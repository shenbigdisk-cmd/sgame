import { SIGHT_SIZE } from '../game/aimRing';
import Canopy from './Canopy';
import type { CSSProperties } from 'react';
import './cockpit.css';
import { SUPPLIES } from '../game/supplies';
import type { HudState, HudWeapon, VehicleType, RadarBlip, WeaponId } from '../game/types';
import { VEHICLES, WEAPON_INFO } from '../game/vehicles';
import type { Settings } from '../game/settings';
import { Icon } from './Icons';

interface Props {
  hud: HudState;
  vehicle: VehicleType;
  touch?: boolean;
  onZoom?: () => void;
  onUnstick?: () => void;
  onExtract?: () => void;
  onWeapon?: (id: WeaponId) => void;
  settings?: Settings;
}

const TWO_PI = Math.PI * 2;
const wrap = (a: number) => {
  a = a % TWO_PI;
  if (a > Math.PI) a -= TWO_PI;
  if (a < -Math.PI) a += TWO_PI;
  return a;
};
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const pad = (n: number, w = 2) => String(Math.max(0, Math.floor(n))).padStart(w, '0');
function Bar({
  ratio,
  color,
  height = 8,
  bg = 'rgba(0,0,0,0.55)',
}: {
  ratio: number;
  color: string;
  height?: number;
  bg?: string;
}) {
  return (
    <div
      className="w-full rounded-sm overflow-hidden"
      style={{ height, background: bg, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)' }}
    >
      <div
        className="h-full"
        style={{
          width: `${clamp01(ratio) * 100}%`,
          background: color,
          boxShadow: `0 0 8px ${color}`,
          transition: 'width 80ms linear',
        }}
      />
    </div>
  );
}

const BLIP_COLOR: Record<string, string> = {
  scout: '#ff4d4d',
  tank: '#ff5c33',
  mech: '#ff7733',
  heavy: '#ff1f5a',
  sniper: '#ff0077',
  mender: '#63ffba',
  jackal: '#ffa32e',
  skimmer: '#e791ff',
  bastion: '#ffc55a',
  boss: '#ff003c',
  pickup: '#00e5ff',
  drop: '#ffd700',
  obstacle: 'rgba(255,255,255,0.22)',
};

function Radar({
  blips,
  hullRel,
  accent,
  size,
}: {
  blips: RadarBlip[];
  hullRel: number;
  accent: string;
  size: number;
}) {
  const range = 180;
  const half = size / 2;
  const scale = half / range;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <defs>
        <clipPath id="radarClip">
          <circle cx={half} cy={half} r={half - 2} />
        </clipPath>
      </defs>
      <circle
        cx={half}
        cy={half}
        r={half - 1}
        fill="rgba(3,16,22,0.88)"
        stroke={accent}
        strokeOpacity="0.5"
      />
      <circle cx={half} cy={half} r={half * 0.66} fill="none" stroke={accent} strokeOpacity="0.2" />
      <circle cx={half} cy={half} r={half * 0.33} fill="none" stroke={accent} strokeOpacity="0.2" />
      <line x1={half} y1={2} x2={half} y2={size - 2} stroke={accent} strokeOpacity="0.15" />
      <line x1={2} y1={half} x2={size - 2} y2={half} stroke={accent} strokeOpacity="0.15" />
      <path
        d={`M${half} ${half} L${half - half * 0.6} 2 L${half + half * 0.6} 2 Z`}
        fill={accent}
        fillOpacity="0.08"
      />
      <g clipPath="url(#radarClip)">
        {blips.map((b, i) => {
          let x = half + b.x * scale;
          let y = half - b.y * scale;
          const c = BLIP_COLOR[b.kind] ?? '#ff4d4d';

          // 1. Obstacles
          if (b.kind === 'obstacle') {
            const fill = b.tall ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.16)';
            if (b.poly) {
              const pts: string[] = [];
              for (let k = 0; k < b.poly.length; k += 2)
                pts.push(`${half + b.poly[k] * scale},${half - b.poly[k + 1] * scale}`);
              return <polygon key={i} points={pts.join(' ')} fill={fill} />;
            }
            return <circle key={i} cx={x} cy={y} r={Math.max(1.2, (b.size ?? 3) * scale)} fill={fill} />;
          }

          // 2. Supply Drops (Crates / Nano repair / ammo): distinct glowing crate box with +
          if (b.kind === 'relay')
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={4}
                fill="none"
                stroke={b.size === 1 ? '#63ffba' : '#ffaf46'}
                strokeWidth={1.8}
              />
            );
          if (b.kind === 'drop' && b.dropKind) {
            const supply = SUPPLIES[b.dropKind];
            return (
              <g key={i} transform={`translate(${x - 5},${y - 5}) scale(0.42)`}>
                <rect width="24" height="24" rx="3" fill="#102019" stroke={supply.color} />
                <path d={supply.path} fill="none" stroke={supply.color} strokeWidth="2.8" />
              </g>
            );
          }
          // 3. Pickups (Credits, scrap, exp): bright neon cyan diamond
          if (b.kind === 'pickup') {
            return (
              <polygon
                key={i}
                points={`${x},${y - 3.2} ${x + 3.2},${y} ${x},${y + 3.2} ${x - 3.2},${y}`}
                fill="#00e5ff"
                style={{ filter: 'drop-shadow(0 0 3px #00e5ff)' }}
              />
            );
          }

          // 4. Edge indicator for distant or unseen enemy tanks (clamped to perimeter)
          if (b.edge) {
            const angle = Math.atan2(y - half, x - half);
            const edgeRadius = half - 5;
            const ex = half + Math.cos(angle) * edgeRadius;
            const ey = half + Math.sin(angle) * edgeRadius;
            const rotDeg = (angle * 180) / Math.PI + 90;
            return (
              <g key={i} transform={`translate(${ex},${ey}) rotate(${rotDeg})`}>
                <polygon
                  points="0,-5 4,3 -4,3"
                  fill={c}
                  stroke="#ffffff"
                  strokeWidth="0.8"
                  style={{ filter: `drop-shadow(0 0 4px ${c})` }}
                />
              </g>
            );
          }

          // 5. Boss: prominent crowned diamond
          if (b.kind === 'boss') {
            const d = Math.hypot(x - half, y - half);
            if (d > half - 6) {
              x = half + ((x - half) / d) * (half - 6);
              y = half + ((y - half) / d) * (half - 6);
            }
            return (
              <polygon
                key={i}
                points={`${x},${y - 6} ${x + 6},${y} ${x},${y + 6} ${x - 6},${y}`}
                fill={c}
                stroke="#ffffff"
                strokeWidth="0.8"
                style={{ filter: `drop-shadow(0 0 5px ${c})` }}
              />
            );
          }

          // 6. Enemies: hostile directional triangles / chevrons
          if (b.kind === 'heavy') {
            return (
              <polygon
                key={i}
                points={`${x},${y - 4} ${x + 4},${y} ${x},${y + 4} ${x - 4},${y}`}
                fill={c}
                stroke="#ffffff"
                strokeWidth="0.8"
                style={{ filter: `drop-shadow(0 0 3px ${c})` }}
              />
            );
          }
          // Scout, tank, mech, sniper: sharp hostile arrow
          return (
            <polygon
              key={i}
              points={`${x},${y - 3.5} ${x + 3},${y + 2.5} ${x - 3},${y + 2.5}`}
              fill={c}
              style={{ filter: `drop-shadow(0 0 3px ${c})` }}
            />
          );
        })}
      </g>
      <g transform={`rotate(${(-hullRel * 180) / Math.PI} ${half} ${half})`}>
        <line
          x1={half}
          y1={half}
          x2={half}
          y2={half - 16}
          stroke="#ffffff"
          strokeOpacity="0.7"
          strokeWidth="1.5"
        />
        <polygon
          points={`${half},${half - 20} ${half - 3},${half - 14} ${half + 3},${half - 14}`}
          fill="#ffffff"
          fillOpacity="0.8"
        />
      </g>
      <circle cx={half} cy={half} r={2.5} fill={accent} />
    </svg>
  );
}

