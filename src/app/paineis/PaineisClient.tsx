'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import Image from 'next/image';
import { onAuthStateChanged } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase/client';
import { RotateCw, X } from 'lucide-react';

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

/** Toque: quanto tempo segurando um módulo do catálogo até "pegar" ele pra arrastar. */
const LONG_PRESS_MS = 350;
/** Movimento (px) que cancela o long-press — é rolagem de página, não arraste. */
const LONG_PRESS_MOVE_TOLERANCE_PX = 10;

/** Folga (mm) tolerada ao comparar sobreposição — evita falso positivo por float. */
const COLLISION_EPS_MM = 0.01;

type Rotation = 0 | 90 | 180 | 270;

interface Placement {
  instanceId: string;
  moduleId: string;
  /** Canto superior-esquerdo da caixa (já rotacionada), em mm, relativo ao painel. */
  xMm: number;
  yMm: number;
  rotation: Rotation;
}

function formatPrice(cents: number, currency: string): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: currency || 'BRL' });
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Dimensões que o módulo ocupa depois de girado (90°/270° trocam os eixos). */
function footprint(module: WallPanelModule, rotation: Rotation): { w: number; h: number } {
  return rotation % 180 === 0
    ? { w: module.widthMm, h: module.heightMm }
    : { w: module.heightMm, h: module.widthMm };
}

/** Sobreposição de retângulos. Encostar é permitido; invadir não. */
function overlaps(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number
): boolean {
  return (
    ax < bx + bw - COLLISION_EPS_MM &&
    ax + aw > bx + COLLISION_EPS_MM &&
    ay < by + bh - COLLISION_EPS_MM &&
    ay + ah > by + COLLISION_EPS_MM
  );
}

