/**
 * Shop Coupon - passive: while held, your next shop purchase costs 30% less;
 * the coupon is consumed by that purchase.
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 */

import { assertHookNames } from '../../sim/effects.js';

const passiveHooks = {
  onShopPrice: (price) => Math.round(price * 0.7),
};
assertHookNames(passiveHooks, 'item "shop_coupon" passiveHooks');

/** @type {import('../../types.js').ItemDef} */
export default {
  id: 'shop_coupon',
  name: { en: 'Shop Coupon', de: 'Einkaufsgutschein' },
  description: {
    en: 'Passive: your next shop purchase is 30% off. One use.',
    de: 'Passiv: Dein naechster Einkauf im Laden ist 30% guenstiger. Einmalig.',
  },
  price: 4,
  rarity: 'common',
  phase: 'passive',
  target: 'none',
  competitiveSafe: true,
  icon: { bg: '#be185d', glyph: 'coupon', fg: '#fce7f3' },
  /** Passive hooks apply while the item sits in the bag (see effects.js). */
  passiveHooks,
  /** Passive items are never actively used; effect is a no-op safeguard. */
  effect() {},
};
