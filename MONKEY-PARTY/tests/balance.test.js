/**
 * Balance & Bots measurement harness (alpha -> 1.0 balance pass).
 *
 * Headless seeded match runner over the REAL boards/items/minigames content
 * (contrast: tests/sim.test.js drives a fixture board). Minigame results
 * come from either a difficulty-weighted seeded stub (fast, used for the
 * big batches) or the real bot-driven minigame sims (slow, used for a small
 * fidelity batch). The stub's skill table was numerically calibrated so its
 * per-difficulty average ranks match 60 real FFA sims (easy 3.57 / normal
 * 2.95 / hard 2.08 / wild 1.40 of 4). No Math.random / Date.now anywhere -
 * seeded rng only, so every bound below is seed-stable.
 *
 * ------------------------------------------------------------------------
 * TUNING SUMMARY - before -> after, measured on this harness
 * (40-match stub batch = mixed 12 boards x rotating seat/difficulty map,
 * seeds 1000+7919*m; 400-match all-'normal' batch for seat fairness).
 * ------------------------------------------------------------------------
 * 1. shared/sim/scoring.js - awardBonuses tie-break: turn order -> seeded
 *    random pick among tied players.
 *      seat 0 match-win share (400 all-normal matches): 38.3% -> 29.5%
 *      seat 0 bonus-banana share: 34.9% -> 24-27% (seat 3 was 19.3%).
 *    The residual seat-0 edge is the frozen first-to-pass-the-star turn
 *    order advantage in sim/movement.js (out of scope for this package).
 * 2. shared/ai/difficulty.js - easy noise 3 -> 4.5, lookahead 4 -> 3
 *    (randomChance/topK pinned by tests/sim.test.js); wild randomChance
 *    0.4 -> 0.5, noise 4 -> 5.5.
 *      easy avg final rank: ~3.0 -> 3.25 of 4 (clearly beatable);
 *      wild wins per 40-match batch: 31 -> 25. Wild stays the top WINNER
 *      because the frozen minigame bot tables treat 'wild' as the sharpest
 *      reflexes (avg minigame rank 1.40 vs hard's 2.08 over 60 real sims);
 *      the board profile now gambles hard enough to give some of it back.
 *      hard remains the best consistent profile (avg rank 2.27).
 * 3. shared/ai/boardBot.js heuristics (per 40-match stub batch):
 *      - lucky_mask races affordable stars (6 -> 11): 17 -> 38 uses.
 *      - ghost_banana keys on "rival can afford the star" (flat 9 -> 11/8/3):
 *        3 -> 10 uses.
 *      - swap_totem considers ANY closer rival, not just the leader:
 *        2 -> 5 uses.
 *      - mini_gorilla = star denial vs a leader who can BUY (8 -> 11):
 *        0-4 -> 5 uses.
 *      - chaos_box gamble for high-randomChance profiles (6 -> 9) + shop
 *        base 3 -> 5: 0 -> 14 uses, 0-3 -> 26 buys.
 *      - dicePick: prefer any draft value >= star distance (star prompts on
 *        PASS, movement.js performStep) instead of exact-landing only.
 *      - trap placement scores the star approach (starDist <= 6 -> +4), not
 *        just raw traffic - see the unit test below.
 *      - junction shop routing: rich (>= 20 coins) + itemless doubles the
 *        shop goodie weight.
 * 4. Item prices: chaos_box 8 -> 7, ghost_banana 12 -> 10, mini_gorilla
 *    12 -> 10 (all were shelf-ware: 0-5 buys per 40-match batch; after the
 *    price+bot changes every item is bought AND used every batch).
 *    double_dice price 10 and golden_ticket rarity 'epic' are pinned by
 *    tests/items.test.js and stay untouched.
 * 5. shared/rules.js presets - fast: startCoins 15 -> 20, starPrice
 *    20 -> 15. Before, 42% of 5-round fast matches ended with ZERO stars
 *    bought (coin-tiebreak finishes); after, >= 75% of fast matches see a
 *    star bought (82% on the fixed-seat 40-batch, 15/20 on the rotating
 *    batch below). hardcore kept at startCoins 0 / starPrice 30: still
 *    liquid (1.67 star buys/match, >= 1 star in 11/12 matches) and the
 *    grind is the point of the preset.
 * 6. shared/minigames/select.js - verified, no change needed: over 500
 *    sequential picks all 18 eligible families land 4.2-6.4% shares (fair
 *    split ~5.6%) and the id+family anti-repeat window holds with zero
 *    violations.
 * 7. NOT tuned here (frozen files, noted in comments where relevant):
 *    red-field/boss coin swings live in shared/sim/fields.js (frozen);
 *    the dice-draft pool lives in shared/sim/dice.js (frozen - no draft
 *    first-pick dominance was measured, seat shares stay under 40%);
 *    the item roster is pinned to exactly 14 ids by tests/items.test.js,
 *    and since every item now trades and fires, no new item was added.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { registerAllContent } from '#shared/content/index.js';
import { createMatchSim } from '#shared/sim/match.js';
import { decideBoardAction } from '#shared/ai/boardBot.js';
import { PROFILES } from '#shared/ai/difficulty.js';
import { selectMinigame, familyOf, ANTI_REPEAT_WINDOW } from '#shared/minigames/select.js';
import { boards, minigames, items } from '#shared/registries.js';
import { createRng } from '#shared/rng.js';
import { DEFAULT_RULES, PRESETS } from '#shared/rules.js';
import { MINIGAME_HZ } from '#shared/minigames/framework.js';

await registerAllContent();

const DIFFS = ['easy', 'normal', 'hard', 'wild'];
/** Real content boards only (the heuristic fixture below is excluded). */
const BOARD_IDS = boards.ids();

