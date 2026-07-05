/**
 * Tournament (cup) mode model - the "Solo Modes" package.
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 * All randomness goes through shared/rng.js, seeded by the caller.
 *
 * Four cups of three boards each cover all 12 boards exactly once, with a
 * fixed difficulty ramp (banana: easy bots + 5 fast rounds -> golden: hard
 * bots + 10 hardcore rounds). createTournament() builds a fully
 * deterministic, JSON-serializable plain object: the roster (the human +
 * 3 seeded rival bots with distinct characters) and one pre-seeded leg
 * per board. The reducers (applyMatchResult / standings / currentLeg /
 * isComplete / champion) never mutate their input, so a tournament can be
 * round-tripped through JSON.stringify at any point without changing
 * behavior. sanitizeTournament() rebuilds a tournament from untrusted
 * (persisted) data and returns null when it cannot be trusted.
 */

import { createRng } from './rng.js';
import { validateRules } from './rules.js';
import { BOT_DIFFICULTIES } from './constants.js';
// Cup boards mirror shared/content/boards BOARD_IDS (covering all 12
// exactly once); tests/tournament.test.js enforces the invariant.
import { CHARACTER_IDS } from './content/characters/index.js';

/** Cup points per placement (1st..4th). Further places earn 0. */
export const PLACEMENT_POINTS = [10, 7, 4, 2];

/** Seats per tournament match: the human + 3 rival bots. */
export const TOURNAMENT_SEATS = 4;

/** The human's player id inside tournament matches (localPlayers pid). */
export const PLAYER_PID = 'p1';

/** Rival name pool (seeded pick; distinct per tournament). */
export const RIVAL_NAMES = [
  'Bongo', 'Kiki', 'Mango', 'Chimpy', 'Nana', 'Tarzana', 'Coco', 'Peel',
];

/**
 * The four cups. Together their boards cover BOARD_IDS exactly once.
 * `rules` are PARTIAL rule overrides; every leg carries the validated
 * full Rules object (maxSeats 4 / botsFill off, so a tournament match is
 * always exactly the 4 roster seats).
 */
export const CUPS = [
  {
    id: 'banana_cup',
    name: { en: 'Banana Cup', de: 'Bananen-Cup' },
    description: {
      en: 'A gentle warm-up: 5 fast rounds per board against easy rivals.',
      de: 'Sanftes Aufwärmen: 5 schnelle Runden pro Brett gegen leichte Rivalen.',
    },
    boards: ['jungle_ruins', 'cloud_canopy', 'monkey_funfair'],
    botDifficulty: 'easy',
    rules: {
      rounds: 5, botDifficulty: 'easy', fastMode: true, startCoins: 20, starPrice: 15,
    },
  },
  {
    id: 'coconut_cup',
    name: { en: 'Coconut Cup', de: 'Kokosnuss-Cup' },
    description: {
      en: 'Salt water and slippery ice: 7 rounds against normal rivals.',
      de: 'Salzwasser und glattes Eis: 7 Runden gegen normale Rivalen.',
    },
    boards: ['pirate_lagoon', 'underwater_reef', 'icy_coconut_peak'],
    botDifficulty: 'normal',
    rules: { rounds: 7, botDifficulty: 'normal' },
  },
  {
    id: 'vine_cup',
    name: { en: 'Vine Cup', de: 'Lianen-Cup' },
    description: {
      en: 'Ghosts, neon and robots: 8 rounds against normal rivals.',
      de: 'Geister, Neon und Roboter: 8 Runden gegen normale Rivalen.',
    },
    boards: ['ghost_jungle', 'neon_monkey_city', 'robo_banana_factory'],
    botDifficulty: 'normal',
    rules: { rounds: 8, botDifficulty: 'normal' },
  },
  {
    id: 'golden_cup',
    name: { en: 'Golden Cup', de: 'Goldener Cup' },
    description: {
      en: 'The final gauntlet: 10 hardcore rounds against hard rivals.',
      de: 'Der finale Härtetest: 10 Hardcore-Runden gegen schwere Rivalen.',
    },
    boards: ['volcano_island', 'golden_temple', 'gorilla_palace'],
    botDifficulty: 'hard',
    rules: {
      rounds: 10, botDifficulty: 'hard', hardcore: true, startCoins: 0, starPrice: 30,
    },
  },
];

