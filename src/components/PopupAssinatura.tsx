'use client';

import { useState, useEffect, useRef } from 'react';

export default function PopupAssinatura() {
  const [shouldShow, setShouldShow] = useState(false);
  const [open, setOpen] = useState(false);
  const [cardStyle, setCardStyle] = useState<React.CSSProperties>({});
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let hasShown = false;
    
    // Scroll mínimo necessário (200px)
    const MINIMUM_SCROLL = 200;

    // Timer de 30 segundos - dispara independentemente do scroll
    timeoutId = setTimeout(() => {
      if (!hasShown) {
        setShouldShow(true);
        setOpen(true);
        hasShown = true;
      }
    }, 3000);

    // Detectar scroll
    const handleScroll = () => {
      if (hasShown) return;

      // Se o usuário scrollou o mínimo (200px) OU chegou até a sessão 2
      if (window.scrollY >= MINIMUM_SCROLL || window.scrollY > window.innerHeight * 0.5) {
        setShouldShow(true);
        setOpen(true);
        hasShown = true;
        clearTimeout(timeoutId);
      }
    };

    window.addEventListener('scroll', handleScroll);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    const updateCardSize = () => {
      const isDesktop = window.innerWidth >= 768;
      
      if (isDesktop) {
        // Proporção da imagem: 1024 / 1536 = 0.6667
        const ratio = 1024 / 1536;
        const maxHeight = window.innerHeight * 0.9; // 90vh
        const calculatedWidth = maxHeight * ratio;
        
        setCardStyle({
          position: 'relative',
          width: calculatedWidth,
          height: maxHeight,
          borderRadius: 16,
          overflow: 'hidden',
          backgroundImage: 'url(/images/pop-up-assinatura.jpeg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        });
      } else {
        // Mobile: mantém o comportamento original
        setCardStyle({
          position: 'relative',
          width: '100%',
          maxWidth: 520,
          aspectRatio: '1024 / 1536',
          maxHeight: '90vh',
          borderRadius: 16,
          overflow: 'hidden',
          backgroundImage: 'url(/images/pop-up-assinatura.jpeg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        });
      }
    };

    updateCardSize();
    window.addEventListener('resize', updateCardSize);
    return () => window.removeEventListener('resize', updateCardSize);
  }, []);

  // Bloquear scroll do body quando o popup estiver aberto
  useEffect(() => {
    if (open) {
      // Salva a posição atual do scroll
      const scrollY = window.scrollY;
      
      // Bloqueia o scroll
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      
      return () => {
        // Restaura o scroll quando o popup fechar
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [open]);

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
        Modal "caixa" com proporção calculada dinamicamente no desktop.
        No desktop: largura = 90vh × (1024/1536) para manter a proporção exata.
        No mobile: mantém o comportamento com aspect-ratio.
      */}
      <div
        ref={cardRef}
        onClick={(e) => e.stopPropagation()}
        style={cardStyle}
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
