import { firestoreDb } from '../firebase/client';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { ProductComment } from './ProductComment';

export async function updateProductComment(productId: string, commentId: string, data: Partial<Omit<ProductComment, 'id' | 'date'>>) {
  const commentRef = doc(firestoreDb, 'products', productId, 'comments', commentId);
  await updateDoc(commentRef, {
    ...data,
    date: Timestamp.now(),
  });
}
