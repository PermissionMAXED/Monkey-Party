/**
 * Rilla - gorilla, starter. Perk "thick_fur": the first trap that hits her
 * each round (placed item trap OR built-in board trap) is blocked.
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 * The once-per-round bookkeeping lives in a permanent marker entry inside
 * player.effects (JSON-safe, snapshot-serializable, no registered hooks).
 */

const MARKER_ID = 'rilla_thick_fur_used';

/** @type {import('../../types.js').CharacterDef} */
export default {
  id: 'rilla',
  name: 'Rilla',
  species: 'gorilla',
  blurb: {
    en: 'A gentle mountain of muscle. Traps barely tickle her.',
    de: 'Ein sanfter Berg aus Muskeln. Fallen kitzeln sie hoechstens.',
  },
  build: {
    scale: 1.6,
    furColor: '#3b3b45',
    faceColor: '#6b6672',
    bellyColor: '#55505c',
    earStyle: 'small',
    tail: 'none',
    snout: 'wide',
    brow: 'heavy',
    armLen: 1.25,
    potbelly: 0.55,
  },
  perk: {
    id: 'thick_fur',
    description: {
      en: 'Thick Fur: the first trap to hit Rilla each round is blocked.',
      de: 'Dickes Fell: Die erste Falle, die Rilla pro Runde trifft, wird geblockt.',
    },
    hooks: {
      /** Cancel the first trap per round; later traps pass through. */
      onTrapTriggered(info, ctx) {
        if (!info || info.cancelled) return info;
        const player = ctx.sim.state.players[ctx.playerId];
        const round = ctx.sim.state.round;
        let marker = player.effects.find((e) => e.id === MARKER_ID);
        if (marker && marker.data?.round === round) return info; // already spent this round
        if (marker) {
          marker.data = { round };
        } else {
          marker = { id: MARKER_ID, turnsLeft: -1, data: { round } };
          player.effects.push(marker);
        }
        return { ...info, cancelled: true };
      },
    },
  },
  voice: { pitch: 0.6, style: 'grunt' },
  emotes: ['flex', 'taunt', 'facepalm'],
  unlock: { bananas: 0 },
};
