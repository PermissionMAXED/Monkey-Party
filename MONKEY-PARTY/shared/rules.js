/**
 * Match rules: defaults, presets, and validation/clamping.
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 * See the Rules typedef in shared/types.js.
 */

import { BANANA_MULTIPLIERS, BOT_DIFFICULTIES, ITEM_MODES, MAX_SEATS, MIN_PLAYERS } from './constants.js';

/** @type {import('./types.js').Rules} */
export const DEFAULT_RULES = Object.freeze({
  rounds: 10,
  maxSeats: 8,
  botsFill: true,
  botDifficulty: 'normal',
  minigameEvery: 1,
  minigameCategories: ['*'],
  items: 'normal',
  bananaMultiplier: 1,
  traps: true,
  randomEvents: true,
  chaosMode: false,
  fastMode: false,
  hardcore: false,
  competitive: false,
  starPrice: 20,
  startCoins: 10,
  startItems: [],
});

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function asBool(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function asStringArray(value, fallback) {
  if (!Array.isArray(value)) return fallback.slice();
  const out = value.filter((v) => typeof v === 'string' && v.length > 0);
  return out.length > 0 ? out : fallback.slice();
}

/**
 * Merge a partial rules object over the defaults, clamping every field to a
 * legal value. Always returns a complete, self-consistent Rules object.
 *
 * Competitive mode FORCES: randomEvents off, items 'allSame', chaosMode off.
 * (The competitiveSafe content filter is applied by content selection:
 * sims/pickers must exclude defs with competitiveSafe === false whenever
 * rules.competitive is true.)
 *
 * @param {Partial<import('./types.js').Rules>} [partial]
 * @returns {import('./types.js').Rules}
 */
export function validateRules(partial = {}) {
  const src = partial !== null && typeof partial === 'object' ? partial : {};
  const d = DEFAULT_RULES;

  const rules = {
    rounds: clampInt(src.rounds, 1, 50, d.rounds),
    maxSeats: clampInt(src.maxSeats, MIN_PLAYERS, MAX_SEATS, d.maxSeats),
    botsFill: asBool(src.botsFill, d.botsFill),
    botDifficulty: oneOf(src.botDifficulty, BOT_DIFFICULTIES, d.botDifficulty),
    minigameEvery: clampInt(src.minigameEvery, 0, 10, d.minigameEvery),
    minigameCategories: asStringArray(src.minigameCategories, d.minigameCategories),
    items: oneOf(src.items, ITEM_MODES, d.items),
    bananaMultiplier: BANANA_MULTIPLIERS.includes(src.bananaMultiplier) ? src.bananaMultiplier : d.bananaMultiplier,
    traps: asBool(src.traps, d.traps),
    randomEvents: asBool(src.randomEvents, d.randomEvents),
    chaosMode: asBool(src.chaosMode, d.chaosMode),
    fastMode: asBool(src.fastMode, d.fastMode),
    hardcore: asBool(src.hardcore, d.hardcore),
    competitive: asBool(src.competitive, d.competitive),
    starPrice: clampInt(src.starPrice, 1, 99, d.starPrice),
    startCoins: clampInt(src.startCoins, 0, 999, d.startCoins),
    startItems: asStringArray(src.startItems, d.startItems.length ? d.startItems : []),
  };

  if (!Array.isArray(src.startItems)) rules.startItems = d.startItems.slice();

  if (rules.competitive) {
    rules.randomEvents = false;
    rules.items = 'allSame';
    rules.chaosMode = false;
  }

  return rules;
}

/* ------------------------------------------------------------------ */
/* Presets                                                             */
/* ------------------------------------------------------------------ */

/**
 * Named rule presets. Each value is a complete, validated Rules object.
 * @type {Object<string, import('./types.js').Rules>}
 */
export const PRESETS = Object.freeze({
  /** The classic party experience - the defaults. */
  party: validateRules({}),

  /** Shorter match, snappier pacing. */
  fast: validateRules({
    rounds: 5,
    fastMode: true,
    startCoins: 15,
    minigameEvery: 1,
  }),

  /** Maximum mayhem: chaos mechanics, infinite items, double bananas. */
  chaos: validateRules({
    chaosMode: true,
    randomEvents: true,
    items: 'infinite',
    bananaMultiplier: 2,
    traps: true,
    botDifficulty: 'wild',
  }),

  /** Punishing economy and tougher bots. */
  hardcore: validateRules({
    hardcore: true,
    startCoins: 0,
    starPrice: 30,
    botDifficulty: 'hard',
  }),

  /** Fair, low-variance ruleset (forces: no randomEvents, items 'allSame', competitiveSafe filter). */
  competitive: validateRules({
    competitive: true,
    traps: false,
    botDifficulty: 'hard',
  }),
});
