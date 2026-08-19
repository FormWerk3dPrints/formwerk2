import { NextResponse } from 'next/server';
import { firebaseAdminAuth, firebaseAdminDb } from '@/lib/firebase/adminServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* O log NÃO pode ser um arquivo em disco: na Vercel o filesystem é efêmero e
   somente-leitura, então cada deploy (ou cada instância fria) perderia o
   histórico. As linhas ficam numa coleção append-only do Firestore e o .txt é
   montado sob demanda no GET, mantendo o mesmo formato de linha. */
const COLLECTION = 'adminAuditLogs';
/** Teto de linhas devolvidas no .txt, para não estourar memória/tempo da função. */
const MAX_LINES = 10000;

const ENTITIES = ['produto', 'kit', 'categoria'] as const;
const ACTIONS = ['cadastro', 'alteracao', 'delecao'] as const;
type Entity = (typeof ENTITIES)[number];
type Action = (typeof ACTIONS)[number];

const ACTION_LABEL: Record<Action, string> = {
  cadastro: 'cadastro',
  alteracao: 'alteração',
  delecao: 'deleção',
};

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
}

/** Só admin escreve ou lê o log. */
async function getAdminEmail(token: string): Promise<string | null> {
  try {
    const decoded = await firebaseAdminAuth.verifyIdToken(token);
    const email = typeof decoded.email === 'string' ? decoded.email.toLowerCase() : '';
    if (!email) return null;
    const snap = await firebaseAdminDb.collection('admins').doc(email).get();
    if (!snap.exists || snap.data()?.active !== true) return null;
    return email;
  } catch {
    return null;
  }
}

/** dd/MM/aaaa HH:mm:ss no fuso de São Paulo — não depende do fuso do servidor. */
function localDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

/** Colchetes no conteúdo quebrariam o formato do log. */
function sanitize(value: string): string {
  return value.replace(/[[\]\r\n]+/g, ' ').trim() || '(sem nome)';
}

function formatLine(entry: {
  entity: string;
  name: string;
  userEmail: string;
  action: Action;
  at: Date;
}): string {
  return (
    `[${entry.entity}] [${entry.name}] [${entry.userEmail}] ` +
    `[${localDateTime(entry.at)}] [${ACTION_LABEL[entry.action] ?? entry.action}]`
  );
}

export async function POST(req: Request) {
  try {
    const token = getBearerToken(req);
    const email = token ? await getAdminEmail(token) : null;
    if (!email) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = (await req.json()) as { entity?: string; name?: string; action?: string };
    const entity = body.entity as Entity;
    const action = body.action as Action;
    if (!ENTITIES.includes(entity) || !ACTIONS.includes(action)) {
      return NextResponse.json({ error: 'Entidade ou ação inválida' }, { status: 400 });
    }

    await firebaseAdminDb.collection(COLLECTION).add({
      entity,
      name: sanitize(String(body.name ?? '')),
      userEmail: email,
      action,
      // createdAt é a fonte da ordem; o texto é formatado na leitura.
      createdAt: new Date(),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Erro ao gravar log' }, { status: 500 });
  }
}

/** Devolve o log inteiro como texto puro. `?download=1` força salvar o arquivo. */
export async function GET(req: Request) {
  const token = getBearerToken(req);
  const email = token ? await getAdminEmail(token) : null;
  if (!email) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const snap = await firebaseAdminDb
      .collection(COLLECTION)
      .orderBy('createdAt', 'asc')
      .limit(MAX_LINES)
      .get();

    const lines = snap.docs.map((doc) => {
      const data = doc.data();
      const createdAt: Date =
        typeof data.createdAt?.toDate === 'function' ? data.createdAt.toDate() : new Date(0);
      return formatLine({
        entity: String(data.entity ?? ''),
        name: String(data.name ?? ''),
        userEmail: String(data.userEmail ?? ''),
        action: data.action as Action,
        at: createdAt,
      });
    });

    const body = lines.length > 0 ? lines.join('\n') + '\n' : '';
    const download = new URL(req.url).searchParams.get('download') === '1';

    return new Response(body, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        ...(download
          ? { 'Content-Disposition': 'attachment; filename="admin-audit.txt"' }
          : {}),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Erro ao ler log' }, { status: 500 });
  }
}
