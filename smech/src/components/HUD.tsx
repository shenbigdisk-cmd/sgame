import type { HudState, VehicleType, RadarBlip, WeaponId } from '../game/types';
import { VEHICLES } from '../game/vehicles';
import type { Settings } from '../game/settings';
import { Icon } from './Icons';

interface Props {
  hud: HudState;
  vehicle: VehicleType;
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
const fmtTime = (t: number) => `${pad(t / 60)}:${pad(t % 60)}`;

const MONO = "'Share Tech Mono', 'Courier New', monospace";
const DISPLAY = "'Orbitron', 'Share Tech Mono', monospace";
function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="flex flex-col leading-none">
      <span className="text-[9px] md:text-[10px] tracking-[0.3em] opacity-60">{label}</span>
      <span className="text-sm md:text-lg mt-1" style={{ fontFamily: DISPLAY, color: accent, textShadow: `0 0 8px ${accent}55` }}>
        {value}
      </span>
    </div>
  );
}

function Bar({ ratio, color, height = 8, bg = 'rgba(0,0,0,0.55)' }: { ratio: number; color: string; height?: number; bg?: string }) {
  return (
    <div className="w-full rounded-sm overflow-hidden" style={{ height, background: bg, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)' }}>
      <div className="h-full" style={{ width: `${clamp01(ratio) * 100}%`, background: color, boxShadow: `0 0 8px ${color}`, transition: 'width 80ms linear' }} />
    </div>
  );
}

function CockpitFrame({ vehicle: _vehicle, accent }: { vehicle: VehicleType; accent: string }) {
  const tank = false;
  const viewport = tank ? 'M3 9 L97 9 L99 13 L99 80 L97 83 L3 83 L1 80 L1 13 Z' : 'M10 3 L90 3 L99 15 L99 76 L92 87 L8 87 L1 76 L1 15 Z';
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <linearGradient id="frameGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#111317" />
          <stop offset="1" stopColor="#07080a" />
        </linearGradient>
      </defs>
      <path d={`M0 0 H100 V100 H0 Z ${viewport}`} fill="url(#frameGrad)" fillRule="evenodd" opacity="0.985" />
      <path d={viewport} fill="none" stroke="#2c323a" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <path d={viewport} fill="none" stroke={accent} strokeOpacity="0.35" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      {tank ? (
        <>
          <line x1="1" y1="8" x2="99" y2="8" stroke="#1e2228" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <line x1="0" y1="84.5" x2="100" y2="84.5" stroke="#3a4049" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <line x1="0" y1="85.5" x2="100" y2="85.5" stroke={accent} strokeOpacity="0.25" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        </>
      ) : (
        <>
          <line x1="1" y1="15" x2="10" y2="3" stroke="#3a4049" strokeWidth="3" vectorEffect="non-scaling-stroke" />
          <line x1="99" y1="15" x2="90" y2="3" stroke="#3a4049" strokeWidth="3" vectorEffect="non-scaling-stroke" />
          <line x1="1" y1="76" x2="8" y2="87" stroke="#3a4049" strokeWidth="3" vectorEffect="non-scaling-stroke" />
          <line x1="99" y1="76" x2="92" y2="87" stroke="#3a4049" strokeWidth="3" vectorEffect="non-scaling-stroke" />
          <line x1="0" y1="88.5" x2="100" y2="88.5" stroke={accent} strokeOpacity="0.25" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        </>
      )}
    </svg>
  );
}

const BLIP_COLOR: Record<string, string> = {
  tank: '#ff4d4d',
  mech: '#ff9f3d',
  heavy: '#ff3df0',
  sniper: '#3dff7a',
  boss: '#ff2d55',
  pickup: '#4dff88',
  drop: '#ffd24a',
  obstacle: 'rgba(255,255,255,0.22)',
};

