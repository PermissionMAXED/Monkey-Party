/**
 * Tournament (cup) model tests - shared/tournament.js is pure and is
 * imported directly (no DOM, no registration step needed).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CUPS,
  PLACEMENT_POINTS,
  TOURNAMENT_SEATS,
  PLAYER_PID,
  getCup,
  createTournament,
  currentLeg,
  applyMatchResult,
  standings,
  isComplete,
  champion,
  sanitizeTournament,
} from '#shared/tournament.js';
import { BOARD_IDS } from '#shared/content/boards/index.js';
import { CHARACTER_IDS } from '#shared/content/characters/index.js';
import { validateRules } from '#shared/rules.js';

/* ------------------------------------------------------------------ */
/* CUPS                                                                */
/* ------------------------------------------------------------------ */

test('CUPS: 4 cups of 3 boards cover all 12 board ids exactly once', () => {
  assert.equal(CUPS.length, 4);
  const seen = [];
  for (const cup of CUPS) {
    assert.equal(cup.boards.length, 3, `${cup.id} must have 3 boards`);
    seen.push(...cup.boards);
  }
  assert.equal(seen.length, 12);
  assert.equal(new Set(seen).size, 12, 'no board appears twice');
  assert.deepEqual([...seen].sort(), [...BOARD_IDS].sort(), 'cups cover exactly the canonical boards');
});

test('CUPS: fixed difficulty/length ramp (cup 1 easy + 5 rounds -> cup 4 hard + 10 rounds)', () => {
  assert.equal(CUPS[0].rules.botDifficulty, 'easy');
  assert.equal(CUPS[0].rules.rounds, 5);
  assert.equal(CUPS[3].rules.botDifficulty, 'hard');
  assert.equal(CUPS[3].rules.rounds, 10);
  // Every cup's partial rules must survive validateRules untouched.
  for (const cup of CUPS) {
    const validated = validateRules(cup.rules);
    for (const [key, value] of Object.entries(cup.rules)) {
      assert.equal(validated[key], value, `${cup.id} rules.${key} must be a legal value`);
    }
  }
  assert.equal(getCup('banana_cup'), CUPS[0]);
  assert.equal(getCup('nope'), null);
});

/* ------------------------------------------------------------------ */
/* createTournament determinism                                        */
/* ------------------------------------------------------------------ */

const BASE = { seed: 12345, cupId: 'banana_cup', playerName: 'Tester', characterId: CHARACTER_IDS[0] };

test('createTournament: deterministic for a fixed seed (roster + legs)', () => {
  const a = createTournament(BASE);
  const b = createTournament({ ...BASE });
  assert.deepEqual(a, b, 'same inputs -> identical state');
  const c = createTournament({ ...BASE, seed: 54321 });
  assert.notDeepEqual(
    { roster: a.roster, legSeeds: a.legs.map((l) => l.seed) },
    { roster: c.roster, legSeeds: c.legs.map((l) => l.seed) },
    'a different seed changes roster/leg seeds',
  );
});

test('createTournament: roster is the player + 3 distinct rival bots', () => {
  const t = createTournament(BASE);
  assert.equal(t.roster.length, TOURNAMENT_SEATS);
  assert.equal(t.roster[0].pid, PLAYER_PID);
  assert.equal(t.roster[0].isBot, false);
  assert.equal(t.roster[0].characterId, CHARACTER_IDS[0]);
  const bots = t.roster.slice(1);
  assert.ok(bots.every((r) => r.isBot));
  assert.deepEqual(bots.map((r) => r.pid), ['bot1', 'bot2', 'bot3']);
  const chars = bots.map((r) => r.characterId);
  assert.equal(new Set(chars).size, 3, 'rival characters are distinct');
  assert.ok(!chars.includes(t.roster[0].characterId), 'no rival copies the player character');
  assert.ok(chars.every((id) => CHARACTER_IDS.includes(id)));
});

test('createTournament: legs carry the cup boards, per-leg seeds and full rules', () => {
  const t = createTournament(BASE);
  assert.deepEqual(t.legs.map((l) => l.boardId), CUPS[0].boards);
  assert.equal(new Set(t.legs.map((l) => l.seed)).size, t.legs.length, 'leg seeds differ');
  for (const leg of t.legs) {
    assert.equal(leg.rules.rounds, 5);
    assert.equal(leg.rules.botDifficulty, 'easy');
    assert.equal(leg.rules.maxSeats, TOURNAMENT_SEATS);
    assert.equal(leg.rules.botsFill, false);
    assert.equal(leg.botDifficulty, 'easy');
  }
});

test('createTournament: optional difficulty override applies to every leg', () => {
  const t = createTournament({ ...BASE, difficulty: 'hard' });
  assert.ok(t.legs.every((l) => l.botDifficulty === 'hard' && l.rules.botDifficulty === 'hard'));
  const invalid = createTournament({ ...BASE, difficulty: 'impossible' });
  assert.equal(invalid.difficulty, null, 'unknown difficulties are dropped');
  assert.ok(invalid.legs.every((l) => l.botDifficulty === 'easy'));
});

