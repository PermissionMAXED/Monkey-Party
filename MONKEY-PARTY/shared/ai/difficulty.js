/**
 * Bot difficulty profiles for the board-decision bot.
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 *
 * Each profile scales how far the bot looks ahead on the board graph and
 * how noisy its decisions are:
 *  - randomChance: probability of picking randomly among the topK actions
 *    instead of the single best one (easy = 35% among top-3, hard = 5%).
 *  - noise: uniform score jitter added per action (seeded RNG only).
 *  - lookahead: BFS depth for path/star/shop scoring.
 *
 * 'hard' is the STRONGEST profile (near-optimal, minimal noise). 'wild' is
 * NOT a difficulty step above hard: it is the erratic chaos-monkey profile
 * used by the chaos rules preset - it reads the board deeply but gambles
 * loudly (high noise, frequent random picks among the top actions).
 */

export const PROFILES = Object.freeze({
  easy: Object.freeze({ randomChance: 0.35, topK: 3, noise: 3, lookahead: 4 }),
  normal: Object.freeze({ randomChance: 0.15, topK: 2, noise: 1.5, lookahead: 8 }),
  /** hard = strongest: near-optimal play, deepest consistent lookahead. */
  hard: Object.freeze({ randomChance: 0.05, topK: 2, noise: 0.5, lookahead: 12 }),
  /** wild = erratic/aggressive: deep reads, loud noise, frequent gambles. */
  wild: Object.freeze({ randomChance: 0.4, topK: 3, noise: 4, lookahead: 16 }),
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
