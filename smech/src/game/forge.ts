import type { VehicleType, WeaponId } from './types';
import { VEHICLES, WEAPON_INFO, type VehicleConfig, type PowerCosts, type WeaponSocket } from './vehicles';

/**
 * THE FORGE — the mech construction system.
 *
 * A mech is a FRAME plus one component in every other slot. Frames are free
 * (they are the chassis you salvage); every other component is bought with
 * credits earned in the pits.
 *
 * Two systems make a build more than a list of parts:
 *
 * * MASS — every component has a dry weight in tonnes. The heavier the
 *   mech, the slower it drives and the slower it turns. Strip the guns off
 *   and the thing sprints; bolt on a siege cannon and it waddles.
 * * POWER — the reactor stores energy and trickles it back into the grid.
 *   Every weapon draws power when it fires, so a heavy loadout needs a
 *   bigger reactor. Run the grid dry and the guns cut out mid-burst.
 */

/** Energy the mech's own systems draw every second, before any weapon. */
export const HULL_DRAW = 4;
export function reserveRecharge(output:number,sectorMultiplier=1){
  return Math.max(0,output*sectorMultiplier-HULL_DRAW);
}

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

/** The cockpit socket each component slot feeds. */
export type Socket = WeaponSocket;

const SOCKET_OF: Partial<Record<ComponentSlot, Socket>> = {
  primary: 'primary',
  secondary: 'secondary',
  specialQ: 'specialQ',
  specialE: 'specialE',
};

/**
 * The tuning fields each cockpit socket is allowed to write.
 *
 * This is the guard against a primary scattergun overwriting the secondary
 * cannons, or a special component quietly changing a trigger weapon.
 */
const TUNING_KEYS: Record<Socket, readonly (keyof WeaponTuning)[]> = {
  primary: ['mgDamage', 'mgInterval', 'mgHeatPerShot', 'scatterDamage', 'scatterReload', 'scatterSpeed', 'scatterSplash', 'scatterSpread'],
  secondary: ['cannonDamage', 'cannonReload', 'shellSpeed', 'splash', 'flameDamage', 'cryoDamage', 'cryoSlowTime', 'beamInterval', 'cryoGrenadeDamage', 'cryoGrenadeReload', 'empDamage', 'empReload'],
  specialQ: [],
  specialE: [],
};

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
  /** extra top speed in m/s on top of the mass ratio (light servos) */
  maxSpeed?: number;
  accel?: number;
  turnRate?: number;
  /** Additional share of moving projectile spread absorbed by the drive. */
  driveStability?: number;
}

/**
 * Weapon tuning a mounted weapon contributes.
 *
 * The fields are grouped by the socket that reads them, so a scattergun in
 * the primary mount never overwrites the secondary cannons' shell profile.
 */
export interface WeaponTuning {
  /** secondary cannon shell profile */
  cannonDamage?: number;
  cannonReload?: number;
  shellSpeed?: number;
  splash?: number;
  /** primary bullet gun */
  mgDamage?: number;
  mgInterval?: number;
  mgHeatPerShot?: number;
  /** primary scattergun shell profile */
  scatterDamage?: number;
  scatterReload?: number;
  scatterSpeed?: number;
  scatterSplash?: number;
  scatterSpread?: number;
  /** secondary beam weapons: damage and cycle time per tick */
  flameDamage?: number;
  cryoDamage?: number;
  cryoSlowTime?: number;
  beamInterval?: number;
  /** cryo grenade blast and canister cycle */
  cryoGrenadeDamage?: number;
  cryoGrenadeReload?: number;
  /** EMP disruptor direct damage and cycle time */
  empDamage?: number;
  empReload?: number;
}

