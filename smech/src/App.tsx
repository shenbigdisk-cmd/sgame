import { useCallback, useMemo, useRef, useState } from 'react';
import Menu from './components/Menu';
import GameView from './components/GameView';
import GameOver from './components/GameOver';
import CampaignMap from './components/CampaignMap';
import CampaignDebrief from './components/CampaignDebrief';
import MechBuilder from './components/MechBuilder';
import { AudioManager } from './game/audio';
import { randomSeedCode } from './game/world';
import { loadSettings, saveSettings, type Settings } from './game/settings';
import { loadRecords, submitRecord } from './game/records';
import { buildConfig, frameOf } from './game/forge';
import {
  creditsForRun,
  garageStepWeight,
  grantCredits,
  loadGarage,
  saveGarage,
  type GarageState,
} from './game/garage';
import {
  completeCampaignMission,
  loadCampaign,
  saveCampaign,
  type CampaignMission,
  type CampaignState,
  type SalvageItem,
} from './game/campaign';
import type { ControlMode, GameStats, VehicleType } from './game/types';

type Screen = 'menu' | 'playing' | 'gameover' | 'campaign' | 'debrief' | 'forge';

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [vehicle, setVehicle] = useState<VehicleType>('warden');
  const [controls, setControls] = useState<ControlMode>('arcade');
  const [seed, setSeed] = useState('');
  const [stats, setStats] = useState<GameStats | null>(null);
  const [session, setSession] = useState(0);
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [records, setRecords] = useState(() => loadRecords());
  // The mech the player builds in the forge, and the credits it was bought with.
  const [garage, setGarage] = useState<GarageState>(() => loadGarage());
  // Mercenary campaign state
  const [campaign, setCampaign] = useState<CampaignState>(() => loadCampaign());
  const [campaignMission, setCampaignMission] = useState<CampaignMission | null>(null);
  const [debriefMission, setDebriefMission] = useState<CampaignMission | null>(null);

  // The built configuration must keep a stable identity: the simulation
  // rebuilds itself whenever it changes, and a fresh object every render
  // would rebuild it in a loop.
  const build = useMemo(() => buildConfig(garage.equipped), [garage.equipped]);
  // The audio graph outlives a single run, so it is kept in a ref and mirrored
  // into state (only for rendering) — never read a ref during render.
  const audioRef = useRef<AudioManager | null>(null);
  const [audio, setAudio] = useState<AudioManager | null>(null);

  const ensureAudio = useCallback((): AudioManager => {
    if (!audioRef.current) {
      audioRef.current = new AudioManager();
      setAudio(audioRef.current);
    }
    const manager = audioRef.current;
    manager.resume();
    manager.setVolume(settings.volume);
    manager.setMusicVolume(settings.music);
    return manager;
  }, [settings]);

  const start = useCallback((v: VehicleType, c: ControlMode, sd: string) => {
    ensureAudio();
    setCampaignMission(null);
    setVehicle(v);
    setControls(c);
    setSeed(sd);
    setStats(null);
    setSession((s) => s + 1);
    setScreen('playing');
  }, [ensureAudio]);

  const startCampaignMission = useCallback((mission: CampaignMission) => {
    ensureAudio();
    const frame = frameOf(garage.equipped);
    setVehicle(frame);
    setControls('arcade');
    setSeed(mission.seed);
    setCampaignMission(mission);
    setStats(null);
    setSession((s) => s + 1);
    setScreen('playing');
  }, [ensureAudio, garage.equipped]);

  const handleCampaignVictory = useCallback((mission: CampaignMission) => {
    setDebriefMission(mission);
    setScreen('debrief');
  }, []);

  const handleConfirmDebrief = useCallback((chosenSalvage?: SalvageItem) => {
    if (debriefMission) {
      const updatedCampaign = completeCampaignMission(campaign, debriefMission.id, chosenSalvage);
      setCampaign(updatedCampaign);
      saveCampaign(updatedCampaign);
      const bonusScrap = chosenSalvage?.kind === 'scrap' ? chosenSalvage.value : 0;
      const totalCreditsEarned = debriefMission.rewards.credits + bonusScrap;
      setGarage((current) => {
        const nextGarage = grantCredits(current, totalCreditsEarned);
        saveGarage(nextGarage);
        return nextGarage;
      });
    }
    setDebriefMission(null);
    setCampaignMission(null);
    setScreen('campaign');
  }, [campaign, debriefMission]);

  const updateSettings = useCallback((next: Settings) => {
    setSettings(next);
    saveSettings(next);
    audioRef.current?.setVolume(next.volume);
    audioRef.current?.setMusicVolume(next.music);
  }, []);

  const bankLoot = useCallback((amount: number) => {
    setGarage(current => grantCredits(current, amount));
  }, []);

  const handleGameOver = useCallback((s: GameStats) => {
    const { records: next, isBest, rank } = submitRecord(s);
    setRecords(next);
    // Winning in the sand pays out credits for the forge.
    const earned = creditsForRun(s, isBest);
    setGarage((current) => grantCredits(current, earned));
    setStats({ ...s, isBest, rank, credits: earned + (s.lootCredits ?? 0), mechName: garage.mechName });
    setScreen('gameover');
  }, [garage.mechName]);

  if (screen === 'menu') {
    return (
      <Menu
        onStart={start}
        onOpenCampaign={() => setScreen('campaign')}
        settings={settings}
        onSettings={updateSettings}
        records={records}
        garage={garage}
        onGarage={(next: GarageState) => {
          setGarage(next);
          saveGarage(next);
        }}
      />
    );
  }

  if (screen === 'campaign') {
    return (
      <CampaignMap
        campaign={campaign}
        garage={garage}
        onUpdateCampaign={(next) => {
          setCampaign(next);
          saveCampaign(next);
        }}
        onDeployMission={startCampaignMission}
        onOpenForge={() => setScreen('forge')}
        onBackToMenu={() => setScreen('menu')}
      />
    );
  }

  if (screen === 'forge') {
    return (
      <MechBuilder
        garage={garage}
        onBuild={(next) => {
          setGarage(next);
          saveGarage(next);
          setScreen('campaign');
        }}
        onCancel={() => setScreen('campaign')}
        accent="#c0f069"
      />
    );
  }

  return (
    <div className="app-viewport relative w-full bg-black">
      {screen === 'playing' && audio && (
        <GameView
          key={session}
          vehicle={vehicle}
          config={build}
          stepWeight={garageStepWeight(garage)}
          mechName={garage.mechName}
          controls={controls}
          seed={seed}
          audio={audio}
          settings={settings}
          onSettings={updateSettings}
          onLoot={bankLoot}
          onGameOver={handleGameOver}
          onAbort={() => setScreen(campaignMission ? 'campaign' : 'menu')}
          campaignMission={campaignMission}
          onCampaignVictory={handleCampaignVictory}
          soundtrack={null}
        />
      )}
      {screen === 'debrief' && debriefMission && (
        <CampaignDebrief
          mission={debriefMission}
          onConfirmDebrief={handleConfirmDebrief}
        />
      )}
      {screen === 'gameover' && stats && (
        <GameOver
          stats={stats}
          records={records}
          onRetry={(fresh) => {
            if (campaignMission) {
              startCampaignMission(campaignMission);
            } else {
              start(vehicle, controls, fresh ? randomSeedCode() : seed);
            }
          }}
          onMenu={() => setScreen(campaignMission ? 'campaign' : 'menu')}
        />
      )}
    </div>
  );
}

