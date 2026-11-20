import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Floaters } from './floaters';

const at = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** A camera 30m back on the z axis, looking at the test points' height. */
const testCamera = () => {
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 100);
  camera.position.set(0, 2, 30);
  camera.lookAt(0, 2, 0);
  camera.updateMatrixWorld(true);
  return camera;
};

describe('floaters', () => {
  it('records a damage readout', () => {
    const f = new Floaters();
    const enemy = {};
    f.addDamage(enemy, at(0, 2, 0), 42, false);
    expect(f.size).toBe(1);
    const out = f.project(testCamera());
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe('42');
    expect(out[0].kind).toBe('hit');
  });

  it('merges rapid hits on the same target into one climbing number', () => {
    const f = new Floaters();
    const enemy = {};
    f.addDamage(enemy, at(0, 2, 0), 10, false);
    f.addDamage(enemy, at(0, 2, 0), 15, false);
    f.update(0.1);
    f.addDamage(enemy, at(0, 2, 0), 20, false);
    expect(f.size).toBe(1);
    const [out] = f.project(testCamera());
    expect(out.text).toBe('45');
  });

  it('does not merge hits on different targets', () => {
    const f = new Floaters();
    f.addDamage({}, at(0, 2, 0), 10, false);
    f.addDamage({}, at(5, 2, 0), 10, false);
    expect(f.size).toBe(2);
  });

  it('promotes a merged readout to a crit once a crit lands', () => {
    const f = new Floaters();
    const enemy = {};
    f.addDamage(enemy, at(0, 2, 0), 10, false);
    f.addDamage(enemy, at(0, 2, 0), 40, true);
    const [out] = f.project(testCamera());
    expect(out.kind).toBe('crit');
    expect(out.text).toBe('50');
  });

  it('prunes expired readouts', () => {
    const f = new Floaters();
    f.addDamage({}, at(0, 2, 0), 10, false);
    f.update(2);
    expect(f.size).toBe(0);
  });

  it('caps the readout population, evicting damage numbers before score popups', () => {
    const f = new Floaters();
    for (let i = 0; i < 30; i++) f.addDamage({}, at(i, 2, 0), 1, false);
    f.addScore(at(0, 2, 0), 250);
    expect(f.size).toBeLessThanOrEqual(16);
    // the score popup survives eviction pressure from the damage flood
    const kinds = f.project(testCamera()).map((x) => x.kind);
    expect(kinds).toContain('score');
  });

  it('renders a score readout with the streak multiplier', () => {
    const f = new Floaters();
    f.addScore(at(0, 3, 0), 340, 3);
    const [out] = f.project(testCamera());
    expect(out.text).toBe('+340 ×3');
    expect(out.kind).toBe('score');
  });

  it('projects a point dead ahead to the centre of the screen', () => {
    const f = new Floaters();
    const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 100);
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);
    camera.updateMatrixWorld(true);
    f.addScore(at(0, 0, -20), 100);
    const [out] = f.project(camera);
    expect(out.x).toBeCloseTo(0.5, 1);
    expect(out.y).toBeGreaterThan(0.4);
    expect(out.y).toBeLessThan(0.62); // the readout climbs as it ages
  });

  it('drops readouts behind the camera', () => {
    const f = new Floaters();
    const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 100);
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);
    camera.updateMatrixWorld(true);
    f.addScore(at(0, 0, 10), 100);
    expect(f.project(camera)).toHaveLength(0);
  });
});
