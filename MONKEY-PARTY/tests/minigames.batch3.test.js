/**
 * Minigame Batch 3 content tests.
 *
 * Puts the eight bespoke batch-3 minigames (banana_bridge_builders,
 * monkey_cannonball_dodge, coconut_curling, firefly_catchers,
 * totem_tower_topple, stampede_surfers, echo_cavern, royal_banana_heist)
 * through the same headless gauntlet style as tests/minigames.test.js:
 * registry presence + contract fields, bot-driven completion inside the
 * hard duration cap at min AND max player counts, full results coverage,
 * seed determinism, and a getState/applyState round-trip mid-game.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import registerAllMinigames from '#shared/minigames/index.js';
import { minigames } from '#shared/registries.js';
import { createRng } from '#shared/rng.js';
import { DEFAULT_RULES } from '#shared/rules.js';
import { MINIGAME_HZ, CATEGORIES } from '#shared/minigames/framework.js';
import { emptyFrame } from '#shared/minigames/inputs.js';

const report = await registerAllMinigames();

const BATCH3_IDS = [
  'banana_bridge_builders',
  'monkey_cannonball_dodge',
  'coconut_curling',
  'firefly_catchers',
  'totem_tower_topple',
  'stampede_surfers',
  'echo_cavern',
  'royal_banana_heist',
];

const SEED = 0xba3a3a;

/* ------------------------------------------------------------------ */
/* Headless helpers (same shape as tests/minigames.test.js)            */
/* ------------------------------------------------------------------ */

function makePlayers(def, count = null) {
  const n = count ?? Math.min(Math.max(4, def.players.min), def.players.max);
  return Array.from({ length: n }, (_, i) => `p${i + 1}`);
}

/** Unique player counts every def is gauntleted at: default, min, and max. */
function gauntletCounts(def) {
  const dflt = Math.min(Math.max(4, def.players.min), def.players.max);
  return [...new Set([dflt, def.players.min, def.players.max])];
}

function freshBotRngs(players, seed) {
  const m = new Map();
  players.forEach((pid, i) => m.set(pid, createRng((seed + i * 7919) >>> 0)));
  return m;
}

function botInputs(def, state, players, rngs) {
  const inputs = {};
  for (const pid of players) {
    inputs[pid] = def.bot(state, pid, 'normal', rngs.get(pid));
  }
  return inputs;
}

function makeSim(def, seed, players) {
  const sim = def.createSim({
    seed,
    players,
    params: JSON.parse(JSON.stringify(def.params ?? {})),
    rules: { ...DEFAULT_RULES },
  });
  sim.init();
  return sim;
}

function runToCompletion(def, seed, { count = null } = {}) {
  const players = makePlayers(def, count);
  const sim = makeSim(def, seed, players);
  const rngs = freshBotRngs(players, seed ^ 0x5eed);
  // The batch-3 hard cap is sacred: durationSec * 30 ticks, no slack.
  const cap = def.durationSec * MINIGAME_HZ;
  let ticks = 0;
  while (!sim.isFinished() && ticks < cap) {
    const state = sim.getState();
    sim.step(botInputs(def, state, players, rngs));
    ticks += 1;
  }
  return { sim, players, ticks, cap };
}

/* ------------------------------------------------------------------ */
/* Registration + contract                                             */
/* ------------------------------------------------------------------ */

test('batch3: registrar loads and every batch-3 id is present', () => {
  assert.ok(report.loaded.includes('batch3'),
    `batch3 must load, got ${JSON.stringify(report)}`);
  for (const id of BATCH3_IDS) {
    assert.ok(minigames.get(id), `missing minigame "${id}"`);
  }
});

