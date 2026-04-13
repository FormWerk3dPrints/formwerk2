"use client";
import { useRef, useEffect } from "react";

interface AnimatedSales2Props {
  salesCount: number;
}

interface Boat {
  x: number;
  y: number;
  angle: number;
  speed: number;
  drift: number;
  phase: number;
  state: "sailing" | "approaching" | "docked";
  targetIsland: number;
  lastIsland: number;
  dockTimer: number;
  baseSpeed: number;
}

interface Island {
  x: number;
  y: number;
  points: { rx: number; ry: number }[]; // irregular shape offsets
  baseRadius: number;
  rotation: number;
}

const BOAT_LENGTH = 18;
const BOAT_WIDTH = 8;
const WAVE_SPEED = 0.4;
const WAVE_AMPLITUDE = 3;
const ISLAND_COUNT = 5;
const DOCK_DURATION = 4; // seconds docked

export default function AnimatedSales2({ salesCount }: AnimatedSales2Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!salesCount) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let cw = 0;
    let ch = 0;

    const resize = () => {
      const parent = canvas.parentElement!;
      cw = parent.clientWidth;
      ch = parent.clientHeight;
      canvas.width = cw * devicePixelRatio;
      canvas.height = ch * devicePixelRatio;
      canvas.style.width = cw + "px";
      canvas.style.height = ch + "px";
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    };
    resize();

    // Create islands (spread across canvas, no overlap)
    const islands: Island[] = [];
    for (let i = 0; i < ISLAND_COUNT; i++) {
      const baseRadius = 45 + Math.random() * 40;
      const pointCount = 8 + Math.floor(Math.random() * 5);
      const points: { rx: number; ry: number }[] = [];
      for (let p = 0; p < pointCount; p++) {
        points.push({
          rx: baseRadius * (0.7 + Math.random() * 0.6),
          ry: baseRadius * (0.5 + Math.random() * 0.5),
        });
      }

      // Try placing without overlapping existing islands
      let placed = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const x = cw * 0.12 + Math.random() * cw * 0.76;
        const y = ch * 0.12 + Math.random() * ch * 0.76;
        const overlaps = islands.some((other) => {
          const dx = other.x - x;
          const dy = other.y - y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          return dist < other.baseRadius + baseRadius + 20;
        });
        if (!overlaps) {
          islands.push({ x, y, points, baseRadius, rotation: Math.random() * Math.PI * 2 });
          placed = true;
          break;
        }
      }
      if (!placed) {
        // skip this island if no valid position found
      }
    }

    // Helper: check if point is inside any island
    const isInsideIsland = (px: number, py: number) => {
      return islands.some((isl) => {
        const dx = px - isl.x;
        const dy = py - isl.y;
        return Math.sqrt(dx * dx + dy * dy) < isl.baseRadius + BOAT_LENGTH;
      });
    };

    // Create boats (never inside an island)
    const boats: Boat[] = [];
    for (let i = 0; i < salesCount; i++) {
      const baseSpeed = 8 + Math.random() * 12;
      let bx = 0, by = 0;
      for (let attempt = 0; attempt < 100; attempt++) {
        bx = Math.random() * cw;
        by = Math.random() * ch;
        if (!isInsideIsland(bx, by)) break;
      }
      boats.push({
        x: bx,
        y: by,
        angle: Math.random() * Math.PI * 2,
        speed: baseSpeed,
        drift: (Math.random() - 0.5) * 0.3,
        phase: Math.random() * Math.PI * 2,
        state: "sailing",
        targetIsland: -1,
        lastIsland: -1,
        dockTimer: 0,
        baseSpeed,
      });
    }

    let animationId: number;
    let lastTime = performance.now();

    const drawIsland = (island: Island) => {
      const { x, y, points, rotation } = island;
      const n = points.length;

      // Build smooth irregular shape points
      const shapePoints: { sx: number; sy: number }[] = [];
      for (let i = 0; i < n; i++) {
        const angle = rotation + (i / n) * Math.PI * 2;
        shapePoints.push({
          sx: x + Math.cos(angle) * points[i].rx,
          sy: y + Math.sin(angle) * points[i].ry,
        });
      }

      // Draw sand (outer)
      ctx.beginPath();
      ctx.moveTo(
        (shapePoints[n - 1].sx + shapePoints[0].sx) / 2,
        (shapePoints[n - 1].sy + shapePoints[0].sy) / 2
      );
      for (let i = 0; i < n; i++) {
        const next = shapePoints[(i + 1) % n];
        const mx = (shapePoints[i].sx + next.sx) / 2;
        const my = (shapePoints[i].sy + next.sy) / 2;
        ctx.quadraticCurveTo(shapePoints[i].sx, shapePoints[i].sy, mx, my);
      }
      ctx.closePath();
      ctx.fillStyle = "#e8d5a3";
      ctx.fill();
      ctx.strokeStyle = "#c4a96a";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw green interior (smaller)
      ctx.beginPath();
      const scale = 0.65;
      const firstInner = shapePoints[n - 1];
      const secondInner = shapePoints[0];
      ctx.moveTo(
        x + (firstInner.sx - x) * scale / 2 + (secondInner.sx - x) * scale / 2,
        y + (firstInner.sy - y) * scale / 2 + (secondInner.sy - y) * scale / 2
      );
      for (let i = 0; i < n; i++) {
        const next = shapePoints[(i + 1) % n];
        const cpx = x + (shapePoints[i].sx - x) * scale;
        const cpy = y + (shapePoints[i].sy - y) * scale;
        const mx = x + ((shapePoints[i].sx - x) + (next.sx - x)) * scale / 2;
        const my = y + ((shapePoints[i].sy - y) + (next.sy - y)) * scale / 2;
        ctx.quadraticCurveTo(cpx, cpy, mx, my);
      }
      ctx.closePath();
      ctx.fillStyle = "#4a9e38";
      ctx.fill();
    };

    const drawBoat = (x: number, y: number, angle: number, bobOffset: number) => {
      ctx.save();
      ctx.translate(x, y + bobOffset);
      ctx.rotate(angle);

      // Hull
      ctx.beginPath();
      ctx.moveTo(BOAT_LENGTH / 2, 0);
      ctx.lineTo(-BOAT_LENGTH / 2, -BOAT_WIDTH / 2);
      ctx.quadraticCurveTo(-BOAT_LENGTH / 2 - 3, 0, -BOAT_LENGTH / 2, BOAT_WIDTH / 2);
      ctx.closePath();
      ctx.fillStyle = "#8B4513";
      ctx.fill();
      ctx.strokeStyle = "#5C2D0A";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Sail
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(2, -BOAT_WIDTH * 0.9);
      ctx.lineTo(-BOAT_LENGTH * 0.25, -BOAT_WIDTH * 0.3);
      ctx.closePath();
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 0.9;
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.restore();
    };

    const drawWaves = (now: number) => {
      const t = now / 1000;
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1.5;

      for (let row = 0; row < ch + 30; row += 25) {
        ctx.beginPath();
        for (let x = -10; x <= cw + 10; x += 4) {
          const y = row + Math.sin(x * 0.02 + t * WAVE_SPEED + row * 0.1) * WAVE_AMPLITUDE
                       + Math.sin(x * 0.04 + t * WAVE_SPEED * 1.3) * WAVE_AMPLITUDE * 0.5;
          if (x === -10) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    };

    const animate = (now: number) => {
      animationId = requestAnimationFrame(animate);
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const t = now / 1000;

      // Ocean background
      ctx.fillStyle = "#1a6fb5";
      ctx.fillRect(0, 0, cw, ch);

      // Subtle gradient overlay
      const grad = ctx.createLinearGradient(0, 0, 0, ch);
      grad.addColorStop(0, "rgba(30, 144, 200, 0.3)");
      grad.addColorStop(1, "rgba(10, 60, 100, 0.3)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, cw, ch);

      // Draw waves
      drawWaves(now);

      // Draw islands
      for (const island of islands) {
        drawIsland(island);
      }

      // Count docked/approaching boats for 20% cap
      const maxDocked = Math.max(1, Math.floor(boats.length * 0.2));
      let dockedCount = 0;
      for (const b of boats) {
        if (b.state === "docked" || b.state === "approaching") dockedCount++;
      }

      // Update and draw boats
      for (const boat of boats) {
        if (boat.state === "sailing") {
          // Randomly decide to approach an island (only if under 20% cap)
          if (Math.random() < 0.002 && dockedCount < maxDocked && islands.length > 0) {
            // Pick nearest island that is not the last one visited
            const candidates = islands
              .map((isl, idx) => {
                const dx = isl.x - boat.x;
                const dy = isl.y - boat.y;
                return { idx, dist: Math.sqrt(dx * dx + dy * dy) };
              })
              .filter((c) => c.idx !== boat.lastIsland)
              .sort((a, b) => a.dist - b.dist);

            if (candidates.length > 0) {
              boat.targetIsland = candidates[0].idx;
              boat.state = "approaching";
              dockedCount++;
            }
          }

          // Normal sailing
          boat.x += Math.cos(boat.angle) * boat.speed * dt;
          boat.y += Math.sin(boat.angle) * boat.speed * dt;
          boat.angle += boat.drift * dt;
          boat.angle += Math.sin(t * 0.5 + boat.phase) * 0.1 * dt;

        } else if (boat.state === "approaching") {
          const island = islands[boat.targetIsland];
          const dx = island.x - boat.x;
          const dy = island.y - boat.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const dockDist = island.baseRadius + BOAT_LENGTH * 0.6;

          // Steer toward island
          const targetAngle = Math.atan2(dy, dx);
          let angleDiff = targetAngle - boat.angle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          boat.angle += angleDiff * 2 * dt;

          // Slow down as approaching
          const approachSpeed = Math.max(boat.baseSpeed * 0.3, boat.baseSpeed * Math.min(1, dist / 150));
          boat.x += Math.cos(boat.angle) * approachSpeed * dt;
          boat.y += Math.sin(boat.angle) * approachSpeed * dt;

          // Dock when close enough
          if (dist < dockDist) {
            boat.state = "docked";
            boat.dockTimer = 0;
            boat.speed = 0;
          }

        } else if (boat.state === "docked") {
          boat.dockTimer += dt;
          if (boat.dockTimer > DOCK_DURATION) {
            boat.lastIsland = boat.targetIsland;

            // Pick a different island to go to
            const others = islands
              .map((isl, idx) => {
                const dx = isl.x - boat.x;
                const dy = isl.y - boat.y;
                return { idx, dist: Math.sqrt(dx * dx + dy * dy) };
              })
              .filter((c) => c.idx !== boat.lastIsland)
              .sort((a, b) => a.dist - b.dist);

            if (others.length > 0 && dockedCount < maxDocked) {
              boat.targetIsland = others[0].idx;
              boat.state = "approaching";
            } else {
              boat.state = "sailing";
              boat.targetIsland = -1;
            }
            boat.speed = boat.baseSpeed;
            // Initial angle away from current island
            const island = islands[boat.lastIsland];
            boat.angle = Math.atan2(boat.y - island.y, boat.x - island.x);
          }
        }

        // Island avoidance — push boat out and steer around (skip target island when approaching/docked)
        for (let j = 0; j < islands.length; j++) {
          if ((boat.state === "approaching" || boat.state === "docked") && j === boat.targetIsland) continue;
          const isl = islands[j];
          const dx = boat.x - isl.x;
          const dy = boat.y - isl.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const avoidRadius = isl.baseRadius + BOAT_LENGTH;

          if (dist < avoidRadius && dist > 0) {
            // Push out
            const nx = dx / dist;
            const ny = dy / dist;
            boat.x = isl.x + nx * avoidRadius;
            boat.y = isl.y + ny * avoidRadius;

            // Steer tangentially (clockwise) to go around
            const tangentAngle = Math.atan2(ny, nx) + Math.PI / 2;
            let angleDiff = tangentAngle - boat.angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            boat.angle += angleDiff * 4 * dt;
          }
        }

        // Wrap around screen
        if (boat.x > cw + BOAT_LENGTH) boat.x = -BOAT_LENGTH;
        if (boat.x < -BOAT_LENGTH) boat.x = cw + BOAT_LENGTH;
        if (boat.y > ch + BOAT_LENGTH) boat.y = -BOAT_LENGTH;
        if (boat.y < -BOAT_LENGTH) boat.y = ch + BOAT_LENGTH;

        // Bob on waves
        const bob = boat.state === "docked"
          ? Math.sin(t * WAVE_SPEED * 2 + boat.phase) * WAVE_AMPLITUDE * 0.5
          : Math.sin(t * WAVE_SPEED * 2 + boat.phase + boat.x * 0.01) * WAVE_AMPLITUDE;

        drawBoat(boat.x, boat.y, boat.angle, bob);
      }
    };

    animationId = requestAnimationFrame(animate);

    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", onResize);
    };
  }, [salesCount]);

  return (
    <canvas ref={canvasRef} className="w-full h-full rounded-2xl" />
  );
}
