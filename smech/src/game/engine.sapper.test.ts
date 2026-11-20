import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetColliderGrid } from './colliders';
import { Game } from './engine';
import { Floaters } from './floaters';
import { STARTER_EQUIPPED, buildConfig } from './forge';
import { defaultStats } from './upgrades';

/**
 * The Ember Sapper (suicide rig) and the LAST CIRCUIT signature upgrade,
 * exercised in the real simulation the same way engine.handling.test.ts does:
 * the Game prototype with hand-stubbed internals.
 */

type SimEnemy = ReturnType<typeof buildSapper>;

function sapper(x: number, z = 0) {
  return buildSapper(x, z);
}

function buildSapper(x: number, z = 0) {
  return {
    kind: 'sapper',
    hp: 34,
    maxHp: 34,
    pos: new THREE.Vector3(x, 0, z),
    aware: true,
    alive: true,
    height: 2.1,
    radius: 1.7,
    cfg: { name: 'Ember Sapper', score: 130, speed: 15.5 },
    brittleTime: 0,
    burnTime: 0,
    stunTime: 0,
    freezeLock: 0,
    empResistance: 0,
    fireCooldown: 1,
    lostTimer: 0,
    searchPos: new THREE.Vector3(),
    group: new THREE.Group(),
    yaw: 0,
    aimYaw: 0,
    laser: null,
    slowTime: 0,
    burnDps: 0,
    cryoCharge: 0,
    canSee: false,
    blindFire: false,
    losTimer: 1,
    intelTimer: 99,
    stuckT: 0,
    lastX: x,
    lastZ: z,
    detourT: 0,
    detourYaw: 0,
    state: 'approach',
    stateTimer: 1,
    strafeDir: 1,
    burst: 0,
    burstTimer: 0,
    side: 1,
    turret: null,
    torso: new THREE.Group(),
    legs: [],
    walkPhase: 0,
    moving: false,
    hitFlash: 0,
    flashMats: [],
    bar: new THREE.Group(),
    barFg: new THREE.Mesh(
      new THREE.PlaneGeometry(4, 0.34),
      new THREE.MeshBasicMaterial(),
    ),
    boss: false,
    elite: false,
    cargo: 0,
    repairTimer: 0,
    dmgMul: 1,
    warned: false,
  };
}

function harness(hp = 1000, stats = defaultStats()) {
  const enemies: SimEnemy[] = [];
  const damageDirs: { angle: number; time: number }[] = [];
  const game = Object.assign(Object.create(Game.prototype), {
    cfg: buildConfig(STARTER_EQUIPPED),
    canvas: { clientHeight: 720 },
    camera: new THREE.PerspectiveCamera(70, 1, 0.1, 500),
    scene: { remove: vi.fn(), add: vi.fn() },
    time: 1,
    alive: true,
    hp,
    score: 0,
    kills: 0,
    streak: 0,
    streakTime: -10,
    pos: new THREE.Vector3(0, 0, 0),
    vel: new THREE.Vector3(),
    turretYaw: 0,
    damageDirs,
    damageFlash: 0,
    shake: 0,
    stats,
    taken: new Map<string, number>(),
    owned: new Set<string>(),
    shieldHp: 0,
    shieldBroken: true,
    shieldDelay: 0,
    shieldFlash: 0,
    buffT: { aegis: 0, overcharge: 0, rapid: 0, haste: 0, overdrive: 0, smoke: 0 },
    enemies,
    floaters: new Floaters(),
    tmpA: new THREE.Vector3(),
    tmpB: new THREE.Vector3(),
    tmpC: new THREE.Vector3(),
    tmpD: new THREE.Vector3(),
    floaterAnchor: new THREE.Vector3(),
    lastEnemyCombatTime: 0,
    ambushTime: -10,
    ambushMsgTime: -10,
    critTime: -10,
    hitMarkerTime: -10,
    spottedMsgTime: -10,
    reactiveCd: -99,
    arcTimer: 6,
    lastStandActive: false,
    power: 0,
    // collaborators
    audio: {
      playCrit: vi.fn(),
      playHitEnemy: vi.fn(),
      playPlayerHit: vi.fn(),
      playExplosion: vi.fn(),
      playKillStreak: vi.fn(),
      playLockWarning: vi.fn(),
      playOverdrive: vi.fn(),
    },
    sparks: vi.fn(),
    explosion: vi.fn(),
    dust: vi.fn(),
    flashLight: vi.fn(),
    elementBurst: vi.fn(),
    muzzleFlash: vi.fn(),
    spawnPickup: vi.fn(),
    spawnDrop: vi.fn(),
    leaveWreck: vi.fn(),
    makeNoise: vi.fn(),
    addFeed: vi.fn(),
    setMessage: vi.fn(),
    panFor: () => 0,
    isConcealed: () => false,
    fire: { emit: vi.fn() },
    smoke: { emit: vi.fn() },
    smokeClouds: [],
    dropTimer: 22,
    lootCredits: 0,
  });
  // structural type: just the surface the tests exercise (Game's own privates stay hidden)
  return game as unknown as {
    enemies: SimEnemy[];
    floaters: Floaters;
    damageDirs: { angle: number; time: number }[];
    score: number;
    kills: number;
    hp: number;
    shake: number;
    buffT: { aegis: number; overcharge: number; rapid: number; haste: number; overdrive: number; smoke: number };
    damageEnemy(e: never, dmg: number, powered?: boolean): void;
    killEnemy(e: never, award?: boolean): void;
  };
}

