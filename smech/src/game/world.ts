import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Procedural world
//
// Every deployment generates a complete sector from a short seed code: a
// weather/time-of-day theme, a road network and a set of themed districts
// (city, industrial yard, ruins, highlands, marsh, outpost, mesas, crater).
// The whole map is generated up front; the playable perimeter starts small and
// is pushed outwards as the player survives, revealing new districts.
// ---------------------------------------------------------------------------

export const WORLD_RADIUS = 380;
export const START_RADIUS = 200;
export const ZONE_STEP = 48;
export const MAX_ZONE = 3;
export const zoneRadius = (zone: number) => Math.min(START_RADIUS + zone * ZONE_STEP, WORLD_RADIUS - 28);

const TWO_PI = Math.PI * 2;

// ---------------------------------------------------------------------------
// Seeded random numbers
// ---------------------------------------------------------------------------
let rngState = 1;
function seedRng(seed: number) {
  rngState = seed >>> 0 || 1;
}
function rnd() {
  rngState = (rngState + 0x6d2b79f5) >>> 0;
  let t = rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rand = (a: number, b: number) => a + rnd() * (b - a);
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
const chance = (p: number) => rnd() < p;
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function seedFromString(code: string) {
  let h = 2166136261;
  for (let i = 0; i < code.length; i++) {
    h ^= code.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function randomSeedCode() {
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return `${s.slice(0, 3)}-${s.slice(3)}`;
}

// ---------------------------------------------------------------------------
// Themes (time of day / weather)
// ---------------------------------------------------------------------------
export interface Theme {
  name: string;
  skyTop: number;
  skyHorizon: number;
  skyBottom: number;
  fog: number;
  fogNear: number;
  fogFar: number;
  sunColor: number;
  sunIntensity: number;
  sunDir: [number, number, number];
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  ambient: number;
  ambientIntensity: number;
  exposure: number;
  ground: string;
  windowGlow: number;
  stars: number;
  sunDisc: number;
  sunSize: number;
  dust: number;
  ambience: 'wind' | 'night' | 'storm';
}

const THEMES: Theme[] = [
  {
    name: 'DUSK', skyTop: 0x16223d, skyHorizon: 0xc4a27f, skyBottom: 0x3d3128, fog: 0xc4a27f, fogNear: 70, fogFar: 520,
    sunColor: 0xffd6ad, sunIntensity: 2.6, sunDir: [0.55, 0.32, 0.45], hemiSky: 0xb4c4e0, hemiGround: 0x6a5744, hemiIntensity: 1.35,
    ambient: 0x8a7a6a, ambientIntensity: 0.35, exposure: 1.1, ground: '#857a5c', windowGlow: 1.1, stars: 0, sunDisc: 0xffe9c4, sunSize: 38, dust: 1, ambience: 'wind',
  },
  {
    name: 'HIGH NOON', skyTop: 0x3d6fb0, skyHorizon: 0xd8d2c0, skyBottom: 0x6b6252, fog: 0xcfc7b4, fogNear: 110, fogFar: 620,
    sunColor: 0xfff1dc, sunIntensity: 3.1, sunDir: [0.25, 0.85, 0.2], hemiSky: 0xc8dcf5, hemiGround: 0x7c6a50, hemiIntensity: 1.5,
    ambient: 0x9a8c7a, ambientIntensity: 0.35, exposure: 1.05, ground: '#9a8c68', windowGlow: 0.25, stars: 0, sunDisc: 0xfffaf0, sunSize: 30, dust: 0.7, ambience: 'wind',
  },
  {
    name: 'NIGHT OPS', skyTop: 0x04070f, skyHorizon: 0x1a2a45, skyBottom: 0x0a0d14, fog: 0x131f33, fogNear: 40, fogFar: 380,
    sunColor: 0x7f9fe0, sunIntensity: 1.15, sunDir: [-0.4, 0.55, 0.3], hemiSky: 0x3a4f80, hemiGround: 0x1c1a22, hemiIntensity: 0.9,
    ambient: 0x303a52, ambientIntensity: 0.55, exposure: 1.25, ground: '#6e6a5a', windowGlow: 2.4, stars: 1, sunDisc: 0xdfe8ff, sunSize: 16, dust: 0.5, ambience: 'night',
  },
  {
    name: 'DUST STORM', skyTop: 0x6a4a2c, skyHorizon: 0xb8895a, skyBottom: 0x3a2a1c, fog: 0xb0825a, fogNear: 12, fogFar: 240,
    sunColor: 0xffb070, sunIntensity: 1.9, sunDir: [0.5, 0.45, 0.2], hemiSky: 0xd9a878, hemiGround: 0x5c4430, hemiIntensity: 1.3,
    ambient: 0x8a6a4a, ambientIntensity: 0.4, exposure: 1.15, ground: '#8a6c48', windowGlow: 1.3, stars: 0, sunDisc: 0xffc890, sunSize: 46, dust: 3.2, ambience: 'storm',
  },
  {
    name: 'ASHFALL', skyTop: 0x1f2226, skyHorizon: 0x7b7a74, skyBottom: 0x242320, fog: 0x6b6a66, fogNear: 35, fogFar: 340,
    sunColor: 0xd8d2c4, sunIntensity: 1.8, sunDir: [0.3, 0.5, 0.5], hemiSky: 0x9aa0a6, hemiGround: 0x4a4640, hemiIntensity: 1.2,
    ambient: 0x6a6a68, ambientIntensity: 0.4, exposure: 1.1, ground: '#6f6b60', windowGlow: 1.0, stars: 0, sunDisc: 0xe8e2d4, sunSize: 26, dust: 1.6, ambience: 'wind',
  },
];

// ---------------------------------------------------------------------------
// Layout data
// ---------------------------------------------------------------------------
export type DistrictType = 'city' | 'industrial' | 'ruins' | 'highlands' | 'marsh' | 'outpost' | 'mesas' | 'crater';

export interface District {
  type: DistrictType;
  name: string;
  x: number;
  z: number;
  r: number;
  /** perimeter zone at which the district centre becomes reachable */
  zone: number;
}

export interface Layout {
  code: string;
  theme: Theme;
  districts: District[];
  roads: [number, number][][];
}

interface Hill {
  x: number;
  z: number;
  r: number;
  h: number;
}
interface Circle {
  x: number;
  z: number;
  r: number;
}
interface Water {
  x: number;
  z: number;
  rx: number;
  rz: number;
  level: number;
}

let HILLS: Hill[] = [];
let FLATS: Circle[] = [];
let WATER: Water[] = [];
let ROAD_SEGS: number[][] = [];
let DISTRICTS: District[] = [];

const NAMES: Record<DistrictType, string[]> = {
  city: ['DOWNTOWN', 'MERIDIAN CITY', 'HARBOR HEIGHTS', 'CENTRAL BLOCKS'],
  industrial: ['FOUNDRY YARD', 'CARGO DEPOT', 'REFINERY ROW', 'SCRAPWORKS'],
  ruins: ['BROKEN QUARTER', 'SHELLED SUBURB', 'OLD TOWN', 'THE WRECKAGE'],
  highlands: ['RAZORBACK RIDGE', 'IRON HILLS', 'WINDSWEPT HEIGHTS', 'CINDER BLUFFS'],
  marsh: ['MIRROR LAKES', 'SALT MARSH', 'THE SHALLOWS', 'REED FLATS'],
  outpost: ['FORWARD BASE', 'OUTPOST DELTA', 'RELAY STATION', 'CHECKPOINT NINE'],
  mesas: ['STONE FOREST', 'PILLAR FIELD', 'RED MESAS', 'THE SPIRES'],
  crater: ['IMPACT BASIN', 'THE PIT', 'SCORCH CRATER', 'GROUND ZERO'],
};

const SIZES: Record<DistrictType, [number, number]> = {
  city: [46, 58],
  industrial: [42, 52],
  ruins: [34, 44],
  highlands: [40, 52],
  marsh: [34, 44],
  outpost: [24, 30],
  mesas: [38, 50],
  crater: [34, 44],
};

const ROAD_REACH: Record<DistrictType, number> = {
  city: 0.35, industrial: 0.45, ruins: 0.4, outpost: 0.3, highlands: 0.95, marsh: 0.95, mesas: 0.85, crater: 0.95,
};

const ALL_TYPES: DistrictType[] = ['city', 'industrial', 'ruins', 'highlands', 'marsh', 'outpost', 'mesas', 'crater'];

export function generateLayout(code: string): Layout {
  seedRng(seedFromString(code));
  HILLS = [];
  FLATS = [{ x: 0, z: 0, r: 40 }];
  WATER = [];
  ROAD_SEGS = [];
  DISTRICTS = [];
  const theme = pick(THEMES);

  const nameCount: Partial<Record<DistrictType, number>> = {};
  const typeCount: Partial<Record<DistrictType, number>> = {};
  const nameOffset: Partial<Record<DistrictType, number>> = {};
  const nameFor = (t: DistrictType) => {
    const list = NAMES[t];
    if (nameOffset[t] === undefined) nameOffset[t] = Math.floor(rnd() * list.length);
    const n = nameCount[t] ?? 0;
    nameCount[t] = n + 1;
    return list[((nameOffset[t] ?? 0) + n) % list.length];
  };
  const zoneOf = (x: number, z: number) => {
    const d = Math.hypot(x, z);
    for (let zn = 0; zn <= MAX_ZONE; zn++) if (d <= zoneRadius(zn) - 8) return zn;
    return MAX_ZONE;
  };
  const place = (type: DistrictType, rMin: number, rMax: number): District | null => {
    const [sMin, sMax] = SIZES[type];
    for (let t = 0; t < 90; t++) {
      const a = rnd() * TWO_PI;
      const dist = rand(rMin, rMax);
      const r = rand(sMin, sMax);
      const x = Math.sin(a) * dist;
      const z = Math.cos(a) * dist;
      if (dist + r > WORLD_RADIUS - 46) continue;
      if (dist - r < 46) continue;
      if (DISTRICTS.some((d) => Math.hypot(d.x - x, d.z - z) < d.r + r + 12)) continue;
      const d: District = { type, name: nameFor(type), x, z, r, zone: zoneOf(x, z) };
      DISTRICTS.push(d);
      typeCount[type] = (typeCount[type] ?? 0) + 1;
      return d;
    }
    return null;
  };
  const pickType = () => {
    const open = ALL_TYPES.filter((t) => (typeCount[t] ?? 0) < 2);
    return pick(open.length ? open : ALL_TYPES);
  };

  // the first perimeter always contains a bit of everything
  for (const t of shuffle<DistrictType>(['city', 'industrial', 'highlands', 'marsh'])) place(t, 90, 150) ?? place(t, 70, 180);
  place(pick<DistrictType>(['outpost', 'ruins']), 85, 145);
  // outer rings are revealed by the expanding perimeter
  for (let i = 0; i < 4; i++) place(pickType(), 150, 235);
  for (let i = 0; i < 5; i++) place(pickType(), 235, 320);

  // ---- terrain features from districts ----
  for (const d of DISTRICTS) {
    if (d.type === 'city' || d.type === 'industrial' || d.type === 'outpost' || d.type === 'ruins') FLATS.push({ x: d.x, z: d.z, r: d.r + 6 });
    if (d.type === 'highlands') {
      HILLS.push({ x: d.x, z: d.z, r: d.r * 0.8, h: rand(15, 22) });
      for (let k = 0; k < 3; k++) {
        const a = rnd() * TWO_PI;
        HILLS.push({ x: d.x + Math.sin(a) * d.r * 0.55, z: d.z + Math.cos(a) * d.r * 0.55, r: rand(20, 28), h: rand(8, 13) });
      }
    } else if (d.type === 'mesas') {
      HILLS.push({ x: d.x, z: d.z, r: d.r * 0.9, h: rand(3, 5) });
    } else if (d.type === 'crater') {
      HILLS.push({ x: d.x, z: d.z, r: d.r * 0.85, h: -rand(8, 11) });
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * TWO_PI + rand(-0.15, 0.15);
        HILLS.push({ x: d.x + Math.sin(a) * d.r * 0.82, z: d.z + Math.cos(a) * d.r * 0.82, r: 15, h: rand(3.5, 5.5) });
      }
    } else if (d.type === 'marsh') {
      for (let k = 0; k < 2; k++) {
        const a = rnd() * TWO_PI;
        const off = rand(0.05, 0.5) * d.r;
        WATER.push({ x: d.x + Math.sin(a) * off, z: d.z + Math.cos(a) * off, rx: rand(15, 25), rz: rand(11, 18), level: 0.55 });
      }
      HILLS.push({ x: d.x, z: d.z, r: d.r * 0.9, h: rand(2, 3.5) });
    }
  }
  // a guaranteed low ridge near the spawn, plus scattered rolling hills
  const ridgeAngle = rnd() * TWO_PI;
  for (let k = 0; k < 3; k++) {
    const a = ridgeAngle + (k - 1) * 0.42;
    const dist = rand(72, 96);
    HILLS.push({ x: Math.sin(a) * dist, z: Math.cos(a) * dist, r: rand(22, 30), h: rand(7, 9.5) });
  }
  for (let i = 0; i < 12; i++) {
    for (let t = 0; t < 20; t++) {
      const a = rnd() * TWO_PI;
      const dist = rand(70, 320);
      const hill = { x: Math.sin(a) * dist, z: Math.cos(a) * dist, r: rand(22, 42), h: rand(4, 11) };
      if (DISTRICTS.some((d) => Math.hypot(d.x - hill.x, d.z - hill.z) < d.r + hill.r * 0.7)) continue;
      HILLS.push(hill);
      break;
    }
  }
  // a small pond near the spawn that slows early flanking
  {
    const a = ridgeAngle + Math.PI * 0.6 + rand(-0.5, 0.5);
    const dist = rand(58, 80);
    WATER.push({ x: Math.sin(a) * dist, z: Math.cos(a) * dist, rx: rand(13, 18), rz: rand(9, 12), level: 0.55 });
  }

  // ---- roads connecting districts ----
  interface RoadNode {
    x: number;
    z: number;
    r: number;
  }
  const nodes: RoadNode[] = [{ x: 0, z: 0, r: 70 }];
  const roads: [number, number][][] = [];
  const sorted = [...DISTRICTS].sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
  for (const d of sorted) {
    let from = nodes[0];
    let best = Infinity;
    for (const n of nodes) {
      const dd = Math.hypot(n.x - d.x, n.z - d.z) - n.r * 0.3;
      if (dd < best) {
        best = dd;
        from = n;
      }
    }
    const len = Math.hypot(d.x - from.x, d.z - from.z);
    const ux = (d.x - from.x) / len;
    const uz = (d.z - from.z) / len;
    const p0: [number, number] = [from.x + ux * from.r * 0.5, from.z + uz * from.r * 0.5];
    const reach = d.r * ROAD_REACH[d.type];
    const p2: [number, number] = [d.x - ux * reach, d.z - uz * reach];
    const bend = rand(-18, 18);
    const p1: [number, number] = [(p0[0] + p2[0]) / 2 - uz * bend, (p0[1] + p2[1]) / 2 + ux * bend];
    const steps = Math.max(4, Math.ceil(Math.hypot(p2[0] - p0[0], p2[1] - p0[1]) / 6));
    const pts: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = (1 - t) * (1 - t);
      const b = 2 * (1 - t) * t;
      const c = t * t;
      pts.push([a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]]);
    }
    for (let i = 0; i < pts.length - 1; i++) ROAD_SEGS.push([pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]]);
    roads.push(pts);
    nodes.push({ x: d.x, z: d.z, r: d.r });
  }

  return { code, theme, districts: DISTRICTS, roads };
}

