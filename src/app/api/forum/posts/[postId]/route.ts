import { NextResponse } from 'next/server';
import { firebaseAdminAuth, firebaseAdminDb } from '@/lib/firebase/adminServer';
import type { ForumPost, ForumTag } from '@/lib/forum/types';

function getBearerToken(req: Request): string | null {
  const h = req.headers.get('authorization');
  if (!h) return null;
  const [scheme, token] = h.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token.trim() : null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;

  try {
    const snap = await firebaseAdminDb.collection('forumPosts').doc(postId).get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Post não encontrado.' }, { status: 404 });
    }

    const data = snap.data()!;
    const post: ForumPost = {
      id: snap.id,
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
      createdAt:
        typeof data.createdAt?.toDate === 'function'
          ? data.createdAt.toDate().toISOString()
          : new Date().toISOString(),
      updatedAt:
        typeof data.updatedAt?.toDate === 'function'
          ? data.updatedAt.toDate().toISOString()
          : new Date().toISOString(),
    };

    // Return the user's current vote if authenticated
    let userVote: string | null = null;
    const token = getBearerToken(req);
    if (token) {
      try {
        const decoded = await firebaseAdminAuth.verifyIdToken(token);
        const voteDoc = await firebaseAdminDb
          .collection('forumPosts')
          .doc(postId)
          .collection('votes')
          .doc(decoded.uid)
          .get();
        userVote = voteDoc.exists ? (voteDoc.data()?.vote ?? null) : null;
      } catch { /* not authenticated or token invalid — no vote status */ }
    }

    return NextResponse.json({ post, userVote });
  } catch (err) {
    console.error('[GET /api/forum/posts/[postId]]', err);
    return NextResponse.json({ error: 'Erro ao carregar post.' }, { status: 500 });
  }
}
