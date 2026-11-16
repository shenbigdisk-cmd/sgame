import type { VehicleType, WeaponId } from './types';
import { VEHICLES, type VehicleConfig } from './vehicles';

/**
 * THE FORGE — the mech construction system.
 *
 * A mech is a FRAME plus one component in every other slot. Frames are free
 * (they are the chassis you salvage); every other component is bought with
 * credits earned in the pits. The catalogue is deliberately small so a build
 * always feels deliberate rather than like a spreadsheet.
 */

export type ComponentSlot =
  | 'frame'
  | 'primary'
  | 'secondary'
  | 'specialQ'
  | 'specialE'
  | 'armour'
  | 'reactor'
  | 'drive';

export const COMPONENT_SLOTS: ComponentSlot[] = [
  'frame',
  'primary',
  'secondary',
  'specialQ',
  'specialE',
  'armour',
  'reactor',
  'drive',
];

export const SLOT_LABELS: Record<ComponentSlot, string> = {
  frame: 'FRAME',
  primary: 'PRIMARY',
  secondary: 'SECONDARY',
  specialQ: 'SPECIAL · Q',
  specialE: 'SPECIAL · E',
  armour: 'ARMOUR',
  reactor: 'REACTOR',
  drive: 'DRIVE',
};

/** The key each slot answers to in the cockpit. */
export const SLOT_KEYS: Record<ComponentSlot, string> = {
  frame: '—',
  primary: 'LMB',
  secondary: 'RMB',
  specialQ: 'Q',
  specialE: 'E',
  armour: '—',
  reactor: '—',
  drive: '—',
};

/** Stat deltas a component adds to the frame baseline. */
export interface ComponentMods {
  maxHp?: number;
  shield?: number;
  maxSpeed?: number;
  accel?: number;
  turnRate?: number;
}

/** Weapon tuning a mounted weapon contributes. */
export type WeaponTuning = Partial<
  Pick<
    VehicleConfig,
    'cannonDamage' | 'cannonReload' | 'shellSpeed' | 'splash' | 'mgDamage' | 'mgInterval' | 'mgHeatPerShot'
  >
>;

export interface ComponentDef {
  id: string;
  slot: ComponentSlot;
  name: string;
  desc: string;
  /** credits needed to buy it */
  cost: number;
  icon: string;
  /** the weapon this component mounts, if any */
  weapon?: WeaponId;
  /** frame this component is based on */
  frame?: VehicleType;
  mods?: ComponentMods;
  weaponStats?: WeaponTuning;
  /** enemy difficulty weight carried by a frame */
  stepWeight?: number;
}

/* ------------------------------------------------------------------ *
 * Frames — free, always available
 * ------------------------------------------------------------------ */

const FRAMES: ComponentDef[] = (['warden', 'pyre', 'glacier'] as VehicleType[]).map((id) => {
  const v = VEHICLES[id];
  return {
    id: `f_${id}`,
    slot: 'frame',
    name: `${v.shortName} FRAME`,
    desc: `${v.role}. ${v.description}`,
    cost: 0,
    icon: 'armor',
    frame: id,
    stepWeight: { warden: 1, pyre: 1.5, glacier: 0.75 }[id],
  };
});

/* ------------------------------------------------------------------ *
 * Weapons
 * ------------------------------------------------------------------ */

