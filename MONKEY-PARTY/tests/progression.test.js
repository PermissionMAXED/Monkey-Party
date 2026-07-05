/**
 * Progression & meta package tests:
 *   - profile v2 sanitize round-trips legacy (v1) shapes losslessly and
 *     never throws on corrupt localStorage junk,
 *   - levelForXp is monotonic and inverts xpForLevel,
 *   - applyMatchResults on a synthetic final state produces the expected
 *     XP / banana-bank / tallies / achievements / history entry,
 *   - history caps at 20 entries,
 *   - the achievements catalog is well-formed.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_PROFILE,
  sanitizeProfile,
  levelForXp,
  xpForLevel,
  HISTORY_LIMIT,
} from '../src/app/profileStore.js';
import { createLocalStore } from '../src/app/settingsStore.js';
import { applyMatchResults } from '../src/app/progression.js';
import { ACHIEVEMENTS, getAchievement } from '../src/ui/progression/achievements.js';

/** Fresh in-memory profile store (Node has no localStorage). */
function freshStore() {
  return createLocalStore(`test:profile:${Math.random()}`, DEFAULT_PROFILE, sanitizeProfile);
}

/* ------------------------------------------------------------------ */
/* Synthetic final match state                                         */
/* ------------------------------------------------------------------ */

function playerStats(over = {}) {
  return {
    minigameCoins: 0, fieldsMoved: 0, itemsUsed: 0, coinsLost: 0, eventsHit: 0, minigameWins: 0, ...over,
  };
}

function syntheticMatch() {
  const state = {
    boardId: 'jungle_ruins',
    round: 10,
    rules: { rounds: 10 },
    turnOrder: ['p1', 'p2', 'p3', 'p4'],
    minigameHistory: ['banana_scramble', 'banana_scramble'],
    players: {
      p1: {
        id: 'p1', name: 'Alice', characterId: 'kiko', isBot: false, coins: 23, goldenBananas: 3,
        stats: playerStats({ minigameWins: 2, minigameCoins: 30, itemsUsed: 4 }),
      },
      p2: {
        id: 'p2', name: 'Botto', characterId: 'babu', isBot: true, difficulty: 'hard', coins: 12, goldenBananas: 1,
        stats: playerStats({ minigameWins: 0 }),
      },
      p3: {
        id: 'p3', name: 'Chimp', characterId: 'momo', isBot: true, difficulty: 'easy', coins: 9, goldenBananas: 0,
        stats: playerStats(),
      },
      p4: {
        id: 'p4', name: 'Dodo', characterId: 'nana', isBot: true, difficulty: 'easy', coins: 2, goldenBananas: 0,
        stats: playerStats(),
      },
    },
  };
  const gameOver = { winner: 'p1', ranking: ['p1', 'p2', 'p3', 'p4'] };
  const bonuses = [{ playerId: 'p1', category: 'minigame_king', bananas: 1 }];
  return { state, gameOver, bonuses };
}

/* ------------------------------------------------------------------ */
/* Profile v2 sanitize                                                 */
/* ------------------------------------------------------------------ */

test('profile: sanitize round-trips a legacy v1 shape losslessly', () => {
  const legacy = {
    name: 'OldMonkey',
    stats: {
      gamesPlayed: 7, gamesWon: 2, minigamesPlayed: 30, minigamesWon: 9, coinsEarned: 412, starsCollected: 11,
    },
    goldenBananas: 17,
    unlockedCosmetics: ['sunglasses'],
    unlockedCharacters: ['kumo'],
  };
  const out = sanitizeProfile({ ...DEFAULT_PROFILE, ...legacy });
  assert.equal(out.name, 'OldMonkey');
  assert.deepEqual(
    { ...out.stats },
    { ...legacy.stats, itemsUsed: 0 },
    'v1 stat values survive, the v2 itemsUsed counter defaults to 0',
  );
  assert.equal(out.goldenBananas, 17);
  assert.deepEqual(out.unlockedCosmetics, ['sunglasses']);
  assert.deepEqual(out.unlockedCharacters, ['kumo']);
  // v2 fields appear with defaults.
  assert.equal(out.xp, 0);
  assert.deepEqual(out.perCharacter, {});
  assert.deepEqual(out.perMinigame, {});
  assert.deepEqual(out.achievements, []);
  assert.deepEqual(out.history, []);
  assert.equal(out.bananasSpent, 0);
  assert.deepEqual(out.boardsPlayed, []);

  // A full v2 profile round-trips through sanitize unchanged.
  const again = sanitizeProfile(out);
  assert.deepEqual(again, out);
});

