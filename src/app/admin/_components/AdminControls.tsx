import type { ReactNode } from 'react';

const ICON_BUTTON_TONES = {
  default: 'hover:text-gray-900',
  info: 'hover:text-blue-600',
  danger: 'hover:text-red-600',
} as const;

/**
 * Botão só de ícone das listas do admin. Tem 40px no celular, o mínimo
 * razoável para acertar com o dedo, e volta a 32px a partir de `sm`.
 */
export function AdminIconButton({
  label,
  onClick,
  tone = 'default',
  children,
}: {
  label: string;
  onClick: () => void;
  tone?: keyof typeof ICON_BUTTON_TONES;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 sm:h-8 sm:w-8 ${ICON_BUTTON_TONES[tone]}`}
    >
      {children}
    </button>
  );
}

export function StatusPill({
  active,
  activeLabel = 'Ativo',
  inactiveLabel = 'Inativo',
}: {
  active: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
}) {
  return (
    <span
      className={`inline-block shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
        active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
      }`}
    >
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}
