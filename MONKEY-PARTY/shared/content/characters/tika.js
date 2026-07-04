/**
 * Tika - tamarin, starter. Perk "sparkle": landing on an item field has a
 * 20% chance to yield a second item (seeded sim RNG - deterministic).
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 * onLandNode runs after the field effect granted the first item, so the
 * bonus grant simply stacks a second one (bag-full converts to +5 coins).
 */

/** @type {import('../../types.js').CharacterDef} */
export default {
  id: 'tika',
  name: 'Tika',
  species: 'tamarin',
  blurb: {
    en: 'A golden whirlwind with an eye for shiny loot.',
    de: 'Ein goldener Wirbelwind mit Blick fuer glitzernde Beute.',
  },
  build: {
    scale: 0.85,
    furColor: '#e0a13c',
    faceColor: '#5b4632',
    bellyColor: '#f0c46a',
    earStyle: 'tufted',
    tail: 'long',
    snout: 'short',
    brow: 'arched',
    armLen: 0.95,
    potbelly: 0.05,
  },
  perk: {
    id: 'sparkle',
    description: {
      en: 'Sparkle: item fields have a 20% chance to give Tika a second item.',
      de: 'Funkeln: Itemfelder geben Tika mit 20% Chance ein zweites Item.',
    },
    hooks: {
      /** 20% double grant when landing on an item field. */
      onLandNode(value, ctx) {
        if (ctx.fieldType !== 'item') return value;
        if (ctx.sim.state.rules.items === 'off') return value;
        if (ctx.sim.rng.next() < 0.2) {
          ctx.sim.emit('item', { kind: 'perk_sparkle', playerId: ctx.playerId, node: ctx.node });
          ctx.sim.giveItem(ctx.playerId, 'random');
        }
        return value;
      },
    },
  },
  voice: { pitch: 1.35, style: 'twinkle' },
  emotes: ['dance', 'laugh', 'cry'],
  unlock: { bananas: 0 },
};
