import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createSentryTurret } from './sentryTurret';

describe('field sentry model', () => {
  it('builds a detailed three-foot platform with a separately aimable head', () => {
    const model = createSentryTurret('#62e6cb');
    const feet = model.group.children.filter((child) => child.type === 'Mesh');
    let meshCount = 0;
    model.group.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) meshCount += 1;
    });

    expect(model.group.name).toBe('warden-field-sentry');
    expect(model.head.name).toBe('sentry-traverse-head');
    expect(model.head.parent).toBe(model.group);
    expect(feet.length).toBeGreaterThanOrEqual(10);
    expect(meshCount).toBeGreaterThan(30);
    expect(model.head.position.y).toBeGreaterThan(2);
  });
});
