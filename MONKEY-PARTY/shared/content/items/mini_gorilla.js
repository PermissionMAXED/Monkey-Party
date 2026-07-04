/**
 * Mini Gorilla - a tiny gorilla shoves a target 5 nodes backwards.
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 */

import { pushBack } from '../../sim/movement.js';

/** @type {import('../../types.js').ItemDef} */
export default {
  id: 'mini_gorilla',
  name: { en: 'Mini Gorilla', de: 'Mini-Gorilla' },
  description: {
    en: 'A pocket-sized gorilla pushes a rival 5 fields back.',
    de: 'Ein Taschen-Gorilla schiebt einen Rivalen 5 Felder zurueck.',
  },
  price: 12,
  rarity: 'rare',
  phase: 'anytime',
  target: 'player',
  competitiveSafe: true,
  icon: { bg: '#374151', glyph: 'gorilla', fg: '#e5e7eb' },
  effect(sim, userId, targetId) {
    const node = pushBack(sim, targetId, 5);
    sim.emit('item', { kind: 'pushback', playerId: userId, targetId, itemId: 'mini_gorilla', node });
  },
};
