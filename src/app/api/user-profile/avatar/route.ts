import { NextResponse } from 'next/server';
import { firebaseAdminAuth, firebaseAdminDb } from '@/lib/firebase/adminServer';

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
}

export async function PATCH(req: Request) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await firebaseAdminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Token inválido.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const avatarUrl =
    body && typeof body === 'object' && 'avatarUrl' in body
      ? (body as Record<string, unknown>).avatarUrl
      : undefined;

  if (typeof avatarUrl !== 'string' || !avatarUrl.startsWith('https://')) {
    return NextResponse.json({ error: 'URL de avatar inválida.' }, { status: 400 });
  }

  try {
    await firebaseAdminDb.collection('userProfiles').doc(uid).set(
      { avatarUrl, updatedAt: new Date() },
      { merge: true }
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Erro ao salvar avatar.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await firebaseAdminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Token inválido.' }, { status: 401 });
  }

  try {
    const { FieldValue } = await import('firebase-admin/firestore');
    await firebaseAdminDb.collection('userProfiles').doc(uid).update({
      avatarUrl: FieldValue.delete(),
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Erro ao remover avatar.' }, { status: 500 });
  }
}
