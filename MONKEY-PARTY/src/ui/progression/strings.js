/**
 * Progression package strings ('prog.*' plus the stats-screen and
 * character-select additions that ship with this package). Merged into
 * the shared UI dictionary via i18n.extendDict at import time - same
 * convention as src/ui/help/strings.js. The namespace import + optional
 * call keeps this module loadable against an i18n build that predates
 * extendDict.
 */

import * as i18n from '../i18n.js';

export const PROG_DICT = {
  /* ---------- main-menu entries ---------- */
  'prog.menu.achievements': { en: 'Achievements', de: 'Erfolge' },
  'prog.menu.history': { en: 'Match History', de: 'Spielverlauf' },

  /* ---------- achievements screen ---------- */
  'prog.ach.title': { en: 'Achievements', de: 'Erfolge' },
  'prog.ach.count': { en: '{n} / {total} unlocked', de: '{n} / {total} freigeschaltet' },

  /* ---------- history screen ---------- */
  'prog.hist.title': { en: 'Match History', de: 'Spielverlauf' },
  'prog.hist.empty': {
    en: 'No matches yet — go throw a party!',
    de: 'Noch keine Spiele — schmeiß eine Party!',
  },
  'prog.hist.rounds': { en: '{n} rounds', de: '{n} Runden' },
  'prog.hist.winner': { en: 'Winner: {name}', de: 'Sieger: {name}' },
  'prog.hist.placement': { en: 'You finished #{n}', de: 'Du wurdest #{n}' },
  'prog.hist.unknownBoard': { en: 'Unknown board', de: 'Unbekanntes Brett' },

  /* ---------- stats screen (level/XP + meta tables) ---------- */
  'stats.level': { en: 'Level {n}', de: 'Level {n}' },
  'stats.xpProgress': { en: '{cur} / {next} XP', de: '{cur} / {next} XP' },
  'stats.xpGained': { en: '+{n} XP', de: '+{n} XP' },
  'stats.levelUp': { en: 'LEVEL UP! Level {n}', de: 'LEVEL-UP! Level {n}' },
  'stats.achievementUnlocked': { en: 'Achievement unlocked!', de: 'Erfolg freigeschaltet!' },
  'stats.perCharacter': { en: 'Characters', de: 'Charaktere' },
  'stats.perMinigame': { en: 'Top Minigames', de: 'Top-Minispiele' },
  'stats.col.name': { en: 'Name', de: 'Name' },
  'stats.col.plays': { en: 'Plays', de: 'Spiele' },
  'stats.col.wins': { en: 'Wins', de: 'Siege' },

  /* ---------- character select (banana economy) ---------- */
  'char.bank': { en: 'Banana Bank', de: 'Bananen-Konto' },
  'char.filter.all': { en: 'All', de: 'Alle' },
  'char.filter.owned': { en: 'Owned', de: 'Freigeschaltet' },
  'char.filter.locked': { en: 'Locked', de: 'Gesperrt' },
  'char.filterEmpty': { en: 'Nothing here yet.', de: 'Hier ist noch nichts.' },
};

i18n.extendDict?.(PROG_DICT);

export default PROG_DICT;
