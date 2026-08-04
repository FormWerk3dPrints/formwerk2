import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { firestoreServerDb } from '@/lib/firebase/server';
import PaineisClient, { type WallPanelModule } from './PaineisClient';

export const dynamic = 'force-dynamic';

export default async function PaineisPage() {
  const wallPanelsQuery = query(
    collection(firestoreServerDb, 'wall-panels'),
    where('active', '==', true),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(wallPanelsQuery);

  const modules: WallPanelModule[] = snap.docs.map((d) => {
    const data = d.data() as any;
    const imageUrls = Array.isArray(data.imageUrls)
      ? (data.imageUrls as string[]).filter(Boolean)
      : [];

    return {
      id: String(d.id),
      slug: typeof data.slug === 'string' ? data.slug : String(d.id),
      name: String(data.name ?? ''),
      widthMm: typeof data.widthMm === 'number' ? data.widthMm : 0,
      heightMm: typeof data.heightMm === 'number' ? data.heightMm : 0,
      imageUrls,
      mainImageUrl: typeof data.mainImageUrl === 'string' ? data.mainImageUrl : undefined,
    };
  });

  return <PaineisClient modules={modules} />;
}
