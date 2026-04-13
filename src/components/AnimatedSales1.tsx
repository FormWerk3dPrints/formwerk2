"use client";
import { useRef, useEffect } from "react";

interface AnimatedSales1Props {
  salesCount: number;
}

const BALL_RADIUS = 10;
const GRAVITY = 500;
const RESTITUTION = 0.3;
const GRAVITY_ROTATION_SPEED = 1.2;

export default function AnimatedSales1({ salesCount }: AnimatedSales1Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!salesCount) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Resize canvas to container (always square)
    const resize = () => {
      const parent = canvas.parentElement!;
      const dim = Math.min(parent.clientWidth, parent.clientHeight);
      canvas.width = dim * devicePixelRatio;
      canvas.height = dim * devicePixelRatio;
      canvas.style.width = dim + "px";
      canvas.style.height = dim + "px";
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    };
    resize();

    const size = () => canvas.width / devicePixelRatio;
    const center = () => size() / 2;
    const arenaRadius = () => size() / 2;

    // Create balls inside circle
    const balls: { x: number; y: number; vx: number; vy: number }[] = [];
    for (let i = 0; i < salesCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * (arenaRadius() - BALL_RADIUS * 2);
      balls.push({
        x: center() + Math.cos(angle) * r,
        y: center() + Math.sin(angle) * r,
        vx: (Math.random() - 0.5) * 200,
        vy: (Math.random() - 0.5) * 200,
      });
    }

    let animationId: number;
    let lastTime = performance.now();

    const animate = (now: number) => {
      animationId = requestAnimationFrame(animate);
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const s = size();
      const cx = center();
      const cy = center();
      const ar = arenaRadius();

      // Rotating gravity — starts pointing down, then circles the screen
      const gravityAngle = Math.PI / 2 + now / 1000 * GRAVITY_ROTATION_SPEED;
      const gx = Math.cos(gravityAngle) * GRAVITY;
      const gy = Math.sin(gravityAngle) * GRAVITY;

      for (const ball of balls) {
        ball.vx += gx * dt;
        ball.vy += gy * dt;
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;

        // Circular wall collision
        const dx = ball.x - cx;
        const dy = ball.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const limit = ar - BALL_RADIUS;
        if (dist > limit) {
          const nx = dx / dist;
          const ny = dy / dist;
          ball.x = cx + nx * limit;
          ball.y = cy + ny * limit;
          // Reflect velocity along normal
          const dot = ball.vx * nx + ball.vy * ny;
          ball.vx = (ball.vx - 2 * dot * nx) * RESTITUTION;
          ball.vy = (ball.vy - 2 * dot * ny) * RESTITUTION;
        }
      }

      // Ball-to-ball collisions
      for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
          const a = balls[i];
          const b = balls[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = BALL_RADIUS * 2;

          if (dist < minDist && dist > 0) {
            const nx = dx / dist;
            const ny = dy / dist;

            // Separate
            const overlap = (minDist - dist) / 2;
            a.x += nx * overlap;
            a.y += ny * overlap;
            b.x -= nx * overlap;
            b.y -= ny * overlap;

            // Elastic response
            const dvx = a.vx - b.vx;
            const dvy = a.vy - b.vy;
            const dvDotN = dvx * nx + dvy * ny;

            if (dvDotN > 0) continue;

            a.vx -= dvDotN * nx;
            a.vy -= dvDotN * ny;
            b.vx += dvDotN * nx;
            b.vy += dvDotN * ny;
          }
        }
      }

      // Draw
      ctx.clearRect(0, 0, s, s);

      // Clip to circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, ar, 0, Math.PI * 2);
      ctx.clip();

      ctx.fillStyle = '#3b82f6';
      for (const ball of balls) {
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Draw circle border
      ctx.beginPath();
      ctx.arc(cx, cy, ar - 1, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.1)';
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    animationId = requestAnimationFrame(animate);

    const onResize = () => {
      resize();
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', onResize);
    };
  }, [salesCount]);

  return (
    <canvas ref={canvasRef} className="rounded-full w-full h-full" />
  );
}
