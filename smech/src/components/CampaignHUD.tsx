import { useEffect, useState } from 'react';
import type { CampaignObjective, RadioTransmission } from '../game/campaign';
import { SQUAD } from '../game/campaign';
import type { ObjectiveWaypoint } from '../game/campaignWorld';

interface CampaignHUDProps {
  objectives: CampaignObjective[];
  transmission: RadioTransmission | null;
  extractionReady: boolean;
  waypoints?: ObjectiveWaypoint[];
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

export default function CampaignHUD({
  objectives,
  transmission,
  extractionReady,
  waypoints = [],
  missionTitle,
  operationName,
}: CampaignHUDProps) {
  const [hiddenId, setHiddenId] = useState<string | null>(null);

  useEffect(() => {
    if (!transmission) return;
    const timer = setTimeout(() => setHiddenId(transmission.id), 8000);
    return () => clearTimeout(timer);
  }, [transmission]);

  const activeTransmission =
    transmission && hiddenId !== transmission.id ? transmission : null;

  const currentStage = objectives.find((o) => !o.completed)?.stage ?? objectives[objectives.length - 1]?.stage ?? 1;

  return (
    <>
      {/* Top Center Tactical Waypoint Compass HUD */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pointer-events-none select-none font-mono">
        <div className="flex items-center gap-4 rounded-full border border-slate-700/80 bg-black/80 px-6 py-1.5 shadow-[0_0_20px_rgba(0,0,0,0.8)] backdrop-blur">
          {waypoints.length > 0 ? (
            waypoints.map((wp) => {
              const isCenter = Math.abs(wp.relAngle) < 0.35;
              const isLeft = wp.relAngle < -0.35;

              return (
                <div
                  key={wp.id}
                  className="flex items-center gap-2 text-xs font-bold tracking-wider"
                  style={{ color: wp.color }}
                >
                  {isLeft && <span>◀</span>}
                  {isCenter && <span className="animate-pulse">◆</span>}
                  <span>
                    {wp.title}: {wp.dist}m
                  </span>
                  {!isLeft && !isCenter && <span>▶</span>}
                </div>
              );
            })
          ) : (
            <span className="text-xs text-slate-400">NO ACTIVE WAYPOINTS</span>
          )}
        </div>
      </div>

      {/* Objective Tracker (Top Left) */}
      <div className="absolute top-16 left-6 z-20 flex flex-col gap-1.5 rounded border border-amber-900/60 bg-black/85 p-3.5 font-mono text-xs backdrop-blur pointer-events-none max-w-sm shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
            {missionTitle ? `${missionTitle} // STAGE ${currentStage}` : 'SORTIE OBJECTIVES'}
          </span>
          {extractionReady && (
            <span className="animate-pulse rounded bg-emerald-950 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]">
              AIRLIFT BEACON ACTIVE
            </span>
          )}
        </div>
        {operationName && (
          <div className="text-[9px] tracking-[0.25em] text-slate-500 mb-1">OP: {operationName}</div>
        )}

        {objectives.map((obj) => {
          const isHold = obj.type === 'hold_zone';
          const holdPct = isHold ? Math.min(100, Math.floor((obj.currentCount / obj.targetCount) * 100)) : 0;
          return (
            <div key={obj.id} className={`flex items-start gap-2.5 text-[11px] py-0.5 ${obj.optional ? 'opacity-70' : ''}`}>
              <span
                className={`font-bold mt-0.5 ${
                  obj.completed
                    ? 'text-emerald-400'
                    : obj.type === 'reach_extraction' && !extractionReady
                      ? 'text-slate-600'
                      : 'text-amber-400'
                }`}
              >
                {obj.completed ? '☑' : '☐'}
              </span>
              <div className="flex flex-col flex-1">
                <span
                  className={`${
                    obj.completed
                      ? 'line-through text-slate-500 font-semibold'
                      : obj.type === 'reach_extraction' && !extractionReady
                        ? 'text-slate-500 italic'
                        : 'text-slate-200 font-bold'
                  }`}
                >
                  {obj.optional && <span className="text-[9px] text-cyan-400 mr-1">[OPT]</span>}
                  {obj.title}
                  {obj.targetCount > 1 && !obj.completed && (
                    <span className="text-amber-300 ml-1.5">
                      {isHold ? `(${Math.floor(obj.currentCount)}/${obj.targetCount}s)` : `(${obj.currentCount}/${obj.targetCount})`}
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-slate-400">{obj.desc}</span>
                {isHold && !obj.completed && (
                  <div className="mt-1 h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-violet-400 transition-all duration-300" style={{ width: `${holdPct}%` }} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Radio Transmission Display (Bottom Center / In-Cockpit Screen) */}
      {activeTransmission && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3.5 rounded-lg border bg-black/95 px-5 py-3 font-mono shadow-[0_0_30px_rgba(6,182,212,0.4)] backdrop-blur max-w-xl pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-200" style={{ borderColor: `${callsignColor(activeTransmission.callsign)}88` }}>
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded border font-bold text-[9px] text-center leading-tight"
            style={{
              borderColor: callsignColor(activeTransmission.callsign),
              color: callsignColor(activeTransmission.callsign),
              backgroundColor: `${callsignColor(activeTransmission.callsign)}20`,
            }}
          >
            COMMS
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: callsignColor(activeTransmission.callsign) }}>
                {activeTransmission.callsign} // {activeTransmission.sender}
              </span>
              <span className="h-1.5 w-1.5 rounded-full animate-ping" style={{ backgroundColor: callsignColor(activeTransmission.callsign) }} />
            </div>
            <p className="text-xs text-slate-100 leading-snug mt-0.5">
              "{activeTransmission.text}"
            </p>
          </div>
        </div>
      )}
    </>
  );
}
