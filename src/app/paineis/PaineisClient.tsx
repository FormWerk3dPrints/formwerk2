'use client';

import { useEffect, useMemo, useState } from 'react';
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
  const [panelWidthMm, setPanelWidthMm] = useState(PANEL_MAX_WIDTH_MM);
  const [panelHeightMm, setPanelHeightMm] = useState(PANEL_MAX_HEIGHT_MM);

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
              Largura do painel (mm, máx. {PANEL_MAX_WIDTH_MM})
            </label>
            <input
              type="number"
              min={PANEL_MIN_WIDTH_MM}
              max={PANEL_MAX_WIDTH_MM}
              value={panelWidthMm}
              onChange={(e) => {
                const raw = e.target.value;
                setPanelWidthMm(raw === '' ? 0 : Number(raw));
              }}
              onBlur={() =>
                setPanelWidthMm((prev) => clamp(prev, PANEL_MIN_WIDTH_MM, PANEL_MAX_WIDTH_MM))
              }
              className="w-full border rounded-lg px-3 py-2 text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Altura do painel (mm, máx. {PANEL_MAX_HEIGHT_MM})
            </label>
            <input
              type="number"
              min={PANEL_MIN_HEIGHT_MM}
              max={PANEL_MAX_HEIGHT_MM}
              value={panelHeightMm}
              onChange={(e) => {
                const raw = e.target.value;
                setPanelHeightMm(raw === '' ? 0 : Number(raw));
              }}
              onBlur={() =>
                setPanelHeightMm((prev) => clamp(prev, PANEL_MIN_HEIGHT_MM, PANEL_MAX_HEIGHT_MM))
              }
              className="w-full border rounded-lg px-3 py-2 text-gray-900"
            />
          </div>
        </div>

        {/* Base do painel — cada módulo anexado é dimensionado proporcionalmente
            ao tamanho real dele (widthMm/heightMm) relativo ao painel. A largura é o
            menor entre: 100% do container, um teto em px, e o valor que faria a altura
            bater exatamente com o teto em vh — assim o quadro sempre cabe inteiro na
            tela, qualquer que seja a proporção largura/altura escolhida. */}
        <div
          className="mx-auto mb-6 rounded-xl border-4 border-dashed border-brand-200 bg-white shadow-inner overflow-hidden"
          style={{
            aspectRatio: `${panelWidthMm} / ${panelHeightMm}`,
            width: `min(100%, ${PANEL_DISPLAY_MAX_WIDTH_PX}px, calc(${PANEL_DISPLAY_MAX_HEIGHT_VH}vh * ${panelWidthMm} / ${panelHeightMm}))`,
          }}
        >
          {attachedModules.length === 0 ? (
            <div className="flex h-full items-center justify-center text-gray-400 text-center px-6">
              Painel vazio — clique nos módulos abaixo para anexar.
            </div>
          ) : (
            <div className="flex h-full w-full flex-wrap content-start gap-1 p-2 overflow-y-auto">
              {attachedModules.map((m) => {
                const widthPercent = clamp((m.widthMm / panelWidthMm) * 100, 0, 100);
                const heightPercent = clamp((m.heightMm / panelHeightMm) * 100, 0, 100);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleAttach(m.id)}
                    className="group relative overflow-hidden rounded-md bg-gray-100"
                    style={{ width: `${widthPercent}%`, height: `${heightPercent}%` }}
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