/** @returns {Object|null} The cup def for an id, or null. */
export function getCup(cupId) {
  return CUPS.find((c) => c.id === cupId) ?? null;
}

/* ------------------------------------------------------------------ */
/* Construction                                                        */
/* ------------------------------------------------------------------ */

/**
 * Full validated Rules for one cup, with an optional bot-difficulty
 * override. Tournament matches always play exactly the 4 roster seats.
 *
 * @param {Object} cup CUPS entry.
 * @param {string|null} [difficulty] Optional BOT_DIFFICULTIES override.
 * @returns {import('./types.js').Rules}
 */
function cupRules(cup, difficulty = null) {
  const partial = { ...cup.rules, maxSeats: TOURNAMENT_SEATS, botsFill: false };
  if (difficulty && BOT_DIFFICULTIES.includes(difficulty)) partial.botDifficulty = difficulty;
  return validateRules(partial);
}

/**
 * Create a new tournament run through a cup. Deterministic: the same
 * arguments always produce the same roster and leg seeds.
 *
 * @param {{
 *   seed: number,
 *   cupId?: string,
 *   playerName?: string,
 *   characterId?: string|null,
 *   difficulty?: string|null,     // optional BOT_DIFFICULTIES override
 *   characterPool?: string[],     // injectable for tests; defaults to CHARACTER_IDS
 * }} opts
 * @returns {Object} Serializable tournament state (plain object).
 */
export function createTournament(opts = {}) {
  const seed = Number(opts.seed) >>> 0;
  const cup = getCup(opts.cupId ?? CUPS[0].id);
  if (!cup) throw new Error(`[tournament] unknown cup "${opts.cupId}"`);
  const playerName = typeof opts.playerName === 'string' && opts.playerName.trim().length > 0
    ? opts.playerName.trim().slice(0, 16)
    : 'Monkey';
  const characterId = typeof opts.characterId === 'string' && opts.characterId.length > 0
    ? opts.characterId
    : null;
  const difficulty = typeof opts.difficulty === 'string' && BOT_DIFFICULTIES.includes(opts.difficulty)
    ? opts.difficulty
    : null;
  const pool = Array.isArray(opts.characterPool) && opts.characterPool.length > 0
    ? opts.characterPool.slice()
    : CHARACTER_IDS.slice();

  const rng = createRng(seed);

  /* Roster: the human + 3 seeded rival bots with characters distinct from
   * the player's (and from each other, pool permitting). */
  const rosterRng = rng.fork('roster');
  const charPicks = rosterRng.shuffle(pool.filter((id) => id !== characterId));
  const namePicks = rosterRng.shuffle(RIVAL_NAMES);
  const roster = [
    { pid: PLAYER_PID, name: playerName, characterId, isBot: false },
  ];
  for (let i = 0; i < TOURNAMENT_SEATS - 1; i += 1) {
    roster.push({
      // Matches src/app/session.js addBot() pids (bot1, bot2, ...), so
      // match results map straight back onto this roster.
      pid: `bot${i + 1}`,
      name: namePicks[i % namePicks.length] ?? `Rival ${i + 1}`,
      characterId: charPicks[i % Math.max(1, charPicks.length)] ?? null,
      isBot: true,
    });
  }

  /* Legs: one pre-seeded match per cup board, all rules fixed up front. */
  const rules = cupRules(cup, difficulty);
  const legs = cup.boards.map((boardId, index) => ({
    index,
    boardId,
    seed: rng.fork(`leg:${index}`).state(),
    rules: { ...rules },
    botDifficulty: rules.botDifficulty,
  }));

  return {
    v: 1,
    seed,
    cupId: cup.id,
    playerName,
    characterId,
    difficulty,
    roster,
    legs,
    /** One entry per finished leg (see applyMatchResult). */
    results: [],
  };
}

