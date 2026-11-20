# STEEL HORIZON: SALTLINE — The Kestrel Revenge

The story campaign. Six operations, three acts, one revenge — and a truth
neither side was told.

## Premise

Three years ago, at Kestrel Ridge, an Allied strike destroyed the town of
Kestrel and Warlord Viktor Kane ambushed the convoy that followed — killing
Lt. Cole's brother Daniel. Command buried the report. Now Kane commands the
1st Legion citadel on the Saltline Frontier, and Col. Halvorsen has finally
authorized the hunt. RAVEN squad will track him across six operations. The
truth about Kestrel is worse than either side was told.

## The Squad

| Callsign | Pilot | Chassis | Role |
| --- | --- | --- | --- |
| RAVEN-1 | Lt. Elias "Raven" Cole — **you** | WARDEN-9 "Oathkeeper" | Squad leader. Forward observer at Kestrel. His brother Daniel died in the ambush that followed. |
| RAVEN-2 | Sgt. Mara "Havoc" Voss | PYRE-12 "Crowd-Eater" | Gunner. Loud, fearless, best shot in the squad. Lost her platoon at Kestrel. |
| RAVEN-3 | Cpl. Jonah "Ghost" Park | GLACIER-7 "The Exile" | Recon / sniper. The only one who read the Kestrel report cover to cover. |
| RAVEN-4 | WO. Ada "Doc" Okafor | WARDEN-9 "Field Kit" | Medic / engineer. Runs the Vessk clinic. The squad's conscience. |

**Col. Ingrid Halvorsen "OVERLORD"** — AGC 2nd Armoured Recon handler. A
flawed ally, not a villain: she will lie about Kestrel until the truth costs
her everything.

**Warlord Viktor "AEGIS BANE" Kane** — Iron Vanguard 1st Legion. Believes
Cole ordered the bombing of his hometown. He killed Daniel Cole in revenge
for a crime Cole never ordered. Both men were lied to by the same broker.

**The Broker** — an Obsidian Syndicate handler (voice only). He sold the
Kestrel targeting data to *both* sides. The war was a receipt.

## The Six Operations

### Act I — The Hunt

**OP-1 · Ashes of Kestrel** (*Escort of the Fallen*, Dusk, TACTICAL)
Escort a militia convoy of Kestrel survivors through the ruins. Kane's
ambush, Kane's voice on the radio — the first time in three years. Teaches
Wisps, Hounds and the Mender-first rule.

**OP-2 · Cold Trail** (*Ghost Signal*, Night Ops, SEVERE)
Infiltrate the relay station, steal Kane's citadel coordinates — and find
the Syndicate ledger: "Kestrel Ridge — targeting data sold to both sides."
Sniper nests, sapper ambushes, a Bastion-guarded reactor.

### Act II — The Price

**OP-3 · Iron Harvest** (*Hold the Line*, Dust Storm, SEVERE)
Defend the militia town of Vessk: hold the market square while Doc
evacuates the clinic, break the assault, demolish the canal roadblock.
The squad came for revenge and stayed for the people.

**OP-4 · Ghost Signal** (*Sabotage the Citadel*, Ashfall, CRITICAL)
Demolish the shield generator and both flak batteries of Kane's anti-air
belt. Ghost finally says what the Kestrel report actually said: Cole never
called the strike. His observer codes were forged.

### Act III — The Reckoning

**OP-5 · The Reckoning** (*Citadel Siege*, High Noon, CRITICAL)
The full siege: Goliath artillery, citadel core, honor guard. Mid-battle,
Kane broadcasts the truth — and Halvorsen confirms it on open comms. Kane
asks for a duel, alone, at the caldera heart.

**OP-6 · Aegis Bane** (*The Last Duel*, Dusk, CRITICAL)
Break the honor guard, face the Warlord's siege walker, survive the death
throes, extract as the broker fleet turns away. The revenge ends. The
squad flies on — not for vengeance, but for every town still waiting for
someone to hold the square.

## How it plays

- **Sequential unlock.** Operation N+1 opens when N is secured. Completed
  operations can be replayed.
- **Four stages per operation:** three combat stages + extraction. Each
  stage has its own radio chatter from the squad — watch the callsign
  colours (HAVOC red, GHOST blue, DOC green, OVERLORD cyan, AEGIS BANE red).
- **Intel before every sortie.** The war-room briefing lists enemy counters
  for that operation's threat mix (Bastion → shells/rockets, Mender →
  kill first, Sapper → kill at range, Longbow → break line of sight).
- **Radar navigation.** A gold diamond marks the active objective on the
  cockpit radar; hostile contacts appear as coloured threat markers. OP-1's
  pickets are a Wisp skimmer, Hound Walker and T-90 Raider, all staged on
  dry, open ground.
- **Hold-the-line defense.** OP-3 opens with a `hold_zone` stage: stay in
  the ring while the timer runs. Leaving pauses the hold; it never resets.
- **Story salvage.** Every debrief offers a choice of three artifacts —
  Daniel's dog tags, the Syndicate ledger, Kane's final recording — each
  worth Forge credits and a piece of the story.
- **Pilot progression.** XP and skill points carry across operations and
  into the Forge. Faction standing rises with the Allies and the Militia.

## Design rules (enforced by tests)

- At most **one kill-count objective per stage** — the engine credits each
  kill to a single objective.
- Tactical spawns are staged near their objective, but every matching kill
  during the active stage counts even if a pursuer follows the player out of
  the original area; this prevents kill objectives from soft-locking.
- Installation names drive the 3D mesh: `GENERATOR` → reactor,
  `ROADBLOCK` → barrier wall, `FOB`/`BASE` → command post, else flak tower.
- Every mission ends with a `reach_extraction` stage.

## Code map

| File | Role |
| --- | --- |
| `smech/src/game/campaign.ts` | Story bible, squad, missions, skills, progression |
| `smech/src/game/campaignEngine.ts` | Stage progression, hold zones, optional objectives |
| `smech/src/game/campaignWorld.ts` | 3D installations, extraction pad, waypoints |
| `smech/src/components/CampaignMap.tsx` | War room: operations, squad, skills, factions |
| `smech/src/components/CampaignHUD.tsx` | In-sortie objectives, waypoints, radio |
| `smech/src/components/CampaignDebrief.tsx` | After-action story, rewards, salvage draft |