export interface ComponentDef {
  id: string;
  slot: ComponentSlot;
  name: string;
  desc: string;
  /** credits needed to buy it */
  cost: number;
  icon: string;
  /** dry weight in tonnes */
  weight: number;
  /** energy drawn per activation, in kilojoules */
  power?: number;
  /** seconds between activations; the sustained draw is power / powerInterval */
  powerInterval?: number;
  /** reactor only: stored energy in kilojoules */
  powerCapacity?: number;
  /** reactor only: recharge rate in kilojoules per second */
  powerOutput?: number;
  /** the weapon this component mounts, if any */
  weapon?: WeaponId;
  /** Maximum projectile travel, or beam reach, in metres for trigger weapons. */
  range?: number;
  /** Fraction of movement-induced spread absorbed (projectile weapons only). */
  stability?: number;
  /** the model the factory view builds for this part; defaults to its weapon */
  model?: string;
  /** frame this component is based on */
  frame?: VehicleType;
  mods?: ComponentMods;
  weaponStats?: WeaponTuning;
  /** enemy difficulty weight carried by a frame */
  stepWeight?: number;
}

/* ------------------------------------------------------------------ *
 * Frames — base chassis for mech construction
 * ------------------------------------------------------------------ */

const FRAME_COSTS: Record<VehicleType, number> = {
  warden: 250,
  pyre: 450,
  glacier: 600,
};

const FRAMES: ComponentDef[] = (['warden', 'pyre', 'glacier'] as VehicleType[]).map((id) => {
  const v = VEHICLES[id];
  return {
    id: `f_${id}`,
    slot: 'frame',
    name: `${v.shortName} FRAME`,
    desc: `${v.role}. ${v.description}`,
    cost: FRAME_COSTS[id],
    icon: 'armor',
    weight: v.mass,
    frame: id,
    stepWeight: { warden: 1, pyre: 1.5, glacier: 0.75 }[id],
  };
});

/* ------------------------------------------------------------------ *
 * Weapons — weight in tonnes, power in kilojoules per activation
 * ------------------------------------------------------------------ */

