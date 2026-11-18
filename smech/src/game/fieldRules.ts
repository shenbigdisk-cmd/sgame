/** Shared between the cockpit, field brief and simulation. */
export const SALVAGE = {
  min: 25,
  max: 60,
  aegisSeconds: 6,
  overchargeSeconds: 25,
  firepower: 1.35,
  smokeDamage: 0.7,
} as const;
export function cacheValue(roll: number) {
  return (
    SALVAGE.min + Math.min(SALVAGE.max - SALVAGE.min, Math.floor(roll * (SALVAGE.max - SALVAGE.min + 1)))
  );
}

type Point = { x: number; y: number; z: number };
/** Swept segment against the visible, flattened smoke ellipsoid; fast rounds cannot skip it. */
export function crossesVeil(a: Point, b: Point, cloud: { pos: Point; radius: number; life: number }) {
  if (cloud.life <= 0) return false;
  const x = a.x - cloud.pos.x,
    y = (a.y - cloud.pos.y - 3) / 0.55,
    z = a.z - cloud.pos.z;
  const dx = b.x - a.x,
    dy = (b.y - a.y) / 0.55,
    dz = b.z - a.z;
  const len = dx * dx + dy * dy + dz * dz;
  const t = len ? Math.max(0, Math.min(1, -(x * dx + y * dy + z * dz) / len)) : 0;
  return (x + t * dx) ** 2 + (y + t * dy) ** 2 + (z + t * dz) ** 2 <= cloud.radius ** 2;
}

/** Even a fully upgraded Veil leaves a gap before the next screen is ready. */
export function veilStats(stacks: number, evolved: boolean, baseCooldown: number) {
  const belt = Math.max(0, Math.min(2, stacks));
  const life = 6 + (evolved ? 2 : 0) + 0.5 * belt;
  return {
    radius: 10 + (evolved ? 4 : 0) + 0.8 * belt,
    life,
    // Faster base recharges and upgrades must not permit a permanent screen.
    cooldown: Math.max(life + 1.6, baseCooldown * (1 - 0.12 * belt)),
  };
}
