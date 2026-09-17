/**
 * Descrições de imagem: o texto alternativo que os leitores de tela anunciam.
 *
 * No Firestore ficam num mapa ao lado de `imageUrls`:
 *   imageAlts: { [urlDaImagem]: 'o que a foto mostra' }
 * A chave é a própria URL, então reordenar ou remover imagens nunca
 * desalinha as descrições.
 *
 * Imagem sem descrição escrita recebe uma automática com o nome do item e a
 * posição, para o leitor de tela nunca anunciar só "imagem".
 */
export type ImageAlts = Record<string, string>;

export const IMAGE_ALT_MAX_LENGTH = 300;

/** Normaliza o valor vindo do Firestore ou de um payload: só textos não vazios. */
export function readImageAlts(value: unknown): ImageAlts {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const alts: ImageAlts = {};
  for (const [url, text] of Object.entries(value as Record<string, unknown>)) {
    if (typeof text !== 'string') continue;
    const trimmed = text.trim().slice(0, IMAGE_ALT_MAX_LENGTH);
    if (trimmed) alts[url] = trimmed;
  }
  return alts;
}

/** Como `readImageAlts`, mas descarta descrições de URLs que não são do item. */
export function sanitizeImageAlts(value: unknown, urls: string[]): ImageAlts {
  const allowed = new Set(urls);
  return Object.fromEntries(
    Object.entries(readImageAlts(value)).filter(([url]) => allowed.has(url))
  );
}

/**
 * Descrição escrita da imagem ou, na falta dela, a automática:
 * "Nome, imagem 2 de 4", ou só o nome quando o item tem uma imagem.
 */
export function imageAlt(
  name: string,
  url: string,
  alts?: ImageAlts,
  position?: { index: number; total: number }
): string {
  const written = alts?.[url]?.trim();
  if (written) return written;
  if (position && position.total > 1) {
    return `${name}, imagem ${position.index + 1} de ${position.total}`;
  }
  return name;
}

/** Descrição da imagem de capa (a principal, ou a primeira), usada nos cards. */
export function coverImageAlt(item: {
  name: string;
  imageUrls: string[];
  mainImageUrl?: string;
  imageAlts?: ImageAlts;
}): string {
  return imageAlt(item.name, item.mainImageUrl || item.imageUrls[0] || '', item.imageAlts);
}
