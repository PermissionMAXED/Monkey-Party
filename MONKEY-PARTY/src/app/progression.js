/**
 * Progression & meta: fold a finished match into the local profile.
 *
 * applyMatchResults(profileStore, {state, gameOver, bonuses, localPids})
 * supersedes the legacy applyMatchToProfile (src/ui/victoryScene.js): it
 * performs the exact same lifetime-stat bumps and banana-bank fold, PLUS
 * the v2 meta (XP/level, per-character + per-minigame tallies, match
 * history, boardsPlayed, achievements).
 *
 * CLIENT-only code (Date.now for history timestamps is fine here; never
 * under shared/). Contract: called exactly ONCE per finished match.
 */

import { minigames as minigameRegistry } from '#shared/registries.js';
import { levelForXp, HISTORY_LIMIT } from './profileStore.js';
import { ACHIEVEMENTS } from '../ui/progression/achievements.js';

/* ------------------------------------------------------------------ */
/* Reward tuning (documented so balance passes can find it)            */
/* ------------------------------------------------------------------ */

/** XP: base per finished match + per golden banana + per minigame win. */
const XP_BASE = 50;
const XP_PER_BANANA = 15;
const XP_PER_MINIGAME_WIN = 5;
/** XP placement bonus for 1st/2nd/3rd; everyone else gets the OTHER value. */
const XP_PLACEMENT = [100, 50, 25];
const XP_PLACEMENT_OTHER = 10;

/** Banana-bank placement bonus: 1st +10, 2nd +5, everyone else +2. */
const BANANA_PLACEMENT = [10, 5];
const BANANA_PLACEMENT_OTHER = 2;

function placementXp(placement) {
  return XP_PLACEMENT[placement - 1] ?? XP_PLACEMENT_OTHER;
}

