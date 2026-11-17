import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { buildMech, disposeMech } from '../game/mechModels';
import type { ComponentSlot } from '../game/forge';

interface Props {
  equipped: Partial<Record<ComponentSlot, string>>;
  accent: string;
  label: string;
}

/**
 * THE FACTORY FLOOR.
 *
 * A live 3D view of the mech as it is assembled: drag to walk around it,
 * every part you mount shows up on the model.
 */
export default function FactoryView({ equipped, accent, label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mechRef = useRef<THREE.Group | null>(null);
  const sceneRef = useRef<{ renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera } | null>(null);
  const spin = useRef({ yaw: 0.7, pitch: 0.12, dragging: false, lastX: 0, lastY: 0, zoom: 1 });

  // ---------------------------------------------------------------- scene
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0b1214, 14, 34);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
    camera.position.set(0, 3.4, 11);

    scene.add(new THREE.HemisphereLight(0x9fd6e6, 0x141b18, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(5, 9, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -8;
    key.shadow.camera.right = 8;
    key.shadow.camera.top = 10;
    key.shadow.camera.bottom = -4;
    key.shadow.bias = -0.0009;
    scene.add(key);
    const rim = new THREE.DirectionalLight(new THREE.Color(accent), 2.6);
    rim.position.set(-7, 4, -6);
    scene.add(rim);
    const fill = new THREE.PointLight(new THREE.Color(accent), 14, 26, 2);
    fill.position.set(0, 1.4, 5.5);
    scene.add(fill);

    // factory floor: a dark deck with a glowing grid
    const deck = new THREE.Mesh(
      new THREE.CircleGeometry(9, 48),
      new THREE.MeshStandardMaterial({ color: 0x11191b, roughness: 0.95, metalness: 0.1 }),
    );
    deck.rotation.x = -Math.PI / 2;
    deck.receiveShadow = true;
    scene.add(deck);
    const grid = new THREE.GridHelper(18, 36, new THREE.Color(accent), 0x1d3033);
    grid.position.y = 0.01;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.35;
    scene.add(grid);
    const pad = new THREE.Mesh(
      new THREE.RingGeometry(2.9, 3.2, 48),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(accent), transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.02;
    scene.add(pad);

    sceneRef.current = { renderer, scene, camera };

    const resize = () => {
      const parent = canvas.parentElement;
      const w = parent?.clientWidth ?? 320;
      const h = parent?.clientHeight ?? 260;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (canvas.parentElement) observer.observe(canvas.parentElement);

    let raf = 0;
    const clock = new THREE.Clock();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.1);
      const s = spin.current;
      if (!s.dragging) s.yaw += dt * 0.28;
      const mech = mechRef.current;
      if (mech) {
        mech.rotation.y = s.yaw;
        mech.rotation.x = s.pitch;
      }
      camera.position.set(
        Math.sin(s.yaw) * 11 * s.zoom,
        3.4 + s.pitch * 6,
        Math.cos(s.yaw) * 11 * s.zoom,
      );
      camera.lookAt(0, 3.1, 0);
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      if (mechRef.current) {
        scene.remove(mechRef.current);
        disposeMech(mechRef.current);
        mechRef.current = null;
      }
      renderer.dispose();
      sceneRef.current = null;
    };
  }, [accent]);

  // ---------------------------------------------------------------- model
  useEffect(() => {
    const ctx = sceneRef.current;
    if (!ctx) return;
    if (mechRef.current) {
      ctx.scene.remove(mechRef.current);
      disposeMech(mechRef.current);
      mechRef.current = null;
    }
    const mech = buildMech(equipped);
    mech.position.y = 0;
    ctx.scene.add(mech);
    mechRef.current = mech;
  }, [equipped]);

  // --------------------------------------------------------------- input
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s = spin.current;
    const down = (e: PointerEvent) => {
      s.dragging = true;
      s.lastX = e.clientX;
      s.lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!s.dragging) return;
      s.yaw -= (e.clientX - s.lastX) * 0.012;
      s.pitch = Math.max(-0.35, Math.min(0.5, s.pitch + (e.clientY - s.lastY) * 0.006));
      s.lastX = e.clientX;
      s.lastY = e.clientY;
    };
    const up = (e: PointerEvent) => {
      s.dragging = false;
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      s.zoom = Math.max(0.55, Math.min(1.6, s.zoom + e.deltaY * 0.001));
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', wheel, { passive: false });
    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('wheel', wheel);
    };
  }, []);

  return (
    <div className="forge-view">
      <canvas ref={canvasRef} className="forge-view-canvas" aria-label={`${label} on the factory floor`} role="img" />
      <div className="forge-view-caption">
        <span>{label}</span>
        <em>DRAG TO TURN</em>
      </div>
    </div>
  );
}
