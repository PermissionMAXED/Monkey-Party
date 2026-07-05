/**
 * Solo Modes strings (Tournament cups + Minigame Practice), all under the
 * 'tour.' namespace. Merged into the shared UI dictionary via
 * i18n.extendDict at import time; the namespace import + optional call
 * keeps this module loadable against an i18n build without extendDict
 * (same convention as src/ui/help/strings.js).
 */

import * as i18n from '../i18n.js';

export const TOURNAMENT_DICT = {
  /* ---------- main-menu entries ---------- */
  'tour.menu': { en: 'Tournament', de: 'Turnier' },
  'tour.practiceMenu': { en: 'Minigame Practice', de: 'Minispiel-Training' },

  /* ---------- cup select ---------- */
  'tour.title': { en: 'Tournament', de: 'Turnier' },
  'tour.subtitle': {
    en: 'Race three boards per cup against three rivals. Win the cup to unlock the next one!',
    de: 'Fahre drei Bretter pro Cup gegen drei Rivalen. Gewinn den Cup und schalte den nächsten frei!',
  },
  'tour.locked': { en: 'Locked', de: 'Gesperrt' },
  'tour.lockedHint': { en: 'Win the previous cup (1st place) to unlock.', de: 'Gewinn den vorherigen Cup (1. Platz) zum Freischalten.' },
  'tour.wonBadge': { en: 'Cup won!', de: 'Cup gewonnen!' },
  'tour.bestPlace': { en: 'Best: {place}', de: 'Bestwert: {place}' },
  'tour.inProgress': { en: 'In progress - leg {n}/{total}', de: 'Läuft - Etappe {n}/{total}' },
  'tour.legCount': { en: '{n} boards', de: '{n} Bretter' },
  'tour.roundsPerLeg': { en: '{n} rounds per board', de: '{n} Runden pro Brett' },
  'tour.bots': { en: '{difficulty} rivals', de: '{difficulty} Rivalen' },
  'tour.start': { en: 'Start Cup', de: 'Cup starten' },
  'tour.continue': { en: 'Continue Cup', de: 'Cup fortsetzen' },
  'tour.restartConfirm': {
    en: 'A cup is already in progress. Abandon it and start this one?',
    de: 'Ein Cup läuft bereits. Abbrechen und diesen starten?',
  },
  'tour.chooseChar': { en: 'Your monkey', de: 'Dein Affe' },
  'tour.playerName': { en: 'Racing as {name}', de: 'Du spielst als {name}' },

  /* ---------- standings / between legs ---------- */
  'tour.standings': { en: 'Cup Standings', de: 'Cup-Zwischenstand' },
  'tour.afterLeg': { en: 'After leg {n} of {total}', de: 'Nach Etappe {n} von {total}' },
  'tour.col.place': { en: '#', de: '#' },
  'tour.col.player': { en: 'Player', de: 'Spieler' },
  'tour.col.points': { en: 'Points', de: 'Punkte' },
  'tour.col.bananas': { en: 'Bananas', de: 'Bananen' },
  'tour.col.coins': { en: 'Coins', de: 'Münzen' },
  'tour.col.wins': { en: 'Wins', de: 'Siege' },
  'tour.nextLeg': { en: 'Next up: leg {n} of {total}', de: 'Als Nächstes: Etappe {n} von {total}' },
  'tour.nextRace': { en: 'Next race!', de: 'Nächstes Rennen!' },
  'tour.firstRace': { en: 'To the first race!', de: 'Zum ersten Rennen!' },
  'tour.resumeHint': {
    en: 'Quitting a race mid-way does not record it - the cup resumes at the same leg.',
    de: 'Ein abgebrochenes Rennen wird nicht gewertet - der Cup geht bei derselben Etappe weiter.',
  },
  'tour.abandon': { en: 'Abandon cup', de: 'Cup aufgeben' },
  'tour.abandonConfirm': {
    en: 'Really abandon this cup? Progress in it is lost.',
    de: 'Diesen Cup wirklich aufgeben? Der Fortschritt darin geht verloren.',
  },
  'tour.pointsHint': {
    en: 'Cup points: 10 / 7 / 4 / 2 by placement. Ties break on golden bananas, then coins.',
    de: 'Cup-Punkte: 10 / 7 / 4 / 2 nach Platzierung. Gleichstand entscheidet über goldene Bananen, dann Münzen.',
  },

  /* ---------- cup finished ---------- */
  'tour.cupDone': { en: 'Cup complete!', de: 'Cup abgeschlossen!' },
  'tour.champion': { en: '{name} wins the {cup}!', de: '{name} gewinnt den {cup}!' },
  'tour.unlockNext': { en: 'Next cup unlocked!', de: 'Nächster Cup freigeschaltet!' },
  'tour.noUnlock': {
    en: 'Only a 1st place unlocks the next cup - try again!',
    de: 'Nur ein 1. Platz schaltet den nächsten Cup frei - versuch es nochmal!',
  },
  'tour.collect': { en: 'Continue', de: 'Weiter' },

  /* ---------- practice ---------- */
  'prac.title': { en: 'Minigame Practice', de: 'Minispiel-Training' },
  'prac.subtitle': {
    en: 'Try any minigame on its own - no stakes, no progression, just practice.',
    de: 'Probiere jedes Minispiel einzeln aus - kein Risiko, kein Fortschritt, nur Training.',
  },
  'prac.search': { en: 'Search minigames…', de: 'Minispiele suchen…' },
  'prac.all': { en: 'All', de: 'Alle' },
  'prac.players': { en: '{min}-{max} players', de: '{min}-{max} Spieler' },
  'prac.playersExact': { en: '{n} players', de: '{n} Spieler' },
  'prac.duration': { en: '~{n}s', de: '~{n}s' },
  'prac.empty': { en: 'No minigames match your search.', de: 'Keine Minispiele passen zu deiner Suche.' },
  'prac.none': {
    en: 'No minigames are registered - is the content package loaded?',
    de: 'Keine Minispiele registriert - ist das Content-Paket geladen?',
  },
  'prac.setupTitle': { en: 'Practice setup', de: 'Trainings-Setup' },
  'prac.botCount': { en: 'Bots', de: 'Bots' },
  'prac.botDifficulty': { en: 'Bot difficulty', de: 'Bot-Schwierigkeit' },
  'prac.play': { en: 'Play!', de: 'Spielen!' },
  'prac.running': { en: 'Practice: {name}', de: 'Training: {name}' },
  'prac.quitRun': { en: 'Quit practice', de: 'Training beenden' },
  'prac.results': { en: 'Practice Results', de: 'Trainings-Ergebnis' },
  'prac.replay': { en: 'Replay (new seed)', de: 'Nochmal (neuer Seed)' },
  'prac.another': { en: 'Choose another', de: 'Anderes wählen' },
  'prac.toMenu': { en: 'Back to Menu', de: 'Zurück zum Menü' },
  'prac.category.ffa': { en: 'Free-for-all', de: 'Jeder gegen jeden' },
  'prac.category.2v2': { en: '2 vs 2', de: '2 gegen 2' },
  'prac.category.1v3': { en: '1 vs 3', de: '1 gegen 3' },
  'prac.category.team': { en: 'Team', de: 'Team' },
  'prac.category.duel': { en: 'Duel', de: 'Duell' },
  'prac.category.boss': { en: 'Boss', de: 'Boss' },
};

i18n.extendDict?.(TOURNAMENT_DICT);

export default TOURNAMENT_DICT;