/* ------------------------------------------------------------------ */
/* Minigame result synthesis                                           */
/* ------------------------------------------------------------------ */

/**
 * Seeded stub: rank participants by difficulty skill + seeded noise.
 * Skill values are calibrated against the REAL minigame sims' bot tables
 * (avg rank over 60 real FFA sims: easy 3.57, normal 2.95, hard 2.08,
 * wild 1.40 - wild IS the sharpest minigame profile by design there).
 */
const STUB_SKILL = { easy: 0.0, normal: 0.5, hard: 1.0, wild: 1.6 };

function stubResults(state, rng) {
  const teams = state.minigame?.teams;
  const participants = Array.isArray(teams) ? teams.flat() : state.turnOrder.slice();
  const scored = participants.map((pid, i) => ({
    pid,
    score: (STUB_SKILL[state.players[pid].difficulty] ?? 0.5) + rng.next() * 2,
    i,
  }));
  scored.sort((a, b) => (b.score - a.score) || (a.i - b.i));
  const ranking = scored.map((s) => s.pid);
  const base = [10, 7, 5, 3];
  const coins = {};
  ranking.forEach((pid, i) => { coins[pid] = i < base.length ? base[i] : 1; });
  return { ranking, coins, stats: {} };
}

/** Run the REAL minigame sim with its own bot at each seat's difficulty. */
function realResults(state, matchRng) {
  const def = minigames.get(state.minigame.pendingId);
  if (!def) return stubResults(state, matchRng);
  const teams = state.minigame.teams;
  const participants = Array.isArray(teams) ? teams.flat() : state.turnOrder.slice();
  const seed = matchRng.int(0, 0xffffffff) >>> 0;
  const sim = def.createSim({
    seed,
    players: participants,
    params: JSON.parse(JSON.stringify(state.minigame.params ?? def.params ?? {})),
    rules: state.rules,
  });
  sim.init();
  const rngs = new Map(participants.map((pid, i) => [pid, createRng((seed + i * 7919) >>> 0)]));
  const cap = def.durationSec * MINIGAME_HZ + 300;
  let ticks = 0;
  while (!sim.isFinished() && ticks < cap) {
    const s = sim.getState();
    const inputs = {};
    for (const pid of participants) {
      inputs[pid] = def.bot(s, pid, state.players[pid].difficulty ?? 'normal', rngs.get(pid));
    }
    sim.step(inputs);
    ticks += 1;
  }
  return sim.getResults();
}

/* ------------------------------------------------------------------ */
/* Headless match runner                                               */
/* ------------------------------------------------------------------ */

/** Applies budget: a 10-round 4-seat match measures ~90-110 applies. */
const ACTION_BUDGET = 400;