function Radar({ blips, hullRel, accent, size }: { blips: RadarBlip[]; hullRel: number; accent: string; size: number }) {
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
      <circle cx={half} cy={half} r={half - 1} fill="rgba(0,10,8,0.7)" stroke={accent} strokeOpacity="0.55" />
      <circle cx={half} cy={half} r={half * 0.66} fill="none" stroke={accent} strokeOpacity="0.2" />
      <circle cx={half} cy={half} r={half * 0.33} fill="none" stroke={accent} strokeOpacity="0.2" />
      <line x1={half} y1={2} x2={half} y2={size - 2} stroke={accent} strokeOpacity="0.15" />
      <line x1={2} y1={half} x2={size - 2} y2={half} stroke={accent} strokeOpacity="0.15" />
      <path d={`M${half} ${half} L${half - half * 0.6} 2 L${half + half * 0.6} 2 Z`} fill={accent} fillOpacity="0.08" />
      <g clipPath="url(#radarClip)">
      {blips.map((b, i) => {
        let x = half + b.x * scale;
        let y = half - b.y * scale;
        const c = BLIP_COLOR[b.kind];
        if (b.kind === 'obstacle') {
          const fill = b.tall ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.16)';
          if (b.poly) {
            const pts: string[] = [];
            for (let k = 0; k < b.poly.length; k += 2) pts.push(`${half + b.poly[k] * scale},${half - b.poly[k + 1] * scale}`);
            return <polygon key={i} points={pts.join(' ')} fill={fill} />;
          }
          return <circle key={i} cx={x} cy={y} r={Math.max(1.2, (b.size ?? 3) * scale)} fill={fill} />;
        }
        if (b.kind === 'boss') {
          // clamp to the radar edge so the boss is always visible
          const d = Math.hypot(x - half, y - half);
          if (d > half - 6) {
            x = half + ((x - half) / d) * (half - 6);
            y = half + ((y - half) / d) * (half - 6);
          }
          return <polygon key={i} points={`${x},${y - 6} ${x + 6},${y} ${x},${y + 6} ${x - 6},${y}`} fill={c} style={{ filter: `drop-shadow(0 0 4px ${c})` }} />;
        }
        const r = b.kind === 'heavy' ? 4 : 3;
        if (b.kind !== 'pickup' && !b.alert) return <circle key={i} cx={x} cy={y} r={r} fill="none" stroke={c} strokeWidth="1.3" opacity="0.85" />;
        return <circle key={i} cx={x} cy={y} r={r} fill={c} style={{ filter: `drop-shadow(0 0 3px ${c})` }} />;
      })}
      </g>
      <g transform={`rotate(${(-hullRel * 180) / Math.PI} ${half} ${half})`}>
        <line x1={half} y1={half} x2={half} y2={half - 16} stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1.5" />
        <polygon points={`${half},${half - 20} ${half - 3},${half - 14} ${half + 3},${half - 14}`} fill="#ffffff" fillOpacity="0.8" />
      </g>
      <circle cx={half} cy={half} r={2.5} fill={accent} />
    </svg>
  );
}

function HullIcon({ hullRel, accent, size = 46 }: { hullRel: number; accent: string; size?: number }) {
  const h = size / 2;
  return (
    <svg width={size} height={size} viewBox={`${-h} ${-h} ${size} ${size}`}>
      <g transform={`rotate(${(-hullRel * 180) / Math.PI})`} opacity="0.9">
        <rect x={-9} y={-13} width={18} height={26} rx={2} fill="none" stroke="#dfe6ee" strokeWidth="1.5" />
        <rect x={-13} y={-14} width={4} height={28} fill="#dfe6ee" opacity="0.5" />
        <rect x={9} y={-14} width={4} height={28} fill="#dfe6ee" opacity="0.5" />
        <polygon points="-6,-13 0,-17 6,-13" fill="#dfe6ee" opacity="0.7" />
      </g>
      <circle r={5} fill="none" stroke={accent} strokeWidth="1.5" />
      <line x1={0} y1={0} x2={0} y2={-21} stroke={accent} strokeWidth="2.5" />
    </svg>
  );
}

const WEAPON_ICON: Record<WeaponId, string> = { autocannon: 'autocannon', cannon: 'cannon', scatter: 'scatter', coil: 'coil', flame: 'flame', cryo: 'cryo', cryoball: 'cryoball', jump: 'jump', mines: 'mines', smoke: 'smoke', missiles: 'missile', turret: 'turret', mortar: 'mortar', overdrive: 'overdrive', rail: 'target', nova: 'nova' };

