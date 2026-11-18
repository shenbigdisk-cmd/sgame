import { describe, expect, it } from 'vitest';
import { Ordnance, RACK_CAPACITIES } from './ordnance';
import { buildConfig, PRESETS } from './forge';
import { VEHICLES } from './vehicles';

describe('special cartridges', () => {
  it('uses slot capacities even when weapons are swapped between mounts', () => {
    const rack = new Ordnance({ ...VEHICLES.warden.loadout, abilityQ: 'smoke', abilityE: 'cinder' });
    expect(rack.key('smoke')).toBe('Q');
    expect(rack.key('cinder')).toBe('E');
    expect(rack.key('cannon')).toBeUndefined();
    expect(RACK_CAPACITIES).toEqual({ Q: 5, E: 3 });
    expect(rack.count).toEqual({ Q: 5, E: 3 });
    expect(rack.missing || rack.dry).toBe(false);
  });

  it('adds one charge per mounted rack without exceeding its own cap', () => {
    const rack = new Ordnance(VEHICLES.pyre.loadout);
    rack.count.Q = 0;
    rack.count.E = 2;
    expect(rack.dry).toBe(true);
    rack.rearm();
    expect(rack.count).toEqual({ Q: 1, E: 3 });
    expect(rack.dry).toBe(false);
    expect(rack.missing).toBe(true);
    for (let i = 0; i < 10; i++) rack.rearm();
    expect(rack.count).toEqual({ Q: 5, E: 3 });
    expect(rack.missing).toBe(false);
  });

  it('fully refills depleted or partially spent racks for a new stage', () => {
    const rack = new Ordnance(VEHICLES.pyre.loadout);
    rack.count.Q = 0;
    rack.count.E = 1;
    rack.refill();
    expect(rack.count).toEqual({ Q: 5, E: 3 });
    expect(rack.dry || rack.missing).toBe(false);
  });

  it('never loads or requests supplies for stripped mounts', () => {
    const empty = new Ordnance({ ...VEHICLES.pyre.loadout, abilityQ: null, abilityE: null });
    empty.rearm();
    empty.refill();
    expect(empty.count).toEqual({ Q: 0, E: 0 });
    expect(empty.dry || empty.missing).toBe(false);
    const onlyE = new Ordnance({ ...VEHICLES.pyre.loadout, abilityQ: null });
    onlyE.count.E = 0;
    onlyE.refill();
    expect(onlyE.count).toEqual({ Q: 0, E: 3 });
    const onlyQ = new Ordnance({ ...VEHICLES.pyre.loadout, abilityE: null });
    onlyQ.count.Q = 0;
    onlyQ.refill();
    expect(onlyQ.count).toEqual({ Q: 5, E: 0 });
  });

  it('gives factory Pyre Skyfall while preserving Cinder in custom builds', () => {
    expect(VEHICLES.pyre.loadout.abilityQ).toBe('orbital');
    expect(buildConfig(PRESETS[1].equipped).loadout.abilityQ).toBe('orbital');
    expect(buildConfig({ frame: 'f_pyre', specialQ: 'x_jump' }).loadout.abilityQ).toBe('cinder');
  });
});
