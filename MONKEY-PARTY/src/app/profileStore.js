/**
 * localStorage-backed player profile store: name, lifetime stats, total
 * golden bananas, unlocked cosmetics/characters.
 *
 * Uses the generic persistent store from settingsStore.js (which already
 * guards for the absence of localStorage).
 */

import { createLocalStore } from './settingsStore.js';

const STORAGE_KEY = 'monkey-party:profile:v1';
const MAX_NAME_LENGTH = 24;

export const DEFAULT_PROFILE = Object.freeze({
  name: 'Monkey',
  /** Lifetime stats across all matches. */
  stats: Object.freeze({
    gamesPlayed: 0,
    gamesWon: 0,
    minigamesPlayed: 0,
    minigamesWon: 0,
    coinsEarned: 0,
    starsCollected: 0,
  }),
  /** Total golden bananas earned (unlock currency). */
  goldenBananas: 0,
  /** Cosmetic ids the player has unlocked. */
  unlockedCosmetics: [],
  /** Character ids the player has unlocked (starters are implicit via unlock.bananas === 0). */
  unlockedCharacters: [],
});

function asNonNegativeInt(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

function asStringArray(v) {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((x) => typeof x === 'string' && x.length > 0))];
}

function sanitizeProfile(raw) {
  const d = DEFAULT_PROFILE;
  const rawStats = raw.stats && typeof raw.stats === 'object' ? raw.stats : {};
  const stats = {};
  for (const key of Object.keys(d.stats)) {
    stats[key] = asNonNegativeInt(rawStats[key], d.stats[key]);
  }
  const name = typeof raw.name === 'string' && raw.name.trim().length > 0
    ? raw.name.trim().slice(0, MAX_NAME_LENGTH)
    : d.name;
  return {
    name,
    stats,
    goldenBananas: asNonNegativeInt(raw.goldenBananas, d.goldenBananas),
    unlockedCosmetics: asStringArray(raw.unlockedCosmetics),
    unlockedCharacters: asStringArray(raw.unlockedCharacters),
  };
}

/** The app-wide profile store singleton (get/set/subscribe). */
export const profileStore = createLocalStore(STORAGE_KEY, DEFAULT_PROFILE, sanitizeProfile);
