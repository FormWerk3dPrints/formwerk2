import { useEffect, useState } from 'react';
import { getProductComments } from '@/lib/products/getProductComments';
import { updateProductComment } from '@/lib/products/updateProductComment';
import { deleteProductComment } from '@/lib/products/deleteProductComment';
import { ProductComment } from '@/lib/products/ProductComment';
import { AdminCommentForm } from '@/components/AdminCommentForm';

interface AdminProductCommentsEditorProps {
  productId: string;
}

export function AdminProductCommentsEditor({ productId }: AdminProductCommentsEditorProps) {
  const [comments, setComments] = useState<ProductComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<ProductComment>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const data = await getProductComments(productId);
      setComments(data);
    } catch (e) {
      setError('Erro ao carregar comentários');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  function beginEdit(comment: ProductComment) {
    setEditingId(comment.id ?? null);
    setEditData({
      name: comment.name,
      role: comment.role,
      comment: comment.comment,
      profilePicture: comment.profilePicture,
    });
  }

  async function handleSave() {
    if (!editingId) return;
    setSaving(true);
    setError('');
    try {
      await updateProductComment(productId, editingId, {
        name: editData.name ?? '',
        role: editData.role ?? '',
        comment: editData.comment ?? '',
        profilePicture: editData.profilePicture ?? '',
      });
      setEditingId(null);
      setEditData({});
      await refresh();
    } catch (e) {
      setError('Erro ao salvar comentário');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Remover este comentário?')) return;
    setSaving(true);
    setError('');
    try {
      await deleteProductComment(productId, id);
      if (editingId === id) {
        setEditingId(null);
        setEditData({});
      }
      await refresh();
    } catch (e) {
      setError('Erro ao remover comentário');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-sm opacity-70">Carregando comentários…</div>;
  if (error) return <div className="text-red-600 text-sm">{error}</div>;

  return (
    <div className="flex flex-col gap-6">
      <AdminCommentForm productId={productId} onCommentAdded={refresh} />
      <div className="flex flex-col gap-4">
        {comments.length === 0 && (
          <div className="text-sm opacity-60">Nenhum comentário cadastrado.</div>
        )}
        {comments.map((c) => (
          <div key={c.id} className="rounded border p-3 bg-white flex flex-col gap-2">
            {editingId === c.id ? (
              <>
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    className="border rounded px-2 py-1 text-sm"
                    value={editData.name ?? ''}
                    onChange={e => setEditData(d => ({ ...d, name: e.target.value }))}
                    placeholder="Nome"
                  />
                  <input
                    className="border rounded px-2 py-1 text-sm"
                    value={editData.role ?? ''}
                    onChange={e => setEditData(d => ({ ...d, role: e.target.value }))}
                    placeholder="Função"
                  />
                  <input
                    className="border rounded px-2 py-1 text-sm"
                    value={editData.profilePicture ?? ''}
                    onChange={e => setEditData(d => ({ ...d, profilePicture: e.target.value }))}
                    placeholder="URL da foto (opcional)"
                  />
                </div>
                <textarea
                  className="border rounded px-2 py-1 text-sm w-full mt-1"
                  value={editData.comment ?? ''}
                  onChange={e => setEditData(d => ({ ...d, comment: e.target.value }))}
                  placeholder="Comentário"
                  rows={2}
                />
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    className="bg-black text-white rounded px-3 py-1 text-sm disabled:opacity-60"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    className="border rounded px-3 py-1 text-sm"
                    onClick={() => { setEditingId(null); setEditData({}); }}
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 items-center">
                  {c.profilePicture && (
                    <img src={c.profilePicture} alt={c.name} className="w-8 h-8 rounded-full object-cover border" />
                  )}
                  <span className="font-semibold text-sm">{c.name}</span>
                  <span className="text-xs text-gray-500">{c.role}</span>
                  <span className="text-xs text-gray-400 ml-2">{c.date ? new Date(c.date).toLocaleDateString() : ''}</span>
                </div>
                <div className="text-sm italic text-gray-700">{c.comment}</div>
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    className="border rounded px-3 py-1 text-sm"
                    onClick={() => beginEdit(c)}
                    disabled={saving}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="border rounded px-3 py-1 text-sm text-red-600"
                    onClick={() => handleDelete(c.id!)}
                    disabled={saving}
                  >
                    Remover
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}