const WEAPON_COMPONENTS: ComponentDef[] = [
  // Trigger weapons expose their real maximum reach and moving stability.
  // Expensive variants buy handling, reach, or a useful effect rather than
  // dramatically more damage. Higher weight, heat, energy and slower cycles
  // give the upgraded parts meaningful tradeoffs.
  {
    id: 'p_autocannon', slot: 'primary', name: 'ROTARY AUTOCANNONS',
    desc: 'Dependable mid-range bursts. Light and economical, but less steady on the move.',
    cost: 200, icon: 'autocannon', weight: 1.6, power: 0.9, powerInterval: 0.09,
    weapon: 'autocannon', range: 125, stability: 0.3,
    weaponStats: { mgDamage: 5, mgInterval: 0.09, mgHeatPerShot: 0.024 },
  },
  {
    id: 'p_autocannon_mk2', slot: 'primary', name: 'AUTOCANNONS MK II',
    desc: 'Longer barrels and stabilised mounts. A little more punch, at greater heat and energy cost.',
    cost: 520, icon: 'autocannon', model: 'mk2', weight: 2.0, power: 1.4, powerInterval: 0.1,
    weapon: 'autocannon', range: 155, stability: 0.55,
    weaponStats: { mgDamage: 5.3, mgInterval: 0.1, mgHeatPerShot: 0.031 },
  },
  {
    id: 'p_scatter', slot: 'primary', name: 'SCRAP SCATTERGUN',
    desc: 'Six pellets with damage falloff. Dangerous close up, but short-ranged.',
    cost: 460, icon: 'scatter', weight: 2.2, power: 6, powerInterval: 1.05,
    weapon: 'scatter', range: 65, stability: 0.25,
    weaponStats: { scatterDamage: 11, scatterReload: 1.05, scatterSpeed: 175, scatterSplash: 1.4, scatterSpread: 0.085 },
  },
  {
    id: 'p_scatter_sawed', slot: 'primary', name: 'SAWN-OFF SCATTERGUN',
    desc: 'Tighter grouping in a lighter package; shorter reach, slower reload and more power per shot.',
    cost: 640, icon: 'scatter', model: 'sawed', weight: 1.9, power: 7.5, powerInterval: 1.15,
    weapon: 'scatter', range: 48, stability: 0.45,
    weaponStats: { scatterDamage: 11.7, scatterReload: 1.15, scatterSpeed: 165, scatterSplash: 1.5, scatterSpread: 0.065 },
  },
  {
    id: 'p_gatling', slot: 'primary', name: 'GATLING ARRAY',
    desc: 'A steady, fast array with slightly stronger rounds; heavy and hungry, with a shorter reach.',
    cost: 880, icon: 'autocannon', model: 'gatling', weight: 3.4, power: 2.2, powerInterval: 0.08,
    weapon: 'autocannon', range: 115, stability: 0.65,
    weaponStats: { mgDamage: 5.5, mgInterval: 0.08, mgHeatPerShot: 0.032 },
  },
  {
    id: 'p_bore', slot: 'primary', name: 'BORE SCATTERGUN',
    desc: 'Longer reach and tighter pellets, with a wider blast. Heavy, slower to reload, and power-hungry.',
    cost: 760, icon: 'scatter', model: 'bore', weight: 3.0, power: 9, powerInterval: 1.4,
    weapon: 'scatter', range: 90, stability: 0.55,
    weaponStats: { scatterDamage: 12.1, scatterReload: 1.4, scatterSpeed: 185, scatterSplash: 2.0, scatterSpread: 0.055 },
  },
  {
    id: 'p_coil', slot: 'primary', name: 'COIL REPEATER',
    desc: 'Long-range needles with a stabilised mount. Less damage per round than the rotary.',
    cost: 720, icon: 'coil', weight: 1.7, power: 1.2, powerInterval: 0.105,
    weapon: 'coil', range: 185, stability: 0.6,
    weaponStats: { mgDamage: 4.5, mgInterval: 0.105, mgHeatPerShot: 0.024 },
  },
  {
    id: 'p_coil_rail', slot: 'primary', name: 'RAIL COIL',
    desc: 'Exceptional reach and stability for sightline duels; very heavy, slower and power-hungry.',
    cost: 1180, icon: 'coil', model: 'railcoil', weight: 3.8, power: 3.4, powerInterval: 0.19,
    weapon: 'coil', range: 225, stability: 0.8,
    weaponStats: { mgDamage: 4.9, mgInterval: 0.19, mgHeatPerShot: 0.04 },
  },

  // ---- secondary ----
  {
    id: 's_cannon', slot: 'secondary', name: 'TWIN 60MM CANNONS',
    desc: 'Straightforward high-explosive shells. Cover and gravity can shorten their reach.',
    cost: 250, icon: 'cannon', weight: 2.8, power: 11, powerInterval: 1.35,
    weapon: 'cannon', range: 170, stability: 0.35,
    weaponStats: { cannonDamage: 40, cannonReload: 1.35, shellSpeed: 150, splash: 4.5 },
  },
  {
    id: 's_cannon_90', slot: 'secondary', name: 'TWIN 90MM CANNONS',
    desc: 'A slightly wider blast and steadier, longer reach. Slower, heavier and less efficient.',
    cost: 560, icon: 'cannon', model: 'cannon90', weight: 4.2, power: 19, powerInterval: 1.5,
    weapon: 'cannon', range: 190, stability: 0.5,
    weaponStats: { cannonDamage: 44, cannonReload: 1.5, shellSpeed: 145, splash: 5.1 },
  },
  {
    id: 's_cannon_atlas', slot: 'secondary', name: 'ATLAS CANNONS',
    desc: 'Long-range stabilised shells with a wider blast. Siege weight, long reload and high draw.',
    cost: 820, icon: 'cannon', model: 'atlas', weight: 5.0, power: 27, powerInterval: 1.7,
    weapon: 'cannon', range: 225, stability: 0.8,
    weaponStats: { cannonDamage: 46, cannonReload: 1.7, shellSpeed: 190, splash: 5.5 },
  },
  {
    id: 's_cryoball', slot: 'secondary', name: 'CRYO GRENADE',
    desc: 'Lobbed ice charge that freezes enemies in the blast. The arc may land before maximum travel.',
    cost: 380, icon: 'cryoball', weight: 2.4, power: 12, powerInterval: WEAPON_INFO.cryoball.cooldown,
    weapon: 'cryoball', range: 55,
    weaponStats: { cryoGrenadeDamage: 26, cryoGrenadeReload: WEAPON_INFO.cryoball.cooldown },
  },
  {
    id: 's_flame', slot: 'secondary', name: "DRAGON'S BREATH",
    desc: 'A short cone of liquid fire that sets mechs ablaze.',
    cost: 620, icon: 'flame', weight: 3.0, power: 2.4, powerInterval: 0.12,
    weapon: 'flame', range: 30,
    weaponStats: { flameDamage: 5.4, beamInterval: 0.12 },
  },
  {
    id: 's_flame_vent', slot: 'secondary', name: 'VENTED FLAME',
    desc: 'A longer burning cone with a little more damage. The pressurised system draws more power.',
    cost: 690, icon: 'flame', model: 'vent', weight: 3.8, power: 4.2, powerInterval: 0.12,
    weapon: 'flame', range: 42,
    weaponStats: { flameDamage: 5.7, beamInterval: 0.12 },
  },
  {
    id: 's_cryo', slot: 'secondary', name: 'CRYO LANCE',
    desc: 'A freezing lance that slows a target. Heat and power limit sustained fire.',
    cost: 780, icon: 'cryo', weight: 2.6, power: 4, powerInterval: 0.12,
    weapon: 'cryo', range: 70,
    weaponStats: { cryoDamage: 3.8, cryoSlowTime: 2.4, beamInterval: 0.12 },
  },
  {
    id: 's_cryo_heavy', slot: 'secondary', name: 'DEEP FREEZE LANCE',
    desc: 'Longer reach and a longer slow. Its heavy cooler consumes more power and cycles slower.',
    cost: 940, icon: 'cryo', model: 'deepfreeze', weight: 3.6, power: 6.4, powerInterval: 0.16,
    weapon: 'cryo', range: 85,
    weaponStats: { cryoDamage: 4.1, cryoSlowTime: 3.4, beamInterval: 0.16 },
  },
  {
    id: 's_emp', slot: 'secondary', name: 'VOLT EMP DISRUPTOR',
    desc: 'Low-damage pulse disables one enemy for 1.5 s (bosses 0.45 s). Each target resists repeat EMP for 4 s.',
    cost: 880, icon: 'bolt', weight: 3.0, power: 22, powerInterval: 3.2,
    weapon: 'emp', range: 110, stability: 0.6,
    weaponStats: { empDamage: 12, empReload: 3.2 },
  },

  // ---- specials (usable in either special slot) ----
  { id: 'x_missiles', slot: 'specialQ', name: 'HOMING MISSILES', desc: 'A salvo of guided rockets.', cost: 300, icon: 'missile', weight: 2.2, power: 16, powerInterval: WEAPON_INFO.missiles.cooldown, weapon: 'missiles' },
  { id: 'x_turret', slot: 'specialQ', name: 'SENTRY TURRET', desc: 'Automated gun tracks enemies within 85 m. Holds a flank for 24 s.', cost: 340, icon: 'turret', weight: 2.0, power: 12, powerInterval: WEAPON_INFO.turret.cooldown, weapon: 'turret' },
  { id: 'x_orbital', slot: 'specialQ', name: 'SKYFALL ORBITAL', desc: 'Mark an area up to 180 m away for a wide barrage from orbit.', cost: 560, icon: 'strike', weight: 2.6, power: 30, powerInterval: WEAPON_INFO.orbital.cooldown, weapon: 'orbital' },
  { id: 'x_jump', slot: 'specialQ', name: 'CINDER CANISTER', desc: 'Lob a fire canister that bursts on impact and burns the ground for 6 seconds.', cost: 420, icon: 'flame', weight: 2.6, power: 30, powerInterval: WEAPON_INFO.cinder.cooldown, weapon: 'cinder' },
  { id: 'x_mines', slot: 'specialQ', name: 'CINDER MINES', desc: 'Deploy proximity mines that detonate into fire.', cost: 380, icon: 'mines', weight: 1.9, power: 8, powerInterval: WEAPON_INFO.mines.cooldown, weapon: 'mines' },
  { id: 'x_smoke', slot: 'specialQ', name: 'VEIL SMOKE', desc: 'Block enemy bullets and break locks. Heavy shots penetrate at 70% damage; move to avoid blind fire.', cost: 260, icon: 'smoke', weight: 1.4, power: 10, powerInterval: WEAPON_INFO.smoke.cooldown, weapon: 'smoke' },
  { id: 'x_rail', slot: 'specialQ', name: 'LONGBOW RAILGUN', desc: 'An instant precision beam reaching up to 260 m in a clear sightline.', cost: 640, icon: 'target', weight: 3.2, power: 55, powerInterval: WEAPON_INFO.rail.cooldown, weapon: 'rail' },
  { id: 'x_mortar', slot: 'specialQ', name: 'INCENDIARY MORTARS', desc: 'Marks an area for burning mortar shells.', cost: 560, icon: 'mortar', weight: 3.4, power: 24, powerInterval: WEAPON_INFO.mortar.cooldown, weapon: 'mortar' },
  { id: 'x_overdrive', slot: 'specialQ', name: 'OVERDRIVE VENT', desc: 'Vent the reactor: speed, reload and a burn nova.', cost: 600, icon: 'overdrive', weight: 2.4, power: 45, powerInterval: WEAPON_INFO.overdrive.cooldown, weapon: 'overdrive' },
  { id: 'x_swarm', slot: 'specialQ', name: 'SWARM POD', desc: 'A wider salvo of cheaper rockets.', cost: 520, icon: 'missile', model: 'swarm', weight: 2.6, power: 20, powerInterval: WEAPON_INFO.missiles.cooldown, weapon: 'missiles' },
  { id: 'x_nova', slot: 'specialQ', name: 'STASIS NOVA', desc: 'A 26 m freezing pulse that locks enemies in place.', cost: 580, icon: 'nova', weight: 2.8, power: 50, powerInterval: WEAPON_INFO.nova.cooldown, weapon: 'nova' },
];

