"use client";

import { siWhatsapp } from "simple-icons/icons";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type SimpleIconData = {
  title: string;
  path: string;
};

function SimpleIcon({
  icon,
  className,
}: {
  icon: SimpleIconData;
  className?: string;
}) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <title>{icon.title}</title>
      <path d={icon.path} />
    </svg>
  );
}

const WHATSAPP_WA_ME_URL = "https://wa.me/554999159142";
const FOOTER_ID = "site-footer";

export default function FloatingWhatsApp() {
  const [isHidden, setIsHidden] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // O Footer é montado/desmontado ao trocar de rota (ele está dentro das pages),
    // então precisamos re-ligar o observer sempre que a rota mudar.
    setIsHidden(false);

    let cancelled = false;
    let observer: IntersectionObserver | null = null;

    const attach = () => {
      const footer =
        document.getElementById(FOOTER_ID) ??
        (document.querySelector("footer") as HTMLElement | null);

      if (!footer || cancelled) return;

      observer = new IntersectionObserver(
        (entries) => {
          setIsHidden(entries.some((entry) => entry.isIntersecting));
        },
        {
          threshold: 0.01,
        },
      );

      observer.observe(footer);
    };

    // Aguarda o DOM atualizar após navegação.
    const raf = requestAnimationFrame(attach);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      observer?.disconnect();
      observer = null;
    };
  }, [pathname]);

  return (
    <a
      href={WHATSAPP_WA_ME_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Abrir WhatsApp para (55) 49 99159142"
      aria-hidden={isHidden ? true : undefined}
      tabIndex={isHidden ? -1 : undefined}
      className={`whatsapp-shake-10s fixed bottom-4 right-4 z-50 inline-flex h-20 w-20 items-center justify-center rounded-full bg-green-500 text-white shadow-lg transition-all duration-300 hover:bg-green-600 hover:shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-green-300 ${
        isHidden ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <span className="sr-only">WhatsApp</span>
      <SimpleIcon icon={siWhatsapp} className="h-10 w-10" />
    </a>
  );
}
