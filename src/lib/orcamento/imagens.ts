import sharp from 'sharp';

/**
 * Miniatura dos itens do orçamento, usada no PDF e no DOCX.
 *
 * Reduz antes de embutir: a imagem original do produto tem centenas de KB, e
 * no documento ela aparece com pouco mais de 2 cm.
 */
export async function miniaturaDoItem(url: string | undefined): Promise<Uint8Array | undefined> {
  if (!url) return undefined;
  try {
    const resposta = await fetch(url);
    if (!resposta.ok) return undefined;
    const original = Buffer.from(await resposta.arrayBuffer());
    const reduzida = await sharp(original)
      .resize({ width: 220, height: 220, fit: 'inside' })
      .jpeg({ quality: 72 })
      .toBuffer();
    return new Uint8Array(reduzida);
  } catch {
    // Imagem fora do ar ou formato que o sharp não abre: o item sai sem foto.
    return undefined;
  }
}