function runMatch({ seed, boardId, seats, rules = {}, real = false }) {
  const sim = createMatchSim({
    seed,
    boardId,
    rules: { rounds: 10, ...rules },
    players: seats.map((difficulty, i) => ({
      id: `p${i}`, name: `P${i}`, isBot: true, difficulty,
    })),
  });
  const botRng = createRng((seed ^ 0x9e3779b9) >>> 0);
  const mgRng = createRng((seed ^ 0x51ed) >>> 0);
  let applies = 0;
  while (applies < ACTION_BUDGET) {
    const state = sim.getState();
    if (state.phase === 'game_over') break;
    if (state.phase === 'minigame') {
      const results = real ? realResults(state, mgRng) : stubResults(state, mgRng);
      sim.apply({ type: 'minigameResults', playerId: state.turnOrder[0], payload: { results } });
      applies += 1;
      continue;
    }
    const awaiting = state.awaiting;
    assert.ok(awaiting, `sim stalled in phase "${state.phase}" with no awaiting`);
    const legal = sim.legalActions(awaiting.playerId);
    assert.ok(legal.length > 0, `no legal actions for ${awaiting.decision}`);
    const action = decideBoardAction(state, legal, awaiting.playerId,
      state.players[awaiting.playerId].difficulty ?? 'normal', botRng);
    assert.ok(legal.includes(action), 'bot must return one of the legal actions');
    sim.apply(action);
    applies += 1;
  }
  const state = sim.getState();
  const log = sim.getEventLog();
  const over = log.find((e) => e.type === 'game_over');
  const itemPlays = {};
  for (const e of log) {
    if (e.type !== 'item') continue;
    if (e.kind === 'used' || e.kind === 'consumed'
      || (e.kind === 'granted' && e.consumedOnAcquire)) {
      itemPlays[e.itemId] = (itemPlays[e.itemId] ?? 0) + 1;
    }
  }
  return {
    finished: state.phase === 'game_over',
    applies,
    winner: over?.winner ?? null,
    ranking: over?.ranking ?? [],
    starBuys: log.filter((e) => e.type === 'star' && e.kind === 'bought').length,
    itemPlays,
    log,
  };
}

/**
 * n matches across the real boards; the difficulty->seat map rotates per
 * match so seat fairness decouples from bot skill.
 */
function mixedBatch({ n, real = false, rules = {}, seedBase }) {
  const out = [];
  for (let m = 0; m < n; m += 1) {
    const rot = m % 4;
    const seats = [0, 1, 2, 3].map((s) => DIFFS[(s + rot) % 4]);
    out.push({
      seats,
      ...runMatch({
        seed: seedBase + m * 7919,
        boardId: BOARD_IDS[m % BOARD_IDS.length],
        seats,
        rules,
        real,
      }),
    });
  }
  return out;
}

const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

/* ------------------------------------------------------------------ */
/* (a)-(e) structural fairness batch - stub minigames, 40 matches      */
/* ------------------------------------------------------------------ */

