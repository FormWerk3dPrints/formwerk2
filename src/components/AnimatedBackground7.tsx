"use client";

import { useEffect, useRef } from "react";

type Blob = {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  phase: number;
};

export default function AnimatedBackground7() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    container.appendChild(canvas);
    canvasRef.current = canvas;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const getDpr = () => Math.min(window.devicePixelRatio || 1, 2);

    let width = 1;
    let height = 1;

    const blobs: Blob[] = [];

    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

    const initBlobs = () => {
      blobs.length = 0;
      const maxDim = Math.max(width, height);

      const count = 6; // light + calm
      for (let i = 0; i < count; i++) {
        const r = maxDim * (0.35 + Math.random() * 0.20);
        blobs.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r,
          // A bit more drift so the motion is clearly noticeable.
          vx: (Math.random() - 0.5) * 0.09,
          vy: (Math.random() - 0.5) * 0.08,
          phase: Math.random() * Math.PI * 2,
        });
      }
    };

    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));

      const dpr = getDpr();
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      initBlobs();
    };

    const ro = new ResizeObserver(() => resize());
    ro.observe(container);
    resize();

    const start = performance.now();
    let last = start;

    const draw = (now: number) => {
      const t = (now - start) / 1000;

      ctx.clearRect(0, 0, width, height);

      // Blue base wash so it never reads gray.
      const base = ctx.createLinearGradient(0, 0, width, height);
      base.addColorStop(0, "rgba(13, 106, 167, 0.14)");
      base.addColorStop(1, "rgba(13, 106, 167, 0.08)");
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, width, height);

      // Draw blobs with soft edges.
      ctx.save();
      ctx.globalCompositeOperation = "screen";

      for (const b of blobs) {
        // Gentle drift + breathing.
        const breathe = 1 + 0.06 * Math.sin(t * 0.32 + b.phase);
        const rr = b.r * breathe;

        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, rr);
        // Light inner core
        g.addColorStop(0, "rgba(255, 255, 255, 0.22)");
        // Blue tint
        g.addColorStop(0.35, "rgba(13, 106, 167, 0.20)");
        // Fade out
        g.addColorStop(1, "rgba(13, 106, 167, 0)");

        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(b.x, b.y, rr, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Very subtle vignette to keep attention in the center.
      const vignette = ctx.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.75);
      vignette.addColorStop(0, "rgba(255, 255, 255, 0)");
      vignette.addColorStop(1, "rgba(255, 255, 255, 0.55)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);
    };

    const step = (now: number) => {
      const dt = clamp((now - last) / 1000, 0, 0.05);
      last = now;

      // Add a subtle global “swirl” so movement feels more alive.
      // (Still slow enough to not steal attention.)
      const t = (now - start) / 1000;
      const globalDx = 0.8 * Math.sin(t * 0.18);
      const globalDy = 0.6 * Math.cos(t * 0.16);

      for (const b of blobs) {
        b.x += (b.vx * 1000 + globalDx) * dt;
        b.y += (b.vy * 1000 + globalDy) * dt;

        // Soft bounds (wrap) to avoid sharp bounces.
        const margin = b.r * 0.2;
        if (b.x < -margin) b.x = width + margin;
        if (b.x > width + margin) b.x = -margin;
        if (b.y < -margin) b.y = height + margin;
        if (b.y > height + margin) b.y = -margin;
      }

      draw(now);
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();

      if (canvasRef.current && container.contains(canvasRef.current)) {
        container.removeChild(canvasRef.current);
      }
      canvasRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0 z-0 pointer-events-none" aria-hidden="true" />;
}
