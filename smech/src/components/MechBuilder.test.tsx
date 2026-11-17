import { describe, it, expect, vi, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import MechBuilder from './MechBuilder';
import { DEFAULT_GARAGE, type GarageState } from '../game/garage';
import { STARTER_COMPONENTS, STARTER_EQUIPPED } from '../game/forge';

beforeAll(() => {
  // @ts-expect-error React act environment flag
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

describe('MechBuilder Component', () => {
  const mockGarage: GarageState = {
    ...DEFAULT_GARAGE,
    credits: 5000,
    owned: [...STARTER_COMPONENTS],
    equipped: { ...STARTER_EQUIPPED },
  };

  it('renders system slots on the left and components on the right', async () => {
    const onBuild = vi.fn();
    const onCancel = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MechBuilder
          garage={mockGarage}
          onBuild={onBuild}
          onCancel={onCancel}
          accent="#8fdbe1"
        />
      );
    });

    expect(container.textContent).toContain('BUILD NEW MECH');
    expect(container.textContent).toContain('SYSTEM SLOTS');
    expect(container.textContent).toContain('FRAME');
    expect(container.textContent).toContain('PRIMARY');
    expect(container.textContent).toContain('5,000 CR');
  });

  it('allows switching slots and mounts selected component', async () => {
    const onBuild = vi.fn();
    const onCancel = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MechBuilder
          garage={mockGarage}
          onBuild={onBuild}
          onCancel={onCancel}
          accent="#8fdbe1"
        />
      );
    });

    // Find and click PRIMARY slot item
    const slotBtns = container.querySelectorAll('.builder-slot-item');
    const primaryBtn = Array.from(slotBtns).find((b) => b.textContent?.includes('PRIMARY'));
    expect(primaryBtn).toBeDefined();

    await act(async () => {
      primaryBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Should display components for primary
    expect(container.textContent).toContain('AVAILABLE COMPONENTS: PRIMARY');

    // Click on a component card
    const compCards = container.querySelectorAll('.builder-comp-card');
    expect(compCards.length).toBeGreaterThan(0);
    await act(async () => {
      compCards[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Build button should exist
    const buildBtn = container.querySelector('.builder-build-btn') as HTMLButtonElement;
    expect(buildBtn).not.toBeNull();
  });

  it('calls onCancel when Cancel button is clicked', async () => {
    const onBuild = vi.fn();
    const onCancel = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MechBuilder
          garage={mockGarage}
          onBuild={onBuild}
          onCancel={onCancel}
          accent="#8fdbe1"
        />
      );
    });

    const cancelBtn = container.querySelector('.builder-cancel-btn') as HTMLButtonElement;
    expect(cancelBtn).not.toBeNull();
    await act(async () => {
      cancelBtn.click();
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onBuild and creates custom mech when Build Mech is clicked', async () => {
    const onBuild = vi.fn();
    const onCancel = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MechBuilder
          garage={mockGarage}
          onBuild={onBuild}
          onCancel={onCancel}
          accent="#8fdbe1"
        />
      );
    });

    const buildBtn = container.querySelector('.builder-build-btn') as HTMLButtonElement;
    expect(buildBtn).not.toBeNull();
    await act(async () => {
      buildBtn.click();
    });

    expect(onBuild).toHaveBeenCalledTimes(1);
    const updatedGarage: GarageState = onBuild.mock.calls[0][0];
    expect(updatedGarage.customMechs.length).toBe(1);
    expect(updatedGarage.credits).toBeLessThan(mockGarage.credits);
  });
});