test('profile: sanitize never throws on corrupt shapes', () => {
  const junkShapes = [
    {},
    { stats: 'nope', history: 42, perCharacter: [], perMinigame: 'x' },
    { xp: -5, bananasSpent: Infinity, achievements: { a: 1 }, boardsPlayed: 'jungle' },
    { history: [null, 7, 'x', {}, { players: 'bad' }, { players: [{}, null] }] },
    { perCharacter: { kiko: null, '': { plays: 3 }, babu: { plays: 'x', wins: -2 } } },
    { name: 12, unlockedCharacters: [1, null, 'kumo', 'kumo'] },
    { history: [{ players: [{ name: 'A' }], when: 'yesterday', placement: -3 }] },
  ];
  for (const junk of junkShapes) {
    const out = sanitizeProfile({ ...DEFAULT_PROFILE, ...junk });
    assert.equal(typeof out, 'object');
    assert.equal(typeof out.stats.gamesPlayed, 'number');
    assert.ok(Array.isArray(out.history));
    assert.ok(out.xp >= 0);
  }
  // Deduped string arrays + a rescued valid history entry.
  const mixed = sanitizeProfile({
    ...DEFAULT_PROFILE,
    unlockedCharacters: [1, null, 'kumo', 'kumo'],
    history: [{ players: [{ name: 'A', bananas: 2, coins: 5, isLocal: true }], when: 3, placement: 2 }],
  });
  assert.deepEqual(mixed.unlockedCharacters, ['kumo']);
  assert.equal(mixed.history.length, 1);
  assert.equal(mixed.history[0].placement, 2);
  assert.equal(mixed.history[0].players[0].isLocal, true);
});

/* ------------------------------------------------------------------ */
/* Level curve                                                         */
/* ------------------------------------------------------------------ */

test('levelForXp: monotonic, inverts xpForLevel, safe on junk', () => {
  // xpForLevel strictly increases.
  for (let n = 0; n < 60; n += 1) {
    assert.ok(xpForLevel(n + 1) > xpForLevel(n), `xpForLevel(${n + 1}) > xpForLevel(${n})`);
  }
  // levelForXp never decreases as xp grows.
  let prev = levelForXp(0);
  for (let xp = 0; xp <= 60000; xp += 37) {
    const lvl = levelForXp(xp);
    assert.ok(lvl >= prev, `levelForXp(${xp}) = ${lvl} must be >= ${prev}`);
    prev = lvl;
  }
  // Exact inversion at the thresholds: 100 * n^1.35 cumulative.
  for (let n = 0; n <= 40; n += 1) {
    assert.equal(levelForXp(xpForLevel(n)), n, `levelForXp(xpForLevel(${n}))`);
    if (n > 0) assert.equal(levelForXp(xpForLevel(n) - 1), n - 1, `one XP short of level ${n}`);
  }
  assert.equal(xpForLevel(1), 100);
  assert.equal(levelForXp(99), 0);
  assert.equal(levelForXp(-5), 0);
  assert.equal(levelForXp(NaN), 0);
  assert.equal(levelForXp('junk'), 0);
});

/* ------------------------------------------------------------------ */
/* applyMatchResults                                                   */
/* ------------------------------------------------------------------ */

test('applyMatchResults: expected xp/bananas/tallies/achievements on a synthetic win', () => {
  const store = freshStore();
  const { state, gameOver, bonuses } = syntheticMatch();
  const result = applyMatchResults(store, {
    state, gameOver, bonuses, localPids: new Map([['p1', 0]]),
  });

  // Bananas: 3 from the match + 10 first-place bonus.
  assert.equal(result.bananasEarned, 13);
  // XP: base 50 + 15*3 bananas + 5*2 minigame wins + 100 first place = 205.
  assert.equal(result.xpGained, 205);
  // 205 XP crosses the level-1 threshold (100) but not level 2 (255).
  assert.equal(result.leveledUpTo, 1);

  const profile = store.get();
  assert.equal(profile.goldenBananas, 13);
  assert.equal(profile.xp, 205);
  // Legacy stat semantics preserved exactly.
  assert.equal(profile.stats.gamesPlayed, 1);
  assert.equal(profile.stats.gamesWon, 1);
  assert.equal(profile.stats.minigamesPlayed, 2);
  assert.equal(profile.stats.minigamesWon, 2);
  assert.equal(profile.stats.coinsEarned, 53); // 30 minigame coins + 23 held
  assert.equal(profile.stats.starsCollected, 3);
  assert.equal(profile.stats.itemsUsed, 4);
  // Tallies.
  assert.deepEqual(profile.perCharacter, { kiko: { plays: 1, wins: 1 } });
  // Single distinct minigame id -> wins attribution is exact.
  assert.deepEqual(profile.perMinigame, { banana_scramble: { plays: 2, wins: 2 } });
  assert.deepEqual(profile.boardsPlayed, ['jungle_ruins']);

  // History entry.
  assert.equal(profile.history.length, 1);
  const entry = profile.history[0];
  assert.ok(entry.when > 0);
  assert.equal(entry.boardId, 'jungle_ruins');
  assert.equal(entry.rounds, 10);
  assert.equal(entry.winnerName, 'Alice');
  assert.equal(entry.placement, 1);
  assert.equal(entry.players.length, 4);
  assert.deepEqual(entry.players[0], {
    name: 'Alice', characterId: 'kiko', bananas: 3, coins: 23, isLocal: true,
  });
  assert.equal(entry.players[1].isLocal, false);

  // Achievements: first party + first win + won vs a hard bot. NOT
  // pure_win (2 of the 3 bananas were bought), NOT clean_sweep (<3
  // minigames), NOT duelist (category unknown without registered content).
  const ids = result.newAchievements.map((a) => a.id).sort();
  assert.deepEqual(ids, ['first_party', 'first_win', 'giant_slayer']);
  assert.deepEqual([...profile.achievements].sort(), ids);
});

