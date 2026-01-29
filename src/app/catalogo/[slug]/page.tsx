import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { firestoreServerDb } from '@/lib/firebase/server';
import ProductDetailsClient, {
  type DetailsCategory,
  type DetailsProduct,
} from './ProductDetailsClient';

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!slug) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl text-gray-600">Produto não encontrado</p>
      </div>
    );
  }

  const snap = await getDoc(doc(firestoreServerDb, 'products', slug));
  if (!snap.exists()) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl text-gray-600">Produto não encontrado</p>
      </div>
    );
  }

  const data = snap.data() as any;
  const imageUrls = Array.isArray(data.imageUrls) ? (data.imageUrls as string[]).filter(Boolean) : [];

  const product: DetailsProduct = {
    id: String(snap.id),
    categoryId: String(data.categoryId ?? ''),
    name: String(data.name ?? ''),
    description: String(data.description ?? ''),
    imageUrls,
    mainImageUrl: typeof data.mainImageUrl === 'string' ? data.mainImageUrl : undefined,
    videoUrl: typeof data.videoUrl === 'string' && data.videoUrl ? data.videoUrl : undefined,
    priceCents:
      typeof data.priceCents === 'number' || typeof data.priceCents === 'string'
        ? data.priceCents
        : undefined,
  };

  let category: DetailsCategory | null = null;
  if (product.categoryId) {
    const catSnap = await getDoc(doc(firestoreServerDb, 'categories', product.categoryId));
    if (catSnap.exists()) {
      const c = catSnap.data() as any;
      category = {
        id: String(catSnap.id),
        name: String(c.name ?? ''),
        color: String(c.color ?? '#0D6AA7'),
      };
    }
  }

  const categoriesQuery = query(
    collection(firestoreServerDb, 'categories'),
    where('active', '==', true),
    orderBy('order', 'asc')
  );
  const categoriesSnap = await getDocs(categoriesQuery);
  const categoriesById: Record<string, DetailsCategory> = {};
  for (const d of categoriesSnap.docs) {
    const c = d.data() as any;
    categoriesById[d.id] = {
      id: String(d.id),
      name: String(c.name ?? ''),
      color: String(c.color ?? '#0D6AA7'),
    };
  }

  // Suggested products: same category first, then any others.
  const suggestedQuery = query(
    collection(firestoreServerDb, 'products'),
    where('active', '==', true),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  const suggestedSnap = await getDocs(suggestedQuery);
  const allSuggested: DetailsProduct[] = suggestedSnap.docs
    .filter((d) => d.id !== product.id)
    .map((d) => {
      const p = d.data() as any;
      const urls = Array.isArray(p.imageUrls) ? (p.imageUrls as string[]).filter(Boolean) : [];
      return {
        id: String(d.id),
        categoryId: String(p.categoryId ?? ''),
        name: String(p.name ?? ''),
        description: String(p.description ?? ''),
        imageUrls: urls,
        mainImageUrl: typeof p.mainImageUrl === 'string' ? p.mainImageUrl : undefined,
        priceCents:
          typeof p.priceCents === 'number' || typeof p.priceCents === 'string'
            ? p.priceCents
            : undefined,
      };
    });

  const suggestedProducts = allSuggested.sort((a, b) => {
    const aSame = a.categoryId === product.categoryId;
    const bSame = b.categoryId === product.categoryId;
    if (aSame !== bSame) return aSame ? -1 : 1;
    return 0;
  });

  return (
    <ProductDetailsClient
      product={product}
      category={category}
      suggestedProducts={suggestedProducts}
      categoriesById={categoriesById}
    />
  );
}
