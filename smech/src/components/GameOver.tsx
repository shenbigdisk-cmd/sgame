import type { GameStats } from '../game/types';
import { VEHICLES } from '../game/vehicles';
import type { RunRecord } from '../game/records';

interface Props {
  stats: GameStats;
  records?: RunRecord[];
  onRetry: (freshSector: boolean) => void;
  onMenu: () => void;
}

const DISPLAY = "'Orbitron', 'Share Tech Mono', monospace";
const MONO = "'Share Tech Mono', 'Courier New', monospace";

const pad = (n: number, w = 2) => String(Math.max(0, Math.floor(n))).padStart(w, '0');

function rank(score: number) {
  if (score >= 12000) return { title: 'IRON LEGEND', color: '#ff3df0' };
  if (score >= 7000) return { title: 'ACE COMMANDER', color: '#f3b83f' };
  if (score >= 3500) return { title: 'VETERAN', color: '#5fe0ff' };
  if (score >= 1200) return { title: 'GUNNER', color: '#62ff7a' };
  return { title: 'RECRUIT', color: '#c8c8c8' };
}

export default function GameOver({ stats, records = [], onRetry, onMenu }: Props) {
  const accent = VEHICLES[stats.vehicle].accent;
  const r = rank(stats.score);
  const mins = Math.floor(stats.timeSurvived / 60);
  const secs = Math.floor(stats.timeSurvived % 60);
  const best = records[0]?.score ?? 0;
  return (
    <div
      className="gameover-screen absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 text-zinc-100 p-2 sm:p-4 md:p-6 overflow-hidden"
      style={{ backdropFilter: 'blur(6px)' }}
    >
      <div
        className="gameover-content flex flex-col w-full max-w-2xl max-h-full rounded-lg p-3 sm:p-5 md:p-7 text-center overflow-hidden"
        style={{
          background: 'rgba(8,10,14,0.92)',
          border: `1px solid ${accent}55`,
          boxShadow: `0 0 60px ${accent}22`,
        }}
      >
        {/* Header: fixed pinned, never pushed out */}
        <div className="gameover-header flex flex-col items-center flex-shrink-0">
          <div className="text-[10px] tracking-[0.5em] text-red-400" style={{ fontFamily: MONO }}>
            // VEHICLE LOST — MISSION ENDED
          </div>
          <h2
            className="mt-1 sm:mt-2 text-xl sm:text-3xl md:text-4xl font-black tracking-[0.2em] whitespace-nowrap"
            style={{ fontFamily: DISPLAY, color: '#fff', textShadow: '0 0 24px rgba(255,60,60,0.5)' }}
          >
            HULL DESTROYED
          </h2>
          {stats.isBest && (
            <div
              className="mt-1.5 inline-block px-3 py-0.5 rounded text-[10px] sm:text-[11px] tracking-[0.4em]"
              style={{ fontFamily: DISPLAY, color: '#ffd24a', border: '1px solid #ffd24a66', background: 'rgba(255,210,74,0.08)' }}
            >
              ★ NEW PERSONAL BEST
            </div>
          )}
        </div>

        {/* Scrollable Results Body: flex-1 min-h-0 overflow-y-auto */}
        <div className="gameover-body flex flex-col gap-2.5 sm:gap-4 my-2 sm:my-3 flex-1 min-h-0 overflow-y-auto px-1 sm:px-2">
          {/* Score & Rank */}
          <div className="flex flex-col items-center">
            <div
              className="text-4xl sm:text-5xl md:text-6xl font-black leading-tight"
              style={{ fontFamily: DISPLAY, color: accent, textShadow: `0 0 30px ${accent}66` }}
            >
              {pad(stats.score, 6)}
            </div>
            <div className="text-[10px] tracking-[0.4em] text-zinc-400 mt-0.5" style={{ fontFamily: MONO }}>
              FINAL SCORE
            </div>
            <div
              className="mt-1.5 inline-block px-3 py-0.5 rounded text-xs tracking-[0.35em]"
              style={{ fontFamily: DISPLAY, color: r.color, border: `1px solid ${r.color}66` }}
            >
              RANK: {r.title}
            </div>

            <div className="text-[10px] tracking-[0.3em] text-zinc-500 mt-1" style={{ fontFamily: MONO }}>
              SECTOR {stats.seed} · PERIMETER LEVEL {stats.zone + 1}
              {stats.mechName ? ` · ${stats.mechName}` : ''}
            </div>
          </div>

          {/* Credits earned */}
          {typeof stats.credits === 'number' && stats.credits > 0 && (
            <div className="gameover-credits">
              <span className="text-[10px] tracking-[0.35em] text-zinc-400" style={{ fontFamily: MONO }}>
                // CREDITS EARNED
              </span>
              <strong style={{ fontFamily: DISPLAY, color: '#ffd24a' }}>+{stats.credits.toLocaleString('en-US')} CR</strong>
              <span className="text-[10px] tracking-[0.2em] text-zinc-500" style={{ fontFamily: MONO }}>
                SPEND THEM IN THE FORGE
              </span>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              ['WAVES', pad(stats.wave)],
              ['KILLS', pad(stats.kills)],
              ['SURVIVED', `${pad(mins)}:${pad(secs)}`],
            ].map(([l, v]) => (
              <div
                key={l}
                className="rounded p-2 sm:p-2.5"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <div className="text-[9px] sm:text-[10px] tracking-[0.3em] text-zinc-400" style={{ fontFamily: MONO }}>
                  {l}
                </div>
                <div className="text-base sm:text-xl md:text-2xl mt-0.5" style={{ fontFamily: DISPLAY }}>
                  {v}
                </div>
              </div>
            ))}
          </div>

          {/* Perks */}
          {stats.perks.length > 0 && (
            <div className="gameover-perks text-left">
              <div className="text-[10px] tracking-[0.35em] text-zinc-400 mb-1" style={{ fontFamily: MONO }}>
                // LOADOUT AT TIME OF LOSS
              </div>
              <div className="flex flex-wrap gap-1.5">
                {stats.perks.map((p, i) => (
                  <span
                    key={i}
                    className="text-[10px] tracking-[0.12em] px-2 py-0.5 rounded"
                    style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${accent}44`, fontFamily: MONO }}
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Records */}
          {records.length > 0 && (
            <div className="text-left">
              <div className="text-[10px] tracking-[0.35em] text-zinc-400 mb-1" style={{ fontFamily: MONO }}>
                // HALL OF FAME
              </div>
              <div className="records-panel">
                <div className="records-list">
                  {records.slice(0, 5).map((rec, i) => (
                    <div key={`${rec.at}-${i}`} className={`records-row ${i === 0 ? 'is-best' : ''}`}>
                      <span>{pad(i + 1)}</span>
                      <span>
                        {pad(rec.score, 6)} <em>· WAVE {pad(rec.wave)} · {VEHICLES[rec.vehicle]?.shortName ?? 'MECH'}</em>
                      </span>
                      <span>{pad(rec.timeSurvived / 60)}:{pad(rec.timeSurvived % 60)}</span>
                    </div>
                  ))}
                </div>
              </div>
              {best > 0 && !stats.isBest && (
                <div className="mt-1 text-[10px] tracking-[0.2em] text-zinc-500" style={{ fontFamily: MONO }}>
                  BEST {pad(best, 6)} · {pad(best - stats.score)} SHORT
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons: pinned at bottom, never pushed out of screen */}
        <div className="gameover-actions pt-2.5 sm:pt-3 border-t border-white/10 flex flex-wrap gap-2 sm:gap-3 justify-center items-center flex-shrink-0">
          <button
            onClick={() => onRetry(false)}
            className="px-4 sm:px-6 py-2 sm:py-2.5 rounded font-black tracking-[0.2em] text-xs sm:text-sm text-black transition-transform hover:scale-[1.03] cursor-pointer whitespace-nowrap"
            style={{ fontFamily: DISPLAY, background: accent, boxShadow: `0 0 30px ${accent}55` }}
          >
            REDEPLOY
          </button>
          <button
            onClick={() => onRetry(true)}
            className="px-4 sm:px-6 py-2 sm:py-2.5 rounded font-bold tracking-[0.2em] text-xs sm:text-sm transition-colors hover:bg-white/10 cursor-pointer whitespace-nowrap"
            style={{ fontFamily: DISPLAY, border: `1px solid ${accent}88`, color: accent }}
          >
            NEW SECTOR
          </button>
          <button
            onClick={onMenu}
            className="px-4 sm:px-6 py-2 sm:py-2.5 rounded font-bold tracking-[0.2em] text-xs sm:text-sm transition-colors hover:bg-white/10 cursor-pointer whitespace-nowrap"
            style={{ fontFamily: DISPLAY, border: '1px solid rgba(255,255,255,0.25)' }}
          >
            CHANGE MECH
          </button>
        </div>
      </div>
    </div>
  );
}
