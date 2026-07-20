# Aetherklang — English Handbook Summary

> **“The world has a voice. You are learning to play it.”**

The complete primary handbook is available in German at
[`HANDBUCH.md`](HANDBUCH.md). This summary covers the essential systems,
content, controls, and progression. The core loop and Crescendo expansion are
playable: the original items, blocks, creatures, HUD, Kammerton, and Choral
encounter now connect to ensembles, chords, lifetime grades, new instruments,
Klangweaver armor, Tonarium landmarks, and two additional creatures.

## Premise

The Aetherklang is the hidden world-song running through stone, water,
crystal, and living beings. Choral, once guardian of its great cadence, tore
voices from their context and forged **Dissonance**. You are a Resonant: an
adventurer who can hear the underlying beat, collect Resonance Points, and
answer broken sound with deliberate action.

## Core loop

1. Find or craft resonance crystals.
2. Craft a Tuning Fork and Codex.
3. Learn the 120 BPM world beat (HUD metronome, beat tick).
4. Build RP through on-beat actions.
5. Spend RP on instrument abilities.
6. Hunt Dissonance Spirits and seal the rifts they tear open.
7. Craft a Glockenspiel Portal.
8. Enter the Kammerton dimension, cross the golden bridge, and answer
   Choral's final cadence.

## Five moods

| Mood | Effect |
| --- | --- |
| **Silence** (Stille) | Mob notice radius ×0.75 (API); dissonance decays 3× faster |
| **Joy** (Freude) | Healing aura: a quarter heart to players within 6 blocks every 5 s; stronger harp pulses |
| **Wrath** (Zorn) | ×1.10 damage integration (API); much stronger Bass Hammer shockwaves |
| **Sorrow** (Trauer) | Slowing impact halved (API) |
| **Wonder** (Wunder) | Luck effect refreshed every 5 s, note particles; harp notes become healing |

Moods are stances, not locked classes. Cycle them with **M** (costs 2 RP,
free in Creative), switch for free at a Mood Altar, or set them directly via
command.

## Beat and RP

The authoritative server beat runs at **120 BPM**, one beat every **500 ms**.

| Rating | Window | Reward |
| --- | ---: | --- |
| **Perfect** | within ±40 ms | +2 RP on instrument actions; feeds perfect streaks |
| **Good** | within ±100 ms | triggers all on-beat item effects |
| **Miss** | outside ±100 ms | no beat bonus |

Consecutive perfect beats build a **perfect streak** (up to 8); a streak of
2+ doubles passive dissonance decay.

RP ranges from **0 to 100** (120 with the Klangweaver Chestplate) and survives
death. Gains: +2 perfect action, +2 on-beat Blade/Hammer hit, +3 on-beat
Tuning Fork scan, +1 crystal tap, +1 healing harp pulse, +1 active-ensemble
action per beat, and at least +1 from a full-set Afterecho. Costs: 2 mood
cycle, 6 altar attunement, 8 dash (6 in Klangweaver Boots), 10 Organ Horn,
12 blade fan, 12 rift seal, 16 Fermata Bell, and 24 portal toll.

**Dissonance** (0–100 %, HUD "DIS" meter) rises from rifts (+5 %/s inside),
spirit hits (+12 %), dissonant echo notes (+8 %), and Choral's storm/beam
(+24 %/+16 %). At 65 %+ Echo Guardians shield themselves (only ~1/3 damage
taken) and defend their altars against you. It decays slowly on its own;
Silence triples and perfect streaks double the decay.

## Content overview

### Items (all playable)

- **Tuning Fork:** scans 8 blocks around (±4 vertical) for resonance
  sources, sets Silence, +3 RP on beat; also taps crystals, attunes altars,
  and seals rifts.
- **Resonance Blade:** diamond-tier sword; on-beat hits deal +3 magic
  damage and grant +2 RP; sneak + right-click fires a 12-RP cone slash
  (~4.5 blocks, 5 magic damage, knockback, 1.5 s cooldown). Durability 512.
- **Echo Harp:** fires homing echo notes (healing 3.5 hearts in Joy/Wonder,
  otherwise 3.5 hearts damage); channel it bow-style to pulse on-beat heals
  (1 heart, 1.5 in Joy, 7-block radius, +1 RP per healing pulse).
  Durability 384.
