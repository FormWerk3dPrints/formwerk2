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
import {
  type WallPanel,
  deleteStorageObject,
  findAvailableDocId,
  logAndAlertError,
  uploadWallPanelImages,
} from '../_utils/helpers';
import { useSmoothScroller } from '@/components/ScrollContext';
import { AdminModal } from '../_components/AdminModal';
import { AdminIconButton, StatusPill } from '../_components/AdminControls';
import { ImageOrderList } from '../_components/ImageOrderList';
import { Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';

export default function AdminWallPanelsPage() {
  const [wallPanels, setWallPanels] = useState<WallPanel[]>([]);
  const [loading, setLoading] = useState(true);

  // Form modal
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<WallPanel | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formPriceCents, setFormPriceCents] = useState(0);
  const [formCurrency, setFormCurrency] = useState('BRL');
  const [formWidthMm, setFormWidthMm] = useState(0);
  const [formHeightMm, setFormHeightMm] = useState(0);
  const [formActive, setFormActive] = useState(true);
  const [formImageFiles, setFormImageFiles] = useState<File[]>([]);
  const [formImageFilesKey, setFormImageFilesKey] = useState(0);

  // Edit-only: existing images
  const [editImageUrls, setEditImageUrls] = useState<string[]>([]);
  const [editMainImageUrl, setEditMainImageUrl] = useState('');

  // Search/filter (tabela)
  const [searchQuery, setSearchQuery] = useState('');

  // Validation popup
  const [validationPopup, setValidationPopup] = useState<{
    title: string;
    missingFields: string[];
  } | null>(null);

  const lenisRef = useSmoothScroller();

  async function fetchData() {
    try {
      const snap = await getDocs(
        query(collection(firestoreDb, 'wall-panels'), orderBy('createdAt', 'desc'), limit(200))
      );

      setWallPanels(
        snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            slug: data.slug ?? d.id,
            name: data.name ?? '',
            priceCents: typeof data.priceCents === 'number' ? data.priceCents : 0,
            currency: data.currency ?? 'BRL',
            widthMm: typeof data.widthMm === 'number' ? data.widthMm : 0,
            heightMm: typeof data.heightMm === 'number' ? data.heightMm : 0,
            imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
            mainImageUrl: data.mainImageUrl,
            imageAlts: data.imageAlts && typeof data.imageAlts === 'object' ? data.imageAlts : {},
            active: data.active ?? false,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          };
        })
      );
    } catch (e) {
      logAndAlertError('Erro ao carregar painéis', e);
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

  const filteredWallPanels = useMemo(() => {
    if (!searchQuery.trim()) return wallPanels;
    const q = searchQuery.toLowerCase();
    return wallPanels.filter((w) => w.name.toLowerCase().includes(q));
  }, [searchQuery, wallPanels]);

  function resetForm() {
    setFormName('');
    setFormPriceCents(0);
    setFormCurrency('BRL');
    setFormWidthMm(0);
    setFormHeightMm(0);
    setFormActive(true);
    setFormImageFiles([]);
    setFormImageFilesKey((k) => k + 1);
    setEditImageUrls([]);
    setEditMainImageUrl('');
  }

  function openCreate() {
    setEditing(null);
    resetForm();
    setShowForm(true);
  }

  function openEdit(w: WallPanel) {
    setEditing(w);
    setFormName(w.name);
    setFormPriceCents(w.priceCents);
    setFormCurrency(w.currency);
    setFormWidthMm(w.widthMm);
    setFormHeightMm(w.heightMm);
    setFormActive(w.active);
    setFormImageFiles([]);
    setFormImageFilesKey((n) => n + 1);
    setEditImageUrls(w.imageUrls);
    setEditMainImageUrl(w.mainImageUrl ?? '');
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
        await updateDoc(doc(firestoreDb, 'wall-panels', editing.id), {
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
        await updateDoc(doc(firestoreDb, 'wall-panels', editing.id), {
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
      const missingFields: string[] = [];
      if (!name) missingFields.push('Nome');
      if (!(formWidthMm > 0)) missingFields.push('Largura (mm)');
      if (!(formHeightMm > 0)) missingFields.push('Altura (mm)');

      if (missingFields.length) {
        setValidationPopup({ title: 'Não foi possível salvar o módulo.', missingFields });
        return;
      }

      setSaving(true);

      let imageUrls = [...editImageUrls];
      let mainImageUrl = editMainImageUrl;

      try {
        if (formImageFiles.length) {
          const newUrls = await uploadWallPanelImages(editing.id, formImageFiles);
          imageUrls = Array.from(new Set([...imageUrls, ...newUrls]));
          if (!mainImageUrl) mainImageUrl = imageUrls[0] ?? '';
        }

        await updateDoc(doc(firestoreDb, 'wall-panels', editing.id), {
          name,
          priceCents: Number.isFinite(formPriceCents) ? formPriceCents : 0,
          currency: formCurrency.trim() || 'BRL',
          widthMm: Number.isFinite(formWidthMm) ? formWidthMm : 0,
          heightMm: Number.isFinite(formHeightMm) ? formHeightMm : 0,
          active: formActive,
          imageUrls,
          mainImageUrl,
          updatedAt: serverTimestamp(),
        });

        setShowForm(false);
        resetForm();
        setEditing(null);
        await fetchData();
      } catch (e) {
        logAndAlertError('Erro ao atualizar módulo', e);
      } finally {
        setSaving(false);
      }
    } else {
      const missingFields: string[] = [];
      if (!name) missingFields.push('Nome');
      if (!(formWidthMm > 0)) missingFields.push('Largura (mm)');
      if (!(formHeightMm > 0)) missingFields.push('Altura (mm)');
      if (!formImageFiles.length) missingFields.push('Imagens (upload)');

      if (missingFields.length) {
        setValidationPopup({ title: 'Não foi possível cadastrar o módulo.', missingFields });
        return;
      }

      setSaving(true);

      const baseSlug = slugify(name);
      const slug = await findAvailableDocId('wall-panels', baseSlug);

      try {
        await setDoc(doc(firestoreDb, 'wall-panels', slug), {
          slug,
          name,
          priceCents: Number.isFinite(formPriceCents) ? formPriceCents : 0,
          currency: formCurrency.trim() || 'BRL',
          widthMm: Number.isFinite(formWidthMm) ? formWidthMm : 0,
          heightMm: Number.isFinite(formHeightMm) ? formHeightMm : 0,
          imageUrls: [],
          mainImageUrl: '',
          active: formActive,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const imageUrls = await uploadWallPanelImages(slug, formImageFiles);

        await updateDoc(doc(firestoreDb, 'wall-panels', slug), {
          imageUrls,
          mainImageUrl: imageUrls[0] ?? '',
          updatedAt: serverTimestamp(),
        });

        setShowForm(false);
        resetForm();
        await fetchData();
      } catch (e) {
        logAndAlertError('Erro ao criar módulo', e);
        try {
          await deleteDoc(doc(firestoreDb, 'wall-panels', slug));
        } catch {
          // ignore
        }
      } finally {
        setSaving(false);
      }
    }
  }

  async function handleDelete(wallPanel: WallPanel) {
    if (!window.confirm(`Excluir o módulo "${wallPanel.name}"?`)) return;
    try {
      await deleteDoc(doc(firestoreDb, 'wall-panels', wallPanel.id));
      await Promise.allSettled(wallPanel.imageUrls.map((url) => deleteStorageObject(url)));
      await fetchData();
    } catch (e) {
      logAndAlertError('Erro ao excluir módulo', e);
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

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Painéis de Parede</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-black text-white px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity sm:py-2"
        >
          <Plus className="h-4 w-4" />
          Novo Módulo
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por nome…"
          className="border rounded-lg px-3 py-2 text-sm text-gray-700 min-w-0 flex-1 sm:flex-none sm:w-64"
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

      {/* Form Modal */}
      {showForm && (
        // Sem fechar ao tocar fora: um toque acidental não pode descartar o
        // que foi preenchido. Fecha só no X ou em Cancelar.
        <AdminModal
          title={`${editing ? 'Editar' : 'Novo'} Módulo`}
          onClose={() => setShowForm(false)}
          footer={
            <div className="flex gap-3 sm:justify-end">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-lg border px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 sm:flex-none sm:py-2"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="flex-1 rounded-lg bg-black px-4 py-2.5 text-sm text-white hover:opacity-90 disabled:opacity-50 sm:flex-none sm:py-2"
              >
                {saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Criar módulo'}
              </button>
            </div>
          }
        >
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

              {/* Preço + Moeda + Ativo */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
                <div className="col-span-2 flex items-end sm:col-span-1 sm:pb-2">
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

              {/* Dimensões do módulo (mm) — usadas para escalar proporcionalmente no /paineis */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Largura (mm)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formWidthMm}
                    onChange={(e) => setFormWidthMm(Number(e.target.value))}
                    className="w-full border rounded-lg px-3 py-2 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Altura (mm)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formHeightMm}
                    onChange={(e) => setFormHeightMm(Number(e.target.value))}
                    className="w-full border rounded-lg px-3 py-2 text-gray-900"
                  />
                </div>
              </div>

              {/* Imagens existentes (edit) */}
              {editing && (
                <ImageOrderList
                  urls={editImageUrls}
                  onMove={(idx, direction) => void moveImage(idx, direction)}
                  onRemove={(url) => void removeExistingImage(url)}
                  altEditor={{
                    collection: 'wall-panels',
                    docId: editing.id,
                    itemName: formName.trim() || editing.name,
                    alts: editing.imageAlts,
                    onSaved: (next) => {
                      setEditing((prev) => (prev ? { ...prev, imageAlts: next } : prev));
                      setWallPanels((prev) =>
                        prev.map((w) => (w.id === editing.id ? { ...w, imageAlts: next } : w))
                      );
                    },
                  }}
                />
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

        </AdminModal>
      )}

      {/* Tabela */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
        </div>
      ) : filteredWallPanels.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {searchQuery ? 'Nenhum módulo encontrado.' : 'Nenhum módulo cadastrado ainda.'}
        </div>
      ) : (
        <div className="sm:bg-white sm:rounded-xl sm:border sm:overflow-hidden">
          {/* Celular: cartões. A tabela escondia preço e dimensões abaixo de md. */}
          <ul className="space-y-3 sm:hidden">
            {filteredWallPanels.map((wallPanel) => (
              <li key={wallPanel.id} className="rounded-xl border bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900">{wallPanel.name}</div>
                    <div className="truncate text-xs text-gray-400">{wallPanel.id}</div>
                  </div>
                  <StatusPill active={wallPanel.active} />
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2">
                  <div className="min-w-0 text-sm text-gray-600">
                    {wallPanel.priceCents > 0
                      ? (wallPanel.priceCents / 100).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: wallPanel.currency || 'BRL',
                        })
                      : '—'}
                    <span className="text-gray-300"> · </span>
                    {wallPanel.widthMm > 0 && wallPanel.heightMm > 0
                      ? `${wallPanel.widthMm} × ${wallPanel.heightMm} mm`
                      : '—'}
                  </div>
                  <div className="flex shrink-0 items-center">
                    <AdminIconButton label="Editar" onClick={() => openEdit(wallPanel)}>
                      <Pencil className="h-4 w-4" />
                    </AdminIconButton>
                    <AdminIconButton label="Excluir" tone="danger" onClick={() => handleDelete(wallPanel)}>
                      <Trash2 className="h-4 w-4" />
                    </AdminIconButton>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <table className="hidden w-full sm:table">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Módulo</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 hidden md:table-cell">
                  Preço
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 hidden md:table-cell">
                  Dimensões
                </th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredWallPanels.map((wallPanel) => (
                <tr key={wallPanel.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div className="font-medium text-gray-900">{wallPanel.name}</div>
                    <div className="text-xs text-gray-400">{wallPanel.id}</div>
                  </td>
                  <td className="py-3 px-4 text-gray-600 text-sm hidden md:table-cell">
                    {wallPanel.priceCents > 0
                      ? (wallPanel.priceCents / 100).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: wallPanel.currency || 'BRL',
                        })
                      : '—'}
                  </td>
                  <td className="py-3 px-4 text-gray-600 text-sm hidden md:table-cell">
                    {wallPanel.widthMm > 0 && wallPanel.heightMm > 0
                      ? `${wallPanel.widthMm} × ${wallPanel.heightMm} mm`
                      : '—'}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {wallPanel.active ? (
                      <Eye className="h-4 w-4 text-green-500 mx-auto" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-gray-400 mx-auto" />
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(wallPanel)}
                        className="p-1.5 text-gray-400 hover:text-black transition-colors"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(wallPanel)}
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
