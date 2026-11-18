import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Game } from '../game/engine';
import TouchControls from './TouchControls';

beforeAll(() => {
  // @ts-expect-error React act environment flag
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', { configurable: true, value: () => {} });
});

let container: HTMLDivElement;
let root: Root;
let game: {
  setTouchMode: ReturnType<typeof vi.fn>;
  setPadFire: ReturnType<typeof vi.fn>;
  setPadMove: ReturnType<typeof vi.fn>;
  addPadLook: ReturnType<typeof vi.fn>;
};

function render(enabled = true) {
  act(() => root.render(<TouchControls game={game as unknown as Game} accent="#8fdbe1" enabled={enabled} />));
}
function surface(selector: string) {
  const found = container.querySelector<HTMLElement>(selector);
  if (!found) throw new Error(`Missing ${selector}`);
  return found;
}
function pointer(target: HTMLElement, type: string, id: number, x = 240, y = 200) {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
  Object.defineProperty(event, 'pointerId', { value: id });
  act(() => target.dispatchEvent(event));
}
function advance(ms: number) {
  act(() => vi.advanceTimersByTime(ms));
}

beforeEach(() => {
  vi.useFakeTimers();
  game = { setTouchMode: vi.fn(), setPadFire: vi.fn(), setPadMove: vi.fn(), addPadLook: vi.fn() };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  render();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('touch movement and weapon gestures', () => {
  it('lets a drag aim without firing and keeps the movement stick independent', () => {
    const look = surface('.touch-look');
    const stick = surface('.touch-stick');
    pointer(look, 'pointerdown', 1);
    pointer(look, 'pointermove', 1, 270, 210);
    advance(400);
    pointer(look, 'pointerup', 1, 270, 210);
    expect(game.addPadLook).toHaveBeenCalledWith(30, 10);
    expect(game.setPadFire.mock.calls.some(([p, s]) => p || s)).toBe(false);

    pointer(stick, 'pointerdown', 2, 60, 300);
    pointer(stick, 'pointermove', 2, 60, 238);
    expect(game.setPadMove).toHaveBeenLastCalledWith(0, 1);
    pointer(stick, 'pointerup', 2, 60, 238);
    expect(game.setPadMove).toHaveBeenLastCalledWith(0, 0);
  });

  it('makes a brief primary tap last long enough to register a shot', () => {
    const look = surface('.touch-look');
    pointer(look, 'pointerdown', 1);
    pointer(look, 'pointerup', 1);
    expect(game.setPadFire).toHaveBeenLastCalledWith(true, false);
    advance(119);
    expect(game.setPadFire).toHaveBeenLastCalledWith(true, false);
    advance(1);
    expect(game.setPadFire).toHaveBeenLastCalledWith(false, false);
  });

  it('fires primary on hold and allows aiming while held', () => {
    const look = surface('.touch-look');
    pointer(look, 'pointerdown', 1);
    advance(199);
    expect(game.setPadFire.mock.calls.some(([p]) => p)).toBe(false);
    advance(1);
    expect(game.setPadFire).toHaveBeenLastCalledWith(true, false);
    pointer(look, 'pointermove', 1, 275, 220);
    expect(game.addPadLook).toHaveBeenLastCalledWith(35, 20);
    expect(game.setPadFire).toHaveBeenLastCalledWith(true, false);
    advance(120);
    pointer(look, 'pointerup', 1, 275, 220);
    expect(game.setPadFire).toHaveBeenLastCalledWith(false, false);
  });

  it('fires secondary alone with two quick fingers, and can still aim', () => {
    const look = surface('.touch-look');
    pointer(look, 'pointerdown', 1);
    pointer(look, 'pointerdown', 2, 275, 230);
    expect(game.setPadFire).toHaveBeenLastCalledWith(false, true);
    pointer(look, 'pointermove', 1, 280, 220);
    advance(300);
    expect(game.addPadLook).toHaveBeenLastCalledWith(40, 20);
    expect(game.setPadFire.mock.calls.some(([p]) => p)).toBe(false);
    pointer(look, 'pointerup', 2, 275, 230);
    expect(game.setPadFire).toHaveBeenLastCalledWith(false, false);
    pointer(look, 'pointerup', 1, 280, 220);
    expect(game.setPadFire.mock.calls.some(([p]) => p)).toBe(false);
  });

  it('can fire both together and release each independently', () => {
    const look = surface('.touch-look');
    pointer(look, 'pointerdown', 1);
    advance(200);
    pointer(look, 'pointerdown', 2, 275, 230);
    expect(game.setPadFire).toHaveBeenLastCalledWith(true, true);
    advance(120);
    pointer(look, 'pointerup', 2, 275, 230);
    expect(game.setPadFire).toHaveBeenLastCalledWith(true, false);
    pointer(look, 'pointerup', 1);
    expect(game.setPadFire).toHaveBeenLastCalledWith(false, false);
  });

  it('cancels pending holds, taps, and movement on blur or pointer cancellation', () => {
    let look = surface('.touch-look');
    pointer(look, 'pointerdown', 1);
    advance(100);
    pointer(look, 'pointercancel', 1);
    advance(300);
    expect(game.setPadFire.mock.calls.some(([p, s]) => p || s)).toBe(false);

    look = surface('.touch-look');
    pointer(look, 'pointerdown', 2);
    pointer(look, 'pointerup', 2);
    expect(game.setPadFire).toHaveBeenLastCalledWith(true, false);
    act(() => window.dispatchEvent(new Event('blur')));
    expect(game.setPadFire).toHaveBeenLastCalledWith(false, false);
    expect(game.setPadMove).toHaveBeenLastCalledWith(0, 0);
    advance(300);
    expect(game.setPadFire).toHaveBeenLastCalledWith(false, false);
  });

  it('releases touch input during an upgrade without turning touch mode off', () => {
    const look = surface('.touch-look');
    const stick = surface('.touch-stick');
    pointer(look, 'pointerdown', 1);
    pointer(stick, 'pointerdown', 2, 60, 300);
    pointer(stick, 'pointermove', 2, 60, 238);
    advance(200);
    expect(game.setPadFire).toHaveBeenLastCalledWith(true, false);
    render(false);
    expect(game.setPadFire).toHaveBeenLastCalledWith(false, false);
    expect(game.setPadMove).toHaveBeenLastCalledWith(0, 0);
    expect(game.setTouchMode).not.toHaveBeenCalledWith(false);
    advance(500);
    render(true);
    expect(container.querySelector('.touch-look')).not.toBeNull();
    expect(game.setPadFire).toHaveBeenLastCalledWith(false, false);
  });
});
