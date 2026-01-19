'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import ProductCard from '@/components/ProductCard';

export interface DetailsCategory {
  id: string;
  name: string;
  color: string;
}

export interface DetailsProduct {
  id: string; // slug
  categoryId: string;
  name: string;
  description: string;
  imageUrls: string[];
  mainImageUrl?: string;
  videoUrl?: string;
}

function hashStringToSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function ProductDetailsClient({
  product,
  category,
  suggestedProducts,
  categoriesById,
}: {
  product: DetailsProduct;
  category: DetailsCategory | null;
  suggestedProducts: DetailsProduct[];
  categoriesById: Record<string, DetailsCategory>;
}) {
  // Mídias: vídeo primeiro (se existir), depois imagens
  const mediaItems = useMemo(() => {
    const items: { type: 'video' | 'image'; url: string }[] = [];

    // Vídeo como primeiro item
    if (product.videoUrl) {
      items.push({ type: 'video', url: product.videoUrl });
    }

    // Imagens
    const urls = Array.isArray(product.imageUrls) ? product.imageUrls : [];
    const main = typeof product.mainImageUrl === 'string' ? product.mainImageUrl : '';
    const merged = [main, ...urls].filter(Boolean);
    const uniqueImages = Array.from(new Set(merged));
    for (const url of uniqueImages) {
      items.push({ type: 'image', url });
    }

    return items;
  }, [product.imageUrls, product.mainImageUrl, product.videoUrl]);

  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

  const handlePrevMedia = () => {
    if (mediaItems.length) {
      setCurrentMediaIndex((prev) => (prev - 1 + mediaItems.length) % mediaItems.length);
    }
  };

  const handleNextMedia = () => {
    if (mediaItems.length) {
      setCurrentMediaIndex((prev) => (prev + 1) % mediaItems.length);
    }
  };

  const safeMediaIndex = mediaItems.length ? currentMediaIndex % mediaItems.length : 0;
  const currentMedia = mediaItems[safeMediaIndex];

  const seededSuggested = useMemo(() => {
    const seed = hashStringToSeed(product.id);
    const rand = mulberry32(seed);

    const copy = suggestedProducts.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy.slice(0, 3);
  }, [product.id, suggestedProducts]);

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="container mx-auto max-w-4xl">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8">
            <div className="flex flex-col gap-4">
              <div
                className="relative w-full aspect-square rounded-lg overflow-hidden"
                style={{ backgroundColor: (category?.color || '#0D6AA7') + '20' }}
              >
                {currentMedia ? (
                  currentMedia.type === 'video' ? (
                    <video
                      src={currentMedia.url}
                      controls
                      disablePictureInPicture
                      controlsList="nodownload noplaybackrate"
                      className="absolute inset-0 w-full h-full object-contain bg-black"
                    />
                  ) : (
                    <Image
                      src={currentMedia.url}
                      alt={`${product.name} - ${safeMediaIndex + 1}`}
                      fill
                      className="object-cover"
                    />
                  )
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-600">
                    Sem imagem
                  </div>
                )}

                {mediaItems.length > 1 && (
                  <>
                    <button
                      onClick={handlePrevMedia}
                      className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 font-bold py-2 px-3 rounded-full transition-colors btn-hover-expand"
                      aria-label="Mídia anterior"
                    >
                      &#10094;
                    </button>
                    <button
                      onClick={handleNextMedia}
                      className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 font-bold py-2 px-3 rounded-full transition-colors btn-hover-expand"
                      aria-label="Próxima mídia"
                    >
                      &#10095;
                    </button>
                  </>
                )}

                {mediaItems.length > 0 && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                    {safeMediaIndex + 1} / {mediaItems.length}
                  </div>
                )}
              </div>

              {mediaItems.length > 1 && (
                <div className="flex gap-2 overflow-x-auto">
                  {mediaItems.map((media, index) => (
                    <button
                      key={media.url}
                      onClick={() => setCurrentMediaIndex(index)}
                      className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors btn-hover-expand ${
                        safeMediaIndex === index ? 'border-blue-500' : 'border-gray-200'
                      }`}
                    >
                      {media.type === 'video' ? (
                        <div className="w-full h-full bg-gray-800 flex items-center justify-center text-white text-xs">
                          ▶ Vídeo
                        </div>
                      ) : (
                        <Image
                          src={media.url}
                          alt={`Thumbnail ${index + 1}`}
                          width={80}
                          height={80}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col justify-between">
              {category && (
                <div
                  className="inline-block px-4 py-2 rounded-full text-white font-semibold w-fit mb-4"
                  style={{ backgroundColor: category.color }}
                >
                  {category.name}
                </div>
              )}

              <div>
                <h1 className="text-4xl font-bold text-gray-800 mb-4">{product.name}</h1>
              </div>

              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-800 mb-3">Descrição</h2>
                <p className="text-gray-600 text-lg leading-relaxed">{product.description}</p>
              </div>
            </div>
          </div>
        </div>

        {seededSuggested.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Você também pode gostar</h2>
            <div className="flex items-stretch gap-6 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible md:grid md:grid-cols-3 md:gap-8">
              {seededSuggested.map((p) => {
                const cat = categoriesById[p.categoryId] ?? null;
                return (
                  <div key={p.id} className="flex-shrink-0 w-64 md:w-auto flex flex-col">
                    <ProductCard
                      id={p.id}
                      name={p.name}
                      description={p.description}
                      price={''}
                      image={p.mainImageUrl || p.imageUrls[0] || ''}
                      categoryColor={cat?.color || '#0D6AA7'}
                      compact
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-12 text-center">
          <Link
            href="/catalogo"
            className="inline-block bg-blue-600 text-white font-semibold py-3 px-8 rounded-lg hover:bg-blue-700 transition-colors btn-hover-expand"
            style={{ backgroundColor: '#0D6AA7' }}
          >
            Voltar ao Catálogo
          </Link>
        </div>
      </div>
    </main>
  );
}
