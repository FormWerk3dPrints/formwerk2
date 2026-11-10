'use client';

import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { FileDown } from 'lucide-react';
import { firebaseAuth } from '@/lib/firebase/client';
import { formatCents } from '@/lib/prices/coerceToCents';

/**
 * Histórico de orçamentos do visitante logado.
 *
 * O registro dos itens fica guardado para sempre; o PDF vale 30 dias, então
 * cada linha mostra o link enquanto ele existe e, depois, só a lista de itens.
 */

type ItemHistorico = { nome: string; quantidade: number; precoUnitarioCents: number | null };

type OrcamentoHistorico = {
  numero: string;
  criadoEm: string | null;
  expiraEm: string | null;
  valido: boolean;
  itens: ItemHistorico[];
  totalCents: number | null;
  pdfUrl: string | null;
};

function formatarData(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { dateStyle: 'short' });
}

export default function MeusOrcamentos() {
  const [orcamentos, setOrcamentos] = useState<OrcamentoHistorico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const user = firebaseAuth.currentUser;
    if (!user) {
      setCarregando(false);
      return;
    }
    setCarregando(true);
    setErro(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/orcamento/meus', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        setErro('Não foi possível carregar seus orçamentos.');
        return;
      }
      const dados = await res.json();
      setOrcamentos(Array.isArray(dados.orcamentos) ? dados.orcamentos : []);
    } catch {
      setErro('Não foi possível carregar seus orçamentos.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, () => void carregar());
    return () => unsub();
  }, [carregar]);

  if (carregando) {
    return <p className="text-sm text-gray-500">Carregando seus orçamentos...</p>;
  }

  if (erro) {
    return <p className="text-sm text-red-600">{erro}</p>;
  }

  if (orcamentos.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Você ainda não pediu nenhum orçamento. Monte o seu pelo carrinho, no topo da página.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {orcamentos.map((o) => (
        <li key={o.numero} className="rounded-lg border p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="font-mono text-xs text-gray-400">{o.numero}</div>
              <div className="text-sm text-gray-600">{formatarData(o.criadoEm)}</div>
            </div>
            {o.totalCents !== null && (
              <div className="font-semibold text-gray-900">{formatCents(o.totalCents)}</div>
            )}
          </div>

          <ul className="mt-3 border-t pt-3 text-sm text-gray-700">
            {o.itens.map((item, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span>
                  {item.quantidade} un — {item.nome}
                </span>
                {item.precoUnitarioCents !== null && (
                  <span className="shrink-0 text-gray-500">
                    {formatCents(item.precoUnitarioCents * item.quantidade)}
                  </span>
                )}
              </li>
            ))}
          </ul>

          {o.pdfUrl ? (
            <a
              href={o.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold"
              style={{ color: '#0D6AA7' }}
            >
              <FileDown className="h-4 w-4" />
              Abrir PDF
            </a>
          ) : (
            <p className="mt-3 text-xs text-gray-400">
              PDF expirado — o arquivo fica disponível por 30 dias. Os itens acima continuam
              registrados.
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
