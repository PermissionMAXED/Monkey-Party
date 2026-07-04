/**
 * Lucky Mask - reroll the dice once and keep the better total.
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 */

import { registerEffectDef } from '../../sim/effects.js';

registerEffectDef({
  id: 'lucky_mask',
  hooks: {
    onDiceRoll: (roll, ctx) => {
      const alt = roll.values.map(() => ctx.sim.rng.int(1, roll.sides));
      const altTotal = alt.reduce((a, b) => a + b, 0);
      if (altTotal > roll.total) {
        return { ...roll, values: alt, total: altTotal, rerolled: true, discarded: roll.total };
      }
      return { ...roll, rerolled: true, discarded: altTotal };
    },
  },
});

/** @type {import('../../types.js').ItemDef} */
export default {
  id: 'lucky_mask',
  name: { en: 'Lucky Mask', de: 'Gluecksmaske' },
  description: {
    en: 'Roll twice this turn, keep the better result.',
    de: 'Wuerfle diese Runde zweimal und behalte das bessere Ergebnis.',
  },
  price: 6,
  rarity: 'common',
  phase: 'preRoll',
  target: 'none',
  competitiveSafe: true,
  icon: { bg: '#059669', glyph: 'mask', fg: '#d1fae5' },
  effect(sim, userId) {
    sim.addEffect(userId, { id: 'lucky_mask', turnsLeft: 1 });
  },
};
