import { NextResponse } from 'next/server';
import { firebaseAdminAuth, firebaseAdminDb } from '@/lib/firebase/adminServer';

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
}

export async function GET(req: Request) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ verified: false }, { status: 401 });
    }

    const decoded = await firebaseAdminAuth.verifyIdToken(token);
    const docSnap = await firebaseAdminDb.collection('userProfiles').doc(decoded.uid).get();

    const verified = docSnap.exists && docSnap.data()?.verified === true;
    return NextResponse.json({ verified });
  } catch {
    return NextResponse.json({ verified: false }, { status: 401 });
  }
}