/* ------------------------------------------------------------------ *
 * Hull systems
 * ------------------------------------------------------------------ */

const SYSTEMS: ComponentDef[] = [
  // ---- armour ----
  { id: 'h_service', slot: 'armour', name: 'SERVICE PLATING', desc: 'Standard hull plating. Nothing more.', cost: 150, icon: 'armor', model: 'h_service', weight: 1.2, mods: {} },
  { id: 'h_lattice', slot: 'armour', name: 'LATTICE ARMOUR', desc: 'Welded lattice. +40 hull for 1.4 t.', cost: 520, icon: 'armor', model: 'h_lattice', weight: 2.6, mods: { maxHp: 40 } },
  { id: 'h_ablation', slot: 'armour', name: 'ABLATIVE CARAPACE', desc: 'Sacrificial layers. +85 hull for 3.2 t.', cost: 880, icon: 'armor', model: 'h_ablation', weight: 4.4, mods: { maxHp: 85 } },
  { id: 'h_ballistic', slot: 'armour', name: 'BALLISTIC SHELL', desc: 'Sacrificial ablative block hung outside the frame. Soaks one huge hit.', cost: 640, icon: 'armor', model: 'h_ballistic', weight: 3.0, mods: { maxHp: 55 } },
  { id: 'h_reactive', slot: 'armour', name: 'REACTIVE SKIN', desc: 'A reactive blanket that swells when struck. +90 hull and +30 shield.', cost: 1080, icon: 'armor', model: 'h_reactive', weight: 4.0, mods: { maxHp: 90, shield: 30 } },

  // ---- reactor ----
  { id: 'c_standard', slot: 'reactor', name: 'STANDARD CORE', desc: 'The frame reactor as it left the yard.', cost: 200, icon: 'battery', model: 'c_standard', weight: 3.0, powerCapacity: 90, powerOutput: 26, mods: {} },
  { id: 'c_fused', slot: 'reactor', name: 'FUSED CAPACITOR', desc: 'A salvaged fusion cell. +35 shield, a deeper buffer.', cost: 460, icon: 'battery', model: 'c_fused', weight: 3.8, powerCapacity: 140, powerOutput: 38, mods: { shield: 35 } },
  { id: 'c_titan', slot: 'reactor', name: 'TITAN REACTOR', desc: 'Foundry-grade core. +70 shield and a grid that can feed anything.', cost: 840, icon: 'battery', model: 'c_titan', weight: 5.4, powerCapacity: 210, powerOutput: 58, mods: { shield: 70 } },
  { id: 'c_solar', slot: 'reactor', name: 'SOLAR WEAVE', desc: 'A skin of photocells. No burst power, but it never stops trickling.', cost: 380, icon: 'battery', model: 'c_solar', weight: 1.8, powerCapacity: 170, powerOutput: 44, mods: {} },
  { id: 'c_volatile', slot: 'reactor', name: 'VOLATILE CELL', desc: 'A cracked fusion cell that dumps its whole buffer in one glorious second.', cost: 720, icon: 'battery', model: 'c_volatile', weight: 2.6, powerCapacity: 300, powerOutput: 62, mods: { shield: 45 } },

  // ---- drive ----
  { id: 'd_standard', slot: 'drive', name: 'STANDARD STRUTS', desc: 'Factory legs. Honest and unremarkable.', cost: 180, icon: 'gear', model: 'd_standard', weight: 2.4, mods: {} },
  { id: 'd_sprint', slot: 'drive', name: 'SPRINT SERVOS', desc: 'Light servos. Half a tonne lighter and far quicker to answer.', cost: 420, icon: 'gear', model: 'd_sprint', weight: 1.6, mods: { maxSpeed: 2.4, accel: 3 } },
  { id: 'd_atlas', slot: 'drive', name: 'ATLAS LEGS', desc: 'Heavy stabilisers absorb 22% more movement spread; +30 hull but extra mass.', cost: 800, icon: 'gear', model: 'd_atlas', weight: 3.8, mods: { maxSpeed: 1.2, accel: 4, turnRate: 0.2, maxHp: 30, driveStability: 0.22 } },
  { id: 'd_skimmer', slot: 'drive', name: 'SKIMMER LEGS', desc: 'Ground-effect skids. Fast in a straight line, vague in a turn.', cost: 560, icon: 'gear', model: 'd_skimmer', weight: 2.0, mods: { maxSpeed: 3.6, accel: 5, turnRate: -0.15 } },
  { id: 'd_anvil', slot: 'drive', name: 'ANVIL DRIVE', desc: 'Siege anchors absorb 30% more movement spread, with +55 hull and +25 shield. Heavy and slow.', cost: 960, icon: 'gear', model: 'd_anvil', weight: 4.6, mods: { maxSpeed: -1.6, accel: 2, turnRate: 0.25, maxHp: 55, shield: 25, driveStability: 0.3 } },
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
  secondary: ['cannon', 'cryoball', 'flame', 'cryo', 'emp'],
  special: ['missiles', 'turret', 'orbital', 'cinder', 'mines', 'smoke', 'rail', 'mortar', 'overdrive', 'nova'],
};

