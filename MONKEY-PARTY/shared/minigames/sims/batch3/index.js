/**
 * Minigame batch 3: eight more fully custom minigames (content package,
 * "Minigame Batch 3").
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 *
 * Default-exports registerBatch3(), which defines every batch-3 minigame
 * through the framework validator (idempotent: already-registered ids are
 * skipped by each game's register()).
 */

import registerBananaBridgeBuilders from './bananaBridgeBuilders.js';
import registerMonkeyCannonballDodge from './monkeyCannonballDodge.js';
import registerCoconutCurling from './coconutCurling.js';
import registerFireflyCatchers from './fireflyCatchers.js';
import registerTotemTowerTopple from './totemTowerTopple.js';
import registerStampedeSurfers from './stampedeSurfers.js';
import registerEchoCavern from './echoCavern.js';
import registerRoyalBananaHeist from './royalBananaHeist.js';

/** Batch-3 minigame ids, in registration order. */
export const BATCH3_IDS = [
  'banana_bridge_builders',
  'monkey_cannonball_dodge',
  'coconut_curling',
  'firefly_catchers',
  'totem_tower_topple',
  'stampede_surfers',
  'echo_cavern',
  'royal_banana_heist',
];

const REGISTRARS = [
  registerBananaBridgeBuilders,
  registerMonkeyCannonballDodge,
  registerCoconutCurling,
  registerFireflyCatchers,
  registerTotemTowerTopple,
  registerStampedeSurfers,
  registerEchoCavern,
  registerRoyalBananaHeist,
];

/**
 * Register all batch-3 minigames.
 * @returns {import('../../../types.js').MinigameDef[]}
 */
export default function registerBatch3() {
  return REGISTRARS.map((register) => register());
}
