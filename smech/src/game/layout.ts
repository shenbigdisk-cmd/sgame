/**
 * Sector layout: the seeded skeleton of a map.
 *
 * A layout decides the theme (time of day and weather), the named districts,
 * the road network and the terrain features (hills, flats and water) that the
 * world builder dresses in concrete.
 */

import { pick, rand, rnd, seedFromString, seedRng, shuffle } from './rng';

export const WORLD_RADIUS = 380;
export const START_RADIUS = 200;
export const ZONE_STEP = 48;
export const MAX_ZONE = 3;
export const zoneRadius = (zone: number) => Math.min(START_RADIUS + zone * ZONE_STEP, WORLD_RADIUS - 28);

const TWO_PI = Math.PI * 2;

// ---------------------------------------------------------------------------
// Seeded random numbers
// ---------------------------------------------------------------------------
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
export type DistrictType = 'city' | 'industrial' | 'ruins' | 'highlands' | 'marsh' | 'outpost' | 'mesas' | 'crater' | 'forest' | 'beach' | 'grassplain';

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

export interface RiverSegment {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  width: number;
  level: number;
}

export interface Bridge {
  x: number;
  z: number;
  length: number;
  width: number;
  angle: number;
  y: number;
}

export let HILLS: Hill[] = [];
export let FLATS: Circle[] = [];
export let WATER: Water[] = [];
export let RIVERS: RiverSegment[] = [];
export let BRIDGES: Bridge[] = [];
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
  forest: ['JADE CANOPY', 'CEDAR RIDGE', 'BLACKWOOD TAIGA', 'MISTY VALE', 'EMERALD PINES'],
  beach: ['COASTAL SHALLOWS', 'AZURE COVE', 'REEF STRAND', 'DRIFTWOOD SHOAL', 'WHITE SANDS'],
  grassplain: ['STEPPE REACH', 'VERDANT BASIN', 'GOLDEN MEADOW', 'SAVANNAH FLAT', 'PRAIRIE RUN'],
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
  forest: [40, 52],
  beach: [36, 46],
  grassplain: [44, 56],
};

const ROAD_REACH: Record<DistrictType, number> = {
  city: 0.35, industrial: 0.45, ruins: 0.4, outpost: 0.3, highlands: 0.95, marsh: 0.95, mesas: 0.85, crater: 0.95,
  forest: 0.65, beach: 0.7, grassplain: 0.5,
};

const ALL_TYPES: DistrictType[] = ['city', 'industrial', 'ruins', 'highlands', 'marsh', 'outpost', 'mesas', 'crater', 'forest', 'beach', 'grassplain'];

