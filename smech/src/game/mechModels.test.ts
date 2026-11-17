import { describe, expect, it } from 'vitest';
import { COMPONENTS, STARTER_EQUIPPED } from './forge';
import { MODEL_KEYS, buildMech, componentModelKey, disposeMech } from './mechModels';

type Mech = ReturnType<typeof buildMech>;

const meshCount = (mech: Mech): number => {
  let count = 0;
  mech.traverse((object) => {
    if ((object as { isMesh?: boolean }).isMesh) count += 1;
  });
  return count;
};

describe('factory floor models', () => {
  it('gives every non-frame component a distinct, known model', () => {
    const keys = COMPONENTS.filter((comp) => comp.slot !== 'frame').map((comp) => componentModelKey(comp.id));
    expect(keys.every(Boolean)).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(MODEL_KEYS.has(key!), key ?? undefined).toBe(true);
  });

  it('assembles visibly different geometry for catalogue variants', () => {
    const builds = [
      STARTER_EQUIPPED,
      { ...STARTER_EQUIPPED, primary: 'p_autocannon_mk2' },
      { ...STARTER_EQUIPPED, primary: 'p_scatter_sawed' },
      { ...STARTER_EQUIPPED, secondary: 's_cannon_90' },
    ];
    const mechs = builds.map((equipped) => buildMech(equipped));
    const signatures = mechs.map(meshCount);
    expect(signatures.every((n) => n > 10)).toBe(true);
    expect(new Set(signatures).size).toBe(signatures.length);
    for (const mech of mechs) disposeMech(mech);
  });

  it('still assembles a bare frame when every weapon socket is stripped', () => {
    const mech = buildMech({ frame: 'f_glacier' });
    expect(meshCount(mech)).toBeGreaterThan(10);
    disposeMech(mech);
  });
});
