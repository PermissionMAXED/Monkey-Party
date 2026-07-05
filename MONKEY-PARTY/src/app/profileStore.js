/**
 * localStorage-backed player profile store: name, lifetime stats, total
 * golden bananas, unlocked cosmetics/characters, and (v2) the progression
 * meta: XP/level, per-character and per-minigame tallies, achievements,
 * match history, spent bananas, boards played.
 *
 * Uses the generic persistent store from settingsStore.js (which already
 * guards for the absence of localStorage).
 *
 * NOTE: this module is CLIENT-only code - Date.now() is allowed in the
 * data written here (history timestamps), unlike anything under shared/.
 *
 * The storage key intentionally stays at :v1 - sanitizeProfile() upgrades
 * any legacy (or corrupt) stored shape forward losslessly: unknown fields
 * are dropped, missing v2 fields get their defaults, and existing v1 data
 * (name, stats, bananas, unlocks) is preserved as-is.
 */

import { createLocalStore } from './settingsStore.js';

const STORAGE_KEY = 'monkey-party:profile:v1';
const MAX_NAME_LENGTH = 24;

/** Match history entries kept (most recent first). */
export const HISTORY_LIMIT = 20;
/** Player rows kept per history entry (matches MAX_SEATS in shared). */
const HISTORY_MAX_PLAYERS = 8;

export const DEFAULT_PROFILE = Object.freeze({
  name: 'Monkey',
  /** Lifetime stats across all matches. */
  stats: Object.freeze({
    gamesPlayed: 0,
    gamesWon: 0,
    minigamesPlayed: 0,
    minigamesWon: 0,
    coinsEarned: 0,
    starsCollected: 0,
    /** v2: lifetime items used (feeds the item achievements). */
    itemsUsed: 0,
  }),
  /** Total golden bananas available to spend (unlock currency). */
  goldenBananas: 0,
  /** Cosmetic ids the player has unlocked. */
  unlockedCosmetics: [],
  /** Character ids the player has unlocked (starters are implicit via unlock.bananas === 0). */
  unlockedCharacters: [],

  /* ---------------- v2 progression meta ---------------- */
  /** Lifetime XP (level is DERIVED via levelForXp, never stored). */
  xp: 0,
  /** Per-character tallies: {[characterId]: {plays, wins}}. */
  perCharacter: Object.freeze({}),
  /** Per-minigame tallies: {[minigameId]: {plays, wins}}. */
  perMinigame: Object.freeze({}),
  /** Unlocked achievement ids (see src/ui/progression/achievements.js). */
  achievements: [],
  /**
   * Last HISTORY_LIMIT match summaries, most recent first:
   * {when, boardId, rounds, players: [{name, characterId, bananas, coins,
   *  isLocal}], winnerName, placement}.
   */
  history: [],
  /** Lifetime golden bananas spent on unlocks (earned = goldenBananas + bananasSpent). */
  bananasSpent: 0,
  /** Distinct board ids ever played. */
  boardsPlayed: [],
});

/* ------------------------------------------------------------------ */
/* Level curve                                                         */
/* ------------------------------------------------------------------ */

/**
 * XP curve: reaching level n requires 100 * n^1.35 CUMULATIVE XP.
 *
 *   level 1:   100 XP        level 5:    ~876 XP
 *   level 2:   ~255 XP       level 10:  ~2,239 XP
 *   level 3:   ~440 XP       level 20:  ~5,704 XP
 *
 * Fresh profiles (xp < 100) are level 0. The gentle super-linear exponent
 * keeps early levels frequent (~1 level per match at first) while late
 * levels stay meaningful.
 */
const XP_CURVE_BASE = 100;
const XP_CURVE_EXPONENT = 1.35;

/**
 * Cumulative XP required to REACH a level (0 for level <= 0).
 * @param {number} level
 * @returns {number}
 */
export function xpForLevel(level) {
  const n = Math.floor(Number(level) || 0);
  if (n <= 0) return 0;
  return Math.round(XP_CURVE_BASE * n ** XP_CURVE_EXPONENT);
}

/**
 * Level derived from lifetime XP: the highest n with xpForLevel(n) <= xp.
 * Monotonic in xp; returns 0 for invalid/negative input.
 * @param {number} xp
 * @returns {number}
 */
