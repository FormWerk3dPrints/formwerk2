import { doc, getDoc } from 'firebase/firestore';
import { firestoreDb } from './client';

// Cache para evitar múltiplas chamadas ao Firestore
const adminCache = new Map<string, { isAdmin: boolean; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

export async function isAdminEmail(email: string | null | undefined): Promise<boolean> {
  console.log('[isAdminEmail] Chamado com email:', JSON.stringify(email));

  if (!email) {
    console.log('[isAdminEmail] Email é null/undefined/vazio — retornando false');
    return false;
  }

  const normalizedEmail = email.toLowerCase().trim();
  console.log('[isAdminEmail] Email normalizado:', JSON.stringify(normalizedEmail));
  console.log('[isAdminEmail] Código de caracteres do email normalizado:', [...normalizedEmail].map((c, i) => `${i}:'${c}'(${c.charCodeAt(0)})`).join(' '));

  // Verificar cache
  const cached = adminCache.get(normalizedEmail);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('[isAdminEmail] Usando cache — isAdmin:', cached.isAdmin, '| idade do cache (ms):', Date.now() - cached.timestamp);
    return cached.isAdmin;
  }
  console.log('[isAdminEmail] Sem cache válido, consultando Firestore...');

  try {
    const docRef = doc(firestoreDb, 'admins', normalizedEmail);
    console.log('[isAdminEmail] Caminho do documento Firestore:', docRef.path);

    const adminDoc = await getDoc(docRef);
    console.log('[isAdminEmail] Documento existe?', adminDoc.exists());

    if (adminDoc.exists()) {
      const data = adminDoc.data();
      console.log('[isAdminEmail] Dados do documento:', JSON.stringify(data));
      console.log('[isAdminEmail] Campo active:', JSON.stringify(data?.active), '| typeof:', typeof data?.active);
      console.log('[isAdminEmail] active === true?', data?.active === true);
    } else {
      console.log('[isAdminEmail] Documento NÃO encontrado em admins/' + normalizedEmail);
    }

    const isAdmin = adminDoc.exists() && adminDoc.data()?.active === true;
    console.log('[isAdminEmail] Resultado final isAdmin:', isAdmin);

    // Atualizar cache
    adminCache.set(normalizedEmail, { isAdmin, timestamp: Date.now() });

    return isAdmin;
  } catch (error) {
    console.error('[isAdminEmail] ERRO ao verificar admin:', error);
    console.error('[isAdminEmail] Tipo do erro:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('[isAdminEmail] Mensagem:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('[isAdminEmail] Stack:', error.stack);
    }
    return false;
  }
}
