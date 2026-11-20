import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Game } from '../game/engine';
import type { AudioManager } from '../game/audio';
import type { ControlMode, GameStats, HudState, VehicleType } from '../game/types';
import type { Settings } from '../game/settings';
import type { CampaignMission, CampaignObjective, RadioTransmission } from '../game/campaign';
import { CampaignEngine } from '../game/campaignEngine';
import { CampaignWorldManager, type ObjectiveWaypoint } from '../game/campaignWorld';
import type { SoundtrackDirector } from '../game/soundtrack';
import HUD from './HUD';
import CampaignHUD from './CampaignHUD';
import TouchControls from './TouchControls';
import UpgradeScreen from './UpgradeScreen';
import SettingsPanel from './SettingsPanel';
import { VEHICLES, type VehicleConfig } from '../game/vehicles';
import FullscreenButton from './FullscreenButton';

interface Props {
  vehicle: VehicleType;
  /** the built mech configuration from the forge */
  config?: VehicleConfig;
  /** enemy difficulty weight carried by the equipped frame */
  stepWeight?: number;
  /** the name the player gave the mech */
  mechName?: string;
  controls: ControlMode;
  seed: string;
  audio: AudioManager;
  settings: Settings;
  onSettings: (settings: Settings) => void;
  onLoot: (amount: number) => void;
  onGameOver: (s: GameStats) => void;
  onAbort: () => void;
  campaignMission?: CampaignMission | null;
  onCampaignVictory?: (mission: CampaignMission) => void;
  soundtrack?: SoundtrackDirector | null;
}

const DISPLAY = "'Orbitron', 'Share Tech Mono', monospace";
const MONO = "'Share Tech Mono', 'Courier New', monospace";

