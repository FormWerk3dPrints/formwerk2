import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { firebaseAdminAuth, firebaseAdminDb } from '@/lib/firebase/adminServer';

function getBearerToken(req: Request): string | null {
  const h = req.headers.get('authorization');
  if (!h) return null;
  const [scheme, token] = h.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token.trim() : null;
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const vote =
    body && typeof body === 'object' && 'vote' in body
      ? (body as Record<string, unknown>).vote
      : undefined;

  if (vote !== 'like' && vote !== 'dislike' && vote !== null) {
    return NextResponse.json({ error: 'Valor de voto inválido.' }, { status: 400 });
  }

  const postRef = firebaseAdminDb.collection('forumPosts').doc(postId);
  const voteRef = postRef.collection('votes').doc(uid);

  let newUserVote: string | null = null;

  await firebaseAdminDb.runTransaction(async (tx) => {
    const voteDoc = await tx.get(voteRef);
    const currentVote: string | null = voteDoc.exists ? (voteDoc.data()?.vote ?? null) : null;

    let likeDelta = 0;
    let dislikeDelta = 0;

    if (vote === null || currentVote === vote) {
      // Toggle off
      if (voteDoc.exists) {
        tx.delete(voteRef);
        if (currentVote === 'like') likeDelta = -1;
        else if (currentVote === 'dislike') dislikeDelta = -1;
      }
      newUserVote = null;
    } else {
      // Change or set vote
      if (currentVote === 'like') likeDelta -= 1;
      if (currentVote === 'dislike') dislikeDelta -= 1;
      if (vote === 'like') likeDelta += 1;
      if (vote === 'dislike') dislikeDelta += 1;
      tx.set(voteRef, { vote, createdAt: FieldValue.serverTimestamp() });
      newUserVote = vote;
    }

    if (likeDelta !== 0 || dislikeDelta !== 0) {
      tx.update(postRef, {
        likeCount: FieldValue.increment(likeDelta),
        dislikeCount: FieldValue.increment(dislikeDelta),
      });
    }
  });

  // Read updated counts
  const updatedPost = await postRef.get();
  const data = updatedPost.data();
  return NextResponse.json({
    ok: true,
    userVote: newUserVote,
    likeCount: data?.likeCount ?? 0,
    dislikeCount: data?.dislikeCount ?? 0,
  });
}
