import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  firebaseAdminAuth,
  firebaseAdminBucket,
  firebaseAdminDb,
} from '@/lib/firebase/adminServer';
import { coercePriceToCents } from '@/lib/prices/coerceToCents';
import { buildQuotePdf, type QuoteItem } from '@/lib/orcamento/pdf';
import { miniaturaDoItem } from '@/lib/orcamento/imagens';
import { montarRegistro, type ItemRegistrado } from '@/lib/orcamento/registro';
import { COLLECTION_BY_KIND, sanitizeQuantity, type CartKind } from '@/lib/cart/types';

/**
 * Gera o PDF do orçamento, guarda no Storage e registra no Firestore.
 *
 * O que chega do navegador é só tipo, id e quantidade: nome, imagem e preço
 * vêm do banco. Preço só entra no documento quando o pedido traz token de um
 * usuário verified — assim ninguém forja acesso a valores mexendo no payload.
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_ITENS = 60;
/** O PDF some do Storage depois disso (ver /api/cron/limpar-orcamentos). */
const DIAS_ATE_EXPIRAR = 30;

type LinhaRecebida = { kind: CartKind; id: string; quantity: number };

function lerToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [esquema, token] = header.split(' ');
  if (esquema?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
}

async function usuarioVerificado(token: string | null): Promise<{ verified: boolean; uid?: string; email?: string }> {
  if (!token) return { verified: false };
  try {
    const decoded = await firebaseAdminAuth.verifyIdToken(token);
    const perfil = await firebaseAdminDb.collection('userProfiles').doc(decoded.uid).get();
    return {
      verified: perfil.exists && perfil.data()?.verified === true,
      uid: decoded.uid,
      email: decoded.email,
    };
  } catch {
    return { verified: false };
  }
}

function textoLimpo(valor: unknown, maximo = 200): string {
  return typeof valor === 'string' ? valor.trim().slice(0, maximo) : '';
}

async function lerLogo(): Promise<Uint8Array | undefined> {
  try {
    const arquivo = await readFile(path.join(process.cwd(), 'public/images/logo-formwerk-600.png'));
    return new Uint8Array(arquivo);
  } catch {
    return undefined;
  }
}

export async function POST(req: Request) {
  try {
    const corpo = await req.json();
    const linhasBrutas = Array.isArray(corpo?.items) ? corpo.items : [];

    const linhas: LinhaRecebida[] = linhasBrutas
      .filter(
        (l: unknown): l is LinhaRecebida =>
          !!l &&
          typeof (l as LinhaRecebida).id === 'string' &&
          ['produto', 'kit', 'painel'].includes((l as LinhaRecebida).kind),
      )
      .slice(0, MAX_ITENS)
      .map((l: LinhaRecebida) => ({ ...l, quantity: sanitizeQuantity(l.quantity) }));

    if (!linhas.length) {
      return NextResponse.json({ error: 'Carrinho vazio.' }, { status: 400 });
    }

    const cliente = {
      cliente: textoLimpo(corpo?.customer?.cliente),
      documento: textoLimpo(corpo?.customer?.documento, 40),
      endereco: textoLimpo(corpo?.customer?.endereco, 300),
      contato: textoLimpo(corpo?.customer?.contato, 120),
      email: textoLimpo(corpo?.customer?.email, 120),
    };

    if (!cliente.cliente || !cliente.contato) {
      return NextResponse.json(
        { error: 'Informe pelo menos o cliente e o contato/responsável.' },
        { status: 400 },
      );
    }

    const acesso = await usuarioVerificado(lerToken(req));

    // Busca os documentos reais. Um id inexistente é descartado em silêncio:
    // produto desativado entre a visita e o envio não deve derrubar o pedido.
    const itens: QuoteItem[] = [];
    const registro: ItemRegistrado[] = [];

    for (const linha of linhas) {
      const snap = await firebaseAdminDb
        .collection(COLLECTION_BY_KIND[linha.kind])
        .doc(linha.id)
        .get();
      if (!snap.exists) continue;

      const dados = snap.data() ?? {};
      const nome = typeof dados.name === 'string' ? dados.name : '';
      const plural = typeof dados.pluralName === 'string' ? dados.pluralName.trim() : '';
      // "pluralName" existe para isto: 2 unidades viram "Dominós de frações".
      const descricao = linha.quantity > 1 && plural ? plural : nome;
      const imagemUrl =
        typeof dados.mainImageUrl === 'string' && dados.mainImageUrl
          ? dados.mainImageUrl
          : Array.isArray(dados.imageUrls)
            ? dados.imageUrls.find((u: unknown) => typeof u === 'string')
            : undefined;

      const precoCents = coercePriceToCents(dados.priceCents);

      itens.push({
        descricao: descricao || linha.id,
        quantidade: linha.quantity,
        unidade: 'un',
        precoUnitarioCents: acesso.verified ? precoCents : undefined,
        imagem: await miniaturaDoItem(imagemUrl),
      });

      registro.push({
        kind: linha.kind,
        id: linha.id,
        nome: descricao || linha.id,
        quantidade: linha.quantity,
        precoUnitarioCents: precoCents,
      });
    }

    if (!itens.length) {
      return NextResponse.json({ error: 'Nenhum item do carrinho foi encontrado.' }, { status: 400 });
    }

    const agora = new Date();
    const numero = `${agora.getFullYear()}${String(agora.getMonth() + 1).padStart(2, '0')}-${randomUUID().slice(0, 6).toUpperCase()}`;

    const pdf = await buildQuotePdf({
      numero,
      emitidoEm: agora,
      cliente,
      itens,
      mostrarPrecos: acesso.verified,
      logo: await lerLogo(),
    });

    // Token de download: deixa o PDF acessível pela URL padrão do Firebase
    // Storage sem abrir o bucket inteiro para leitura pública.
    const tokenDownload = randomUUID();
    const caminho = `orcamentos/${numero}.pdf`;
    const bucket = firebaseAdminBucket();
    await bucket.file(caminho).save(Buffer.from(pdf), {
      contentType: 'application/pdf',
      metadata: { metadata: { firebaseStorageDownloadTokens: tokenDownload } },
    });

    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
      caminho,
    )}?alt=media&token=${tokenDownload}`;

    const expiraEm = new Date(agora.getTime() + DIAS_ATE_EXPIRAR * 24 * 60 * 60 * 1000);

    // Dados do cliente, itens, valores e o link com token vão cifrados; só
    // número, uid, datas e caminho do arquivo ficam legíveis no banco.
    await firebaseAdminDb
      .collection('orcamentos')
      .doc(numero)
      .set(
        montarRegistro({
          numero,
          solicitanteUid: acesso.uid ?? null,
          comPreco: acesso.verified,
          criadoEm: agora,
          expiraEm,
          pdfPath: caminho,
          conteudo: {
            cliente,
            itens: registro,
            totalCents: registro.reduce(
              (soma, i) => soma + Number(i.precoUnitarioCents ?? 0) * Number(i.quantidade ?? 0),
              0,
            ),
            pdfUrl: url,
            solicitanteEmail: acesso.email ?? null,
          },
        }),
      );

    return NextResponse.json({ numero, url, expiraEm: expiraEm.toISOString() });
  } catch (erro) {
    console.error('Erro ao gerar orçamento:', erro);
    return NextResponse.json({ error: 'Não foi possível gerar o orçamento.' }, { status: 500 });
  }
}
