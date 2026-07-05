/**
 * Data-driven achievement catalog for the progression package.
 *
 * PURE data + pure checks: no DOM, no CSS, no i18n side effects - this
 * module is imported by src/app/progression.js (applyMatchResults) AND by
 * the achievements screen, and must stay Node-importable for tests.
 *
 * Each def:
 *   id       stable string id (stored in profile.achievements)
 *   name     {en, de}
 *   desc     {en, de}
 *   icon     emoji shown on the card
 *   check(profile, match)  -> boolean; `profile` is the ALREADY-UPDATED
 *            profile draft, `match` a per-local-player summary (may be
 *            null when re-evaluating outside a match):
 *            {boardId, rounds, minigamesPlayed, localSeatCount, placement,
 *             won, bananas, coins, minigameWins, itemsUsed,
 *             wonWithoutStar, beatHardBot, duelWon}
 *   progress?(profile) -> {cur, goal} for the locked-card progress hint
 *            (only for counter-style achievements).
 */

import { levelForXp } from '../../app/profileStore.js';

/** All 12 boards must appear in profile.boardsPlayed for 'globetrotter'. */
const BOARD_COUNT = 12;

/** Lifetime bananas earned = current bank + everything already spent. */
function bananasEarned(profile) {
  return (profile.goldenBananas ?? 0) + (profile.bananasSpent ?? 0);
}

