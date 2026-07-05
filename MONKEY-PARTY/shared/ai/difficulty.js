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
  /**
   * easy: randomChance/topK are pinned by tests/sim.test.js (0.35 / 3), so
   * beginner-friendliness is tuned through noise + lookahead instead:
   * noise 4.5 (was 3) drowns out most score gaps below "use the ticket",
   * and lookahead 3 (was 4) means easy barely reads past the next corner.
   * Measured (tests/balance.test.js batch): easy avg final rank 3.2-3.4 of
   * 4 vs hard 2.1-2.5 - clearly beatable without playing dead.
   */
  easy: Object.freeze({ randomChance: 0.35, topK: 3, noise: 4.5, lookahead: 3 }),
  normal: Object.freeze({ randomChance: 0.15, topK: 2, noise: 1.5, lookahead: 8 }),
  /**
   * hard = strongest CONSISTENT profile: near-optimal play, deep lookahead,
   * but 5% random top-2 picks + 0.5 noise keep it human ("not psychic").
   */
  hard: Object.freeze({ randomChance: 0.05, topK: 2, noise: 0.5, lookahead: 12 }),
  /**
   * wild = erratic/aggressive: hard-level MEANS, loud variance. lookahead
   * 12 (was 16) matches hard instead of out-reading it - wild's board
   * profile is no longer strictly superior on any knob. randomChance 0.5 /
   * noise 5.5 keep the gambles loud: many frozen minigame bot tables (pre
   * batch3) still treat 'wild' as the sharpest reflexes (avg minigame rank
   * 1.40 of 4 vs hard's 2.08, measured over 60 real sims), so board-side
   * blunders (declined stars, random junctions) claw back part of that
   * frozen minigame edge. The batch3 tables sample wild per-window between
   * peak/'hard'/'easy' rows for the same hard-mean/high-variance shape.
   */
  wild: Object.freeze({ randomChance: 0.5, topK: 3, noise: 5.5, lookahead: 12 }),
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
