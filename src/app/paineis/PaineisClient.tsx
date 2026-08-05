'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import Image from 'next/image';
import { onAuthStateChanged } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase/client';
import { X } from 'lucide-react';

export interface WallPanelModule {
  id: string;
  slug: string;
  name: string;
  /** Dimensões reais do módulo, em mm — usadas para escalar proporcionalmente dentro do painel. */
  widthMm: number;
  heightMm: number;
  imageUrls: string[];
  mainImageUrl?: string;
  /** Only present when the viewer is a verified user (gated by /api/wall-panels). */
  priceCents?: number;
  currency?: string;
}

const PANEL_MAX_WIDTH_MM = 2850;
const PANEL_MAX_HEIGHT_MM = 1830;
const PANEL_MIN_WIDTH_MM = 300;
const PANEL_MIN_HEIGHT_MM = 300;

/** Limites de exibição — o quadro sempre encolhe pra caber dentro disso, qualquer que seja a proporção. */
const PANEL_DISPLAY_MAX_WIDTH_PX = 672; // igual ao antigo max-w-2xl
const PANEL_DISPLAY_MAX_HEIGHT_VH = 55;
/** Espessura da borda tracejada (border-4). Fica FORA da área útil (content-box). */
const PANEL_BORDER_PX = 4;

