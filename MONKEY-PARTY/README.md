# MONKEY-PARTY

A Mario-Party-style 3D browser party game — fully original, themed around
monkeys, jungle chaos, and bananas. 2–8 players hop across boards, roll
dice, buy items, set traps, and battle through minigames for Golden
Bananas. Play on the couch, online, or against bots.

Built with **Vite + three.js + vanilla JS ES modules** on the client and a
**Node + `ws`** authoritative server for online play. No frameworks.

## What's in the box (1.0)

- **12 boards** — from Jungle Ruins and Volcano Island to Neon Monkey City,
  Ghost Jungle, and Gorilla Palace, each with its own theme, events, board
  mechanics, and boss event.
- **16 playable monkeys** — each with a perk and unlockable cosmetics
  (hats, skins, accessories) bought with lifetime Golden Bananas.
- **14 items** — movement boosters, traps, curses, steals, shields, and
  the coveted Golden Ticket.
- **51+ minigames** across six categories (free-for-all, 2v2, 1v3, team,
  duel, boss), all deterministic 30 Hz sims with bot support.
- **Couch play** — up to 8 local seats sharing keyboards/gamepads; empty
  seats are auto-filled with bots (four difficulty levels).
- **Online play** — quick match, public lobby browser, private lobbies
  with join codes, chat, emotes, mid-match reconnect; the server and every
  client run the same deterministic sim in lockstep.
- **Competitive mode** — a rules preset that disables random events,
  levels item access (`allSame`), drafts dice instead of rolling, and
  filters out content marked `competitiveSafe: false`.
- **Rule presets** — `party` (default), `fast`, `chaos`, `hardcore`, and
  `competitive`, plus a full custom-rules editor.
- **English + German** localization, colorblind assist, per-seat controls,
  and an in-game How to Play manual.

## Getting started

```bash
npm install

npm run dev      # Vite dev server -> http://localhost:5173
npm run server   # Node ws game server on :8081 (online play only)
npm test         # node --test tests/*.test.js
npm run lint     # eslint .
```

Offline (local/couch + bots) play needs only `npm run dev`. Run
`npm run server` alongside it for online multiplayer.

## Production build

```bash
npm run build    # vite build -> dist/
npm run preview  # serve the built client on http://localhost:5174
```

The built client is a fully static bundle; the game server is a separate
Node process. See [docs/DEPLOY.md](docs/DEPLOY.md) for static hosting, the
server-URL resolution convention (`VITE_MP_SERVER` / `?server=`),
reverse-proxy TLS notes, and operational caveats.

## Controls

| Input                         | Action                          |
| ----------------------------- | ------------------------------- |
| WASD / arrow keys / d-pad     | Move (InputFrame.move)          |
| Space / Enter / gamepad A     | Primary action (InputFrame.a)   |
| Shift / Backspace / gamepad B | Secondary action (InputFrame.b) |
| Mouse / right stick           | Aim (InputFrame.aim)            |

Local multiplayer supports multiple seats per device; seat-to-device
bindings live in the settings store, and the in-game How to Play screen
lists the per-seat keyboard layouts.

## Project layout

```
index.html            Canvas + UI overlay + loading screen
src/
  main.js             Client boot: content -> engine -> UI
  app/                Screen router, sessions, stores, version
  engine/             three.js renderer, input, audio/music, quality, FX
  ui/                 Menus, lobby, HUD, match controller, i18n (en/de)
  boardplay/          3D board-play view (tokens, dice, camera director)
  boards/ characters/ minigames/   3D views for the shared content defs
  net/                ws client (reconnect, resume tokens)
server/               Authoritative Node ws server (lobbies, rooms, bots)
shared/               PURE ESM - no DOM, no three.js, no Math.random/Date.now
  types.js            JSDoc contracts every package depends on
  constants.js        Phases, node types, categories, tick rate, ...
  protocol.js         MSG/SRV message maps, encode/decode, validators
  registries.js       boards/characters/items/minigames singletons
  rng.js              Deterministic mulberry32 RNG (serializable state)
  rules.js            DEFAULT_RULES, PRESETS, validateRules()
  sim/                The deterministic board-match simulation
  ai/                 Board bot + difficulty profiles
  minigames/          Minigame framework, selection, and all sims
  content/            Board/character/item defs + registerAllContent()
tests/                node:test suites (sim, server, content, e2e, ...)
docs/                 DEPLOY.md and other documentation
```

## Conventions

- `#shared/*` resolves to `shared/*` in both Node (package.json `imports`)
  and Vite (resolve alias) — use it instead of relative paths across
  package boundaries.
- Everything under `shared/` must stay deterministic and environment-free
  so the match sim can run identically on client and server: no DOM, no
  three.js, no `Math.random`, no `Date.now`.
- All randomness in sims flows through `shared/rng.js`
  (`createRng(seed)`), whose state serializes into match snapshots.
- Network messages are JSON `{ t, v, ...payload }` with
  `v = PROTOCOL_VERSION` (see `shared/protocol.js`).
- Minigame sims step at a fixed 30Hz; `step()` advances exactly 1/30s.
- Optional sibling modules are loaded via guarded dynamic imports
  (`@vite-ignore`), so the app boots even while a package is missing; the
  production build resolves these through a Vite plugin (see
  `vite.config.js`).

## Versioning

`src/app/version.js` exports `VERSION` (keep in sync with `package.json`)
and a `BUILD_STAMP`. Release notes live in [CHANGELOG.md](CHANGELOG.md).
