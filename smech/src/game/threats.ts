import type { EnemyKind } from './types';

/** Visible in the hangar before committing to a loadout. */
export const DOSSIERS: Record<
  EnemyKind,
  { name: string; role: string; icon: string; strength: string; counter: string }
> = {
  skimmer: {name:'Wisp',role:'Low-altitude scout',icon:'radar',strength:'Fast, low-flying drones sweep over berms and shallow water.',counter:'Only 22 base hull. Track them with automatic fire; bullets deal 50% extra damage. Tall structures still block their approach.'},
  jackal: {
    name: 'Jackal', role: 'Salvage runner', icon: 'coin',
    strength: 'Sprints to a landed credit cache, then retreats with its cargo.',
    counter: 'Freeze its light legs or intercept the gold backpack. Destroy a loaded Jackal to recover its stolen cache.',
  },
  bastion: {
    name: 'Bastion',
    role: 'Plated assault tank',
    icon: 'shield',
    strength: 'Ablative plating halves incoming bullet damage.',
    counter: 'Shells and rockets deal 50% extra damage. Switch sockets before it closes.',
  },
  mender: {
    name: 'Mender',
    role: 'Field support walker',
    icon: 'regen',
    strength: 'Pulses a repair beam to a damaged ally within 42 m.',
    counter: 'It cannot repair itself. Break its sightline to the squad or target it first.',
  },
  tank: {
    name: 'T-90 Raider',
    role: 'Line tank',
    icon: 'armor',
    strength: 'Mid-range cannon with explosive splash.',
    counter: 'Cross its aim between shots. Its hull is slow to turn.',
  },
  mech: {
    name: 'Hound Walker',
    role: 'Fast skirmisher',
    icon: 'target',
    strength: 'Closes quickly and fires six-round bursts.',
    counter: 'Fight down a long lane. Its light frame has just 48 base hull.',
  },
  sniper: {
    name: 'Longbow',
    role: 'Precision hunter',
    icon: 'radar',
    strength: 'A high-velocity shot can reach you from 240 m.',
    counter: 'Duck behind terrain while its targeting laser charges to cancel the shot.',
  },
  heavy: {
    name: 'Goliath',
    role: 'Siege walker',
    icon: 'missile',
    strength: 'Heavy hull and paired homing rockets.',
    counter: 'Use terrain to intercept rockets. Its slow stride makes it a good mortar target.',
  },
  sapper: {
    name: 'Ember Sapper',
    role: 'Demolition drone',
    icon: 'blast',
    strength: 'Sprints at your hull and detonates on contact. Shooting it open still cooks off its core at half force.',
    counter: 'It cannot shoot back — only close distance. Destroy it at range, freeze its tracks, or drag it into its own friends.',
  },
};
export function impactMultiplier(kind: EnemyKind, shot: 'bullet' | 'rocket' | 'shell') {
  if (kind === 'skimmer' && shot === 'bullet') return 1.5;
  return kind === 'bastion' ? (shot === 'bullet' ? 0.5 : 1.5) : 1;
}
