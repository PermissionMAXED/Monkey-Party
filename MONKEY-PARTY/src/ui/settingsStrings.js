/**
 * Localized strings for the reorganized settings screen (sections,
 * accessibility options, key rebinding flow).
 *
 * The dict is registered with the shared i18n module via extendDict when
 * that hook exists; `ts()` additionally resolves from the local dict so the
 * screen stays localized even before/without the hook.
 */

import * as i18n from './i18n.js';

export const SETTINGS_DICT = {
  /* ---------- sections ---------- */
  'settings.section.profile': { en: 'Profile', de: 'Profil' },
  'settings.section.audio': { en: 'Audio', de: 'Audio' },
  'settings.section.video': { en: 'Video', de: 'Video' },
  'settings.section.accessibility': { en: 'Accessibility', de: 'Barrierefreiheit' },
  'settings.section.language': { en: 'Language', de: 'Sprache' },
  'settings.section.controls': { en: 'Controls', de: 'Steuerung' },
  'settings.section.data': { en: 'Data', de: 'Daten' },

  /* ---------- video ---------- */
  'settings.fpsMeter': { en: 'FPS meter', de: 'FPS-Anzeige' },

  /* ---------- accessibility ---------- */
  'settings.reducedMotion': { en: 'Reduced motion', de: 'Reduzierte Bewegung' },
  'settings.screenShake': { en: 'Screen shake', de: 'Bildschirmwackeln' },
  'settings.textScale': { en: 'Text size', de: 'Textgröße' },
  'settings.textScale.100': { en: 'Normal (100%)', de: 'Normal (100%)' },
  'settings.textScale.115': { en: 'Large (115%)', de: 'Groß (115%)' },
  'settings.textScale.130': { en: 'Extra large (130%)', de: 'Extra groß (130%)' },
  'settings.colorblindMode': { en: 'Colorblind mode', de: 'Farbenblind-Modus' },
  'settings.colorblind.off': { en: 'Off', de: 'Aus' },
  'settings.colorblind.deuteranopia': { en: 'Deuteranopia (green-blind)', de: 'Deuteranopie (Grünblind)' },
  'settings.colorblind.protanopia': { en: 'Protanopia (red-blind)', de: 'Protanopie (Rotblind)' },
  'settings.colorblind.tritanopia': { en: 'Tritanopia (blue-blind)', de: 'Tritanopie (Blaublind)' },
  'settings.colorblindPreview': { en: 'Player colors', de: 'Spielerfarben' },

  /* ---------- controls / key rebinding ---------- */
  'settings.seatDevices': { en: 'Devices per seat', de: 'Geräte pro Platz' },
  'settings.rebind.title': { en: 'Rebind keys', de: 'Tasten neu belegen' },
  'settings.rebind.hint': {
    en: 'Click a key, then press the new key. Esc cancels.',
    de: 'Taste anklicken, dann neue Taste drücken. Esc bricht ab.',
  },
  'settings.rebind.pressKey': { en: 'Press a key…', de: 'Taste drücken…' },
  'settings.rebind.conflict': {
    en: 'Key already used for "{action}" on this device',
    de: 'Taste wird auf diesem Gerät schon für „{action}“ benutzt',
  },
  'settings.rebind.saved': { en: 'Key binding saved', de: 'Tastenbelegung gespeichert' },
  'settings.rebind.cancelled': { en: 'Rebind cancelled', de: 'Neubelegung abgebrochen' },
  'settings.rebind.reset': { en: 'Reset keys', de: 'Tasten zurücksetzen' },
  'settings.action.up': { en: 'Up', de: 'Hoch' },
  'settings.action.down': { en: 'Down', de: 'Runter' },
  'settings.action.left': { en: 'Left', de: 'Links' },
  'settings.action.right': { en: 'Right', de: 'Rechts' },
  'settings.action.a': { en: 'Action A', de: 'Aktion A' },
  'settings.action.b': { en: 'Action B', de: 'Aktion B' },
};

// Register with the shared dictionary when the hook exists (wired by the
// i18n owner); harmless no-op otherwise thanks to the local fallback below.
i18n.extendDict?.(SETTINGS_DICT);

/**
 * Translate like i18n.t(), falling back to the local settings dict for keys
 * the shared dictionary doesn't know (yet).
 */
export function ts(key, vars = null) {
  const shared = i18n.t(key, vars);
  if (shared !== key) return shared;
  const entry = SETTINGS_DICT[key];
  if (!entry) return key;
  const lang = i18n.getLang?.() ?? 'en';
  let text = entry[lang] ?? entry.en ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}
