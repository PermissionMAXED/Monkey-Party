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
import { boards, minigames } from '#shared/registries.js';
import { createRng } from '#shared/rng.js';
import { DEFAULT_RULES } from '#shared/rules.js';
import { MINIGAME_HZ, CATEGORIES } from '#shared/minigames/framework.js';
import { emptyFrame } from '#shared/minigames/inputs.js';
import { createMatchSim } from '#shared/sim/match.js';

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

/* ------------------------------------------------------------------ */
/* Control convention (src/engine/input.js: y = +1 is up/forward)      */
/*                                                                     */
/* Each batch-3 view pins its camera in src/minigames/views/batch3/:   */
/*   monkey_cannonball_dodge  pos [0,15,15]  look [0,0,-1]  (+z cam)   */
/*   stampede_surfers         pos [0,14,14]  look [0,0,-1]  (+z cam)   */
/*   banana_bridge_builders   pos [0,21,-19] look [0,0,5]   (-z cam)   */
/*   coconut_curling          pos [0,17,-9]  look [0,0,12]  (-z cam)   */
/* A +z camera looking toward -z means screen-up = world -z; a -z      */
/* camera looking toward +z means screen-up = world +z AND screen-     */
/* right = world -x (camera right = cross(up, pos - look)). Stick up   */
/* must always move up-screen and stick right must move right-screen.  */
/* ------------------------------------------------------------------ */

const UP = () => ({ move: { x: 0, y: 1 }, a: false, b: false });
const RIGHT = () => ({ move: { x: 1, y: 0 }, a: false, b: false });

/** Step through the 3-2-1-GO countdown with idle frames. */
function skipCountdown(sim) {
  while (sim.getState().tick < sim.getState().countdownTicks) sim.step({});
}

test('controls: monkey_cannonball_dodge stick-up moves dodger AND crosshair toward -z (away from the +z camera)', () => {
  const def = minigames.get('monkey_cannonball_dodge');
  const players = makePlayers(def, 4);
  const sim = makeSim(def, SEED, players);
  skipCountdown(sim);
  const before = sim.getState();
  const dodger = players.find((pid) => before.players[pid].role === 'dodger');
  const solo = before.soloId;
  for (let i = 0; i < 30; i += 1) sim.step({ [dodger]: UP(), [solo]: UP() });
  const after = sim.getState();
  assert.ok(after.players[dodger].z < before.players[dodger].z,
    'stick up must move the dodger up-screen (-z)');
  assert.ok(after.players[solo].z < before.players[solo].z,
    'stick up must move the solo crosshair up-screen (-z)');
});

test('controls: stampede_surfers stick-up hops toward a LOWER lane (lane 0 sits at -z, away from the +z camera)', () => {
  const def = minigames.get('stampede_surfers');
  const players = makePlayers(def, 4);
  const sim = makeSim(def, SEED, players);
  skipCountdown(sim);
  const pid = players[1]; // slot 1 -> lane 1, so an up-hop is possible.
  const before = sim.getState().players[pid].lane;
  assert.equal(before, 1, 'fixture: p2 starts in lane 1');
  for (let i = 0; i < 3; i += 1) sim.step({ [pid]: UP() });
  const after = sim.getState().players[pid].lane;
  assert.equal(after, before - 1, 'stick up must hop up-screen = lane index - 1');
});

test('controls: banana_bridge_builders stick-right moves toward world -x (screen-right under the -z camera)', () => {
  const def = minigames.get('banana_bridge_builders');
  const players = makePlayers(def, 4);
  const sim = makeSim(def, SEED, players);
  skipCountdown(sim);
  const pid = players[0];
  const before = sim.getState().players[pid].x;
  for (let i = 0; i < 30; i += 1) sim.step({ [pid]: RIGHT() });
  const after = sim.getState().players[pid].x;
  assert.ok(after < before, 'stick right must move right ON SCREEN, i.e. world -x');
});

test('controls: coconut_curling stick-right steers the throw toward world -x (screen-right under the -z camera)', () => {
  const def = minigames.get('coconut_curling');
  const players = makePlayers(def, 4);
  const sim = makeSim(def, SEED, players);
  skipCountdown(sim);
  const pid = players[0];
  for (let i = 0; i < 20; i += 1) sim.step({ [pid]: RIGHT() });
  const angle = sim.getState().players[pid].angle;
  assert.ok(angle < 0,
    'stick right must steer to a negative angle (launch vx = sin(angle) < 0 = world -x = screen-right)');
});

/* ------------------------------------------------------------------ */
/* Fairness fixes                                                      */
/* ------------------------------------------------------------------ */

