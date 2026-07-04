/**
 * Gibbs - gibbon, starter. Perk "swinger": board toll gates cost him
 * nothing - the toll is covered the moment he lands on a toll event node
 * (he simply swings over the gate).
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 * Toll events (gorilla_palace 'toll_gate', neon_monkey_city 'rooftop_toll')
 * charge 5 coins in their handlers during the field phase. onPassNode with
 * stepsLeft 0 fires just before that, so granting the fee there nets the
 * toll to zero and Gibbs is never marched back for being broke.
 */

const TOLL_FEE = 5;

/** @type {import('../../types.js').CharacterDef} */
export default {
  id: 'gibbs',
  name: 'Gibbs',
  species: 'gibbon',
  blurb: {
    en: 'Arms like vines. Gates, tolls and bouncers mean nothing up high.',
    de: 'Arme wie Lianen. Tore, Maut und Tuersteher zaehlen da oben nicht.',
  },
  build: {
    scale: 1.1,
    furColor: '#1f1f24',
    faceColor: '#e8d9c4',
    bellyColor: '#3a3a40',
    earStyle: 'small',
    tail: 'none',
    snout: 'flat',
    brow: 'flat',
    armLen: 1.6,
    potbelly: 0,
  },
  perk: {
    id: 'swinger',
    description: {
      en: 'Swinger: toll gates cost Gibbs 0 coins.',
      de: 'Schwinger: Zolltore kosten Gibbs 0 Muenzen.',
    },
    hooks: {
      /** Landing on a toll event node: cover the fee before it is charged. */
      onPassNode(value, ctx) {
        if (ctx.stepsLeft !== 0) return value; // pass-through never charges a toll
        const { sim, playerId, node } = ctx;
        if (!sim.state.rules.randomEvents) return value; // events (and tolls) are off
        const nodeDef = sim.board.nodes.find((n) => n.id === node);
        if (nodeDef?.type !== 'event' || !String(nodeDef.event ?? '').includes('toll')) return value;
        sim.coins(playerId, TOLL_FEE, 'perk:swinger');
        return value;
      },
    },
  },
  voice: { pitch: 1.1, style: 'whoop' },
  emotes: ['dance', 'taunt', 'flex'],
  unlock: { bananas: 0 },
};
