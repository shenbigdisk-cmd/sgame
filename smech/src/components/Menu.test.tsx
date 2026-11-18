import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import Menu from './Menu';
import { STARTER_EQUIPPED } from '../game/forge';
import { buildNewMech, DEFAULT_GARAGE, loadGarage, selectMech } from '../game/garage';
import { DEFAULT_SETTINGS } from '../game/settings';

beforeAll(() => {
  // @ts-expect-error React act environment flag
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

describe('hangar chassis selection', () => {
  it('shows a built and reloaded custom mech by its name, then the factory name when selected', async () => {
    const built = buildNewMech(
      { ...DEFAULT_GARAGE, credits: 10_000 },
      'VOLT RANGER',
      { ...STARTER_EQUIPPED, primary: 'p_coil_rail', secondary: 's_emp', drive: 'd_atlas' },
    );
    expect(built.ok).toBe(true);
    const restored = loadGarage();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const render = (garage: typeof restored) => root.render(
      <Menu garage={garage} onGarage={vi.fn()} onStart={vi.fn()}
        settings={DEFAULT_SETTINGS} onSettings={vi.fn()} records={[]} />,
    );

    await act(async () => render(restored));
    expect(container.querySelector('.op-hero h1')?.textContent).toBe('VOLT RANGER');
    expect(container.querySelector('.op-hero h1')?.getAttribute('title')).toBe('VOLT RANGER');
    expect(container.querySelector('.op-cards')?.classList.contains('has-overflow')).toBe(true);
    expect(container.querySelector('.op-cards')?.getAttribute('tabindex')).toBe('0');
    expect(container.querySelector('.op-more-chassis')?.textContent).toContain('Scroll');
    expect(container.querySelector('.op-sockets')?.textContent).toContain('RAIL COIL');
    expect(container.querySelector('.op-sockets')?.textContent).toContain('225 m max');
    expect(container.querySelector('.op-sockets')?.textContent).toContain('VOLT EMP DISRUPTOR');
    expect(container.querySelector('.op-sockets')?.textContent).toContain('110 m max');

    await act(async () => render(selectMech(restored, 'prebuilt:pyre')));
    expect(container.querySelector('.op-hero h1')?.textContent).toBe('PYRE-12');
    await act(async () => root.unmount());
    container.remove();
  });
});
