'use client';

import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

/**
 * Imagens já cadastradas, com reordenação e remoção. Usada por produtos, kits
 * e painéis, que antes tinham três cópias quase idênticas desta lista.
 *
 * No celular os controles viram alvos de toque de verdade e a URL some: numa
 * tela estreita ela não informava nada e empurrava os botões para fora.
 */
export function ImageOrderList({
  urls,
  onMove,
  onRemove,
}: {
  urls: string[];
  onMove: (idx: number, direction: -1 | 1) => void;
  onRemove: (url: string) => void;
}) {
  if (urls.length === 0) return null;

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        Imagens cadastradas ({urls.length})
      </label>
      <ul className="grid gap-2 sm:max-h-64 sm:overflow-y-auto sm:overscroll-contain">
        {urls.map((url, idx) => (
          <li key={url} className="flex items-center gap-2 rounded-lg border px-2 py-2 sm:px-3">
            <div className="flex shrink-0 flex-col sm:flex-row sm:items-center">
              <button
                type="button"
                disabled={idx === 0}
                onClick={() => onMove(idx, -1)}
                aria-label="Mover para cima"
                title="Mover para cima"
                className="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-25 sm:h-7 sm:w-7"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={idx === urls.length - 1}
                onClick={() => onMove(idx, 1)}
                aria-label="Mover para baixo"
                title="Mover para baixo"
                className="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-25 sm:h-7 sm:w-7"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Imagem ${idx + 1}`}
              className="h-14 w-14 shrink-0 rounded object-cover sm:h-10 sm:w-10"
            />

            <div className="min-w-0 flex-1">
              <div className="text-sm text-gray-700">{idx + 1}</div>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="hidden truncate text-xs text-gray-500 underline sm:block"
              >
                {url}
              </a>
            </div>

            <button
              type="button"
              onClick={() => onRemove(url)}
              aria-label={`Remover imagem ${idx + 1}`}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 sm:h-auto sm:w-auto sm:px-2 sm:py-1 sm:text-xs"
            >
              <Trash2 className="h-4 w-4 sm:hidden" />
              <span className="hidden sm:inline">Remover</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
