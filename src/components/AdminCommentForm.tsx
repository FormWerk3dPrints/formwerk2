
import { useState } from 'react';
import { CommentProfileImagePicker } from './CommentProfileImagePicker';

import { addProductComment } from '../lib/products/addProductComment';


interface AdminCommentFormProps {
  productId: string;
  onCommentAdded?: () => void;
}

export function AdminCommentForm({ productId, onCommentAdded }: AdminCommentFormProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [comment, setComment] = useState('');
  const [profilePicture, setProfilePicture] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await addProductComment(productId, { name, role, comment, profilePicture });
      setName('');
      setRole('');
      setComment('');
      setProfilePicture(undefined);
      onCommentAdded?.();
    } catch (err) {
      setError('Failed to add comment');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-4 rounded-lg border border-black/10 mt-4">
      <h3 className="font-bold text-base mb-2 text-gray-900">Adicionar comentário</h3>
      <div>
        <input
          className="w-full border border-black rounded-md px-3 py-2 bg-white focus:border-black focus:outline-none text-sm text-gray-900"
          placeholder="Nome"
          value={name}
          onChange={e => setName(e.target.value)}
          required
        />
      </div>
      <div>
        <input
          className="w-full border border-black rounded-md px-3 py-2 bg-white focus:border-black focus:outline-none text-sm text-gray-900"
          placeholder="Função"
          value={role}
          onChange={e => setRole(e.target.value)}
          required
        />
      </div>
      <div>
        <textarea
          className="w-full border border-black rounded-md px-3 py-2 bg-white focus:border-black focus:outline-none text-sm text-gray-900"
          placeholder="Comentário"
          value={comment}
          onChange={e => setComment(e.target.value)}
          required
          rows={2}
        />
      </div>
      <div>
        <span className="text-xs text-gray-900">Imagem de perfil (opcional):</span>
        <CommentProfileImagePicker value={profilePicture} onChange={setProfilePicture} />
      </div>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      <button
        type="submit"
        className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-white hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-60 text-sm"
        disabled={loading}
      >
        {loading ? 'Salvando…' : 'Adicionar comentário'}
      </button>
    </form>
  );
}
