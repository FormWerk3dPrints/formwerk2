'use client';

import { useEffect, useState } from 'react';
import { Check, Minus, Plus, ShoppingCart } from 'lucide-react';
import { useCart } from '@/lib/cart/useCart';
import { MAX_QUANTITY, sanitizeQuantity, type CartKind } from '@/lib/cart/types';

type Props = {
  kind: CartKind;
  id: string;
  name: string;
  pluralName?: string;
  imageUrl?: string;
  className?: string;
};

/**
 * Escolhe a quantidade e joga o item no orçamento. Usado na página de cada
 * produto, kit e painel.
 */
export default function AddToCartButton({
  kind,
  id,
  name,
  pluralName,
  imageUrl,
  className = '',
}: Props) {
  const { addItem } = useCart();
  const [quantidade, setQuantidade] = useState(1);
  // Como a gaveta não abre mais sozinha, o botão confirma por alguns segundos
  // que o item entrou.
  const [confirmado, setConfirmado] = useState(false);

  useEffect(() => {
    if (!confirmado) return;
    const id = setTimeout(() => setConfirmado(false), 2500);
    return () => clearTimeout(id);
  }, [confirmado]);

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <div className="flex items-center gap-1 rounded-lg border px-1 py-1">
        <button
          type="button"
          onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
          disabled={quantidade <= 1}
          className="rounded-md p-2 text-gray-600 disabled:opacity-40"
          aria-label="Diminuir quantidade"
        >
          <Minus size={16} />
        </button>
        <input
          type="number"
          min={1}
          max={MAX_QUANTITY}
          value={quantidade}
          onChange={(e) => setQuantidade(sanitizeQuantity(e.target.value))}
          className="w-16 border-0 text-center text-sm font-semibold text-gray-900 focus:outline-none"
          aria-label="Quantidade"
        />
        <button
          type="button"
          onClick={() => setQuantidade((q) => sanitizeQuantity(q + 1))}
          className="rounded-md p-2 text-gray-600"
          aria-label="Aumentar quantidade"
        >
          <Plus size={16} />
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          addItem({ kind, id, name, pluralName, imageUrl }, quantidade);
          setConfirmado(true);
        }}
        className="inline-flex items-center gap-2 rounded-lg px-6 py-3 font-semibold text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: confirmado ? '#15803d' : '#0D6AA7' }}
      >
        {confirmado ? <Check size={18} /> : <ShoppingCart size={18} />}
        {confirmado ? 'Adicionado ao orçamento' : 'Adicionar ao orçamento'}
      </button>
      {/* Leitor de tela: o botão muda de rótulo, mas o aviso aqui é anunciado
          sem precisar que o foco volte para ele. */}
      <span role="status" aria-live="polite" className="sr-only">
        {confirmado ? `${quantidade} ${quantidade > 1 ? 'unidades adicionadas' : 'unidade adicionada'} ao orçamento` : ''}
      </span>
    </div>
  );
}
