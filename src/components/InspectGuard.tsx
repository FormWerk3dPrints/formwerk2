'use client';

import { useEffect } from 'react';

/**
 * Deterrentes fracos contra inspeção casual (clique-direito, atalhos de DevTools,
 * view-source). Não impede um usuário técnico — qualquer conteúdo enviado ao
 * navegador é, por definição, inspecionável. Isso só desencoraja cópia casual.
 */
export default function InspectGuard() {
  useEffect(() => {
    function blockContextMenu(e: MouseEvent) {
      e.preventDefault();
    }

    function blockDevtoolsKeys(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      const isDevtoolsShortcut =
        key === 'f12' ||
        (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(key)) ||
        (e.metaKey && e.altKey && ['i', 'j', 'c'].includes(key)) ||
        (e.ctrlKey && key === 'u') ||
        (e.metaKey && key === 'u');

      if (isDevtoolsShortcut) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    document.addEventListener('contextmenu', blockContextMenu);
    document.addEventListener('keydown', blockDevtoolsKeys, true);

    return () => {
      document.removeEventListener('contextmenu', blockContextMenu);
      document.removeEventListener('keydown', blockDevtoolsKeys, true);
    };
  }, []);

  return null;
}