/* ------------------------------------------------------------------ */
/* Reducers                                                            */
/* ------------------------------------------------------------------ */

/** @returns {boolean} True once every leg has a recorded result. */
export function isComplete(tournament) {
  return (tournament?.results?.length ?? 0) >= (tournament?.legs?.length ?? 0);
}

/**
 * The leg that must be played next, or null when the cup is complete.
 * Includes the roster so callers can seat the match without extra lookups.
 *
 * @returns {{index: number, boardId: string, seed: number,
 *   rules: import('./types.js').Rules, botDifficulty: string,
 *   roster: Object[]}|null}
 */
export function currentLeg(tournament) {
  if (!tournament || isComplete(tournament)) return null;
  const leg = tournament.legs[tournament.results.length];
  if (!leg) return null;
  return {
    index: leg.index,
    boardId: leg.boardId,
    seed: leg.seed,
    rules: { ...leg.rules },
    botDifficulty: leg.botDifficulty,
    roster: tournament.roster.map((r) => ({ ...r })),
  };
}

function asCount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

/**
 * Record the finished current leg and return the NEXT tournament state
 * (the input is not mutated). Cup points: 10/7/4/2 by placement.
 *
 * `others` (optional) carries the bots' real match results
 * ([{pid, placement, bananas, coins}]). When absent, the remaining
 * placements are assigned to the bots deterministically from the leg
 * seed, with zero bananas/coins - point math stays exact either way.
 *
 * @param {Object} tournament
 * @param {{placement: number, bananas?: number, coins?: number,
 *   others?: {pid: string, placement: number, bananas?: number, coins?: number}[]}} result
 * @returns {Object} Next tournament state.
 */
export function applyMatchResult(tournament, result = {}) {
  const leg = currentLeg(tournament);
  if (!leg) throw new Error('[tournament] applyMatchResult(): the cup is already complete');

  const size = tournament.roster.length;
  const placement = Number(result.placement);
  if (!Number.isInteger(placement) || placement < 1 || placement > size) {
    throw new Error(`[tournament] applyMatchResult(): placement must be an integer in 1..${size}`);
  }

  const placements = { [PLAYER_PID]: placement };
  const bananas = { [PLAYER_PID]: asCount(result.bananas) };
  const coins = { [PLAYER_PID]: asCount(result.coins) };

  const botPids = tournament.roster.filter((r) => r.isBot).map((r) => r.pid);
  if (Array.isArray(result.others) && result.others.length > 0) {
    for (const entry of result.others) {
      if (!entry || !botPids.includes(entry.pid)) {
        throw new Error(`[tournament] applyMatchResult(): unknown rival pid "${entry?.pid}"`);
      }
      placements[entry.pid] = Number(entry.placement);
      bananas[entry.pid] = asCount(entry.bananas);
      coins[entry.pid] = asCount(entry.coins);
    }
  } else {
    // No rival results reported: deal the remaining placements out
    // deterministically from the leg seed.
    const free = [];
    for (let place = 1; place <= size; place += 1) {
      if (place !== placement) free.push(place);
    }
    const order = createRng(leg.seed).fork('botPlacements').shuffle(botPids);
    order.forEach((pid, i) => {
      placements[pid] = free[i];
      bananas[pid] = 0;
      coins[pid] = 0;
    });
  }

  // The placements must be a permutation of 1..size.
  const seen = new Set(Object.values(placements));
  const valid = Object.keys(placements).length === size
    && seen.size === size
    && [...seen].every((p) => Number.isInteger(p) && p >= 1 && p <= size);
  if (!valid) {
    throw new Error('[tournament] applyMatchResult(): placements must cover every seat exactly once');
  }

  const points = {};
  for (const [pid, place] of Object.entries(placements)) {
    points[pid] = PLACEMENT_POINTS[place - 1] ?? 0;
  }

  return {
    ...tournament,
    roster: tournament.roster.map((r) => ({ ...r })),
    legs: tournament.legs.map((l) => ({ ...l, rules: { ...l.rules } })),
    results: [
      ...tournament.results.map((r) => ({
        ...r,
        placements: { ...r.placements },
        bananas: { ...r.bananas },
        coins: { ...r.coins },
        points: { ...r.points },
      })),
      { legIndex: leg.index, boardId: leg.boardId, placements, bananas, coins, points },
    ],
  };
}

