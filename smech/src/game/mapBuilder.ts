import { StructureField } from './structures';
import { enhanceGroundMaterial, enhanceObstacleMaterial, getBrushedMetalNormalTexture } from './saltlineVisuals';
/**
 * World builder: turns a sector layout into a dressed, lit and animated arena.
 */

import * as THREE from 'three';
import { FLATS, HILLS, START_RADIUS, WATER, WORLD_RADIUS, heightAt, inWater, roadDist, type District, type Layout } from './layout';
import { chance, pick, rand, rnd, shuffle } from './rng';

const TWO_PI = Math.PI * 2;
import { gridInsert, nearObstacles, obsDist, resetColliderGrid, type Obstacle } from './colliders';

function makeGroundTexture(base: string) {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 50; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = rand(25, 100);
    const dark = rnd() < 0.55;
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const grd = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        grd.addColorStop(0, dark ? 'rgba(40,34,24,0.45)' : 'rgba(190,175,140,0.35)');
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd;
        g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    }
  }
  for (let i = 0; i < 15000; i++) {
    const v = 70 + rnd() * 110;
    g.fillStyle = `rgba(${v},${v * 0.94},${v * 0.82},${0.2 + rnd() * 0.4})`;
    const s = 1 + rnd() * 2.2;
    g.fillRect(rnd() * size, rnd() * size, s, s);
  }
  g.strokeStyle = 'rgba(30,26,18,0.32)';
  for (let i = 0; i < 40; i++) {
    let x = rnd() * size;
    let y = rnd() * size;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 7; k++) {
      x += rand(-28, 28);
      y += rand(-28, 28);
      g.lineTo(x, y);
    }
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(62, 62);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeFacadeTextures(base: string) {
  const size = 256;
  const col = document.createElement('canvas');
  const emi = document.createElement('canvas');
  col.width = col.height = emi.width = emi.height = size;
  const g = col.getContext('2d')!;
  const e = emi.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  e.fillStyle = '#000';
  e.fillRect(0, 0, size, size);
  for (let i = 0; i < 2200; i++) {
    const v = rnd() < 0.5 ? 0 : 255;
    g.fillStyle = `rgba(${v},${v},${v},${rnd() * 0.06})`;
    g.fillRect(rnd() * size, rnd() * size, rand(1, 6), rand(1, 14));
  }
  const cell = size / 4;
  for (let gx = 0; gx < 4; gx++) {
    for (let gy = 0; gy < 4; gy++) {
      const x = gx * cell + cell * 0.18;
      const y = gy * cell + cell * 0.22;
      const w = cell * 0.64;
      const h = cell * 0.5;
      const broken = rnd() < 0.18;
      g.fillStyle = broken ? '#0b0b0c' : '#1d2630';
      g.fillRect(x, y, w, h);
      if (!broken) {
        g.fillStyle = 'rgba(160,190,220,0.18)';
        g.fillRect(x, y, w * 0.45, h * 0.35);
      }
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(x - 2, y + h, w + 4, 3);
      if (!broken && rnd() < 0.18) {
        const warm = rnd() < 0.75;
        e.fillStyle = warm ? '#ffb15a' : '#9fd8ff';
        e.fillRect(x + 2, y + 2, w - 4, h - 4);
        g.fillStyle = warm ? '#6a4a2a' : '#3a5a70';
        g.fillRect(x + 2, y + 2, w - 4, h - 4);
      }
    }
  }
  const map = new THREE.CanvasTexture(col);
  const emissiveMap = new THREE.CanvasTexture(emi);
  for (const t of [map, emissiveMap]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
  }
  return { map, emissiveMap };
}

function makeRoadTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#35363a';
  g.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 1800; i++) {
    const v = 40 + rnd() * 50;
    g.fillStyle = `rgba(${v},${v},${v + 4},${0.25 + rnd() * 0.4})`;
    g.fillRect(rnd() * 128, rnd() * 256, rand(1, 3), rand(1, 3));
  }
  g.fillStyle = 'rgba(210,205,190,0.55)';
  g.fillRect(7, 0, 3, 256);
  g.fillRect(118, 0, 3, 256);
  g.fillStyle = 'rgba(232,190,70,0.8)';
  for (let y = 0; y < 256; y += 128) g.fillRect(62, y, 4, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeStrataTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d')!;
  const bands = ['#9a5a3c', '#b8744a', '#8a4e34', '#c28a5c', '#a2603f', '#7d4630'];
  let y = 0;
  while (y < 256) {
    const h = rand(10, 28);
    g.fillStyle = pick(bands);
    g.fillRect(0, y, 64, h);
    y += h;
  }
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(0,0,0,${rnd() * 0.12})`;
    g.fillRect(rnd() * 64, rnd() * 256, rand(1, 4), rand(1, 8));
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeContainerTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#d9d9d9';
  g.fillRect(0, 0, 256, 64);
  for (let x = 0; x < 256; x += 6) {
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fillRect(x, 4, 2, 56);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(x + 2, 4, 1, 56);
  }
  g.fillStyle = 'rgba(0,0,0,0.5)';
  g.fillRect(0, 0, 256, 4);
  g.fillRect(0, 60, 256, 4);
  for (let i = 0; i < 160; i++) {
    g.fillStyle = `rgba(80,40,20,${rnd() * 0.2})`;
    g.fillRect(rnd() * 256, rnd() * 64, rand(1, 6), rand(1, 4));
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeFenceTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1, 'rgba(255,255,255,0.95)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(255,255,255,0.7)';
  g.lineWidth = 2;
  for (let x = 0; x <= 128; x += 32) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 128);
    g.stroke();
  }
  for (let y = 16; y < 128; y += 24) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(128, y);
    g.stroke();
  }
  // fade the whole grid out toward the top of the wall
  g.globalCompositeOperation = 'destination-in';
  const mask = g.createLinearGradient(0, 0, 0, 128);
  mask.addColorStop(0, 'rgba(0,0,0,0)');
  mask.addColorStop(0.35, 'rgba(0,0,0,0.25)');
  mask.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = mask;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function setShadows(obj: THREE.Object3D, cast = true) {
  obj.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = cast;
      o.receiveShadow = true;
    }
  });
}

/** An InstancedMesh with a simple append API; used for rocks, trees, containers... */
class Pool {
  mesh: THREE.InstancedMesh;
  n = 0;
  private cap: number;
  private o = new THREE.Object3D();
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, cap: number, shadows = true) {
    this.cap = cap;
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = shadows;
    this.mesh.receiveShadow = true;
    parent.add(this.mesh);
  }
  add(x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, rx = 0, rz = 0, color?: THREE.Color) {
    if (this.n >= this.cap) return false;
    this.o.position.set(x, y, z);
    this.o.scale.set(sx, sy, sz);
    this.o.rotation.set(rx, ry, rz);
    this.o.updateMatrix();
    this.mesh.setMatrixAt(this.n, this.o.matrix);
    if (color) this.mesh.setColorAt(this.n, color);
    this.n++;
    this.mesh.count = this.n;
    return true;
  }
  addMatrix(m: THREE.Matrix4) {
    if (this.n >= this.cap) return false;
    this.mesh.setMatrixAt(this.n, m);
    this.n++;
    this.mesh.count = this.n;
    return true;
  }
  finish() {
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// Map builder
// ---------------------------------------------------------------------------
export interface ExplosiveBarrel {
  group: THREE.Group;
  pos: THREE.Vector3;
  hp: number;
  destroyed: boolean;
}

interface FieldRelay {
  marker: THREE.Group;
  reward: 'rapid' | 'repair';
  charge: number;
  claimed: boolean;
}

export interface MapResult {
  structures: StructureField;
  relays: FieldRelay[];
  /** persistent fires (burning oil, wrecks) – the engine emits particles here */
  fires: THREE.Vector3[];
  barrels: ExplosiveBarrel[];
  waterTexture: THREE.Texture;
  /** move the perimeter fence to a new radius */
  setRadius: (r: number) => void;
  /** per-frame animation (turbines, radar dishes, fence shimmer) */
  animate: (dt: number, t: number) => void;
}

export function buildMap(parent: THREE.Object3D, obstacles: Obstacle[], makeWreck: () => THREE.Group, layout: Layout): MapResult {
  const theme = layout.theme;
  const fires: THREE.Vector3[] = [];
  const barrels: ExplosiveBarrel[] = [];
  const animators: ((dt: number, t: number) => void)[] = [];
  resetColliderGrid();
  const structures = new StructureField(obstacles,heightAt);
  // continue the seeded sequence deterministically after layout generation

  // ---- terrain mesh ------------------------------------------------------
  const SIZE = 1000;
  const SEG = 260;
  const tgeo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  tgeo.rotateX(-Math.PI / 2);
  const tpos = tgeo.getAttribute('position') as THREE.BufferAttribute;
  const colors = new Float32Array(tpos.count * 3);
  const cSand = new THREE.Color(0xe6dcc4);
  const cDark = new THREE.Color(0xb8a888);
  const cRock = new THREE.Color(0x8a7a66);
  const tmpColor = new THREE.Color();
  const row = SEG + 1;
  const cellSize = SIZE / SEG;
  const hgrid = new Float32Array(tpos.count);
  for (let i = 0; i < tpos.count; i++) {
    hgrid[i] = heightAt(tpos.getX(i), tpos.getZ(i));
    tpos.setY(i, hgrid[i]);
  }
  for (let i = 0; i < tpos.count; i++) {
    const ix = i % row;
    const iz = Math.floor(i / row);
    const y = hgrid[i];
    const gx = (hgrid[ix < SEG ? i + 1 : i] - hgrid[ix > 0 ? i - 1 : i]) / (2 * cellSize);
    const gz = (hgrid[iz < SEG ? i + row : i] - hgrid[iz > 0 ? i - row : i]) / (2 * cellSize);
    const slope = Math.min(1, Math.hypot(gx, gz) / 0.55);
    tmpColor.copy(cSand).lerp(cDark, Math.min(1, Math.max(0, (y - 2) / 14)) * 0.6).lerp(cRock, slope * 0.75);
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }
  tgeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  tgeo.computeVertexNormals();
  const groundMat = new THREE.MeshStandardMaterial({
    map: makeGroundTexture(theme.ground),
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.15,
  });
  enhanceGroundMaterial(groundMat);
  animators.push((_dt, t) => {
    if (groundMat.userData.shader?.uniforms?.uTime) {
      groundMat.userData.shader.uniforms.uTime.value = t;
    }
  });
  const ground = new THREE.Mesh(tgeo, groundMat);
  ground.receiveShadow = true;
  parent.add(ground);

  // ---- water -------------------------------------------------------------
  const waterCanvas = document.createElement('canvas');
  waterCanvas.width = waterCanvas.height = 256;
  const wc = waterCanvas.getContext('2d')!;
  wc.fillStyle = '#527f7d';
  wc.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 220; i++) {
    wc.strokeStyle = `rgba(202,230,219,${rand(0.04, 0.24)})`;
    wc.lineWidth = rand(0.5, 1.5);
    const x = rand(0, 256);
    const y = rand(0, 256);
    wc.beginPath();
    wc.moveTo(x, y);
    wc.quadraticCurveTo(x + 6, y - 2, x + rand(10, 27), y);
    wc.stroke();
  }
  const waterTexture = new THREE.CanvasTexture(waterCanvas);
  waterTexture.wrapS = waterTexture.wrapT = THREE.RepeatWrapping;
  waterTexture.repeat.set(4, 2);
  waterTexture.colorSpace = THREE.SRGBColorSpace;
  const waterGeo = new THREE.CircleGeometry(1, 72);
  const waterMat = new THREE.MeshStandardMaterial({ map: waterTexture, color: 0x9ccac3, roughness: 0.28, metalness: 0.35, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
  const shoreGeo = new THREE.RingGeometry(1, 1.045, 72);
  const shoreMat = new THREE.MeshBasicMaterial({ color: 0xaac8b8, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false });
  for (const w of WATER) {
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.scale.set(w.rx, w.rz, 1);
    water.position.set(w.x, w.level, w.z);
    water.receiveShadow = true;
    const shore = new THREE.Mesh(shoreGeo, shoreMat);
    shore.rotation.x = -Math.PI / 2;
    shore.scale.set(w.rx, w.rz, 1);
    shore.position.set(w.x, w.level + 0.02, w.z);
    parent.add(water, shore);
  }

  // ---- roads -------------------------------------------------------------
  if (layout.roads.length) {
    const rp: number[] = [];
    const ru: number[] = [];
    const ri: number[] = [];
    for (const pts of layout.roads) {
      const base = rp.length / 3;
      let acc = 0;
      for (let i = 0; i < pts.length; i++) {
        const [x, z] = pts[i];
        const [px, pz] = pts[Math.max(0, i - 1)];
        const [nx, nz] = pts[Math.min(pts.length - 1, i + 1)];
        let tx = nx - px;
        let tz = nz - pz;
        const tl = Math.hypot(tx, tz) || 1;
        tx /= tl;
        tz /= tl;
        if (i > 0) acc += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
        const hw = 4.6;
        const lx = x - tz * hw;
        const lz = z + tx * hw;
        const rx = x + tz * hw;
        const rz = z - tx * hw;
        rp.push(lx, heightAt(lx, lz) + 0.22, lz, rx, heightAt(rx, rz) + 0.22, rz);
        ru.push(0, acc / 24, 1, acc / 24);
        if (i > 0) {
          const k = base + (i - 1) * 2;
          ri.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
        }
      }
    }
    const rgeo = new THREE.BufferGeometry();
    rgeo.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
    rgeo.setAttribute('uv', new THREE.Float32BufferAttribute(ru, 2));
    rgeo.setIndex(ri);
    rgeo.computeVertexNormals();
    const road = new THREE.Mesh(rgeo, new THREE.MeshStandardMaterial({ map: makeRoadTexture(), roughness: 0.95, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    road.receiveShadow = true;
    parent.add(road);
  }

  // ---- distant mountains & industrial flare stacks ----------------------
  const mGeo = new THREE.ConeGeometry(1, 1, 7, 1);
  const mMat = new THREE.MeshStandardMaterial({ color: 0x5a524a, roughness: 1, flatShading: true });
  for (let i = 0; i < 38; i++) {
    const a = (i / 38) * TWO_PI + rand(-0.08, 0.08);
    const r = rand(470, 600);
    const h = rand(70, 165);
    const m = new THREE.Mesh(mGeo, mMat);
    m.scale.set(rand(100, 190), h, rand(100, 190));
    m.position.set(Math.sin(a) * r, h / 2 - 4, Math.cos(a) * r);
    m.rotation.y = rand(0, TWO_PI);
    parent.add(m);
  }

  // Distant industrial communication towers / refinery stacks on the horizon
  const towerGeo = new THREE.CylinderGeometry(0.8, 2.2, 55, 6);
  const towerMat = new THREE.MeshStandardMaterial({ color: 0x22262a, roughness: 0.8, metalness: 0.8 });
  const beaconMatDistant = new THREE.MeshBasicMaterial({ color: 0xff2020 });
  const beaconGeo = new THREE.SphereGeometry(1.6, 6, 6);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TWO_PI + rand(-0.12, 0.12);
    const r = rand(430, 560);
    const y0 = heightAt(Math.sin(a) * r, Math.cos(a) * r);
    const tower = new THREE.Mesh(towerGeo, towerMat);
    tower.position.set(Math.sin(a) * r, y0 + 26, Math.cos(a) * r);
    parent.add(tower);
    const beacon = new THREE.Mesh(beaconGeo, beaconMatDistant);
    beacon.position.set(Math.sin(a) * r, y0 + 54, Math.cos(a) * r);
    parent.add(beacon);
  }

  // ---- perimeter fence & catenary power cables ---------------------------
  const FENCE_SEG = 168;
  const fenceGeo = new THREE.BufferGeometry();
  const fPos = new Float32Array((FENCE_SEG + 1) * 2 * 3);
  const fUv = new Float32Array((FENCE_SEG + 1) * 2 * 2);
  const fIdx: number[] = [];
  for (let i = 0; i <= FENCE_SEG; i++) {
    const u = i / FENCE_SEG;
    fUv[i * 4] = u;
    fUv[i * 4 + 1] = 0;
    fUv[i * 4 + 2] = u;
    fUv[i * 4 + 3] = 1;
    if (i < FENCE_SEG) {
      const a = i * 2;
      fIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  fenceGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3).setUsage(THREE.DynamicDrawUsage));
  fenceGeo.setAttribute('uv', new THREE.BufferAttribute(fUv, 2));
  fenceGeo.setIndex(fIdx);
  const fenceTex = makeFenceTexture();
  fenceTex.repeat.set(70, 1);
  const fence = new THREE.Mesh(
    fenceGeo,
    new THREE.MeshBasicMaterial({ map: fenceTex, color: 0x7ee8ff, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
  );
  fence.frustumCulled = false;
  parent.add(fence);
  const PYLONS = 56;
  const pylons = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 1, 1.1), new THREE.MeshStandardMaterial({ color: 0x3b4650, roughness: 0.5, metalness: 0.7, emissive: 0x2ad0ff, emissiveIntensity: 0.4 }), PYLONS);
  pylons.frustumCulled = false;
  pylons.castShadow = true;
  parent.add(pylons);

  // Catenary power cables strung between all perimeter pylons
  const CABLE_SUBDIV = 4;
  const cableVertCount = PYLONS * 2 * CABLE_SUBDIV * 2;
  const cablePos = new Float32Array(cableVertCount * 3);
  const cableGeo = new THREE.BufferGeometry();
  cableGeo.setAttribute('position', new THREE.BufferAttribute(cablePos, 3).setUsage(THREE.DynamicDrawUsage));
  const fenceCableMat = new THREE.LineBasicMaterial({ color: 0x161a1e, transparent: true, opacity: 0.8 });
  const cables = new THREE.LineSegments(cableGeo, fenceCableMat);
  cables.frustumCulled = false;
  parent.add(cables);

  const po = new THREE.Object3D();
  const setRadius = (r: number) => {
    for (let i = 0; i <= FENCE_SEG; i++) {
      const a = (i / FENCE_SEG) * TWO_PI;
      const x = Math.sin(a) * r;
      const z = Math.cos(a) * r;
      const y = heightAt(x, z);
      fPos[i * 6] = x;
      fPos[i * 6 + 1] = y - 1.5;
      fPos[i * 6 + 2] = z;
      fPos[i * 6 + 3] = x;
      fPos[i * 6 + 4] = y + 24;
      fPos[i * 6 + 5] = z;
    }
    (fenceGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    for (let i = 0; i < PYLONS; i++) {
      const a = (i / PYLONS) * TWO_PI;
      const x = Math.sin(a) * r;
      const z = Math.cos(a) * r;
      const y = heightAt(x, z);
      po.position.set(x, y + 7, z);
      po.scale.set(1, 15, 1);
      po.rotation.set(0, a, 0);
      po.updateMatrix();
      pylons.setMatrixAt(i, po.matrix);
    }
    pylons.instanceMatrix.needsUpdate = true;

    // String drooped catenary cables along pylon tops
    let cIdx = 0;
    for (let i = 0; i < PYLONS; i++) {
      const nextI = (i + 1) % PYLONS;
      const a0 = (i / PYLONS) * TWO_PI;
      const a1 = (nextI / PYLONS) * TWO_PI;
      const x0 = Math.sin(a0) * r, z0 = Math.cos(a0) * r, y0 = heightAt(x0, z0);
      const x1 = Math.sin(a1) * r, z1 = Math.cos(a1) * r, y1 = heightAt(x1, z1);

      for (const yOffset of [13.5, 10.8]) {
        for (let s = 0; s < CABLE_SUBDIV; s++) {
          const t0 = s / CABLE_SUBDIV;
          const t1 = (s + 1) / CABLE_SUBDIV;
          const sag0 = -1.4 * 4 * t0 * (1 - t0);
          const sag1 = -1.4 * 4 * t1 * (1 - t1);

          cablePos[cIdx++] = x0 + (x1 - x0) * t0;
          cablePos[cIdx++] = (y0 + yOffset) + ((y1 + yOffset) - (y0 + yOffset)) * t0 + sag0;
          cablePos[cIdx++] = z0 + (z1 - z0) * t0;

          cablePos[cIdx++] = x0 + (x1 - x0) * t1;
          cablePos[cIdx++] = (y0 + yOffset) + ((y1 + yOffset) - (y0 + yOffset)) * t1 + sag1;
          cablePos[cIdx++] = z0 + (z1 - z0) * t1;
        }
      }
    }
    (cableGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  };
  setRadius(START_RADIUS);

  // ---- shared materials & instanced pools -------------------------------
  const propNormal = getBrushedMetalNormalTexture();
  const concrete = new THREE.MeshStandardMaterial({ color: 0x8b857a, roughness: 0.88 });
  enhanceObstacleMaterial(concrete, { wearAmount: 0.5, rustAmount: 0.4 });
  const darkConcrete = new THREE.MeshStandardMaterial({ color: 0x5d5952, roughness: 0.85 });
  enhanceObstacleMaterial(darkConcrete, { wearAmount: 0.6, rustAmount: 0.5 });
  const metal = new THREE.MeshStandardMaterial({
    color: 0x555d64,
    roughness: 0.42,
    metalness: 0.72,
    normalMap: propNormal,
    normalScale: new THREE.Vector2(0.3, 0.3),
  });
  enhanceObstacleMaterial(metal, { wearAmount: 0.65, rustAmount: 0.7 });
  const rust = new THREE.MeshStandardMaterial({
    color: 0x7a4e32,
    roughness: 0.78,
    metalness: 0.35,
    normalMap: propNormal,
    normalScale: new THREE.Vector2(0.4, 0.4),
  });
  enhanceObstacleMaterial(rust, { wearAmount: 0.85, rustAmount: 0.9 });
  const beaconMat = new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 4 });
  const facades = ['#8b857a', '#7a756c', '#9a9184', '#6f6a63', '#857868', '#7c8088'].map(makeFacadeTextures);

  const rocks = new Pool(parent, new THREE.DodecahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }), 640);
  const rockColors = [0x75685a, 0x6b6256, 0x84766a, 0x7a6a58, 0x66605a].map((c) => new THREE.Color(c));
  const barkMat = new THREE.MeshStandardMaterial({ color: 0x3a2e24, roughness: 1 });
  const trunks = new Pool(parent, new THREE.CylinderGeometry(0.18, 0.35, 1, 5), barkMat, 180);
  const branches = new Pool(parent, new THREE.CylinderGeometry(0.18, 0.35, 1, 5), barkMat, 720, false);
  const reeds = new Pool(parent, new THREE.ConeGeometry(0.1, 1, 4), new THREE.MeshStandardMaterial({ color: 0x7d7a45, roughness: 1 }), 900, false);
  const berms = new Pool(parent, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x9c8a62, roughness: 1 }), 160);
  const blocks = new Pool(parent, new THREE.BoxGeometry(1, 1, 1), concrete, 60);
  const containers = new Pool(parent, new THREE.BoxGeometry(12, 2.6, 2.5), new THREE.MeshStandardMaterial({ map: makeContainerTexture(), color: 0xffffff, roughness: 0.7, metalness: 0.35 }), 300);
  const lampPoles = new Pool(parent, new THREE.CylinderGeometry(0.12, 0.16, 1, 6), metal, 160, false);
  const lampHeads = new Pool(parent, new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffcf80, emissiveIntensity: 1.3 + theme.windowGlow * 2 }), 160, false);
  const containerColors = [0x8a3324, 0x2f5f8a, 0x3f6e3a, 0xb8642a, 0x6b6b6b, 0x7a2f4f, 0x2a7070].map((c) => new THREE.Color(c));
  const sandbagColor = new THREE.Color(0xffffff);

  // ---- helpers -----------------------------------------------------------
  const FOOT: [number, number][] = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  /** Is a candidate footprint free (with margin), off the roads and inside the map? */
  const free = (x: number, z: number, hw: number, hd: number, rot: number, margin: number) => {
    if (Math.hypot(x, z) < 16) return false;
    if (roadDist(x, z) < Math.max(hw, hd) * 0.6 + 5.5) return false;
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    for (const [fx, fz] of FOOT) {
      const lx = fx * hw;
      const lz = fz * hd;
      const wx = x + lx * c + lz * s;
      const wz = z - lx * s + lz * c;
      if (Math.hypot(wx, wz) > WORLD_RADIUS - 40) return false;
      for (const o of nearObstacles(wx, wz, margin + 3)) if (obsDist(o, wx, wz) < margin) return false;
    }
    return true;
  };
  const inFlat = (x: number, z: number) => FLATS.some((f) => Math.hypot(x - f.x, z - f.z) < f.r + 3);
  const baseY = (x: number, z: number, r: number) => Math.min(heightAt(x, z), heightAt(x + r, z), heightAt(x - r, z), heightAt(x, z + r), heightAt(x, z - r));
  const addBox = (x: number, z: number, hw: number, hd: number, h: number, rot: number, y0: number) => {
    const o: Obstacle = { x, z, r: Math.hypot(hw, hd), h, y0, box: { hw, hd, c: Math.cos(rot), s: Math.sin(rot), rot } };
    obstacles.push(o);
    gridInsert(o);
    return o;
  };
  const addCircle = (x: number, z: number, r: number, h: number, y0: number) => {
    const o: Obstacle = { x, z, r, h, y0 };
    obstacles.push(o);
    gridInsert(o);
    return o;
  };
  const addRock = (x: number, z: number, s: number, collide = true) => {
    const y = heightAt(x, z);
    const sy = s * rand(0.6, 1.0);
    const placed = rocks.add(x, y + sy * 0.3, z, s * rand(0.8, 1.4), sy, s * rand(0.8, 1.4), rand(0, TWO_PI), rand(0, 0.4), rand(0, 0.4), pick(rockColors));
    if (placed && collide) addCircle(x, z, s * 0.95, sy * 1.2, y);
  };
  const addLamp = (x: number, z: number) => {
    const y = heightAt(x, z);
    lampPoles.add(x, y + 3.5, z, 1, 7, 1);
    lampHeads.add(x, y + 7.2, z, 1, 1, 1);
  };
  const addBerm = (x: number, z: number, len: number, rot: number) => {
    const y = baseY(x, z, len / 2);
    if (berms.add(x, y + 0.95, z, len, 1.9, 2.4, rot, 0, 0, sandbagColor)) addBox(x, z, len / 2, 1.2, 1.9, rot, y);
  };
  const addBarrel = (x: number, z: number) => {
    const group = new THREE.Group();
    const body = new THREE.Mesh(barrelGeo, barrelMat);
    body.position.y = 1.05;
    const band = new THREE.Mesh(bandGeo, bandMat);
    band.position.y = 1.05;
    group.add(body, band);
    const y = heightAt(x, z);
    group.position.set(x, y, z);
    setShadows(group);
    parent.add(group);
    barrels.push({ group, pos: new THREE.Vector3(x, y + 1.05, z), hp: 20, destroyed: false });
  };
  const barrelGeo = new THREE.CylinderGeometry(0.68, 0.72, 2.1, 12);
  const bandGeo = new THREE.CylinderGeometry(0.73, 0.73, 0.2, 12);
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0xac392a, roughness: 0.55, metalness: 0.55 });
  enhanceObstacleMaterial(barrelMat, { wearAmount: 0.7, rustAmount: 0.6 });
  const bandMat = new THREE.MeshStandardMaterial({ color: 0xe8bd62, roughness: 0.7, emissive: 0x4b2109, emissiveIntensity: 0.3 });
  const barrelCluster = (x: number, z: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const bx = x + rand(-2.4, 2.4);
      const bz = z + rand(-2.4, 2.4);
      if (!inWater(bx, bz) && free(bx, bz, 0.8, 0.8, 0, 1.4)) addBarrel(bx, bz);
    }
  };
  const addWreck = (x: number, z: number, burning: boolean) => {
    const g = makeWreck();
    const y = heightAt(x, z);
    g.position.set(x, y - rand(0.2, 0.4), z);
    g.rotation.set(rand(-0.12, 0.12), rand(0, TWO_PI), rand(-0.15, 0.15));
    parent.add(g);
    addCircle(x, z, 3.7, 2.8, y);
    if (burning) fires.push(new THREE.Vector3(x, y + 2.2, z));
  };

  // ---- buildings ----------------------------------------------------------
  const buildBuilding = (x: number, z: number, w: number, d: number, h: number, forceRuin = false) => {
    if (!free(x, z, w / 2 + 0.3, d / 2 + 0.3, 0, 3)) return false;
    const y0 = heightAt(x, z) - 0.3;
    const g = new THREE.Group();
    const facade = pick(facades);
    const mkFacade = (repX: number) => {
      const map = facade.map.clone();
      const emissiveMap = facade.emissiveMap.clone();
      map.repeat.set(repX / 4.2, h / 4.2);
      emissiveMap.repeat.copy(map.repeat);
      map.needsUpdate = emissiveMap.needsUpdate = true;
      return new THREE.MeshStandardMaterial({ map, emissiveMap, emissive: 0xffffff, emissiveIntensity: theme.windowGlow, roughness: 0.92 });
    };
    const sideX = mkFacade(d);
    const sideZ = mkFacade(w);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x55524c, roughness: 1 });
    const ruined = forceRuin || (h < 30 && chance(0.3));
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [sideX, sideX, roofMat, roofMat, sideZ, sideZ]);
    body.position.y = h / 2;
    g.add(body);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 3.2, d + 0.6), concrete);
    plinth.position.y = 1.6;
    g.add(plinth);
    if (ruined) {
      for (let i = 0; i < 4; i++) {
        const cw = rand(2, w * 0.4);
        const ch = rand(1.5, 5);
        const chunk = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, rand(2, d * 0.4)), concrete);
        chunk.position.set(rand(-w / 2 + cw / 2, w / 2 - cw / 2), h + ch / 2, rand(-d / 3, d / 3));
        chunk.rotation.set(rand(-0.2, 0.2), rand(0, 1), rand(-0.2, 0.2));
        g.add(chunk);
      }
    } else {
      const parapet = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 1, d + 0.4), concrete);
      parapet.position.y = h + 0.5;
      const ac = new THREE.Mesh(new THREE.BoxGeometry(rand(1.5, 3), rand(1, 2), rand(1.5, 3)), metal);
      ac.position.set(rand(-w / 3, w / 3), h + 1.4, rand(-d / 3, d / 3));
      g.add(parapet, ac);
      if (h > 30) {
        const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 9, 5), metal);
        ant.position.set(w * 0.2, h + 5.5, -d * 0.2);
        const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), beaconMat);
        beacon.position.set(w * 0.2, h + 10.2, -d * 0.2);
        g.add(ant, beacon);
      }
    }
    g.position.set(x, y0, z);
    setShadows(g);
    parent.add(g);
    structures.register(addBox(x, z, w / 2 + 0.3, d / 2 + 0.3, h + 1, 0, y0), g, ruined ? 'RUIN' : 'BUILDING', ruined ? 65 : Math.min(190, 75+h*2));
    return true;
  };

  const rubblePlaza = (x: number, z: number) => {
    const y = heightAt(x, z);
    for (let i = 0; i < 14; i++) {
      const s = rand(1, 3);
      const a = rand(0, TWO_PI);
      const r = rand(0, 5.5);
      const px = x + Math.sin(a) * r;
      const pz = z + Math.cos(a) * r;
      rocks.add(px, heightAt(px, pz) + s * 0.25, pz, s * rand(1, 2), s * 0.6, s, rand(0, TWO_PI), rand(-0.4, 0.4), rand(-0.4, 0.4), pick(rockColors));
    }
    const wall = new THREE.Mesh(new THREE.BoxGeometry(9, 5, 1), concrete);
    wall.position.set(x + rand(-3, 3), y + 2.5, z + 6);
    wall.rotation.y = rand(-0.4, 0.4);
    wall.castShadow = wall.receiveShadow = true;
    parent.add(wall);
    // Low scatter is walkable; only the upright slab actually stops a mech.
    addBox(wall.position.x,wall.position.z,4.5,.5,5,wall.rotation.y,y);
    if (chance(0.5)) fires.push(new THREE.Vector3(x + rand(-4, 4), y + 0.5, z + rand(-4, 4)));
  };

  // ======================================================================
  // DISTRICT GENERATORS
  // ======================================================================
  const buildCity = (d: District) => {
    const cell = 38;
    const n = Math.ceil(d.r / cell);
    for (let gx = -n; gx <= n; gx++) {
      for (let gz = -n; gz <= n; gz++) {
        const dd = Math.hypot(gx * cell, gz * cell);
        if (dd > d.r * 0.95) continue;
        const cx = d.x + gx * cell;
        const cz = d.z + gz * cell;
        const core = 1 - dd / d.r;
        const roll = rnd();
        if (roll < 0.1) {
          if (free(cx, cz, 6, 6, 0, 2)) rubblePlaza(cx, cz);
          continue;
        }
        if (roll < 0.18) continue; // open lot
        if (roll < 0.34) {
          for (const side of [-1, 1]) buildBuilding(cx + side * 7.5, cz, rand(9, 11), rand(16, 22), rand(10, 22));
        } else {
          const tower = core > 0.5 && chance(0.6);
          buildBuilding(cx + rand(-2, 2), cz + rand(-2, 2), rand(16, 24), rand(16, 24), tower ? rand(38, 58) : rand(12, 28));
        }
        for (const [ox, oz] of [[-19, -19], [19, -19], [-19, 19], [19, 19]]) {
          if (chance(0.5) && free(cx + ox, cz + oz, 0.5, 0.5, 0, 1.5)) addLamp(cx + ox, cz + oz);
        }
      }
    }
  };

  const buildIndustrial = (d: District) => {
    const cStack = (x: number, z: number, rot: number) => {
      if (!free(x, z, 6.4, 2.9, rot, 1.5)) return;
      const stack = 1 + Math.floor(rnd() * 3);
      const y = baseY(x, z, 6);
      const c = Math.cos(rot);
      const s = Math.sin(rot);
      for (let lvl = 0; lvl < stack; lvl++) {
        for (const side of [-1.27, 1.27]) {
          if (lvl === stack - 1 && chance(0.25)) continue;
          const lx = rand(-0.3, 0.3);
          const cx=x+lx*c+side*s, cz=z-lx*s+side*c;
          if (containers.add(cx,y+1.3+lvl*2.6,cz,1,1,1,rot,0,0,pick(containerColors))) {
            addBox(cx,cz,6,1.25,2.6,rot,y+lvl*2.6);
          }
        }
      }

    };
    const rows = Math.floor(d.r / 15);
    for (let row = -rows; row <= rows; row++) {
      const z = d.z + row * 17;
      for (let x = d.x - d.r * 0.85; x <= d.x + d.r * 0.85; x += 15) {
        if (Math.hypot(x - d.x, z - d.z) > d.r * 0.88 || chance(0.25)) continue;
        cStack(x + rand(-1.5, 1.5), z, chance(0.12) ? rand(-0.4, 0.4) : 0);
      }
    }
    // warehouse
    const wa = rnd() * TWO_PI;
    for (let t = 0; t < 12; t++) {
      const wx = d.x + Math.sin(wa + t * 0.5) * d.r * 0.55;
      const wz = d.z + Math.cos(wa + t * 0.5) * d.r * 0.55;
      if (!free(wx, wz, 23, 13, 0, 3)) continue;
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(46, 13, 26), new THREE.MeshStandardMaterial({ color: 0x6a6f73, roughness: 0.7, metalness: 0.4 }));
      body.position.y = 6.5;
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(13.5, 13.5, 46.4, 16, 1, false, 0, Math.PI), rust);
      roof.rotation.set(0, 0, Math.PI / 2);
      roof.scale.set(1, 1, 0.35);
      roof.position.y = 13;
      const door = new THREE.Mesh(new THREE.BoxGeometry(12, 9, 0.4), darkConcrete);
      door.position.set(0, 4.5, -13.1);
      g.add(body, roof, door);
      for (let i = 0; i < 4; i++) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.5, 13.2, 26.4), metal);
        rib.position.set(-18 + i * 12, 6.6, 0);
        g.add(rib);
      }
      const y = baseY(wx, wz, 20) - 0.3;
      g.position.set(wx, y, wz);
      setShadows(g);
      parent.add(g);
      structures.register(addBox(wx, wz, 23, 13, 17, 0, y), g, 'WAREHOUSE', 170);
      break;
    }
    // fuel tanks
    const tankMat = new THREE.MeshStandardMaterial({ color: 0xb9b4a8, roughness: 0.5, metalness: 0.5 });
    enhanceObstacleMaterial(tankMat, { wearAmount: 0.55, rustAmount: 0.75 });
    for (let i = 0, made = 0; i < 20 && made < 3; i++) {
      const a = rnd() * TWO_PI;
      const tr = rand(5, 7);
      const tx = d.x + Math.sin(a) * d.r * rand(0.3, 0.7);
      const tz = d.z + Math.cos(a) * d.r * rand(0.3, 0.7);
      if (!free(tx, tz, tr, tr, 0, 1.5)) continue;
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(tr, tr, 10, 24), tankMat);
      body.position.y = 5;
      const top = new THREE.Mesh(new THREE.SphereGeometry(tr, 24, 8, 0, TWO_PI, 0, Math.PI / 2), tankMat);
      top.scale.y = 0.25;
      top.position.y = 10;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(tr + 0.05, tr + 0.05, 1, 24), rust);
      band.position.y = 3;
      g.add(body, top, band);
      const y = heightAt(tx, tz) - 0.2;
      g.position.set(tx, y, tz);
      setShadows(g);
      parent.add(g);
      addCircle(tx, tz, tr, 11, y);
      if (made === 0) fires.push(new THREE.Vector3(tx + tr + 3, y + 0.5, tz));
      made++;
    }
    // gantry crane over the rows
    if (chance(0.7)) {
      const yellow = new THREE.MeshStandardMaterial({ color: 0xd9a42b, roughness: 0.6, metalness: 0.4 });
      const crane = new THREE.Group();
      const span = d.r * 0.8;
      for (const lx of [-6, 6]) {
        for (const lz of [-span, span]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(1.6, 24, 1.6), yellow);
          leg.position.set(lx, 12, lz);
          crane.add(leg);
        }
        const beam = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2, span * 2), yellow);
        beam.position.set(lx, 24, 0);
        crane.add(beam);
      }
      const trolley = new THREE.Mesh(new THREE.BoxGeometry(14, 3, 5), yellow);
      trolley.position.set(0, 22.5, span * 0.2);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), beaconMat);
      lamp.position.set(0, 25.5, span);
      crane.add(trolley, lamp);
      crane.position.set(d.x - d.r * 0.2, heightAt(d.x, d.z), d.z);
      setShadows(crane);
      parent.add(crane);
    }
    barrelCluster(d.x + rand(-d.r * 0.4, d.r * 0.4), d.z + rand(-d.r * 0.4, d.r * 0.4), 3);
  };

  const buildRuins = (d: District) => {
    for (let i = 0, made = 0; i < 40 && made < 6; i++) {
      const a = rnd() * TWO_PI;
      const rr = rnd() * d.r * 0.8;
      if (buildBuilding(d.x + Math.sin(a) * rr, d.z + Math.cos(a) * rr, rand(12, 18), rand(12, 18), rand(6, 13), true)) made++;
    }
    for (let i = 0, made = 0; i < 40 && made < 9; i++) {
      const a = rnd() * TWO_PI;
      const rr = rnd() * d.r * 0.85;
      const x = d.x + Math.sin(a) * rr;
      const z = d.z + Math.cos(a) * rr;
      const w = rand(8, 14);
      const rot = rand(0, Math.PI);
      if (!free(x, z, w / 2, 0.8, rot, 2.5)) continue;
      const y = baseY(x, z, w / 2);
      const hgt = rand(3.5, 6.5);
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, 1.3), chance(0.5) ? concrete : darkConcrete);
      wall.position.set(x, y + hgt / 2, z);
      wall.rotation.y = rot;
      const top = new THREE.Mesh(new THREE.BoxGeometry(w * 0.4, 1.4, 1.2), concrete);
      top.position.set(x + Math.cos(rot) * w * 0.15, y + hgt + 0.5, z - Math.sin(rot) * w * 0.15);
      top.rotation.set(rand(-0.2, 0.2), rot, rand(-0.25, 0.25));
      setShadows(wall);
      setShadows(top);
      const group = new THREE.Group(); group.position.set(x,y,z); group.rotation.y = rot;
      parent.add(group); group.attach(wall); group.attach(top);
      structures.register(addBox(x,z,w/2,0.8,hgt,rot,y),group,'RUIN WALL',55);
      made++;
    }
    for (let i = 0; i < 4; i++) {
      const a = rnd() * TWO_PI;
      const rr = rnd() * d.r * 0.8;
      const x = d.x + Math.sin(a) * rr;
      const z = d.z + Math.cos(a) * rr;
      if (free(x, z, 6, 6, 0, 2)) rubblePlaza(x, z);
    }
    for (let i = 0, made = 0; i < 20 && made < 3; i++) {
      const a = rnd() * TWO_PI;
      const rr = rnd() * d.r * 0.8;
      const x = d.x + Math.sin(a) * rr;
      const z = d.z + Math.cos(a) * rr;
      if (!free(x, z, 3.7, 3.7, 0, 3)) continue;
      addWreck(x, z, made < 2);
      made++;
    }
    barrelCluster(d.x + rand(-d.r * 0.5, d.r * 0.5), d.z + rand(-d.r * 0.5, d.r * 0.5), 3);
  };

  const buildHighlands = (d: District) => {
    for (let i = 0, made = 0; i < 80 && made < 16; i++) {
      const a = rnd() * TWO_PI;
      const rr = rnd() * d.r * 0.85;
      const x = d.x + Math.sin(a) * rr;
      const z = d.z + Math.cos(a) * rr;
      const s = rand(4, 7.5);
      if (!free(x, z, s, s, 0, 3.5)) continue;
      addRock(x, z, s);
      made++;
    }
    const top = HILLS.filter((h) => Math.hypot(h.x - d.x, h.z - d.z) < d.r).sort((a, b) => b.h - a.h)[0];
    if (top && chance(0.7)) {
      const bx = top.x;
      const bz = top.z;
      if (free(bx, bz, 6, 4, 0, 2)) {
        const by = heightAt(bx, bz);
        const rot = rand(0, TWO_PI);
        const g = new THREE.Group();
        const bunker = new THREE.Mesh(new THREE.BoxGeometry(12, 3.4, 8), darkConcrete);
        bunker.position.y = 1.4;
        const slit = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 0.3), new THREE.MeshBasicMaterial({ color: 0x050505 }));
        slit.position.set(0, 2.3, -4.05);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 7, 6), metal);
        pole.position.set(5, 5, 3);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), beaconMat);
        lamp.position.set(5, 8.6, 3);
        g.add(bunker, slit, pole, lamp);
        g.position.set(bx, by - 0.4, bz);
        g.rotation.y = rot;
        setShadows(g);
        parent.add(g);
        addBox(bx, bz, 6, 4, 3.4, rot, by - 0.4);
      }
    }
    barrelCluster(d.x + rand(-d.r * 0.4, d.r * 0.4), d.z + rand(-d.r * 0.4, d.r * 0.4), 2);
  };

  const buildMarsh = (d: District) => {
    for (const w of WATER) {
      if (Math.hypot(w.x - d.x, w.z - d.z) > d.r) continue;
      for (let i = 0; i < 80; i++) {
        const a = rnd() * TWO_PI;
        const f = rand(0.88, 1.3);
        const x = w.x + Math.sin(a) * w.rx * f;
        const z = w.z + Math.cos(a) * w.rz * f;
        for (let k = 0; k < 3; k++) {
          const rx = x + rand(-1.4, 1.4);
          const rz = z + rand(-1.4, 1.4);
          const h = rand(1.6, 3.4);
          reeds.add(rx, Math.max(heightAt(rx, rz), w.level - 0.3) + h / 2, rz, 1, h, 1, 0, rand(-0.15, 0.15), rand(-0.15, 0.15));
        }
      }
      for (let k = 0; k < 2; k++) {
        const a = rnd() * TWO_PI;
        const f = rand(0.1, 0.5);
        const x = w.x + Math.sin(a) * w.rx * f;
        const z = w.z + Math.cos(a) * w.rz * f;
        const s = rand(3, 5);
        const sy = s * rand(0.7, 1.1);
        const y = Math.max(heightAt(x, z), w.level - 0.2);
        if (rocks.add(x, y + sy * 0.3, z, s, sy, s, rand(0, TWO_PI), rand(0, 0.3), rand(0, 0.3), pick(rockColors))) addCircle(x, z, s * 0.95, sy * 1.2, y);
      }
    }
    for (let i = 0, made = 0; i < 40 && made < 6; i++) {
      const a = rnd() * TWO_PI;
      const rr = rnd() * d.r * 0.9;
      const x = d.x + Math.sin(a) * rr;
      const z = d.z + Math.cos(a) * rr;
      if (inWater(x, z) || !free(x, z, 4, 4, 0, 3)) continue;
      addRock(x, z, rand(3.5, 6));
      made++;
    }
    for (let i = 0, made = 0; i < 20 && made < 2; i++) {
      const a = rnd() * TWO_PI;
      const rr = rnd() * d.r * 0.8;
      const x = d.x + Math.sin(a) * rr;
      const z = d.z + Math.cos(a) * rr;
      if (inWater(x, z) || !free(x, z, 3.7, 3.7, 0, 3)) continue;
      addWreck(x, z, false);
      made++;
    }
  };

  const radarDishes: THREE.Object3D[] = [];
  const buildOutpost = (d: District) => {
    // sandbag ring with gaps
    const ringR = d.r * 0.62;
    const gaps = [rnd() * TWO_PI, rnd() * TWO_PI];
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TWO_PI;
      if (gaps.some((g) => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < 0.4)) continue;
      const x = d.x + Math.sin(a) * ringR;
      const z = d.z + Math.cos(a) * ringR;
      if (free(x, z, 3.6, 1.3, a + Math.PI / 2, 1.5)) addBerm(x, z, 7.2, a + Math.PI / 2);
    }
    // watchtower
    const tx = d.x + rand(-4, 4);
    const tz = d.z + rand(-4, 4);
    if (free(tx, tz, 3.2, 3.2, 0, 2)) {
      const g = new THREE.Group();
      for (const sx of [-2.2, 2.2]) {
        for (const sz of [-2.2, 2.2]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 11, 0.5), metal);
          leg.position.set(sx, 5.5, sz);
          g.add(leg);
        }
      }
      const platform = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.5, 6.2), darkConcrete);
      platform.position.y = 11;
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.6, 4.6), concrete);
      cabin.position.y = 12.6;
      const glass = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.9, 4.7), new THREE.MeshStandardMaterial({ color: 0x1b2a36, emissive: 0xffc070, emissiveIntensity: theme.windowGlow * 0.6 }));
      glass.position.y = 12.9;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 1.6, 4), rust);
      roof.position.y = 14.7;
      roof.rotation.y = Math.PI / 4;
      g.add(platform, cabin, glass, roof);
      const y = heightAt(tx, tz);
      g.position.set(tx, y, tz);
      setShadows(g);
      parent.add(g);
      structures.register(addBox(tx, tz, 3.2, 3.2, 14, 0, y), g, 'WATCHTOWER', 80);
    }
    // tents
    const tentMat = new THREE.MeshStandardMaterial({ color: 0x7d7a52, roughness: 1 });
    for (let i = 0, made = 0; i < 20 && made < 3; i++) {
      const a = rnd() * TWO_PI;
      const x = d.x + Math.sin(a) * ringR * 0.55;
      const z = d.z + Math.cos(a) * ringR * 0.55;
      if (!free(x, z, 3.6, 3.6, 0, 2)) continue;
      const tent = new THREE.Mesh(new THREE.CylinderGeometry(0, 5, 3.8, 4), tentMat);
      const y = heightAt(x, z);
      tent.position.set(x, y + 1.9, z);
      tent.rotation.y = rand(0, TWO_PI) + Math.PI / 4;
      setShadows(tent);
      parent.add(tent);
      addCircle(x, z, 3.4, 3.6, y);
      made++;
    }
    // radar dish
    const rx = d.x + rand(-ringR, ringR) * 0.5;
    const rz = d.z + rand(-ringR, ringR) * 0.5;
    if (free(rx, rz, 2, 2, 0, 2)) {
      const g = new THREE.Group();
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 5, 8), metal);
      mast.position.y = 2.5;
      const dishPivot = new THREE.Group();
      dishPivot.position.y = 5.2;
      const dish = new THREE.Mesh(new THREE.SphereGeometry(2.6, 14, 8, 0, TWO_PI, 0, Math.PI / 2.4), new THREE.MeshStandardMaterial({ color: 0xcfd2d4, roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide }));
      dish.rotation.x = -Math.PI / 2.6;
      dishPivot.add(dish);
      g.add(mast, dishPivot);
      const y = heightAt(rx, rz);
      g.position.set(rx, y, rz);
      setShadows(g);
      parent.add(g);
      addCircle(rx, rz, 1.3, 7, y);
      radarDishes.push(dishPivot);
    }
    barrelCluster(d.x + rand(-8, 8), d.z + rand(-8, 8), 4);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TWO_PI;
      const x = d.x + Math.sin(a) * (d.r * 0.85);
      const z = d.z + Math.cos(a) * (d.r * 0.85);
      if (free(x, z, 0.5, 0.5, 0, 1.5)) addLamp(x, z);
    }
  };

  const strata = makeStrataTexture();
  const mesaMat = new THREE.MeshStandardMaterial({ map: strata, roughness: 1, flatShading: true });
  const buildMesas = (d: District) => {
    const count = 6 + Math.floor(rnd() * 4);
    for (let i = 0, made = 0; i < 60 && made < count; i++) {
      const a = rnd() * TWO_PI;
      const rr = rnd() * d.r * 0.85;
      const x = d.x + Math.sin(a) * rr;
      const z = d.z + Math.cos(a) * rr;
      const r = rand(4, 9);
      const h = rand(14, 34);
      if (!free(x, z, r + 1, r + 1, 0, 7)) continue;
      const geo = new THREE.CylinderGeometry(r * rand(0.62, 0.9), r * 1.18, h, 10, 4);
      const p = geo.getAttribute('position') as THREE.BufferAttribute;
      for (let v = 0; v < p.count; v++) {
        const px = p.getX(v);
        const py = p.getY(v);
        const pz = p.getZ(v);
        const k = 1 + 0.12 * Math.sin(px * 1.7 + py * 2.3) * Math.cos(pz * 1.9 + py * 1.1);
        p.setX(v, px * k);
        p.setZ(v, pz * k);
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mesaMat);
      const y = baseY(x, z, r);
      m.position.set(x, y + h / 2 - 1, z);
      m.rotation.y = rand(0, TWO_PI);
      setShadows(m);
      parent.add(m);
      addCircle(x, z, r * 0.95, h, y);
      made++;
    }
    for (let i = 0, made = 0; i < 30 && made < 5; i++) {
      const a = rnd() * TWO_PI;
      const rr = rnd() * d.r * 0.9;
      const x = d.x + Math.sin(a) * rr;
      const z = d.z + Math.cos(a) * rr;
      const s = rand(3.5, 6);
      if (!free(x, z, s, s, 0, 3)) continue;
      addRock(x, z, s);
      made++;
    }
  };

  const crystalMat = new THREE.MeshStandardMaterial({ color: 0x2a1a10, emissive: 0xff7a2a, emissiveIntensity: 2.6, roughness: 0.4 });
  const buildCrater = (d: District) => {
    // a glowing impact shard cluster in the middle of the bowl
    const cy = heightAt(d.x, d.z);
    const shards = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const h = rand(3, 9);
      const shard = new THREE.Mesh(new THREE.ConeGeometry(rand(0.7, 1.5), h, 5), crystalMat);
      const a = rnd() * TWO_PI;
      const rr = rand(0, 4);
      shard.position.set(Math.sin(a) * rr, h / 2, Math.cos(a) * rr);
      shard.rotation.set(rand(-0.4, 0.4), 0, rand(-0.4, 0.4));
      shards.add(shard);
    }
    shards.position.set(d.x, cy, d.z);
    parent.add(shards);
    addCircle(d.x, d.z, 4.5, 8, cy);
    fires.push(new THREE.Vector3(d.x + 5, cy + 1.2, d.z));
    for (let i = 0, made = 0; i < 40 && made < 5; i++) {
      const a = rnd() * TWO_PI;
      const rr = rand(0.25, 0.7) * d.r;
      const x = d.x + Math.sin(a) * rr;
      const z = d.z + Math.cos(a) * rr;
      if (!free(x, z, 3.7, 3.7, 0, 3)) continue;
      addWreck(x, z, made < 2);
      made++;
    }
    for (let i = 0, made = 0; i < 40 && made < 7; i++) {
      const a = rnd() * TWO_PI;
      const rr = rand(0.5, 0.95) * d.r;
      const x = d.x + Math.sin(a) * rr;
      const z = d.z + Math.cos(a) * rr;
      const s = rand(3.5, 6);
      if (!free(x, z, s, s, 0, 3)) continue;
      addRock(x, z, s);
      made++;
    }
    barrelCluster(d.x + d.r * 0.5, d.z, 3);
  };

  for (const d of layout.districts) {
    switch (d.type) {
      case 'city': buildCity(d); break;
      case 'industrial': buildIndustrial(d); break;
      case 'ruins': buildRuins(d); break;
      case 'highlands': buildHighlands(d); break;
      case 'marsh': buildMarsh(d); break;
      case 'outpost': buildOutpost(d); break;
      case 'mesas': buildMesas(d); break;
      case 'crater': buildCrater(d); break;
    }
  }

  // ======================================================================
  // CENTRAL PLAZA: monument and barrier arcs (hull-down positions)
  // ======================================================================
  {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.8, 1.6, 8), concrete);
    base.position.y = 0.8;
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.6, 5, 2.6), darkConcrete);
    plinth.position.y = 4;
    const statue = makeWreck();
    statue.scale.setScalar(0.42);
    statue.position.y = 6.5;
    statue.rotation.set(0, 0.6, 0);
    g.add(base, plinth, statue);
    const my = heightAt(0, 26);
    g.position.set(0, my, 26);
    setShadows(g);
    parent.add(g);
    addCircle(0, 26, 4.6, 8, my);
    // Alternate full-height sight breaks and low firing positions. Staggering
    // the nests leaves wide radial exits even for a heavy custom chassis.
    const nests = pick([3, 4, 5]);
    const bearing = rand(0, TWO_PI);
    for (let k = 0; k < nests; k++) {
      const a = bearing + k * TWO_PI / nests;
      const r = rand(28, 38);
      const tall = k % 2 === 0;
      const x = Math.sin(a) * r, z = Math.cos(a) * r;
      if (!free(x, z, 6.5, 2, a, 2)) continue;
      const h = tall ? 5.2 : 1.9, len = tall ? 11 : 13;
      const y = baseY(x, z, 3);
      if (tall) {
        const g = new THREE.Group(); g.position.set(x,y,z); g.rotation.y = a;
        const panel = new THREE.Mesh(new THREE.BoxGeometry(len,h,2), concrete); panel.position.y=h/2;
        g.add(panel); setShadows(g); parent.add(g);
        structures.register(addBox(x,z,len/2,1,h,a,y),g,'BREACH WALL',60);
        addLamp(x + Math.cos(a) * 6.5, z - Math.sin(a) * 6.5);
      } else if (blocks.add(x,y+h/2,z,len,h,2,a)) {
        addBox(x,z,len/2,1,h,a,y);
      }
    }
  }

  // ======================================================================
  // OPEN GROUND: berms, boulders, wrecks, trees, pylons, turbines, barrels
  // ======================================================================
  const anywhere = (rMin: number, rMax: number): [number, number] => {
    const a = rnd() * TWO_PI;
    const d = rand(rMin, rMax);
    return [Math.sin(a) * d, Math.cos(a) * d];
  };
  for (let i = 0, made = 0; i < 160 && made < 12; i++) {
    const [x, z] = anywhere(40, WORLD_RADIUS - 50);
    if (inFlat(x, z) || inWater(x, z)) continue;
    const len = rand(8, 16);
    const rot = rand(0, Math.PI);
    if (!free(x, z, len / 2, 1.4, rot, 5)) continue;
    addBerm(x, z, len, rot);
    made++;
  }
  for (let i = 0, made = 0; i < 260 && made < 70; i++) {
    const [x, z] = anywhere(30, WORLD_RADIUS - 50);
    if (inFlat(x, z) || inWater(x, z)) continue;
    const s = rand(3.5, 7.5);
    if (!free(x, z, s, s, 0, 4)) continue;
    addRock(x, z, s);
    made++;
  }
  for (let i = 0, made = 0; i < 120 && made < 6; i++) {
    const [x, z] = anywhere(35, WORLD_RADIUS - 60);
    if (inFlat(x, z) || inWater(x, z) || !free(x, z, 3.6, 3.6, 0, 4)) continue;
    addWreck(x, z, made < 3);
    made++;
  }
  // wind turbines (animated)
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xe6e6e0, roughness: 0.5 });
  for (let i = 0, made = 0; i < 80 && made < 6; i++) {
    const [x, z] = anywhere(60, WORLD_RADIUS - 70);
    if (inFlat(x, z) || inWater(x, z) || !free(x, z, 2.4, 2.4, 0, 6)) continue;
    const y = heightAt(x, z);
    const g = new THREE.Group();
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.5, 30, 10), bladeMat);
    tower.position.y = 15;
    const nacelle = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 5), bladeMat);
    nacelle.position.y = 30.5;
    const rotor = new THREE.Group();
    rotor.position.set(0, 30.5, 2.8);
    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.7, 14, 0.25), bladeMat);
      const arm = new THREE.Group();
      arm.rotation.z = (b / 3) * TWO_PI;
      blade.position.y = 7.4;
      arm.add(blade);
      rotor.add(arm);
    }
    g.add(tower, nacelle, rotor);
    g.position.set(x, y, z);
    g.rotation.y = rand(0, TWO_PI);
    setShadows(g);
    parent.add(g);
    addCircle(x, z, 2, 32, y);
    const speed = rand(0.5, 1.1);
    animators.push((dt) => {
      rotor.rotation.z += dt * speed;
    });
    made++;
  }
  // pylon lines with sagging cables between far-apart districts
  const cableMat = new THREE.LineBasicMaterial({ color: 0x1a1a1a });
  const cablePts: THREE.Vector3[] = [];
  const pylonLine = (ax: number, az: number, bx: number, bz: number) => {
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.floor(len / 58);
    let prev: THREE.Vector3[] | null = null;
    for (let i = 0; i <= n; i++) {
      const t = i / Math.max(1, n);
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      if (Math.hypot(x, z) > WORLD_RADIUS - 50 || inWater(x, z)) {
        prev = null;
        continue;
      }
      const y = heightAt(x, z);
      const g = new THREE.Group();
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 1.1, 22, 4), metal);
      mast.position.y = 11;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(9, 0.5, 0.5), metal);
      arm.position.y = 20;
      g.add(mast, arm);
      g.position.set(x, y, z);
      g.rotation.y = Math.atan2(bx - ax, bz - az) + Math.PI / 2;
      setShadows(g);
      parent.add(g);
      const cur = [-4, 0, 4].map((off) => {
        const lx = Math.cos(g.rotation.y) * off;
        const lz = -Math.sin(g.rotation.y) * off;
        return new THREE.Vector3(x + lx, y + 19.8, z + lz);
      });
      if (prev) {
        for (let c = 0; c < 3; c++) {
          let last = prev[c];
          for (let k = 1; k <= 8; k++) {
            const u = k / 8;
            const p = prev[c].clone().lerp(cur[c], u);
            p.y -= Math.sin(u * Math.PI) * 3.5;
            cablePts.push(last, p);
            last = p;
          }
        }
      }
      prev = cur;
    }
  };
  {
    const far = shuffle(layout.districts.filter((d) => !inFlat(d.x, d.z) || d.type === 'city'));
    if (far.length >= 2) pylonLine(far[0].x + 20, far[0].z + 14, far[1].x - 20, far[1].z - 14);
    if (far.length >= 4) pylonLine(far[2].x + 18, far[2].z - 12, far[3].x - 16, far[3].z + 12);
  }
  if (cablePts.length) parent.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(cablePts), cableMat));

  // dead trees (instanced) and scattered fuel drums
  for (let i = 0, made = 0; i < 300 && made < 150; i++) {
    const [x, z] = anywhere(25, WORLD_RADIUS - 45);
    if (inFlat(x, z) || inWater(x, z)) continue;
    if (roadDist(x, z) < 7) continue;
    let blocked = false;
    for (const o of nearObstacles(x, z, 4)) if (obsDist(o, x, z) < 2) blocked = true;
    if (blocked) continue;
    const h = rand(4, 8);
    const y = heightAt(x, z) - 0.2;
    const rot = rand(0, TWO_PI);
    trunks.add(x, y + h / 2, z, 1, h, 1, rot);
    for (let k = 0; k < 4; k++) {
      const bl = rand(1.5, 3);
      const holder = new THREE.Object3D();
      holder.position.set(x, y, z);
      holder.rotation.y = rot;
      const br = new THREE.Object3D();
      br.position.set(0, h * rand(0.5, 0.95), 0);
      br.rotation.set(rand(0.6, 1.1), rand(0, TWO_PI), 0);
      br.scale.set(0.5, bl, 0.5);
      br.translateY(bl / 2);
      holder.add(br);
      holder.updateMatrixWorld(true);
      branches.addMatrix(br.matrixWorld);
    }
    made++;
  }
  for (let i = 0; i < 40; i++) {
    const [x, z] = anywhere(35, WORLD_RADIUS - 55);
    if (inWater(x, z)) continue;
    barrelCluster(x, z, 2);
    if (barrels.length >= 44) break;
  }

  for (const p of [rocks, trunks, branches, reeds, berms, blocks, containers, lampPoles, lampHeads]) p.finish();
  for (const f of fires) f.y = Math.max(f.y, heightAt(f.x, f.z) + 0.5);

  // Each relay is a one-use objective in the initial playable perimeter.
  const relays: FieldRelay[] = [];
  for (const reward of ['rapid', 'repair'] as const) {
    for (let attempt = 0; attempt < 160; attempt++) {
      const [x, z] = anywhere(50, START_RADIUS - 26);
      if (inWater(x, z) || nearObstacles(x, z, 12).some(o => obsDist(o, x, z) < 12)) continue;
      if (relays.some(r => Math.hypot(x-r.marker.position.x, z-r.marker.position.z) < 64)) continue;
      const marker = new THREE.Group();
      const y = heightAt(x,z);
      marker.position.set(x,y,z);
      const neon = new THREE.MeshBasicMaterial({ color: reward === 'repair' ? 0x63ffba : 0xffaf46 });
      const path = Array.from({length: 49}, (_, i) => {
        const dx = Math.sin(i * TWO_PI / 48) * 9, dz = Math.cos(i * TWO_PI / 48) * 9;
        return new THREE.Vector3(dx, heightAt(x+dx,z+dz)-y+0.35, dz);
      });
      marker.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path), 48, 0.13, 4), neon));
      const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(1.8), new THREE.MeshBasicMaterial({color: neon.color, wireframe: true}));
      beacon.position.y = 6; marker.add(beacon);
      animators.push((dt,t) => { if(marker.visible) { beacon.rotation.y += dt; beacon.position.y = 6 + Math.sin(t*2)*0.6; } });
      parent.add(marker);
      // Two offset blast screens shelter the capture ring without closing it.
      // A pilot can take the longer open side or punch a direct firing lane.
      const approach = rand(0,TWO_PI);
      for (const arm of [-0.88,0.88]) {
        const facing=approach+arm, wx=x+Math.sin(facing)*13, wz=z+Math.cos(facing)*13;
        if(inWater(wx,wz) || !free(wx,wz,5.4,1.2,facing,2.8)) continue;
        const wy=baseY(wx,wz,3), high=arm>0 ? 6.2 : 3.7;
        const screen=new THREE.Group();screen.position.set(wx,wy,wz);screen.rotation.y=facing;
        const slab=new THREE.Mesh(new THREE.BoxGeometry(10.8,high,2.2),darkConcrete);slab.position.y=high/2;
        screen.add(slab);setShadows(screen);parent.add(screen);
        structures.register(addBox(wx,wz,5.4,1.1,high,facing,wy),screen,'RELAY SCREEN',75);
      }
      relays.push({marker, reward, charge: 0, claimed: false});
      break;
    }
  }
  const animate = (dt: number, t: number) => {
    fenceTex.offset.x = t * 0.018;
    fenceTex.offset.y = Math.sin(t * 0.6) * 0.02;
    for (const a of animators) a(dt, t);
    for (const d of radarDishes) d.rotation.y += dt * 0.9;
  };

  return { structures, relays, fires, barrels, waterTexture, setRadius, animate };
}
