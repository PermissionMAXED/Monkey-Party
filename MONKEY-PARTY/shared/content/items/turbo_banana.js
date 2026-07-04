/**
 * Turbo Banana - +4 movement steps this turn.
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 */

import { registerEffectDef } from '../../sim/effects.js';

registerEffectDef({
  id: 'turbo_banana',
  hooks: {
    onMoveSteps: (steps) => steps + 4,
  },
});

/** @type {import('../../types.js').ItemDef} */
export default {
  id: 'turbo_banana',
  name: { en: 'Turbo Banana', de: 'Turbo-Banane' },
  description: {
    en: 'Peel out! Move 4 extra steps this turn.',
    de: 'Vollgas! Ziehe diese Runde 4 Felder weiter.',
  },
  price: 6,
  rarity: 'common',
  phase: 'preRoll',
  target: 'none',
  competitiveSafe: true,
  icon: { bg: '#f59e0b', glyph: 'banana', fg: '#fef3c7' },
  effect(sim, userId) {
    sim.addEffect(userId, { id: 'turbo_banana', turnsLeft: 1 });
  },
};