test('batch3: every def carries the full localized contract fields', () => {
  for (const id of BATCH3_IDS) {
    const def = minigames.get(id);
    assert.ok(CATEGORIES.includes(def.category), `${id}: category "${def.category}"`);
    for (const field of ['name', 'description', 'howTo']) {
      assert.equal(typeof def[field]?.en, 'string', `${id}: ${field}.en`);
      assert.equal(typeof def[field]?.de, 'string', `${id}: ${field}.de`);
      assert.ok(def[field].en.length > 3, `${id}: ${field}.en not a placeholder`);
      assert.ok(def[field].de.length > 3, `${id}: ${field}.de not a placeholder`);
      assert.notEqual(def[field].en, def[field].de, `${id}: ${field} actually localized`);
    }
    assert.ok(Array.isArray(def.tags) && def.tags.length > 0, `${id}: tags`);
    assert.ok(Number.isInteger(def.players?.min) && Number.isInteger(def.players?.max)
      && def.players.min >= 1 && def.players.max >= def.players.min, `${id}: players range`);
    assert.ok(Number.isFinite(def.durationSec) && def.durationSec > 0, `${id}: durationSec`);
    assert.equal(typeof def.competitiveSafe, 'boolean', `${id}: competitiveSafe`);
    assert.equal(typeof def.params, 'object', `${id}: params`);
    assert.equal(typeof def.createSim, 'function', `${id}: createSim`);
    assert.equal(typeof def.createView, 'function', `${id}: createView`);
    assert.equal(typeof def.bot, 'function', `${id}: bot`);
    assert.equal(def.family, undefined, `${id}: bespoke games must not set family`);
  }
});

test('batch3: ids collide with nothing else in the registry', () => {
  const all = minigames.all().map((d) => d.id);
  assert.equal(new Set(all).size, all.length, 'registry ids are globally unique');
});

/* ------------------------------------------------------------------ */
/* The headless gauntlet at default, min, and max player counts        */
/* ------------------------------------------------------------------ */

for (const id of BATCH3_IDS) {
  const def = minigames.get(id);
  if (!def) continue; // The registration test reports the failure.

  for (const count of gauntletCounts(def)) {
    test(`${id} @${count}p: bots finish within the hard cap (durationSec * 30 ticks)`, () => {
      const { sim, ticks, cap } = runToCompletion(def, SEED, { count });
      assert.ok(sim.isFinished(), `${id} did not finish within ${cap} ticks`);
      assert.ok(ticks <= cap, `${id} took ${ticks} > ${cap} ticks`);
    });

    test(`${id} @${count}p: results rank every player, with coins and stats`, () => {
      const { sim, players } = runToCompletion(def, SEED, { count });
      const results = sim.getResults();
      assert.ok(Array.isArray(results.ranking), 'ranking array');
      const flat = results.ranking.flat();
      assert.deepEqual([...flat].sort(), [...players].sort(),
        'ranking covers every player exactly once');
      for (const pid of players) {
        assert.equal(typeof results.coins[pid], 'number', `coins for ${pid}`);
        assert.ok(Number.isFinite(results.coins[pid]));
        assert.equal(typeof results.stats[pid], 'object', `stats for ${pid}`);
      }
    });

    test(`${id} @${count}p: determinism - same seed + inputs, identical outcome`, () => {
      const a = runToCompletion(def, SEED, { count });
      const b = runToCompletion(def, SEED, { count });
      assert.equal(a.ticks, b.ticks, 'tick counts match');
      assert.deepEqual(a.sim.getState(), b.sim.getState(), 'final states match');
      assert.deepEqual(a.sim.getResults(), b.sim.getResults(), 'results match');
    });

    test(`${id} @${count}p: getState -> applyState round-trip stays in lockstep`, () => {
      const players = makePlayers(def, count);
      const rngs = freshBotRngs(players, SEED ^ 0x5eed);
      const simA = makeSim(def, SEED, players);

      const midpoint = Math.floor((def.durationSec * MINIGAME_HZ) / 2);
      for (let i = 0; i < midpoint && !simA.isFinished(); i += 1) {
        const state = simA.getState();
        simA.step(botInputs(def, state, players, rngs));
      }

      const snap = simA.getState();
      assert.equal(typeof snap, 'object');
      // Snapshots must survive JSON transport (netsync sends them as JSON).
      const wire = JSON.parse(JSON.stringify(snap));
      const simB = makeSim(def, SEED ^ 0xdead, players); // Different seed on purpose.
      simB.applyState(wire);
      assert.deepEqual(simB.getState(), snap, 'applyState restores the snapshot exactly');

      for (let i = 0; i < 120; i += 1) {
        if (simA.isFinished()) break;
        const state = simA.getState();
        const inputs = botInputs(def, state, players, rngs);
        simA.step(inputs);
        simB.step(inputs);
      }
      assert.deepEqual(simB.getState(), simA.getState(), 'restored sim stays in lockstep');
      assert.equal(simB.isFinished(), simA.isFinished());
      if (simA.isFinished()) {
        assert.deepEqual(simB.getResults(), simA.getResults());
      }
    });
  }

  test(`${id}: sim tolerates missing input maps (bots-vanished safety)`, () => {
    const players = makePlayers(def, def.players.min);
    const sim = makeSim(def, SEED, players);
    for (let i = 0; i < 90; i += 1) sim.step({});
    for (let i = 0; i < 30; i += 1) sim.step(undefined);
    const state = sim.getState();
    assert.equal(state.tick, 120);
    assert.ok(!Number.isNaN(JSON.stringify(state).length));
  });

  test(`${id}: bot returns clampable frames for every seat and difficulty`, () => {
    const players = makePlayers(def, def.players.max);
    const sim = makeSim(def, SEED, players);
    const rng = createRng(7);
    for (let i = 0; i < 150; i += 1) {
      const state = sim.getState();
      const inputs = {};
      for (const pid of players) {
        const frame = def.bot(state, pid, ['easy', 'normal', 'hard', 'wild'][i % 4], rng);
        assert.equal(typeof frame, 'object', `${id}: bot frame for ${pid}`);
        inputs[pid] = frame;
      }
      sim.step(inputs);
    }
    assert.ok(sim.getState().tick >= 150);
  });
}

