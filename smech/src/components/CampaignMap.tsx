import { useState } from 'react';
import {
  CAMPAIGN_MISSIONS,
  FACTIONS,
  PILOT_SKILLS,
  unlockPilotSkill,
  xpForLevel,
  type CampaignMission,
  type CampaignState,
  type PilotSkillDef,
  type PilotSkillId,
  type SkillCategory,
} from '../game/campaign';
import type { GarageState } from '../game/garage';

interface CampaignMapProps {
  campaign: CampaignState;
  garage: GarageState;
  onUpdateCampaign: (next: CampaignState) => void;
  onDeployMission: (mission: CampaignMission) => void;
  onOpenForge: () => void;
  onBackToMenu: () => void;
}

export default function CampaignMap({
  campaign,
  garage,
  onUpdateCampaign,
  onDeployMission,
  onOpenForge,
  onBackToMenu,
}: CampaignMapProps) {
  const [activeTab, setActiveTab] = useState<'contracts' | 'skills' | 'factions'>('contracts');
  const [selectedMission, setSelectedMission] = useState<CampaignMission | null>(() => {
    return (
      CAMPAIGN_MISSIONS.find((m) => m.id === campaign.activeMissionId) ||
      CAMPAIGN_MISSIONS[0]
    );
  });
  const [selectedSkillCategory, setSelectedSkillCategory] = useState<SkillCategory>('gunnery');

  const handleUnlockSkill = (skillId: PilotSkillId) => {
    const res = unlockPilotSkill(campaign, skillId);
    if (res.success) {
      onUpdateCampaign(res.state);
    }
  };

  const nextLvlXp = xpForLevel(campaign.level);
  const xpPercent = Math.min(100, Math.floor((campaign.xp / nextLvlXp) * 100));

  return (
    <div className="relative flex h-full w-full flex-col bg-slate-950 font-mono text-slate-100 select-none overflow-hidden">
      {/* Top Tactical Command Header */}
      <header className="flex h-16 items-center justify-between border-b border-amber-900/40 bg-black/60 px-6 backdrop-blur">
        <div className="flex items-center gap-4">
          <button
            onClick={onBackToMenu}
            className="flex items-center gap-2 rounded border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-amber-500 hover:text-white transition"
          >
            ◀ RETURN TO HANGAR
          </button>
          <div className="h-4 w-px bg-slate-800" />
          <div>
            <h1 className="text-sm font-bold tracking-widest text-amber-400">
              CAMPAIGN OPERATIONS // THEATER COMMAND
            </h1>
            <p className="text-[10px] tracking-wider text-slate-400">
              ALLIED GROUND FORCES // EXPANSIVE BATTLEFIELD OPERATIONS
            </p>
          </div>
        </div>

        {/* Pilot Dossier Status */}
        <div className="flex items-center gap-6 text-xs">
          <div className="flex items-center gap-3 rounded border border-slate-800 bg-slate-900/50 px-4 py-1.5">
            <div>
              <span className="text-[10px] text-slate-400">PILOT: </span>
              <span className="font-bold text-amber-300">{campaign.callsign}</span>
            </div>
            <div className="h-3 w-px bg-slate-800" />
            <div>
              <span className="text-[10px] text-slate-400">RANK: </span>
              <span className="font-bold text-white">LVL {campaign.level}</span>
            </div>
            <div className="h-3 w-px bg-slate-800" />
            <div className="w-24">
              <div className="flex justify-between text-[9px] text-slate-400 mb-0.5">
                <span>XP</span>
                <span>{campaign.xp}/{nextLvlXp}</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${xpPercent}%` }} />
              </div>
            </div>
            <div className="h-3 w-px bg-slate-800" />
            <div>
              <span className="text-[10px] text-slate-400">SKILL PTS: </span>
              <span className="font-bold text-cyan-400">{campaign.skillPoints}</span>
            </div>
          </div>

          <button
            onClick={onOpenForge}
            className="flex items-center gap-2 rounded border border-amber-600/80 bg-amber-600/20 px-4 py-2 font-bold text-amber-300 hover:bg-amber-600 hover:text-black transition"
          >
            🛠 THE FORGE ({garage.credits} CR)
          </button>
        </div>
      </header>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-slate-800 bg-slate-950/80 px-6">
        <button
          onClick={() => setActiveTab('contracts')}
          className={`flex items-center gap-2 px-6 py-3 text-xs font-bold tracking-wider transition border-b-2 ${
            activeTab === 'contracts'
              ? 'border-amber-400 text-amber-300 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>🎯</span> MILITARY OPERATIONS
        </button>
        <button
          onClick={() => setActiveTab('skills')}
          className={`flex items-center gap-2 px-6 py-3 text-xs font-bold tracking-wider transition border-b-2 ${
            activeTab === 'skills'
              ? 'border-cyan-400 text-cyan-300 bg-cyan-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>⚡</span> PILOT SPECIALIZATION ({campaign.skillPoints} PTS)
        </button>
        <button
          onClick={() => setActiveTab('factions')}
          className={`flex items-center gap-2 px-6 py-3 text-xs font-bold tracking-wider transition border-b-2 ${
            activeTab === 'factions'
              ? 'border-emerald-400 text-emerald-300 bg-emerald-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>🛡</span> FACTION RELATIONS
        </button>
      </div>

      {/* Content Area */}
      <div className="flex flex-1 overflow-hidden p-6 gap-6">
        {activeTab === 'contracts' && (
          <>
            {/* Missions Column */}
            <div className="flex w-1/2 flex-col gap-3 overflow-y-auto pr-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                ACTIVE MILITARY THEATERS
              </h2>
              {CAMPAIGN_MISSIONS.map((mission) => {
                const isCompleted = campaign.completedMissionIds.includes(mission.id);
                const isSelected = selectedMission?.id === mission.id;
                const isUnlocked = true;

                return (
                  <div
                    key={mission.id}
                    onClick={() => isUnlocked && setSelectedMission(mission)}
                    className={`relative flex flex-col rounded-lg border p-4 cursor-pointer transition ${
                      !isUnlocked
                        ? 'opacity-40 border-slate-800 bg-slate-900/20 cursor-not-allowed'
                        : isSelected
                          ? 'border-amber-400 bg-amber-950/20 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                          : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-cyan-400" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          OPERATION {mission.operationNumber} // {mission.operationName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isCompleted && (
                          <span className="rounded bg-emerald-950 px-2 py-0.5 text-[9px] font-bold text-emerald-400 border border-emerald-700">
                            ✓ SECURED
                          </span>
                        )}
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[9px] font-bold text-amber-300">
                          {mission.threatLevel}
                        </span>
                      </div>
                    </div>

                    <h3 className="mt-2 text-sm font-bold text-white tracking-wide">
                      {mission.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                      {mission.theater}
                    </p>

                    <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/60 pt-2">
                      <div>REWARDS: <span className="text-amber-300 font-bold">+{mission.rewards.credits} CR</span></div>
                      <div>XP: <span className="text-cyan-300 font-bold">+{mission.rewards.xp}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Mission Briefing Detail */}
            <div className="flex flex-1 flex-col justify-between rounded-lg border border-amber-900/40 bg-black/60 p-6 backdrop-blur">
              {selectedMission ? (
                <>
                  <div className="space-y-4 overflow-y-auto">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500">
                          TACTICAL BRIEFING // OP-{selectedMission.operationNumber}
                        </span>
                        <h2 className="text-lg font-bold text-white">
                          {selectedMission.title}
                        </h2>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400">THEATER</div>
                        <div className="text-xs font-bold text-cyan-400">
                          {selectedMission.theater}
                        </div>
                      </div>
                    </div>

                    <div className="rounded bg-slate-900/60 p-3 text-xs leading-relaxed text-slate-300 border border-slate-800">
                      <p className="font-semibold text-amber-300/90 mb-1">COMMAND TRANSMISSION:</p>
                      {selectedMission.briefingTranscript.map((line, idx) => (
                        <p key={idx} className="mb-1 text-slate-300">
                          &gt; {line}
                        </p>
                      ))}
                    </div>

                    {/* Operational Stages Checklist */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                        OPERATIONAL STAGES & OBJECTIVES:
                      </h4>
                      <div className="space-y-2">
                        {selectedMission.objectives.map((obj) => (
                          <div
                            key={obj.id}
                            className="flex items-start gap-3 rounded border border-slate-800/80 bg-slate-950/50 p-2.5 text-xs"
                          >
                            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">
                              STAGE {obj.stage}
                            </span>
                            <div>
                              <div className="font-bold text-slate-200">{obj.title}</div>
                              <div className="text-[11px] text-slate-400">{obj.desc}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Salvage Intel */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                        TACTICAL SALVAGE OPPORTUNITIES:
                      </h4>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        {selectedMission.salvagePool.map((salv) => (
                          <div key={salv.id} className="rounded border border-slate-800 bg-slate-950/40 p-2">
                            <div className="font-bold text-amber-300 text-[11px] truncate">{salv.name}</div>
                            <div className="text-[9px] text-slate-400 mt-0.5">{salv.kind.toUpperCase()} — {salv.value} CR</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Deploy Button */}
                  <div className="border-t border-slate-800 pt-4 mt-4 flex items-center justify-between">
                    <div className="text-xs text-slate-400">
                      BATTLE RIG READY: <span className="font-bold text-white">{garage.mechName}</span>
                    </div>
                    <button
                      onClick={() => onDeployMission(selectedMission)}
                      className="flex items-center gap-3 rounded bg-amber-500 px-6 py-2.5 font-bold text-black hover:bg-amber-400 transition shadow-[0_0_20px_rgba(245,158,11,0.3)] tracking-wider text-sm"
                    >
                      <span>⚡</span> LAUNCH SORTIE
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-slate-500">
                  SELECT A MISSION FROM THE CONTRACTS BOARD
                </div>
              )}
            </div>
          </>
        )}

        {/* Skills Tab */}
        {activeTab === 'skills' && (
          <div className="flex h-full w-full flex-col gap-6">
            <div className="flex gap-3 border-b border-slate-800 pb-3">
              {(['gunnery', 'piloting', 'engineering', 'tactics'] as SkillCategory[]).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedSkillCategory(cat)}
                  className={`rounded px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${
                    selectedSkillCategory === cat
                      ? 'bg-cyan-500 text-black'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-4 overflow-y-auto">
              {Object.values(PILOT_SKILLS)
                .filter((skill) => skill.category === selectedSkillCategory)
                .map((skill: PilotSkillDef) => {
                  const rank = campaign.skills[skill.id] || 0;
                  const isMax = rank >= skill.maxRank;
                  const canAfford = campaign.skillPoints >= skill.costPerRank;

                  return (
                    <div
                      key={skill.id}
                      className="flex flex-col justify-between rounded-lg border border-slate-800 bg-slate-900/40 p-4 transition hover:border-slate-700"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-white">{skill.name}</h4>
                          <span className="text-xs font-bold text-cyan-400">
                            RANK {rank} / {skill.maxRank}
                          </span>
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-slate-400">
                          {skill.desc}
                        </p>
                      </div>

                      <div className="mt-4 border-t border-slate-800/80 pt-3 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">
                          COST: <span className="font-bold text-white">{skill.costPerRank} PT</span>
                        </span>
                        <button
                          disabled={isMax || !canAfford}
                          onClick={() => handleUnlockSkill(skill.id)}
                          className={`rounded px-3 py-1.5 text-xs font-bold transition ${
                            isMax
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              : canAfford
                                ? 'bg-cyan-500 text-black hover:bg-cyan-400'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {isMax ? 'MAX RANK' : 'TRAIN SKILL'}
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Factions Tab */}
        {activeTab === 'factions' && (
          <div className="grid grid-cols-2 gap-6 w-full">
            {Object.values(FACTIONS).map((faction) => {
              const rep = campaign.factions[faction.id] || 0;
              const repStatus =
                rep >= 40 ? 'ALLIED' : rep >= 15 ? 'FRIENDLY' : rep <= -40 ? 'HOSTILE' : 'NEUTRAL';

              return (
                <div
                  key={faction.id}
                  className="flex flex-col justify-between rounded-lg border border-slate-800 bg-slate-900/40 p-5"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-3.5 w-3.5 rounded-full"
                          style={{ backgroundColor: faction.color }}
                        />
                        <h3 className="text-sm font-bold text-white">{faction.name}</h3>
                      </div>
                      <span
                        className="rounded px-2.5 py-0.5 text-[10px] font-bold border"
                        style={{
                          borderColor: faction.color,
                          color: faction.color,
                        }}
                      >
                        {repStatus} ({rep > 0 ? `+${rep}` : rep})
                      </span>
                    </div>

                    <div className="text-[11px] italic text-slate-400 mt-1">
                      "{faction.tagline}"
                    </div>

                    <p className="mt-3 text-xs leading-relaxed text-slate-300">
                      {faction.description}
                    </p>
                  </div>

                  <div className="mt-6">
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>STANDING: -100</span>
                      <span>0</span>
                      <span>+100</span>
                    </div>
                    <div className="relative h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="absolute top-0 bottom-0 transition-all duration-300"
                        style={{
                          backgroundColor: faction.color,
                          left: '50%',
                          width: `${Math.abs(rep) / 2}%`,
                          transform: rep < 0 ? 'translateX(-100%)' : 'none',
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
