/*objetos aleatórios renderizados, sensíveis à gravidade e scroll*/
"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function AnimatedBackground3() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | undefined>(undefined);
  const rendererRef = useRef<THREE.WebGLRenderer | undefined>(undefined);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 6);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    rendererRef.current = renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0); // transparent
    container.appendChild(renderer.domElement);

    // Different polyhedra (reused geometries)
    const geometries: THREE.BufferGeometry[] = [
      new THREE.TetrahedronGeometry(1, 0),
      new THREE.OctahedronGeometry(1, 0),
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.BoxGeometry(1, 1, 1),
    ];
    for (const g of geometries) g.computeBoundingSphere();
    const baseRadii = geometries.map((g) => g.boundingSphere?.radius ?? 1);

    const material = new THREE.MeshStandardMaterial({
      color: 0xeaf5ff,
      metalness: 0.0,
      roughness: 1.0,
      emissive: 0xd8efff,
      emissiveIntensity: 0.05,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      flatShading: true,
    });

    const POLY_COUNT = 5;
    const MIN_SCALE = 1;
    const MAX_SCALE = 1;

    type Body = {
      mesh: THREE.Mesh;
      radius: number;
      velocity: THREE.Vector2;
      travelDir3: THREE.Vector3;
      rollAxis: THREE.Vector3;
    };

    const bodies: Body[] = [];
    const randomVelocity = () => {
      // Slow movement (world units / sec)
      const sx = (Math.random() * 0.18 + 0.05) * (Math.random() < 0.5 ? -1 : 1);
      const sy = (Math.random() * 0.12 + 0.03) * (Math.random() < 0.5 ? -1 : 1);
      return new THREE.Vector2(sx, sy);
    };

    for (let i = 0; i < POLY_COUNT; i++) {
      const geomIndex = Math.floor(Math.random() * geometries.length);
      const geometry = geometries[geomIndex];
      const baseRadius = baseRadii[geomIndex];
      const scale = THREE.MathUtils.lerp(MIN_SCALE, MAX_SCALE, Math.random());

      const mesh = new THREE.Mesh(geometry, material);
      mesh.scale.setScalar(scale);
      scene.add(mesh);

      bodies.push({
        mesh,
        radius: baseRadius * scale,
        velocity: randomVelocity(),
        travelDir3: new THREE.Vector3(),
        rollAxis: new THREE.Vector3(),
      });
    }

    const clock = new THREE.Clock();

    let halfW = 1;
    let halfH = 1;
    const updateFrustumBounds = () => {
      // All meshes share same Z (0).
      const distance = Math.abs(camera.position.z);
      const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distance;
      const halfWidth = halfHeight * camera.aspect;
      halfW = halfWidth;
      halfH = halfHeight;
    };

    const setRandomPositions = () => {
      updateFrustumBounds();
      for (const b of bodies) {
        const r = b.radius;
        b.mesh.position.x = THREE.MathUtils.randFloat(-halfW + r, halfW - r);
        b.mesh.position.y = THREE.MathUtils.randFloat(-halfH + r, halfH - r);
      }
    };

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.35);
    keyLight.position.set(3, 4, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x8ab6ff, 0.22);
    fillLight.position.set(-4, -2, 3);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x42c9ff, 0.12);
    rimLight.position.set(-2, 3, -4);
    scene.add(rimLight);

    const ambient = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambient);

    const resize = () => {
      const { clientWidth, clientHeight } = container;
      const width = clientWidth || 1;
      const height = clientHeight || 1;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);

      updateFrustumBounds();
      // Keep all meshes within bounds after resize
      for (const b of bodies) {
        const r = b.radius;
        b.mesh.position.x = THREE.MathUtils.clamp(b.mesh.position.x, -halfW + r, halfW - r);
        b.mesh.position.y = THREE.MathUtils.clamp(b.mesh.position.y, -halfH + r, halfH - r);
      }
    };

    const ro = new ResizeObserver(() => resize());
    ro.observe(container);
    resize();
    setRandomPositions();

    // Physics params
    const gravity = 1.2; // world units / s^2 (down is -Y)
    const wallRestitution = 0.75;
    const pairRestitution = 0.55;
    const linearDamping = 0.995;

    // Scroll agitation
    let lastScrollY = typeof window !== "undefined" ? window.scrollY : 0;
    let scrollEnergy = 0;
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastScrollY;
      lastScrollY = y;
      // Stronger agitation input from scroll.
      scrollEnergy += Math.min(1200, Math.abs(dy) * 2);
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const tmp = new THREE.Vector2();
    const n = new THREE.Vector2();

    const animate = () => {
      const dt = Math.min(0.05, clock.getDelta());

      // Add scroll agitation (decays over time)
      const shake = Math.min(2, scrollEnergy / 260);
      if (shake > 0.0001) {
        for (const b of bodies) {
          b.velocity.x += (Math.random() * 2 - 1) * shake * 0.22;
          // Slight upward bias so it reads as "agitated" against gravity.
          b.velocity.y += ((Math.random() * 2 - 1) * 0.18 + 0.08) * shake;
        }
      }
      scrollEnergy *= 0.92;

      // Integrate forces + move
      for (const b of bodies) {
        const { mesh, velocity } = b;

        // gravity
        velocity.y -= gravity * dt;

        // damping
        velocity.multiplyScalar(linearDamping);

        mesh.position.x += velocity.x * dt;
        mesh.position.y += velocity.y * dt;
      }

      // Collisions (sphere approximation)
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          const a = bodies[i];
          const b = bodies[j];

          const ax = a.mesh.position.x;
          const ay = a.mesh.position.y;
          const bx = b.mesh.position.x;
          const by = b.mesh.position.y;

          const dx = bx - ax;
          const dy = by - ay;
          const r = a.radius + b.radius;
          const distSq = dx * dx + dy * dy;
          if (distSq >= r * r) continue;

          const dist = Math.max(1e-6, Math.sqrt(distSq));
          n.set(dx / dist, dy / dist);

          // Positional correction (separate)
          const penetration = r - dist;
          const correction = penetration * 0.5;
          a.mesh.position.x -= n.x * correction;
          a.mesh.position.y -= n.y * correction;
          b.mesh.position.x += n.x * correction;
          b.mesh.position.y += n.y * correction;

          // Relative velocity along normal
          tmp.set(b.velocity.x - a.velocity.x, b.velocity.y - a.velocity.y);
          const velAlongNormal = tmp.dot(n);
          if (velAlongNormal > 0) continue;

          const jImpulse = (-(1 + pairRestitution) * velAlongNormal) / 2;
          const ix = jImpulse * n.x;
          const iy = jImpulse * n.y;
          a.velocity.x -= ix;
          a.velocity.y -= iy;
          b.velocity.x += ix;
          b.velocity.y += iy;
        }
      }

      // Walls + roll rotation
      for (const b of bodies) {
        const { mesh, velocity, travelDir3, rollAxis } = b;
        const r = b.radius;

        // Bounce on walls
        if (mesh.position.x >= halfW - r) {
          mesh.position.x = halfW - r;
          velocity.x = -Math.abs(velocity.x) * wallRestitution;
        } else if (mesh.position.x <= -halfW + r) {
          mesh.position.x = -halfW + r;
          velocity.x = Math.abs(velocity.x) * wallRestitution;
        }

        if (mesh.position.y >= halfH - r) {
          mesh.position.y = halfH - r;
          velocity.y = -Math.abs(velocity.y) * wallRestitution;
        } else if (mesh.position.y <= -halfH + r) {
          mesh.position.y = -halfH + r;
          velocity.y = Math.abs(velocity.y) * wallRestitution;
          // slight floor friction
          velocity.x *= 0.98;
        }

        // Roll forward along movement direction
        const speed = velocity.length();
        if (speed > 1e-6) {
          travelDir3.set(velocity.x, velocity.y, 0).normalize();
          rollAxis.set(-travelDir3.y, travelDir3.x, 0).normalize();
          const omega = speed / Math.max(0.08, r);
          mesh.rotateOnAxis(rollAxis, omega * dt);
        }
      }

      renderer.render(scene, camera);
      frameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      window.removeEventListener("scroll", onScroll);
      ro.disconnect();
      renderer.dispose();
      for (const g of geometries) g.dispose();
      material.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 z-0 pointer-events-none" />
  );
}
