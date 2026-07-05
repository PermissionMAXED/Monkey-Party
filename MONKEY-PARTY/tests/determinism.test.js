/**
 * Release QA: DETERMINISM record/replay (release engineering package).
 *
 * The whole online architecture rests on shared/ being deterministic: the
 * server and every client replay the same action log through identical
 * sims. This suite locks that guarantee down for the release:
 *
 * 1. Match record/replay: for N seeds, build TWO sims from an identical
 *    {seed, rules, boardId, players} config, drive sim A with a scripted
 *    bot, replay every recorded action into sim B, and assert getState()
 *    snapshots + emitted event batches are deeply equal at EVERY step
 *    (plus the full event logs at the end).
 *
 * 2. Minigame lockstep fuzz: one registered minigame per category, two
 *    sims stepped in lockstep with an identical fixed-seed input script;
 *    per-tick states and final results must be identical.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { registerAllContent } from '#shared/content/index.js';
import { boards, minigames } from '#shared/registries.js';
import { createMatchSim } from '#shared/sim/match.js';
import { decideBoardAction } from '#shared/ai/boardBot.js';
import { createRng } from '#shared/rng.js';
import { DEFAULT_RULES } from '#shared/rules.js';

await registerAllContent();

const SEEDS = [1, 0xBEEF, 20260705, 0x5EED5, 987654321]; // N = 5
const ACTION_BUDGET = 5000;
const MINIGAME_HZ = 30;

const PLAYERS = [
  { id: 'p1', name: 'A', isBot: true, difficulty: 'normal' },
  { id: 'p2', name: 'B', isBot: true, difficulty: 'normal' },
  { id: 'p3', name: 'C', isBot: true, difficulty: 'hard' },
  { id: 'p4', name: 'D', isBot: true, difficulty: 'easy' },
];

function boardId() {
  const available = boards.all().map((b) => b.id);
  return available.includes('jungle_ruins') ? 'jungle_ruins' : available[0];
}

function makeSim(seed) {
  return createMatchSim({
    seed,
    boardId: boardId(),
    rules: { rounds: 6 },
    players: PLAYERS.map((p) => ({ ...p })),
  });
}

const clone = (v) => JSON.parse(JSON.stringify(v));

/**
 * Scripted decision source for sim A: board bot for awaiting decisions,
 * synthetic-but-deterministic results for minigame phases (the minigame
 * sims get their own dedicated lockstep fuzz below).
 */
function nextAction(state, sim, scriptRng) {
  if (state.phase === 'minigame') {
    const ranking = scriptRng.shuffle(state.turnOrder);
    const coins = {};
    ranking.forEach((pid, i) => { coins[pid] = Math.max(0, 10 - i * 3); });
    return {
      type: 'minigameResults',
      playerId: state.turnOrder[0],
      payload: { results: { ranking, coins, stats: {} } },
    };
  }
  const awaiting = state.awaiting;
  assert.ok(awaiting, `sim stalled in phase "${state.phase}"`);
  const legal = sim.legalActions(awaiting.playerId);
  const difficulty = state.players[awaiting.playerId].difficulty ?? 'normal';
  const action = decideBoardAction(state, legal, awaiting.playerId, difficulty, scriptRng);
  assert.ok(legal.includes(action), 'scripted bot must pick a legal action');
  return action;
}

for (const seed of SEEDS) {
  test(`determinism: record/replay match (seed ${seed}) - equal state + events at every step`, () => {
    const simA = makeSim(seed);
    const simB = makeSim(seed);
    const scriptRng = createRng(seed ^ 0xD00D);

    // Identical starting snapshots before any action.
    assert.deepEqual(clone(simA.getState()), clone(simB.getState()));

    let steps = 0;
    while (simA.getState().phase !== 'game_over') {
      assert.ok(steps < ACTION_BUDGET, 'match must terminate');
      const stateA = simA.getState();
      const action = nextAction(stateA, simA, scriptRng);

      // Record from A, replay the identical action into B.
      const resultA = simA.apply(clone(action));
      const resultB = simB.apply(clone(action));

      // Event batches and public snapshots must match at every step.
      assert.deepEqual(clone(resultA.events), clone(resultB.events),
        `event batch diverged at step ${steps} (${action.type})`);
      assert.deepEqual(clone(simA.getState()), clone(simB.getState()),
        `state snapshot diverged at step ${steps} (${action.type})`);
      steps += 1;
    }

    // Full histories are byte-identical too.
    assert.equal(JSON.stringify(simA.getEventLog()), JSON.stringify(simB.getEventLog()));
    assert.equal(simB.getState().phase, 'game_over');
  });
}

/* ------------------------------------------------------------------ */
/* Minigame lockstep fuzz: one sim per category                        */
/* ------------------------------------------------------------------ */

/** First (by id) registered minigame of each category present in the registry. */
function representativePerCategory() {
  const byCategory = new Map();
  for (const def of [...minigames.all()].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!byCategory.has(def.category)) byCategory.set(def.category, def);
  }
  return [...byCategory.values()];
}

function playerListFor(def) {
  const n = Math.min(Math.max(4, def.players.min), def.players.max);
  return Array.from({ length: n }, (_, i) => `p${i + 1}`);
}

for (const def of representativePerCategory()) {
  test(`determinism: minigame "${def.id}" (${def.category}) - lockstep runs are identical`, () => {
    const seed = 0xF00D ^ def.id.length;
    const players = playerListFor(def);
    const cfg = () => ({
      seed,
      players: players.slice(),
      params: clone(def.params ?? {}),
      rules: { ...DEFAULT_RULES },
    });
    const simA = def.createSim(cfg());
    const simB = def.createSim(cfg());
    simA.init();
    simB.init();

    // Fixed-seed input script: inputs derive from sim A's public state via
    // the def bot; the SAME frames are fed to both sims each tick.
    const rngs = new Map();
    players.forEach((pid, i) => rngs.set(pid, createRng((seed + i * 104729) >>> 0)));

    const cap = def.durationSec * MINIGAME_HZ + 300;
    let ticks = 0;
    while (!simA.isFinished() && ticks < cap) {
      const stateA = simA.getState();
      const inputs = {};
      for (const pid of players) inputs[pid] = def.bot(stateA, pid, 'normal', rngs.get(pid));
      simA.step(clone(inputs));
      simB.step(clone(inputs));
      assert.equal(JSON.stringify(simA.getState()), JSON.stringify(simB.getState()),
        `"${def.id}" state diverged at tick ${ticks}`);
      assert.equal(simA.isFinished(), simB.isFinished(),
        `"${def.id}" finish flag diverged at tick ${ticks}`);
      ticks += 1;
    }

    assert.ok(simA.isFinished(), `"${def.id}" must finish within its duration cap`);
    assert.deepEqual(clone(simA.getResults()), clone(simB.getResults()),
      `"${def.id}" final results diverged`);
  });
}