export function districtAt(x: number, z: number): string {
  if (Math.hypot(x, z) < 44) return 'CENTRAL PLAZA';
  let found = 'OPEN GROUND';
  let bd = Infinity;
  for (const d of DISTRICTS) {
    const dd = Math.hypot(d.x - x, d.z - z) / d.r;
    if (dd < 1 && dd < bd) {
      bd = dd;
      found = d.name;
    }
  }
  return found;
}

function roadDist(x: number, z: number) {
  let best = Infinity;
  for (const s of ROAD_SEGS) {
    const dx = s[2] - s[0];
    const dz = s[3] - s[1];
    const l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - s[0]) * dx + (z - s[1]) * dz) / l2));
    const d = Math.hypot(x - (s[0] + dx * t), z - (s[1] + dz * t));
    if (d < best) best = d;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Terrain
// ---------------------------------------------------------------------------
function flatMask(x: number, z: number) {
  let m = 1;
  for (const f of FLATS) {
    const d = Math.max(0, Math.hypot(x - f.x, z - f.z) - f.r);
    m = Math.min(m, Math.min(1, d / 14));
    if (m === 0) break;
  }
  return m;
}

const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** Ground height at a world position. Used for driving, projectiles and line of sight. */
export function heightAt(x: number, z: number) {
  let h = 0;
  for (const hl of HILLS) {
    const dx = x - hl.x;
    const dz = z - hl.z;
    const d2 = (dx * dx + dz * dz) / (hl.r * hl.r);
    if (d2 < 4) h += hl.h * Math.exp(-d2 * 1.6);
  }
  const d = Math.hypot(x, z);
  const rim = WORLD_RADIUS - 70;
  if (d > rim) h += smoothstep(Math.min(1, (d - rim) / 70)) * 18;
  const fm = flatMask(x, z);
  if (fm > 0) h += (Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.038 - 0.7) + Math.sin((x + z) * 0.021) * 0.6) * 0.9 * fm;
  for (const w of WATER) {
    const wd = Math.hypot((x - w.x) / w.rx, (z - w.z) / w.rz);
    if (wd < 1.2) {
      const blend = smoothstep(Math.max(0, Math.min(1, (1.2 - wd) / 0.28)));
      h += (w.level - 0.35 - h) * blend;
    }
  }
  return h;
}

