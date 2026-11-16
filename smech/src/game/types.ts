export type VehicleType = 'warden' | 'pyre' | 'glacier';
export type EnemyKind = 'tank' | 'mech' | 'heavy' | 'sniper';
/** 'arcade' = hull auto-follows the aim, WASD moves relative to where you look. */
export type ControlMode = 'arcade' | 'realistic';

export type WeaponId =
  | 'autocannon'
  | 'cannon'
  | 'scatter'
  | 'coil'
  | 'flame'
  | 'cryo'
  | 'cryoball'
  | 'jump'
  | 'mines'
  | 'smoke'
  | 'missiles'
  | 'turret'
  | 'mortar'
  | 'overdrive'
  | 'rail'
  | 'nova';
export type Rarity = 'common' | 'rare' | 'epic';

export type UpgradeTag = 'HULL' | 'WEAPON' | 'SYSTEM' | 'SIGNATURE';

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  rarity: Rarity;
  icon: string;
  tag: UpgradeTag;
  /** signature upgrades add a new mechanic instead of a stat bonus */
  signature?: boolean;
  evolution?: boolean;
  evolves?: WeaponId;
  /** maximum number of times this can be taken (undefined = unlimited) */
  max?: number;
}

export type DropKind = 'repair' | 'shield' | 'overcharge' | 'rapid' | 'emp' | 'score';

export interface HudBuff {
  id: string;
  name: string;
  icon: string;
  time: number;
  max: number;
}

export interface HudDrop {
  kind: DropKind;
  label: string;
  /** seconds until the pod lands (0 = on the ground) */
  inbound: number;
  dist: number;
}

export interface HudWeapon {
  id: WeaponId;
  name: string;
  /** Compact weapon name for the cockpit slots. */
  short: string;
  key: string;
  owned: boolean;
  /** 0..1 cooldown progress (1 = ready) */
  ready: number;
  /** active duration remaining 0..1 (shield) */
  active: number;
  detail: string;
}

export interface RadarBlip {
  x: number; // right component (relative to turret facing)
  y: number; // forward component
  kind: EnemyKind | 'pickup' | 'obstacle' | 'boss' | 'drop';
  size?: number;
  /** box footprint corners in radar space (x,y pairs) */
  poly?: number[];
  tall?: boolean;
  /** enemy has spotted the player */
  alert?: boolean;
}

export interface HudTarget {
  name: string;
  hp: number; // 0..1
  dist: number;
  status?: 'FROZEN' | 'BRITTLE' | 'CHILLED' | 'BURNING';
}

export interface FeedEntry {
  text: string;
  age: number;
}

export interface DamageDir {
  angle: number; // relative to view, positive = left
  age: number;
}

export interface HudState {
  hp: number;
  maxHp: number;
  shield: number;
  shieldMax: number;
  shieldActive: boolean;
  shieldStatus: 'online' | 'recharging' | 'restarting';
  shieldDelay: number;
  cannonReady: number; // 0..1 (primary readiness, drives the crosshair ring)
  mgHeat: number; // 0..1
  mgOverheat: boolean;
  priName: string;
  priReady: number; // 0..1
  priIsHeat: boolean;
  priHeat: number; // 0..1
  priOverheat: boolean;
  secName: string;
  secReady: number; // 0..1
  secIsHeat: boolean;
  secHeat: number; // 0..1
  secOverheat: boolean;
  score: number;
  kills: number;
  wave: number;
  enemiesLeft: number;
  turretYaw: number;
  hullYaw: number;
  pitch: number;
  speed: number;
  maxSpeed: number;
  blips: RadarBlip[];
  message: string;
  messageAge: number;
  feed: FeedEntry[];
  hitMarkerAge: number;
  critAge: number;
  damageFlash: number;
  damageDirs: DamageDir[];
  waveCountdown: number;
  alive: boolean;
  time: number;
  zoom: boolean;
  target?: HudTarget;
  vehicleName: string;
  controls: ControlMode;
  /** true while the hull is auto-aligning to the aim direction (arcade mode) */
  autoAlign: boolean;
  /** lateral movement, -1 (left) .. 1 (right) */
  lean: number;
  weapons: HudWeapon[];
  /** pending upgrade choice (null when nothing to pick) */
  offer: UpgradeDef[] | null;
  perks: { name: string; icon: string; count: number }[];
  boss?: { name: string; hp: number };
  /** strike marker is placed and shells are inbound */
  strikeInbound: number;
  /** sniper is locking on to the player (0..1 charge) */
  lockWarning: number;
  streak: number;
  streakAge: number;
  /** number of enemies currently hunting you / with eyes on you */
  detected: number;
  seenBy: number;
  ambushAge: number;
  inWater: boolean;
  buffs: HudBuff[];
  drops: HudDrop[];
  /** next supply drop, if one is on its way down */
  dropInbound?: { label: string; seconds: number };
  /** shots fired since the last overcharged round (signature upgrade) */
  overchargeCount: number;
  /** procedural sector info */
  district: string;
  seed: string;
  themeName: string;
  zone: number;
  maxZone: number;
  arenaRadius: number;
  /** waves left before the perimeter expands (0 = fully expanded) */
  expandIn: number;
  /** modifier of the current wave, e.g. SWARM */
  waveTag: string;
  musicOn: boolean;
  expandAge: number;
}

export interface GameStats {
  score: number;
  wave: number;
  kills: number;
  timeSurvived: number;
  vehicle: VehicleType;
  perks: string[];
  seed: string;
  zone: number;
}
