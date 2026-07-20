# Aetherklang — English Handbook Summary

> **“The world has a voice. You are learning to play it.”**

The complete primary handbook is available in German at
[`HANDBUCH.md`](HANDBUCH.md). This summary covers the essential systems,
content, controls, and progression. The core game loop is fully playable:
all six items, all seven blocks, all four creatures (AI, loot, renderers),
the resonance HUD, the Kammerton dimension, and the Choral boss encounter.

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

RP ranges from **0 to 100** and survives death. Gains: +2 perfect action,
+2 on-beat Blade/Hammer hit, +3 on-beat Tuning Fork scan, +1 crystal tap,
+1 healing harp pulse. Costs: 2 mood cycle, 6 altar attunement, 8 dash,
12 blade fan, 12 rift seal, 24 portal toll (waived while carrying the Codex).

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
- **Codex of Resonance:** custom Tonarium handbook (23 folios, 9
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

Bottom-left resonance panel: mood icon and name, RP bar (`x / 100`),
metronome pendulum with a golden "TAKT" pulse in the perfect window, and a
DIS meter in percent. Beats are also audible as ticks, and a mood-colored
vignette with dissonance distortion frames the screen.

## Codex

Open the Codex with **K** or right-click the Codex item. It has 23 folios in
nine categories: Lore, Moods, Beat & RP, Instruments, Blocks, Creatures,
Dimension, Boss, and Tips. The welcome and tips folios are always open;
Survival players see synced unlock state; Creative mode opens every page.

## Controls

| Action | Default | Note |
| --- | --- | --- |
| Open Codex | **K** | also right-click with the Codex |
| Resonance Dash | **R** | requires worn Echo Boots; 8 RP, 3 s cooldown |
| Cycle mood | **M** | 2 RP (free in Creative) |
| Close Codex | **Esc** | game keeps running |

All keys are rebindable under the Aetherklang controls category.

## Advancements

First Resonance (obtain a crystal), Right on Beat (first perfect action),
A World With a Voice (open the Codex), Through the Glockenspiel (enter a
portal), Final Cadence (defeat Choral).

## Commands

- `/aetherklang`
- `/aetherklang rp get`
- `/aetherklang rp set <0..100>` (permission level 2)
- `/aetherklang rp add <-100..100>` (permission level 2)
- `/aetherklang mood <stille|freude|zorn|trauer|wunder>`
- `/aetherklang beat info`
- `/aetherklang codex unlock <0..255>` (permission level 2)
- `/aetherklang codex list`

Codex numeric IDs match the zero-based order in
`assets/aetherklang/kodex/pages.json`. Quick dev-test commands for the
Kammerton are listed in the German handbook and `README.md`.

## Credits

Aetherklang Team; built with Fabric Loader, Fabric API, and Yarn mappings for
Minecraft.
