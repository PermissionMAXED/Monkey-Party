/**
 * Pip - squirrel monkey, unlock 75 bananas. Perk "hoarder": when his item
 * bag overflows, the converted grant pays 8 coins instead of 5 (he squeezes
 * every last banana out of the stash).
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 * Bag-full conversions pay out with reason 'item_bag_full' (see
 * shared/sim/shop.js grantItem), which this hook tops up by +3.
 */

/** @type {import('../../types.js').CharacterDef} */
export default {
  id: 'pip',
  name: 'Pip',
  species: 'squirrel monkey',
  blurb: {
    en: 'Tiny paws, bottomless pockets. Nothing he grabs goes to waste.',
    de: 'Winzige Pfoten, bodenlose Taschen. Nichts, was er greift, verkommt.',
  },
  build: {
    scale: 0.8,
    furColor: '#b7a14f',
    faceColor: '#f4e9d0',
    bellyColor: '#e6d9a8',
    earStyle: 'round',
    tail: 'long',
    snout: 'short',
    brow: 'arched',
    armLen: 0.9,
    potbelly: 0.1,
  },
  perk: {
    id: 'hoarder',
    description: {
      en: 'Hoarder: item grants with a full bag pay Pip 8 coins instead of 5.',
      de: 'Hamsterer: Items bei voller Tasche bringen Pip 8 statt 5 Muenzen.',
    },
    hooks: {
      /** Full-bag item conversions (+5) pay +3 extra. */
      onCoinsGained(amount, ctx) {
        if (ctx.reason !== 'item_bag_full') return amount;
        return amount + 3;
      },
    },
  },
  voice: { pitch: 1.5, style: 'peep' },
  emotes: ['cry', 'dance', 'laugh'],
  unlock: { bananas: 75 },
};
