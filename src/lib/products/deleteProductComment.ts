import { firestoreDb } from '../firebase/client';
import { doc, deleteDoc } from 'firebase/firestore';

export async function deleteProductComment(productId: string, commentId: string) {
  const commentRef = doc(firestoreDb, 'products', productId, 'comments', commentId);
  await deleteDoc(commentRef);
}
