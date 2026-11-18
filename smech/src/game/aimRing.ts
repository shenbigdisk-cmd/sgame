import { boxImpact, nearObstacles, type Obstacle } from './colliders';

type Point = { x: number; y: number; z: number };
type AimTarget = { alive: boolean; pos: Point; height: number; radius: number };

/** Intersect the finite-height circular footprint; a shot over low cover is clear. */
function crossesCylinder(o: Obstacle, a: Point, b: Point) {
  const dy = b.y - a.y;
  let lo = 0,
    hi = 1;
  if (Math.abs(dy) < 1e-8) {
    if (a.y < o.y0 || a.y > o.y0 + o.h) return false;
  } else {
    const t0 = (o.y0 - a.y) / dy,
      t1 = (o.y0 + o.h - a.y) / dy;
    lo = Math.max(lo, Math.min(t0, t1));
    hi = Math.min(hi, Math.max(t0, t1));
    if (lo > hi) return false;
  }
  const dx = b.x - a.x,
    dz = b.z - a.z,
    x = a.x - o.x,
    z = a.z - o.z;
  const t = Math.max(lo, Math.min(hi, -(x * dx + z * dz) / (dx * dx + dz * dz || 1)));
  return (x + dx * t) ** 2 + (z + dz * t) ** 2 <= o.r ** 2;
}

// Geometry shared by the HUD and its perspective-space acquisition cone (CSS pixels).
export const SIGHT_SIZE = 112;
export const SIGHT_RADIUS = (SIGHT_SIZE * 11) / 48;
export function sightSlope(fovDegrees: number, viewportHeight: number) {
  return (2 * SIGHT_RADIUS * Math.tan((fovDegrees * Math.PI) / 360)) / Math.max(1, viewportHeight);
}

function visible(origin: Point, end: Point, ground: (x: number, z: number) => number) {
  const dx = end.x - origin.x,
    dy = end.y - origin.y,
    dz = end.z - origin.z;
  const length = Math.hypot(dx, dy, dz);
  for (const o of nearObstacles((origin.x + end.x) / 2, (origin.z + end.z) / 2, Math.hypot(dx, dz) / 2)) {
    if (o.box ? boxImpact(o, origin, end) <= 1 : crossesCylinder(o, origin, end)) return false;
  }
  for (let d = 0; d < length; d += 1.5) {
    const t = d / length;
    if (ground(origin.x + dx * t, origin.z + dz * t) > origin.y + dy * t) return false;
  }
  return ground(end.x, end.z) <= end.y;
}

/** Test the visible ring, not just its one-pixel center. Cast towards the
 * enemy within the cone so nearby cover still masks an off-center hostile. */
export function aimOnHostile(
  origin: Point,
  dir: Point,
  enemies: readonly AimTarget[],
  ground: (x: number, z: number) => number,
  slope = 0,
) {
  for (const e of enemies) {
    if (!e.alive) continue;
    const x = e.pos.x - origin.x,
      y = e.pos.y + e.height * 0.5 - origin.y,
      z = e.pos.z - origin.z;
    const along = x * dir.x + y * dir.y + z * dir.z;
    if (along <= 0 || along - e.radius > 300) continue;
    const sx = x - along * dir.x,
      sy = y - along * dir.y,
      sz = z - along * dir.z;
    const offset = Math.hypot(sx, sy, sz),
      aperture = along * slope;
    if (offset > aperture + e.radius) continue;
    // If centered exactly, use the crosshair ray. Otherwise test the enemy
    // center (or the rim ray if only part of the hostile overlaps the ring).
    const fraction = offset <= e.radius ? 0 : Math.min(1, aperture / offset);
    const vx = along * dir.x + sx * fraction,
      vy = along * dir.y + sy * fraction,
      vz = along * dir.z + sz * fraction;
    const mag = Math.hypot(vx, vy, vz),
      rx = vx / mag,
      ry = vy / mag,
      rz = vz / mag;
    const depth = x * rx + y * ry + z * rz;
    const disc = e.radius ** 2 - (x * x + y * y + z * z - depth * depth);
    if (disc < -1e-7) continue;
    const hit = Math.max(0, depth - Math.sqrt(Math.max(0, disc)));
    if (
      hit <= 300 &&
      visible(origin, { x: origin.x + rx * hit, y: origin.y + ry * hit, z: origin.z + rz * hit }, ground)
    )
      return true;
  }
  return false;
}
