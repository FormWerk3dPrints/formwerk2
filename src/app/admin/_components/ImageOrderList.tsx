'use client';

import { useId, useState } from 'react';
import { deleteField, doc, FieldPath, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Check, ChevronDown, ChevronUp, Loader2, Trash2 } from 'lucide-react';
import { firestoreDb } from '@/lib/firebase/client';
import { IMAGE_ALT_MAX_LENGTH, imageAlt, type ImageAlts } from '@/lib/images/imageAlt';

type AltEditor = {
  collection: 'products' | 'kits' | 'wall-panels';
  docId: string;
  /** Nome do item, usado para mostrar a descrição automática como sugestão. */
  itemName: string;
  alts: ImageAlts;
  /** Chamado depois de gravar, com o mapa de descrições já atualizado. */
  onSaved: (next: ImageAlts) => void;
};

/**
 * Imagens já cadastradas, com reordenação, remoção e descrição. Usada por
 * produtos, kits e painéis, que antes tinham três cópias quase idênticas.
 *
 * No celular os controles viram alvos de toque de verdade e a URL some: numa
 * tela estreita ela não informava nada e empurrava os botões para fora.
 */
export function ImageOrderList({
  urls,
  onMove,
  onRemove,
  altEditor,
}: {
  urls: string[];
  onMove: (idx: number, direction: -1 | 1) => void;
  onRemove: (url: string) => void;
  /** Liga o campo de descrição por imagem. Só existe para itens já salvos. */
  altEditor?: AltEditor;
}) {
  if (urls.length === 0) return null;

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        Imagens cadastradas ({urls.length})
      </label>
      <ul className="grid gap-2 sm:max-h-80 sm:overflow-y-auto sm:overscroll-contain">
        {urls.map((url, idx) => (
          <li key={url} className="rounded-lg border px-2 py-2 sm:px-3">
            <div className="flex items-center gap-2">
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
            </div>

            {altEditor && (
              <ImageAltField url={url} index={idx} total={urls.length} editor={altEditor} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Descrição de uma imagem. Grava sozinha ao sair do campo, como o preço da
 * tabela e a própria ordem das imagens: não depende do botão Salvar do modal.
 */
function ImageAltField({
  url,
  index,
  total,
  editor,
}: {
  url: string;
  index: number;
  total: number;
  editor: AltEditor;
}) {
  const inputId = useId();
  const saved = editor.alts[url] ?? '';
  const [draft, setDraft] = useState(saved);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const automatic = imageAlt(editor.itemName, url, undefined, { index, total });

  async function commit() {
    const next = draft.trim().slice(0, IMAGE_ALT_MAX_LENGTH);
    if (next === saved) return;

    setStatus('saving');
    try {
      // FieldPath em vez da string 'imageAlts.<url>': a URL tem pontos e
      // barras, que numa string de caminho seriam lidos como separadores.
      await updateDoc(
        doc(firestoreDb, editor.collection, editor.docId),
        new FieldPath('imageAlts', url),
        next ? next : deleteField(),
        'updatedAt',
        serverTimestamp()
      );
      const updated = { ...editor.alts };
      if (next) updated[url] = next;
      else delete updated[url];
      editor.onSaved(updated);
      setDraft(next);
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="mt-2">
      <label htmlFor={inputId} className="mb-1 flex items-center gap-2 text-xs text-gray-500">
        Descrição da imagem (o que a foto mostra)
        {status === 'saving' && <Loader2 className="h-3 w-3 animate-spin" aria-label="Salvando" />}
        {status === 'saved' && <Check className="h-3 w-3 text-green-600" aria-label="Salva" />}
        {status === 'error' && <span className="text-red-600">Falha ao salvar</span>}
      </label>
      <input
        id={inputId}
        type="text"
        value={draft}
        maxLength={IMAGE_ALT_MAX_LENGTH}
        placeholder={`Automática: ${automatic}`}
        onChange={(e) => {
          setDraft(e.target.value);
          if (status !== 'saving') setStatus('idle');
        }}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void commit();
          }
        }}
        className="w-full rounded-lg border px-3 py-2 text-sm text-gray-900"
      />
    </div>
  );
}