// A single transient notice: actionable information displaces routine telemetry.
function Notice({
  hud,
  touch,
  onExtract,
  onUnstick,
}: Pick<Props, 'hud' | 'touch' | 'onExtract' | 'onUnstick'>) {
  if (!hud.alive) return null;
  if (hud.salvageWindow)
    return (
      <button className="cp-extract" onClick={onExtract}>
        Extract ↵ · {Math.ceil(hud.victoryCountdown)}s
      </button>
    );
  if (hud.driveBlocked)
    return (
      <button className="cp-extract" onClick={onUnstick}>
        Drive blocked · Unstick [U]
      </button>
    );
  if (hud.lockWarning > 0) return <strong className="cp-danger">Sniper lock · break sightline</strong>;
  if (hud.strikeInbound > 0)
    return <>{hud.strikeKind === 'orbital' ? 'Skyfall' : 'Artillery'} inbound · {hud.strikeInbound.toFixed(1)}s</>;
  if (hud.priOverheat || hud.secOverheat)
    return (
      <strong className="cp-danger">
        {hud.priOverheat && hud.secOverheat ? 'Weapons' : hud.priOverheat ? 'Primary' : 'Secondary'}{' '}
        overheated
      </strong>
    );
  if (hud.relay)
    return (
      <>
        Linking {hud.relay.name} · {Math.floor(hud.relay.progress * 100)}%
      </>
    );
  if (hud.victoryCountdown > 0) return <>Stage clear · draft in {Math.ceil(hud.victoryCountdown)}s</>;
  if (hud.dropInbound)
    return (
      <>
        Inbound: {hud.dropInbound.label} · {Math.ceil(hud.dropInbound.seconds)}s
      </>
    );
  if (touch && hud.time < 12)
    return (
      <>
        <span className="cp-touch-hint-full">Right: drag aim · hold fire · 2 fingers alt</span>
        <span className="cp-touch-hint-compact">Hold fire · 2 fingers alt</span>
      </>
    );
  if (hud.waveCountdown > 0) return <>Next wave · {Math.ceil(hud.waveCountdown)}s</>;
  if (hud.messageAge < 2.7 && hud.message) return <>{hud.message}</>;
  const last = hud.feed.at(-1);
  if (last && last.age < 2.2) return <>{last.text}</>;
  const cache = hud.drops.filter((d) => d.kind === 'coins' && !d.inbound).sort((a, b) => a.dist - b.dist)[0];
  return cache ? (
    <>
      <i style={{ display: 'inline-block', transform: `rotate(${cache.bearing}rad)` }}>↑</i> Cache ·{' '}
      {Math.round(cache.dist)}m
    </>
  ) : null;
}

