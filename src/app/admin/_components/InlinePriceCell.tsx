'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { parseReaisToCents } from '@/lib/prices/coerceToCents';

/**
 * Preço editável direto na tabela: clicou, digitou, salvou — sem abrir o modal.
 *
 * O campo trabalha em REAIS (é o que aparece na tela), mas o que vai pro
 * Firestore é sempre centavo inteiro. Isso também normaliza os registros
 * antigos que foram gravados como reais decimais: ao editar, o produto sai
 * do formato ambíguo.
 */
export default function InlinePriceCell({
  valueCents,
  currency = 'BRL',
  onSave,
  label,
}: {
  valueCents: number;
  currency?: string;
  /** Deve persistir o valor. Se lançar, a célula volta ao valor anterior. */
  onSave: (nextCents: number) => Promise<void>;
  /** Usado no aria-label, pra dizer de quem é o preço. */
  label: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  // Some o "salvo" depois de um instante.
  useEffect(() => {
    if (!savedAt) return;
    const t = setTimeout(() => setSavedAt(0), 1800);
    return () => clearTimeout(t);
  }, [savedAt]);

  const formatted =
    valueCents > 0
      ? (valueCents / 100).toLocaleString('pt-BR', {
          style: 'currency',
          currency: currency || 'BRL',
        })
      : '—';

  function startEditing() {
    setError(null);
    // Pré-preenche em reais, com vírgula — o formato que o admin digita.
    setDraft(valueCents > 0 ? (valueCents / 100).toFixed(2).replace('.', ',') : '');
    setEditing(true);
  }

  async function commit() {
    const next = parseReaisToCents(draft);
    if (next === null) {
      setError('Valor inválido');
      return;
    }
    if (next === valueCents) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(next);
      setEditing(false);
      setSavedAt(Date.now());
    } catch {
      setError('Falha ao salvar');
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-gray-400 text-sm">R$</span>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void commit();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              setEditing(false);
              setError(null);
            }
          }}
          onBlur={() => void commit()}
          disabled={saving}
          inputMode="decimal"
          aria-label={`Preço de ${label} em reais`}
          className="w-24 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-black focus:outline-none disabled:opacity-60"
        />
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={startEditing}
        title="Clique para alterar o preço"
        aria-label={`Alterar preço de ${label}`}
        className="rounded px-1.5 py-0.5 -mx-1.5 text-left text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
      >
        {formatted}
      </button>
      {savedAt > 0 && <Check className="h-3.5 w-3.5 text-green-500" />}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
