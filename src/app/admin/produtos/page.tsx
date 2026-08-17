'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { firestoreDb } from '@/lib/firebase/client';
import {
  normalizeText,
  slugify,
  splitKeywords,
  tokenize,
} from '@/lib/text/normalize';
import { AdminShell } from '../_components/AdminShell';
import {
  type Category,
  type Product,
  deleteStorageObject,
  findAvailableDocId,
  logAndAlertError,
  uploadProductImages,
  uploadProductVideo,
} from '../_utils/helpers';
import { AdminProductCommentsEditor } from '../AdminProductCommentsEditor';
import { useSmoothScroller } from '@/components/ScrollContext';
import { Plus, Pencil, Trash2, X, Eye, EyeOff, MessageSquare, ChevronUp, ChevronDown } from 'lucide-react';

export default function AdminProdutosPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Form modal
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formPluralName, setFormPluralName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategoryIds, setFormCategoryIds] = useState<string[]>([]);
  const [formPriceCents, setFormPriceCents] = useState(0);
  const [formCurrency, setFormCurrency] = useState('BRL');
  const [formActive, setFormActive] = useState(true);
  const [formKeywordsManual, setFormKeywordsManual] = useState('');
  const [formImageFiles, setFormImageFiles] = useState<File[]>([]);
  const [formImageFilesKey, setFormImageFilesKey] = useState(0);
  const [formVideoFile, setFormVideoFile] = useState<File | null>(null);
  const [formVideoFileKey, setFormVideoFileKey] = useState(0);

  // Edit-only: existing media
  const [editImageUrls, setEditImageUrls] = useState<string[]>([]);
  const [editMainImageUrl, setEditMainImageUrl] = useState('');
  const [editVideoUrl, setEditVideoUrl] = useState('');
  const [editKeywords, setEditKeywords] = useState<string[]>([]);

  // Comments modal
  const [commentsProductId, setCommentsProductId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');

  // Validation popup
  const [validationPopup, setValidationPopup] = useState<{
    title: string;
    missingFields: string[];
  } | null>(null);
  const lenisRef = useSmoothScroller();

  async function fetchData() {
    try {
      const [catSnap, prodSnap] = await Promise.all([
        getDocs(query(collection(firestoreDb, 'categories'), orderBy('order', 'asc'), limit(200))),
        getDocs(query(collection(firestoreDb, 'products'), orderBy('createdAt', 'desc'), limit(200))),
      ]);

      setCategories(
        catSnap.docs.map((d) => {
          const data = d.data() as Omit<Category, 'id'>;
          return {
            id: d.id,
            name: data.name ?? '',
            description: data.description ?? '',
            color: data.color ?? '',
            order: typeof data.order === 'number' ? data.order : 0,
            active: data.active ?? false,
          };
        })
      );

      setProducts(
        prodSnap.docs.map((d) => {
          const data = d.data() as Omit<Product, 'id'>;
          return {
            id: d.id,
            slug: data.slug ?? d.id,
            name: data.name ?? '',
            pluralName: typeof data.pluralName === 'string' ? data.pluralName.trim() : '',
            nameNormalized: data.nameNormalized ?? '',
            nameTokens: Array.isArray(data.nameTokens) ? data.nameTokens : [],
            keywords: Array.isArray(data.keywords) ? data.keywords : [],
            description: data.description ?? '',
            categoryIds: Array.isArray(data.categoryIds) ? data.categoryIds : ((data as any).categoryId ? [(data as any).categoryId] : []),
            priceCents: typeof data.priceCents === 'number' ? data.priceCents : 0,
            currency: data.currency ?? 'BRL',
            imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
            mainImageUrl: data.mainImageUrl,
            videoUrl: typeof data.videoUrl === 'string' ? data.videoUrl : undefined,
            salesCount: typeof data.salesCount === 'number' ? data.salesCount : 0,
            active: data.active ?? false,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          };
        })
      );
    } catch (e) {
      logAndAlertError('Erro ao carregar dados', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const lenis = lenisRef?.current;
    if (showForm || commentsProductId || validationPopup) {
      lenis?.stop();
    } else {
      lenis?.start();
    }
    return () => { lenis?.start(); };
  }, [showForm, commentsProductId, validationPopup, lenisRef]);

  const filteredProducts = useMemo(() => {
    let list = products;

    if (filterCategoryId) {
      list = list.filter((p) => p.categoryIds.includes(filterCategoryId));
    }

    if (!searchQuery.trim()) return list;

    const queryNormalized = normalizeText(searchQuery);
    const queryTokens = Array.from(
      new Set([...tokenize(searchQuery), ...splitKeywords(searchQuery)])
    );

    const scored = list
      .map((p) => {
        const normalizedName = normalizeText(p.name);
        const nameIncludes = normalizedName.includes(queryNormalized) ? 3 : 0;
        const nameTokens = Array.isArray(p.nameTokens) ? p.nameTokens : [];
        const keywords = Array.isArray(p.keywords) ? p.keywords : [];
        const tokenNameHits = queryTokens.reduce(
          (acc, t) => acc + (nameTokens.includes(t) ? 1 : 0),
          0
        );
        const tokenKeywordHits = queryTokens.reduce(
          (acc, t) => acc + (keywords.some((k) => k.includes(t)) ? 1 : 0),
          0
        );
        const scoreName = nameIncludes + tokenNameHits * 2;
        const scoreKeywords = tokenKeywordHits;
        return { product: p, scoreName, scoreKeywords };
      })
      .filter((x) => x.scoreName > 0 || x.scoreKeywords > 0);

    scored.sort((a, b) => {
      const aHasName = a.scoreName > 0;
      const bHasName = b.scoreName > 0;
      if (aHasName !== bHasName) return aHasName ? -1 : 1;
      if (a.scoreName !== b.scoreName) return b.scoreName - a.scoreName;
      if (a.scoreKeywords !== b.scoreKeywords) return b.scoreKeywords - a.scoreKeywords;
      return a.product.name.localeCompare(b.product.name, 'pt-BR');
    });

    return scored.map((x) => x.product);
  }, [searchQuery, filterCategoryId, products]);

  function getCategoryName(id: string): string {
    return categories.find((c) => c.id === id)?.name || id;
  }

  function resetForm() {
    setFormName('');
    setFormPluralName('');
    setFormDescription('');
    setFormCategoryIds([]);
    setFormPriceCents(0);
    setFormCurrency('BRL');
    setFormActive(true);
    setFormKeywordsManual('');
    setFormImageFiles([]);
    setFormImageFilesKey((k) => k + 1);
    setFormVideoFile(null);
    setFormVideoFileKey((k) => k + 1);
    setEditImageUrls([]);
    setEditMainImageUrl('');
    setEditVideoUrl('');
    setEditKeywords([]);
  }

  function openCreate() {
    setEditing(null);
    resetForm();
    setShowForm(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setFormName(p.name);
    setFormPluralName(p.pluralName);
    setFormDescription(p.description);
    setFormCategoryIds(p.categoryIds);
    setFormPriceCents(p.priceCents);
    setFormCurrency(p.currency);
    setFormActive(p.active);
    setFormKeywordsManual('');
    setFormImageFiles([]);
    setFormImageFilesKey((k) => k + 1);
    setFormVideoFile(null);
    setFormVideoFileKey((k) => k + 1);
    setEditImageUrls(p.imageUrls);
    setEditMainImageUrl(p.mainImageUrl ?? '');
    setEditVideoUrl(p.videoUrl ?? '');
    setEditKeywords(p.keywords);
    setShowForm(true);
  }

  async function handleSave() {
    setValidationPopup(null);

    const name = formName.trim();
    const pluralName = formPluralName.trim();
    const categoryIds = formCategoryIds;

    if (editing) {
      // Edit mode
      if (!name || !pluralName) {
        setValidationPopup({
          title: 'Não foi possível salvar o produto.',
          missingFields: [
            ...(!name ? ['Nome'] : []),
            ...(!pluralName ? ['Nome (plural)'] : []),
          ],
        });
        return;
      }

      setSaving(true);

      const nameNormalized = normalizeText(name);
      const nameTokens = tokenize(name);
      const manualKeywords = editKeywords.length
        ? editKeywords
        : splitKeywords(formKeywordsManual);
      const keywords = manualKeywords.filter((k) => !nameTokens.includes(k));

      let imageUrls = [...editImageUrls];
      let mainImageUrl = editMainImageUrl;
      let videoUrl = editVideoUrl;

      try {
        if (formImageFiles.length) {
          const newUrls = await uploadProductImages(editing.id, formImageFiles);
          imageUrls = Array.from(new Set([...imageUrls, ...newUrls]));
          if (!mainImageUrl) mainImageUrl = imageUrls[0] ?? '';
        }

        if (formVideoFile) {
          videoUrl = await uploadProductVideo(editing.id, formVideoFile);
        }

        const updatePayload: Record<string, unknown> = {
          name,
          pluralName,
          nameNormalized,
          nameTokens,
          keywords,
          description: formDescription.trim(),
          categoryIds,
          priceCents: Number.isFinite(formPriceCents) ? formPriceCents : 0,
          currency: formCurrency.trim() || 'BRL',
          active: formActive,
          imageUrls,
          mainImageUrl,
          videoUrl,
          updatedAt: serverTimestamp(),
        };

        const sanitizedPayload = Object.fromEntries(
          Object.entries(updatePayload).filter(([, value]) => value !== undefined)
        );

        await updateDoc(doc(firestoreDb, 'products', editing.id), sanitizedPayload);

        setShowForm(false);
        resetForm();
        setEditing(null);
        await fetchData();
      } catch (e) {
        logAndAlertError('Erro ao atualizar produto', e);
      } finally {
        setSaving(false);
      }
    } else {
      // Create mode
      const missingFields: string[] = [];
      if (!name) missingFields.push('Nome');
      if (!pluralName) missingFields.push('Nome (plural)');
      if (!categoryIds.length) missingFields.push('Categoria');
      if (!formImageFiles.length) missingFields.push('Imagens (upload)');

      if (missingFields.length) {
        setValidationPopup({
          title: 'Não foi possível cadastrar o produto.',
          missingFields,
        });
        return;
      }

      setSaving(true);

      const baseSlug = slugify(name);
      const slug = await findAvailableDocId('products', baseSlug);
      const nameNormalized = normalizeText(name);
      const nameTokens = tokenize(name);
      const manualKeywords = splitKeywords(formKeywordsManual);
      const keywords = manualKeywords.filter((k) => !nameTokens.includes(k));

      try {
        await setDoc(doc(firestoreDb, 'products', slug), {
          slug,
          name,
          pluralName,
          nameNormalized,
          nameTokens,
          keywords,
          description: formDescription.trim(),
          categoryIds,
          priceCents: Number.isFinite(formPriceCents) ? formPriceCents : 0,
          currency: formCurrency.trim() || 'BRL',
          imageUrls: [],
          mainImageUrl: '',
          videoUrl: '',
          salesCount: 0,
          active: formActive,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const imageUrls = await uploadProductImages(slug, formImageFiles);
        let videoUrl = '';
        if (formVideoFile) {
          videoUrl = await uploadProductVideo(slug, formVideoFile);
        }

        await updateDoc(doc(firestoreDb, 'products', slug), {
          imageUrls,
          mainImageUrl: imageUrls[0] ?? '',
          videoUrl,
          updatedAt: serverTimestamp(),
        });

        setShowForm(false);
        resetForm();
        await fetchData();
      } catch (e) {
        logAndAlertError('Erro ao criar produto', e);
        try {
          await deleteDoc(doc(firestoreDb, 'products', slug));
        } catch {
          // ignore
        }
      } finally {
        setSaving(false);
      }
    }
  }

  async function moveImage(idx: number, direction: -1 | 1) {
    const next = [...editImageUrls];
    const target = idx + direction;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    const newMain = next[0] ?? '';
    setEditImageUrls(next);
    setEditMainImageUrl(newMain);

    if (editing) {
      try {
        await updateDoc(doc(firestoreDb, 'products', editing.id), {
          imageUrls: next,
          mainImageUrl: newMain,
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        logAndAlertError('Erro ao mover imagem', e);
      }
    }
  }

  async function reverseImageOrder() {
    const reversed = [...editImageUrls].reverse();
    const newMain = reversed[0] ?? '';
    setEditImageUrls(reversed);
    setEditMainImageUrl(newMain);

    if (editing) {
      try {
        await updateDoc(doc(firestoreDb, 'products', editing.id), {
          imageUrls: reversed,
          mainImageUrl: newMain,
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        logAndAlertError('Erro ao inverter ordem das imagens', e);
      }
    }
  }

  async function removeExistingImage(url: string) {
    if (!window.confirm('Remover esta imagem?')) return;

    const nextUrls = editImageUrls.filter((u) => u !== url);
    const nextMain = editMainImageUrl === url ? (nextUrls[0] ?? '') : editMainImageUrl;

    if (editing) {
      try {
        await updateDoc(doc(firestoreDb, 'products', editing.id), {
          imageUrls: nextUrls,
          mainImageUrl: nextMain,
          updatedAt: serverTimestamp(),
        });
        await deleteStorageObject(url);
      } catch (e) {
        logAndAlertError('Erro ao remover imagem', e);
      }
    }

    setEditImageUrls(nextUrls);
    setEditMainImageUrl(nextMain);
  }

  async function removeExistingVideo() {
    if (!window.confirm('Remover o vídeo deste produto?')) return;
    if (!editVideoUrl || !editing) return;

    try {
      await updateDoc(doc(firestoreDb, 'products', editing.id), {
        videoUrl: '',
        updatedAt: serverTimestamp(),
      });
      await deleteStorageObject(editVideoUrl);
    } catch (e) {
      logAndAlertError('Erro ao remover vídeo', e);
    }

    setEditVideoUrl('');
  }

  async function handleDelete(prod: Product) {
    if (!window.confirm(`Excluir o produto "${prod.name}"?`)) return;

    try {
      await deleteDoc(doc(firestoreDb, 'products', prod.id));
      await fetchData();
    } catch (e) {
      logAndAlertError('Erro ao excluir produto', e);
    }
  }

  return (
    <AdminShell>
      {/* Validation popup */}
      {validationPopup && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          data-lenis-prevent
          onClick={() => setValidationPopup(null)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 border shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-lg font-bold text-gray-900">{validationPopup.title}</div>
            <div className="mt-2 text-sm text-gray-500">Campos faltando:</div>
            <ul className="mt-2 list-disc pl-5 text-sm text-gray-700">
              {validationPopup.missingFields.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="rounded-lg bg-black px-4 py-2 text-white hover:opacity-90"
                onClick={() => setValidationPopup(null)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comments modal */}
      {commentsProductId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          data-lenis-prevent
          onClick={() => setCommentsProductId(null)}
        >
          <div
            className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            data-lenis-prevent
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                Comentários
              </h2>
              <button
                onClick={() => setCommentsProductId(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <AdminProductCommentsEditor productId={commentsProductId} />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Produtos</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          Novo Produto
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por nome ou keywords…"
          className="border rounded-lg px-3 py-2 text-sm text-gray-700 w-64"
        />
        <select
          value={filterCategoryId}
          onChange={(e) => setFilterCategoryId(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm text-gray-700"
        >
          <option value="">Todas as categorias</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        {(filterCategoryId || searchQuery) && (
          <button
            onClick={() => {
              setFilterCategoryId('');
              setSearchQuery('');
            }}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Product Form Modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          data-lenis-prevent
        >
          {/* Sem onClick no fundo: clicar fora não fecha, pra não perder
              o que foi preenchido por acidente. Fecha só no X ou em Cancelar. */}
          <div
            className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            data-lenis-prevent
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editing ? 'Editar' : 'Novo'} Produto
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-gray-900"
                  />
                  {formName && (
                    <p className="text-xs text-gray-400 mt-1">
                      Slug: {slugify(formName)}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome (plural)
                  </label>
                  <input
                    type="text"
                    value={formPluralName}
                    onChange={(e) => setFormPluralName(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-gray-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoria
                  </label>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 border rounded-lg px-3 py-2">
                    {categories
                      .slice()
                      .sort((a, b) => a.order - b.order)
                      .map((c) => (
                        <label key={c.id} className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formCategoryIds.includes(c.id)}
                            onChange={() =>
                              setFormCategoryIds((prev) =>
                                prev.includes(c.id)
                                  ? prev.filter((id) => id !== c.id)
                                  : [...prev, c.id]
                              )
                            }
                            className="rounded"
                          />
                          <span className="text-sm text-gray-700">{c.name}</span>
                        </label>
                      ))}
                  </div>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-2">
                    <input
                      type="checkbox"
                      checked={formActive}
                      onChange={(e) => setFormActive(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700">Ativo</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-gray-900"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Preço (centavos)
                  </label>
                  <input
                    type="number"
                    value={formPriceCents}
                    onChange={(e) => setFormPriceCents(Number(e.target.value))}
                    className="w-full border rounded-lg px-3 py-2 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Moeda
                  </label>
                  <input
                    type="text"
                    value={formCurrency}
                    onChange={(e) => setFormCurrency(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-gray-900"
                  />
                </div>
              </div>

              {/* Keywords */}
              {editing ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Palavras-chave
                  </label>
                  <input
                    type="text"
                    value={editKeywords.join(', ')}
                    onChange={(e) => setEditKeywords(splitKeywords(e.target.value))}
                    className="w-full border rounded-lg px-3 py-2 text-gray-900 text-sm"
                    placeholder="separadas por vírgula"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Palavras-chave (separadas por vírgula)
                  </label>
                  <input
                    type="text"
                    value={formKeywordsManual}
                    onChange={(e) => setFormKeywordsManual(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-gray-900 text-sm"
                    placeholder="ex.: geometria, poliedros, educacional"
                  />
                </div>
              )}

              {/* Existing images (edit mode) */}
              {editing && editImageUrls.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Imagens cadastradas ({editImageUrls.length})
                  </label>
                  <div className="grid gap-2 max-h-48 overflow-y-auto">
                    {editImageUrls.map((url, idx) => (
                      <div
                        key={url}
                        className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                      >
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveImage(idx, -1)}
                            className="text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:cursor-not-allowed"
                            title="Mover para cima"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === editImageUrls.length - 1}
                            onClick={() => moveImage(idx, 1)}
                            className="text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:cursor-not-allowed"
                            title="Mover para baixo"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                          <span className="text-xs text-gray-400 w-4">{idx + 1}</span>
                        </div>
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" className="h-8 w-8 object-cover rounded shrink-0" />
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="max-w-[30ch] truncate text-xs underline text-gray-500"
                          >
                            {url}
                          </a>
                        </div>
                        <button
                          type="button"
                          className="text-red-500 hover:text-red-700 text-xs shrink-0"
                          onClick={() => removeExistingImage(url)}
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload images */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {editing ? 'Adicionar imagens' : 'Imagens (upload)'}
                </label>
                <input
                  key={formImageFilesKey}
                  type="file"
                  accept="image/*"
                  multiple
                  className="w-full border rounded-lg px-3 py-2 text-sm text-gray-700"
                  onChange={(e) => {
                    const selected = Array.from(e.target.files ?? []).filter(Boolean);
                    setFormImageFiles((prev) => [...prev, ...selected]);
                  }}
                />
                {formImageFiles.length > 0 && (
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    <span>{formImageFiles.length} arquivo(s) selecionado(s)</span>
                    <button
                      type="button"
                      className="text-red-500 underline hover:text-red-700"
                      onClick={() => {
                        setFormImageFiles([]);
                        setFormImageFilesKey((k) => k + 1);
                      }}
                    >
                      limpar
                    </button>
                  </div>
                )}
              </div>

              {/* Existing video (edit mode) */}
              {editing && editVideoUrl && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-green-700">Vídeo atual cadastrado</span>
                  <button
                    type="button"
                    className="text-red-500 underline hover:text-red-700"
                    onClick={removeExistingVideo}
                  >
                    remover vídeo
                  </button>
                </div>
              )}

              {/* Upload video */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vídeo (opcional)
                </label>
                <input
                  key={formVideoFileKey}
                  type="file"
                  accept="video/*"
                  className="w-full border rounded-lg px-3 py-2 text-sm text-gray-700"
                  onChange={(e) => setFormVideoFile(e.target.files?.[0] ?? null)}
                />
                {formVideoFile && (
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    <span>{formVideoFile.name}</span>
                    <button
                      type="button"
                      className="text-red-500 underline hover:text-red-700"
                      onClick={() => {
                        setFormVideoFile(null);
                        setFormVideoFileKey((k) => k + 1);
                      }}
                    >
                      cancelar
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-black text-white py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {saving ? 'Salvando…' : editing ? 'Atualizar' : 'Criar'}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-6 py-2 border rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Products Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-white rounded-lg h-16 border" />
          ))}
        </div>
      ) : filteredProducts.length > 0 ? (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                    Produto
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 hidden sm:table-cell">
                    Categoria
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 hidden md:table-cell">
                    Imagens
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">
                    Status
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredProducts.map((prod) => (
                  <tr key={prod.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900">{prod.name}</div>
                      <div className="text-xs text-gray-400">{prod.id}</div>
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-sm hidden sm:table-cell">
                      {prod.categoryIds.map((id) => getCategoryName(id)).join(', ')}
                    </td>
                    <td className="py-3 px-4 text-gray-600 text-sm hidden md:table-cell">
                      {prod.imageUrls.length}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {prod.active ? (
                        <Eye className="h-4 w-4 text-green-500 mx-auto" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-gray-400 mx-auto" />
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setCommentsProductId(prod.id)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Comentários"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEdit(prod)}
                          className="p-1.5 text-gray-400 hover:text-black transition-colors"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(prod)}
                          className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          {filterCategoryId || searchQuery
            ? 'Nenhum produto encontrado.'
            : 'Nenhum produto cadastrado.'}
        </div>
      )}
    </AdminShell>
  );
}
