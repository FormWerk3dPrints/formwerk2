"use client";

import { siWhatsapp } from "simple-icons/icons";
import { useEffect, useState } from "react";

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

  useEffect(() => {
    const footer =
      document.getElementById(FOOTER_ID) ??
      (document.querySelector("footer") as HTMLElement | null);

    if (!footer) return;

    const observer = new IntersectionObserver(
      (entries) => {
        setIsHidden(entries.some((entry) => entry.isIntersecting));
      },
      {
        threshold: 0.01,
      },
    );

    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  return (
    <a
      href={WHATSAPP_WA_ME_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Abrir WhatsApp para (55) 49 99159142"
      aria-hidden={isHidden ? true : undefined}
      tabIndex={isHidden ? -1 : undefined}
      className={`fixed bottom-4 right-4 z-50 inline-flex h-20 w-20 items-center justify-center rounded-full bg-green-500 text-white transition-all duration-200 hover:bg-green-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-300 ${
        isHidden ? "pointer-events-none opacity-0 scale-95" : "opacity-100 scale-100"
      }`}
    >
      <span className="sr-only">WhatsApp</span>
      <SimpleIcon icon={siWhatsapp} className="h-10 w-10" />
    </a>
  );
}
