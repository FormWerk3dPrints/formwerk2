import {
  deleteObject,
  getDownloadURL,
  listAll,
  ref as storageRef,
  uploadBytes,
} from 'firebase/storage';
import {
  doc,
  getDoc,
  type Timestamp,
} from 'firebase/firestore';
import { firebaseStorage, firestoreDb } from '@/lib/firebase/client';

export type Category = {
  id: string;
  name: string;
  description: string;
  color: string;
  order: number;
  active: boolean;
};

export type Product = {
  id: string; // slug
  slug: string;
  name: string;
  pluralName: string;
  nameNormalized: string;
  nameTokens: string[];
  keywords: string[];
  description: string;
  categoryIds: string[];
  priceCents: number;
  currency: string;
  imageUrls: string[];
  mainImageUrl?: string;
  videoUrl?: string;
  salesCount: number;
  active: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type Kit = {
  id: string; // slug
  slug: string;
  name: string;
  description: string;
  productIds: string[];
  priceCents: number;
  currency: string;
  color: string;
  imageUrls: string[];
  mainImageUrl?: string;
  active: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export function formatTimestamp(ts?: Timestamp): string {
  if (!ts) return '';
  try {
    return ts.toDate().toLocaleString('pt-BR');
  } catch {
    return '';
  }
}

export function logAndAlertError(prefix: string, error: unknown) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(`${prefix}:`, error);
  window.alert(`${prefix}:\n${errorMessage}`);
}

export async function findAvailableDocId(
  collectionName: 'products' | 'categories' | 'kits',
  baseId: string
): Promise<string> {
  const sanitized = baseId || 'item';

  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? sanitized : `${sanitized}-${i + 1}`;
    const ref = doc(firestoreDb, collectionName, candidate);
    const snap = await getDoc(ref);
    if (!snap.exists()) return candidate;
  }

  return `${sanitized}-${Date.now()}`;
}

function fileExtensionFromName(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot === -1) return '';
  return fileName.slice(lastDot + 1).trim().toLowerCase();
}

function toPaddedIndex(n: number): string {
  return String(n).padStart(2, '0');
}

export function storageObjectRefFromUrl(url: string) {
  if (url.startsWith('gs://')) {
    const withoutScheme = url.slice('gs://'.length);
    const firstSlash = withoutScheme.indexOf('/');
    const objectPath = firstSlash === -1 ? '' : withoutScheme.slice(firstSlash + 1);
    return storageRef(firebaseStorage, objectPath);
  }

  const parsed = new URL(url);
  const match = parsed.pathname.match(/\/o\/(.+)$/);
  if (!match) {
    throw new Error('URL de Storage inválida.');
  }

  const objectPath = decodeURIComponent(match[1]);
  return storageRef(firebaseStorage, objectPath);
}

async function getNextImageIndex(slug: string): Promise<number> {
  const folder = storageRef(firebaseStorage, `products/${slug}`);
  try {
    const listed = await listAll(folder);
    let maxIndex = 0;

    for (const item of listed.items) {
      const name = item.name;
      const match = name.match(/-(\d+)\.[a-z0-9]+$/i);
      if (!match) continue;
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed) && parsed > maxIndex) maxIndex = parsed;
    }

    return maxIndex + 1;
  } catch {
    return 1;
  }
}

export async function uploadKitImages(slug: string, files: File[]): Promise<string[]> {
  if (!files.length) return [];

  const folder = storageRef(firebaseStorage, `kits/${slug}`);
  let startIndex = 1;
  try {
    const listed = await listAll(folder);
    let maxIndex = 0;
    for (const item of listed.items) {
      const match = item.name.match(/-(\d+)\.[a-z0-9]+$/i);
      if (!match) continue;
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed) && parsed > maxIndex) maxIndex = parsed;
    }
    startIndex = maxIndex + 1;
  } catch {
    startIndex = 1;
  }

  const uploadedUrls: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = fileExtensionFromName(file.name);
    const fileName = `${slug}-${toPaddedIndex(startIndex + i)}${ext ? `.${ext}` : ''}`;
    const objectRef = storageRef(firebaseStorage, `kits/${slug}/${fileName}`);
    await uploadBytes(objectRef, file);
    const url = await getDownloadURL(objectRef);
    uploadedUrls.push(url);
  }

  return uploadedUrls;
}

export async function uploadProductImages(slug: string, files: File[]): Promise<string[]> {
  if (!files.length) return [];

  const startIndex = await getNextImageIndex(slug);
  const uploadedUrls: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = fileExtensionFromName(file.name);
    const index = startIndex + i;
    const fileName = `${slug}-${toPaddedIndex(index)}${ext ? `.${ext}` : ''}`;
    const objectRef = storageRef(firebaseStorage, `products/${slug}/${fileName}`);
    await uploadBytes(objectRef, file);
    const url = await getDownloadURL(objectRef);
    uploadedUrls.push(url);
  }

  return uploadedUrls;
}

export async function uploadProductVideo(slug: string, file: File): Promise<string> {
  const ext = fileExtensionFromName(file.name);
  const fileName = `${slug}-video${ext ? `.${ext}` : ''}`;
  const objectRef = storageRef(firebaseStorage, `products/${slug}/${fileName}`);
  await uploadBytes(objectRef, file);
  return getDownloadURL(objectRef);
}

export async function deleteStorageObject(url: string) {
  try {
    await deleteObject(storageObjectRefFromUrl(url));
  } catch (e) {
    console.warn('Falha ao remover do Storage:', e);
  }
}