/* ------------------------------------------------------------------ *
 * Factory presets — the three chassis the yard builds on the line
 * ------------------------------------------------------------------ */

export interface Preset {
  id: string;
  name: string;
  frame: VehicleType;
  blurb: string;
  equipped: Record<ComponentSlot, string>;
}

export const PRESETS: Preset[] = [
  {
    id: 'warden',
    name: 'WARDEN-9',
    frame: 'warden',
    blurb: 'Twin autocannons, honest cannons and a loyal sentry. The all-rounder.',
    equipped: {
      frame: 'f_warden',
      primary: 'p_autocannon',
      secondary: 's_cannon',
      specialQ: 'x_missiles',
      specialE: 'x_turret',
      armour: 'h_service',
      reactor: 'c_standard',
      drive: 'd_standard',
    },
  },
  {
    id: 'pyre',
    name: 'PYRE-12',
    frame: 'pyre',
    blurb: 'Scattergun, dragon breath and an orbital barrage. Built to break a crowd.',
    equipped: {
      frame: 'f_pyre',
      primary: 'p_scatter',
      secondary: 's_flame',
      specialQ: 'x_mines',
      specialE: 'x_orbital',
      armour: 'h_service',
      reactor: 'c_fused',
      drive: 'd_standard',
    },
  },
  {
    id: 'glacier',
    name: 'GLACIER-7',
    frame: 'glacier',
    blurb: 'Coil repeater, cryo grenade and a railgun. Light, quick and cold.',
    equipped: {
      frame: 'f_glacier',
      primary: 'p_coil',
      secondary: 's_cryoball',
      specialQ: 'x_rail',
      specialE: 'x_smoke',
      armour: 'h_service',
      reactor: 'c_titan',
      drive: 'd_standard',
    },
  },
];

