# Monkey-Party

A colorful multiplayer party game (Mario-Party-inspired, fully original) themed around monkeys, jungle chaos, bananas, board games, and 50+ minigames. Built with Vite + three.js (client) and a Node `ws` server (online multiplayer).

## Cursor Cloud specific instructions

### Project location
- The entire app lives in the **`MONKEY-PARTY/`** subdirectory, not the repo root. Run all `npm` commands from `/workspace/MONKEY-PARTY` (or use `--prefix MONKEY-PARTY`).

### Running / testing (see `MONKEY-PARTY/package.json` for the source of truth)
- `npm run dev` — Vite dev client on port **5173** (`server.host` enabled). This is the main way to play/test; offline (local/couch + AI bots), Tournament and Practice modes all work with the dev server alone, no backend needed.
- `npm run server` — authoritative WebSocket server on port **8081**. Only needed for **online** multiplayer; run it *alongside* `npm run dev`.
- `npm run build` / `npm run preview` — production build + preview (port 5174). The build works despite the guarded `@vite-ignore` dynamic imports because `vite.config.js` has a `guardedDynamicImports` plugin that rewrites them to `import.meta.glob` lookups; if you add new guarded dynamic imports, re-verify `npm run build` + `npm run preview` boot.
- `npm test` — runs `node --test tests/*.test.js` (~951 tests). Do **not** run `node --test tests/` (a bare directory arg fails on Node 22 with `MODULE_NOT_FOUND`); always use the glob form / the `npm test` script.
- `npm run lint` — eslint (flat config, lenient). CI (`.github/workflows/ci.yml`, repo root) runs lint + test + build on Node 22.
- Content counts at boot (dev console table): 12 boards, 16 characters, 14 items, **59 minigames** — if any is short, a content registrar failed to load.

### 1.0 feature/integration conventions (non-obvious)
- **Optional UI packages load via a guarded loader** in `src/ui/index.js`: modules at fixed paths (`./help/index.js`, `./netStatus.js`, `./progression/index.js`, `./tournament/index.js`) default-export `register(ctx)` and may return `{ menuItems }` rendered on the main menu. New optional screens should follow this pattern so the app degrades gracefully if one is absent.
- **i18n**: each UI package keeps a local `*Strings.js` (or `strings.js`) dict registered via `i18n.extendDict?.(dict)`; core-screen keys live directly in `src/ui/i18n.js` `DICT`. `tests/i18n-audit.test.js` enforces en+de coverage across all `*Strings.js`/`strings.js` and `t/ts/tm/tNet(...)` call sites — run it after adding strings.
- **Accessibility is real**: reduced-motion (CSS + `engine.fx` + choreography timing), text scale, and colorblind modes recolor **both** HUD (CSS `--mp-p1..p8`) and 3D tokens/minigame colors (`src/app/playerPalette.js`). Keep gameplay colors sourced from the palette module, not hardcoded.
- **Engine juice hooks** are optional-chained: `engine.fx?.shake/flash/hitStop`, `ctx.music?.setIntensity/stinger`. `shared/` must never depend on them.

### Architecture gotchas (important, non-obvious)
- **`shared/` must stay pure & deterministic**: no DOM, no `three`, no `Math.random`, no `Date.now`. All randomness goes through the seeded RNG in `shared/rng.js`. This purity is load-bearing — the online server and every client run the *same* `shared/sim` deterministically and replicate board turns via event logs; any nondeterminism causes desyncs. `shared/` is imported by both client and server via the `#shared/*` package-imports alias.
- **Content is data-driven and self-registering**: boards (12), characters (16), items (14), minigames (59) are defs registered through `shared/registries.js`. `registerAllContent()` guards each content pack in try/catch so a missing/broken pack won't crash boot — check the boot console for `[content] registrars loaded: [...]` to confirm all four loaded, and the registry counts.
- **Client `src/` may import `#shared/*`, but `shared/` must never import `src/`.** three.js scene builders in `src/` guard optional sibling imports so modules load even mid-build.
- **The UI is the integration hub**: `src/ui/index.js` `buildUI(app)` (called by `src/main.js`) wires sessions, input, board-play view, and the minigame harness. `src/ui/matchController.js` orchestrates the board-phase ↔ minigame-phase flow. `src/app/session.js` exposes offline (local sim + bots) and online (server replica) sessions behind one `ISession` interface.
- Every human decision prompt auto-defaults (~20s client / 25s server) and minigames have hard duration caps, so a match can never hang waiting on input.

### Aetherklang (second product in this repo)
- **Aetherklang** is a separate Fabric 1.21.9 Minecraft mod living entirely in the **`AETHERKLANG/`** subdirectory (mod id `aetherklang`, JDK 21, Gradle + Fabric Loom). It shares nothing with MONKEY-PARTY — **never mix their build commands, and do not break MONKEY-PARTY** when working on Aetherklang (and vice versa).
- Run all Gradle tasks from `/workspace/AETHERKLANG`: `./gradlew build` to verify/build (do **not** combine `clean build` in the same invocation — a known Loom pitfall; run `./gradlew clean` separately first if you really need it), `./gradlew runClient` for the dev client, `./gradlew runServer` for a headless server (needs `run/eula.txt` with `eula=true`).
- Gameplay/docs source of truth: keybinds are **K** (open Kodex), **R** (Resonance Dash, requires worn Echostiefel, 8 RP; 6 with Klangweber boots), **M** (cycle mood, 2 RP), **N** (toggle adaptive music, client-local; registered under the vanilla **MISC** keybind category, not Aetherklang — reusing the mod category id crashes with a duplicate-category collision). Beat is 120 BPM with ±40 ms perfect / ±100 ms good windows; RP is 0–100 (120 with the Klangweber chestplate). The player-facing product bible is `AETHERKLANG/docs/HANDBUCH.md` (German, primary) with an English summary in `AETHERKLANG/docs/HANDBOOK.md` — keep both in sync with code when mechanics change. More agent notes in `AETHERKLANG/AGENTS.md`.
- Crescendo expansion (all playable): ensembles + mood chords, lifetime-RP grades (Novize/Adept/Virtuose/Maestro), Orgelhorn + Fermatenglocke instruments (Fermatenglocke gated on Adept, 150 lifetime RP), Klangweber armor set, Sirene + Taktling creatures, Tonarium gardens/bridges/archives, aurora/ripple/beam FX, and an adaptive music sequencer. To inspect the Tonarium expansion in-game: `/execute in aetherklang:kammerton run tp @s 0 129 272` (Resonance Garden ring) and `/execute in aetherklang:kammerton run tp @s 0 142 394` (central Crystal Archive; the other two archives are near `-68 137 342` and `68 137 342`).

### Subagent model preference
- The project owner requires **`claude-fable-5-thinking-xhigh`** for all Task subagents (planning, building, testing, reviewing). Use that model slug when spawning subagents for this repo.
