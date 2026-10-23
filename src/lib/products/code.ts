/**
 * Código interno do produto, no formato FW-0001.
 *
 * Vive só no admin: não aparece em nenhuma página pública. Os produtos que já
 * existiam ficam sem código até alguém preencher pela planilha, por isso tudo
 * aqui trata string vazia como "ainda não tem", e não como erro.
 */

export const PRODUCT_CODE_PREFIX = 'FW-';

/** Quantidade mínima de dígitos. Passando de 9999, o código simplesmente cresce. */
const DIGITS = 4;

/** 7 vira FW-0007. */
export function formatProductCode(numero: number): string {
  return `${PRODUCT_CODE_PREFIX}${String(numero).padStart(DIGITS, '0')}`;
}

/**
 * Aceita o que for digitado — "7", "fw7", "FW 7", "fw-0007" — e devolve sempre
 * FW-0007. Devolve string vazia quando o campo está vazio (produto sem código)
 * e null quando não dá para entender o que foi digitado.
 */
export function normalizeProductCode(bruto: string): string | null {
  const limpo = bruto.trim();
  if (!limpo) return '';

  const match = /^(?:fw[\s_-]*)?(\d{1,9})$/i.exec(limpo);
  if (!match) return null;

  const numero = Number(match[1]);
  if (!Number.isSafeInteger(numero) || numero <= 0) return null;

  return formatProductCode(numero);
}

/** Número dentro de um código, ou null se não for um código válido. */
export function productCodeNumber(code: string | undefined | null): number | null {
  if (!code) return null;
  const match = /^fw-(\d{1,9})$/i.exec(code.trim());
  if (!match) return null;
  const numero = Number(match[1]);
  return Number.isSafeInteger(numero) ? numero : null;
}

/**
 * Próximo código livre, um acima do maior que já existe. Com a lista vazia,
 * começa em FW-0001.
 */
export function nextProductCode(existentes: Array<string | undefined | null>): string {
  const maior = existentes.reduce<number>((max, code) => {
    const numero = productCodeNumber(code);
    return numero !== null && numero > max ? numero : max;
  }, 0);

  return formatProductCode(maior + 1);
}

/**
 * Procura outro produto com o mesmo código. Devolve o nome do dono do código,
 * para a mensagem de erro dizer com quem está o conflito.
 */
export function findProductCodeOwner(
  code: string,
  produtos: Array<{ id: string; name: string; code?: string }>,
  ignorarId?: string,
): { id: string; name: string } | null {
  if (!code) return null;
  const dono = produtos.find((p) => p.id !== ignorarId && (p.code ?? '') === code);
  return dono ? { id: dono.id, name: dono.name } : null;
}
