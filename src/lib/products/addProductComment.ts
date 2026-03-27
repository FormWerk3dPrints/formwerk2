import { firestoreDb } from '../firebase/client';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { ProductComment } from './ProductComment';

export async function addProductComment(productId: string, comment: Omit<ProductComment, 'id' | 'date'>) {
  const commentsRef = collection(firestoreDb, 'products', productId, 'comments');
  const docRef = await addDoc(commentsRef, {
    ...comment,
    date: Timestamp.now(),
  });
  return docRef.id;
}
