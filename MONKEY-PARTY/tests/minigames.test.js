/**
 * Minigame framework + content tests (package P7).
 *
 * Covers the framework helpers (defineMinigame, stepper, scoring, inputs,
 * selection) and then puts EVERY registered minigame (batch1 always;
 * batch2/templates when present) through the same headless gauntlet:
 * bot-driven completion inside the duration cap, full results coverage,
 * seed determinism, and a getState/applyState round-trip mid-game.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import registerAllMinigames from '#shared/minigames/index.js';
import { minigames } from '#shared/registries.js';
import { createRng } from '#shared/rng.js';
import { DEFAULT_RULES } from '#shared/rules.js';
import {
  defineMinigame, createFixedStepper, rankByScore, rankByScoreGrouped, coinsForRanking,
  makeTeams, standardCountdown, MINIGAME_HZ, CATEGORIES,
} from '#shared/minigames/framework.js';
import { emptyFrame, clampFrame, packFrame, unpackFrame } from '#shared/minigames/inputs.js';
import { selectMinigame, categoryPoolFromColors } from '#shared/minigames/select.js';

const report = await registerAllMinigames();

/* ------------------------------------------------------------------ */
/* Headless helpers                                                    */
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

function botInputs(def, state, players, rngs, idleSet = null) {
  const inputs = {};
  for (const pid of players) {
    inputs[pid] = idleSet?.has(pid)
      ? emptyFrame()
      : def.bot(state, pid, 'normal', rngs.get(pid));
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

function runToCompletion(def, seed, { idleSet = null, count = null } = {}) {
  const players = makePlayers(def, count);
  const sim = makeSim(def, seed, players);
  const rngs = freshBotRngs(players, seed ^ 0x5eed);
  const cap = def.durationSec * MINIGAME_HZ + 300;
  let ticks = 0;
  while (!sim.isFinished() && ticks < cap) {
    const state = sim.getState();
    sim.step(botInputs(def, state, players, rngs, idleSet));
    ticks += 1;
  }
  return { sim, players, ticks, cap };
}

/* ------------------------------------------------------------------ */
/* Registration                                                        */
/* ------------------------------------------------------------------ */

test('registerAll: batch1, batch2 AND templates all load (no silent drops)', () => {
  for (const batch of ['batch1', 'batch2', 'templates']) {
    assert.ok(report.loaded.includes(batch), `${batch} must load, got ${JSON.stringify(report)}`);
  }
  assert.ok(minigames.count() >= 8, `expected >= 8 minigames, got ${minigames.count()}`);
  for (const id of [
    'banana_scramble', 'vine_swing_sprint', 'barrel_blast_arena', 'sneaky_statue',
    'memory_totem', 'splash_sumo', 'banana_cannon_teams', 'bomb_banana',
  ]) {
    assert.ok(minigames.get(id), `missing minigame "${id}"`);
  }
});

test('registerAll: idempotent (second call does not throw on duplicates)', async () => {
  const again = await registerAllMinigames();
  assert.deepEqual(again, report);
});

/* ------------------------------------------------------------------ */
/* Framework: defineMinigame                                           */
/* ------------------------------------------------------------------ */

function validDefStub(id) {
  return {
    id,
    name: { en: 'X', de: 'X' },
    description: { en: 'X', de: 'X' },
    howTo: { en: 'X', de: 'X' },
    category: 'ffa',
    tags: [],
    players: { min: 2, max: 8 },
    durationSec: 30,
    competitiveSafe: true,
    params: {},
    createSim: () => ({}),
    createView: () => ({}),
    bot: () => emptyFrame(),
  };
}

test('defineMinigame: registers valid defs and rejects malformed ones', () => {
  const def = defineMinigame(validDefStub('__mg_valid__'));
  assert.equal(minigames.get('__mg_valid__'), def);

  assert.throws(() => defineMinigame(null), /def must be an object/);
  assert.throws(() => defineMinigame({ ...validDefStub('__mg_a__'), name: { en: 'x' } }), /name/);
  assert.throws(() => defineMinigame({ ...validDefStub('__mg_b__'), category: 'racing' }), /category/);
  assert.throws(() => defineMinigame({ ...validDefStub('__mg_c__'), players: { min: 5, max: 2 } }), /players/);
  assert.throws(() => defineMinigame({ ...validDefStub('__mg_d__'), durationSec: 0 }), /durationSec/);
  assert.throws(() => defineMinigame({ ...validDefStub('__mg_e__'), competitiveSafe: 'yes' }), /competitiveSafe/);
  assert.throws(() => defineMinigame({ ...validDefStub('__mg_f__'), bot: null }), /bot/);
  assert.throws(() => defineMinigame({ ...validDefStub('__mg_g__'), tags: [1] }), /tags/);
  // Duplicate ids bubble up from the registry.
  assert.throws(() => defineMinigame(validDefStub('__mg_valid__')), /duplicate/);
});

test('framework: every registered def passes the defineMinigame field contract', () => {
  for (const def of minigames.all()) {
    assert.ok(CATEGORIES.includes(def.category), `${def.id}: category`);
    assert.equal(typeof def.name?.en, 'string', `${def.id}: name.en`);
    assert.equal(typeof def.name?.de, 'string', `${def.id}: name.de`);
    assert.equal(typeof def.howTo?.en, 'string', `${def.id}: howTo.en`);
    assert.equal(typeof def.howTo?.de, 'string', `${def.id}: howTo.de`);
    assert.equal(typeof def.createSim, 'function', `${def.id}: createSim`);
    assert.equal(typeof def.createView, 'function', `${def.id}: createView`);
    assert.equal(typeof def.bot, 'function', `${def.id}: bot`);
  }
});

/* ------------------------------------------------------------------ */
/* Framework: stepper, scoring, countdown                              */
/* ------------------------------------------------------------------ */

test('createFixedStepper: fixed 30Hz accumulation with capped catch-up', () => {
  let steps = 0;
  const sim = {
    isFinished: () => false,
    step: () => {
      steps += 1;
    },
  };
  const stepper = createFixedStepper(sim, { hz: 30 });
  stepper.advance(1 / 60, {}); // Half a step: nothing yet.
  assert.equal(steps, 0);
  stepper.advance(1 / 60, {});
  assert.equal(steps, 1);
  stepper.advance(0.5, {}); // 15 steps.
  assert.equal(steps, 16);
  stepper.advance(10, {}); // Tab-blur: capped at 0.5s of catch-up.
  assert.equal(steps, 31);
  assert.ok(stepper.alpha() >= 0 && stepper.alpha() <= 1);
  assert.equal(stepper.tickCount(), 31);
});

test('createFixedStepper: stops stepping once the sim finishes', () => {
  let steps = 0;
  const sim = {
    isFinished: () => steps >= 3,
    step: () => {
      steps += 1;
    },
  };
  const stepper = createFixedStepper(sim, { hz: 30 });
  stepper.advance(1, {});
  assert.equal(steps, 3);
});

test('rankByScore: descending with stable ties', () => {
  assert.deepEqual(rankByScore({ a: 1, b: 5, c: 3 }), ['b', 'c', 'a']);
  assert.deepEqual(rankByScore({ a: 2, b: 2, c: 9 }), ['c', 'a', 'b']);
  assert.deepEqual(rankByScore({}), []);
});

test('rankByScoreGrouped: equal scores cluster into tie groups', () => {
  assert.deepEqual(rankByScoreGrouped({ a: 1, b: 5, c: 3 }), ['b', 'c', 'a']);
  assert.deepEqual(rankByScoreGrouped({ a: 2, b: 9, c: 2, d: 1 }), ['b', ['a', 'c'], 'd']);
  assert.deepEqual(rankByScoreGrouped({ a: 4, b: 4 }), [['a', 'b']]);
  assert.deepEqual(rankByScoreGrouped({}), []);
  // Groups flatten to full coverage and coinsForRanking pays them equally.
  assert.deepEqual(
    coinsForRanking(rankByScoreGrouped({ a: 2, b: 2, c: 1 })),
    { a: 10, b: 10, c: 5 },
  );
});

test('coinsForRanking: base payouts, tie groups, chaos doubling', () => {
  assert.deepEqual(coinsForRanking(['a', 'b', 'c', 'd']), { a: 10, b: 7, c: 5, d: 3 });
  assert.deepEqual(
    coinsForRanking(['a', 'b', 'c', 'd', 'e']),
    { a: 10, b: 7, c: 5, d: 3, e: 1 },
  );
  assert.deepEqual(coinsForRanking([['a', 'b'], 'c']), { a: 10, b: 10, c: 5 });
  assert.deepEqual(coinsForRanking(['a', 'b'], { chaos: true }), { a: 20, b: 14 });
  assert.deepEqual(coinsForRanking(['a'], { base: [4] }), { a: 4 });
});

test('makeTeams: category splits', () => {
  const four = ['a', 'b', 'c', 'd'];
  assert.deepEqual(makeTeams(four, '2v2'), [['a', 'b'], ['c', 'd']]);
  assert.deepEqual(makeTeams(four, '1v3'), [['a'], ['b', 'c', 'd']]);
  assert.deepEqual(makeTeams(four, 'duel'), [['a'], ['b']]);
  assert.equal(makeTeams(four, 'ffa'), null);
  assert.deepEqual(makeTeams(['a', 'b', 'c'], 'team'), [['a', 'b'], ['c']]);
});

test('standardCountdown: tick math', () => {
  const cd = standardCountdown(null, 3);
  assert.equal(cd.totalTicks, 90);
  assert.equal(cd.isActive(0), true);
  assert.equal(cd.isActive(89), true);
  assert.equal(cd.isActive(90), false);
  assert.equal(cd.remainingSec(0), 3);
  assert.equal(cd.remainingSec(60), 1);
  assert.equal(cd.remainingSec(90), 0);
});

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

test('inputs: emptyFrame/clampFrame sanitize anything', () => {
  assert.deepEqual(emptyFrame(), { move: { x: 0, y: 0 }, a: false, b: false });
  assert.deepEqual(clampFrame(null), emptyFrame());
  assert.deepEqual(
    clampFrame({ move: { x: 5, y: -9 }, a: 1, b: 0, aim: { x: NaN, y: 2 } }),
    { move: { x: 1, y: -1 }, a: true, b: false, aim: { x: 0, y: 1 } },
  );
});

test('inputs: packFrame/unpackFrame round-trip (with and without aim)', () => {
  const plain = { move: { x: -0.5, y: 0.25 }, a: true, b: false };
  assert.deepEqual(unpackFrame(packFrame(plain)), plain);
  const aimed = { move: { x: 0.1, y: -1 }, a: false, b: true, aim: { x: 0.75, y: -0.3 } };
  assert.deepEqual(unpackFrame(packFrame(aimed)), aimed);
  assert.equal(packFrame(plain).length, 3);
  assert.equal(packFrame(aimed).length, 5);
  assert.deepEqual(unpackFrame([]), emptyFrame());
  assert.deepEqual(unpackFrame(null), emptyFrame());
});

/* ------------------------------------------------------------------ */
/* Selection                                                           */
/* ------------------------------------------------------------------ */

const roster = (colors) => colors.map((c, i) => ({ id: `p${i + 1}`, lastFieldColor: c }));

test('categoryPoolFromColors: 2/2 -> 2v2, 1/3 -> 1v3, else ffa/team(/duel)', () => {
  assert.deepEqual(categoryPoolFromColors(roster(['blue', 'blue', 'red', 'red'])).pool, ['2v2']);
  assert.deepEqual(categoryPoolFromColors(roster(['blue', 'red', 'red', 'red'])).pool, ['1v3']);
  assert.deepEqual(categoryPoolFromColors(roster(['red', 'red', 'red', 'blue'])).pool, ['1v3']);
  assert.deepEqual(categoryPoolFromColors(roster(['blue', 'blue', 'blue', 'red'])).pool, ['1v3']);
  assert.deepEqual(categoryPoolFromColors(roster(['blue', 'blue', 'blue', 'blue'])).pool, ['ffa', 'team']);
  assert.deepEqual(categoryPoolFromColors(roster(['blue', 'neutral', 'red', 'red'])).pool, ['ffa', 'team']);
  assert.deepEqual(categoryPoolFromColors(roster(['blue', 'red'])).pool, ['ffa', 'team', 'duel']);
});

test('selectMinigame: 2/2 color split picks a 2v2 game with color teams', () => {
  const picked = selectMinigame({
    rules: { ...DEFAULT_RULES },
    players: roster(['blue', 'red', 'blue', 'red']),
    history: [],
    rng: createRng(7),
  });
  assert.ok(picked);
  assert.equal(minigames.get(picked.minigameId).category, '2v2');
  assert.equal(picked.id, picked.minigameId);
  assert.deepEqual(picked.teams, [['p1', 'p3'], ['p2', 'p4']]);
});

test('selectMinigame: 1/3 color split picks a 1v3 game with the solo first', () => {
  const picked = selectMinigame({
    rules: { ...DEFAULT_RULES },
    players: roster(['red', 'blue', 'blue', 'blue']),
    history: [],
    rng: createRng(11),
  });
  assert.ok(picked);
  assert.equal(minigames.get(picked.minigameId).category, '1v3');
  assert.deepEqual(picked.teams, [['p1'], ['p2', 'p3', 'p4']]);
});

test('selectMinigame: competitive rules exclude competitiveSafe:false games', () => {
  const rules = { ...DEFAULT_RULES, competitive: true };
  const rng = createRng(3);
  for (let i = 0; i < 40; i += 1) {
    const picked = selectMinigame({
      rules,
      players: roster(['neutral', 'neutral', 'neutral', 'neutral']),
      history: [],
      rng,
    });
    assert.ok(picked);
    assert.ok(minigames.get(picked.minigameId).competitiveSafe, `picked unsafe ${picked.minigameId}`);
  }
});

test('selectMinigame: respects rules.minigameCategories', () => {
  const rng = createRng(5);
  for (let i = 0; i < 20; i += 1) {
    const picked = selectMinigame({
      rules: { ...DEFAULT_RULES, minigameCategories: ['ffa'] },
      players: roster(['blue', 'blue', 'red', 'red']), // Would prefer 2v2...
      history: [],
      rng,
    });
    assert.ok(picked);
    assert.equal(minigames.get(picked.minigameId).category, 'ffa');
  }
});

test('selectMinigame: anti-repeat excludes the last 8 unless the pool exhausts', () => {
  const ffaIds = minigames.all().filter((d) => d.category === 'ffa'
    && d.players.min <= 4 && 4 <= d.players.max).map((d) => d.id);
  const rng = createRng(13);
  const players = roster(['neutral', 'neutral', 'neutral', 'neutral']);
  const rules = { ...DEFAULT_RULES, minigameCategories: ['ffa'] };

  // Recent history blocks those ids while alternatives remain.
  const history = ffaIds.slice(0, ffaIds.length - 1);
  for (let i = 0; i < 20; i += 1) {
    const picked = selectMinigame({ rules, players, history, rng });
    assert.ok(picked);
    if (history.length < 8) {
      assert.ok(!history.includes(picked.minigameId), `repeated ${picked.minigameId}`);
    }
  }

  // Pool exhaustion: every ffa game in recent history still yields a pick.
  const picked = selectMinigame({ rules, players, history: ffaIds.slice(-8), rng });
  assert.ok(picked, 'exhausted pool must still pick something');
});

test('selectMinigame: anti-repeat is family-aware (template siblings blocked)', () => {
  const dodgeIds = minigames.all()
    .filter((d) => d.family === 'dodgeRain').map((d) => d.id);
  assert.ok(dodgeIds.length >= 3, 'expected several dodgeRain variants');
  const rng = createRng(23);
  const players = roster(['neutral', 'neutral', 'neutral', 'neutral']);
  // One recently played dodge variant must block ALL of its siblings.
  for (let i = 0; i < 60; i += 1) {
    const picked = selectMinigame({
      rules: { ...DEFAULT_RULES }, players, history: [dodgeIds[0]], rng,
    });
    assert.ok(picked);
    assert.ok(!dodgeIds.includes(picked.minigameId),
      `picked family sibling ${picked.minigameId} right after ${dodgeIds[0]}`);
  }
});

test('selectMinigame: honors an explicit boss/category preference', () => {
  const players = roster(['neutral', 'neutral', 'neutral', 'neutral']);
  const viaBoss = selectMinigame({
    rules: { ...DEFAULT_RULES }, players, history: [], rng: createRng(29), boss: true,
  });
  assert.ok(viaBoss);
  assert.equal(minigames.get(viaBoss.minigameId).category, 'boss');
  const viaCategory = selectMinigame({
    rules: { ...DEFAULT_RULES }, players, history: [], rng: createRng(31), category: 'team',
  });
  assert.ok(viaCategory);
  assert.equal(minigames.get(viaCategory.minigameId).category, 'team');
});

test('selectMinigame: compatible with the match-sim caller shape (state/minigames)', () => {
  const state = {
    turnOrder: ['p1', 'p2', 'p3', 'p4'],
    players: {
      p1: { lastFieldColor: 'blue' },
      p2: { lastFieldColor: 'red' },
      p3: { lastFieldColor: null },
      p4: { lastFieldColor: 'neutral' },
    },
    rules: { ...DEFAULT_RULES },
  };
  const picked = selectMinigame({ state, rng: createRng(21), minigames, rules: state.rules });
  assert.ok(picked);
  assert.equal(typeof picked.id, 'string');
  assert.ok(minigames.get(picked.id));
});

/* ------------------------------------------------------------------ */
/* Every registered minigame: the headless gauntlet                    */
/* ------------------------------------------------------------------ */

const SEED = 0xc0ffee;
const realDefs = minigames.all().filter((d) => !d.id.startsWith('__mg_'));

for (const def of realDefs) {
  // Every def runs the gauntlet at its default (4-ish), min, AND max
  // player counts, so roster-size edge cases cannot slip through.
  for (const count of gauntletCounts(def)) {
    test(`${def.id} @${count}p: bots finish within the duration cap`, () => {
      const { sim, ticks, cap } = runToCompletion(def, SEED, { count });
      assert.ok(sim.isFinished(), `${def.id} did not finish within ${cap} ticks`);
      assert.ok(ticks <= cap);
    });

    test(`${def.id} @${count}p: results carry a full ranking, coin map, and stats`, () => {
      const { sim, players } = runToCompletion(def, SEED, { count });
      const results = sim.getResults();
      assert.ok(Array.isArray(results.ranking), 'ranking array');
      const flat = results.ranking.flat();
      assert.deepEqual([...flat].sort(), [...players].sort(), 'ranking covers every player exactly once');
      for (const pid of players) {
        assert.equal(typeof results.coins[pid], 'number', `coins for ${pid}`);
        assert.ok(Number.isFinite(results.coins[pid]));
        assert.equal(typeof results.stats[pid], 'object', `stats for ${pid}`);
      }
    });

    test(`${def.id} @${count}p: determinism - same seed, same bots, identical outcome`, () => {
      const a = runToCompletion(def, SEED, { count });
      const b = runToCompletion(def, SEED, { count });
      assert.equal(a.ticks, b.ticks, 'tick counts match');
      assert.deepEqual(a.sim.getState(), b.sim.getState(), 'final states match');
      assert.deepEqual(a.sim.getResults(), b.sim.getResults(), 'results match');
    });

    test(`${def.id} @${count}p: getState -> applyState round-trip mid-game stays in lockstep`, () => {
      const players = makePlayers(def, count);
      const rngs = freshBotRngs(players, SEED ^ 0x5eed);
      const simA = makeSim(def, SEED, players);

      const midpoint = Math.floor((def.durationSec * MINIGAME_HZ) / 2);
      for (let i = 0; i < midpoint && !simA.isFinished(); i += 1) {
        const state = simA.getState();
        simA.step(botInputs(def, state, players, rngs));
      }

      const snap = simA.getState();
      const simB = makeSim(def, SEED ^ 0xdead, players); // Different seed on purpose.
      simB.applyState(snap);
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
}

/* ------------------------------------------------------------------ */
/* Bots beat idle players (skill games)                                */
/* ------------------------------------------------------------------ */

for (const id of ['banana_scramble', 'vine_swing_sprint', 'sneaky_statue']) {
  test(`${id}: normal bots beat an idle player`, () => {
    const def = minigames.get(id);
    const { sim } = runToCompletion(def, SEED, { idleSet: new Set(['p4']) });
    const results = sim.getResults();
    const flat = results.ranking.flat();
    assert.equal(flat[flat.length - 1], 'p4', `idle p4 should rank last, got ${flat.join(',')}`);
  });
}

/* ------------------------------------------------------------------ */
/* A skilled human beats hard bots (reaction / rhythm)                 */
/* ------------------------------------------------------------------ */

function runWithHuman(def, seed, humanFn, difficulty = 'hard') {
  const players = makePlayers(def, 4);
  const humanPid = players[0];
  const sim = makeSim(def, seed, players);
  const rngs = freshBotRngs(players, seed ^ 0x5eed);
  const cap = def.durationSec * MINIGAME_HZ + 300;
  let ticks = 0;
  while (!sim.isFinished() && ticks < cap) {
    const state = sim.getState();
    const inputs = {};
    for (const pid of players) {
      inputs[pid] = pid === humanPid
        ? humanFn(state, pid)
        : def.bot(state, pid, difficulty, rngs.get(pid));
    }
    sim.step(inputs);
    ticks += 1;
  }
  return { sim, humanPid };
}

test('reaction duel: a sharp (~167ms) human beats hard bots', () => {
  const def = minigames.get('firework_flinch');
  assert.ok(def, 'firework_flinch registered');
  // Presses 5 ticks after the signal, never falls for fakes.
  const { sim, humanPid } = runWithHuman(def, SEED, (s, pid) => {
    const frame = emptyFrame();
    const me = s.players[pid];
    if (s.phase === 'window' && !me.locked && me.pressedTick < 0
      && s.tick - s.signalAt >= 4) frame.a = true;
    return frame;
  });
  assert.ok(sim.isFinished());
  const flat = sim.getResults().ranking.flat();
  assert.equal(flat[0], humanPid, `human should win, ranking: ${flat.join(',')}`);
});

test('rhythm_drums: a frame-perfect human beats hard bots', () => {
  const def = minigames.get('rhythm_drums');
  const { sim, humanPid } = runWithHuman(def, SEED, (s, pid) => {
    const frame = emptyFrame();
    const me = s.players[pid];
    const beat = s.beats[me.next];
    if (beat && s.tick === beat.tick - 1) {
      if (beat.lane === 0) frame.a = true;
      else frame.b = true;
    }
    return frame;
  });
  assert.ok(sim.isFinished());
  const flat = sim.getResults().ranking.flat();
  assert.equal(flat[0], humanPid, `human should win, ranking: ${flat.join(',')}`);
});
