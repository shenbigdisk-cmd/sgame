import { useCallback } from 'react';
import { DEFAULT_SETTINGS, type QualityMode, type Settings } from '../game/settings';

interface Props {
  settings: Settings;
  onChange: (next: Settings) => void;
  accent?: string;
  /** Compact layout for the pause overlay. */
  dense?: boolean;
}

const DISPLAY = "'Orbitron', 'Share Tech Mono', monospace";
const MONO = "'Share Tech Mono', 'Courier New', monospace";

const QUALITY_LABEL: Record<QualityMode, string> = { auto: 'AUTO', high: 'HIGH', low: 'LIGHT' };

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="settings-toggle"
      style={{ background: on ? 'var(--settings-accent)' : 'rgba(255,255,255,0.06)', color: on ? '#10161a' : '#93a7a0', borderColor: on ? 'var(--settings-accent)' : 'rgba(255,255,255,0.18)' }}
    >
      {on ? 'ON' : 'OFF'}
    </button>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="settings-row">
      <span className="settings-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ['--pct' as string]: `${pct}%` }}
      />
      <span className="settings-value">{format(value)}</span>
    </label>
  );
}

export default function SettingsPanel({ settings, onChange, accent = '#8fdbe1', dense = false }: Props) {
  const patch = useCallback(
    (next: Partial<Settings>) => onChange({ ...settings, ...next }),
    [settings, onChange],
  );

  return (
    <div
      className={`settings-panel ${dense ? 'is-dense' : ''}`}
      style={{ '--settings-accent': accent } as React.CSSProperties}
    >
      <div className="settings-heading">
        <span>COCKPIT CONFIGURATION</span>
        <button type="button" className="settings-reset" onClick={() => onChange({ ...DEFAULT_SETTINGS })} title="Restore defaults">
          RESET
        </button>
      </div>

      <Slider
        label="SENSITIVITY"
        value={settings.sensitivity}
        min={0.25}
        max={3}
        step={0.05}
        format={(v) => `${v.toFixed(2)}x`}
        onChange={(v) => patch({ sensitivity: v })}
      />
      <Slider
        label="FIELD OF VIEW"
        value={settings.fov}
        min={55}
        max={105}
        step={1}
        format={(v) => `${v}°`}
        onChange={(v) => patch({ fov: v })}
      />
      <Slider
        label="MASTER VOLUME"
        value={settings.volume}
        min={0}
        max={1}
        step={0.05}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(v) => patch({ volume: v })}
      />
      <Slider
        label="SCORE VOLUME"
        value={settings.music}
        min={0}
        max={1}
        step={0.05}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(v) => patch({ music: v })}
      />

      <div className="settings-row">
        <span className="settings-label">RENDER QUALITY</span>
        <div className="settings-choice" role="group" aria-label="Render quality">
          {(Object.keys(QUALITY_LABEL) as QualityMode[]).map((q) => (
            <button
              key={q}
              type="button"
              aria-pressed={settings.quality === q}
              className={settings.quality === q ? 'active' : ''}
              onClick={() => patch({ quality: q })}
            >
              {QUALITY_LABEL[q]}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-row">
        <span className="settings-label">INTELLIGENT AIMING</span>
        <Toggle on={settings.pitchAssist} onChange={(v) => patch({ pitchAssist: v })} label="Auto-elevation pitch tracking" />
      </div>
      <div className="settings-row">
        <span className="settings-label">INVERT LOOK</span>
        <Toggle on={settings.invertY} onChange={(v) => patch({ invertY: v })} label="Invert look axis" />
      </div>
      <div className="settings-row">
        <span className="settings-label">CROSSHAIR</span>
        <Toggle on={settings.crosshair} onChange={(v) => patch({ crosshair: v })} label="Show crosshair" />
      </div>
      <div className="settings-row">
        <span className="settings-label">PERFORMANCE READOUT</span>
        <Toggle on={settings.showFps} onChange={(v) => patch({ showFps: v })} label="Show performance readout" />
      </div>

      <p className="settings-note" style={{ fontFamily: MONO }}>
        {settings.quality === 'low'
          ? 'LIGHT MODE — bloom and shadows disabled for maximum frame rate.'
          : settings.quality === 'high'
            ? 'HIGH MODE — full resolution bloom, adaptive downscaling disabled.'
            : 'AUTO — resolution and bloom scale down automatically if frames drop.'}
      </p>
      <span className="sr-only" style={{ fontFamily: DISPLAY }}>{settings.crosshair ? 'crosshair on' : 'crosshair off'}</span>
    </div>
  );
}
