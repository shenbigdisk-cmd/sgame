import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetColliderGrid } from './colliders';
import { Game } from './engine';
import { STARTER_EQUIPPED, buildConfig } from './forge';
import { defaultStats } from './upgrades';
import { EMP } from './weaponHandling';
import type { VehicleConfig } from './vehicles';
import type { WeaponId } from './types';

type TestEnemy = {
  alive: boolean;
  boss: boolean;
  kind: 'mech';
  pos: THREE.Vector3;
  radius: number;
  height: number;
  hp: number;
  maxHp: number;
  stunTime: number;
  empResistance: number;
  slowTime: number;
  burnTime: number;
  burst: number;
  lockTimer: number;
  canSee: boolean;
  laser: THREE.Line | null;
};
type TestProjectile = {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  prev: THREE.Vector3;
  vel: THREE.Vector3;
  origin: THREE.Vector3;
  owner: 'player' | 'enemy';
  kind: 'bullet' | 'shell' | 'rocket';
  damage: number;
  splash: number;
  gravity: number;
  life: number;
  homing: number;
  homingTarget: TestEnemy | null;
  trail: number;
  burnPool: boolean;
  whizzed: boolean;
  rangeLeft?: number;
  weapon?: WeaponId;
};
type Harness = {
  cfg: VehicleConfig;
  camera: THREE.PerspectiveCamera;
  projectiles: TestProjectile[];
  enemies: TestEnemy[];
  vel: THREE.Vector3;
  speed: number;
  controls: 'arcade' | 'realistic';
  cannonCd: number;
  secCd: number;
  secCdMax: number;
  taken: Map<string, number>;
  damageEnemy: ReturnType<typeof vi.fn>;
  beamHit: ReturnType<typeof vi.fn>;
  traceCover: ReturnType<typeof vi.fn>;
  enemyShoot: ReturnType<typeof vi.fn>;
  firePrimaryBullets: () => void;
  fireCannon: () => void;
  fireScatter: () => void;
  fireEmp: () => void;
  fireBeam: (kind: 'flame' | 'cryo') => void;
  assistTarget: (from: THREE.Vector3, dir: THREE.Vector3, range: number) => TestEnemy | null;
  updateProjectiles: (dt: number) => void;
  updateEnemies: (dt: number) => void;
  impact: (p: TestProjectile, enemy: TestEnemy | null, player: boolean) => void;
  spawnProjectile: (owner: 'player', kind: 'bullet', pos: THREE.Vector3, vel: THREE.Vector3, damage: number, splash: number, gravity: number, life: number, homing: number) => void;
};

function enemy(x: number, boss = false): TestEnemy {
  const barFg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial());
  return {
    alive: true, boss, kind: 'mech', pos: new THREE.Vector3(x, 49, 0), radius: 0.5, height: 2,
    hp: 500, maxHp: 500, stunTime: 0, empResistance: 0, slowTime: 0, burnTime: 0,
    burst: 3, lockTimer: 0.6, canSee: true, laser: new THREE.Line(),
    // Remaining fields are used by the real updateEnemies visual pass.
    freezeLock: 0, brittleTime: 0, moving: true, group: new THREE.Group(), yaw: 0, aimYaw: 0,
    turret: null, torso: null, legs: [], walkPhase: 0, flashMats: [], hitFlash: 0,
    bar: new THREE.Group(), barFg, cfg: { speed: 1 },
  } as TestEnemy;
}

