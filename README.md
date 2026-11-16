# STEEL HORIZON — The Iron Colosseum

A first-person tank and mech combat simulator that runs entirely in the browser.
Take the gunner's seat of a salvage rig, drop into a procedurally generated
sector, and survive escalating waves of hostile armour while you scavenge
upgrades and weapon caches off the sand.

Built with **React 19 + TypeScript + Vite + three.js**. Everything you see is
generated at runtime: the terrain, the districts, the roads, the sky, the
mechanics, and every single sound.

---

## Quick start

```bash
cd smech
npm install
npm run dev        # http://localhost:5173
```

Production build (a single self-contained `dist/index.html`):

```bash
npm run build
npm run preview
```

Quality gates:

```bash
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run test       # vitest
npm run check      # all three
```

---

## Controls

| Input | Action |
| --- | --- |
| `Mouse` | Aim the turret / camera |
| `LMB` / `Space` | Primary weapon (autocannons, scattergun, coil repeater) |
| `RMB` / `C` | Secondary weapon (60mm cannons, flamethrower, cryo grenade) |
| `Q` / `E` | Chassis special hardpoints |
| `R` / `F` | Scavenged module hardpoints (once a weapon cache is opened) |
| `W A S D` | Drive (relative to your view in **EASY**, hull-relative in **SIM**) |
| `Z` / `MMB` | Scope |
| `M` | Music on / off |
| `Esc` | Release the mouse (pause menu) |
| `1` `2` `3` | Pick an upgrade after a wave |
| `Enter` / `N` | Call the next wave early |

On touch devices an on-screen stick, fire buttons and module buttons appear
automatically.

---

## The three chassis

| Chassis | Role | Loadout |
| --- | --- | --- |
| **WARDEN-9 "Oathkeeper"** | Balanced veteran | Rotary autocannons · 60mm cannons · Homing missiles · Sentry turret |
| **PYRE-12 "Crowd-Eater"** | Fire brawler | Scrap scattergun · Dragon's Breath · Skyfall slam · Cinder mines |
| **GLACIER-7 "The Exile"** | Cryo duelist | Coil repeater · Cryo grenade · Longbow railgun · Veil smoke |

---

## Systems

### Procedural sectors
Every seed (`ABC-123`) deterministically builds a theme (time of day, weather,
palette), a district layout with named regions, a road network, water bodies,
hills and cover. The perimeter expands every third wave, revealing new
districts and two supply pods in the newly opened ring.

### Waves
Each wave picks a tag — `SWARM`, `ARMORED PUSH`, `SNIPER NEST` or
`FLANKING AMBUSH` — and mixes four enemy chassis (raider tank, hound walker,
goliath heavy, longbow sniper) plus an elite champion. Every fifth wave a
**WARLORD** boss enters the arena. Between waves the arena is repaired, the
shield is refilled and you choose one of three rewards.

### Rewards
Upgrades roll as **STANDARD / RARE / UNIQ** and cover hull, weapon, system and
signature categories. Weapons can be **evolved** into stronger forms
(`STATIC LINK`, `CONCUSSION CORE`, `CRYO SHATTER`, …), and signature upgrades
introduce new mechanics (cluster munitions, reactive armour, overcharged
rounds, repair swarm, killstreak surge, arc discharger, bulwark field,
saturation barrage, supply network).

### Weapon caches
Supply pods can fall out of the sky carrying a **WEAPON CACHE**. Opening one
mounts a spare special weapon into the `R` / `F` hardpoints:

* **INCENDIARY MORTARS** — mark an area, then bury it under a shell storm
* **STASIS NOVA** — a freezing pulse that locks hostiles in place
* **OVERDRIVE VENT** — vent the reactor for speed, reload and a burn nova
* **CRYO LANCE** — a single devastating lance that freezes what it hits

Each of them can then be evolved and tuned with its own upgrade line.

### Feedback
Procedural audio (weapons, explosions, engines, ambience and an adaptive
score) is synthesised with the Web Audio API and spatialised with stereo pan,
distance muffling and speed-of-sound delay. The HUD tracks hull, shield,
heat, cooldowns, a radar, target telemetry, kill streaks and incoming damage
directions.

### Persistence
Cockpit settings (sensitivity, field of view, invert look, render quality,
volumes, crosshair, performance readout) and the hall-of-fame records are
stored in `localStorage`.

---

## Project layout

```
smech/
├─ index.html
├─ vite.config.ts          # single-file production build
├─ vitest.config.ts
├─ eslint.config.js
└─ src/
   ├─ App.tsx               # screen flow: hangar → arena → debrief
   ├─ components/
   │  ├─ Menu.tsx           # hangar: chassis, loadout, legend, config, hall of fame
   │  ├─ GameView.tsx       # canvas host, pause menu, loading screen
   │  ├─ HUD.tsx            # cockpit instruments, radar, crosshair, modules
   │  ├─ UpgradeScreen.tsx  # between-wave reward draft
   │  ├─ GameOver.tsx       # debrief and hall of fame
   │  ├─ SettingsPanel.tsx  # cockpit configuration
   │  ├─ TouchControls.tsx  # on-screen stick + buttons
   │  ├─ Icons.tsx          # inline SVG icon set
   │  └─ FullscreenButton.tsx
   └─ game/
      ├─ engine.ts          # simulation: player, enemies, weapons, effects
      ├─ world.ts           # façade over the world generator
      ├─ layout.ts          # seeded sector layout: theme, districts, terrain
      ├─ mapBuilder.ts      # dresses a layout into a lit, animated arena
      ├─ colliders.ts       # static obstacle grid and collision helpers
      ├─ rng.ts             # the seeded random stream behind every world
      ├─ enemyMeshes.ts     # procedural tank / walker / heavy meshes
      ├─ particles.ts       # instanced billboard particle system
      ├─ readiness.ts       # pure weapon-readiness and aim-assist maths
      ├─ vehicles.ts        # chassis + weapon catalogue
      ├─ upgrades.ts        # upgrade catalogue and reward rolling
      ├─ weaponEffects.ts   # beam / lightning visuals
      ├─ audio.ts           # procedural Web Audio engine
      ├─ settings.ts        # persisted cockpit preferences
      ├─ records.ts         # hall of fame
      └─ types.ts           # shared types
```

---

## Licence

All code and art in this repository is original to the project.