export function inWater(x: number, z: number) {
  for (const w of WATER) if (Math.hypot((x - w.x) / w.rx, (z - w.z) / w.rz) < 0.9) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Obstacles + spatial grid
// ---------------------------------------------------------------------------
export interface Obstacle {
  x: number;
  z: number;
  /** bounding radius (circle obstacles: exact radius) */
  r: number;
  /** height above its base */
  h: number;
  /** terrain height at the base */
  y0: number;
  /** oriented box footprint (half extents + rotation), if not a circle */
  box?: { hw: number; hd: number; c: number; s: number; rot: number };
  stamp?: number;
}

const CELL = 32;
let gridCells = new Map<number, Obstacle[]>();
let queryStamp = 1;
const queryOut: Obstacle[] = [];
const cellKey = (cx: number, cz: number) => (cx + 64) * 256 + (cz + 64);

function gridInsert(o: Obstacle) {
  const x0 = Math.floor((o.x - o.r) / CELL);
  const x1 = Math.floor((o.x + o.r) / CELL);
  const z0 = Math.floor((o.z - o.r) / CELL);
  const z1 = Math.floor((o.z + o.r) / CELL);
  for (let cx = x0; cx <= x1; cx++) {
    for (let cz = z0; cz <= z1; cz++) {
      const k = cellKey(cx, cz);
      let arr = gridCells.get(k);
      if (!arr) {
        arr = [];
        gridCells.set(k, arr);
      }
      arr.push(o);
    }
  }
}

/**
 * Obstacles whose bounding circle may touch a circle at (x, z). The returned array is
 * shared: consume it immediately and do not call this again while iterating.
 */
export function nearObstacles(x: number, z: number, radius: number): Obstacle[] {
  queryOut.length = 0;
  queryStamp++;
  const x0 = Math.floor((x - radius) / CELL);
  const x1 = Math.floor((x + radius) / CELL);
  const z0 = Math.floor((z - radius) / CELL);
  const z1 = Math.floor((z + radius) / CELL);
  for (let cx = x0; cx <= x1; cx++) {
    for (let cz = z0; cz <= z1; cz++) {
      const arr = gridCells.get(cellKey(cx, cz));
      if (!arr) continue;
      for (const o of arr) {
        if (o.stamp === queryStamp) continue;
        o.stamp = queryStamp;
        queryOut.push(o);
      }
    }
  }
  return queryOut;
}

/** Signed distance from a point to an obstacle footprint (negative = inside). */
export function obsDist(o: Obstacle, x: number, z: number) {
  const dx = x - o.x;
  const dz = z - o.z;
  if (!o.box) return Math.hypot(dx, dz) - o.r;
  const b = o.box;
  const lx = dx * b.c - dz * b.s;
  const lz = dx * b.s + dz * b.c;
  const qx = Math.abs(lx) - b.hw;
  const qz = Math.abs(lz) - b.hd;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
}

/** Push a circle of `radius` at `pos` out of the obstacle. Returns true if it collided. */
export function obsResolve(o: Obstacle, pos: { x: number; z: number }, radius: number) {
  const dx = pos.x - o.x;
  const dz = pos.z - o.z;
  if (dx * dx + dz * dz > (o.r + radius) * (o.r + radius)) return false;
  if (!o.box) {
    const d = Math.hypot(dx, dz);
    const min = o.r + radius;
    if (d >= min) return false;
    const k = (min - d) / (d || 1);
    pos.x += dx * k;
    pos.z += dz * k;
    return true;
  }
  const b = o.box;
  const lx = dx * b.c - dz * b.s;
  const lz = dx * b.s + dz * b.c;
  const cx = Math.max(-b.hw, Math.min(b.hw, lx));
  const cz = Math.max(-b.hd, Math.min(b.hd, lz));
  const nx = lx - cx;
  const nz = lz - cz;
  const d = Math.hypot(nx, nz);
  let pushLx = 0;
  let pushLz = 0;
  if (d > 1e-4) {
    if (d >= radius) return false;
    pushLx = (nx / d) * (radius - d);
    pushLz = (nz / d) * (radius - d);
  } else {
    const px = b.hw - Math.abs(lx);
    const pz = b.hd - Math.abs(lz);
    if (px < pz) pushLx = Math.sign(lx || 1) * (px + radius);
    else pushLz = Math.sign(lz || 1) * (pz + radius);
  }
  pos.x += pushLx * b.c + pushLz * b.s;
  pos.z += -pushLx * b.s + pushLz * b.c;
  return true;
}

/** World-space footprint corners (for the radar). */
export function obsCorners(o: Obstacle): [number, number][] | null {
  if (!o.box) return null;
  const { hw, hd, c, s } = o.box;
  const pts: [number, number][] = [];
  for (const [lx, lz] of [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ]) {
    pts.push([o.x + lx * c + lz * s, o.z - lx * s + lz * c]);
  }
  return pts;
}

// ---------------------------------------------------------------------------
// Textures
// ---------------------------------------------------------------------------
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
  constructor(scene: THREE.Scene, geo: THREE.BufferGeometry, mat: THREE.Material, cap: number, shadows = true) {
    this.cap = cap;
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = shadows;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);
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

export interface MapResult {
  /** persistent fires (burning oil, wrecks) – the engine emits particles here */
  fires: THREE.Vector3[];
  barrels: ExplosiveBarrel[];
  waterTexture: THREE.Texture;
  /** move the perimeter fence to a new radius */
  setRadius: (r: number) => void;
  /** per-frame animation (turbines, radar dishes, fence shimmer) */
  animate: (dt: number, t: number) => void;
}

export function buildMap(scene: THREE.Scene, obstacles: Obstacle[], makeWreck: () => THREE.Group, layout: Layout): MapResult {
  const theme = layout.theme;
  const fires: THREE.Vector3[] = [];
  const barrels: ExplosiveBarrel[] = [];
  const animators: ((dt: number, t: number) => void)[] = [];
  gridCells = new Map();
  queryStamp = 1;
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
  const ground = new THREE.Mesh(tgeo, new THREE.MeshStandardMaterial({ map: makeGroundTexture(theme.ground), vertexColors: true, roughness: 1, metalness: 0 }));
  ground.receiveShadow = true;
  scene.add(ground);

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
    scene.add(water, shore);
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
    scene.add(road);
  }

  // ---- distant mountains -------------------------------------------------
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
    scene.add(m);
  }

  // ---- perimeter fence (moves outwards as the map expands) --------------
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
  scene.add(fence);
  const PYLONS = 56;
  const pylons = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 1, 1.1), new THREE.MeshStandardMaterial({ color: 0x3b4650, roughness: 0.5, metalness: 0.7, emissive: 0x2ad0ff, emissiveIntensity: 0.4 }), PYLONS);
  pylons.frustumCulled = false;
  pylons.castShadow = true;
  scene.add(pylons);
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
  };
  setRadius(START_RADIUS);

  // ---- shared materials & instanced pools -------------------------------
  const concrete = new THREE.MeshStandardMaterial({ color: 0x8b857a, roughness: 0.95 });
  const darkConcrete = new THREE.MeshStandardMaterial({ color: 0x5d5952, roughness: 0.95 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x4b4f55, roughness: 0.55, metalness: 0.6 });
  const rust = new THREE.MeshStandardMaterial({ color: 0x6e4b33, roughness: 0.85, metalness: 0.3 });
  const beaconMat = new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 4 });
  const facades = ['#8b857a', '#7a756c', '#9a9184', '#6f6a63', '#857868', '#7c8088'].map(makeFacadeTextures);

  const rocks = new Pool(scene, new THREE.DodecahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }), 640);
  const rockColors = [0x75685a, 0x6b6256, 0x84766a, 0x7a6a58, 0x66605a].map((c) => new THREE.Color(c));
  const barkMat = new THREE.MeshStandardMaterial({ color: 0x3a2e24, roughness: 1 });
  const trunks = new Pool(scene, new THREE.CylinderGeometry(0.18, 0.35, 1, 5), barkMat, 180);
  const branches = new Pool(scene, new THREE.CylinderGeometry(0.18, 0.35, 1, 5), barkMat, 720, false);
  const reeds = new Pool(scene, new THREE.ConeGeometry(0.1, 1, 4), new THREE.MeshStandardMaterial({ color: 0x7d7a45, roughness: 1 }), 900, false);
  const berms = new Pool(scene, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x9c8a62, roughness: 1 }), 160);
  const blocks = new Pool(scene, new THREE.BoxGeometry(1, 1, 1), concrete, 60);
  const containers = new Pool(scene, new THREE.BoxGeometry(12, 2.6, 2.5), new THREE.MeshStandardMaterial({ map: makeContainerTexture(), color: 0xffffff, roughness: 0.7, metalness: 0.35 }), 300);
  const lampPoles = new Pool(scene, new THREE.CylinderGeometry(0.12, 0.16, 1, 6), metal, 160, false);
  const lampHeads = new Pool(scene, new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffcf80, emissiveIntensity: 1.3 + theme.windowGlow * 2 }), 160, false);
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
    rocks.add(x, y + sy * 0.3, z, s * rand(0.8, 1.4), sy, s * rand(0.8, 1.4), rand(0, TWO_PI), rand(0, 0.4), rand(0, 0.4), pick(rockColors));
    if (collide) addCircle(x, z, s * 0.95, sy * 1.2, y);
  };
  const addLamp = (x: number, z: number) => {
    const y = heightAt(x, z);
    lampPoles.add(x, y + 3.5, z, 1, 7, 1);
    lampHeads.add(x, y + 7.2, z, 1, 1, 1);
  };
  const addBerm = (x: number, z: number, len: number, rot: number) => {
    const y = baseY(x, z, len / 2);
    berms.add(x, y + 0.95, z, len, 1.9, 2.4, rot, 0, 0, sandbagColor);
    addBox(x, z, len / 2, 1.2, 1.9, rot, y);
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
    scene.add(group);
    barrels.push({ group, pos: new THREE.Vector3(x, y + 1.05, z), hp: 20, destroyed: false });
  };
  const barrelGeo = new THREE.CylinderGeometry(0.68, 0.72, 2.1, 12);
  const bandGeo = new THREE.CylinderGeometry(0.73, 0.73, 0.2, 12);
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0xac392a, roughness: 0.55, metalness: 0.55 });
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
    scene.add(g);
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
    scene.add(g);
    addBox(x, z, w / 2 + 0.3, d / 2 + 0.3, h + 1, 0, y0);
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
    scene.add(wall);
    addCircle(x, z, 6, 3, y);
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
          containers.add(x + lx * c + side * s, y + 1.3 + lvl * 2.6, z - lx * s + side * c, 1, 1, 1, rot, 0, 0, pick(containerColors));
        }
      }
      addBox(x, z, 6.1, 2.7, stack * 2.6, rot, y);
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
      scene.add(g);
      addBox(wx, wz, 23, 13, 17, 0, y);
      break;
    }
    // fuel tanks
    const tankMat = new THREE.MeshStandardMaterial({ color: 0xb9b4a8, roughness: 0.5, metalness: 0.5 });
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
      scene.add(g);
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
      scene.add(crane);
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
      scene.add(wall, top);
      addBox(x, z, w / 2, 0.8, hgt, rot, y);
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
        scene.add(g);
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
        rocks.add(x, y + sy * 0.3, z, s, sy, s, rand(0, TWO_PI), rand(0, 0.3), rand(0, 0.3), pick(rockColors));
        addCircle(x, z, s * 0.95, sy * 1.2, y);
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
      scene.add(g);
      addCircle(tx, tz, 3.2, 14, y);
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
      scene.add(tent);
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
      scene.add(g);
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
      scene.add(m);
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
    scene.add(shards);
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
    scene.add(g);
    addCircle(0, 26, 4.6, 8, my);
    for (let k = 0; k < 4; k++) {
      const ac = (k * Math.PI) / 2 + 0.35;
      for (const j of [-1, 0, 1]) {
        const a = ac + j * 0.42;
        const x = Math.sin(a) * 20;
        const z = Math.cos(a) * 20;
        const y = heightAt(x, z);
        blocks.add(x, y + 0.75, z, 8, 1.5, 1, a + Math.PI / 2);
        addBox(x, z, 4, 0.5, 1.5, a + Math.PI / 2, y);
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
    scene.add(g);
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
      scene.add(g);
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
  if (cablePts.length) scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(cablePts), cableMat));

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

  const animate = (dt: number, t: number) => {
    fenceTex.offset.x = t * 0.018;
    fenceTex.offset.y = Math.sin(t * 0.6) * 0.02;
    for (const a of animators) a(dt, t);
    for (const d of radarDishes) d.rotation.y += dt * 0.9;
  };

  return { fires, barrels, waterTexture, setRadius, animate };
}
