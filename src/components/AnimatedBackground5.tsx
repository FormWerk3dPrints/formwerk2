"use client";

import { useEffect, useRef } from "react";

export default function AnimatedBackground5() {
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

    type Drop = {
      x: number;
      y: number;
      size: number;
      speed: number;
      drift: number;
      alpha: number;
    };

    // Calm, sparse rain.
    const dropCountFor = (w: number, h: number) => {
      const area = w * h;
      // ~ 1 drop per ~18k px, clamped.
      return Math.max(55, Math.min(170, Math.floor(area / 16000)));
    };

    let drops: Drop[] = [];

    const resetDrop = (drop: Drop, startAboveTop = false) => {
      drop.x = Math.random() * width;
      drop.y = startAboveTop ? -Math.random() * height * 0.3 : Math.random() * height;
      // Larger points
      drop.size = 2.2 + Math.random() * 2.6;
      drop.speed = 28 + Math.random() * 40; // px/sec (very calm)
      drop.drift = -6 + Math.random() * 12; // subtle wind
      // Slightly higher alpha so it shows on white backgrounds.
      drop.alpha = 0.14 + Math.random() * 0.10;
    };

    const rebuildDrops = () => {
      const count = dropCountFor(width, height);
      drops = Array.from({ length: count }, () => {
        const drop: Drop = { x: 0, y: 0, size: 0, speed: 0, drift: 0, alpha: 0 };
        resetDrop(drop, false);
        return drop;
      });
    };

    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));

      const ratio = dpr();
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

      rebuildDrops();
    };

    const ro = new ResizeObserver(() => resize());
    ro.observe(container);
    resize();

    const color = "13, 106, 167"; // #0D6AA7

    let last = performance.now();
    const animate = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      ctx.clearRect(0, 0, width, height);
      // Points (not strokes)

      for (const drop of drops) {
        drop.y += drop.speed * dt;
        drop.x += drop.drift * dt;

        if (drop.y - drop.size > height + 24) {
          resetDrop(drop, true);
        }
        if (drop.x < -20) drop.x = width + 20;
        if (drop.x > width + 20) drop.x = -20;

        ctx.fillStyle = `rgba(${color}, ${drop.alpha})`;
        ctx.beginPath();
        ctx.arc(drop.x, drop.y, drop.size, 0, Math.PI * 2);
        ctx.fill();
      }

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
