'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase/client';
import type { ForumPost, ForumComment, VoteValue } from '@/lib/forum/types';

// ── helpers ────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

function Avatar({
  name,
  avatarUrl,
  size = 'md',
}: {
  name: string;
  avatarUrl: string | null;
  size?: 'sm' | 'md';
}) {
  const dim = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-10 h-10 text-sm';
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${dim} rounded-full object-cover flex-shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${dim} rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold flex-shrink-0`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ── VoteBar ────────────────────────────────────────────────────────────────

function VoteBar({
  likeCount,
  dislikeCount,
  userVote,
  onVote,
  disabled,
}: {
  likeCount: number;
  dislikeCount: number;
  userVote: VoteValue | null;
  onVote: (v: VoteValue) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onVote('like')}
        disabled={disabled}
        className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-colors ${
          userVote === 'like'
            ? 'bg-green-100 border-green-400 text-green-700'
            : 'border-gray-200 text-gray-600 hover:border-green-300 hover:text-green-600'
        } disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        <span>👍</span>
        <span>{likeCount}</span>
      </button>
      <button
        onClick={() => onVote('dislike')}
        disabled={disabled}
        className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-colors ${
          userVote === 'dislike'
            ? 'bg-red-100 border-red-400 text-red-700'
            : 'border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600'
        } disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        <span>👎</span>
        <span>{dislikeCount}</span>
      </button>
    </div>
  );
}

// ── CommentItem ────────────────────────────────────────────────────────────

function CommentItem({
  comment,
  postId,
  authUser,
  depth,
}: {
  comment: ForumComment;
  postId: string;
  authUser: User | null;
  depth: number;
}) {
  const [likeCount, setLikeCount] = useState(comment.likeCount);
  const [dislikeCount, setDislikeCount] = useState(comment.dislikeCount);
  const [replyCount, setReplyCount] = useState(comment.replyCount);
  const [userVote, setUserVote] = useState<VoteValue | null>(null);
  const [voting, setVoting] = useState(false);

  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [replyError, setReplyError] = useState('');

  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<ForumComment[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);

  async function handleVote(v: VoteValue) {
    if (!authUser || voting) return;
    setVoting(true);
    const prevVote = userVote;
    const prevLike = likeCount;
    const prevDislike = dislikeCount;

    // Optimistic
    const newVote = userVote === v ? null : v;
    setUserVote(newVote);
    if (newVote === null) {
      if (prevVote === 'like') setLikeCount((n) => n - 1);
      else setDislikeCount((n) => n - 1);
    } else {
      if (prevVote === 'like') setLikeCount((n) => n - 1);
      if (prevVote === 'dislike') setDislikeCount((n) => n - 1);
      if (newVote === 'like') setLikeCount((n) => n + 1);
      else setDislikeCount((n) => n + 1);
    }

    try {
      const token = await authUser.getIdToken();
      const res = await fetch(
        `/api/forum/posts/${postId}/comments/${comment.id}/vote`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ vote: v }),
        }
      );
      if (res.ok) {
        const d = await res.json();
        setUserVote(d.userVote ?? null);
        setLikeCount(d.likeCount ?? likeCount);
        setDislikeCount(d.dislikeCount ?? dislikeCount);
      } else {
        setUserVote(prevVote);
        setLikeCount(prevLike);
        setDislikeCount(prevDislike);
      }
    } catch {
      setUserVote(prevVote);
      setLikeCount(prevLike);
      setDislikeCount(prevDislike);
    } finally {
      setVoting(false);
    }
  }

  async function loadReplies() {
    if (loadingReplies) return;
    setLoadingReplies(true);
    try {
      const res = await fetch(
        `/api/forum/posts/${postId}/comments?parentCommentId=${comment.id}`
      );
      const d = await res.json();
      setReplies(d.comments ?? []);
      setShowReplies(true);
    } catch { } finally {
      setLoadingReplies(false);
    }
  }

  async function handleReplySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!authUser || !replyBody.trim()) return;
    setSubmittingReply(true);
    setReplyError('');
    try {
      const token = await authUser.getIdToken();
      const res = await fetch(`/api/forum/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ body: replyBody.trim(), parentCommentId: comment.id }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'Erro ao responder.');
      }
      setReplyBody('');
      setShowReplyForm(false);
      setReplyCount((n) => n + 1);
      // Reload replies
      const snap = await fetch(
        `/api/forum/posts/${postId}/comments?parentCommentId=${comment.id}`
      );
      const snapData = await snap.json();
      setReplies(snapData.comments ?? []);
      setShowReplies(true);
    } catch (err: unknown) {
      setReplyError(err instanceof Error ? err.message : 'Erro ao responder.');
    } finally {
      setSubmittingReply(false);
    }
  }

  return (
    <div className={depth > 0 ? 'ml-8 border-l-2 border-gray-100 pl-4' : ''}>
      <div className="py-3">
        {/* Author */}
        <div className="flex items-center gap-2 mb-2">
          <Avatar
            name={comment.authorName}
            avatarUrl={comment.authorAvatarUrl}
            size="sm"
          />
          <div>
            <span className="text-sm font-medium text-gray-900">{comment.authorName}</span>
            {comment.authorInstitution && (
              <span className="text-xs text-gray-500 ml-1.5">{comment.authorInstitution}</span>
            )}
          </div>
          <span className="text-xs text-gray-400 ml-auto">{timeAgo(comment.createdAt)}</span>
        </div>

        {/* Body */}
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
          {comment.body}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-2">
          <VoteBar
            likeCount={likeCount}
            dislikeCount={dislikeCount}
            userVote={userVote}
            onVote={handleVote}
            disabled={!authUser || voting}
          />
          {authUser && depth === 0 && (
            <button
              onClick={() => setShowReplyForm((v) => !v)}
              className="text-xs text-gray-500 hover:text-blue-600 transition-colors"
            >
              Responder
            </button>
          )}
          {depth === 0 && replyCount > 0 && !showReplies && (
            <button
              onClick={loadReplies}
              className="text-xs text-blue-600 hover:underline"
            >
              {loadingReplies ? 'Carregando...' : `${replyCount} resposta${replyCount > 1 ? 's' : ''}`}
            </button>
          )}
          {depth === 0 && showReplies && replies.length > 0 && (
            <button
              onClick={() => setShowReplies(false)}
              className="text-xs text-gray-400 hover:underline"
            >
              Ocultar respostas
            </button>
          )}
        </div>

        {/* Reply form */}
        {showReplyForm && authUser && (
          <form onSubmit={handleReplySubmit} className="mt-3">
            <textarea
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder="Escreva uma resposta..."
              rows={2}
              maxLength={2000}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
            />
            {replyError && <p className="text-xs text-red-500 mt-1">{replyError}</p>}
            <div className="flex gap-2 mt-2">
              <button
                type="submit"
                disabled={submittingReply || !replyBody.trim()}
                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
              >
                {submittingReply ? 'Enviando...' : 'Responder'}
              </button>
              <button
                type="button"
                onClick={() => { setShowReplyForm(false); setReplyBody(''); }}
                className="text-xs text-gray-500 hover:underline"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Replies */}
      {showReplies && replies.map((r) => (
        <CommentItem
          key={r.id}
          comment={r}
          postId={postId}
          authUser={authUser}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function ForumPostPage() {
  const params = useParams();
  const router = useRouter();
  const postId = typeof params.postId === 'string' ? params.postId : '';

  const [authUser, setAuthUser] = useState<User | null | undefined>(undefined);
  const [post, setPost] = useState<ForumPost | null>(null);
  const [userVote, setUserVote] = useState<VoteValue | null>(null);
  const [likeCount, setLikeCount] = useState(0);
  const [dislikeCount, setDislikeCount] = useState(0);
  const [voting, setVoting] = useState(false);

  const [comments, setComments] = useState<ForumComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);

  const [commentBody, setCommentBody] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState('');

  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Auth
  useEffect(() => {
    return onAuthStateChanged(firebaseAuth, setAuthUser);
  }, []);

  // Load post
  const loadPost = useCallback(async (user: User | null) => {
    try {
      const headers: Record<string, string> = {};
      if (user) {
        const token = await user.getIdToken();
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`/api/forum/posts/${postId}`, { headers });
      if (res.status === 404) { setNotFound(true); return; }
      const d = await res.json();
      if (d.post) {
        setPost(d.post);
        setLikeCount(d.post.likeCount);
        setDislikeCount(d.post.dislikeCount);
        setUserVote(d.userVote ?? null);
      }
    } catch { }
  }, [postId]);

  // Load comments
  const loadComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/forum/posts/${postId}/comments`);
      const d = await res.json();
      setComments(d.comments ?? []);
    } catch { } finally {
      setLoadingComments(false);
    }
  }, [postId]);

  useEffect(() => {
    if (authUser === undefined) return;
    loadPost(authUser);
    loadComments();
  }, [authUser, loadPost, loadComments]);

  // Vote on post
  async function handleVote(v: VoteValue) {
    if (!authUser || voting) return;
    setVoting(true);
    const prevVote = userVote;
    const prevLike = likeCount;
    const prevDislike = dislikeCount;

    const newVote = userVote === v ? null : v;
    setUserVote(newVote);
    if (newVote === null) {
      if (prevVote === 'like') setLikeCount((n) => n - 1);
      else setDislikeCount((n) => n - 1);
    } else {
      if (prevVote === 'like') setLikeCount((n) => n - 1);
      if (prevVote === 'dislike') setDislikeCount((n) => n - 1);
      if (newVote === 'like') setLikeCount((n) => n + 1);
      else setDislikeCount((n) => n + 1);
    }

    try {
      const token = await authUser.getIdToken();
      const res = await fetch(`/api/forum/posts/${postId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ vote: v }),
      });
      if (res.ok) {
        const d = await res.json();
        setUserVote(d.userVote ?? null);
        setLikeCount(d.likeCount ?? likeCount);
        setDislikeCount(d.dislikeCount ?? dislikeCount);
      } else {
        setUserVote(prevVote);
        setLikeCount(prevLike);
        setDislikeCount(prevDislike);
      }
    } catch {
      setUserVote(prevVote);
      setLikeCount(prevLike);
      setDislikeCount(prevDislike);
    } finally {
      setVoting(false);
    }
  }

  // Submit comment
  async function handleCommentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!authUser || !commentBody.trim()) return;
    setSubmittingComment(true);
    setCommentError('');
    try {
      const token = await authUser.getIdToken();
      const res = await fetch(`/api/forum/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ body: commentBody.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'Erro ao comentar.');
      }
      setCommentBody('');
      await loadComments();
    } catch (err: unknown) {
      setCommentError(err instanceof Error ? err.message : 'Erro ao comentar.');
    } finally {
      setSubmittingComment(false);
    }
  }

  // ── Render states ──────────────────────────────────────────────────────

  if (authUser === undefined || (!post && !notFound)) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-2xl">😕</p>
        <p className="text-gray-600">Discussão não encontrada.</p>
        <Link href="/forum" className="text-blue-600 hover:underline">
          Voltar ao fórum
        </Link>
      </main>
    );
  }

  if (!post) return null;

  return (
    <main className="min-h-screen bg-gray-50 pt-24 pb-16 px-4">
      {/* Lightbox */}
      {lightboxIdx !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxIdx(null)}
        >
          <img
            src={post.imageUrls[lightboxIdx]}
            alt=""
            className="max-w-full max-h-full object-contain"
          />
          <button
            className="absolute top-4 right-4 text-white text-2xl"
            onClick={() => setLightboxIdx(null)}
          >
            ×
          </button>
        </div>
      )}

      <div className="max-w-2xl mx-auto">
        {/* Back */}
        <button
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:text-gray-700 mb-4 block"
        >
          ← Voltar
        </button>

        {/* Post card */}
        <article className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
          {/* Author */}
          <div className="flex items-start gap-3 mb-4">
            <Avatar name={post.authorName} avatarUrl={post.authorAvatarUrl} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">{post.authorName}</p>
              {post.authorInstitution && (
                <p className="text-sm text-gray-500">{post.authorInstitution}</p>
              )}
            </div>
            <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo(post.createdAt)}</span>
          </div>

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {post.tags.map((t) => (
                <span
                  key={`${t.type}-${t.refId}`}
                  className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full"
                >
                  {t.label}
                </span>
              ))}
            </div>
          )}

          {/* Title */}
          <h1 className="text-xl font-bold text-gray-900 mb-3">{post.title}</h1>

          {/* Body */}
          <p className="text-gray-700 leading-relaxed whitespace-pre-line mb-4">{post.body}</p>

          {/* Images gallery */}
          {post.imageUrls.length > 0 && (
            <div
              className={`grid gap-2 mb-4 ${
                post.imageUrls.length === 1
                  ? 'grid-cols-1'
                  : post.imageUrls.length === 2
                  ? 'grid-cols-2'
                  : 'grid-cols-3'
              }`}
            >
              {post.imageUrls.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setLightboxIdx(i)}
                  className="rounded-lg overflow-hidden"
                >
                  <img
                    src={url}
                    alt=""
                    className="w-full h-48 object-cover hover:opacity-90 transition-opacity"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Video */}
          {post.videoUrl && (
            <div className="mb-4 rounded-lg overflow-hidden">
              <video
                src={post.videoUrl}
                controls
                className="w-full max-h-72"
                preload="metadata"
              />
            </div>
          )}

          {/* Vote bar */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <VoteBar
              likeCount={likeCount}
              dislikeCount={dislikeCount}
              userVote={userVote}
              onVote={handleVote}
              disabled={!authUser || voting}
            />
            {!authUser && (
              <Link href="/conta" className="text-xs text-blue-600 hover:underline">
                Entrar para votar
              </Link>
            )}
          </div>
        </article>

        {/* Comments section */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-bold text-gray-900 mb-4">
            {comments.length} comentário{comments.length !== 1 ? 's' : ''}
          </h2>

          {/* Comment form */}
          {authUser ? (
            <form onSubmit={handleCommentSubmit} className="mb-6">
              <textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Escreva um comentário..."
                rows={3}
                maxLength={2000}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              {commentError && (
                <p className="text-xs text-red-500 mt-1">{commentError}</p>
              )}
              <button
                type="submit"
                disabled={submittingComment || !commentBody.trim()}
                className="mt-2 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submittingComment ? 'Enviando...' : 'Comentar'}
              </button>
            </form>
          ) : (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg text-sm text-gray-600">
              <Link href="/conta" className="text-blue-600 font-medium hover:underline">
                Entre na sua conta
              </Link>{' '}
              para comentar.
            </div>
          )}

          {/* Comments list */}
          {loadingComments ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">
              Seja o primeiro a comentar!
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {comments.map((c) => (
                <CommentItem
                  key={c.id}
                  comment={c}
                  postId={postId}
                  authUser={authUser ?? null}
                  depth={0}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
