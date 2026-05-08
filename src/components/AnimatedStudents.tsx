'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { firestoreDb } from '@/lib/firebase/client';

interface Props {
  count?: number;
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
  const [started, setStarted] = useState(false);

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

  const sectionH = ROWS * STRIDE - GAP + 64; // grid height + vertical breathing room

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

        {/* Edge fade — matches ClientsSection style */}
        <div
          className="absolute inset-y-0 left-0 w-24 pointer-events-none"
          style={{
            background: 'linear-gradient(to right, #f9fafb, transparent)',
          }}
        />
        <div
          className="absolute inset-y-0 right-0 w-24 pointer-events-none"
          style={{
            background: 'linear-gradient(to left, #f9fafb, transparent)',
          }}
        />

        {/* Left overlay — slides in from the right */}
        <div className="absolute inset-y-0 left-0 right-0 overflow-hidden flex items-start pointer-events-none">
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

        {/* Right overlay — slides in from the left */}
        <div className="absolute inset-y-0 left-0 right-0 overflow-hidden flex items-start justify-end pointer-events-none">
          <div
            className={`flex flex-col font-bold text-white text-xl md:text-3xl leading-tight select-none transition-all duration-700 ease-out ${
              started ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
            }`}
            style={{
              background: 'linear-gradient(135deg, #0D6AA7 0%, #1278BC 52%, #0A5B8F 100%)',
              padding: '8px 28px 24px 28px',
              boxShadow: '0 6px 24px 0 rgba(13,106,167,0.22)',
              marginTop: 168,
              lineHeight: 1.18,
            }}
          >
            Conheça nossos<br />
            <span className="flex items-center gap-3">
              produtos:
              <Link
                href="/catalogo"
                className="bg-white font-extrabold rounded px-6 py-1 text-base pointer-events-auto transition-transform duration-200 hover:scale-110"
                style={{ color: '#0D6AA7' }}
              >
                ir!
              </Link>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
