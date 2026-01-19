import { NextResponse } from 'next/server';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { firestoreServerDb } from '@/lib/firebase/server';

export async function GET() {
  try {
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

      return {
        id: String(d.id),
        categoryId: typeof data.categoryId === 'string' ? data.categoryId : '',
        name: typeof data.name === 'string' ? data.name : '',
        pluralName: typeof data.pluralName === 'string' ? data.pluralName : '',
        description: typeof data.description === 'string' ? data.description : '',
        imageUrls,
        mainImageUrl: typeof data.mainImageUrl === 'string' ? data.mainImageUrl : undefined,
        keywords: Array.isArray(data.keywords) ? (data.keywords as string[]).filter(Boolean) : [],
        nameTokens: Array.isArray(data.nameTokens)
          ? (data.nameTokens as string[]).filter(Boolean)
          : [],
        priceCents: typeof data.priceCents === 'number' ? data.priceCents : undefined,
        active: data.active !== false,
        createdAt,
        updatedAt,
      };
    });

    return NextResponse.json({ products });
  } catch {
    return NextResponse.json(
      { error: 'Erro ao carregar produtos' },
      { status: 500 }
    );
  }
}
