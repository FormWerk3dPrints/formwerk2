import { NextResponse } from 'next/server';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { firestoreServerDb } from '@/lib/firebase/server';
import { firebaseAdminAuth, firebaseAdminDb } from '@/lib/firebase/adminServer';

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
}

async function isVerifiedUser(token: string): Promise<boolean> {
  try {
    const decoded = await firebaseAdminAuth.verifyIdToken(token);
    const profileSnap = await firebaseAdminDb
      .collection('userProfiles')
      .doc(decoded.uid)
      .get();
    if (!profileSnap.exists) return false;
    return profileSnap.data()?.verified === true;
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  try {
    const token = getBearerToken(req);
    const verified = token ? await isVerifiedUser(token) : false;

    const productsQuery = query(
      collection(firestoreServerDb, 'products'),
      where('active', '==', true),
      orderBy('createdAt', 'desc')
    );
    const productsSnap = await getDocs(productsQuery);

    const products = productsSnap.docs.map((d) => {
      const data = d.data() as any;
      const imageUrls = Array.isArray(data.imageUrls)
        ? (data.imageUrls as string[]).filter(Boolean)
        : [];

      const createdAt =
        typeof data?.createdAt?.toDate === 'function'
          ? data.createdAt.toDate().toISOString()
          : undefined;
      const updatedAt =
        typeof data?.updatedAt?.toDate === 'function'
          ? data.updatedAt.toDate().toISOString()
          : undefined;

      const base = {
        id: String(d.id),
        categoryIds: Array.isArray(data.categoryIds)
          ? (data.categoryIds as string[])
          : (typeof data.categoryId === 'string' && data.categoryId ? [data.categoryId] : []),
        name: typeof data.name === 'string' ? data.name : '',
        pluralName: typeof data.pluralName === 'string' ? data.pluralName : '',
        description: typeof data.description === 'string' ? data.description : '',
        imageUrls,
        mainImageUrl: typeof data.mainImageUrl === 'string' ? data.mainImageUrl : undefined,
        keywords: Array.isArray(data.keywords) ? (data.keywords as string[]).filter(Boolean) : [],
        nameTokens: Array.isArray(data.nameTokens)
          ? (data.nameTokens as string[]).filter(Boolean)
          : [],
        active: data.active !== false,
        createdAt,
        updatedAt,
      };

      if (verified) {
        return { ...base, priceCents: typeof data.priceCents === 'number' ? data.priceCents : undefined };
      }

      return base;
    });

    return NextResponse.json({ products });
  } catch {
    return NextResponse.json(
      { error: 'Erro ao carregar produtos' },
      { status: 500 }
    );
  }
}
