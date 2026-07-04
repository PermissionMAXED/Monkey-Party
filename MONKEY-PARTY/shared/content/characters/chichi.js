/**
 * Chichi - macaque, starter. Perk "hot_springs": +1 coin at the start of
 * each of her turns (a warm soak keeps the wallet cozy).
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 */

/** @type {import('../../types.js').CharacterDef} */
export default {
  id: 'chichi',
  name: 'Chichi',
  species: 'macaque',
  blurb: {
    en: 'A snow-monkey spa regular who starts every turn refreshed.',
    de: 'Schneeaffen-Stammgast im Spa, startet jede Runde erfrischt.',
  },
  build: {
    scale: 0.95,
    furColor: '#a08561',
    faceColor: '#e26d5c',
    bellyColor: '#cbb695',
    earStyle: 'round',
    tail: 'short',
    snout: 'short',
    brow: 'soft',
    armLen: 1.0,
    potbelly: 0.3,
  },
  perk: {
    id: 'hot_springs',
    description: {
      en: 'Hot Springs: Chichi gains +1 coin at the start of her turn.',
      de: 'Heisse Quellen: Chichi erhaelt +1 Muenze zu Beginn ihres Zugs.',
    },
    hooks: {
      /** Notification hook: grant the turn-start coin. */
      onTurnStart(value, ctx) {
        ctx.sim.coins(ctx.playerId, 1, 'perk:hot_springs');
        return value;
      },
    },
  },
  voice: { pitch: 1.0, style: 'chatter' },
  emotes: ['laugh', 'cry', 'dance'],
  unlock: { bananas: 0 },
};