function SpecialWeapon({
  weapon,
  slot,
  onWeapon,
}: {
  weapon?: HudWeapon;
  slot: 'Q' | 'E';
  onWeapon?: Props['onWeapon'];
}) {
  const id = weapon?.id;
  const depleted = weapon?.charges === 0;
  const cooldown = Math.ceil(weapon?.cooldownLeft ?? 0);
  const charging = !!weapon?.underpowered;
  const progress = clamp01(weapon?.ready ?? 0);
  const status = !id
    ? 'Empty socket'
    : depleted
      ? 'Rearm required'
      : cooldown > 0
        ? `Cooldown ${cooldown} seconds`
        : charging
          ? 'Charging'
          : progress < 1
            ? 'Not ready'
            : 'Ready';
  const count = weapon?.charges === undefined ? '—' : `${weapon.charges}/${weapon.capacity}`;
  const warning = depleted || charging;
  return (
    <button
      type="button"
      className={`cp-special${warning ? ' is-warning' : ''}${!id ? ' is-empty' : ''}`}
      aria-label={`${slot} ${id ? weapon.name : 'empty socket'}: ${status}${id && weapon.charges !== undefined ? `, ${weapon.charges} of ${weapon.capacity} charges` : ''}`}
      title={
        id
          ? `${weapon.name} · ${status}${weapon.cost === undefined ? '' : ` · ${weapon.cost} kJ/use`}`
          : `${slot} · Empty socket`
      }
      disabled={!id || depleted || cooldown > 0 || charging || progress < 1}
      onClick={() => {
        if (id) onWeapon?.(id);
      }}
    >
      <svg className="cp-special-ring" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r="21.5" className="cp-special-track" />
        {id && (
          <circle
            cx="24"
            cy="24"
            r="21.5"
            pathLength="100"
            className="cp-special-progress"
            strokeDasharray={`${progress * 100} 100`}
            transform="rotate(-90 24 24)"
          />
        )}
      </svg>
      <span className="cp-special-key">{slot}</span>
      <span className="cp-special-face">
        {!id ? (
          '—'
        ) : depleted ? (
          'REARM'
        ) : cooldown > 0 ? (
          `${cooldown}s`
        ) : charging ? (
          'PWR'
        ) : (
          <Icon name={WEAPON_INFO[id].icon} />
        )}
      </span>
      <span className="cp-special-count">{count}</span>
    </button>
  );
}

