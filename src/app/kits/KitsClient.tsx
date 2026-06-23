'use client';

import ProductCard from '@/components/ProductCard';

export interface CatalogKit {
  id: string;
  name: string;
  description: string;
  color: string;
  imageUrls: string[];
  mainImageUrl?: string;
}

export default function KitsClient({ kits }: { kits: CatalogKit[] }) {
  if (!kits.length) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-xl text-gray-600">Nenhum kit disponível no momento.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="container mx-auto max-w-6xl">
        <h1 className="text-4xl font-bold text-gray-800 mb-2 text-center">
          Kits Educacionais
        </h1>
        <p className="text-gray-600 text-center mb-12">
          Conjuntos completos pensados para potencializar o aprendizado!
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {kits.map((kit) => (
            <ProductCard
              key={kit.id}
              id={kit.id}
              name={kit.name}
              description={kit.description}
              price=""
              image={kit.mainImageUrl || kit.imageUrls[0] || ''}
              categoryColor={kit.color}
              href={`/kits/${kit.id}`}
              mobileLayout="side"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
