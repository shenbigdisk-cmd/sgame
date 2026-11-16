import { useCallback, useEffect, useRef, useState } from 'react';
import type { Game } from '../game/engine';
import type { HudWeapon } from '../game/types';

interface Props {
  game: Game | null;
  accent: string;
  weapons: HudWeapon[];
}

const DISPLAY = "'Orbitron', 'Share Tech Mono', monospace";

/**
 * On-screen controls for touch devices: a virtual stick on the left for
 * movement (relative to where you are looking), drag anywhere on the right to
 * aim, and big fire buttons.
 */
export default function TouchControls({ game, accent, weapons }: Props) {
  const [stick, setStick] = useState<{ active: boolean; ox: number; oy: number; dx: number; dy: number }>({ active: false, ox: 0, oy: 0, dx: 0, dy: 0 });
  const lookId = useRef<number | null>(null);
  const lookLast = useRef({ x: 0, y: 0 });
  const stickId = useRef<number | null>(null);
  const [firing, setFiring] = useState<{ cannon: boolean; mg: boolean }>({ cannon: false, mg: false });

  useEffect(() => {
    game?.setTouchMode(true);
    return () => game?.setTouchMode(false);
  }, [game]);

  const RADIUS = 62;

  const stickOrigin = useRef({ x: 0, y: 0 });

  const onStickMove = useCallback(
    (x: number, y: number) => {
      let dx = x - stickOrigin.current.x;
      let dy = y - stickOrigin.current.y;
      const d = Math.hypot(dx, dy);
      if (d > RADIUS) {
        dx = (dx / d) * RADIUS;
        dy = (dy / d) * RADIUS;
      }
      setStick((s) => ({ ...s, dx, dy }));
      // y is inverted: dragging up = forward
      game?.setPadMove(dx / RADIUS, -dy / RADIUS);
    },
    [game],
  );

  // --- aiming: any touch that starts on the right half (not on a button) ---
  const startLook = (e: React.PointerEvent) => {
    if (lookId.current !== null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    lookId.current = e.pointerId;
    lookLast.current = { x: e.clientX, y: e.clientY };
  };
  const moveLook = (e: React.PointerEvent) => {
    if (lookId.current !== e.pointerId) return;
    const dx = e.clientX - lookLast.current.x;
    const dy = e.clientY - lookLast.current.y;
    lookLast.current = { x: e.clientX, y: e.clientY };
    game?.addPadLook(dx, dy);
  };
  const endLook = (e: React.PointerEvent) => {
    if (lookId.current === e.pointerId) lookId.current = null;
  };

  // --- movement stick: any touch on the left third ---
  const startStick = (e: React.PointerEvent) => {
    if (stickId.current !== null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    stickId.current = e.pointerId;
    stickOrigin.current = { x: e.clientX, y: e.clientY };
    setStick({ active: true, ox: e.clientX, oy: e.clientY, dx: 0, dy: 0 });
  };
  const moveStick = (e: React.PointerEvent) => {
    if (stickId.current !== e.pointerId) return;
    onStickMove(e.clientX, e.clientY);
  };
  const endStick = (e: React.PointerEvent) => {
    if (stickId.current !== e.pointerId) return;
    stickId.current = null;
    setStick({ active: false, ox: 0, oy: 0, dx: 0, dy: 0 });
    game?.setPadMove(0, 0);
  };

  const fireRef = useRef({ cannon: false, mg: false });
  const setFire = (which: 'cannon' | 'mg', on: boolean) => {
    if (which === 'cannon') fireRef.current.cannon = on;
    else fireRef.current.mg = on;
    setFiring({ ...fireRef.current });
    game?.setPadFire(fireRef.current.cannon, fireRef.current.mg);
  };

  return (
    <div className="absolute inset-0 z-10" style={{ touchAction: 'none' }}>
      {/* look surface (right side, above the buttons) */}
      <div className="absolute inset-y-0 right-0" style={{ width: '62%' }} onPointerDown={startLook} onPointerMove={moveLook} onPointerUp={endLook} onPointerCancel={endLook} />
      {/* movement stick surface (left side) */}
      <div className="absolute inset-y-0 left-0" style={{ width: '38%' }} onPointerDown={startStick} onPointerMove={moveStick} onPointerUp={endStick} onPointerCancel={endStick} />

      {/* stick visual */}
      {stick.active && (
        <div className="absolute pointer-events-none" style={{ left: stick.ox, top: stick.oy, transform: 'translate(-50%, -50%)' }}>
          <div className="rounded-full" style={{ width: RADIUS * 2, height: RADIUS * 2, border: `2px solid ${accent}66`, background: 'rgba(0,0,0,0.25)' }} />
          <div
            className="absolute rounded-full"
            style={{
              width: 54,
              height: 54,
              left: RADIUS + stick.dx - 27,
              top: RADIUS + stick.dy - 27,
              background: `${accent}cc`,
              boxShadow: `0 0 18px ${accent}`,
            }}
          />
        </div>
      )}
      {!stick.active && (
        <div className="absolute pointer-events-none left-[8%] bottom-[26%] text-[10px] tracking-[0.3em] opacity-40" style={{ fontFamily: DISPLAY, color: accent }}>
          DRAG TO MOVE
        </div>
      )}

      {/* fire buttons */}
      <div className="absolute right-5 top-[24%] flex gap-2">
        {weapons.filter((weapon) => weapon.key === 'Q' || weapon.key === 'E').map((weapon) => (
          <button
            key={weapon.id}
            className="min-w-[74px] rounded px-2 py-3 text-[10px] tracking-wider"
            style={{ fontFamily: DISPLAY, border: `1px solid ${accent}`, background: 'rgba(0,0,0,0.68)', color: accent, opacity: weapon.ready >= 1 ? 1 : 0.5 }}
            onPointerDown={(e) => { e.preventDefault(); game?.useWeapon(weapon.id); }}
          >
            {weapon.key}<br />{weapon.name}
          </button>
        ))}
      </div>
      <div className="absolute right-5 bottom-24 flex flex-col items-end gap-3">
        <button
          className="rounded-full flex items-center justify-center active:scale-95 transition-transform"
          style={{ width: 74, height: 74, background: firing.mg ? '#ff8a3d' : 'rgba(20,12,8,0.6)', border: `2px solid ${accent}`, color: '#fff', fontFamily: DISPLAY }}
          onPointerDown={(e) => {
            e.preventDefault();
            setFire('mg', true);
          }}
          onPointerUp={() => setFire('mg', false)}
          onPointerLeave={() => setFire('mg', false)}
          onPointerCancel={() => setFire('mg', false)}
        >
          <span className="text-[10px] tracking-[0.2em]">{weapons[1]?.detail ?? 'SEC'}</span>
        </button>
        <button
          className="rounded-full flex items-center justify-center active:scale-95 transition-transform"
          style={{ width: 96, height: 96, background: firing.cannon ? accent : 'rgba(20,12,8,0.6)', border: `3px solid ${accent}`, color: firing.cannon ? '#000' : '#fff', fontFamily: DISPLAY, boxShadow: `0 0 20px ${accent}55` }}
          onPointerDown={(e) => {
            e.preventDefault();
            setFire('cannon', true);
          }}
          onPointerUp={() => setFire('cannon', false)}
          onPointerLeave={() => setFire('cannon', false)}
          onPointerCancel={() => setFire('cannon', false)}
        >
          <span className="text-xs tracking-[0.2em]">{weapons[0]?.detail ?? 'FIRE'}</span>
        </button>
      </div>

      {/* scope toggle */}
      <button
        className="absolute right-5 bottom-[46%] rounded px-3 py-2 text-[10px] tracking-[0.25em] active:scale-95"
        style={{ fontFamily: DISPLAY, border: `1px solid ${accent}88`, background: 'rgba(0,0,0,0.45)', color: accent }}
        onPointerDown={(e) => {
          e.preventDefault();
          game?.toggleZoom();
        }}
      >
        SCOPE
      </button>
    </div>
  );
}
