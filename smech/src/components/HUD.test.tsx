import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { SIGHT_RADIUS, SIGHT_SIZE, sightSlope } from '../game/aimRing';
import { DEFAULT_SETTINGS } from '../game/settings';
import type { HudState, HudWeapon } from '../game/types';
import HUD from './HUD';

const state: HudState = {
  driveBlocked: false,
  lootCredits: 0,
  hp: 60,
  maxHp: 120,
  shield: 10,
  shieldMax: 40,
  shieldActive: true,
  shieldStatus: 'online',
  shieldDelay: 0,
  mgHeat: 0,
  mgOverheat: false,
  priName: '',
  priReady: 1,
  priIsHeat: false,
  priHeat: 0,
  priOverheat: false,
  secName: '',
  secReady: 1,
  secIsHeat: false,
  secHeat: 0,
  secOverheat: false,
  score: 0,
  kills: 0,
  wave: 1,
  enemiesLeft: 4,
  turretYaw: 0,
  hullYaw: 0,
  pitch: 0,
  speed: 0,
  maxSpeed: 1,
  blips: [],
  message: '',
  messageAge: 10,
  feed: [],
  hitMarkerAge: 10,
  critAge: 10,
  floaters: [],
  damageFlash: 0,
  damageDirs: [],
  waveCountdown: 0,
  power: 0,
  powerMax: 1,
  powerOutput: 0,
  powerDraw: 0,
  victoryCountdown: 0,
  salvageWindow: false,
  alive: true,
  time: 0,
  zoom: false,
  aimedEnemy: false,
  vehicleName: 'Warden',
  controls: 'arcade',
  autoAlign: false,
  lean: 0,
  weapons: [],
  offer: null,
  perks: [],
  strikeInbound: 0,
  lockWarning: 0,
  streak: 0,
  streakAge: 10,
  detected: 0,
  seenBy: 0,
  ambushAge: 10,
  inWater: false,
  concealed: false,
  buffs: [],
  drops: [],
  overchargeCount: 0,
  district: 'Test',
  seed: 'TEST',
  themeName: 'Test',
  condition: '',
  zone: 1,
  maxZone: 1,
  arenaRadius: 100,
  expandIn: 0,
  waveTag: '',
  musicOn: false,
  expandAge: 10,
  fps: 60,
};

function renderHud(changes: Partial<HudState> = {}, crosshair = true, touch = false) {
  const container = document.createElement('div');
  container.innerHTML = renderToStaticMarkup(
    <HUD
      hud={{ ...state, ...changes }}
      vehicle="warden"
      touch={touch}
      settings={{ ...DEFAULT_SETTINGS, crosshair }}
    />,
  );
  return container;
}

