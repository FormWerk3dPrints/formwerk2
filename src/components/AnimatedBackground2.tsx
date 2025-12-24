"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function AnimatedBackground2() {
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

    const geometry = new THREE.IcosahedronGeometry(1.4, 0);
    const material = new THREE.MeshStandardMaterial({
      // Very subtle tint so it blends with the hero gradient.
      color: 0xeaf5ff,
      metalness: 0.0,
      roughness: 1.0,
      emissive: 0xd8efff,
      emissiveIntensity: 0.06,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      flatShading: true,
    });

    // 20 small polyhedra
    const POLY_COUNT = 20;
    const POLY_SCALE = 0.22; // much smaller
    const baseRadius = 1.4;
    const getRadius = () => baseRadius * POLY_SCALE;

    type Poly = {
      mesh: THREE.Mesh;
      velocity: THREE.Vector2;
      travelDir3: THREE.Vector3;
      rollAxis: THREE.Vector3;
    };

    const polys: Poly[] = [];
    const randomVelocity = () => {
      // Reduced speed (world units / sec)
      const sx = (Math.random() * 0.22 + 0.08) * (Math.random() < 0.5 ? -1 : 1);
      const sy = (Math.random() * 0.18 + 0.06) * (Math.random() < 0.5 ? -1 : 1);
      return new THREE.Vector2(sx, sy);
    };

    for (let i = 0; i < POLY_COUNT; i++) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.scale.setScalar(POLY_SCALE);
      scene.add(mesh);

      polys.push({
        mesh,
        velocity: randomVelocity(),
        travelDir3: new THREE.Vector3(),
        rollAxis: new THREE.Vector3(),
      });
    }

    const clock = new THREE.Clock();

    let halfW = 1;
    let halfH = 1;
    const updateFrustumBounds = () => {
      // all meshes share same Z
      const distance = Math.abs(camera.position.z);
      const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distance;
      const halfWidth = halfHeight * camera.aspect;
      halfW = halfWidth;
      halfH = halfHeight;
    };

    const setRandomPositions = () => {
      updateFrustumBounds();
      const r = getRadius();
      for (const p of polys) {
        p.mesh.position.x = THREE.MathUtils.randFloat(-halfW + r, halfW - r);
        p.mesh.position.y = THREE.MathUtils.randFloat(-halfH + r, halfH - r);
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
      const r = getRadius();
      for (const p of polys) {
        p.mesh.position.x = THREE.MathUtils.clamp(p.mesh.position.x, -halfW + r, halfW - r);
        p.mesh.position.y = THREE.MathUtils.clamp(p.mesh.position.y, -halfH + r, halfH - r);
      }
    };

    resize();
    setRandomPositions();
    window.addEventListener("resize", resize);

    const animate = () => {
      const dt = Math.min(0.05, clock.getDelta());

      const r = getRadius();
      for (const p of polys) {
        const { mesh, velocity, travelDir3, rollAxis } = p;

        // Roll "forward" along the current movement direction.
        const speed = velocity.length();
        if (speed > 1e-6) {
          travelDir3.set(velocity.x, velocity.y, 0).normalize();
          rollAxis.set(-travelDir3.y, travelDir3.x, 0).normalize();

          // Angular speed ~ v / r (rolling). Clamp radius to avoid extreme values.
          const omega = speed / Math.max(0.12, r);
          mesh.rotateOnAxis(rollAxis, omega * dt);
        }

        // Movement
        mesh.position.x += velocity.x * dt;
        mesh.position.y += velocity.y * dt;

        // Bounce when hitting the screen edge
        if (mesh.position.x >= halfW - r) {
          mesh.position.x = halfW - r;
          velocity.x = -Math.abs(velocity.x);
        } else if (mesh.position.x <= -halfW + r) {
          mesh.position.x = -halfW + r;
          velocity.x = Math.abs(velocity.x);
        }

        if (mesh.position.y >= halfH - r) {
          mesh.position.y = halfH - r;
          velocity.y = -Math.abs(velocity.y);
        } else if (mesh.position.y <= -halfH + r) {
          mesh.position.y = -halfH + r;
          velocity.y = Math.abs(velocity.y);
        }
      }

      renderer.render(scene, camera);
      frameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", resize);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 z-0 pointer-events-none" />
  );
}
