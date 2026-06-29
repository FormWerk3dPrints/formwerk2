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
const STRIDE = CELL + GAP;
const SPEED = 0.5;

function buildColorGrid(cols: number, rows: number, paletteLen: number): number[] {
  const grid = new Array<number>(cols * rows).fill(0);
  const safe = Math.max(paletteLen, 2);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const h = (Math.imul(col, 2654435761) ^ Math.imul(row, 40503)) >>> 0;
      let idx = h % safe;
      if (col > 0 && idx === grid[(col - 1) * rows + row]) {
        idx = (idx + 1) % safe;
      }
      grid[col * rows + row] = idx;
    }
    if (grid[0 * rows + row] === grid[(cols - 1) * rows + row]) {
      let fixed = (grid[0 * rows + row] + 1) % safe;
      if (cols > 1 && fixed === grid[1 * rows + row]) fixed = (fixed + 1) % safe;
      grid[0 * rows + row] = fixed;
    }
  }
  return grid;
}

function drawAvatar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  img: HTMLImageElement | null,
) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, CELL, CELL);

  const grad = ctx.createLinearGradient(x, y, x, y + CELL);
  grad.addColorStop(0, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, CELL, CELL);

  if (img) {
    const pad = CELL * 0.15;
    ctx.drawImage(img, x + pad, y + pad, CELL - pad * 2, CELL - pad * 2);
  }
}

const BLUE_GRADIENT = 'linear-gradient(135deg, #0D6AA7 0%, #1278BC 52%, #0A5B8F 100%)';
const BLUE_SHADOW = '0 8px 24px 0 rgba(13,106,167,0.28)';

