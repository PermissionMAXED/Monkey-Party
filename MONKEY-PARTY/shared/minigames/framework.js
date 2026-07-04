/**
 * Minigame framework (package P7).
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 *
 * defineMinigame(def) validates a MinigameDef (see shared/types.js) and
 * registers it in the singleton minigames registry. Every minigame in this
 * project MUST go through defineMinigame - never call
 * minigames.register(def) directly, or you skip contract validation.
 *
 * Also exports the shared runtime helpers every sim/view uses:
 *   - createFixedStepper(sim, {hz, onTick, maxCatchUpSec}) - accumulator
 *   - rankByScore(scores) - score map -> ranking array
 *   - coinsForRanking(ranking, {base, chaos}) - ranking -> coin payouts
 *   - makeTeams(players, category) - deterministic team split
 *   - standardCountdown(sim, seconds) - shared 3-2-1 intro countdown
 */

import { minigames } from '../registries.js';

/** Fixed simulation rate for every minigame (steps per second). */
export const MINIGAME_HZ = 30;

/** Default intro countdown in seconds (3-2-1-GO). */
export const COUNTDOWN_SEC = 3;

/** Ticks spent in the standard intro countdown. */
export const COUNTDOWN_TICKS = COUNTDOWN_SEC * MINIGAME_HZ;

/** Legal MinigameDef categories. */
export const CATEGORIES = ['ffa', '2v2', '1v3', 'team', 'duel', 'boss'];

/* ------------------------------------------------------------------ */
/* defineMinigame                                                      */
/* ------------------------------------------------------------------ */

function isLocalized(v) {
  return v !== null && typeof v === 'object'
    && typeof v.en === 'string' && v.en.length > 0
    && typeof v.de === 'string' && v.de.length > 0;
}

function fail(id, msg) {
  throw new Error(`[minigames] defineMinigame(${id ?? '?'}): ${msg}`);
}

/**
 * Validate a MinigameDef and register it. Returns the def (for chaining).
 *
 * Required: id, name/description/howTo ({en,de}), category (CATEGORIES),
 * tags (string[]), players ({min,max} within 1..8, min<=max), durationSec
 * (finite > 0), competitiveSafe (bool), params (object), and the lifecycle
 * trio createSim/createView/bot (functions).
 *
 * @param {import('../types.js').MinigameDef} def
 * @returns {import('../types.js').MinigameDef}
 */
export function defineMinigame(def) {
  if (def === null || typeof def !== 'object') fail(null, 'def must be an object');
  const id = def.id;
  if (typeof id !== 'string' || id.length === 0) fail(null, 'def.id must be a non-empty string');

  if (!isLocalized(def.name)) fail(id, 'name must be localized {en,de}');
  if (!isLocalized(def.description)) fail(id, 'description must be localized {en,de}');
  if (!isLocalized(def.howTo)) fail(id, 'howTo must be localized {en,de}');
  if (!CATEGORIES.includes(def.category)) {
    fail(id, `category "${def.category}" must be one of ${CATEGORIES.join('|')}`);
  }
  if (!Array.isArray(def.tags) || def.tags.some((t) => typeof t !== 'string')) {
    fail(id, 'tags must be a string array');
  }
  const p = def.players;
  if (p === null || typeof p !== 'object'
    || !Number.isInteger(p.min) || !Number.isInteger(p.max)
    || p.min < 1 || p.max > 8 || p.min > p.max) {
    fail(id, 'players must be {min,max} integers with 1 <= min <= max <= 8');
  }
  if (!Number.isFinite(def.durationSec) || def.durationSec <= 0) {
    fail(id, 'durationSec must be a finite number > 0');
  }
  if (typeof def.competitiveSafe !== 'boolean') fail(id, 'competitiveSafe must be a boolean');
  if (def.params === null || typeof def.params !== 'object') fail(id, 'params must be an object');
  for (const fn of ['createSim', 'createView', 'bot']) {
    if (typeof def[fn] !== 'function') fail(id, `${fn} must be a function`);
  }

  minigames.register(def);
  return def;
}

/* ------------------------------------------------------------------ */
/* Fixed stepper                                                       */
/* ------------------------------------------------------------------ */

/**
 * Accumulator-based fixed stepper for an IMinigameSim.
 *
 * advance(dtSec, getInputs) accumulates render time and steps the sim at
 * exactly 1/hz per step until the accumulator is drained or the sim
 * finishes. Catch-up is capped (default 0.5s) so a tab-blur or long hitch
 * never triggers a spiral of death - excess time is dropped.
 *
 * @param {import('../types.js').IMinigameSim} sim
 * @param {{hz?: number, onTick?: (tick: number) => void, maxCatchUpSec?: number}} [opts]
 * @returns {{
 *   advance: (dtSec: number, getInputs?: Object|((tick: number) => Object)) => number,
 *   alpha: () => number,
 *   tickCount: () => number,
 *   stepSec: number,
 * }}
 */
