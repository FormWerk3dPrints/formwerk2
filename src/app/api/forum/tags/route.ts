import { NextResponse } from 'next/server';
import { firebaseAdminDb } from '@/lib/firebase/adminServer';

export async function GET() {
  try {
    const [catSnap, prodSnap, kitsSnap] = await Promise.all([
      firebaseAdminDb.collection('categories').where('active', '==', true).get(),
      firebaseAdminDb.collection('products').where('active', '==', true).get(),
      firebaseAdminDb.collection('kits').where('active', '==', true).get(),
    ]);

    return NextResponse.json({
      categories: catSnap.docs.map((d) => ({
        id: d.id,
        name: String(d.data().name ?? d.id),
        color: String(d.data().color ?? '#0D6AA7'),
      })),
      products: prodSnap.docs.map((d) => ({
        id: d.id,
        name: String(d.data().name ?? d.id),
      })),
      kits: kitsSnap.docs.map((d) => ({
        id: d.id,
        name: String(d.data().name ?? d.id),
      })),
    });
  } catch {
    return NextResponse.json({ error: 'Erro ao carregar tags' }, { status: 500 });
  }
}
