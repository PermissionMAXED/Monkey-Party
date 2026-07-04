/**
 * Ghost Banana - steal 1d6+4 coins from a target; 20% of the time the ghost
 * grabs a random item instead. Not competitive-safe (high variance theft).
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 */

/** @type {import('../../types.js').ItemDef} */
export default {
  id: 'ghost_banana',
  name: { en: 'Ghost Banana', de: 'Geisterbanane' },
  description: {
    en: 'A spooky banana spirit steals 1d6+4 coins from a rival - sometimes it snatches an item instead.',
    de: 'Ein spukender Bananengeist stiehlt 1d6+4 Muenzen von einem Rivalen - manchmal schnappt er sich stattdessen ein Item.',
  },
  price: 12,
  rarity: 'rare',
  phase: 'anytime',
  target: 'player',
  competitiveSafe: false,
  icon: { bg: '#0f172a', glyph: 'ghost', fg: '#c7d2fe' },
  effect(sim, userId, targetId) {
    const target = sim.state.players[targetId];
    const wantsItem = sim.rng.next() < 0.2;
    if (wantsItem && target.items.length > 0) {
      if (sim.tryBlockWithShield(targetId, 'steal')) {
        sim.emit('item', { kind: 'steal_blocked', playerId: userId, targetId, itemId: 'ghost_banana' });
        return;
      }
      const idx = sim.rng.int(0, target.items.length - 1);
      const stolen = target.items.splice(idx, 1)[0];
      const me = sim.state.players[userId];
      if (me.items.length < 3) me.items.push(stolen);
      sim.emit('item', { kind: 'item_stolen', playerId: userId, targetId, itemId: 'ghost_banana', stolen });
      return;
    }
    const amount = sim.rng.int(1, 6) + 4;
    const stolen = sim.stealCoins(targetId, userId, amount);
    sim.emit('item', { kind: 'coins_stolen', playerId: userId, targetId, itemId: 'ghost_banana', amount: stolen });
  },
};
