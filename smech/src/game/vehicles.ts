import type { VehicleType, WeaponId } from './types';

/** The four cockpit sockets a weapon can be fired from. */
export type WeaponSocket = 'primary' | 'secondary' | 'specialQ' | 'specialE';

/** Kilojoules consumed by one activation of each socket. */
export type PowerCosts = Record<WeaponSocket, number>;

/** The four cockpit weapon sockets; a stripped socket is null. */
export type VehicleLoadout = Record<'primary' | 'secondary' | 'abilityQ' | 'abilityE', WeaponId | null>;

export interface VehicleConfig {
  name: string;
  shortName: string;
  role: string;
  epithet: string;
  description: string;
  backstory: string;
  style: string;
  accent: string;
  armorColor: number;
  loadout: VehicleLoadout;
  maxHp: number;
  shield: number;
  maxSpeed: number;
  accel: number;
  turnRate: number;
  /** dry mass of the chassis in tonnes */
  mass: number;
  /** stored energy in kilojoules */
  powerCapacity: number;
  /** recharge rate in kilojoules per second */
  powerOutput: number;
  /** sustained draw of the factory loadout in kilojoules per second */
  powerDraw: number;
  /**
   * Kilojoules drawn per activation, per socket.
   *
   * Each socket has its own cost, so mounting two guns that happen to fire
   * the same round still costs what each gun actually burns.
   */
  powerCost: PowerCosts;
  camHeight: number;
  radius: number;
  /** secondary cannon: shell damage, cycle time, muzzle speed, blast radius */
  cannonDamage: number;
  cannonReload: number;
  shellSpeed: number;
  splash: number;
  /** primary bullet gun: hit points, cycle time, heat per shot */
  mgDamage: number;
  mgInterval: number;
  mgHeatPerShot: number;
  /** primary scattergun: its own shell profile, separate from the cannons */
  scatterDamage: number;
  scatterReload: number;
  scatterSpeed: number;
  scatterSplash: number;
  /** secondary beam weapons: damage and cycle time per tick */
  flameDamage: number;
  cryoDamage: number;
  beamInterval: number;
  /** cryo grenade: blast damage and canister cycle */
  cryoGrenadeDamage: number;
  cryoGrenadeReload: number;
}

/** Resolve a weapon id to the socket that actually fires it. */
export function socketForWeapon(weapon: WeaponId, loadout: VehicleLoadout): WeaponSocket | null {
  if (weapon === loadout.primary) return 'primary';
  if (weapon === loadout.secondary) return 'secondary';
  if (weapon === loadout.abilityQ) return 'specialQ';
  if (weapon === loadout.abilityE) return 'specialE';
  return null;
}

export const VEHICLE_ORDER: VehicleType[] = ['warden', 'pyre', 'glacier'];