test('batch: 40 mixed-board matches - difficulty ordering, seat fairness, star liquidity, item coverage, action budget', () => {
  const batch = mixedBatch({ n: 40, seedBase: 1000 });

  const winsByDiff = {};
  const winsBySeat = {};
  const rankByDiff = {};
  const plays = {};
  let matchesWithStar = 0;
  for (const m of batch) {
    // (e) no-hang: every match reaches game_over within the action budget.
    assert.ok(m.finished, 'match must reach game_over within the budget');
    assert.ok(m.applies < ACTION_BUDGET, `applies ${m.applies} under budget`);

    const seat = Number(m.winner.slice(1));
    winsByDiff[m.seats[seat]] = (winsByDiff[m.seats[seat]] ?? 0) + 1;
    winsBySeat[seat] = (winsBySeat[seat] ?? 0) + 1;
    m.seats.forEach((d, s) => (rankByDiff[d] ??= []).push(m.ranking.indexOf(`p${s}`) + 1));
    if (m.starBuys > 0) matchesWithStar += 1;
    for (const [k, v] of Object.entries(m.itemPlays)) plays[k] = (plays[k] ?? 0) + v;
  }

  // (a) hard beats easy in aggregate. Measured: hard avg rank 2.27 / 7 wins
  // vs easy 3.25 / 4 wins (wild wins most - it is the calibrated sharpest
  // minigame profile, see header note 2).
  assert.ok((winsByDiff.hard ?? 0) >= (winsByDiff.easy ?? 0),
    `hard wins (${winsByDiff.hard ?? 0}) >= easy wins (${winsByDiff.easy ?? 0})`);
  assert.ok(avg(rankByDiff.easy) - avg(rankByDiff.hard) >= 0.3,
    `hard avg rank (${avg(rankByDiff.hard).toFixed(2)}) clearly better than easy (${avg(rankByDiff.easy).toFixed(2)})`);

  // (b) turn-order fairness: no seat wins >40% of the batch.
  // Measured 7/12/10/11 - the scoring.js seeded bonus tie-break keeps
  // seat 0 from snowballing (38.3% -> 29.5% on the 400-match census).
  for (const [seat, wins] of Object.entries(winsBySeat)) {
    assert.ok(wins / batch.length <= 0.4,
      `seat ${seat} won ${wins}/${batch.length} (> 40%)`);
  }

  // (c) economy liquidity: >80% of 10-round matches see a star bought.
  // Measured 39/40 (2.63 buys/match).
  assert.ok(matchesWithStar / batch.length > 0.8,
    `stars bought in ${matchesWithStar}/${batch.length} matches`);

  // (d) every item fires at least once across the batch (items:'normal').
  // Measured floor: mini_gorilla/swap_totem/shop_coupon at 5 plays each.
  const neverPlayed = items.ids().filter((id) => !plays[id]);
  assert.deepEqual(neverPlayed, [], `items never used: ${neverPlayed.join(', ')}`);
});

/* ------------------------------------------------------------------ */
/* Real-minigame fidelity batch (slow path, kept small)                */
/* ------------------------------------------------------------------ */

test('batch: 6 matches with REAL minigame sims finish within budget with liquid stars', () => {
  const batch = mixedBatch({ n: 6, real: true, seedBase: 5000 });
  let matchesWithStar = 0;
  for (const m of batch) {
    assert.ok(m.finished, 'real-minigame match must reach game_over');
    assert.ok(m.applies < ACTION_BUDGET, `applies ${m.applies} under budget`);
    if (m.starBuys > 0) matchesWithStar += 1;
  }
  // Measured 6/6 (maxApplies 94).
  assert.ok(matchesWithStar >= 4, `stars bought in ${matchesWithStar}/6 real matches`);
});

test('real minigame sims: per-difficulty skill ordering (easy worst, hard beats normal)', () => {
  // 24 real FFA sims, difficulty rotating through the seats. Measured avg
  // ranks: easy 3.71, normal 2.88, hard 2.00, wild 1.42 (of 4). These are
  // the FROZEN minigame bot tables - the ordering documented here is what
  // difficulty.js's board profiles compensate against (see header note 2).
  const ranksByDiff = { easy: [], normal: [], hard: [], wild: [] };
  const ffaDefs = minigames.all().filter((d) => d.category === 'ffa'
    && d.players.min <= 4 && 4 <= d.players.max);
  assert.ok(ffaDefs.length >= 10, 'enough FFA minigames to sample');
  for (let i = 0; i < 24; i += 1) {
    const def = ffaDefs[i % ffaDefs.length];
    const seed = (0xabc123 + i * 104729) >>> 0;
    const rot = i % 4;
    const seats = [0, 1, 2, 3].map((s) => DIFFS[(s + rot) % 4]);
    const players = ['p0', 'p1', 'p2', 'p3'];
    const sim = def.createSim({
      seed, players, params: JSON.parse(JSON.stringify(def.params ?? {})), rules: {},
    });
    sim.init();
    const rngs = new Map(players.map((pid, j) => [pid, createRng((seed + j * 7919) >>> 0)]));
    const cap = def.durationSec * MINIGAME_HZ + 300;
    let ticks = 0;
    while (!sim.isFinished() && ticks < cap) {
      const s = sim.getState();
      const inputs = {};
      players.forEach((pid, j) => { inputs[pid] = def.bot(s, pid, seats[j], rngs.get(pid)); });
      sim.step(inputs);
      ticks += 1;
    }
    sim.getResults().ranking.flat().forEach((pid, rank) => {
      ranksByDiff[seats[Number(pid.slice(1))]].push(rank + 1);
    });
  }
  assert.ok(avg(ranksByDiff.easy) > avg(ranksByDiff.normal) + 0.3, 'easy ranks below normal');
  assert.ok(avg(ranksByDiff.normal) > avg(ranksByDiff.hard) + 0.3, 'normal ranks below hard');
  assert.ok(avg(ranksByDiff.easy) > avg(ranksByDiff.hard) + 1.0, 'easy far below hard');
});

