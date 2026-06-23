import { notFound } from 'next/navigation';
import { collection, doc, getDoc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { firestoreServerDb } from '@/lib/firebase/server';
import KitDetailClient, { type KitDetail, type KitProduct } from './KitDetailClient';

export const dynamic = 'force-dynamic';

export default async function KitSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const kitSnap = await getDoc(doc(firestoreServerDb, 'kits', slug));
  if (!kitSnap.exists()) notFound();

  const data = kitSnap.data() as any;
  if (!data.active) notFound();

  const productIds: string[] = Array.isArray(data.productIds) ? data.productIds : [];

  const kit: KitDetail = {
    id: kitSnap.id,
    name: String(data.name ?? ''),
    description: String(data.description ?? ''),
    color: typeof data.color === 'string' && data.color ? data.color : '#0D6AA7',
    priceCents: typeof data.priceCents === 'number' ? data.priceCents : 0,
    currency: typeof data.currency === 'string' && data.currency ? data.currency : 'BRL',
    imageUrls: Array.isArray(data.imageUrls) ? (data.imageUrls as string[]).filter(Boolean) : [],
    mainImageUrl: typeof data.mainImageUrl === 'string' ? data.mainImageUrl : undefined,
  };

  let products: KitProduct[] = [];
  if (productIds.length > 0) {
    const productsSnap = await getDocs(
      query(
        collection(firestoreServerDb, 'products'),
        where('active', '==', true),
        orderBy('name', 'asc')
      )
    );
    const activeIds = new Set(productIds);
    products = productsSnap.docs
      .filter((d) => activeIds.has(d.id))
      .map((d) => {
        const p = d.data() as any;
        const imageUrls = Array.isArray(p.imageUrls)
          ? (p.imageUrls as string[]).filter(Boolean)
          : [];
        return {
          id: d.id,
          name: String(p.name ?? ''),
          description: String(p.description ?? ''),
          imageUrls,
          mainImageUrl: typeof p.mainImageUrl === 'string' ? p.mainImageUrl : undefined,
        };
      })
      .sort((a, b) => productIds.indexOf(a.id) - productIds.indexOf(b.id));
  }

  return <KitDetailClient kit={kit} products={products} />;
}
