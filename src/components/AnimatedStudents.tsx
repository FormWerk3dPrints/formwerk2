'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { firestoreDb } from '@/lib/firebase/client';

interface Props {
  count?: number;
}

interface KitPreview {
  id: string;
  name: string;
  imageUrl: string;
}

const FALLBACK_PALETTE = [
  '#FF6B6B', '#FF8E53', '#FFC300', '#51CF66', '#22B5D2',
  '#339AF0', '#CC5DE8', '#F06595', '#20C997', '#FF6348',
  '#5C7CFA', '#94D82D', '#FFA94D', '#4DABF7', '#DA77F2',
  '#FA5252', '#38D9A9', '#74C0FC', '#F783AC', '#8CE99A',
];

const CELL = 21;
const GAP = 2;
const ROWS = 13;
const STRIDE = CELL + GAP; // 23
const SPEED = 0.5; // px per frame

/**
 * Pre-builds a flat color-index grid [col * ROWS + row].
 * Guarantees no two horizontally adjacent cells in the same row share a color,
 * including the tile-wrap seam (last col -> first col).
 */
function buildColorGrid(cols: number, paletteLen: number): number[] {
  const grid = new Array<number>(cols * ROWS).fill(0);
  const safe = Math.max(paletteLen, 2);

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < cols; col++) {
      const h = (Math.imul(col, 2654435761) ^ Math.imul(row, 40503)) >>> 0;
      let idx = h % safe;
      // Avoid same color as left neighbour
      if (col > 0 && idx === grid[(col - 1) * ROWS + row]) {
        idx = (idx + 1) % safe;
      }
      grid[col * ROWS + row] = idx;
    }
    // Fix seam: col 0 must differ from col (cols-1)
    if (grid[0 * ROWS + row] === grid[(cols - 1) * ROWS + row]) {
      let fixed = (grid[0 * ROWS + row] + 1) % safe;
      // Also keep it different from col 1
      if (cols > 1 && fixed === grid[1 * ROWS + row]) fixed = (fixed + 1) % safe;
      grid[0 * ROWS + row] = fixed;
    }
  }
  return grid;
}

function drawAvatar(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, img: HTMLImageElement | null) {
  // Colored background
  ctx.fillStyle = color;
  ctx.fillRect(x, y, CELL, CELL);

  // Subtle gradient overlay for depth
  const grad = ctx.createLinearGradient(x, y, x, y + CELL);
  grad.addColorStop(0, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, CELL, CELL);

  // White SVG icon centered with padding
  if (img) {
    const pad = CELL * 0.15;
    ctx.drawImage(img, x + pad, y + pad, CELL - pad * 2, CELL - pad * 2);
  }
}