/* ------------------------------------------------------------------ */
/* Determinism regression pin                                          */
/* ------------------------------------------------------------------ */

test('determinism: pinned seed replays byte-identically and reproduces the pinned outcome', () => {
  const run = () => runMatch({
    seed: 0xBA7A2CE,
    boardId: 'jungle_ruins',
    seats: ['easy', 'normal', 'hard', 'wild'],
  });
  const a = run();
  const b = run();
  assert.equal(JSON.stringify(a.log), JSON.stringify(b.log), 'same seed -> identical event log');
  // Pinned outcome for seed 0xBA7A2CE on jungle_ruins (REGENERATE this pin
  // if a future legitimate tuning change alters it - its job is to catch
  // ACCIDENTAL nondeterminism, e.g. an unseeded random sneaking in).
  // Regenerated after minigame batch3 landed: 8 more registered minigames
  // shift the seeded minigame-selection stream, which is a legitimate
  // content change, not nondeterminism.
  assert.ok(a.finished);
  assert.equal(a.winner, 'p3');
  assert.deepEqual(a.ranking, ['p3', 'p1', 'p0', 'p2']);
  assert.equal(a.starBuys, 3);
});

/* ------------------------------------------------------------------ */
/* Preset liquidity (rules.js tuning)                                  */
/* ------------------------------------------------------------------ */

test('fast preset: 5-round matches still end on golden bananas (star liquidity)', () => {
  // Before the startCoins 15->20 / starPrice 20->15 retune, 42% of fast
  // matches saw ZERO stars. Measured now: 15/20 with a star, 1.05 buys/match.
  let withStar = 0;
  for (let m = 0; m < 20; m += 1) {
    const rot = m % 4;
    const seats = [0, 1, 2, 3].map((s) => DIFFS[(s + rot) % 4]);
    const s = runMatch({
      seed: 9000 + m * 7919,
      boardId: BOARD_IDS[m % BOARD_IDS.length],
      seats,
      rules: { ...PRESETS.fast },
    });
    assert.ok(s.finished);
    if (s.starBuys > 0) withStar += 1;
  }
  assert.ok(withStar >= 14, `fast preset: star bought in ${withStar}/20 matches`);
});

test('hardcore preset: punishing but not a stalemate (stars still trade)', () => {
  // Measured 11/12 with a star, 1.67 buys/match at startCoins 0 / price 30.
  let withStar = 0;
  for (let m = 0; m < 12; m += 1) {
    const rot = m % 4;
    const seats = [0, 1, 2, 3].map((s) => DIFFS[(s + rot) % 4]);
    const s = runMatch({
      seed: 3000 + m * 7919,
      boardId: BOARD_IDS[m % BOARD_IDS.length],
      seats,
      rules: { ...PRESETS.hardcore },
    });
    assert.ok(s.finished);
    if (s.starBuys > 0) withStar += 1;
  }
  assert.ok(withStar >= 9, `hardcore preset: star bought in ${withStar}/12 matches`);
});

/* ------------------------------------------------------------------ */
/* Minigame selection distribution (select.js verification)            */
/* ------------------------------------------------------------------ */

