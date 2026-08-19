'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase/client';
import { formatCents } from '@/lib/prices/coerceToCents';

type PriceMap = Record<string, { priceCents: number; currency: string }>;

/* Cache por usuário: uma página pode montar o hook em mais de um lugar (bloco
   de preço + grade de sugeridos). Sem isso seriam requisições duplicadas. */
let cachedUid: string | null = null;
let cachedRequest: Promise<PriceMap> | null = null;

async function loadPrices(uid: string, idToken: string): Promise<PriceMap> {
  if (cachedUid === uid && cachedRequest) return cachedRequest;
  cachedUid = uid;
  cachedRequest = (async () => {
    const res = await fetch('/api/products/prices', {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) return {};
    const data = (await res.json()) as { verified?: boolean; prices?: PriceMap };
    return data.verified && data.prices ? data.prices : {};
  })();
  return cachedRequest;
}

/**
 * Preços dos produtos para exibir nos cards. Devolve um mapa vazio para quem
 * não é `verified` — a API nem envia os valores nesse caso, então não há preço
 * escondido no HTML.
 *
 * `priceLabel(id)` devolve string vazia quando não há preço a mostrar, que é
 * exatamente o que o ProductCard trata como "sem badge".
 */
export function useProductPrices() {
  const [prices, setPrices] = useState<PriceMap>({});

  useEffect(() => {
    let cancelled = false;
    const unsub = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) {
        // Logout invalida o cache — o próximo login refaz a busca.
        cachedUid = null;
        cachedRequest = null;
        if (!cancelled) setPrices({});
        return;
      }
      try {
        const idToken = await user.getIdToken();
        const loaded = await loadPrices(user.uid, idToken);
        if (!cancelled) setPrices(loaded);
      } catch {
        if (!cancelled) setPrices({});
      }
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  function priceLabel(productId: string): string {
    const entry = prices[productId];
    // Produto sem preço cadastrado não ganha badge — melhor nada que "R$ 0,00".
    if (!entry || entry.priceCents <= 0) return '';
    return formatCents(entry.priceCents, entry.currency);
  }

  return { prices, priceLabel };
}
