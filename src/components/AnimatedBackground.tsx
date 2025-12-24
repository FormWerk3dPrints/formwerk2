/*icosaedro 3d rotacionando*/
"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function AnimatedBackground() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | undefined>(undefined);
  const rendererRef = useRef<THREE.WebGLRenderer | undefined>(undefined);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(-7, 0, 6);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    rendererRef.current = renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0); // transparent
    container.appendChild(renderer.domElement);

    const geometry = new THREE.IcosahedronGeometry(2.4, 0);
    const material = new THREE.MeshStandardMaterial({
      color: 0x3aa6e9, // lighter base color
      metalness: 0.15,
      roughness: 0.35,
      emissive: 0x5bc6ff, // brighter emissive
      emissiveIntensity: 0.35,
      flatShading: true,
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.7);
    keyLight.position.set(3, 4, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x8ab6ff, 0.5);
    fillLight.position.set(-4, -2, 3);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x42c9ff, 0.4);
    rimLight.position.set(-2, 3, -4);
    scene.add(rimLight);

    const ambient = new THREE.AmbientLight(0xffffff, 0.15);
    scene.add(ambient);

    const resize = () => {
      const { clientWidth, clientHeight } = container;
      const width = clientWidth || 1;
      const height = clientHeight || 1;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    resize();
    window.addEventListener("resize", resize);

    const animate = () => {
      mesh.rotation.x += 0.0035;
      mesh.rotation.y += 0.0045;
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
      container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 z-0 pointer-events-none" />
  );
}
