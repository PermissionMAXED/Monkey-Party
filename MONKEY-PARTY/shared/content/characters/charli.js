/**
 * Charli - chimpanzee, unlock 50 bananas. Perk "gambler": bad gambles get
 * a second chance - Chaos Box coin losses and casino stakes he loses are
 * rerolled once (seeded sim RNG), keeping the better outcome.
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 * Chaos Box losses arrive with reason 'chaos_box'. Casino losses come from
 * board event handlers (default reason 'helper') while Charli stands on a
 * casino event node, so the node is checked to scope the reroll.
 */

/** @type {import('../../types.js').CharacterDef} */
export default {
  id: 'charli',
  name: 'Charli',
  species: 'chimpanzee',
  blurb: {
    en: 'A card shark in monkey fur. The house never quite wins against him.',
    de: 'Ein Zocker im Affenpelz. Das Haus gewinnt gegen ihn nie so richtig.',
  },
  build: {
    scale: 1.15,
    furColor: '#5a4632',
    faceColor: '#c9a186',
    bellyColor: '#7a6248',
    earStyle: 'big',
    tail: 'none',
    snout: 'wide',
    brow: 'heavy',
    armLen: 1.2,
    potbelly: 0.3,
  },
  perk: {
    id: 'gambler',
    description: {
      en: 'Gambler: lost chaos/casino gambles are rerolled once - keep the better result.',
      de: 'Zocker: Verlorene Chaos-/Casino-Wetten werden einmal neu gewuerfelt - das bessere Ergebnis zaehlt.',
    },
    hooks: {
      /** 50% of gamble losses fizzle to 0 (a reroll that keeps the better side). */
      onCoinsLost(loss, ctx) {
        if (loss <= 0) return loss;
        const { sim, playerId, reason } = ctx;
        const isChaos = reason === 'chaos_box';
        const node = sim.board.nodes.find((n) => n.id === sim.state.players[playerId].node);
        const isCasino = reason === 'helper' && String(node?.event ?? '').includes('casino');
        if (!isChaos && !isCasino) return loss;
        if (sim.rng.next() < 0.5) {
          sim.emit('item', { kind: 'perk_gambler', playerId, saved: loss });
          return 0;
        }
        return loss;
      },
    },
  },
  voice: { pitch: 0.9, style: 'hoot' },
  emotes: ['taunt', 'laugh', 'dance'],
  unlock: { bananas: 50 },
};
