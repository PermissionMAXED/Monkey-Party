# Aetherklang — English Opus Handbook

> **“The world has a voice. You are learning to play it.”**

The primary opus bible is available in German at
[`HANDBUCH.md`](HANDBUCH.md). This English companion covers the complete
playable core, Crescendo, and SINFONIE: original items, blocks, creatures,
HUD, Kammerton, and Choral connect to ensembles, chords, lifetime grades,
Klangweaver armor, a 48-island outer Klangmeer, Motif creatures, six
boss scores, daily contracts, the Leitmotiv tree, Sound Forge, World Chord,
and Dissonance Cascades.

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
| **Perfect** | within ±40 ms | +2 RP bonus on instrument actions; feeds perfect streaks |
| **Good** | within ±100 ms | triggers all on-beat item effects |
| **Miss** | outside ±100 ms | no beat bonus |

Consecutive perfect beats build a **perfect streak** (up to 8); a streak of
2+ doubles passive dissonance decay.

RP ranges from **0 to 100** (120 with the Klangweaver Chestplate) and survives
death. Gains: +2 perfect-action bonus, +2 on-beat Blade/Hammer hit, +3 on-beat
Tuning Fork scan (+5 total on Perfect), +1 crystal tap, +1 healing harp pulse
(+3 total on Perfect), +1 active-ensemble action per beat, and at least +1
from a full-set Afterecho. Costs: 2 mood
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
  sources, sets Silence, +3 RP on beat (+5 total on Perfect); also taps
  crystals, attunes altars, and seals rifts.
- **Resonance Blade:** diamond-tier sword; on-beat hits deal +3 magic
  damage and grant +2 RP; sneak + right-click fires a 12-RP cone slash
  (~4.5 blocks, 5 magic damage, knockback, 1.5 s cooldown). Durability 512.
- **Echo Harp:** fires homing echo notes (healing 3.5 hearts in Joy/Wonder,
  otherwise 3.5 hearts damage); channel it bow-style to pulse on-beat heals
  (1 heart, 1.5 in Joy, 7-block radius, +1 RP per healing pulse, +3 total
  on Perfect).
  Durability 384.
- **Bass Hammer:** diamond-tier axe; on-beat hits smash a 3.25-block
  shockwave (3 damage, 5 in Wrath) with knockback and +2 RP; on-beat
  right-click slams a 4.25-block wave in front (5 damage, 8 in Wrath,
  2.25 s cooldown). Durability 768.
- **Echo Boots:** iron-tier boots; press **R** while wearing them (or
  sneak + right-click holding them) for the Resonance Dash — 8 RP, 3 s
  cooldown, ~5 blocks with a mood-colored trail. Durability 429.
