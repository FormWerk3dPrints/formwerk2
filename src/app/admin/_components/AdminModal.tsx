'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

/**
 * Modal do admin.
 *
 * No celular ocupa a tela inteira, com cabeçalho e rodapé fixos: Salvar e
 * Cancelar ficam sempre ao alcance do polegar, mesmo com o teclado aberto e o
 * formulário comprido. A partir de `sm` volta a ser o cartão centralizado.
 */
export function AdminModal({
  title,
  onClose,
  children,
  footer,
  closeOnBackdrop = false,
  size = 'lg',
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Ações que ficam fixas no rodapé (Salvar, Cancelar). */
  footer?: ReactNode;
  /** Formulários deixam false: um toque fora não pode descartar o que foi preenchido. */
  closeOnBackdrop?: boolean;
  size?: 'md' | 'lg';
}) {
  // O Lenis só controla a roda do mouse. No toque quem rola é o navegador, e
  // sem esta trava a página de trás rola junto quando o modal chega ao fim.
  useEffect(() => {
    const html = document.documentElement;
    const previous = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = previous;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 sm:items-center sm:p-4"
      data-lenis-prevent
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`flex h-[100dvh] w-full flex-col bg-white sm:h-auto sm:max-h-[90vh] sm:rounded-xl ${
          size === 'md' ? 'sm:max-w-lg' : 'sm:max-w-2xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-1.5 sm:border-b-0 sm:px-6 sm:pt-5 sm:pb-1">
          <h2 className="text-lg font-bold text-gray-900 sm:text-xl">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6"
          data-lenis-prevent
        >
          {children}
        </div>

        {footer && (
          <div className="shrink-0 border-t bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:rounded-b-xl sm:px-6 sm:py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
