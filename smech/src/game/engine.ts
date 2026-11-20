import { aimOnHostile, sightSlope } from './aimRing';
import { DriveRecovery } from './driveRecovery';
import { makeHardpoint, poseHardpoint } from './cockpitArms';
import { moveHull } from './hullMotion';
import { Ordnance, RACK_CAPACITIES } from './ordnance';
import { ORBITAL, orbitalDamage, orbitalOffset, orbitalRadius } from './orbital';
import { reserveRecharge } from './forge';
import { makeSupplyCrate } from './supplyMesh';
import { SUPPLIES } from './supplies';
import { boxImpact } from './colliders';
import { SALVAGE, cacheValue, crossesVeil, veilStats } from './fieldRules';
import { conditionFor } from './sectorRules';
import { activeStatuses } from './status';
import { EMP, projectileSpread } from './weaponHandling';
import { impactMultiplier } from './threats';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import {
  createSaltlineSky,
  enablePCSSShadows,
  fitDirectionalLightShadow,
  AGX_GRADE_SHADER,
  generateEnvironmentMap,
  AmbientDustVolume,
  type SaltlineSkyController,
} from './saltlineVisuals';
import type { AudioManager } from './audio';
import type { ControlMode, DropKind, EnemyKind, GameStats, HudState, HudWeapon, RadarBlip, UpgradeDef, VehicleType, WeaponId } from './types';
import { defaultStats, offerName, rollOffer, weaponUpgradeInfo, type PlayerStats } from './upgrades';
import { VEHICLES, WEAPON_INFO, socketForWeapon, type VehicleConfig } from './vehicles';
import { DEFAULT_SETTINGS, type Settings } from './settings';
import { createBar, createSkimmerMesh, createMechMesh, createSapperMesh, createTankMesh, setShadows, type Palette, type MechMesh, type SapperMesh, type TankMesh } from './enemyMeshes';
import { Floaters } from './floaters';
import { aimAssist, cooldownReadiness, secondaryReadiness, triggerReadiness } from './readiness';
import { ParticleSystem } from './particles';
import { WeaponEffects } from './weaponEffects';
import { MAX_ZONE, START_RADIUS, WORLD_RADIUS, buildMap, districtAt, generateLayout, heightAt, inWater, nearObstacles, obsCorners, obsDist, obsResolve, randomSeedCode, stageSeedCode, zoneRadius, type ExplosiveBarrel, type Layout, type MapResult, type Obstacle } from './world';

// ---------------------------------------------------------------------------
// Constants & math helpers
// ---------------------------------------------------------------------------
const SHELL_GRAVITY = 7;
const TWO_PI = Math.PI * 2;

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const wrapAngle = (a: number) => {
  a = a % TWO_PI;
  if (a > Math.PI) a -= TWO_PI;
  else if (a < -Math.PI) a += TWO_PI;
  return a;
};
const moveAngle = (a: number, b: number, max: number) => {
  const d = wrapAngle(b - a);
  return Math.abs(d) <= max ? b : a + Math.sign(d) * max;
};
const moveToward = (a: number, b: number, max: number) => (Math.abs(b - a) <= max ? b : a + Math.sign(b - a) * max);
const fwd = (yaw: number, out: THREE.Vector3) => out.set(Math.sin(yaw), 0, Math.cos(yaw));
const rightOf = (yaw: number, out: THREE.Vector3) => out.set(-Math.cos(yaw), 0, Math.sin(yaw));

// ---------------------------------------------------------------------------
// Configs
// ---------------------------------------------------------------------------
interface EnemyConfig {
  name: string;
  hp: number;
  speed: number;
  turnRate: number;
  aimRate: number;
  radius: number;
  height: number;
  preferredRange: number;
  fireRange: number;
  cooldown: number;
  burstCount: number;
  burstInterval: number;
  score: number;
}

const ENEMIES: Record<EnemyKind, EnemyConfig> = {
  skimmer: { name: 'Wisp', hp: 22, speed: 24, turnRate: 3.8, aimRate: 2.9, radius: 2.1, height: 1.8, preferredRange: 36, fireRange: 105, cooldown: 2.8, burstCount: 2, burstInterval: 0.13, score: 110 },
  jackal: { name: 'Jackal', hp: 38, speed: 16.5, turnRate: 2.8, aimRate: 2.1, radius: 2.4, height: 5, preferredRange: 55, fireRange: 100, cooldown: 3.6, burstCount: 3, burstInterval: 0.14, score: 180 },
  bastion: { name: 'Bastion', hp: 115, speed: 6, turnRate: 0.8, aimRate: 1.3, radius: 3.6, height: 3.2, preferredRange: 48, fireRange: 125, cooldown: 4.2, burstCount: 1, burstInterval: 0, score: 220 },
  mender: { name: 'Mender', hp: 42, speed: 11, turnRate: 1.8, aimRate: 1.7, radius: 2.4, height: 5, preferredRange: 78, fireRange: 108, cooldown: 3.8, burstCount: 3, burstInterval: 0.15, score: 240 },
  // no weapon: it ram-detonates. fireRange 0 keeps the trigger logic inert.
  sapper: { name: 'Ember Sapper', hp: 34, speed: 15.5, turnRate: 3.6, aimRate: 0, radius: 1.7, height: 2.1, preferredRange: 0, fireRange: 0, cooldown: 99, burstCount: 0, burstInterval: 0, score: 130 },
  tank: { name: 'T-90 Raider', hp: 75, speed: 8, turnRate: 0.9, aimRate: 1.6, radius: 3.3, height: 3.0, preferredRange: 65, fireRange: 150, cooldown: 3.2, burstCount: 1, burstInterval: 0, score: 100 },
  mech: { name: 'Hound Walker', hp: 48, speed: 13, turnRate: 2.2, aimRate: 2.8, radius: 2.4, height: 5.0, preferredRange: 42, fireRange: 115, cooldown: 2.4, burstCount: 6, burstInterval: 0.11, score: 150 },
  heavy: { name: 'Goliath', hp: 240, speed: 5.5, turnRate: 0.7, aimRate: 1.1, radius: 4.6, height: 8.5, preferredRange: 85, fireRange: 175, cooldown: 4.6, burstCount: 2, burstInterval: 0.35, score: 400 },
  sniper: { name: 'Longbow', hp: 55, speed: 7.5, turnRate: 1.1, aimRate: 1.4, radius: 3.2, height: 3.0, preferredRange: 150, fireRange: 240, cooldown: 5.5, burstCount: 1, burstInterval: 0, score: 250 },
};
const BOSS_NAME = 'WARLORD';
/** Seconds of celebration between clearing a stage and the reward draft. */
const STAGE_CLEAR_DELAY = 2.8;
const DROP_WEIGHTS: [DropKind, number][] = [
  ['repair', 30], ['shield', 17], ['overcharge', 16], ['rapid', 13], ['emp', 9], ['score', 7], ['coins', 22], ['aegis', 9],
];

const PALETTES: Record<EnemyKind | 'wreck', Palette> = {
  tank: { hull: 0x6e3b2c, dark: 0x2a2a2e, glow: 0xff3b1f, glowIntensity: 2.5 },
  mech: { hull: 0x4e5a68, dark: 0x23262b, glow: 0xff2a2a, glowIntensity: 3 },
  heavy: { hull: 0x3c3843, dark: 0x1d1c21, glow: 0xff8a1f, glowIntensity: 3 },
  sniper: { hull: 0x3f5a63, dark: 0x1b2328, glow: 0x3dff7a, glowIntensity: 3 },
  skimmer: { hull: 0x685682, dark: 0x262532, glow: 0xe791ff, glowIntensity: 3 },
  jackal: { hull: 0xbd722d, dark: 0x323534, glow: 0xffde65, glowIntensity: 3 },
  bastion: { hull: 0x967329, dark: 0x363229, glow: 0xffd547, glowIntensity: 2.8 },
  mender: { hull: 0x568879, dark: 0x253934, glow: 0x61ffcf, glowIntensity: 3 },
  sapper: { hull: 0x59351f, dark: 0x241812, glow: 0xffa02e, glowIntensity: 3.4 },
  wreck: { hull: 0x2b2623, dark: 0x1a1816, glow: 0x111111, glowIntensity: 0 },
};
const BOSS_PALETTE: Palette = { hull: 0x5a1f2a, dark: 0x1a1013, glow: 0xff2d55, glowIntensity: 4 };

// ---------------------------------------------------------------------------
// Entity types
// ---------------------------------------------------------------------------

interface Projectile {
  mesh: THREE.Object3D;
  pos: THREE.Vector3;
  prev: THREE.Vector3;
  vel: THREE.Vector3;
  owner: 'player' | 'enemy';
  kind: 'shell' | 'bullet' | 'rocket';
  damage: number;
  splash: number;
  gravity: number;
  life: number;
  homing: number;
  trail: number;
  /** soft aim-assist target (player projectiles in arcade mode) */
  homingTarget: Enemy | null;
  origin: THREE.Vector3;
  whizzed: boolean;
  burnPool: boolean;
  weapon?: WeaponId;
  charged?: boolean;
  veiled?: boolean;
  /** Remaining path length in metres; absent for non-trigger projectiles. */
  rangeLeft?: number;
}

interface Enemy {
  kind: EnemyKind;
  cfg: EnemyConfig;
  group: THREE.Group;
  pos: THREE.Vector3;
  yaw: number;
  aimYaw: number;
  hp: number;
  maxHp: number;
  dmgMul: number;
  state: 'approach' | 'strafe' | 'retreat' | 'hold';
  stateTimer: number;
  strafeDir: number;
  fireCooldown: number;
  burst: number;
  burstTimer: number;
  side: number;
  turret: THREE.Object3D | null;
  torso: THREE.Object3D | null;
  legs: THREE.Object3D[];
  walkPhase: number;
  moving: boolean;
  hitFlash: number;
  flashMats: THREE.MeshStandardMaterial[];
  bar: THREE.Group;
  barFg: THREE.Mesh;
  radius: number;
  height: number;
  alive: boolean;
  boss: boolean;
  elite: boolean;
  /** sniper lock-on charge (seconds remaining before the shot) */
  cargo: number;
  repairTimer: number;
  lockTimer: number;
  laser: THREE.Line | null;
  slowTime: number;
  burnTime: number;
  burnDps: number;
  cryoCharge: number;
  freezeLock: number;
  brittleTime: number;
  stunTime: number;
  /** EMP-specific resistance prevents the disruptor from permanently stun-locking a target. */
  empResistance: number;
  /** stealth: has this unit spotted the player? */
  aware: boolean;
  /** sapper has announced its run with a warning ping */
  warned: boolean;
  canSee: boolean;
  blindFire: boolean;
  losTimer: number;
  lostTimer: number;
  /** last known / suspected player position */
  searchPos: THREE.Vector3;
  intelTimer: number;
  stuckT: number;
  lastX: number;
  lastZ: number;
  detourT: number;
  detourYaw: number;
}

interface Turret {
  group: THREE.Group;
  barrel: THREE.Object3D;
  pos: THREE.Vector3;
  cooldown: number;
  life: number;
}

interface Mine {
  group: THREE.Group;
  pos: THREE.Vector3;
  arm: number;
  life: number;
  core: THREE.Mesh;
}

interface SmokeCloud {
  pos: THREE.Vector3;
  radius: number;
  life: number;
  maxLife: number;
  emit: number;
  mesh?: THREE.Mesh;
}

interface Burn {
  pos: THREE.Vector3;
  radius: number;
  life: number;
  tick: number;
}

interface Wreck {
  group: THREE.Group;
  pos: THREE.Vector3;
  life: number;
  smokeTimer: number;
}

interface Crater {
  mesh: THREE.Mesh;
  life: number;
}

type Strike = {
  marker: THREE.Group;
  pos: THREE.Vector3;
  timer: number;
  shells: number;
  shellTimer: number;
} & ({ kind: 'mortar' } | { kind: 'orbital'; radius: number; fired: number; damageMul: number });

interface Pickup {
  group: THREE.Group;
  pos: THREE.Vector3;
  t: number;
}

interface SupplyDrop {
  credits: number;
  kind: DropKind;
  group: THREE.Group;
  ring: THREE.Mesh;
  pos: THREE.Vector3;
  falling: boolean;
  vy: number;
  life: number;
  ping: number;
}

interface FeedItem {
  text: string;
  time: number;
}

export interface GameOptions {
  canvas: HTMLCanvasElement;
  vehicle: VehicleType;
  /** the name the player gave the mech */
  mechName?: string;
  /** the built mech configuration; defaults to the stock chassis */
  config?: VehicleConfig;
  /** enemy difficulty weight carried by the equipped frame */
  stepWeight?: number;
  controls?: ControlMode;
  /** sector seed code; a random one is generated when omitted */
  seed?: string;
  audio: AudioManager;
  /** cockpit preferences (sensitivity, fov, quality…) */
  settings?: Settings;
  onLoot?: (amount: number) => void;
  onHud: (h: HudState) => void;
  onGameOver: (s: GameStats) => void;
  onPause: (paused: boolean) => void;
  /** Campaign mode: disables random wave survival loop & expands play area to full sector */
  campaignMode?: boolean;
  onEnemyKilled?: (e: { kind: EnemyKind; pos: { x: number; z: number }; boss?: boolean; elite?: boolean }) => void;
  onCheckInstallationHit?: (start: THREE.Vector3, end: THREE.Vector3, damage: number, splash: number) => boolean;
  onAreaDamage?: (pos: THREE.Vector3, damage: number, radius: number) => void;
}

// ---------------------------------------------------------------------------
// Game
// ---------------------------------------------------------------------------
export class Game {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private audio: AudioManager;
  private opts: GameOptions;
  private cfg: VehicleConfig;
  private vehicle: VehicleType;
  /** the name the player gave the mech */
  private mechName = '';

  private running = false;
  private paused = true;
  private raf = 0;
  private time = 0;
  private hudTimer = 0;
  private gameOverSent = false;

  private keys = new Set<string>();
  private mouse = { left: false, right: false };
  private zoom = false;
  private fovCurrent = 70;

  // player state
  public pos = new THREE.Vector3(0, 0, 0);
  get playerPos(): THREE.Vector3 { return this.pos; }
  get worldScene(): THREE.Scene { return this.scene; }
  private recovery = new DriveRecovery();
  private safeFooting = {x:0,z:0};
  private hullYaw = 0;
  private turretYaw = 0;
  private pitch = 0;
  private speed = 0;
  /** lateral velocity in world space (arcade controls) */
  private vel = new THREE.Vector3();
  private lean = 0;
  private controls: ControlMode = 'arcade';
  private enemyDmgMul = 1;
  private shellDrop = SHELL_GRAVITY;
  /** injected input (touch controls / on-screen buttons) */
  private padMove = { x: 0, y: 0 };
  private padFire = { primary: false, secondary: false };
  private padSensitivity = 1;
  private touchMode = false;

  // progression / weapon systems
  private stats: PlayerStats = defaultStats();
  private settings: Settings = { ...DEFAULT_SETTINGS };
  /** upgrade stacks taken during the run, keyed by upgrade id */
  private taken = new Map<string, number>();
  private perkList: { name: string; icon: string }[] = [];
  private owned = new Set<WeaponId>();
  private weaponCd: Record<WeaponId, number> = { autocannon: 0, cannon: 0, scatter: 0, coil: 0, flame: 0, cryo: 0, cryoball: 0, emp: 0, cinder: 0, orbital: 0, mines: 0, smoke: 0, missiles: 0, turret: 0, mortar: 0, overdrive: 0, rail: 0, nova: 0 };
  private shieldHp = 0;
  private shieldDelay = 0;
  /** stored reactor energy in kilojoules */
  private power = 0;
  /** throttle for the "power depleted" warning */
  private powerWarnCd = 0;
  private shieldBroken = false;
  private shieldFlash = 0;
  private upgrading = false;
  private pulses: { mesh: THREE.Mesh; age: number }[] = [];
  private missileQueue = 0;
  private missileTimer = 0;
  private strikes: Strike[] = [];
  private offer: UpgradeDef[] | null = null;
  private offersPending = 0;
  private wrecks: Wreck[] = [];
  private craters: Crater[] = [];
  private critTime = -10;
  private streak = 0;
  private streakTime = -10;
  // temporary combat buffs from supply drops / signature upgrades
  private lootCredits = 0;
  private buffT = { aegis: 0, overcharge: 0, rapid: 0, haste: 0, overdrive: 0, smoke: 0 };
  /** Duration at the last activation; a later upgrade must not stretch its timer bar. */
  private overdriveDuration = 8;
  private shotCounter = 0;
  private primaryShots = 0;
  private reactiveCd = -99;
  private arcTimer = 6;
  private drops: SupplyDrop[] = [];
  private dropTimer = 22;
  private dropTimerTotal = 22;
  private lines: { line: THREE.Line; age: number }[] = [];
  private lockWarnTimer = 0;
  private composer!: EffectComposer;
  private bloom!: UnrealBloomPass;
  private saltlineSky?: SaltlineSkyController;
  private ambientDust?: AmbientDustVolume;
  private agxPass?: ShaderPass;
  private shieldMesh!: THREE.Mesh;
  private fireSpots: THREE.Vector3[] = [];
  private fireLights: THREE.PointLight[] = [];
  private fireTimer = 0;
  private spottedMsgTime = -10;
  private ambushTime = -10;
  private ambushMsgTime = -10;
  private mgNoiseTimer = 0;
  private dustTimer = 0;
  private tiltPitch = 0;
  private tiltRoll = 0;
  private swayX = 0;
  private swayY = 0;
  private swayTargetX = 0;
  private swayTargetY = 0;
  private hp: number;
  private alive = true;
  private deathTimer = 0;
  private cannonCd = 0;
  /** reload of a scattergun mounted in the primary socket */
  private primaryCd = 0;
  private mgTimer = 0;
  private mgHeat = 0;
  private mgOverheat = false;
  /** Number of shots remaining in current 3-round burst */
  private mgBurstRemaining = 0;
  /** Pause timer between bursts */
  private mgBurstPauseTimer = 0;
  /** Timestamp of the last time player was in combat or saw an enemy */
  private lastEnemyCombatTime = 0;
  private secHeat = 0;
  private secOverheat = false;
  /** cooldown of the cryo grenade (seconds) */
  private secCd = 0;
  /** the cooldown `secCd` was primed with — used for an accurate readiness bar */
  private secCdMax = 0;
  /** interval between two beam ticks (flamethrower / cryo lance) */
  private beamCd = 0;
  private mines: Mine[] = [];
  private smokeClouds: SmokeCloud[] = [];
  private ordnance: Ordnance;
  private turrets: Turret[] = [];
  private burns: Burn[] = [];
  private recoil = 0;
  private armRecoil = [0, 0];
  private armRecoilVel = [0, 0];
  private recoilPitch = 0;
  private shake = 0;
  private landDip = 0;
  private prevSpeed = 0;
  private floaters = new Floaters();
  private floaterAnchor = new THREE.Vector3();
  /** rising edge tracker for the LAST CIRCUIT signature upgrade */
  private lastStandActive = false;
  private walkPhase = 0;
  private lastStep = 0;
  private damageFlash = 0;
  private damageDirs: { angle: number; time: number }[] = [];
  private hitMarkerTime = -10;
  private killTime = -10;
  private message = '';
  private messageTime = -10;
  private feed: FeedItem[] = [];
  private score = 0;
  private kills = 0;
  private wave = 0;
  private waveActive = false;
  private waveTimer = 4;
  /** a stage was cleared: the reward draft waits out the celebration first */
  private victoryPending = false;
  private victoryTimer = 0;
  private lowHpAlarm = 0;

  // world
  private obstacles: Obstacle[] = [];
  /** the seed the run started from; each stage derives its own sector from it */
  private baseSeed = '';
  /** the theme lights of the current sector */
  private worldLights: THREE.Object3D[] = [];
  /** the stage whose arena still has to be generated */
  private pendingArena = 0;
  /**
   * Every mesh the world generator produced for the current arena.
   *
   * The arena is disposable: when a stage is won the whole root is thrown
   * away and a fresh sector is built in its place.
   */
  private worldRoot: THREE.Group;
  private layout!: Layout;
  private mapApi!: MapResult;
  private seedCode = '';
  private condition: ReturnType<typeof conditionFor>;
  private arenaR = START_RADIUS;
  private arenaTarget = START_RADIUS;
  private zone = 0;
  private districtName = '';
  private districtTimer = 0;
  private expandTime = -99;
  private waveTag = '';
  private musicTimer = 0;
  private wading = false;
  private stars: THREE.Points | null = null;
  private fireLightTimer = 0;
  private stepWeight = 1;
  private buildMs = 0;
  private explosiveBarrels: ExplosiveBarrel[] = [];
  private waterTexture: THREE.Texture | null = null;
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private pickups: Pickup[] = [];
  private fire: ParticleSystem;
  private smoke: ParticleSystem;
  private weaponFx: WeaponEffects;
  private flashLights: THREE.PointLight[] = [];
  private muzzleLight: THREE.PointLight;
  private hemiLight?: THREE.HemisphereLight;
  private ambientLight?: THREE.AmbientLight;
  private baseHemiIntensity = 0.55;
  private baseAmbientIntensity = 0.45;
  private baseSunIntensity = 1.0;
  private sun!: THREE.DirectionalLight;
  private sky!: THREE.Mesh;
  private sunDisc!: THREE.Mesh;
  private sunDir = new THREE.Vector3(0.55, 0.32, 0.45).normalize();
  private weapon = new THREE.Group();
  private arms: ReturnType<typeof makeHardpoint>[] = [];