export const VEHICLES: Record<VehicleType, VehicleConfig> = {
  warden: {
    name: 'WARDEN-9 "OATHKEEPER"',
    shortName: 'WARDEN',
    role: 'BALANCED VETERAN',
    epithet: 'THE OATHKEEPER',
    description: 'Twin autocannons, honest cannons, and a loyal sentry. The honest all-rounder.',
    backstory:
      'Sergeant Ilsa Renn forfeited a palace-guard commission to buy her family out of debt — the price was ten bouts in the pits. Forty bouts later she has never left the sand. The crowd respects her because she never fights dirty: rotary guns, straight cannons, and a sentry turret she maintains herself between rounds.',
    style: 'Hold the middle ground. Shred at mid range, plant the sentry to cover a flank, and finish with missiles.',
    accent: '#8fdbe1',
    armorColor: 0x526271,
    loadout: { primary: 'autocannon', secondary: 'cannon', abilityQ: 'missiles', abilityE: 'turret' },
    maxHp: 150,
    shield: 80,
    maxSpeed: 19,
    accel: 16,
    turnRate: 1.8,
    mass: 9.4,
    powerCapacity: 90,
    powerOutput: 26,
    powerDraw: 24.7,
    powerCost: { primary: 0.9, secondary: 11, specialQ: 16, specialE: 12 },
    camHeight: 4,
    radius: 2.4,
    cannonDamage: 40,
    cannonReload: 1.35,
    shellSpeed: 150,
    splash: 4.5,
    mgDamage: 5,
    mgInterval: 0.09,
    mgHeatPerShot: 0.024,
    scatterDamage: 11,
    scatterReload: 1.05,
    scatterSpeed: 175,
    scatterSplash: 1.4,
    flameDamage: 5.4,
    cryoDamage: 3.8,
    beamInterval: 0.12,
    cryoGrenadeDamage: 26,
    cryoGrenadeReload: 2.8,
  },
  pyre: {
    name: 'PYRE-12 "CROWD-EATER"',
    shortName: 'PYRE',
    role: 'FIRE BRAWLER',
    epithet: 'THE CROWD-EATER',
    description: 'A close-quarters brawler: scattergun, flamethrower, a rocket-powered jump slam, and proximity mines.',
    backstory:
      'Nobody knows his real name — the foundry worker who walked into the pits with a welding rig and walked out a legend. PYRE fights for spectacle, not score: the louder the crowd, the hotter he burns. He closes the distance with a jet-assisted leap, seeds the sand with mines, and refuses to let anyone walk away clean.',
    style: 'Close the gap. Scorch them at point blank, leap onto clustered enemies, and mine your escape route.',
    accent: '#e8915a',
    armorColor: 0x7a4a33,
    loadout: { primary: 'scatter', secondary: 'flame', abilityQ: 'jump', abilityE: 'mines' },
    maxHp: 185,
    shield: 70,
    maxSpeed: 16.5,
    accel: 14,
    turnRate: 1.6,
    mass: 10.8,
    powerCapacity: 140,
    powerOutput: 38,
    powerDraw: 33.6,
    powerCost: { primary: 6, secondary: 2.4, specialQ: 30, specialE: 8 },
    camHeight: 4.4,
    radius: 2.6,
    cannonDamage: 40,
    cannonReload: 1.35,
    shellSpeed: 150,
    splash: 4.5,
    mgDamage: 5,
    mgInterval: 0.09,
    mgHeatPerShot: 0.03,
    scatterDamage: 11,
    scatterReload: 1.05,
    scatterSpeed: 175,
    scatterSplash: 1.4,
    flameDamage: 5.4,
    cryoDamage: 3.8,
    beamInterval: 0.12,
    cryoGrenadeDamage: 26,
    cryoGrenadeReload: 2.8,
  },
  glacier: {
    name: 'GLACIER-7 "THE EXILE"',
    shortName: 'GLACIER',
    role: 'CRYO DUELIST',
    epithet: 'THE EXILE',
    description: 'A sniper duelist: precision coil repeater, cryo grenade launcher, a lightning railgun, and escape smoke.',
    backstory:
      'Lady Vey of House Meridian was exiled after a duel that ended one second too late. She brought her house dueling rig to the pits and never looked back. GLACIER does not brawl. She picks a lane, freezes the first thing that rushes her with a cryo grenade, and vanishes in smoke. The crowd is quiet when she fights. That is how you know she is winning.',
    style: 'Hold long sightlines. Lob cryo grenades at anyone closing in, railgun priority targets, and smoke out when they get too close.',
    accent: '#a8d8f0',
    armorColor: 0x4a5e6e,
    loadout: { primary: 'coil', secondary: 'cryoball', abilityQ: 'rail', abilityE: 'smoke' },
    maxHp: 120,
    shield: 95,
    maxSpeed: 21,
    accel: 18,
    turnRate: 2.0,
    mass: 8.6,
    powerCapacity: 210,
    powerOutput: 58,
    powerDraw: 56.4,
    powerCost: { primary: 1.2, secondary: 4, specialQ: 55, specialE: 10 },
    camHeight: 4.2,
    radius: 2.3,
    cannonDamage: 40,
    cannonReload: 1.35,
    shellSpeed: 150,
    splash: 4.5,
    mgDamage: 4.5,
    mgInterval: 0.105,
    mgHeatPerShot: 0.024,
    scatterDamage: 11,
    scatterReload: 1.05,
    scatterSpeed: 175,
    scatterSplash: 1.4,
    flameDamage: 5.4,
    cryoDamage: 3.8,
    beamInterval: 0.12,
    cryoGrenadeDamage: 26,
    cryoGrenadeReload: 2.8,
  },
};

