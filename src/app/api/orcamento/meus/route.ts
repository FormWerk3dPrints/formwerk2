import { NextResponse } from 'next/server';
import { firebaseAdminAuth, firebaseAdminDb } from '@/lib/firebase/adminServer';
import { getBearerToken } from '@/lib/admin/assertAdmin';
import { lerConteudo } from '@/lib/orcamento/registro';

/**
 * Histórico de orçamentos de quem está logado, para a página Minha Conta.
 *
 * O registro em JSON nunca é apagado, então o histórico continua completo
 * depois dos 30 dias — o que some é o link do PDF.
 *
 * Preço só volta para quem é `verified`, igual ao resto do site: o documento
 * guarda o valor de tabela mesmo quando o pedido veio sem acesso a preço.
 */

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'missing-token' }, { status: 401 });

    const decoded = await firebaseAdminAuth.verifyIdToken(token);
    const perfil = await firebaseAdminDb.collection('userProfiles').doc(decoded.uid).get();
    const verified = perfil.exists && perfil.data()?.verified === true;

    const snap = await firebaseAdminDb
      .collection('orcamentos')
      .where('solicitanteUid', '==', decoded.uid)
      .limit(100)
      .get();

    const agora = Date.now();
    const orcamentos = snap.docs
      .map((doc) => {
        const d = doc.data();
        // Itens, valores e link do PDF estão cifrados no banco.
        const conteudo = lerConteudo(d);
        const criadoEm =
          d.criadoEm && typeof d.criadoEm.toDate === 'function' ? d.criadoEm.toDate() : null;
        const expiraEm =
          d.expiraEm && typeof d.expiraEm.toDate === 'function' ? d.expiraEm.toDate() : null;
        const valido = expiraEm ? expiraEm.getTime() > agora && d.pdfPath != null : false;

        const itens = conteudo.itens.map((i) => ({
          nome: typeof i.nome === 'string' ? i.nome : '?',
          quantidade: typeof i.quantidade === 'number' ? i.quantidade : 1,
          precoUnitarioCents: verified ? (i.precoUnitarioCents ?? null) : null,
        }));

        return {
          numero: typeof d.numero === 'string' ? d.numero : doc.id,
          criadoEm: criadoEm ? criadoEm.toISOString() : null,
          expiraEm: expiraEm ? expiraEm.toISOString() : null,
          valido,
          itens,
          totalCents: verified ? conteudo.totalCents : null,
          // O link só vale enquanto o arquivo existe no Storage.
          pdfUrl: valido ? conteudo.pdfUrl : null,
        };
      })
      // Ordena aqui em vez de no Firestore: com o filtro por uid, o orderBy
      // exigiria índice composto.
      .sort((a, b) => (b.criadoEm ?? '').localeCompare(a.criadoEm ?? ''));

    return NextResponse.json({ verified, orcamentos });
  } catch {
    return NextResponse.json({ error: 'falha' }, { status: 500 });
  }
}
