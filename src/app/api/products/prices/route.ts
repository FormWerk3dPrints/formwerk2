import { NextResponse } from 'next/server';
import { firebaseAdminAuth, firebaseAdminDb } from '@/lib/firebase/adminServer';
import { coercePriceToCents } from '@/lib/prices/coerceToCents';

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

/**
 * Mapa id -> preço de todos os produtos ativos, só para usuário verified.
 * Payload enxuto de propósito: as listagens já têm nome/imagem vindos do
 * server component; aqui só falta o preço, que não pode trafegar para quem
 * não tem direito. Sem token válido responde `{ verified: false, prices: {} }`.
 */
export async function GET(req: Request) {
  try {
    const token = getBearerToken(req);
    const verified = token ? await isVerifiedUser(token) : false;

    if (!verified) {
      return NextResponse.json({ verified: false, prices: {} });
    }

    const snap = await firebaseAdminDb
      .collection('products')
      .where('active', '==', true)
      .get();

    const prices: Record<string, { priceCents: number; currency: string }> = {};
    for (const doc of snap.docs) {
      const data = doc.data();
      prices[doc.id] = {
        priceCents: coercePriceToCents(data.priceCents),
        currency: typeof data.currency === 'string' && data.currency ? data.currency : 'BRL',
      };
    }

    return NextResponse.json({ verified: true, prices });
  } catch {
    return NextResponse.json({ error: 'Erro ao carregar preços' }, { status: 500 });
  }
}