export default function AnimatedStudents({ count = 1250 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const stateRef = useRef({ running: false, offset: 0 });
  const paletteRef = useRef<string[]>(FALLBACK_PALETTE);
  const colorGridRef = useRef<number[]>([]);
  const colsRef = useRef(0);
  const rowsRef = useRef(0);
  const avatarImgRef = useRef<HTMLImageElement | null>(null);
  const [started, setStarted] = useState(false);
  const [kits, setKits] = useState<KitPreview[]>([]);
  const [activeKit, setActiveKit] = useState(0);

  // Trigger entrance animation when section enters viewport
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
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Load user SVG icon
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

  // Fetch active kits for carousel
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
            return {
              id: d.id,
              name: typeof data.name === 'string' ? data.name : '',
              imageUrl,
            };
          })
          .filter((k) => k.imageUrl);
        setKits(items);
      })
      .catch(() => {});
  }, []);

  // Auto-rotate kit images
  useEffect(() => {
    if (kits.length <= 1) return;
    const id = setInterval(() => setActiveKit((prev) => (prev + 1) % kits.length), 3500);
    return () => clearInterval(id);
  }, [kits.length]);

  // Fetch category colors
  useEffect(() => {
    getDocs(query(collection(firestoreDb, 'categories'), where('active', '==', true)))
      .then((snap) => {
        const colors = snap.docs
          .map((doc) => doc.data().color)
          .filter((c): c is string => typeof c === 'string' && c.trim().length > 0);
        if (colors.length > 0) {
          paletteRef.current = colors;
          if (colsRef.current > 0) {
            colorGridRef.current = buildColorGrid(
              colsRef.current,
              rowsRef.current,
              colors.length,
            );
          }
        }
      })
      .catch(() => {});
  }, []);

  // Canvas animation — rows computed dynamically from canvas height
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
    let rowsCount = 0;
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
      rowsCount = Math.ceil(cssH / STRIDE) + 1;
      tileWidth = colsPerTile * STRIDE;
      colsRef.current = colsPerTile;
      rowsRef.current = rowsCount;
      colorGridRef.current = buildColorGrid(colsPerTile, rowsCount, paletteRef.current.length);
    };

    const draw = () => {
      if (!state.running) return;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cssW, cssH);

      for (let tile = 0; tile < 2; tile++) {
        for (let col = 0; col < colsPerTile; col++) {
          const x = tile * tileWidth + col * STRIDE - state.offset;
          if (x + CELL < 0 || x > cssW) continue;

          for (let row = 0; row < rowsCount; row++) {
            const palette = paletteRef.current;
            const colorIdx = colorGridRef.current[col * rowsCount + row] ?? 0;
            const y = row * STRIDE;
            drawAvatar(ctx, x, y, palette[colorIdx % palette.length], avatarImgRef.current);
          }
        }
      }

      state.offset += SPEED;
      if (state.offset >= tileWidth) state.offset -= tileWidth;
      rafId = requestAnimationFrame(draw);
    };

    syncSize();
    draw();

    const ro = new ResizeObserver(() => syncSize());
    ro.observe(canvas);

    return () => {
      state.running = false;
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  const formatted = count.toLocaleString('pt-BR');

  return (
    <section
      ref={sectionRef}
      className="relative bg-white overflow-hidden min-h-[420px] lg:h-[50dvh]"
    >
      {/* Full-bleed canvas background */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

      {/* Edge fades — desktop only */}
      <div
        className="hidden lg:block absolute inset-y-0 left-0 w-32 pointer-events-none z-10"
        style={{ background: 'linear-gradient(to right, #ffffff, transparent)' }}
      />
      <div
        className="hidden lg:block absolute inset-y-0 right-0 w-32 pointer-events-none z-10"
        style={{ background: 'linear-gradient(to left, #ffffff, transparent)' }}
      />

      {/* ── MOBILE layout (< lg): texts left (column), square kits card right ── */}
      <div className="lg:hidden absolute inset-0 flex flex-row gap-3 p-4 z-20">

        {/* Left column: count + mission stacked */}
        <div className="flex flex-col gap-3 flex-1 min-w-0">
          {/* Students count */}
          <div
            className={`flex-1 flex items-center justify-center rounded-2xl p-3 transition-all duration-700 ease-out hover:opacity-80 hover:duration-200 ${
              started ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
            }`}
            style={{ background: BLUE_GRADIENT, boxShadow: BLUE_SHADOW }}
          >
            <p className="text-white font-bold text-center leading-snug select-none text-sm">
              Somamos&nbsp;<span className="font-extrabold">{formatted}</span>
              <br />estudantes impactados!
            </p>
          </div>

          {/* Mission */}
          <div
            className={`flex-1 flex items-center justify-center rounded-2xl p-3 transition-all duration-700 ease-out hover:opacity-80 hover:duration-200 ${
              started ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
            }`}
            style={{
              background: BLUE_GRADIENT,
              boxShadow: BLUE_SHADOW,
              transitionDelay: '100ms',
            }}
          >
            <p className="text-white font-extrabold text-center leading-snug select-none text-xs">
              Transformamos o aprendizado teórico em experiência prática e interativa para
              professores e alunos.
            </p>
          </div>
        </div>

        {/* Right column: kits + ESG */}
        <div
          className={`flex flex-col gap-3 flex-shrink-0 transition-all duration-700 ease-out ${
            started ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
          }`}
          style={{ width: 'calc(50% - 6px)', transitionDelay: '200ms' }}
        >
          {/* Kits card */}
          <div
            className="flex-[2] flex flex-col rounded-2xl overflow-hidden"
            style={{ background: BLUE_GRADIENT, boxShadow: BLUE_SHADOW }}
          >
            <div className="flex flex-col h-full p-3 text-white select-none">
              <span className="text-xs font-bold opacity-80 mb-1.5 tracking-wide uppercase flex-shrink-0">
                Nossos Kits:
              </span>

              <div className="relative flex-1 overflow-hidden rounded mb-1.5">
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

              <div className="flex gap-1 mb-1.5 flex-shrink-0">
                {kits.length > 1 &&
                  kits.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveKit(i)}
                      className="w-1.5 h-1.5 rounded-full transition-opacity"
                      style={{ backgroundColor: 'white', opacity: i === activeKit ? 1 : 0.35 }}
                    />
                  ))}
              </div>

              <Link
                href="/kits"
                className="text-center bg-white font-extrabold rounded-lg py-1.5 text-xs transition-transform duration-200 hover:scale-105 flex-shrink-0"
                style={{ color: '#0D6AA7' }}
              >
                Ver Kits →
              </Link>
            </div>
          </div>

          {/* ESG card */}
          <Link
            href="/sobre"
            className="group flex-1 flex items-center justify-center rounded-2xl p-3 transition-opacity duration-200 hover:opacity-80"
            style={{ background: BLUE_GRADIENT, boxShadow: BLUE_SHADOW }}
          >
            <p className="text-white font-bold text-center leading-snug select-none text-xs group-hover:underline">
              A Formwerk adota práticas alinhadas aos princípios ESG.
            </p>
          </Link>
        </div>
      </div>

      {/* ── DESKTOP layout (lg+): three cards in a horizontal row ── */}
      <div className="hidden lg:flex absolute inset-0 items-stretch justify-between gap-8 z-20 pointer-events-none">
        {/* Left: two-card column (students count + ESG) */}
        <div
          className={`flex flex-col gap-2 flex-shrink-0 pointer-events-auto transition-all duration-700 ease-out ${
            started ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-16'
          }`}
          style={{ width: 300 }}
        >
          <div
            className="flex-1 flex flex-col items-center justify-center p-8 transition-opacity duration-200 hover:opacity-80"
            style={{ background: BLUE_GRADIENT, boxShadow: BLUE_SHADOW }}
          >
            <p className="text-white font-bold text-center text-2xl xl:text-3xl leading-snug select-none">
              Somamos&nbsp;<span className="font-extrabold">{formatted}</span>
              <br />estudantes impactados!
            </p>
          </div>
          <Link
            href="/sobre"
            className="group flex-1 flex items-center justify-center p-8 pointer-events-auto transition-opacity duration-200 hover:opacity-80"
            style={{ background: BLUE_GRADIENT, boxShadow: BLUE_SHADOW }}
          >
            <p className="text-white font-bold text-center text-base xl:text-lg leading-snug select-none group-hover:underline">
              A Formwerk adota práticas alinhadas aos princípios ESG.
            </p>
          </Link>
        </div>

        {/* Center: mission */}
        <div
          className={`flex-1 flex items-center justify-center transition-all duration-1000 ease-out ${
            started ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          }`}
          style={{ transitionDelay: '200ms' }}
        >
          <p
            className="text-center font-extrabold text-white text-xl xl:text-2xl leading-snug select-none p-8 pointer-events-auto transition-opacity duration-200 hover:opacity-80"
            style={{ background: BLUE_GRADIENT, boxShadow: BLUE_SHADOW, maxWidth: 420 }}
          >
            Transformamos o aprendizado teórico em experiência prática e interativa para
            professores e alunos.
          </p>
        </div>

        {/* Right: kits carousel */}
        <div
          className={`flex flex-col overflow-hidden flex-shrink-0 pointer-events-auto transition-all duration-700 ease-out ${
            started ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-16'
          }`}
          style={{
            background: BLUE_GRADIENT,
            boxShadow: BLUE_SHADOW,
            width: 300,
            transitionDelay: '120ms',
          }}
        >
          <div className="flex flex-col h-full p-5 text-white select-none">
            <span className="text-sm font-bold opacity-80 mb-2 tracking-wide uppercase flex-shrink-0">
              Conheça nossos Kits:
            </span>

            <div className="relative flex-1 overflow-hidden rounded mb-3">
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
              style={{ minHeight: '1.5rem' }}
            >
              {kits[activeKit]?.name ?? ''}
            </span>

            <div className="flex gap-1.5 mb-3 flex-shrink-0" style={{ minHeight: 12 }}>
              {kits.length > 1 &&
                kits.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveKit(i)}
                    className="w-2 h-2 rounded-full pointer-events-auto transition-opacity"
                    style={{ backgroundColor: 'white', opacity: i === activeKit ? 1 : 0.35 }}
                  />
                ))}
            </div>

            <Link
              href="/kits"
              className="pointer-events-auto text-center bg-white font-extrabold rounded-lg py-2.5 px-6 text-base transition-transform duration-200 hover:scale-105 flex-shrink-0"
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
