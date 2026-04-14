"use client";
import { useRef, useEffect } from "react";
import * as THREE from "three";

interface AnimatedSales3Props {
  salesCount: number;
  started?: boolean;
}

const COLS = 7;
const ROWS = 4;
const PER_LAYER = COLS * ROWS;
const BOX_W = 1.0;
const BOX_H = 0.7;
const BOX_D = 1.0;
const GAP = 0.02;
const GRAVITY = -15;
const FLOOR_Y = 0;

interface FallingBox {
  mesh: THREE.Mesh;
  targetY: number;
  vy: number;
  landed: boolean;
  col: number;
  row: number;
  layer: number;
}

export default function AnimatedSales3({ salesCount, started = true }: AnimatedSales3Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(started);

  useEffect(() => {
    startedRef.current = started;
  }, [started]);

  useEffect(() => {
    if (!salesCount) return;
    const container = containerRef.current;
    if (!container) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeff6ff);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      200
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(8, 15, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 50;
    dirLight.shadow.camera.left = -15;
    dirLight.shadow.camera.right = 15;
    dirLight.shadow.camera.top = 15;
    dirLight.shadow.camera.bottom = -5;
    scene.add(dirLight);

    // Floor
    const floorGeo = new THREE.PlaneGeometry(30, 30);
    const floorMat = new THREE.MeshBasicMaterial({ color: 0xdbeafe });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = FLOOR_Y;
    floor.receiveShadow = true;
    scene.add(floor);

    // Cardboard texture (procedural)
    const cardboardCanvas = document.createElement("canvas");
    cardboardCanvas.width = 128;
    cardboardCanvas.height = 128;
    const tctx = cardboardCanvas.getContext("2d")!;
    tctx.fillStyle = "#c4945a";
    tctx.fillRect(0, 0, 128, 128);
    // Add grain
    for (let i = 0; i < 3000; i++) {
      const gx = Math.random() * 128;
      const gy = Math.random() * 128;
      tctx.fillStyle = `rgba(${100 + Math.random() * 60}, ${70 + Math.random() * 40}, ${40 + Math.random() * 30}, 0.15)`;
      tctx.fillRect(gx, gy, 1, 1);
    }
    // Tape lines
    tctx.strokeStyle = "rgba(180, 160, 100, 0.35)";
    tctx.lineWidth = 6;
    tctx.beginPath();
    tctx.moveTo(64, 0);
    tctx.lineTo(64, 128);
    tctx.stroke();
    tctx.beginPath();
    tctx.moveTo(0, 64);
    tctx.lineTo(128, 64);
    tctx.stroke();

    // Create per-face overlay canvases
    // BoxGeometry face order: 0=+X(right), 1=-X(left), 2=+Y(top), 3=-Y(bottom), 4=+Z(front), 5=-Z(back)
    const S = 128;
    function makeOverlay(): [HTMLCanvasElement, CanvasRenderingContext2D] {
      const c = document.createElement("canvas");
      c.width = S;
      c.height = S;
      return [c, c.getContext("2d")!];
    }

    const overlays: HTMLCanvasElement[] = [];

    // Right (+X): PNG overlay
    {
      const [c] = makeOverlay();
      overlays.push(c);
      const rightImg = new Image();
      rightImg.src = "/images/assets/right-box.png";
      rightImg.onload = () => {
        const ctx = c.getContext("2d")!;
        ctx.drawImage(rightImg, 0, 0, S, S);
        const compCanvas = faceTextures[0].image as HTMLCanvasElement;
        const compCtx = compCanvas.getContext("2d")!;
        compCtx.clearRect(0, 0, S, S);
        compCtx.drawImage(cardboardCanvas, 0, 0);
        compCtx.drawImage(c, 0, 0);
        faceTextures[0].needsUpdate = true;
      };
    }

    // Left (-X): horizontal grip lines
    {
      const [c, ctx] = makeOverlay();
      ctx.strokeStyle = "rgba(120, 80, 40, 0.18)";
      ctx.lineWidth = 2;
      for (let y = 38; y <= 92; y += 9) {
        ctx.beginPath();
        ctx.moveTo(25, y);
        ctx.lineTo(103, y);
        ctx.stroke();
      }
      overlays.push(c);
    }

    // Top (+Y): PNG overlay
    {
      const [c] = makeOverlay();
      overlays.push(c);
      const topImg = new Image();
      topImg.src = "/images/assets/top-box2.png";
      topImg.onload = () => {
        const ctx = c.getContext("2d")!;
        ctx.drawImage(topImg, 0, 0, S, S);
        // Recomposite this face texture
        const compCanvas = faceTextures[2].image as HTMLCanvasElement;
        const compCtx = compCanvas.getContext("2d")!;
        compCtx.clearRect(0, 0, S, S);
        compCtx.drawImage(cardboardCanvas, 0, 0);
        compCtx.drawImage(c, 0, 0);
        faceTextures[2].needsUpdate = true;
      };
    }

    // Bottom (-Y): small stamp circle
    {
      const [c, ctx] = makeOverlay();
      ctx.strokeStyle = "rgba(120, 80, 40, 0.12)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(64, 64, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(64, 64, 15, 0, Math.PI * 2);
      ctx.stroke();
      overlays.push(c);
    }

    // Front (+Z): PNG overlay
    {
      const [c] = makeOverlay();
      overlays.push(c);
      const frontImg = new Image();
      frontImg.src = "/images/assets/front-box2.0.png";
      frontImg.onload = () => {
        const ctx = c.getContext("2d")!;
        ctx.drawImage(frontImg, 0, 0, S, S);
        const compCanvas = faceTextures[4].image as HTMLCanvasElement;
        const compCtx = compCanvas.getContext("2d")!;
        compCtx.clearRect(0, 0, S, S);
        compCtx.drawImage(cardboardCanvas, 0, 0);
        compCtx.drawImage(c, 0, 0);
        faceTextures[4].needsUpdate = true;
      };
    }

    // Back (-Z): diagonal cross marks
    {
      const [c, ctx] = makeOverlay();
      ctx.strokeStyle = "rgba(120, 80, 40, 0.14)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(38, 38);
      ctx.lineTo(90, 90);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(90, 38);
      ctx.lineTo(38, 90);
      ctx.stroke();
      overlays.push(c);
    }

    // Composite: cardboard base + face overlay for each face
    const faceTextures = overlays.map((overlay) => {
      const canvas = document.createElement("canvas");
      canvas.width = S;
      canvas.height = S;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(cardboardCanvas, 0, 0);
      ctx.drawImage(overlay, 0, 0);
      return new THREE.CanvasTexture(canvas);
    });

    // Shared geometry
    const boxGeo = new THREE.BoxGeometry(BOX_W, BOX_H, BOX_D);

    // Compute grid positions
    const totalLayers = Math.ceil(salesCount / PER_LAYER);
    const gridOffsetX = -(COLS * (BOX_W + GAP) - GAP) / 2 + BOX_W / 2;
    const gridOffsetZ = -(ROWS * (BOX_D + GAP) - GAP) / 2 + BOX_D / 2;

    // Create all boxes
    const boxes: FallingBox[] = [];
    for (let i = 0; i < salesCount; i++) {
      const layer = Math.floor(i / PER_LAYER);
      const posInLayer = i % PER_LAYER;
      const col = posInLayer % COLS;
      const row = Math.floor(posInLayer / COLS);

      const targetY = FLOOR_Y + BOX_H / 2 + layer * BOX_H;
      const x = gridOffsetX + col * (BOX_W + GAP);
      const z = gridOffsetZ + row * (BOX_D + GAP);

      // Slight color variation per box
      const hueShift = (Math.random() - 0.5) * 0.06;
      const baseColor = new THREE.Color(0xc4945a);
      baseColor.offsetHSL(hueShift, -0.05 + Math.random() * 0.1, -0.03 + Math.random() * 0.06);

      const materials = faceTextures.map((tex) => new THREE.MeshStandardMaterial({
        map: tex,
        color: baseColor,
        roughness: 0.9,
        metalness: 0,
      }));

      const mesh = new THREE.Mesh(boxGeo, materials);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.set(x, 20 + Math.random() * 10 + layer * 3, z);
      mesh.visible = false; // hidden until dropped

      scene.add(mesh);
      boxes.push({
        mesh,
        targetY,
        vy: 0,
        landed: false,
        col,
        row,
        layer,
      });
    }

    // Camera position — look at center of the stack, offset to the right
    const stackHeight = totalLayers * BOX_H;
    const centerY = FLOOR_Y + stackHeight / 2;
    const aspect = container.clientWidth / container.clientHeight;
    const offsetX = (COLS * (BOX_W + GAP)) * -.25 * aspect;
    camera.position.set(
      COLS * 0.8 + offsetX,
      Math.max(stackHeight * 1.2, 4) + 2,
      ROWS * 2.5 + 3
    );
    camera.lookAt(offsetX, centerY, 0);

    // Inverse ease-in-out cubic: makes drop RATE follow ease-in-out
    // (slow at start, fast in middle, slow at end)
    function inverseEaseInOutCubic(y: number): number {
      if (y < 0.5) {
        return Math.cbrt(y / 4);
      } else {
        return 1 - Math.cbrt((1 - y) / 4);
      }
    }

    // Animation
    const clock = new THREE.Clock();
    let animationId: number;
    let dropTimer = 0;
    let nextDrop = 0;
    const BOUNCE_DAMPING = 0.3;
    const ANIMATION_DURATION = 2.5; // seconds

    // Pre-compute eased drop times for each box
    const dropTimes: number[] = [];
    for (let i = 0; i < boxes.length; i++) {
      const p = boxes.length > 1 ? i / (boxes.length - 1) : 0;
      dropTimes.push(inverseEaseInOutCubic(p) * ANIMATION_DURATION);
    }

    let hasStarted = false;

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);

      if (!startedRef.current) {
        renderer.render(scene, camera);
        return;
      }

      if (!hasStarted) {
        hasStarted = true;
        clock.getDelta(); // reset delta to avoid big jump
      }

      // Drop boxes with eased timing
      dropTimer += dt;
      while (nextDrop < boxes.length && dropTimer >= dropTimes[nextDrop]) {
        boxes[nextDrop].mesh.visible = true;
        nextDrop++;
      }

      // Physics for each visible box
      for (const box of boxes) {
        if (!box.mesh.visible || box.landed) continue;

        box.vy += GRAVITY * dt;
        box.mesh.position.y += box.vy * dt;

        // Collision with target position (stacking)
        if (box.mesh.position.y <= box.targetY) {
          box.mesh.position.y = box.targetY;
          box.vy = 0;
          box.landed = true;
        }

        // Slight wobble while falling
        if (!box.landed) {
          box.mesh.rotation.z = Math.sin(box.mesh.position.y * 2 + box.col) * 0.04;
          box.mesh.rotation.x = Math.sin(box.mesh.position.y * 1.5 + box.row) * 0.03;
        } else {
          box.mesh.rotation.z = 0;
          box.mesh.rotation.x = 0;
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    // Resize
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [salesCount]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
