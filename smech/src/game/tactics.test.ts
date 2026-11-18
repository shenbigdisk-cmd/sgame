import { expect, it } from 'vitest';
import * as THREE from 'three';
import { boxImpact, gridInsert, nearObstacles, resetColliderGrid, type Obstacle } from './colliders';
import { StructureField } from './structures';
import { offerName, UPGRADES } from './upgrades';
import { impactMultiplier } from './threats';
const wall = (): Obstacle => ({
  x: 0,
  z: 0,
  y0: 0,
  h: 5,
  r: 5.1,
  box: { hw: 5, hd: 0.5, c: 1, s: 0, rot: 0 },
});
it('tracks a thin wall even when a shell crosses its entire depth in one frame', () => {
  const o = wall();
  expect(boxImpact(o, { x: 0, y: 3, z: -4 }, { x: 0, y: 3, z: 4 })).toBeCloseTo(3.5 / 8);
  expect(boxImpact(o, { x: 0, y: 6, z: -4 }, { x: 0, y: 6, z: 4 })).toBe(Infinity);
});
it('collapses once and clears both the obstacle list and spatial grid', () => {
  resetColliderGrid();
  const o = wall(),
    world = [o],
    field = new StructureField(world),
    model = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 1));
  slab.position.y = 2.5;
  model.add(slab);
  gridInsert(o);
  field.register(o, model, 'wall', 80);
  expect(field.blast(new THREE.Vector3(0, 25, 0), 4, 100)).toHaveLength(0);
  expect(field.blast(new THREE.Vector3(0, 2, 0), 4, 40)[0].remaining).toBe(50);
  expect(field.blast(new THREE.Vector3(0, 2, 0), 4, 40)[0].remaining).toBe(0);
  expect(world).toHaveLength(0);
  expect(nearObstacles(0, 0, 1)).not.toContain(o);
  expect(slab.visible).toBe(false);
  const sections = model.children.filter(
    (m) => m instanceof THREE.Mesh && m !== slab && m.visible && !(m instanceof THREE.InstancedMesh),
  );
  expect(sections.length).toBeGreaterThan(1);
  field.animate(0.35);
  expect(sections.some((m) => Math.abs(m.rotation.z) > 0.001)).toBe(true);
  field.animate(3);
  expect(model.scale.y).toBe(1);
  expect((model.getObjectByName('settled-rubble') as THREE.InstancedMesh).count).toBeGreaterThan(0);
  expect(field.blast(new THREE.Vector3(), 4, 100)).toHaveLength(0);
});
it('only numbers subsequent installations of stackable perks', () => {
  const name = (id: string, owned: number) => offerName(UPGRADES.find((u) => u.id === id)!, owned);
  expect(name('shield_cd', 0)).toBe('FLUX REGULATOR');
  expect(name('shield_cd', 1)).toBe('FLUX REGULATOR 2');
  expect(name('autoloader', 2)).toBe('AUTOLOADER 3');
  expect(name('autoloader', 3)).toBe('AUTOLOADER 4');
  for (const u of UPGRADES.filter((u) => u.max === 1 || u.id === 'medkit'))
    expect(offerName(u, 1)).toBe(u.name);
});
it('gives automatic weapons a niche against fragile airborne targets', () => {
  expect(impactMultiplier('skimmer', 'bullet')).toBe(1.5);
  expect(impactMultiplier('skimmer', 'shell')).toBe(1);
});
