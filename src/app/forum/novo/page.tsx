'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firebaseAuth, firebaseStorage } from '@/lib/firebase/client';
import type { ForumTag } from '@/lib/forum/types';

type RefItem = { id: string; name: string };

// ── helpers ────────────────────────────────────────────────────────────────

async function uploadFile(file: File, uid: string): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'bin';
  const path = `forum/uploads/${uid}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const sRef = storageRef(firebaseStorage, path);
  await uploadBytes(sRef, file);
  return getDownloadURL(sRef);
}

// ── Component ──────────────────────────────────────────────────────────────

export default function NovoPostPage() {
  const router = useRouter();

  const [authUser, setAuthUser] = useState<User | null | undefined>(undefined);
  const [categories, setCategories] = useState<RefItem[]>([]);
  const [products, setProducts] = useState<RefItem[]>([]);
  const [kits, setKits] = useState<RefItem[]>([]);
  const [productSearch, setProductSearch] = useState('');

  // Form state
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState<ForumTag[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Auth guard
  useEffect(() => {
    return onAuthStateChanged(firebaseAuth, (u) => {
      setAuthUser(u);
      if (u === null) router.replace('/conta');
    });
  }, [router]);

  // Load reference data
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

  // ── Tag helpers ──────────────────────────────────────────────────────────

  function toggleGeral() {
    const exists = tags.some((t) => t.type === 'geral');
    if (exists) {
      setTags(tags.filter((t) => t.type !== 'geral'));
    } else {
      setTags([...tags, { type: 'geral', refId: 'geral', label: 'Geral' }]);
    }
  }

  function toggleRef(type: 'product' | 'category' | 'kit', id: string, name: string) {
    const exists = tags.some((t) => t.type === type && t.refId === id);
    if (exists) {
      setTags(tags.filter((t) => !(t.type === type && t.refId === id)));
    } else {
      setTags([...tags, { type, refId: id, label: name }]);
    }
  }

  function isTagSelected(type: string, refId: string) {
    return tags.some((t) => t.type === type && t.refId === refId);
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!authUser) return;
    if (!title.trim()) { setError('Título é obrigatório.'); return; }
    if (!body.trim()) { setError('Conteúdo é obrigatório.'); return; }
    if (tags.length === 0) { setError('Selecione pelo menos uma tag.'); return; }

    setSubmitting(true);
    setError('');

    try {
      // Upload images
      const imageUrls = await Promise.all(imageFiles.map((f) => uploadFile(f, authUser.uid)));

      // Upload video
      let videoUrl: string | null = null;
      if (videoFile) {
        videoUrl = await uploadFile(videoFile, authUser.uid);
      }

      const token = await authUser.getIdToken();
      const res = await fetch('/api/forum/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), tags, imageUrls, videoUrl }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'Erro ao criar post.');
      }

      const { id } = await res.json();
      router.push(`/forum/${id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar post.');
      setSubmitting(false);
    }
  }

  // ── Image handling ───────────────────────────────────────────────────────

  function handleImagesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setImageFiles((prev) => [...prev, ...files].slice(0, 5));
    e.target.value = '';
  }

  function removeImage(index: number) {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
  }

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  if (authUser === undefined) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 pt-24 pb-16 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            ← Voltar
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Nova Discussão</h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Title */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Título <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Do que se trata esta discussão?"
              maxLength={200}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Body */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Descrição <span className="text-red-500">*</span>
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Detalhe sua dúvida, ideia ou observação..."
              rows={6}
              maxLength={5000}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              required
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{body.length}/5000</p>
          </div>

          {/* Tags */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">
              Tags <span className="text-red-500">*</span>
              <span className="font-normal text-gray-400 ml-1">(selecione pelo menos uma)</span>
            </p>

            {/* Geral */}
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isTagSelected('geral', 'geral')}
                  onChange={toggleGeral}
                  className="w-4 h-4 accent-blue-600"
                />
                <span className="text-sm text-gray-700">Geral</span>
              </label>
            </div>

            {/* Categorias */}
            {categories.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Categorias
                </p>
                <div className="flex flex-wrap gap-2">
                  {categories.map((c) => (
                    <label key={c.id} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isTagSelected('category', c.id)}
                        onChange={() => toggleRef('category', c.id, c.name)}
                        className="w-3.5 h-3.5 accent-blue-600"
                      />
                      <span className="text-sm text-gray-700">{c.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Kits */}
            {kits.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Kits
                </p>
                <div className="flex flex-wrap gap-2">
                  {kits.map((k) => (
                    <label key={k.id} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isTagSelected('kit', k.id)}
                        onChange={() => toggleRef('kit', k.id, k.name)}
                        className="w-3.5 h-3.5 accent-blue-600"
                      />
                      <span className="text-sm text-gray-700">{k.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Produtos (searchable) */}
            {products.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Produtos
                </p>
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Buscar produto..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mb-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <div className="max-h-36 overflow-y-auto flex flex-col gap-1">
                  {filteredProducts.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                      <input
                        type="checkbox"
                        checked={isTagSelected('product', p.id)}
                        onChange={() => toggleRef('product', p.id, p.name)}
                        className="w-3.5 h-3.5 accent-blue-600"
                      />
                      <span className="text-sm text-gray-700">{p.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Selected tags preview */}
            {tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span
                    key={`${t.type}-${t.refId}`}
                    className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full"
                  >
                    {t.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Images */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">
              Imagens <span className="text-gray-400 font-normal">(até 5)</span>
            </p>
            {imageFiles.length < 5 && (
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="text-sm border border-dashed border-gray-300 rounded-lg px-4 py-2.5 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
              >
                + Adicionar imagem
              </button>
            )}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImagesChange}
            />
            {imageFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {imageFiles.map((f, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={URL.createObjectURL(f)}
                      alt={f.name}
                      className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Video */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">Vídeo (opcional)</p>
            {!videoFile ? (
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                className="text-sm border border-dashed border-gray-300 rounded-lg px-4 py-2.5 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
              >
                + Adicionar vídeo
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-700 truncate max-w-xs">{videoFile.name}</span>
                <button
                  type="button"
                  onClick={() => setVideoFile(null)}
                  className="text-xs text-red-500 hover:underline"
                >
                  Remover
                </button>
              </div>
            )}
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setVideoFile(f);
                e.target.value = '';
              }}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Publicando...' : 'Publicar discussão'}
          </button>
        </form>
      </div>
    </main>
  );
}
