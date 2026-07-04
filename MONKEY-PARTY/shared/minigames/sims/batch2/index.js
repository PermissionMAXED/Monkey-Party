/**
 * Minigame batch 2: eight more fully custom minigames (package P8).
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 *
 * Default-exports registerBatch2(), which defines every batch-2 minigame
 * through the framework validator (idempotent: already-registered ids are
 * skipped by each game's register()).
 */

import registerRollingLogRun from './rollingLogRun.js';
import registerJunglePainters from './junglePainters.js';
import registerGhostMazeEscape from './ghostMazeEscape.js';
import registerPiranhaFishing from './piranhaFishing.js';
import registerRhythmDrums from './rhythmDrums.js';
import registerIceSlideRace from './iceSlideRace.js';
import registerBluffBanana from './bluffBanana.js';
import registerKingGorillaSmash from './kingGorillaSmash.js';

/** Batch-2 minigame ids, in registration order. */
export const BATCH2_IDS = [
  'rolling_log_run',
  'jungle_painters',
  'ghost_maze_escape',
  'piranha_fishing',
  'rhythm_drums',
  'ice_slide_race',
  'bluff_banana',
  'king_gorilla_smash',
];

const REGISTRARS = [
  registerRollingLogRun,
  registerJunglePainters,
  registerGhostMazeEscape,
  registerPiranhaFishing,
  registerRhythmDrums,
  registerIceSlideRace,
  registerBluffBanana,
  registerKingGorillaSmash,
];

/**
 * Register all batch-2 minigames.
 * @returns {import('../../../types.js').MinigameDef[]}
 */
export default function registerBatch2() {
  return REGISTRARS.map((register) => register());
}
