import { beforeEach, it, expect } from 'vitest';
import { gridInsert, resetColliderGrid, obsDist, type Obstacle } from './colliders';
import { moveHull } from './hullMotion';
beforeEach(resetColliderGrid);
function wall(x: number, z: number, hw: number, hd: number): Obstacle {
  const o = { x, z, h: 8, y0: 0, r: Math.hypot(hw, hd), box: { hw, hd, c: 1, s: 0, rot: 0 } };
  gridInsert(o);
  return o;
}
it('slides along a wall and backs away without having to stop first', () => {
  wall(0, 0, 1, 30);
  const p = { x: 3, z: 0 },
    safe = { ...p };
  for (let i = 0; i < 30; i++) moveHull(p, -0.25, 0.25, 2, 80, safe);
  expect(p.x).toBeCloseTo(3);
  expect(p.z).toBeCloseTo(7.5);
  moveHull(p, 0.5, 0, 2, 80, safe);
  expect(p.x).toBeCloseTo(3.5);
});
it('does not enter a fence/wall pinch and can reverse out of it', () => {
  const o = wall(15, 0, 1, 10);
  const p = { x: 18.1, z: -3 },
    safe = { ...p };
  for (let i = 0; i < 50; i++) {
    moveHull(p, -0.2, 0.4, 2, 19, safe);
    expect(obsDist(o, p.x, p.z)).toBeGreaterThanOrEqual(2 - 1e-6);
    expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(19 + 1e-6);
  }
  const z = p.z;
  for (let i = 0; i < 10; i++) moveHull(p, 0, -0.3, 2, 19, safe);
  expect(p.z).toBeLessThan(z - 2.5);
});
it('can leave an exact circular collider center', () => {
  gridInsert({ x: 0, z: 0, r: 3, h: 5, y0: 0 });
  const p = { x: 0, z: 0 };
  moveHull(p, 0, 0, 2, 20, { x: 8, z: 0 });
  expect(Math.hypot(p.x, p.z)).toBeCloseTo(5);
});
