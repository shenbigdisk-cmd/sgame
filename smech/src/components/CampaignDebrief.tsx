import { useState } from 'react';
import type { CampaignMission, SalvageItem } from '../game/campaign';

interface CampaignDebriefProps {
  mission: CampaignMission;
  onConfirmDebrief: (chosenSalvage?: SalvageItem) => void;
}

export default function CampaignDebrief({
  mission,
  onConfirmDebrief,
}: CampaignDebriefProps) {
  const [selectedSalvage, setSelectedSalvage] = useState<SalvageItem | null>(() => {
    return mission.salvagePool[0] || null;
  });

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 font-mono text-slate-100 select-none p-6 backdrop-blur-md">
      <div className="relative flex w-full max-w-2xl flex-col rounded-xl border border-amber-600/60 bg-slate-950 p-8 shadow-[0_0_50px_rgba(245,158,11,0.2)]">
        {/* Top Header */}
        <div className="border-b border-amber-900/40 pb-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
              ✓ SORTIE ACCOMPLISHED // AIRLIFT CONFIRMED
            </span>
            <span className="rounded bg-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-300 border border-amber-500/40">
              OP-{mission.operationNumber}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-wide text-white">
            {mission.title}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Theater: <span className="font-bold text-cyan-400">{mission.theater}</span>
          </p>
        </div>

        {/* Rewards Summary */}
        <div className="my-6 grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-center">
            <div className="text-[10px] uppercase text-slate-400">CREDITS EARNED</div>
            <div className="mt-1 text-lg font-black text-amber-400">
              +{mission.rewards.credits} CR
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-center">
            <div className="text-[10px] uppercase text-slate-400">EXPERIENCE</div>
            <div className="mt-1 text-lg font-black text-cyan-400">
              +{mission.rewards.xp} XP
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-center">
            <div className="text-[10px] uppercase text-slate-400">ALLIED STANDING</div>
            <div className="mt-1 text-lg font-black text-emerald-400">
              +25 REP
            </div>
          </div>
        </div>

        {/* Salvage Draft Selection */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              FIELD SALVAGE RECOVERY (CLAIM 1 ARTIFACT):
            </h3>
            <span className="text-[10px] text-amber-400/80">SELECT ITEM FOR FORGE INVENTORY</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {mission.salvagePool.map((item) => {
              const isSelected = selectedSalvage?.id === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedSalvage(item)}
                  className={`flex flex-col justify-between rounded-lg border p-3.5 cursor-pointer transition ${
                    isSelected
                      ? 'border-amber-400 bg-amber-950/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                      : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-300">
                      {item.kind}
                    </span>
                    <h4 className="mt-2 text-xs font-bold text-white line-clamp-1">
                      {item.name}
                    </h4>
                    <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">
                      {item.detail}
                    </p>
                  </div>
                  <div className="mt-3 border-t border-slate-800/80 pt-2 text-[10px] text-amber-300 font-bold">
                    SCRAP VALUE: {item.value} CR
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Confirm Button */}
        <div className="flex items-center justify-end border-t border-slate-800 pt-4">
          <button
            onClick={() => onConfirmDebrief(selectedSalvage || undefined)}
            className="flex items-center gap-2 rounded bg-amber-500 px-6 py-2.5 font-bold text-black hover:bg-amber-400 transition tracking-wider text-xs shadow-[0_0_20px_rgba(245,158,11,0.3)]"
          >
            CLAIM SALVAGE & RETURN TO WAR-ROOM ▶
          </button>
        </div>
      </div>
    </div>
  );
}
