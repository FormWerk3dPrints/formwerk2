'use client';

import ProductCard from '@/components/ProductCard';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import productsData from '@/data/products.json';

interface Product {
  id: number;
  categoryId: string;
  name: string;
  description: string;
  price: string;
  images: string[];
}

interface Category {
  id: string;
  name: string;
  color: string;
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function ProductDetails() {
  const params = useParams();
  const productIdParam = params?.id;
  const productId = Array.isArray(productIdParam)
    ? productIdParam[0]
    : (productIdParam as string | undefined);
  const productIdNumber = productId
    ? Number.parseInt(productId, 10)
    : Number.NaN;

  const product = useMemo(() => {
    return (
      productsData.products.find((p: Product) => p.id === productIdNumber) ||
      null
    );
  }, [productIdNumber]);

  const category = useMemo(() => {
    if (!product) return null;
    return (
      productsData.categories.find(
        (c: Category) => c.id === product.categoryId
      ) || null
    );
  }, [product]);

  const suggestedProducts = useMemo(() => {
    if (!product) return [];

    const others = productsData.products.filter(
      (p: Product) => p.id !== product.id
    );

    const rand = mulberry32(product.id);

    // Shuffle (Fisher–Yates)
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [others[i], others[j]] = [others[j], others[i]];
    }

    return others.slice(0, 3);
  }, [product]);

  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const handlePrevImage = () => {
    if (product) {
      setCurrentImageIndex(
        (prev) => (prev - 1 + product.images.length) % product.images.length
      );
    }
  };

  const handleNextImage = () => {
    if (product) {
      setCurrentImageIndex((prev) => (prev + 1) % product.images.length);
    }
  };

  if (!productId || Number.isNaN(productIdNumber)) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-xl text-gray-600">Produto não encontrado</p>
        </div>
      </>
    );
  }

  if (!product) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-xl text-gray-600">Produto não encontrado</p>
        </div>
      </>
    );
  }

  const safeImageIndex = currentImageIndex % product.images.length;

  return (
    <>
      <main className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8">
              {/* Carrossel de Imagens */}
              <div className="flex flex-col gap-4">
                {/* Imagem Principal */}
                <div
                  className="relative w-full aspect-square rounded-lg overflow-hidden"
                  style={{
                    backgroundColor: category?.color + '20',
                  }}
                >
                  <Image
                    src={product.images[safeImageIndex]}
                    alt={`${product.name} - ${safeImageIndex + 1}`}
                    fill
                    className="object-cover"
                  />

                  {/* Controles do Carrossel */}
                  {product.images.length > 1 && (
                    <>
                      <button
                        onClick={handlePrevImage}
                        className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 font-bold py-2 px-3 rounded-full transition-colors btn-hover-expand"
                        aria-label="Imagem anterior"
                      >
                        &#10094;
                      </button>
                      <button
                        onClick={handleNextImage}
                        className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 font-bold py-2 px-3 rounded-full transition-colors btn-hover-expand"
                        aria-label="Próxima imagem"
                      >
                        &#10095;
                      </button>
                    </>
                  )}

                  {/* Indicador de Imagem */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                    {safeImageIndex + 1} / {product.images.length}
                  </div>
                </div>

                {/* Thumbnails */}
                {product.images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto">
                    {product.images.map((image, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentImageIndex(index)}
                        className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors btn-hover-expand ${
                          safeImageIndex === index
                            ? 'border-blue-500'
                            : 'border-gray-200'
                        }`}
                      >
                        <Image
                          src={image}
                          alt={`Thumbnail ${index + 1}`}
                          width={80}
                          height={80}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Informações do Produto */}
              <div className="flex flex-col justify-between">
                {/* Category Badge */}
                {category && (
                  <div
                    className="inline-block px-4 py-2 rounded-full text-white font-semibold w-fit mb-4"
                    style={{ backgroundColor: category.color }}
                  >
                    {category.name}
                  </div>
                )}

                {/* Nome e Preço */}
                <div>
                  <h1 className="text-4xl font-bold text-gray-800 mb-4">
                    {product.name}
                  </h1>
                  {/*PREÇO REMOVIDO
                  <p className="text-3xl font-bold mb-6" style={{ color: category?.color }}>
                    {product.price}
                  </p>
                  */}
                </div>

                {/* Descrição */}
                <div className="mb-8">
                  <h2 className="text-xl font-semibold text-gray-800 mb-3">
                    Descrição
                  </h2>
                  <p className="text-gray-600 text-lg leading-relaxed">
                    {product.description}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Sugestões */}
          {suggestedProducts.length > 0 && (
            <div className="mt-12">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                Você também pode gostar
              </h2>
              <div className="flex items-stretch gap-6 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible md:grid md:grid-cols-3 md:gap-8">
                {suggestedProducts.map((p) => {
                  const cat = productsData.categories.find(
                    (c: Category) => c.id === p.categoryId
                  );
                  return (
                    <div
                      key={p.id}
                      className="flex-shrink-0 w-64 md:w-auto flex flex-col"
                    >
                      <ProductCard
                        id={p.id}
                        name={p.name}
                        description={p.description}
                        price={p.price}
                        image={p.images[0]}
                        categoryColor={cat?.color || '#0D6AA7'}
                        compact
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Voltar ao Catálogo */}
          <div className="mt-12 text-center">
            <Link
              href="/catalogo"
              className="inline-block text-white font-semibold py-3 px-8 rounded-lg hover:opacity-90 transition-opacity btn-hover-expand"
              style={{ backgroundColor: '#0D6AA7' }}
            >
              ← Voltar ao Catálogo
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
