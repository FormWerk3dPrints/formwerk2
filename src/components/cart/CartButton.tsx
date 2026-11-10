'use client';

import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/lib/cart/useCart';

/** Ícone do carrinho no cabeçalho, com o número de itens. */
export default function CartButton({ className = '' }: { className?: string }) {
  const { count, openCart } = useCart();

  return (
    <button
      type="button"
      onClick={openCart}
      className={`relative text-white hover:text-blue-100 transition-colors ${className}`}
      aria-label={count > 0 ? `Orçamento: ${count} ${count === 1 ? 'item' : 'itens'}` : 'Orçamento (vazio)'}
    >
      <ShoppingCart size={22} />
      {count > 0 && (
        <span
          // data-contrast-keep: o círculo é desenhado com cor de fundo e
          // sumiria no alto contraste sem isto.
          data-contrast-keep
          className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-[#0D6AA7]"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}
