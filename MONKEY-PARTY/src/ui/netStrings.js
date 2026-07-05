/**
 * Localized strings for the online-robustness UI (netStatus banner, lobby
 * connection dots, copy-code button, rematch notice).
 *
 * The dictionary is registered through `i18n.extendDict?.(dict)` when the
 * i18n module supports dictionary extension. tNet() additionally falls
 * back to this local dictionary, so these strings stay localized even when
 * extendDict is unavailable (i18n.t() returns unknown keys verbatim).
 */

import * as i18n from './i18n.js';

/** key -> {en, de} (same shape as the main i18n DICT). */
export const NET_DICT = {
  /* ---------- connection status banner ---------- */
  'net.reconnecting': { en: 'Reconnecting… (attempt {n})', de: 'Verbinde neu… (Versuch {n})' },
  'net.reconnectingShort': { en: 'Reconnecting…', de: 'Verbinde neu…' },
  'net.reconnectFailed': { en: 'Connection lost — retrying failed', de: 'Verbindung verloren — Wiederverbinden fehlgeschlagen' },
  'net.retry': { en: 'Retry', de: 'Erneut versuchen' },
  'net.versionMismatch': {
    en: 'Version mismatch — client and server speak different protocol versions. Please reload the page.',
    de: 'Versionskonflikt — Client und Server nutzen unterschiedliche Protokollversionen. Bitte Seite neu laden.',
  },
  'net.fatal': { en: 'Connection error: {msg}', de: 'Verbindungsfehler: {msg}' },

  /* ---------- lobby connection quality dots ---------- */
  'net.conn.good': { en: 'Connected', de: 'Verbunden' },
  'net.conn.warn': { en: 'Connected (high latency: {ms}ms)', de: 'Verbunden (hohe Latenz: {ms}ms)' },
  'net.conn.bad': { en: 'Disconnected — a bot covers this seat until they return', de: 'Getrennt — ein Bot übernimmt den Platz bis zur Rückkehr' },

  /* ---------- lobby extras ---------- */
  'net.copyCode': { en: 'Copy code', de: 'Code kopieren' },
  'net.codeCopied': { en: 'Lobby code copied!', de: 'Lobby-Code kopiert!' },
  'net.copyFailed': { en: 'Could not copy — code: {code}', de: 'Kopieren fehlgeschlagen — Code: {code}' },
  'net.preset': { en: 'Preset: {name}', de: 'Vorlage: {name}' },
  'net.presetCustom': { en: 'Custom', de: 'Eigene' },
  'net.rematch': { en: 'Lobby reopened — ready up for a rematch!', de: 'Lobby wieder offen — bereit machen fürs Rematch!' },
  'net.system': { en: 'System', de: 'System' },
};

// Register with the main dictionary when the i18n module supports it
// (optional: tNet() below works either way).
i18n.extendDict?.(NET_DICT);

/**
 * Translate a net.* key with {var} interpolation. Resolution order:
 *  1. the main i18n dictionary (covers the extendDict path),
 *  2. the local NET_DICT fallback,
 *  3. the key itself (visible during dev, never crashes).
 *
 * @param {string} key
 * @param {Object<string, *>} [vars]
 * @returns {string}
 */
export function tNet(key, vars = null) {
  const viaMain = i18n.t(key, vars);
  if (viaMain !== key) return viaMain;
  const entry = NET_DICT[key];
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

export default tNet;
