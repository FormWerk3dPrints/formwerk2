import PricedProductGrid from '@/components/PricedProductGrid';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { firestoreServerDb } from '@/lib/firebase/server';
import { searchProductsByTokens } from '@/lib/products/search';

export const dynamic = 'force-dynamic';

type SearchParams = {
  q?: string | string[];
};

type Category = {
  id: string;
  name: string;
  color: string;
};

async function getActiveCategories(): Promise<Category[]> {
  const categoriesQuery = query(
    collection(firestoreServerDb, 'categories'),
    where('active', '==', true),
    orderBy('order', 'asc')
  );

  const snap = await getDocs(categoriesQuery);

  return snap.docs.map((d) => {
    const data = d.data() as { name?: unknown; color?: unknown };
    return {
      id: d.id,
      name: typeof data.name === 'string' ? data.name : '',
      color: typeof data.color === 'string' ? data.color : '#0D6AA7',
    };
  });
}

function pickFirst(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] ?? '';
  return param ?? '';
}

export default async function CatalogoResultados({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = pickFirst(sp.q).trim();

  const categories = await getActiveCategories();
  const categoryColorById = new Map(categories.map((c) => [c.id, c.color] as const));

  const { nameMatches, keywordMatches } = await searchProductsByTokens({
    q,
    maxTokens: 10,
    maxPerGroup: 200,
  });

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="container mx-auto max-w-6xl">
        <h1 className="text-4xl font-bold text-gray-800 mb-2 text-center">
          Resultados da busca
        </h1>
        <p className="text-gray-600 text-center mb-10">
          {q ? (
            <>
              Você pesquisou por <span className="font-semibold">{q}</span>
            </>
          ) : (
            'Digite um termo para buscar no catálogo.'
          )}
        </p>

        {q && nameMatches.length === 0 && keywordMatches.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-xl text-gray-600">Nenhum produto encontrado.</p>
          </div>
        ) : (
          <div className="space-y-12">
            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                Resultados por nome
              </h2>

              {nameMatches.length > 0 ? (
                <PricedProductGrid
                  items={nameMatches.map((product) => ({
                    id: product.id,
                    name: product.name,
                    description: product.description,
                    image: product.mainImageUrl || product.imageUrls[0] || '',
                    categoryColor:
                      product.categoryIds.map((id) => categoryColorById.get(id)).find(Boolean) ??
                      '#0D6AA7',
                  }))}
                />
              ) : (
                <p className="text-gray-600">Nenhum resultado por nome.</p>
              )}
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                Resultados por palavra chave
              </h2>

              {keywordMatches.length > 0 ? (
                <PricedProductGrid
                  items={keywordMatches.map((product) => ({
                    id: product.id,
                    name: product.name,
                    description: product.description,
                    image: product.mainImageUrl || product.imageUrls[0] || '',
                    categoryColor:
                      product.categoryIds.map((id) => categoryColorById.get(id)).find(Boolean) ??
                      '#0D6AA7',
                  }))}
                />
              ) : (
                <p className="text-gray-600">Nenhum resultado por palavra chave.</p>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