/**
 * Aggregated cup standings, best first. Sort: cup points desc, then total
 * golden bananas desc (the banana tiebreak), then total coins desc, then
 * roster order (stable).
 *
 * @returns {{pid: string, name: string, characterId: string|null,
 *   isBot: boolean, points: number, bananas: number, coins: number,
 *   wins: number, legsPlayed: number}[]}
 */
export function standings(tournament) {
  if (!tournament?.roster) return [];
  const rows = tournament.roster.map((r, order) => ({
    pid: r.pid,
    name: r.name,
    characterId: r.characterId,
    isBot: r.isBot,
    points: 0,
    bananas: 0,
    coins: 0,
    wins: 0,
    legsPlayed: tournament.results.length,
    order,
  }));
  for (const result of tournament.results ?? []) {
    for (const row of rows) {
      row.points += result.points?.[row.pid] ?? 0;
      row.bananas += result.bananas?.[row.pid] ?? 0;
      row.coins += result.coins?.[row.pid] ?? 0;
      if (result.placements?.[row.pid] === 1) row.wins += 1;
    }
  }
  rows.sort((a, b) => (b.points - a.points)
    || (b.bananas - a.bananas)
    || (b.coins - a.coins)
    || (a.order - b.order));
  return rows.map(({ order: _order, ...rest }) => rest);
}

/**
 * The cup winner, or null while legs remain.
 * @returns {ReturnType<typeof standings>[number]|null}
 */
export function champion(tournament) {
  if (!isComplete(tournament)) return null;
  return standings(tournament)[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* Sanitizing (for persisted / untrusted data)                         */
/* ------------------------------------------------------------------ */

/**
 * Rebuild a tournament from untrusted data (e.g. localStorage). The base
 * state is reconstructed from the stored inputs via createTournament()
 * (so tampered rosters/legs cannot survive), then every stored result is
 * re-applied through applyMatchResult(). Returns null when the data is
 * not a usable tournament.
 *
 * @param {*} raw
 * @param {{characterPool?: string[]}} [opts]
 * @returns {Object|null}
 */
export function sanitizeTournament(raw, opts = {}) {
  if (raw === null || typeof raw !== 'object') return null;
  if (!getCup(raw.cupId)) return null;
  if (!Number.isFinite(Number(raw.seed))) return null;
  let tournament;
  try {
    tournament = createTournament({
      seed: raw.seed,
      cupId: raw.cupId,
      playerName: raw.playerName,
      characterId: raw.characterId,
      difficulty: raw.difficulty,
      characterPool: opts.characterPool,
    });
  } catch {
    return null;
  }
  const results = Array.isArray(raw.results) ? raw.results : [];
  if (results.length > tournament.legs.length) return null;
  try {
    for (const entry of results) {
      const botPids = tournament.roster.filter((r) => r.isBot).map((r) => r.pid);
      tournament = applyMatchResult(tournament, {
        placement: entry?.placements?.[PLAYER_PID],
        bananas: entry?.bananas?.[PLAYER_PID],
        coins: entry?.coins?.[PLAYER_PID],
        others: botPids.map((pid) => ({
          pid,
          placement: entry?.placements?.[pid],
          bananas: entry?.bananas?.[pid],
          coins: entry?.coins?.[pid],
        })),
      });
    }
  } catch {
    return null;
  }
  return tournament;
}
