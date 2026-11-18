import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { Game } from './engine';
import { Ordnance } from './ordnance';
import { ORBITAL } from './orbital';
import { defaultStats } from './upgrades';
import { VEHICLES, type VehicleConfig } from './vehicles';
import type { EnemyKind, WeaponId } from './types';

type Target = {
  alive: boolean;
  pos: THREE.Vector3;
  radius: number;
  height: number;
  kind: EnemyKind;
  hp: number;
};
type OrbitalStrike = {
  kind: 'orbital';
  pos: THREE.Vector3;
  radius: number;
  damageMul: number;
  timer: number;
  shells: number;
  fired: number;
};
type Harness = {
  cfg: VehicleConfig;
  ordnance: Ordnance;
  owned: Set<WeaponId>;
  weaponCd: Partial<Record<WeaponId, number>>;
  taken: Map<string, number>;
  power: number;
  wave: number;
  waveActive: boolean;
  strikes: OrbitalStrike[];
  enemies: Target[];
  scene: THREE.Scene;
  audio: { playWave: ReturnType<typeof vi.fn>; playExplosion: ReturnType<typeof vi.fn> };
  weaponFx: { beam: ReturnType<typeof vi.fn> };
  mapApi: { structures: { blast: ReturnType<typeof vi.fn> } };
  spawnEnemy: ReturnType<typeof vi.fn>;
  damageEnemy: ReturnType<typeof vi.fn>;
  startWave: () => void;
  useWeapon: (id: WeaponId) => void;
  weaponCooldown: (id: WeaponId) => number;
  orbitalImpact: (strike: OrbitalStrike, index: number) => void;
};

/** Exercise the real simulation methods without constructing a WebGL renderer. */
function harness(): Harness {
  const cfg = { ...VEHICLES.pyre, loadout: { ...VEHICLES.pyre.loadout } };
  const game = Object.assign(Object.create(Game.prototype) as Harness, {
    cfg,
    ordnance: new Ordnance(cfg.loadout),
    owned: new Set<WeaponId>(['orbital', 'mines']),
    weaponCd: { orbital: 0, mines: 0 },
    stats: defaultStats(),
    taken: new Map<string, number>(),
    power: cfg.powerCapacity,
    powerWarnCd: 0,
    alive: true,
    paused: false,
    upgrading: false,
    wave: 1,
    waveActive: false,
    waveTag: '',
    strikes: [],
    enemies: [],
    scene: new THREE.Scene(),
    pulses: [],
    pos: new THREE.Vector3(),
    shake: 0,
    buffT: { overcharge: 0 },
    explosiveBarrels: [],
    audio: { playWave: vi.fn(), playStrikeCall: vi.fn(), playExplosion: vi.fn() },
    weaponFx: { beam: vi.fn() },
    mapApi: { structures: { blast: vi.fn(() => []) } },
    orbitalTarget: () => new THREE.Vector3(0, 0, 30),
    makeOrbitalMarker: () => new THREE.Group(),
    makeNoise: vi.fn(),
    spawnEnemy: vi.fn(),
    spawnDrop: vi.fn(),
    setMessage: vi.fn(),
    addFeed: vi.fn(),
    explosion: vi.fn(),
    elementBurst: vi.fn(),
    flashLight: vi.fn(),
    addCrater: vi.fn(),
    panFor: () => 0,
    damageEnemy: vi.fn((enemy: Target, damage: number) => {
      enemy.hp -= damage;
    }),
  });
  return game;
}

describe('stage rearm in the simulation', () => {
  it('refills and readies both racks when a new stage actually starts', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const game = harness();
    game.ordnance.count.Q = 0;
    game.ordnance.count.E = 1;
    game.weaponCd.orbital = 6;
    game.weaponCd.mines = 4;
    game.startWave();
    expect(game.wave).toBe(2);
    expect(game.waveActive).toBe(true);
    expect(game.spawnEnemy).toHaveBeenCalled();
    expect(game.ordnance.count).toEqual({ Q: 5, E: 3 });
    expect(game.weaponCd).toEqual({ orbital: 0, mines: 0 });
  });

  it('leaves stripped sockets empty and does not reset an unmounted weapon', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const game = harness();
    game.cfg.loadout.abilityQ = null;
    game.ordnance = new Ordnance(game.cfg.loadout);
    game.ordnance.count.E = 0;
    game.weaponCd.orbital = 6;
    game.weaponCd.mines = 4;
    game.startWave();
    expect(game.ordnance.count).toEqual({ Q: 0, E: 3 });
    expect(game.weaponCd).toEqual({ orbital: 6, mines: 0 });
  });
});

