import { NextResponse } from 'next/server';
import { assertAdminAccess, statusDoErro } from '@/lib/admin/assertAdmin';
import { firebaseAdminDb } from '@/lib/firebase/adminServer';
import { buildQuoteDocx } from '@/lib/orcamento/docx';
import { miniaturaDoItem } from '@/lib/orcamento/imagens';
import { COLLECTION_BY_KIND, type CartKind } from '@/lib/cart/types';
import { lerConteudo, type ItemRegistrado } from '@/lib/orcamento/registro';
import type { QuoteItem } from '@/lib/orcamento/pdf';

/**
 * Baixa um orçamento em DOCX, para edição no Word.
 *
 * Monta a partir do JSON guardado no Firestore, que nunca é apagado — por
 * isso funciona mesmo depois dos 30 dias, quando o PDF já saiu do Storage.
 * As imagens são buscadas de novo pelo id de cada item.
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

async function imagemDoItem(item: ItemRegistrado): Promise<Uint8Array | undefined> {
  const kind = item.kind as CartKind | undefined;
  if (!kind || !item.id || !COLLECTION_BY_KIND[kind]) return undefined;
  try {
    const snap = await firebaseAdminDb.collection(COLLECTION_BY_KIND[kind]).doc(item.id).get();
    if (!snap.exists) return undefined;
    const dados = snap.data() ?? {};
    const url =
      typeof dados.mainImageUrl === 'string' && dados.mainImageUrl
        ? dados.mainImageUrl
        : Array.isArray(dados.imageUrls)
          ? dados.imageUrls.find((u: unknown) => typeof u === 'string')
          : undefined;
    return miniaturaDoItem(url);
  } catch {
    // Produto apagado depois do orçamento: o DOCX sai sem a foto dele.
    return undefined;
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ numero: string }> }) {
  try {
    await assertAdminAccess(req);

    const { numero } = await params;
    const snap = await firebaseAdminDb.collection('orcamentos').doc(numero).get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'nao-encontrado' }, { status: 404 });
    }

    const dados = snap.data() ?? {};
    const conteudo = lerConteudo(dados);
    const registrados = conteudo.itens;

    const itens: QuoteItem[] = [];
    for (const item of registrados) {
      itens.push({
        descricao: typeof item.nome === 'string' ? item.nome : (item.id ?? '?'),
        quantidade: typeof item.quantidade === 'number' ? item.quantidade : 1,
        unidade: 'un',
        precoUnitarioCents:
          typeof item.precoUnitarioCents === 'number' ? item.precoUnitarioCents : undefined,
        imagem: await imagemDoItem(item),
      });
    }

    const criadoEm =
      dados.criadoEm && typeof dados.criadoEm.toDate === 'function'
        ? dados.criadoEm.toDate()
        : new Date();

    const docx = await buildQuoteDocx({
      numero,
      emitidoEm: criadoEm,
      cliente: conteudo.cliente,
      itens,
      // Pedido de visitante sai com as colunas de valor em branco, para serem
      // preenchidas à mão — foi o combinado.
      mostrarPrecos: dados.comPreco === true,
    });

    return new NextResponse(new Uint8Array(docx), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="orcamento-${numero}.docx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (erro) {
    const status = statusDoErro(erro);
    if (status === 500) console.error('Erro ao gerar DOCX:', erro);
    return NextResponse.json({ error: 'falha-no-docx' }, { status });
  }
}
