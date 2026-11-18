import { seedFromString } from './rng';

const CONDITIONS = [
  { name: 'Grid surge', detail: '+25% reactor recharge', energy: 1.25, cooling: 1, sight: 1 },
  { name: 'Cold front', detail: '+30% weapon cooling', energy: 1, cooling: 1.3, sight: 1 },
  { name: 'Signal haze', detail: '−20% enemy sight range', energy: 1, cooling: 1, sight: 0.8 },
] as const;

/** An independent roll: previewing the modifier must not advance the map RNG. */
export function conditionFor(code: string) {
  return CONDITIONS[seedFromString(`condition:${code}`) % CONDITIONS.length];
}