function WeaponSlot({ w, accent, onUse }: { w: HudState['weapons'][number]; accent: string; onUse?: () => void }) {
  const R = 20;
  const circ = 2 * Math.PI * R;
  const ready = w.ready >= 1;
  const color = !w.owned ? 'rgba(255,255,255,0.18)' : w.active > 0 ? '#59c8ff' : ready ? accent : '#ff8a3d';
  return (
    <button
      onClick={onUse}
      className="pointer-events-auto flex flex-col items-center gap-0.5 w-[58px] select-none"
      style={{ opacity: w.owned ? 1 : 0.42, cursor: w.owned ? 'pointer' : 'default' }}
      title={`${w.name} [${w.key}]${w.detail === 'EVOLVED' ? ' / EVOLVED' : ''}`}
    >
      <div className="relative" style={{ width: 52, height: 52 }}>
        <svg width="52" height="52" viewBox="-26 -26 52 52" className="absolute inset-0">
          <circle r={R} fill="rgba(0,0,0,0.55)" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
          {w.owned && (
            <circle
              r={R}
              fill="none"
              stroke={color}
              strokeWidth="3"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - (w.active > 0 ? w.active : w.ready))}
              transform="rotate(-90)"
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 80ms linear', filter: ready || w.active > 0 ? `drop-shadow(0 0 4px ${color})` : 'none' }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center" style={{ color: w.detail === 'EVOLVED' ? '#e8c37c' : '#fff' }}>
          <Icon name={w.owned && w.id ? WEAPON_ICON[w.id] : 'lock'} size={22} />
        </div>
        <div
          className="absolute -top-1 -right-1 w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold"
          style={{ background: w.owned && ready ? accent : 'rgba(30,30,36,0.9)', color: w.owned && ready ? '#000' : '#aaa', border: `1px solid ${w.owned ? accent : 'rgba(255,255,255,0.2)'}`, fontFamily: DISPLAY }}
        >
          {w.key}
        </div>
      </div>
      <div className="text-[7px] tracking-[0.06em] opacity-80 text-center leading-tight" style={{ fontFamily: MONO }}>
        {w.short || w.name}
        {w.detail === 'EVOLVED' && <span className="block text-[7px] tracking-[0.2em] mt-0.5" style={{ color: '#e8c37c' }}>EVOLVED</span>}
      </div>
    </button>
  );
}

