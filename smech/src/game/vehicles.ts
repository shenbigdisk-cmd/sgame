import type { VehicleType, WeaponId } from './types';

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
  loadout: { primary: WeaponId; secondary: WeaponId; abilityQ: WeaponId; abilityE: WeaponId };
  maxHp: number;
  shield: number;
  maxSpeed: number;
  accel: number;
  turnRate: number;
  camHeight: number;
  radius: number;
  cannonDamage: number;
  cannonReload: number;
  shellSpeed: number;
  splash: number;
  mgDamage: number;
  mgInterval: number;
  mgHeatPerShot: number;
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
    camHeight: 4,
    radius: 2.4,
    cannonDamage: 40,
    cannonReload: 1.35,
    shellSpeed: 150,
    splash: 4.5,
    mgDamage: 5,
    mgInterval: 0.09,
    mgHeatPerShot: 0.024,
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
    camHeight: 4.4,
    radius: 2.6,
    cannonDamage: 11,
    cannonReload: 1.05,
    shellSpeed: 175,
    splash: 1.4,
    mgDamage: 5,
    mgInterval: 0.09,
    mgHeatPerShot: 0.03,
  },
  glacier: {
    name: 'GLACIER-7 "THE EXILE"',
    shortName: 'GLACIER',
    role: 'CRYO DUELIST',
    epithet: 'THE EXILE',
    description: 'A sniper duelist: precision coil repeater, thrown ice grenades, a lightning railgun, and escape smoke.',
    backstory:
      'Lady Vey of House Meridian was exiled after a duel that ended one second too late. She brought her house dueling rig to the pits and never looked back. GLACIER does not brawl. She picks a lane, freezes the first thing that rushes her with an ice grenade, and vanishes in smoke. The crowd is quiet when she fights. That is how you know she is winning.',
    style: 'Hold long sightlines. Ice-grenade anyone closing in, railgun priority targets, and smoke out when they get too close.',
    accent: '#a8d8f0',
    armorColor: 0x4a5e6e,
    loadout: { primary: 'coil', secondary: 'cryoball', abilityQ: 'rail', abilityE: 'smoke' },
    maxHp: 120,
    shield: 95,
    maxSpeed: 21,
    accel: 18,
    turnRate: 2.0,
    camHeight: 4.2,
    radius: 2.3,
    cannonDamage: 30,
    cannonReload: 0.8,
    shellSpeed: 160,
    splash: 4,
    mgDamage: 4.5,
    mgInterval: 0.105,
    mgHeatPerShot: 0.024,
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
  cryo: { name: 'CRYO LANCE', short: 'CRYO LANCE', description: 'A freezing beam that slows what it touches.', cooldown: 0, icon: 'cryo', key: 'RMB' },
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
