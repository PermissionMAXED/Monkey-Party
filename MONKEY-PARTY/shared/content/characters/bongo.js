/**
 * Bongo - mandrill, starter. Perk "drummer": finishing a minigame in the
 * top 2 pays +2 bonus coins (the crowd loves a drum solo).
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 * The rank is read from sim.state.minigame.results.ranking, which the sim
 * stores before paying out minigame coins (see shared/sim/match.js).
 */

/** Index of a player in a ranking whose entries may be ids or team arrays. */
function rankIndex(ranking, pid) {
  return ranking.findIndex((entry) => (Array.isArray(entry) ? entry.includes(pid) : entry === pid));
}

/** @type {import('../../types.js').CharacterDef} */
export default {
  id: 'bongo',
  name: 'Bongo',
  species: 'mandrill',
  blurb: {
    en: 'A rainbow-faced showman who drums his way onto every podium.',
    de: 'Ein Showaffe mit Regenbogengesicht, der sich auf jedes Podest trommelt.',
  },
  build: {
    scale: 1.3,
    furColor: '#4a5d23',
    faceColor: '#d94f30',
    bellyColor: '#c9b458',
    earStyle: 'small',
    tail: 'short',
    snout: 'long',
    brow: 'heavy',
    armLen: 1.1,
    potbelly: 0.35,
  },
  perk: {
    id: 'drummer',
    description: {
      en: 'Drummer: +2 coins when Bongo finishes a minigame 1st or 2nd.',
      de: 'Trommler: +2 Muenzen, wenn Bongo ein Minispiel als 1. oder 2. beendet.',
    },
    hooks: {
      /** +2 payout on a top-2 minigame finish. */
      onMinigameCoins(amount, ctx) {
        if (amount <= 0) return amount;
        const ranking = ctx.sim.state.minigame?.results?.ranking;
        if (!Array.isArray(ranking)) return amount;
        const idx = rankIndex(ranking, ctx.playerId);
        return idx >= 0 && idx <= 1 ? amount + 2 : amount;
      },
    },
  },
  voice: { pitch: 0.8, style: 'boom' },
  emotes: ['dance', 'flex', 'taunt'],
  unlock: { bananas: 0 },
};
