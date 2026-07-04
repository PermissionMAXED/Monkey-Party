/**
 * Kiko - capuchin, starter. Perk "shop_haggler": -10% shop prices.
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 * Perk hooks are pure (value, ctx) => value functions run inside the sim.
 */

/** @type {import('../../types.js').CharacterDef} */
export default {
  id: 'kiko',
  name: 'Kiko',
  species: 'capuchin',
  blurb: {
    en: 'A quick-fingered capuchin who never pays full price.',
    de: 'Ein flinker Kapuziner, der nie den vollen Preis zahlt.',
  },
  build: {
    scale: 1.0,
    furColor: '#8a5a33',
    faceColor: '#f0d9b5',
    bellyColor: '#e8c9a0',
    earStyle: 'round',
    tail: 'long',
    snout: 'short',
    brow: 'flat',
    armLen: 1.0,
    potbelly: 0.15,
  },
  perk: {
    id: 'shop_haggler',
    description: {
      en: 'Haggler: shop prices are 10% cheaper for Kiko.',
      de: 'Feilscher: Ladenpreise sind fuer Kiko 10% guenstiger.',
    },
    hooks: {
      /** -10% (rounded), always at least 1 coin off anything costing 2+. */
      onShopPrice(price) {
        if (price <= 1) return price;
        return Math.min(price - 1, Math.round(price * 0.9));
      },
    },
  },
  voice: { pitch: 1.15, style: 'chirpy' },
  emotes: ['dance', 'laugh', 'taunt'],
  unlock: { bananas: 0 },
};
