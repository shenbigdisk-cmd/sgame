import { describe, it, expect, vi, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import MechBuilder from './MechBuilder';
import { DEFAULT_GARAGE, calculateBuildCost, type GarageState } from '../game/garage';
import { STARTER_COMPONENTS, STARTER_EQUIPPED, buildConfig } from '../game/forge';

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
    expect(container.querySelector<HTMLInputElement>('.builder-name-input')?.maxLength).toBe(18);
    expect(container.querySelector('[aria-pressed="true"] .builder-slot-label')?.textContent).toBe('FRAME');
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

  it('compares real reach and stability, prices EMP and stabilised legs, and builds that loadout', async () => {
    const onBuild = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<MechBuilder garage={mockGarage} onBuild={onBuild} onCancel={vi.fn()} accent="#8fdbe1" />);
    });
    const slot = async (name: string) => {
      const button = [...container.querySelectorAll<HTMLButtonElement>('.builder-slot-item')]
        .find((item) => item.querySelector('.builder-slot-label')?.textContent === name);
      expect(button).toBeDefined();
      await act(async () => button!.click());
    };
    const mount = async (name: string) => {
      const card = [...container.querySelectorAll<HTMLElement>('.builder-comp-card')]
        .find((item) => item.querySelector('.builder-comp-name')?.textContent === name);
      expect(card).toBeDefined();
      await act(async () => card!.click());
    };
    await slot('PRIMARY');
    expect(container.querySelector('[aria-pressed="true"] .builder-slot-label')?.textContent).toBe('PRIMARY');
    expect(container.querySelector('[aria-label="Equip RAIL COIL"]')).not.toBeNull();
    expect(container.textContent).toContain('MAX RANGE: 125 M');
    expect(container.textContent).toContain('MAX RANGE: 225 M');
    expect(container.textContent).toContain('STABILITY: 80%');
    await mount('RAIL COIL');
    await slot('SECONDARY');
    expect(container.textContent).toContain('VOLT EMP DISRUPTOR');
    expect(container.textContent).toContain('MAX RANGE: 110 M');
    expect(container.textContent).toContain('EMP DMG: 12');
    expect(container.textContent).toContain('4 s');
    await mount('VOLT EMP DISRUPTOR');
    await slot('DRIVE');
    expect(container.textContent).toContain('DRIVE STABILITY: +22%');
    await mount('ATLAS LEGS');
    const equipped = { ...STARTER_EQUIPPED, primary: 'p_coil_rail', secondary: 's_emp', drive: 'd_atlas' };
    const cost = calculateBuildCost(equipped);
    expect(container.querySelector('.builder-cost')?.textContent).toContain(cost.toLocaleString('en-US'));
    await act(async () => container.querySelector<HTMLButtonElement>('.builder-build-btn')!.click());
    expect(onBuild).toHaveBeenCalledOnce();
    const built = onBuild.mock.calls[0][0] as GarageState;
    expect(built.credits).toBe(mockGarage.credits - cost);
    expect(built.customMechs[0].cost).toBe(cost);
    expect(buildConfig(built.equipped)).toMatchObject({ primaryRange: 225, secondaryRange: 110, driveStability: 0.22 });
    await act(async () => root.unmount());
    container.remove();
  });

  it('swaps duplicated special weapon variants rather than charging for a different hidden weapon', async () => {
    const onBuild = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => root.render(<MechBuilder garage={mockGarage} onBuild={onBuild} onCancel={vi.fn()} accent="#8fdbe1" />));
    const q = [...container.querySelectorAll<HTMLButtonElement>('.builder-slot-item')]
      .find((item) => item.querySelector('.builder-slot-label')?.textContent === 'SPECIAL · Q')!;
    await act(async () => q.click());
    const turret = [...container.querySelectorAll<HTMLElement>('.builder-comp-card')]
      .find((item) => item.querySelector('.builder-comp-name')?.textContent === 'SENTRY TURRET')!;
    await act(async () => turret.click());
    await act(async () => container.querySelector<HTMLButtonElement>('.builder-build-btn')!.click());
    const built = onBuild.mock.calls[0][0] as GarageState;
    expect(built.equipped.specialQ).toBe('x_turret');
    expect(built.equipped.specialE).toBe('x_missiles');
    expect(buildConfig(built.equipped).loadout).toMatchObject({ abilityQ: 'turret', abilityE: 'missiles' });
    await act(async () => root.unmount());
    container.remove();
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