- **Bass Hammer:** diamond-tier axe; on-beat hits smash a 3.25-block
  shockwave (3 damage, 5 in Wrath) with knockback and +2 RP; on-beat
  right-click slams a 4.25-block wave in front (5 damage, 8 in Wrath,
  2.25 s cooldown). Durability 768.
- **Echo Boots:** iron-tier boots; press **R** while wearing them (or
  sneak + right-click holding them) for the Resonance Dash — 8 RP, 3 s
  cooldown, ~5 blocks with a mood-colored trail. Durability 429.
- **Codex of Resonance:** custom Tonarium handbook (35 folios, 15
  categories); carrying it grants free portal passage.

### Blocks (all playable)

- **Resonance Crystals** (Indigo, Cyan, Gold, Magenta): glowing, craftable,
  mined with iron pickaxe or better; right-click for a mood hint and +1 RP.
- **Mood Altar:** right-click cycles moods for free (sneak reverses); with
  the Tuning Fork, attune nearby crystals for 6 RP. Guarded by Echo
  Guardians.
- **Dissonance Rift:** standing inside inflicts Wither, one heart per
  second, and +5 % dissonance per second; seal it for 12 RP. Dissonance
  Spirits seed new rifts.
- **Glockenspiel Portal:** unbreakable two-way gate to the Kammerton. Enter
  with the Codex in either hand (free) or pay 24 RP; the return portal to
  the overworld spawn is free.

### Creatures (all playable: AI, loot, renderers, spawn eggs)

- **Dissonance Spirit:** phantom-like flier; spawns in the overworld in low
  light or near rifts, seeds one rift itself; melee adds dissonance and it
  volleys dissonant echo notes; takes ×1.75 damage from on-beat hits.
  Drops amethyst shards.
- **Echo Guardian (Hallwächter):** heavy altar guardian (26 hearts, armor
  10); shields itself against players at 65 %+ dissonance. Drops gold
  nuggets. No natural spawn.
- **Echo Note:** small homing note projectile, healing (3.5 hearts) or
  dissonant (3.5 hearts damage, +8 % dissonance), 8 s lifetime.
- **Choral:** the final boss (110 hearts, armor 8, boss bar, darkened sky).

## The Kammerton dimension

`aetherklang:kammerton` is a floating-island archive under an indigo sky.
You arrive at an authored sanctum island (altar, four crystal pylons, free
return portal), then follow a golden lantern-lit bridge ~90 blocks south to
Choral's arena — amethyst rings, twelve purpur pillars, crystal pylons, and
a central altar. Approaching within 22 blocks of the arena center awakens
Choral once per world ("Choral awakens").

## Choral boss phases

| Phase | Health | Attack | Telegraph / answer |
| --- | --- | --- | --- |
| 1 · Note Ring | > 66 % (purple bar) | Ring of 14 dissonant echo notes every 4.5 s | Golden beat ring swells — stand between spokes |
| 2 · Dissonance Storm | 66–33 % (gold bar) | 4.5-heart storm on your position (+24 % dissonance) every 5 s | Magenta smoke ring shrinks — move (dash!) away |
| 3 · Chorus Beam | < 33 % (red bar) | 7-heart beam along the line to you (+16 % dissonance) every 6 s | Light motes trace the line — step sideways |

Loot: echo shards, amethyst clusters, two resonance crystals, music disc
"5", and a 20 % chance of a master instrument (player kill). Victory grants
the "Final Cadence" advancement.

## HUD

Bottom-left resonance panel: mood icon and name, RP bar (`x / 100`, or 120),
metronome pendulum with a golden "TAKT" pulse in the perfect window, and a
DIS meter in percent. Beats are also audible as ticks, and a mood-colored
vignette with dissonance distortion frames the screen. Crescendo adds a
shape-coded rank sigil with lifetime RP and a three-slot Chord HUD with
ensemble size.

## Codex

Open the Codex with **K** or right-click the Codex item. It has 35 folios in
15 categories: the original nine plus Ensembles & Chords, Tonarium
Expansion, Resonance Grades, New Instruments, Klangweaver Armor, and New
Creatures. New folios visibly label content as PLAYABLE, FOUNDATION, or
VISION. Survival players see synced unlock state; Creative mode opens every
page.

## Controls

| Action | Default | Note |
| --- | --- | --- |
| Open Codex | **K** | also right-click with the Codex |
| Resonance Dash | **R** | requires worn Echo Boots; 8 RP, 3 s cooldown |
| Cycle mood | **M** | 2 RP (free in Creative) |
| Toggle adaptive music | **N** | local audio only; no server-side effect |
| Close Codex | **Esc** | game keeps running |

