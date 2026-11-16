import { useCallback, useRef, useState } from 'react';
import Menu from './components/Menu';
import GameView from './components/GameView';
import GameOver from './components/GameOver';
import { AudioManager } from './game/audio';
import { randomSeedCode } from './game/world';
import type { ControlMode, GameStats, VehicleType } from './game/types';

type Screen = 'menu' | 'playing' | 'gameover';

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [vehicle, setVehicle] = useState<VehicleType>('warden');
  const [controls, setControls] = useState<ControlMode>('arcade');
  const [seed, setSeed] = useState('');
  const [stats, setStats] = useState<GameStats | null>(null);
  const [session, setSession] = useState(0);
  const audioRef = useRef<AudioManager | null>(null);

  const getAudio = () => {
    if (!audioRef.current) audioRef.current = new AudioManager();
    audioRef.current.resume();
    return audioRef.current;
  };

  const start = useCallback((v: VehicleType, c: ControlMode, sd: string) => {
    getAudio();
    setVehicle(v);
    setControls(c);
    setSeed(sd);
    setStats(null);
    setSession((s) => s + 1);
    setScreen('playing');
  }, []);

  const handleGameOver = useCallback((s: GameStats) => {
    setStats(s);
    setScreen('gameover');
  }, []);

  if (screen === 'menu') return <Menu onStart={start} />;

  return (
    <div className="app-viewport relative w-full bg-black">
      {screen === 'playing' && audioRef.current && (
        <GameView key={session} vehicle={vehicle} controls={controls} seed={seed} audio={audioRef.current} onGameOver={handleGameOver} />
      )}
      {screen === 'gameover' && stats && <GameOver stats={stats} onRetry={(fresh) => start(vehicle, controls, fresh ? randomSeedCode() : seed)} onMenu={() => setScreen('menu')} />}
    </div>
  );
}
