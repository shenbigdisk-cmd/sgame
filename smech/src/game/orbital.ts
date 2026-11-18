/** Skyfall's targeting envelope and impact pattern, in metres and seconds. */
export const ORBITAL = {
  radius: 24,
  range: 180,
  warning: 1.7,
  bolts: 7,
  interval: 0.19,
  coreDamage: 85,
  followupDamage: 24,
} as const;

/** Each uplink rank widens the footprint; the evolution widens it further. */
export function orbitalRadius(ranks: number, evolved: boolean) {
  return ORBITAL.radius * (1 + 0.1 * Math.max(0, Math.min(2, ranks))) * (evolved ? 1.25 : 1);
}

/** Central blast followed by six evenly spaced strikes inside its perimeter. */
export function orbitalOffset(index: number, radius: number) {
  if (index === 0) return { x: 0, z: 0 };
  const angle = ((index - 1) / (ORBITAL.bolts - 1)) * Math.PI * 2;
  return { x: Math.cos(angle) * radius * 0.6, z: Math.sin(angle) * radius * 0.6 };
}

/** Damage tapers towards the edge, but remains meaningful across the entire marker. */
export function orbitalDamage(distance: number, radius: number, baseDamage: number) {
  if (distance >= radius) return 0;
  return baseDamage * (1 - (0.5 * Math.max(0, distance)) / radius);
}