export default function AnimatedStudents({ count = 1250 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const stateRef = useRef({ running: false, offset: 0 });
  const paletteRef = useRef<string[]>(FALLBACK_PALETTE);
  const colorGridRef = useRef<number[]>([]);
  const colsRef = useRef(0);
  const avatarImgRef = useRef<HTMLImageElement | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [started, setStarted] = useState(false);
  const [kits, setKits] = useState<KitPreview[]>([]);
  const [activeKit, setActiveKit] = useState(0);
  const [activeText, setActiveText] = useState(0);
  const slideContainerRef = useRef<HTMLDivElement>(null);
  const textDiv0Ref = useRef<HTMLDivElement>(null);
  const textDiv1Ref = useRef<HTMLDivElement>(null);
  const textSpan0Ref = useRef<HTMLSpanElement>(null);
  const textSpan1Ref = useRef<HTMLSpanElement>(null);
  const [textFontSizes, setTextFontSizes] = useState<[number, number]>([16, 14]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    const syncMobile = (matches: boolean) => setIsMobile(matches);

    syncMobile(media.matches);
    const handleChange = (event: MediaQueryListEvent) => syncMobile(event.matches);
    media.addEventListener('change', handleChange);

    return () => media.removeEventListener('change', handleChange);
  }, []);

  // Trigger slide-in when section enters viewport
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Load user.svg with white fill as a reusable image
  useEffect(() => {
    const svgSrc = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none">
      <path d="M8 7C9.65685 7 11 5.65685 11 4C11 2.34315 9.65685 1 8 1C6.34315 1 5 2.34315 5 4C5 5.65685 6.34315 7 8 7Z" fill="white"/>
      <path d="M14 12C14 10.3431 12.6569 9 11 9H5C3.34315 9 2 10.3431 2 12V15H14V12Z" fill="white"/>
    </svg>`;
    const blob = new Blob([svgSrc], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      avatarImgRef.current = img;
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, []);

  // Fetch kits for carousel
  useEffect(() => {
    getDocs(query(collection(firestoreDb, 'kits'), where('active', '==', true)))
      .then((snap) => {
        const items: KitPreview[] = snap.docs
          .map((d) => {
            const data = d.data();
            const imageUrls = Array.isArray(data.imageUrls)
              ? (data.imageUrls as string[]).filter(Boolean)
              : [];
            const imageUrl =
              typeof data.mainImageUrl === 'string' && data.mainImageUrl
                ? data.mainImageUrl
                : imageUrls[0] ?? '';
            return { id: d.id, name: typeof data.name === 'string' ? data.name : '', imageUrl };
          })
          .filter((k) => k.imageUrl);
        setKits(items);
      })
      .catch(() => {});
  }, []);

  // Auto-rotate kit carousel
  useEffect(() => {
    if (kits.length <= 1) return;
    const id = setInterval(() => setActiveKit((prev) => (prev + 1) % kits.length), 3500);
    return () => clearInterval(id);
  }, [kits.length]);

  // Auto-rotate text carousel (mobile)
  useEffect(() => {
    const id = setInterval(() => setActiveText((prev) => (prev + 1) % 2), 4000);
    return () => clearInterval(id);
  }, []);

  // Fit text to fill left card on mobile
  useEffect(() => {
    if (!isMobile) return;

    let rafId: number;

    const fitAll = () => {
      const container = slideContainerRef.current;
      const div0 = textDiv0Ref.current;
      const div1 = textDiv1Ref.current;
      const span0 = textSpan0Ref.current;
      const span1 = textSpan1Ref.current;
      if (!container || !div0 || !div1 || !span0 || !span1) return;
      const maxH = container.clientHeight - 32; // p-4 top + bottom
      if (maxH <= 0) return;

      const fitSpan = (span: HTMLSpanElement, div: HTMLDivElement): number => {
        const maxW = div.getBoundingClientRect().width;
        let lo = 10, hi = 90;
        while (lo < hi - 1) {
          const mid = (lo + hi) >> 1;
          span.style.fontSize = mid + 'px';
          // clientHeight: altura real do texto quebrado (auto-height div)
          // getBoundingClientRect().width: detecta overflow horizontal (ex: &nbsp; indivisível)
          const fits = div.clientHeight <= maxH && span.getBoundingClientRect().width <= maxW + 1;
          if (fits) lo = mid; else hi = mid;
        }
        span.style.fontSize = '';
        return lo;
      };

      setTextFontSizes([fitSpan(span0, div0), fitSpan(span1, div1)]);
    };

    // Double rAF: garante que o layout já está completo antes de medir
    rafId = requestAnimationFrame(() => { rafId = requestAnimationFrame(fitAll); });

    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(fitAll);
    });
    if (slideContainerRef.current) ro.observe(slideContainerRef.current);

    return () => { cancelAnimationFrame(rafId); ro.disconnect(); };
  }, [isMobile]);

  // Fetch category colors from Firestore
  useEffect(() => {
    getDocs(query(collection(firestoreDb, 'categories'), where('active', '==', true)))
      .then((snap) => {
        const colors = snap.docs
          .map((doc) => doc.data().color)
          .filter((c): c is string => typeof c === 'string' && c.trim().length > 0);
        if (colors.length > 0) {
          paletteRef.current = colors;
          // Rebuild grid with new palette if size already known
          if (colsRef.current > 0) {
            colorGridRef.current = buildColorGrid(colsRef.current, colors.length);
          }
        }
      })
      .catch(() => {
        // keep fallback palette
      });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = stateRef.current;
    state.running = true;
    state.offset = 0;

    let rafId: number;
    let cssW = 0;
    let cssH = 0;
    let colsPerTile = 0;
    let tileWidth = 0;

    const syncSize = () => {
      cssW = canvas.offsetWidth;
      cssH = canvas.offsetHeight;
      if (cssW === 0 || cssH === 0) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      colsPerTile = Math.ceil(cssW / STRIDE) + 2;
      tileWidth = colsPerTile * STRIDE;
      colsRef.current = colsPerTile;
      colorGridRef.current = buildColorGrid(colsPerTile, paletteRef.current.length);
    };

    const draw = () => {
      if (!state.running) return;

      // White background so gaps between cells appear white
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cssW, cssH);

      const totalGridH = ROWS * STRIDE - GAP;
      const startY = (cssH - totalGridH) / 2;

      // Draw two tiles side-by-side for seamless infinite scroll
      for (let tile = 0; tile < 2; tile++) {
        for (let col = 0; col < colsPerTile; col++) {
          const x = tile * tileWidth + col * STRIDE - state.offset;
          if (x + CELL < 0 || x > cssW) continue; // skip fully offscreen columns

          for (let row = 0; row < ROWS; row++) {
            const palette = paletteRef.current;
            const colorIdx = colorGridRef.current[col * ROWS + row] ?? 0;
            const y = startY + row * STRIDE;
            drawAvatar(ctx, x, y, palette[colorIdx % palette.length], avatarImgRef.current);
          }
        }
      }

      state.offset += SPEED;
      if (state.offset >= tileWidth) {
        state.offset -= tileWidth;
      }

      rafId = requestAnimationFrame(draw);
    };

    syncSize();
    draw();

    const ro = new ResizeObserver(() => {
      syncSize();
    });
    ro.observe(canvas);

    return () => {
      state.running = false;
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  const formatted = count.toLocaleString('pt-BR');

  const gridHeight = ROWS * STRIDE - GAP;
  const sectionH = gridHeight + (isMobile ? 0 : 64);
  const mobileTextHighlightStyle = {
    background: 'linear-gradient(135deg, #0D6AA7 0%, #1278BC 52%, #0A5B8F 100%)',
    padding: '0.12em 0.34em',
    boxShadow: '0 8px 24px 0 rgba(13,106,167,0.28)',
    WebkitBoxDecorationBreak: 'clone' as const,
    boxDecorationBreak: 'clone' as const,
  };

  return (
    <section ref={sectionRef} className="relative bg-gray-50 overflow-hidden" style={{ padding: '0' }}>
      {/* Full-bleed canvas band */}
      <div
        className="relative left-1/2 w-screen -translate-x-1/2"
        style={{ height: `${sectionH}px` }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full block"
        />

        {/* Edge fade — apenas desktop */}
        <div
          className="hidden lg:block absolute inset-y-0 left-0 w-24 pointer-events-none"
          style={{
            background: 'linear-gradient(to right, #f9fafb, transparent)',
          }}
        />
        <div
          className="hidden lg:block absolute inset-y-0 right-0 w-24 pointer-events-none"
          style={{
            background: 'linear-gradient(to left, #f9fafb, transparent)',
          }}
        />

        {/* ── MOBILE / TABLET layout (< lg) ── dois cards iguais flutuando sobre o canvas */}
        <div className="lg:hidden absolute inset-x-0 top-7 bottom-3 flex gap-3 px-4 pointer-events-none">

          {/* Card esquerdo: carrossel de frases */}
          <div
            className={`w-1/2 flex flex-col items-center justify-center transition-all duration-700 ease-out ${
              started ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            {/* Área dos slides — flex-1 para ocupar o espaço disponível */}
            <div ref={slideContainerRef} className="relative w-full flex-1 overflow-hidden">
              {/* Slide 0 — estudantes */}
              <div
                className="absolute inset-0 flex flex-col items-center justify-center p-4 transition-opacity duration-700"
                style={{ opacity: activeText === 0 ? 1 : 0 }}
              >
                <div ref={textDiv0Ref} className="text-center w-full">
                  <span
                    ref={textSpan0Ref}
                    className="text-white font-bold leading-snug select-none"
                    style={{ ...mobileTextHighlightStyle, fontSize: textFontSizes[0] }}
                  >
                    Somamos&nbsp;<span className="font-extrabold">{formatted}</span><br />estudantes impactados!
                  </span>
                </div>
              </div>

              {/* Slide 1 — frase */}
              <div
                className="absolute inset-0 flex flex-col items-center justify-center p-4 transition-opacity duration-700"
                style={{ opacity: activeText === 1 ? 1 : 0 }}
              >
                <div ref={textDiv1Ref} className="text-center w-full">
                  <span
                    ref={textSpan1Ref}
                    className="text-white font-extrabold leading-snug select-none"
                    style={{ ...mobileTextHighlightStyle, fontSize: textFontSizes[1] }}
                  >
                    Transformamos o aprendizado teórico em experiência prática e interativa para professores e alunos.
                  </span>
                </div>
              </div>
            </div>

            {/* Dots do carrossel de texto */}
            <div className="flex justify-center gap-1.5 pb-3 flex-shrink-0 pointer-events-auto">
              {[0, 1].map((i) => (
                <button
                  key={i}
                  onClick={() => setActiveText(i)}
                  className="w-2 h-2 rounded-full transition-opacity"
                  style={{ backgroundColor: 'white', opacity: i === activeText ? 1 : 0.4 }}
                />
              ))}
            </div>
          </div>

          {/* Card direito: kits — sempre visível */}
          <div
            className={`w-1/2 flex flex-col rounded-2xl overflow-hidden transition-all duration-700 ease-out ${
              started ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
            style={{
              background: 'linear-gradient(135deg, #0D6AA7 0%, #1278BC 52%, #0A5B8F 100%)',
              boxShadow: '0 8px 32px 0 rgba(13,106,167,0.35)',
              transitionDelay: '120ms',
            }}
          >
            <div className="flex flex-col flex-1 p-3 overflow-hidden text-white select-none">
              <span className="text-xs font-bold opacity-80 mb-2 tracking-wide uppercase flex-shrink-0">
                Conheça nossos Kits:
              </span>

              {/* Imagem do kit — ocupa o espaço restante */}
              <div className="relative flex-1 overflow-hidden rounded mb-2">
                {kits.map((kit, i) => (
                  <div
                    key={kit.id}
                    className="absolute inset-0 transition-opacity duration-700"
                    style={{ opacity: i === activeKit ? 1 : 0 }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={kit.imageUrl} alt={kit.name} className="absolute inset-0 w-full h-full object-cover" />
                  </div>
                ))}
              </div>

              {/* Nome do kit */}
              <span className="text-xs font-bold leading-tight mb-1.5 flex-shrink-0 truncate">
                {kits[activeKit]?.name ?? ''}
              </span>

              {/* Dots dos kits */}
              <div className="flex gap-1 mb-2 flex-shrink-0" style={{ height: 10 }}>
                {kits.length > 1 && kits.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveKit(i)}
                    className="w-1.5 h-1.5 rounded-full pointer-events-auto transition-opacity"
                    style={{ backgroundColor: 'white', opacity: i === activeKit ? 1 : 0.35 }}
                  />
                ))}
              </div>

              <Link
                href="/kits"
                className="pointer-events-auto text-center bg-white font-extrabold rounded-lg py-1.5 text-xs transition-transform duration-200 hover:scale-105 flex-shrink-0"
                style={{ color: '#0D6AA7' }}
              >
                Ver Kits →
              </Link>
            </div>
          </div>
        </div>

        {/* ── DESKTOP layout (lg+) ── three absolute overlays */}

        {/* Left overlay — slides in from the left */}
        <div className="hidden lg:flex absolute inset-y-0 left-0 right-0 overflow-hidden items-start pointer-events-none">
          <span
            className={`inline font-bold text-white text-xl md:text-3xl leading-tight select-none transition-all duration-700 ease-out ${
              started ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'
            }`}
            style={{
              background: 'linear-gradient(135deg, #0D6AA7 0%, #1278BC 52%, #0A5B8F 100%)',
              padding: '8px 28px 32px 28px',
              boxShadow: '0 6px 24px 0 rgba(13,106,167,0.22)',
              marginTop: 54,
              WebkitBoxDecorationBreak: 'clone',
              boxDecorationBreak: 'clone',
              lineHeight: 1.18,
            }}
          >
            Somamos&nbsp;<span className="font-extrabold">{formatted}</span><br />estudantes impactados!
          </span>
        </div>

        {/* Center overlay — phrase */}
        <div className="hidden lg:flex absolute inset-0 items-center justify-center pointer-events-none px-4">
          <p
            className={`text-center font-extrabold text-white text-lg md:text-2xl leading-snug select-none transition-all duration-1000 ease-out max-w-xs md:max-w-sm ${
              started ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
            style={{
              background: 'linear-gradient(135deg, #0D6AA7 0%, #1278BC 52%, #0A5B8F 100%)',
              padding: '14px 22px',
              boxShadow: '0 6px 24px 0 rgba(13,106,167,0.22)',
              lineHeight: 1.3,
              transitionDelay: '200ms',
            }}
          >
            Transformamos o aprendizado teórico em
              experiência prática e interativa
            para professores e alunos.
          </p>
        </div>

        {/* Right overlay — Kit carousel */}
        <div className="hidden lg:flex absolute inset-y-0 left-0 right-0 overflow-hidden items-start justify-end pointer-events-none">
          <div
            className={`flex flex-col text-white select-none transition-all duration-700 ease-out ${
              started ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
            }`}
            style={{
              background: 'linear-gradient(135deg, #0D6AA7 0%, #1278BC 52%, #0A5B8F 100%)',
              padding: '12px 24px 16px 24px',
              boxShadow: '0 6px 24px 0 rgba(13,106,167,0.22)',
              marginTop: 30,
              lineHeight: 1.18,
              width: 260,
              height: 310,
              overflow: 'hidden',
            }}
          >
            <span className="text-xs md:text-sm font-bold opacity-80 mb-2 tracking-wide uppercase flex-shrink-0">
              Conheça nossos Kits:
            </span>

            <div className="relative w-full overflow-hidden rounded flex-shrink-0 mb-2" style={{ height: 148 }}>
              {kits.map((kit, i) => (
                <div
                  key={kit.id}
                  className="absolute inset-0 transition-opacity duration-700"
                  style={{ opacity: i === activeKit ? 1 : 0 }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={kit.imageUrl}
                    alt={kit.name}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>

            <span
              className="text-base font-bold leading-tight mb-2 flex-shrink-0 truncate"
              style={{ height: '1.5rem' }}
            >
              {kits[activeKit]?.name ?? ''}
            </span>

            <div className="flex gap-1.5 mb-3 flex-shrink-0" style={{ height: 12 }}>
              {kits.length > 1 && kits.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveKit(i)}
                  className="w-2 h-2 rounded-full pointer-events-auto transition-opacity"
                  style={{ backgroundColor: 'white', opacity: i === activeKit ? 1 : 0.35 }}
                />
              ))}
            </div>

            <div className="flex-1" />

            <Link
              href="/kits"
              className="pointer-events-auto text-center bg-white font-extrabold rounded py-2 px-6 text-base transition-transform duration-200 hover:scale-105 flex-shrink-0"
              style={{ color: '#0D6AA7' }}
            >
              Ver Kits →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
