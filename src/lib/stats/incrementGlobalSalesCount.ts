import { doc, increment, setDoc } from 'firebase/firestore';
import { firestoreDb } from '@/lib/firebase/client';

const STATS_DOC = doc(firestoreDb, 'siteStats', 'global');

/**
 * Atomically increments totalSalesCount by the given amount.
 * Uses merge so the document is created automatically if it doesn't exist yet.
 */
export async function incrementGlobalSalesCount(amount: number): Promise<void> {
  await setDoc(STATS_DOC, { totalSalesCount: increment(amount) }, { merge: true });
}
