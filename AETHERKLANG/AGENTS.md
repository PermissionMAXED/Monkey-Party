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
  `0/129/1600` in `aetherklang:kammerton`.
- The client Kodex still loads the single
  `assets/aetherklang/kodex/pages.json`; preserve existing order because list
  indices are persisted folio IDs, and add matching keys to both language files.
