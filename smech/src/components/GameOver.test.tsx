import { describe, it, expect, vi, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import GameOver from './GameOver';
import type { GameStats } from '../game/types';

beforeAll(() => {
  // @ts-expect-error React act environment flag
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

describe('GameOver Component', () => {
  const dummyStats: GameStats = {
    score: 5400,
    wave: 4,
    kills: 18,
    timeSurvived: 195,
    credits: 250,
    vehicle: 'warden',
    mechName: 'TITAN-9',
    zone: 2,
    seed: '7X9A',
    isBest: true,
    perks: ['AUTOCANNON', 'RAPID FIRE', 'SHIELD OVERCLOCK'],
  };

  it('renders correctly with flex layout and action buttons', async () => {
    const onRetry = vi.fn();
    const onMenu = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <GameOver stats={dummyStats} records={[]} onRetry={onRetry} onMenu={onMenu} />
      );
    });

    // Check flex layout structure classes
    const screenDiv = container.querySelector('.gameover-screen') as HTMLElement;
    expect(screenDiv).not.toBeNull();
    expect(screenDiv.className).toContain('flex');
    expect(screenDiv.className).toContain('flex-col');
    expect(screenDiv.className).toContain('overflow-hidden');

    const contentDiv = container.querySelector('.gameover-content') as HTMLElement;
    expect(contentDiv).not.toBeNull();
    expect(contentDiv.className).toContain('flex');
    expect(contentDiv.className).toContain('flex-col');
    expect(contentDiv.className).toContain('max-h-full');

    const headerDiv = container.querySelector('.gameover-header') as HTMLElement;
    expect(headerDiv).not.toBeNull();
    expect(headerDiv.className).toContain('flex-shrink-0');

    const bodyDiv = container.querySelector('.gameover-body') as HTMLElement;
    expect(bodyDiv).not.toBeNull();
    expect(bodyDiv.className).toContain('flex-1');
    expect(bodyDiv.className).toContain('min-h-0');
    expect(bodyDiv.className).toContain('overflow-y-auto');

    const actionsDiv = container.querySelector('.gameover-actions') as HTMLElement;
    expect(actionsDiv).not.toBeNull();
    expect(actionsDiv.className).toContain('flex-shrink-0');

    // Buttons check
    const buttons = Array.from(actionsDiv.querySelectorAll('button'));
    expect(buttons.length).toBe(3);

    const redeployBtn = buttons.find((b) => b.textContent?.includes('REDEPLOY'));
    const newSectorBtn = buttons.find((b) => b.textContent?.includes('NEW SECTOR'));
    const changeMechBtn = buttons.find((b) => b.textContent?.includes('CHANGE MECH'));

    expect(redeployBtn).toBeDefined();
    expect(newSectorBtn).toBeDefined();
    expect(changeMechBtn).toBeDefined();

    await act(async () => {
      redeployBtn?.click();
    });
    expect(onRetry).toHaveBeenCalledWith(false);

    await act(async () => {
      newSectorBtn?.click();
    });
    expect(onRetry).toHaveBeenCalledWith(true);

    await act(async () => {
      changeMechBtn?.click();
    });
    expect(onMenu).toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  });
});
