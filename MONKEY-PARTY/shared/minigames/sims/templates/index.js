/**
 * Template minigames registrar (package P8).
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 *
 * Six parameterized templates (reactionDuel, dodgeRain, mashRace,
 * memoryPath, collectRush, targetShoot) fan out into the full variant
 * catalog declared in variants.js. Default-exports registerTemplates(),
 * loaded by shared/minigames/index.js; idempotent because every factory
 * skips ids that are already registered.
 */

import { VARIANTS } from './variants.js';
import { makeReactionDuelVariant } from './reactionDuel.js';
import { makeDodgeRainVariant } from './dodgeRain.js';
import { makeMashRaceVariant } from './mashRace.js';
import { makeMemoryPathVariant } from './memoryPath.js';
import { makeCollectRushVariant } from './collectRush.js';
import { makeTargetShootVariant } from './targetShoot.js';

/** templateId -> variant factory. */
export const TEMPLATE_FACTORIES = {
  reactionDuel: makeReactionDuelVariant,
  dodgeRain: makeDodgeRainVariant,
  mashRace: makeMashRaceVariant,
  memoryPath: makeMemoryPathVariant,
  collectRush: makeCollectRushVariant,
  targetShoot: makeTargetShootVariant,
};

/** All template variant ids, in registration order. */
export const TEMPLATE_VARIANT_IDS = VARIANTS.map((v) => v.id);

/**
 * Register every template variant.
 * @returns {import('../../../types.js').MinigameDef[]}
 */
export default function registerTemplates() {
  return VARIANTS.map((variant) => {
    const factory = TEMPLATE_FACTORIES[variant.templateId];
    if (typeof factory !== 'function') {
      throw new Error(`[minigames] unknown template "${variant.templateId}" for variant "${variant.id}"`);
    }
    return factory(variant);
  });
}
