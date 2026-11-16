import type { CSSProperties, ReactElement } from 'react';

/** Small inline SVG icon set so the HUD never depends on emoji fonts. */
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export const ICONS: Record<string, ReactElement> = {
  missile: (
    <g {...P}>
      <path d="M12 2c3 3 4 7 4 11l-4 4-4-4c0-4 1-8 4-11z" />
      <path d="M8 13l-3 3 1 3 3-2M16 13l3 3-1 3-3-2" />
      <circle cx="12" cy="10" r="1.4" />
    </g>
  ),
  shield: (
    <g {...P}>
      <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z" />
      <path d="M12 7v9M8.5 11.5h7" />
    </g>
  ),
  strike: (
    <g {...P}>
      <path d="M19 4l-7 9M14 4l-3 4M20 9l-3 3" />
      <circle cx="9" cy="16" r="4" />
      <path d="M9 12v8M5 16h8" />
    </g>
  ),
  armor: (
    <g {...P}>
      <rect x="3" y="5" width="18" height="5" rx="1" />
      <rect x="3" y="14" width="18" height="5" rx="1" />
      <path d="M8 5v5M14 5v5M11 14v5M17 14v5" />
    </g>
  ),
  regen: (
    <g {...P}>
      <path d="M12 21s-7-4.5-7-11a4 4 0 017-2.5A4 4 0 0119 10c0 6.5-7 11-7 11z" />
      <path d="M12 8v6M9 11h6" />
    </g>
  ),
  rock: (
    <g {...P}>
      <path d="M4 18l3-9 5-3 6 4 2 8z" />
      <path d="M7 9l5 9M12 6l-1 12" />
    </g>
  ),
  gear: (
    <g {...P}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
    </g>
  ),
  wrench: (
    <g {...P}>
      <path d="M14 3a5 5 0 00-4.5 7L3 16.5 7.5 21l6.5-6.5A5 5 0 0021 10l-3 1-2-2 1-3z" />
    </g>
  ),
  magnet: (
    <g {...P}>
      <path d="M6 3v9a6 6 0 0012 0V3" />
      <path d="M6 3h4v9M14 3h4v9M9 12a3 3 0 006 0" />
    </g>
  ),
  blood: (
    <g {...P}>
      <path d="M12 3s6 7 6 11a6 6 0 01-12 0c0-4 6-11 6-11z" />
      <path d="M9 14a3 3 0 003 3" />
    </g>
  ),
  reload: (
    <g {...P}>
      <path d="M20 12a8 8 0 11-2.3-5.7" />
      <path d="M20 4v5h-5" />
    </g>
  ),
  blast: (
    <g {...P}>
      <path d="M12 3l2 5 5-2-2 5 4 3-5 1 1 5-5-3-5 3 1-5-5-1 4-3-2-5 5 2z" />
    </g>
  ),
  target: (
    <g {...P}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    </g>
  ),
  snow: (
    <g {...P}>
      <path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19" />
    </g>
  ),
  bolt: (
    <g {...P}>
      <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
    </g>
  ),
  radar: (
    <g {...P}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 12l6-6" />
    </g>
  ),
  clock: (
    <g {...P}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </g>
  ),
  battery: (
    <g {...P}>
      <rect x="3" y="7" width="16" height="10" rx="1.5" />
      <path d="M19 10h2v4h-2M6 10v4M9.5 10v4M13 10v4" />
    </g>
  ),
  radio: (
    <g {...P}>
      <rect x="3" y="9" width="18" height="11" rx="2" />
      <path d="M7 9l10-5M8 15h3M15 15h.01" />
    </g>
  ),
  coin: (
    <g {...P}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v10M9.5 9.5h3.5a1.75 1.75 0 010 3.5H11a1.75 1.75 0 000 3.5h3.5" />
    </g>
  ),
  lock: (
    <g {...P}>
      <rect x="5" y="11" width="14" height="10" rx="1.5" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </g>
  ),
  autocannon: (
    <g {...P}>
      <rect x="4" y="9" width="16" height="6" rx="1" />
      <path d="M6 9V5M12 9V4M18 9V5" />
      <circle cx="12" cy="12" r="1" />
    </g>
  ),
  cannon: (
    <g {...P}>
      <rect x="10" y="3" width="4" height="14" rx="1" />
      <rect x="7" y="17" width="10" height="4" rx="1" />
    </g>
  ),
  scatter: (
    <g {...P}>
      <path d="M12 21V10M7 20L10 10M17 20L14 10" />
      <circle cx="12" cy="7" r="2" />
      <circle cx="7" cy="8" r="1.4" />
      <circle cx="17" cy="8" r="1.4" />
    </g>
  ),
  coil: (
    <g {...P}>
      <ellipse cx="12" cy="6" rx="5" ry="2" />
      <ellipse cx="12" cy="12" rx="5" ry="2" />
      <ellipse cx="12" cy="18" rx="5" ry="2" />
      <path d="M12 4v16" />
    </g>
  ),
  flame: (
    <g {...P}>
      <path d="M12 2c3 4 6 7 6 11a6 6 0 01-12 0c0-2 1-3.5 2-5 .5 1.2 1.2 2 2 2.5C10.5 7 11 4 12 2z" />
      <path d="M12 22a3.5 3.5 0 01-3.5-3.5c0-1.5 1-2.5 3.5-5 2.5 2.5 3.5 3.5 3.5 5A3.5 3.5 0 0112 22z" />
    </g>
  ),
  cryo: (
    <g {...P}>
      <path d="M12 2v20M4 6l16 12M20 6L4 18" />
      <path d="M12 2l-2 2M12 2l2 2M12 22l-2-2M12 22l2-2" />
      <circle cx="12" cy="12" r="1.6" />
    </g>
  ),
  turret: (
    <g {...P}>
      <path d="M5 21l2-7h10l2 7z" />
      <path d="M12 14V5" />
      <rect x="10.5" y="3" width="3" height="3" />
    </g>
  ),
  mortar: (
    <g {...P}>
      <path d="M9 3l6 2-4 12-6-2z" />
      <path d="M4 19h16" />
      <circle cx="17" cy="5" r="1.4" />
    </g>
  ),
  overdrive: (
    <g {...P}>
      <path d="M5 14a7 7 0 0114 0" />
      <path d="M12 14l4-5" />
      <circle cx="12" cy="14" r="1.4" />
      <path d="M3 18h18" />
    </g>
  ),
  nova: (
    <g {...P}>
      <circle cx="12" cy="12" r="2" />
      <path d="M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3" />
    </g>
  ),
  cryoball: (
    <g {...P}>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 5l2 3-2 3-2-3zM7 9l3 1 1 3-3-1zM17 9l-3 1-1 3 3-1zM9 16l3-2 3 2" />
    </g>
  ),
  jump: (
    <g {...P}>
      <path d="M12 20V5M7 10l5-5 5 5" />
      <path d="M4 20h16" />
      <path d="M6 16l-2 2M18 16l2 2" />
    </g>
  ),
  mines: (
    <g {...P}>
      <circle cx="12" cy="15" r="5" />
      <path d="M12 10V7M8 12l-2-2M16 12l2-2M12 7V3" />
      <circle cx="12" cy="3" r="1" />
    </g>
  ),
  smoke: (
    <g {...P}>
      <path d="M4 17a3 3 0 011-5.8A4.5 4.5 0 0113 8a3.5 3.5 0 015.8 3.8A3 3 0 0118 17z" />
      <path d="M7 21h10M9 19h6" />
    </g>
  ),
  skull: (
    <g {...P}>
      <path d="M12 3a8 8 0 00-8 8c0 3 2 5 4 6v3h8v-3c2-1 4-3 4-6a8 8 0 00-8-8z" />
      <circle cx="9" cy="11" r="1.4" />
      <circle cx="15" cy="11" r="1.4" />
      <path d="M11 16h2" />
    </g>
  ),
};

/** Map of upgrade icon keys (used in upgrades.ts) to SVG names. */
export function Icon({ name, size = 20, className, style }: { name: string; size?: number; className?: string; style?: CSSProperties }) {
  const body = ICONS[name] ?? ICONS.gear;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} aria-hidden>
      {body}
    </svg>
  );
}
