'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase/client';
import type { ForumPost, FilterSort } from '@/lib/forum/types';

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

type RefItem = { id: string; name: string; color?: string };

// ── PostCard ────────────────────────────────────────────────────────────────

function PostCard({ post }: { post: ForumPost }) {
  return (
    <Link
      href={`/forum/${post.id}`}
      className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
    >
      {/* Author row */}
      <div className="flex items-center gap-2.5 mb-3">
        {post.authorAvatarUrl ? (
          <img
            src={post.authorAvatarUrl}
            alt={post.authorName}
            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
            {post.authorName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <span className="text-sm font-medium text-gray-900 truncate block">{post.authorName}</span>
          {post.authorInstitution && (
            <span className="text-xs text-gray-500 truncate block">{post.authorInstitution}</span>
          )}
        </div>
        <span className="text-xs text-gray-400 ml-auto flex-shrink-0">{timeAgo(post.createdAt)}</span>
      </div>

      {/* Title & body preview */}
      <h3 className="font-semibold text-gray-900 leading-snug mb-1">{post.title}</h3>
      <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">{post.body}</p>

      {/* Tags */}
      {post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {post.tags.map((tag) => (
            <span
              key={`${tag.type}-${tag.refId}`}
              className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100"
            >
              {tag.label}
            </span>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span>👍</span>
          <span>{post.likeCount}</span>
        </span>
        <span className="flex items-center gap-1">
          <span>👎</span>
          <span>{post.dislikeCount}</span>
        </span>
        <span className="flex items-center gap-1">
          <span>💬</span>
          <span>{post.commentCount}</span>
        </span>
      </div>
    </Link>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

const SORTS: { key: FilterSort; label: string }[] = [
  { key: 'padrao', label: 'Padrão' },
  { key: 'novos', label: 'Novos' },
  { key: 'em-alta', label: 'Em Alta 🔥' },
  { key: 'all-time', label: 'All-Time' },
];

const TAG_TYPES = [
  { key: 'all', label: 'Todos' },
  { key: 'geral', label: 'Geral' },
  { key: 'product', label: 'Produtos' },
  { key: 'category', label: 'Categorias' },
  { key: 'kit', label: 'Kits' },
];

export default function ForumPage() {
  const [authUser, setAuthUser] = useState<User | null | undefined>(undefined);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<FilterSort>('padrao');
  const [tagType, setTagType] = useState<string>('all');
  const [tagRef, setTagRef] = useState<string>('');

  const [categories, setCategories] = useState<RefItem[]>([]);
  const [products, setProducts] = useState<RefItem[]>([]);
  const [kits, setKits] = useState<RefItem[]>([]);

  // Auth
  useEffect(() => {
    return onAuthStateChanged(firebaseAuth, (u) => setAuthUser(u));
  }, []);

  // Load reference data once
  useEffect(() => {
    fetch('/api/forum/tags')
      .then((r) => r.json())
      .then((d) => {
        setCategories(d.categories ?? []);
        setProducts(d.products ?? []);
        setKits(d.kits ?? []);
      })
      .catch(() => {});
  }, []);

  // Load posts when filters change
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ sort });

    let tag = tagType;
    if (tagType !== 'all' && tagType !== 'geral' && tagRef) {
      tag = `${tagType}:${tagRef}`;
    }
    if (tag !== 'all') params.set('tag', tag);

    fetch(`/api/forum/posts?${params}`)
      .then((r) => r.json())
      .then((d) => setPosts(d.posts ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sort, tagType, tagRef]);

  const refItems: RefItem[] =
    tagType === 'product' ? products : tagType === 'category' ? categories : kits;

  return (
    <main className="min-h-screen bg-gray-50 pt-24 pb-16 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Fórum</h1>
            <p className="text-gray-500 text-sm mt-0.5">Discussões da comunidade FormWerk</p>
          </div>
          {authUser && (
            <Link
              href="/forum/novo"
              className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              + Nova discussão
            </Link>
          )}
          {authUser === null && (
            <Link
              href="/conta"
              className="text-sm text-blue-600 hover:underline"
            >
              Entrar para participar
            </Link>
          )}
        </div>

        {/* Sort tabs */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 mb-3 flex gap-1 overflow-x-auto">
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`flex-shrink-0 text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
                sort === s.key
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Tag type tabs */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 mb-4 flex gap-1 overflow-x-auto">
          {TAG_TYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTagType(t.key); setTagRef(''); }}
              className={`flex-shrink-0 text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
                tagType === t.key
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Sub-filter for product / category / kit */}
        {['product', 'category', 'kit'].includes(tagType) && refItems.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 px-3 py-2 mb-4">
            <select
              value={tagRef}
              onChange={(e) => setTagRef(e.target.value)}
              className="w-full text-sm text-gray-700 bg-transparent outline-none"
            >
              <option value="">
                Todos os {tagType === 'product' ? 'produtos' : tagType === 'category' ? 'categorias' : 'kits'}
              </option>
              {refItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Posts */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-4xl mb-3">💬</p>
            <p className="font-medium">Nenhuma discussão encontrada.</p>
            {authUser && (
              <Link href="/forum/novo" className="text-blue-600 hover:underline text-sm mt-2 block">
                Seja o primeiro a postar!
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
