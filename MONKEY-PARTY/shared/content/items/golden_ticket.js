/**
 * Golden Ticket - epic: teleport straight to the star node (and get the
 * purchase prompt right away if you can afford the star).
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 */

/** @type {import('../../types.js').ItemDef} */
export default {
  id: 'golden_ticket',
  name: { en: 'Golden Ticket', de: 'Goldenes Ticket' },
  description: {
    en: 'First class! Teleport directly to the golden banana star.',
    de: 'Erste Klasse! Teleportiere dich direkt zum goldenen Bananenstern.',
  },
  price: 25,
  rarity: 'epic',
  phase: 'preRoll',
  target: 'none',
  competitiveSafe: true,
  icon: { bg: '#a16207', glyph: 'ticket', fg: '#fef08a' },
  effect(sim, userId) {
    const starNode = sim.state.board.starNode;
    sim.teleport(userId, starNode);
    sim.emit('star', { kind: 'ticket_arrival', playerId: userId, node: starNode });
    sim.promptStar(userId); // buyStar prompt when affordable
  },
};
