/**
 * Nana - orangutan, starter. Perk "wise": shops she walks into carry one
 * extra ware (+1 shop stock, added via the board's shopStockOverrides).
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 * onPassNode fires for the final step too (before the shop opens), so the
 * extra ware is on the shelf whether Nana passes or lands on the shop.
 */

/** Preferred extra wares, first one not already in stock gets added. */
const WISE_WARES = ['lucky_mask', 'shop_coupon', 'shield_shell', 'double_dice'];

/** @type {import('../../types.js').CharacterDef} */
export default {
  id: 'nana',
  name: 'Nana',
  species: 'orangutan',
  blurb: {
    en: 'An old soul of the canopy. Shopkeepers show her the good shelf.',
    de: 'Eine alte Seele der Baumkronen. Haendler zeigen ihr das gute Regal.',
  },
  build: {
    scale: 1.35,
    furColor: '#c15f2e',
    faceColor: '#8a6c50',
    bellyColor: '#a9744a',
    earStyle: 'small',
    tail: 'none',
    snout: 'wide',
    brow: 'soft',
    armLen: 1.4,
    potbelly: 0.6,
  },
  perk: {
    id: 'wise',
    description: {
      en: 'Wise: shops Nana visits stock 1 extra ware.',
      de: 'Weise: Laeden, die Nana besucht, fuehren 1 zusaetzliche Ware.',
    },
    hooks: {
      /** Entering a shop node adds one extra ware to that shop's stock. */
      onPassNode(value, ctx) {
        const { sim, node } = ctx;
        const nodeDef = sim.board.nodes.find((n) => n.id === node);
        if (!nodeDef || nodeDef.type !== 'shop') return value;
        const overrides = sim.state.board.shopStockOverrides;
        const extra = Array.isArray(overrides[node]) ? overrides[node] : [];
        if (extra.some((id) => WISE_WARES.includes(id))) return value; // already enriched
        const base = sim.board.shops?.find((s) => s.node === node)?.stock ?? [];
        const have = new Set([...base, ...extra]);
        const ware = WISE_WARES.find((id) => !have.has(id));
        if (ware) overrides[node] = [...extra, ware];
        return value;
      },
    },
  },
  voice: { pitch: 0.75, style: 'mellow' },
  emotes: ['facepalm', 'laugh', 'cry'],
  unlock: { bananas: 0 },
};