test('applyMatchResults: losing local seat gets consolation rewards, no win achievements', () => {
  const store = freshStore();
  const { state, gameOver, bonuses } = syntheticMatch();
  const result = applyMatchResults(store, {
    state, gameOver, bonuses, localPids: ['p3'], // 3rd place, 0 bananas
  });
  assert.equal(result.bananasEarned, 2); // others: +2
  assert.equal(result.xpGained, 50 + 25); // base + 3rd-place bonus
  assert.equal(result.leveledUpTo, null); // 75 XP < 100
  const ids = result.newAchievements.map((a) => a.id).sort();
  assert.deepEqual(ids, ['first_party']);
  const profile = store.get();
  assert.equal(profile.stats.gamesWon, 0);
  assert.equal(profile.history[0].placement, 3);
});

test('applyMatchResults: tolerates missing/empty inputs', () => {
  const store = freshStore();
  const empty = applyMatchResults(store, { state: null, gameOver: null, bonuses: [], localPids: [] });
  assert.deepEqual(empty, { xpGained: 0, leveledUpTo: null, newAchievements: [], bananasEarned: 0 });
  assert.equal(store.get().stats.gamesPlayed, 0);
  const noSuchPid = applyMatchResults(store, {
    state: syntheticMatch().state, gameOver: { winner: 'p1' }, localPids: ['ghost'],
  });
  assert.equal(noSuchPid.xpGained, 0);
});

test('applyMatchResults: history caps at 20 entries (newest first)', () => {
  const store = freshStore();
  for (let i = 0; i < 25; i += 1) {
    const { state, gameOver, bonuses } = syntheticMatch();
    const named = { ...state, boardId: `board_${i}` };
    applyMatchResults(store, { state: named, gameOver, bonuses, localPids: ['p1'] });
  }
  const profile = store.get();
  assert.equal(profile.history.length, HISTORY_LIMIT);
  assert.equal(HISTORY_LIMIT, 20);
  assert.equal(profile.history[0].boardId, 'board_24', 'most recent match first');
  assert.equal(profile.history[19].boardId, 'board_5', 'oldest kept entry');
  // 25 distinct boards played unlocks the 12-board globetrotter.
  assert.ok(profile.boardsPlayed.length === 25);
  assert.ok(profile.achievements.includes('globetrotter'));

  // Sanitize also enforces the cap on stored junk.
  const bloated = sanitizeProfile({
    ...DEFAULT_PROFILE,
    history: Array.from({ length: 30 }, (_, i) => ({
      players: [{ name: `P${i}`, bananas: 0, coins: 0, isLocal: true }],
      when: i, boardId: 'b', rounds: 1, winnerName: 'x', placement: 1,
    })),
  });
  assert.equal(bloated.history.length, HISTORY_LIMIT);
});

/* ------------------------------------------------------------------ */
/* Achievements catalog                                                */
/* ------------------------------------------------------------------ */

test('achievements: catalog is well-formed (unique ids, en+de, icons, pure checks)', () => {
  assert.ok(ACHIEVEMENTS.length >= 20, `expected ~20+ achievements, got ${ACHIEVEMENTS.length}`);
  const seen = new Set();
  const profile = sanitizeProfile({ ...DEFAULT_PROFILE });
  for (const def of ACHIEVEMENTS) {
    assert.ok(typeof def.id === 'string' && def.id.length > 0, 'id');
    assert.ok(!seen.has(def.id), `duplicate id "${def.id}"`);
    seen.add(def.id);
    for (const field of ['name', 'desc']) {
      assert.ok(typeof def[field]?.en === 'string' && def[field].en.length > 0, `${def.id}.${field}.en`);
      assert.ok(typeof def[field]?.de === 'string' && def[field].de.length > 0, `${def.id}.${field}.de`);
    }
    assert.ok(typeof def.icon === 'string' && def.icon.length > 0, `${def.id}.icon`);
    assert.equal(typeof def.check, 'function', `${def.id}.check`);
    // Checks run cleanly on a fresh profile with no match summary.
    assert.equal(def.check(profile, null), false, `${def.id} must not unlock on a fresh profile`);
    if (def.progress) {
      const p = def.progress(profile);
      assert.ok(Number.isFinite(p.cur) && Number.isFinite(p.goal) && p.goal > 0, `${def.id}.progress`);
    }
  }
  assert.equal(getAchievement('first_win')?.icon, '🏆');
  assert.equal(getAchievement('nope'), null);
});
