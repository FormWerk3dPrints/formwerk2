import 'server-only';

import {
  collection,
  getDocs,
  limit,
  query,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { firestoreServerDb } from '@/lib/firebase/server';
import { tokenize } from '@/lib/text/normalize';

export interface ProductSearchResult {
  id: string; // slug
  categoryId: string;
  name: string;
  description: string;
  imageUrls: string[];
  mainImageUrl?: string;
  nameTokens: string[];
  keywords: string[];
  active: boolean;
}

export interface ProductSuggestion {
  id: string; // slug
  name: string;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? (value as unknown[]).map(String).map((s) => s.trim()).filter(Boolean)
    : [];
}

function mapProductDoc(id: string, data: DocumentData): ProductSearchResult {
  const imageUrls = Array.isArray(data.imageUrls)
    ? (data.imageUrls as string[]).filter(Boolean)
    : [];

  return {
    id: String(id),
    categoryId: typeof data.categoryId === 'string' ? data.categoryId : '',
    name: typeof data.name === 'string' ? data.name : '',
    description: typeof data.description === 'string' ? data.description : '',
    imageUrls,
    mainImageUrl: typeof data.mainImageUrl === 'string' ? data.mainImageUrl : undefined,
    nameTokens: asStringArray(data.nameTokens),
    keywords: asStringArray(data.keywords),
    active: data.active !== false,
  };
}

function scoreByOverlap(searchTokens: string[], docTokens: string[]): number {
  if (!searchTokens.length || !docTokens.length) return 0;
  const set = new Set(docTokens);
  let score = 0;
  for (const t of searchTokens) if (set.has(t)) score += 1;
  return score;
}

function scoreBySubstring(searchTokens: string[], docTokens: string[]): number {
  if (!searchTokens.length || !docTokens.length) return 0;

  let score = 0;
  for (const t of searchTokens) {
    let matched = false;
    for (const dt of docTokens) {
      if (dt === t) {
        // match exato deve ter prioridade
        score += 100 + t.length;
        matched = true;
        break;
      }
      if (dt.includes(t)) {
        score += t.length;
        matched = true;
        break;
      }
    }
    if (!matched) continue;
  }

  return score;
}

function uniqById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

const ACTIVE_PRODUCTS_CACHE: {
  expiresAt: number;
  max: number;
  products: ProductSearchResult[];
} = {
  expiresAt: 0,
  max: 0,
  products: [],
};

async function getActiveProductsCached(max: number): Promise<ProductSearchResult[]> {
  const now = Date.now();
  if (ACTIVE_PRODUCTS_CACHE.expiresAt > now && ACTIVE_PRODUCTS_CACHE.max >= max) {
    return ACTIVE_PRODUCTS_CACHE.products.slice(0, max);
  }

  const productsQuery = query(
    collection(firestoreServerDb, 'products'),
    where('active', '==', true),
    limit(max)
  );

  const snap = await getDocs(productsQuery);
  const products = snap.docs.map((d) => mapProductDoc(d.id, d.data()));

  ACTIVE_PRODUCTS_CACHE.products = products;
  ACTIVE_PRODUCTS_CACHE.max = max;
  // TTL curto para refletir updates sem pesar no Firestore
  ACTIVE_PRODUCTS_CACHE.expiresAt = now + 60_000;

  return products;
}

export async function searchProductsByTokens(input: {
  q: string;
  maxTokens?: number;
  maxPerGroup?: number;
}): Promise<{
  tokens: string[];
  nameMatches: ProductSearchResult[];
  keywordMatches: ProductSearchResult[];
}> {
  const maxTokens = input.maxTokens ?? 10;
  const maxPerGroup = input.maxPerGroup ?? 200;

  const tokens = tokenize(input.q).slice(0, maxTokens);
  if (!tokens.length) {
    return { tokens, nameMatches: [], keywordMatches: [] };
  }

  const poolMax = Math.max(maxPerGroup * 10, 500);
  const productsPool = await getActiveProductsCached(poolMax);

  const nameMatches = productsPool
    .map((p) => ({ p, score: scoreBySubstring(tokens, p.nameTokens) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name))
    .map((x) => x.p);

  const nameIds = new Set(nameMatches.map((p) => p.id));

  const keywordMatches = productsPool
    .filter((p) => !nameIds.has(p.id))
    .map((p) => ({ p, score: scoreBySubstring(tokens, p.keywords) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name))
    .map((x) => x.p);

  return { tokens, nameMatches, keywordMatches };
}

export async function getProductSuggestions(input: {
  q: string;
  limit: number;
}): Promise<{
  tokens: string[];
  suggestions: ProductSuggestion[];
}> {
  const { tokens, nameMatches, keywordMatches } = await searchProductsByTokens({
    q: input.q,
    maxTokens: 10,
    maxPerGroup: 50,
  });

  const nameSuggestions: ProductSuggestion[] = nameMatches.map((p) => ({
    id: p.id,
    name: p.name,
  }));
  const keywordSuggestions: ProductSuggestion[] = keywordMatches.map((p) => ({
    id: p.id,
    name: p.name,
  }));

  const merged = [...nameSuggestions, ...keywordSuggestions].slice(0, input.limit);

  return { tokens, suggestions: merged };
}
