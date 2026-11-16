import { describe, expect, it } from 'vitest';
import { aimAssist, cooldownReadiness, isModuleWeapon, moduleKey, secondaryReadiness, triggerReadiness } from './readiness';

describe('trigger readiness', () => {
  it('reports free heat for heat weapons', () => {
    expect(triggerReadiness({ isHeat: true, heat: 0, overheat: false, reloadRemaining: 0, reloadTime: 1 })).toBe(1);
    expect(triggerReadiness({ isHeat: true, heat: 0.5, overheat: false, reloadRemaining: 0, reloadTime: 1 })).toBe(0.5);
  });

  it('reports reload progress for non-heat weapons', () => {
    expect(triggerReadiness({ isHeat: false, heat: 0, overheat: false, reloadRemaining: 0, reloadTime: 2 })).toBe(1);
    expect(triggerReadiness({ isHeat: false, heat: 0, overheat: false, reloadRemaining: 1, reloadTime: 2 })).toBe(0.5);
    expect(triggerReadiness({ isHeat: false, heat: 0, overheat: false, reloadRemaining: 2, reloadTime: 2 })).toBe(0);
  });

  it('is never ready while overheated', () => {
    expect(triggerReadiness({ isHeat: true, heat: 0, overheat: true, reloadRemaining: 0, reloadTime: 1 })).toBe(0);
  });

  it('clamps out-of-range values into 0..1', () => {
    expect(triggerReadiness({ isHeat: false, heat: 0, overheat: false, reloadRemaining: -3, reloadTime: 2 })).toBe(1);
    expect(triggerReadiness({ isHeat: false, heat: 0, overheat: false, reloadRemaining: 9, reloadTime: 2 })).toBe(0);
    expect(triggerReadiness({ isHeat: true, heat: -1, overheat: false, reloadRemaining: 0, reloadTime: 1 })).toBe(1);
    expect(triggerReadiness({ isHeat: true, heat: 4, overheat: false, reloadRemaining: 0, reloadTime: 1 })).toBe(0);
  });

  it('treats a zero reload time as permanently ready', () => {
    expect(triggerReadiness({ isHeat: false, heat: 0, overheat: false, reloadRemaining: 5, reloadTime: 0 })).toBe(1);
  });
});

describe('cooldown readiness', () => {
  it('counts down from full to empty', () => {
    expect(cooldownReadiness(0, 10)).toBe(1);
    expect(cooldownReadiness(5, 10)).toBe(0.5);
    expect(cooldownReadiness(10, 10)).toBe(0);
  });

  it('stays ready when there is no cooldown at all', () => {
    expect(cooldownReadiness(0, 0)).toBe(1);
    expect(cooldownReadiness(3, 0)).toBe(1);
  });

  it('clamps values outside the expected range', () => {
    expect(cooldownReadiness(-2, 10)).toBe(1);
    expect(cooldownReadiness(20, 10)).toBe(0);
  });
});

describe('secondary readiness', () => {
  const base = { reloadRemaining: 0, reloadTime: 2, cooldownRemaining: 0, cooldownTime: 0, heat: 0, overheat: false };

  it('reads the cannon reload', () => {
    expect(secondaryReadiness({ ...base, kind: 'cannon' })).toBe(1);
    expect(secondaryReadiness({ ...base, kind: 'cannon', reloadRemaining: 1 })).toBe(0.5);
  });

  it('reads the grenade canister cooldown', () => {
    expect(secondaryReadiness({ ...base, kind: 'cryoball', cooldownTime: 4 })).toBe(1);
    expect(secondaryReadiness({ ...base, kind: 'cryoball', cooldownRemaining: 1, cooldownTime: 4 })).toBe(0.75);
  });

  it('reads beam heat and locks out while overheated', () => {
    expect(secondaryReadiness({ ...base, kind: 'beam' })).toBe(1);
    expect(secondaryReadiness({ ...base, kind: 'beam', heat: 0.4 })).toBe(0.6);
    expect(secondaryReadiness({ ...base, kind: 'beam', overheat: true })).toBe(0);
  });

  it('ignores the grenade cooldown for a beam and vice versa', () => {
    expect(secondaryReadiness({ ...base, kind: 'beam', cooldownRemaining: 9, cooldownTime: 10 })).toBe(1);
    expect(secondaryReadiness({ ...base, kind: 'cryoball', heat: 0.9, cooldownTime: 0 })).toBe(1);
  });
});

describe('aim assist', () => {
  it('clamps the multiplier into the advertised cone', () => {
    expect(aimAssist(1)).toBe(1);
    expect(aimAssist(0)).toBe(0);
    expect(aimAssist(-2)).toBe(0);
    expect(aimAssist(9)).toBe(1.6);
  });

  it('survives a broken stat', () => {
    expect(aimAssist(Number.NaN)).toBe(0);
    expect(aimAssist(Number.POSITIVE_INFINITY)).toBe(1.6);
  });
});

describe('module hardpoints', () => {
  it('binds the first module to R and the second to F', () => {
    expect(moduleKey(0)).toBe('R');
    expect(moduleKey(1)).toBe('F');
  });

  it('recognises the scavenged module weapons', () => {
    expect(isModuleWeapon('mortar')).toBe(true);
    expect(isModuleWeapon('nova')).toBe(true);
    expect(isModuleWeapon('overdrive')).toBe(true);
    expect(isModuleWeapon('cryo')).toBe(true);
    expect(isModuleWeapon('missiles')).toBe(false);
    expect(isModuleWeapon('turret')).toBe(false);
  });
});
