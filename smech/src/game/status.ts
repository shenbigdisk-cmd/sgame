import { SALVAGE } from './fieldRules';
import type { HudBuff } from './types';

/** Timers maintained by the simulation, in seconds. Smoke here is the sprint, not the cloud. */
export interface BuffTimers {
  aegis: number;
  overcharge: number;
  rapid: number;
  haste: number;
  overdrive: number;
  smoke: number;
}

/** Build every active HUD status; cloud time only applies while the pilot remains inside it. */
export function activeStatuses(
  timers: BuffTimers,
  overdriveDuration: number,
  coveringCloud?: { life: number; maxLife: number },
  alive = true,
): HudBuff[] {
  if (!alive) return [];
  const statuses: HudBuff[] = ([
    ['aegis', 'INVULNERABLE', 'shield', SALVAGE.aegisSeconds],
    ['overcharge', 'FIREPOWER +35%', 'bolt', SALVAGE.overchargeSeconds],
    ['rapid', 'RAPID RELOAD', 'clock', 25],
    ['haste', 'KILLSTREAK SURGE', 'gear', 8],
    ['overdrive', 'OVERDRIVE', 'overdrive', overdriveDuration],
    ['smoke', 'VEIL SPRINT', 'smoke', 4.5],
  ] as const)
    .filter(([id]) => timers[id] > 0)
    .map(([id, name, icon, max]) => ({ id, name, icon, time: timers[id], max }));
  if (coveringCloud && coveringCloud.life > 0) {
    statuses.unshift({ id: 'veiled', name: 'VEILED IN SMOKE', icon: 'smoke', time: coveringCloud.life, max: coveringCloud.maxLife });
  }
  return statuses;
}