/* ------------------------------------------------------------------ */
/* Purity: no wall-clock or Math.random inside a step                  */
/* ------------------------------------------------------------------ */

test('batch3: stepping is stable when Math.random and Date.now are poisoned', () => {
  const realRandom = Math.random;
  const realNow = Date.now;
  try {
    Math.random = () => { throw new Error('Math.random used inside a batch3 sim'); };
    Date.now = () => { throw new Error('Date.now used inside a batch3 sim'); };
    for (const id of BATCH3_IDS) {
      const def = minigames.get(id);
      const players = makePlayers(def, def.players.min);
      const sim = makeSim(def, SEED, players);
      const rngs = freshBotRngs(players, SEED ^ 0x5eed);
      for (let i = 0; i < 240 && !sim.isFinished(); i += 1) {
        const state = sim.getState();
        sim.step(botInputs(def, state, players, rngs));
      }
      assert.ok(sim.getState().tick >= 1, `${id} stepped under poisoned globals`);
    }
  } finally {
    Math.random = realRandom;
    Date.now = realNow;
  }
});

/* ------------------------------------------------------------------ */
/* Frames: bots produce usable (empty-frame-compatible) input          */
/* ------------------------------------------------------------------ */

test('batch3: emptyFrame is always a legal input for every batch-3 sim', () => {
  for (const id of BATCH3_IDS) {
    const def = minigames.get(id);
    const players = makePlayers(def, def.players.min);
    const sim = makeSim(def, SEED, players);
    const cap = def.durationSec * MINIGAME_HZ;
    let ticks = 0;
    while (!sim.isFinished() && ticks < cap) {
      const inputs = {};
      for (const pid of players) inputs[pid] = emptyFrame();
      sim.step(inputs);
      ticks += 1;
    }
    assert.ok(sim.isFinished(), `${id} must hard-finish even with all-idle players`);
    const results = sim.getResults();
    assert.deepEqual([...results.ranking.flat()].sort(), [...players].sort(),
      `${id} ranks every idle player`);
  }
});