function harness(cfg = buildConfig(STARTER_EQUIPPED)): Harness {
  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 500);
  camera.position.set(0, 50, 0);
  camera.lookAt(100, 50, 0);
  camera.updateMatrixWorld(true);
  return Object.assign(Object.create(Game.prototype), {
    cfg, camera, canvas: { clientHeight: 720 },
    scene: new THREE.Scene(), pos: new THREE.Vector3(), vel: new THREE.Vector3(), speed: 0,
    controls: 'realistic', stats: defaultStats(), taken: new Map<string, number>(),
    geo: { bullet: new THREE.BoxGeometry(0.1, 0.1, 1), shell: new THREE.SphereGeometry(0.3), rocket: new THREE.BoxGeometry(1, 1, 1) },
    mats: { bullet: new THREE.MeshBasicMaterial(), playerShell: new THREE.MeshBasicMaterial(), playerRocket: new THREE.MeshBasicMaterial(), rocket: new THREE.MeshBasicMaterial() },
    projectiles: [], enemies: [], explosiveBarrels: [], smokeClouds: [],
    tmpA: new THREE.Vector3(), tmpB: new THREE.Vector3(), tmpC: new THREE.Vector3(), tmpD: new THREE.Vector3(),
    muzzleLocal: () => new THREE.Vector3(1.8, -1.4, -3.7), muzzleLight: { position: new THREE.Vector3(), intensity: 0 },
    armRecoil: [0, 0], armRecoilVel: [0, 0], recoilPitch: 0, shake: 0, shotCounter: 0, primaryShots: 0, mgNoiseTimer: 0,
    shellDrop: 0, cannonCd: 0, secCd: 0, secCdMax: 0, time: 1, alive: true,
    muzzleFlash: vi.fn(), makeNoise: vi.fn(), sparks: vi.fn(), dust: vi.fn(), elementBurst: vi.fn(), addFeed: vi.fn(),
    audio: { playMG: vi.fn(), playCannon: vi.fn(), playScatter: vi.fn(), playEmp: vi.fn(), playFlame: vi.fn(), playCryo: vi.fn(), playArc: vi.fn() },
    fire: { emit: vi.fn() }, smoke: { emit: vi.fn() }, weaponFx: { beam: vi.fn(), shockwave: vi.fn() },
    hasLOS: () => true, traceCover: vi.fn((_origin, _dir, range: number) => range),
    damageEnemy: vi.fn((e: TestEnemy, damage: number) => { e.hp -= damage; }), beamHit: vi.fn(), enemyShoot: vi.fn(),
    panFor: () => 0,
  }) as Harness;
}

beforeEach(() => resetColliderGrid());

describe('trigger weapons in the real simulation', () => {
  it('mounts per-component range on fired rounds and honours cannon reloads', () => {
    const game = harness(buildConfig({ ...STARTER_EQUIPPED, primary: 'p_coil_rail', secondary: 's_cannon_atlas' }));
    game.firePrimaryBullets();
    expect(game.projectiles[0].weapon).toBe('coil');
    expect(game.projectiles[0].rangeLeft).toBe(225);
    expect(game.projectiles[0].damage).toBe(4.9);
    game.fireCannon();
    expect(game.projectiles[1].rangeLeft).toBe(225);
    expect(game.projectiles[1].damage).toBe(46);
    expect(game.cannonCd).toBe(1.7);
  });

  it('gives each scatter pellet the selected range', () => {
    const game = harness(buildConfig({ ...STARTER_EQUIPPED, primary: 'p_scatter_sawed' }));
    game.fireScatter();
    expect(game.projectiles).toHaveLength(6);
    expect(game.projectiles.every((p) => p.rangeLeft === 48 && p.weapon === 'scatter')).toBe(true);
  });

  it('caps the swept path before collision even on a long frame', () => {
    const game = harness();
    const outOfRange = enemy(12);
    game.enemies = [outOfRange];
    game.spawnProjectile('player', 'bullet', new THREE.Vector3(0, 50, 0), new THREE.Vector3(100, 0, 0), 5, 0, 0, 5, 0);
    const shot = game.projectiles[0];
    shot.rangeLeft = 10;
    game.updateProjectiles(1);
    expect(shot.pos.x).toBeCloseTo(10);
    expect(game.damageEnemy).not.toHaveBeenCalled();
    expect(game.projectiles).toHaveLength(0);

    const inRange = enemy(8);
    game.enemies = [inRange];
    game.spawnProjectile('player', 'bullet', new THREE.Vector3(0, 50, 0), new THREE.Vector3(100, 0, 0), 5, 0, 0, 5, 0);
    game.projectiles[0].rangeLeft = 10;
    game.updateProjectiles(1);
    expect(game.damageEnemy).toHaveBeenCalledWith(inRange, expect.any(Number));
    expect(game.projectiles).toHaveLength(0);
  });

  it('does not acquire an arcade assist target beyond the selected gun range', () => {
    const game = harness();
    game.controls = 'arcade';
    const target = enemy(160);
    game.enemies = [target];
    const origin = new THREE.Vector3(0, 50, 0), direction = new THREE.Vector3(1, 0, 0);
    expect(game.assistTarget(origin, direction, 125)).toBeNull();
    expect(game.assistTarget(origin, direction, 185)).toBe(target);
  });

  it('uses stabilised legs to reduce the actual movement-induced deviation, including strafing', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.8);
    try {
      const stock = harness(buildConfig(STARTER_EQUIPPED));
      const steady = harness(buildConfig({ ...STARTER_EQUIPPED, drive: 'd_anvil' }));
      for (const game of [stock, steady]) {
        game.controls = 'arcade';
        game.vel.set(0, 0, game.cfg.maxSpeed); // pure strafe, not forward speed
        game.firePrimaryBullets();
      }
      const axis = new THREE.Vector3(1, 0, 0);
      expect(steady.projectiles[0].vel.clone().normalize().distanceTo(axis))
        .toBeLessThan(stock.projectiles[0].vel.clone().normalize().distanceTo(axis));
    } finally {
      random.mockRestore();
    }
  });

  it('uses each beam component’s reach and longer cryo slow in combat', () => {
    const target = enemy(35);
    const standard = harness(buildConfig({ ...STARTER_EQUIPPED, secondary: 's_flame' }));
    standard.enemies = [target];
    standard.fireBeam('flame');
    expect(standard.traceCover).toHaveBeenCalledWith(expect.any(THREE.Vector3), expect.any(THREE.Vector3), 30);
    expect(standard.beamHit).not.toHaveBeenCalled();
    const extended = harness(buildConfig({ ...STARTER_EQUIPPED, secondary: 's_flame_vent' }));
    extended.enemies = [target];
    extended.fireBeam('flame');
    expect(extended.traceCover).toHaveBeenCalledWith(expect.any(THREE.Vector3), expect.any(THREE.Vector3), 42);
    expect(extended.beamHit).toHaveBeenCalled();
    const cryo = harness(buildConfig({ ...STARTER_EQUIPPED, secondary: 's_cryo_heavy' }));
    cryo.enemies = [target];
    cryo.fireBeam('cryo');
    expect(target.slowTime).toBe(3.4);
  });
});

