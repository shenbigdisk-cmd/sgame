/**
 * Static world colliders.
 *
 * Every building, container and rock in a sector is stored as an obstacle in a
 * uniform grid so that collision and line-of-sight queries stay cheap even
 * with a few hundred props in the arena.
 */

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

/** Drop every registered obstacle — called before a new sector is built. */
export function resetColliderGrid() {
  gridCells = new Map();
  queryStamp = 1;
}
const queryOut: Obstacle[] = [];
const cellKey = (cx: number, cz: number) => (cx + 64) * 256 + (cz + 64);

export function gridInsert(o: Obstacle) {
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
    if (d < 1e-9) { pos.x = o.x + min; pos.z = o.z; return true; }
    const k = (min - d) / d;
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

/** A collapsed structure leaves neither a movement collider nor a radar / LOS footprint. */
export function removeObstacle(o: Obstacle, world: Obstacle[]) {
  const idx = world.indexOf(o);
  if (idx !== -1) world.splice(idx, 1);
  for (const cell of gridCells.values()) {
    const i = cell.indexOf(o);
    if (i !== -1) cell.splice(i, 1);
  }
}

/** Entry fraction for a swept projectile against a rotated box (thin walls included). */
export function boxImpact(o: Obstacle, a: {x:number;y:number;z:number}, b: typeof a) {
  const box = o.box;
  if (!box) return Infinity;
  const dx = a.x-o.x, dz = a.z-o.z, vx = b.x-a.x, vz = b.z-a.z;
  let enter=0, exit=1;
  const slab = (p:number, v:number, lo:number, hi:number) => {
    if (Math.abs(v)<1e-8) return p>=lo && p<=hi;
    const t0=(lo-p)/v,t1=(hi-p)/v;
    enter=Math.max(enter,Math.min(t0,t1)); exit=Math.min(exit,Math.max(t0,t1)); return enter<=exit;
  };
  return slab(dx*box.c-dz*box.s,vx*box.c-vz*box.s,-box.hw,box.hw) && slab(a.y,b.y-a.y,o.y0,o.y0+o.h) && slab(dx*box.s+dz*box.c,vx*box.s+vz*box.c,-box.hd,box.hd) ? enter : Infinity;
}
