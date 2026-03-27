import { firestoreDb } from '../firebase/client';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { ProductComment } from './ProductComment';

export async function getProductComments(productId: string): Promise<ProductComment[]> {
  const commentsRef = collection(firestoreDb, 'products', productId, 'comments');
  const q = query(commentsRef, orderBy('date', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    date: doc.data().date?.toDate?.() ?? null,
  }) as ProductComment);
}