export function createFixedStepper(sim, opts = {}) {
  const hz = opts.hz ?? MINIGAME_HZ;
  const onTick = opts.onTick ?? null;
  const maxCatchUpSec = opts.maxCatchUpSec ?? 0.5;
  const stepSec = 1 / hz;

  let acc = 0;
  let tick = 0;

  /**
   * @param {number} dtSec Render delta in seconds.
   * @param {Object|Function} [getInputs] inputsMap, or (tick) => inputsMap.
   * @returns {number} Number of fixed steps performed.
   */
  function advance(dtSec, getInputs) {
    acc += Math.max(0, Number(dtSec) || 0);
    if (acc > maxCatchUpSec) acc = maxCatchUpSec; // Tab-blur safety.
    let steps = 0;
    while (acc >= stepSec) {
      if (sim.isFinished()) {
        acc = 0;
        break;
      }
      const inputs = typeof getInputs === 'function' ? (getInputs(tick) ?? {}) : (getInputs ?? {});
      sim.step(inputs);
      acc -= stepSec;
      tick += 1;
      steps += 1;
      if (onTick) onTick(tick);
    }
    return steps;
  }

  return {
    advance,
    alpha: () => Math.min(1, acc / stepSec),
    tickCount: () => tick,
    stepSec,
  };
}

/* ------------------------------------------------------------------ */
/* Scoring helpers                                                     */
/* ------------------------------------------------------------------ */

/**
 * Rank player ids by score, descending. Ties keep the map's insertion
 * order (deterministic - build the scores map in player order).
 *
 * @param {Object<string, number>} scores pid -> score.
 * @returns {string[]} ranking, best first.
 */
export function rankByScore(scores) {
  const entries = Object.entries(scores ?? {});
  // Stable sort: equal scores keep insertion order.
  return entries
    .map(([pid, score], index) => ({ pid, score: Number(score) || 0, index }))
    .sort((a, b) => (b.score - a.score) || (a.index - b.index))
    .map((e) => e.pid);
}

/**
 * Coin payouts for a ranking. Ranking entries may be plain pids or arrays
 * of tied pids (every member of a tied group earns that place's payout).
 * Places beyond base.length earn 1 consolation coin (0 with an empty base).
 * chaos doubles every payout.
 *
 * @param {Array<string|string[]>} ranking Best first.
 * @param {{base?: number[], chaos?: boolean}} [opts]
 * @returns {Object<string, number>} pid -> coins.
 */
export function coinsForRanking(ranking, opts = {}) {
  const base = Array.isArray(opts.base) && opts.base.length > 0 ? opts.base : [10, 7, 5, 3];
  const mult = opts.chaos ? 2 : 1;
  const coins = {};
  let place = 0;
  for (const entry of ranking ?? []) {
    const group = Array.isArray(entry) ? entry : [entry];
    const payout = place < base.length ? base[place] : 1;
    for (const pid of group) {
      if (typeof pid === 'string' && pid.length > 0) coins[pid] = payout * mult;
    }
    place += group.length;
  }
  return coins;
}

/**
 * Deterministic team split for a category, preserving the given player
 * order (shuffle beforehand if you want random teams).
 *
 *   '2v2'/'team' -> two halves; 'duel' -> first two solo; '1v3' -> first
 *   player alone vs the rest; anything else (ffa/boss) -> null.
 *
 * @param {string[]} players
 * @param {string} category
 * @returns {string[][]|null}
 */
export function makeTeams(players, category) {
  const pids = Array.isArray(players) ? players.slice() : [];
  switch (category) {
    case '2v2':
    case 'team': {
      const half = Math.ceil(pids.length / 2);
      return [pids.slice(0, half), pids.slice(half)];
    }
    case 'duel':
      return [[pids[0]], [pids[1]]];
    case '1v3':
      return [[pids[0]], pids.slice(1)];
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Countdown                                                           */
/* ------------------------------------------------------------------ */

/**
 * Standard 3-2-1 intro countdown helper. Sims call this once and then use
 * isActive(tick) to ignore inputs while the countdown runs; views use
 * remainingSec(tick) to draw the numbers.
 *
 * When `tick` is omitted the helper reads the sim's own tick counter
 * (getState().tick), which every framework sim exposes.
 *
 * @param {import('../types.js').IMinigameSim|null} sim
 * @param {number} [seconds]
 * @returns {{
 *   totalTicks: number,
 *   isActive: (tick?: number) => boolean,
 *   remainingSec: (tick?: number) => number,
 * }}
 */
export function standardCountdown(sim, seconds = COUNTDOWN_SEC) {
  const totalTicks = Math.max(0, Math.round(seconds * MINIGAME_HZ));

  function tickOf() {
    try {
      return Number(sim?.getState?.()?.tick) || 0;
    } catch {
      return 0;
    }
  }

  return {
    totalTicks,
    isActive: (tick) => (tick ?? tickOf()) < totalTicks,
    remainingSec: (tick) => Math.max(0, Math.ceil((totalTicks - (tick ?? tickOf())) / MINIGAME_HZ)),
  };
}
