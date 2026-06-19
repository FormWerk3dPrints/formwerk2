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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (!slug) {
    return NextResponse.json({ error: 'Slug inválido' }, { status: 400 });
  }

  try {
    const token = getBearerToken(req);
    const verified = token ? await isVerifiedUser(token) : false;

    const snap = await firebaseAdminDb.collection('kits').doc(slug).get();

    if (!snap.exists) {
      return NextResponse.json({ error: 'Kit não encontrado' }, { status: 404 });
    }

    const data = snap.data()!;

    const base = {
      id: snap.id,
      slug: typeof data.slug === 'string' ? data.slug : snap.id,
      name: typeof data.name === 'string' ? data.name : '',
      description: typeof data.description === 'string' ? data.description : '',
      productIds: Array.isArray(data.productIds) ? (data.productIds as string[]) : [],
      currency: typeof data.currency === 'string' ? data.currency : 'BRL',
      imageUrls: Array.isArray(data.imageUrls)
        ? (data.imageUrls as string[]).filter(Boolean)
        : [],
      mainImageUrl: typeof data.mainImageUrl === 'string' ? data.mainImageUrl : undefined,
      active: data.active !== false,
      createdAt:
        typeof data.createdAt?.toDate === 'function'
          ? data.createdAt.toDate().toISOString()
          : undefined,
    };

    if (verified) {
      return NextResponse.json({
        kit: { ...base, priceCents: typeof data.priceCents === 'number' ? data.priceCents : undefined },
      });
    }

    return NextResponse.json({ kit: base });
  } catch {
    return NextResponse.json({ error: 'Erro ao carregar kit' }, { status: 500 });
  }
}
