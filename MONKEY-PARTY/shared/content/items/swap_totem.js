/**
 * Swap Totem - swap board positions with another player.
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 */

/** @type {import('../../types.js').ItemDef} */
export default {
  id: 'swap_totem',
  name: { en: 'Swap Totem', de: 'Tausch-Totem' },
  description: {
    en: 'Ancient jungle magic swaps your position with another monkey.',
    de: 'Uralte Dschungelmagie tauscht deine Position mit einem anderen Affen.',
  },
  price: 12,
  rarity: 'rare',
  phase: 'anytime',
  target: 'player',
  competitiveSafe: true,
  icon: { bg: '#7c3aed', glyph: 'totem', fg: '#ede9fe' },
  effect(sim, userId, targetId) {
    const me = sim.state.players[userId];
    const other = sim.state.players[targetId];
    const myNode = me.node;
    sim.teleport(userId, other.node);
    sim.teleport(targetId, myNode);
    sim.emit('item', { kind: 'swap', playerId: userId, targetId, itemId: 'swap_totem' });
  },
};
