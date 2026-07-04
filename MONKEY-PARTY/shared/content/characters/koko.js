/**
 * Koko - colobus, unlock 35 bananas. Perk "acrobat": slide hazards never
 * catch her - banana-peel traps (the skid-and-drop kind) always fizzle.
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 */

/** Placed trap item ids that slide/shove their victim. */
const SLIDE_TRAPS = ['banana_peel'];

/** @type {import('../../types.js').CharacterDef} */
export default {
  id: 'koko',
  name: 'Koko',
  species: 'colobus',
  blurb: {
    en: 'A black-and-white blur that lands on her feet. Always.',
    de: 'Ein schwarz-weisser Blitz, der immer auf den Fuessen landet.',
  },
  build: {
    scale: 1.05,
    furColor: '#17171c',
    faceColor: '#3c3c44',
    bellyColor: '#f2f2f2',
    earStyle: 'small',
    tail: 'long',
    snout: 'short',
    brow: 'flat',
    armLen: 1.2,
    potbelly: 0,
  },
  perk: {
    id: 'acrobat',
    description: {
      en: 'Acrobat: slide traps (banana peels) never trip Koko.',
      de: 'Akrobatin: Rutschfallen (Bananenschalen) legen Koko nie aufs Kreuz.',
    },
    hooks: {
      /** Cancel slide-type placed traps; other traps hit as normal. */
      onTrapTriggered(info, ctx) {
        if (!info || info.cancelled) return info;
        if (!ctx.itemId || !SLIDE_TRAPS.includes(ctx.itemId)) return info;
        return { ...info, cancelled: true };
      },
    },
  },
  voice: { pitch: 1.2, style: 'airy' },
  emotes: ['dance', 'flex', 'taunt'],
  unlock: { bananas: 35 },
};
