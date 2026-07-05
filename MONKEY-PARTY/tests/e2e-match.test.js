/**
 * Release QA: HEADLESS FULL-MATCH E2E (release engineering package).
 *
 * Boots the REAL content (registerAllContent: 12 boards, 16 characters,
 * 14 items, 51+ minigames), then plays complete matches the way the app
 * does offline:
 *   - every state.awaiting decision is answered by the board bot
 *     (decideBoardAction), exactly like src/app/session.js,
 *   - every minigame phase runs the SELECTED minigame's real sim to
 *     completion with def.bot() inputs and submits sim.getResults() via a
 *     'minigameResults' action (mirroring session.js startMinigameRunner).
 *
 * Asserts per match: reaches 'game_over' within a sane action budget (no
 * hang), a winner exists, and coins/bananas never go negative. Runs 3
 * seeds x 2 real boards.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { registerAllContent } from '#shared/content/index.js';
import { boards, minigames } from '#shared/registries.js';
import { createMatchSim } from '#shared/sim/match.js';
import { decideBoardAction } from '#shared/ai/boardBot.js';
import { createRng } from '#shared/rng.js';
import { PHASES, DECISION_TYPES } from '#shared/constants.js';

const report = await registerAllContent();

/** Hard cap on board actions applied per match (hang detection). */
const ACTION_BUDGET = 5000;
/** Extra ticks past the duration cap a minigame may need to wrap up. */
const MINIGAME_TICK_SLACK = 300;
const MINIGAME_HZ = 30;

const SEEDS = [0xC0FFEE, 0xB0B0, 424242];

const BOT_PLAYERS = [
  { id: 'p1', name: 'Bongo', isBot: true, difficulty: 'easy' },
  { id: 'p2', name: 'Kiki', isBot: true, difficulty: 'normal' },
  { id: 'p3', name: 'Mango', isBot: true, difficulty: 'hard' },
  { id: 'p4', name: 'Chimpy', isBot: true, difficulty: 'wild' },
];

/** Two real boards (prefer the flagship pair, fall back to whatever exists). */
function pickBoardIds() {
  const available = boards.all().map((b) => b.id);
  const preferred = ['jungle_ruins', 'volcano_island'].filter((id) => available.includes(id));
  return preferred.length === 2 ? preferred : available.slice(0, 2);
}

/**
 * Run the pending minigame's REAL sim headlessly with bot inputs (the same
 * loop as session.js startMinigameRunner) and return its results.
 */
function runMinigame(state, mgSeed) {
  const mg = state.minigame;
  const def = minigames.get(mg.pendingId);
  assert.ok(def, `selected minigame "${mg.pendingId}" must be registered`);

  const players = Array.isArray(mg.teams) ? mg.teams.flat() : state.turnOrder.slice();
  const sim = def.createSim({
    seed: mgSeed,
    players,
    params: { ...def.params, ...(mg.params ?? {}) },
    rules: state.rules,
  });
  sim.init();

  const rngs = new Map();
  players.forEach((pid, i) => rngs.set(pid, createRng((mgSeed + i * 7919) >>> 0)));

  const cap = def.durationSec * MINIGAME_HZ + MINIGAME_TICK_SLACK;
  let ticks = 0;
  while (!sim.isFinished() && ticks < cap) {
    const mgState = sim.getState();
    const inputs = {};
    for (const pid of players) {
      const difficulty = state.players[pid]?.difficulty ?? 'normal';
      inputs[pid] = def.bot(mgState, pid, difficulty, rngs.get(pid));
    }
    sim.step(inputs);
    ticks += 1;
  }
  assert.ok(sim.isFinished(), `minigame "${mg.pendingId}" must finish within its duration cap (${ticks}/${cap} ticks)`);

  const results = sim.getResults();
  assert.ok(Array.isArray(results?.ranking) && results.ranking.length > 0,
    `minigame "${mg.pendingId}" results must contain a ranking`);
  return { results, reporter: players[0] };
}

