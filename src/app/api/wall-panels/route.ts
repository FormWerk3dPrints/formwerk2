import { NextResponse } from 'next/server';
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

    const snap = await firebaseAdminDb
      .collection('wall-panels')
      .where('active', '==', true)
      .get();

    const wallPanels = snap.docs
      .map((d) => {
        const data = d.data();
        const createdAtMs =
          typeof data.createdAt?.toMillis === 'function' ? data.createdAt.toMillis() : 0;
        const base = {
          id: d.id,
          slug: typeof data.slug === 'string' ? data.slug : d.id,
          name: typeof data.name === 'string' ? data.name : '',
          currency: typeof data.currency === 'string' ? data.currency : 'BRL',
          widthMm: typeof data.widthMm === 'number' ? data.widthMm : 0,
          heightMm: typeof data.heightMm === 'number' ? data.heightMm : 0,
          imageUrls: Array.isArray(data.imageUrls)
            ? (data.imageUrls as string[]).filter(Boolean)
            : [],
          mainImageUrl: typeof data.mainImageUrl === 'string' ? data.mainImageUrl : undefined,
          active: data.active !== false,
          _createdAtMs: createdAtMs,
        };

        if (verified) {
          return {
            ...base,
            priceCents: typeof data.priceCents === 'number' ? data.priceCents : undefined,
          };
        }

        return base;
      })
      .sort((a, b) => b._createdAtMs - a._createdAtMs)
      .map(({ _createdAtMs: _, ...wallPanel }) => wallPanel);

    return NextResponse.json({ wallPanels });
  } catch {
    return NextResponse.json({ error: 'Erro ao carregar painéis' }, { status: 500 });
  }
}
