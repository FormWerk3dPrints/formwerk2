import { NextResponse } from 'next/server';
import { FieldValue, type DocumentData } from 'firebase-admin/firestore';
import { firebaseAdminAuth, firebaseAdminDb } from '@/lib/firebase/adminServer';
import {
  decryptProfilePayload,
  type EncryptedBlob,
} from '@/lib/security/userProfileCrypto';
import type { ForumPost, ForumTag } from '@/lib/forum/types';

function getBearerToken(req: Request): string | null {
  const h = req.headers.get('authorization');
  if (!h) return null;
  const [scheme, token] = h.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token.trim() : null;
}

function mapPost(id: string, data: DocumentData): ForumPost & { _createdAtMs: number } {
  const createdAtMs =
    typeof data.createdAt?.toMillis === 'function' ? data.createdAt.toMillis() : 0;
  return {
    id,
    authorUid: String(data.authorUid ?? ''),
    authorName: String(data.authorName ?? 'Usuário'),
    authorInstitution: String(data.authorInstitution ?? ''),
    authorAvatarUrl: typeof data.authorAvatarUrl === 'string' ? data.authorAvatarUrl : null,
    title: String(data.title ?? ''),
    body: String(data.body ?? ''),
    imageUrls: Array.isArray(data.imageUrls) ? (data.imageUrls as string[]) : [],
    videoUrl: typeof data.videoUrl === 'string' && data.videoUrl ? data.videoUrl : null,
    tags: Array.isArray(data.tags) ? (data.tags as ForumTag[]) : [],
    tagKeys: Array.isArray(data.tagKeys) ? (data.tagKeys as string[]) : [],
    likeCount: typeof data.likeCount === 'number' ? data.likeCount : 0,
    dislikeCount: typeof data.dislikeCount === 'number' ? data.dislikeCount : 0,
    commentCount: typeof data.commentCount === 'number' ? data.commentCount : 0,
    createdAt: new Date(createdAtMs || Date.now()).toISOString(),
    updatedAt:
      typeof data.updatedAt?.toDate === 'function'
        ? data.updatedAt.toDate().toISOString()
        : new Date().toISOString(),
    _createdAtMs: createdAtMs,
  };
}

function hotScore(likeCount: number, createdAtMs: number): number {
  const ageHours = (Date.now() - createdAtMs) / 3_600_000;
  return likeCount / Math.pow(ageHours + 2, 1.5);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sort = url.searchParams.get('sort') ?? 'padrao';
  const tag = url.searchParams.get('tag') ?? 'all';

  try {
    const snap = await firebaseAdminDb
      .collection('forumPosts')
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();

    let posts = snap.docs.map((d) => mapPost(d.id, d.data()));

    // Tag filter
    if (tag !== 'all') {
      if (tag === 'geral' || tag.includes(':')) {
        posts = posts.filter((p) => p.tagKeys.includes(tag));
      } else {
        // 'product', 'category', 'kit' — filter by prefix
        posts = posts.filter((p) => p.tagKeys.some((k) => k.startsWith(`${tag}:`)));
      }
    }

    // Sort
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    switch (sort) {
      case 'em-alta':
        posts = posts.filter((p) => p._createdAtMs > weekAgo);
        posts.sort((a, b) => b.likeCount - a.likeCount);
        break;
      case 'all-time':
        posts.sort((a, b) => b.likeCount - a.likeCount);
        break;
      case 'novos':
        // already desc from Firestore
        break;
      default: // padrao
        posts.sort(
          (a, b) =>
            hotScore(b.likeCount, b._createdAtMs) - hotScore(a.likeCount, a._createdAtMs)
        );
        break;
    }

    // Strip internal field
    const result = posts.slice(0, 50).map(({ _createdAtMs: _, ...p }) => p);
    return NextResponse.json({ posts: result });
  } catch (err) {
    console.error('[GET /api/forum/posts]', err);
    return NextResponse.json({ error: 'Erro ao carregar posts' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  let uid: string;
  try {
    const decoded = await firebaseAdminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Token inválido.' }, { status: 401 });
  }

  // Must have a registered profile
  const profileDoc = await firebaseAdminDb.collection('userProfiles').doc(uid).get();
  if (!profileDoc.exists || !profileDoc.data()?.encryptedProfile) {
    return NextResponse.json(
      { error: 'Complete seu perfil antes de postar no fórum.' },
      { status: 403 }
    );
  }

  // Get author info
  let authorName = 'Usuário';
  let authorInstitution = '';
  let authorAvatarUrl: string | null = null;
  try {
    const pd = profileDoc.data() as Record<string, unknown>;
    const decrypted = decryptProfilePayload<{
      fullName: string;
      educationInstitution: string;
    }>(pd.encryptedProfile as EncryptedBlob);
    authorName = decrypted.fullName || 'Usuário';
    authorInstitution = decrypted.educationInstitution || '';
    authorAvatarUrl = typeof pd.avatarUrl === 'string' ? pd.avatarUrl : null;
  } catch { /* use defaults */ }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const postBody = typeof payload.body === 'string' ? payload.body.trim() : '';
  const tags: ForumTag[] = Array.isArray(payload.tags) ? (payload.tags as ForumTag[]) : [];
  const imageUrls: string[] = Array.isArray(payload.imageUrls)
    ? (payload.imageUrls as string[]).filter((u) => typeof u === 'string')
    : [];
  const videoUrl: string | null =
    typeof payload.videoUrl === 'string' && payload.videoUrl ? payload.videoUrl : null;

  if (!title) return NextResponse.json({ error: 'Título é obrigatório.' }, { status: 400 });
  if (!postBody)
    return NextResponse.json({ error: 'Conteúdo é obrigatório.' }, { status: 400 });
  if (tags.length === 0)
    return NextResponse.json({ error: 'Selecione pelo menos uma tag.' }, { status: 400 });

  const tagKeys = tags.map((t) => (t.type === 'geral' ? 'geral' : `${t.type}:${t.refId}`));

  const newRef = firebaseAdminDb.collection('forumPosts').doc();
  await newRef.set({
    authorUid: uid,
    authorName,
    authorInstitution,
    authorAvatarUrl,
    title,
    body: postBody,
    imageUrls,
    videoUrl,
    tags,
    tagKeys,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ id: newRef.id }, { status: 201 });
}
