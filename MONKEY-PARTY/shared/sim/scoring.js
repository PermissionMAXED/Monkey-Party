/**
 * Coin / golden-banana mutations, end-game bonus bananas, winner evaluation.
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 */

import { runHook } from './effects.js';
import { bumpStat } from './stats.js';

/* ------------------------------------------------------------------ */
/* Coins & bananas                                                     */
/* ------------------------------------------------------------------ */

/**
 * Add (or remove) coins for a player. Gains run through the onCoinsGained
 * chain, losses through onCoinsLost (as a positive magnitude). Balances are
 * clamped to >= 0. Emits a 'coins' event with the actual applied delta.
 *
 * @param {Object} sim
 * @param {string} pid
 * @param {number} delta Positive = gain, negative = loss.
 * @param {string} [reason] Free-form reason tag ('field_blue', 'trap', ...).
 * @returns {number} The delta actually applied (after hooks + clamping).
 */
export function addCoins(sim, pid, delta, reason = '') {
  const player = sim.state.players[pid];
  if (!player) throw new Error(`[sim] addCoins: unknown player "${pid}"`);
  let amount = Math.trunc(Number(delta) || 0);
  if (amount === 0) return 0;

  if (amount > 0) {
    amount = Math.max(0, Math.trunc(runHook(sim, 'onCoinsGained', pid, amount, { reason })));
  } else {
    const loss = Math.max(0, Math.trunc(runHook(sim, 'onCoinsLost', pid, -amount, { reason })));
    amount = -Math.min(loss, player.coins); // clamp so coins never go below 0
  }
  if (amount === 0) return 0;

  player.coins += amount;
  if (amount < 0) bumpStat(sim, pid, 'coinsLost', -amount);
  sim.emit('coins', { playerId: pid, delta: amount, total: player.coins, reason });
  return amount;
}

/**
 * Grant golden bananas (never negative totals).
 *
 * @param {Object} sim
 * @param {string} pid
 * @param {number} n
 * @param {string} [reason]
 * @returns {number} Applied delta.
 */
export function addBananas(sim, pid, n, reason = '') {
  const player = sim.state.players[pid];
  if (!player) throw new Error(`[sim] addBananas: unknown player "${pid}"`);
  let amount = Math.trunc(Number(n) || 0);
  if (amount < 0) amount = -Math.min(-amount, player.goldenBananas);
  if (amount === 0) return 0;
  player.goldenBananas += amount;
  sim.emit('star', { kind: 'bananas', playerId: pid, delta: amount, total: player.goldenBananas, reason });
  return amount;
}

/**
 * Award minigame payout coins (through the onMinigameCoins chain), tracking
 * the minigameCoins stat.
 *
 * @param {Object} sim
 * @param {string} pid
 * @param {number} n
 * @returns {number} Applied delta.
 */
export function addMinigameCoins(sim, pid, n) {
  let amount = Math.trunc(Number(n) || 0);
  if (amount === 0) return 0;
  amount = Math.trunc(runHook(sim, 'onMinigameCoins', pid, amount, {}));
  const applied = addCoins(sim, pid, amount, 'minigame');
  if (applied > 0) bumpStat(sim, pid, 'minigameCoins', applied);
  return applied;
}

/* ------------------------------------------------------------------ */
/* End-game bonus bananas                                              */
/* ------------------------------------------------------------------ */

/**
 * The five bonus categories. Each maps a player's stats to a score; the
 * highest score wins the category (ties break by turn order).
 */
export const BONUS_CATEGORIES = [
  {
    id: 'minigame_king',
    name: { en: 'Minigame King', de: 'Minigame-Koenig' },
    score: (stats) => stats.minigameWins,
  },
  {
    id: 'travel_monkey',
    name: { en: 'Travel Monkey', de: 'Reise-Affe' },
    score: (stats) => stats.fieldsMoved,
  },
  {
    id: 'item_monkey',
    name: { en: 'Item Monkey', de: 'Item-Affe' },
    score: (stats) => stats.itemsUsed,
  },
  {
    id: 'unlucky_monkey',
    name: { en: 'Unlucky Monkey', de: 'Pech-Affe' },
    score: (stats) => stats.coinsLost,
  },
  {
    id: 'event_monkey',
    name: { en: 'Event Monkey', de: 'Event-Affe' },
    score: (stats) => stats.eventsHit,
  },
];

/**
 * Award the end-game bonus bananas: 3 seeded picks out of the 5 categories,
 * one banana per category to the leading player. Skipped entirely in
 * competitive rules. Categories where every score is 0 award nothing.
 *
 * @param {Object} sim
 * @returns {{category: string, playerId: string, score: number}[]} Awards given.
 */
export function awardBonuses(sim) {
  const { state } = sim;
  if (state.rules.competitive) return [];

  const picked = sim.rng.shuffle(BONUS_CATEGORIES).slice(0, 3);
  const awards = [];
  for (const category of picked) {
    let best = null;
    let bestScore = 0;
    for (const pid of state.turnOrder) {
      const score = category.score(state.players[pid].stats);
      if (score > bestScore) {
        bestScore = score;
        best = pid;
      }
    }
    if (best === null) continue;
    addBananas(sim, best, 1, `bonus:${category.id}`);
    sim.emit('bonus', { category: category.id, name: category.name, playerId: best, score: bestScore, bananas: 1 });
    awards.push({ category: category.id, playerId: best, score: bestScore });
  }
  return awards;
}

/* ------------------------------------------------------------------ */
/* Winner evaluation                                                   */
/* ------------------------------------------------------------------ */

/**
 * Rank all players: bananas desc -> coins desc -> minigame wins desc ->
 * seeded coin flip. Deterministic for a given RNG state.
 *
 * @param {Object} sim
 * @returns {string[]} Player ids, winner first.
 */
export function evaluateWinner(sim) {
  const { state } = sim;
  // One seeded tiebreak draw per player, in turn order, so full ties resolve
  // by a reproducible "coin flip".
  const flip = new Map();
  for (const pid of state.turnOrder) flip.set(pid, sim.rng.next());

  return [...state.turnOrder].sort((a, b) => {
    const pa = state.players[a];
    const pb = state.players[b];
    if (pb.goldenBananas !== pa.goldenBananas) return pb.goldenBananas - pa.goldenBananas;
    if (pb.coins !== pa.coins) return pb.coins - pa.coins;
    if (pb.stats.minigameWins !== pa.stats.minigameWins) return pb.stats.minigameWins - pa.stats.minigameWins;
    return flip.get(b) - flip.get(a);
  });
}
