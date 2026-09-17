'use client';

import { useSyncExternalStore } from 'react';
import { Contrast } from 'lucide-react';
import { CONTRAST_CHANGE_EVENT, CONTRAST_STORAGE_KEY } from '@/lib/a11y/contrast';

function applyContrast(on: boolean) {
  if (on) {
    document.documentElement.setAttribute('data-contrast', 'high');
  } else {
    document.documentElement.removeAttribute('data-contrast');
  }
}

function subscribe(onChange: () => void) {
  // Outra aba mudou a preferência: acompanha nesta também.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== CONTRAST_STORAGE_KEY) return;
    applyContrast(e.newValue === 'high');
    onChange();
  };

  window.addEventListener(CONTRAST_CHANGE_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CONTRAST_CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}

const getSnapshot = () => document.documentElement.getAttribute('data-contrast') === 'high';
const getServerSnapshot = () => false;

/**
 * Liga e desliga o alto contraste. O estado mora no atributo `data-contrast`
 * do <html>, que o script do <head> já aplica antes de o React carregar.
 */
export default function ContrastToggle({ className = '' }: { className?: string }) {
  const active = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    const next = !active;
    applyContrast(next);
    try {
      localStorage.setItem(CONTRAST_STORAGE_KEY, next ? 'high' : 'normal');
    } catch {
      // Navegação privada ou armazenamento bloqueado: vale só até recarregar.
    }
    window.dispatchEvent(new Event(CONTRAST_CHANGE_EVENT));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={active}
      aria-label="Alto contraste"
      title={active ? 'Desativar alto contraste' : 'Ativar alto contraste'}
      className={className}
    >
      <Contrast size={22} aria-hidden="true" />
    </button>
  );
}
