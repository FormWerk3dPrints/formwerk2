export function normalizeText(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function slugify(input: string): string {
  return normalizeText(input)
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const STOPWORDS = new Set([
  'a',
  'o',
  'as',
  'os',
  'um',
  'uma',
  'uns',
  'umas',
  'de',
  'do',
  'da',
  'dos',
  'das',
  'e',
  'em',
  'no',
  'na',
  'nos',
  'nas',
  'para',
  'por',
  'com',
  'sem',
  'ao',
  'aos',
  'à',
  'às',
 ]);

export function tokenize(input: string): string[] {
  const normalized = normalizeText(input);
  if (!normalized) return [];

  const rawTokens = normalized.split(' ');
  const tokens = rawTokens
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => !STOPWORDS.has(t));

  return Array.from(new Set(tokens));
}

export function splitKeywords(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(',')
        .map((k) => normalizeText(k))
        .filter(Boolean)
    )
  );
}