test('echo_cavern: two perfect teams tie-break on echo SPEED (doneTick), not on pad ownership', () => {
  const def = minigames.get('echo_cavern');
  const players = makePlayers(def, 8); // Teams of 4: each player owns exactly one pad.
  const sim = makeSim(def, SEED, players);
  const cap = def.durationSec * MINIGAME_HZ;

  // Scripted perfect play: the owner of the next expected pad presses A a
  // fixed delay after the team's last advance - team A drums every 3 ticks,
  // team B every 9. Both echo every melody perfectly; only speed differs.
  const delays = [3, 9];
  let ticks = 0;
  while (!sim.isFinished() && ticks < cap) {
    const s = sim.getState();
    const inputs = {};
    if (s.phase === 'replay') {
      s.teams.forEach((team, ti) => {
        if (team.done || team.broken) return;
        const expected = s.seq[team.progress];
        const owner = team.members.find((pid) => s.players[pid].ownedPads[0] === expected);
        if (owner && (s.tick + 1) - team.lastAdvanceTick === delays[ti]) {
          inputs[owner] = { move: { x: 0, y: 0 }, a: true, b: false };
        }
      });
    }
    sim.step(inputs);
    ticks += 1;
  }

  assert.ok(sim.isFinished(), 'scripted echo game finishes');
  const state = sim.getState();
  const results = sim.getResults();
  const [teamA, teamB] = state.teams.map((t) => t.members);
  assert.equal(state.teams[0].best, state.teams[1].best, 'both teams echo perfectly (equal best)');
  assert.equal(state.teams[0].total, state.teams[1].total, 'both teams echo perfectly (equal total)');
  assert.ok(state.teams[0].doneTick < state.teams[1].doneTick, 'team A drummed faster');
  const flat = results.ranking.flat();
  assert.deepEqual([...flat.slice(0, teamA.length)].sort(), [...teamA].sort(),
    'the faster perfect team ranks first (speed tiebreak, not pad lottery)');
  assert.deepEqual([...flat.slice(teamA.length)].sort(), [...teamB].sort(),
    'the slower perfect team ranks second');
});

test('monkey_cannonball_dodge: a non-sweeping solo grades BETWEEN dodgers by hits', () => {
  const def = minigames.get('monkey_cannonball_dodge');
  const players = makePlayers(def, 4);
  const sim = makeSim(def, SEED, players);
  const solo = sim.getState().soloId;
  // The solo mashes fire with the crosshair parked on the center dodger
  // spawn (0,0); everyone else idles. The center dodger takes 2 hits and
  // sinks; the flanking dodgers (at x = +-3.4, blast radius 1.8) survive.
  const cap = def.durationSec * MINIGAME_HZ;
  for (let i = 0; i < cap && !sim.isFinished(); i += 1) {
    sim.step({ [solo]: { move: { x: 0, y: 0 }, a: i % 2 === 0, b: false } });
  }
  const state = sim.getState();
  assert.equal(state.soloWon, false, 'no full sweep');
  const sunk = players.find((pid) => state.players[pid].role === 'dodger' && !state.players[pid].alive);
  assert.ok(sunk, 'the center dodger was sunk');
  assert.equal(state.players[solo].score, 2, 'solo landed exactly 2 hits');
  const flat = sim.getResults().ranking.flat();
  assert.equal(flat.indexOf(solo), 2, 'solo ranks above the sunk dodger, below the survivors');
  assert.equal(flat[3], sunk, 'the sunk dodger ranks last');
});

test('coconut_curling: knock credit goes to the STRIKER (the stone moving along the collision normal)', () => {
  const def = minigames.get('coconut_curling');
  const players = makePlayers(def, 4);
  const sim = makeSim(def, SEED, players);
  // Surgical snapshot: p1's stone slides straight into p2's resting stone.
  const snap = sim.getState();
  snap.tick = 200;
  snap.phase = 'slide';
  snap.phaseTick = 150;
  snap.stones = [
    { id: 1, owner: players[0], x: 0, z: 5, vx: 0, vz: 6, moving: true, out: false },
    { id: 2, owner: players[1], x: 0, z: 6, vx: 0, vz: 0, moving: false, out: false },
  ];
  sim.applyState(snap);
  sim.step({});
  const s = sim.getState();
  assert.equal(s.players[players[0]].knocks, 1, 'the moving stone\'s owner gets the knock');
  assert.equal(s.players[players[1]].knocks, 0, 'the stationary stone\'s owner does not');
});

