import { useCallback, useRef, useState } from 'react';
import Menu from './components/Menu';
import GameView from './components/GameView';
import GameOver from './components/GameOver';
import { AudioManager } from './game/audio';
import { randomSeedCode } from './game/world';
import { loadSettings, saveSettings, type Settings } from './game/settings';
import { loadRecords, submitRecord } from './game/records';
import type { ControlMode, GameStats, VehicleType } from './game/types';

type Screen = 'menu' | 'playing' | 'gameover';

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [vehicle, setVehicle] = useState<VehicleType>('warden');
  const [controls, setControls] = useState<ControlMode>('arcade');
  const [seed, setSeed] = useState('');
  const [stats, setStats] = useState<GameStats | null>(null);
  const [session, setSession] = useState(0);
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [records, setRecords] = useState(() => loadRecords());
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
    setVehicle(v);
    setControls(c);
    setSeed(sd);
    setStats(null);
    setSession((s) => s + 1);
    setScreen('playing');
  }, [ensureAudio]);

  const updateSettings = useCallback((next: Settings) => {
    setSettings(next);
    saveSettings(next);
    audioRef.current?.setVolume(next.volume);
    audioRef.current?.setMusicVolume(next.music);
  }, []);

  const handleGameOver = useCallback((s: GameStats) => {
    const { records: next, isBest, rank } = submitRecord(s);
    setRecords(next);
    setStats({ ...s, isBest, rank });
    setScreen('gameover');
  }, []);

  if (screen === 'menu') {
    return <Menu onStart={start} settings={settings} onSettings={updateSettings} records={records} />;
  }

  return (
    <div className="app-viewport relative w-full bg-black">
      {screen === 'playing' && audio && (
        <GameView
          key={session}
          vehicle={vehicle}
          controls={controls}
          seed={seed}
          audio={audio}
          settings={settings}
          onSettings={updateSettings}
          onGameOver={handleGameOver}
          onAbort={() => setScreen('menu')}
        />
      )}
      {screen === 'gameover' && stats && (
        <GameOver
          stats={stats}
          records={records}
          onRetry={(fresh) => start(vehicle, controls, fresh ? randomSeedCode() : seed)}
          onMenu={() => setScreen('menu')}
        />
      )}
    </div>
  );
}
