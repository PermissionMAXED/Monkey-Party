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
 * Pick the bonus categories for a match: Minigame King always, plus ONE
 * seeded pick from the remaining categories (2 bonus bananas total, so the
 * hidden end-game swing can never outweigh the board game). Returns [] for
 * competitive and hardcore rules (no bonus bananas there).
 *
 * Called at match start so the active categories can be announced up front
 * (MatchState.bonusCategories).
 *
 * @param {Object} rng Seeded RNG (shared/rng.js).
 * @param {import('../types.js').Rules} rules
 * @returns {string[]} Category ids.
 */
export function pickBonusCategoryIds(rng, rules) {
  if (rules.competitive || rules.hardcore) return [];
  const others = BONUS_CATEGORIES.filter((c) => c.id !== 'minigame_king');
  return ['minigame_king', rng.pick(others).id];
}

/**
 * Award the end-game bonus bananas: one banana per announced category
 * (state.bonusCategories - Minigame King + 1 random) to the leading player.
 * Skipped entirely in competitive AND hardcore rules. Categories where
 * every score is 0 award nothing. Ties break by turn order.
 *
 * @param {Object} sim
 * @returns {{category: string, playerId: string, score: number}[]} Awards given.
 */
export function awardBonuses(sim) {
  const { state } = sim;
  if (state.rules.competitive || state.rules.hardcore) return [];

  const ids = Array.isArray(state.bonusCategories) && state.bonusCategories.length > 0
    ? state.bonusCategories
    : pickBonusCategoryIds(sim.rng, state.rules);
  const awards = [];
  for (const id of ids) {
    const category = BONUS_CATEGORIES.find((c) => c.id === id);
    if (!category) continue;
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
 * Rank all players with the ANNOUNCED deterministic tiebreak chain:
 * bananas desc -> coins desc -> minigame wins desc -> turn order.
 *
 * When the winner was decided by anything other than bananas (i.e. the top
 * two players are tied on golden bananas) the result records which rule
 * broke the tie so the UI can surface it.
 *
 * @param {Object} sim
 * @returns {{ranking: string[], tiebreak: 'coins'|'minigameWins'|'turnOrder'|null}}
 */
export function evaluateWinner(sim) {
  const { state } = sim;
  const order = state.turnOrder;
  const ranking = [...order].sort((a, b) => {
    const pa = state.players[a];
    const pb = state.players[b];
    if (pb.goldenBananas !== pa.goldenBananas) return pb.goldenBananas - pa.goldenBananas;
    if (pb.coins !== pa.coins) return pb.coins - pa.coins;
    if (pb.stats.minigameWins !== pa.stats.minigameWins) return pb.stats.minigameWins - pa.stats.minigameWins;
    return order.indexOf(a) - order.indexOf(b);
  });

  let tiebreak = null;
  if (ranking.length > 1) {
    const first = state.players[ranking[0]];
    const second = state.players[ranking[1]];
    if (second.goldenBananas === first.goldenBananas) {
      if (first.coins !== second.coins) tiebreak = 'coins';
      else if (first.stats.minigameWins !== second.stats.minigameWins) tiebreak = 'minigameWins';
      else tiebreak = 'turnOrder';
    }
  }
  return { ranking, tiebreak };
}