- **Codex of Resonance:** custom Tonarium handbook (81 folios, 22
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

Open the Codex with **K** or right-click the Codex item. It has 81 folios in
22 categories: nine original registers, six Crescendo registers, and seven
SINFONIE registers — Regions, Bosses, Leitmotiv, Score, Forge, Cascade, and
Motifs. New folios visibly label content as PLAYABLE, FOUNDATION, or VISION.
Survival players see synced unlock state; Creative mode opens every page.

## Controls

| Action | Default | Note |
| --- | --- | --- |
| Open Codex | **K** | also right-click with the Codex |
| Open Leitmotiv | **L** | 24 permanent nodes across three branches |
| Resonance Dash | **R** | requires worn Echo Boots; 8 RP, 3 s cooldown |
| Cycle mood | **M** | 2 RP (free in Creative) |
| Toggle adaptive music | **N** | local audio only; no server-side effect |
| Close Codex | **Esc** | game keeps running |

**K**, **L**, **R**, and **M** are rebindable under the Aetherklang controls
category. The **N** music toggle is listed under **Miscellaneous (MISC)**.

## Advancements

First Resonance (obtain a crystal), Right on Beat (first perfect action),
A World With a Voice (open the Codex), Through the Glockenspiel (enter a
portal), Final Cadence (defeat Choral), Three Become One (first chord), On
the Same Beat (first ensemble), Resonance Adept (150 lifetime RP), Pocket
Metronome (tame a Beatling), The Song Falls Silent (defeat a Siren), and
Sealed Memory (unseal an Archive folio).

## Commands

- `/aetherklang`
- `/aetherklang rp get`
- `/aetherklang rp set <0..120>` (permission level 2; capped at 100 without the chestplate)
- `/aetherklang rp add <-120..120>` (permission level 2; active capacity still applies)
- `/aetherklang mood <stille|freude|zorn|trauer|wunder>`
- `/aetherklang beat info`
- `/aetherklang codex unlock <0..255>` (permission level 2)
- `/aetherklang codex list`
- `/aetherklang partitur` or `/aetherklang partitur open`
- `/aetherklang klangwerk dump`
- `/aetherklang klangwerk reload` (permission level 2)
- `/aetherklang kaskade start|status` (permission level 2)

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

Joining assigns a voice from the held instrument: Tuning Fork, Soprano Flute,
and Triangle are **Soprano**; Echo Harp and Fermata Bell are **Alto**;
Resonance Blade and Organ Horn are **Tenor**; Bass Hammer, Double Bass, and
Timpani are **Bass**. Uninstrumented members fill the least represented voice.

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

### World Chord and Cascades

An ensemble can share **Silence → Joy → Wonder → Sorrow → Wrath** to resolve
the World Chord. Two players are sufficient; three or four players and more
distinct voices increase its healing, area damage, knockback, and group FX.
A solo player may use a nearby tamed Beatling as a second voice, or play the
reduced **Silence → Joy → Wonder** three-note form.

After long quiet periods, Dissonance Cascades can open a rift near players.
Two Motif waves lead to an elite Dissonance Herald. Clearing all three waves
closes the rift and rewards nearby participants with Cascade Cores. Operators
can trigger and inspect the development flow with
`/aetherklang kaskade start` and `/aetherklang kaskade status`.

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
| **Composer** | `1,800` |
| **Conductor** | `3,600` |
| **Klangmeister** | `9,000` |

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

- requires at least **Adept grade** (`150` lifetime RP),
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

The Choir Heart fuels Klangweaver armor or combines with four Glass Bottles
and four Amethyst Shards to make **four Resonance Elixirs**. Each elixir
restores **12 RP** and grants Speed I plus Luck I for 30 seconds.

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
- A mood-colored crystal and five orbiting glyphs float above every Mood
  Altar.
- Choral gains a rotating halo in phase two and a gold pillar in phase three;
  each transition erupts in stacked glyph rings and a rising light spiral.
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
| **Sound Lantern** (4) | Lantern, 2× Copper Ingot, Amethyst Shard, Gold Resonance Crystal |
| **Beat Bridge** (6) | 3× Bamboo Planks, 2× Cyan Crystal, Redstone, Gold Crystal |
| **Resonance Archive** | Chiseled Bookshelf, 4× Indigo Crystal, 4× Amethyst Shard |
| **Soundflower** (2) | Spore Blossom, 2× Amethyst Shard, Glow Berries, Cyan Crystal |
| **Resonance Elixir** (4) | Choir Heart, 4× Glass Bottle, 4× Amethyst Shard |

The **Choir Heart** itself has no recipe; a Siren drops one. Drinking an
elixir restores 12 RP, applies Speed I and Luck I for 30 seconds, and returns
its Glass Bottle.

## SINFONIE: the outer opus

SINFONIE turns the systems learned in the core and Crescendo into a
long-term score. Explore the Klangmeer, hunt data-driven Motifs, wake four
regional bosses and two elite island bosses, claim daily Score contracts, spend Leitmotiv Keys, and
forge four instruments from Base through Master to Virtuoso.

The repeatable loop is:

**Score → explore → Motifs → regional Bosswerk → keys and materials →
Leitmotiv or Forge → World Chord and Cascade**

| System | Playable scope |
| --- | --- |
| Klangmeer | 48 deterministic islands, eight archetypes, four fixed regions |
| Motifs | Runner, Wing, Pulser; eight stat/color/loot variants |
| Bosswerk | Tremolo, Glissanda, Kakophon, General Pause, Ostinato, Ritardando |
| Leitmotiv | 24 permanent nodes in Combat, Harmony, World |
| Score | Three contracts per 24,000-tick world day from eleven definitions |
| Forge | Four instruments, three tiers, twelve one-slot relics |
| Cascades | Five-mood World Chord and three-wave rift event |

## Klangmeer atlas

The authored center remains the prelude:

| Place | Coordinates |
| --- | ---: |
| Arrival | `0 / 129 / 0` |
| Choral arena | `0 / 140 / 96` |
| Resonance Gardens | near `0 / 129 / 272` |
| Crystal Archives | near `-68 / 137 / 342`, `0 / 142 / 394`, `68 / 137 / 342` |

The world seed deterministically composes 48 outer islands from Bass Vault,
Arpeggio Garden, Cacophony Reef, Crystal Crown, Resonance Grove, General
Pause Shelf, Echo Terrace, and Beat Roundel archetypes. Persistent lodestone
markers prevent duplicate generation.

### Four regions and landmarks

| Region | Anchor | Landmark | Boss |
| --- | ---: | --- | --- |
| Bassgewölbe / Bass Vault | `-900 / 129 / 0` | Great Timpani | Tremolo |
| Arpeggienmeer / Arpeggio Sea | `900 / 129 / 0` | String Bridges | Glissanda |
| Kakophonie-Riff / Cacophony Reef | `0 / 129 / 900` | Swarm Throne | Kakophon |
| Generalpause-Öde / General Pause Wastes | `0 / 129 / 1600` | Empty Podium | General Pause |

Entering within 420 blocks of an anchor sends `region_sync`, updates the
regional presentation, and triggers its one-time advancement. Approaching
within 24 blocks of an armed landmark summons its boss once; separate
generation and encounter markers prevent duplicate arenas and encounters.

Bring a spare instrument, blocks, food, and at least 24 RP. The farthest
region is 1,600 blocks south of the center, so mark a return route.

## Motif bestiary

Motif creatures select a data-driven variant when spawned. Variant ID
persists and controls name, health, attack, speed, visual scale, two render
colors, and direct loot. Every Motif takes **1.75× damage from an on-beat
player hit**.

| Archetype / variant | Health | Attack | Speed | Loot |
| --- | ---: | ---: | ---: | --- |
| Runner · Presto | 20 | 4 | 0.34 | 1–3 Sound Dust |
| Runner · Ostinato | 34 | 6 | 0.23 | 1–2 Resonance Ingots |
| Runner · Syncopation | 26 | 7 | 0.29 | 1 Leitmotiv Key |
| Wing · Legato | 18 | 3 | 0.30 | 1–2 String Hearts |
| Wing · Staccato | 14 | 5 | 0.38 | 1 Swarm Eye |
| Wing · Nocturne | 30 | 6 | 0.26 | 1–2 Silence Shards |
| Pulser · Bass | 42 | 8 | 0.19 | 1–2 Cascade Cores |
| Pulser · Triplet | 24 | 5 | 0.31 | 1 Tremolo Core |

In mixed groups, remove fast Wings first, then dangerous Runners, then
heavy Pulsers. Score contracts count exact archetypes or any Motif, so one
hunt can feed contracts, Forge materials, and Leitmotiv currency.

## Bosswerk scores

All six bosses execute validated three-phase JSON scores on the ten-tick
world beat. An attack begins on its interval, telegraphs for one or two
beats, then executes server-side. Phase changes reset the phrase and update
the boss bar.

| Boss | Health | Guaranteed drop | Leitmotiv Keys | Phase rhythm |
| --- | ---: | --- | ---: | --- |
| Tremolo | 240 | Tremolo Core | 2 | 4 → 3 → 2 beats |
| Glissanda | 260 | String Heart | 2 | 4 → 3 → 2 beats |
| Kakophon | 300 | Swarm Eye | 2 | 5 → 3 → 2 beats |
| General Pause | 340 | Silence Shard | 3 | 5 → 3 → 2 beats |
| Ostinato | 285 | Ostinato Relic | 2 | 4 → 3 → 2 beats |
| Ritardando | 310 | Fermata Relic | 2 | 5 → 4 → 3 beats |

### Phase scripts

- **Tremolo:** Note Ring/Shockwave; Note Ring/Glide Strike/Summon;
  Note Ring/Cacophony/Fermata.
- **Glissanda:** Glide Strike/Beam Line; Glide Strike/Shockwave/Note Ring;
  Beam Line/Glide Strike/Fermata.
- **Kakophon:** Cacophony/Summon; Cacophony/Note Ring/Shockwave;
  Cacophony/Beam Line/Summon.
- **General Pause:** Silence Zone/Fermata; Silence Zone/Beam Line/Summon;
  Fermata/Silence Zone/Shockwave.

Read the particles rather than the body: leave Shockwave radii, stand
between Note Ring spokes, step across Beam Lines and Glide Strikes, exit
Silence Zones early, and clear summoned Motifs before the next phrase.

## Leitmotiv tree

Press **L** to open the tree. Combat, Harmony, and World each have eight
linear nodes. Costs rise from one key in the first four nodes, to two in the
next two, to three in the final two. A node requires its predecessor.

| Branch | Eight-node arc |
| --- | --- |
| Combat | +5% damage → PERFECT +0.01 → +5% damage → +1 RP gain → +7.5% damage → PERFECT +0.01 → +1 RP gain → +10% damage |
| Harmony | +10% healing → +25% dissonance decay → GOOD +0.015 → +15% healing → +35% decay → +10 RP cap → GOOD +0.015 → +25% healing |
| World | dash −1 RP → +10 RP cap → +1 RP gain → GOOD +0.015 → dash −1 RP → +15 RP cap → +1 RP gain → dash −2 RP |

Advancements, Score rewards, and boss kills grant keys. Choral and General
Pause grant three; Siren and the other Sinfonie bosses grant two. Creative
players do not consume keys. Unlocks and claimed advancement rewards persist
in resonance player data.

Window modifiers stack with armor and Beatling but cap at 0.5 phase. Dash
cost can never fall below one RP. The tree supports mixed builds; World
capacity plus Harmony timing often matters more than rushing one capstone.

## Daily Score and Music Stand

Use `aetherklang:notenpult` or `/aetherklang partitur`. The server selects
three contracts for each 24,000-tick world-day rotation and tracks progress
for Motif kills, chords, region visits, sealed rifts, and credited RP gains.

| Contract family | Examples | Rewards |
| --- | --- | --- |
| Resonance | earn 20 RP | 8 RP, key, Sound Dust |
| Motif hunt | four Runners, three Wings, six any | RP, keys, Dust/Ingot/Shards |
| Chord | any two, Healing Triad, Stellar Fortissimo | RP, keys, Amethyst/Core |
| Region | Kammerton, Resonance Garden | RP, key, Dust/Ingot |
| Rift | seal two or four | 18–24 RP, 2–3 keys, Shards/Ingots |

Completed contracts must be claimed in the Score screen. If inventory is
full, excess item rewards drop safely beside the player. Rotation replaces
the active set and its progress.

Contract data comes from the atomically reloadable Klangwerk catalog:

- `/aetherklang klangwerk dump` lists counts and IDs.
- `/aetherklang klangwerk reload` validates and installs a complete
  snapshot; on failure, the previous valid snapshot remains active.

## Sound Forge

Hold one Sinfonie instrument in the main hand and use
`aetherklang:klangamboss`. Upgrade ingredients come from inventory. A relic
in the offhand performs a socket operation instead.

| Instrument | Cost and base use | Master cost | Virtuoso cost |
| --- | --- | --- | --- |
| Timpani | 8 RP; Strength I; 3 magic damage and knockback to hostiles within 6 blocks | 2 Ingots, 8 Dust, Tremolo Core | 4 Ingots, 16 Dust, Silence Shard |
| Soprano Flute | 5 RP; heals allies within 8 blocks for 1.5 hearts, grants Regeneration I, clears Poison | 2 Ingots, 8 Dust, Cascade Core | 4 Ingots, 16 Dust, Leitmotiv Key |
| Double Bass | 7 RP; Resistance I; Slowness II and Weakness I to hostiles within 8 blocks | 2 Ingots, 8 Dust, String Heart | 4 Ingots, 16 Dust, 2 Tremolo Cores |
| Triangle | 4 RP; Speed I; reveals hostiles within 16 blocks with Glowing | 2 Ingots, 8 Dust, Swarm Eye | 4 Ingots, 16 Dust, 2 Silence Shards |

Base lasts five seconds with a nine-second cooldown. Master lasts seven
seconds with a 7.25-second cooldown. Virtuoso lasts nine seconds, shortens
cooldown to 5.5 seconds, and raises the status-effect amplifier. Timpani
damage and Flute healing also rise by 1.5 points per tier; Virtuoso raises
Double Bass Slowness to III. Every successful use is an on-beat action, can
grant normal Perfect-timing RP, and costs one durability.

Each instrument has one permanent relic socket:

| Relic | Added effect |
| --- | --- |
| Metronome | Haste |
| Echo | Absorption |
| Fermata | Slow Falling |
| Crescendo | Strength |
| Ostinato | Regeneration |
| Cadence | Luck |
| Legato | Health Boost |
| Staccato | Jump Boost |
| Fortissimo | Fire Resistance |
| Pianissimo | Invisibility |
| Harmony | Resistance |
| Dissonance | Night Vision and clears Darkness |

Upgrade consumption is atomic; missing materials consume nothing. A filled
socket cannot be replaced in this release. Socket effects last nine seconds
at Base, eleven at Master, and thirteen at Virtuoso; Virtuoso raises their
amplifier too. Loose relics can be used directly for a 15-second effect with
a 30-second cooldown.

## World Chord and Dissonance Cascades

The complete World Chord is:

**Silence → Joy → Wonder → Sorrow → Wrath**

An ensemble may share the five on-beat inputs. Progress times out after
twelve seconds; success applies a 25-second cooldown. More members and more
distinct voice parts increase radius, healing, Absorption, hostile damage,
and knockback. A tamed Beatling supplies the second voice for a solo player;
without one, the three-note reduced form remains available.

Voice assignment follows held instruments:

- **Soprano:** Tuning Fork, Soprano Flute, Triangle
- **Alto:** Echo Harp, Fermata Bell
- **Tenor:** Resonance Blade, Organ Horn
- **Bass:** Bass Hammer, Double Bass, Timpani

Uninstrumented members fill the least represented part.

### Cascade event

After an initial eight-minute quiet period, a world may test every 30
seconds for a rift 18–32 blocks from a player. One Cascade can run per world:

1. three Motif Runners + one Pulser,
2. two Runners + two Wings + one Pulser,
3. two Wings + the Dissonance Herald.

The Herald is a glowing Pulser with 90 health, ten attack, and eight armor.
The next wave waits for all tracked creatures to die, then begins after
three seconds. Participants within 48 blocks receive one Cascade Core; with
three or more participants, each receives two. The rift closes on resolution.

Operators can use `/aetherklang kaskade start` and
`/aetherklang kaskade status`.

## Codex and data contracts

The first 35 Codex entries remain in their original order, preserving
numeric unlock IDs. SINFONIE appends 46 folios for a total of **81**, and
adds seven registers without changing the original fifteen.

Two content lifecycles matter:

| Catalog | Lifecycle |
| --- | --- |
| `data/aetherklang/content` | decoded and frozen at mod initialization |
| `data/aetherklang/klangwerk` | validated and atomically reloadable |
| Bosswerk boss files | loaded at startup; all six scores required |
| `assets/aetherklang/kodex/pages.json` | loaded from client resources |

Registry IDs, 16 serialized Klang operations, region anchors, numeric Codex
order, and `boss_fx` / `region_sync` / `leitmotiv_sync` payloads are stable
integration contracts.

## Quick reference

- **Codex:** K or use `aetherklang:kodex`; 81 folios / 22 categories
- **Leitmotiv:** L; 24 nodes / 3 branches; keys from contracts, progress,
  and bosses
- **Dash:** R; Echo Boots 8 RP, Klangweaver Boots 6 RP
- **Mood:** M; 2 RP, free at a Mood Altar
- **Adaptive music:** N; local only
- **Beat:** 120 BPM; PERFECT ±40 ms; GOOD ±100 ms
- **RP:** 0–100, or 120 with chestplate; Horn 10; Bell 16; fan/rift 12
- **Fermata Bell:** usable from Adept grade (`150` lifetime RP)
- **Grades:** Novice 0; Adept 150; Virtuoso 400; Maestro 900; Composer 1,800;
  Conductor 3,600; Klangmeister 9,000 lifetime RP
- **Ensemble:** same beat, within 12 blocks, 10 seconds, +1 RP/action
- **Chord:** three on-beat moods, effect within 8 blocks
- **Crescendo route:** Organ Tower → Siren → ensembles/chords → Gardens →
  Archives → Maestro
- **SINFONIE route:** Score → Motifs → four regions → Bosswerk → Leitmotiv
  → Sound Forge → World Chord/Cascade
- **Region anchors:** `-900/129/0`, `900/129/0`, `0/129/900`,
  `0/129/1600`

## Credits

Aetherklang Team; built with Fabric Loader, Fabric API, and Yarn mappings for
Minecraft.
