import { nearObstacles, obsDist, obsResolve } from './colliders';

type Point = { x: number; z: number };
const EPS = 1e-6;
function clear(p: Point, radius: number, limit: number) {
  if (Math.hypot(p.x, p.z) > limit + EPS) return false;
  return !nearObstacles(p.x, p.z, radius).some((o) => obsDist(o, p.x, p.z) < radius - EPS);
}

/** Move in hull-sized substeps. Accept a contact correction only if it clears
 * *all* footprints and the perimeter together; never commit a wedged pose. */
export function moveHull(p: Point, dx: number, dz: number, radius: number, limit: number, safe: Point) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (radius * 0.45)));
  let contact = false;
  for (let i = 0; i < steps; i++) {
    const x = p.x,
      z = p.z;
    p.x += dx / steps;
    p.z += dz / steps;
    for (let pass = 0; pass < 6; pass++) {
      let hit = false;
      for (const o of nearObstacles(p.x, p.z, radius)) if (obsResolve(o, p, radius)) hit = true;
      const d = Math.hypot(p.x, p.z);
      if (d > limit) {
        p.x *= limit / d;
        p.z *= limit / d;
        hit = true;
      }
      if (!hit) break;
      contact = true;
      if (clear(p, radius, limit)) break;
    }
    if (!clear(p, radius, limit)) {
      // Full diagonal was blocked. Try its components so reversing or steering
      // along the boundary still works, even in a tight two-surface corner.
      p.x = x + dx / steps;
      p.z = z;
      if (!clear(p, radius, limit)) {
        p.x = x;
        p.z = z + dz / steps;
      }
      if (!clear(p, radius, limit)) {
        p.x = x;
        p.z = z;
      }
      if (!clear(p, radius, limit)) {
        p.x = safe.x;
        p.z = safe.z;
      }
      contact = true;
    }
    safe.x = p.x;
    safe.z = p.z;
  }
  return contact;
}
