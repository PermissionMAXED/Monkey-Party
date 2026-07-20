# Aetherklang Agent Notes

## Cursor Cloud specific instructions

- This is the isolated Fabric 1.21.9 project inside the larger checkout. Run all
  Gradle tasks from `/workspace/AETHERKLANG`; do not use the sibling product's
  build commands.
- The common and client code use Loom split environment source sets. Common
  code belongs in `src/main/java`; Minecraft client-only imports belong in
  `src/client/java`.
- Standard source generation, client startup, checks, and build commands are
  documented in `README.md`. There is no WP1 datagen run configuration because
  its minimal generated-equivalent assets are committed.
- A headless `runServer` smoke test needs the local, ignored `run/eula.txt` to
  contain `eula=true`. Leave a successful development server running when a
  follow-up agent may need to test against it.
- Minecraft 1.21.9 pauses an empty dedicated server after 60 seconds, including
  console command processing. For longer terminal-driven smoke tests, set the
  local, ignored `run/server.properties` value `pause-when-empty-seconds=-1`.
- Loom's client and server runs share the ignored `run/` directory, including
  `logs/latest.log`; run them one at a time when clean logs matter.
- If switching run targets leaves Loom reporting a missing
  `build/loom-cache/argFiles/runServer` (or `runClient`), rerun that target with
  `--no-configuration-cache`; a clean build is not required.
- Kammerton's authored arrival islands and all one-shot boss approach triggers
  are persisted in the dimension itself. Use a fresh development world (or
  reset only `run/world/dimensions/aetherklang/kammerton`) when validating
  first-entry generation or the arena triggers again; landmark teleport and
  summon commands are in `README.md`.
- The authored Stimmpfeiler route cycles Overworld, Bassgewölbe,
  Arpeggienmeer, Kakophonie-Riff, and Generalpause-Öde; normal use moves
  forward and sneak-use moves backward. Choral-Reprise is also persisted by
  hidden Kammerton block flags and only arms after both the normal Choral and
  Generalpause have died, so use a fresh dimension when retesting that gate.
- In Cursor Cloud the offline development client can log Mojang/Realms 401s and
  disable OpenAL because no account or audio device is attached. Those host
  limitations do not block rendering; use the client-ready and atlas-load log
  lines to confirm startup.
- Registry identifiers and payload directions in the `Mod*` registry classes
  are frozen integration contracts. Add implementations behind those constants
  rather than renaming them.
- Sinfonie JSON under `data/aetherklang/content` is decoded and frozen only at
  mod initialization; restart the client/server after edits. The type map,
  strict validation rules, and the extra registry work required for mob/boss
  definitions are documented in `docs/CONTENT_PIPELINE.md`.
- Klangwerk JSON under `data/aetherklang/klangwerk` is a separate, atomic
  server-data reload catalog. Use `/aetherklang klangwerk reload` for a focused
  reload and `/aetherklang klangwerk dump` to inspect the installed snapshot;
  schema and path validation rules are documented in `docs/CONTENT_PIPELINE.md`.
- Sinfonie smoke commands are `/aetherklang partitur`,
  `/aetherklang kaskade start|status`, and `/aetherklang klangwerk dump|reload`.
  The fixed Klangmeer anchors are Bassgewölbe `-900/129/0`, Arpeggienmeer
  `900/129/0`, Kakophonie-Riff `0/129/900`, and Generalpause-Öde
  `0/129/1600` in `aetherklang:kammerton`; the elite boss islands are
  Ostinato `-360/129/2000` and Ritardando `360/129/2000`.
- `tools/generate_sinfonie_content.py` is the deterministic source for the
  large Motiv/Kodex/contract/relic/advancement/recipe JSON set. Regenerate
  after changing its tables; the script validates minimum counts and can be
  run repeatedly without accumulating output.
- A fresh development world composes 120 Klangmeer islands (roughly 166,000
  blocks) before the server reports `Done`; this can take about one minute in
  Cursor Cloud. Do not mistake that bounded first-world generation for a hang.
- The outer **Fermatenring** belt adds another 100 islands (80–120 target band;
  currently 100) between roughly 1300–2100 blocks from center. Generation
  completes only after both `GENERATION_MARKER` and `FERMATENRING_MARKER` are
  lodestones.
- `tools/generate_palette_textures.py` batch-generates unique palette-shifted
  PNGs for items/blocks that still pointed at Minecraft placeholders; rerun
  after adding new stub models.
- The client Kodex still loads the single
  `assets/aetherklang/kodex/pages.json`; preserve existing order because list
  indices are persisted folio IDs, and add matching keys to both language files.