export const WEAPON_INFO: Record<
  WeaponId,
  { name: string; short: string; description: string; cooldown: number; icon: string; key: string }
> = {
  autocannon: { name: 'ROTARY AUTOCANNONS', short: 'AUTOCANNONS', description: 'Twin rapid-fire guns. Reliable at mid range.', cooldown: 0, icon: 'autocannon', key: 'LMB' },
  cannon: { name: 'TWIN 60MM CANNONS', short: '60MM CANNONS', description: 'Honest high-explosive shells.', cooldown: 0.9, icon: 'cannon', key: 'RMB' },
  scatter: { name: 'SCRAP SCATTERGUN', short: 'SCATTERGUN', description: 'Six barrels of close-range persuasion.', cooldown: 1.05, icon: 'scatter', key: 'LMB' },
  coil: { name: 'COIL REPEATER', short: 'COIL REPEATER', description: 'Hypervelocity needles. Precise and punishing.', cooldown: 0, icon: 'coil', key: 'LMB' },
  flame: { name: "DRAGON'S BREATH", short: 'FLAMETHROWER', description: 'A cone of liquid fire. Sets mechs ablaze.', cooldown: 0, icon: 'flame', key: 'RMB' },
  cryo: { name: 'CRYO LANCE', short: 'CRYO LANCE', description: 'A freezing lance that locks a target in frost.', cooldown: 3.5, icon: 'cryo', key: 'RMB' },
  cryoball: { name: 'CRYO GRENADE', short: 'CRYO GRENADE', description: 'Lobbed ice charge that freezes everything in the blast.', cooldown: 2.8, icon: 'cryoball', key: 'RMB' },
  jump: { name: 'SKYFALL SLAM', short: 'JUMP SLAM', description: 'Rocket-jump forward and crash down with a fiery shockwave.', cooldown: 10, icon: 'jump', key: 'Q' },
  mines: { name: 'CINDER MINES', short: 'MINES', description: 'Deploy proximity mines that detonate into fire.', cooldown: 9, icon: 'mines', key: 'E' },
  smoke: { name: 'VEIL SMOKE', short: 'SMOKE', description: 'Pop a dense smoke screen to break line of sight and escape.', cooldown: 14, icon: 'smoke', key: 'E' },
  missiles: { name: 'HOMING MISSILES', short: 'MISSILE POD', description: 'A salvo of guided rockets.', cooldown: 8, icon: 'missile', key: 'Q' },
  turret: { name: 'SENTRY TURRET', short: 'SENTRY', description: 'An automated gun turret. Holds a flank for 24s.', cooldown: 22, icon: 'turret', key: 'E' },
  mortar: { name: 'INCENDIARY MORTARS', short: 'MORTARS', description: 'Marks an area for burning mortar shells.', cooldown: 20, icon: 'mortar', key: 'Q' },
  overdrive: { name: 'OVERDRIVE VENT', short: 'OVERDRIVE', description: 'Vent the reactor: speed, reload and a burn nova.', cooldown: 22, icon: 'overdrive', key: 'E' },
  rail: { name: 'LONGBOW RAILGUN', short: 'RAILGUN', description: 'An instant lightning beam. Lethal precision.', cooldown: 8, icon: 'target', key: 'Q' },
  nova: { name: 'STASIS NOVA', short: 'STASIS NOVA', description: 'A freezing pulse that locks enemies in place.', cooldown: 15, icon: 'nova', key: 'E' },
};

/** Total number of distinct weapons in the arsenal. */
export const WEAPON_COUNT = Object.keys(WEAPON_INFO).length;
