"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

// A cena traz o Three.js junto (126 KB comprimidos). Como o rodapé existe em
// todas as páginas, o import fica à parte e só acontece quando ele se aproxima.
const AnimatedBackground3 = dynamic(() => import("./AnimatedBackground3"), {
  ssr: false,
});

/** Fundo 3D do rodapé, montado apenas quando o rodapé chega perto da tela. */
export default function FooterBackground() {
  const ref = useRef<HTMLDivElement>(null);
  const [perto, setPerto] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPerto(true);
          io.disconnect();
        }
      },
      // Uma tela de antecedência, para a cena já estar pronta quando aparecer.
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="absolute inset-0 z-0 pointer-events-none scale-75 md:scale-100 origin-center"
    >
      {perto && <AnimatedBackground3 />}
    </div>
  );
}
