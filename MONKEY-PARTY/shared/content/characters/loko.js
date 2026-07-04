/**
 * Loko - howler monkey, unlock 5 bananas. Perk "loud": the first rival he
 * struts past each round is startled by a deafening taunt and drops 1 coin
 * (cap: once per round).
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 * Once-per-round bookkeeping lives in a permanent marker entry in
 * player.effects (JSON-safe, snapshot-serializable, no registered hooks).
 */

const MARKER_ID = 'loko_loud_used';

/** @type {import('../../types.js').CharacterDef} */
export default {
  id: 'loko',
  name: 'Loko',
  species: 'howler',
  blurb: {
    en: 'You hear him three boards away. Standing near him costs money.',
    de: 'Man hoert ihn drei Bretter weit. Neben ihm zu stehen kostet Geld.',
  },
  build: {
    scale: 1.2,
    furColor: '#7a2e1d',
    faceColor: '#3d2418',
    bellyColor: '#8f4a2c',
    earStyle: 'round',
    tail: 'thick',
    snout: 'wide',
    brow: 'heavy',
    armLen: 1.05,
    potbelly: 0.4,
  },
  perk: {
    id: 'loud',
    description: {
      en: 'Loud: the first rival Loko passes each round drops 1 coin.',
      de: 'Laut: Der erste Rivale, an dem Loko pro Runde vorbeizieht, verliert 1 Muenze.',
    },
    hooks: {
      /** Taunt the first co-located rival per round out of 1 coin. */
      onPassNode(value, ctx) {
        const { sim, playerId, node } = ctx;
        const me = sim.state.players[playerId];
        const round = sim.state.round;
        let marker = me.effects.find((e) => e.id === MARKER_ID);
        if (marker && marker.data?.round === round) return value; // already howled this round
        const victim = sim.state.turnOrder
          .map((pid) => sim.state.players[pid])
          .find((p) => p.id !== playerId && p.node === node && p.coins > 0);
        if (!victim) return value;
        if (marker) {
          marker.data = { round };
        } else {
          marker = { id: MARKER_ID, turnsLeft: -1, data: { round } };
          me.effects.push(marker);
        }
        sim.emit('item', { kind: 'perk_loud', playerId, targetId: victim.id, node });
        sim.coins(victim.id, -1, 'perk:loud_taunt');
        return value;
      },
    },
  },
  voice: { pitch: 0.65, style: 'howl' },
  emotes: ['taunt', 'laugh', 'flex'],
  unlock: { bananas: 5 },
};
