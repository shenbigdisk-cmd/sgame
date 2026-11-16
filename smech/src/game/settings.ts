/**
 * Player settings. Persisted to localStorage so a run always starts with the
 * cockpit the player left behind.
 */

export type QualityMode = 'auto' | 'high' | 'low';

export interface Settings {
  /** Mouse / touch look sensitivity multiplier. */
  sensitivity: number;
  /** Horizontal field of view in degrees. */
  fov: number;
  /** Invert the vertical look axis. */
  invertY: boolean;
  /** Rendering budget: adaptive, full quality or a light one. */
  quality: QualityMode;
  /** Master volume, 0..1. */
  volume: number;
  /** Music volume, 0..1. */
  music: number;
  /** Draw a frame-time / FPS readout in the HUD. */
  showFps: boolean;
  /** Draw the cockpit crosshair. */
  crosshair: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  sensitivity: 1,
  fov: 70,
  invertY: false,
  quality: 'auto',
  volume: 0.75,
  music: 0.6,
  showFps: false,
  crosshair: true,
};

export const SETTINGS_STORAGE_KEY = 'steel-horizon:settings:v1';

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** Merge stored values over the defaults, ignoring anything malformed. */
export function normaliseSettings(raw: unknown): Settings {
  const out: Settings = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== 'object') return out;
  const src = raw as Partial<Record<keyof Settings, unknown>>;
  const num = (key: 'sensitivity' | 'fov' | 'volume' | 'music') => {
    const v = src[key];
    if (typeof v === 'number' && Number.isFinite(v)) out[key] = v;
  };
  num('sensitivity');
  num('fov');
  num('volume');
  num('music');
  if (typeof src.invertY === 'boolean') out.invertY = src.invertY;
  if (typeof src.showFps === 'boolean') out.showFps = src.showFps;
  if (typeof src.crosshair === 'boolean') out.crosshair = src.crosshair;
  if (src.quality === 'auto' || src.quality === 'high' || src.quality === 'low') out.quality = src.quality;
  out.sensitivity = clamp(out.sensitivity, 0.25, 3);
  out.fov = clamp(out.fov, 55, 105);
  out.volume = clamp(out.volume, 0, 1);
  out.music = clamp(out.music, 0, 1);
  return out;
}

export function loadSettings(): Settings {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return normaliseSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* storage may be unavailable (private mode / embedded webviews) */
  }
}
