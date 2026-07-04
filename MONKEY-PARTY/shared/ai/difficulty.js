/**
 * Bot difficulty profiles for the board-decision bot.
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 *
 * Each profile scales how far the bot looks ahead on the board graph and
 * how noisy its decisions are:
 *  - randomChance: probability of picking randomly among the topK actions
 *    instead of the single best one (easy = 35% among top-3, wild = 0%).
 *  - noise: uniform score jitter added per action (seeded RNG only).
 *  - lookahead: BFS depth for path/star/shop scoring.
 */

export const PROFILES = Object.freeze({
  easy: Object.freeze({ randomChance: 0.35, topK: 3, noise: 3, lookahead: 4 }),
  normal: Object.freeze({ randomChance: 0.15, topK: 2, noise: 1.5, lookahead: 8 }),
  hard: Object.freeze({ randomChance: 0.05, topK: 2, noise: 0.5, lookahead: 12 }),
  /** wild = optimal: full lookahead, zero randomness. */
  wild: Object.freeze({ randomChance: 0, topK: 1, noise: 0, lookahead: 20 }),
});

/**
 * @param {'easy'|'normal'|'hard'|'wild'|string} difficulty
 * @returns {{randomChance: number, topK: number, noise: number, lookahead: number}}
 */
export function getDifficultyProfile(difficulty) {
  return PROFILES[difficulty] ?? PROFILES.normal;
}

/**
 * Apply the profile's decision noise to a raw score.
 *
 * @param {number} score
 * @param {{noise: number}} profile
 * @param {Object} rng Seeded RNG (shared/rng.js).
 * @returns {number}
 */
export function jitterScore(score, profile, rng) {
  if (!profile.noise || !rng) return score;
  return score + (rng.next() * 2 - 1) * profile.noise;
}