test('createTournament: rejects unknown cups', () => {
  assert.throws(() => createTournament({ seed: 1, cupId: 'tin_cup' }), /unknown cup/);
});

/* ------------------------------------------------------------------ */
/* applyMatchResult                                                    */
/* ------------------------------------------------------------------ */

test('applyMatchResult: placement points 10/7/4/2 and accumulation', () => {
  assert.deepEqual(PLACEMENT_POINTS, [10, 7, 4, 2]);
  let t = createTournament(BASE);
  t = applyMatchResult(t, {
    placement: 1,
    bananas: 2,
    coins: 30,
    others: [
      { pid: 'bot1', placement: 2, bananas: 1, coins: 20 },
      { pid: 'bot2', placement: 3, bananas: 0, coins: 10 },
      { pid: 'bot3', placement: 4, bananas: 0, coins: 5 },
    ],
  });
  assert.equal(t.results.length, 1);
  assert.deepEqual(t.results[0].points, { p1: 10, bot1: 7, bot2: 4, bot3: 2 });

  t = applyMatchResult(t, {
    placement: 3,
    bananas: 1,
    coins: 12,
    others: [
      { pid: 'bot1', placement: 1, bananas: 2, coins: 25 },
      { pid: 'bot2', placement: 2, bananas: 1, coins: 18 },
      { pid: 'bot3', placement: 4, bananas: 0, coins: 3 },
    ],
  });
  const rows = standings(t);
  const byPid = Object.fromEntries(rows.map((r) => [r.pid, r]));
  assert.equal(byPid.p1.points, 14);
  assert.equal(byPid.bot1.points, 17);
  assert.equal(byPid.bot2.points, 11);
  assert.equal(byPid.bot3.points, 4);
  assert.equal(byPid.p1.bananas, 3);
  assert.equal(byPid.p1.coins, 42);
  assert.equal(byPid.p1.wins, 1);
  assert.equal(rows[0].pid, 'bot1', 'most points leads the standings');
});

test('applyMatchResult: never mutates its input', () => {
  const t0 = createTournament(BASE);
  const frozen = JSON.stringify(t0);
  const t1 = applyMatchResult(t0, { placement: 2, bananas: 1, coins: 9 });
  assert.equal(JSON.stringify(t0), frozen, 'input unchanged');
  assert.notEqual(t0, t1);
  assert.equal(t0.results.length, 0);
  assert.equal(t1.results.length, 1);
});

test('applyMatchResult: fills rival placements deterministically when others is omitted', () => {
  const t0 = createTournament(BASE);
  const a = applyMatchResult(t0, { placement: 2 });
  const b = applyMatchResult(t0, { placement: 2 });
  assert.deepEqual(a.results[0].placements, b.results[0].placements);
  const places = Object.values(a.results[0].placements).sort();
  assert.deepEqual(places, [1, 2, 3, 4], 'placements form a permutation of 1..4');
  assert.equal(a.results[0].placements.p1, 2);
});

test('applyMatchResult: validates placements', () => {
  const t = createTournament(BASE);
  assert.throws(() => applyMatchResult(t, { placement: 0 }), /placement must be an integer/);
  assert.throws(() => applyMatchResult(t, { placement: 5 }), /placement must be an integer/);
  assert.throws(() => applyMatchResult(t, { placement: 1.5 }), /placement must be an integer/);
  assert.throws(() => applyMatchResult(t, {
    placement: 1,
    others: [
      { pid: 'bot1', placement: 2 },
      { pid: 'bot2', placement: 2 },
      { pid: 'bot3', placement: 4 },
    ],
  }), /every seat exactly once/);
  assert.throws(() => applyMatchResult(t, {
    placement: 1,
    others: [{ pid: 'ghost', placement: 2 }],
  }), /unknown rival/);
});

/* ------------------------------------------------------------------ */
/* standings tiebreaks                                                 */
/* ------------------------------------------------------------------ */