const WEAPON_COMPONENTS: ComponentDef[] = [
  // ---- primary ----
  {
    id: 'p_autocannon',
    slot: 'primary',
    name: 'ROTARY AUTOCANNONS',
    desc: 'Twin rapid-fire guns. Reliable at mid range.',
    cost: 0,
    icon: 'autocannon',
    weapon: 'autocannon',
    weaponStats: { mgDamage: 5, mgInterval: 0.09, mgHeatPerShot: 0.024 },
  },
  {
    id: 'p_autocannon_mk2',
    slot: 'primary',
    name: 'AUTOCANNONS MK II',
    desc: 'Rebored barrels. Harder hits, slower cadence, meaner heat.',
    cost: 520,
    icon: 'autocannon',
    weapon: 'autocannon',
    weaponStats: { mgDamage: 6.6, mgInterval: 0.1, mgHeatPerShot: 0.031 },
  },
  {
    id: 'p_scatter',
    slot: 'primary',
    name: 'SCRAP SCATTERGUN',
    desc: 'Six barrels of close-range persuasion.',
    cost: 460,
    icon: 'scatter',
    weapon: 'scatter',
    weaponStats: { cannonDamage: 11, cannonReload: 1.05, shellSpeed: 175, splash: 1.4, mgDamage: 5, mgInterval: 0.09, mgHeatPerShot: 0.03 },
  },
  {
    id: 'p_scatter_sawed',
    slot: 'primary',
    name: 'SAWN-OFF SCATTERGUN',
    desc: 'Chopped short for the pit. Tighter spread, brutal up close.',
    cost: 640,
    icon: 'scatter',
    weapon: 'scatter',
    weaponStats: { cannonDamage: 13, cannonReload: 1.15, shellSpeed: 165, splash: 1.6, mgDamage: 5, mgInterval: 0.09, mgHeatPerShot: 0.03 },
  },
  {
    id: 'p_coil',
    slot: 'primary',
    name: 'COIL REPEATER',
    desc: 'Hypervelocity needles. Precise and punishing.',
    cost: 720,
    icon: 'coil',
    weapon: 'coil',
    weaponStats: { mgDamage: 4.5, mgInterval: 0.105, mgHeatPerShot: 0.024 },
  },

  // ---- secondary ----
  {
    id: 's_cannon',
    slot: 'secondary',
    name: 'TWIN 60MM CANNONS',
    desc: 'Honest high-explosive shells.',
    cost: 0,
    icon: 'cannon',
    weapon: 'cannon',
    weaponStats: { cannonDamage: 40, cannonReload: 1.35, shellSpeed: 150, splash: 4.5 },
  },
  {
    id: 's_cannon_90',
    slot: 'secondary',
    name: 'TWIN 90MM CANNONS',
    desc: 'Salvage from a siege walker. Slower, louder, far heavier.',
    cost: 560,
    icon: 'cannon',
    weapon: 'cannon',
    weaponStats: { cannonDamage: 52, cannonReload: 1.5, shellSpeed: 145, splash: 5.4 },
  },
  {
    id: 's_cryoball',
    slot: 'secondary',
    name: 'CRYO GRENADE',
    desc: 'Lobbed ice charge that freezes everything in the blast.',
    cost: 380,
    icon: 'cryoball',
    weapon: 'cryoball',
    weaponStats: { cannonDamage: 30, cannonReload: 0.8, shellSpeed: 160, splash: 4 },
  },
  {
    id: 's_flame',
    slot: 'secondary',
    name: "DRAGON'S BREATH",
    desc: 'A cone of liquid fire. Sets mechs ablaze.',
    cost: 620,
    icon: 'flame',
    weapon: 'flame',
    weaponStats: { cannonDamage: 12, cannonReload: 1, splash: 1.4 },
  },
  {
    id: 's_cryo',
    slot: 'secondary',
    name: 'CRYO LANCE',
    desc: 'A freezing lance that locks a target in frost.',
    cost: 780,
    icon: 'cryo',
    weapon: 'cryo',
    weaponStats: { cannonDamage: 30, cannonReload: 0.8, splash: 4 },
  },

  // ---- specials (usable in either special slot) ----
  { id: 'x_missiles', slot: 'specialQ', name: 'HOMING MISSILES', desc: 'A salvo of guided rockets.', cost: 300, icon: 'missile', weapon: 'missiles' },
  { id: 'x_turret', slot: 'specialQ', name: 'SENTRY TURRET', desc: 'An automated gun turret. Holds a flank for 24s.', cost: 340, icon: 'turret', weapon: 'turret' },
  { id: 'x_jump', slot: 'specialQ', name: 'SKYFALL SLAM', desc: 'Rocket-jump forward and crash down with a fiery shockwave.', cost: 420, icon: 'jump', weapon: 'jump' },
  { id: 'x_mines', slot: 'specialQ', name: 'CINDER MINES', desc: 'Deploy proximity mines that detonate into fire.', cost: 380, icon: 'mines', weapon: 'mines' },
  { id: 'x_smoke', slot: 'specialQ', name: 'VEIL SMOKE', desc: 'Pop a dense smoke screen to break line of sight and escape.', cost: 260, icon: 'smoke', weapon: 'smoke' },
  { id: 'x_rail', slot: 'specialQ', name: 'LONGBOW RAILGUN', desc: 'An instant lightning beam. Lethal precision.', cost: 640, icon: 'target', weapon: 'rail' },
  { id: 'x_mortar', slot: 'specialQ', name: 'INCENDIARY MORTARS', desc: 'Marks an area for burning mortar shells.', cost: 560, icon: 'mortar', weapon: 'mortar' },
  { id: 'x_overdrive', slot: 'specialQ', name: 'OVERDRIVE VENT', desc: 'Vent the reactor: speed, reload and a burn nova.', cost: 600, icon: 'overdrive', weapon: 'overdrive' },
  { id: 'x_nova', slot: 'specialQ', name: 'STASIS NOVA', desc: 'A freezing pulse that locks enemies in place.', cost: 580, icon: 'nova', weapon: 'nova' },
];

