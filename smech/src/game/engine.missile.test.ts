import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { Game } from './engine';

type Target = {
  alive: boolean;
  pos: THREE.Vector3;
  radius: number;
  height: number;
};

type MissileTargetHarness = {
  closestEnemyToAimCross(from: THREE.Vector3, dir: THREE.Vector3, range?: number): Target | null;
};

function target(x: number, z: number, alive = true): Target {
  return { alive, pos: new THREE.Vector3(x, 4, z), radius: 2, height: 2 };
}

function harness(enemies: Target[], hasLOS = vi.fn(() => true)) {
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 1000);
  camera.position.set(0, 5, 0);
  camera.lookAt(0, 5, 100);
  camera.updateMatrixWorld(true);
  const game = Object.assign(Object.create(Game.prototype), {
    camera,
    enemies,
    tmpA: new THREE.Vector3(),
    tmpB: new THREE.Vector3(),
    hasLOS,
  });
  return { game: game as MissileTargetHarness, camera, hasLOS };
}

const sightOrigin = () => new THREE.Vector3(0, 5, 0);
const sightDirection = () => new THREE.Vector3(0, 0, 1);

describe('missile reticle targeting', () => {
  it('chooses the enemy closest to the aim cross over a nearer off-center hostile', () => {
    const closeButOffAxis = target(10, 35);
    const centeredFartherAway = target(0, 110);
    const { game } = harness([closeButOffAxis, centeredFartherAway]);

    expect(game.closestEnemyToAimCross(sightOrigin(), sightDirection())).toBe(centeredFartherAway);
  });

  it('does not depend on enemy array order', () => {
    const left = target(-8, 55);
    const right = target(9, 70);
    const centered = target(0, 145);
    const first = harness([left, right, centered]).game.closestEnemyToAimCross(sightOrigin(), sightDirection());
    const reversed = harness([centered, right, left]).game.closestEnemyToAimCross(sightOrigin(), sightDirection());

    expect(first).toBe(centered);
    expect(reversed).toBe(centered);
  });

  it('skips dead, occluded, behind-camera, and out-of-range targets', () => {
    const deadCenter = target(0, 40, false);
    const blockedCenter = target(0, 60);
    const offAxis = target(8, 80);
    const behind = target(0, -20);
    const far = target(0, 400);
    const hasLOS = vi.fn((_from: THREE.Vector3, pos: THREE.Vector3) => pos !== blockedCenter.pos);
    const { game } = harness([deadCenter, blockedCenter, offAxis, behind, far], hasLOS);

    expect(game.closestEnemyToAimCross(sightOrigin(), sightDirection(), 240)).toBe(offAxis);
  });
});