All keys are rebindable under the Aetherklang controls category.

## Advancements

First Resonance (obtain a crystal), Right on Beat (first perfect action),
A World With a Voice (open the Codex), Through the Glockenspiel (enter a
portal), Final Cadence (defeat Choral).

## Commands

- `/aetherklang`
- `/aetherklang rp get`
- `/aetherklang rp set <0..120>` (permission level 2; capped at 100 without the chestplate)
- `/aetherklang rp add <-120..120>` (permission level 2; active capacity still applies)
- `/aetherklang mood <stille|freude|zorn|trauer|wunder>`
- `/aetherklang beat info`
- `/aetherklang codex unlock <0..255>` (permission level 2)
- `/aetherklang codex list`

Codex numeric IDs match the zero-based order in
`assets/aetherklang/kodex/pages.json`. Quick dev-test commands for the
Kammerton are listed in the German handbook and `README.md`.

## Crescendo: ensembles and chords

### Ensembles

Two players form a playable ensemble when both perform a valid on-beat
action on the same server beat, in the same dimension, within **12 blocks**.
The link lasts **10 seconds** and refreshes when the players answer together.

- Each later on-beat action by a linked player grants **+1 RP**, at most once
  per beat.
- The Chord HUD shows ensemble size as `♫n`.
- Intertwined cyan and gold particles connect nearby members.
- Beat Bridges remain solid between timing windows while two players are
  nearby.
- Links are temporary and disappear on timeout or disconnect.

Attacks and use of the Tuning Fork, Blade, Harp, Hammer, Organ Horn, or
Fermata Bell can count after server-side beat validation.

### Chords

Every valid on-beat action stores its current mood in a three-slot sequence.
A recognized sequence immediately resolves within an **8-block radius**:

| Mood sequence | Chord | Effect |
| --- | --- | --- |
| Silence → Joy → Wonder | Healing Triad | Heals the group for 3 hearts |
| Wrath → Wrath → Sorrow | Falling Cadence | 3 hearts magic damage and 6 s Slowness II |
| Sorrow → Silence → Joy | Gentle Resolution | Heals 1 heart, clears Slowness, grants 8 s Regeneration |
| Wonder → Wrath → Wonder | Stellar Fortissimo | 2 hearts magic damage, launch, and 8 s Glowing |

Chords spend no extra RP, though changing mood may cost RP. The HUD, golden
glyphs, sound, and chord name confirm a successful resolution.

## Resonance grades

`gesamt_rp` records only positive RP actually credited to the active pool.
Spending, dying, or changing dimension never reduces it. RP rejected because
the pool is already full does not count.

| Grade | Lifetime RP |
| --- | ---: |
| **Novice** | `0` |
| **Adept** | `150` |
| **Virtuoso** | `400` |
| **Maestro** | `900` |

The server derives the grade from lifetime RP, persists both values, and
sends `aetherklang:rang_sync`. The rank sigil uses color plus additional
marks and shows `ΣRP`, so the information does not rely on color alone.

## Crescendo instruments

### Organ Horn — `aetherklang:orgelhorn` · Playable

Hold use for at least **10 ticks**, then release in the GOOD window.

- Cost: **10 RP**, only when a wave fires
- Reach: **12-block** view cone
- Damage: **7** (3.5 hearts), plus knockback and 2.5 s Darkness
- PERFECT: stronger knockback and the normal perfect-action RP
- MISS: no wave and no RP cost
- Durability: 384

### Fermata Bell — `aetherklang:fermatenglocke` · Playable

Throw the Bell for **16 RP**. On first impact it anchors an eight-second,
six-block dome:

- living entities are heavily slowed and retain 18% velocity,
- projectiles retain only 5% velocity,
- the thrower is unaffected by their own field,
- cooldown is 20 seconds,
- durability is 256.

The field controls movement; it does not stop the server beat or world time.

## Klangweaver armor

All four items use diamond armor values and emit a piece-scaled cyan/gold
aura.

| Piece | Playable benefit |
| --- | --- |
| Helmet | Marks up to 16 resonance sources within 12 horizontal / 6 vertical blocks |
| Chestplate | Raises active RP capacity from 100 to **120** |
| Leggings | Widens the GOOD phase window by `0.03` |
| Boots | Enable Resonance Dash for **6 RP** instead of 8 |