describe('Volt EMP in the real simulation', () => {
  it('fires a finite low-damage pulse and primes its real cooldown', () => {
    const game = harness(buildConfig({ ...STARTER_EQUIPPED, secondary: 's_emp' }));
    game.fireEmp();
    expect(game.projectiles[0]).toMatchObject({ weapon: 'emp', rangeLeft: 110, damage: 12 });
    expect(game.secCd).toBe(3.2);
    expect(game.secCdMax).toBe(3.2);
  });

  it('breaks attacks and locks, stops movement, and cannot repeatedly stun an immune target', () => {
    const game = harness();
    const target = enemy(10);
    game.enemies = [target];
    game.spawnProjectile('player', 'bullet', new THREE.Vector3(10, 50, 0), new THREE.Vector3(), 12, 0, 0, 3, 0);
    const pulse = game.projectiles[0];
    pulse.weapon = 'emp';
    game.impact(pulse, target, false);
    expect(target.stunTime).toBe(EMP.stun);
    expect(target.empResistance).toBe(EMP.resistance);
    expect(target.burst).toBe(0);
    expect(target.lockTimer).toBe(0);
    expect(target.laser?.visible).toBe(false);
    expect(target.hp).toBe(488);
    const position = target.pos.clone();
    game.updateEnemies(0.5);
    expect(target.pos).toEqual(position);
    expect(target.stunTime).toBe(1);
    expect(target.empResistance).toBe(3.5);
    expect(game.enemyShoot).not.toHaveBeenCalled();
    game.impact(pulse, target, false);
    expect(target.stunTime).toBe(1); // damage lands but immunity prevents a refreshed stun
    expect(target.hp).toBe(476);
    target.empResistance = 0;
    game.impact(pulse, target, false);
    expect(target.stunTime).toBe(EMP.stun);
  });

  it('uses shorter boss stuns and chains to only one nearby target after evolution', () => {
    const game = harness();
    game.taken.set('evo_emp', 1);
    const boss = enemy(10, true), linked = enemy(14), far = enemy(40);
    game.enemies = [boss, linked, far];
    game.spawnProjectile('player', 'bullet', new THREE.Vector3(10, 50, 0), new THREE.Vector3(), 12, 0, 0, 3, 0);
    const pulse = game.projectiles[0];
    pulse.weapon = 'emp';
    game.impact(pulse, boss, false);
    expect(boss.stunTime).toBe(EMP.bossStun);
    expect(linked.stunTime).toBe(EMP.chainStun);
    expect(linked.empResistance).toBe(EMP.resistance);
    expect(linked.hp).toBe(494);
    expect(far.hp).toBe(500);
  });

  it('dynamically converges shots on close-range and point-blank enemies directly in front of the mech', () => {
    const game = harness();
    const closeHostile = enemy(0);
    closeHostile.pos.set(0, 50, 4); // 4m in front of camera at (0, 50, 0)
    game.camera.position.set(0, 50, 0);
    game.camera.lookAt(0, 50, 10);
    game.camera.updateMatrixWorld(true);
    game.enemies = [closeHostile];

    game.firePrimaryBullets();
    expect(game.projectiles).toHaveLength(1);
    const p = game.projectiles[0];
    // Shot is directed forward toward the close target
    expect(p.vel.z).toBeGreaterThan(200);
    game.updateProjectiles(0.02);
    expect(closeHostile.hp).toBeLessThan(500);
  });
});
