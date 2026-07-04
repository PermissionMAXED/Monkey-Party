/**
 * Kumo - langur, unlock 10 bananas. Perk "zen": red fields sting 1 coin
 * less (breathe in, breathe out, keep a coin).
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 */

/** @type {import('../../types.js').CharacterDef} */
export default {
  id: 'kumo',
  name: 'Kumo',
  species: 'langur',
  blurb: {
    en: 'A silver-furred monk. Bad luck slides off him like rain.',
    de: 'Ein silberner Moench. Pech perlt an ihm ab wie Regen.',
  },
  build: {
    scale: 1.0,
    furColor: '#c8c8d0',
    faceColor: '#2b2b33',
    bellyColor: '#dcdce2',
    earStyle: 'small',
    tail: 'long',
    snout: 'flat',
    brow: 'soft',
    armLen: 1.1,
    potbelly: 0,
  },
  perk: {
    id: 'zen',
    description: {
      en: 'Zen: red fields cost Kumo 1 coin less.',
      de: 'Zen: Rote Felder kosten Kumo 1 Muenze weniger.',
    },
    hooks: {
      /** Red-field losses (reason 'field_red') are reduced by 1. */
      onCoinsLost(loss, ctx) {
        if (ctx.reason !== 'field_red') return loss;
        return Math.max(0, loss - 1);
      },
    },
  },
  voice: { pitch: 0.95, style: 'calm' },
  emotes: ['facepalm', 'laugh', 'dance'],
  unlock: { bananas: 10 },
};
