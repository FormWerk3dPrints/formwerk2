'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase/client';
import ProductCard from '@/components/ProductCard';
import { useProductPrices } from '@/hooks/useProductPrices';
import { ArrowLeft } from 'lucide-react';

export interface KitDetail {
  id: string;
  name: string;
  description: string;
  color: string;
  imageUrls: string[];
  mainImageUrl?: string;
}

export interface KitProduct {
  id: string;
  name: string;
  description: string;
  imageUrls: string[];
  mainImageUrl?: string;
}

/** Preço do kit: só chega ao navegador se o usuário for verified. */
type KitPrice = { priceCents: number; currency: string };

async function fetchKitPrice(user: User, slug: string): Promise<KitPrice | null> {
  try {
    const idToken = await user.getIdToken();
    const res = await fetch(`/api/kits/${encodeURIComponent(slug)}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      kit?: { priceCents?: number; currency?: string };
    };
    // priceCents só vem no JSON quando a API reconhece o usuário como verified.
    if (typeof data.kit?.priceCents !== 'number') return null;
    return { priceCents: data.kit.priceCents, currency: data.kit.currency ?? 'BRL' };
  } catch {
    return null;
  }
}

function formatPrice(priceCents: number, currency: string): string {
  return (priceCents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: currency || 'BRL',
  });
}

export default function KitDetailClient({
  kit,
  products,
}: {
  kit: KitDetail;
  products: KitProduct[];
}) {
  const [price, setPrice] = useState<KitPrice | null>(null);
  const { priceLabel } = useProductPrices();
  const mainImage = kit.mainImageUrl || kit.imageUrls[0] || '';

  useEffect(() => {
    let cancelled = false;
    const unsub = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) {
        if (!cancelled) setPrice(null);
        return;
      }
      const loaded = await fetchKitPrice(user, kit.id);
      if (!cancelled) setPrice(loaded);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [kit.id]);

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Topo colorido com nome do kit */}
      <div className="w-full py-8 px-4" style={{ backgroundColor: kit.color + '18' }}>
        <div className="container mx-auto max-w-5xl">
          <Link
            href="/kits"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Kits
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800">{kit.name}</h1>
          {kit.description && (
            <p className="mt-3 text-gray-600 max-w-2xl">{kit.description}</p>
          )}
        </div>
      </div>

      <div className="container mx-auto max-w-5xl px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start mb-16">
          {/* Imagem 1:1 */}
          <div className="w-full">
            {mainImage ? (
              <div
                className="relative w-full aspect-square rounded-xl overflow-hidden shadow-lg"
                style={{ backgroundColor: kit.color + '20' }}
              >
                <Image
                  src={mainImage}
                  alt={kit.name}
                  fill
                  sizes="(max-width: 767px) 100vw, 50vw"
                  className="object-cover"
                  priority
                />
              </div>
            ) : (
              <div
                className="w-full aspect-square rounded-xl flex items-center justify-center text-gray-400 text-sm"
                style={{ backgroundColor: kit.color + '20' }}
              >
                Sem imagem
              </div>
            )}
          </div>

          {/* Preço + informações */}
          <div className="flex flex-col gap-6 md:pt-2">
            <div
              className="h-1 rounded-full w-16"
              style={{ backgroundColor: kit.color }}
            />

            {price && (
              <div>
                <p className="text-sm text-gray-500 font-medium uppercase tracking-wide mb-1">
                  Valor do kit
                </p>
                {price.priceCents > 0 ? (
                  <p className="text-3xl font-bold text-gray-900">
                    {formatPrice(price.priceCents, price.currency)}
                  </p>
                ) : (
                  <p className="text-xl text-gray-500 italic">Sob consulta</p>
                )}
              </div>
            )}

            <div>
              <p className="text-sm text-gray-500 font-medium uppercase tracking-wide mb-1">
                Composição
              </p>
              <p className="text-gray-700 text-sm">
                {products.length === 0
                  ? 'Nenhum produto neste kit.'
                  : `${products.length} produto${products.length !== 1 ? 's' : ''} incluído${products.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
        </div>

        {/* Produtos do kit */}
        {products.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Produtos incluídos</h2>
            <div
              className="h-1 rounded-full w-12 mb-8"
              style={{ backgroundColor: kit.color }}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  name={product.name}
                  description={product.description}
                  price={priceLabel(product.id)}
                  image={product.mainImageUrl || product.imageUrls[0] || ''}
                  categoryColor={kit.color}
                  mobileLayout="side"
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
