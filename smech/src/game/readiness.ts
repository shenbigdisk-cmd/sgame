/**
 * Weapon readiness — how far along a trigger is towards being usable.
 *
 * The cockpit draws a bar for every slot and the crosshair ring for the
 * primary, so every readout must agree. These pure helpers are the single
 * source of truth; the engine and the HUD both derive their numbers from them.
 */

/** Clamp a value into the 0..1 range. */
const unit = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export interface TriggerReadiness {
  /** True for weapons that build heat instead of reloading (autocannon, coil, flame, cryo). */
  isHeat: boolean;
  /** Current heat, 0..1. */
  heat: number;
  /** True while the weapon is locked out by an overheat. */
  overheat: boolean;
  /** Seconds left on the reload, for weapons that reload instead of heating. */
  reloadRemaining: number;
  /** Full reload time in seconds. */
  reloadTime: number;
}

/**
 * Readiness of a trigger weapon.
 *
 * Heat weapons report their free heat (1 = completely cool), everything else
 * reports how much of its reload is left. An overheated weapon is never ready.
 */
export function triggerReadiness(t: TriggerReadiness): number {
  if (t.overheat) return 0;
  if (t.isHeat) return unit(1 - t.heat);
  if (t.reloadTime <= 0) return 1;
  return unit(1 - t.reloadRemaining / t.reloadTime);
}

/**
 * Readiness of a cooldown weapon (cryo grenade, special weapons).
 *
 * `cooldownTime` must be the value the cooldown was primed with, not a
 * freshly computed one: upgrades picked mid-cooldown would otherwise make the
 * bar jump backwards.
 */
export function cooldownReadiness(remaining: number, cooldownTime: number): number {
  if (cooldownTime <= 0) return 1;
  return unit(1 - remaining / cooldownTime);
}

/** How the secondary trigger behaves, which decides how its readiness is read. */
export type SecondaryKind = 'cannon' | 'cryoball' | 'beam';

export interface SecondaryReadiness {
  kind: SecondaryKind;
  /** Seconds left on the cannon reload. */
  reloadRemaining: number;
  /** Full cannon reload time in seconds. */
  reloadTime: number;
  /** Seconds left on the grenade cooldown. */
  cooldownRemaining: number;
  /** The grenade cooldown it was primed with. */
  cooldownTime: number;
  /** Current beam heat, 0..1. */
  heat: number;
  /** True while the beam is locked out by an overheat. */
  overheat: boolean;
}

/**
 * Readiness of the secondary trigger.
 *
 * The three secondaries cool down in completely different ways: the 60mm
 * cannons reload, the cryo grenade runs a timed canister and the beam
 * flamethrower / cryo lance builds heat.
 */
export function secondaryReadiness(s: SecondaryReadiness): number {
  if (s.kind === 'cannon') {
    if (s.reloadTime <= 0) return 1;
    return unit(1 - s.reloadRemaining / s.reloadTime);
  }
  if (s.kind === 'cryoball') return cooldownReadiness(s.cooldownRemaining, s.cooldownTime);
  if (s.overheat) return 0;
  return unit(1 - s.heat);
}

/**
 * Aim assist strength, clamped so stacking targeting computers can never bend
 * shots past the cone the cockpit advertises.
 */
export function aimAssist(multiplier: number, max = 1.6): number {
  if (Number.isNaN(multiplier)) return 0;
  if (multiplier <= 0) return 0;
  if (!Number.isFinite(multiplier)) return max;
  return multiplier > max ? max : multiplier;
}
