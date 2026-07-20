# Aetherklang — English Handbook Summary

> **“The world has a voice. You are learning to play it.”**

The complete primary handbook is available in German at
[`HANDBUCH.md`](HANDBUCH.md). This summary covers the essential systems,
content, controls, and progression.

## Premise

The Aetherklang is the hidden world-song running through stone, water,
crystal, and living beings. Choral, once guardian of its great cadence, tore
voices from their context and forged **Dissonance**. You are a Resonant: an
adventurer who can hear the underlying beat, collect Resonance Points, and
answer broken sound with deliberate action.

## Core loop

1. Find resonance crystals.
2. Craft a Tuning Fork and Codex.
3. Learn the 120 BPM world beat.
4. Build RP through precise actions.
5. Spend RP on instrument abilities.
6. Close Dissonance Rifts and collect all four crystal colors.
7. Open a Glockenspiel Portal.
8. Explore the planned Tonarium dimension and confront Choral.

## Five moods

| Mood | Focus |
| --- | --- |
| **Silence** | Preparation and reduced mob notice radius |
| **Joy** | A small healing aura for nearby players |
| **Wrath** | Offensive integrations with a 10% damage multiplier |
| **Sorrow** | Resistance-oriented integrations that halve slowing impact |
| **Wonder** | Luck and exploratory note effects |

Moods are stances, not locked classes. The registered default cycle key is
**M**; commands can set each mood directly.

## Beat and RP

The authoritative beat runs at **120 BPM**, one beat every **500 ms**.

| Rating | Window |
| --- | ---: |
| **Perfect** | within ±40 ms |
| **Good** | within ±100 ms |
| **Miss** | outside ±100 ms |

RP ranges from **0 to 100**. Connected perfect actions currently award 2 RP;
the Tuning Fork and Resonance Blade also provide concrete on-beat gains.
Special abilities spend RP only when activated successfully.

## Content overview

### Items

- **Tuning Fork:** scans nearby resonance sources; playable.
- **Resonance Blade:** on-beat bonus and a 12-RP cone slash; playable.
- **Echo Harp:** planned ranged control/support instrument.
- **Bass Hammer:** planned heavy posture and shockwave instrument.
- **Echo Boots:** planned Resonance Dash mobility item.
- **Codex of Resonance:** playable custom Tonarium handbook.

### Blocks

Four Resonance Crystals—Indigo, Cyan, Gold, and Magenta—represent base tone,
conduction, timing, and bound dissonance. The Mood Altar, Dissonance Rift,
and Glockenspiel Portal are registered content foundations for mood
attunement, encounters, and dimension progression.

### Creatures

The Dissonance Spirit, Echo Guardian, Echo Note, and Choral entity types are
registered. Their full AI, encounters, models, and loot remain planned.
Choral is the intended multi-phase final boss.

## Codex

Open the Codex with **K** or use the Codex item. It has nine categories:
Lore, Moods, Beat & RP, Instruments, Blocks, Creatures, Dimension, Boss, and
Tips. Survival players see persistent unlock state; Creative mode opens every
page. Use the index, page buttons, and previous/next arrows to navigate.

## Controls

| Action | Default |
| --- | --- |
| Open Codex | **K** |
| Resonance Dash | **R** |
| Cycle mood | **M** |
| Close Codex | **Esc** |

All keys are rebindable under the Aetherklang controls category.

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
`assets/aetherklang/kodex/pages.json`.

## Credits

Aetherklang Team; built with Fabric Loader, Fabric API, and Yarn mappings for
Minecraft.
