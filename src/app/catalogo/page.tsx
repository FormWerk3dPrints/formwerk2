import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { firestoreServerDb } from '@/lib/firebase/server';
import CatalogoClient, {
  type CatalogCategory,
  type CatalogProduct,
} from './CatalogoClient';

// Força a página a ser dinâmica (sem cache estático)
export const dynamic = 'force-dynamic';

export default async function Catalogo() {
  const categoriesQuery = query(
    collection(firestoreServerDb, 'categories'),
    where('active', '==', true),
    orderBy('order', 'asc')
  );
  const categoriesSnap = await getDocs(categoriesQuery);
  const categories: CatalogCategory[] = categoriesSnap.docs.map((d) => {
    const data = d.data() as Partial<CatalogCategory> & {
      description?: string;
      color?: string;
      name?: string;
    };

    return {
      id: d.id,
      name: String(data.name ?? ''),
      description: String(data.description ?? ''),
      color: String(data.color ?? '#0D6AA7'),
    };
  });

  const productsQuery = query(
    collection(firestoreServerDb, 'products'),
    where('active', '==', true),
    orderBy('createdAt', 'desc')
  );
  const productsSnap = await getDocs(productsQuery);
  const products: CatalogProduct[] = productsSnap.docs.map((d) => {
    const data = d.data() as any;
    const imageUrls = Array.isArray(data.imageUrls)
      ? (data.imageUrls as string[]).filter(Boolean)
      : [];

    return {
      id: String(d.id),
      categoryIds: Array.isArray(data.categoryIds)
        ? data.categoryIds
        : (typeof data.categoryId === 'string' && data.categoryId ? [data.categoryId] : []),
      name: String(data.name ?? ''),
      description: String(data.description ?? ''),
      imageUrls,
      mainImageUrl: typeof data.mainImageUrl === 'string' ? data.mainImageUrl : undefined,
    };
  });

  return <CatalogoClient categories={categories} products={products} />;
}
