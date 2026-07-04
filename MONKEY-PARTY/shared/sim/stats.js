/**
 * Per-player match statistics.
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 *
 * Stats accumulate on MatchPlayerState.stats (see shared/types.js) and feed
 * the end-of-game bonus categories in scoring.js.
 */

/** Keys tracked on MatchPlayerState.stats. */
export const STAT_KEYS = [
  'minigameCoins',
  'fieldsMoved',
  'itemsUsed',
  'coinsLost',
  'eventsHit',
  'minigameWins',
];

/**
 * Fresh zeroed stats object for a new player.
 * @returns {import('../types.js').MatchPlayerState['stats']}
 */
export function initStats() {
  const stats = {};
  for (const key of STAT_KEYS) stats[key] = 0;
  return stats;
}

/**
 * Increment a stat for a player. Unknown keys throw (they would silently
 * break the bonus-category evaluation otherwise).
 *
 * @param {Object} sim Match sim (needs .state).
 * @param {string} pid Player id.
 * @param {string} key One of STAT_KEYS.
 * @param {number} [n] Amount to add (default 1).
 */
export function bumpStat(sim, pid, key, n = 1) {
  if (!STAT_KEYS.includes(key)) {
    throw new Error(`[sim] bumpStat: unknown stat "${key}"`);
  }
  const player = sim.state.players[pid];
  if (!player) return;
  player.stats[key] += n;
}
