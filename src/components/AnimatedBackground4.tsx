"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function AnimatedBackground4() {
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
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    container.appendChild(renderer.domElement);

    // Chuva de poliedros pequenos e regulares.
    // Use uma geometria regular (icosaedro) e InstancedMesh para performance.
    const geometry = new THREE.IcosahedronGeometry(1, 0);
    geometry.computeBoundingSphere();

    const material = new THREE.MeshStandardMaterial({
      // Bem claro para se camuflar com o background.
      color: 0xeaf5ff,
      metalness: 0.0,
      roughness: 1.0,
      emissive: 0xd8efff,
      emissiveIntensity: 0.04,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      flatShading: true,
    });

    const DROP_COUNT = 90;
    const SCALE_MIN = 0.08;
    const SCALE_MAX = 0.12;

    const instanced = new THREE.InstancedMesh(geometry, material, DROP_COUNT);
    instanced.frustumCulled = false;
    scene.add(instanced);

    // Per-instance state
    const x = new Float32Array(DROP_COUNT);
    const y = new Float32Array(DROP_COUNT);
    const z = new Float32Array(DROP_COUNT);
    const speed = new Float32Array(DROP_COUNT);
    const rotX = new Float32Array(DROP_COUNT);
    const rotY = new Float32Array(DROP_COUNT);
    const rotZ = new Float32Array(DROP_COUNT);
    const rotSpeedX = new Float32Array(DROP_COUNT);
    const rotSpeedY = new Float32Array(DROP_COUNT);
    const rotSpeedZ = new Float32Array(DROP_COUNT);
    const scale = new Float32Array(DROP_COUNT);

    const tempObj = new THREE.Object3D();

    const clock = new THREE.Clock();

    let halfW = 1;
    let halfH = 1;
    const updateFrustumBounds = () => {
      const distance = Math.abs(camera.position.z);
      const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distance;
      const halfWidth = halfHeight * camera.aspect;
      halfW = halfWidth;
      halfH = halfHeight;
    };

    const spawn = (i: number, spawnAboveTop = true) => {
      const s = THREE.MathUtils.lerp(SCALE_MIN, SCALE_MAX, Math.random());
      scale[i] = s;
      const r = (geometry.boundingSphere?.radius ?? 1) * s;

      x[i] = THREE.MathUtils.randFloat(-halfW + r, halfW - r);
      y[i] = spawnAboveTop
        ? halfH + r + Math.random() * (halfH * 1.2)
        : THREE.MathUtils.randFloat(-halfH + r, halfH - r);
      z[i] = THREE.MathUtils.randFloat(-0.8, 0.8);

      // Falling speed (world units / sec)
      speed[i] = 0.55 + Math.random() * 0.95;

      rotX[i] = Math.random() * Math.PI * 2;
      rotY[i] = Math.random() * Math.PI * 2;
      rotZ[i] = Math.random() * Math.PI * 2;

      rotSpeedX[i] = (Math.random() * 2 - 1) * 0.9;
      rotSpeedY[i] = (Math.random() * 2 - 1) * 0.9;
      rotSpeedZ[i] = (Math.random() * 2 - 1) * 0.9;
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
    };

    const ro = new ResizeObserver(() => resize());
    ro.observe(container);
    resize();

    for (let i = 0; i < DROP_COUNT; i++) spawn(i, false);

    const updateInstance = (i: number) => {
      tempObj.position.set(x[i], y[i], z[i]);
      tempObj.rotation.set(rotX[i], rotY[i], rotZ[i]);
      tempObj.scale.setScalar(scale[i]);
      tempObj.updateMatrix();
      instanced.setMatrixAt(i, tempObj.matrix);
    };

    for (let i = 0; i < DROP_COUNT; i++) updateInstance(i);
    instanced.instanceMatrix.needsUpdate = true;

    const animate = () => {
      const dt = Math.min(0.05, clock.getDelta());

      // Update falling polyhedra
      for (let i = 0; i < DROP_COUNT; i++) {
        y[i] -= speed[i] * dt;
        rotX[i] += rotSpeedX[i] * dt;
        rotY[i] += rotSpeedY[i] * dt;
        rotZ[i] += rotSpeedZ[i] * dt;

        const r = (geometry.boundingSphere?.radius ?? 1) * scale[i];
        if (y[i] < -halfH - r - 0.4) {
          spawn(i, true);
        }

        updateInstance(i);
      }
      instanced.instanceMatrix.needsUpdate = true;

      renderer.render(scene, camera);
      frameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      ro.disconnect();
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
