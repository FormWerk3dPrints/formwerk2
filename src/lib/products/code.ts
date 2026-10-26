/**
 * Código interno do produto: letras, traço e número — FW-0007, KT-12, PN-003.
 *
 * Vive só no admin: não aparece em nenhuma página pública. Os produtos que já
 * existiam ficam sem código até alguém preencher pela planilha, por isso tudo
 * aqui trata string vazia como "ainda não tem", e não como erro.
 *
 * Regra de ouro: a planilha manda. O que for digitado é gravado como está
 * (só o prefixo vira maiúsculo e o separador vira traço), sem completar com
 * zeros — senão PN-003 viraria PN-0003 e deixaria de bater com a planilha.
 * A exceção é digitar um número solto, atalho que assume o prefixo padrão.
 */

/** Prefixo usado na sugestão automática e no atalho de digitar só o número. */
export const DEFAULT_CODE_PREFIX = 'FW';

/** Dígitos da sugestão automática. Passando de 9999, o código cresce. */
const DIGITS = 4;

/** 7 vira FW-0007. */
export function formatProductCode(numero: number, prefixo: string = DEFAULT_CODE_PREFIX): string {
  return `${prefixo}-${String(numero).padStart(DIGITS, '0')}`;
}

/**
 * Normaliza o que foi digitado:
 *   "kt 12" e "kt-12"  →  "KT-12"   (dígitos preservados)
 *   "7"                →  "FW-0007" (atalho do prefixo padrão)
 *   ""                 →  ""        (produto ainda sem código)
 *   "abc", "FW"        →  null      (não dá para entender)
 */
export function normalizeProductCode(bruto: string): string | null {
  const limpo = bruto.trim();
  if (!limpo) return '';

  // Número solto: atalho para o prefixo padrão, com zeros à esquerda.
  const soNumero = /^(\d{1,9})$/.exec(limpo);
  if (soNumero) {
    const numero = Number(soNumero[1]);
    if (!Number.isSafeInteger(numero) || numero <= 0) return null;
    return formatProductCode(numero);
  }

  const match = /^([A-Za-z]{1,8})[\s._-]*(\d{1,9})$/.exec(limpo);
  if (!match) return null;

  const numero = Number(match[2]);
  if (!Number.isSafeInteger(numero) || numero <= 0) return null;

  return `${match[1].toUpperCase()}-${match[2]}`;
}

/**
 * Forma usada só para comparar: prefixo mais o número sem zeros à esquerda.
 * É o que faz FW-7 e FW-0007 contarem como o mesmo código.
 */
export function canonicalProductCode(code: string | undefined | null): string | null {
  if (!code) return null;
  const match = /^([A-Za-z]{1,8})[\s._-]*(\d{1,9})$/.exec(code.trim());
  if (!match) return null;
  const numero = Number(match[2]);
  if (!Number.isSafeInteger(numero)) return null;
  return `${match[1].toUpperCase()}-${numero}`;
}

/** Prefixo de um código, em maiúsculas, ou null. */
export function productCodePrefix(code: string | undefined | null): string | null {
  const canonico = canonicalProductCode(code);
  return canonico ? canonico.split('-')[0] : null;
}

/** Número de um código, ignorando zeros à esquerda, ou null. */
export function productCodeNumber(code: string | undefined | null): number | null {
  const canonico = canonicalProductCode(code);
  return canonico ? Number(canonico.split('-')[1]) : null;
}

/**
 * Próximo código livre do prefixo padrão, um acima do maior FW que existe.
 * Códigos de outros prefixos não entram na conta. Com a lista vazia, começa
 * em FW-0001.
 */
export function nextProductCode(existentes: Array<string | undefined | null>): string {
  const maior = existentes.reduce<number>((max, code) => {
    if (productCodePrefix(code) !== DEFAULT_CODE_PREFIX) return max;
    const numero = productCodeNumber(code);
    return numero !== null && numero > max ? numero : max;
  }, 0);

  return formatProductCode(maior + 1);
}

/**
 * Procura outro produto com o mesmo código, comparando pela forma canônica —
 * KT-7 e KT-007 são o mesmo código. Devolve o dono, para a mensagem de erro
 * dizer com quem está o conflito.
 */
export function findProductCodeOwner(
  code: string,
  produtos: Array<{ id: string; name: string; code?: string }>,
  ignorarId?: string,
): { id: string; name: string; code: string } | null {
  const alvo = canonicalProductCode(code);
  if (!alvo) return null;

  const dono = produtos.find(
    (p) => p.id !== ignorarId && canonicalProductCode(p.code) === alvo,
  );
  return dono ? { id: dono.id, name: dono.name, code: dono.code ?? '' } : null;
}
