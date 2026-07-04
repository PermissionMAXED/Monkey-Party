/**
 * Double Dice - roll two d6 this turn.
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 */

import { registerEffectDef } from '../../sim/effects.js';

registerEffectDef({
  id: 'double_dice',
  hooks: {
    onDicePool: (pool) => ({ ...pool, count: 2 }),
  },
});

/** @type {import('../../types.js').ItemDef} */
export default {
  id: 'double_dice',
  name: { en: 'Double Dice', de: 'Doppelwuerfel' },
  description: {
    en: 'Roll two dice this turn and move the sum.',
    de: 'Wuerfle diese Runde zwei Wuerfel und ziehe die Summe.',
  },
  price: 10,
  rarity: 'rare',
  phase: 'preRoll',
  target: 'none',
  competitiveSafe: true,
  icon: { bg: '#1d4ed8', glyph: 'dice2', fg: '#ffffff' },
  effect(sim, userId) {
    sim.addEffect(userId, { id: 'double_dice', turnsLeft: 1 });
  },
};
