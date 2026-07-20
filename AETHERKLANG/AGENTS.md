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
- Kammerton's authored arrival islands and first Choral approach trigger are
  persisted in the dimension itself. Use a fresh development world (or reset
  only `run/world/dimensions/aetherklang/kammerton`) when validating first-entry
  generation or the one-shot arena trigger again; quick test commands are in
  `README.md`.
- In Cursor Cloud the offline development client can log Mojang/Realms 401s and
  disable OpenAL because no account or audio device is attached. Those host
  limitations do not block rendering; use the client-ready and atlas-load log
  lines to confirm startup.
- Registry identifiers and payload directions in the `Mod*` registry classes
  are frozen integration contracts. Add implementations behind those constants
  rather than renaming them.