/* ------------------------------------------------------------------ *
 * Build maths
 * ------------------------------------------------------------------ */

/** Mass of the starter loadout, used as the reference for the mass ratio. */
export const REFERENCE_LOADOUT_MASS = COMPONENT_SLOTS.filter((s) => s !== 'frame').reduce(
  (sum, slot) => sum + (getComponent(STARTER_EQUIPPED[slot])?.weight ?? 0),
  0,
);

/** The full readout the Forge shows and the simulation runs on. */
export interface BuildStats {
  /** total dry mass in tonnes */
  mass: number;
  /** mass ratio against the reference loadout: above 1 is lighter than stock */
  massFactor: number;
  maxHp: number;
  shield: number;
  maxSpeed: number;
  accel: number;
  turnRate: number;
  /** Extra share of movement-induced spread absorbed by the drive. */
  driveStability: number;
  /** stored energy in kilojoules */
  powerCapacity: number;
  /** recharge rate in kilojoules per second */
  powerOutput: number;
  /** sustained draw of the mounted loadout in kilojoules per second */
  powerDraw: number;
  /** kJ per activation, per socket */
  powerCost: PowerCosts;
}

type EquippedEntry = [ComponentSlot, ComponentDef];

/**
 * Resolve each mounted component together with the slot it is mounted in.
 *
 * The slot, not `comp.slot`, is authoritative: every special component is
 * catalogued under `specialQ`, but the same catalogue fills `specialE`.
 */
