/**
 * Momo - spider monkey, starter. Perk "long_reach": single-die rolls that
 * total 1 or 2 get +1 step (those long limbs stretch a little further).
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 */

/** @type {import('../../types.js').CharacterDef} */
export default {
  id: 'momo',
  name: 'Momo',
  species: 'spider monkey',
  blurb: {
    en: 'All arms, legs and tail. Short rolls stretch a step further.',
    de: 'Nur Arme, Beine und Schwanz. Kurze Wuerfe reichen einen Schritt weiter.',
  },
  build: {
    scale: 1.05,
    furColor: '#4d3826',
    faceColor: '#d9b38c',
    bellyColor: '#c69c6d',
    earStyle: 'round',
    tail: 'curl',
    snout: 'short',
    brow: 'arched',
    armLen: 1.45,
    potbelly: 0,
  },
  perk: {
    id: 'long_reach',
    description: {
      en: 'Long Reach: dice rolls of 1-2 move Momo 1 extra step.',
      de: 'Langer Arm: Wuerfe von 1-2 bewegen Momo 1 Feld weiter.',
    },
    hooks: {
      /** +1 on weak single-die totals (1-2). Multi-dice pools are untouched. */
      onDiceRoll(roll) {
        if (!roll || roll.count !== 1) return roll;
        if (roll.total < 1 || roll.total > 2) return roll;
        return { ...roll, total: roll.total + 1 };
      },
    },
  },
  voice: { pitch: 1.05, style: 'smooth' },
  emotes: ['dance', 'laugh', 'cry'],
  unlock: { bananas: 0 },
};
