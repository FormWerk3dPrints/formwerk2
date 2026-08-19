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
import { slugify } from '@/lib/text/normalize';
import { AdminShell } from '../_components/AdminShell';
import InlinePriceCell from '../_components/InlinePriceCell';
import { logAdminAction } from '@/lib/admin/auditLog';
import {
  type Kit,
  type Product,
  deleteStorageObject,
  findAvailableDocId,
  logAndAlertError,
  uploadKitImages,
} from '../_utils/helpers';
import { useSmoothScroller } from '@/components/ScrollContext';
import { Plus, Pencil, Trash2, X, Eye, EyeOff, ChevronUp, ChevronDown } from 'lucide-react';

export default function AdminKitsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [loading, setLoading] = useState(true);

  // Form modal
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Kit | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formProductIds, setFormProductIds] = useState<string[]>([]);
  const [formPriceCents, setFormPriceCents] = useState(0);
  const [formCurrency, setFormCurrency] = useState('BRL');
  const [formColor, setFormColor] = useState('#0D6AA7');
  const [formActive, setFormActive] = useState(true);
  const [formImageFiles, setFormImageFiles] = useState<File[]>([]);
  const [formImageFilesKey, setFormImageFilesKey] = useState(0);

  // Edit-only: existing images
  const [editImageUrls, setEditImageUrls] = useState<string[]>([]);
  const [editMainImageUrl, setEditMainImageUrl] = useState('');

  // Search/filter (tabela)
  const [searchQuery, setSearchQuery] = useState('');
  // Busca de produtos dentro do formulário
  const [productSearch, setProductSearch] = useState('');

  // Validation popup
  const [validationPopup, setValidationPopup] = useState<{
    title: string;
    missingFields: string[];
  } | null>(null);

  const lenisRef = useSmoothScroller();

  async function fetchData() {
    try {
      const [prodSnap, kitsSnap] = await Promise.all([
        getDocs(query(collection(firestoreDb, 'products'), orderBy('name', 'asc'), limit(500))),
        getDocs(query(collection(firestoreDb, 'kits'), orderBy('createdAt', 'desc'), limit(200))),
      ]);

      setProducts(
        prodSnap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            slug: data.slug ?? d.id,
            name: data.name ?? '',
            pluralName: data.pluralName ?? '',
            nameNormalized: data.nameNormalized ?? '',
            nameTokens: Array.isArray(data.nameTokens) ? data.nameTokens : [],
            keywords: Array.isArray(data.keywords) ? data.keywords : [],
            description: data.description ?? '',
            categoryIds: Array.isArray(data.categoryIds) ? data.categoryIds : [],
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

      setKits(
        kitsSnap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            slug: data.slug ?? d.id,
            name: data.name ?? '',
            description: data.description ?? '',
            productIds: Array.isArray(data.productIds) ? data.productIds : [],
            priceCents: typeof data.priceCents === 'number' ? data.priceCents : 0,
            currency: data.currency ?? 'BRL',
            imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
            mainImageUrl: data.mainImageUrl,
            color: typeof data.color === 'string' ? data.color : '#0D6AA7',
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
    if (showForm || validationPopup) {
      lenis?.stop();
    } else {
      lenis?.start();
    }
    return () => { lenis?.start(); };
  }, [showForm, validationPopup, lenisRef]);

  const filteredKits = useMemo(() => {
    if (!searchQuery.trim()) return kits;
    const q = searchQuery.toLowerCase();
    return kits.filter((k) => k.name.toLowerCase().includes(q));
  }, [searchQuery, kits]);

  function getProductName(id: string): string {
    return products.find((p) => p.id === id)?.name ?? id;
  }

  function resetForm() {
    setFormName('');
    setFormDescription('');
    setFormProductIds([]);
    setFormPriceCents(0);
    setFormCurrency('BRL');
    setFormColor('#0D6AA7');
    setFormActive(true);
    setFormImageFiles([]);
    setFormImageFilesKey((k) => k + 1);
    setEditImageUrls([]);
    setEditMainImageUrl('');
    setProductSearch('');
  }

  function openCreate() {
    setEditing(null);
    resetForm();
    setShowForm(true);
  }

  function openEdit(k: Kit) {
    setEditing(k);
    setFormName(k.name);
    setFormDescription(k.description);
    setFormProductIds(k.productIds);
    setFormPriceCents(k.priceCents);
    setFormCurrency(k.currency);
    setFormColor(k.color || '#0D6AA7');
    setFormActive(k.active);
    setFormImageFiles([]);
    setFormImageFilesKey((n) => n + 1);
    setEditImageUrls(k.imageUrls);
    setEditMainImageUrl(k.mainImageUrl ?? '');
    setShowForm(true);
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
        await updateDoc(doc(firestoreDb, 'kits', editing.id), {
          imageUrls: next,
          mainImageUrl: newMain,
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        logAndAlertError('Erro ao mover imagem', e);
      }
    }
  }

  async function removeExistingImage(url: string) {
    if (!window.confirm('Remover esta imagem?')) return;

    const nextUrls = editImageUrls.filter((u) => u !== url);
    const nextMain = editMainImageUrl === url ? (nextUrls[0] ?? '') : editMainImageUrl;

    if (editing) {
      try {
        await updateDoc(doc(firestoreDb, 'kits', editing.id), {
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

  async function handleSave() {
    setValidationPopup(null);

    const name = formName.trim();

    if (editing) {
      if (!name) {
        setValidationPopup({ title: 'Não foi possível salvar o kit.', missingFields: ['Nome'] });
        return;
      }

      setSaving(true);

      let imageUrls = [...editImageUrls];
      let mainImageUrl = editMainImageUrl;

      try {
        if (formImageFiles.length) {
          const newUrls = await uploadKitImages(editing.id, formImageFiles);
          imageUrls = Array.from(new Set([...imageUrls, ...newUrls]));
          if (!mainImageUrl) mainImageUrl = imageUrls[0] ?? '';
        }

        await updateDoc(doc(firestoreDb, 'kits', editing.id), {
          name,
          description: formDescription.trim(),
          productIds: formProductIds,
          priceCents: Number.isFinite(formPriceCents) ? formPriceCents : 0,
          currency: formCurrency.trim() || 'BRL',
          color: formColor.trim() || '#0D6AA7',
          active: formActive,
          imageUrls,
          mainImageUrl,
          updatedAt: serverTimestamp(),
        });
        void logAdminAction('kit', name || editing.name, 'alteracao');

        setShowForm(false);
        resetForm();
        setEditing(null);
        await fetchData();
      } catch (e) {
        logAndAlertError('Erro ao atualizar kit', e);
      } finally {
        setSaving(false);
      }
    } else {
      const missingFields: string[] = [];
      if (!name) missingFields.push('Nome');
      if (!formProductIds.length) missingFields.push('Produtos');
      if (!formImageFiles.length) missingFields.push('Imagens (upload)');

      if (missingFields.length) {
        setValidationPopup({ title: 'Não foi possível cadastrar o kit.', missingFields });
        return;
      }

      setSaving(true);

      const baseSlug = slugify(name);
      const slug = await findAvailableDocId('kits', baseSlug);

      try {
        await setDoc(doc(firestoreDb, 'kits', slug), {
          slug,
          name,
          description: formDescription.trim(),
          productIds: formProductIds,
          priceCents: Number.isFinite(formPriceCents) ? formPriceCents : 0,
          currency: formCurrency.trim() || 'BRL',
          color: formColor.trim() || '#0D6AA7',
          imageUrls: [],
          mainImageUrl: '',
          active: formActive,
          salesCount: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const imageUrls = await uploadKitImages(slug, formImageFiles);

        await updateDoc(doc(firestoreDb, 'kits', slug), {
          imageUrls,
          mainImageUrl: imageUrls[0] ?? '',
          updatedAt: serverTimestamp(),
        });
        void logAdminAction('kit', name, 'cadastro');

        setShowForm(false);
        resetForm();
        await fetchData();
      } catch (e) {
        logAndAlertError('Erro ao criar kit', e);
        try {
          await deleteDoc(doc(firestoreDb, 'kits', slug));
        } catch {
          // ignore
        }
      } finally {
        setSaving(false);
      }
    }
  }

  /**
   * Grava só o preço, direto da tabela. Atualiza a lista em memória em vez de
   * refazer o fetch inteiro — a edição é pontual e recarregar tudo faria a
   * tabela piscar a cada alteração.
   */
  async function updateKitPrice(kitId: string, nextCents: number) {
    await updateDoc(doc(firestoreDb, 'kits', kitId), {
      priceCents: nextCents,
      updatedAt: serverTimestamp(),
    });
    const changed = kits.find((k) => k.id === kitId);
    void logAdminAction('kit', changed?.name ?? kitId, 'alteracao');
    setKits((prev) => prev.map((k) => (k.id === kitId ? { ...k, priceCents: nextCents } : k)));
  }

  async function handleDelete(kit: Kit) {
    if (!window.confirm(`Excluir o kit "${kit.name}"?`)) return;
    try {
      await deleteDoc(doc(firestoreDb, 'kits', kit.id));
      void logAdminAction('kit', kit.name, 'delecao');
      await Promise.allSettled(kit.imageUrls.map((url) => deleteStorageObject(url)));
      await fetchData();
    } catch (e) {
      logAndAlertError('Erro ao excluir kit', e);
    }
  }

  function toggleProduct(id: string) {
    setFormProductIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
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

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Kits Educacionais</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          Novo Kit
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por nome…"
          className="border rounded-lg px-3 py-2 text-sm text-gray-700 w-64"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Kit Form Modal */}
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
                {editing ? 'Editar' : 'Novo'} Kit
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-gray-900"
                />
                {formName && !editing && (
                  <p className="text-xs text-gray-400 mt-1">Slug: {slugify(formName)}</p>
                )}
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-gray-900"
                  rows={3}
                />
              </div>

              {/* Preço + Moeda + Cor + Ativo */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Moeda</label>
                  <input
                    type="text"
                    value={formCurrency}
                    onChange={(e) => setFormCurrency(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cor</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formColor}
                      onChange={(e) => setFormColor(e.target.value)}
                      className="color-picker-input h-10 w-14 shrink-0 cursor-pointer appearance-none rounded-lg border border-gray-300 bg-white p-1"
                      aria-label="Selecionar cor do kit"
                    />
                    <input
                      type="text"
                      value={formColor}
                      onChange={(e) => setFormColor(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                      placeholder="#0D6AA7"
                    />
                  </div>
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
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

              {/* Produtos */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Produtos do kit ({formProductIds.length} selecionado{formProductIds.length !== 1 ? 's' : ''})
                </label>
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Buscar produto…"
                  className="w-full border rounded-t-lg px-3 py-2 text-sm text-gray-700 border-b-0"
                />
                <div className="border rounded-b-lg p-3 max-h-48 overflow-y-auto space-y-1">
                  {products.length === 0 && (
                    <p className="text-sm text-gray-400">Nenhum produto cadastrado.</p>
                  )}
                  {(() => {
                    const q = productSearch.trim().toLowerCase();
                    const visible = q
                      ? products.filter(
                          (p) =>
                            p.name.toLowerCase().includes(q) ||
                            p.id.toLowerCase().includes(q)
                        )
                      : products;
                    if (visible.length === 0)
                      return <p className="text-sm text-gray-400">Nenhum resultado.</p>;
                    return visible.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={formProductIds.includes(p.id)}
                          onChange={() => toggleProduct(p.id)}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-800">{p.name}</span>
                        <span className="text-xs text-gray-400 ml-auto">{p.id}</span>
                      </label>
                    ));
                  })()}
                </div>
              </div>

              {/* Imagens existentes (edit) */}
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
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === editImageUrls.length - 1}
                            onClick={() => moveImage(idx, 1)}
                            className="text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:cursor-not-allowed"
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

              {/* Upload de novas imagens */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {editing ? 'Adicionar imagens' : 'Imagens (upload)'}
                </label>
                <input
                  key={formImageFilesKey}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) =>
                    setFormImageFiles(Array.from(e.target.files ?? []))
                  }
                  className="block w-full text-sm text-gray-700 border rounded-lg px-3 py-2"
                />
                {formImageFiles.length > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    {formImageFiles.length} arquivo{formImageFiles.length !== 1 ? 's' : ''} selecionado{formImageFiles.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="rounded-lg bg-black px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
              >
                {saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Criar kit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabela */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
        </div>
      ) : filteredKits.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {searchQuery ? 'Nenhum kit encontrado.' : 'Nenhum kit cadastrado ainda.'}
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Kit</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 hidden sm:table-cell">
                  Produtos
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 hidden md:table-cell">
                  Preço
                </th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredKits.map((kit) => (
                <tr key={kit.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div className="font-medium text-gray-900">{kit.name}</div>
                    <div className="text-xs text-gray-400">{kit.id}</div>
                  </td>
                  <td className="py-3 px-4 text-gray-500 text-sm hidden sm:table-cell">
                    <div className="flex flex-col gap-0.5">
                      {kit.productIds.length === 0 ? (
                        <span className="text-gray-400 italic">Nenhum</span>
                      ) : (
                        kit.productIds.map((id) => (
                          <span key={id} className="truncate max-w-[20ch]">
                            {getProductName(id)}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 hidden md:table-cell">
                    <InlinePriceCell
                      valueCents={kit.priceCents}
                      currency={kit.currency}
                      label={kit.name}
                      onSave={(nextCents) => updateKitPrice(kit.id, nextCents)}
                    />
                  </td>
                  <td className="py-3 px-4 text-center">
                    {kit.active ? (
                      <Eye className="h-4 w-4 text-green-500 mx-auto" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-gray-400 mx-auto" />
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(kit)}
                        className="p-1.5 text-gray-400 hover:text-black transition-colors"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(kit)}
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
      )}
    </AdminShell>
  );
}
