import { doc, getDoc } from 'firebase/firestore';
import { firestoreDb } from '@/lib/firebase/client';

export interface GlobalStats {
  totalSalesCount: number;
}

const STATS_DOC = doc(firestoreDb, 'siteStats', 'global');

export async function getGlobalStats(): Promise<GlobalStats> {
  const snap = await getDoc(STATS_DOC);
  if (!snap.exists()) {
    return { totalSalesCount: 0 };
  }
  const data = snap.data();
  return {
    totalSalesCount: typeof data.totalSalesCount === 'number' ? data.totalSalesCount : 0,
  };
}