test('minigame selection: 500 seeded picks - every family competes as ~one game, anti-repeat holds', () => {
  const rng = createRng(0x5e1ec7);
  const players = ['p1', 'p2', 'p3', 'p4'].map((id) => ({ id, lastFieldColor: null }));
  const history = [];
  const byFamily = {};
  let violations = 0;

  const N = 500;
  for (let i = 0; i < N; i += 1) {
    const picked = selectMinigame({ rules: { ...DEFAULT_RULES }, players, history: history.slice(), rng });
    assert.ok(picked, 'selector always returns a pick for a 4-player table');
    const fam = familyOf(minigames.get(picked.minigameId));
    byFamily[fam] = (byFamily[fam] ?? 0) + 1;
    const recent = history.slice(-ANTI_REPEAT_WINDOW);
    const recentFams = new Set(recent.map((id) => familyOf(minigames.get(id))));
    if (recent.includes(picked.minigameId) || recentFams.has(fam)) violations += 1;
    history.push(picked.minigameId);
  }

  assert.equal(violations, 0, 'no id/family repeats inside the anti-repeat window');

  // Eligible pool for a 4-player neutral table = ffa/team defs fitting 4.
  const eligibleFamilies = new Set(
    minigames.all()
      .filter((d) => ['ffa', 'team'].includes(d.category)
        && (d.players?.min ?? 1) <= 4 && 4 <= (d.players?.max ?? 8))
      .map((d) => familyOf(d)),
  );
  // Measured: 18 families, each within 4.2-6.4% (fair split ~5.6%) - i.e.
  // template variants really do split ONE family share, so a 7-variant
  // family does not appear 7x as often as a unique custom game.
  for (const fam of eligibleFamilies) {
    const share = (byFamily[fam] ?? 0) / N;
    assert.ok(share > 0.015, `family "${fam}" starved (${(share * 100).toFixed(1)}%)`);
    assert.ok(share < 0.12, `family "${fam}" dominates (${(share * 100).toFixed(1)}%)`);
  }
  for (const fam of Object.keys(byFamily)) {
    assert.ok(eligibleFamilies.has(fam), `picked family "${fam}" is eligible`);
  }
});

/* ------------------------------------------------------------------ */
/* Difficulty profile shape guards                                     */
/* ------------------------------------------------------------------ */

test('difficulty profiles: easy is noisy+shortsighted, hard is consistent, wild gambles loudest', () => {
  assert.ok(PROFILES.easy.noise > PROFILES.normal.noise, 'easy noisier than normal');
  assert.ok(PROFILES.normal.noise > PROFILES.hard.noise, 'normal noisier than hard');
  assert.ok(PROFILES.easy.lookahead < PROFILES.normal.lookahead, 'easy reads less board than normal');
  assert.ok(PROFILES.normal.lookahead < PROFILES.hard.lookahead, 'normal reads less board than hard');
  assert.ok(PROFILES.hard.randomChance < PROFILES.normal.randomChance, 'hard gambles least');
  assert.ok(PROFILES.normal.randomChance < PROFILES.easy.randomChance, 'easy gambles more than normal');
  assert.ok(PROFILES.wild.randomChance >= PROFILES.easy.randomChance, 'wild gambles the most');
  assert.ok(PROFILES.wild.noise > PROFILES.easy.noise, 'wild is the loudest profile');
});

/* ------------------------------------------------------------------ */
/* Bot heuristics on a constructed fixture                             */
/* ------------------------------------------------------------------ */

// Symmetric two-branch loop: the ONLY asymmetry between branch A and B is
// the shop on a02. The star node is set per test via state.board.starNode.
//
//   s00 -> s01 =junction=> a01 -> a02(shop) -> a03 -> a04 -> m01
//                          b01 -> b02 ------> b03 -> b04 -> m01
//   m01 -> m02 =junction=> t01/u01 -> m03 -> s00 (loop)
const FIXTURE_ID = 'bal_fixture';
boards.register({
  id: FIXTURE_ID,
  name: { en: 'Balance Fixture', de: 'Balance-Fixture' },
  description: { en: 'Symmetric fixture for bot heuristic tests.', de: 'Symmetrische Fixture fuer Bot-Heuristik-Tests.' },
  difficulty: 1,
  theme: { sky: null, fog: null, ambient: null, palette: { primary: '#166534', secondary: '#0c4a6e', accent: '#f59e0b' } },
  music: { tempo: 110, scale: null, pattern: null },
  nodes: [
    { id: 's00', pos: [0, 0, 0], type: 'start', next: ['s01'] },
    { id: 's01', pos: [1, 0, 0], type: 'junction', next: ['a01', 'b01'] },
    { id: 'a01', pos: [2, 0, 1], type: 'blue', next: ['a02'] },
    { id: 'a02', pos: [3, 0, 1], type: 'shop', next: ['a03'] },
    { id: 'a03', pos: [4, 0, 1], type: 'blue', next: ['a04'] },
    { id: 'a04', pos: [5, 0, 1], type: 'blue', next: ['m01'] },
    { id: 'b01', pos: [2, 0, -1], type: 'blue', next: ['b02'] },
    { id: 'b02', pos: [3, 0, -1], type: 'blue', next: ['b03'] },
    { id: 'b03', pos: [4, 0, -1], type: 'blue', next: ['b04'] },
    { id: 'b04', pos: [5, 0, -1], type: 'blue', next: ['m01'] },
    { id: 'm01', pos: [6, 0, 0], type: 'blue', next: ['m02'] },
    { id: 'm02', pos: [7, 0, 0], type: 'junction', next: ['t01', 'u01'] },
    { id: 't01', pos: [8, 0, 1], type: 'blue', next: ['m03'] },
    { id: 'u01', pos: [8, 0, -1], type: 'blue', next: ['m03'] },
    { id: 'm03', pos: [9, 0, 0], type: 'blue', next: ['s00'] },
  ],
  starSpawns: ['a03', 'm01'],
  shops: [{ node: 'a02', stock: ['double_dice', 'shield_shell', 'lucky_mask'] }],
  events: {},
  mechanics: [],
  bossEvent: null,
  view: null,
});

