/**
 * Babu - baboon, starter. Perk "bully": his push effects go 2 fields
 * further (a Mini Gorilla he unleashes shoves rivals 7 back, not 5).
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 * onItemUse runs after the item's effect, so the extra shove stacks on
 * top of the item's own pushback (same deterministic path).
 */

import { pushBack } from '../../sim/movement.js';

/** Item ids whose effect pushes a rival backwards. */
const PUSH_ITEMS = ['mini_gorilla'];

/** @type {import('../../types.js').CharacterDef} */
export default {
  id: 'babu',
  name: 'Babu',
  species: 'baboon',
  blurb: {
    en: 'Big, loud and pushy - literally. Do not queue in front of him.',
    de: 'Gross, laut und aufdringlich - woertlich. Stell dich nie vor ihn.',
  },
  build: {
    scale: 1.25,
    furColor: '#8c7a66',
    faceColor: '#c65b4e',
    bellyColor: '#9c8a75',
    earStyle: 'pointy',
    tail: 'curl',
    snout: 'long',
    brow: 'heavy',
    armLen: 1.15,
    potbelly: 0.25,
  },
  perk: {
    id: 'bully',
    description: {
      en: 'Bully: push effects Babu uses shove 2 extra fields.',
      de: 'Rüpel: Schubs-Effekte von Babu stossen 2 Felder weiter.',
    },
    hooks: {
      /** After a push item resolves, shove the same target 2 more fields. */
      onItemUse(use, ctx) {
        if (!use || !PUSH_ITEMS.includes(use.itemId) || !use.target) return use;
        if (!ctx.sim.state.players[use.target]) return use;
        const node = pushBack(ctx.sim, use.target, 2);
        ctx.sim.emit('item', {
          kind: 'perk_bully', playerId: ctx.playerId, targetId: use.target, itemId: use.itemId, node,
        });
        return use;
      },
    },
  },
  voice: { pitch: 0.7, style: 'bark' },
  emotes: ['taunt', 'flex', 'facepalm'],
  unlock: { bananas: 0 },
};
