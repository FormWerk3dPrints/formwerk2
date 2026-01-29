function parseMoneyToCents(input: string): number | null {
  const raw = String(input ?? '').trim();
  if (!raw) return null;

  // Accept "1.234,56", "1234,56", "1234.56", "1234"
  const normalized = raw.replace(/\s+/g, '').replace(/\./g, '').replace(',', '.');
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

// Mirrors /admin/emissao formatting (no currency symbol).
export function formatCentsBRL(cents: number): string {
  const value = Number.isFinite(cents) ? cents : 0;
  return (value / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Mirrors /admin/emissao coercion for legacy storage.
export function coerceFirestorePriceToCents(value: unknown): number {
  // Supports legacy storage where "priceCents" may actually be stored as decimal reais (e.g. 12.34).
  // Normalize everything to integer cents.
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return 0;
    if (Number.isInteger(value)) return value;
    return Math.round(value * 100);
  }

  if (typeof value === 'string') {
    const parsed = parseMoneyToCents(value);
    return parsed ?? 0;
  }

  return 0;
}

// Price label for UI badges, matching the /admin convention "R$" + formatted value.
export function formatBRLFromFirestorePrice(value: unknown): string {
  const cents = coerceFirestorePriceToCents(value);
  if (!Number.isFinite(cents) || cents <= 0) return '';
  return `R$ ${formatCentsBRL(cents)}`;
}
