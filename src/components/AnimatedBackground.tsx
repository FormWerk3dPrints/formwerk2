/*icosaedro 3d rotacionando*/
"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Icosaedro girando, usado como indicador de carregamento na home.
 *
 * Antes existiam dois arquivos iguais (este e AnimatedBackgroundMobile), os
 * dois montados ao mesmo tempo e escondidos por CSS: eram dois contextos
 * WebGL e dois laços infinitos, sendo que só um aparecia. Agora é um só, e a
 * distância da câmera é escolhida pela largura da janela.
 *
 * O laço para quando o elemento sai da tela, quando a aba vai para segundo
 * plano e quando o sistema pede menos animação.
 */
export default function AnimatedBackground() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const semMovimento = window.matchMedia("(prefers-reduced-motion: reduce)");

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, -1.5, 10);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
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
      const aspect = width / height;

      camera.aspect = aspect;

      // No celular o objeto ficava grande demais, por isso a câmera recua um
      // pouco mais — era a única diferença entre os dois componentes antigos.
      const telaEstreita = window.innerWidth < 768;
      const base = telaEstreita ? 11 : 10;
      const teto = telaEstreita ? 17 : 16;

      let distance = base;
      if (aspect > 1.2) {
        // Em telas mais largas, recuar um pouco
        distance = base + (aspect - 1.2) * 1.5;
      } else if (aspect < 0.8) {
        // Em telas mais altas (portrait), recuar também
        distance = base + (0.8 - aspect) * 2;
      }

      camera.position.z = Math.min(distance, teto);
      camera.position.y = -1.5;

      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      renderer.render(scene, camera);
    };

    let frameId = 0;
    let naTela = false;

    const animate = () => {
      mesh.rotation.x += 0.007;
      mesh.rotation.y += 0.009;
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };

    const retomar = () => {
      if (frameId || !naTela || document.hidden || semMovimento.matches) return;
      frameId = requestAnimationFrame(animate);
    };

    const parar = () => {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = 0;
    };

    resize();
    window.addEventListener("resize", resize);

    const io = new IntersectionObserver(
      ([entry]) => {
        naTela = entry.isIntersecting;
        if (naTela) retomar();
        else parar();
      },
      { threshold: 0 },
    );
    io.observe(container);

    const aoTrocarAba = () => (document.hidden ? parar() : retomar());
    document.addEventListener("visibilitychange", aoTrocarAba);
    semMovimento.addEventListener("change", aoTrocarAba);

    return () => {
      parar();
      io.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", aoTrocarAba);
      semMovimento.removeEventListener("change", aoTrocarAba);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 z-0 pointer-events-none" aria-hidden="true" />
  );
}