export function generateLayout(code: string): Layout {
  seedRng(seedFromString(code));
  HILLS = [];
  FLATS = [{ x: 0, z: 0, r: 40 }];
  WATER = [];
  RIVERS = [];
  BRIDGES = [];
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
  for (const t of shuffle<DistrictType>(['city', 'industrial', 'highlands', 'marsh'])) {
    if (!place(t, 90, 150)) place(t, 70, 180);
  }
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
    } else if (d.type === 'forest') {
      HILLS.push({ x: d.x, z: d.z, r: d.r * 0.8, h: rand(4.5, 8.5) });
      for (let k = 0; k < 2; k++) {
        const a = rnd() * TWO_PI;
        HILLS.push({ x: d.x + Math.sin(a) * d.r * 0.5, z: d.z + Math.cos(a) * d.r * 0.5, r: rand(18, 26), h: rand(3, 6) });
      }
    } else if (d.type === 'beach') {
      FLATS.push({ x: d.x, z: d.z, r: d.r + 5 });
      const a = rnd() * TWO_PI;
      WATER.push({ x: d.x + Math.sin(a) * d.r * 0.35, z: d.z + Math.cos(a) * d.r * 0.35, rx: rand(18, 28), rz: rand(14, 22), level: 0.45 });
    } else if (d.type === 'grassplain') {
      HILLS.push({ x: d.x, z: d.z, r: d.r * 0.85, h: rand(2.5, 5) });
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

  // ---- continuous river system ----
  const riverA = rnd() * TWO_PI;
  const riverTargetA = riverA + Math.PI + rand(-0.6, 0.6);
  const riverW = rand(15, 20);
  const riverLevel = 0.5;

  const rWaypoints: [number, number][] = [];
  const startDist = WORLD_RADIUS - 65;
  rWaypoints.push([Math.sin(riverA) * startDist, Math.cos(riverA) * startDist]);

  const midSteps = 4;
  for (let s = 1; s <= midSteps; s++) {
    const t = s / (midSteps + 1);
    const ang = riverA + (riverTargetA - riverA) * t + rand(-0.35, 0.35);
    const dist = rand(70, 210);
    rWaypoints.push([Math.sin(ang) * dist, Math.cos(ang) * dist]);
  }
  rWaypoints.push([Math.sin(riverTargetA) * startDist, Math.cos(riverTargetA) * startDist]);

  for (let i = 0; i < rWaypoints.length - 1; i++) {
    const p0 = rWaypoints[i];
    const p1 = rWaypoints[i + 1];
    const segs = Math.max(3, Math.ceil(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / 26));
    for (let k = 0; k < segs; k++) {
      const t0 = k / segs;
      const t1 = (k + 1) / segs;
      const x0 = p0[0] + (p1[0] - p0[0]) * t0;
      const z0 = p0[1] + (p1[1] - p0[1]) * t0;
      const x1 = p0[0] + (p1[0] - p0[0]) * t1;
      const z1 = p0[1] + (p1[1] - p0[1]) * t1;
      RIVERS.push({ x0, z0, x1, z1, width: riverW, level: riverLevel });
    }
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

  // ---- road bridges across rivers ----
  for (const pts of roads) {
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const mx = (p0[0] + p1[0]) / 2;
      const mz = (p0[1] + p1[1]) / 2;
      const rd = riverDist(mx, mz);
      if (rd.seg && rd.dist < rd.seg.width * 0.7) {
        if (!BRIDGES.some((b) => Math.hypot(b.x - mx, b.z - mz) < 28)) {
          const dx = p1[0] - p0[0];
          const dz = p1[1] - p0[1];
          const angle = Math.atan2(dx, dz);
          const approachY = Math.max(rd.seg.level + 0.88, (heightAt(p0[0], p0[1]) + heightAt(p1[0], p1[1])) / 2 + 0.5);
          BRIDGES.push({
            x: mx,
            z: mz,
            length: Math.max(26, rd.seg.width * 1.65),
            width: 11.2,
            angle,
            y: approachY,
          });
        }
      }
    }
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

export function roadDist(x: number, z: number) {
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

export function riverDist(x: number, z: number): { dist: number; seg?: RiverSegment } {
  let best = Infinity;
  let bestSeg: RiverSegment | undefined;
  for (const r of RIVERS) {
    const dx = r.x1 - r.x0;
    const dz = r.z1 - r.z0;
    const l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - r.x0) * dx + (z - r.z0) * dz) / l2));
    const d = Math.hypot(x - (r.x0 + dx * t), z - (r.z0 + dz * t));
    if (d < best) {
      best = d;
      bestSeg = r;
    }
  }
  return { dist: best, seg: bestSeg };
}

export function onBridge(x: number, z: number): Bridge | null {
  for (const b of BRIDGES) {
    const dx = x - b.x;
    const dz = z - b.z;
    const cos = Math.cos(-b.angle);
    const sin = Math.sin(-b.angle);
    const u = dx * cos - dz * sin;
    const v = dx * sin + dz * cos;
    if (Math.abs(u) <= b.length / 2 + 1.2 && Math.abs(v) <= b.width / 2) {
      return b;
    }
  }
  return null;
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
  const bridge = onBridge(x, z);
  if (bridge) return bridge.y;

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
  const rd = riverDist(x, z);
  if (rd.seg && rd.dist < rd.seg.width * 1.3) {
    const rLimit = rd.seg.width * 1.3;
    const blend = smoothstep(Math.max(0, Math.min(1, (rLimit - rd.dist) / (rd.seg.width * 0.5))));
    h += (rd.seg.level - 0.42 - h) * blend;
  }
  return h;
}

export function inWater(x: number, z: number) {
  if (onBridge(x, z)) return false;
  for (const w of WATER) if (Math.hypot((x - w.x) / w.rx, (z - w.z) / w.rz) < 0.9) return true;
  const rd = riverDist(x, z);
  if (rd.seg && rd.dist < rd.seg.width * 0.52) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Obstacles + spatial grid
// ---------------------------------------------------------------------------