/** Play a full match to game_over; returns {applies, minigamesPlayed}. */
function playMatch(sim, botRng) {
  let applies = 0;
  let minigamesPlayed = 0;
  while (applies < ACTION_BUDGET) {
    const state = sim.getState();
    assert.ok(PHASES.includes(state.phase), `unknown phase "${state.phase}"`);
    if (state.phase === 'game_over') return { applies, minigamesPlayed };

    if (state.phase === 'minigame') {
      // Deterministic per-minigame seed (mirrors session.js rng.fork usage).
      const mgSeed = botRng.fork(`mg:${state.minigame.pendingId}:${state.round}`).state();
      const { results, reporter } = runMinigame(state, mgSeed);
      sim.apply({ type: 'minigameResults', playerId: reporter, payload: { results } });
      minigamesPlayed += 1;
      applies += 1;
      continue;
    }

    const awaiting = state.awaiting;
    assert.ok(awaiting, `sim stalled in phase "${state.phase}" with no awaiting decision`);
    assert.ok(DECISION_TYPES.includes(awaiting.decision), `unknown decision "${awaiting.decision}"`);
    const legal = sim.legalActions(awaiting.playerId);
    assert.ok(legal.length > 0, `no legal actions for awaiting "${awaiting.decision}"`);
    const difficulty = state.players[awaiting.playerId].difficulty ?? 'normal';
    const action = decideBoardAction(state, legal, awaiting.playerId, difficulty, botRng);
    assert.ok(legal.includes(action), 'board bot must return one of the legal actions');
    sim.apply(action);
    applies += 1;
  }
  assert.fail(`match did not reach game_over within ${ACTION_BUDGET} actions`);
}

/* ------------------------------------------------------------------ */
/* Suite                                                               */
/* ------------------------------------------------------------------ */

test('registerAllContent loads all four content packs with release counts', () => {
  assert.deepEqual(report.missing, [], 'no content registrar may be missing in a release build');
  assert.ok(boards.count() >= 12, `expected >= 12 boards, got ${boards.count()}`);
  assert.ok(minigames.count() >= 51, `expected >= 51 minigames, got ${minigames.count()}`);
});

for (const boardId of pickBoardIds()) {
  for (const seed of SEEDS) {
    test(`e2e: full bot match on "${boardId}" (seed ${seed}) reaches game_over sanely`, () => {
      const sim = createMatchSim({
        seed,
        boardId,
        rules: { rounds: 8 },
        players: BOT_PLAYERS.map((p) => ({ ...p })),
      });
      const { applies, minigamesPlayed } = playMatch(sim, createRng(seed ^ 0x5EED));

      const state = sim.getState();
      assert.equal(state.phase, 'game_over');
      assert.equal(state.awaiting, null);
      assert.ok(applies < ACTION_BUDGET, `finished within budget (${applies} actions)`);
      assert.ok(minigamesPlayed > 0, 'at least one real minigame was played');

      // A winner exists and is one of the players.
      const over = sim.getEventLog().filter((e) => e.type === 'game_over');
      assert.equal(over.length, 1, 'exactly one game_over event');
      assert.ok(state.turnOrder.includes(over[0].winner), 'winner is a real player');
      assert.equal(over[0].ranking.length, state.turnOrder.length);

      // Coins and bananas are non-negative for everyone, at the end...
      for (const pid of state.turnOrder) {
        assert.ok(state.players[pid].coins >= 0, `${pid} coins >= 0`);
        assert.ok(state.players[pid].goldenBananas >= 0, `${pid} bananas >= 0`);
      }
      // ...and along the way (every emitted coin total is clamped).
      for (const evt of sim.getEventLog().filter((e) => e.type === 'coins')) {
        assert.ok(evt.total >= 0, 'coin totals must never go negative');
      }
    });
  }
}