function equippedEntries(equipped: Partial<Record<ComponentSlot, string>>): EquippedEntry[] {
  const out: EquippedEntry[] = [];
  for (const slot of COMPONENT_SLOTS) {
    const id = equipped[slot];
    const comp = id ? getComponent(id) : undefined;
    if (comp) out.push([slot, comp]);
  }
  return out;
}

function equippedComponents(equipped: Partial<Record<ComponentSlot, string>>): ComponentDef[] {
  return equippedEntries(equipped).map(([, comp]) => comp);
}

type NumericTuning = Record<keyof WeaponTuning, number | undefined>;

/** Collect tuning only from the fields the mounted socket is allowed to own. */
function collectTuning(equipped: Partial<Record<ComponentSlot, string>>): WeaponTuning {
  const tuning: WeaponTuning = {};
  const target = tuning as NumericTuning;
  for (const [slot, comp] of equippedEntries(equipped)) {
    const socket = SOCKET_OF[slot];
    if (!socket || !comp.weaponStats) continue;
    const source = comp.weaponStats as NumericTuning;
    for (const key of TUNING_KEYS[socket]) {
      if (source[key] !== undefined) target[key] = source[key];
    }
  }
  return tuning;
}

/** Total dry mass of a build, in tonnes. */
export function buildMass(equipped: Partial<Record<ComponentSlot, string>>): number {
  return equippedComponents(equipped).reduce((sum, c) => sum + c.weight, 0);
}

/**
 * The speed ratio of a build.
 *
 * A stock loadout sits at 1. Strip the mass off and the mech runs faster;
 * pile it on and it drags. Clamped so no build is ever undriveable.
 */
export function massFactor(equipped: Partial<Record<ComponentSlot, string>>): number {
  const frame = getComponent(equipped.frame ?? STARTER_EQUIPPED.frame);
  const reference = (frame?.weight ?? 9.4) + REFERENCE_LOADOUT_MASS;
  const total = buildMass(equipped);
  if (total <= 0) return 1;
  return Math.max(0.62, Math.min(1.35, reference / total));
}

