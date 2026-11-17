/**
 * Seeded pseudo random number generator.
 *
 * The whole world — layout, terrain, props and textures — is generated from a
 * single stream so that a sector seed always rebuilds the same arena.
 */

let rngState = 1;

/** Restart the stream from a numeric seed. */
export function seedRng(seed: number) {
  rngState = seed >>> 0 || 1;
}

/** Next float in [0, 1). */
export function rnd() {
  rngState = (rngState + 0x6d2b79f5) >>> 0;
  let t = rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Next float in [a, b). */
export const rand = (a: number, b: number) => a + rnd() * (b - a);

/** Pick one element of an array. */
export const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];

/** True with the given probability. */
export const chance = (p: number) => rnd() < p;

/** Fisher–Yates shuffle (returns a new array). */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Stable 32 bit hash of a sector code. */
export function seedFromString(code: string) {
  let h = 2166136261;
  for (let i = 0; i < code.length; i++) {
    h ^= code.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A fresh, human friendly sector code such as `K7P-2M`. */
export function randomSeedCode() {
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return `${s.slice(0, 3)}-${s.slice(3)}`;
}

/**
 * The sector code for a given stage of a run.
 *
 * Every stage clears into a brand new arena, so the sector code changes with
 * it. It is derived from the run seed so a replay of the same seed walks the
 * same chain of arenas.
 */
export function stageSeedCode(base: string, stage: number): string {
  let h = seedFromString(`${base}#${stage}`);
  let s = '';
  for (let i = 0; i < 6; i++) {
    s += CODE_CHARS[h % CODE_CHARS.length];
    h = Math.floor(h / CODE_CHARS.length) + 0x9e3779b9;
  }
  return `${s.slice(0, 3)}-${s.slice(3)}`;
}
