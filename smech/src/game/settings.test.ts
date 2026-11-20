import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, loadSettings, normaliseSettings, saveSettings } from './settings';

if (typeof localStorage === 'undefined' || typeof localStorage.clear !== 'function') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  } as Storage;
}

describe('settings normalisation', () => {
  it('falls back to the defaults for junk input', () => {
    expect(normaliseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normaliseSettings('nope')).toEqual(DEFAULT_SETTINGS);
    expect(normaliseSettings({ sensitivity: 'fast' })).toEqual(DEFAULT_SETTINGS);
  });

  it('clamps out-of-range values', () => {
    const s = normaliseSettings({ sensitivity: 99, fov: 10, volume: 4, music: -2 });
    expect(s.sensitivity).toBe(3);
    expect(s.fov).toBe(55);
    expect(s.volume).toBe(1);
    expect(s.music).toBe(0);
  });

  it('keeps valid values', () => {
    const s = normaliseSettings({ sensitivity: 1.5, fov: 90, invertY: true, pitchAssist: false, quality: 'low', showFps: true, crosshair: false });
    expect(s.sensitivity).toBe(1.5);
    expect(s.fov).toBe(90);
    expect(s.invertY).toBe(true);
    expect(s.pitchAssist).toBe(false);
    expect(s.quality).toBe('low');
    expect(s.showFps).toBe(true);
    expect(s.crosshair).toBe(false);
  });

  it('rejects an unknown quality mode', () => {
    expect(normaliseSettings({ quality: 'ultra' }).quality).toBe('auto');
  });
});

describe('settings persistence', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips through localStorage', () => {
    const next = { ...DEFAULT_SETTINGS, sensitivity: 1.75, fov: 88, invertY: true, quality: 'high' as const };
    saveSettings(next);
    expect(loadSettings()).toEqual(next);
  });

  it('returns defaults when nothing was stored', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('survives a corrupted entry', () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, '{ not json');
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
