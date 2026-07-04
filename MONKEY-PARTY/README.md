# MONKEY-PARTY

A Mario-Party-style 3D browser party game: monkeys, jungle, bananas. 2-8
players hop around boards, roll dice, buy items, and battle it out in
minigames for golden bananas.

Built with **Vite + three.js + vanilla JS ES modules** on the client and a
**Node + `ws`** server for online play. No frameworks.

## Status

This repository currently contains the **foundation package (P1)**: shared
contracts, protocol, RNG, rules, registries, client boot/session/screen
plumbing, and stores. Content packages (boards, characters, items,
minigames), the match sim, AI, engine, net, and UI packages plug into these
foundations. The app boots standalone and shows a placeholder screen with
registry counts until those packages exist.

## Getting started

```bash
npm install

npm run dev      # Vite dev server -> http://localhost:5173
npm run server   # Node ws game server (requires the server/ package)
npm test         # node --test tests/
npm run lint     # eslint .
```

## Controls (planned)

| Input                       | Action                          |
| --------------------------- | ------------------------------- |
| WASD / arrow keys / d-pad   | Move (InputFrame.move)          |
| Space / Enter / gamepad A   | Primary action (InputFrame.a)   |
| Shift / Backspace / gamepad B | Secondary action (InputFrame.b) |
| Mouse / right stick         | Aim (InputFrame.aim)            |

Local multiplayer supports multiple seats per device; seat-to-device
bindings live in the settings store.

## Project layout

```
index.html            Canvas + UI overlay + loading screen
src/
  main.js             Client boot: content -> engine -> UI
  app/
    screenRouter.js   DOM-overlay screen manager with fade transitions
    session.js        ISession: offline (local sim + bots) & online (replica)
    settingsStore.js  localStorage settings (volumes, quality, language, ...)
    profileStore.js   localStorage profile (name, stats, golden bananas, ...)
  styles/main.css     Dark jungle theme
shared/               PURE ESM - no DOM, no three.js, no Math.random, no Date.now
  types.js            JSDoc contracts every package depends on (EXACT shapes)
  constants.js        Phases, node types, categories, tick rate, ...
  protocol.js         MSG/SRV message maps, encode/decode, validators
  registry.js         createRegistry(name)
  registries.js       boards/characters/items/minigames singletons
  events.js           SimEvent type constants + tiny emitter
  rng.js              Deterministic mulberry32 RNG (serializable state)
  rules.js            DEFAULT_RULES, PRESETS, validateRules()
  content/index.js    registerAllContent() - tolerant of missing packages
tests/                node:test suites (registry, protocol)
```

## Conventions

- `#shared/*` resolves to `shared/*` in both Node (package.json `imports`)
  and Vite (resolve alias) - use it instead of relative paths across
  package boundaries.
- Everything under `shared/` must stay deterministic and environment-free
  so the match sim can run identically on client and server: no DOM, no
  three.js, no `Math.random`, no `Date.now`.
- All randomness in sims flows through `shared/rng.js`
  (`createRng(seed)`), whose state serializes into match snapshots.
- Network messages are JSON `{ t, v, ...payload }` with
  `v = PROTOCOL_VERSION` (see `shared/protocol.js`).
- Minigame sims step at a fixed 30Hz; `step()` advances exactly 1/30s.

## Rule presets

`shared/rules.js` ships `party` (defaults), `fast`, `chaos`, `hardcore`,
and `competitive`. Competitive forces random events off, items to
`allSame`, and filters out content marked `competitiveSafe: false`.
