'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProductCard from '@/components/ProductCard';

export interface CatalogCategory {
  id: string;
  name: string;
  color: string;
  description: string;
}

export interface CatalogProduct {
  id: string; // slug
  categoryId: string;
  name: string;
  description: string;
  imageUrls: string[];
  mainImageUrl?: string;
}

type ProductSuggestion = {
  id: string;
  name: string;
};

export default function CatalogoClient({
  categories,
  products,
}: {
  categories: CatalogCategory[];
  products: CatalogProduct[];
}) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string>(
    () => categories[0]?.id ?? ''
  );

  const [queryText, setQueryText] = useState('');
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedCategoryData = useMemo(
    () => categories.find((cat) => cat.id === selectedCategory) ?? null,
    [categories, selectedCategory]
  );

  const filteredProducts = useMemo(
    () => products.filter((product) => product.categoryId === selectedCategory),
    [products, selectedCategory]
  );

  useEffect(() => {
    const controller = new AbortController();

    const q = queryText.trim();
    if (!q) {
      setSuggestions([]);
      setIsOpen(false);
      setActiveIndex(-1);
      return () => controller.abort();
    }

    const handle = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/products/search?mode=suggest&q=${encodeURIComponent(q)}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error('Falha ao buscar');

        const data = (await res.json()) as { suggestions?: ProductSuggestion[] };
        const nextSuggestions = Array.isArray(data.suggestions)
          ? data.suggestions
          : [];

        setSuggestions(nextSuggestions);
        setIsOpen(true);
        // Não pré-seleciona: Enter sem navegar deve ir para /resultados.
        setActiveIndex(-1);
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setIsOpen(false);
          setActiveIndex(-1);
        }
      }
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(handle);
    };
  }, [queryText]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!containerRef.current) return;
      if (containerRef.current.contains(e.target as Node)) return;
      setIsOpen(false);
      setActiveIndex(-1);
    }

    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  function goToResults() {
    const q = queryText.trim();
    if (!q) return;
    setIsOpen(false);
    setActiveIndex(-1);
    router.push(`/catalogo/resultados?q=${encodeURIComponent(q)}`);
  }

  function goToProduct(id: string) {
    setIsOpen(false);
    setActiveIndex(-1);
    router.push(`/catalogo/${id}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!suggestions.length) return;
      setIsOpen(true);
      setActiveIndex((idx) => {
        if (idx < 0) return 0;
        return (idx + 1) % suggestions.length;
      });
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!suggestions.length) return;
      setIsOpen(true);
      setActiveIndex((idx) => {
        if (idx < 0) return suggestions.length - 1;
        return idx <= 0 ? suggestions.length - 1 : idx - 1;
      });
      return;
    }

    if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && activeIndex >= 0 && activeIndex < suggestions.length) {
        goToProduct(suggestions[activeIndex]!.id);
        return;
      }
      goToResults();
    }
  }

  if (!categories.length) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl text-gray-600">Nenhuma categoria encontrada.</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="container mx-auto max-w-6xl">
        <h1 className="text-4xl font-bold text-gray-800 mb-2 text-center">
          Produtos por Categoria
        </h1>
        <p className="text-gray-600 text-center mb-12">
          Explore nossos principais produtos organizados por categoria!
        </p>

        <div className="mb-8" ref={containerRef}>
          <div className="relative max-w-2xl mx-auto">
            <div className="relative">
              <input
                type="text"
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                onFocus={() => {
                  if (queryText.trim()) setIsOpen(true);
                }}
                onKeyDown={onKeyDown}
                placeholder="Buscar produtos..."
                className="w-full bg-white border-2 border-gray-200 rounded-lg px-4 py-3 pr-12 text-gray-800 focus:outline-none focus:border-gray-300"
                aria-label="Buscar produtos"
                autoComplete="off"
              />

              <button
                type="button"
                onClick={goToResults}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors"
                aria-label="Buscar"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-5 h-5 text-gray-600"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.3-4.3" />
                </svg>
              </button>
            </div>

            {isOpen && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-20">
                <ul role="listbox" aria-label="Sugestões de produtos">
                  {suggestions.map((s, idx) => (
                    <li
                      key={s.id}
                      role="option"
                      aria-selected={idx === activeIndex}
                      className={`px-4 py-3 cursor-pointer text-gray-800 text-sm md:text-base ${
                        idx === activeIndex ? 'bg-gray-100' : 'bg-white'
                      }`}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onMouseDown={(e) => {
                        // evita o blur do input antes do click
                        e.preventDefault();
                      }}
                      onClick={() => goToProduct(s.id)}
                    >
                      {s.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="mb-12">
          <div className="flex flex-wrap gap-3 md:gap-4 mx-auto justify-center md:justify-center">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 md:px-6 py-2 md:py-3 rounded-lg font-semibold transition-all text-sm md:text-base btn-hover-expand ${
                  selectedCategory === category.id
                    ? 'text-white shadow-lg'
                    : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-gray-300'
                }`}
                style={{
                  backgroundColor:
                    selectedCategory === category.id ? category.color : 'white',
                  borderColor:
                    selectedCategory === category.id
                      ? category.color
                      : 'rgb(229, 231, 235)',
                }}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {selectedCategoryData && (
          <div
            className="h-1 rounded-full mb-8"
            style={{ backgroundColor: selectedCategoryData.color }}
          />
        )}

        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                name={product.name}
                description={product.description}
                price={''}
                image={product.mainImageUrl || product.imageUrls[0] || ''}
                categoryColor={selectedCategoryData?.color || '#0D6AA7'}
                mobileLayout="side"
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-xl text-gray-600">
              Nenhum produto encontrado nesta categoria.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