export default function HUD({
  hud,
  vehicle,
  touch,
  onZoom,
  onWeapon,
  onExtract,
  onUnstick,
  settings,
}: Props) {
  const accent = VEHICLES[vehicle].accent;
  const visibility = hud.seenBy ? 'Exposed' : hud.detected ? 'Hunted' : 'Concealed';
  const alert = hud.seenBy ? '#ff9179' : hud.detected ? '#f2cb7a' : '#9bc8a9';
  const vitals = [
    { label: 'Hull', val: hud.hp, max: hud.maxHp, color: hud.hp / hud.maxHp < 0.3 ? '#ff795f' : '#beea99' },
    { label: 'Shield', val: hud.shield, max: hud.shieldMax, color: hud.shieldActive ? '#8ecff2' : '#e1ac63' },
  ];
  const incoming = hud.damageDirs.at(-1);
  return (
    <div className="cp-overlay" style={{ '--cp-accent': accent } as CSSProperties}>
      <div
        aria-hidden
        className="cp-glass"
        style={{
          boxShadow:
            hud.damageFlash > 0.02
              ? `inset 0 0 90px rgba(255,54,29,${hud.damageFlash})`
              : hud.buffs.some((b) => b.id === 'aegis')
                ? 'inset 0 0 60px #66e5ff44'
                : undefined,
        }}
      />
      <Canopy />
      <header className="cp-top">
        <section className="cp-stage">
          <div className="cp-eyebrow">
            {VEHICLES[vehicle].shortName} <span>/ {hud.district}</span>
          </div>
          <div className="cp-stage-line">
            <b>Stage {pad(hud.wave)}</b>
            <span>{pad(hud.enemiesLeft)} hostiles</span>
          </div>
          {hud.waveTag && <small className="cp-wave">{hud.waveTag}</small>}
          {hud.boss && (
            <div className="cp-boss">
              {hud.boss.name}
              <Bar ratio={hud.boss.hp} color="#fa866d" height={3} />
            </div>
          )}
        </section>
        {touch && (
          <button type="button" className="cp-zoom" onClick={onZoom} aria-label="Toggle scope">
            <Icon name="target" size={18} />
          </button>
        )}
        <div className="cp-notice">
          <Notice hud={hud} touch={touch} onUnstick={onUnstick} onExtract={onExtract} />
        </div>
      </header>
      {hud.alive && (
        <div className="cp-aim">
          {hud.zoom && <div className="cp-scope" />}
          {settings?.crosshair !== false && (
            <svg
              className="cp-reticle"
              width={SIGHT_SIZE}
              height={SIGHT_SIZE}
              viewBox="-24 -24 48 48"
              role="img"
              aria-label={hud.aimedEnemy ? 'Enemy in sight' : 'Open sight'}
            >
              {incoming && incoming.age < 1 && (
                <path
                  transform={`rotate(${(-incoming.angle * 180) / Math.PI})`}
                  d="M-11 -16 Q0 -22 11 -16"
                  fill="none"
                  stroke="#ff8068"
                  strokeWidth="2"
                />
              )}
              <circle
                className="cp-reticle-ring"
                r="11"
                pathLength="100"
                fill="none"
                stroke={hud.aimedEnemy ? '#ff4b60' : '#a9eaf0'}
                strokeWidth={hud.aimedEnemy ? 1 : 0.7}
                strokeDasharray={hud.aimedEnemy ? undefined : '22.5 2.5'}
                transform="rotate(-45)"
              />
              <path
                d="M0 -16v2.4 M16 0h-2.4 M0 16v-2.4 M-16 0h2.4"
                stroke={hud.aimedEnemy ? '#ff4b60' : '#a9eaf0'}
                strokeWidth="0.65"
                opacity="0.85"
              />
              <circle r="0.65" fill={hud.aimedEnemy ? '#ff4b60' : '#e2fbff'} />
              {hud.hitMarkerAge < 0.2 && (
                <path
                  d="M-9 -9l-2 -2 M9 -9l2 -2 M9 9l2 2 M-9 9l-2 2"
                  stroke={hud.critAge < 0.25 ? '#ffbe66' : 'white'}
                  strokeWidth="1.1"
                  fill="none"
                />
              )}
            </svg>
          )}
        </div>
      )}
      <footer className="cp-dock">
        <section className="flight-vitals" aria-label="Chassis instruments">
          <div className="flight-contact">
            <b style={{ color: alert }}>● {visibility}</b>
            {settings?.showFps && <small>{Math.round(hud.fps)} FPS</small>}
          </div>
          <div className="cp-vitals">
            {vitals.map((v) => {
              const restarting = v.label === 'Shield' && !hud.shieldActive;
              const waiting = restarting && hud.shieldDelay > 0;
              const status = waiting
                ? `, recharge starts in ${Math.ceil(hud.shieldDelay)} seconds`
                : restarting
                  ? ', restarting'
                  : '';
              return (
                <div
                  className="cp-meter"
                  key={v.label}
                  role="progressbar"
                  aria-label={v.label}
                  aria-valuemin={0}
                  aria-valuemax={Math.max(v.max, 1)}
                  aria-valuenow={Math.max(0, Math.min(v.val, Math.max(v.max, 1)))}
                  aria-valuetext={`${Math.ceil(v.val)} of ${v.max}${status}`}
                  title={`${v.label}: ${Math.ceil(v.val)} / ${v.max}`}
                >
                  <label>{v.label}</label>
                  <b>{waiting ? `${Math.ceil(hud.shieldDelay)}s` : Math.ceil(v.val)}</b>
                  <Bar
                    ratio={v.val / Math.max(v.max, 1)}
                    color={v.color}
                    height={6}
                    bg="rgba(39, 75, 80, 0.65)"
                  />
                </div>
              );
            })}
          </div>
          <div className="cp-buffs">
            {hud.buffs.slice(0, 2).map((b) => (
              <span key={b.id}>
                {b.name} · {Math.ceil(b.time)}s
              </span>
            ))}
          </div>
        </section>
        <section className="cp-weapons" aria-label="Additional weapons">
          <SpecialWeapon slot="Q" weapon={hud.weapons[2]} onWeapon={onWeapon} />
          <SpecialWeapon slot="E" weapon={hud.weapons[3]} onWeapon={onWeapon} />
        </section>
        <section className="flight-radar" aria-label="Tactical radar">
          <Radar blips={hud.blips} hullRel={wrap(hud.hullYaw - hud.turretYaw)} accent={accent} size={128} />
        </section>
      </footer>
    </div>
  );
}