/* ------------------------------------------------------------------ *
 * Hull systems
 * ------------------------------------------------------------------ */

const SYSTEMS: ComponentDef[] = [
  // ---- armour ----
  { id: 'h_service', slot: 'armour', name: 'SERVICE PLATING', desc: 'Standard hull plating. Nothing more.', cost: 0, icon: 'armor', mods: {} },
  { id: 'h_lattice', slot: 'armour', name: 'LATTICE ARMOUR', desc: 'Welded lattice. +40 hull, a little slower.', cost: 520, icon: 'armor', mods: { maxHp: 40, maxSpeed: -0.6 } },
  { id: 'h_ablation', slot: 'armour', name: 'ABLATIVE CARAPACE', desc: 'Sacrificial layers. +85 hull, noticeably sluggish.', cost: 880, icon: 'armor', mods: { maxHp: 85, maxSpeed: -1.3 } },

  // ---- reactor ----
  { id: 'c_standard', slot: 'reactor', name: 'STANDARD CORE', desc: 'The frame reactor as it left the yard.', cost: 0, icon: 'battery', mods: {} },
  { id: 'c_fused', slot: 'reactor', name: 'FUSED CAPACITOR', desc: 'A salvaged fusion cell. +35 shield.', cost: 460, icon: 'battery', mods: { shield: 35 } },
  { id: 'c_titan', slot: 'reactor', name: 'TITAN REACTOR', desc: 'A foundry-grade core. +70 shield and a touch more speed.', cost: 840, icon: 'battery', mods: { shield: 70, maxSpeed: 0.8 } },

  // ---- drive ----
  { id: 'd_standard', slot: 'drive', name: 'STANDARD STRUTS', desc: 'Factory legs. Honest and unremarkable.', cost: 0, icon: 'gear', mods: {} },
  { id: 'd_sprint', slot: 'drive', name: 'SPRINT SERVOS', desc: 'Light servos. +12% top speed, quicker to answer.', cost: 420, icon: 'gear', mods: { maxSpeed: 2.3, accel: 3 } },
  { id: 'd_atlas', slot: 'drive', name: 'ATLAS LEGS', desc: 'Heavy stabilisers. +8% speed, +30 hull, sharper turns.', cost: 800, icon: 'gear', mods: { maxSpeed: 1.5, accel: 4, turnRate: 0.2, maxHp: 30 } },
];

export const COMPONENTS: ComponentDef[] = [...FRAMES, ...WEAPON_COMPONENTS, ...SYSTEMS];

const BY_ID = new Map(COMPONENTS.map((c) => [c.id, c]));

export function getComponent(id: string): ComponentDef | undefined {
  return BY_ID.get(id);
}

/** Every component that can be mounted in a given slot. */
export function componentsForSlot(slot: ComponentSlot): ComponentDef[] {
  if (slot === 'specialQ' || slot === 'specialE') {
    // The same catalogue fills both special slots.
    return COMPONENTS.filter((c) => c.id.startsWith('x_'));
  }
  return COMPONENTS.filter((c) => c.slot === slot);
}

/** Components the player owns from the very first run. */
export const STARTER_COMPONENTS: string[] = [
  'f_warden',
  'f_pyre',
  'f_glacier',
  'p_autocannon',
  's_cannon',
  'x_missiles',
  'x_turret',
  'h_service',
  'c_standard',
  'd_standard',
];

/** The slot each starter component is equipped in. */
export const STARTER_EQUIPPED: Record<ComponentSlot, string> = {
  frame: 'f_warden',
  primary: 'p_autocannon',
  secondary: 's_cannon',
  specialQ: 'x_missiles',
  specialE: 'x_turret',
  armour: 'h_service',
  reactor: 'c_standard',
  drive: 'd_standard',
};

