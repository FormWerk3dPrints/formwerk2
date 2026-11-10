import { cert, getApp, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

function getPrivateKeyFromEnv(): string | undefined {
  const value = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (!value) return undefined;
  return value.replace(/\\n/g, '\n');
}

function getFirebaseAdminApp(): App {
  if (getApps().length > 0) return getApp();

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = getPrivateKeyFromEnv();

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase Admin não configurado. Defina FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL e FIREBASE_ADMIN_PRIVATE_KEY.'
    );
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const firebaseAdminApp = getFirebaseAdminApp();

export const firebaseAdminAuth = getAuth(firebaseAdminApp);
export const firebaseAdminDb = getFirestore(firebaseAdminApp);

/**
 * Bucket do Storage pelo lado do servidor (usado para guardar o PDF dos
 * orçamentos). O nome vem da mesma variável que o SDK do navegador usa.
 */
export function firebaseAdminBucket() {
  const nome = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!nome) {
    throw new Error('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET não definido.');
  }
  return getStorage(firebaseAdminApp).bucket(nome);
}