function placementBananas(placement) {
  return BANANA_PLACEMENT[placement - 1] ?? BANANA_PLACEMENT_OTHER;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function pidsOf(localPids) {
  if (localPids instanceof Map) return [...localPids.keys()];
  if (localPids instanceof Set) return [...localPids];
  if (Array.isArray(localPids)) return [...localPids];
  return [];
}

/** Sum of end-game bonus bananas per player id (from the 'bonus' events). */
function bonusBananasByPid(bonuses) {
  const out = {};
  for (const b of Array.isArray(bonuses) ? bonuses : []) {
    if (!b || typeof b.playerId !== 'string') continue;
    out[b.playerId] = (out[b.playerId] ?? 0) + Math.max(0, Number(b.bananas) || 1);
  }
  return out;
}

const EMPTY_RESULT = Object.freeze({
  xpGained: 0,
  leveledUpTo: null,
  newAchievements: Object.freeze([]),
  bananasEarned: 0,
});

/* ------------------------------------------------------------------ */
/* applyMatchResults                                                   */
/* ------------------------------------------------------------------ */

/**
 * Fold the finished match into the local profile and evaluate achievements.
 *
 * @param {*} profileStore The store from src/app/profileStore.js.
 * @param {{
 *   state: Object,               Final MatchState (deep-frozen snapshot).
 *   gameOver: {winner: string, ranking?: string[]},
 *   bonuses?: {playerId: string, bananas?: number}[],
 *   localPids: Map<string, number>|Set<string>|string[],
 * }} opts
 * @returns {{
 *   xpGained: number,
 *   leveledUpTo: number|null,   New level when the match leveled us up.
 *   newAchievements: Object[],  Achievement DEFS unlocked by this match.
 *   bananasEarned: number,      Golden bananas added to the bank.
 * }}
 */
export function applyMatchResults(profileStore, { state, gameOver, bonuses, localPids } = {}) {
  const pids = pidsOf(localPids).filter((pid) => state?.players?.[pid]);
  if (!profileStore || pids.length === 0) return { ...EMPTY_RESULT, newAchievements: [] };

  const profile = profileStore.get();
  const ranking = Array.isArray(gameOver?.ranking) && gameOver.ranking.length > 0
    ? gameOver.ranking
    : (state.turnOrder ?? []).slice();
  const winnerId = gameOver?.winner ?? ranking[0] ?? null;
  const historyIds = Array.isArray(state.minigameHistory) ? state.minigameHistory : [];
  const minigamesPlayed = historyIds.length;
  const bonusByPid = bonusBananasByPid(bonuses);
  const roundsPlayed = Math.max(0, Number(state.rules?.rounds ?? state.round) || 0);

  const placementOf = (pid) => {
    const idx = ranking.indexOf(pid);
    return idx === -1 ? ranking.length || 1 : idx + 1;
  };

  /* Per-minigame win attribution: the final state only knows each player's
   * TOTAL minigame wins (stats.minigameWins) and the list of played ids
   * (minigameHistory) - never which minigame a win came from. Attribution
   * is therefore only exact when a single distinct minigame was played;
   * otherwise per-id `plays` stays exact and `wins` is left untouched. */
  const distinctIds = [...new Set(historyIds)];
  const singleId = distinctIds.length === 1 ? distinctIds[0] : null;
  const allDuels = distinctIds.length > 0
    && distinctIds.every((id) => minigameRegistry.get(id)?.category === 'duel');

  /* Rival hard/wild bots present (for the giant_slayer achievement). */
  const localSet = new Set(pids);
  const hasHardBot = (state.turnOrder ?? []).some((pid) => {
    const p = state.players[pid];
    return p && !localSet.has(pid) && p.isBot && (p.difficulty === 'hard' || p.difficulty === 'wild');
  });

  /* ---------------- fold every LOCAL player in ---------------- */

  const stats = { ...profile.stats };
  const perCharacter = { ...profile.perCharacter };
  const perMinigame = { ...profile.perMinigame };
  const boardsPlayed = [...profile.boardsPlayed];
  let bananasEarned = 0;
  let xpGained = 0;
  const summaries = [];

  for (const pid of pids) {
    const p = state.players[pid];
    const won = winnerId === pid;
    const placement = placementOf(pid);
    const mgWins = p.stats?.minigameWins ?? 0;

    /* Lifetime stats: identical semantics to the legacy applyMatchToProfile. */
    stats.gamesPlayed += 1;
    if (won) stats.gamesWon += 1;
    stats.minigamesPlayed += minigamesPlayed;
    stats.minigamesWon += mgWins;
    stats.coinsEarned += Math.max(0, p.stats?.minigameCoins ?? 0) + Math.max(0, p.coins);
    stats.starsCollected += p.goldenBananas;
    stats.itemsUsed += p.stats?.itemsUsed ?? 0;

    /* Banana bank: the match's bananas + a placement bonus. */
    bananasEarned += p.goldenBananas + placementBananas(placement);

    /* XP award. */
    xpGained += XP_BASE
      + XP_PER_BANANA * p.goldenBananas
      + XP_PER_MINIGAME_WIN * mgWins
      + placementXp(placement);

    /* Per-character tally. */
    if (typeof p.characterId === 'string' && p.characterId.length > 0) {
      const tally = { ...(perCharacter[p.characterId] ?? { plays: 0, wins: 0 }) };
      tally.plays += 1;
      if (won) tally.wins += 1;
      perCharacter[p.characterId] = tally;
    }

    /* Per-minigame tally (see the attribution note above). */
    for (const id of historyIds) {
      const tally = { ...(perMinigame[id] ?? { plays: 0, wins: 0 }) };
      tally.plays += 1;
      perMinigame[id] = tally;
    }
    if (singleId && mgWins > 0) {
      perMinigame[singleId] = {
        ...perMinigame[singleId],
        wins: (perMinigame[singleId]?.wins ?? 0) + mgWins,
      };
    }

    /* Achievement summary for this seat. Star purchases are the only
     * non-bonus banana source, so "won without buying a star" is exactly
     * "every banana came from the end-game bonuses". */
    summaries.push({
      boardId: state.boardId ?? '',
      rounds: roundsPlayed,
      minigamesPlayed,
      localSeatCount: pids.length,
      placement,
      won,
      bananas: p.goldenBananas,
      coins: Math.max(0, p.coins),
      minigameWins: mgWins,
      itemsUsed: p.stats?.itemsUsed ?? 0,
      wonWithoutStar: won && p.goldenBananas - (bonusByPid[pid] ?? 0) <= 0,
      beatHardBot: won && hasHardBot,
      duelWon: allDuels && mgWins > 0,
    });
  }

  if (typeof state.boardId === 'string' && state.boardId.length > 0 && !boardsPlayed.includes(state.boardId)) {
    boardsPlayed.push(state.boardId);
  }

  /* ---------------- history entry (one per match) ---------------- */

  const bestLocal = summaries.reduce((a, b) => (b.placement < a.placement ? b : a), summaries[0]);
  const entry = {
    when: Date.now(), // client-only code: wall clock is allowed here
    boardId: state.boardId ?? '',
    rounds: roundsPlayed,
    players: ranking.map((pid) => {
      const p = state.players[pid];
      return {
        name: p?.name ?? pid,
        characterId: p?.characterId ?? null,
        bananas: p?.goldenBananas ?? 0,
        coins: Math.max(0, p?.coins ?? 0),
        isLocal: localSet.has(pid),
      };
    }),
    winnerName: state.players[winnerId]?.name ?? winnerId ?? '?',
    placement: bestLocal.placement,
  };
  const history = [entry, ...profile.history].slice(0, HISTORY_LIMIT);

  /* ---------------- achievements ---------------- */

  const draft = {
    ...profile,
    stats,
    goldenBananas: profile.goldenBananas + bananasEarned,
    xp: profile.xp + xpGained,
    perCharacter,
    perMinigame,
    history,
    boardsPlayed,
  };
  const unlocked = new Set(profile.achievements);
  const newAchievements = [];
  for (const def of ACHIEVEMENTS) {
    if (unlocked.has(def.id)) continue;
    let passed = false;
    for (const summary of summaries) {
      try {
        if (def.check(draft, summary)) {
          passed = true;
          break;
        }
      } catch (err) {
        console.warn(`[progression] achievement "${def.id}" check threw:`, err);
      }
    }
    if (passed) {
      unlocked.add(def.id);
      newAchievements.push(def);
    }
  }

  /* ---------------- persist + report ---------------- */

  const levelBefore = levelForXp(profile.xp);
  profileStore.set({
    stats,
    goldenBananas: draft.goldenBananas,
    xp: draft.xp,
    perCharacter,
    perMinigame,
    achievements: [...unlocked],
    history,
    boardsPlayed,
  });
  const levelAfter = levelForXp(profileStore.get().xp);

  return {
    xpGained,
    leveledUpTo: levelAfter > levelBefore ? levelAfter : null,
    newAchievements,
    bananasEarned,
  };
}

export default applyMatchResults;