export default function PaineisClient({ modules: initialModules }: { modules: WallPanelModule[] }) {
  const [modules, setModules] = useState<WallPanelModule[]>(initialModules);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);

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

  const moduleById = useMemo(() => {
    const map = new Map<string, WallPanelModule>();
    for (const m of modules) map.set(m.id, m);
    return map;
  }, [modules]);

  // Medidos em JS (em vez de só CSS) para poder derivar uma escala px/mm única
  // e exata — é ela que garante que nenhum módulo saia distorcido.
  const panelWrapperRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
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
    // Antes da primeira medição (primeiro paint) — mesma fórmula de antes
    // (evita flash de tamanho errado; a medição chega em seguida).
    panelStyle = {
      aspectRatio: `${displayWidthMm} / ${displayHeightMm}`,
      width: `min(100%, ${PANEL_DISPLAY_MAX_WIDTH_PX}px, calc(${PANEL_DISPLAY_MAX_HEIGHT_VH}vh * ${displayWidthMm} / ${displayHeightMm}))`,
    };
  }

  // Escala uniforme px por mm — a MESMA nos dois eixos, já que o quadro mantém
  // panelRatio exato. É o que garante que um módulo de 400x400mm apareça
  // quadrado e que 2 módulos de 600mm ocupem exatamente meio painel de 1200mm.
  const moduleScale = hasMeasurements ? panelWidthPx / displayWidthMm : 0;

  /* Refs lidos pelos listeners globais de ponteiro. Sem isso os handlers
     fechariam sobre valores velhos (a posição muda a cada pointermove). */
  const geomRef = useRef({ scale: 0, panelW: 0, panelH: 0 });
  geomRef.current = { scale: moduleScale, panelW: displayWidthMm, panelH: displayHeightMm };
  const placementsRef = useRef<Placement[]>(placements);
  placementsRef.current = placements;
  const moduleByIdRef = useRef(moduleById);
  moduleByIdRef.current = moduleById;

  /* Escreve no ref ANTES do setState. Sem isso, duas ações no mesmo tick (dois
     cliques rápidos, ou vários pointermove antes do re-render) leriam a lista
     velha e a colisão não enxergaria o que acabou de ser posicionado. */
  function commitPlacements(next: Placement[]) {
    placementsRef.current = next;
    setPlacements(next);
  }

  /** Posição válida? (dentro do painel e sem invadir outro módulo) */
  function isValidPosition(
    module: WallPanelModule,
    rotation: Rotation,
    xMm: number,
    yMm: number,
    ignoreInstanceId: string | null,
    list: Placement[],
    panelW: number,
    panelH: number
  ): boolean {
    const { w, h } = footprint(module, rotation);
    if (xMm < -COLLISION_EPS_MM || yMm < -COLLISION_EPS_MM) return false;
    if (xMm + w > panelW + COLLISION_EPS_MM) return false;
    if (yMm + h > panelH + COLLISION_EPS_MM) return false;

    for (const other of list) {
      if (other.instanceId === ignoreInstanceId) continue;
      const om = moduleByIdRef.current.get(other.moduleId);
      if (!om) continue;
      const of = footprint(om, other.rotation);
      if (overlaps(xMm, yMm, w, h, other.xMm, other.yMm, of.w, of.h)) return false;
    }
    return true;
  }

  /** Primeiro espaço livre varrendo em linhas — usado no clique simples. */
  function findFreeSpot(
    module: WallPanelModule,
    rotation: Rotation,
    list: Placement[],
    panelW: number,
    panelH: number
  ): { xMm: number; yMm: number } | null {
    const { w, h } = footprint(module, rotation);
    if (w > panelW || h > panelH) return null;
    const step = Math.max(10, Math.min(w, h) / 4);
    for (let y = 0; y <= panelH - h + COLLISION_EPS_MM; y += step) {
      for (let x = 0; x <= panelW - w + COLLISION_EPS_MM; x += step) {
        if (isValidPosition(module, rotation, x, y, null, list, panelW, panelH)) {
          return { xMm: x, yMm: y };
        }
      }
    }
    // Última tentativa: encostado no canto inferior-direito.
    const cx = panelW - w;
    const cy = panelH - h;
    if (isValidPosition(module, rotation, cx, cy, null, list, panelW, panelH)) {
      return { xMm: cx, yMm: cy };
    }
    return null;
  }

  const [placementError, setPlacementError] = useState<string | null>(null);
  useEffect(() => {
    if (!placementError) return;
    const t = setTimeout(() => setPlacementError(null), 4000);
    return () => clearTimeout(t);
  }, [placementError]);

  function addModuleAtFreeSpot(moduleId: string) {
    const module = moduleByIdRef.current.get(moduleId);
    if (!module) return;
    const list = placementsRef.current;
    const { panelW, panelH } = geomRef.current;
    const spot = findFreeSpot(module, 0, list, panelW, panelH);
    if (!spot) {
      setPlacementError(`Sem espaço livre para "${module.name}" neste painel.`);
      return;
    }
    const instanceId = `${moduleId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    commitPlacements([...list, { instanceId, moduleId, ...spot, rotation: 0 }]);
    setSelectedInstanceId(instanceId);
  }

  function removePlacement(instanceId: string) {
    commitPlacements(placementsRef.current.filter((p) => p.instanceId !== instanceId));
    setSelectedInstanceId((cur) => (cur === instanceId ? null : cur));
  }

  /** Gira mantendo o CENTRO fixo; se não couber, tenta empurrar pra dentro do painel. */
  function rotatePlacement(instanceId: string, nextRotation: Rotation) {
    const list = placementsRef.current;
    const idx = list.findIndex((p) => p.instanceId === instanceId);
    if (idx === -1) return;
    const current = list[idx];
    const module = moduleByIdRef.current.get(current.moduleId);
    if (!module) return;
    const { panelW, panelH } = geomRef.current;

    const before = footprint(module, current.rotation);
    const after = footprint(module, nextRotation);
    const cx = current.xMm + before.w / 2;
    const cy = current.yMm + before.h / 2;

    if (after.w > panelW || after.h > panelH) {
      setPlacementError('Girado, esse módulo não cabe no painel.');
      return;
    }

    const candidateX = clamp(cx - after.w / 2, 0, panelW - after.w);
    const candidateY = clamp(cy - after.h / 2, 0, panelH - after.h);

    if (!isValidPosition(module, nextRotation, candidateX, candidateY, instanceId, list, panelW, panelH)) {
      setPlacementError('Não dá pra girar aqui — sem espaço.');
      return;
    }
    const next = [...list];
    next[idx] = { ...current, rotation: nextRotation, xMm: candidateX, yMm: candidateY };
    commitPlacements(next);
  }

  /* ---------- Arraste (ponteiro unificado: mouse, caneta e toque) ---------- */

  type DragState =
    | {
        kind: 'pending-new';
        moduleId: string;
        pointerId: number;
        startX: number;
        startY: number;
        timer: ReturnType<typeof setTimeout>;
      }
    | { kind: 'new'; moduleId: string; pointerId: number }
    | {
        kind: 'move';
        instanceId: string;
        pointerId: number;
        offsetXMm: number;
        offsetYMm: number;
        moved: boolean;
      }
    | { kind: 'rotate'; instanceId: string; pointerId: number; startRotation: Rotation; moved: boolean };

  const dragRef = useRef<DragState | null>(null);
  const [ghost, setGhost] = useState<{ moduleId: string; x: number; y: number } | null>(null);
  const [draggingInstanceId, setDraggingInstanceId] = useState<string | null>(null);

  /** Ponto do ponteiro convertido para mm dentro do painel. */
  function pointerToPanelMm(clientX: number, clientY: number): { xMm: number; yMm: number } | null {
    const el = panelRef.current;
    const { scale } = geomRef.current;
    if (!el || scale <= 0) return null;
    const rect = el.getBoundingClientRect();
    return {
      xMm: (clientX - rect.left - PANEL_BORDER_PX) / scale,
      yMm: (clientY - rect.top - PANEL_BORDER_PX) / scale,
    };
  }

  useEffect(() => {
    function cancelPending() {
      const drag = dragRef.current;
      if (drag?.kind === 'pending-new') clearTimeout(drag.timer);
    }

    function handleMove(e: PointerEvent) {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;

      if (drag.kind === 'pending-new') {
        const dist = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
        // Mexeu antes de completar o long-press → é rolagem, não arraste.
        if (dist > LONG_PRESS_MOVE_TOLERANCE_PX) {
          clearTimeout(drag.timer);
          dragRef.current = null;
        }
        return;
      }

      if (drag.kind === 'new') {
        setGhost({ moduleId: drag.moduleId, x: e.clientX, y: e.clientY });
        return;
      }

      if (drag.kind === 'move') {
        const point = pointerToPanelMm(e.clientX, e.clientY);
        if (!point) return;
        drag.moved = true;
        const { panelW, panelH } = geomRef.current;
        const list = placementsRef.current;
        const current = list.find((p) => p.instanceId === drag.instanceId);
        if (!current) return;
        const module = moduleByIdRef.current.get(current.moduleId);
        if (!module) return;
        const { w, h } = footprint(module, current.rotation);

        const targetX = clamp(point.xMm - drag.offsetXMm, 0, Math.max(0, panelW - w));
        const targetY = clamp(point.yMm - drag.offsetYMm, 0, Math.max(0, panelH - h));

        // Tenta o movimento cheio; se colidir, desliza só num eixo (dá a
        // sensação de "escorregar" pela lateral do outro módulo).
        const candidates: Array<[number, number]> = [
          [targetX, targetY],
          [targetX, current.yMm],
          [current.xMm, targetY],
        ];
        for (const [cx, cy] of candidates) {
          if (isValidPosition(module, current.rotation, cx, cy, drag.instanceId, list, panelW, panelH)) {
            if (cx === current.xMm && cy === current.yMm) return;
            commitPlacements(
              list.map((p) => (p.instanceId === drag.instanceId ? { ...p, xMm: cx, yMm: cy } : p))
            );
            return;
          }
        }
        return;
      }

      if (drag.kind === 'rotate') {
        const list = placementsRef.current;
        const current = list.find((p) => p.instanceId === drag.instanceId);
        if (!current) return;
        const module = moduleByIdRef.current.get(current.moduleId);
        if (!module) return;
        const el = panelRef.current;
        const { scale } = geomRef.current;
        if (!el || scale <= 0) return;

        const rect = el.getBoundingClientRect();
        const { w, h } = footprint(module, current.rotation);
        const centerX = rect.left + PANEL_BORDER_PX + (current.xMm + w / 2) * scale;
        const centerY = rect.top + PANEL_BORDER_PX + (current.yMm + h / 2) * scale;
        const dist = Math.hypot(e.clientX - centerX, e.clientY - centerY);
        if (dist < 8) return; // perto demais do centro: ângulo instável

        drag.moved = true;
        const angle = (Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180) / Math.PI;
        // "Trava" a cada 90°: o ângulo livre é sempre arredondado pro múltiplo
        // mais próximo, então nunca sobra um valor torto.
        const snapped = (((Math.round(angle / 90) * 90) % 360) + 360) % 360;
        const nextRotation = ((snapped + drag.startRotation) % 360) as Rotation;
        if (nextRotation !== current.rotation) rotatePlacement(drag.instanceId, nextRotation);
      }
    }

    function handleUp(e: PointerEvent) {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;

      if (drag.kind === 'pending-new') {
        // Soltou antes do long-press → clique simples: adiciona no 1º espaço livre.
        clearTimeout(drag.timer);
        dragRef.current = null;
        addModuleAtFreeSpot(drag.moduleId);
        return;
      }

      if (drag.kind === 'new') {
        dragRef.current = null;
        setGhost(null);
        const module = moduleByIdRef.current.get(drag.moduleId);
        const point = pointerToPanelMm(e.clientX, e.clientY);
        if (!module || !point) return;
        const { panelW, panelH } = geomRef.current;
        const { w, h } = footprint(module, 0);
        // Solta centralizado no dedo/cursor.
        const x = clamp(point.xMm - w / 2, 0, Math.max(0, panelW - w));
        const y = clamp(point.yMm - h / 2, 0, Math.max(0, panelH - h));
        const list = placementsRef.current;

        if (point.xMm < 0 || point.yMm < 0 || point.xMm > panelW || point.yMm > panelH) {
          return; // soltou fora do painel: descarta
        }
        if (!isValidPosition(module, 0, x, y, null, list, panelW, panelH)) {
          setPlacementError('Aí encostaria em outro módulo — solte num espaço livre.');
          return;
        }
        const instanceId = `${drag.moduleId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        commitPlacements([...list, { instanceId, moduleId: drag.moduleId, xMm: x, yMm: y, rotation: 0 }]);
        setSelectedInstanceId(instanceId);
        return;
      }

      if (drag.kind === 'move') {
        dragRef.current = null;
        setDraggingInstanceId(null);
        if (!drag.moved) setSelectedInstanceId(drag.instanceId);
        return;
      }

      if (drag.kind === 'rotate') {
        dragRef.current = null;
        // Toque/clique sem girar de fato → gira 90° (o caminho rápido).
        if (!drag.moved) {
          const current = placementsRef.current.find((p) => p.instanceId === drag.instanceId);
          if (current) rotatePlacement(drag.instanceId, ((current.rotation + 90) % 360) as Rotation);
        }
      }
    }

    function handleCancel(e: PointerEvent) {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      cancelPending();
      dragRef.current = null;
      setGhost(null);
      setDraggingInstanceId(null);
    }

    // Enquanto um arraste está ativo, bloqueia a rolagem por toque —
    // sem isso o dedo arrasta a página em vez do módulo.
    function blockTouchScroll(e: TouchEvent) {
      const drag = dragRef.current;
      if (drag && drag.kind !== 'pending-new') e.preventDefault();
    }

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleCancel);
    window.addEventListener('touchmove', blockTouchScroll, { passive: false });
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleCancel);
      window.removeEventListener('touchmove', blockTouchScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayWidthMm, displayHeightMm]);

  function startCatalogPress(e: ReactPointerEvent<HTMLButtonElement>, moduleId: string) {
    if (dragRef.current) return;
    const pointerId = e.pointerId;
    const timer = setTimeout(() => {
      // Segurou o suficiente: "pega" o módulo e passa a seguir o ponteiro.
      const drag = dragRef.current;
      if (drag?.kind !== 'pending-new' || drag.pointerId !== pointerId) return;
      dragRef.current = { kind: 'new', moduleId, pointerId };
      setGhost({ moduleId, x: drag.startX, y: drag.startY });
    }, LONG_PRESS_MS);

    dragRef.current = {
      kind: 'pending-new',
      moduleId,
      pointerId,
      startX: e.clientX,
      startY: e.clientY,
      timer,
    };
  }

  function startPlacementDrag(e: ReactPointerEvent<HTMLDivElement>, placement: Placement) {
    if (dragRef.current) return;
    e.stopPropagation();
    const point = pointerToPanelMm(e.clientX, e.clientY);
    if (!point) return;
    dragRef.current = {
      kind: 'move',
      instanceId: placement.instanceId,
      pointerId: e.pointerId,
      offsetXMm: point.xMm - placement.xMm,
      offsetYMm: point.yMm - placement.yMm,
      moved: false,
    };
    setDraggingInstanceId(placement.instanceId);
    setSelectedInstanceId(placement.instanceId);
  }

  function startRotateDrag(e: ReactPointerEvent<HTMLButtonElement>, placement: Placement) {
    if (dragRef.current) return;
    e.stopPropagation();
    const el = panelRef.current;
    const { scale } = geomRef.current;
    const module = moduleById.get(placement.moduleId);
    if (!el || !module || scale <= 0) return;
    const rect = el.getBoundingClientRect();
    const { w, h } = footprint(module, placement.rotation);
    const centerX = rect.left + PANEL_BORDER_PX + (placement.xMm + w / 2) * scale;
    const centerY = rect.top + PANEL_BORDER_PX + (placement.yMm + h / 2) * scale;
    const grabAngle = (Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180) / Math.PI;
    const grabSnapped = (((Math.round(grabAngle / 90) * 90) % 360) + 360) % 360;
    dragRef.current = {
      kind: 'rotate',
      instanceId: placement.instanceId,
      pointerId: e.pointerId,
      // Guarda a diferença pra rotação não "pular" no momento em que pega a alça.
      startRotation: (((placement.rotation - grabSnapped) % 360) + 360) % 360 as Rotation,
      moved: false,
    };
    setSelectedInstanceId(placement.instanceId);
  }

  /* Painel encolheu? Reposiciona quem ficou pra fora e descarta o que não cabe
     mais — senão o desenho passaria a mentir sobre o que cabe de verdade. */
  useEffect(() => {
    const prev = placementsRef.current;
    const kept: Placement[] = [];
    let changed = false;
    let dropped = 0;

    for (const p of prev) {
      const module = moduleByIdRef.current.get(p.moduleId);
      if (!module) { changed = true; dropped++; continue; }
      const { w, h } = footprint(module, p.rotation);
      if (w > displayWidthMm || h > displayHeightMm) { changed = true; dropped++; continue; }
      const x = clamp(p.xMm, 0, displayWidthMm - w);
      const y = clamp(p.yMm, 0, displayHeightMm - h);
      if (!isValidPosition(module, p.rotation, x, y, p.instanceId, kept, displayWidthMm, displayHeightMm)) {
        const spot = findFreeSpot(module, p.rotation, kept, displayWidthMm, displayHeightMm);
        if (!spot) { changed = true; dropped++; continue; }
        kept.push({ ...p, xMm: spot.xMm, yMm: spot.yMm });
        changed = true;
        continue;
      }
      if (x !== p.xMm || y !== p.yMm) changed = true;
      kept.push({ ...p, xMm: x, yMm: y });
    }

    if (!changed) return;
    commitPlacements(kept);
    if (dropped > 0) {
      setPlacementError(
        dropped === 1
          ? '1 módulo não cabe mais no painel e foi removido.'
          : `${dropped} módulos não cabem mais no painel e foram removidos.`
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayWidthMm, displayHeightMm, modules]);

  const placedModules = placements
    .map((p) => ({ placement: p, module: moduleById.get(p.moduleId) }))
    .filter((x): x is { placement: Placement; module: WallPanelModule } => Boolean(x.module));

  const selectedPlaced = placedModules.find((x) => x.placement.instanceId === selectedInstanceId) ?? null;

  const totalCents = placedModules.reduce((sum, x) => sum + (x.module.priceCents ?? 0), 0);
  const hasPrice = placedModules.some((x) => typeof x.module.priceCents === 'number');
  const totalCurrency = placedModules.find((x) => x.module.currency)?.module.currency ?? 'BRL';
  const ghostModule = ghost ? moduleById.get(ghost.moduleId) : null;

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="container mx-auto max-w-5xl lg:max-w-7xl">
        <h1 className="text-4xl font-bold text-gray-800 mb-2 text-center">Painéis de Parede</h1>
        <p className="text-gray-600 text-center mb-8 max-w-2xl mx-auto">
          Informe as dimensões do seu painel, então arraste os módulos para dentro dele e
          posicione como quiser. Toque num módulo já posicionado para girá-lo ou removê-lo.
        </p>

        {/* No desktop o catálogo fica ao lado do quadro; no mobile, embaixo. */}
        <div className="lg:flex lg:items-start lg:gap-8">
        <div className="lg:min-w-0 lg:flex-1">

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

        {/* Base do painel — posicionamento livre, com colisão entre módulos e
            contra a borda. panelStyle garante que o quadro cabe inteiro na tela
            e mantém a proporção real. */}
        <div ref={panelWrapperRef} className="mx-auto mb-2">
          <div
            ref={panelRef}
            className="relative mx-auto rounded-xl border-4 border-dashed border-brand-200 bg-white shadow-inner touch-none select-none"
            style={panelStyle}
            onPointerDown={() => setSelectedInstanceId(null)}
          >
            {placedModules.length === 0 && (
              <div className="pointer-events-none flex h-full items-center justify-center text-gray-400 text-center px-6">
                Painel vazio — arraste um módulo de baixo para cá (ou toque nele).
              </div>
            )}

            {/* Camada dos módulos: recortada, pra nada vazar o arredondado do quadro. */}
            <div className="absolute inset-0 overflow-hidden rounded-lg">
            {placedModules.map(({ placement, module }) => {
              const { w, h } = footprint(module, placement.rotation);
              const selected = selectedInstanceId === placement.instanceId;
              const dragging = draggingInstanceId === placement.instanceId;
              return (
                <div
                  key={placement.instanceId}
                  role="button"
                  tabIndex={0}
                  aria-label={`${module.name}, girado ${placement.rotation} graus`}
                  onPointerDown={(e) => startPlacementDrag(e, placement)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedInstanceId(placement.instanceId);
                    }
                    if (e.key === 'r' || e.key === 'R') {
                      e.preventDefault();
                      rotatePlacement(placement.instanceId, ((placement.rotation + 90) % 360) as Rotation);
                    }
                    if (e.key === 'Delete' || e.key === 'Backspace') {
                      e.preventDefault();
                      removePlacement(placement.instanceId);
                    }
                  }}
                  className={`absolute cursor-grab touch-none ${dragging ? 'cursor-grabbing z-20' : ''} ${
                    selected ? 'z-10 ring-2 ring-brand' : 'ring-1 ring-white/60'
                  }`}
                  style={{
                    left: `${placement.xMm * moduleScale}px`,
                    top: `${placement.yMm * moduleScale}px`,
                    width: `${w * moduleScale}px`,
                    height: `${h * moduleScale}px`,
                  }}
                >
                  {/* A imagem gira dentro da caixa; a caixa em si já tem as
                      dimensões do módulo rotacionado. */}
                  <div
                    className="absolute left-1/2 top-1/2 overflow-hidden"
                    style={{
                      width: `${module.widthMm * moduleScale}px`,
                      height: `${module.heightMm * moduleScale}px`,
                      transform: `translate(-50%, -50%) rotate(${placement.rotation}deg)`,
                    }}
                  >
                    <Image
                      src={module.mainImageUrl || module.imageUrls[0] || ''}
                      alt={module.name}
                      fill
                      sizes="240px"
                      className="object-cover pointer-events-none"
                      draggable={false}
                    />
                  </div>

                </div>
              );
            })}
            </div>

            {/* Camada das alças: FORA do recorte, então elas continuam inteiras
                mesmo com o módulo encostado na borda do painel. */}
            {selectedPlaced && (
              <div className="pointer-events-none absolute inset-0 z-40">
                {(() => {
                  const { placement, module } = selectedPlaced;
                  const { w } = footprint(module, placement.rotation);
                  const left = placement.xMm * moduleScale;
                  const top = placement.yMm * moduleScale;
                  const right = left + w * moduleScale;
                  return (
                    <>
                      <button
                        type="button"
                        onPointerDown={(e) => startRotateDrag(e, placement)}
                        className="pointer-events-auto absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center rounded-full bg-brand text-white shadow-md ring-2 ring-white"
                        style={{ left: `${left}px`, top: `${top}px` }}
                        aria-label={`Girar ${module.name} (arraste para girar, trava a cada 90°)`}
                        title="Girar — arraste em volta; trava a cada 90°"
                      >
                        <RotateCw className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          removePlacement(placement.instanceId);
                        }}
                        className="pointer-events-auto absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-red-500 text-white shadow-md ring-2 ring-white"
                        style={{ left: `${right}px`, top: `${top}px` }}
                        aria-label={`Remover ${module.name} do painel`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        <p className="mb-6 text-center text-xs text-gray-500">
          {placementError ? (
            <span className="font-medium text-red-600">{placementError}</span>
          ) : (
            <>Segure um módulo para arrastá-lo. Selecionado: <RotateCw className="inline h-3 w-3" /> gira (trava a cada 90°), <X className="inline h-3 w-3" /> remove.</>
          )}
        </p>

        {placedModules.length > 0 && (
          <div className="mx-auto mb-12 max-w-2xl rounded-lg border bg-white p-4 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {placedModules.length} módulo{placedModules.length !== 1 ? 's' : ''} no painel
            </span>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  commitPlacements([]);
                  setSelectedInstanceId(null);
                }}
                className="text-sm text-gray-500 underline hover:text-gray-700"
              >
                Limpar
              </button>
              {hasPrice && (
                <span className="text-xl font-bold text-gray-900">
                  {formatPrice(totalCents, totalCurrency)}
                </span>
              )}
            </div>
          </div>
        )}

        </div>

        {/* Catálogo: coluna à direita no desktop, acompanhando a rolagem. */}
        <aside className="lg:sticky lg:top-24 lg:w-96 lg:shrink-0 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center lg:text-left">Módulos disponíveis</h2>

        {modules.length === 0 ? (
          <p className="text-center text-gray-500 lg:text-left">Nenhum módulo cadastrado ainda.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-2 gap-6 lg:gap-4">
            {modules.map((m) => {
              const usedCount = placements.filter((p) => p.moduleId === m.id).length;
              return (
                <button
                  key={m.id}
                  type="button"
                  onPointerDown={(e) => startCatalogPress(e, m.id)}
                  className="text-left rounded-lg border-2 border-transparent bg-white overflow-hidden shadow-lg transition-shadow hover:shadow-xl select-none"
                >
                  <div className="relative aspect-square bg-gray-100">
                    <Image
                      src={m.mainImageUrl || m.imageUrls[0] || ''}
                      alt={m.name}
                      fill
                      sizes="(max-width: 767px) 50vw, (max-width: 1023px) 25vw, 180px"
                      className="object-cover"
                      draggable={false}
                    />
                    {usedCount > 0 && (
                      <div className="absolute top-2 right-2 rounded-full bg-brand text-white text-xs font-semibold px-2 py-0.5">
                        {usedCount}× no painel
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
        </aside>
        </div>
      </div>

      {/* Fantasma que segue o dedo/cursor enquanto traz um módulo pro painel. */}
      {ghost && ghostModule && moduleScale > 0 && (
        <div
          className="pointer-events-none fixed z-50 opacity-80 ring-2 ring-brand"
          style={{
            left: `${ghost.x - (ghostModule.widthMm * moduleScale) / 2}px`,
            top: `${ghost.y - (ghostModule.heightMm * moduleScale) / 2}px`,
            width: `${ghostModule.widthMm * moduleScale}px`,
            height: `${ghostModule.heightMm * moduleScale}px`,
          }}
        >
          <Image
            src={ghostModule.mainImageUrl || ghostModule.imageUrls[0] || ''}
            alt=""
            fill
            sizes="240px"
            className="object-cover"
          />
        </div>
      )}
    </main>
  );
}