export default function HUD({ hud, vehicle, onWeapon, settings }: Props) {
  const accent = VEHICLES[vehicle].accent;
  const hpRatio = clamp01(hud.hp / hud.maxHp);
  const powerDry = hud.power <= 0.5;
  const powerColor = powerDry ? '#ff5a5a' : hud.powerDraw > hud.powerOutput ? '#ffb347' : '#7fe0c0';
  const hpColor = hpRatio > 0.5 ? '#62ff7a' : hpRatio > 0.25 ? '#ffc23d' : '#ff4d4d';
  const heading = ((((-hud.turretYaw * 180) / Math.PI) % 360) + 360) % 360;
  const hullRel = wrap(hud.hullYaw - hud.turretYaw);
  const spdRatio = clamp01(Math.abs(hud.speed) / hud.maxSpeed);
  const ready = hud.priReady >= 1;
  const msgOpacity = hud.messageAge < 2.6 ? 1 : Math.max(0, 1 - (hud.messageAge - 2.6) / 0.8);
  const low = hpRatio < 0.3 && hud.alive;
  const pulse = (Math.sin(hud.time * 7) + 1) / 2;
  const R = 44;
  const circ = 2 * Math.PI * R;
  const consoleH = '12%';

  const compass: { off: number; label: string; major: boolean }[] = [];
  for (let h = 0; h < 360; h += 15) {
    let off = h - heading;
    if (off > 180) off -= 360;
    if (off < -180) off += 360;
    if (Math.abs(off) <= 55) {
      const label = h === 0 ? 'N' : h === 90 ? 'E' : h === 180 ? 'S' : h === 270 ? 'W' : h % 45 === 0 ? String(h) : '';
      compass.push({ off, label, major: h % 45 === 0 });
    }
  }

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden select-none" style={{ color: accent, fontFamily: MONO }}>
      {/* damage flash */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgba(255,40,0,0) 30%, rgba(255,30,0,0.9) 100%)', opacity: hud.damageFlash }} />
      {/* shield tint */}

      {/* perimeter expansion flash */}
      {hud.expandAge < 1.8 && (
        <div className="absolute inset-0" style={{ boxShadow: `inset 0 0 180px rgba(126,232,255,${0.55 * (1 - hud.expandAge / 1.8)})` }} />
      )}
      {/* vision-block vignette */}
      <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 140px 20px rgba(0,0,0,0.55)' }} />
      {low && <div className="absolute inset-0" style={{ boxShadow: `inset 0 0 ${90 + pulse * 70}px rgba(255,0,0,${0.25 + pulse * 0.4})` }} />}
      {/* sniper lock warning */}
      {hud.lockWarning > 0 && hud.alive && (
        <div className="absolute inset-0" style={{ boxShadow: `inset 0 0 60px rgba(255,40,60,${0.15 + hud.lockWarning * 0.4 * (0.5 + pulse * 0.5)})` }} />
      )}

      {/* scope overlay */}
      {hud.zoom && (
        <div className="absolute inset-0">
          <div className="absolute left-0 right-0 top-1/2 h-px" style={{ background: `${accent}44` }} />
          <div className="absolute top-0 bottom-0 left-1/2 w-px" style={{ background: `${accent}44` }} />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border" style={{ width: '70vh', height: '70vh', borderColor: `${accent}55` }} />
          <div className="absolute left-1/2 top-[18%] -translate-x-1/2 text-xs tracking-[0.4em] opacity-80">SCOPE 2.3×</div>
        </div>
      )}

      <CockpitFrame vehicle={vehicle} accent={accent} />

      {/* top-left */}
      <div className="absolute top-[1.6%] left-[2.5%] flex gap-5 md:gap-8">
        <Stat label="STAGE" value={hud.wave ? pad(hud.wave) : '--'} accent={accent} />
        <Stat label="HOSTILES" value={pad(hud.enemiesLeft)} accent={hud.enemiesLeft > 0 ? '#ff6b6b' : accent} />
        <Stat label="SCORE" value={pad(hud.score, 6)} accent={accent} />
      </div>

      {/* wave modifier */}
      {hud.waveTag && (
        <div className="absolute left-[2.5%]" style={{ top: '6.6%' }}>
          <span
            className="text-[9px] tracking-[0.3em] px-2 py-0.5 rounded whitespace-nowrap"
            style={{ background: 'rgba(0,0,0,0.5)', border: `1px solid ${accent}55`, color: accent, fontFamily: DISPLAY }}
          >
            {hud.waveTag}
          </span>
        </div>
      )}
      {/* top-right */}
      <div className="absolute top-[1.6%] right-[2.5%] flex gap-5 md:gap-8 text-right items-end flex-col md:flex-row">
        <Stat label="MISSION TIME" value={fmtTime(hud.time)} accent={accent} />
        <Stat label="KILLS" value={pad(hud.kills)} accent={accent} />
      </div>

      {/* music state */}
      <div
        className="absolute right-[2.5%] text-[9px] tracking-[0.25em] opacity-70"
        style={{ top: '6.6%', textShadow: '0 1px 3px #000', color: hud.musicOn ? accent : '#8b8b8b' }}
        title={hud.musicOn ? 'Music on (M)' : 'Music off (M)'}
      >
        {hud.musicOn ? '♪ SCORE ON' : '♪̸ SCORE OFF'}
      </div>

      {/* compass */}
      <div className="absolute top-[1.2%] left-1/2 -translate-x-1/2 flex items-start gap-3">
        <div className="relative w-[300px] h-[40px] overflow-hidden">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 w-0 h-0" style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: `7px solid ${accent}` }} />
          <div className="absolute left-0 right-0 top-[8px] h-px" style={{ background: `${accent}44` }} />
          {compass.map((c) => (
            <div key={c.off + c.label} className="absolute top-[9px] flex flex-col items-center" style={{ left: `calc(50% + ${c.off * 2.6}px)`, transform: 'translateX(-50%)', opacity: 1 - Math.abs(c.off) / 70 }}>
              <div style={{ width: 1, height: c.major ? 9 : 4, background: accent }} />
              <span className="text-[10px] leading-none mt-1" style={{ fontFamily: DISPLAY }}>{c.label}</span>
            </div>
          ))}
        </div>
        <div className="text-base leading-none mt-[7px] w-[52px]" style={{ fontFamily: DISPLAY, textShadow: `0 0 8px ${accent}55` }}>
          {pad(heading, 3)}°
        </div>
      </div>

      {/* sector readout */}
      <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 text-center" style={{ top: '7.6%' }}>
        <div className="text-[10px] tracking-[0.3em]" style={{ fontFamily: DISPLAY, textShadow: '0 1px 4px #000' }}>▸ {hud.district}</div>
        <div className="text-[9px] tracking-[0.18em] opacity-80 whitespace-nowrap" style={{ textShadow: '0 1px 4px #000, 0 0 8px #000' }}>
          SECTOR {hud.seed} · {hud.themeName} · PERIMETER {hud.arenaRadius}M
          {hud.expandIn > 0 ? ` · EXPANDS IN ${hud.expandIn} WAVE${hud.expandIn > 1 ? 'S' : ''}` : ' · FULLY OPEN'}
        </div>
      </div>

      {/* perk chips */}
      {hud.perks.length > 0 && (
        <div className="absolute left-[2.5%] top-[10.5%] flex flex-wrap gap-1 max-w-[34%]">
          {hud.perks.map((p) => (
            <span key={p.name} className="text-[9px] tracking-[0.12em] px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.5)', border: `1px solid ${accent}44`, fontFamily: MONO }} title={p.name}>
              <Icon name={p.icon} size={11} style={{ display: "inline", verticalAlign: "-2px" }} /> {p.name}
              {p.count > 1 ? ` ×${p.count}` : ''}
            </span>
          ))}
        </div>
      )}

      {/* active combat buffs */}
      {hud.buffs.length > 0 && (
        <div className="absolute left-[2.5%] flex flex-col gap-1.5" style={{ top: '17%' }}>
          {hud.buffs.map((b) => (
            <div key={b.id} className="flex items-center gap-2 px-2 py-1 rounded" style={{ background: 'rgba(0,0,0,0.55)', border: `1px solid ${accent}55`, minWidth: 148 }}>
              <Icon name={b.icon} size={13} />
              <div className="flex-1">
                <div className="text-[9px] tracking-[0.18em] leading-none">{b.name}</div>
                <div className="mt-1 h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.15)' }}>
                  <div className="h-full" style={{ width: `${clamp01(b.time / b.max) * 100}%`, background: accent, boxShadow: `0 0 6px ${accent}` }} />
                </div>
              </div>
              <span className="text-[10px] leading-none" style={{ fontFamily: DISPLAY }}>{Math.ceil(b.time)}s</span>
            </div>
          ))}
        </div>
      )}

      {/* boss bar */}
      {hud.boss && (
        <div className="absolute left-1/2 -translate-x-1/2 top-[11%] w-[min(60vw,520px)]">
          <div className="flex justify-between text-[10px] tracking-[0.35em] text-rose-300" style={{ fontFamily: DISPLAY }}>
            <span className="flex items-center gap-1"><Icon name="skull" size={13} /> {hud.boss.name}</span>
            <span>{Math.ceil(hud.boss.hp * 100)}%</span>
          </div>
          <div className="mt-1">
            <Bar ratio={hud.boss.hp} color="#ff2d55" height={7} />
          </div>
        </div>
      )}

      {/* messages */}
      <div className="absolute left-1/2 top-[20%] -translate-x-1/2 text-center w-full px-8" style={{ opacity: msgOpacity }}>
        <div className="text-lg md:text-2xl lg:text-3xl tracking-[0.3em] font-bold" style={{ fontFamily: DISPLAY, textShadow: `0 0 16px ${accent}99, 0 2px 4px #000` }}>
          {hud.message}
        </div>
      </div>
      {hud.victoryCountdown > 0 && hud.alive && (
        <div
          className="absolute left-1/2 top-[27%] -translate-x-1/2 text-center text-xs md:text-sm tracking-[0.35em]"
          style={{ color: '#ffd24a', textShadow: '0 0 14px rgba(255,210,74,0.45)' }}
        >
          REWARD DRAFT IN {Math.ceil(hud.victoryCountdown)}
        </div>
      )}
      {hud.waveCountdown > 0 && hud.alive && hud.victoryCountdown <= 0 && (
        <div className="absolute left-1/2 top-[27%] -translate-x-1/2 text-center text-xs md:text-sm tracking-[0.35em] opacity-80">
          NEXT WAVE IN {Math.ceil(hud.waveCountdown)} · ENTER TO SKIP
        </div>
      )}
      {hud.lockWarning > 0 && hud.alive && (
        <div className="absolute left-1/2 top-[15.5%] -translate-x-1/2 text-center text-xs md:text-sm tracking-[0.4em] text-rose-400 font-bold" style={{ fontFamily: DISPLAY, opacity: 0.6 + pulse * 0.4, textShadow: '0 0 10px #ff2040' }}>
          ▲ SNIPER LOCK — BREAK LINE OF SIGHT
        </div>
      )}
      {hud.dropInbound && (
        <div className="absolute left-1/2 -translate-x-1/2 text-center text-xs tracking-[0.35em]" style={{ top: '11.5%', fontFamily: DISPLAY, color: '#ffd24a', textShadow: '0 0 12px rgba(255,210,74,0.5)' }}>
          ▼ SUPPLY DROP · {hud.dropInbound.label} · {Math.ceil(hud.dropInbound.seconds)}s
        </div>
      )}
      {hud.strikeInbound > 0 && (
        <div className="absolute left-1/2 top-[15.5%] -translate-x-1/2 text-center text-xs tracking-[0.4em] text-orange-300" style={{ fontFamily: DISPLAY }}>
          ▼ ARTILLERY INBOUND · {hud.strikeInbound.toFixed(1)}s
        </div>
      )}

      {/* feed */}
      <div className="absolute right-[3%] top-[12%] flex flex-col items-end gap-1 text-[11px] md:text-xs tracking-wider">
        {hud.feed.map((f, i) => (
          <div key={i} style={{ opacity: f.age < 3.5 ? 0.95 : Math.max(0, 1 - (f.age - 3.5) / 1.5), textShadow: '0 1px 3px #000' }}>
            {f.text}
          </div>
        ))}
      </div>

      {/* streak */}
      {hud.streak > 1 && hud.streakAge < 4 && (
        <div className="absolute right-[3%] top-[26%] text-right" style={{ opacity: Math.max(0, 1 - hud.streakAge / 4) }}>
          <div className="text-2xl md:text-3xl font-black" style={{ fontFamily: DISPLAY, color: '#ffb347', textShadow: '0 0 14px #ffb34788' }}>
            ×{hud.streak}
          </div>
          <div className="text-[9px] tracking-[0.35em] opacity-80">KILL STREAK</div>
        </div>
      )}

      {/* damage direction indicators */}
      {hud.damageDirs.map((d, i) => (
        <div key={i} className="absolute left-1/2 top-1/2 w-0 h-0" style={{ transform: `rotate(${-d.angle}rad)`, opacity: Math.max(0, 1 - d.age / 1.3) }}>
          <svg width="90" height="34" viewBox="0 0 90 34" style={{ transform: 'translate(-45px, -150px)' }}>
            <path d="M6 30 Q45 2 84 30" stroke="#ff3b3b" strokeWidth="5" fill="none" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 4px #ff0000)' }} />
          </svg>
        </div>
      ))}

      {/* crosshair */}
      {hud.alive && settings?.crosshair !== false && (
        <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" width="180" height="180" viewBox="-90 -90 180 180">
          <circle r={R} fill="none" stroke={accent} strokeOpacity="0.2" strokeWidth="2" />
          <circle
            r={R}
            fill="none"
            stroke={ready ? accent : '#ff8a3d'}
            strokeWidth="2.5"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - hud.priReady)}
            transform="rotate(-90)"
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 60ms linear' }}
          />
          {ready && <circle r={R + 6} fill="none" stroke={accent} strokeOpacity="0.35" strokeWidth="1" strokeDasharray="4 8" />}
          {hud.target && <circle r={R + 12} fill="none" stroke="#ff6b6b" strokeOpacity="0.7" strokeWidth="1.5" strokeDasharray="10 14" style={{ animation: 'spin 4s linear infinite' }} />}
          <circle r={1.8} fill={accent} />
          <line x1={-30} y1={0} x2={-12} y2={0} stroke={accent} strokeWidth="1.6" />
          <line x1={12} y1={0} x2={30} y2={0} stroke={accent} strokeWidth="1.6" />
          <line x1={0} y1={-30} x2={0} y2={-12} stroke={accent} strokeWidth="1.6" />
          <line x1={0} y1={12} x2={0} y2={30} stroke={accent} strokeWidth="1.6" opacity="0.5" />
          <line x1={-7} y1={16} x2={7} y2={16} stroke={accent} strokeWidth="1" opacity="0.55" />
          <line x1={-5} y1={24} x2={5} y2={24} stroke={accent} strokeWidth="1" opacity="0.45" />
          <line x1={-3} y1={32} x2={3} y2={32} stroke={accent} strokeWidth="1" opacity="0.35" />
          {hud.hitMarkerAge < 0.2 && (
            <g stroke={hud.critAge < 0.25 ? '#ffb347' : '#ffffff'} strokeWidth={hud.critAge < 0.25 ? 3.4 : 2.6} strokeLinecap="round" opacity={1 - hud.hitMarkerAge / 0.2}>
              <line x1={-9} y1={-9} x2={-17} y2={-17} />
              <line x1={9} y1={-9} x2={17} y2={-17} />
              <line x1={-9} y1={9} x2={-17} y2={17} />
              <line x1={9} y1={9} x2={17} y2={17} />
            </g>
          )}
          {hud.ambushAge < 0.8 && (
            <text y={-84} textAnchor="middle" fill="#62ff7a" fontSize="12" fontFamily={DISPLAY} letterSpacing="3" opacity={1 - hud.ambushAge / 0.8}>
              AMBUSH
            </text>
          )}
          {hud.overchargeCount > 0 && hud.overchargeCount < 5 && (
            <text y={-46} textAnchor="middle" fill="#ffb347" fontSize="10" fontFamily={DISPLAY} letterSpacing="2.5" opacity={hud.overchargeCount <= 1 ? 1 : 0.65}>
              OVERCHARGE IN {hud.overchargeCount}
            </text>
          )}
          {hud.critAge < 0.5 && (
            <text y={-70} textAnchor="middle" fill="#ffb347" fontSize="12" fontFamily={DISPLAY} letterSpacing="3" opacity={1 - hud.critAge / 0.5}>
              CRITICAL
            </text>
          )}
          {hud.mgOverheat && (
            <text y={-58} textAnchor="middle" fill="#ff5a3d" fontSize="11" fontFamily={DISPLAY} letterSpacing="3">
              OVERHEAT
            </text>
          )}
          {!hud.priIsHeat && !ready && (
            <text y={74} textAnchor="middle" fill="#ff8a3d" fontSize="10" fontFamily={DISPLAY} letterSpacing="3" opacity="0.85">
              RELOADING
            </text>
          )}
        </svg>
      )}

      {/* target info */}
      {hud.target && hud.alive && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 mt-[92px] w-[190px] text-center">
          <div className="text-[11px] tracking-[0.25em] text-red-300" style={{ textShadow: '0 1px 3px #000' }}>
            {hud.target.name} · {Math.round(hud.target.dist)}m
          </div>
          <div className="mt-1 px-6">
            <Bar ratio={hud.target.hp} color={hud.target.hp > 0.5 ? '#ff6b6b' : '#ff2a2a'} height={5} />
          </div>
          {hud.target.status && <div className="mt-1 text-[9px] tracking-[0.25em]" style={{ color: hud.target.status === 'BURNING' ? '#ffb36b' : '#9de9ff' }}>{hud.target.status}</div>}
        </div>
      )}


      {/* weapon systems */}
      <div className="absolute right-[2.5%] flex items-end gap-0.5" style={{ bottom: `calc(${consoleH} + 1.5%)` }}>
        {hud.weapons.map((w) => (
          <WeaponSlot
            key={w.id ?? w.key}
            w={w}
            accent={accent}
            onUse={w.id && (w.key === 'Q' || w.key === 'E') ? () => onWeapon?.(w.id!) : undefined}
          />
        ))}
      </div>

      {/* performance readout */}
      {settings?.showFps && (
        <div className="perf-readout" style={{ bottom: `calc(${consoleH} + 1.5%)`, left: '2.5%', top: 'auto', transform: 'none' }}>
          {Math.round(hud.fps)} FPS
        </div>
      )}

      {/* bottom console */}
      <div className="absolute left-0 right-0 bottom-0 flex items-center justify-between px-[2.5%] gap-4" style={{ height: consoleH }}>
        <div className="flex-1 min-w-0 max-w-[260px]">
          <div className="flex justify-between items-end mb-1">
            <span className="text-[10px] tracking-[0.3em] opacity-70">ARMOR INTEGRITY</span>
            <span className="text-base leading-none" style={{ fontFamily: DISPLAY, color: hpColor }}>
              {Math.ceil(hud.hp)}
              <span className="text-[10px] opacity-60">/{hud.maxHp}</span>
            </span>
          </div>
          <Bar ratio={hpRatio} color={hpColor} height={10} />
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-[9px] tracking-[0.2em] opacity-70 w-[52px]">SHIELD</span>
            <div className="flex-1"><Bar ratio={hud.shield / Math.max(1, hud.shieldMax)} color={hud.shieldActive ? '#59c8ff' : '#d6a45b'} height={5} /></div>
            <span className="text-[9px] opacity-80 text-right whitespace-nowrap" style={{ color: hud.shieldActive ? '#9de9ff' : '#ffb76b' }}>
              {hud.shieldStatus === 'restarting' ? (hud.shieldDelay > 0 ? `REBOOT ${Math.ceil(hud.shieldDelay)}S` : 'REBOOTING') : hud.shieldStatus === 'recharging' ? 'RECHARGING' : `${Math.ceil(hud.shield)}/${hud.shieldMax}`}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-[9px] tracking-[0.2em] opacity-70 w-[52px]">POWER</span>
            <div className="flex-1"><Bar ratio={hud.power / Math.max(1, hud.powerMax)} color={powerColor} height={5} /></div>
            <span className="text-[9px] opacity-80 text-right whitespace-nowrap" style={{ color: powerColor }}>
              {Math.ceil(hud.power)}/{hud.powerMax} KJ
            </span>
          </div>
          <div className="mt-1.5 text-[10px] tracking-[0.25em] opacity-70 truncate">{hud.vehicleName}</div>
          {low && <div className="text-[10px] tracking-[0.3em] text-red-400" style={{ opacity: 0.5 + pulse * 0.5 }}>▲ HULL CRITICAL</div>}
        </div>

        <div className="flex items-center gap-3">
          <HullIcon hullRel={hullRel} accent={accent} />
          <div className="w-[96px]">
            <div className="text-[10px] tracking-[0.3em] opacity-70">DRIVE</div>
            <div className="text-xl leading-none" style={{ fontFamily: DISPLAY }}>
              {Math.round(Math.abs(hud.speed) * 3.2)}
              <span className="text-[10px] opacity-60 ml-1">KM/H</span>
            </div>
            <div className="mt-1.5">
              <Bar ratio={spdRatio} color={hud.speed < -0.2 ? '#ff9f3d' : accent} height={5} />
            </div>
            <div className="text-[9px] tracking-[0.25em] opacity-60 mt-1">
              {hud.inWater ? 'SHALLOW WATER' : hud.controls === 'arcade' ? (hud.speed < -0.2 ? 'REVERSING' : hud.autoAlign ? 'AUTO-HULL' : 'ALIGNING') : `${hud.speed < -0.2 ? 'REVERSE' : 'HULL'} ${Math.round(Math.abs((hullRel * 180) / Math.PI))}° ${hullRel > 0.05 ? 'L' : hullRel < -0.05 ? 'R' : ''}`}
            </div>
          </div>
        </div>

        <div className="w-[210px] shrink-0 hidden sm:block">
          <div className="flex justify-between gap-2 text-[9px] tracking-[0.12em] opacity-80">
            <span>LMB · {hud.priName}</span>
            <span style={{ color: hud.priOverheat ? '#ff5a3d' : hud.priReady >= 1 ? '#62ff7a' : '#ff8a3d' }}>
              {hud.priOverheat ? 'OVERHEAT' : hud.priIsHeat ? `HEAT ${Math.round(hud.priHeat * 100)}%` : hud.priReady >= 1 ? 'READY' : 'LOADING'}
            </span>
          </div>
          <div className="mt-1">
            <Bar ratio={hud.priIsHeat ? hud.priHeat : hud.priReady} color={hud.priOverheat ? '#ff5a3d' : hud.priIsHeat && hud.priHeat > 0.45 ? '#ffc23d' : ready ? accent : '#ff8a3d'} height={6} />
          </div>
          <div className="flex justify-between gap-2 text-[9px] tracking-[0.12em] opacity-80 mt-2">
            <span>RMB · {hud.secName}</span>
            <span style={{ color: hud.secOverheat ? '#ff5a3d' : hud.secReady >= 1 ? '#62ff7a' : accent }}>
              {hud.secOverheat ? 'OVERHEAT' : hud.secIsHeat ? `HEAT ${Math.round(hud.secHeat * 100)}%` : hud.secReady >= 1 ? 'READY' : 'LOADING'}
            </span>
          </div>
          <div className="mt-1">
            <Bar ratio={hud.secIsHeat ? hud.secHeat : hud.secReady} color={hud.secOverheat ? '#ff5a3d' : hud.secIsHeat && hud.secHeat > 0.45 ? '#ffc23d' : '#62ff7a'} height={6} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex flex-col text-[8px] leading-[11px] tracking-[0.2em] opacity-70 text-right">
            <span className="text-red-400">● TANK</span>
            <span className="text-orange-400">● WALKER</span>
            <span className="text-fuchsia-400">● HEAVY</span>
            <span className="text-green-400">● SNIPER</span>
            <span className="opacity-80">○ UNAWARE</span>
            <span style={{ color: '#ffd24a' }}>◆ SUPPLY DROP</span>
            <span className="text-rose-500">◆ BOSS</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div
              className="text-[9px] tracking-[0.25em] px-2 py-0.5 rounded whitespace-nowrap"
              style={{
                fontFamily: DISPLAY,
                color: hud.seenBy > 0 ? '#ff5a5a' : hud.detected > 0 ? '#ffc23d' : '#62ff7a',
                border: `1px solid ${hud.seenBy > 0 ? '#ff5a5a' : hud.detected > 0 ? '#ffc23d' : '#62ff7a'}66`,
                background: 'rgba(0,0,0,0.5)',
                opacity: hud.seenBy > 0 ? 0.65 + pulse * 0.35 : 1,
              }}
            >
              {hud.seenBy > 0 ? `EXPOSED · ${hud.seenBy}` : hud.detected > 0 ? `HUNTED · ${hud.detected}` : 'CONCEALED'}
            </div>
            <Radar blips={hud.blips} hullRel={hullRel} accent={accent} size={92} />
          </div>
        </div>
      </div>

      {/* controls hint */}
      {hud.time < 16 && hud.alive && (
        <div
          className="absolute left-1/2 -translate-x-1/2 text-[10px] md:text-[11px] tracking-[0.25em] text-center max-w-full px-4"
          style={{ bottom: `calc(${consoleH} + 2%)`, opacity: hud.time < 12 ? 0.8 : Math.max(0, (16 - hud.time) / 4) }}
        >
          {hud.controls === 'arcade'
            ? `LMB PRIMARY · RMB / C SECONDARY · Q / E SPECIALS · Z SCOPE · M MUSIC`
            : `WASD DRIVE HULL · MOUSE AIM TURRET · LMB CANNON · RMB / C SECONDARY · Z SCOPE`}
        </div>
      )}

      {/* strafe indicator (arcade mode) */}
      {hud.controls === 'arcade' && (Math.abs(hud.lean) > 0.04 || spdRatio > 0.04) && (
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2" style={{ bottom: `calc(${consoleH} + 6.5%)` }}>
          <span className="text-[9px] tracking-[0.3em] opacity-50">A</span>
          <div className="relative w-28 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <div className="absolute top-0 bottom-0 w-2 rounded-full" style={{ left: `calc(50% + ${hud.lean * 46}% - 4px)`, background: accent, boxShadow: `0 0 8px ${accent}` }} />
          </div>
          <span className="text-[9px] tracking-[0.3em] opacity-50">D</span>
        </div>
      )}
    </div>
  );
}
