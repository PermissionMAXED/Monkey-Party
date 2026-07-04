/**
 * Magnet Banana - passive, 3 turns: +1 coin for every node you pass.
 * Activates the moment it is acquired (it never occupies a bag slot).
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 */

import { registerEffectDef } from '../../sim/effects.js';

registerEffectDef({
  id: 'magnet_banana',
  hooks: {
    onPassNode: (value, ctx) => {
      ctx.sim.coins(ctx.playerId, 1, 'magnet_banana');
      return value;
    },
  },
});

/** @type {import('../../types.js').ItemDef} */
export default {
  id: 'magnet_banana',
  name: { en: 'Magnet Banana', de: 'Magnetbanane' },
  description: {
    en: 'Passive for 3 turns: attract +1 coin for every field you pass.',
    de: 'Passiv fuer 3 Zuege: Ziehe +1 Muenze fuer jedes passierte Feld an.',
  },
  price: 7,
  rarity: 'common',
  phase: 'passive',
  target: 'self',
  competitiveSafe: true,
  icon: { bg: '#b45309', glyph: 'magnet', fg: '#fef9c3' },
  /** Starts its 3-turn aura immediately on pickup; the item itself is consumed. */
  onAcquire(sim, pid) {
    sim.addEffect(pid, { id: 'magnet_banana', turnsLeft: 3 });
    return { consumed: true };
  },
  /** Passive items are never actively used; effect is a no-op safeguard. */
  effect() {},
};