/** @type {ReturnType<typeof Object.freeze>[]} */
export const ACHIEVEMENTS = [
  {
    id: 'first_party',
    name: { en: 'Party Animal', de: 'Partytier' },
    desc: { en: 'Finish your first party.', de: 'Beende deine erste Party.' },
    icon: '🎉',
    check: (p) => p.stats.gamesPlayed >= 1,
    progress: (p) => ({ cur: p.stats.gamesPlayed, goal: 1 }),
  },
  {
    id: 'first_win',
    name: { en: 'Top Banana', de: 'Oberbanane' },
    desc: { en: 'Win your first party.', de: 'Gewinne deine erste Party.' },
    icon: '🏆',
    check: (p) => p.stats.gamesWon >= 1,
    progress: (p) => ({ cur: p.stats.gamesWon, goal: 1 }),
  },
  {
    id: 'games_10',
    name: { en: 'Regular Guest', de: 'Stammgast' },
    desc: { en: 'Finish 10 parties.', de: 'Beende 10 Partys.' },
    icon: '🎪',
    check: (p) => p.stats.gamesPlayed >= 10,
    progress: (p) => ({ cur: p.stats.gamesPlayed, goal: 10 }),
  },
  {
    id: 'games_50',
    name: { en: 'Jungle Veteran', de: 'Dschungel-Veteran' },
    desc: { en: 'Finish 50 parties.', de: 'Beende 50 Partys.' },
    icon: '🌴',
    check: (p) => p.stats.gamesPlayed >= 50,
    progress: (p) => ({ cur: p.stats.gamesPlayed, goal: 50 }),
  },
  {
    id: 'wins_10',
    name: { en: 'Crowned Ape', de: 'Gekrönter Affe' },
    desc: { en: 'Win 10 parties.', de: 'Gewinne 10 Partys.' },
    icon: '👑',
    check: (p) => p.stats.gamesWon >= 10,
    progress: (p) => ({ cur: p.stats.gamesWon, goal: 10 }),
  },
  {
    id: 'pure_win',
    name: { en: 'Frugal Monkey', de: 'Sparsamer Affe' },
    desc: {
      en: 'Win a party without buying a single star.',
      de: 'Gewinne eine Party, ohne einen Stern zu kaufen.',
    },
    icon: '🧘',
    check: (_p, m) => m?.wonWithoutStar === true,
  },
  {
    id: 'mg_wins_10',
    name: { en: 'Minigame Menace', de: 'Minispiel-Schreck' },
    desc: { en: 'Win 10 minigames.', de: 'Gewinne 10 Minispiele.' },
    icon: '🎮',
    check: (p) => p.stats.minigamesWon >= 10,
    progress: (p) => ({ cur: p.stats.minigamesWon, goal: 10 }),
  },
  {
    id: 'mg_wins_50',
    name: { en: 'Arcade Legend', de: 'Arcade-Legende' },
    desc: { en: 'Win 50 minigames.', de: 'Gewinne 50 Minispiele.' },
    icon: '🕹️',
    check: (p) => p.stats.minigamesWon >= 50,
    progress: (p) => ({ cur: p.stats.minigamesWon, goal: 50 }),
  },
  {
    id: 'items_25',
    name: { en: 'Gadget Monkey', de: 'Gadget-Affe' },
    desc: { en: 'Use 25 items.', de: 'Benutze 25 Items.' },
    icon: '🎒',
    check: (p) => p.stats.itemsUsed >= 25,
    progress: (p) => ({ cur: p.stats.itemsUsed, goal: 25 }),
  },
  {
    id: 'globetrotter',
    name: { en: 'Globetrotter', de: 'Weltenbummler' },
    desc: { en: 'Play on all 12 boards.', de: 'Spiele auf allen 12 Brettern.' },
    icon: '🗺️',
    check: (p) => p.boardsPlayed.length >= BOARD_COUNT,
    progress: (p) => ({ cur: p.boardsPlayed.length, goal: BOARD_COUNT }),
  },
  {
    id: 'level_5',
    name: { en: 'Climbing the Canopy', de: 'Hoch hinaus' },
    desc: { en: 'Reach level 5.', de: 'Erreiche Level 5.' },
    icon: '⭐',
    check: (p) => levelForXp(p.xp) >= 5,
    progress: (p) => ({ cur: levelForXp(p.xp), goal: 5 }),
  },
  {
    id: 'level_10',
    name: { en: 'King of the Treetops', de: 'König der Wipfel' },
    desc: { en: 'Reach level 10.', de: 'Erreiche Level 10.' },
    icon: '🌟',
    check: (p) => levelForXp(p.xp) >= 10,
    progress: (p) => ({ cur: levelForXp(p.xp), goal: 10 }),
  },
  {
    id: 'bank_100',
    name: { en: 'Banana Banker', de: 'Bananen-Banker' },
    desc: { en: 'Bank 100 golden bananas (lifetime).', de: 'Sammle insgesamt 100 goldene Bananen.' },
    icon: '🍌',
    check: (p) => bananasEarned(p) >= 100,
    progress: (p) => ({ cur: bananasEarned(p), goal: 100 }),
  },
  {
    id: 'bank_500',
    name: { en: 'Banana Baron', de: 'Bananen-Baron' },
    desc: { en: 'Bank 500 golden bananas (lifetime).', de: 'Sammle insgesamt 500 goldene Bananen.' },
    icon: '💰',
    check: (p) => bananasEarned(p) >= 500,
    progress: (p) => ({ cur: bananasEarned(p), goal: 500 }),
  },
  {
    id: 'spender',
    name: { en: 'Boutique Shopper', de: 'Boutique-Shopper' },
    desc: { en: 'Spend 50 bananas on unlocks.', de: 'Gib 50 Bananen für Freischaltungen aus.' },
    icon: '🛍️',
    check: (p) => p.bananasSpent >= 50,
    progress: (p) => ({ cur: p.bananasSpent, goal: 50 }),
  },
  {
    id: 'giant_slayer',
    name: { en: 'Giant Slayer', de: 'Riesenbezwinger' },
    desc: {
      en: 'Win a party against a hard (or wild) bot.',
      de: 'Gewinne eine Party gegen einen schweren (oder wilden) Bot.',
    },
    icon: '🦾',
    check: (_p, m) => m?.beatHardBot === true,
  },
  {
    id: 'duelist',
    name: { en: 'Duelist', de: 'Duellant' },
    desc: { en: 'Win a duel minigame.', de: 'Gewinne ein Duell-Minispiel.' },
    icon: '⚔️',
    check: (_p, m) => m?.duelWon === true,
  },
  {
    id: 'couch_party',
    name: { en: 'Couch Party', de: 'Couch-Party' },
    desc: {
      en: 'Finish a party with 2+ local players.',
      de: 'Beende eine Party mit 2+ lokalen Spielern.',
    },
    icon: '🛋️',
    check: (_p, m) => (m?.localSeatCount ?? 0) >= 2,
  },
  {
    id: 'clean_sweep',
    name: { en: 'Clean Sweep', de: 'Klarer Durchmarsch' },
    desc: {
      en: 'Win every minigame in a party (3 or more played).',
      de: 'Gewinne jedes Minispiel einer Party (mindestens 3 gespielt).',
    },
    icon: '🧹',
    check: (_p, m) => (m?.minigamesPlayed ?? 0) >= 3 && (m?.minigameWins ?? 0) >= m.minigamesPlayed,
  },
  {
    id: 'marathon',
    name: { en: 'Marathon Monkey', de: 'Marathon-Affe' },
    desc: { en: 'Finish a 20+ round party.', de: 'Beende eine Party mit 20+ Runden.' },
    icon: '🏃',
    check: (_p, m) => (m?.rounds ?? 0) >= 20,
  },
  {
    id: 'star_collector',
    name: { en: 'Star Collector', de: 'Sternensammler' },
    desc: {
      en: 'Collect 25 golden bananas across all parties.',
      de: 'Sammle 25 goldene Bananen über alle Partys.',
    },
    icon: '✨',
    check: (p) => p.stats.starsCollected >= 25,
    progress: (p) => ({ cur: p.stats.starsCollected, goal: 25 }),
  },
  {
    id: 'coin_hoarder',
    name: { en: 'Coin Hoarder', de: 'Münzen-Hamsterer' },
    desc: { en: 'Earn 1000 coins (lifetime).', de: 'Verdiene insgesamt 1000 Münzen.' },
    icon: '🪙',
    check: (p) => p.stats.coinsEarned >= 1000,
    progress: (p) => ({ cur: p.stats.coinsEarned, goal: 1000 }),
  },
];

/**
 * @param {string} id
 * @returns {Object|null}
 */
export function getAchievement(id) {
  return ACHIEVEMENTS.find((a) => a.id === id) ?? null;
}

export default ACHIEVEMENTS;
