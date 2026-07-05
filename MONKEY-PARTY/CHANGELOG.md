# Changelog

All notable changes to MONKEY-PARTY are documented here. The format loosely
follows [Keep a Changelog](https://keepachangelog.com/); versions follow
semantic versioning.

## [1.0.0] - 2026-07-05

First stable release. This is the umbrella release for the alpha -> 1.0
push, bundling the work of the parallel feature packages into one shippable
game.

### Highlights

- **Content complete**: 12 boards, 16 playable monkeys with perks and
  cosmetics, 14 items, and 51+ minigames across all six categories
  (ffa / 2v2 / 1v3 / team / duel / boss).
- **Audio-visual polish**: post-processing pipeline, particles, transitions,
  camera direction, procedural music and SFX per board theme, and quality
  presets so low-end machines stay smooth.
- **Onboarding**: in-game How to Play manual (party flow, boards, items,
  minigames, online) and a credits roll; language toggle (EN/DE) right on
  the main menu.
- **Progression**: lifetime profile stats, Golden Banana bank, and
  cosmetic/character unlocks that persist across matches.
- **Tournament & competitive play**: `competitive` rules preset (dice
  draft, no random events, `allSame` items, competitive-safe content
  filter) plus rule presets `party`, `fast`, `chaos`, `hardcore`.
- **Batch-3 minigames**: the roster grows past 51 with the third minigame
  batch, including new template variants.
- **Accessibility**: colorblind assist, per-seat control bindings,
  auto-defaulting decision prompts (no soft-locks), and reduced-motion
  friendly UI.
- **Online hardening**: protocol version checks, heartbeats, per-connection
  rate limiting, malformed-frame tolerance, mid-match reconnect with resume
  tokens, bot seat-covering for dropped players, and deterministic
  client-side replicas verified against the server event log.

### Release engineering (this package)

- Production build via `npm run build` (Vite): the guarded dynamic-import
  architecture is bundled through a config-level plugin so all content
  registrars and optional packages load from hashed chunks.
- `npm run preview` serves the built client for pre-release smoke tests.
- New release QA suites: full-match headless e2e (`tests/e2e-match.test.js`),
  cross-sim determinism record/replay (`tests/determinism.test.js`),
  localization audit (`tests/i18n-audit.test.js`), and build output smoke
  test (`tests/build-smoke.test.js`).
- CI workflow (GitHub Actions, Node 22): `npm ci && npm run lint && npm test
  && npm run build`.
- Deployment guide: [docs/DEPLOY.md](docs/DEPLOY.md).
- `src/app/version.js` exposes `VERSION` / `BUILD_STAMP`.

## [0.1.0]

- Foundation package: shared contracts, protocol, seeded RNG, rules,
  registries, client boot/session/screen plumbing, and stores.
