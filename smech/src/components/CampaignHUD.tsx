import { useEffect, useState } from 'react';
import type { CampaignObjective, RadioTransmission } from '../game/campaign';
import { SQUAD } from '../game/campaign';

interface CampaignHUDProps {
  objectives: CampaignObjective[];
  stage: number;
  transmission: RadioTransmission | null;
  extractionReady: boolean;
  missionTitle?: string;
  operationName?: string;
}

const CALLSIGN_COLORS: Record<string, string> = {
  OVERLORD: '#38bdf8',
  HAVOC: '#ef4444',
  GHOST: '#38bdf8',
  DOC: '#10b981',
  'AEGIS BANE': '#ef4444',
  RAVEN: '#f59e0b',
};

function callsignColor(callsign: string): string {
  for (const [key, color] of Object.entries(CALLSIGN_COLORS)) {
    if (callsign.includes(key)) return color;
  }
  const member = SQUAD.find((s) => callsign.includes(s.callsign));
  return member?.color ?? '#06b6d4';
}

const OBJECTIVE_HINT: Partial<Record<CampaignObjective['type'], string>> = {
  infiltrate_zone: 'ENTER THE MARKED AREA',
  hold_zone: 'STAY INSIDE THE RING',
  reach_extraction: 'REACH THE EXTRACTION BEACON',
  demolish_installation: 'DESTROY THE MARKED INSTALLATION',
  neutralize_outpost: 'ELIMINATE HOSTILES IN THE AREA',
  secure_fob: 'ELIMINATE HOSTILES IN THE AREA',
  eliminate_warlord: 'ELIMINATE THE WARLORD',
};

export default function CampaignHUD({
  objectives,
  stage,
  transmission,
  extractionReady,
  missionTitle,
  operationName,
}: CampaignHUDProps) {
  const [hiddenId, setHiddenId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!transmission) return;
    const timer = setTimeout(() => setHiddenId(transmission.id), 6000);
    return () => clearTimeout(timer);
  }, [transmission]);

  const activeTransmission =
    transmission && hiddenId !== transmission.id ? transmission : null;
  const activeObjectives = objectives.filter((obj) => obj.stage === stage && !obj.completed);

  return (
    <>
      {/* Only live tasks for this stage are shown; completed and future tasks leave the HUD. */}
      <div className="pointer-events-none absolute left-4 top-[5.75rem] z-20 w-[min(21rem,calc(100vw-2rem))] select-none font-mono">
        <section className="border-l-2 border-amber-400 bg-black/80 px-3 py-2 shadow-lg backdrop-blur-sm">
          <header className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-[9px] font-bold uppercase tracking-[0.18em] text-amber-300">
                {operationName || missionTitle || 'SORTIE'} <span className="text-slate-500">//</span> STAGE {stage}
              </div>
              {missionTitle && operationName && (
                <div className="truncate text-[9px] tracking-wider text-slate-400">{missionTitle}</div>
              )}
            </div>
            <button
              type="button"
              className="pointer-events-auto flex h-6 w-6 shrink-0 items-center justify-center border border-slate-700 text-slate-300 hover:border-amber-400 hover:text-amber-300"
              aria-label={collapsed ? 'Expand mission objectives' : 'Collapse mission objectives'}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((value) => !value)}
            >
              {collapsed ? '+' : '−'}
            </button>
          </header>

          {!collapsed && (
            <div className="mt-1.5 border-t border-slate-800 pt-1.5">
              {activeObjectives.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  {activeObjectives.slice(0, 3).map((obj) => {
                    const isHold = obj.type === 'hold_zone';
                    const holdPct = isHold
                      ? Math.min(100, Math.floor((obj.currentCount / obj.targetCount) * 100))
                      : 0;
                    const counter = isHold
                      ? `${Math.floor(obj.currentCount)} / ${obj.targetCount}s`
                      : obj.targetCount > 1
                        ? `${obj.currentCount} / ${obj.targetCount}`
                        : null;
                    return (
                      <div key={obj.id} className="min-w-0">
                        <div className="flex items-start gap-2">
                          <span className={`mt-px text-xs ${obj.optional ? 'text-cyan-300' : 'text-amber-300'}`}>
                            {obj.optional ? '◇' : '◆'}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[11px] font-bold leading-snug text-slate-100">
                            {obj.optional && <span className="mr-1 text-[9px] text-cyan-300">BONUS</span>}
                            {obj.title}
                          </span>
                          {counter && <span className="shrink-0 text-[10px] tabular-nums text-amber-200">{counter}</span>}
                        </div>
                        <div className="ml-4 truncate text-[9px] text-slate-400">
                          {obj.desc || OBJECTIVE_HINT[obj.type]}
                        </div>
                        {isHold && (
                          <div className="ml-4 mt-1 h-1 overflow-hidden rounded-full bg-slate-700">
                            <div className="h-full bg-violet-400 transition-[width] duration-300" style={{ width: `${holdPct}%` }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {activeObjectives.length > 3 && (
                    <div className="ml-4 text-[9px] text-slate-400">+{activeObjectives.length - 3} MORE TASKS</div>
                  )}
                </div>
              ) : (
                <div className="text-[10px] tracking-wider text-emerald-300">STAGE SECURED · NEW ORDERS INBOUND</div>
              )}
            </div>
          )}

          {extractionReady && !collapsed && (
            <div className="mt-1.5 border-t border-emerald-500/30 pt-1 text-[9px] font-bold tracking-widest text-emerald-300">
              EXTRACTION BEACON ACTIVE
            </div>
          )}
        </section>
      </div>

      {/* Brief radio call; it clears on its own after six seconds. */}
      {activeTransmission && (
        <div
          className="pointer-events-none absolute bottom-28 left-1/2 z-30 flex max-w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 items-center gap-3 rounded border bg-black/95 px-4 py-2.5 font-mono shadow-[0_0_24px_rgba(6,182,212,0.3)] backdrop-blur"
          style={{ borderColor: `${callsignColor(activeTransmission.callsign)}88` }}
        >
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded border text-[9px] font-bold"
            style={{
              borderColor: callsignColor(activeTransmission.callsign),
              color: callsignColor(activeTransmission.callsign),
              backgroundColor: `${callsignColor(activeTransmission.callsign)}20`,
            }}
          >
            COMMS
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-[10px] font-bold uppercase tracking-wider" style={{ color: callsignColor(activeTransmission.callsign) }}>
                {activeTransmission.callsign} // {activeTransmission.sender}
              </span>
              <span className="h-1.5 w-1.5 shrink-0 animate-ping rounded-full" style={{ backgroundColor: callsignColor(activeTransmission.callsign) }} />
            </div>
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-100">
              “{activeTransmission.text}”
            </p>
          </div>
        </div>
      )}
    </>
  );
}