With the full set, each perfect action schedules an **Afterecho** ten ticks
later. It grants at least +1 RP with audiovisual feedback. Blade and Bass
Hammer perfect hits also replay their resonance effect at half strength.

## Siren, Beatling, and Organ Tower

### Organ Tower and Siren · Playable

The Overworld creates an authored copper-and-blackstone tower once,
**96 blocks east of world spawn**. A persistent marker prevents duplicate
generation. Its Siren has 45 hearts, armor 6, and sings every six seconds,
pulling creatures from up to 16 blocks during the phrase. On-beat hits deal
×1.75 damage. The Siren always drops a **Choir Heart**.

The Choir Heart currently serves as loot and an integration item; it has no
use recipe.

### Beatling · Playable

Beatlings naturally appear in the Kammerton, hop every ten ticks, and can be
tamed with one Gold Resonance Crystal. A tamed Beatling follows or sits for
its owner and widens that owner's GOOD window by `0.02` within 12 blocks.
They do not breed in this version.

## Tonarium expansion

The Kammerton now continues beyond Choral's arena:

- eight Resonance Gardens form a ring near `0 / 129 / 272`,
- three Crystal Archives stand near `-68 / 137 / 342`,
  `0 / 142 / 394`, and `68 / 137 / 342`,
- three-wide Beat Bridges connect the northern garden and archives,
- hidden markers ensure each authored region is generated once.

| New block | Playable behavior |
| --- | --- |
| Sound Lantern | Pulses from light level 5 to 15 for the first two ticks of each beat |
| Beat Bridge | Solid in the GOOD window, or continuously with two nearby players |
| Resonance Archive | Right-click unseals one location-bound Codex folio per player |
| Soundflower | Chimes and emits notes on touch; 1.5 s cooldown per creature |

The three Archives unlock the existing Tonarium, Portal Rite, and Final
Cadence folios according to location.

## Crescendo presentation

- The Kammerton draws five mood-colored aurora bands; dissonance shifts them
  toward magenta and beats brighten them.
- A chromatic screen ripple begins on the second consecutive perfect action.
- A desaturated scanline wash signals proximity to an active Fermata field.
- Ensemble links and Klangweaver auras make group and equipment state visible.
- Adaptive music maps each mood to an eight-step motif, adds ensemble harmony,
  detunes with dissonance, and layers Choral's phase. Press **N** to toggle it
  locally.

## Recipes and availability

The original recipes remain unchanged. Crescendo adds:

| Item | Ingredients |
| --- | --- |
| **Organ Horn** | Goat Horn, Copper Ingots, Gold Resonance Crystal |
| **Fermata Bell** | Bell, Cyan Resonance Crystal, Amethyst Shard, 2× Gold Ingot |
| **Klangweaver Helmet** | 4× any Resonance Crystal around 1× Choir Heart |
| **Klangweaver Chestplate** | 7× any Resonance Crystal around 1× Choir Heart |
| **Klangweaver Leggings** | 6× any Resonance Crystal around 1× Choir Heart |
| **Klangweaver Boots** | 2× Resonance Crystal above 2× Choir Heart |

The **Choir Heart** has no recipe; a Siren drops one. Sound Lantern, Beat
Bridge, Resonance Archive, and Soundflower currently have **no Survival
crafting recipe** and come from world content or the Creative inventory.

## Quick reference

- **Codex:** K or use `aetherklang:kodex`; 35 folios / 15 categories
- **Dash:** R; Echo Boots 8 RP, Klangweaver Boots 6 RP
- **Mood:** M; 2 RP, free at a Mood Altar
- **Adaptive music:** N; local only
- **Beat:** 120 BPM; PERFECT ±40 ms; GOOD ±100 ms
- **RP:** 0–100, or 120 with chestplate; Horn 10; Bell 16; fan/rift 12
- **Grades:** Novice 0; Adept 150; Virtuoso 400; Maestro 900 lifetime RP
- **Ensemble:** same beat, within 12 blocks, 10 seconds, +1 RP/action
- **Chord:** three on-beat moods, effect within 8 blocks
- **Crescendo route:** Organ Tower → Siren → ensembles/chords → Gardens →
  Archives → Maestro

## Credits

Aetherklang Team; built with Fabric Loader, Fabric API, and Yarn mappings for
Minecraft.