export function levelForXp(xp) {
  const v = Number(xp);
  if (!Number.isFinite(v) || v < XP_CURVE_BASE) return 0;
  // Closed-form estimate, then correct for Math.round in xpForLevel.
  let level = Math.floor((v / XP_CURVE_BASE) ** (1 / XP_CURVE_EXPONENT));
  while (xpForLevel(level + 1) <= v) level += 1;
  while (level > 0 && xpForLevel(level) > v) level -= 1;
  return level;
}

/* ------------------------------------------------------------------ */
/* Sanitizers (must NEVER throw, whatever localStorage held)           */
/* ------------------------------------------------------------------ */

function asNonNegativeInt(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

function asStringArray(v) {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((x) => typeof x === 'string' && x.length > 0))];
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** {[id]: {plays, wins}} with non-negative ints; junk entries are dropped. */
function sanitizeTallyMap(raw) {
  if (!isPlainObject(raw)) return {};
  const out = {};
  for (const [id, value] of Object.entries(raw)) {
    if (id.length === 0 || !isPlainObject(value)) continue;
    const plays = asNonNegativeInt(value.plays, 0);
    const wins = asNonNegativeInt(value.wins, 0);
    if (plays === 0 && wins === 0) continue;
    out[id] = { plays, wins };
  }
  return out;
}

function sanitizeHistoryPlayer(raw) {
  if (!isPlainObject(raw)) return null;
  return {
    name: typeof raw.name === 'string' && raw.name.length > 0 ? raw.name.slice(0, MAX_NAME_LENGTH) : '?',
    characterId: typeof raw.characterId === 'string' && raw.characterId.length > 0 ? raw.characterId : null,
    bananas: asNonNegativeInt(raw.bananas, 0),
    coins: asNonNegativeInt(raw.coins, 0),
    isLocal: raw.isLocal === true,
  };
}

function sanitizeHistoryEntry(raw) {
  if (!isPlainObject(raw)) return null;
  const players = (Array.isArray(raw.players) ? raw.players : [])
    .map(sanitizeHistoryPlayer)
    .filter(Boolean)
    .slice(0, HISTORY_MAX_PLAYERS);
  if (players.length === 0) return null; // an empty match row is useless
  return {
    when: asNonNegativeInt(raw.when, 0),
    boardId: typeof raw.boardId === 'string' ? raw.boardId : '',
    rounds: asNonNegativeInt(raw.rounds, 0),
    players,
    winnerName: typeof raw.winnerName === 'string' && raw.winnerName.length > 0
      ? raw.winnerName.slice(0, MAX_NAME_LENGTH)
      : '?',
    placement: Math.max(1, asNonNegativeInt(raw.placement, 1)),
  };
}

function sanitizeHistory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(sanitizeHistoryEntry).filter(Boolean).slice(0, HISTORY_LIMIT);
}

/**
 * Normalize any stored/patched profile shape to the v2 layout. Legacy v1
 * profiles pass through losslessly (v2 fields default); corrupt values of
 * ANY kind degrade to safe defaults instead of throwing.
 *
 * @param {Object} raw Merged {...DEFAULT_PROFILE, ...stored} object.
 * @returns {Object} A fresh, fully-populated profile.
 */
export function sanitizeProfile(raw) {
  const d = DEFAULT_PROFILE;
  const src = isPlainObject(raw) ? raw : {};
  const rawStats = isPlainObject(src.stats) ? src.stats : {};
  const stats = {};
  for (const key of Object.keys(d.stats)) {
    stats[key] = asNonNegativeInt(rawStats[key], d.stats[key]);
  }
  const name = typeof src.name === 'string' && src.name.trim().length > 0
    ? src.name.trim().slice(0, MAX_NAME_LENGTH)
    : d.name;
  return {
    name,
    stats,
    goldenBananas: asNonNegativeInt(src.goldenBananas, d.goldenBananas),
    unlockedCosmetics: asStringArray(src.unlockedCosmetics),
    unlockedCharacters: asStringArray(src.unlockedCharacters),
    xp: asNonNegativeInt(src.xp, d.xp),
    perCharacter: sanitizeTallyMap(src.perCharacter),
    perMinigame: sanitizeTallyMap(src.perMinigame),
    achievements: asStringArray(src.achievements),
    history: sanitizeHistory(src.history),
    bananasSpent: asNonNegativeInt(src.bananasSpent, d.bananasSpent),
    boardsPlayed: asStringArray(src.boardsPlayed),
  };
}

/** The app-wide profile store singleton (get/set/subscribe). */
export const profileStore = createLocalStore(STORAGE_KEY, DEFAULT_PROFILE, sanitizeProfile);