describe('Skyfall in the simulation', () => {
  it('spends one Q charge only when powered and off cooldown', () => {
    const game = harness();
    game.power = 0;
    game.useWeapon('orbital');
    expect(game.ordnance.count.Q).toBe(5);
    expect(game.strikes).toHaveLength(0);
    game.power = game.cfg.powerCapacity;
    game.useWeapon('orbital');
    expect(game.ordnance.count).toEqual({ Q: 4, E: 3 });
    expect(game.power).toBe(game.cfg.powerCapacity - game.cfg.powerCost.specialQ);
    expect(game.weaponCd.orbital).toBe(7);
    expect(game.strikes[0]).toMatchObject({
      kind: 'orbital',
      timer: ORBITAL.warning,
      radius: 24,
      shells: 7,
      fired: 0,
    });
    game.useWeapon('orbital');
    expect(game.ordnance.count.Q).toBe(4);
    game.weaponCd.orbital = 0;
    game.ordnance.count.Q = 0;
    const power = game.power;
    game.useWeapon('orbital');
    expect(game.power).toBe(power);
    expect(game.ordnance.count.Q).toBe(0);
  });

  it('applies the uplink and evolution to the real strike and cooldown', () => {
    const game = harness();
    game.taken.set('orbital_uplink', 2);
    game.taken.set('evo_orbital', 1);
    expect(game.weaponCooldown('orbital')).toBeCloseTo(7 * 0.76);
    game.useWeapon('orbital');
    expect(game.strikes[0].radius).toBeCloseTo(36);
    expect(game.strikes[0].damageMul).toBeCloseTo(1.2);
  });

  it('targets the nearest visible enemy or the sight’s ground/cover point', () => {
    const game = harness() as Harness & {
      camera: THREE.PerspectiveCamera;
      canvas: { clientHeight: number };
      arenaR: number;
      traceCover: () => number;
      hasLOS: () => boolean;
      orbitalTarget: () => THREE.Vector3;
    };
    game.camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 500);
    game.camera.position.set(0, 2, 0);
    game.camera.lookAt(0, 2, 40);
    game.camera.updateMatrixWorld(true);
    game.canvas = { clientHeight: 720 };
    game.arenaR = 100;
    game.traceCover = () => 100;
    game.hasLOS = () => true;
    game.orbitalTarget = (Game.prototype as unknown as { orbitalTarget: () => THREE.Vector3 }).orbitalTarget;
    game.enemies = [70, 40].map((z) => ({
      alive: true,
      pos: new THREE.Vector3(0, 0, z),
      radius: 2,
      height: 4,
      kind: 'mech',
      hp: 100,
    }));
    expect(game.orbitalTarget().z).toBeCloseTo(40);
    game.hasLOS = () => false;
    game.traceCover = () => 27;
    expect(game.orbitalTarget().z).toBeCloseTo(27);
    game.traceCover = () => 100;
    game.arenaR = 60;
    expect(game.orbitalTarget().z).toBeCloseTo(54);
  });

  it('draws the marker at the same radius used for damage', () => {
    const game = harness();
    const makeMarker = (
      Game.prototype as unknown as {
        makeOrbitalMarker: (target: THREE.Vector3, radius: number) => THREE.Group;
      }
    ).makeOrbitalMarker;
    const marker = makeMarker.call(game, new THREE.Vector3(5, 0, 10), 24);
    expect(marker.name).toBe('orbital-marker');
    const perimeter = marker.getObjectByName('orbital-perimeter') as THREE.Mesh;
    const points = perimeter.geometry.getAttribute('position');
    expect(points.count).toBeGreaterThan(100);
    const radii = Array.from({ length: points.count }, (_, i) => Math.hypot(points.getX(i), points.getZ(i)));
    expect(Math.max(...radii)).toBeCloseTo(24);
    expect(Math.min(...radii)).toBeCloseTo(23.45);
  });

  it('fires a vertical beam, damages the entire marked area and applies Breach Charges', () => {
    const game = harness();
    game.enemies = [0, 18, 40].map((x) => ({
      alive: true,
      pos: new THREE.Vector3(x, 0, 0),
      radius: 2,
      height: 4,
      kind: 'mech',
      hp: 1000,
    }));
    game.taken.set('breacher', 1);
    const strike: OrbitalStrike = {
      kind: 'orbital',
      pos: new THREE.Vector3(),
      radius: 24,
      damageMul: 1,
      timer: 0,
      shells: 7,
      fired: 0,
    };
    game.orbitalImpact(strike, 0);
    expect(game.enemies[0].hp).toBe(1000 - ORBITAL.coreDamage);
    expect(game.enemies[1].hp).toBeLessThan(1000);
    expect(game.enemies[2].hp).toBe(1000);
    expect(game.mapApi.structures.blast).toHaveBeenCalledWith(
      expect.any(THREE.Vector3),
      24,
      ORBITAL.coreDamage * 1.5,
    );
    const [start, end] = game.weaponFx.beam.mock.calls[0] as [THREE.Vector3, THREE.Vector3];
    expect(start.x).toBe(end.x);
    expect(start.z).toBe(end.z);
    expect(start.y - end.y).toBe(180);
    game.orbitalImpact(strike, 1);
    const [nextStart, nextEnd] = game.weaponFx.beam.mock.calls[1] as [THREE.Vector3, THREE.Vector3];
    expect(nextStart.x).toBeCloseTo(14.4);
    expect(nextStart.x).toBe(nextEnd.x);
    expect(nextStart.z).toBe(nextEnd.z);
    expect(game.scene.children.length).toBeGreaterThan(0);
  });
});
