/**
 * Dice Curse - the target rolls only a d3 on their next turn.
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 */

import { registerEffectDef } from '../../sim/effects.js';

registerEffectDef({
  id: 'dice_curse',
  hooks: {
    onDicePool: (pool) => ({ ...pool, sides: 3, count: 1 }),
  },
});

/** @type {import('../../types.js').ItemDef} */
export default {
  id: 'dice_curse',
  name: { en: 'Dice Curse', de: 'Wuerfelfluch' },
  description: {
    en: 'Hex a rival: on their next turn they roll only a d3.',
    de: 'Verhexe einen Rivalen: In seinem naechsten Zug wuerfelt er nur einen W3.',
  },
  price: 9,
  rarity: 'rare',
  phase: 'anytime',
  target: 'player',
  competitiveSafe: true,
  icon: { bg: '#581c87', glyph: 'curse', fg: '#f3e8ff' },
  effect(sim, userId, targetId) {
    sim.addEffect(targetId, { id: 'dice_curse', turnsLeft: 1 });
    sim.emit('item', { kind: 'cursed', playerId: userId, targetId, itemId: 'dice_curse' });
  },
};
