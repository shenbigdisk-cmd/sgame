/** Shared trigger-weapon handling, expressed in metres and seconds. */
export const EMP = {
  stun: 1.5,
  bossStun: 0.45,
  resistance: 4,
  chainRange: 16,
  chainStun: 0.75,
  chainBossStun: 0.3,
} as const;

const unit = (value: number) => Math.max(0, Math.min(1, value));

/** Weapon and drive absorb an additive share of the movement-spread penalty. */
export function effectiveStability(weapon: number, drive: number) {
  return Math.min(0.95, unit(weapon) + unit(drive));
}

/**
 * Maximum random directional offset. Stationary accuracy is unchanged;
 * stabilization reduces only the additional dispersion caused by moving.
 */
export function projectileSpread(base: number, speed: number, maxSpeed: number, weapon: number, drive: number) {
  const movement = unit(Math.abs(speed) / Math.max(0.001, maxSpeed));
  return Math.max(0, base) + 0.032 * movement * (1 - effectiveStability(weapon, drive));
}