test('coconut_curling: launch slots rotate one place between waves (nobody keeps the center lane)', () => {
  const def = minigames.get('coconut_curling');
  const players = makePlayers(def, 4);
  const sim = makeSim(def, SEED, players);
  const wave1 = {};
  for (const pid of players) wave1[pid] = sim.getState().players[pid].launchX;
  const cap = def.durationSec * MINIGAME_HZ;
  let ticks = 0;
  while (ticks < cap) {
    const s = sim.getState();
    if (s.wave === 2 && s.phase === 'aim') break;
    sim.step({});
    ticks += 1;
  }
  const s = sim.getState();
  assert.equal(s.wave, 2, 'reached the second wave');
  players.forEach((pid, i) => {
    assert.equal(s.players[pid].launchX, wave1[players[(i + 1) % players.length]],
      `${pid} moved one launch slot over in wave 2`);
    assert.notEqual(s.players[pid].launchX, wave1[pid], `${pid} does not keep its wave-1 slot`);
  });
});

/* ------------------------------------------------------------------ */
/* Boss cadence (shared/sim/match.js pickMinigame)                     */
/* ------------------------------------------------------------------ */

// Minimal linear-loop fixture board: blue fields only, no shops/items/
// events, star priced out of reach - so driving a match only ever needs
// 'roll' actions and stubbed minigame results.
const CADENCE_BOARD_ID = 'batch3_cadence_fixture';
boards.register({
  id: CADENCE_BOARD_ID,
  name: { en: 'Cadence Fixture', de: 'Kadenz-Fixture' },
  description: { en: 'Fixture board for boss cadence tests.', de: 'Testbrett fuer Boss-Kadenz-Tests.' },
  difficulty: 1,
  theme: { sky: null, fog: null, ambient: null, palette: { primary: '#166534', secondary: '#0c4a6e', accent: '#f59e0b' } },
  music: { tempo: 110, scale: null, pattern: null },
  nodes: Array.from({ length: 10 }, (_, i) => ({
    id: `c${i}`,
    pos: [i, 0, 0],
    type: i === 0 ? 'start' : 'blue',
    next: [`c${(i + 1) % 10}`],
  })),
  starSpawns: ['c5'],
  shops: [],
  events: {},
  mechanics: [],
  bossEvent: null,
  view: null,
});

/** Drive a match with roll-only bots + stubbed 0-coin minigame results. */
function playCadenceMatch({ seed, rounds }) {
  const sim = createMatchSim({
    seed,
    boardId: CADENCE_BOARD_ID,
    rules: { rounds, items: 'off', startCoins: 0, starPrice: 99 },
    players: ['p1', 'p2', 'p3', 'p4'].map((id) => ({ id, isBot: true })),
  });
  let guard = 0;
  while (guard < 2000) {
    guard += 1;
    const state = sim.getState();
    if (state.phase === 'game_over') break;
    if (state.phase === 'minigame') {
      sim.apply({
        type: 'minigameResults',
        playerId: state.turnOrder[0],
        payload: { results: { ranking: state.turnOrder.slice(), coins: {}, stats: {} } },
      });
      continue;
    }
    assert.ok(state.awaiting, `stalled in phase "${state.phase}"`);
    sim.apply({ type: 'roll', playerId: state.awaiting.playerId, payload: {} });
  }
  return sim.getEventLog()
    .filter((e) => e.type === 'minigame_start')
    .map((e) => ({ id: e.minigameId, category: minigames.get(e.minigameId)?.category }));
}

test('boss cadence: 10-round match plays boss games at #4, #8 and the final round, never back-to-back', () => {
  for (const seed of [0xC0FFEE, 0xBADA55, 12345]) {
    const played = playCadenceMatch({ seed, rounds: 10 });
    assert.equal(played.length, 10);
    const bossAt = played.map((m, i) => (m.category === 'boss' ? i : -1)).filter((i) => i >= 0);
    assert.deepEqual(bossAt, [3, 7, 9], `seed ${seed}: boss minigames at #4, #8 and the final round`);
    assert.notEqual(played[3].id, played[7].id, `seed ${seed}: cadence rotates through the boss pool`);
    for (let i = 1; i < played.length; i += 1) {
      assert.ok(!(played[i].category === 'boss' && played[i - 1].category === 'boss'),
        `seed ${seed}: no back-to-back boss games`);
    }
  }
});

test('boss cadence: 5-round (fast-preset length) match skips the #4 cadence slot next to the final boss', () => {
  for (const seed of [0xC0FFEE, 0xBADA55, 12345]) {
    const played = playCadenceMatch({ seed, rounds: 5 });
    assert.equal(played.length, 5);
    const categories = played.map((m) => m.category);
    assert.equal(categories[4], 'boss', `seed ${seed}: the final round is still a boss game`);
    assert.notEqual(categories[3], 'boss',
      `seed ${seed}: minigame #4 must not be a boss right before the final-round boss`);
  }
});