const freshStats = () => ({
  fieldsMoved: 0, coinsLost: 0, itemsUsed: 0, minigameWins: 0, minigameCoins: 0, eventsHit: 0,
});

/** Constructed 2-player state on the fixture (same shape as sim.test.js). */
function makeState({ starNode, me = {}, rival = {}, awaiting }) {
  return {
    matchId: 'm_bal',
    seed: 1,
    boardId: FIXTURE_ID,
    rules: { ...DEFAULT_RULES },
    protocolVersion: 1,
    round: 1,
    phase: 'roll',
    turnOrder: ['p1', 'p2'],
    currentTurn: 0,
    players: {
      p1: {
        id: 'p1', name: 'P1', characterId: null, cosmetics: {}, isBot: true, difficulty: 'hard',
        node: 's01', facingNext: null, coins: 25, goldenBananas: 0, items: [],
        effects: [], lastFieldColor: null, connected: true, stats: freshStats(), ...me,
      },
      p2: {
        id: 'p2', name: 'P2', characterId: null, cosmetics: {}, isBot: true, difficulty: 'hard',
        node: 'b02', facingNext: null, coins: 5, goldenBananas: 1, items: [],
        effects: [], lastFieldColor: null, connected: true, stats: freshStats(), ...rival,
      },
    },
    board: { starNode, traps: {}, mechanics: {}, blockedNodes: [], shopStockOverrides: {} },
    minigame: null,
    awaiting,
    rngState: 0,
  };
}

/** How often (out of 50 seeds) the bot picks the action matching `match`. */
function pickRate(state, legal, difficulty, match) {
  let hits = 0;
  for (let seed = 1; seed <= 50; seed += 1) {
    const action = decideBoardAction(state, legal, 'p1', difficulty, createRng(seed));
    if (match(action)) hits += 1;
  }
  return hits;
}

test('bot heuristic: junctions route toward an affordable star', () => {
  // Star on branch A (a03, dist 2 from a01) vs 12 via branch B.
  const state = makeState({
    starNode: 'a03',
    awaiting: { playerId: 'p1', decision: 'junction', options: ['a01', 'b01'] },
  });
  const legal = [
    { type: 'junction', playerId: 'p1', payload: { choice: 'a01' } },
    { type: 'junction', playerId: 'p1', payload: { choice: 'b01' } },
  ];
  const starSide = (a) => a.payload.choice === 'a01';
  assert.ok(pickRate(state, legal, 'hard', starSide) >= 45, 'hard bots track the star branch');
  assert.ok(pickRate(state, legal, 'easy', starSide) >= 30, 'even easy bots lean toward the star');
});

