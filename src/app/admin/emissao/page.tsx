'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  type Timestamp,
  updateDoc,
} from 'firebase/firestore';

import { firebaseAuth, firestoreDb } from '@/lib/firebase/client';
import { isAdminEmail } from '@/lib/firebase/admin';
import { normalizeText, splitKeywords, tokenize } from '@/lib/text/normalize';
import { incrementGlobalSalesCount } from '@/lib/stats/incrementGlobalSalesCount';
import { useSmoothScroller } from '@/components/ScrollContext';

type Product = {
  id: string; // slug
  name: string;
  pluralName: string;
  nameTokens: string[];
  keywords: string[];
  priceCents: number;
  currency: string;
  salesCount: number;
  active: boolean;
  createdAt?: Timestamp;
};

type SelectedItem = {
  productId: string;
  quantity: number;
  useDefaultPrice: boolean;
  manualUnitPrice: string; // "12,34" or "12.34" or "12"
};

function pad2(n: number): string {
  const v = Math.max(0, Math.floor(n));
  return String(v).padStart(2, '0');
}

function formatCentsBRL(cents: number): string {
  const value = Number.isFinite(cents) ? cents : 0;
  return (value / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function coerceFirestorePriceToCents(value: unknown): number {
  // Supports legacy storage where "priceCents" may actually be stored as decimal reais (e.g. 12.34).
  // We normalize everything to integer cents for calculations.
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

function parseMoneyToCents(input: string): number | null {
  const raw = String(input ?? '').trim();
  if (!raw) return null;

  // Accept "1.234,56", "1234,56", "1234.56", "1234"
  const normalized = raw.replace(/\s+/g, '').replace(/\./g, '').replace(',', '.');
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

function clampDiscountPct(value: number): number {
  const v = Number.isFinite(value) ? value : 0;
  return Math.min(100, Math.max(0, v));
}

function applyDiscountToCents(cents: number, discountPct: number): number {
  const pct = clampDiscountPct(discountPct);
  return Math.round(cents * (100 - pct) / 100);
}

export default function EmissaoPage() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCheckDone, setAdminCheckDone] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');

  const [selected, setSelected] = useState<SelectedItem[]>([]);
  const [discountPct, setDiscountPct] = useState<number>(0);

  const [popup, setPopup] = useState<{ title: string; lines: string[] } | null>(null);
  const lenisRef = useSmoothScroller();

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, (user) => {
      setAuthUser(user);
      setAuthLoading(false);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!authUser?.email) {
      setIsAdmin(false);
      setAdminCheckDone(true);
      return;
    }
    isAdminEmail(authUser.email).then((result) => {
      setIsAdmin(result);
      setAdminCheckDone(true);
    });
  }, [authUser?.email, authLoading]);

  async function handleLogin() {
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(firebaseAuth, provider);
    } catch (e) {
      console.error(e);
      setError('Falha no login com Google.');
    }
  }

  async function handleLogout() {
    setError(null);
    try {
      await signOut(firebaseAuth);
    } catch (e) {
      console.error(e);
      setError('Falha ao sair.');
    }
  }

  async function refreshProducts() {
    setError(null);
    setDataLoading(true);

    try {
      const productsQuery = query(
        collection(firestoreDb, 'products'),
        orderBy('createdAt', 'desc'),
        limit(500)
      );
      const snap = await getDocs(productsQuery);
      const loaded: Product[] = snap.docs
        .map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: String(d.id),
            name: String(data.name ?? ''),
            pluralName: typeof data.pluralName === 'string' ? data.pluralName.trim() : '',
            nameTokens: Array.isArray(data.nameTokens) ? data.nameTokens : [],
            keywords: Array.isArray(data.keywords) ? data.keywords : [],
            priceCents: coerceFirestorePriceToCents(data.priceCents),
            currency: String(data.currency ?? 'BRL'),
            salesCount: typeof data.salesCount === 'number' ? data.salesCount : 0,
            active: !!data.active,
            createdAt: data.createdAt as Timestamp | undefined,
          };
        })
        .filter((p) => p.active);

      setProducts(loaded);
    } catch (e) {
      console.error(e);
      setError('Erro ao carregar produtos.');
    } finally {
      setDataLoading(false);
    }
  }

  useEffect(() => {
    const lenis = lenisRef?.current;
    if (popup) {
      lenis?.stop();
    } else {
      lenis?.start();
    }
    return () => { lenis?.start(); };
  }, [popup, lenisRef]);

  useEffect(() => {
    if (!authLoading && isAdmin) {
      void refreshProducts();
    }
  }, [authLoading, isAdmin]);

  const filteredProducts = useMemo(() => {
    const qn = normalizeText(search);
    if (!qn) return products;

    const tokens = Array.from(new Set([...tokenize(search), ...splitKeywords(search)]));

    const scored = products
      .map((p) => {
        const nameIncludes = normalizeText(p.name).includes(qn) ? 3 : 0;
        const tokenNameHits = tokens.reduce((acc, t) => acc + (p.nameTokens.includes(t) ? 1 : 0), 0);
        const tokenKeywordHits = tokens.reduce((acc, t) => acc + (p.keywords.some((k) => k.includes(t)) ? 1 : 0), 0);

        const scoreName = nameIncludes + tokenNameHits * 2;
        const scoreKeywords = tokenKeywordHits;

        return { product: p, scoreName, scoreKeywords };
      })
      .filter((x) => x.scoreName > 0 || x.scoreKeywords > 0);

    scored.sort((a, b) => {
      const aHasName = a.scoreName > 0;
      const bHasName = b.scoreName > 0;
      if (aHasName !== bHasName) return aHasName ? -1 : 1;
      if (a.scoreName !== b.scoreName) return b.scoreName - a.scoreName;
      if (a.scoreKeywords !== b.scoreKeywords) return b.scoreKeywords - a.scoreKeywords;
      return a.product.name.localeCompare(b.product.name, 'pt-BR');
    });

    return scored.map((x) => x.product);
  }, [products, search]);

  const selectedById = useMemo(() => {
    const map = new Map<string, SelectedItem>();
    for (const item of selected) map.set(item.productId, item);
    return map;
  }, [selected]);

  function addProduct(productId: string) {
    setSelected((prev) => {
      if (prev.some((p) => p.productId === productId)) return prev;
      return [...prev, { productId, quantity: 1, useDefaultPrice: true, manualUnitPrice: '' }];
    });
  }

  function removeProduct(productId: string) {
    setSelected((prev) => prev.filter((p) => p.productId !== productId));
  }

  function updateSelected(productId: string, patch: Partial<SelectedItem>) {
    setSelected((prev) =>
      prev.map((p) => (p.productId === productId ? { ...p, ...patch } : p))
    );
  }

  const declaration = useMemo(() => {
    const missing: string[] = [];

    const clampedDiscount = clampDiscountPct(discountPct);

    const lines: string[] = [];
    let grandTotal = 0;

    for (const item of selected) {
      const qty = Math.max(0, Math.floor(item.quantity || 0));
      if (qty <= 0) continue;

      const product = products.find((p) => p.id === item.productId);
      if (!product) continue;

      let unitCents: number | null = null;
      if (item.useDefaultPrice) {
        unitCents = product.priceCents;
      } else {
        unitCents = parseMoneyToCents(item.manualUnitPrice);
        if (unitCents === null) {
          missing.push(`Preço manual inválido: ${product.name}`);
          continue;
        }
      }

      const discountedUnitCents = applyDiscountToCents(unitCents, clampedDiscount);
      const totalCents = discountedUnitCents * qty;
      grandTotal += totalCents;

      const usePlural = qty > 1;
      const displayName = usePlural ? (product.pluralName || product.name) : product.name;
      const displayNameUpper = displayName.toLocaleUpperCase('pt-BR');
      const unitWord = qty === 1 ? 'UNIDADE' : 'UNIDADES';

      lines.push(
        `${pad2(qty)} ${unitWord} DE ${displayNameUpper} PREÇO UNITÁRIO: R$: ${formatCentsBRL(discountedUnitCents)} = PREÇO TOTAL R$: ${formatCentsBRL(totalCents)}`
      );
    }

    if (missing.length) {
      return { text: '', missing };
    }

    if (!lines.length) {
      return { text: '', missing: ['Nenhum produto com quantidade maior que 0 foi selecionado.'] };
    }

    lines.push(`PREÇO FINAL  R$: ${formatCentsBRL(grandTotal)}`);

    return { text: lines.join('\n'), missing: [] as string[] };
  }, [discountPct, products, selected]);

  async function handleGenerate() {
    setError(null);

    if (declaration.missing.length) {
      setPopup({ title: 'Não foi possível gerar a declaração.', lines: declaration.missing });
      return;
    }

    try {
      // Incrementar contador de vendas para cada produto selecionado com qty > 0
      const updates: Promise<void>[] = [];
      let totalQty = 0;
      for (const sel of selected) {
        if (sel.quantity > 0) {
          totalQty += sel.quantity;
          updates.push(
            updateDoc(doc(firestoreDb, 'products', sel.productId), {
              salesCount: increment(sel.quantity),
            })
          );
        }
      }
      // Atualizar contador global de vendas
      if (totalQty > 0) {
        updates.push(incrementGlobalSalesCount(totalQty));
      }
      await Promise.all(updates);

      setPopup({ title: 'Declaração pronta!', lines: ['A declaração foi gerada e os contadores de vendas foram atualizados.'] });
    } catch (e) {
      console.error(e);
      setError('Falha ao gerar declaração.');
    }
  }

  async function handleCopy() {
    setError(null);

    if (declaration.missing.length) {
      setPopup({ title: 'Não foi possível gerar a declaração.', lines: declaration.missing });
      return;
    }

    try {
      await navigator.clipboard.writeText(declaration.text);
      setPopup({ title: 'Copiado!', lines: ['Declaração copiada para a área de transferência.'] });
    } catch (e) {
      console.error(e);
      setError('Falha ao copiar.');
    }
  }

  if (authLoading || !adminCheckDone) {
    return (
      <main className="min-h-screen bg-gray-50 text-gray-900">
        <div className="container mx-auto px-4 py-10">
          <h1 className="text-2xl font-bold">Emissão</h1>
          <p className="mt-4">Carregando…</p>
        </div>
      </main>
    );
  }

  if (!authUser) {
    return (
      <main className="min-h-screen bg-gray-50 text-gray-900">
        <div className="container mx-auto px-4 py-10">
          <button
            type="button"
            className="inline-flex items-center rounded-md bg-black px-4 py-2 text-white btn-hover-expand hover:opacity-90 active:opacity-80"
            onClick={handleLogin}
          >
            Entrar com Google
          </button>
          {error && <p className="mt-4 text-red-600">{error}</p>}
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-gray-50 text-gray-900">
        <div className="container mx-auto px-4 py-10">
          <h1 className="text-2xl font-bold">Emissão</h1>
          <p className="mt-4">Acesso negado para {authUser.email}.</p>
          <button
            type="button"
            className="mt-6 inline-flex items-center rounded-md bg-black px-4 py-2 text-white hover:opacity-90 active:opacity-80"
            onClick={handleLogout}
          >
            Sair
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      {popup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={popup.title}
          data-lenis-prevent
          onClick={() => setPopup(null)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-black/10 bg-white p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-lg font-bold">{popup.title}</div>
            <ul className="mt-3 list-disc pl-5 text-sm">
              {popup.lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="inline-flex items-center rounded-md bg-black px-4 py-2 text-white hover:opacity-90 active:opacity-80"
                onClick={() => setPopup(null)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Emissão</h1>
            <p className="mt-1 text-sm opacity-80">Logado como {authUser.email}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin"
              className="inline-flex w-full items-center justify-center rounded-md border border-black px-4 py-2 hover:opacity-90 active:opacity-80 sm:w-auto"
            >
              Voltar ao Admin
            </Link>

            <button
              type="button"
              className="inline-flex w-full items-center justify-center rounded-md bg-black px-4 py-2 text-white hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              onClick={() => void refreshProducts()}
              disabled={dataLoading}
              aria-busy={dataLoading}
            >
              {dataLoading && (
                <span
                  className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white"
                  aria-hidden="true"
                />
              )}
              {dataLoading ? 'Atualizando…' : 'Atualizar'}
            </button>

            <button
              type="button"
              className="inline-flex w-full items-center justify-center rounded-md border border-black px-4 py-2 hover:opacity-90 active:opacity-80 sm:w-auto"
              onClick={handleLogout}
            >
              Sair
            </button>
          </div>
        </div>

        {error && <p className="mt-6 text-red-600">{error}</p>}

        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-black/10 bg-white p-4">
            <h2 className="text-lg font-bold">Selecionar produtos</h2>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-sm opacity-80">Buscar</span>
                <input
                  className="h-10 rounded-md border border-black/20 bg-gray-50 px-3 text-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nome/keywords…"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-sm opacity-80">Desconto (%)</span>
                <input
                  type="number"
                  className="h-10 rounded-md border border-black/20 bg-gray-50 px-3 text-sm"
                  value={discountPct}
                  onChange={(e) => setDiscountPct(Number(e.target.value))}
                  min={0}
                  max={100}
                  step={0.01}
                />
              </label>
            </div>

            <div className="mt-4 grid gap-2">
              {filteredProducts.slice(0, 50).map((p) => {
                const already = selectedById.has(p.id);
                return (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-black/10 bg-white px-3 py-2"
                  >
                    <div>
                      <div className="text-sm font-semibold">{p.name}</div>
                      <div className="text-xs opacity-70">{p.id}</div>
                    </div>

                    <button
                      type="button"
                      className="inline-flex items-center rounded-md bg-black px-3 py-2 text-sm text-white hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => addProduct(p.id)}
                      disabled={already}
                    >
                      {already ? 'Adicionado' : 'Adicionar'}
                    </button>
                  </div>
                );
              })}

              {filteredProducts.length === 0 && (
                <p className="text-sm opacity-80">Nenhum produto encontrado.</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-black/10 bg-white p-4">
            <h2 className="text-lg font-bold">Aquisições</h2>

            {selected.length === 0 ? (
              <p className="mt-3 text-sm opacity-80">Nenhum produto selecionado.</p>
            ) : (
              <div className="mt-3 grid gap-3">
                {selected.map((item) => {
                  const product = products.find((p) => p.id === item.productId);
                  if (!product) return null;

                  const usingDefault = item.useDefaultPrice;
                  const manualCents = parseMoneyToCents(item.manualUnitPrice);
                  const unitCentsRaw = usingDefault ? product.priceCents : (manualCents ?? 0);
                  const qty = Math.max(0, Math.floor(item.quantity || 0));
                  const unitCents = applyDiscountToCents(unitCentsRaw, discountPct);
                  const lineTotal = unitCents * qty;

                  return (
                    <div key={item.productId} className="rounded-md border border-black/10 bg-gray-50 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold">{product.name}</div>
                          <div className="text-xs opacity-70">{product.id}</div>
                        </div>
                        <button
                          type="button"
                          className="rounded-md border border-black/20 bg-white px-3 py-2 text-sm hover:opacity-90 active:opacity-80"
                          onClick={() => removeProduct(item.productId)}
                        >
                          Remover
                        </button>
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <label className="grid gap-1">
                          <span className="text-sm opacity-80">Quantidade</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            className="h-10 w-24 rounded-md border border-black/20 bg-white px-3 text-center text-sm tabular-nums"
                            value={
                              item.quantity === 0
                                ? ''
                                : item.quantity > 0 && item.quantity < 10
                                  ? pad2(item.quantity)
                                  : String(item.quantity)
                            }
                            placeholder="00"
                            onChange={(e) => {
                              const digitsOnly = e.target.value.replace(/\D+/g, '');
                              if (!digitsOnly) {
                                updateSelected(item.productId, { quantity: 0 });
                                return;
                              }

                              const next = Number.parseInt(digitsOnly, 10);
                              updateSelected(item.productId, {
                                quantity: Number.isFinite(next) ? next : 0,
                              });
                            }}
                          />
                        </label>

                        <label className="grid gap-1">
                          <span className="text-sm opacity-80">Preço unitário</span>
                          <div className="flex items-center gap-2">
                            <label className="inline-flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={item.useDefaultPrice}
                                onChange={(e) => updateSelected(item.productId, { useDefaultPrice: e.target.checked })}
                              />
                              <span className="opacity-80">Usar padrão</span>
                            </label>
                          </div>
                          {!item.useDefaultPrice && (
                            <input
                              className="mt-2 h-10 w-full rounded-md border border-black/20 bg-white px-3 text-right text-sm tabular-nums"
                              inputMode="decimal"
                              value={item.manualUnitPrice}
                              onChange={(e) => updateSelected(item.productId, { manualUnitPrice: e.target.value })}
                              placeholder="R$ 12,34"
                            />
                          )}
                          <div className="mt-1 text-xs opacity-70">
                            Unit: R$: {formatCentsBRL(unitCents)}
                          </div>
                        </label>

                        <div className="grid gap-1">
                          <span className="text-sm opacity-80">Total</span>
                          <div className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm flex items-center">
                            R$: {formatCentsBRL(lineTotal)}
                          </div>
                          {!item.useDefaultPrice && manualCents === null && item.manualUnitPrice.trim() && (
                            <div className="text-xs text-red-600">Preço manual inválido</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-4">
              <button
                type="button"
                className="inline-flex w-full items-center justify-center rounded-md bg-black px-4 py-2 text-white hover:opacity-90 active:opacity-80 sm:w-auto"
                onClick={() => void handleGenerate()}
              >
                Gerar
              </button>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-lg border border-black/10 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Declaração</h2>
            <button
              type="button"
              className="inline-flex w-full items-center justify-center rounded-md bg-black px-4 py-2 text-white hover:opacity-90 active:opacity-80 sm:w-auto"
              onClick={() => void handleCopy()}
            >
              Copiar
            </button>
          </div>

          <textarea
            className="mt-3 w-full rounded-md border border-black/20 bg-gray-50 px-3 py-2 text-sm"
            rows={10}
            readOnly
            value={declaration.text}
            placeholder="A declaração aparecerá aqui…"
          />
        </section>
      </div>
    </main>
  );
}
