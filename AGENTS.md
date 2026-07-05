# Monkey-Party

A colorful multiplayer party game (Mario-Party-inspired, fully original) themed around monkeys, jungle chaos, bananas, board games, and 50+ minigames. Built with Vite + three.js (client) and a Node `ws` server (online multiplayer).

## Cursor Cloud specific instructions

### Project location
- The entire app lives in the **`MONKEY-PARTY/`** subdirectory, not the repo root. Run all `npm` commands from `/workspace/MONKEY-PARTY` (or use `--prefix MONKEY-PARTY`).

### Running / testing (see `MONKEY-PARTY/package.json` for the source of truth)
- `npm run dev` — Vite dev client on port **5173** (`server.host` enabled). This is the main way to play/test; offline (local/couch + AI bots) works with the dev server alone, no backend needed.
- `npm run server` — authoritative WebSocket server on port **8081**. Only needed for **online** multiplayer; run it *alongside* `npm run dev`.
- `npm test` — runs `node --test tests/*.test.js`. Do **not** run `node --test tests/` (a bare directory arg fails on Node 22 with `MODULE_NOT_FOUND`); always use the glob form / the `npm test` script.
- `npm run lint` — eslint (flat config, lenient).

### Architecture gotchas (important, non-obvious)
- **`shared/` must stay pure & deterministic**: no DOM, no `three`, no `Math.random`, no `Date.now`. All randomness goes through the seeded RNG in `shared/rng.js`. This purity is load-bearing — the online server and every client run the *same* `shared/sim` deterministically and replicate board turns via event logs; any nondeterminism causes desyncs. `shared/` is imported by both client and server via the `#shared/*` package-imports alias.
- **Content is data-driven and self-registering**: boards (12), characters (16), items (14), minigames (51) are defs registered through `shared/registries.js`. `registerAllContent()` guards each content pack in try/catch so a missing/broken pack won't crash boot — check the boot console for `[content] registrars loaded: [...]` to confirm all four loaded, and the registry counts.
- **Client `src/` may import `#shared/*`, but `shared/` must never import `src/`.** three.js scene builders in `src/` guard optional sibling imports so modules load even mid-build.
- **The UI is the integration hub**: `src/ui/index.js` `buildUI(app)` (called by `src/main.js`) wires sessions, input, board-play view, and the minigame harness. `src/ui/matchController.js` orchestrates the board-phase ↔ minigame-phase flow. `src/app/session.js` exposes offline (local sim + bots) and online (server replica) sessions behind one `ISession` interface.
- Every human decision prompt auto-defaults (~20s client / 25s server) and minigames have hard duration caps, so a match can never hang waiting on input.

### Subagent model preference
- The project owner requires **`claude-fable-5-thinking-xhigh`** for all Task subagents (planning, building, testing, reviewing). Use that model slug when spawning subagents for this repo.
