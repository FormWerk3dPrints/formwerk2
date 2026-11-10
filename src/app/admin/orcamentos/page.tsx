'use client';

import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase/client';
import { AdminShell } from '../_components/AdminShell';
import { ChevronLeft, ChevronRight, Eye, FileDown, RefreshCw, X } from 'lucide-react';
import { formatCents } from '@/lib/prices/coerceToCents';

/**
 * Orçamentos pedidos pelo site. Cada um guarda os itens, os dados do cliente
 * e o link do PDF; o arquivo some do Storage 30 dias depois, por isso a lista
 * mostra a data de validade de cada link.
 */

type Orcamento = {
  numero: string;
  cliente: { cliente?: string; documento?: string; contato?: string; email?: string } | null;
  itens: Array<{ nome?: string; quantidade?: number }>;
  totalCents: number;
  comPreco: boolean;
  solicitanteEmail: string | null;
  pdfUrl: string | null;
  criadoEm: string | null;
  expiraEm: string | null;
};

function formatarData(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function AdminOrcamentosPage() {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  /** Índice, dentro de `comPdf`, do orçamento aberto no visualizador. */
  const [visualizando, setVisualizando] = useState<number | null>(null);
  const [baixando, setBaixando] = useState<string | null>(null);

  // Só entram na navegação os que ainda têm arquivo: depois de 30 dias sobra
  // o registro, mas não há PDF para folhear.
  const comPdf = orcamentos.filter((o) => o.pdfUrl);

  /** O DOCX exige o token no cabeçalho, então não dá para usar link direto. */
  async function baixarDocx(numero: string) {
    setBaixando(numero);
    try {
      const user = firebaseAuth.currentUser;
      if (!user) return;
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/admin/orcamentos/${encodeURIComponent(numero)}/docx`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        setErro('Não foi possível gerar o DOCX.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orcamento-${numero}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBaixando(null);
    }
  }

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const user = firebaseAuth.currentUser;
      if (!user) {
        setErro('Faça login para ver os orçamentos.');
        return;
      }
      const idToken = await user.getIdToken();
      const res = await fetch('/api/admin/orcamentos', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        setErro(res.status === 403 ? 'Sem permissão.' : 'Erro ao carregar os orçamentos.');
        return;
      }
      const dados = await res.json();
      setOrcamentos(Array.isArray(dados.orcamentos) ? dados.orcamentos : []);
    } catch {
      setErro('Erro ao carregar os orçamentos.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, () => void carregar());
    return () => unsub();
  }, [carregar]);

  return (
    <AdminShell>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orçamentos</h1>
          <p className="text-sm text-gray-500">
            Pedidos feitos pelo carrinho do site. O PDF fica disponível por 30 dias.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void carregar()}
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </button>
      </div>

      {erro && <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{erro}</p>}

      {carregando ? (
        <p className="py-12 text-center text-gray-500">Carregando...</p>
      ) : orcamentos.length === 0 && !erro ? (
        <p className="py-12 text-center text-gray-500">Nenhum orçamento pedido ainda.</p>
      ) : (
        <ul className="space-y-3">
          {orcamentos.map((o) => {
            const expirado = o.expiraEm ? new Date(o.expiraEm).getTime() < Date.now() : false;
            return (
              <li key={o.numero} className="rounded-xl border bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-gray-400">{o.numero}</div>
                    <div className="font-semibold text-gray-900">
                      {o.cliente?.cliente || 'Sem nome'}
                    </div>
                    <div className="text-sm text-gray-600">
                      {[o.cliente?.contato, o.cliente?.email, o.cliente?.documento]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">{formatarData(o.criadoEm)}</div>
                    {o.comPreco ? (
                      <div className="font-semibold text-gray-900">{formatCents(o.totalCents)}</div>
                    ) : (
                      <div className="text-xs text-amber-600">sem preço (visitante)</div>
                    )}
                  </div>
                </div>

                <ul className="mt-3 border-t pt-3 text-sm text-gray-700">
                  {o.itens.map((item, i) => (
                    <li key={i}>
                      {item.quantidade ?? 1} un — {item.nome ?? '?'}
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex flex-wrap items-center gap-4">
                  {o.pdfUrl && !expirado ? (
                    <button
                      type="button"
                      onClick={() => setVisualizando(comPdf.findIndex((x) => x.numero === o.numero))}
                      className="inline-flex items-center gap-2 text-sm font-semibold"
                      style={{ color: '#0D6AA7' }}
                    >
                      <Eye className="h-4 w-4" />
                      Ver PDF
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400">
                      PDF expirado — o registro dos itens continua aqui
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => void baixarDocx(o.numero)}
                    disabled={baixando === o.numero}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900 disabled:opacity-50"
                  >
                    <FileDown className="h-4 w-4" />
                    {baixando === o.numero ? 'Gerando...' : 'Baixar DOCX'}
                  </button>

                  {!o.comPreco && (
                    <span className="text-xs text-amber-600">
                      DOCX sai com a coluna de preço em branco
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Visualizador: folheia os orçamentos que ainda têm PDF. */}
      {visualizando !== null && comPdf[visualizando] && (
        <div
          className="fixed inset-0 z-[70] flex flex-col bg-black/60 p-4"
          // Sem isto o Lenis rola a lista atrás em vez do PDF.
          data-lenis-prevent
          role="dialog"
          aria-modal="true"
          aria-label={`Orçamento ${comPdf[visualizando].numero}`}
        >
          <div className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
              <div className="min-w-0">
                <div className="font-mono text-xs text-gray-400">{comPdf[visualizando].numero}</div>
                <div className="truncate font-semibold text-gray-900">
                  {comPdf[visualizando].cliente?.cliente || 'Sem nome'}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVisualizando((i) => Math.max(0, (i ?? 0) - 1))}
                  disabled={visualizando === 0}
                  className="rounded-lg border p-2 text-gray-600 disabled:opacity-40"
                  aria-label="Orçamento anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs text-gray-500">
                  {visualizando + 1} de {comPdf.length}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setVisualizando((i) => Math.min(comPdf.length - 1, (i ?? 0) + 1))
                  }
                  disabled={visualizando >= comPdf.length - 1}
                  className="rounded-lg border p-2 text-gray-600 disabled:opacity-40"
                  aria-label="Próximo orçamento"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void baixarDocx(comPdf[visualizando].numero)}
                  className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium text-gray-700"
                >
                  <FileDown className="h-4 w-4" />
                  DOCX
                </button>
                <button
                  type="button"
                  onClick={() => setVisualizando(null)}
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </header>

            <iframe
              key={comPdf[visualizando].numero}
              src={comPdf[visualizando].pdfUrl ?? ''}
              title={`PDF do orçamento ${comPdf[visualizando].numero}`}
              className="flex-1 w-full"
            />
          </div>
        </div>
      )}
    </AdminShell>
  );
}
