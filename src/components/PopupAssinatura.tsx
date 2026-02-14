'use client';

import { useState } from 'react';

export default function PopupAssinatura() {
  const [open, setOpen] = useState(true);

  if (!open) return null;

  return (
    /* Overlay escuro — clicar fora fecha */
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.70)',
        padding: 16,
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Pop-up de assinatura"
      onClick={() => setOpen(false)}
    >
      {/*
        Modal "caixa" com aspect-ratio fixo 2:3 (1024×1536).
        O X é posicionado relativo a este contêiner, não à imagem.
        A imagem é background-image → não injeta nenhum wrapper extra.
      */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 520,
          aspectRatio: '1024 / 1536',
          maxHeight: '90vh',
          borderRadius: 16,
          overflow: 'hidden',
          backgroundImage: 'url(/images/557d0ded-6646-4426-97dd-109497b63568-wm.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Botão X — posição fixa dentro da caixa modal */}
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Fechar pop-up"
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            width: 36,
            height: 36,
            borderRadius: '50%',
            backgroundColor: 'rgba(0,0,0,0.55)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
