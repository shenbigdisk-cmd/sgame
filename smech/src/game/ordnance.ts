import type { VehicleLoadout } from './vehicles';
import type { WeaponId } from './types';

/** Capacity belongs to the socket, not to the weapon fitted in it. */
export const RACK_CAPACITIES = { Q: 5, E: 3 } as const;
export type RackKey = keyof typeof RACK_CAPACITIES;

/** One cartridge per trigger pull, regardless of salvo size or deployable count. */
export class Ordnance {
  readonly count: Record<RackKey, number> = { Q: 0, E: 0 };
  constructor(private loadout: VehicleLoadout) {
    this.refill();
  }
  key(id: WeaponId): RackKey | undefined {
    return this.loadout.abilityQ === id ? 'Q' : this.loadout.abilityE === id ? 'E' : undefined;
  }
  get missing() {
    return !!(
      (this.loadout.abilityQ && this.count.Q < RACK_CAPACITIES.Q) ||
      (this.loadout.abilityE && this.count.E < RACK_CAPACITIES.E)
    );
  }
  get dry() {
    return !!((this.loadout.abilityQ && !this.count.Q) || (this.loadout.abilityE && !this.count.E));
  }
  /** A field crate adds one charge to each mounted rack. */
  rearm() {
    if (this.loadout.abilityQ) this.count.Q = Math.min(RACK_CAPACITIES.Q, this.count.Q + 1);
    if (this.loadout.abilityE) this.count.E = Math.min(RACK_CAPACITIES.E, this.count.E + 1);
  }
  /** The pit crew completely reloads mounted racks at the start of each stage. */
  refill() {
    this.count.Q = this.loadout.abilityQ ? RACK_CAPACITIES.Q : 0;
    this.count.E = this.loadout.abilityE ? RACK_CAPACITIES.E : 0;
  }
}