const isTouchDevice = () =>
  typeof window !== 'undefined' && ('ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0) && window.matchMedia('(pointer: coarse)').matches;

export default function GameView({
  vehicle,
  config,
  stepWeight,
  mechName,
  controls,
  seed,
  audio,
  settings,
  onSettings,
  onLoot,
  onGameOver,
  onAbort,
  campaignMission,
  onCampaignVictory,
  soundtrack,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [paused, setPaused] = useState(true);
  const [loading, setLoading] = useState(true);
  const [everLocked, setEverLocked] = useState(false);
  const [pauseTab, setPauseTab] = useState<'controls' | 'settings'>('controls');

  // Campaign objective and radio comms state
  const campaignEngineRef = useRef<CampaignEngine | null>(null);
  const worldManagerRef = useRef<CampaignWorldManager | null>(null);
  const prevKillsRef = useRef(0);
  const lastSoundtrackUpdateRef = useRef(0);
  const lastWaypointUpdateRef = useRef(0);
  const [objectives, setObjectives] = useState<CampaignObjective[]>(() =>
    campaignMission ? campaignMission.objectives.map((o) => ({ ...o })) : [],
  );
  const [activeTransmission, setActiveTransmission] = useState<RadioTransmission | null>(null);
  const [extractionReady, setExtractionReady] = useState(false);
  const [waypoints, setWaypoints] = useState<ObjectiveWaypoint[]>([]);

  useEffect(() => {
    if (!campaignMission) return;
    const engine = new CampaignEngine(campaignMission, {
      onTransmission: (t) => setActiveTransmission(t),
      onObjectiveUpdate: () => {
        setObjectives([...engine.objectives]);
      },
      onStageAdvance: (_stage, newSpawns) => {
        setObjectives([...engine.objectives]);
        setExtractionReady(engine.extractionReady);
        const g = gameRef.current;
        if (g) {
          for (const s of newSpawns) {
            g.spawnTacticalEnemy(s.kind, s.pos[0], s.pos[1], s.boss, false);
          }
        }
      },
      onMissionSuccess: () => {
        onCampaignVictory?.(campaignMission);
      },
    });
    campaignEngineRef.current = engine;
    setObjectives([...engine.objectives]);
    setExtractionReady(engine.extractionReady);
    prevKillsRef.current = 0;
  }, [campaignMission, onCampaignVictory]);

  // A failure while building the simulation (no WebGL, corrupt sector, ...)
  // happens inside a timer callback, so it never reaches the error boundary on
  // its own. It is captured here and re-thrown during render instead.
  const [bootError, setBootError] = useState<Error | null>(null);
  const onGameOverRef = useRef(onGameOver);
  const settingsRef = useRef(settings);
  useEffect(() => {
    onGameOverRef.current = onGameOver;
  }, [onGameOver]);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  const touch = useMemo(() => isTouchDevice(), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let g: Game | null = null;
    let lockTimer = 0;
    let lastCampaignHudTime = 0;
    // let the loading screen paint before the (synchronous) map generation starts
    const boot = window.setTimeout(() => {
      try {
        g = new Game({
          canvas,
          vehicle,
          config,
          stepWeight,
          mechName,
          controls,
          seed,
          audio,
          settings: settingsRef.current,
          campaignMode: Boolean(campaignMission),
          onEnemyKilled: (e) => {
            campaignEngineRef.current?.onEnemyKilled(e.kind, e.pos, e.boss);
          },
          onCheckInstallationHit: (start, end, damage, splash) => {
            return worldManagerRef.current?.checkHit(start, end, damage, splash) ?? false;
          },
          onAreaDamage: (pos, damage, radius) => {
            worldManagerRef.current?.applySplashDamage(pos, damage, radius);
          },
          onHud: (nextHud) => {
            setHud(nextHud);
            const now = performance.now();

            if (soundtrack && now - lastSoundtrackUpdateRef.current > 350) {
              lastSoundtrackUpdateRef.current = now;
              if (nextHud.enemiesLeft > 0) {
                soundtrack.setMood(nextHud.boss ? 'boss' : 'combat');
                soundtrack.setIntensity(Math.min(1, nextHud.enemiesLeft / 6));
              } else if (extractionReady) {
                soundtrack.setMood('victory');
              } else {
                soundtrack.setMood('patrol');
                soundtrack.setIntensity(0.2);
              }
            }

            const engine = campaignEngineRef.current;
            if (engine && g) {
              const hpRatio = nextHud.maxHp > 0 ? nextHud.hp / nextHud.maxHp : 1;
              const elapsed = lastCampaignHudTime ? Math.min(0.1, (now - lastCampaignHudTime) / 1000) : 0;
              lastCampaignHudTime = now;
              engine.update(elapsed, g.playerPos.x, g.playerPos.z, hpRatio);
              if (engine.extractionReady !== extractionReady) {
                setExtractionReady(engine.extractionReady);
              }

              if (worldManagerRef.current) {
                worldManagerRef.current.update(
                  0.05,
                  g.playerPos.x,
                  g.playerPos.z,
                  engine.extractionReady,
                  engine.currentStage,
                );

                if (now - lastWaypointUpdateRef.current > 200) {
                  lastWaypointUpdateRef.current = now;
                  const wps = worldManagerRef.current.getWaypoints(
                    g.playerPos.x,
                    g.playerPos.z,
                    nextHud.turretYaw,
                    engine.currentStage,
                    engine.extractionReady,
                    engine.objectives,
                  );
                  setWaypoints(wps);
                }
              }
            }
          },
          onLoot,
          onGameOver: (st) => onGameOverRef.current(st),
          onPause: (p) => {
            setPaused(p);
            if (!p) setEverLocked(true);
          },
        });
        gameRef.current = g;
        setGame(g);
        (window as unknown as { __steelGame?: Game }).__steelGame = g;
        if (campaignMission) {
          worldManagerRef.current = new CampaignWorldManager(g.worldScene, campaignMission, audio, {
            onInstallationDestroyed: (id, _name, x, z) => {
              campaignEngineRef.current?.onInstallationDestroyed(id, { x, z });
            },
          });
          const initialSpawns = campaignEngineRef.current?.getSpawnsForStage(1) || [];
          for (const s of initialSpawns) {
            g.spawnTacticalEnemy(s.kind, s.pos[0], s.pos[1], s.boss, false);
          }
        }
        g.start();
        setLoading(false);
        // TouchControls un-pauses touch games on mount; mouse games grab the pointer now
        if (!touch) lockTimer = window.setTimeout(() => g?.requestPointerLock(), 50);
      } catch (err) {
        setBootError(err instanceof Error ? err : new Error(String(err)));
      }
    }, 80);
    return () => {
      window.clearTimeout(boot);
      window.clearTimeout(lockTimer);
      worldManagerRef.current?.dispose();
      worldManagerRef.current = null;
      g?.dispose();
      gameRef.current = null;
      setGame(null);
    };
  }, [vehicle, config, stepWeight, mechName, controls, seed, audio, touch, onLoot]);

  // live cockpit preferences are pushed into the running simulation
  useEffect(() => {
    gameRef.current?.applySettings(settings);
  }, [settings]);

  const handleSettings = useCallback(
    (next: Settings) => {
      onSettings(next);
      gameRef.current?.applySettings(next);
    },
    [onSettings],
  );

  const accent = VEHICLES[vehicle].accent;

  // Hand a boot failure to the error boundary by throwing during render.
  if (bootError) throw bootError;

  return (
    <div className="app-viewport relative w-full bg-black overflow-hidden" style={{ touchAction: 'none' }}>
      <canvas tabIndex={-1} aria-label="Arena cockpit" ref={canvasRef} className="absolute inset-0 w-full h-full block" />
      {hud && (
        <HUD
          onUnstick={() => gameRef.current?.unstick()}
          touch={touch}
          onZoom={() => gameRef.current?.toggleZoom()}
          hud={hud}
          vehicle={vehicle}
          settings={settings}
          onExtract={() => gameRef.current?.extractNow()}
          onWeapon={(id) => gameRef.current?.useWeapon(id)}
        />
      )}
      {campaignMission && (
        <CampaignHUD
          objectives={objectives}
          transmission={activeTransmission}
          extractionReady={extractionReady}
          waypoints={waypoints}
        />
      )}
      {touch && <TouchControls game={game} accent={accent} enabled={!!hud?.alive && !hud.offer && !loading} />}
      {hud?.offer && <UpgradeScreen hud={hud} accent={accent} onPick={(i) => gameRef.current?.pickUpgrade(i)} onHover={() => audio.playUiHover()} />}
      {loading && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-5 bg-[#070d0f] text-center" role="status" aria-live="polite">
          <div className="text-[10px] tracking-[0.5em] text-zinc-400" style={{ fontFamily: MONO }}>// PROCEDURAL GENERATION</div>
          <div className="text-2xl md:text-4xl font-black tracking-[0.2em] text-white" style={{ fontFamily: DISPLAY }}>GENERATING SECTOR {seed}</div>
          <div className="h-[3px] w-64 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-1/3 rounded-full loading-bar" style={{ background: accent, boxShadow: `0 0 12px ${accent}` }} />
          </div>
          <div className="text-[10px] tracking-[0.3em] text-zinc-500" style={{ fontFamily: MONO }}>SURVEYING TERRAIN · LAYING ROADS · PLACING DISTRICTS</div>
        </div>
      )}
      {paused && !touch && !loading && !hud?.offer && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center cursor-pointer select-none"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
          onClick={() => gameRef.current?.requestPointerLock()}
          role="dialog"
          aria-modal="true"
          aria-label={everLocked ? 'Simulation paused' : 'Cockpit ready'}
        >
          <div
            className="pause-panel text-center px-8 py-8 rounded-lg"
            style={{ background: 'rgba(8,10,14,0.85)', border: `1px solid ${accent}66`, boxShadow: `0 0 50px ${accent}22` }}
            // Everything inside the panel is interactive: tabs, sliders and
            // buttons must not bubble up to the overlay, or changing a setting
            // would immediately resume the simulation and close this menu.
            onClick={(event) => event.stopPropagation()}
          >
            <div className="text-[10px] tracking-[0.5em] text-zinc-400" style={{ fontFamily: MONO }}>
              {everLocked ? '// SIMULATION PAUSED' : '// COCKPIT READY'}
            </div>
            <div className="mt-3 text-2xl md:text-4xl font-black tracking-[0.25em] text-white" style={{ fontFamily: DISPLAY, textShadow: `0 0 20px ${accent}88` }}>
              {everLocked ? 'PAUSED' : 'TAKE CONTROL'}
            </div>
            <div className="mt-4 text-xs md:text-sm tracking-[0.3em]" style={{ fontFamily: MONO, color: accent }}>
              CLICK TO {everLocked ? 'RESUME' : 'ENGAGE'} · MOUSE WILL BE CAPTURED
            </div>

            <div className="pause-tabs" role="tablist" aria-label="Pause menu sections">
              <button role="tab" aria-selected={pauseTab === 'controls'} className="pause-tab" onClick={() => setPauseTab('controls')}>CONTROLS</button>
              <button role="tab" aria-selected={pauseTab === 'settings'} className="pause-tab" onClick={() => setPauseTab('settings')}>SETTINGS</button>
            </div>

            {pauseTab === 'controls' ? (
              <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-1 text-[11px] text-zinc-400 text-left" style={{ fontFamily: MONO }}>
                {controls === 'arcade' ? (
                  <>
                    <span><b className="text-zinc-200">WASD</b> move toward aim</span>
                    <span><b className="text-zinc-200">MOUSE / ARROWS</b> aim</span>
                    <span><b className="text-zinc-200">A / D</b> sidestep</span>
                    <span><b className="text-zinc-200">HULL</b> lines up itself</span>
                  </>
                ) : (
                  <>
                    <span><b className="text-zinc-200">WASD</b> drive hull</span>
                    <span><b className="text-zinc-200">MOUSE / ARROWS</b> aim turret</span>
                  </>
                )}
                <span><b className="text-zinc-200">LMB / SPACE</b> primary weapon</span>
                <span><b className="text-zinc-200">RMB / CTRL / C</b> secondary weapon</span>
                <span><b className="text-zinc-200">Q / E</b> special weapons</span>
                <span><b className="text-zinc-200">Z</b> scope</span>
                <span><b className="text-zinc-200">M</b> music on / off</span>
                <span><b className="text-zinc-200">ESC</b> pause</span>
                <span><b className="text-zinc-200">U</b> unstick when drive is blocked</span>
              </div>
            ) : (
              <div className="mt-5 text-left">
                <SettingsPanel settings={settings} onChange={handleSettings} accent={accent} dense />
              </div>
            )}

            <div className="pause-menu">
              <div className="pause-menu-actions">
                <button
                  type="button"
                  className="pause-action is-primary"
                  style={{ ['--pause-accent' as string]: accent }}
                  onClick={(e) => { e.stopPropagation(); gameRef.current?.requestPointerLock(); }}
                >
                  <span>RESUME</span>
                </button>
                <button
                  type="button"
                  className="pause-action is-ghost"
                  onClick={(e) => { e.stopPropagation(); onAbort(); }}
                >
                  <span>ABORT TO HANGAR</span>
                </button>
              </div>
            </div>

            <div className="pause-fullscreen" onClick={(event) => event.stopPropagation()}><FullscreenButton /></div>
          </div>
        </div>
      )}
    </div>
  );
}