  private geo = {
    shell: new THREE.SphereGeometry(0.3, 8, 8),
    bullet: new THREE.BoxGeometry(0.14, 0.14, 2.0),
    rocket: new THREE.CylinderGeometry(0.22, 0.34, 1.9, 8),
    pickup: new THREE.BoxGeometry(1.4, 1.4, 1.4),
    cross1: new THREE.BoxGeometry(0.9, 0.25, 1.5),
    cross2: new THREE.BoxGeometry(0.25, 0.9, 1.5),
    ring: new THREE.RingGeometry(1.6, 2.0, 24),
    crater: new THREE.CircleGeometry(1, 14),
  };
  private mats = {
    playerShell: new THREE.MeshBasicMaterial({ color: 0xffe0a0 }),
    enemyShell: new THREE.MeshBasicMaterial({ color: 0xff7040 }),
    bullet: new THREE.MeshBasicMaterial({ color: 0xffd060 }),
    enemyBullet: new THREE.MeshBasicMaterial({ color: 0xff5030 }),
    rocket: new THREE.MeshBasicMaterial({ color: 0xff9040 }),
    playerRocket: new THREE.MeshBasicMaterial({ color: 0x9fe8ff }),
    sniperShell: new THREE.MeshBasicMaterial({ color: 0x7dffb0 }),
    laser: new THREE.LineBasicMaterial({ color: 0xff2040, transparent: true, opacity: 0.8 }),
    pickup: new THREE.MeshStandardMaterial({ color: 0x1f6f3f, emissive: 0x18c060, emissiveIntensity: 0.6, roughness: 0.5 }),
    pickupCross: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.2 }),
    ring: new THREE.MeshBasicMaterial({ color: 0x40ff90, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
  };
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private tmpC = new THREE.Vector3();
  private tmpD = new THREE.Vector3();

  constructor(opts: GameOptions) {
    const buildStart = performance.now();
    this.opts = opts;
    this.baseSeed = opts.seed && opts.seed.trim() ? opts.seed.trim().toUpperCase() : randomSeedCode();
    this.seedCode = this.baseSeed;
    this.layout = generateLayout(this.seedCode);
    this.condition = conditionFor(this.seedCode);
    if (opts.campaignMode) {
      this.arenaR = WORLD_RADIUS - 10;
      this.arenaTarget = WORLD_RADIUS - 10;
      this.zone = MAX_ZONE;
    }
    this.stepWeight = opts.stepWeight ?? { warden: 1, pyre: 1.5, glacier: 0.75 }[opts.vehicle];
    this.canvas = opts.canvas;
    this.audio = opts.audio;
    this.vehicle = opts.vehicle;
    this.cfg = opts.config ?? VEHICLES[opts.vehicle];
    this.ordnance = new Ordnance(this.cfg.loadout);
    this.mechName = opts.mechName?.trim() || this.cfg.name;
    this.hp = this.cfg.maxHp;
    this.power = this.cfg.powerCapacity;
    this.stats.shieldMax = this.cfg.shield;
    this.shieldHp = this.cfg.shield;
    this.owned = new Set(
      [this.cfg.loadout.primary, this.cfg.loadout.secondary, this.cfg.loadout.abilityQ, this.cfg.loadout.abilityE].filter(
        (w): w is WeaponId => Boolean(w),
      ),
    );
    this.controls = opts.controls ?? 'arcade';
    // friendlier handling for the easy mode: flatter shots, softer incoming fire
    this.shellDrop = this.controls === 'arcade' ? SHELL_GRAVITY * 0.35 : SHELL_GRAVITY;
    this.enemyDmgMul = this.controls === 'arcade' ? 0.7 : 1;
    if (this.controls === 'arcade') {
      this.cfg = {
        ...this.cfg,
        splash: this.cfg.splash * 1.35,
        scatterSplash: this.cfg.scatterSplash * 1.35,
        mgDamage: this.cfg.mgDamage * 1.25,
      };
    }
    this.geo.rocket.rotateX(Math.PI / 2);

    this.renderer = new THREE.WebGLRenderer({ canvas: opts.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    enablePCSSShadows(280, 280, 490, 16, 8);
    // AGX_GRADE_SHADER handles filmic tone mapping & sRGB output in the post-pass
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.toneMappingExposure = this.layout.theme.exposure;
    const gl = this.renderer.getContext();
    const gpuInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const gpuName = gpuInfo ? String(gl.getParameter(gpuInfo.UNMASKED_RENDERER_WEBGL)) : '';
    const software = /swiftshader|llvmpipe|softpipe/i.test(gpuName);
    if (software) {
      // Software renderers need a smaller render target to remain responsive.
      this.quality = 0;
      this.renderer.setPixelRatio(0.65);
      this.renderer.setSize(window.innerWidth, window.innerHeight, false);
      this.renderer.shadowMap.enabled = false;
    } else if (this.settings.quality === 'low') {
      // Explicitly light mode: no bloom, no shadows, native resolution.
      this.quality = 0;
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
    }
    this.audio.setVolume(this.settings.volume);
    this.audio.setMusicVolume(this.settings.music);

    this.camera = new THREE.PerspectiveCamera(this.settings.fov, window.innerWidth / window.innerHeight, 0.1, 1500);
    this.fovCurrent = this.settings.fov;
    this.scene.add(this.camera);
    this.scene.fog = new THREE.Fog(this.layout.theme.fog, this.layout.theme.fogNear, this.layout.theme.fogFar);

    this.fire = new ParticleSystem(900, true);
    this.smoke = new ParticleSystem(700, false);
    this.scene.add(this.fire.mesh, this.smoke.mesh);
    this.weaponFx = new WeaponEffects(this.scene);

    this.muzzleLight = new THREE.PointLight(0xffc080, 0, 45, 2);
    this.camera.add(this.muzzleLight);

    // post-processing: bloom + Saltline AgX filmic tone mapping & color grading pass
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.45, 0.4, 0.88);
    this.composer.addPass(this.bloom);
    this.agxPass = new ShaderPass(AGX_GRADE_SHADER);
    this.agxPass.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    this.composer.addPass(this.agxPass);
    this.composer.setSize(window.innerWidth, window.innerHeight);

    // energy shield: a faint hex-ish bubble around the cockpit (only visible edges)
    this.shieldMesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(this.cfg.radius * 1.9, 1),
      new THREE.MeshBasicMaterial({ color: 0x59c8ff, transparent: true, opacity: 0, wireframe: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.shieldMesh.visible = false;
    this.scene.add(this.shieldMesh);

    this.worldRoot = new THREE.Group();
    this.scene.add(this.worldRoot);
    this.buildWorld();
    this.buildMs = performance.now() - buildStart;
    this.buildWeapon();

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mousedown', this.onMouseDown);
    document.addEventListener('mouseup', this.onMouseUp);
    document.addEventListener('pointerlockchange', this.onLockChange);
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('blur', this.onBlur);
  }

  // -------------------------------------------------------------------------
  // World construction
  // -------------------------------------------------------------------------
  private buildWorld() {
    this.buildEnvironment();
    // procedural terrain, districts, roads, cover and set dressing
    const map = buildMap(this.worldRoot, this.obstacles, () => createTankMesh(PALETTES.wreck).group, this.layout);
    this.mapApi = map;
    if (this.opts.campaignMode) map.setBoundaryVisible(false);
    this.fireSpots = map.fires;
    this.explosiveBarrels = map.barrels;
    this.waterTexture = map.waterTexture;
    // a few pooled lights follow the burning wrecks nearest to the player
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight(0xff8a3a, 0, 30, 2);
      this.scene.add(l);
      this.fireLights.push(l);
    }

    // explosion light pool
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight(0xffb070, 0, 70, 2);
      this.scene.add(l);
      this.flashLights.push(l);
    }
  }

  /**
   * The sky, the sun and the ambient light of the sector.
   *
   * These belong to the theme, and the theme belongs to the arena, so they
   * are rebuilt whenever a new sector is generated.
   */
  private buildEnvironment() {
    const scene = this.scene;
    const theme = this.layout.theme;
    const hemi = new THREE.HemisphereLight(theme.hemiSky, theme.hemiGround, theme.hemiIntensity);
    const ambient = new THREE.AmbientLight(theme.ambient, theme.ambientIntensity);
    this.hemiLight = hemi;
    this.ambientLight = ambient;
    this.baseHemiIntensity = theme.hemiIntensity;
    this.baseAmbientIntensity = theme.ambientIntensity;
    this.baseSunIntensity = theme.sunIntensity;
    this.worldLights.push(hemi, ambient);
    scene.add(hemi, ambient);
    const sun = new THREE.DirectionalLight(theme.sunColor, theme.sunIntensity);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.4;
    scene.add(sun, sun.target);
    this.sun = sun;
    this.sunDir.set(theme.sunDir[0], theme.sunDir[1], theme.sunDir[2]).normalize();
    fitDirectionalLightShadow(this.sun, this.sunDir, this.pos);

    // Saltline volumetric cloud deck & atmospheric sky
    const sunCol = new THREE.Color(theme.sunColor);
    const skyTop = new THREE.Color(theme.skyTop);
    const skyHor = new THREE.Color(theme.skyHorizon);
    this.saltlineSky = createSaltlineSky(this.sunDir, sunCol, skyTop, skyHor);
    this.sky = this.saltlineSky.mesh;
    scene.add(this.sky);

    // Image-Based Lighting: bake HDR cubemap from the sky for realistic specular reflections on all mechs & metals
    scene.environment = generateEnvironmentMap(this.renderer, this.saltlineSky);
    scene.environmentIntensity = 0.6;

    // Atmospheric windblown micro-particles
    this.ambientDust = new AmbientDustVolume(scene);

    this.sunDisc = new THREE.Mesh(new THREE.CircleGeometry(theme.sunSize, 24), new THREE.MeshBasicMaterial({ color: theme.sunDisc, fog: false }));
    this.sunDisc.visible = false;
    scene.add(this.sunDisc);
    if (theme.stars > 0) {
      const n = 800;
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const th = Math.random() * TWO_PI;
        const ph = Math.acos(Math.random() * 0.95 + 0.05);
        arr[i * 3] = Math.sin(ph) * Math.cos(th) * 1100;
        arr[i * 3 + 1] = Math.cos(ph) * 1100;
        arr[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * 1100;
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85, depthWrite: false }));
      this.stars.frustumCulled = false;
      scene.add(this.stars);
    }

  }

  /**
   * Throw the arena away and build a fresh sector in its place.
   *
   * Winning a stage means the crowd turns on you and the yard drags the
   * mech to the next sector: new terrain, new districts, new theme, new
   * seed. The old sector's meshes are disposed so nothing leaks between
   * stages.
   */
  private rebuildArena(stage: number) {
    const t0 = performance.now();

    // ---- tear the old sector down ------------------------------------
    this.worldRoot.traverse((o) => {
      const m = o as THREE.Mesh & { isPoints?: boolean; isLine?: boolean };
      if (m.isMesh || m.isPoints || m.isLine) {
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      }
    });
    this.worldRoot.clear();
    this.obstacles.length = 0;
    this.fireSpots = [];
    this.explosiveBarrels = [];
    if (this.waterTexture) this.waterTexture.dispose();
    this.waterTexture = null;

    // ---- clear the leftovers of the fight ----------------------------
    for (const e of this.enemies) this.scene.remove(e.group ?? new THREE.Group());
    this.enemies.length = 0;
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    this.projectiles.length = 0;
    for (const p of this.pickups) this.scene.remove(p.group);
    this.pickups.length = 0;
    while (this.drops.length) this.removeDrop(this.drops.length - 1);
    for (const cloud of this.smokeClouds) if (cloud.mesh) {
      this.scene.remove(cloud.mesh);
      cloud.mesh.geometry.dispose();
      (cloud.mesh.material as THREE.Material).dispose();
    }
    this.smokeClouds.length = 0;
    for (const t of this.turrets) this.scene.remove(t.group);
    this.turrets.length = 0;
    for (const m of this.mines) this.scene.remove(m.group);
    this.mines.length = 0;
    for (const s of this.strikes) this.removeStrikeMarker(s.marker);
    this.strikes.length = 0;
    for (const w of this.wrecks) this.scene.remove(w.group);
    this.wrecks.length = 0;
    for (const c of this.craters) this.scene.remove(c.mesh);
    this.craters.length = 0;

    // ---- build the next sector ---------------------------------------
    this.seedCode = stageSeedCode(this.baseSeed, stage);
    this.layout = generateLayout(this.seedCode);
    this.condition = conditionFor(this.seedCode);
    // the new sector starts tight and opens out to the depth the run has
    // already reached, so the pits keep growing across the night
    this.arenaR = START_RADIUS;
    this.arenaTarget = zoneRadius(this.zone);
    this.expandTime = this.time;

    const theme = this.layout.theme;
    this.scene.fog = new THREE.Fog(theme.fog, theme.fogNear, theme.fogFar);
    this.renderer.toneMappingExposure = theme.exposure;

    // the sky dome, sun disc and stars belong to the theme, so they are
    // rebuilt with the sector they belong to
    if (this.sky) {
      this.scene.remove(this.sky);
      this.sky.geometry.dispose();
      (this.sky.material as THREE.Material).dispose();
    }
    if (this.sunDisc) {
      this.scene.remove(this.sunDisc);
      this.sunDisc.geometry.dispose();
      (this.sunDisc.material as THREE.Material).dispose();
    }
    if (this.stars) {
      this.scene.remove(this.stars);
      this.stars.geometry.dispose();
      (this.stars.material as THREE.Material).dispose();
      this.stars = null;
    }
    if (this.sun) {
      this.scene.remove(this.sun);
      this.scene.remove(this.sun.target);
    }
    for (const l of this.worldLights) this.scene.remove(l);
    this.worldLights.length = 0;
    this.buildEnvironment();

    const map = buildMap(this.worldRoot, this.obstacles, () => createTankMesh(PALETTES.wreck).group, this.layout);
    this.mapApi = map;
    if (this.opts.campaignMode) map.setBoundaryVisible(false);
    this.fireSpots = map.fires;
    this.explosiveBarrels = map.barrels;
    this.waterTexture = map.waterTexture;

    // the mech is dropped into the middle of the new sector
    this.pos.set(0, heightAt(0, 0), 0);
    this.safeFooting.x=this.safeFooting.z=0;
    this.recovery.reset(this.pos);
    this.vel.set(0, 0, 0);
    this.turretYaw = this.hullYaw = 0;
    this.pitch = 0;
    this.primaryCd = 0;
    this.cannonCd = 0;
    this.mgTimer = 0;
    this.mgBurstRemaining = 0;
    this.mgBurstPauseTimer = 0;
    this.lastEnemyCombatTime = 0;
    this.mgHeat = 0;
    this.mgOverheat = false;
    this.secCd = 0;
    this.secCdMax = 0;
    this.beamCd = 0;
    this.secHeat = 0;
    this.secOverheat = false;

    // a repair kit lands next to the mech so the new sector starts fair
    const a = rand(0, TWO_PI);
    const px = Math.sin(a) * 16;
    const pz = Math.cos(a) * 16;
    if (!this.obstacles.some((o) => obsDist(o, px, pz) < 3)) this.spawnPickup(px, pz);

    this.setMessage(`NEW SECTOR — ${theme.name} · ${this.layout.districts[0]?.name ?? 'THE PIT'}`);
    this.addFeed(`THE YARD DROPS YOU IN ${this.seedCode}`);
    this.buildMs = performance.now() - t0;
  }

  private buildWeapon() {
    this.arms = [this.cfg.loadout.primary,this.cfg.loadout.secondary].map((id,i)=>{
      const arm=makeHardpoint(id,this.cfg);
      poseHardpoint(arm.root,i,this.camera.aspect,this.settings.fov,0);
      this.weapon.add(arm.root);return arm;
    });
    this.camera.add(this.weapon);
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------
  start() {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    this.audio.startEngine(this.vehicle);
    this.audio.startAmbience(this.layout.theme.ambience);
    this.audio.startMusic();
    this.setMessage('SYSTEMS ONLINE — HOSTILES INBOUND');
    this.loop();
  }

  requestPointerLock() {
    if (this.upgrading || !this.alive) return;
    this.canvas.focus({ preventScroll: true });
    this.audio.resume();
    try {
      const r = this.canvas.requestPointerLock() as unknown;
      if (r && typeof (r as Promise<void>).catch === 'function') (r as Promise<void>).catch(() => undefined);
    } catch {
      /* ignore */
    }
  }

  isLocked() {
    return document.pointerLockElement === this.canvas;
  }

  // -------------------------------------------------------------------------
  // Touch / on-screen input (used when there is no pointer lock, e.g. mobile)
  // -------------------------------------------------------------------------
  /** Movement stick input, x = strafe (-1..1), y = throttle (-1..1). */
  setPadMove(x: number, y: number) {
    this.padMove.x = clamp(x, -1, 1);
    this.padMove.y = clamp(y, -1, 1);
  }

  /** Fire buttons held down. */
  setPadFire(primary: boolean, secondary: boolean) {
    this.padFire.primary = primary;
    this.padFire.secondary = secondary;
  }

  /** Aim drag from a touch surface, in pixels. */
  addPadLook(dx: number, dy: number) {
    if (!this.alive) return;
    const sens = 0.0032 * this.padSensitivity * this.settings.sensitivity * (this.zoom ? 0.5 : 1);
    this.turretYaw -= dx * sens;
    const ddy = this.settings.invertY ? dy : -dy;
    this.pitch = clamp(this.pitch + ddy * sens, -0.3, 0.4);
  }

  setPadSensitivity(s: number) {
    this.padSensitivity = clamp(s, 0.3, 2.5);
  }

  toggleZoom() {
    this.zoom = !this.zoom;
  }

  /**
   * Run without pointer lock (touch devices). The game loop keeps ticking and
   * aiming is driven by addPadLook instead of mouse movement.
   */
  setTouchMode(on: boolean) {
    this.touchMode = on;
    if (on) {
      this.paused = false;
      this.audio.resume();
      this.opts.onPause(false);
    }
  }

  isTouchMode() {
    return this.touchMode;
  }

  /** Live cockpit preferences — the pause menu can change these mid-run. */
  applySettings(settings: Settings) {
    this.settings = { ...this.settings, ...settings };
    this.fovCurrent = this.settings.fov;
    this.camera.fov = this.settings.fov;
    this.camera.updateProjectionMatrix();
    this.audio.setVolume(this.settings.volume);
    this.audio.setMusicVolume(this.settings.music);
    if (this.settings.quality === 'low' && this.quality > 0) {
      this.quality = 0;
      this.renderer.shadowMap.enabled = false;
    }
  }

  getSettings(): Settings {
    return { ...this.settings };
  }

  /** Spawn an enemy unit at tactical world coordinates. */
  public spawnTacticalEnemy(kind: EnemyKind, x: number, z: number, boss = false, elite = false) {
    this.spawnEnemy(kind, x, z, boss, elite);
    this.waveActive = true;
  }

  /** Debug helper: spawn an enemy a given distance ahead of the turret. */
  debugSpawn(kind: EnemyKind, dist = 60, side = 0, boss = false) {
    const f = fwd(this.turretYaw, new THREE.Vector3());
    const r = rightOf(this.turretYaw, new THREE.Vector3());
    const x = this.pos.x + f.x * dist + r.x * side;
    const z = this.pos.z + f.z * dist + r.z * side;
    this.spawnEnemy(kind, x, z, boss);
    this.waveActive = true;
    if (this.wave === 0) this.wave = 1;
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mousedown', this.onMouseDown);
    document.removeEventListener('mouseup', this.onMouseUp);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('blur', this.onBlur);
    this.audio.stopEngine();
    this.audio.stopAmbience();
    this.audio.stopMusic();
    this.audio.setWading(false);
    if (this.isLocked()) document.exitPointerLock();
    while(this.drops.length) this.removeDrop(this.drops.length-1);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat.dispose();
      }
    });
    this.weaponFx.dispose();
    this.ambientDust?.destroy(this.scene);
    this.composer.dispose();
    this.renderer.dispose();
  }

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------
  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.upgrading && (this.paused || !this.alive)) return;
    if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ControlLeft', 'ControlRight'].includes(e.code)) e.preventDefault();
    if (this.upgrading) {
      if (!e.repeat && (e.code === 'Digit1' || e.code === 'Numpad1')) this.pickUpgrade(0);
      if (!e.repeat && (e.code === 'Digit2' || e.code === 'Numpad2')) this.pickUpgrade(1);
      if (!e.repeat && (e.code === 'Digit3' || e.code === 'Numpad3')) this.pickUpgrade(2);
      return;
    }
    // Movement and actions belong to the same live simulation. A stale lock
    // sample must not silently discard only Q/E (or the recovery key).
    this.keys.add(e.code);
    if(e.code==='KeyU' && !e.repeat) this.unstick();
    if (e.code === 'KeyZ') this.zoom = !this.zoom;
    if (e.code === 'KeyM' && !e.repeat) this.audio.toggleMusic();
    if (!e.repeat && e.code === 'KeyQ' && this.cfg.loadout.abilityQ) this.useWeapon(this.cfg.loadout.abilityQ);
    if (!e.repeat && e.code === 'KeyE' && this.cfg.loadout.abilityE) this.useWeapon(this.cfg.loadout.abilityE);
    if (e.code === 'Digit1' || e.code === 'Numpad1') this.pickUpgrade(0);
    if (e.code === 'Digit2' || e.code === 'Numpad2') this.pickUpgrade(1);
    if (e.code === 'Digit3' || e.code === 'Numpad3') this.pickUpgrade(2);
    if (e.code === 'Enter' && this.victoryPending) this.extractNow();
    if ((e.code === 'Enter' || e.code === 'KeyN') && !this.waveActive && !this.victoryPending && this.waveTimer > 1.5) {
      this.waveTimer = 1.5;
      this.setMessage('CALLING IN THE NEXT WAVE');
    }
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  private onMouseMove = (e: MouseEvent) => {
    if (!this.isLocked() || !this.alive) return;
    const sens = 0.0021 * this.settings.sensitivity * (this.zoom ? 0.45 : 1);
    this.turretYaw -= e.movementX * sens;
    const dy = this.settings.invertY ? e.movementY : -e.movementY;
    this.pitch = clamp(this.pitch + dy * sens, -0.3, 0.4);
    this.swayTargetX = clamp(this.swayTargetX - e.movementX * 0.0006, -0.05, 0.05);
    this.swayTargetY = clamp(this.swayTargetY + dy * 0.0006, -0.035, 0.035);
  };
  private onMouseDown = (e: MouseEvent) => {
    if (!this.isLocked()) return;
    if (e.button === 0) this.mouse.left = true;
    else if (e.button === 2) this.mouse.right = true;
    else if (e.button === 1) {
      this.zoom = !this.zoom;
      e.preventDefault();
    }
  };
  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.mouse.left = false;
    else if (e.button === 2) this.mouse.right = false;
  };
  private onContextMenu = (e: Event) => e.preventDefault();
  private onLockChange = () => {
    if (this.upgrading) {
      if (this.isLocked()) document.exitPointerLock();
      this.paused = true;
      this.keys.clear();
      this.mouse.left = this.mouse.right = false;
      // The upgrade screen owns the viewport: keep the pause veil hidden but
      // leave the simulation frozen.
      this.opts.onPause(false);
      return;
    }
    if (this.touchMode) return;
    const locked = this.isLocked();
    this.paused = !locked;
    if (this.paused) this.audio.setMusicIntensity(0.05);
    if (!locked) {
      this.keys.clear();
      this.mouse.left = this.mouse.right = false;
    } else {
      this.canvas.focus({ preventScroll: true });
      this.audio.resume();
    }
    this.opts.onPause(this.paused && this.alive);
  };
  private onBlur = () => {
    this.keys.clear();
    this.mouse.left = this.mouse.right = false;
    this.padMove.x = this.padMove.y = 0;
    this.padFire.primary = this.padFire.secondary = false;
    // A preview iframe can lose keyboard focus before the browser releases
    // mouse capture. Do not leave the pilot fighting without keyboard input.
    if (!this.touchMode && this.alive && !this.upgrading && !this.paused) {
      this.paused = true;
      this.opts.onPause(true);
      if (this.isLocked()) document.exitPointerLock();
    }
  };
  private onResize = () => {
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.composer.setSize(window.innerWidth, window.innerHeight);
    this.agxPass?.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    if (this.quality === 1) this.bloom.setSize(Math.round(window.innerWidth / 2), Math.round(window.innerHeight / 2));
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  };

  // -------------------------------------------------------------------------
  // Main loop
  // -------------------------------------------------------------------------
  private perfSamples = 0;
  private perfSlow = 0;
  private quality = 2; // 2 = bloom full, 1 = bloom low-res, 0 = bloom off
  private fps = 60;

  private loop = () => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    const raw = this.clock.getDelta();
    if ((!this.paused && !this.upgrading) || !this.alive) {
      let remaining = Math.min(raw, 0.25);
      while (remaining > 0) {
        const step = Math.min(remaining, 0.05);
        this.update(step);
        remaining -= step;
        if (this.upgrading && this.alive) break;
      }
    }
    const t0 = performance.now();
    if (this.quality > 0) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
    // adaptive quality: step bloom down on machines that can't keep ~30 fps
    const frameMs = performance.now() - t0;
    this.perfSamples++;
    if (frameMs > 40 || raw > 0.06) this.perfSlow++;
    if (this.perfSamples >= 12) {
      if (this.perfSlow > 8 && this.quality > 0) {
        this.quality--;
        if (this.quality === 1) {
          this.renderer.setPixelRatio(1);
          this.onResize();
        }
      }
      this.perfSamples = 0;
      this.perfSlow = 0;
    }
  };

  private update(dt: number) {
    this.time += dt;
    this.saltlineSky?.update(dt);
    const flash = this.saltlineSky?.getFlashIntensity() ?? 0;
    if (this.hemiLight) this.hemiLight.intensity = this.baseHemiIntensity + flash * 0.12;
    if (this.ambientLight) this.ambientLight.intensity = this.baseAmbientIntensity + flash * 0.06;
    if (this.sun) this.sun.intensity = this.baseSunIntensity + flash * 0.08;
    if (this.agxPass) {
      this.agxPass.uniforms.uTime.value = this.time;
      this.agxPass.uniforms.uDamage.value = this.damageFlash;
      this.agxPass.uniforms.uLowHealth.value = this.hp < this.cfg.maxHp * 0.35 ? 1.0 : 0.0;
      this.agxPass.uniforms.uFlash.value = flash * 0.4;
      this.agxPass.uniforms.uExposure.value = (this.layout.theme.exposure ?? 1.0) * 0.94;
    }
    if (this.arenaR < this.arenaTarget) {
      this.arenaR = Math.min(this.arenaTarget, this.arenaR + 16 * dt);
      this.mapApi.setRadius(this.arenaR);
    }
    this.mapApi.animate(dt, this.time);
    this.mapApi.structures.animate(dt,(p,scale)=>this.dust(p,scale));
    if (this.alive) {
      this.updatePlayer(dt);
      this.pos.y = heightAt(this.pos.x, this.pos.z);
      for (const relay of this.mapApi.relays) {
        if (relay.claimed) continue;
        const pos = relay.marker.position;
        if (Math.hypot(this.pos.x-pos.x, this.pos.z-pos.z) > 9) { relay.charge = 0; continue; }
        if (relay.charge === 0) this.addFeed(`${relay.reward === 'repair' ? 'REPAIR' : 'RELOAD'} RELAY — HOLD FOR 2 SECONDS`);
        relay.charge += dt;
        if (relay.charge >= 2) {
          relay.claimed = true;
          relay.marker.visible = false;
          this.applyDrop(relay.reward);
        }
      }
      this.updateWeapons(dt);
      this.updateSystems(dt);
    } else {
      this.deathTimer += dt;
      if (this.deathTimer > 3.2 && !this.gameOverSent) {
        this.gameOverSent = true;
        this.opts.onGameOver({
          score: this.score,
          wave: this.wave,
          kills: this.kills,
          lootCredits: this.lootCredits,
          timeSurvived: this.time,
          vehicle: this.vehicle,
          mechName: this.mechName,
          perks: this.perkList.map((p) => p.name),
          seed: this.seedCode,
          zone: this.zone,
        });
      }
    }
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateStrikes(dt);
    this.updatePickups(dt);
    this.updateWaves(dt);
    this.updateEffects(dt);
    this.updateTurrets(dt);
    this.updateBurns(dt);
    this.updateMines(dt);
    this.updateSmokeClouds(dt);
    this.updateWrecks(dt);
    this.updateCamera(dt);
    // the reactor trickles energy back into the grid
    this.power = Math.min(this.cfg.powerCapacity, this.power + reserveRecharge(this.cfg.powerOutput,this.condition.energy) * dt);
    if (this.powerWarnCd > 0) this.powerWarnCd -= dt;
    this.hudTimer += dt;
    if (this.hudTimer >= 1 / 30) {
      this.hudTimer = 0;
      this.opts.onHud(this.buildHud());
    }
  }

  // -------------------------------------------------------------------------
  // Player
  // -------------------------------------------------------------------------
  private updatePlayer(dt: number) {
    const k = this.keys;
    const mobility = this.stats.speedMul * (this.buffT.haste > 0 ? 1.2 : 1) * (this.buffT.overdrive > 0 ? 1.25 : 1) * (this.buffT.smoke > 0 ? 1.15 : 1) * (inWater(this.pos.x, this.pos.z) ? 0.72 : 1);
    const c = { ...this.cfg, maxSpeed: this.cfg.maxSpeed * mobility, accel: this.cfg.accel * mobility };
    let throttle = 0;
    if (k.has('KeyW')) throttle += 1;
    if (k.has('KeyS')) throttle -= 1;
    let turnKey = 0;
    if (k.has('KeyA')) turnKey += 1;
    if (k.has('KeyD')) turnKey -= 1;
    throttle += this.padMove.y;
    // keyboard A = +1 (left), D = -1 (right); touch stick +x = right
    const turn = turnKey - this.padMove.x;

    // Arrow keys aiming (right-hand cursor controls rotate aim like a mouse)
    let arrowYaw = 0;
    let arrowPitch = 0;
    if (k.has('ArrowLeft')) arrowYaw += 1;
    if (k.has('ArrowRight')) arrowYaw -= 1;
    if (k.has('ArrowUp')) arrowPitch += 1;
    if (k.has('ArrowDown')) arrowPitch -= 1;
    if (arrowYaw !== 0 || arrowPitch !== 0) {
      const turnSpeed = 2.4 * this.settings.sensitivity * (this.zoom ? 0.45 : 1.0);
      const pitchSpeed = 1.8 * this.settings.sensitivity * (this.zoom ? 0.45 : 1.0);
      this.turretYaw += arrowYaw * turnSpeed * dt;
      const dy = (this.settings.invertY ? -arrowPitch : arrowPitch) * pitchSpeed * dt;
      this.pitch = clamp(this.pitch + dy, -0.3, 0.4);
      this.swayTargetX = clamp(this.swayTargetX + arrowYaw * 0.02, -0.05, 0.05);
      this.swayTargetY = clamp(this.swayTargetY + dy * 0.02, -0.035, 0.035);
    }
    this.updatePitchAssist(dt);

    if (this.controls === 'arcade') {
      // ---------------------------------------------------------------------
      // EASY / ARCADE: WASD is relative to where you are LOOKING. The hull
      // steers itself, so the player never has to think about vehicle heading.
      // ---------------------------------------------------------------------
      const strafe = -turnKey + this.padMove.x; // +1 = move to the player's right
      let mx = strafe;
      let my = throttle;
      const mag = Math.hypot(mx, my);
      if (mag > 1) {
        mx /= mag;
        my /= mag;
      }
      const f = fwd(this.turretYaw, this.tmpA);
      const r = rightOf(this.turretYaw, this.tmpB);
      const wish = this.tmpC.set(0, 0, 0).addScaledVector(f, my).addScaledVector(r, mx);
      const wishLen = wish.length();
      const maxSpd = c.maxSpeed * (my < -0.05 ? 0.62 : 1);
      const target = wishLen > 0.001 ? wish.multiplyScalar(maxSpd / wishLen) : this.tmpC.set(0, 0, 0);
      // accelerate toward the desired velocity
      const dv = this.tmpD.subVectors(target, this.vel);
      const maxDv = c.accel * 1.35 * dt;
      if (dv.length() <= maxDv) this.vel.copy(target);
      else this.vel.addScaledVector(dv.normalize(), maxDv);
      // friction when no input
      if (wishLen < 0.001) this.vel.multiplyScalar(Math.max(0, 1 - dt * 6));
      const x=this.pos.x,z=this.pos.z, incoming=this.vel.length();
      if(moveHull(this.pos,this.vel.x*dt,this.vel.z*dt,c.radius,this.arenaR-c.radius-1.8,this.safeFooting)) {
        // Keep actual sliding velocity instead of braking both axes at every contact.
        this.vel.set((this.pos.x-x)/dt,0,(this.pos.z-z)/dt).clampLength(0,incoming);
        if(incoming-this.vel.length()>c.maxSpeed*.5) this.shake=Math.max(this.shake,.15);
      }
      const speedMag=this.vel.length();
      // hull follows the direction of travel (or the aim when standing still)
      const hullTarget = speedMag > 1.2 ? Math.atan2(this.vel.x, this.vel.z) : this.turretYaw;
      this.hullYaw = moveAngle(this.hullYaw, hullTarget, (speedMag > 1.2 ? c.turnRate * 1.9 : c.turnRate * 1.1) * dt);
      // signed speed / strafe lean for the HUD, footsteps and camera
      this.speed = this.vel.dot(fwd(this.turretYaw, this.tmpA));
      this.lean = moveToward(this.lean, clamp(this.vel.dot(rightOf(this.turretYaw, this.tmpB)) / c.maxSpeed, -1, 1), dt * 3);
      if (speedMag > 0.05) {
        this.walkPhase += dt * (3.2 + 7.5 * (speedMag / c.maxSpeed));
        const step = Math.floor(this.walkPhase / Math.PI);
        if (step !== this.lastStep) {
          this.lastStep = step;
          this.audio.playFootstep(this.stepWeight);
          this.shake = Math.max(this.shake, 0.05 + 0.06 * (speedMag / c.maxSpeed));
        }
      }
      this.audio.setEngine(speedMag / c.maxSpeed, wishLen > 0.01);
    } else {
      // ---------------------------------------------------------------------
      // REALISTIC: hull and turret are steered independently (classic tank).
      // ---------------------------------------------------------------------
      const maxSpd = throttle >= 0 ? c.maxSpeed : c.maxSpeed * 0.55;
      if (throttle !== 0) this.speed = moveToward(this.speed, throttle * maxSpd, c.accel * dt);
      else this.speed = moveToward(this.speed, 0, c.accel * 1.6 * dt);

      this.hullYaw += turn * c.turnRate * dt * (1 - 0.25 * Math.abs(this.speed) / c.maxSpeed);
      const f = fwd(this.hullYaw, this.tmpA);
      const x=this.pos.x,z=this.pos.z;
      if(moveHull(this.pos,f.x*this.speed*dt,f.z*this.speed*dt,c.radius,this.arenaR-c.radius-1.8,this.safeFooting)) {
        const traveled=Math.hypot(this.pos.x-x,this.pos.z-z)/dt;
        if(Math.abs(this.speed)-traveled>c.maxSpeed*.5) this.shake=Math.max(this.shake,.15);
        // Speed here is track drive, not a velocity vector. Do not reapply the
        // wall projection to that scalar on every tick of an oblique slide.
        if (traveled < Math.abs(this.speed)*0.02) this.speed=0;
      }
      this.lean = moveToward(this.lean, 0, dt * 3);

      {
        const sf = Math.abs(this.speed) / c.maxSpeed;
        if (sf > 0.05) {
          this.walkPhase += dt * (3.2 + 7.5 * sf);
          const step = Math.floor(this.walkPhase / Math.PI);
          if (step !== this.lastStep) {
            this.lastStep = step;
            this.audio.playFootstep(this.stepWeight);
            this.shake = Math.max(this.shake, 0.05 + 0.06 * sf);
          }
        }
      }
      this.audio.setEngine(Math.abs(this.speed) / c.maxSpeed, throttle !== 0);
    }

    const driving=Math.abs(throttle)>.08 || (this.controls==='arcade' && Math.abs(turn)>.08);
    this.recovery.track(dt,this.pos,driving,c.radius,this.arenaR-c.radius-1.8);
    // low hp alarm
    if (this.hp / c.maxHp < 0.3) {
      this.lowHpAlarm -= dt;
      if (this.lowHpAlarm <= 0) {
        this.lowHpAlarm = 1.4;
        this.audio.playAlarm();
      }
    }
  }

  unstick() {
    if(!this.alive || this.upgrading || this.paused)return;
    const point=this.recovery.destination(this.pos,this.cfg.radius,this.arenaR-this.cfg.radius-1.8);
    if(!point)return;
    this.pos.set(point.x,heightAt(point.x,point.z),point.z);
    this.safeFooting.x=point.x;this.safeFooting.z=point.z;
    this.vel.set(0,0,0);this.speed=this.lean=0;
    this.recovery.reset(point);
    this.setMessage('DRIVE RELEASED');
  }

  /** World-space velocity of the player's vehicle, used for enemy lead prediction. */
  private playerVelocity(out: THREE.Vector3) {
    if (this.controls === 'arcade') return out.copy(this.vel);
    return fwd(this.hullYaw, out).multiplyScalar(this.speed);
  }

  private collideCircle(pos: THREE.Vector3, radius: number, flightFloor = -Infinity) {
    let hit = false;
    for (const o of nearObstacles(pos.x, pos.z, radius + 1)) if (o.y0 + o.h >= flightFloor && obsResolve(o, pos, radius)) hit = true;
    const dc = Math.hypot(pos.x, pos.z);
    const maxR = this.arenaR - radius - 1.8;
    if (dc > maxR) {
      pos.x *= maxR / dc;
      pos.z *= maxR / dc;
      hit = true;
    }
    return hit;
  }

  private updateWeapons(dt: number) {
    const c = this.cfg;
    const rapid = this.buffT.rapid > 0;
    const noHeat = rapid || (this.buffT.overdrive > 0 && this.evolved('overdrive'));
    const rate = (this.buffT.haste > 0 || this.buffT.overdrive > 0 ? 1.3 : 1) * (rapid ? 1.35 : 1);
    this.cannonCd = Math.max(0, this.cannonCd - dt * rate);
    this.primaryCd = Math.max(0, this.primaryCd - dt * rate);
    this.mgTimer -= dt * rate;
    this.mgBurstPauseTimer = Math.max(0, this.mgBurstPauseTimer - dt * rate);
    this.secCd = Math.max(0, this.secCd - dt);
    this.beamCd = Math.max(0, this.beamCd - dt);
    const priHeld = this.mouse.left || this.keys.has('Space') || this.padFire.primary;
    const secHeld = this.mouse.right || this.keys.has('KeyC') || this.keys.has('ControlLeft') || this.keys.has('ControlRight') || this.padFire.secondary;
    if (priHeld && !this.mgOverheat && c.loadout.primary) {
      if (c.loadout.primary === 'scatter') {
        if (this.primaryCd <= 0 && this.spendPower(c.loadout.primary)) {
          this.fireScatter();
        }
      } else {
        // Primary automatic burst: 3 continuous shots, delay, another 3 continuous shots
        if (this.mgBurstPauseTimer <= 0) {
          if (this.mgBurstRemaining <= 0) {
            this.mgBurstRemaining = 3;
          }
          if (this.mgTimer <= 0) {
            if (this.spendPower(c.loadout.primary)) {
              this.firePrimaryBullets();
              this.mgBurstRemaining--;
              this.mgTimer = c.mgInterval * this.stats.reloadMul;
              if (this.mgBurstRemaining <= 0) {
                // Inter-burst pause / delay between 3-round bursts
                this.mgBurstPauseTimer = 0.26 * this.stats.reloadMul;
              }
              if (!noHeat) this.mgHeat = Math.min(1, this.mgHeat + c.mgHeatPerShot * this.stats.mgHeatMul);
              if (this.mgHeat >= 1) this.mgOverheat = true;
            } else {
              this.mgBurstRemaining = 0;
            }
          }
        }
      }
    } else {
      if (this.mgBurstRemaining <= 0) {
        this.mgBurstPauseTimer = 0;
      }
    }
    // Cooling happens only after releasing the trigger, or during a full overheat.
    if (!priHeld || this.mgOverheat) {
      this.mgHeat = Math.max(0, this.mgHeat - dt * this.condition.cooling * (this.mgOverheat ? 0.3 : 0.5));
      if (this.mgOverheat && this.mgHeat <= 0.15) this.mgOverheat = false;
    }
    // Secondary weapon auto-fires continuously with proper gap as long as held & powered
    if (c.loadout.secondary === 'cannon') {
      if (secHeld && this.cannonCd <= 0 && this.spendPower(c.loadout.secondary)) this.fireCannon();
    } else if (c.loadout.secondary === 'cryoball') {
      if (secHeld && this.secCd <= 0 && this.spendPower(c.loadout.secondary)) this.throwCryoBall();
    } else if (c.loadout.secondary === 'emp') {
      if (secHeld && this.secCd <= 0 && this.spendPower(c.loadout.secondary)) this.fireEmp();
    } else if (c.loadout.secondary && secHeld && !this.secOverheat && this.beamCd <= 0 && this.spendPower(c.loadout.secondary)) {
      this.fireBeam(this.cfg.loadout.secondary === 'flame' ? 'flame' : 'cryo');
      this.beamCd = this.cfg.beamInterval;
      if (!noHeat) this.secHeat = Math.min(1, this.secHeat + 0.035 * this.stats.mgHeatMul);
      if (this.secHeat >= 1) this.secOverheat = true;
    }
    if (!secHeld || this.secOverheat) {
      this.secHeat = Math.max(0, this.secHeat - dt * this.condition.cooling * (this.secOverheat ? 0.28 : 0.45));
      if (this.secOverheat && this.secHeat <= 0.15) this.secOverheat = false;
    }
    this.recoil *= Math.exp(-dt * 9);
    for (let i = 0; i < 2; i++) {
      const springK = 140;
      const damping = 18;
      const force = -springK * this.armRecoil[i] - damping * this.armRecoilVel[i];
      this.armRecoilVel[i] += force * dt;
      this.armRecoil[i] += this.armRecoilVel[i] * dt;
      if (this.armRecoil[i] < 0) {
        this.armRecoil[i] = 0;
        this.armRecoilVel[i] = 0;
      }
    }
    this.recoilPitch *= Math.exp(-dt * 8);
    const speedRatio = Math.max(-0.5, Math.min(1.2, this.speed / Math.max(1, this.cfg.maxSpeed)));
    const targetFov = this.zoom ? 32 : (this.settings.fov + speedRatio * 3.5);
    if (Math.abs(targetFov - this.fovCurrent) > 0.05) {
      this.fovCurrent += (targetFov - this.fovCurrent) * Math.min(1, dt * 10);
      this.camera.fov = this.fovCurrent;
      this.camera.updateProjectionMatrix();
    }
  }

  private evolved(weapon: WeaponId) { return this.taken.has(`evo_${weapon}`); }

  /**
   * Spend reactor energy for a weapon activation.
   *
   * The reactor refills the buffer slowly; a hungry loadout can empty it,
   * and a dry grid means the guns simply do not fire.
   */
  private energyCost(weapon:WeaponId) {
    const socket=socketForWeapon(weapon,this.cfg.loadout);
    return socket ? this.cfg.powerCost[socket] : 0;
  }

  private spendPower(weapon: WeaponId): boolean {
    const cost = this.energyCost(weapon);
    if (cost <= 0) return true;
    if (this.power < cost) {
      if (this.powerWarnCd <= 0) {
        this.powerWarnCd = 2.5;
        this.addFeed(`${WEAPON_INFO[weapon].short} NEEDS ${cost} kJ · REACTOR CHARGING`);
      }
      return false;
    }
    this.power -= cost;
    return true;
  }

  /** First solid point on a weapon ray, sampling both terrain and cover. */
  private traceCover(origin: THREE.Vector3, direction: THREE.Vector3, range: number) {
    for (let d = 1.5; d <= range; d += 1.5) {
      const x = origin.x + direction.x * d;
      const y = origin.y + direction.y * d;
      const z = origin.z + direction.z * d;
      if (heightAt(x, z) > y) return Math.max(0, d - 1.5);
      for (const o of nearObstacles(x, z, 1)) {
        if (y >= o.y0 && y < o.y0 + o.h && obsDist(o, x, z) < 0) return Math.max(0, d - 1.5);
      }
    }
    return range;
  }

  /**
   * Dynamically converge projectile trajectory toward the 3D point the player is aiming at.
   * If an enemy or obstacle is within the crosshair reticle cone, weapons converge exactly on it.
   * For point-blank targets where the target is closer than or at the muzzle plane,
   * flags pointBlank so the bullet spawns from the cockpit sightline and hits immediately.
   */
  private getAimConvergence(range: number, muzzleWorldPos?: THREE.Vector3) {
    this.camera.updateMatrixWorld();
    const origin = this.camera.position.clone();
    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    const coverDist = this.traceCover(origin, dir, range);
    const slope = sightSlope(this.camera.fov, this.canvas?.clientHeight ?? 720);

    let bestEnemy: Enemy | null = null;
    let bestDist = Math.min(range, coverDist);
    let bestScore = -Infinity;

    for (const e of this.enemies) {
      if (!e.alive) continue;
      const center = this.enemyCenter(e);
      const delta = center.clone().sub(origin);
      const along = delta.dot(dir);
      if (along <= 0.1 || along > bestDist + e.radius) continue;

      const perpDistSq = delta.lengthSq() - along * along;
      const coneRadius = e.radius + Math.max(0.6, along * slope);
      if (perpDistSq > coneRadius * coneRadius) continue;
      if (!this.hasLOS(origin, e.pos, 0, e.height * 0.5)) continue;

      const perpDist = Math.sqrt(Math.max(0, perpDistSq));
      const score = -perpDist * 3 - along * 0.02;
      if (score > bestScore) {
        bestScore = score;
        bestEnemy = e;
        bestDist = along;
      }
    }

    let target: THREE.Vector3;
    let distance: number;
    if (bestEnemy) {
      target = this.enemyCenter(bestEnemy);
      distance = bestDist;
    } else {
      distance = Math.min(range, coverDist);
      target = origin.clone().addScaledVector(dir, distance);
      if (this.explosiveBarrels) {
        for (const barrel of this.explosiveBarrels) {
          if (barrel.destroyed) continue;
          const delta = barrel.pos.clone().sub(origin);
          const along = delta.dot(dir);
          if (along <= 0.1 || along > distance + 1.2) continue;
          const perpDistSq = delta.lengthSq() - along * along;
          const coneRadius = 1.2 + Math.max(0.4, along * slope);
          if (perpDistSq > coneRadius * coneRadius) continue;
          target = barrel.pos.clone().add(new THREE.Vector3(0, 0.6, 0));
          distance = along;
          break;
        }
      }
    }

    let pointBlank = false;
    if (muzzleWorldPos) {
      const muzzleForwardDist = muzzleWorldPos.clone().sub(origin).dot(dir);
      if (distance <= muzzleForwardDist + 0.8) {
        pointBlank = true;
      }
    }

    return { target, enemy: bestEnemy, distance, pointBlank, dir, origin };
  }

  /** Mark the visible point under the sight, in either control mode. */
  private orbitalTarget() {
    this.camera.updateMatrixWorld();
    const origin = this.camera.position.clone();
    const direction = this.camera.getWorldDirection(new THREE.Vector3());
    const coverDistance = this.traceCover(origin, direction, ORBITAL.range);
    const slope = sightSlope(this.camera.fov, this.canvas.clientHeight);
    let nearest: Enemy | null = null;
    let nearestAlong = Infinity;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const relative = this.enemyCenter(enemy).sub(origin);
      const along = relative.dot(direction);
      if (along <= 0 || along > coverDistance + enemy.radius || along > ORBITAL.range || along >= nearestAlong) {
        continue;
      }
      const tolerance = enemy.radius + along * slope;
      if (relative.lengthSq() - along * along > tolerance * tolerance) continue;
      if (!this.hasLOS(origin, enemy.pos, 0, enemy.height * 0.5)) continue;
      nearest = enemy;
      nearestAlong = along;
    }
    const target = nearest
      ? new THREE.Vector3(nearest.pos.x, 0, nearest.pos.z)
      : origin.clone().addScaledVector(direction, coverDistance);
    const distance = Math.hypot(target.x, target.z);
    if (distance > this.arenaR - 6) {
      target.x *= (this.arenaR - 6) / distance;
      target.z *= (this.arenaR - 6) / distance;
    }
    target.y = heightAt(target.x, target.z);
    return target;
  }

  private linkTarget(from: THREE.Vector3, excluded: Set<Enemy>, range: number) {
    let best: Enemy | null = null;
    let distance = range;
    for (const e of this.enemies) {
      if (!e.alive || excluded.has(e)) continue;
      const d = from.distanceTo(e.pos);
      if (d < distance && this.hasLOS(from, e.pos, 0, e.height * 0.5)) { best = e; distance = d; }
    }
    return best;
  }

  private enemyCenter(e: Enemy) { return new THREE.Vector3(e.pos.x, e.pos.y + e.height * 0.5, e.pos.z); }

  private assistTarget(from: THREE.Vector3, dir: THREE.Vector3, range = 240): Enemy | null {
    if (this.controls !== 'arcade') return null;
    let best: Enemy | null = null;
    let bestScore = -Infinity;
    const slope = sightSlope(this.camera.fov, this.canvas?.clientHeight ?? 720);
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const v = this.tmpA.set(e.pos.x - from.x, e.pos.y + e.height * 0.5 - from.y, e.pos.z - from.z);
      const d = v.length();
      if (d - e.radius > range || d < 0.2) continue;
      const cos = v.divideScalar(d).dot(dir);
      const ang = Math.acos(clamp(cos, -1, 1));
      const tol = Math.max((0.045 + e.radius * 0.01) * this.aimAssist, Math.atan(slope) + e.radius / Math.max(1, d));
      if (ang > tol || !this.hasLOS(from, e.pos, 0, e.height * 0.5)) continue;
      const score = -ang * 3 - d * 0.004;
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  /** Automatically moves aim crosshair elevation (pitch up/down) to track targeted enemies. */
  private updatePitchAssist(dt: number) {
    if (!this.settings.pitchAssist || !this.alive || !this.enemies.length) return;

    const camPos = this.camera.position;
    const forwardX = Math.sin(this.turretYaw);
    const forwardZ = Math.cos(this.turretYaw);

    let bestEnemy: Enemy | null = null;
    let bestScore = -Infinity;

    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.pos.x - camPos.x;
      const dz = e.pos.z - camPos.z;
      const distH = Math.hypot(dx, dz);
      if (distH < 1.5 || distH > 240) continue;

      const nx = dx / distH;
      const nz = dz / distH;
      const dotH = nx * forwardX + nz * forwardZ;
      if (dotH < 0.4) continue;

      if (!this.hasLOS(camPos, e.pos, 0, (e.height ?? 3) * 0.5)) continue;

      const score = dotH * 120 - distH * 0.35;
      if (score > bestScore) {
        bestScore = score;
        bestEnemy = e;
      }
    }

    if (bestEnemy) {
      const dx = bestEnemy.pos.x - camPos.x;
      const dz = bestEnemy.pos.z - camPos.z;
      const distH = Math.hypot(dx, dz);
      const targetY = bestEnemy.pos.y + (bestEnemy.height ?? 3) * 0.52;
      const dy = targetY - camPos.y;
      const targetPitch = clamp(Math.atan2(dy, distH), -0.28, 0.38);

      const trackSpeed = this.zoom ? 12.0 : 8.5;
      this.pitch += (targetPitch - this.pitch) * Math.min(1.0, dt * trackSpeed);
    }
  }

  private muzzleLocal(slot: 'primary' | 'secondary' | 'utility') {
    // Mechanical hardpoints share the camera's local space, including recoil.
    if(slot==='utility') return this.tmpD.set(0.85,-0.65,-2.6);
    const arm=this.arms[slot==='primary'?0:1];
    arm.root.updateMatrix();
    return this.tmpD.copy(arm.tip.position).applyMatrix4(arm.root.matrix);
  }

  /** Debug helper: move the player (automated screenshots). */
  debugTeleport(x: number, z: number, yaw: number, pitch = 0) {
    this.pos.set(x, heightAt(x, z), z);
    this.vel.set(0, 0, 0);
    this.turretYaw = this.hullYaw = yaw;
    this.pitch = pitch;
  }

  /** Debug helper: force a perimeter expansion (automated tests). */
  debugExpand() {
    this.expandPerimeter();
  }

  /** Debug helper: sector info for automated tests. */
  debugWorld() {
    return {
      seed: this.seedCode,
      theme: this.layout.theme.name,
      districts: this.layout.districts.map((d) => `${d.type}:${d.name}`),
      obstacles: this.obstacles.length,
      barrels: this.explosiveBarrels.length,
      arenaR: this.arenaR,
      arenaTarget: this.arenaTarget,
      zone: this.zone,
      roads: this.layout.roads.length,
      buildMs: Math.round(this.buildMs),
    };
  }

  /** Debug helper: enemy list, for automated tests. */
  debugEnemies() {
    return this.enemies.map((e) => ({ kind: e.kind, hp: e.hp, maxHp: e.maxHp, alive: e.alive, dist: Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z) }));
  }

  /** Debug helper: snapshot of player transform, for automated tests. */
  debugState() {
    return {
      x: this.pos.x,
      z: this.pos.z,
      hullYaw: this.hullYaw,
      turretYaw: this.turretYaw,
      speed: this.speed,
      velX: this.vel.x,
      velZ: this.vel.z,
      lean: this.lean,
      controls: this.controls,
      alive: this.alive,
      enemies: this.enemies.length,
    };
  }

  /** Debug helper: apply damage to the player (used by automated smoke tests). */
  debugDamage(amount: number) {
    const from = new THREE.Vector3(this.pos.x + 20, 0, this.pos.z + 20);
    this.damagePlayer(amount, from);
  }

  /** Extra shot dispersion comes from actual movement, including arcade strafing. */
  private movementSpread(base: number, stability: number) {
    const speed = this.controls === 'arcade' ? this.vel.length() : Math.abs(this.speed);
    return projectileSpread(base, speed, this.cfg.maxSpeed, stability, this.cfg.driveStability);
  }

  private fireCannon() {
    const c = this.cfg;
    this.shotCounter++;
    const over = this.stats.overcharge > 0 && this.shotCounter % 5 === 0;
    this.cannonCd = c.cannonReload * this.stats.reloadMul;
    this.camera.updateMatrixWorld();
    const muzzle = this.camera.localToWorld(this.muzzleLocal('secondary').clone());
    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    const convergence = this.getAimConvergence(c.secondaryRange, muzzle);
    const spawnOrigin = convergence.pointBlank
      ? this.camera.position.clone().addScaledVector(dir, 0.4)
      : muzzle;
    const spread = this.movementSpread(0.003, c.secondaryStability) * (convergence.pointBlank ? 0.15 : 1);
    const vel = convergence.target.clone().sub(spawnOrigin).normalize();
    vel.add(new THREE.Vector3(rand(-spread, spread), rand(-spread, spread), rand(-spread, spread))).normalize().multiplyScalar(c.shellSpeed);
    const assist = convergence.enemy ?? this.assistTarget(this.camera.position, dir, c.secondaryRange);
    this.spawnProjectile(
      'player', 'shell', spawnOrigin, vel,
      c.cannonDamage * this.stats.cannonDmgMul * (over ? 2 : 1),
      c.splash * this.stats.splashMul * (over ? 1.6 : 1),
      this.shellDrop, 6, assist ? 2.2 * this.aimAssist : 0, assist,
    );
    const shell = this.projectiles[this.projectiles.length - 1];
    shell.weapon = 'cannon';
    shell.rangeLeft = c.secondaryRange;
    this.armRecoil[1] = 1;
    (this.armRecoilVel ??= [0, 0])[1] = -14;
    this.recoilPitch += 0.015;
    this.shake = Math.max(this.shake, over ? 0.22 : 0.08);
    this.muzzleLight.position.copy(this.muzzleLocal('secondary'));
    this.muzzleLight.intensity = over ? 720 : 420;
    this.muzzleFlash(muzzle, dir, over ? 1.7 : 1);
    this.weaponFx?.shockwave?.(this.pos, over ? 9.0 : 6.0, over ? 0xffbb44 : 0xff9933, 0.38);
    this.dust(this.pos, over ? 1.4 : 0.9);
    this.audio.playCannon();
    if (over) {
      this.audio.playCrit();
      this.addFeed('OVERCHARGED ROUND  ×2 DAMAGE');
    }
    this.makeNoise(120);

  }

  /** Rapid-fire primaries: autocannons (warden) and coil repeater (glacier). */
  private firePrimaryBullets() {
    const c = this.cfg;
    const coil = c.loadout.primary === 'coil';
    this.primaryShots++;
    this.camera.updateMatrixWorld();
    const muzzle = this.camera.localToWorld(this.muzzleLocal('primary').clone());
    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    const convergence = this.getAimConvergence(c.primaryRange, muzzle);
    const spawnOrigin = convergence.pointBlank
      ? this.camera.position.clone().addScaledVector(dir, 0.4)
      : muzzle;
    const vel = convergence.target.clone().sub(spawnOrigin).normalize();
    const spread = this.movementSpread(coil ? 0.003 : 0.009, c.primaryStability) * (convergence.pointBlank ? 0.15 : 1);
    vel.add(new THREE.Vector3(rand(-spread, spread), rand(-spread, spread), rand(-spread, spread))).normalize().multiplyScalar(coil ? 340 : 270);
    const assist = convergence.enemy ?? this.assistTarget(this.camera.position, dir, c.primaryRange);
    this.spawnProjectile('player', 'bullet', spawnOrigin, vel, c.mgDamage * this.stats.mgDmgMul, 0, 0, 3, assist ? 2.5 * this.aimAssist : 0, assist);
    const shot = this.projectiles[this.projectiles.length - 1];
    shot.rangeLeft = c.primaryRange;
    if (c.loadout.primary) shot.weapon = c.loadout.primary;
    shot.charged = !coil && this.evolved('autocannon') && this.primaryShots % 6 === 0;
    (shot.mesh as THREE.Mesh).material = coil || shot.charged ? this.mats.playerRocket : this.mats.bullet;
    if (coil) (shot.mesh as THREE.Mesh).scale.set(0.7, 0.7, 1.8);
    this.muzzleLight.position.copy(this.muzzleLocal('primary'));
    this.muzzleLight.intensity = coil ? 100 : 75;
    this.muzzleFlash(muzzle, dir, 0.3);
    this.armRecoil[0] = coil ? .45 : .7;
    (this.armRecoilVel ??= [0, 0])[0] = coil ? -7 : -10;
    this.recoilPitch += 0.001;
    this.audio.playMG(coil ? 'coil' : 'autocannon');
    this.mgNoiseTimer -= c.mgInterval;
    if (this.mgNoiseTimer <= 0) { this.mgNoiseTimer = 0.5; this.makeNoise(70); }

  }

  private fireScatter() {
    const c = this.cfg;
    this.shotCounter++;
    const over = this.stats.overcharge > 0 && this.shotCounter % 5 === 0;
    this.primaryCd = c.scatterReload * this.stats.reloadMul;
    this.camera.updateMatrixWorld();
    const muzzle = this.camera.localToWorld(this.muzzleLocal('primary').clone());
    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    const convergence = this.getAimConvergence(c.primaryRange, muzzle);
    const spawnOrigin = convergence.pointBlank
      ? this.camera.position.clone().addScaledVector(dir, 0.4)
      : muzzle;
    const center = convergence.target.clone().sub(spawnOrigin).normalize();
    const spread = this.movementSpread(c.scatterSpread, c.primaryStability);
    for (let i = 0; i < 6; i++) {
      const v = center.clone();
      v.x += rand(-spread, spread);
      v.y += rand(-spread * 0.7, spread * 0.7);
      v.z += rand(-spread, spread);
      v.normalize().multiplyScalar(c.scatterSpeed * rand(0.9, 1.1));
      this.spawnProjectile(
        'player', 'shell', spawnOrigin, v,
        c.scatterDamage * this.stats.cannonDmgMul * (over ? 2 : 1),
        c.scatterSplash * this.stats.splashMul * (over ? 1.6 : 1), this.shellDrop, 3, 0,
      );
      const pellet = this.projectiles[this.projectiles.length - 1];
      pellet.weapon = 'scatter';
      pellet.rangeLeft = c.primaryRange;
    }
    this.armRecoil[0] = 1;
    (this.armRecoilVel ??= [0, 0])[0] = -16;
    this.recoilPitch += 0.035;
    this.shake = Math.max(this.shake, over ? 0.24 : 0.16);
    this.muzzleLight.position.copy(this.muzzleLocal('primary'));
    this.muzzleLight.intensity = over ? 720 : 500;
    this.muzzleFlash(muzzle, dir, over ? 1.7 : 1.2);
    this.weaponFx?.shockwave?.(this.pos, over ? 7.5 : 5.0, 0xffa544, 0.32);
    this.dust(this.pos, over ? 1.2 : 0.7);
    this.audio.playScatter();
    if (over) {
      this.audio.playCrit();
      this.addFeed('OVERCHARGED SPREAD  ×2 DAMAGE');
    }
    this.makeNoise(120);
  }

  /** Direct, sound-free damage for beam ticks (the beam loops carry the feedback). */
  private get firepower() { return this.buffT.overcharge > 0 ? SALVAGE.firepower : 1; }
  /** LAST CIRCUIT: a dying machine fights harder. Applied at the damage site. */
  private lastStandMul() {
    return this.stats.lastStand > 0 && this.hp > 0 && this.hp < this.maxHp * 0.35 ? 1 + 0.35 * this.stats.lastStand : 1;
  }

  private beamHit(e: Enemy, dmg: number) {
    if (!e.alive) return;
    let wasCrit = false;
    if (this.stats.critChance > 0 && Math.random() < this.stats.critChance) {
      dmg *= 2;
      wasCrit = true;
      this.critTime = this.time;
    }
    dmg *= this.lastStandMul();
    if (e.brittleTime > 0) dmg *= 1.25;
    const dealt = dmg * this.firepower;
    e.hp -= dealt;
    this.floaters.addDamage(e, this.floaterAnchor.set(e.pos.x, e.pos.y + e.height * 0.65, e.pos.z), dealt, wasCrit);
    e.hitFlash = 1;
    this.hitMarkerTime = this.time;
    this.alertUnit(e, 4);
    if (e.hp <= 0) this.killEnemy(e);
  }

  /** Hold-to-fire secondaries: flamethrower (pyre) and cryo lance (glacier). */
  private fireBeam(kind: 'flame' | 'cryo', discrete = false) {
    const flame = kind === 'flame';
    const c = this.cfg;
    this.camera.updateMatrixWorld();
    const muzzle = this.camera.localToWorld(this.muzzleLocal('secondary').clone());
    const origin = this.camera.position.clone();
    const direction = this.camera.getWorldDirection(new THREE.Vector3());
    const range = discrete ? 95 : c.secondaryRange + (flame ? (this.stats.flameDmgMul - 1) * 5 : 0);
    const coverDistance = this.traceCover(origin, direction, range);
    const hits = this.enemies.filter((enemy) => {
      if (!enemy.alive) return false;
      const delta = this.enemyCenter(enemy).sub(origin);
      const along = delta.dot(direction);
      if (along < 0 || along > coverDistance + enemy.radius) return false;
      const tolerance = enemy.radius + along * (flame ? 0.16 : 0.018);
      if (delta.lengthSq() - along * along > tolerance * tolerance) return false;
      return this.hasLOS(origin, enemy.pos, 0, enemy.height * 0.5);
    }).sort((a, b) => origin.distanceToSquared(a.pos) - origin.distanceToSquared(b.pos));
    const beamEnd = origin.clone().addScaledVector(direction, coverDistance);
    if (!flame && hits[0]) beamEnd.copy(this.enemyCenter(hits[0]));
    for (const enemy of flame ? hits : hits.slice(0, 1)) {
      if (flame) {
        this.beamHit(enemy, c.flameDamage * this.stats.flameDmgMul);
        enemy.burnTime = 2.5;
        enemy.burnDps = c.flameDamage * 0.9 * this.stats.flameDmgMul;
      } else {
        // The hardpoint lance is a single decisive shot; the handheld one ticks.
        this.beamHit(enemy, (discrete ? c.cryoGrenadeDamage : c.cryoDamage) * this.stats.cryoDmgMul);
        enemy.slowTime = Math.max(enemy.slowTime, (discrete ? 4.5 : c.cryoSlowTime) * this.stats.cryoSlowMul);
        if (this.evolved('cryo') && enemy.freezeLock <= 0) {
          enemy.cryoCharge += discrete ? 2 : 1;
          if (enemy.cryoCharge >= 10) {
            enemy.stunTime = Math.max(enemy.stunTime, enemy.boss ? 0.65 : 1.8);
            enemy.freezeLock = 4;
            enemy.cryoCharge = 0;
            this.addFeed('GLACIAL LOCK - TARGET FROZEN');
          }
        }
      }
      this.elementBurst(this.enemyCenter(enemy), flame ? 'fire' : 'ice', discrete ? 12 : 3);
    }
    const visualRange = Math.min(range, coverDistance);
    if (flame) {
      // Fast-moving particles extend the visible flame to its actual damage range.
      for (let i = 0; i < 10; i++) {
        const progress = Math.random();
        const point = muzzle.clone().lerp(origin.clone().addScaledVector(direction, visualRange), progress);
        const spread = progress * 1.8;
        this.fire.emit({
          x: point.x + rand(-spread, spread), y: point.y + rand(-spread * 0.5, spread), z: point.z + rand(-spread, spread),
          vx: direction.x * 24, vy: direction.y * 24 + 1.4, vz: direction.z * 24,
          life: rand(0.14, 0.28), size0: 0.5 + progress * 2, size1: 0.2,
          c0: [1, 0.65, 0.18], c1: [1, 0.16, 0.02], grav: -1, drag: 2, alpha: 0.85,
        });
      }
      this.audio.playFlame();
    } else {
      this.weaponFx.beam(muzzle, beamEnd, 0x8de3ff, discrete ? 0.085 : 0.045, discrete ? 0.24 : 0.14);
      this.elementBurst(beamEnd, 'ice', discrete ? 14 : 5);
      this.audio.playCryo();
    }
    this.muzzleLight.position.copy(this.muzzleLocal('secondary'));
    this.muzzleLight.intensity = flame ? 160 : discrete ? 320 : 110;
    this.armRecoil[1] = flame ? .25 : .16;
    (this.armRecoilVel ??= [0, 0])[1] = -4;
    this.makeNoise(55);
  }

  private elementBurst(point: THREE.Vector3, type: 'fire' | 'ice' | 'electric', count = 12) {
    const c0: [number, number, number] = type === 'fire' ? [1, 0.65, 0.2] : type === 'ice' ? [0.7, 0.9, 1] : [0.85, 1, 1];
    const c1: [number, number, number] = type === 'fire' ? [1, 0.2, 0.03] : [0.2, 0.6, 1];
    for (let i = 0; i < count; i++) this.fire.emit({
      x: point.x, y: point.y, z: point.z,
      vx: rand(-8, 8), vy: rand(-2, 9), vz: rand(-8, 8),
      life: rand(0.15, 0.4), size0: type === 'electric' ? 0.38 : 0.55, size1: 0.04,
      c0, c1, grav: 3, drag: 2, alpha: 0.95,
    });
  }

  // Vehicle-specific weapons and automatic shields


  // ---------------------------------------------------------------------------
  // Short, aimed arc: the canister travels through the world and bursts on first contact.
  private launchCanister() {
    this.camera.updateMatrixWorld();
    const muzzle = this.camera.localToWorld(this.muzzleLocal('utility').clone());
    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    const velocity = dir.clone().multiplyScalar(34);
    velocity.y += 9;
    const radius = (8 + 1.8 * (this.taken.get('cinder_charge') ?? 0)) * (this.evolved('cinder') ? 1.35 : 1);
    this.spawnProjectile('player', 'shell', muzzle, velocity, 48, radius, 21, 5, 0);
    const shell = this.projectiles[this.projectiles.length - 1];
    shell.weapon = 'cinder'; shell.mesh.scale.setScalar(1.8);
    this.audio.playMortar(); this.muzzleFlash(muzzle,dir,0.65);this.makeNoise(90);
    this.addFeed('CINDER CANISTER AWAY');
  }

  private makeMine(x: number, z: number) {
    const y = heightAt(x, z);
    const group = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x25282c, roughness: 0.65, metalness: 0.5 });
    const trim = new THREE.MeshStandardMaterial({ color: 0xff6b2a, emissive: 0xff5e22, emissiveIntensity: 2.4, roughness: 0.4 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.25, 12), metal);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.78, 0.42, 12), metal);
    body.position.y = 0.3;
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), trim);
    core.position.y = 0.56;
    group.add(base, body, core);
    group.position.set(x, y, z);
    setShadows(group);
    this.scene.add(group);
    this.mines.push({ group, pos: new THREE.Vector3(x, y, z), arm: 0.7, life: 26, core });
    this.audio.playMine();
  }

  private deployMines() {
    const count = 2 + (this.taken.get('mine_stock') ?? 0) + (this.evolved('mines') ? 1 : 0);
    const maxActive = 6 + 2 * (this.taken.get('mine_stock') ?? 0);
    while (this.mines.length + count > maxActive) {
      const oldest = this.mines.shift();
      if (oldest) this.removeMine(oldest, false);
    }
    for (let i = 0; i < count; i++) {
      const angle = this.turretYaw + Math.PI + (i - (count - 1) / 2) * 0.5;
      let x = this.pos.x + Math.sin(angle) * 4.5;
      let z = this.pos.z + Math.cos(angle) * 4.5;
      const dc = Math.hypot(x, z);
      if (dc > this.arenaR - 4) { x *= (this.arenaR - 4) / dc; z *= (this.arenaR - 4) / dc; }
      if (nearObstacles(x, z, 2).some((o) => obsDist(o, x, z) < 1.4)) { x = this.pos.x; z = this.pos.z; }
      this.makeMine(x, z);
    }
    this.makeNoise(50);
    this.addFeed(`CINDER MINES ARMED - ${this.mines.length} ACTIVE`);
  }

  private removeMine(mine: Mine, detonate: boolean) {
    this.scene.remove(mine.group);
    mine.group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    });
    const index = this.mines.indexOf(mine);
    if (index >= 0) this.mines.splice(index, 1);
    if (detonate) {
      const radius = (7.5 + 1.6 * (this.taken.get('mine_stock') ?? 0)) * (this.evolved('mines') ? 1.5 : 1);
      const center = mine.pos.clone().add(new THREE.Vector3(0, 0.7, 0));
      this.explosion(center, 1.5);
      this.audio.playExplosion(center.distanceTo(this.pos), true, this.panFor(center.x, center.z));
      this.flashLight(center, 120);
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        const distance = enemy.pos.distanceTo(mine.pos) - enemy.radius;
        if (distance < radius) {
          this.damageEnemy(enemy, 70 * (1 - Math.max(0, distance) / radius * 0.5));
          if (this.evolved('mines')) { enemy.burnTime = Math.max(enemy.burnTime, 2.5); enemy.burnDps = Math.max(enemy.burnDps, 7); }
        }
      }
      if (this.evolved('mines')) this.addBurn(center, 6, 6);
      this.shake = Math.max(this.shake, 0.14);
    }
  }

  private updateMines(dt: number) {
    for (let i = this.mines.length - 1; i >= 0; i--) {
      const mine = this.mines[i];
      mine.arm -= dt;
      mine.life -= dt;
      (mine.core.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.65 + Math.sin(this.time * 12 + mine.pos.x) * 0.5;
      if (mine.life <= 0) { this.removeMine(mine, false); continue; }
      if (mine.arm > 0) continue;
      for (const enemy of this.enemies) {
        if (enemy.alive && Math.hypot(enemy.pos.x - mine.pos.x, enemy.pos.z - mine.pos.z) < enemy.radius + 3.2) {
          this.removeMine(mine, true);
          break;
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Glacier sniper kit: Cryo Grenade and Veil Smoke
  // ---------------------------------------------------------------------------
  private get cryoCooldown() {
    return this.cfg.cryoGrenadeReload * (1 - 0.12 * (this.taken.get('ice_capacity') ?? 0)) * this.stats.reloadMul;
  }

  /** A precise, low-damage disruption bolt; a direct hit is required. */
  private fireEmp() {
    const c = this.cfg;
    this.camera.updateMatrixWorld();
    const muzzle = this.camera.localToWorld(this.muzzleLocal('secondary').clone());
    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    const convergence = this.getAimConvergence(c.secondaryRange, muzzle);
    const spawnOrigin = convergence.pointBlank
      ? this.camera.position.clone().addScaledVector(dir, 0.4)
      : muzzle;
    const spread = this.movementSpread(0.004, c.secondaryStability) * (convergence.pointBlank ? 0.15 : 1);
    const vel = convergence.target.clone().sub(spawnOrigin).normalize();
    vel.add(new THREE.Vector3(rand(-spread, spread), rand(-spread, spread), rand(-spread, spread))).normalize().multiplyScalar(230);
    const assist = convergence.enemy ?? this.assistTarget(this.camera.position, dir, c.secondaryRange);
    this.spawnProjectile('player', 'bullet', spawnOrigin, vel, c.empDamage, 0, 0, 3, assist ? 2.2 * this.aimAssist : 0, assist);
    const pulse = this.projectiles[this.projectiles.length - 1];
    pulse.weapon = 'emp';
    pulse.rangeLeft = c.secondaryRange;
    (pulse.mesh as THREE.Mesh).material = this.mats.playerRocket;
    pulse.mesh.scale.set(1.5, 1.5, 1.5);
    this.secCd = c.empReload * this.stats.reloadMul;
    this.secCdMax = this.secCd;
    this.armRecoil[1] = 0.55;
    (this.armRecoilVel ??= [0, 0])[1] = -8;
    this.muzzleLight.position.copy(this.muzzleLocal('secondary'));
    this.muzzleLight.intensity = 200;
    this.muzzleFlash(muzzle, dir, 0.45);
    this.audio.playEmp();
    this.makeNoise(65);
  }

  private throwCryoBall() {
    this.camera.updateMatrixWorld();
    const muzzle = this.camera.localToWorld(this.muzzleLocal('secondary').clone());
    const direction = this.camera.getWorldDirection(new THREE.Vector3());
    const convergence = this.getAimConvergence(this.cfg.secondaryRange, muzzle);
    const spawnOrigin = convergence.pointBlank
      ? this.camera.position.clone().addScaledVector(direction, 0.4)
      : muzzle;
    const target = convergence.target.clone();
    target.y = heightAt(target.x, target.z);
    const flight = 0.8;
    const gravity = 18;
    const velocity = target.sub(spawnOrigin).divideScalar(flight);
    velocity.y += 0.5 * gravity * flight;
    this.spawnProjectile('player', 'rocket', spawnOrigin, velocity, 0, 0, gravity, 3.5, 0);
    const ball = this.projectiles[this.projectiles.length - 1];
    ball.weapon = 'cryoball';
    ball.rangeLeft = this.cfg.secondaryRange;
    const mesh = ball.mesh as THREE.Mesh;
    mesh.material = this.mats.playerRocket;
    mesh.scale.setScalar(1.35);
    this.armRecoil[1] = .8;
    (this.armRecoilVel ??= [0, 0])[1] = -12;
    this.secCd = this.cryoCooldown;
    this.secCdMax = this.cryoCooldown;
    this.muzzleFlash(muzzle, direction, 0.45);
    this.audio.playCryo();
    this.makeNoise(60);
    this.addFeed('CRYO GRENADE AWAY');
  }

  private frostBurst(pos: THREE.Vector3) {
    const evolved = this.evolved('cryoball');
    const radius = 9 * (1 + 0.2 * (this.taken.get('ice_capacity') ?? 0)) * (evolved ? 1.15 : 1);
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      if (enemy.pos.distanceTo(pos) > radius + enemy.radius) continue;
      this.beamHit(enemy, this.cfg.cryoGrenadeDamage * this.stats.cryoDmgMul);
      enemy.stunTime = Math.max(enemy.stunTime, enemy.boss ? 0.4 : 1.4 + (evolved ? 2 : 0));
      enemy.slowTime = Math.max(enemy.slowTime, 5 * this.stats.cryoSlowMul);
      if (evolved) enemy.brittleTime = 5;
      this.elementBurst(this.enemyCenter(enemy), 'ice', 10);
    }
    const burst = new THREE.Mesh(
      new THREE.RingGeometry(0.86, 1, 48),
      new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    burst.rotation.x = -Math.PI / 2;
    burst.position.set(pos.x, heightAt(pos.x, pos.z) + 0.25, pos.z);
    burst.userData.radius = radius;
    this.scene.add(burst);
    this.pulses.push({ mesh: burst, age: 0 });
    this.elementBurst(pos, 'ice', 24);
    this.flashLight(pos, 110);
    this.audio.playNova();
    this.makeNoise(70);
    this.addFeed('CRYO GRENADE DETONATED');
  }

  private throwSmoke() {
    const evolved = this.evolved('smoke');
    const {radius, life} = veilStats(this.taken.get('smoke_belt') ?? 0, evolved, WEAPON_INFO.smoke.cooldown);
    this.smokeClouds.push({ pos: new THREE.Vector3(this.pos.x, this.pos.y, this.pos.z), radius, life, maxLife: life, emit: 0 });
    this.buffT.smoke = 4.5;
    // Recheck immediately: no extra tracking frames after the pilot deploys cover.
    for (const e of this.enemies) e.losTimer = 0;
    this.audio.playSmoke();
    this.addFeed('VEIL ACTIVE — BULLETS BLOCKED · HEAVY FIRE STILL PENETRATES');
  }

  private updateSmokeClouds(dt: number) {
    for (const cloud of this.smokeClouds) {
      if (!cloud.mesh) {
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(cloud.radius, 20, 12),
          new THREE.MeshBasicMaterial({ color: 0xdde1dc, transparent: true, opacity: 0.15, depthWrite: false, side: THREE.DoubleSide }),
        );
        mesh.position.set(cloud.pos.x, cloud.pos.y + 3, cloud.pos.z);
        mesh.scale.y = 0.55;
        this.scene.add(mesh);
        cloud.mesh = mesh;
      }
      (cloud.mesh.material as THREE.MeshBasicMaterial).opacity = 0.1 + 0.07 * Math.min(1, cloud.life / cloud.maxLife) * (0.8 + Math.random() * 0.3);
    }
    for (let i = this.smokeClouds.length - 1; i >= 0; i--) {
      const cloud = this.smokeClouds[i];
      cloud.life -= dt;
      if (cloud.life <= 0) {
        if (cloud.mesh) { this.scene.remove(cloud.mesh); cloud.mesh.geometry.dispose(); (cloud.mesh.material as THREE.Material).dispose(); }
        this.smokeClouds.splice(i, 1);
        continue;
      }
      cloud.emit -= dt;
      if (cloud.emit <= 0) {
        cloud.emit = 0.045;
        for (let k = 0; k < 3; k++) {
          const angle = rand(0, TWO_PI);
          const r = rand(0, cloud.radius * 0.85);
          this.smoke.emit({
            x: cloud.pos.x + Math.sin(angle) * r, y: cloud.pos.y + rand(0.3, 4.5), z: cloud.pos.z + Math.cos(angle) * r,
            vx: rand(-0.7, 0.7), vy: rand(0.5, 2.2), vz: rand(-0.7, 0.7),
            life: rand(2.8, 4.6), size0: rand(3.5, 6), size1: rand(7, 13),
            c0: [0.76, 0.77, 0.75], c1: [0.46, 0.47, 0.46], grav: -0.25, drag: 0.8, alpha: 0.5,
          });
        }
      }
      if (this.alive && this.evolved('smoke') && Math.hypot(this.pos.x - cloud.pos.x, this.pos.z - cloud.pos.z) < cloud.radius) {
        this.shieldHp = Math.min(this.stats.shieldMax, this.shieldHp + (30 / cloud.maxLife) * dt);
        if (this.shieldBroken && this.shieldHp >= this.stats.shieldMax) this.shieldBroken = false;
      }
    }
  }

  /** The longest-lived cloud actually covering the pilot (if any). */
  private concealmentCloud(): SmokeCloud | undefined {
    if (!this.alive || !this.smokeClouds.length) return undefined;
    const pilot = { x: this.pos.x, y: this.pos.y + 1.5, z: this.pos.z };
    let covering: SmokeCloud | undefined;
    for (const cloud of this.smokeClouds) {
      if (crossesVeil(pilot, pilot, cloud) && (!covering || cloud.life > covering.life)) covering = cloud;
    }
    return covering;
  }

  private isConcealed() {
    return !!this.concealmentCloud();
  }

  private get maxHp() {
    return Math.round(this.cfg.maxHp * this.stats.maxHpMul);
  }

  /**
   * Aim assist strength, clamped so a stack of targeting computers can never
   * bend shots past the cone the cockpit advertises.
   */
  private get aimAssist() {
    return aimAssist(this.stats.assistMul);
  }

  /** Readiness of the primary weapon, 0..1 (heat weapons report free heat). */
  private primaryReadiness(): number {
    const pri = this.cfg.loadout.primary;
    return triggerReadiness({
      isHeat: pri === 'autocannon' || pri === 'coil',
      heat: this.mgHeat,
      overheat: this.mgOverheat,
      reloadRemaining: this.primaryCd,
      reloadTime: this.cfg.scatterReload * this.stats.reloadMul,
    });
  }

  /** Readiness of the secondary weapon, 0..1. */
  private secondaryReadiness(): number {
    const sec = this.cfg.loadout.secondary;
    return secondaryReadiness({
      kind: sec === 'cannon' ? 'cannon' : sec === 'cryoball' ? 'cryoball' : sec === 'emp' ? 'emp' : 'beam',
      reloadRemaining: this.cannonCd,
      reloadTime: this.cfg.cannonReload * this.stats.reloadMul,
      cooldownRemaining: this.secCd,
      cooldownTime: this.secCdMax,
      heat: this.secHeat,
      overheat: this.secOverheat,
    });
  }

  /** Readiness of any weapon slot, 0..1 — the single source of truth. */
  private weaponReadiness(id: WeaponId): number {
    if (id === this.cfg.loadout.primary) return this.primaryReadiness();
    if (id === this.cfg.loadout.secondary) return this.secondaryReadiness();
    const full = this.weaponCooldown(id);
    if (full <= 0) return 1;
    return cooldownReadiness(this.weaponCd[id], full);
  }

  /** Full recharge time of a special weapon, including every upgrade. */
  private weaponCooldown(id: WeaponId): number {
    const info = WEAPON_INFO[id];
    const s = this.stats;
    switch (id) {
      case 'missiles': return info.cooldown * s.missileCdMul;
      case 'mortar': return info.cooldown * s.strikeCdMul;
      case 'cryo': return info.cooldown * s.reloadMul;
      case 'cinder': return info.cooldown * (1 - 0.18 * (this.taken.get('cinder_charge') ?? 0));
      case 'orbital': return info.cooldown * (1 - 0.12 * (this.taken.get('orbital_uplink') ?? 0));
      case 'smoke': return veilStats(this.taken.get('smoke_belt') ?? 0, this.evolved('smoke'), info.cooldown).cooldown;
      default: return info.cooldown;
    }
  }

  /** Q / E abilities. Every mech owns exactly its own four weapons. */
  useWeapon(id: WeaponId) {
    if (!this.alive || this.paused || this.upgrading || !this.owned.has(id) || this.weaponCd[id] > 0) return;
    const rack = this.ordnance.key(id);
    if (!rack) return;
    if (!this.ordnance.count[rack]) { this.addFeed(`${rack} EMPTY — REARM CRATE OR NEXT STAGE`); return; }
    if (!this.spendPower(id)) return;
    this.ordnance.count[rack]--;
    const s = this.stats;
    if (id === 'missiles') {
      this.missileQueue = s.missileCount;
      this.missileTimer = 0;
      this.weaponCd.missiles = this.weaponCooldown('missiles');
      this.addFeed('MISSILE SALVO AWAY');
    } else if (id === 'rail') {
      this.weaponCd.rail = this.weaponCooldown('rail');
      this.fireRail();
    } else if (id === 'turret') {
      this.weaponCd.turret = this.weaponCooldown('turret');
      this.deployTurret();
    } else if (id === 'mortar') {
      // mark the point the player is aiming at (ground hit, or max range)
      const dir = this.camera.getWorldDirection(new THREE.Vector3());
      let t = 220;
      if (dir.y < -0.002) t = Math.min(t, this.traceCover(this.camera.position, dir, 180));
      const target = this.camera.position.clone().addScaledVector(dir, t);
      target.y = heightAt(target.x, target.z);
      const d = Math.hypot(target.x, target.z);
      if (d > this.arenaR - 6) { target.x *= (this.arenaR - 6) / d; target.z *= (this.arenaR - 6) / d; }
      target.y = heightAt(target.x, target.z);
      // snap onto a locked enemy if there is one under the crosshair
      const assist = this.assistTarget(this.camera.position, dir);
      if (assist) target.set(assist.pos.x, assist.pos.y, assist.pos.z);
      const marker = this.makeStrikeMarker();
      marker.position.copy(target);
      this.scene.add(marker);
      this.strikes.push({ kind: 'mortar', marker, pos: target, timer: 2.4, shells: s.strikeShells, shellTimer: 0 });
      this.weaponCd.mortar = this.weaponCooldown('mortar');
      this.audio.playMortar();
      this.audio.playStrikeCall();
      this.addFeed('INCENDIARY MORTARS INBOUND');
    } else if (id === 'orbital') {
      const target = this.orbitalTarget();
      const evolved = this.evolved('orbital');
      const radius = orbitalRadius(this.taken.get('orbital_uplink') ?? 0, evolved);
      const marker = this.makeOrbitalMarker(target, radius);
      this.scene.add(marker);
      this.strikes.push({
        kind: 'orbital', marker, pos: target, radius, timer: ORBITAL.warning,
        shells: ORBITAL.bolts, shellTimer: 0, fired: 0, damageMul: evolved ? 1.2 : 1,
      });
      this.weaponCd.orbital = this.weaponCooldown('orbital');
      this.audio.playStrikeCall();
      this.makeNoise(110);
      this.addFeed('SKYFALL — ORBITAL BARRAGE INBOUND');
    } else if (id === 'cinder') {
      this.weaponCd.cinder = this.weaponCooldown('cinder');
      this.launchCanister();
    } else if (id === 'mines') {
      this.weaponCd.mines = this.weaponCooldown('mines');
      this.deployMines();
    } else if (id === 'smoke') {
      this.weaponCd.smoke = this.weaponCooldown('smoke');
      this.throwSmoke();
    } else if (id === 'overdrive') {
      this.weaponCd.overdrive = this.weaponCooldown('overdrive');
      this.fireOverdrive();
    } else if (id === 'nova') {
      this.weaponCd.nova = this.weaponCooldown('nova');
      this.fireNova();
    } else if (id === 'cryo') {
      this.weaponCd.cryo = this.weaponCooldown('cryo');
      this.fireBeam('cryo', true);
      this.shake = Math.max(this.shake, 0.08);
    }
  }

  /** Pyre vents the reactor: a burn nova plus 10s+ of speed and reload. */
  private fireOverdrive() {
    const stacks = this.stats.overdriveStacks;
    this.overdriveDuration = 8 + 4 * stacks;
    this.buffT.overdrive = this.overdriveDuration;
    if (this.evolved('overdrive')) {
      this.shieldHp = Math.min(this.stats.shieldMax, this.shieldHp + 50);
      this.shieldBroken = false;
      this.shieldDelay = 0;
      this.mgHeat = 0;this.mgOverheat=false;
      this.secHeat = 0;
      this.secOverheat = false;
    }
    const dmg = 40 * (1 + 0.4 * stacks);
    const radius = 16;
    const center = new THREE.Vector3(this.pos.x, this.pos.y + 1.2, this.pos.z);
    this.explosion(center, 1.4);
    for (let i = 0; i < 14; i++) {
      const th = rand(0, TWO_PI);
      this.fire.emit({
        x: this.pos.x, y: this.pos.y + 1, z: this.pos.z,
        vx: Math.cos(th) * rand(8, 16), vy: rand(2, 6), vz: Math.sin(th) * rand(8, 16),
        life: rand(0.4, 0.8), size0: 1.8, size1: 0.4, c0: [1, 0.65, 0.25], c1: [1, 0.25, 0.05], grav: -1, drag: 2, alpha: 1,
      });
    }
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = e.pos.distanceTo(this.pos) - e.radius;
      if (d < radius) {
        this.damageEnemy(e, dmg * (1 - Math.max(0, d) / radius * 0.5));
        e.burnTime = 2;
        e.burnDps = 5;
      }
    }
    this.audio.playOverdrive();
    this.makeNoise(110);
    this.shake = Math.max(this.shake, 0.2);
    this.addFeed('OVERDRIVE VENTED — FULL BURN');
  }

  /** Glacier's stasis nova: freezes hostiles in place. */
  private fireNova() {
    const radius = 26 * this.stats.empRadiusMul;
    let affected = 0;
    for (const enemy of this.enemies) {
      if (!enemy.alive || Math.hypot(enemy.pos.x - this.pos.x, enemy.pos.z - this.pos.z) > radius) continue;
      enemy.stunTime = Math.max(enemy.stunTime, enemy.boss ? 2 : 3.5);
      enemy.slowTime = Math.max(enemy.slowTime, 4 + 2 * (this.stats.empRadiusMul - 1));
      if (this.evolved('nova')) {
        enemy.brittleTime = 6;
        this.beamHit(enemy, 20);
      }
      this.elementBurst(this.enemyCenter(enemy), 'ice', 10);
      affected++;
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];
      if (projectile.owner !== 'enemy' || projectile.pos.distanceTo(this.pos) > radius) continue;
      this.scene.remove(projectile.mesh);
      this.projectiles.splice(i, 1);
    }
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.88, 1, 64),
      new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(this.pos.x, this.pos.y + 0.4, this.pos.z);
    ring.userData.radius = radius;
    this.scene.add(ring);
    this.pulses.push({ mesh: ring, age: 0 });
    this.audio.playNova();
    this.makeNoise(80);
    this.addFeed(`STASIS NOVA: ${affected} HOSTILES FROZEN`);
  }

  /** Warden's sentry: an automated gun that holds a position for 30s. */
  private deployTurret() {
    while (this.turrets.length >= 1) {
      const old = this.turrets.shift()!;
      this.explosion(old.pos, 0.8);
      this.scene.remove(old.group);
    }
    const f = fwd(this.turretYaw, new THREE.Vector3());
    let bx = 0;
    let bz = 0;
    for (const [ox, oz] of [[7, 0], [5, 4], [5, -4], [9, 0]]) {
      const cx = this.pos.x + f.x * ox + -f.z * oz;
      const cz = this.pos.z + f.z * ox + f.x * oz;
      if (!nearObstacles(cx, cz, 3).some((o) => obsDist(o, cx, cz) < 2.5)) {
        bx = cx;
        bz = cz;
        break;
      }
      bx = cx;
      bz = cz;
    }
    const y = heightAt(bx, bz);
    const g = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.7, metalness: 0.4 });
    const trim = new THREE.MeshStandardMaterial({ color: this.cfg.accent, emissive: this.cfg.accent, emissiveIntensity: 1.2 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 0.8, 10), dark);
    base.position.y = 0.4;
    const column = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.9), dark);
    column.position.y = 1.4;
    const head = new THREE.Group();
    head.position.y = 2.2;
    const housing = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 1.4), dark);
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 2.2, 8), dark);
    gun.rotation.x = Math.PI / 2;
    gun.position.z = 1.6;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), trim);
    eye.position.set(0, 0.45, 0.4);
    head.add(housing, gun, eye);
    g.add(base, column, head);
    g.position.set(bx, y, bz);
    setShadows(g);
    this.scene.add(g);
    this.turrets.push({ group: g, barrel: head, pos: new THREE.Vector3(bx, y, bz), cooldown: 0.5, life: 24 * this.stats.turretLifeMul });
    this.audio.playTurretDeploy();
    this.makeNoise(60);
    this.addFeed('SENTRY DEPLOYED — COVERING YOU');
  }

  private updateTurrets(dt: number) {
    for (let i = this.turrets.length - 1; i >= 0; i--) {
      const t = this.turrets[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.explosion(this.tmpA.set(t.pos.x, t.pos.y + 1.5, t.pos.z), 0.9);
        this.scene.remove(t.group);
        this.turrets.splice(i, 1);
        continue;
      }
      let best: Enemy | null = null;
      let bestD = 85;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const d = e.pos.distanceTo(t.pos);
        if (d < bestD && this.hasLOS(t.pos, e.pos, 2.2, 2)) {
          bestD = d;
          best = e;
        }
      }
      if (best) {
        t.barrel.lookAt(this.tmpA.set(best.pos.x, best.pos.y + best.height * 0.5, best.pos.z));
        t.cooldown -= dt;
        if (t.cooldown <= 0) {
          const from = new THREE.Vector3(t.pos.x, t.pos.y + 2.2, t.pos.z);
          const destination = this.enemyCenter(best);
          const aim = destination.clone().sub(from).normalize();
          if (this.evolved('turret')) {
            t.cooldown = 0.85;
            this.weaponFx.beam(from, destination, 0x7bf0e8, 0.065, 0.24, true);
            this.damageEnemy(best, 17 * this.stats.turretDmgMul);
            const next = this.linkTarget(destination, new Set([best]), 20);
            if (next) {
              this.weaponFx.beam(destination, this.enemyCenter(next), 0x7bf0e8, 0.045, 0.24, true);
              this.damageEnemy(next, 10 * this.stats.turretDmgMul);
            }
            this.audio.playArc(t.pos.distanceTo(this.pos), this.panFor(t.pos.x, t.pos.z));
          } else {
            t.cooldown = 0.55;
            this.spawnProjectile('player', 'bullet', from, aim.clone().multiplyScalar(240), 8 * this.stats.turretDmgMul, 0, 0, 0.8, 0);
            this.muzzleFlash(from, aim, 0.3);
            this.audio.playTurretShot(t.pos.distanceTo(this.pos), this.panFor(t.pos.x, t.pos.z));
          }
        }
      }
    }
  }

  /** Lingering incendiary pools from mortars and barrels. */
  private addBurn(pos: THREE.Vector3, radius = 8, life = 6) {
    if (this.burns.length >= 10) this.burns.shift();
    this.burns.push({ pos: new THREE.Vector3(pos.x, heightAt(pos.x, pos.z) + 0.4, pos.z), radius, life, tick: 0 });
  }

  private updateBurns(dt: number) {
    for (let i = this.burns.length - 1; i >= 0; i--) {
      const b = this.burns[i];
      b.life -= dt;
      if (b.life <= 0) {
        this.burns.splice(i, 1);
        continue;
      }
      b.tick -= dt;
      for (let k = 0; k < 2; k++) {
        const a = rand(0, TWO_PI);
        const r = rand(0, b.radius * 0.8);
        this.fire.emit({
          x: b.pos.x + Math.sin(a) * r, y: b.pos.y, z: b.pos.z + Math.cos(a) * r,
          vx: rand(-0.5, 0.5), vy: rand(1.5, 3.5), vz: rand(-0.5, 0.5),
          life: rand(0.35, 0.7), size0: 1.4, size1: 0.3, c0: [1, 0.6, 0.2], c1: [1, 0.2, 0.05], grav: -1, drag: 1.5, alpha: 0.85,
        });
      }
      if (b.tick <= 0) {
        b.tick = 0.5;
        for (const e of this.enemies) {
          if (!e.alive) continue;
          if (Math.hypot(e.pos.x - b.pos.x, e.pos.z - b.pos.z) < b.radius + e.radius) {
            const scorch = 7 * this.firepower * this.lastStandMul();
            e.hp -= scorch;
            this.floaters.addDamage(e, this.floaterAnchor.set(e.pos.x, e.pos.y + e.height * 0.7, e.pos.z), scorch, false);
            e.hitFlash = Math.max(e.hitFlash, 0.5);
            if (e.hp <= 0) this.killEnemy(e);
          }
        }
        const pd = Math.hypot(this.pos.x - b.pos.x, this.pos.z - b.pos.z);
        if (pd < b.radius && this.alive && !this.evolved('mortar')) this.damagePlayer(4, b.pos);
      }
    }
  }

  private fireRail() {
    this.camera.updateMatrixWorld();
    const muzzle = this.camera.localToWorld(this.muzzleLocal('utility').clone());
    const origin = this.camera.position.clone();
    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    const assist = this.assistTarget(origin, dir);
    if (assist) dir.copy(this.enemyCenter(assist)).sub(origin).normalize();
    const limit = this.traceCover(origin, dir, 260);
    let closest: Enemy | null = null;
    let distance = limit;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const to = this.enemyCenter(enemy).sub(origin);
      const projection = to.dot(dir);
      const radius = enemy.radius;
      const sideSq = to.lengthSq() - projection * projection;
      if (projection < 0 || sideSq > radius * radius) continue;
      const entry = projection - Math.sqrt(Math.max(0, radius * radius - sideSq));
      if (entry >= 0 && entry < distance) { distance = entry; closest = enemy; }
    }
    let barrel: ExplosiveBarrel | null = null;
    for (const item of this.explosiveBarrels) {
      if (item.destroyed) continue;
      const to = item.pos.clone().sub(origin);
      const projection = to.dot(dir);
      if (projection > 0 && projection < distance && to.lengthSq() - projection * projection < 1.5) {
        distance = projection; barrel = item; closest = null;
      }
    }
    const endpoint = origin.clone().addScaledVector(dir, distance);
    const damage = 115 * this.stats.railDmgMul;
    this.weaponFx.beam(muzzle, endpoint, 0x63dfff, 0.105, 0.46, true);
    this.elementBurst(endpoint, 'electric', 24);
    this.flashLight(endpoint, 120);
    if (barrel) this.damageBarrel(barrel, damage);
    if (closest) {
      this.damageEnemy(closest, damage);
      if (this.evolved('rail')) {
        const used = new Set<Enemy>([closest]);
        let previous = this.enemyCenter(closest);
        for (const multiplier of [0.55, 0.35]) {
          const next = this.linkTarget(previous, used, 27);
          if (!next) break;
          used.add(next);
          const destination = this.enemyCenter(next);
          this.weaponFx.beam(previous, destination, 0x95edff, 0.075, 0.42, true);
          this.elementBurst(destination, 'electric', 16);
          this.damageEnemy(next, damage * multiplier);
          previous = destination;
        }
      }
    }

    this.muzzleLight.position.copy(this.muzzleLocal('utility'));
    this.muzzleLight.intensity = 320;
    this.audio.playRail();
    this.makeNoise(130);
    this.shake = Math.max(this.shake, 0.12);
    this.addFeed(this.evolved('rail') ? 'CHAIN REACTION - RAIL DISCHARGED' : 'RAILGUN DISCHARGED');
  }

  private makeStrikeMarker() {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(10, 11.2, 48), new THREE.MeshBasicMaterial({ color: 0xff6a2a, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    const inner = new THREE.Mesh(new THREE.RingGeometry(1.5, 2.5, 24), new THREE.MeshBasicMaterial({ color: 0xffd080, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    inner.rotation.x = -Math.PI / 2;
    inner.position.y = 0.16;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 60, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xff8040, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    beam.position.y = 30;
    g.add(ring, inner, beam);
    return g;
  }

  /** A broad cyan targeting perimeter that follows the uneven ground. */
  private makeOrbitalMarker(target: THREE.Vector3, radius: number) {
    const group = new THREE.Group();
    group.name = 'orbital-marker';
    group.position.copy(target);
    const vertices: number[] = [];
    const point = (angle: number, distance: number) => {
      const x = Math.cos(angle) * distance, z = Math.sin(angle) * distance;
      return [x, heightAt(target.x + x, target.z + z) - target.y + 0.28, z];
    };
    const segments = 72;
    for (let i = 0; i < segments; i++) {
      if (i % 6 === 5) continue;
      const a = (i / segments) * TWO_PI, b = ((i + 1) / segments) * TWO_PI;
      const innerA = point(a, radius - 0.55), outerA = point(a, radius);
      const innerB = point(b, radius - 0.55), outerB = point(b, radius);
      vertices.push(...innerA, ...outerA, ...outerB, ...innerA, ...outerB, ...innerB);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const perimeter = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
      color: 0x71dfff, transparent: true, opacity: 0.8, side: THREE.DoubleSide,
      depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    }));
    perimeter.name = 'orbital-perimeter';
    const center = new THREE.Mesh(new THREE.RingGeometry(2.7, 3.2, 48), new THREE.MeshBasicMaterial({
      color: 0xd3f9ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
      depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    }));
    center.rotation.x = -Math.PI / 2;
    center.position.y = 0.3;
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 60, 8, 1, true), new THREE.MeshBasicMaterial({
      color: 0x84e8ff, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending,
      depthWrite: false, toneMapped: false,
    }));
    beacon.position.y = 30;
    group.add(perimeter, center, beacon);
    return group;
  }

  private removeStrikeMarker(marker: THREE.Group) {
    this.scene.remove(marker);
    marker.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
    });
  }

  /** Stereo position (-1 left .. 1 right) of a world point relative to where the player looks. */
  private panFor(x: number, z: number) {
    const dx = x - this.pos.x;
    const dz = z - this.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    return clamp((dx * -Math.cos(this.turretYaw) + dz * Math.sin(this.turretYaw)) / d, -1, 1);
  }

  private updateSystems(dt: number) {
    const s = this.stats;
    // district discovery
    this.districtTimer -= dt;
    if (this.districtTimer <= 0) {
      this.districtTimer = 0.4;
      const dn = districtAt(this.pos.x, this.pos.z);
      if (dn !== this.districtName) {
        if (this.districtName) this.addFeed(`ENTERING: ${dn}`);
        this.districtName = dn;
      }
    }
    // wading sound + adaptive score intensity
    const wadingNow = inWater(this.pos.x, this.pos.z) && Math.hypot(this.vel.x, this.vel.z) + Math.abs(this.speed) > 1.5;
    if (wadingNow !== this.wading) {
      this.wading = wadingNow;
      this.audio.setWading(wadingNow);
    }
    this.musicTimer -= dt;
    if (this.musicTimer <= 0) {
      this.musicTimer = 0.5;
      const hunting = this.enemies.filter((e) => e.aware).length;
      const boss = this.enemies.some((e) => e.boss) ? 0.3 : 0;
      let intensity = 0.12 + this.enemies.length * 0.03 + hunting * 0.05 + boss + (1 - this.hp / this.maxHp) * 0.2;
      if (!this.waveActive) intensity *= 0.45;
      this.audio.setMusicIntensity(this.upgrading ? 0.05 : intensity);
    }
    for (const k of Object.keys(this.weaponCd) as WeaponId[]) this.weaponCd[k] = Math.max(0, this.weaponCd[k] - dt);

    // hull regen
    if (s.regen > 0 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + s.regen * dt);
    // LAST CIRCUIT: announce the moment the hull drops into the danger band
    if (this.stats.lastStand > 0 && this.alive) {
      const critical = this.hp > 0 && this.hp < this.maxHp * 0.35;
      if (critical && !this.lastStandActive) {
        this.addFeed('LAST CIRCUIT ENGAGED — +35% DAMAGE');
        this.audio.playOverdrive();
      }
      this.lastStandActive = critical;
    }
    // repair swarm: passive hull + shield rebuild
    if (s.nanites > 0) {
      if (this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + 2.5 * s.nanites * dt);
      if (!this.shieldBroken && this.shieldHp < s.shieldMax) this.shieldHp = Math.min(s.shieldMax, this.shieldHp + 12 * s.nanites * dt);
    }
    for (const k of ['aegis', 'overcharge', 'rapid', 'haste', 'overdrive', 'smoke'] as const) this.buffT[k] = Math.max(0, this.buffT[k] - dt);
    // arc discharger: automatic chain lightning
    if (s.arc > 0) {
      this.arcTimer -= dt;
      if (this.arcTimer <= 0) {
        this.arcTimer = 6;
        let best: Enemy | null = null;
        let bestD = 45;
        for (const e of this.enemies) {
          const d = e.pos.distanceTo(this.pos);
          if (e.alive && d < bestD) { bestD = d; best = e; }
        }
        if (best) {
          const damage = 26 * s.arc;
          const from = this.tmpA.set(this.pos.x, this.pos.y + 2.2, this.pos.z).clone();
          const to = this.tmpB.set(best.pos.x, best.pos.y + best.height * 0.5, best.pos.z).clone();
          this.damageEnemy(best, damage);
          const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
          const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x67e6ff, transparent: true, opacity: 0.95 }));
          this.scene.add(line);
          this.lines.push({ line, age: 0 });
          this.sparks(to, 1.2);
          this.audio.playArc();
          this.addFeed(`ARC DISCHARGE  ${Math.round(damage)} DMG`);
        }
      }
    }
    for (let i = this.lines.length - 1; i >= 0; i--) {
      const flash = this.lines[i];
      flash.age += dt;
      (flash.line.material as THREE.LineBasicMaterial).opacity = 0.95 * (1 - flash.age / 0.22);
      if (flash.age > 0.22) {
        this.scene.remove(flash.line);
        flash.line.geometry.dispose();
        (flash.line.material as THREE.Material).dispose();
        this.lines.splice(i, 1);
      }
    }
    this.updateDrops(dt);

    // missile salvo
    if (this.missileQueue > 0) {
      this.missileTimer -= dt;
      if (this.missileTimer <= 0) {
        this.missileTimer = 0.13;
        this.missileQueue--;
        this.fireMissile();
      }
    }

    // After a quiet period, an intact shield recharges. A broken shield must
    // reach full capacity before it can absorb damage again.
    this.shieldDelay = Math.max(0, this.shieldDelay - dt);
    if (this.shieldDelay === 0 && this.shieldHp < s.shieldMax) {
      this.shieldHp = Math.min(s.shieldMax, this.shieldHp + 26 * (s.bulwark > 0 ? 1.35 : 1) * dt);
      if (this.shieldBroken && this.shieldHp >= s.shieldMax) {
        this.shieldBroken = false;
        this.audio.playShieldUp();
        this.addFeed('SHIELD RESTORED');
      }
    }
    this.shieldFlash = Math.max(0, this.shieldFlash - dt);
    this.shieldMesh.visible = this.shieldFlash > 0;
    if (this.shieldMesh.visible) {
      (this.shieldMesh.material as THREE.MeshBasicMaterial).opacity = this.shieldFlash * 0.6;
      this.shieldMesh.position.set(this.pos.x, this.pos.y + 1.6, this.pos.z);
      this.shieldMesh.rotation.y += dt * 0.4;
    }
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const pulse = this.pulses[i];
      pulse.age += dt;
      const t = Math.min(1, pulse.age / 0.65);
      pulse.mesh.scale.setScalar(1 + t * pulse.mesh.userData.radius);
      (pulse.mesh.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - t);
      if (t >= 1) {
        this.scene.remove(pulse.mesh);
        pulse.mesh.geometry.dispose();
        (pulse.mesh.material as THREE.Material).dispose();
        this.pulses.splice(i, 1);
      }
    }

    // sniper lock warning tick
    const lock = this.lockWarning();
    if (lock > 0) {
      this.lockWarnTimer -= dt;
      if (this.lockWarnTimer <= 0) {
        this.lockWarnTimer = Math.max(0.09, 0.4 * (1 - lock));
        this.audio.playLockWarning();
      }
    }
  }

  private dropShield() {
    this.shieldHp = 0;
    this.shieldBroken = true;
    this.audio.playShieldDown();
    this.addFeed('SHIELD DEPLETED - TAKE COVER');
  }

  private lockWarning() {
    let best = 0;
    for (const e of this.enemies) if (e.lockTimer > 0) best = Math.max(best, 1 - e.lockTimer / 1.2);
    return best;
  }

  private fireMissile() {
    this.camera.updateMatrixWorld();
    const side = this.missileQueue % 2 === 0 ? 1 : -1;
    const local = this.tmpD.set(side * 2.0, -0.6, -2.2);
    const muzzle = this.camera.localToWorld(local.clone());
    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    let assist = this.assistTarget(muzzle, dir) ?? this.nearestEnemyInFront(dir);
    if (this.evolved('missiles')) {
      const visible = this.enemies.filter((e) => e.alive && e.pos.distanceTo(this.pos) < 180 && this.hasLOS(muzzle, e.pos, 0, e.height * 0.5));
      if (visible.length) assist = visible[this.missileQueue % visible.length];
    }
    // launch outward/upward, then the homing steers it in
    const vel = dir.clone().addScaledVector(rightOf(this.turretYaw, this.tmpC), side * 0.45).add(new THREE.Vector3(0, 0.35, 0)).normalize().multiplyScalar(70);
    const dmg = 23 * this.stats.missileDmgMul;
    this.spawnProjectile('player', 'rocket', muzzle, vel, dmg, 6 * this.stats.splashMul * (1 + this.stats.surge * 0.4), 0, 6, assist ? 4.5 * this.aimAssist : 0, assist);
    const last = this.projectiles[this.projectiles.length - 1];
    (last.mesh as THREE.Mesh).material = this.mats.playerRocket;
    this.muzzleFlash(muzzle, dir, 0.5);
    this.audio.playMissile(side * 0.22);
    this.makeNoise(90);
    this.shake = Math.max(this.shake, 0.05);
  }

  private nearestEnemyInFront(dir: THREE.Vector3) {
    let best: Enemy | null = null;
    let bestD = Infinity;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const v = this.tmpA.set(e.pos.x - this.pos.x, 0, e.pos.z - this.pos.z);
      const d = v.length();
      if (d > 200) continue;
      if (v.divideScalar(d).dot(dir) < 0.55 || !this.hasLOS(this.pos, e.pos, this.cfg.camHeight, e.height * 0.5)) continue;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  private updateStrikes(dt: number) {
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const st = this.strikes[i];
      st.timer -= dt;
      if (st.kind === 'orbital') {
        const perimeter = st.marker.children[0] as THREE.Mesh;
        (perimeter.material as THREE.MeshBasicMaterial).opacity = 0.7 + Math.sin(this.time * 12) * 0.2;
        st.marker.children[1].rotation.z += dt * 1.5;
      } else {
        const pulse = 0.8 + Math.sin(this.time * 12) * 0.2;
        st.marker.children[0].scale.setScalar(pulse);
        st.marker.rotation.y += dt * 1.5;
      }
      if (st.timer <= 1.4 && st.timer + dt > 1.4) this.audio.playIncoming();
      if (st.timer <= 0 && st.shells > 0) {
        st.shellTimer -= dt;
        if (st.shellTimer <= 0) {
          st.shellTimer = st.kind === 'orbital' ? ORBITAL.interval : 0.28;
          st.shells--;
          if (st.kind === 'orbital') {
            this.orbitalImpact(st, st.fired++);
          } else {
            const ox = rand(-7, 7);
            const oz = rand(-7, 7);
            const start = new THREE.Vector3(st.pos.x + ox + 6, st.pos.y + 140, st.pos.z + oz - 4);
            const vel = new THREE.Vector3(-6, -140, 4).normalize().multiplyScalar(160);
            this.spawnProjectile('player', 'shell', start, vel, 60 * this.stats.cannonDmgMul, 11 * this.stats.splashMul, 0, 3, 0, null, true);
            this.audio.playMortar();
            (this.projectiles[this.projectiles.length - 1].mesh as THREE.Mesh).scale.setScalar(2);
          }
        }
      }
      if (st.timer <= 0 && st.shells <= 0) {
        this.removeStrikeMarker(st.marker);
        this.strikes.splice(i, 1);
      }
    }
  }

  /** A central area-wide pulse and six visible vertical follow-up impacts. */
  private orbitalImpact(strike: Extract<Strike, { kind: 'orbital' }>, index: number) {
    const offset = orbitalOffset(index, strike.radius);
    const x = strike.pos.x + offset.x, z = strike.pos.z + offset.z;
    const point = new THREE.Vector3(x, heightAt(x, z) + 0.35, z);
    const central = index === 0;
    const radius = central ? strike.radius : strike.radius * 0.36;
    const damage = (central ? ORBITAL.coreDamage : ORBITAL.followupDamage) * strike.damageMul;
    const sky = point.clone().add(new THREE.Vector3(0, 180, 0));
    this.weaponFx.beam(sky, point, 0x72ddff, central ? 0.9 : 0.48, central ? 0.55 : 0.38);
    this.explosion(point, central ? 1.5 : 0.85);
    this.elementBurst(point, 'electric', central ? 25 : 12);
    this.flashLight(point, central ? 230 : 110);
    this.audio.playExplosion(point.distanceTo(this.pos), central, this.panFor(x, z));
    this.addCrater(point, central ? 1.6 : 0.8);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.86, 1, 64),
      new THREE.MeshBasicMaterial({
        color: 0x8feaff, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
        depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(point);
    ring.userData.radius = radius - 1;
    this.scene.add(ring);
    this.pulses.push({ mesh: ring, age: 0 });
    this.shake = Math.max(this.shake, central ? 0.18 : 0.07);

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const distance = Math.hypot(enemy.pos.x - x, enemy.pos.z - z) - enemy.radius;
      const hit = orbitalDamage(distance, radius, damage);
      if (hit > 0) this.damageEnemy(enemy, hit * impactMultiplier(enemy.kind, 'shell'));
    }
    const breach = this.firepower * (1 + 0.5 * (this.taken.get('breacher') ?? 0));
    for (const hit of this.mapApi.structures.blast(point, radius, damage * breach)) {
      if (hit.remaining === 0) {
        this.dust(new THREE.Vector3(hit.o.x, hit.o.y0 + 1, hit.o.z), 4);
        this.addFeed(`${hit.name} COLLAPSED — LANE OPEN`);
      }
    }
    for (const barrel of this.explosiveBarrels) {
      if (!barrel.destroyed && Math.hypot(barrel.pos.x - x, barrel.pos.z - z) < radius + 2) {
        this.damageBarrel(barrel, damage);
      }
    }
  }

  /** Pick one of the offered upgrades (index 0..2). */
  pickUpgrade(index: number) {
    if (!this.offer || !this.offer[index]) return;
    const u = this.offer[index];
    const installed = this.taken.get(u.id) ?? 0;
    this.taken.set(u.id, installed + 1);
    if(u.id !== 'medkit') this.perkList.push({ name: u.name, icon: u.icon });
    const s = this.stats;
    const hpBefore = this.maxHp;
    switch (u.id) {
      case 'armor': s.maxHpMul += 0.25; break;
      case 'regen': s.regen += 2; break;
      case 'ablative': s.armor = Math.min(0.5, s.armor + 0.1); break;
      case 'drive': s.speedMul += 0.15; break;
      case 'medkit': this.hp = this.maxHp; break;
      case 'magnet': s.pickupMul += 0.5; break;
      case 'vampire': s.vampire += 8; break;
      case 'autoloader': s.reloadMul *= 0.85; break;
      case 'he': s.cannonDmgMul += 0.25; s.splashMul += 0.25; break;
      case 'crit': s.critChance += 0.15; break;
      case 'sig_laststand': s.lastStand += 1; break;
      case 'coolant': s.mgHeatMul *= 0.7; break;
      case 'ap': s.mgDmgMul += 0.4; break;
      case 'targeting': s.assistMul += 0.6; break;
      case 'missile_count': s.missileCount += 2; break;
      case 'missile_cd': s.missileCdMul *= 0.75; s.missileDmgMul += 0.15; break;
      case 'shield_cap': s.shieldMax += 60; if (!this.shieldBroken) this.shieldHp += 60; break;
      case 'shield_cd': s.shieldCdMul *= 0.7; break;
      case 'mortar_shells': s.strikeShells += 1; break;
      case 'mortar_cd': s.strikeCdMul *= 0.75; break;
      case 'turret_up': s.turretDmgMul += 0.4; s.turretLifeMul += 0.5; break;
      case 'overdrive_up': s.overdriveStacks += 1; break;
      case 'belt': s.mgDmgMul += 0.35; break;
      case 'coilcap': s.mgDmgMul += 0.35; break;
      case 'napalm': s.flameDmgMul += 0.4; break;
      case 'deepfreeze': s.cryoDmgMul += 0.35; s.cryoSlowMul += 0.5; break;
      case 'nova_radius': s.empRadiusMul += 0.3; break;
      case 'cryo_lance': s.cryoDmgMul += 0.4; s.cryoSlowMul += 0.5; break;
      case 'rail_damage': s.railDmgMul += 0.35; break;
      case 'salvage': s.salvage += 0.25; break;
      case 'veteran': s.maxHpMul += 0.1; this.hp = Math.min(this.maxHp, this.hp + 30); break;
      case 'laurels': s.shieldMax += 30; this.shieldHp = s.shieldMax; this.shieldBroken = false; this.shieldDelay = 0; break;
      case 'evo_missiles': s.missileCount += 2; break;
      case 'sig_cluster': s.cluster += 1; break;
      case 'sig_reactive': s.reactive += 1; break;
      case 'sig_overcharge': s.overcharge += 1; break;
      case 'sig_nanites': s.nanites += 1; break;
      case 'sig_haste': s.haste += 1; break;
      case 'sig_arc': s.arc += 1; break;
      case 'sig_bulwark': s.bulwark += 1; s.shieldMax += 90; if (!this.shieldBroken) this.shieldHp += 90; break;
      case 'sig_surge': s.surge += 1; s.missileCount += 2; s.missileDmgMul += 0.15; s.strikeShells += 1; break;
      case 'sig_scavenger': s.dropRate += 1; break;
    }
    if (u.id === 'armor') this.hp = Math.min(this.maxHp, this.hp + (this.maxHp - hpBefore) + this.maxHp * 0.25);
    this.audio.playUpgrade();
    this.addFeed(u.id === 'medkit' ? 'FIELD REPAIR COMPLETE' : `${offerName(u, installed)} INSTALLED`);
    this.offersPending--;
    this.offer = this.offersPending > 0 ? rollOffer(this.taken, this.owned, this.hp>=this.maxHp) : null;
    if (this.offer && this.offer.length === 0) {
      this.offer = null;
      this.offersPending = 0;
    }
    if (!this.offer) {
      this.upgrading = false;
      if (this.touchMode) {
        this.paused = false;
        this.opts.onPause(false);
      } else {
        this.paused = true;
        this.opts.onPause(true);
        this.requestPointerLock();
      }
    }
    this.opts.onHud(this.buildHud());
  }

  private grantOffer() {
    this.offersPending++;
    if (!this.offer) this.offer = rollOffer(this.taken, this.owned, this.hp>=this.maxHp);
    if (this.offer.length === 0) {
      this.offer = null;
      this.offersPending = 0;
      return;
    }
    this.upgrading = true;
    this.keys.clear();
    this.mouse.left = this.mouse.right = false;
    this.padMove.x = this.padMove.y = 0;
    this.padFire.primary = this.padFire.secondary = false;
    this.opts.onHud(this.buildHud());
    if (this.isLocked()) document.exitPointerLock();
  }

  // -------------------------------------------------------------------------
  // Supply drops
  // -------------------------------------------------------------------------
  private rollDropKind(): DropKind {
    // Once a rack runs dry, the next ordinary shipment is a rearm unless one is already on the field.
    if (this.ordnance.missing && !this.drops.some(d=>d.kind==='ammo') && (this.ordnance.dry || Math.random()<0.35)) return 'ammo';
    const total = DROP_WEIGHTS.reduce((sum, [, w]) => sum + w, 0);
    let r = Math.random() * total;
    for (const [kind, weight] of DROP_WEIGHTS) {
      r -= weight;
      if (r <= 0) return kind;
    }
    return 'repair';
  }

  private spawnDrop(fx?: number, fz?: number, forced?: DropKind, recovered?: number) {
    const kind = forced ?? this.rollDropKind();
    const close = this.stats.dropRate > 0;
    const dist = rand(close ? 45 : 75, close ? 95 : 150);
    const a = rand(0, TWO_PI);
    let x = fx ?? this.pos.x + Math.sin(a) * dist;
    let z = fz ?? this.pos.z + Math.cos(a) * dist;
    const dc = Math.hypot(x, z);
    if (dc > this.arenaR - 16) {
      x *= (this.arenaR - 16) / dc;
      z *= (this.arenaR - 16) / dc;
    }
    const ox = x, oz = z;
    // Sample walkable ground near the intended landing zone; pushing out of
    // one collider could previously put the pod inside another or past the fence.
    let placed = false;
    for (let t = 0; t < 64; t++) {
      if (t) {
        const angle = rand(0, TWO_PI), reach = rand(4, 12 + t);
        x = ox + Math.sin(angle) * reach; z = oz + Math.cos(angle) * reach;
      }
      if (Math.hypot(x,z) > this.arenaR - 7 || inWater(x,z)) continue;
      if (nearObstacles(x,z,5).some(o=>obsDist(o,x,z)<4)) continue;
      placed = true; break;
    }
    if (!placed) { x = 0; z = 0; } // the protected player spawn is always clear
    const credits = kind === 'coins' ? recovered ?? cacheValue(Math.random()) : 0;
    const {group,ring} = makeSupplyCrate(kind,credits);
    const y = heightAt(x,z);
    group.position.set(x, y + (recovered ? 1.6 : 110), z);
    this.scene.add(group);
    this.drops.push({ credits, kind, group, ring, pos: new THREE.Vector3(x, y, z), falling: !recovered, vy: 8, life: 120, ping: rand(0.5, 2) });
    if (recovered) this.addFeed(`JACKAL CARGO RELEASED — ${recovered} CR`);
    else { this.setMessage(`SUPPLY DROP INBOUND — ${SUPPLIES[kind].name.toUpperCase()}`); this.audio.playIncoming(); }
  }

  private updateDrops(dt: number) {
    if (this.alive) {
      this.dropTimer -= dt * (1 + this.stats.dropRate * 0.35);
      if (this.dropTimer <= 0 && this.drops.length < 3) {
        this.dropTimerTotal = rand(38, 55);
        this.dropTimer = this.dropTimerTotal;
        this.spawnDrop();
      }
    }
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      if (drop.falling) {
        drop.vy = Math.min(70, drop.vy + 34 * dt);
        drop.group.position.y -= drop.vy * dt;
        drop.group.rotation.y += dt * 1.4;
        if (Math.random() < 0.55) {
          this.smoke.emit({
            x: drop.group.position.x + rand(-0.4, 0.4), y: drop.group.position.y + 1.6, z: drop.group.position.z + rand(-0.4, 0.4),
            vx: rand(-1, 1), vy: rand(2, 5), vz: rand(-1, 1),
            life: rand(1, 2.2), size0: 1.1, size1: 4, c0: [0.62, 0.6, 0.58], c1: [0.35, 0.34, 0.33], grav: -1, drag: 1.2, alpha: 0.42,
          });
        }
        if (drop.group.position.y <= drop.pos.y + 1.6) {
          drop.group.position.y = drop.pos.y + 1.6;
          drop.falling = false;
          this.dust(drop.pos, 3);
          this.audio.playDropLand(drop.pos.distanceTo(this.pos), this.panFor(drop.pos.x, drop.pos.z));
          this.addFeed(`SUPPLY DROP LANDED — ${SUPPLIES[drop.kind].name.toUpperCase()}`);
        }
      } else {
        drop.life -= dt;
        drop.ping -= dt;
        if (drop.ping <= 0) {
          drop.ping = 3.2;
          const dd = Math.hypot(drop.pos.x - this.pos.x, drop.pos.z - this.pos.z);
          if (this.alive && dd < 140) this.audio.playBeacon(this.panFor(drop.pos.x, drop.pos.z));
        }
        drop.ring.rotation.z += dt * 0.7;
        const pulse = 0.5 + Math.sin(this.time * 3 + drop.pos.x) * 0.18;
        (drop.ring.material as THREE.MeshBasicMaterial).opacity = pulse;
        if (drop.life <= 0) {
          this.removeDrop(i);
          continue;
        }
        if (this.alive && Math.hypot(drop.pos.x - this.pos.x, drop.pos.z - this.pos.z) < this.cfg.radius + 2.8) {
          if (drop.kind === 'ammo' && !this.ordnance.missing) continue;
          this.applyDrop(drop.kind, drop.credits);
          this.removeDrop(i);
        }
      }
    }
  }

  private removeDrop(index: number) {
    const drop = this.drops[index];
    this.scene.remove(drop.group);
    drop.group.traverse((o) => {
      if (o instanceof THREE.Sprite) { o.material.map?.dispose();o.material.dispose();return; }
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
    });
    this.drops.splice(index, 1);
  }

  private applyDrop(kind: DropKind, credits = 0) {
    const s = this.stats;
    this.audio.playPickup();
    switch (kind) {
      case 'ammo':
        this.ordnance.rearm();
        this.addFeed(`REARMED · +1 PER MOUNT · Q MAX ${RACK_CAPACITIES.Q} / E MAX ${RACK_CAPACITIES.E}`);
        break;
      case 'repair': {
        const heal = Math.min(65 * s.pickupMul, this.maxHp - this.hp);
        if (heal > 1) {
          this.hp += heal;
          this.addFeed(`REPAIR KIT  +${Math.round(heal)} ARMOR`);
        } else {
          // hull already solid: overcharge the shield instead
          this.shieldHp = s.shieldMax;
          this.shieldBroken = false;
          this.shieldDelay = 0;
          this.shieldFlash = 0.5;
          this.addFeed('REPAIR KIT  —  SHIELD OVERCHARGED');
        }
        break;
      }
      case 'shield':
        this.shieldHp = s.shieldMax;
        this.shieldBroken = false;
        this.shieldDelay = 0;
        this.shieldFlash = 0.6;
        this.addFeed('SHIELD BATTERY  —  SHIELD FULL');
        break;
      case 'coins':
        this.lootCredits += credits;
        this.opts.onLoot?.(credits);
        this.addFeed(`CREDIT CACHE  +${credits} CR · BANKED`);
        break;
      case 'aegis':
        this.buffT.aegis = SALVAGE.aegisSeconds;
        this.addFeed('AEGIS ONLINE — INVULNERABLE FOR 6s');
        break;
      case 'overcharge':
        this.buffT.overcharge = SALVAGE.overchargeSeconds;
        this.addFeed('OVERCHARGE ROUNDS  —  +35% DAMAGE FOR 25s');
        break;
      case 'rapid':
        this.buffT.rapid = 25;
        this.addFeed('RAPID RELOAD - +35% FIRE RATE, NO HEAT FOR 25s');
        break;
      case 'emp': {
        let disabled = 0;
        for (const e of this.enemies) {
          if (e.alive && e.pos.distanceTo(this.pos) < 34) {
            e.stunTime = Math.max(e.stunTime, e.boss ? 2.5 : 5);
            disabled++;
          }
        }
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
          const pr = this.projectiles[i];
          if (pr.owner === 'enemy' && pr.pos.distanceTo(this.pos) < 34) {
            this.scene.remove(pr.mesh);
            this.projectiles.splice(i, 1);
          }
        }
        this.explosion(this.tmpA.set(this.pos.x, this.pos.y + 1, this.pos.z), 1.2);
        this.addFeed(`EMP CHARGE  —  ${disabled} HOSTILES DISABLED`);
        break;
      }
      case 'score':
        this.score += 600;
        this.addFeed('SCORE CHIP  +600 SCORE');
        break;
    }
  }

  // -------------------------------------------------------------------------
  // Wrecks & craters (battlefield persistence)
  // -------------------------------------------------------------------------
  private leaveWreck(e: Enemy) {
    const wreckMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 1, metalness: 0.2 });
    e.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.material = wreckMat;
    });
    e.group.rotation.x += rand(-0.18, 0.18);
    e.group.rotation.z += rand(-0.22, 0.22);
    e.group.position.y -= e.kind === 'heavy' ? 0.6 : 0.35;
    if (e.torso) e.torso.rotation.x = rand(0.3, 0.7);
    if(e.kind==='skimmer') e.group.position.y=heightAt(e.pos.x,e.pos.z);
    this.wrecks.push({ group: e.group, pos: e.pos.clone(), life: 28, smokeTimer: 0 });
    if (this.wrecks.length > 14) {
      const old = this.wrecks.shift()!;
      this.scene.remove(old.group);
    }
  }

  private updateWrecks(dt: number) {
    for (let i = this.wrecks.length - 1; i >= 0; i--) {
      const w = this.wrecks[i];
      w.life -= dt;
      w.smokeTimer -= dt;
      if (w.life > 10 && w.smokeTimer <= 0 && w.pos.distanceTo(this.pos) < 160) {
        w.smokeTimer = 0.22;
        this.smoke.emit({
          x: w.pos.x + rand(-1.5, 1.5), y: w.pos.y + 2 + rand(0, 1.5), z: w.pos.z + rand(-1.5, 1.5),
          vx: rand(-0.4, 0.4), vy: rand(1.5, 3), vz: rand(-0.4, 0.4),
          life: rand(1.8, 3), size0: 1.5, size1: 5, c0: [0.15, 0.14, 0.13], c1: [0.1, 0.1, 0.1], grav: -0.6, drag: 1, alpha: 0.4,
        });
        if (Math.random() < 0.35) {
          this.fire.emit({
            x: w.pos.x + rand(-1, 1), y: w.pos.y + 1.5, z: w.pos.z + rand(-1, 1), vx: 0, vy: rand(1, 2.5), vz: 0,
            life: rand(0.3, 0.6), size0: 1.2, size1: 0.3, c0: [1, 0.6, 0.2], c1: [1, 0.2, 0.05], grav: 0, drag: 1, alpha: 0.8,
          });
        }
      }
      if (w.life <= 0) {
        this.scene.remove(w.group);
        this.wrecks.splice(i, 1);
      } else if (w.life < 3) {
        w.group.position.y -= dt * 0.8; // sink into the sand
      }
    }
    for (let i = this.craters.length - 1; i >= 0; i--) {
      const c = this.craters[i];
      c.life -= dt;
      if (c.life < 6) (c.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, c.life / 6) * 0.55;
      if (c.life <= 0) {
        this.scene.remove(c.mesh);
        this.craters.splice(i, 1);
      }
    }
  }

  private addCrater(pos: THREE.Vector3, scale: number) {
    const gy = heightAt(pos.x, pos.z);
    if (pos.y > gy + 1.5) return;
    const mesh = new THREE.Mesh(this.geo.crater, new THREE.MeshBasicMaterial({ color: 0x120e0a, transparent: true, opacity: 0.55, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = rand(0, TWO_PI);
    mesh.position.set(pos.x, gy + 0.08 + this.craters.length * 0.0005, pos.z);
    mesh.scale.setScalar(scale * rand(2.2, 3.2));
    this.scene.add(mesh);
    this.craters.push({ mesh, life: 40 });
    if (this.craters.length > 40) {
      const old = this.craters.shift()!;
      this.scene.remove(old.mesh);
    }
  }

  private damagePlayer(dmgIn: number, from: THREE.Vector3) {
    if (!this.alive || this.buffT.aegis > 0) return;
    this.lastEnemyCombatTime = this.time;
    let dmg = dmgIn * (1 - this.stats.armor);
    if (this.stats.reactive > 0 && this.time - this.reactiveCd > 4) {
      this.reactiveCd = this.time;
      const radius = 13;
      const center = this.tmpA.set(this.pos.x, this.pos.y + 1.2, this.pos.z);
      this.explosion(center, 1.1);
      this.audio.playExplosion(0, false);
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const d = e.pos.distanceTo(this.pos) - e.radius;
        if (d < radius) this.damageEnemy(e, 34 * this.stats.reactive * (1 - Math.max(0, d) / radius * 0.6));
      }
      this.addFeed('REACTIVE ARMOR DETONATION');
    }
    this.shieldDelay = 5 * this.stats.shieldCdMul;
    if (!this.shieldBroken && this.shieldHp > 0) {
      const absorbed = Math.min(this.shieldHp, dmg);
      this.shieldHp -= absorbed;
      dmg -= absorbed;
      this.shieldFlash = 0.5;
      this.audio.playShieldHit();
      this.shake = Math.max(this.shake, 0.05);
      if (this.shieldHp <= 0) this.dropShield();
      if (dmg <= 0.01) return;
    }
    this.hp -= dmg;
    this.damageFlash = Math.min(1, this.damageFlash + 0.3 + dmg / 90);
    this.shake = Math.max(this.shake, 0.12 + dmg * 0.012);
    const ang = Math.atan2(from.x - this.pos.x, from.z - this.pos.z);
    this.damageDirs.push({ angle: wrapAngle(ang - this.turretYaw), time: this.time });
    if (this.damageDirs.length > 6) this.damageDirs.shift();
    this.audio.playPlayerHit();
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
  }

  private die() {
    this.alive = false;
    this.deathTimer = 0;
    this.speed = 0;
    this.mouse.left = this.mouse.right = false;
    const p = this.tmpA.copy(this.pos);
    p.y += 2;
    this.explosion(p, 2.6);
    this.audio.playExplosion(0, true);
    this.audio.stopEngine();
    this.audio.setWading(false);
    this.audio.setMusicIntensity(0.05);
    this.setMessage('HULL DESTROYED');
    this.opts.onPause(false);
    if (this.isLocked()) document.exitPointerLock();
  }

  // -------------------------------------------------------------------------
  // Projectiles
  // -------------------------------------------------------------------------
  private spawnProjectile(
    owner: 'player' | 'enemy',
    kind: 'shell' | 'bullet' | 'rocket',
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    damage: number,
    splash: number,
    gravity: number,
    life: number,
    homing: number,
    homingTarget: Enemy | null = null,
    burnPool = false,
  ) {
    let mesh: THREE.Mesh;
    if (kind === 'shell') mesh = new THREE.Mesh(this.geo.shell, owner === 'player' ? this.mats.playerShell : this.mats.enemyShell);
    else if (kind === 'bullet') mesh = new THREE.Mesh(this.geo.bullet, owner === 'player' ? this.mats.bullet : this.mats.enemyBullet);
    else mesh = new THREE.Mesh(this.geo.rocket, this.mats.rocket);
    mesh.position.copy(pos);
    if (kind !== 'shell') mesh.lookAt(this.tmpA.copy(pos).add(vel));
    this.scene.add(mesh);
    this.projectiles.push({ mesh, pos: pos.clone(), prev: pos.clone(), vel: vel.clone(), owner, kind, damage, splash, gravity, life, homing, trail: 0, homingTarget, origin: pos.clone(), whizzed: false, burnPool });
  }

  private segHitsSphere(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, r: number) {
    const d = this.tmpA.subVectors(b, a);
    const len2 = d.lengthSq();
    let t = 0;
    if (len2 > 1e-6) t = clamp(this.tmpB.subVectors(c, a).dot(d) / len2, 0, 1);
    const p = this.tmpB.copy(a).addScaledVector(d, t);
    return p.distanceToSquared(c) <= r * r;
  }

  private updateProjectiles(dt: number) {
    const ps = this.projectiles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.prev.copy(p.pos);
      if (p.homing > 0) {
        let tx = this.pos.x;
        let ty = this.pos.y + 1.6;
        let tz = this.pos.z;
        if (p.owner === 'player') {
          // aim assist: only pull toward a target that is still alive and roughly ahead
          const t = p.homingTarget;
          if (!t || !t.alive) {
            p.homing = 0;
          } else {
            tx = t.pos.x;
            ty = t.pos.y + t.height * 0.5;
            tz = t.pos.z;
          }
        } else if (!this.alive || this.isConcealed()) {
          p.homing = 0;
        }
        if (p.homing > 0) {
          const target = this.tmpA.set(tx, ty, tz).sub(p.pos).normalize();
          const spd = p.vel.length();
          const cur = this.tmpB.copy(p.vel).divideScalar(spd);
          cur.lerp(target, Math.min(1, p.homing * dt)).normalize();
          p.vel.copy(cur).multiplyScalar(spd);
        }
      }
      p.vel.y -= p.gravity * dt;
      // Clamp the swept segment before collision checks, so a long frame can
      // never let a projectile hit something beyond its advertised reach.
      const speed = p.vel.length();
      const travelTime = p.rangeLeft === undefined || speed <= 0
        ? dt
        : Math.min(dt, Math.max(0, p.rangeLeft) / speed);
      p.pos.addScaledVector(p.vel, travelTime);
      if (p.rangeLeft !== undefined) p.rangeLeft = Math.max(0, p.rangeLeft - p.prev.distanceTo(p.pos));
      p.life -= dt;
      if (p.owner === 'enemy' && !p.veiled && this.smokeClouds.some(c => crossesVeil(p.prev, p.pos, c))) {
        if (p.kind === 'bullet') {
          this.scene.remove(p.mesh);
          ps[i] = ps[ps.length - 1];
          ps.pop();
          continue;
        }
        p.veiled = true; // one attenuation per round, even through overlapping clouds
        p.damage *= SALVAGE.smokeDamage;
        p.homing = 0;
      }
      if (p.owner === 'enemy' && !p.whizzed && this.alive) {
        const near = p.pos.distanceTo(this.pos);
        if (near < 7 && near > this.cfg.radius) {
          p.whizzed = true;
          this.audio.playWhiz(this.panFor(p.pos.x, p.pos.z));
        }
      }
      p.mesh.position.copy(p.pos);
      if (p.kind !== 'shell') p.mesh.lookAt(this.tmpA.copy(p.pos).add(p.vel));

      if (p.kind !== 'bullet') {
        p.trail -= dt;
        if (p.trail <= 0) {
          p.trail = p.kind === 'rocket' ? 0.012 : 0.025;
          this.smoke.emit({
            x: p.pos.x, y: p.pos.y, z: p.pos.z,
            vx: rand(-0.6, 0.6), vy: rand(0.2, 1.2), vz: rand(-0.6, 0.6),
            life: rand(0.5, 1.0), size0: p.kind === 'rocket' ? 0.9 : 0.6, size1: p.kind === 'rocket' ? 2.8 : 1.8,
            c0: [0.5, 0.48, 0.45], c1: [0.25, 0.25, 0.25], grav: -0.5, drag: 1.5, alpha: 0.45,
          });
          if (p.kind === 'rocket') {
            this.fire.emit({
              x: p.pos.x, y: p.pos.y, z: p.pos.z, vx: -p.vel.x * 0.1, vy: -p.vel.y * 0.1, vz: -p.vel.z * 0.1,
              life: 0.15, size0: 1.2, size1: 0.2, c0: [1, 0.8, 0.4], c1: [1, 0.3, 0.05], grav: 0, drag: 0, alpha: 1,
            });
          }
        }
      }

      let hit = false;
      let directEnemy: Enemy | null = null;
      let directPlayer = false;
      let directBarrel: ExplosiveBarrel | null = null;
      const groundY = heightAt(p.pos.x, p.pos.z);
      if (p.pos.y <= groundY) {
        p.pos.y = groundY;
        hit = true;
      }
      if (!hit) {
        for (const barrel of this.explosiveBarrels) {
          if (!barrel.destroyed && this.segHitsSphere(p.prev, p.pos, barrel.pos, 1.25)) {
            directBarrel = barrel;
            hit = true;
            break;
          }
        }
      }
      if (!hit) {
        // Sweep from the muzzle even at point-blank range: a shot must not skip a breach wall.
        {
          let first = Infinity;
          const step = p.prev.distanceTo(p.pos);
          for (const o of nearObstacles((p.prev.x+p.pos.x)/2,(p.prev.z+p.pos.z)/2,step/2+1)) {
            if (o.box) first = Math.min(first, boxImpact(o,p.prev,p.pos));
            else if (p.pos.y < o.y0+o.h && obsDist(o,p.pos.x,p.pos.z)<0) first = Math.min(first,1);
          }
          if (first <= 1) { hit=true; p.pos.lerp(p.prev,1-first); }
        }
      }
      if (!hit) {
        if (p.owner === 'player') {
          for (const e of this.enemies) {
            if (!e.alive) continue;
            const center = this.tmpC.set(e.pos.x, e.pos.y + e.height * 0.5, e.pos.z);
            if (this.segHitsSphere(p.prev, p.pos, center, e.radius)) {
              directEnemy = e;
              hit = true;
              break;
            }
          }
          if (!hit && this.opts?.onCheckInstallationHit && this.opts.onCheckInstallationHit(p.prev, p.pos, p.damage, p.splash)) {
            hit = true;
          }
        } else if (this.alive) {
          const center = this.tmpC.set(this.pos.x, this.pos.y + 1.5, this.pos.z);
          if (this.segHitsSphere(p.prev, p.pos, center, this.cfg.radius * 0.95)) {
            directPlayer = true;
            hit = true;
          }
        }
      }

      let remove = false;
      if (hit) {
        if (directBarrel) {
          this.damageBarrel(directBarrel, p.damage);
          if (p.kind === 'bullet') this.sparks(p.pos, 0.6);
          else this.impact(p, null, false);
        } else {
          this.impact(p, directEnemy, directPlayer);
        }
        remove = true;
      } else if (p.life <= 0 || (p.rangeLeft !== undefined && p.rangeLeft <= 0.00001) || p.pos.x * p.pos.x + p.pos.z * p.pos.z > (WORLD_RADIUS + 60) * (WORLD_RADIUS + 60)) {
        remove = true;
      }
      if (remove) {
        this.scene.remove(p.mesh);
        ps[i] = ps[ps.length - 1];
        ps.pop();
      }
    }
  }

  /** EMP clears the current attack/lock and grants temporary resistance. */
  private disruptEnemy(enemy: Enemy, chained = false) {
    if (!enemy.alive || enemy.empResistance > 0) return false;
    const duration = chained
      ? enemy.boss ? EMP.chainBossStun : EMP.chainStun
      : enemy.boss ? EMP.bossStun : EMP.stun;
    enemy.stunTime = Math.max(enemy.stunTime, duration);
    enemy.empResistance = EMP.resistance;
    enemy.moving = false;
    enemy.burst = 0;
    enemy.lockTimer = 0;
    enemy.canSee = false;
    if (enemy.laser) enemy.laser.visible = false;
    this.elementBurst(this.enemyCenter(enemy), 'electric', 12);
    return true;
  }

  private impact(p: Projectile, directEnemy: Enemy | null, directPlayer: boolean) {
    const pos = p.pos;
    const distToPlayer = pos.distanceTo(this.pos);
    if (p.weapon === 'cryoball') {
      this.frostBurst(pos);
      return;
    }
    let damage = p.damage;
    if (p.weapon === 'scatter') damage *= clamp(1.2 - p.origin.distanceTo(pos) / 85, 0.35, 1);
    if (directEnemy && p.weapon === 'coil' && this.evolved('coil') && (directEnemy.slowTime > 0 || directEnemy.stunTime > 0)) {
      damage *= 1.45;
      this.elementBurst(this.enemyCenter(directEnemy), 'ice', 8);
    }
    if (directEnemy && p.weapon === 'scatter' && this.evolved('scatter')) {
      directEnemy.burnTime = 3;
      directEnemy.burnDps = 8;
    }
    if (directEnemy && p.weapon === 'emp') {
      if (this.disruptEnemy(directEnemy)) {
        this.addFeed('EMP HIT — TARGET DISRUPTED');
        this.audio.playArc(distToPlayer, this.panFor(pos.x, pos.z));
      }
      if (this.evolved('emp')) {
        const from = this.enemyCenter(directEnemy);
        const linked = this.linkTarget(from, new Set([directEnemy]), EMP.chainRange);
        if (linked) {
          this.weaponFx.beam(from, this.enemyCenter(linked), 0x7bf0e8, 0.06, 0.25, true);
          this.disruptEnemy(linked, true);
          this.damageEnemy(linked, damage * 0.5);
        }
      }
    }
    if (directEnemy && p.charged) {
      const from = this.enemyCenter(directEnemy);
      const linked = this.linkTarget(from, new Set([directEnemy]), 18);
      if (linked) {
        this.weaponFx.beam(from, this.enemyCenter(linked), 0x7bf0e8, 0.045, 0.22, true);
        this.damageEnemy(linked, 14);
      }
    }
    if (p.kind === 'bullet') {
      if (directEnemy) {
        this.damageEnemy(directEnemy, damage * impactMultiplier(directEnemy.kind, p.kind));
        this.sparks(pos, 0.7);
      } else if (directPlayer) {
        this.damagePlayer(p.damage, pos);
        this.sparks(pos, 0.4);
      } else {
        this.dust(pos, 0.5);
        if (p.owner === 'enemy' && distToPlayer < 12) this.sparks(pos, 0.3);
      }
      return;
    }
    // Both sides can demolish cover. Armor-piercing bullets remain anti-unit.
    const breach = p.owner==='player' ? this.firepower * (1 + 0.5*(this.taken.get('breacher')??0)) : 1;
    for (const h of this.mapApi.structures.blast(pos,Math.max(2,p.splash),damage*breach)) {
      if (h.remaining===0) {
        this.dust(new THREE.Vector3(h.o.x,h.o.y0+1,h.o.z),4);
        this.addFeed(`${h.name} COLLAPSED — LANE OPEN`);
      } else if (p.owner==='player') this.addFeed(`${h.name} · ${h.remaining}% INTEGRITY`);
    }
    // shells & rockets
    const big = p.splash > 12;
    this.explosion(pos, big ? 2.2 : p.kind === 'rocket' ? 1.35 : 1.0);
    this.audio.playExplosion(distToPlayer, big, this.panFor(pos.x, pos.z));
    if (!directEnemy && !directPlayer) this.addCrater(pos, big ? 2.2 : 1);
    if (p.weapon === 'cinder') this.addBurn(pos,p.splash,this.evolved('cinder') ? 10 : 6);
    else if (p.burnPool) this.addBurn(pos, this.evolved('mortar') ? 11 : 7, this.evolved('mortar') ? 10 : 6);
    if (p.owner === 'player' && p.kind === 'shell' && this.stats.cluster > 0) {
      for (let i = 0; i < 6; i++) {
        const vel = new THREE.Vector3(rand(-1, 1), rand(0.35, 1), rand(-1, 1)).normalize().multiplyScalar(rand(18, 32));
        this.spawnProjectile('player', 'bullet', pos.clone().add(new THREE.Vector3(0, 0.5, 0)), vel, p.damage * 0.3, 0, 9, 1.4, 0);
      }
    }
    for (const barrel of this.explosiveBarrels) {
      if (!barrel.destroyed && barrel.pos.distanceTo(pos) < p.splash + 2) this.damageBarrel(barrel, p.damage);
    }
    if (p.owner === 'player') {
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (p.weapon === 'cannon' && this.evolved('cannon') && (e === directEnemy || e.pos.distanceTo(pos) - e.radius < p.splash)) {
          e.stunTime = Math.max(e.stunTime, e.boss ? 0.3 : 0.85);
          this.elementBurst(this.enemyCenter(e), 'electric', 6);
        }
        if (e === directEnemy) {
          this.damageEnemy(e, damage * impactMultiplier(e.kind, p.kind));
          continue;
        }
        const d = Math.hypot(e.pos.x - pos.x, (e.pos.y + e.height * 0.5) - pos.y, e.pos.z - pos.z) - e.radius;
        if (d < p.splash) this.damageEnemy(e, damage * impactMultiplier(e.kind, p.kind) * 0.7 * (1 - Math.max(0, d) / p.splash));
      }
    } else if (this.alive) {
      if (directPlayer) this.damagePlayer(p.damage, pos);
      else {
        const d = distToPlayer - this.cfg.radius;
        if (d < p.splash) this.damagePlayer(p.damage * 0.65 * (1 - Math.max(0, d) / p.splash), pos);
      }
    }
  }

  private damageBarrel(barrel: ExplosiveBarrel, damage: number) {
    if (barrel.destroyed) return;
    barrel.hp -= damage;
    if (barrel.hp > 0) return;
    barrel.destroyed = true;
    this.scene.remove(barrel.group);
    const center = barrel.pos.clone();
    const radius = 11;
    this.explosion(center, 1.8);
    this.audio.playExplosion(center.distanceTo(this.pos), true, this.panFor(center.x, center.z));
    this.addCrater(center, 1.4);
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const distance = Math.hypot(enemy.pos.x - center.x, enemy.pos.z - center.z);
      if (distance < radius + enemy.radius) this.damageEnemy(enemy, 80 * (1 - Math.min(1, distance / (radius + enemy.radius)) * 0.65), false);
    }
    const playerDistance = Math.hypot(this.pos.x - center.x, this.pos.z - center.z);
    if (playerDistance < radius + this.cfg.radius) this.damagePlayer(50 * (1 - playerDistance / (radius + this.cfg.radius) * 0.65), center);
    for (const other of this.explosiveBarrels) {
      if (!other.destroyed && other.pos.distanceTo(center) < radius) this.damageBarrel(other, 30);
    }
    this.addFeed('FUEL DRUM DETONATED');
  }

  // -------------------------------------------------------------------------
  // Enemies
  // -------------------------------------------------------------------------
  private spawnEnemy(kind: EnemyKind, fx?: number, fz?: number, boss = false, elite = false) {
    const cfg = ENEMIES[kind];
    let x = fx ?? 0;
    let z = fz ?? 0;
    let ok = fx !== undefined && fz !== undefined;
    for (let t = 0; t < 40 && !ok; t++) {
      const a = rand(0, TWO_PI);
      const d = rand(115, 175);
      x = this.pos.x + Math.sin(a) * d;
      z = this.pos.z + Math.cos(a) * d;
      if (Math.hypot(x, z) > this.arenaR - 14) continue;
      if (this.obstacles.some((o) => obsDist(o, x, z) < cfg.radius + 3)) continue;
      ok = true;
    }
    if (!ok) {
      const a = rand(0, TWO_PI);
      x = Math.sin(a) * 150;
      z = Math.cos(a) * 150;
    }
    const palette = boss ? BOSS_PALETTE : PALETTES[kind];
    const built: TankMesh | SapperMesh | MechMesh = kind === 'skimmer' ? createSkimmerMesh(palette) : kind === 'sapper' ? createSapperMesh(palette) : kind === 'tank' || kind === 'bastion' || kind === 'sniper' ? createTankMesh(palette) : createMechMesh(palette, kind === 'heavy');
    // capture structural parts up front — later narrowing branches would otherwise poison these types
    const turretOf = 'turret' in built ? built.turret : null;
    const torsoOf = 'torso' in built ? built.torso : null;
    const legsOf: THREE.Object3D[] = 'legs' in built ? (built as MechMesh).legs : [];
    let laser: THREE.Line | null = null;
    if (kind === 'sniper' && 'turret' in built) {
      // long barrel + sensor mast
      const longBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 8.5, 10), new THREE.MeshStandardMaterial({ color: 0x1b2328, roughness: 0.8, metalness: 0.3 }));
      longBarrel.rotation.x = Math.PI / 2;
      longBarrel.position.set(0, 0.5, 6.2);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.6, 6), longBarrel.material);
      mast.position.set(-1.1, 2.2, -1.2);
      const mastEye = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), new THREE.MeshStandardMaterial({ color: 0x3dff7a, emissive: 0x3dff7a, emissiveIntensity: 3 }));
      mastEye.position.set(-1.1, 3.5, -1.2);
      built.turret.add(longBarrel, mast, mastEye);
      const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]);
      laser = new THREE.Line(lg, this.mats.laser);
      laser.visible = false;
      laser.frustumCulled = false;
      this.scene.add(laser);
    }
    if (kind === 'jackal' && 'torso' in built) {
      const container = new THREE.Mesh(new THREE.BoxGeometry(3.3, 2.2, 1.5), new THREE.MeshStandardMaterial({color:0xf0a534, metalness:0.55, roughness:0.5}));
      container.position.set(0,1.4,-1.6);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(2.9,0.27,1.55), new THREE.MeshBasicMaterial({color:0xffe565}));
      lamp.position.y = 0.74; container.add(lamp); built.torso.add(container);
    }
    if (kind === 'bastion' && 'turret' in built) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(5.8, 1.6, 0.7), built.flashMats[0]);
      plate.rotation.x = -0.22;
      plate.position.set(0, 1.8, 3.45);
      built.group.add(plate);
    } else if (kind === 'mender' && 'torso' in built) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.16, 6, 16), new THREE.MeshBasicMaterial({color: 0x67ffca}));
      coil.position.set(0, 2.8, -0.65);
      built.torso.add(coil);
    }
    if (boss) built.group.scale.setScalar(1.35);
    else if (elite) built.group.scale.setScalar(1.18);
    const { bar, fg } = createBar();
    if (kind === 'heavy') bar.scale.setScalar(boss ? 2.4 : 1.6);
    const yaw = Math.atan2(this.pos.x - x, this.pos.z - z);
    const scale = (1 + (this.wave - 1) * 0.065) * (boss ? 1.85 : 1) * (elite ? 1.7 : 1);
    const e: Enemy = {
      kind,
      cfg: boss ? { ...cfg, name: BOSS_NAME, score: cfg.score * 4, cooldown: cfg.cooldown * 0.85, burstCount: cfg.burstCount + 1, speed: cfg.speed * 1.05 } : elite ? { ...cfg, name: `ELITE ${cfg.name}`, score: Math.round(cfg.score * 2.5), cooldown: cfg.cooldown * 0.85 } : cfg,
      group: built.group,
      pos: new THREE.Vector3(x, heightAt(x, z) + (kind==='skimmer' ? 7 : 0), z),
      yaw,
      aimYaw: yaw,
      hp: cfg.hp * scale,
      maxHp: cfg.hp * scale,
      dmgMul: (1 + (this.wave - 1) * 0.04) * (boss ? 1.10 : 1),
      boss,
      elite,
      cargo: 0,
      repairTimer: 3,
      lockTimer: 0,
      laser,
      slowTime: 0,
      burnTime: 0,
      burnDps: 0,
      cryoCharge: 0,
      freezeLock: 0,
      brittleTime: 0,
      stunTime: 0,
      empResistance: 0,
      aware: false,
      warned: false,
      canSee: false,
      blindFire: false,
      losTimer: rand(0, 0.3),
      lostTimer: 0,
      searchPos: new THREE.Vector3(this.pos.x + rand(-45, 45), 0, this.pos.z + rand(-45, 45)),
      intelTimer: rand(8, 14),
      stuckT: 0,
      lastX: x,
      lastZ: z,
      detourT: 0,
      detourYaw: 0,
      state: 'approach',
      stateTimer: rand(1, 3),
      strafeDir: Math.random() < 0.5 ? -1 : 1,
      fireCooldown: rand(1.5, 3.5),
      burst: 0,
      burstTimer: 0,
      side: 1,
      turret: turretOf,
      torso: torsoOf,
      legs: legsOf,
      walkPhase: rand(0, TWO_PI),
      moving: false,
      hitFlash: 0,
      flashMats: built.flashMats,
      bar,
      barFg: fg,
      radius: cfg.radius,
      height: cfg.height,
      alive: true,
    };
    e.group.position.copy(e.pos);
    e.group.rotation.y = yaw;
    this.scene.add(e.group, bar);
    this.enemies.push(e);
    this.dust(e.pos, 2.5);
  }

  private losCand: Obstacle[] = [];
  /** True if a straight line from `from` (+fromH) to `to` (+toH) clears terrain and buildings. */
  private hasLOS(from: THREE.Vector3, to: THREE.Vector3, fromH = 3, toH = 2) {
    const fy = from.y + fromH;
    const ty = to.y + toH;
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 2) return true;
    const cand = this.losCand;
    cand.length = 0;
    for (const o of this.obstacles) {
      const ox = o.x - from.x;
      const oz = o.z - from.z;
      const t = clamp((ox * dx + oz * dz) / (dist * dist), 0, 1);
      const px = from.x + dx * t - o.x;
      const pz = from.z + dz * t - o.z;
      if (px * px + pz * pz < o.r * o.r) cand.push(o);
    }
    const steps = Math.ceil(dist / 3);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = from.x + dx * t;
      const z = from.z + dz * t;
      const y = fy + (ty - fy) * t;
      if (heightAt(x, z) > y) return false;
      for (const o of cand) if (y < o.y0 + o.h && obsDist(o, x, z) < 0) return false;
    }
    return true;
  }

  private enemyShoot(e: Enemy, blind = false) {
    const f = fwd(e.aimYaw, this.tmpA);
    const r = rightOf(e.aimYaw, this.tmpB);
    const muzzle = this.tmpC.copy(e.pos);
    let speed: number;
    let gravity = 0;
    let spread: number;
    const sc = e.boss ? 1.35 : 1;
    if (e.kind === 'tank' || e.kind === 'bastion') {
      muzzle.addScaledVector(f, 7.2);
      muzzle.y += 2.35;
      speed = 95;
      gravity = SHELL_GRAVITY * 0.8;
      spread = 0.028;
    } else if (e.kind === 'sniper') {
      muzzle.addScaledVector(f, 10.2);
      muzzle.y += 2.35;
      speed = 230;
      spread = 0.006;
    } else if (e.kind === 'skimmer') {
      muzzle.addScaledVector(f,2); muzzle.y += 0.8; speed=145; spread=0.064;
    } else if (e.kind === 'mech' || e.kind === 'mender' || e.kind === 'jackal') {
      muzzle.addScaledVector(f, 3.9).addScaledVector(r, e.side * 1.8);
      muzzle.y += 3.75;
      speed = 175;
      spread = 0.045;
    } else {
      muzzle.addScaledVector(f, 1.2 * sc).addScaledVector(r, e.side * 3.15 * sc);
      muzzle.y += 7.0 * sc;
      speed = 52;
      spread = 0.06;
    }
    e.side *= -1;
    spread *= 1.25 - Math.min(0.4, this.wave * 0.035);
    // aim with lead and ballistic elevation
    const pv = this.playerVelocity(this.tmpD);
    const target = new THREE.Vector3(this.pos.x, this.pos.y + 1.4, this.pos.z);
    const dist = target.distanceTo(muzzle);
    if (blind) {
      target.set(e.searchPos.x + rand(-8, 8), heightAt(e.searchPos.x, e.searchPos.z) + 1.4, e.searchPos.z + rand(-8, 8));
      spread += 0.08;
    } else target.addScaledVector(pv, (dist / speed) * 0.7);
    const dir = target.sub(muzzle);
    const horiz = Math.hypot(dir.x, dir.z);
    dir.normalize();
    if (gravity > 0) dir.y += (gravity * horiz) / (2 * speed * speed);
    dir.x += rand(-spread, spread);
    dir.y += rand(-spread, spread) * 0.6;
    dir.z += rand(-spread, spread);
    dir.normalize().multiplyScalar(speed);
    const dm = e.dmgMul * this.enemyDmgMul;
    if (e.kind === 'tank' || e.kind === 'bastion') this.spawnProjectile('enemy', 'shell', muzzle, dir, 17 * dm, 5, gravity, 6, 0);
    else if (e.kind === 'sniper') {
      this.spawnProjectile('enemy', 'shell', muzzle, dir, 34 * dm, 2.5, 0, 3, 0);
      const m = this.projectiles[this.projectiles.length - 1].mesh as THREE.Mesh;
      m.material = this.mats.sniperShell;
      m.scale.set(0.7, 0.7, 2.5);
    } else if (e.kind === 'mech' || e.kind === 'mender' || e.kind === 'jackal' || e.kind === 'skimmer') this.spawnProjectile('enemy', 'bullet', muzzle, dir, 3.5 * dm, 0, 0, 1.6, 0);
    else this.spawnProjectile('enemy', 'rocket', muzzle, dir, 22 * dm, 9, 0, 5.5, blind ? 0 : 0.85);
    this.muzzleFlash(muzzle, this.tmpA.copy(dir).normalize(), e.kind === 'mech' ? 0.3 : 0.8);
    this.audio.playEnemyShot(e.kind === 'mender' || e.kind === 'jackal' || e.kind === 'skimmer' || e.kind === 'sapper' ? 'mech' : e.kind === 'bastion' ? 'tank' : e.kind, muzzle.distanceTo(this.pos), this.panFor(muzzle.x, muzzle.z));
  }

  private updateEnemies(dt: number) {
    if (this.enemies.some((e) => !e.alive)) this.enemies = this.enemies.filter((e) => e.alive);
    const es = this.enemies;
    for (const e of es) {
      const cfg = e.cfg;
      e.freezeLock = Math.max(0, e.freezeLock - dt);
      e.brittleTime = Math.max(0, e.brittleTime - dt);
      e.empResistance = Math.max(0, e.empResistance - dt);
      if (e.burnTime > 0 && e.alive) {
        e.burnTime -= dt;
        const burnTick = e.burnDps * this.firepower * this.lastStandMul() * dt;
        e.hp -= burnTick;
        this.floaters.addDamage(e, this.floaterAnchor.set(e.pos.x, e.pos.y + e.height * 0.7, e.pos.z), burnTick, false);
        e.hitFlash = Math.max(e.hitFlash, 0.4);
        if (Math.random() < dt * 9) {
          this.fire.emit({
            x: e.pos.x + rand(-1, 1), y: e.pos.y + rand(1, e.height), z: e.pos.z + rand(-1, 1),
            vx: rand(-0.5, 0.5), vy: rand(2, 4), vz: rand(-0.5, 0.5),
            life: rand(0.3, 0.6), size0: 1.1, size1: 0.3, c0: [1, 0.6, 0.2], c1: [1, 0.2, 0.05], grav: -1, drag: 1, alpha: 0.85,
          });
        }
        if (e.hp <= 0) {
          this.killEnemy(e);
          continue;
        }
      }
      if (e.stunTime > 0) {
        e.stunTime = Math.max(0, e.stunTime - dt);
        e.moving = false;
        e.burst = 0;
        e.lockTimer = 0;
        e.canSee = false;
        continue;
      }
      const dx = this.pos.x - e.pos.x;
      const dz = this.pos.z - e.pos.z;
      const dist = Math.hypot(dx, dz);
      const angToPlayer = Math.atan2(dx, dz);
      const sapper = e.kind === 'sapper';
      // sappers announce themselves once, early, while there is still time to react
      if (sapper && !e.warned && dist < 52) {
        e.warned = true;
        this.addFeed('SAPPER RUNNING HOT — BREAK OFF OR BURN IT');
        this.audio.playLockWarning();
      }

      if (e.kind === 'mender' && (e.repairTimer -= dt) <= 0) {
        e.repairTimer = 1;
        const ally = es.find(o => o !== e && o.alive && o.hp < o.maxHp && o.pos.distanceToSquared(e.pos) < 42 ** 2 && this.hasLOS(e.pos, o.pos, 3, 2));
        if (ally) {
          ally.hp = Math.min(ally.maxHp, ally.hp + 16);
          this.weaponFx.beam(this.enemyCenter(e), this.enemyCenter(ally), 0x69ffbb, 0.16, 0.5, false);
          e.repairTimer = 4;
        }
      }
      // ---- perception: units only engage what they can actually see ----
      e.losTimer -= dt;
      if (e.losTimer <= 0) {
        e.losTimer = rand(0.2, 0.35);
        const range = cfg.fireRange * this.condition.sight * (e.aware ? 1.15 : 0.85);
        const eye = this.tmpC.copy(e.pos); eye.y += e.height * 0.85;
        const pilot = this.tmpD.copy(this.pos); pilot.y += 2.2;
        const veiled = this.smokeClouds.some(c => crossesVeil(eye, pilot, c));
        const clear = this.alive && dist < range && this.hasLOS(e.pos, this.pos, e.height * 0.85, 2.2);
        e.canSee = clear && !veiled;
        e.blindFire = clear && veiled && e.aware;
      }
      if (e.canSee) {
        if (!e.aware) {
          e.aware = true;
          e.fireCooldown = Math.max(e.fireCooldown, rand(0.8, 1.4)); // reaction time
          if (this.time - this.spottedMsgTime > 6) {
            this.spottedMsgTime = this.time;
            this.addFeed(`SPOTTED BY ${e.cfg.name.toUpperCase()}`);
          }
        }
        e.lostTimer = 0;
        e.searchPos.set(this.pos.x, 0, this.pos.z);
      } else if (e.aware) {
        e.lostTimer += dt;
        if (e.lostTimer > 7) e.aware = false;
      }
      if (!e.aware) e.blindFire = false;
      // command "intel": periodic rough fixes on the player's area keep the sweep converging
      e.intelTimer -= dt;
      if (e.intelTimer <= 0) {
        e.intelTimer = rand(10, 16);
        if (!e.aware) e.searchPos.set(this.pos.x + rand(-40, 40), 0, this.pos.z + rand(-40, 40));
      }

      if (!sapper) e.stateTimer -= dt;
      if (!e.canSee && this.alive && !sapper) {
        e.state = 'approach';
      } else if (e.stateTimer <= 0) {
        e.stateTimer = rand(1.5, 3.5);
        if (dist > cfg.preferredRange * 1.35) e.state = 'approach';
        else if (dist < cfg.preferredRange * 0.5) e.state = e.kind === 'tank' ? 'hold' : 'retreat';
        else {
          e.state = Math.random() < 0.7 ? 'strafe' : 'hold';
          e.strafeDir = Math.random() < 0.5 ? -1 : 1;
        }
      }
      if (!this.alive) e.state = 'hold';

      let desiredYaw = angToPlayer;
      let moveSpeed = cfg.speed;
      if (!e.canSee && this.alive && !sapper) {
        // hunt: move to the last known / suspected position
        const sx = e.searchPos.x - e.pos.x;
        const sz = e.searchPos.z - e.pos.z;
        const sd = Math.hypot(sx, sz);
        desiredYaw = Math.atan2(sx, sz);
        moveSpeed = cfg.speed * (e.aware ? 1 : 0.7);
        if (sd < 14) {
          // reached it: sweep a new point around the area
          const a = rand(0, TWO_PI);
          e.searchPos.set(e.searchPos.x + Math.sin(a) * 35, 0, e.searchPos.z + Math.cos(a) * 35);
          const dc = Math.hypot(e.searchPos.x, e.searchPos.z);
          if (dc > this.arenaR - 25) e.searchPos.multiplyScalar((this.arenaR - 25) / dc);
        }
      }
      switch (!e.canSee && this.alive ? 'hunt' : e.state) {
        case 'approach':
          break;
        case 'strafe':
          desiredYaw = angToPlayer + e.strafeDir * Math.PI * 0.5;
          moveSpeed *= 0.75;
          break;
        case 'retreat':
          desiredYaw = angToPlayer + Math.PI;
          moveSpeed *= 0.8;
          break;
        case 'hold':
          moveSpeed = 0;
          break;
      }
      if (sapper) {
        desiredYaw = angToPlayer;
        moveSpeed = this.alive ? cfg.speed * (dist < 28 ? 1.3 : 1) : 0;
        e.state = 'approach';
      }
      if (e.kind === 'jackal' && this.alive) {
        // Runners can carry only one cache. Preserve the exact stolen value.
        const cache = e.cargo ? undefined : this.drops.reduce<SupplyDrop | undefined>((best, d) =>
          d.kind === 'coins' && !d.falling && (!best || e.pos.distanceToSquared(d.pos) < e.pos.distanceToSquared(best.pos)) ? d : best, undefined);
        if (cache) {
          desiredYaw = Math.atan2(cache.pos.x - e.pos.x, cache.pos.z - e.pos.z);
          moveSpeed = cfg.speed;
          if (e.pos.distanceToSquared(cache.pos) < 25) {
            e.cargo = cache.credits;
            this.removeDrop(this.drops.indexOf(cache));
            this.addFeed(`JACKAL STOLE ${e.cargo} CR — INTERCEPT TO RECOVER`);
          }
        } else if (e.cargo && dist < 95) {
          desiredYaw = angToPlayer + Math.PI;
          moveSpeed = cfg.speed;
        }
      }
      if (e.kind !== 'skimmer' && inWater(e.pos.x, e.pos.z)) moveSpeed *= 0.72;

      // obstacle avoidance via probe
      const f = fwd(e.yaw, this.tmpA);
      const probeX = e.pos.x + f.x * 14;
      const probeZ = e.pos.z + f.z * 14;
      const rgt = rightOf(e.yaw, this.tmpB);
      void probeX; void probeZ; void rgt;
      const clearance = (yaw: number, d: number) => {
        const cx = e.pos.x + Math.sin(yaw) * d;
        const cz = e.pos.z + Math.cos(yaw) * d;
        let m = Infinity;
        for (const o of nearObstacles(cx, cz, 4)) {
          if (e.kind === 'skimmer' && o.y0+o.h < e.pos.y) continue;
          const dd = obsDist(o, cx, cz);
          if (dd < m) m = dd;
        }
        return m;
      };
      const need = e.radius + 1.5;
      if (e.detourT > 0) {
        e.detourT -= dt;
        desiredYaw = e.detourYaw;
        moveSpeed = Math.max(moveSpeed, cfg.speed * 0.8);
      } else if (moveSpeed > 0 && (clearance(desiredYaw, 12) < need || clearance(desiredYaw, 6) < need)) {
        // pick the nearest free heading around the obstacle (prefers the current flank side)
        for (const off of [0.45, 0.9, 1.4, 2.0, 2.6]) {
          let found = false;
          for (const sgn of [e.strafeDir, -e.strafeDir]) {
            const y2 = desiredYaw + off * sgn;
            if (clearance(y2, 12) >= need && clearance(y2, 6) >= need) {
              desiredYaw = y2;
              found = true;
              break;
            }
          }
          if (found) break;
        }
      }
      if (Math.hypot(probeX, probeZ) > this.arenaR - 8) desiredYaw = Math.atan2(-e.pos.x, -e.pos.z);

      if (e.slowTime > 0) {
        e.slowTime -= dt;
        moveSpeed *= Math.max(0.25, 0.58 - (this.stats.cryoSlowMul - 1) * 0.42);
        if (e.canSee) e.aimYaw = moveAngle(e.aimYaw, angToPlayer, cfg.aimRate * dt * 0.5);
      }
      e.yaw = moveAngle(e.yaw, desiredYaw, cfg.turnRate * dt);
      const facing = Math.abs(wrapAngle(desiredYaw - e.yaw));
      const canMove = moveSpeed > 0 && (facing < 0.7 || e.kind !== 'tank');
      e.moving = canMove;
      if (canMove) {
        fwd(e.yaw, f);
        e.pos.addScaledVector(f, moveSpeed * dt);
        e.walkPhase += dt * moveSpeed * (e.kind === 'heavy' ? 0.55 : 0.75);
      }
      const hover = e.kind === 'skimmer' ? 7 + 1.4*Math.sin(e.walkPhase*0.17+this.time*2) : 0;
      this.collideCircle(e.pos,e.radius,hover ? heightAt(e.pos.x,e.pos.z)+hover : -Infinity);
      e.pos.y = heightAt(e.pos.x,e.pos.z)+hover;
      // stuck on geometry? take a short random detour
      e.stuckT += dt;
      if (e.stuckT > 1.6) {
        const moved = Math.hypot(e.pos.x - e.lastX, e.pos.z - e.lastZ);
        if (canMove && moved < 2.5 && e.detourT <= 0) {
          e.detourT = rand(1.2, 2.2);
          e.detourYaw = e.yaw + (Math.random() < 0.5 ? -1 : 1) * rand(1.4, 2.4);
          e.strafeDir *= -1;
        }
        e.stuckT = 0;
        e.lastX = e.pos.x;
        e.lastZ = e.pos.z;
      }
      // keep away from the player
      const pd = Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z);
      const minPD = e.radius + this.cfg.radius;
      // proximity fuse: a sapper closes all the way in — it does not hold off
      if (sapper && pd < e.radius + this.cfg.radius + 1.5) {
        this.killEnemy(e, false);
        continue;
      }
      if (pd < minPD && pd > 0.01 && !sapper) {
        const push = (minPD - pd) / pd;
        e.pos.x += (e.pos.x - this.pos.x) * push;
        e.pos.z += (e.pos.z - this.pos.z) * push;
      }

      // aim & fire
      const fireYaw = e.canSee ? angToPlayer : Math.atan2(e.searchPos.x - e.pos.x, e.searchPos.z - e.pos.z);
      e.aimYaw = moveAngle(e.aimYaw, e.aware ? fireYaw : e.yaw, cfg.aimRate * dt);
      e.fireCooldown -= dt;
      if (e.lockTimer > 0) {
        // sniper lock-on: visible laser, breaks if line of sight is lost
        e.lockTimer -= dt;
        if (!this.alive || !e.canSee) {
          e.lockTimer = 0;
          e.fireCooldown = 1.2;
        } else if (e.lockTimer <= 0) {
          this.enemyShoot(e);
          e.fireCooldown = cfg.cooldown * rand(0.85, 1.2);
        }
      } else if (e.burst > 0) {
        e.burstTimer -= dt;
        if (e.burstTimer <= 0) {
          e.burst--;
          e.burstTimer = cfg.burstInterval;
          if (e.canSee || e.blindFire) this.enemyShoot(e, !e.canSee);
        }
      } else if (this.alive && e.aware && e.fireCooldown <= 0 && dist < cfg.fireRange && Math.abs(wrapAngle(e.aimYaw - fireYaw)) < 0.09) {
        if (e.blindFire) {
          this.enemyShoot(e, true);
          e.fireCooldown = cfg.cooldown * rand(1.25, 1.75);
        } else if (e.canSee) {
          if (e.kind === 'sniper') {
            e.lockTimer = 1.2;
          } else {
            e.fireCooldown = cfg.cooldown * rand(0.85, 1.2);
            e.burst = cfg.burstCount;
            e.burstTimer = 0;
          }
        } else {
          e.fireCooldown = 0.5;
          if (e.state === 'hold') {
            e.state = 'strafe';
            e.stateTimer = 2;
          }
        }
      }
    }

    // separation between enemies
    for (let i = 0; i < es.length; i++) {
      for (let j = i + 1; j < es.length; j++) {
        const a = es[i];
        const b = es[j];
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        const min = a.radius + b.radius + 1;
        if (d < min && d > 0.01) {
          const push = ((min - d) / d) * 0.5;
          a.pos.x -= dx * push;
          a.pos.z -= dz * push;
          b.pos.x += dx * push;
          b.pos.z += dz * push;
        }
      }
    }

    // visuals
    for (const e of es) {
      e.group.position.copy(e.pos);
      e.group.rotation.y = e.yaw;
      const rel = wrapAngle(e.aimYaw - e.yaw);
      if (e.turret) e.turret.rotation.y = rel;
      if (e.torso) {
        e.torso.rotation.y = rel;
        e.torso.position.y = (e.kind === 'heavy' ? 2.95 * 1.75 : e.kind === 'sapper' ? 0.08 : 2.95) + Math.abs(Math.sin(e.walkPhase)) * (e.moving ? (e.kind === 'sapper' ? 0.06 : 0.18) : 0);
      }
      if (e.legs.length) {
        const amp = e.moving ? 0.55 : 0.08;
        e.legs[0].rotation.x = Math.sin(e.walkPhase) * amp;
        e.legs[1].rotation.x = -Math.sin(e.walkPhase) * amp;
      }
      if (e.stunTime > 0) {
        for (const m of e.flashMats) { m.emissive.setHex(0x4ce7ff); m.emissiveIntensity = 0.65 + Math.sin(this.time * 14) * 0.3; }
      } else if (e.slowTime > 0) {
        for (const m of e.flashMats) { m.emissive.setHex(0x4f92bc); m.emissiveIntensity = 0.3; }
      } else if (e.hitFlash > 0) {
        e.hitFlash = Math.max(0, e.hitFlash - dt * 7);
        for (const m of e.flashMats) { m.emissive.setHex(0xffffff); m.emissiveIntensity = e.hitFlash * 1.2; }
      } else {
        for (const m of e.flashMats) m.emissiveIntensity = 0;
      }
      if (e.laser) {
        e.laser.visible = e.lockTimer > 0;
        if (e.laser.visible) {
          const f = fwd(e.aimYaw, this.tmpA);
          const from = this.tmpB.set(e.pos.x + f.x * 10.5, e.pos.y + 2.85, e.pos.z + f.z * 10.5);
          const to = this.tmpC.set(this.pos.x, this.pos.y + 1.4, this.pos.z);
          const posAttr = e.laser.geometry.getAttribute('position') as THREE.BufferAttribute;
          posAttr.setXYZ(0, from.x, from.y, from.z);
          posAttr.setXYZ(1, to.x, to.y, to.z);
          posAttr.needsUpdate = true;
          (e.laser.material as THREE.LineBasicMaterial).opacity = 0.35 + (1 - e.lockTimer / 1.2) * 0.65;
        }
      }
      e.bar.position.set(e.pos.x, e.pos.y + e.height * (e.boss ? 1.35 : 1) + 1.3, e.pos.z);
      e.bar.quaternion.copy(this.camera.quaternion);
      const ratio = clamp(e.hp / e.maxHp, 0, 1);
      e.barFg.scale.x = Math.max(0.001, ratio);
      (e.barFg.material as THREE.MeshBasicMaterial).color.setHSL(ratio * 0.33, 1, 0.5);
      const dcam = e.pos.distanceTo(this.pos);
      e.bar.visible = dcam < 190 && (ratio < 1 || dcam < 90);
    }
  }

  private damageEnemy(e: Enemy, dmgIn: number, powered = true) {
    if (!e.alive) return;
    this.lastEnemyCombatTime = this.time;
    let dmg = dmgIn;
    if (!e.aware) {
      // ambush: hitting an unaware unit deals +60%
      dmg *= 1.6;
      this.ambushTime = this.time;
      if (this.time - this.ambushMsgTime > 1.5) {
        this.ambushMsgTime = this.time;
        this.addFeed('AMBUSH  +60% DAMAGE');
      }
    }
    this.alertUnit(e, 4);
    for (const o of this.enemies) if (o !== e && !o.aware && o.pos.distanceTo(e.pos) < 45) this.alertUnit(o, 4);
    let wasCrit = false;
    if (this.stats.critChance > 0 && Math.random() < this.stats.critChance) {
      dmg *= 2;
      wasCrit = true;
      this.critTime = this.time;
      this.audio.playCrit();
      this.sparks(this.tmpA.set(e.pos.x, e.pos.y + e.height * 0.5, e.pos.z), 1.5);
    } else {
      this.sparks(this.tmpA.set(e.pos.x + rand(-0.25, 0.25), e.pos.y + e.height * (0.35 + Math.random() * 0.35), e.pos.z + rand(-0.25, 0.25)), 0.6);
    }
    if (powered) dmg *= this.lastStandMul();
    if (e.brittleTime > 0) dmg *= 1.25;
    const dealt = dmg * (powered ? this.firepower : 1);
    e.hp -= dealt;
    this.floaters.addDamage(e, this.floaterAnchor.set(e.pos.x, e.pos.y + e.height * 0.65, e.pos.z), dealt, wasCrit);
    e.hitFlash = 1;
    this.hitMarkerTime = this.time;
    this.audio.playHitEnemy();
    if (e.hp <= 0) this.killEnemy(e);
  }

  /** Make a unit aware of the player's current position (noise, being shot at...). */
  private alertUnit(e: Enemy, forget: number) {
    if (!e.aware) {
      e.aware = true;
      e.lostTimer = forget;
      e.fireCooldown = Math.max(e.fireCooldown, 0.6);
    }
    if (!this.isConcealed()) e.searchPos.set(this.pos.x, 0, this.pos.z);
  }

  /** Weapon noise reveals your position to units within `radius`. */
  private makeNoise(radius: number) {
    for (const e of this.enemies) if (e.pos.distanceTo(this.pos) < radius) this.alertUnit(e, 3.5);
  }

  private killEnemy(e: Enemy, award = true) {
    if (!e.alive) return;
    e.alive = false;
    this.killTime = this.time;
    if (e.kind === 'sapper') this.sapperBlast(e, award ? 0.72 : 1);
    if (e.burnTime > 0 && this.evolved('flame')) {
      const point = this.enemyCenter(e);
      this.elementBurst(point, 'fire', 20);
      for (const other of this.enemies) {
        if (!other.alive || other === e || other.pos.distanceTo(e.pos) > 9) continue;
        other.burnTime = Math.max(other.burnTime, 2.5);
        other.burnDps = Math.max(other.burnDps, 7);
        this.beamHit(other, 24);
      }
    }
    const p = this.tmpD.set(e.pos.x, e.pos.y + e.height * 0.45, e.pos.z);
    this.explosion(p, e.boss ? 3.2 : e.kind === 'heavy' ? 2.4 : 1.5);
    this.audio.playExplosion(e.pos.distanceTo(this.pos), true, this.panFor(e.pos.x, e.pos.z));
    // kill streak: chained kills within 4s multiply score
    if (award) {
      if (this.time - this.streakTime < 4) this.streak++;
      else this.streak = 1;
      this.streakTime = this.time;
    }
    if (award && this.streak > 1) this.audio.playKillStreak(this.streak);
    if (award && this.stats.haste > 0 && this.streak >= 3) {
      this.buffT.haste = 8;
      if (this.streak === 3) this.addFeed('KILLSTREAK SURGE  +30% RELOAD  +20% SPEED');
    }
    const mult = this.stats.salvage * (1 + Math.min(4, this.streak - 1) * 0.25);
    const gained = Math.round(e.cfg.score * mult);
    if (award) {
      this.score += gained;
      this.kills++;
      this.opts?.onEnemyKilled?.({
        kind: e.kind,
        pos: { x: e.pos.x, z: e.pos.z },
        boss: e.boss,
        elite: e.elite,
      });
      this.power=Math.min(this.cfg.powerCapacity,this.power+8*(this.taken.get('induction')??0));
      this.addFeed(`${e.cfg.name.toUpperCase()} DESTROYED  +${gained}${this.streak > 1 ? `  ×${this.streak} STREAK` : ''}`);
      this.floaters.addScore(this.tmpA.set(e.pos.x, e.pos.y + e.height * 0.75, e.pos.z), gained, this.streak);
      if (this.stats.vampire > 0) this.hp = Math.min(this.maxHp, this.hp + this.stats.vampire);
    } else {
      this.addFeed(`${e.cfg.name.toUpperCase()} DETONATED`);
    }
    this.scene.remove(e.bar);
    e.bar.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
    });
    if (e.laser) {
      this.scene.remove(e.laser);
      e.laser.geometry.dispose();
    }
    this.leaveWreck(e);
    if (e.cargo) this.spawnDrop(e.pos.x, e.pos.z, 'coins', e.cargo);
    if (e.elite) {
      this.spawnDrop(e.pos.x, e.pos.z);
      this.addFeed('ELITE DOWN — SUPPLY POD INBOUND');
    }
    if (e.boss) {
      this.setMessage(`${BOSS_NAME} DESTROYED`);
      this.spawnPickup(e.pos.x + 4, e.pos.z);
      this.spawnPickup(e.pos.x - 4, e.pos.z);
    } else if (Math.random() < 0.22 * this.stats.pickupMul) this.spawnPickup(e.pos.x, e.pos.z);
  }

  /**
   * Ember Sapper cook-off. Damages everything in the blast — including other
   * hostiles, which rewards dragging a runner into its own formation. A
   * sapper put down by fire detonates at reduced force; a ram detonation is
   * full force. Aegis and shield behave as usual via damagePlayer.
   */
  private sapperBlast(e: Enemy, scale: number) {
    const center = this.enemyCenter(e);
    this.explosion(center, 1.15 + 1.05 * scale);
    this.flashLight(center, 30 + 22 * scale);
    this.audio.playExplosion(e.pos.distanceTo(this.pos), true, this.panFor(e.pos.x, e.pos.z));
    this.makeNoise(44);
    // burning fuel spray
    for (let i = 0; i < 16; i++) {
      this.fire.emit({
        x: center.x + rand(-1.5, 1.5), y: center.y + rand(-0.5, 1.5), z: center.z + rand(-1.5, 1.5),
        vx: rand(-5, 5), vy: rand(2, 8), vz: rand(-5, 5),
        life: rand(0.35, 0.8), size0: rand(1.0, 1.6), size1: 0.25, c0: [1, 0.62, 0.18], c1: [1, 0.22, 0.05], grav: -6, drag: 1.4, alpha: 0.9,
      });
    }
    const radius = 8 + 5 * scale;
    const d = Math.hypot(this.pos.x - e.pos.x, this.pos.z - e.pos.z);
    if (d < radius) {
      const fall = 1 - d / radius;
      this.damagePlayer(14 + 46 * Math.pow(fall, 1.35), e.pos);
    }
    for (const o of this.enemies) {
      if (o === e || !o.alive) continue;
      const od = o.pos.distanceTo(e.pos);
      if (od < radius) this.damageEnemy(o, 22 + 48 * (1 - od / radius), false);
    }
    this.shake = Math.max(this.shake, clamp(1.15 - d / 20, 0, 0.75));
  }

  // -------------------------------------------------------------------------
  // Pickups
  // -------------------------------------------------------------------------
  private spawnPickup(x: number, z: number) {
    const g = new THREE.Group();
    const box = new THREE.Mesh(this.geo.pickup, this.mats.pickup);
    const c1 = new THREE.Mesh(this.geo.cross1, this.mats.pickupCross);
    const c2 = new THREE.Mesh(this.geo.cross2, this.mats.pickupCross);
    const ring = new THREE.Mesh(this.geo.ring, this.mats.ring);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -1.2;
    box.castShadow = true;
    g.add(box, c1, c2, ring);
    g.position.set(x, heightAt(x, z) + 1.4, z);
    this.scene.add(g);
    this.pickups.push({ group: g, pos: new THREE.Vector3(x, heightAt(x, z), z), t: rand(0, TWO_PI) });
  }

  private updatePickups(dt: number) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.t += dt;
      p.group.position.y = p.pos.y + 1.5 + Math.sin(p.t * 2) * 0.25;
      p.group.rotation.y += dt * 1.2;
      if (this.alive && Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z) < this.cfg.radius + 1.6) {
        const heal = Math.min(55 * this.stats.pickupMul, this.maxHp - this.hp);
        this.hp += heal;
        this.addFeed(`REPAIR KIT  +${Math.round(heal)} ARMOR`);
        this.audio.playPickup();
        this.scene.remove(p.group);
        this.pickups.splice(i, 1);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Waves
  // -------------------------------------------------------------------------
  extractNow() {
    if (this.victoryPending && this.alive) this.victoryTimer = 0;
  }

  private updateWaves(dt: number) {
    if (!this.alive) return;
    // In campaign mode, random wave survival loops are disabled. Tactical military objectives control encounters.
    if (this.opts.campaignMode) return;
    // The reward draft waits for the celebration to land: the arena stays
    // live for a beat so the clear, the cheer and the wreck can breathe.
    if (this.victoryPending) {
      if (this.victoryTimer > STAGE_CLEAR_DELAY && !this.drops.some(d => d.kind === 'coins')) this.victoryTimer = STAGE_CLEAR_DELAY;
      this.victoryTimer -= dt;
      if (this.victoryTimer <= 0) {
        this.victoryPending = false;
        this.victoryTimer = 0;
        // A new sector is generated for every stage that is won.
        if (this.pendingArena > 0) {
          const stage = this.pendingArena;
          this.pendingArena = 0;
          this.rebuildArena(stage);
        }
        // One paused upgrade pick per wave, or two after a boss.
        this.grantOffer();
        if (this.wave % 5 === 0) this.grantOffer();
      }
      return;
    }
    if (!this.waveActive) {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0 && !this.victoryPending) this.startWave();
    } else if (this.enemies.length === 0) {
      this.waveActive = false;
      this.waveTimer = 6 - STAGE_CLEAR_DELAY;
      const bonus = this.wave * 250;
      this.score += bonus;
      this.setMessage(`STAGE ${this.wave} CLEARED — ${this.cfg.shortName} TAKES THE ROUND  +${bonus}`);
      this.audio.playWaveClear();
      this.audio.playCheer();
      this.addFeed('THE CROWD ROARS YOUR NAME');
      this.victoryPending = true;
      this.victoryTimer = this.waveTag === 'SALVAGE RUSH' && this.drops.some(d => d.kind === 'coins') ? 10 : STAGE_CLEAR_DELAY;
      this.dropTimer = Math.min(this.dropTimer, 10);
      // field repairs between waves: guarantee at least 50% max HP, or +35% max HP
      this.hp = Math.min(this.maxHp, Math.max(this.hp + this.maxHp * 0.35, this.maxHp * 0.5));
      this.shieldHp = this.stats.shieldMax;
      this.power = this.cfg.powerCapacity;
      this.shieldBroken = false;
      this.shieldDelay = 0;
      if (this.wave % 3 === 0 && this.zone < MAX_ZONE) this.expandPerimeter();
      // drop a repair kit near the player
      const a = rand(0, TWO_PI);
      const px = clamp(this.pos.x + Math.sin(a) * 18, -this.arenaR + 20, this.arenaR - 20);
      const pz = clamp(this.pos.z + Math.cos(a) * 18, -this.arenaR + 20, this.arenaR - 20);
      if (!this.obstacles.some((o) => obsDist(o, px, pz) < 2)) this.spawnPickup(px, pz);
      // The stage is won: the yard moves the mech on to a fresh sector.
      // The rebuild happens once the celebration has played out, so the
      // player gets to watch the last kill land before the world moves.
      this.pendingArena = this.wave;
    }
  }

  /** Push the perimeter outwards, revealing the next ring of districts. */
  private expandPerimeter() {
    const from = this.arenaTarget;
    this.zone++;
    this.arenaTarget = zoneRadius(this.zone);
    this.expandTime = this.time;
    const opened = this.layout.districts
      .filter((d) => {
        const dist = Math.hypot(d.x, d.z);
        return dist > from - 8 && dist <= this.arenaTarget - 8;
      })
      .map((d) => d.name);
    this.audio.playExpand();
    this.setMessage(`PERIMETER EXPANDING — ${Math.round(this.arenaTarget)}M`);
    this.addFeed(opened.length ? `NEW SECTORS: ${opened.join(' · ')}` : 'PERIMETER EXPANDED');
    // reward for pushing out: two supply pods land in the newly opened ring
    for (let i = 0; i < 2; i++) {
      const a = rand(0, TWO_PI);
      const dd = rand(from + 12, this.arenaTarget - 14);
      this.spawnDrop(Math.sin(a) * dd, Math.cos(a) * dd);
    }
    this.shake = Math.max(this.shake, 0.3);
  }

  /** Waves still to clear before the next perimeter expansion. */
  private wavesToExpand() {
    if (this.zone >= MAX_ZONE) return 0;
    const nextAt = this.waveActive ? Math.ceil(Math.max(1, this.wave) / 3) * 3 : (Math.floor(this.wave / 3) + 1) * 3;
    return nextAt - this.wave + (this.waveActive ? 1 : 0);
  }

  private startWave() {
    this.wave++;
    // The crew reloads both mounted racks and prepares them for the next stage.
    const neededRearm = this.ordnance.missing;
    this.ordnance.refill();
    for (const id of [this.cfg.loadout.abilityQ, this.cfg.loadout.abilityE]) if (id) this.weaponCd[id] = 0;
    if (neededRearm) this.addFeed('STAGE REARM · MOUNTED RACKS FULL');
    this.waveActive = true;
    const bossWave = this.wave % 5 === 0;
    type WaveKind = 'standard' | 'swarm' | 'armor' | 'snipers' | 'ambush' | 'convoy' | 'salvage';
    const LABEL: Record<WaveKind, string> = { standard: '', swarm: 'SWARM', armor: 'ARMORED PUSH', snipers: 'SNIPER NEST', ambush: 'FLANKING AMBUSH', convoy: 'REPAIR CONVOY', salvage: 'SALVAGE RUSH' };
    let tag: WaveKind = !bossWave && this.wave < 3 && Math.random() < 0.16 ? 'salvage' : 'standard';
    if (!bossWave && this.wave >= 3) {
      const r = Math.random();
      tag = r < 0.12 ? 'salvage' : r < 0.22 ? 'standard' : r < 0.4 ? 'convoy' : r < 0.55 ? 'swarm' : r < 0.7 ? 'armor' : r < 0.85 ? 'snipers' : 'ambush';
    }
    this.waveTag = LABEL[tag];
    const base = Math.min(20, 2 + Math.floor(this.wave * 1.45));
    let count = bossWave ? Math.max(2, Math.floor(base * 0.35)) : base;
    if (tag === 'swarm') count = Math.min(24, Math.round(base * 1.4));
    if (tag === 'armor') count = Math.max(3, Math.round(base * 0.75));
    const pickKind = (): EnemyKind => {
      const r = Math.random();
      const heavyP = this.wave >= 3 ? 0.1 + this.wave * 0.02 : 0;
      const sniperP = this.wave >= 2 ? 0.1 + this.wave * 0.012 : 0;
      if (tag === 'standard' && r > 0.84) return this.wave > 1 && r > 0.92 ? 'mender' : 'bastion';
      if (tag === 'standard' && r >= 0.64 && r <= 0.84) return 'skimmer';
      if (tag === 'swarm') return r < 0.46 ? 'skimmer' : r < 0.76 ? 'mech' : r < 0.88 ? 'tank' : 'sapper';
      if (tag === 'armor') return r < 0.35 ? 'tank' : r < 0.6 ? 'heavy' : r < 0.9 ? 'bastion' : 'sniper';
      if (tag === 'snipers') return r < 0.45 ? 'sniper' : r < 0.75 ? 'mech' : 'tank';
      if (r < heavyP) return 'heavy';
      if (r < heavyP + sniperP) return 'sniper';
      const tail = Math.random();
      if (this.wave >= 2 && tail < 0.09) return 'sapper';
      return tail < 0.6 ? 'mech' : 'tank';
    };
    for (let i = 0; i < count; i++) {
      const kind = tag === 'salvage' && i === 0 ? 'jackal' : tag === 'convoy' ? (i === 0 ? 'mender' : i % 2 ? 'bastion' : 'tank') : pickKind();
      if (tag === 'convoy' && i > 0) {
        // Form up on the lead repair walker, not at unrelated spawn points.
        const lead = this.enemies[this.enemies.length - i];
        let placed = false;
        for (let t = 0; t < 20; t++) {
          const a = rand(0, TWO_PI), r = rand(12, 35);
          const x = lead.pos.x + Math.sin(a) * r, z = lead.pos.z + Math.cos(a) * r;
          if (Math.hypot(x, z) > this.arenaR - 14 || Math.hypot(x-this.pos.x,z-this.pos.z) < 70) continue;
          if (nearObstacles(x, z, 8).some(o => obsDist(o, x, z) < 6)) continue;
          if (this.enemies.some(o => Math.hypot(o.pos.x-x,o.pos.z-z) < 10)) continue;
          this.spawnEnemy(kind, x, z);
          placed = true;
          break;
        }
        if (!placed) this.spawnEnemy(kind);
      } else if (tag === 'ambush') {
        // hostiles close in from every direction
        const a = (i / count) * TWO_PI + rand(-0.25, 0.25);
        let placed = false;
        for (let t = 0; t < 12 && !placed; t++) {
          const d = rand(85, 118);
          const x = this.pos.x + Math.sin(a) * d;
          const z = this.pos.z + Math.cos(a) * d;
          if (Math.hypot(x, z) > this.arenaR - 16) continue;
          if (nearObstacles(x, z, 8).some((o) => obsDist(o, x, z) < 6)) continue;
          this.spawnEnemy(kind, x, z);
          placed = true;
        }
        if (!placed) this.spawnEnemy(kind);
      } else {
        this.spawnEnemy(kind);
      }
    }
    if (tag === 'salvage') {
      // Scatter a short trail in one quadrant: a tempting detour, not a free wallet refill.
      const heading = rand(0, TWO_PI);
      for (let i = 0; i < 3; i++) {
        const angle = heading + i * 0.45, reach = 32 + i * 18;
        this.spawnDrop(this.pos.x + Math.sin(angle) * reach, this.pos.z + Math.cos(angle) * reach, i < 2 ? 'coins' : Math.random() < 0.5 ? 'overcharge' : 'aegis');
      }
      this.addFeed('SUPPLY FLIGHT — RACE THE JACKAL TO GOLD CACHES');
    }
    // an elite champion drops a supply pod when destroyed
    const elite = !bossWave && this.wave >= 3 && Math.random() < 0.35 + Math.min(0.3, this.wave * 0.02);
    if (elite) {
      this.spawnEnemy(Math.random() < 0.5 ? 'tank' : 'mech', undefined, undefined, false, true);
      this.addFeed('ELITE CHAMPION DETECTED');
    }
    if (bossWave) {
      this.spawnEnemy('heavy', undefined, undefined, true);
      this.setMessage(`STAGE ${this.wave}  —  ${BOSS_NAME} ENTERS THE ARENA`);
      this.addFeed('PRIORITY TARGET: HEAVY TITAN CHASSIS');
      // Emergency tactical supply drop for the pilot entering a boss duel
      const a = rand(0, TWO_PI);
      const px = clamp(this.pos.x + Math.sin(a) * 22, -this.arenaR + 24, this.arenaR - 24);
      const pz = clamp(this.pos.z + Math.cos(a) * 22, -this.arenaR + 24, this.arenaR - 24);
      this.spawnDrop(px, pz);
    } else if (this.waveTag) {
      this.setMessage(`STAGE ${this.wave}  —  ${this.waveTag}`);
    } else {
      this.setMessage(`STAGE ${this.wave}  —  ${count} CHALLENGERS ENTER`);
    }
    this.audio.playWave();
  }

  // -------------------------------------------------------------------------
  // Effects
  // -------------------------------------------------------------------------
  private flashLight(pos: THREE.Vector3, intensity: number) {
    let best = this.flashLights[0];
    for (const l of this.flashLights) if (l.intensity < best.intensity) best = l;
    best.position.copy(pos);
    best.position.y += 1.5;
    best.intensity = intensity;
  }

  private explosion(pos: THREE.Vector3, scale: number) {
    this.opts?.onAreaDamage?.(pos, 80 * scale, 6 * scale);
    this.weaponFx.shockwave(pos, 5.5 * scale, 0xffa344, 0.42 * Math.sqrt(scale));
    const n = Math.floor(18 * scale);
    for (let i = 0; i < n; i++) {
      const th = rand(0, TWO_PI);
      const ph = rand(0, Math.PI);
      const sp = rand(3, 13) * scale;
      this.fire.emit({
        x: pos.x, y: pos.y, z: pos.z,
        vx: Math.sin(ph) * Math.cos(th) * sp, vy: Math.abs(Math.cos(ph)) * sp * 0.9 + 2, vz: Math.sin(ph) * Math.sin(th) * sp,
        life: rand(0.35, 0.75), size0: 1.6 * scale, size1: 3.4 * scale,
        c0: [1, 0.85, 0.45], c1: [1, 0.2, 0.03], grav: -3, drag: 2.2, alpha: 1,
      });
    }
    const ns = Math.floor(12 * scale);
    for (let i = 0; i < ns; i++) {
      const th = rand(0, TWO_PI);
      const sp = rand(1.5, 6) * scale;
      this.smoke.emit({
        x: pos.x + rand(-1, 1), y: pos.y + rand(0, 1.5), z: pos.z + rand(-1, 1),
        vx: Math.cos(th) * sp, vy: rand(2, 6) * scale, vz: Math.sin(th) * sp,
        life: rand(1.4, 2.8) * Math.sqrt(scale), size0: 2.2 * scale, size1: 7 * scale,
        c0: [0.28, 0.25, 0.22], c1: [0.12, 0.12, 0.12], grav: -1.2, drag: 1.4, alpha: 0.55,
      });
    }
    const nk = Math.floor(16 * scale);
    for (let i = 0; i < nk; i++) {
      const th = rand(0, TWO_PI);
      const ph = rand(0, Math.PI * 0.5);
      const sp = rand(10, 28) * Math.sqrt(scale);
      this.fire.emit({
        x: pos.x, y: pos.y + 0.5, z: pos.z,
        vx: Math.sin(ph) * Math.cos(th) * sp, vy: Math.cos(ph) * sp, vz: Math.sin(ph) * Math.sin(th) * sp,
        life: rand(0.4, 1.0), size0: 0.4, size1: 0.1,
        c0: [1, 0.95, 0.6], c1: [1, 0.4, 0.1], grav: 14, drag: 0.4, alpha: 1,
      });
    }
    // ground dust ring
    const groundAt = heightAt(pos.x, pos.z);
    if (pos.y < groundAt + 2) {
      for (let i = 0; i < 10 * scale; i++) {
        const th = rand(0, TWO_PI);
        const sp = rand(6, 12) * scale;
        this.smoke.emit({
          x: pos.x, y: groundAt + 0.3, z: pos.z, vx: Math.cos(th) * sp, vy: rand(0.5, 2), vz: Math.sin(th) * sp,
          life: rand(0.8, 1.4), size0: 1.5 * scale, size1: 4.5 * scale,
          c0: [0.6, 0.55, 0.42], c1: [0.4, 0.37, 0.3], grav: 0, drag: 3, alpha: 0.45,
        });
      }
    }
    this.flashLight(pos, 600 * scale);
    const d = pos.distanceTo(this.pos);
    if (d < 40) this.shake = Math.max(this.shake, (1 - d / 40) * 0.5 * scale);
  }

  private muzzleFlash(pos: THREE.Vector3, dir: THREE.Vector3, scale: number) {
    const n = Math.floor(6 * scale) + 1;
    for (let i = 0; i < n; i++) {
      this.fire.emit({
        x: pos.x, y: pos.y, z: pos.z,
        vx: dir.x * rand(8, 20) * scale + rand(-2, 2), vy: dir.y * rand(8, 20) * scale + rand(-2, 2), vz: dir.z * rand(8, 20) * scale + rand(-2, 2),
        life: rand(0.06, 0.14), size0: 1.6 * scale + 0.3, size1: 0.3,
        c0: [1, 0.9, 0.6], c1: [1, 0.45, 0.1], grav: 0, drag: 4, alpha: 1,
      });
    }
    if (scale > 0.5) {
      for (let i = 0; i < 5; i++) {
        this.smoke.emit({
          x: pos.x, y: pos.y, z: pos.z,
          vx: dir.x * rand(3, 9) + rand(-1.5, 1.5), vy: dir.y * rand(3, 9) + rand(0, 2), vz: dir.z * rand(3, 9) + rand(-1.5, 1.5),
          life: rand(0.6, 1.2), size0: 1.2, size1: 4, c0: [0.5, 0.48, 0.45], c1: [0.3, 0.3, 0.3], grav: -0.8, drag: 2.5, alpha: 0.4,
        });
      }
      this.flashLight(pos, 250 * scale);
    }
  }

  private sparks(pos: THREE.Vector3, scale: number) {
    const n = Math.floor(14 * scale) + 4;
    for (let i = 0; i < n; i++) {
      const th = rand(0, TWO_PI);
      const ph = rand(0, Math.PI);
      const sp = rand(8, 24) * Math.min(1.5, Math.sqrt(scale));
      this.fire.emit({
        x: pos.x, y: pos.y, z: pos.z,
        vx: Math.sin(ph) * Math.cos(th) * sp, vy: Math.abs(Math.cos(ph)) * sp * 1.2, vz: Math.sin(ph) * Math.sin(th) * sp,
        life: rand(0.25, 0.6), size0: 0.35 * Math.sqrt(scale), size1: 0.04, c0: [1, 0.95, 0.7], c1: [1, 0.45, 0.08], grav: 16, drag: 0.85, alpha: 1,
      });
    }
  }

  private dust(pos: THREE.Vector3, scale: number) {
    const n = Math.floor(5 * scale) + 2;
    for (let i = 0; i < n; i++) {
      const th = rand(0, TWO_PI);
      const sp = rand(1, 4) * scale;
      this.smoke.emit({
        x: pos.x, y: Math.max(0.2, pos.y), z: pos.z, vx: Math.cos(th) * sp, vy: rand(1, 3), vz: Math.sin(th) * sp,
        life: rand(0.5, 1.1), size0: 0.6 * scale, size1: 2.4 * scale, c0: [0.62, 0.56, 0.42], c1: [0.45, 0.4, 0.32], grav: 0, drag: 2.5, alpha: 0.45,
      });
    }
  }

  private updateEffects(dt: number) {
    this.floaters.update(dt);
    this.weaponFx.update(dt);
    this.ambientDust?.update(dt, this.pos);
    if (this.waterTexture) {
      this.waterTexture.offset.x += dt * 0.007;
      this.waterTexture.offset.y += dt * 0.002;
    }
    // persistent fires around the map
    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.fireTimer = 0.05;
      for (const f of this.fireSpots) {
        if (Math.abs(f.x - this.pos.x) > 200 || Math.abs(f.z - this.pos.z) > 200) continue;
        this.fire.emit({
          x: f.x + rand(-0.8, 0.8), y: f.y, z: f.z + rand(-0.8, 0.8), vx: rand(-0.3, 0.3), vy: rand(2, 4.5), vz: rand(-0.3, 0.3),
          life: rand(0.4, 0.8), size0: rand(1.4, 2.2), size1: 0.3, c0: [1, 0.7, 0.3], c1: [1, 0.25, 0.05], grav: -1, drag: 1.2, alpha: 0.9,
        });
        if (Math.random() < 0.5) {
          this.smoke.emit({
            x: f.x + rand(-1, 1), y: f.y + 2.5, z: f.z + rand(-1, 1), vx: rand(-0.5, 0.5) + 0.8, vy: rand(2.5, 4), vz: rand(-0.5, 0.5),
            life: rand(3, 5), size0: 2, size1: 8, c0: [0.16, 0.15, 0.14], c1: [0.1, 0.1, 0.1], grav: -0.3, drag: 0.6, alpha: 0.4,
          });
        }
      }
    }
    this.fireLightTimer -= dt;
    if (this.fireLightTimer <= 0) {
      this.fireLightTimer = 0.4;
      const near = this.fireSpots
        .map((f) => ({ f, d: Math.hypot(f.x - this.pos.x, f.z - this.pos.z) }))
        .filter((o) => o.d < 70)
        .sort((a, b) => a.d - b.d)
        .slice(0, this.fireLights.length);
      this.fireLights.forEach((l, i) => {
        const n = near[i];
        l.userData.on = !!n;
        if (n) l.position.set(n.f.x, n.f.y + 1.5, n.f.z);
      });
    }
    this.fireLights.forEach((l, i) => {
      l.intensity = l.userData.on ? 50 + Math.sin(this.time * (11 + i * 3)) * 12 + Math.random() * 14 : 0;
    });
    if (this.stars) this.stars.position.copy(this.camera.position);
    // wind-blown dust drifting past the cockpit
    this.dustTimer -= dt;
    if (this.dustTimer <= 0) {
      this.dustTimer = 0.12 / this.layout.theme.dust;
      const a = rand(0, TWO_PI);
      const d = rand(10, 60);
      const x = this.pos.x + Math.sin(a) * d;
      const z = this.pos.z + Math.cos(a) * d;
      this.smoke.emit({
        x, y: heightAt(x, z) + rand(0.2, 1.5), z, vx: rand(3, 6), vy: rand(0, 0.5), vz: rand(-1, 1),
        life: rand(2, 4), size0: rand(1, 2), size1: rand(4, 7), c0: [0.72, 0.64, 0.5], c1: [0.62, 0.56, 0.45], grav: 0, drag: 0.2, alpha: 0.14,
      });
    }
    this.fire.update(dt);
    this.smoke.update(dt);
    const decay = Math.exp(-dt * 9);
    for (const l of this.flashLights) l.intensity *= decay;
    this.muzzleLight.intensity *= Math.exp(-dt * 16);
    this.damageFlash = Math.max(0, this.damageFlash - dt * 1.6);
    this.sky.position.copy(this.camera.position);
    this.sunDisc.position.copy(this.camera.position).addScaledVector(this.sunDir, 1100);
    this.sunDisc.lookAt(this.camera.position);
    if (this.quality > 0) {
      fitDirectionalLightShadow(this.sun, this.sunDir, this.pos);
    } else {
      this.sun.position.set(this.pos.x + this.sunDir.x * 160, this.sunDir.y * 160 + 40, this.pos.z + this.sunDir.z * 160);
      this.sun.target.position.set(this.pos.x, 0, this.pos.z);
      this.sun.target.updateMatrixWorld();
    }
  }

  private updateCamera(dt: number) {
    const c = this.cfg;
    const sf = Math.min(1, Math.abs(this.speed) / c.maxSpeed);

    // Coupled stride harmonics (Saltline bobX, bobY & stride thump):
    // 1. bobY: downward chassis compression on foot strikes (double harmonic)
    const stepThump = Math.sin(this.walkPhase * 2);
    const bobY = (stepThump * 0.055 - Math.abs(stepThump) * 0.04) * sf;
    // 2. bobX: lateral chassis weight transfer
    const bobX = Math.cos(this.walkPhase) * 0.035 * sf;

    // Deceleration & braking compression dip (Saltline landDip):
    const accel = (this.speed - this.prevSpeed) / Math.max(0.001, dt);
    this.prevSpeed = this.speed;
    if (accel < -2.0) {
      this.landDip = Math.min(0.24, this.landDip + Math.abs(accel) * 0.0035);
    }
    this.landDip *= Math.exp(-dt * 5.0);

    // Lean into lateral movement with strafe banking (Saltline rollStrafe)
    let roll = Math.sin(this.walkPhase) * 0.012 * sf;
    roll -= this.lean * 0.075;
    // follow the slope: pitch/roll the view with the terrain under the vehicle
    {
      const fx = Math.sin(this.hullYaw);
      const fz = Math.cos(this.hullYaw);
      const L = 3;
      const hf = heightAt(this.pos.x + fx * L, this.pos.z + fz * L);
      const hb = heightAt(this.pos.x - fx * L, this.pos.z - fz * L);
      const hr = heightAt(this.pos.x - fz * L, this.pos.z + fx * L);
      const hl = heightAt(this.pos.x + fz * L, this.pos.z - fx * L);
      const hullPitch = Math.atan2(hf - hb, 2 * L);
      const hullRoll = Math.atan2(hr - hl, 2 * L);
      // project hull tilt into the view direction
      const rel = this.turretYaw - this.hullYaw;
      const tp = hullPitch * Math.cos(rel) + hullRoll * Math.sin(rel);
      const tr = -hullPitch * Math.sin(rel) + hullRoll * Math.cos(rel);
      const k = Math.min(1, dt * 6);
      this.tiltPitch += (tp - this.tiltPitch) * k;
      this.tiltRoll += (tr - this.tiltRoll) * k;
    }
    let camY = c.camHeight + bobY - this.landDip;
    if (!this.alive) {
      camY = Math.max(0.9, c.camHeight - this.deathTimer * 1.1);
      roll = Math.min(0.55, this.deathTimer * 0.45);
    }
    // shift the viewpoint sideways with strafing and stride sway for a weighty feel
    const right = rightOf(this.turretYaw, this.tmpC);
    this.camera.position.set(
      this.pos.x + right.x * (this.lean * 1.1 + bobX),
      camY + this.pos.y,
      this.pos.z + right.z * (this.lean * 1.1 + bobX)
    );
    const yaw = this.turretYaw;
    const pitch = this.pitch + this.recoilPitch + this.tiltPitch * 0.75;
    roll += this.tiltRoll * 0.75;
    const dir = this.tmpA.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    this.camera.lookAt(this.tmpB.copy(this.camera.position).add(dir));
    if (roll) this.camera.rotateZ(roll);
    if (this.shake > 0.001) {
      const s = this.shake;
      this.camera.rotateX((Math.random() - 0.5) * s * 0.09);
      this.camera.rotateY((Math.random() - 0.5) * s * 0.09);
      this.camera.rotateZ((Math.random() - 0.5) * s * 0.06);
      this.camera.position.y += (Math.random() - 0.5) * s * 0.25;
      this.shake *= Math.exp(-dt * 5.5);
    }
    // weapon sway & recoil
    this.swayX += (this.swayTargetX - this.swayX) * Math.min(1, dt * 14);
    this.swayY += (this.swayTargetY - this.swayY) * Math.min(1, dt * 14);
    this.swayTargetX *= Math.exp(-dt * 8);
    this.swayTargetY *= Math.exp(-dt * 8);

    this.weapon.visible = !this.zoom;
    const secArmReady = this.secondaryReadiness();
    const priCharge = this.mgOverheat ? 0 : (1 - this.mgHeat * 0.5);
    this.arms.forEach((arm, i) => {
      const armCharge = i === 1 ? secArmReady : priCharge;
      poseHardpoint(
        arm.root,
        i,
        this.camera.aspect,
        this.settings.fov,
        this.armRecoil[i],
        this.swayX,
        this.swayY,
        bobY,
        armCharge,
        this.time
      );
      arm.updateCharge?.(armCharge, this.time);
      if (arm.rotor) arm.rotor.rotation.z += dt * (1 + this.armRecoil[i] * 16) * 14;
    });
    this.camera.updateMatrixWorld();
  }

  // -------------------------------------------------------------------------
  // HUD
  // -------------------------------------------------------------------------
  private setMessage(text: string) {
    this.message = text;
    this.messageTime = this.time;
  }

  private addFeed(text: string) {
    this.feed.push({ text, time: this.time });
    if (this.feed.length > 5) this.feed.shift();
  }

  private buildHud(): HudState {
    const sy = Math.sin(this.turretYaw);
    const cy = Math.cos(this.turretYaw);
    const blips: RadarBlip[] = [];
    const rel = (x: number, z: number) => {
      const dx = x - this.pos.x;
      const dz = z - this.pos.z;
      return { x: -dx * cy + dz * sy, y: dx * sy + dz * cy, d: Math.hypot(dx, dz) };
    };
    for (const o of this.obstacles) {
      const r = rel(o.x, o.z);
      if (r.d > 135 || o.h < 1.8) continue;
      const corners = obsCorners(o);
      if (corners) {
        const poly: number[] = [];
        for (const [cx, cz] of corners) {
          const q = rel(cx, cz);
          poly.push(q.x, q.y);
        }
        blips.push({ x: r.x, y: r.y, kind: 'obstacle', poly, tall: o.h > 6 });
      } else blips.push({ x: r.x, y: r.y, kind: 'obstacle', size: o.r, tall: o.h > 6 });
    }
    for (const p of this.pickups) {
      const r = rel(p.pos.x, p.pos.z);
      if (r.d < 180) blips.push({ x: r.x, y: r.y, kind: 'pickup' });
    }
    for (const d of this.drops) {
      const r = rel(d.pos.x, d.pos.z);
      if (r.d < 260) blips.push({ x: r.x, y: r.y, kind: 'drop', dropKind: d.kind, size: d.falling ? 4.5 : 3.5 });
    }
    for (const relay of this.mapApi.relays) {
      if (relay.claimed) continue;
      const r = rel(relay.marker.position.x, relay.marker.position.z);
      if (r.d < 176) blips.push({x:r.x, y:r.y, kind:'relay', size: relay.reward === 'repair' ? 1 : 2});
    }
    const showEdgeEnemies = (this.time - this.lastEnemyCombatTime > 3.0) || this.enemies.length <= 4;
    let boss: HudState['boss'];
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const r = rel(e.pos.x, e.pos.z);
      if (e.boss) boss = { name: e.cfg.name, hp: e.hp / e.maxHp };
      if (r.d < 180) {
        blips.push({ x: r.x, y: r.y, kind: e.boss ? 'boss' : e.kind, alert: e.aware, dist: r.d });
      } else if (showEdgeEnemies || e.boss) {
        const inv = 1 / Math.max(1, r.d);
        blips.push({
          x: r.x * inv * 174,
          y: r.y * inv * 174,
          kind: e.boss ? 'boss' : e.kind,
          alert: true,
          edge: true,
          dist: r.d,
        });
      }
    }
    const aimedEnemy = aimOnHostile(this.camera.position, this.camera.getWorldDirection(this.tmpA), this.enemies, heightAt, sightSlope(this.camera.fov,this.canvas.clientHeight));
    if (aimedEnemy) this.lastEnemyCombatTime = this.time;
    const s = this.stats;
    const pri = this.cfg.loadout.primary;
    const sec = this.cfg.loadout.secondary;
    const priIsHeat = pri === 'autocannon' || pri === 'coil';
    const secIsHeat = sec === 'flame' || sec === 'cryo';
    const priReady = this.primaryReadiness();
    const secReady = this.secondaryReadiness();
    const concealment = this.concealmentCloud();
    const slotDetail = (id: WeaponId): string => {
      switch (id) {
        case 'missiles': return `${s.missileCount} GUIDED`;
        case 'mortar': return `${s.strikeShells} SHELLS`;
        case 'orbital': return 'ORBITAL BARRAGE';
        case 'rail': return 'PRECISION';
        case 'turret': return `${Math.round(24 * s.turretLifeMul)}S SENTRY`;
        case 'overdrive': return 'BURN NOVA';
        case 'nova': return 'FREEZE';
        case 'autocannon': return 'RAPID';
        case 'cannon': return 'HE';
        case 'scatter': return 'SPREAD';
        case 'coil': return 'RAPID';
        case 'flame': return 'BURN';
        case 'cryo': return 'SLOW';
        case 'cryoball': return `${this.cryoCooldown.toFixed(1)}S ICE`;
        case 'emp': return 'DISRUPT';
        case 'cinder': return 'GROUND FIRE';
        case 'mines': return `${this.mines.length} ARMED`;
        case 'smoke': return concealment ? 'CONCEAL' : 'READY';
        default: return '';
      }
    };
    const slotReady = (id: WeaponId): number => this.power >= this.energyCost(id) ? this.weaponReadiness(id) : Math.min(this.weaponReadiness(id),this.power/this.energyCost(id));
    const slots = [
      [pri, 'primary'],
      [sec, 'secondary'],
      [this.cfg.loadout.abilityQ, 'specialQ'],
      [this.cfg.loadout.abilityE, 'specialE'],
    ] as const;
    const weapons: HudWeapon[] = slots.map(([id, socket]) => {
      const installed = weaponUpgradeInfo(id, socket, this.taken);
      if (!id) {
        return { id: null, name: 'EMPTY SOCKET', short: 'EMPTY', key: '—', owned: false, ready: 0, active: 0, detail: '', upgradeCount: 0, upgrades: [], evolved: false };
      }
      const info = WEAPON_INFO[id];
      const rack = this.ordnance.key(id);
      return {
        id, name: info.name, short: info.short, key: rack ?? info.key,
        charges: rack ? this.ordnance.count[rack] : undefined,
        capacity: rack ? RACK_CAPACITIES[rack] : undefined,
        cooldownLeft: rack ? this.weaponCd[id] : undefined,
        cost: this.energyCost(id), underpowered: this.power < this.energyCost(id),
        owned: true, ready: rack && !this.ordnance.count[rack] ? 0 : slotReady(id), active: 0,
        detail: installed.evolved ? 'EVOLVED' : slotDetail(id),
        upgradeCount: installed.count, upgrades: installed.upgrades, evolved: installed.evolved,
      };
    });
    const perkMap = new Map<string, { name: string; icon: string; count: number }>();
    for (const p of this.perkList) {
      const cur = perkMap.get(p.name);
      if (cur) cur.count++;
      else perkMap.set(p.name, { ...p, count: 1 });
    }
    const capturing = this.mapApi.relays.find(r => r.charge > 0 && !r.claimed);
    const buffs = activeStatuses(this.buffT, this.overdriveDuration, concealment, this.alive);
    return {
      driveBlocked: this.recovery.ready,
      hp: this.hp,
      maxHp: this.maxHp,
      shield: this.shieldHp,
      shieldMax: s.shieldMax,
      shieldActive: !this.shieldBroken,
      shieldStatus: this.shieldBroken ? 'restarting' : this.shieldHp < s.shieldMax && this.shieldDelay === 0 ? 'recharging' : 'online',
      shieldDelay: this.shieldDelay,
      weapons,
      offer: this.offer,
      perks: [...perkMap.values()],
      boss,
      strikeInbound: this.strikes.length ? Math.max(0, this.strikes[0].timer) : 0,
      strikeKind: this.strikes[0]?.kind,
      lockWarning: this.lockWarning(),
      streak: this.streak,
      streakAge: this.time - this.streakTime,
      critAge: this.time - this.critTime,
      killAge: this.time - this.killTime,
      floaters: this.floaters.project(this.camera),
      detected: this.enemies.filter((e) => e.aware).length,
      seenBy: this.enemies.filter((e) => e.canSee).length,
      ambushAge: this.time - this.ambushTime,
      inWater: inWater(this.pos.x, this.pos.z),
      concealed: !!concealment,
      district: this.districtName || 'CENTRAL PLAZA',
      seed: this.seedCode,
      themeName: this.layout.theme.name,
      condition: `${this.condition.name} · ${this.condition.detail}`,
      zone: this.zone,
      maxZone: MAX_ZONE,
      arenaRadius: Math.round(this.arenaR),
      expandIn: this.wavesToExpand(),
      lootCredits: this.lootCredits,
      waveTag: this.waveActive ? this.waveTag : '',
      musicOn: this.audio.isMusicOn(),
      expandAge: this.time - this.expandTime,
      fps: this.fps,
      overchargeCount: this.stats.overcharge > 0 ? 5 - (this.shotCounter % 5) : 0,
      buffs,
      drops: this.drops.map((d) => ({
        kind: d.kind,
        label: SUPPLIES[d.kind].name.toUpperCase(),
        bearing: Math.atan2(rel(d.pos.x,d.pos.z).x,rel(d.pos.x,d.pos.z).y),
        inbound: d.falling ? clamp((d.group.position.y - d.pos.y) / 45, 0, 30) : 0,
        dist: Math.hypot(d.pos.x - this.pos.x, d.pos.z - this.pos.z),
      })),
      dropInbound: (() => {
        const falling = this.drops.find((d) => d.falling);
        return falling ? { label: SUPPLIES[falling.kind].name.toUpperCase(), seconds: clamp((falling.group.position.y - falling.pos.y) / 45, 0, 30) } : undefined;
      })(),
      mgHeat: priIsHeat ? this.mgHeat : 0,
      mgOverheat: priIsHeat && this.mgOverheat,
      priName: pri ? WEAPON_INFO[pri].short : 'EMPTY',
      priReady,
      priIsHeat,
      priHeat: this.mgHeat,
      priOverheat: this.mgOverheat,
      secName: sec ? WEAPON_INFO[sec].short : 'EMPTY',
      secReady,
      secIsHeat,
      secHeat: this.secHeat,
      secOverheat: this.secOverheat,
      secCharging: secReady < 1.0,
      secCharge: secReady,
      secCooldownLeft: sec === 'cannon' ? this.cannonCd : this.secCd,
      score: this.score,
      kills: this.kills,
      wave: this.wave,
      enemiesLeft: this.enemies.length,
      turretYaw: this.turretYaw,
      hullYaw: this.hullYaw,
      pitch: this.pitch,
      speed: this.speed,
      maxSpeed: this.cfg.maxSpeed * this.stats.speedMul * (inWater(this.pos.x, this.pos.z) ? 0.72 : 1),
      blips,
      message: this.message,
      relay: capturing ? {progress: capturing.charge / 2, name: capturing.reward === 'repair' ? 'REPAIR RELAY' : 'RELOAD RELAY'} : undefined,
      messageAge: this.time - this.messageTime,
      feed: this.feed.filter((f) => this.time - f.time < 5).map((f) => ({ text: f.text, age: this.time - f.time })),
      hitMarkerAge: this.time - this.hitMarkerTime,
      damageFlash: this.damageFlash,
      damageDirs: this.damageDirs.filter((d) => this.time - d.time < 1.3).map((d) => ({ angle: d.angle, age: this.time - d.time })),
      waveCountdown: this.waveActive ? 0 : this.waveTimer,
      power: this.power,
      powerMax: this.cfg.powerCapacity,
      powerOutput: reserveRecharge(this.cfg.powerOutput,this.condition.energy),
      powerDraw: this.cfg.powerDraw,
      salvageWindow: this.victoryPending && this.waveTag === 'SALVAGE RUSH' && this.drops.some(d => d.kind === 'coins'),
      victoryCountdown: this.victoryPending ? Math.max(0, this.victoryTimer) : 0,
      alive: this.alive,
      time: this.time,
      zoom: this.zoom,
      aimedEnemy,
      vehicleName: this.mechName,
      controls: this.controls,
      autoAlign: this.controls === 'arcade' && Math.abs(this.speed) < 1.2,
      lean: this.lean,
    };
  }
}
