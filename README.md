# STEEL HORIZON — The Iron Colosseum

A first-person tank and mech combat simulator that runs entirely in the browser.
Take the gunner's seat of a salvage rig, drop into a procedurally generated
sector, and survive escalating waves of hostile armour. Credits earned in the
sand are spent in **THE FORGE**, where you buy components, strip mounts, save
named builds and watch the mech assemble on a live 3D factory floor.

Built with **React 19 + TypeScript + Vite + three.js**. Everything you see is
generated at runtime: the terrain, the districts, the roads, the sky, the
mechanics, and every single sound.

![The hangar: pick your gladiator](docs/screenshot-menu.png)

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

### Playing the published build

The production build inlines every asset — JavaScript, CSS and three.js — into
one HTML file, so it can be served from any static host. `preview/index.html` in
this repository is that file, regenerated with:

```bash
npm run build
npm run preview:prepare   # copies dist/index.html -> ../preview/index.html
```

It is committed on purpose so the game can be opened straight from a raw file
URL, with no server and no install step:

```
https://raw.githubusercontent.com/shenbigdisk-cmd/sgame/arena/e2b67aef-sgame/preview/index.html
```

---

## Controls

| Input | Action |
| --- | --- |
| `Mouse` | Aim the turret / camera |
| `LMB` / `Space` | Primary weapon (autocannons, scattergun, coil repeater) |
| `RMB` / `C` | Secondary weapon (60mm cannons, flamethrower, cryo lance, cryo grenade) |
| `Q` / `E` | Chassis special hardpoints |
| `W A S D` | Drive (relative to your view in **EASY**, hull-relative in **SIM**) |
| `Z` / `MMB` | Scope |
| `M` | Music on / off |
| `Esc` | Release the mouse (pause menu) |
| `1` `2` `3` | Pick an upgrade after a wave |
| `Enter` / `N` | Call the next wave early |

![In the arena](docs/screenshot-gameplay.png)

On touch devices an on-screen stick, fire buttons and module buttons appear
automatically. Empty weapon sockets are shown as empty and simply do not fire.

---

## The three chassis

| Chassis | Role | Factory loadout | Reactor |
| --- | --- | --- | --- |
| **WARDEN-9 "Oathkeeper"** | Balanced veteran | Rotary autocannons · 60mm cannons · Homing missiles · Sentry turret | Standard Core |
| **PYRE-12 "Crowd-Eater"** | Fire brawler | Scrap scattergun · Dragon's Breath · Skyfall slam · Cinder mines | Fused Capacitor |
| **GLACIER-7 "The Exile"** | Cryo duelist | Coil repeater · Cryo lance · Longbow railgun · Veil smoke | Titan Reactor |

Each factory blueprint is power-positive: its reactor output covers the
sustained draw of the mounted loadout. Swapping in heavier toys can still run
the grid into deficit, which the Forge flags before you deploy.

---

## Systems

### Procedural sectors
Every seed (`ABC-123`) deterministically builds a theme (time of day, weather,
palette), a district layout with named regions, a road network, water bodies,
hills and cover. The perimeter expands every third wave, revealing new
districts and two supply pods in the newly opened ring. Clearing a stage
generates a fresh sector from a deterministic per-stage seed; the old arena's
meshes are disposed, the theme and sky are rebuilt, and the mech is moved to
the new pit with a repair kit nearby.

### Waves
Each wave picks a tag — `SWARM`, `ARMORED PUSH`, `SNIPER NEST` or
`FLANKING AMBUSH` — and mixes four enemy chassis (raider tank, hound walker,
goliath heavy, longbow sniper) plus an elite champion. Every fifth wave a
**WARLORD** boss enters the arena. Between waves the arena is repaired, the
shield is refilled and you choose one of three rewards.

Clearing a stage earns a beat of celebration before the reward draft appears:
the arena stays live for 2.8 seconds of stage time so the clear, the crowd and
the wreck can land, and a `REWARD DRAFT IN N` countdown tells you the draft is
on its way. The next sector is built once that celebration finishes.

### Rewards
Upgrades roll as **STANDARD / RARE / UNIQ** and cover hull, weapon, system and
signature categories. Weapons can be **evolved** into stronger forms
(`STATIC LINK`, `CONCUSSION CORE`, `ABSOLUTE ZERO`, …), and signature upgrades
introduce new mechanics (cluster munitions, reactive armour, overcharged
rounds, repair swarm, killstreak surge, arc discharger, bulwark field,
saturation barrage, supply network).

Every weapon has exactly one evolution, and an evolution only appears once you
own the weapon it upgrades. The four Forge specials evolve too:

| Forge special | Evolution | Effect |
| --- | --- | --- |
| `INCENDIARY MORTARS` | `THERMAL DRUMS` | Pools burn hotter and longer, and never scorch you |
| `STASIS NOVA` | `GLACIAL SHATTER` | Nova deals 20 damage and leaves enemies brittle |
| `OVERDRIVE VENT` | `REACTOR PURGE` | Venting restores shield and purges weapon heat |
| `CRYO LANCE` | `GLACIAL LOCK` | Chilled targets build frost and freeze solid |

### THE FORGE
There is no loot to scavenge. **Credits** are the currency, and they are earned
by fighting: every run pays out on score, waves cleared, kills and personal
bests. A new pilot starts with 600 CR. Open **THE FORGE** from the hangar and
spend them.

Eight slots make up a mech, and every one of them is yours to fill — or leave
empty:

| Slot | What it takes | Example |
| --- | --- | --- |
| `FRAME` | The chassis you walk out in — always free | `WARDEN`, `PYRE`, `GLACIER` |
| `PRIMARY` | The trigger weapon | Rotary autocannons, scattergun, coil repeater |
| `SECONDARY` | The heavy weapon | 60mm cannons, cryo grenade, Dragon's Breath, cryo lance |
| `SPECIAL · Q` | One of the Forge specials | Homing missiles, skyfall slam, longbow railgun |
| `SPECIAL · E` | A second special | Sentry turret, cinder mines, veil smoke |
| `ARMOUR` | Hull plating | Lattice armour, ablative carapace, reactive skin |
| `REACTOR` | Shield and power | Standard core, fused capacitor, titan reactor |
| `DRIVE` | Legs and speed | Sprint servos, skimmer legs, anvil drive |

![THE FORGE: build your mech](docs/screenshot-forge.png)

The factory floor is a live three.js scene: drag to rotate the mech, scroll to
zoom, and watch the frame, weapons, armour, reactor and legs change as you fit
them. Every catalogue component has its own model key, including the upgraded
barrels, sawn-off scattergun, vented flame, deep-freeze lance, swarm pod and
the six bespoke hull systems.

Two build systems make the catalogue more than a list of parts:

* **MASS** — every component has a dry weight in tonnes. A stock loadout sits
  at a factor of 1; strip the guns off and the mech sprints, bolt on a siege
  cannon and it waddles. The Forge shows total mass and the resulting speed and
  turn rate.
* **POWER** — the reactor stores energy (`KJ`) and trickles it back into the
  grid (`KJ/S`). Hull systems draw 4 KJ/S; each mounted weapon advertises its
  activation cost and sustained draw. Activation costs are tracked by cockpit
  socket (`PRIMARY`, `SECONDARY`, `SPECIAL · Q`, `SPECIAL · E`), so two specials
  never overwrite each other and a stripped socket costs nothing. A deficit
  means the reactor cannot sustain continuous fire; the buffer still absorbs
  bursts until it runs dry.

Primary, secondary and special weapon tuning are isolated by socket. A primary
scattergun has its own damage, reload, muzzle speed and splash fields and cannot
overwrite the secondary cannons; beams and cryo grenades use their own damage
and cycle fields. The three factory presets all ship with balanced grids, while
greedy custom builds still produce a visible power warning.

The yard also keeps up to **eight named custom builds**. Save the current
assembly, rename it, load it back or delete it from the rack. Empty mounts are
part of the build and survive a reload.

### Persistence
Credits, every component you own, the mech name, the exact mounted build and
the named build rack are written to `localStorage` under
`steel-horizon:garage:v2`. Saves from `steel-horizon:garage:v1` are migrated
automatically, including their owned parts, so old pilots keep their purchases.
Invalid or tampered component ids are sanitised; deliberately empty sockets are
not. Cockpit settings (sensitivity, field of view, invert look, render quality,
volumes, crosshair, performance readout) and the hall-of-fame records are stored
alongside them.

### Feedback
Procedural audio (weapons, explosions, engines, ambience and an adaptive
score) is synthesised with the Web Audio API and spatialised with stereo pan,
distance muffling and speed-of-sound delay. The HUD tracks hull, shield,
reactor power, heat, cooldowns, a radar, target telemetry, kill streaks and
incoming damage directions.

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
   │  ├─ Forge.tsx          # THE FORGE: presets, saved builds, gauges, purchases, mounts
   │  ├─ FactoryView.tsx    # live 3D factory floor
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
      ├─ rng.ts             # seeded utilities and per-stage sector codes
      ├─ enemyMeshes.ts     # procedural tank / walker / heavy meshes
      ├─ mechModels.ts      # procedural factory models for every component
      ├─ particles.ts       # instanced billboard particle system
      ├─ readiness.ts       # pure weapon-readiness and aim-assist maths
      ├─ vehicles.ts        # chassis + weapon catalogue and socket helpers
      ├─ forge.ts           # THE FORGE catalogue, presets and build resolution
      ├─ garage.ts          # credits, owned parts, equipped slots, persistence
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