/** Weapons the simulation knows how to fire in each cockpit slot. */
export const SLOT_WEAPONS: Record<'primary' | 'secondary' | 'special', WeaponId[]> = {
  primary: ['autocannon', 'scatter', 'coil'],
  secondary: ['cannon', 'cryoball', 'flame', 'cryo'],
  special: ['missiles', 'turret', 'jump', 'mines', 'smoke', 'rail', 'mortar', 'overdrive', 'nova'],
};

/**
 * Turn an equipped set into the configuration the simulation runs on.
 *
 * The frame provides the baseline; every other component adds its deltas and
 * contributes its weapon tuning. A slot left empty falls back to the frame's
 * own default weapon, so a half-built mech is still playable. The same weapon
 * is never mounted twice: the second slot to ask for it takes the next free
 * weapon instead.
 */
export function buildConfig(equipped: Partial<Record<ComponentSlot, string>>): VehicleConfig {
  const frameId = equipped.frame ?? STARTER_EQUIPPED.frame;
  const frame = getComponent(frameId);
  const vehicle: VehicleType = frame?.frame ?? 'warden';
  const base = VEHICLES[vehicle];
  const cfg: VehicleConfig = { ...base, loadout: { ...base.loadout } };

  const mods: Required<Pick<ComponentMods, 'maxHp' | 'shield' | 'maxSpeed' | 'accel' | 'turnRate'>> = {
    maxHp: 0,
    shield: 0,
    maxSpeed: 0,
    accel: 0,
    turnRate: 0,
  };
  const tuning: WeaponTuning = {};

  for (const slot of COMPONENT_SLOTS) {
    const id = equipped[slot];
    const comp = id ? getComponent(id) : undefined;
    if (!comp) continue;
    if (comp.mods) {
      mods.maxHp += comp.mods.maxHp ?? 0;
      mods.shield += comp.mods.shield ?? 0;
      mods.maxSpeed += comp.mods.maxSpeed ?? 0;
      mods.accel += comp.mods.accel ?? 0;
      mods.turnRate += comp.mods.turnRate ?? 0;
    }
    if (comp.weaponStats) Object.assign(tuning, comp.weaponStats);
  }

  const used = new Set<WeaponId>();
  const resolve = (slot: ComponentSlot, fallback: WeaponId, allowed: WeaponId[]): WeaponId => {
    const id = equipped[slot];
    const comp = id ? getComponent(id) : undefined;
    const wanted = comp?.weapon ?? fallback;
    if (!used.has(wanted)) {
      used.add(wanted);
      return wanted;
    }
    const free = allowed.find((w) => !used.has(w));
    if (free) {
      used.add(free);
      return free;
    }
    used.add(wanted);
    return wanted;
  };

  cfg.loadout.primary = resolve('primary', base.loadout.primary, SLOT_WEAPONS.primary);
  cfg.loadout.secondary = resolve('secondary', base.loadout.secondary, SLOT_WEAPONS.secondary);
  cfg.loadout.abilityQ = resolve('specialQ', base.loadout.abilityQ, SLOT_WEAPONS.special);
  cfg.loadout.abilityE = resolve('specialE', base.loadout.abilityE, SLOT_WEAPONS.special);

  cfg.maxHp = Math.max(40, base.maxHp + mods.maxHp);
  cfg.shield = Math.max(0, base.shield + mods.shield);
  cfg.maxSpeed = Math.max(8, base.maxSpeed + mods.maxSpeed);
  cfg.accel = Math.max(4, base.accel + mods.accel);
  cfg.turnRate = Math.max(0.5, base.turnRate + mods.turnRate);
  Object.assign(cfg, tuning);

  return cfg;
}

/** The frame the current build is based on. */
export function frameOf(equipped: Partial<Record<ComponentSlot, string>>): VehicleType {
  const frame = getComponent(equipped.frame ?? STARTER_EQUIPPED.frame);
  return frame?.frame ?? 'warden';
}

/** Enemy difficulty weight carried by the equipped frame. */
export function stepWeightOf(equipped: Partial<Record<ComponentSlot, string>>): number {
  const frame = getComponent(equipped.frame ?? STARTER_EQUIPPED.frame);
  return frame?.stepWeight ?? 1;
}
