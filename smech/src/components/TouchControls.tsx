import { useCallback, useEffect, useRef, useState } from 'react';
import type { Game } from '../game/engine';

interface Props {
  game: Game | null;
  accent: string;
  enabled?: boolean;
}

type FireChannel = 'primary' | 'secondary';
const HOLD_TO_FIRE_MS = 200;
const MIN_FIRE_MS = 120;
const AIM_DRAG_PX = 10;
const RADIUS = 62;

/**
 * The left side is a movement stick. On the right, drag to aim, tap or hold to
 * fire primary, and add a second finger for secondary. A deliberate drag does
 * not fire unless the first finger was already held long enough to shoot.
 */
export default function TouchControls({ game, accent, enabled = true }: Props) {
  useEffect(() => {
    game?.setTouchMode(true);
    return () => game?.setTouchMode(false);
  }, [game]);
  // Removing the surfaces also releases every captured touch during an upgrade.
  return enabled ? <TouchSurface game={game} accent={accent} /> : null;
}

function TouchSurface({ game, accent }: Omit<Props, 'enabled'>) {
  const [stick, setStick] = useState<{ active: boolean; ox: number; oy: number; dx: number; dy: number }>({
    active: false,
    ox: 0,
    oy: 0,
    dx: 0,
    dy: 0,
  });
  const stickId = useRef<number | null>(null);
  const stickOrigin = useRef({ x: 0, y: 0 });
  const lookId = useRef<number | null>(null);
  const secondId = useRef<number | null>(null);
  const lookOrigin = useRef({ x: 0, y: 0 });
  const lookLast = useRef({ x: 0, y: 0 });
  const lookMoved = useRef(false);
  const multiTouch = useRef(false);
  const fire = useRef({ primary: false, secondary: false });
  const fireSince = useRef({ primary: 0, secondary: 0 });
  const holdTimer = useRef<number | null>(null);
  const releaseTimers = useRef<Record<FireChannel, number | null>>({ primary: null, secondary: null });

  const setChannel = useCallback(
    (channel: FireChannel, down: boolean) => {
      if (fire.current[channel] === down) return;
      fire.current[channel] = down;
      game?.setPadFire(fire.current.primary, fire.current.secondary);
    },
    [game],
  );

  const releaseAll = useCallback(
    (hideStick = true) => {
      if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
      for (const channel of ['primary', 'secondary'] as const) {
        const timer = releaseTimers.current[channel];
        if (timer !== null) window.clearTimeout(timer);
        releaseTimers.current[channel] = null;
      }
      stickId.current = lookId.current = secondId.current = null;
      fire.current = { primary: false, secondary: false };
      game?.setPadFire(false, false);
      game?.setPadMove(0, 0);
      if (hideStick) setStick((s) => (s.active ? { ...s, active: false, dx: 0, dy: 0 } : s));
    },
    [game],
  );

  useEffect(() => {
    const onBlur = () => releaseAll();
    const onVisibility = () => {
      if (document.hidden) releaseAll();
    };
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      releaseAll(false);
    };
  }, [releaseAll]);

  const cancelHold = () => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };
  const cancelRelease = (channel: FireChannel) => {
    const timer = releaseTimers.current[channel];
    if (timer !== null) window.clearTimeout(timer);
    releaseTimers.current[channel] = null;
  };
  const press = (channel: FireChannel) => {
    cancelRelease(channel);
    if (!fire.current[channel]) fireSince.current[channel] = Date.now();
    setChannel(channel, true);
  };
  const release = (channel: FireChannel, completeTap: boolean) => {
    cancelRelease(channel);
    if (!fire.current[channel]) return;
    // Keep a quick tap down briefly so the simulation can register it.
    const remaining = completeTap ? Math.max(0, MIN_FIRE_MS - (Date.now() - fireSince.current[channel])) : 0;
    if (remaining) {
      releaseTimers.current[channel] = window.setTimeout(() => {
        releaseTimers.current[channel] = null;
        setChannel(channel, false);
      }, remaining);
    } else setChannel(channel, false);
  };

  // The first right-hand pointer aims. A second one fires the alternate weapon.
  const startLook = (e: React.PointerEvent) => {
    if (lookId.current === null) {
      e.currentTarget.setPointerCapture(e.pointerId);
      cancelRelease('primary');
      setChannel('primary', false);
      lookId.current = e.pointerId;
      lookOrigin.current = lookLast.current = { x: e.clientX, y: e.clientY };
      lookMoved.current = false;
      multiTouch.current = secondId.current !== null;
      if (!multiTouch.current) {
        holdTimer.current = window.setTimeout(() => {
          holdTimer.current = null;
          if (lookId.current === e.pointerId && !lookMoved.current && !multiTouch.current) press('primary');
        }, HOLD_TO_FIRE_MS);
      }
    } else if (secondId.current === null && e.pointerId !== lookId.current) {
      e.currentTarget.setPointerCapture(e.pointerId);
      secondId.current = e.pointerId;
      multiTouch.current = true;
      cancelHold();
      press('secondary');
    }
  };
  const moveLook = (e: React.PointerEvent) => {
    if (lookId.current !== e.pointerId) return;
    const dx = e.clientX - lookLast.current.x;
    const dy = e.clientY - lookLast.current.y;
    lookLast.current = { x: e.clientX, y: e.clientY };
    if (Math.hypot(e.clientX - lookOrigin.current.x, e.clientY - lookOrigin.current.y) > AIM_DRAG_PX) {
      lookMoved.current = true;
      cancelHold();
    }
    game?.addPadLook(dx, dy);
  };
  const endLook = (e: React.PointerEvent) => {
    const completed = e.type === 'pointerup';
    if (lookId.current === e.pointerId) {
      cancelHold();
      lookId.current = null;
      if (completed && !lookMoved.current && !multiTouch.current && !fire.current.primary) press('primary');
      release('primary', completed);
    } else if (secondId.current === e.pointerId) {
      secondId.current = null;
      release('secondary', completed);
    }
  };

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

  const startStick = (e: React.PointerEvent) => {
    if (stickId.current !== null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    stickId.current = e.pointerId;
    stickOrigin.current = { x: e.clientX, y: e.clientY };
    setStick({ active: true, ox: e.clientX, oy: e.clientY, dx: 0, dy: 0 });
  };
  const moveStick = (e: React.PointerEvent) => {
    if (stickId.current === e.pointerId) onStickMove(e.clientX, e.clientY);
  };
  const endStick = (e: React.PointerEvent) => {
    if (stickId.current === e.pointerId) {
      stickId.current = null;
      setStick({ active: false, ox: 0, oy: 0, dx: 0, dy: 0 });
      game?.setPadMove(0, 0);
    }
  };

  return (
    <div className="absolute inset-0 z-10" style={{ touchAction: 'none' }}>
      <div
        className="touch-look absolute inset-y-0 right-0"
        style={{ width: '62%' }}
        onPointerDown={startLook}
        onPointerMove={moveLook}
        onPointerUp={endLook}
        onPointerCancel={endLook}
        onLostPointerCapture={endLook}
      />
      <div
        className="touch-stick absolute inset-y-0 left-0"
        style={{ width: '38%' }}
        onPointerDown={startStick}
        onPointerMove={moveStick}
        onPointerUp={endStick}
        onPointerCancel={endStick}
        onLostPointerCapture={endStick}
      />

      {stick.active && (
        <div
          className="absolute pointer-events-none"
          style={{ left: stick.ox, top: stick.oy, transform: 'translate(-50%, -50%)' }}
        >
          <div
            className="rounded-full"
            style={{
              width: RADIUS * 2,
              height: RADIUS * 2,
              border: `2px solid ${accent}66`,
              background: 'rgba(0,0,0,0.25)',
            }}
          />
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
    </div>
  );
}