function formatPrice(cents: number, currency: string): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: currency || 'BRL' });
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export default function PaineisClient({ modules: initialModules }: { modules: WallPanelModule[] }) {
  const [modules, setModules] = useState<WallPanelModule[]>(initialModules);
  const [attachedIds, setAttachedIds] = useState<string[]>([]);
  // O input guarda exatamente o que foi digitado — inclusive valores inválidos,
  // que ficam em vermelho. O desenho nunca usa esses valores crus.
  const [panelWidthInput, setPanelWidthInput] = useState(String(PANEL_MAX_WIDTH_MM));
  const [panelHeightInput, setPanelHeightInput] = useState(String(PANEL_MAX_HEIGHT_MM));

  const rawWidthMm = Number(panelWidthInput);
  const rawHeightMm = Number(panelHeightInput);

  /* Dimensões efetivas do desenho: sempre dentro dos limites físicos do painel.
     O excedente é simplesmente ignorado (300 vira o piso, 2850/1830 o teto).
     O retângulo e TODOS os módulos derivam destes mesmos dois números, então a
     proporção continua fiel — clampar não distorce nada, só limita. */
  const displayWidthMm = clamp(rawWidthMm, PANEL_MIN_WIDTH_MM, PANEL_MAX_WIDTH_MM);
  const displayHeightMm = clamp(rawHeightMm, PANEL_MIN_HEIGHT_MM, PANEL_MAX_HEIGHT_MM);

  // Vermelho só quando há um número de fato fora da faixa — campo vazio é
  // "em edição", não erro.
  const widthInvalid =
    panelWidthInput.trim() !== '' && Number.isFinite(rawWidthMm) && rawWidthMm !== displayWidthMm;
  const heightInvalid =
    panelHeightInput.trim() !== '' && Number.isFinite(rawHeightMm) && rawHeightMm !== displayHeightMm;

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, async (user) => {
      try {
        const headers: HeadersInit = {};
        if (user) {
          const token = await user.getIdToken();
          headers.Authorization = `Bearer ${token}`;
        }
        const res = await fetch('/api/wall-panels', { headers });
        if (!res.ok) return;
        const data = (await res.json()) as { wallPanels?: WallPanelModule[] };
        if (Array.isArray(data.wallPanels)) setModules(data.wallPanels);
      } catch {
        // keep the server-rendered (no-price) list on failure
      }
    });
    return () => unsub();
  }, []);

  function toggleAttach(id: string) {
    setAttachedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const attachedModules = useMemo(
    () => attachedIds.map((id) => modules.find((m) => m.id === id)).filter((m): m is WallPanelModule => Boolean(m)),
    [attachedIds, modules]
  );

  // Medidos em JS (em vez de só CSS) para poder derivar uma escala px/mm única
  // e exata — é ela que garante que nenhum módulo saia distorcido.
  const panelWrapperRef = useRef<HTMLDivElement>(null);
  const [containerWidthPx, setContainerWidthPx] = useState(0);
  const [viewportHeightPx, setViewportHeightPx] = useState(0);

  useEffect(() => {
    function updateViewportHeight() {
      setViewportHeightPx(window.innerHeight);
    }
    updateViewportHeight();
    window.addEventListener('resize', updateViewportHeight);
    return () => window.removeEventListener('resize', updateViewportHeight);
  }, []);

  useEffect(() => {
    const el = panelWrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContainerWidthPx(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const panelRatio = displayWidthMm / displayHeightMm;
  const hasMeasurements = containerWidthPx > 0 && viewportHeightPx > 0;

  let panelStyle: CSSProperties;
  let panelWidthPx = 0;
  let panelHeightPx = 0;
  if (hasMeasurements) {
    // Desconta a borda: panelWidthPx/panelHeightPx são a ÁREA ÚTIL (content-box),
    // então a escala px/mm vale exatamente onde os módulos são desenhados.
    const availWidth = Math.min(containerWidthPx, PANEL_DISPLAY_MAX_WIDTH_PX) - 2 * PANEL_BORDER_PX;
    const availHeight =
      (viewportHeightPx * PANEL_DISPLAY_MAX_HEIGHT_VH) / 100 - 2 * PANEL_BORDER_PX;
    // Encaixa o maior retângulo possível dentro de (availWidth x availHeight)
    // mantendo panelRatio exato — sem piso por eixo, que quebraria a proporção.
    let w = availWidth;
    let h = w / panelRatio;
    if (h > availHeight) {
      h = availHeight;
      w = h * panelRatio;
    }
    panelWidthPx = w;
    panelHeightPx = h;
    panelStyle = {
      boxSizing: 'content-box',
      width: `${panelWidthPx}px`,
      height: `${panelHeightPx}px`,
    };
  } else {
    // Antes da primeira medição (primeiro paint) — mesma fórmula de antes,
    // sem o piso (evita flash de tamanho errado; a medição chega em seguida).
    panelStyle = {
      aspectRatio: `${displayWidthMm} / ${displayHeightMm}`,
      width: `min(100%, ${PANEL_DISPLAY_MAX_WIDTH_PX}px, calc(${PANEL_DISPLAY_MAX_HEIGHT_VH}vh * ${displayWidthMm} / ${displayHeightMm}))`,
    };
  }

  // Escala uniforme px por mm — a MESMA nos dois eixos, já que o quadro mantém
  // panelRatio exato. É o que garante que um módulo de 400x400mm apareça
  // quadrado e que 2 módulos de 600mm ocupem exatamente meio painel de 1200mm.
  const moduleScale = hasMeasurements ? panelWidthPx / displayWidthMm : null;

  const totalCents = attachedModules.reduce((sum, m) => sum + (m.priceCents ?? 0), 0);
  const hasPrice = attachedModules.some((m) => typeof m.priceCents === 'number');
  const totalCurrency = attachedModules.find((m) => m.currency)?.currency ?? 'BRL';

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="container mx-auto max-w-5xl">
        <h1 className="text-4xl font-bold text-gray-800 mb-2 text-center">Painéis de Parede</h1>
        <p className="text-gray-600 text-center mb-8 max-w-2xl mx-auto">
          Um painel fixo à parede que você monta como quiser — informe as dimensões do seu painel e
          clique nos módulos abaixo para anexá-los, em tamanho proporcional.
        </p>

        {/* Dimensões do painel */}
        <div className="mx-auto mb-6 max-w-2xl grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Largura do painel (mm, {PANEL_MIN_WIDTH_MM}–{PANEL_MAX_WIDTH_MM})
            </label>
            <input
              type="number"
              min={PANEL_MIN_WIDTH_MM}
              max={PANEL_MAX_WIDTH_MM}
              value={panelWidthInput}
              onChange={(e) => setPanelWidthInput(e.target.value)}
              aria-invalid={widthInvalid}
              className={`w-full border rounded-lg px-3 py-2 ${
                widthInvalid
                  ? 'border-red-500 text-red-600 focus:outline-red-500'
                  : 'border-gray-300 text-gray-900'
              }`}
            />
            {widthInvalid && (
              <p className="mt-1 text-xs text-red-600">
                Fora do limite — desenhando em {displayWidthMm} mm.
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Altura do painel (mm, {PANEL_MIN_HEIGHT_MM}–{PANEL_MAX_HEIGHT_MM})
            </label>
            <input
              type="number"
              min={PANEL_MIN_HEIGHT_MM}
              max={PANEL_MAX_HEIGHT_MM}
              value={panelHeightInput}
              onChange={(e) => setPanelHeightInput(e.target.value)}
              aria-invalid={heightInvalid}
              className={`w-full border rounded-lg px-3 py-2 ${
                heightInvalid
                  ? 'border-red-500 text-red-600 focus:outline-red-500'
                  : 'border-gray-300 text-gray-900'
              }`}
            />
            {heightInvalid && (
              <p className="mt-1 text-xs text-red-600">
                Fora do limite — desenhando em {displayHeightMm} mm.
              </p>
            )}
          </div>
        </div>

        {/* Base do painel — cada módulo anexado é dimensionado proporcionalmente
            ao tamanho real dele (widthMm/heightMm) relativo ao painel. panelStyle
            já garante: cabe inteiro na tela (largura/altura calculadas a partir do
            container e da viewport) e nunca fica menor que 300x300px. */}
        <div ref={panelWrapperRef} className="mx-auto mb-6">
          <div
            className="mx-auto rounded-xl border-4 border-dashed border-brand-200 bg-white shadow-inner overflow-hidden"
            style={panelStyle}
          >
            {attachedModules.length === 0 ? (
              <div className="flex h-full items-center justify-center text-gray-400 text-center px-6">
                Painel vazio — clique nos módulos abaixo para anexar.
              </div>
            ) : (
              // Sem padding nem gap: qualquer folga aqui quebraria o encaixe real
              // (ex.: dois módulos de 600mm têm que caber num painel de 1200mm).
              <div className="flex h-full w-full flex-wrap content-start overflow-hidden">
                {attachedModules.map((m) => {
                  const moduleStyle: CSSProperties = moduleScale
                    ? { width: `${m.widthMm * moduleScale}px`, height: `${m.heightMm * moduleScale}px` }
                    : {
                        width: `${clamp((m.widthMm / displayWidthMm) * 100, 0, 100)}%`,
                        height: `${clamp((m.heightMm / displayHeightMm) * 100, 0, 100)}%`,
                      };
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleAttach(m.id)}
                      className="group relative shrink-0 overflow-hidden bg-gray-100 ring-1 ring-white/60"
                      style={moduleStyle}
                      aria-label={`Remover ${m.name} do painel`}
                    >
                      <Image
                        src={m.mainImageUrl || m.imageUrls[0] || ''}
                        alt={m.name}
                        fill
                        sizes="200px"
                        className="object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100">
                        <X className="h-5 w-5 text-white" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {attachedModules.length > 0 && (
          <div className="mx-auto mb-12 max-w-2xl rounded-lg border bg-white p-4 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {attachedModules.length} módulo{attachedModules.length !== 1 ? 's' : ''} anexado
              {attachedModules.length !== 1 ? 's' : ''}
            </span>
            {hasPrice && (
              <span className="text-xl font-bold text-gray-900">
                {formatPrice(totalCents, totalCurrency)}
              </span>
            )}
          </div>
        )}

        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Módulos disponíveis</h2>

        {modules.length === 0 ? (
          <p className="text-center text-gray-500">Nenhum módulo cadastrado ainda.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
            {modules.map((m) => {
              const attached = attachedIds.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleAttach(m.id)}
                  className={`text-left rounded-lg border-2 bg-white overflow-hidden shadow-lg transition-shadow hover:shadow-xl card-hover-expand ${
                    attached ? 'border-brand' : 'border-transparent'
                  }`}
                >
                  <div className="relative aspect-square bg-gray-100">
                    <Image
                      src={m.mainImageUrl || m.imageUrls[0] || ''}
                      alt={m.name}
                      fill
                      sizes="(max-width: 767px) 50vw, 25vw"
                      className="object-cover"
                    />
                    {attached && (
                      <div className="absolute top-2 right-2 rounded-full bg-brand text-white text-xs font-semibold px-2 py-0.5">
                        Anexado
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="text-base font-semibold text-gray-800 line-clamp-2">{m.name}</h3>
                    {m.widthMm > 0 && m.heightMm > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {m.widthMm} × {m.heightMm} mm
                      </p>
                    )}
                    {typeof m.priceCents === 'number' && (
                      <p className="text-sm text-gray-600 mt-1">
                        {formatPrice(m.priceCents, m.currency ?? 'BRL')}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
