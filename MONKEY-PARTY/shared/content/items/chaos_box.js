/**
 * Chaos Box - one random effect from a seeded table of 8 outcomes.
 * Not competitive-safe (pure chaos).
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 */

/** The 8 outcomes, index-stable so seeded picks stay deterministic. */
export const CHAOS_OUTCOMES = [
  'coins_rain', // +10 coins
  'coins_drain', // -10 coins
  'teleport_random', // teleport to a random node
  'swap_random', // swap positions with a random player
  'others_pay', // every other player loses 3 coins
  'free_item', // gain a random item
  'self_curse', // you get the dice curse
  'star_moves', // the star relocates
];

/** @type {import('../../types.js').ItemDef} */
export default {
  id: 'chaos_box',
  name: { en: 'Chaos Box', de: 'Chaoskiste' },
  description: {
    en: 'Crack it open: one of 8 random things happens. Good luck.',
    de: 'Mach sie auf: Eines von 8 zufaelligen Dingen passiert. Viel Glueck.',
  },
  // Balance tuning: 7 (was 8). At 8 the box was the least-traded item in
  // the 40-match harness batches (0-3 shop buys, sometimes zero uses all
  // batch); its outcome table EV is roughly +1..+2 coins, so it should
  // price as an impulse gamble, not alongside dice_curse (9).
  price: 7,
  rarity: 'rare',
  phase: 'anytime',
  target: 'none',
  competitiveSafe: false,
  icon: { bg: '#dc2626', glyph: 'box', fg: '#fee2e2' },
  effect(sim, userId) {
    const roll = sim.rng.int(0, CHAOS_OUTCOMES.length - 1);
    const outcome = CHAOS_OUTCOMES[roll];
    sim.emit('item', { kind: 'chaos', playerId: userId, itemId: 'chaos_box', outcome });
    switch (outcome) {
      case 'coins_rain':
        sim.coins(userId, 10, 'chaos_box');
        break;
      case 'coins_drain':
        sim.coins(userId, -10, 'chaos_box');
        break;
      case 'teleport_random': {
        const node = sim.rng.pick(sim.board.nodes.filter((n) => n.type !== 'start'));
        sim.teleport(userId, node.id);
        break;
      }
      case 'swap_random': {
        const others = sim.state.turnOrder.filter((p) => p !== userId);
        const targetId = sim.rng.pick(others);
        const me = sim.state.players[userId];
        const other = sim.state.players[targetId];
        const myNode = me.node;
        sim.teleport(userId, other.node);
        sim.teleport(targetId, myNode);
        break;
      }
      case 'others_pay':
        for (const p of sim.state.turnOrder) {
          if (p !== userId) sim.coins(p, -3, 'chaos_box');
        }
        break;
      case 'free_item':
        sim.giveItem(userId, 'random');
        break;
      case 'self_curse':
        sim.addEffect(userId, { id: 'dice_curse', turnsLeft: 1 });
        break;
      case 'star_moves':
        sim.relocateStar();
        break;
      default:
        break;
    }
  },
};
