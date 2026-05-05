import { NextResponse } from 'next/server';
import { firebaseAdminAuth, firebaseAdminDb } from '@/lib/firebase/adminServer';

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
}

async function assertAdminAccess(req: Request): Promise<void> {
  const token = getBearerToken(req);
  if (!token) throw new Error('missing-token');

  const decoded = await firebaseAdminAuth.verifyIdToken(token);
  const email = decoded.email?.trim().toLowerCase();
  if (!email) throw new Error('forbidden');

  const adminDoc = await firebaseAdminDb.collection('admins').doc(email).get();
  if (!adminDoc.exists || adminDoc.data()?.active !== true) throw new Error('forbidden');
}

export async function GET(req: Request) {
  try {
    await assertAdminAccess(req);

    const [catSnap, prodSnap, userSnap] = await Promise.all([
      firebaseAdminDb.collection('categories').count().get(),
      firebaseAdminDb.collection('products').count().get(),
      firebaseAdminDb.collection('userProfiles').count().get(),
    ]);

    return NextResponse.json({
      categories: catSnap.data().count,
      products: prodSnap.data().count,
      userProfiles: userSnap.data().count,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'missing-token') {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'forbidden') {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
    }
    console.error('[api/admin/stats][GET]', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