/** Every number the Forge shows about a build. */
export function buildStats(equipped: Partial<Record<ComponentSlot, string>>): BuildStats {
  const frameId = equipped.frame ?? STARTER_EQUIPPED.frame;
  const frame = getComponent(frameId);
  const vehicle: VehicleType = frame?.frame ?? 'warden';
  const base = VEHICLES[vehicle];

  const entries = equippedEntries(equipped);
  const mods = { maxHp: 0, shield: 0, maxSpeed: 0, accel: 0, turnRate: 0, driveStability: 0 };
  const powerCost: PowerCosts = {
    primary: 0,
    secondary: 0,
    specialQ: 0,
    specialE: 0,
  };
  let powerCapacity = 0;
  let powerOutput = 0;
  let draw = HULL_DRAW;

  for (const [slot, comp] of entries) {
    if (comp.mods) {
      mods.maxHp += comp.mods.maxHp ?? 0;
      mods.shield += comp.mods.shield ?? 0;
      mods.maxSpeed += comp.mods.maxSpeed ?? 0;
      mods.accel += comp.mods.accel ?? 0;
      mods.turnRate += comp.mods.turnRate ?? 0;
      mods.driveStability += comp.mods.driveStability ?? 0;
    }
    if (comp.weapon && comp.power) {
      const socket = SOCKET_OF[slot];
      if (socket) {
        powerCost[socket] = comp.power;
        if (comp.powerInterval) draw += comp.power / comp.powerInterval;
      }
    }
    if (comp.powerCapacity) powerCapacity = comp.powerCapacity;
    if (comp.powerOutput) powerOutput = comp.powerOutput;
  }

  const factor = massFactor(equipped);
  return {
    mass: buildMass(equipped),
    massFactor: factor,
    maxHp: Math.max(40, base.maxHp + mods.maxHp),
    shield: Math.max(0, base.shield + mods.shield),
    maxSpeed: Math.max(6, base.maxSpeed * factor + mods.maxSpeed),
    accel: Math.max(4, base.accel * (0.72 + 0.28 * factor) + mods.accel),
    turnRate: Math.max(0.5, base.turnRate * (0.76 + 0.24 * factor) + mods.turnRate),
    driveStability: Math.min(0.95, Math.max(0, mods.driveStability)),
    powerCapacity,
    powerOutput,
    powerDraw: draw,
    powerCost,
  };
}

/**
 * Turn an equipped set into the configuration the simulation runs on.
 *
 * The frame provides the baseline; every other component adds its deltas and
 * contributes only the weapon tuning its cockpit socket owns. A slot left
 * empty stays empty — a stripped mech is legal, lighter and quieter. The same
 * weapon is never mounted twice: the second slot to ask for it takes the next
 * free weapon instead.
 */
export function buildConfig(equipped: Partial<Record<ComponentSlot, string>>): VehicleConfig {
  const frameId = equipped.frame ?? STARTER_EQUIPPED.frame;
  const frame = getComponent(frameId);
  const vehicle: VehicleType = frame?.frame ?? 'warden';
  const base = VEHICLES[vehicle];
  const cfg: VehicleConfig = { ...base, loadout: { ...base.loadout } };

  const stats = buildStats(equipped);
  const tuning = collectTuning(equipped);

  const used = new Set<WeaponId>();
  const resolve = (slot: ComponentSlot, allowed: WeaponId[]): WeaponId | null => {
    const id = equipped[slot];
    // An empty socket stays empty: stripping the guns is a legal build.
    if (!id) return null;
    const comp = getComponent(id);
    const wanted = comp?.weapon;
    if (!wanted) return null;
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

  cfg.loadout.primary = resolve('primary', SLOT_WEAPONS.primary);
  cfg.loadout.secondary = resolve('secondary', SLOT_WEAPONS.secondary);
  cfg.loadout.abilityQ = resolve('specialQ', SLOT_WEAPONS.special);
  cfg.loadout.abilityE = resolve('specialE', SLOT_WEAPONS.special);

  cfg.maxHp = stats.maxHp;
  cfg.shield = stats.shield;
  cfg.maxSpeed = stats.maxSpeed;
  cfg.accel = stats.accel;
  cfg.turnRate = stats.turnRate;
  cfg.mass = stats.mass;
  cfg.powerCapacity = stats.powerCapacity;
  cfg.powerOutput = stats.powerOutput;
  cfg.powerDraw = stats.powerDraw;
  cfg.powerCost = { ...stats.powerCost };
  cfg.driveStability = stats.driveStability;
  const primary = getComponent(equipped.primary ?? '');
  const secondary = getComponent(equipped.secondary ?? '');
  cfg.primaryRange = cfg.loadout.primary ? primary?.range ?? 0 : 0;
  cfg.secondaryRange = cfg.loadout.secondary ? secondary?.range ?? 0 : 0;
  cfg.primaryStability = cfg.loadout.primary ? primary?.stability ?? 0 : 0;
  cfg.secondaryStability = cfg.loadout.secondary ? secondary?.stability ?? 0 : 0;
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
