/**
 * Localized strings for the in-match UX package (pause menu, in-match
 * chat, latency chip, play-again offer).
 *
 * The dictionary is registered through `i18n.extendDict?.(dict)` when the
 * i18n module supports dictionary extension (same convention as
 * netStrings.js). tm() additionally falls back to this local dictionary,
 * so these strings stay localized even when extendDict is unavailable
 * (i18n.t() returns unknown keys verbatim).
 */

import * as i18n from './i18n.js';

/** key -> {en, de} (same shape as the main i18n DICT). */
export const MATCH_DICT = {
  /* ---------- pause menu ---------- */
  'match.pause.title': { en: 'Paused', de: 'Pause' },
  'match.pause.resume': { en: 'Resume', de: 'Weiterspielen' },
  'match.pause.settings': { en: 'Quick Settings', de: 'Schnelleinstellungen' },
  'match.pause.howToPlay': { en: 'How to Play', de: 'So geht’s' },
  'match.pause.quit': { en: 'Quit to Menu', de: 'Zurück zum Menü' },
  'match.pause.quitConfirm': { en: 'Really quit?', de: 'Wirklich verlassen?' },
  'match.pause.onlineNote': {
    en: 'The game continues in online matches — the server keeps playing while you are paused.',
    de: 'In Online-Partien läuft das Spiel weiter — der Server spielt weiter, während du pausierst.',
  },
  'match.pause.shake': { en: 'Screen shake', de: 'Bildschirmwackeln' },

  /* ---------- HUD extras ---------- */
  'match.hud.pause': { en: 'Pause menu (Esc)', de: 'Pausenmenü (Esc)' },
  'match.hud.latency': { en: 'Connection latency', de: 'Verbindungslatenz' },

  /* ---------- in-match chat ---------- */
  'match.chat.title': { en: 'Chat', de: 'Chat' },
  'match.chat.open': { en: 'Open chat (Enter)', de: 'Chat öffnen (Enter)' },
  'match.chat.placeholder': { en: 'Message…', de: 'Nachricht…' },
  'match.chat.send': { en: 'Send', de: 'Senden' },
  'match.chat.system': { en: 'System', de: 'System' },

  /* ---------- play again / rematch offer ---------- */
  'match.again.title': { en: 'One more round?', de: 'Noch eine Runde?' },
  'match.again.play': { en: 'Play Again', de: 'Nochmal spielen' },
  'match.again.lobby': { en: 'Back to Lobby', de: 'Zurück zur Lobby' },
  'match.again.lobbyHint': {
    en: 'The lobby reopens for a rematch after the match ends.',
    de: 'Die Lobby öffnet nach dem Spiel wieder für ein Rematch.',
  },
  'match.again.failed': {
    en: 'Could not restart the match.',
    de: 'Das Spiel konnte nicht neu gestartet werden.',
  },
};

// Register with the main dictionary when the i18n module supports it
// (optional: tm() below works either way).
i18n.extendDict?.(MATCH_DICT);

/**
 * Translate a match.* key with {var} interpolation. Resolution order:
 *  1. the main i18n dictionary (covers the extendDict path),
 *  2. the local MATCH_DICT fallback,
 *  3. the key itself (visible during dev, never crashes).
 *
 * @param {string} key
 * @param {Object<string, *>} [vars]
 * @returns {string}
 */
export function tm(key, vars = null) {
  const viaMain = i18n.t(key, vars);
  if (viaMain !== key) return viaMain;
  const entry = MATCH_DICT[key];
  if (!entry) return key;
  const lang = i18n.getLang?.() ?? 'en';
  let text = entry[lang] ?? entry.en;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

export default tm;