test('bot heuristic: rich + itemless routes toward the shop branch', () => {
  // Star at m01 = same distance from both branches; the shop on a02 is the
  // only asymmetry. 'normal' lookahead (8) sees the shop from a01 but not
  // around the whole loop from b01.
  const legal = [
    { type: 'junction', playerId: 'p1', payload: { choice: 'a01' } },
    { type: 'junction', playerId: 'p1', payload: { choice: 'b01' } },
  ];
  const shopSide = (a) => a.payload.choice === 'a01';
  const rich = makeState({
    starNode: 'm01',
    me: { coins: 25, items: [] },
    awaiting: { playerId: 'p1', decision: 'junction', options: ['a01', 'b01'] },
  });
  const stuffed = makeState({
    starNode: 'm01',
    me: { coins: 25, items: ['shield_shell', 'lucky_mask', 'double_dice'] },
    awaiting: { playerId: 'p1', decision: 'junction', options: ['a01', 'b01'] },
  });
  const richRate = pickRate(rich, legal, 'normal', shopSide);
  const stuffedRate = pickRate(stuffed, legal, 'normal', shopSide);
  assert.ok(richRate >= 40, `rich itemless bot heads for the shop (${richRate}/50)`);
  assert.ok(stuffedRate <= 35, `full bag -> shop is just noise (${stuffedRate}/50)`);
  assert.ok(richRate > stuffedRate, 'the shop pull comes from being rich + itemless');
});

test('bot heuristic: traps land on the star approach, not on busy dead corners', () => {
  // Star at m01. m03 has traffic 2 (t01+u01) but is 7 steps from the star;
  // b04 has traffic 1 but sits 1 step before the star. Pre-fix scores were
  // m03=7 > b04=4 (traffic only); with the star-path term b04=8 > m03=7.
  const state = makeState({
    starNode: 'm01',
    me: { node: 'b02', items: ['coconut_trap'] },
    awaiting: {
      playerId: 'p1', decision: 'itemTarget', itemId: 'coconut_trap', options: { targets: ['m03', 'b04'] },
    },
  });
  const legal = [
    { type: 'itemTarget', playerId: 'p1', payload: { target: 'm03' } },
    { type: 'itemTarget', playerId: 'p1', payload: { target: 'b04' } },
  ];
  const rate = pickRate(state, legal, 'hard', (a) => a.payload.target === 'b04');
  assert.ok(rate >= 45, `hard bots trap the star lane (${rate}/50)`);
});

test('bot heuristic: dice draft prefers the bigger die that still reaches the star', () => {
  // p1 on b03, star m01 (dist 2), 25 coins >= starPrice 20. The star
  // prompts on PASS (movement.js performStep), so value 5 buys the same
  // star AND keeps moving; the old exact-landing bonus picked the 2.
  const state = makeState({
    starNode: 'm01',
    me: { node: 'b03' },
    awaiting: { playerId: 'p1', decision: 'dicePick', options: [2, 5] },
  });
  const legal = [
    { type: 'dicePick', playerId: 'p1', payload: { value: 2 } },
    { type: 'dicePick', playerId: 'p1', payload: { value: 5 } },
  ];
  const rate = pickRate(state, legal, 'hard', (a) => a.payload.value === 5);
  assert.ok(rate >= 45, `hard bots take the bigger star-reaching die (${rate}/50)`);
});

test('bot heuristic: ghost_banana fires when a rival can afford the star', () => {
  const legal = [
    { type: 'useItem', playerId: 'p1', payload: { itemId: 'ghost_banana' } },
    { type: 'skipItem', playerId: 'p1', payload: {} },
    { type: 'roll', playerId: 'p1', payload: {} },
  ];
  const awaiting = { playerId: 'p1', decision: 'roll', options: { usableItems: ['ghost_banana'] } };
  const ghost = (a) => a.type === 'useItem' && a.payload.itemId === 'ghost_banana';

  // Rival holds 25 >= starPrice 20 -> steal now (score 11 beats roll's 10).
  const threat = makeState({
    starNode: 'm01',
    me: { items: ['ghost_banana'] },
    rival: { coins: 25 },
    awaiting,
  });
  // Rival holds 8 (< 10) -> hoarding beats a pointless haunt (score 3).
  const broke = makeState({
    starNode: 'm01',
    me: { items: ['ghost_banana'] },
    rival: { coins: 8 },
    awaiting,
  });
  const threatRate = pickRate(threat, legal, 'hard', ghost);
  const brokeRate = pickRate(broke, legal, 'hard', ghost);
  assert.ok(threatRate >= 40, `hard bots deny the rival's star budget (${threatRate}/50)`);
  assert.ok(brokeRate <= 10, `no ghost wasted on a broke rival (${brokeRate}/50)`);
});
