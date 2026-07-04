/**
 * Zaza - marmoset, starter. Perk "tiny_target": coin steals against her
 * are halved (rounded up) - she is simply too small to rob properly.
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 */

/** @type {import('../../types.js').CharacterDef} */
export default {
  id: 'zaza',
  name: 'Zaza',
  species: 'marmoset',
  blurb: {
    en: 'A pocket-sized fluffball. Thieves grab mostly air.',
    de: 'Ein Wollknaeuel im Taschenformat. Diebe greifen meist ins Leere.',
  },
  build: {
    scale: 0.8,
    furColor: '#d8cfc0',
    faceColor: '#f5e8d8',
    bellyColor: '#efe3d0',
    earStyle: 'tufted',
    tail: 'long',
    snout: 'short',
    brow: 'soft',
    armLen: 0.9,
    potbelly: 0.1,
  },
  perk: {
    id: 'tiny_target',
    description: {
      en: 'Tiny Target: coins stolen from Zaza are halved.',
      de: 'Winziges Ziel: Von Zaza gestohlene Muenzen werden halbiert.',
    },
    hooks: {
      /** Steal losses (reason 'steal') are halved, rounded in her favor. */
      onCoinsLost(loss, ctx) {
        if (ctx.reason !== 'steal') return loss;
        return Math.floor(loss / 2);
      },
    },
  },
  voice: { pitch: 1.45, style: 'squeak' },
  emotes: ['cry', 'laugh', 'dance'],
  unlock: { bananas: 0 },
};
