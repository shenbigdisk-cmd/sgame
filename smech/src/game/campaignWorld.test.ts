import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { CAMPAIGN_MISSIONS } from './campaign';
import { CampaignWorldManager } from './campaignWorld';

describe('CampaignWorldManager', () => {
  const dummyAudio = { playExplosion: vi.fn(), playPickup: vi.fn() } as unknown as import('./audio').AudioManager;

  it('spawns 3D installations and extraction pad in scene', () => {
    const scene = new THREE.Scene();
    const mission = CAMPAIGN_MISSIONS[0];
    const manager = new CampaignWorldManager(scene, mission, dummyAudio);

    expect(scene.children.length).toBeGreaterThan(0);

    const waypoints = manager.getWaypoints(0, 0, 0, 2, false);
    expect(waypoints.length).toBeGreaterThan(0);

    // Flak Batteries are Stage 2 waypoints
    const flakWp = waypoints.find((w) => w.title.includes('FLAK BATTERY'));
    expect(flakWp).toBeDefined();

    manager.dispose();
  });

  it('damages and destroys an installation when hit by projectiles', () => {
    const scene = new THREE.Scene();
    const mission = CAMPAIGN_MISSIONS[0];
    const onDestroyed = vi.fn();
    const manager = new CampaignWorldManager(scene, mission, dummyAudio, {
      onInstallationDestroyed: onDestroyed,
    });

    // Flak Battery Alpha is at [-90, 80]
    const start = new THREE.Vector3(-80, 2, 80);
    const end = new THREE.Vector3(-95, 2, 80);

    // Test swept collision hit
    const hit = manager.checkHit(start, end, 900, 5);
    expect(hit).toBe(true);
    expect(onDestroyed).toHaveBeenCalledWith(
      expect.stringContaining('flak_a'),
      'FLAK BATTERY ALPHA',
      -90,
      80,
    );

    manager.dispose();
  });
});
