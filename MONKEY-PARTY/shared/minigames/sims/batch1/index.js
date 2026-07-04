/**
 * Minigame batch 1: the first 8 fully custom minigames (package P7).
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 *
 * Default-exports registerBatch1(), which defines every batch-1 minigame
 * through the framework validator (idempotent: already-registered ids are
 * skipped by each game's register()).
 */

import registerBananaScramble from './bananaScramble.js';
import registerVineSwingSprint from './vineSwingSprint.js';
import registerBarrelBlastArena from './barrelBlastArena.js';
import registerSneakyStatue from './sneakyStatue.js';
import registerMemoryTotem from './memoryTotem.js';
import registerSplashSumo from './splashSumo.js';
import registerBananaCannonTeams from './bananaCannonTeams.js';
import registerBombBanana from './bombBanana.js';

/** Batch-1 minigame ids, in registration order. */
export const BATCH1_IDS = [
  'banana_scramble',
  'vine_swing_sprint',
  'barrel_blast_arena',
  'sneaky_statue',
  'memory_totem',
  'splash_sumo',
  'banana_cannon_teams',
  'bomb_banana',
];

const REGISTRARS = [
  registerBananaScramble,
  registerVineSwingSprint,
  registerBarrelBlastArena,
  registerSneakyStatue,
  registerMemoryTotem,
  registerSplashSumo,
  registerBananaCannonTeams,
  registerBombBanana,
];

/**
 * Register all batch-1 minigames.
 * @returns {import('../../../types.js').MinigameDef[]}
 */
export default function registerBatch1() {
  return REGISTRARS.map((register) => register());
}
