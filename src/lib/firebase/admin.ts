import { doc, getDoc } from 'firebase/firestore';
import { firestoreDb } from './client';

// Cache para evitar múltiplas chamadas ao Firestore
const adminCache = new Map<string, { isAdmin: boolean; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

export async function isAdminEmail(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;

  const normalizedEmail = email.toLowerCase().trim();

  // Verificar cache
  const cached = adminCache.get(normalizedEmail);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.isAdmin;
  }

  try {
    // Buscar no Firestore - documento com ID = email
    const adminDoc = await getDoc(doc(firestoreDb, 'admins', normalizedEmail));
    const isAdmin = adminDoc.exists() && adminDoc.data()?.active === true;

    // Atualizar cache
    adminCache.set(normalizedEmail, { isAdmin, timestamp: Date.now() });

    return isAdmin;
  } catch (error) {
    console.error('Erro ao verificar admin:', error);
    return false;
  }
}
