import * as THREE from 'three';
import { SUPPLIES } from './supplies';
import type { DropKind } from './types';

export function makeSupplyCrate(kind: DropKind, credits: number) {
  const def = SUPPLIES[kind],
    color = new THREE.Color(def.color);
  const group = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x353d41, roughness: 0.7, metalness: 0.5 });
  const trim = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.35,
    roughness: 0.5,
  });
  const box = (w: number, h: number, d: number, y: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.y = y;
    m.castShadow = true;
    group.add(m);
    return m;
  };
  box(3.6, 2.5, 3.1, 0, steel);
  box(3.8, 0.26, 3.3, 1.22, trim);
  box(3.8, 0.28, 3.3, -1.26, trim);
  for (const x of [-1.16, 1.16]) box(0.28, 2.8, 3.3, 0, trim).position.x = x;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.5, 2.7, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -1.5;
  group.add(ring);
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 144;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#111915';
  ctx.fillRect(0, 0, 512, 144);
  ctx.fillStyle = def.color;
  ctx.fillRect(0, 0, 8, 144);
  ctx.save();
  ctx.translate(21, 29);
  ctx.scale(3.4, 3.4);
  ctx.strokeStyle = def.color;
  ctx.lineWidth = 1.7;
  ctx.stroke(new Path2D(def.path));
  ctx.restore();
  ctx.fillStyle = '#f4f6ed';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText(def.name.toUpperCase(), 122, 66, 378);
  ctx.fillStyle = def.color;
  ctx.font = 'bold 27px monospace';
  ctx.fillText(kind === 'coins' ? `+${credits} CR` : def.short, 122, 112);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, depthWrite: false, toneMapped: false }),
  );
  sign.scale.set(13.5, 3.8, 1);
  sign.position.y = 4.4;
  group.add(sign);
  return { group, ring };
}
