import { NextResponse } from 'next/server';
import { firebaseAdminBucket, firebaseAdminDb } from '@/lib/firebase/adminServer';

/**
 * Apaga os PDFs de orçamento vencidos (30 dias) e marca o registro.
 *
 * Roda pelo cron da Vercel, que manda `Authorization: Bearer $CRON_SECRET`.
 * O registro no Firestore continua — some só o arquivo, que é o que ocupa
 * espaço e fica acessível por link.
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

function autorizado(req: Request): boolean {
  const segredo = process.env.CRON_SECRET;
  // Sem segredo configurado, a rota não roda: melhor não apagar nada do que
  // deixar qualquer um disparar a limpeza.
  if (!segredo) return false;
  const header = req.headers.get('authorization');
  return header === `Bearer ${segredo}`;
}

export async function GET(req: Request) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: 'nao-autorizado' }, { status: 401 });
  }

  try {
    const agora = new Date();
    // Uma desigualdade só: filtrar também por pdfPath exigiria índice
    // composto. Quem já teve o arquivo apagado é descartado no laço.
    const vencidos = await firebaseAdminDb
      .collection('orcamentos')
      .where('expiraEm', '<=', agora)
      .limit(200)
      .get();

    const bucket = firebaseAdminBucket();
    let apagados = 0;

    for (const doc of vencidos.docs) {
      const caminho = doc.data().pdfPath;
      if (typeof caminho !== 'string' || !caminho) continue;
      try {
        await bucket.file(caminho).delete({ ignoreNotFound: true });
      } catch {
        // Arquivo já removido à mão: segue e limpa o registro mesmo assim.
      }
      // pdfPath nulo é o que marca "não há mais arquivo": as leituras usam
      // isso para parar de oferecer o link, que vive cifrado no conteúdo.
      await doc.ref.update({ pdfPath: null, pdfApagadoEm: agora });
      apagados++;
    }

    return NextResponse.json({ apagados });
  } catch (erro) {
    console.error('Erro ao limpar orçamentos:', erro);
    return NextResponse.json({ error: 'falha-na-limpeza' }, { status: 500 });
  }
}