beforeAll(() => {
  // @ts-expect-error React act environment flag
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

const weapons: HudWeapon[] = [
  {
    id: 'autocannon',
    name: 'ROTARY AUTOCANNONS',
    short: 'AUTOCANNONS',
    key: 'LMB',
    owned: true,
    ready: 1,
    active: 0,
    detail: '',
    upgradeCount: 0,
    upgrades: [],
    evolved: false,
  },
  {
    id: 'cannon',
    name: 'TWIN CANNONS',
    short: 'CANNONS',
    key: 'RMB',
    owned: true,
    ready: 1,
    active: 0,
    detail: '',
    upgradeCount: 0,
    upgrades: [],
    evolved: false,
  },
  {
    id: 'missiles',
    name: 'HOMING MISSILES',
    short: 'MISSILE POD',
    key: 'Q',
    owned: true,
    ready: 1,
    active: 0,
    detail: '',
    upgradeCount: 0,
    upgrades: [],
    evolved: false,
    charges: 5,
    capacity: 5,
    cost: 20,
  },
  {
    id: 'turret',
    name: 'SENTRY TURRET',
    short: 'SENTRY',
    key: 'E',
    owned: true,
    ready: 1,
    active: 0,
    detail: '',
    upgradeCount: 0,
    upgrades: [],
    evolved: false,
    charges: 3,
    capacity: 3,
    cost: 30,
  },
];

function meter(container: HTMLElement, label: string) {
  const element = container.querySelector<HTMLElement>(`.cp-meter[aria-label="${label}"]`);
  if (!element) throw new Error(`Missing ${label} bar`);
  return element;
}

function fillWidth(element: HTMLElement) {
  // Read the serialized style: jsdom does not parse the combined shadow and transition reliably.
  const style = element.querySelector('.h-full')?.getAttribute('style') ?? '';
  return /(?:^|;)\s*width:\s*([^;]+)/.exec(style)?.[1];
}

describe('cockpit sight', () => {
  it('shows a clear ring that changes colour on an enemy without adding target text', () => {
    const open = renderHud();
    const sight = open.querySelector('.cp-reticle');
    const ring = sight?.querySelector('.cp-reticle-ring');
    expect(sight?.getAttribute('aria-label')).toBe('Open sight');
    expect(sight?.getAttribute('width')).toBe(String(SIGHT_SIZE));
    expect(ring?.getAttribute('r')).toBe('11');
    expect(ring?.getAttribute('stroke')).toBe('#a9eaf0');
    expect(sight?.querySelector('text')).toBeNull();
    expect(sight?.textContent).toBe('');
    expect(SIGHT_RADIUS).toBeCloseTo((SIGHT_SIZE * 11) / 48);
    expect(sightSlope(70, 720)).toBeCloseTo((2 * SIGHT_RADIUS * Math.tan((70 * Math.PI) / 360)) / 720);

    const targeted = renderHud({ aimedEnemy: true }).querySelector('.cp-reticle');
    expect(targeted?.getAttribute('aria-label')).toBe('Enemy in sight');
    expect(targeted?.querySelector('.cp-reticle-ring')?.getAttribute('stroke')).toBe('#ff4b60');
    expect(targeted?.querySelector('.cp-reticle-ring')?.getAttribute('stroke-dasharray')).toBeNull();
    expect(targeted?.textContent).toBe('');
  });

  it('respects the sight setting and keeps the scope independent', () => {
    const container = renderHud({ zoom: true }, false);
    expect(container.querySelector('.cp-reticle')).toBeNull();
    expect(container.querySelector('.cp-scope')).not.toBeNull();
  });
});

describe('cockpit health and shield bars', () => {
  it('renders two labeled bars with their actual current values', () => {
    const container = renderHud();
    const hull = meter(container, 'Hull');
    const shield = meter(container, 'Shield');
    expect(container.querySelectorAll('.cp-meter')).toHaveLength(2);
    expect(container.querySelector('.flight-dial')).toBeNull();
    expect(container.querySelector('.flight-radar svg')).not.toBeNull();
    expect(hull.getAttribute('role')).toBe('progressbar');
    expect(hull.getAttribute('aria-valuenow')).toBe('60');
    expect(hull.getAttribute('aria-valuemax')).toBe('120');
    expect(hull.querySelector('b')?.textContent).toBe('60');
    expect(fillWidth(hull)).toBe('50%');
    expect(shield.getAttribute('aria-valuenow')).toBe('10');
    expect(shield.querySelector('b')?.textContent).toBe('10');
    expect(fillWidth(shield)).toBe('25%');
  });

  it('keeps the shield bar visible through its restart and recharge', () => {
    const waiting = meter(renderHud({ shield: 0, shieldActive: false, shieldDelay: 2.2 }), 'Shield');
    expect(waiting.querySelector('b')?.textContent).toBe('3s');
    expect(waiting.getAttribute('aria-valuetext')).toContain('recharge starts in 3 seconds');
    expect(fillWidth(waiting)).toBe('0%');

    const recharging = meter(renderHud({ shield: 20, shieldActive: false, shieldDelay: 0 }), 'Shield');
    expect(recharging.querySelector('b')?.textContent).toBe('20');
    expect(recharging.getAttribute('aria-valuetext')).toContain('restarting');
    expect(fillWidth(recharging)).toBe('50%');

    const restored = meter(renderHud({ shield: 40, shieldActive: true, shieldDelay: 0 }), 'Shield');
    expect(restored.querySelector('b')?.textContent).toBe('40');
    expect(fillWidth(restored)).toBe('100%');
  });
});

describe('upgrade and status feedback', () => {
  it('puts the actual upgrade count on the matching special even while cooling or empty', () => {
    const upgraded: HudWeapon = {
      ...weapons[3], ready: 0, charges: 0, evolved: true, upgradeCount: 3,
      upgrades: [
        { name: 'SENTRY PROTOCOLS', rank: 2, evolution: false },
        { name: 'ARC SENTRY', rank: 1, evolution: true },
      ],
    };
    const container = renderHud({ weapons: [...weapons.slice(0, 3), upgraded] });
    const [missiles, turret] = container.querySelectorAll<HTMLButtonElement>('.cp-special');
    expect(missiles.querySelector('.cp-upgrade-badge')).toBeNull();
    expect(turret.querySelector('.cp-upgrade-badge')?.textContent).toBe('+3');
    expect(turret.classList.contains('is-evolved')).toBe(true);
    expect(turret.getAttribute('aria-label')).toContain('3 upgrades, evolved');
    expect(turret.getAttribute('title')).toContain('SENTRY PROTOCOLS ×2');
    expect(turret.getAttribute('title')).toContain('ARC SENTRY (evolution)');
    expect(turret.querySelector('.cp-special-face')?.textContent).toBe('REARM');
  });

  it('adds compact primary and secondary icons only when those weapons have upgrades', () => {
    const container = renderHud({ weapons: [
      { ...weapons[0], upgradeCount: 2, upgrades: [{ name: 'AP ROUNDS', rank: 2, evolution: false }] },
      weapons[1],
      weapons[2],
      weapons[3],
    ] });
    const badges = container.querySelectorAll('.cp-main-weapon');
    expect(badges).toHaveLength(1);
    expect(badges[0].querySelector('svg')).not.toBeNull();
    expect(badges[0].querySelector('b')?.textContent).toBe('+2');
    expect(badges[0].getAttribute('aria-label')).toContain('Primary ROTARY AUTOCANNONS, 2 upgrades');
    expect(container.querySelectorAll('.cp-weapons button')).toHaveLength(2);
    expect(renderHud({ weapons }).querySelector('.cp-main-upgrades')).toBeNull();

    const manyRanks = renderHud({ weapons: [
      { ...weapons[0], upgradeCount: 21, upgrades: [{ name: 'UPGRADES', rank: 21, evolution: false }] },
      { ...weapons[1], upgradeCount: 12, upgrades: [{ name: 'UPGRADES', rank: 12, evolution: false }] },
      weapons[2], weapons[3],
    ] });
    expect([...manyRanks.querySelectorAll('.cp-main-weapon b')].map((badge) => badge.textContent)).toEqual(['+21', '+12']);
  });

  it('renders every status and its countdown without equating undetected with smoke cover', () => {
    const buffs = [
      { id: 'veiled', name: 'VEILED IN SMOKE', icon: 'smoke', time: 5.2, max: 6 },
      { id: 'aegis', name: 'INVULNERABLE', icon: 'shield', time: 3, max: 6 },
      { id: 'overcharge', name: 'FIREPOWER +35%', icon: 'bolt', time: 24, max: 25 },
      { id: 'rapid', name: 'RAPID RELOAD', icon: 'clock', time: 12, max: 25 },
      { id: 'haste', name: 'KILLSTREAK SURGE', icon: 'gear', time: 7, max: 8 },
      { id: 'overdrive', name: 'OVERDRIVE', icon: 'overdrive', time: 15, max: 16 },
      { id: 'smoke', name: 'VEIL SPRINT', icon: 'smoke', time: 2, max: 4.5 },
    ];
    const covered = renderHud({ concealed: true, buffs }, true, true);
    expect(covered.querySelector('.cp-veil-effect')).not.toBeNull();
    expect(covered.querySelectorAll('.cp-buff')).toHaveLength(7);
    expect(covered.querySelector('.cp-buff-veiled b')?.textContent).toBe('6s');
    expect(covered.querySelector('.cp-buff-veiled')?.getAttribute('aria-label')).toContain('while inside');
    expect(covered.querySelector('.cp-buff-veiled')?.getAttribute('aria-label')).toContain('heavy fire can penetrate');
    expect(covered.querySelector('.cp-buff-smoke b')?.textContent).toBe('2s');
    expect(covered.querySelector('.cp-buff-overdrive .cp-buff-progress')?.getAttribute('style')).toContain('93.75%');
    expect(covered.querySelector('.cp-reticle')?.textContent).toBe('');
    const open = renderHud({ detected: 0, seenBy: 0, buffs: [buffs[6]] });
    expect(open.querySelector('.cp-veil-effect')).toBeNull();
    expect(open.querySelector('.cp-buff-veiled')).toBeNull();
    expect(open.querySelector('.flight-contact')?.textContent).toContain('Undetected');
    expect(open.querySelector('.flight-contact')?.textContent).not.toContain('Concealed');
  });
});

describe('floating combat readouts', () => {
  it('renders damage, crit and score floaters projected onto the cockpit', () => {
    const container = renderHud({
      floaters: [
        { id: 1, x: 0.5, y: 0.42, text: '42', kind: 'hit', age: 0, maxAge: 0.9 },
        { id: 2, x: 0.58, y: 0.38, text: '135', kind: 'crit', age: 0.2, maxAge: 1.15 },
        { id: 3, x: 0.44, y: 0.5, text: '+250 ×3', kind: 'score', age: 0.1, maxAge: 1.5 },
      ],
    });
    const floaters = [...container.querySelectorAll('.cp-floater')];
    expect(floaters).toHaveLength(3);
    expect(floaters.map((f) => f.textContent)).toEqual(['42', '135', '+250 ×3']);
    expect(container.querySelector('.cp-floater--hit')?.getAttribute('style')).toContain('left:50%');
    expect(container.querySelector('.cp-floater--crit')).not.toBeNull();
    expect(container.querySelector('.cp-floater--score')).not.toBeNull();
  });

  it('fades a floater out as it reaches the end of its lifetime', () => {
    const container = renderHud({
      floaters: [{ id: 1, x: 0.5, y: 0.5, text: '12', kind: 'hit', age: 0.85, maxAge: 0.9 }],
    });
    const style = container.querySelector('.cp-floater')?.getAttribute('style') ?? '';
    const opacity = Number(/opacity:\s*([\d.]+)/.exec(style)?.[1] ?? '1');
    expect(opacity).toBeLessThan(0.2);
  });
});

describe('floating radar and additional weapons', () => {
  it('names the correct inbound strike without adding text to the sight', () => {
    const orbital = renderHud({ strikeInbound: 1.7, strikeKind: 'orbital' });
    expect(orbital.querySelector('.cp-notice')?.textContent).toContain('Skyfall inbound · 1.7s');
    expect(orbital.querySelector('.cp-reticle')?.textContent).toBe('');
    const mortar = renderHud({ strikeInbound: 2.4, strikeKind: 'mortar' });
    expect(mortar.querySelector('.cp-notice')?.textContent).toContain('Artillery inbound · 2.4s');
  });

  it('shows only the two special controls, with distinct icons and charge counts', () => {
    const container = renderHud({ weapons });
    const buttons = container.querySelectorAll<HTMLButtonElement>('.cp-weapons button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0].getAttribute('aria-label')).toContain('Q HOMING MISSILES: Ready, 5 of 5 charges');
    expect(buttons[1].getAttribute('aria-label')).toContain('E SENTRY TURRET: Ready, 3 of 3 charges');
    expect(buttons[0].querySelector('.cp-special-face svg')).not.toBeNull();
    expect(buttons[1].querySelector('.cp-special-face svg')).not.toBeNull();
    expect(buttons[0].querySelector('.cp-special-count')?.textContent).toBe('5/5');
    expect(buttons[0].querySelector('.cp-special-progress')?.getAttribute('stroke-dasharray')).toBe(
      '100 100',
    );
    expect(container.querySelector('.cp-weapons')?.textContent).not.toContain('AUTOCANNONS');
    expect(container.querySelector('.cp-weapons')?.textContent).not.toContain('CANNONS');
    expect(container.querySelector('.flight-radar svg')?.getAttribute('viewBox')).toBe('0 0 128 128');
  });

  it('communicates cooldown, low power, empty racks and unequipped sockets', () => {
    const cooling = renderHud({
      weapons: [
        ...weapons.slice(0, 2),
        { ...weapons[2], ready: 0.5, charges: 2, cooldownLeft: 3.1 },
        { ...weapons[3], ready: 0, charges: 0 },
      ],
    });
    const [q, e] = cooling.querySelectorAll<HTMLButtonElement>('.cp-special');
    expect(q.disabled).toBe(true);
    expect(q.getAttribute('aria-label')).toContain('Cooldown 4 seconds, 2 of 5 charges');
    expect(q.querySelector('.cp-special-face svg')).not.toBeNull();
    expect(q.querySelector('.cp-special-count')?.textContent).toBe('2/5');
    expect(q.querySelector('.cp-special-progress')?.getAttribute('stroke-dasharray')).toBe('50 100');
    expect(e.disabled).toBe(true);
    expect(e.getAttribute('aria-label')).toContain('Rearm required');
    expect(e.querySelector('.cp-special-face')?.textContent).toBe('REARM');
    expect(e.querySelector('.cp-special-count')?.textContent).toBe('0/3');

    const charging = renderHud({
      weapons: [...weapons.slice(0, 2), { ...weapons[2], ready: 0.8, underpowered: true }],
    });
    const [powered, empty] = charging.querySelectorAll<HTMLButtonElement>('.cp-special');
    expect(powered.disabled).toBe(true);
    expect(powered.getAttribute('aria-label')).toContain('Charging');
    expect(powered.querySelector('.cp-special-face')?.textContent).toBe('PWR');
    expect(empty.disabled).toBe(true);
    expect(empty.getAttribute('aria-label')).toContain('empty socket');
    expect(empty.classList.contains('is-empty')).toBe(true);
  });

  it('activates only ready specials and keeps scope separate on touch', () => {
    const onWeapon = vi.fn();
    const onZoom = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <HUD
          hud={{ ...state, weapons: [...weapons.slice(0, 3), { ...weapons[3], ready: 0, charges: 0 }] }}
          vehicle="warden"
          touch
          onWeapon={onWeapon}
          onZoom={onZoom}
        />,
      ),
    );
    const [q, e] = container.querySelectorAll<HTMLButtonElement>('.cp-special');
    act(() => {
      q.click();
      e.click();
      (container.querySelector('.cp-zoom') as HTMLButtonElement).click();
    });
    expect(onWeapon).toHaveBeenCalledOnce();
    expect(onWeapon).toHaveBeenCalledWith('missiles');
    expect(onZoom).toHaveBeenCalledOnce();
    expect(container.querySelector('.cp-notice')?.textContent).toContain('2 fingers alt');
    act(() => root.unmount());
    container.remove();
  });

  it('still warns when a main weapon overheats, without a primary or secondary tile', () => {
    const overheated = renderHud({ weapons, priOverheat: true });
    expect(overheated.querySelector('.cp-notice')?.textContent).toContain('Primary overheated');
    expect(overheated.querySelectorAll('.cp-special')).toHaveLength(2);
    const threatened = renderHud({ weapons, priOverheat: true, lockWarning: 1 });
    expect(threatened.querySelector('.cp-notice')?.textContent).toContain('Sniper lock');
  });
});
