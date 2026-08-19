'use client';

import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase/client';
import { AdminShell } from '../_components/AdminShell';
import { Download, RefreshCw } from 'lucide-react';

/**
 * Visualização do log de auditoria. O conteúdo vem da API já formatado em
 * linhas de texto — a mesma coisa que o botão de download salva.
 */
export default function AdminLogsPage() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const user = firebaseAuth.currentUser;
      if (!user) {
        setError('Faça login para ver o log.');
        return;
      }
      const idToken = await user.getIdToken();
      const res = await fetch('/api/admin/audit-log', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        setError(res.status === 401 ? 'Sem permissão para ver o log.' : 'Erro ao carregar o log.');
        return;
      }
      setText(await res.text());
    } catch {
      setError('Erro ao carregar o log.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Espera o Firebase resolver a sessão antes de pedir o token.
    const unsub = onAuthStateChanged(firebaseAuth, () => void load());
    return () => unsub();
  }, [load]);

  /* O download precisa do token no header, então não dá pra usar um link
     direto: baixamos o texto e salvamos como arquivo pelo próprio navegador. */
  async function download() {
    const user = firebaseAuth.currentUser;
    if (!user) return;
    const idToken = await user.getIdToken();
    const res = await fetch('/api/admin/audit-log?download=1', {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'admin-audit.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  const lineCount = text.trim() === '' ? 0 : text.trim().split('\n').length;

  return (
    <AdminShell>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Log de alterações</h1>
          <p className="text-sm text-gray-500">
            {loading ? 'Carregando…' : `${lineCount} operação${lineCount === 1 ? '' : 'ões'} registrada${lineCount === 1 ? '' : 's'}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
          <button
            type="button"
            onClick={() => void download()}
            disabled={lineCount === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-black px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Baixar .txt
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : (
        <pre className="max-h-[70vh] overflow-auto rounded-xl border bg-white p-4 text-xs leading-6 text-gray-800">
          {text.trim() === '' && !loading ? 'Nenhuma operação registrada ainda.' : text}
        </pre>
      )}
    </AdminShell>
  );
}
