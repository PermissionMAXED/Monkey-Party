/**
 * Coconut Trap - place a trap within 5 steps; the victim who springs it
 * loses 10 coins to the trap owner.
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 */

/** @type {import('../../types.js').ItemDef} */
export default {
  id: 'coconut_trap',
  name: { en: 'Coconut Trap', de: 'Kokosnuss-Falle' },
  description: {
    en: 'Hide a coconut on a field within 5 steps. Whoever springs it drops 10 coins into your paws.',
    de: 'Verstecke eine Kokosnuss auf einem Feld in 5 Schritten Naehe. Wer sie ausloest, verliert 10 Muenzen an dich.',
  },
  price: 7,
  rarity: 'common',
  phase: 'trapPlace',
  target: 'node',
  competitiveSafe: true,
  icon: { bg: '#78350f', glyph: 'coconut', fg: '#fde68a' },
  effect(sim, userId, targetNode) {
    sim.placeTrap(userId, targetNode, 'coconut_trap');
  },
  /** Trap payload: victim loses up to 10 coins to the owner. */
  onTrigger(sim, victimId, ownerId) {
    sim.stealCoins(victimId, ownerId, 10);
    return {};
  },
};
