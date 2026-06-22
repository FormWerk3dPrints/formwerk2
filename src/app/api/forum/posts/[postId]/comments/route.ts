import { NextResponse } from 'next/server';
import { FieldValue, type DocumentData } from 'firebase-admin/firestore';
import { firebaseAdminAuth, firebaseAdminDb } from '@/lib/firebase/adminServer';
import {
  decryptProfilePayload,
  type EncryptedBlob,
} from '@/lib/security/userProfileCrypto';
import type { ForumComment } from '@/lib/forum/types';

function getBearerToken(req: Request): string | null {
  const h = req.headers.get('authorization');
  if (!h) return null;
  const [scheme, token] = h.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token.trim() : null;
}

function mapComment(id: string, postId: string, data: DocumentData): ForumComment {
  return {
    id,
    postId,
    parentCommentId:
      typeof data.parentCommentId === 'string' ? data.parentCommentId : null,
    authorUid: String(data.authorUid ?? ''),
    authorName: String(data.authorName ?? 'Usuário'),
    authorInstitution: String(data.authorInstitution ?? ''),
    authorAvatarUrl: typeof data.authorAvatarUrl === 'string' ? data.authorAvatarUrl : null,
    body: String(data.body ?? ''),
    likeCount: typeof data.likeCount === 'number' ? data.likeCount : 0,
    dislikeCount: typeof data.dislikeCount === 'number' ? data.dislikeCount : 0,
    replyCount: typeof data.replyCount === 'number' ? data.replyCount : 0,
    createdAt:
      typeof data.createdAt?.toDate === 'function'
        ? data.createdAt.toDate().toISOString()
        : new Date().toISOString(),
  };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
  const url = new URL(req.url);
  const parentCommentId = url.searchParams.get('parentCommentId'); // null param = top-level

  try {
    const snap = await firebaseAdminDb
      .collection('forumPosts')
      .doc(postId)
      .collection('comments')
      .orderBy('createdAt', 'asc')
      .limit(200)
      .get();

    let comments = snap.docs.map((d) => mapComment(d.id, postId, d.data()));

    // Filter in memory to avoid composite index
    if (parentCommentId === null || parentCommentId === undefined) {
      comments = comments.filter((c) => c.parentCommentId === null);
    } else {
      comments = comments.filter((c) => c.parentCommentId === parentCommentId);
    }

    return NextResponse.json({ comments: comments.slice(0, 100) });
  } catch (err) {
    console.error('[GET /api/forum/posts/[postId]/comments]', err);
    return NextResponse.json({ error: 'Erro ao carregar comentários.' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
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
      { error: 'Complete seu perfil antes de comentar.' },
      { status: 403 }
    );
  }

  // Author info
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

  const payload = body as Record<string, unknown>;
  const commentBody =
    typeof payload.body === 'string' ? payload.body.trim() : '';
  const parentCommentId =
    typeof payload.parentCommentId === 'string' ? payload.parentCommentId : null;

  if (!commentBody)
    return NextResponse.json({ error: 'O comentário não pode estar vazio.' }, { status: 400 });

  const commentsCol = firebaseAdminDb
    .collection('forumPosts')
    .doc(postId)
    .collection('comments');

  const newRef = commentsCol.doc();
  await newRef.set({
    parentCommentId,
    authorUid: uid,
    authorName,
    authorInstitution,
    authorAvatarUrl,
    body: commentBody,
    likeCount: 0,
    dislikeCount: 0,
    replyCount: 0,
    createdAt: FieldValue.serverTimestamp(),
  });

  // Increment post commentCount
  await firebaseAdminDb
    .collection('forumPosts')
    .doc(postId)
    .update({ commentCount: FieldValue.increment(1) });

  // If reply, increment parent replyCount
  if (parentCommentId) {
    try {
      await commentsCol.doc(parentCommentId).update({
        replyCount: FieldValue.increment(1),
      });
    } catch { /* parent may not exist */ }
  }

  return NextResponse.json({ id: newRef.id }, { status: 201 });
}
