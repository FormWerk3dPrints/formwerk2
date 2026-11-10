import { NextResponse } from 'next/server';
import { firebaseAdminAuth, firebaseAdminDb } from '@/lib/firebase/adminServer';
import { lerConteudo } from '@/lib/orcamento/registro';

/**
 * Lista os orçamentos pedidos pelo site, para o admin.
 *
 * Vai por API em vez de leitura direta do Firestore porque a coleção
 * `orcamentos` cai no bloqueio geral das regras: aqui quem lê é o Admin SDK,
 * depois de conferir que o e-mail está ativo em `admins`.
 */

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
}

async function assertAdminAccess(req: Request): Promise<void> {
  const token = getBearerToken(req);
  if (!token) throw new Error('missing-token');

  const decoded = await firebaseAdminAuth.verifyIdToken(token);
  const email = decoded.email?.trim().toLowerCase();
  if (!email) throw new Error('forbidden');

  const adminDoc = await firebaseAdminDb.collection('admins').doc(email).get();
  if (!adminDoc.exists || adminDoc.data()?.active !== true) throw new Error('forbidden');
}

function paraData(valor: unknown): string | null {
  if (valor && typeof valor === 'object' && 'toDate' in valor) {
    const d = (valor as { toDate: () => Date }).toDate();
    return d instanceof Date ? d.toISOString() : null;
  }
  return null;
}

export async function GET(req: Request) {
  try {
    await assertAdminAccess(req);

    const snap = await firebaseAdminDb
      .collection('orcamentos')
      .orderBy('criadoEm', 'desc')
      .limit(200)
      .get();

    const orcamentos = snap.docs.map((doc) => {
      const d = doc.data();
      // Cliente, itens, total e link do PDF vêm cifrados do banco.
      const conteudo = lerConteudo(d);
      const expirado = d.pdfPath == null;
      return {
        numero: typeof d.numero === 'string' ? d.numero : doc.id,
        cliente: conteudo.cliente,
        itens: conteudo.itens,
        totalCents: conteudo.totalCents,
        comPreco: d.comPreco === true,
        solicitanteEmail: conteudo.solicitanteEmail,
        // Sem arquivo no Storage, o link guardado não serve para nada.
        pdfUrl: expirado ? null : conteudo.pdfUrl,
        criadoEm: paraData(d.criadoEm),
        expiraEm: paraData(d.expiraEm),
      };
    });

    return NextResponse.json({ orcamentos });
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : 'erro';
    const status = motivo === 'missing-token' ? 401 : motivo === 'forbidden' ? 403 : 500;
    return NextResponse.json({ error: motivo }, { status });
  }
}
