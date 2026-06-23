import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { firestoreServerDb } from '@/lib/firebase/server';
import KitsClient, { type CatalogKit } from './KitsClient';

export const dynamic = 'force-dynamic';

export default async function KitsPage() {
  const kitsQuery = query(
    collection(firestoreServerDb, 'kits'),
    where('active', '==', true),
    orderBy('createdAt', 'desc')
  );
  const kitsSnap = await getDocs(kitsQuery);
  const kits: CatalogKit[] = kitsSnap.docs.map((d) => {
    const data = d.data() as any;
    const imageUrls = Array.isArray(data.imageUrls)
      ? (data.imageUrls as string[]).filter(Boolean)
      : [];

    return {
      id: String(d.id),
      name: String(data.name ?? ''),
      description: String(data.description ?? ''),
      color: typeof data.color === 'string' && data.color ? data.color : '#0D6AA7',
      imageUrls,
      mainImageUrl: typeof data.mainImageUrl === 'string' ? data.mainImageUrl : undefined,
    };
  });

  return <KitsClient kits={kits} />;
}
