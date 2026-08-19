'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { firestoreDb } from '@/lib/firebase/client';
import { slugify } from '@/lib/text/normalize';
import { AdminShell } from '../_components/AdminShell';
import { logAdminAction } from '@/lib/admin/auditLog';
import {
  type Category,
  findAvailableDocId,
  logAndAlertError,
} from '../_utils/helpers';
import { useSmoothScroller } from '@/components/ScrollContext';
import { Plus, Pencil, Trash2, X } from 'lucide-react';

type CategoryForm = {
  name: string;
  description: string;
  color: string;
  order: number;
  active: boolean;
};

const EMPTY_FORM: CategoryForm = {
  name: '',
  description: '',
  color: '',
  order: 0,
  active: true,
};

export default function AdminCategoriasPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const lenisRef = useSmoothScroller();

  async function fetchCategories() {
    try {
      const q = query(
        collection(firestoreDb, 'categories'),
        orderBy('order', 'asc')
      );
      const snapshot = await getDocs(q);
      setCategories(
        snapshot.docs.map((d) => {
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
    } catch (e) {
      logAndAlertError('Erro ao carregar categorias', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    const lenis = lenisRef?.current;
    if (showForm) {
      lenis?.stop();
    } else {
      lenis?.start();
    }
    return () => { lenis?.start(); };
  }, [showForm, lenisRef]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(cat: Category) {
    setEditing(cat);
    setForm({
      name: cat.name,
      description: cat.description,
      color: cat.color,
      order: cat.order,
      active: cat.active,
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);

    try {
      if (editing) {
        await updateDoc(doc(firestoreDb, 'categories', editing.id), {
          name: form.name.trim(),
          description: form.description.trim(),
          color: form.color.trim(),
          order: form.order,
          active: form.active,
        });
        void logAdminAction('categoria', form.name.trim(), 'alteracao');
      } else {
        const baseId = slugify(form.name.trim());
        const id = await findAvailableDocId('categories', baseId);
        await setDoc(doc(firestoreDb, 'categories', id), {
          name: form.name.trim(),
          description: form.description.trim(),
          color: form.color.trim(),
          order: form.order,
          active: form.active,
        });
        void logAdminAction('categoria', form.name.trim(), 'cadastro');
      }

      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditing(null);
      await fetchCategories();
    } catch (e) {
      logAndAlertError('Erro ao salvar categoria', e);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(cat: Category) {
    if (!window.confirm(`Excluir a categoria "${cat.name}"?`)) return;

    try {
      await deleteDoc(doc(firestoreDb, 'categories', cat.id));
      void logAdminAction('categoria', cat.name, 'delecao');
      await fetchCategories();
    } catch (e) {
      logAndAlertError('Erro ao excluir categoria', e);
    }
  }

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Categorias</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          Nova Categoria
        </button>
      </div>

      {/* Modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          data-lenis-prevent
        >
          {/* Sem onClick no fundo: clicar fora não fecha, pra não perder
              o que foi preenchido por acidente. Fecha só no X ou em Cancelar. */}
          <div
            className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
            data-lenis-prevent
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editing ? 'Editar' : 'Nova'} Categoria
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-gray-900"
                  placeholder="Ex: Geometria"
                />
                {form.name && (
                  <p className="text-xs text-gray-400 mt-1">
                    Slug: {slugify(form.name)}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2 text-gray-900"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cor (hex)
                  </label>
                  <input
                    type="text"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-gray-900"
                    placeholder="#RRGGBB"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ordem
                  </label>
                  <input
                    type="number"
                    value={form.order}
                    onChange={(e) =>
                      setForm({ ...form, order: Number(e.target.value) })
                    }
                    className="w-full border rounded-lg px-3 py-2 text-gray-900"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Ativa</span>
              </label>

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

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-white rounded-lg h-16 border" />
          ))}
        </div>
      ) : categories.length > 0 ? (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                  Ordem
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                  Nome
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 hidden sm:table-cell">
                  ID
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 hidden md:table-cell">
                  Cor
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
              {categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-600">{cat.order}</td>
                  <td className="py-3 px-4 font-medium text-gray-900">
                    {cat.name}
                  </td>
                  <td className="py-3 px-4 text-gray-500 text-sm hidden sm:table-cell">
                    {cat.id}
                  </td>
                  <td className="py-3 px-4 hidden md:table-cell">
                    {cat.color && (
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded border"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="text-xs text-gray-500">{cat.color}</span>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        cat.active
                          ? 'bg-green-50 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {cat.active ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(cat)}
                        className="p-1.5 text-gray-400 hover:text-black transition-colors"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(cat)}
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
      ) : (
        <div className="text-center py-12 text-gray-500">
          Nenhuma categoria cadastrada.
        </div>
      )}
    </AdminShell>
  );
}