test('standings: equal points break on bananas, then coins, then roster order', () => {
  // Two legs with mirrored 1st/2nd (p1 <-> bot1) and 3rd/4th (bot2 <-> bot3):
  // p1 and bot1 tie at 17 points, bot2 and bot3 tie at 6 points.
  const playTwoLegs = (leg2Bot3Coins) => {
    let t = createTournament(BASE);
    t = applyMatchResult(t, {
      placement: 1,
      bananas: 1,
      coins: 10,
      others: [
        { pid: 'bot1', placement: 2, bananas: 1, coins: 10 },
        { pid: 'bot2', placement: 3, bananas: 0, coins: 0 },
        { pid: 'bot3', placement: 4, bananas: 0, coins: 0 },
      ],
    });
    return applyMatchResult(t, {
      placement: 2,
      bananas: 1,
      coins: 10,
      others: [
        { pid: 'bot1', placement: 1, bananas: 2, coins: 10 },
        { pid: 'bot2', placement: 4, bananas: 0, coins: 0 },
        { pid: 'bot3', placement: 3, bananas: 0, coins: leg2Bot3Coins },
      ],
    });
  };

  let rows = standings(playTwoLegs(0));
  assert.equal(rows[0].points, rows[1].points, 'tie on points at the top');
  assert.equal(rows[0].pid, 'bot1', 'banana tiebreak wins (3 > 2)');
  assert.equal(rows[1].pid, PLAYER_PID);
  let i2 = rows.findIndex((r) => r.pid === 'bot2');
  let i3 = rows.findIndex((r) => r.pid === 'bot3');
  assert.equal(rows[i2].points, rows[i3].points);
  assert.equal(rows[i2].bananas, rows[i3].bananas);
  assert.equal(rows[i2].coins, rows[i3].coins);
  assert.ok(i2 < i3, 'fully tied rows keep roster order (bot2 before bot3)');

  // Same run, but bot3 out-earns bot2 in coins -> coin tiebreak flips them.
  rows = standings(playTwoLegs(99));
  i2 = rows.findIndex((r) => r.pid === 'bot2');
  i3 = rows.findIndex((r) => r.pid === 'bot3');
  assert.equal(rows[i2].points, rows[i3].points);
  assert.equal(rows[i2].bananas, rows[i3].bananas);
  assert.ok(rows[i3].coins > rows[i2].coins);
  assert.ok(i3 < i2, 'coin tiebreak ranks bot3 above bot2');
});

/* ------------------------------------------------------------------ */
/* Completion + champion                                               */
/* ------------------------------------------------------------------ */

test('completing all legs yields isComplete and a champion', () => {
  let t = createTournament(BASE);
  assert.equal(isComplete(t), false);
  assert.equal(champion(t), null);
  for (let i = 0; i < t.legs.length; i += 1) {
    const leg = currentLeg(t);
    assert.equal(leg.index, i);
    assert.equal(leg.boardId, CUPS[0].boards[i]);
    assert.equal(leg.roster.length, TOURNAMENT_SEATS);
    t = applyMatchResult(t, { placement: 1, bananas: 2, coins: 20 });
  }
  assert.equal(isComplete(t), true);
  assert.equal(currentLeg(t), null);
  const winner = champion(t);
  assert.equal(winner.pid, PLAYER_PID, 'three 1st places make the player champion');
  assert.equal(winner.points, 30);
  assert.throws(() => applyMatchResult(t, { placement: 1 }), /already complete/);
});

/* ------------------------------------------------------------------ */
/* Serialization                                                       */
/* ------------------------------------------------------------------ */

test('serialization: JSON round-trip preserves behavior', () => {
  let t = createTournament(BASE);
  t = applyMatchResult(t, { placement: 2, bananas: 1, coins: 14 });

  const copy = JSON.parse(JSON.stringify(t));
  assert.deepEqual(copy, t, 'plain serializable object');
  assert.deepEqual(standings(copy), standings(t));
  assert.deepEqual(currentLeg(copy), currentLeg(t));

  const result = {
    placement: 1,
    bananas: 3,
    coins: 21,
    others: [
      { pid: 'bot1', placement: 3, bananas: 0, coins: 7 },
      { pid: 'bot2', placement: 2, bananas: 1, coins: 9 },
      { pid: 'bot3', placement: 4, bananas: 0, coins: 2 },
    ],
  };
  const next = applyMatchResult(t, result);
  const nextCopy = applyMatchResult(copy, result);
  assert.deepEqual(nextCopy, next, 'reducers behave identically after a round-trip');
  assert.deepEqual(standings(nextCopy), standings(next));
});

test('sanitizeTournament: accepts a persisted run and rejects garbage', () => {
  let t = createTournament(BASE);
  t = applyMatchResult(t, { placement: 2, bananas: 1, coins: 14 });
  const restored = sanitizeTournament(JSON.parse(JSON.stringify(t)));
  assert.deepEqual(restored, t, 'valid persisted data restores byte-identically');

  assert.equal(sanitizeTournament(null), null);
  assert.equal(sanitizeTournament('banana'), null);
  assert.equal(sanitizeTournament({}), null);
  assert.equal(sanitizeTournament({ seed: 1, cupId: 'tin_cup' }), null);

  // Tampered results (impossible placement) invalidate the whole save.
  const tampered = JSON.parse(JSON.stringify(t));
  tampered.results[0].placements.p1 = 99;
  assert.equal(sanitizeTournament(tampered), null);

  // Too many results cannot be replayed.
  const overfull = JSON.parse(JSON.stringify(t));
  overfull.results = [...overfull.results, ...overfull.results, ...overfull.results, ...overfull.results];
  assert.equal(sanitizeTournament(overfull), null);
});
