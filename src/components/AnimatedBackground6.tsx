"use client";

import { useEffect, useRef } from "react";

export default function AnimatedBackground6() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);

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

    const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

    let width = 1;
    let height = 1;

    // Very subtle grain texture (static) to make the background feel less flat.
    const noiseCanvas = document.createElement("canvas");
    const noiseCtx = noiseCanvas.getContext("2d");

    const buildNoise = () => {
      if (!noiseCtx) return;
      // Keep it small; it will be tiled.
      const nw = 128;
      const nh = 128;
      noiseCanvas.width = nw;
      noiseCanvas.height = nh;
      const img = noiseCtx.createImageData(nw, nh);

      for (let i = 0; i < img.data.length; i += 4) {
        // Very light grain, visibly biased towards blue (avoid “gray dust”).
        const v = 220 + Math.floor(Math.random() * 28);
        img.data[i + 0] = Math.max(0, Math.min(255, v - 18));
        img.data[i + 1] = Math.max(0, Math.min(255, v - 6));
        img.data[i + 2] = Math.max(0, Math.min(255, v + 22));
        img.data[i + 3] = 14; // low alpha
      }
      noiseCtx.putImageData(img, 0, 0);
    };

    buildNoise();

    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));

      const ratio = dpr();
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

      // Rebuild noise occasionally on resize to avoid visible repeats.
      buildNoise();
    };

    const ro = new ResizeObserver(() => resize());
    ro.observe(container);
    resize();

    // Color palette around #0D6AA7, clearly blue but still soft.
    const c1 = "rgba(13, 106, 167, 0.22)";
    const c2 = "rgba(13, 106, 167, 0.16)";
    const c3 = "rgba(13, 106, 167, 0.12)";

    let last = performance.now();
    const start = last;

    const draw = (t: number) => {
      // Base wash
      ctx.clearRect(0, 0, width, height);

      // Full-canvas tint to ensure the result reads “blue”, not gray.
      const base = ctx.createLinearGradient(0, 0, width, height);
      base.addColorStop(0, "rgba(13, 106, 167, 0.18)");
      base.addColorStop(1, "rgba(13, 106, 167, 0.08)");
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, width, height);

      // Slow drift parameters
      const s = (t - start) / 1000;

      // A few soft radial blobs drifting slowly.
      const cx1 = width * (0.25 + 0.05 * Math.sin(s * 0.08));
      const cy1 = height * (0.30 + 0.05 * Math.cos(s * 0.06));
      const r1 = Math.max(width, height) * 0.75;

      const cx2 = width * (0.75 + 0.06 * Math.cos(s * 0.07));
      const cy2 = height * (0.25 + 0.05 * Math.sin(s * 0.05));
      const r2 = Math.max(width, height) * 0.65;

      const cx3 = width * (0.55 + 0.04 * Math.sin(s * 0.09));
      const cy3 = height * (0.75 + 0.04 * Math.cos(s * 0.07));
      const r3 = Math.max(width, height) * 0.55;

      const g1 = ctx.createRadialGradient(cx1, cy1, 0, cx1, cy1, r1);
      g1.addColorStop(0, c1);
      g1.addColorStop(1, "rgba(13, 106, 167, 0)");
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, width, height);

      const g2 = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, r2);
      g2.addColorStop(0, c2);
      g2.addColorStop(1, "rgba(13, 106, 167, 0)");
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, width, height);

      const g3 = ctx.createRadialGradient(cx3, cy3, 0, cx3, cy3, r3);
      g3.addColorStop(0, c3);
      g3.addColorStop(1, "rgba(13, 106, 167, 0)");
      ctx.fillStyle = g3;
      ctx.fillRect(0, 0, width, height);

      // Subtle noise overlay
      if (noiseCtx) {
        ctx.save();
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = ctx.createPattern(noiseCanvas, "repeat")!;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
    };

    const animate = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;

      // Keep it calm: redraw at normal RAF, but content drifts very slowly.
      // dt isn't used directly, but keeping it here makes future tuning easy.
      void dt;

      draw(now);
      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      ro.disconnect();

      if (canvasRef.current && container.contains(canvasRef.current)) {
        container.removeChild(canvasRef.current);
      }
      canvasRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-0 pointer-events-none"
      aria-hidden="true"
    />
  );
}
