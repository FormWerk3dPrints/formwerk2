'use client';

import { useSyncExternalStore } from 'react';
import * as store from './store';

/**
 * Lê o carrinho e devolve as ações. Não precisa de provider: o estado vive no
 * módulo store.ts, e este hook só assina as mudanças.
 */
export function useCart() {
  const estado = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

  return {
    items: estado.items,
    count: estado.items.reduce((soma, i) => soma + i.quantity, 0),
    isOpen: estado.isOpen,
    openCart: store.openCart,
    closeCart: store.closeCart,
    addItem: store.addItem,
    setQuantity: store.setQuantity,
    removeItem: store.removeItem,
    clear: store.clear,
  };
}