beforeEach(() => resetColliderGrid());

describe('Ember Sapper detonations', () => {
  it('ram-detonation wounds the pilot but banks no kill credit', () => {
    const game = harness();
    const rig = sapper(0, 0); // sitting on the hull: inside the fuse radius
    game.enemies.push(rig);
    game.killEnemy(rig as never, false);
    expect(rig.alive).toBe(false);
    expect(game.hp).toBeLessThan(1000);
    expect(game.kills).toBe(0);
    expect(game.score).toBe(0);
  });

  it('a sapper put down by fire still cooks off, at reduced force', () => {
    const game = harness();
    const rig = sapper(6, 0);
    game.enemies.push(rig);
    const hpBefore = game.hp;
    game.killEnemy(rig as never, true); // awarded kill
    expect(rig.alive).toBe(false);
    expect(game.kills).toBe(1);
    expect(game.score).toBe(130); // base score, streak of one
    expect(game.hp).toBeLessThan(hpBefore); // partial damage from the blast
    expect(game.hp).toBeGreaterThan(hpBefore - 45); // but clearly weaker than a ram
  });

  it('awards the kill through damageEnemy and emits a merged damage readout', () => {
    const game = harness(1000, { ...defaultStats(), critChance: 0 });
    const rig = sapper(12, 0);
    game.enemies.push(rig);
    game.damageEnemy(rig as never, 50);
    expect(rig.alive).toBe(false);
    // readout exists for the killing blow (and/or the cook-off chain)
    expect(game.floaters.size).toBeGreaterThanOrEqual(1);
    expect(game.kills).toBe(1);
  });

  it('sapper blasts hurt other hostiles caught in the fire', () => {
    const game = harness(1000, { ...defaultStats(), critChance: 0 });
    const rig = sapper(20, 0);
    const bystander = sapper(23, 0); // 3m from the blast centre
    bystander.cfg = { name: 'Ember Sapper', score: 130, speed: 15.5 };
    game.enemies.push(rig, bystander);
    game.killEnemy(rig as never, true);
    expect(bystander.hp).toBeLessThan(bystander.maxHp);
  });

  it('damagePlayer honours aegis shields against the blast', () => {
    const stats = { ...defaultStats(), armor: 0 };
    const game = harness(1000, stats);
    game.buffT.aegis = 5;
    const rig = sapper(0, 0);
    game.enemies.push(rig);
    game.killEnemy(rig as never, false);
    expect(game.hp).toBe(1000);
  });
});

describe('LAST CIRCUIT signature upgrade', () => {
  it('deals +35% damage while the hull is critical', () => {
    const stats = { ...defaultStats(), lastStand: 1 };
    const game = harness(150, stats);
    game.hp = 40; // below 35% of the warden's 150 base hull
    const target = sapper(50, 0);
    game.enemies.push(target);
    game.damageEnemy(target as never, 100);
    expect(target.hp).toBeCloseTo(34 - 135, 5);
  });

  it('does not boost damage above the threshold', () => {
    const stats = { ...defaultStats(), lastStand: 1 };
    const game = harness(150, stats);
    game.hp = 120; // above the band
    const target = sapper(50, 0);
    game.enemies.push(target);
    game.damageEnemy(target as never, 100);
    expect(target.hp).toBeCloseTo(34 - 100, 5);
  });

  it('scales with stacks and stays inert without the perk', () => {
    const stats = { ...defaultStats(), lastStand: 2 };
    const game = harness(150, stats);
    game.hp = 10;
    const target = sapper(50, 0);
    game.enemies.push(target);
    game.damageEnemy(target as never, 100);
    expect(target.hp).toBeCloseTo(34 - 170, 5);

    const plain = harness(150);
    plain.hp = 10;
    const t2 = sapper(50, 0);
    plain.enemies.push(t2);
    plain.damageEnemy(t2 as never, 100);
    expect(t2.hp).toBeCloseTo(34 - 100, 5);
  });
});
