/**
 * Banana Peel - trap: the victim loses 5 coins and skids 3 nodes forward,
 * ending their movement.
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 */

import { slidePlayer } from '../../sim/movement.js';

/** @type {import('../../types.js').ItemDef} */
export default {
  id: 'banana_peel',
  name: { en: 'Banana Peel', de: 'Bananenschale' },
  description: {
    en: 'Drop a slippery peel within 5 steps. The victim loses 5 coins and skids 3 fields onward.',
    de: 'Lege eine rutschige Schale in 5 Schritten Naehe. Das Opfer verliert 5 Muenzen und schlittert 3 Felder weiter.',
  },
  price: 5,
  rarity: 'common',
  phase: 'trapPlace',
  target: 'node',
  competitiveSafe: true,
  icon: { bg: '#ca8a04', glyph: 'peel', fg: '#fefce8' },
  effect(sim, userId, targetNode) {
    sim.placeTrap(userId, targetNode, 'banana_peel');
  },
  /** Trap payload: -5 coins, 3-node skid, movement cancelled. */
  onTrigger(sim, victimId) {
    sim.coins(victimId, -5, 'trap:banana_peel');
    slidePlayer(sim, victimId, 3);
    return { cancelMove: true };
  },
};
