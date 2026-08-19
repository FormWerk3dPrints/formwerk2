/**
 * Normaliza o `priceCents` gravado no Firestore para centavos inteiros.
 *
 * Parte dos produtos foi salva como reais decimais (89.9 = R$ 89,90) em vez de
 * centavos (8990). Inteiro é lido como centavo; decimal é multiplicado por 100.
 * Mesma regra usada em /admin/emissao — manter as duas alinhadas evita preço
 * divergente entre o que o cliente vê e o que é registrado na venda.
 */
export function coercePriceToCents(value: unknown): number {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return 0;
    return Number.isInteger(value) ? value : Math.round(value * 100);
  }
  if (typeof value === 'string') {
    const normalized = value
      .replace(/[^\d,.-]/g, '')
      .replace(/\./g, '')
      .replace(',', '.');
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.round(parsed * 100);
  }
  return 0;
}

/**
 * Converte o que o admin digita (em REAIS) para centavos inteiros.
 * Aceita "119,90", "119.90", "1.199,90" e "119". Devolve null se não for
 * número válido — o chamador decide o que fazer com isso.
 * String vazia é 0 ("sem preço"), não erro.
 */
export function parseReaisToCents(input: string): number | null {
  const raw = input.trim();
  if (raw === '') return 0;

  const cleaned = raw.replace(/[^\d.,-]/g, '');
  // Sem nenhum dígito não é preço — devolver 0 aqui zeraria o valor sem avisar.
  if (!/\d/.test(cleaned)) return null;
  if (cleaned.includes('-')) return null;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  /* Qual símbolo é o separador decimal:
     - os dois presentes  -> o que vier por último (1.199,90 e 1,199.90)
     - só vírgula         -> decimal
     - só ponto           -> decimal se sobrarem 1–2 dígitos (119.90);
                             com 3, é separador de milhar (1.199)          */
  let decimalIndex = -1;
  if (lastComma !== -1 && lastDot !== -1) {
    decimalIndex = Math.max(lastComma, lastDot);
  } else if (lastComma !== -1) {
    decimalIndex = lastComma;
  } else if (lastDot !== -1) {
    const digitsAfter = cleaned.length - lastDot - 1;
    if (digitsAfter > 0 && digitsAfter <= 2) decimalIndex = lastDot;
  }

  const normalized =
    decimalIndex === -1
      ? cleaned.replace(/[.,]/g, '')
      : `${cleaned.slice(0, decimalIndex).replace(/[.,]/g, '') || '0'}.` +
        cleaned.slice(decimalIndex + 1).replace(/[.,]/g, '');

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

export function formatCents(cents: number, currency = 'BRL'): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: currency || 'BRL',
  });
}
