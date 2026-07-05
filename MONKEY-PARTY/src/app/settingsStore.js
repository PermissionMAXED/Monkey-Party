/**
 * localStorage-backed settings store.
 *
 * Guards for the absence of localStorage (SSR, tests, privacy modes): the
 * store then works in-memory only.
 */

const STORAGE_KEY = 'monkey-party:settings:v1';

const QUALITY_LEVELS = ['low', 'med', 'high'];
const LANGUAGES = ['en', 'de'];
const TEXT_SCALES = [1, 1.15, 1.3];
const COLORBLIND_MODES = ['off', 'deuteranopia', 'protanopia', 'tritanopia'];
/** Keyboard devices that accept per-action key overrides (see engine/input.js). */
const KEY_BINDING_DEVICES = ['kb1', 'kb2', 'kb3'];
const KEY_BINDING_ACTIONS = ['up', 'down', 'left', 'right', 'a', 'b'];
/** KeyboardEvent.code values are plain ASCII words ('KeyW', 'ArrowUp', ...). */
const KEY_CODE_RE = /^[A-Za-z0-9]{1,32}$/;

export const DEFAULT_SETTINGS = Object.freeze({
  masterVolume: 0.8,
  musicVolume: 0.7,
  sfxVolume: 0.8,
  quality: 'med',
  /** Legacy boolean; kept in sync with colorblindMode ('off' <-> false). */
  colorblind: false,
  /** 'off' | 'deuteranopia' | 'protanopia' | 'tritanopia' */
  colorblindMode: 'off',
  language: 'en',
  reducedMotion: false,
  screenShake: true,
  /** UI text scale multiplier: 1 | 1.15 | 1.3 */
  textScale: 1,
  fpsMeter: false,
  /** seat index -> input device id, e.g. { 0: 'keyboard:wasd', 1: 'gamepad:0' } */
  seatBindings: {},
  /** per-device key overrides, e.g. { kb1: { up: 'KeyW', a: 'Space' } } */
  keyBindings: {},
});

/* ------------------------------------------------------------------ */
/* Generic localStorage-backed store (also used by profileStore)       */
/* ------------------------------------------------------------------ */

function getStorage() {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return null;
    const probe = '__monkey_party_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

/**
 * Create a persistent key/value store with get/set/subscribe.
 *
 * @param {string} key localStorage key.
 * @param {Object} defaults Complete default value object.
 * @param {(value: Object) => Object} [sanitize] Normalizes/clamps a merged value.
 * @returns {{
 *   get: () => Object,
 *   set: (patch: Object) => Object,
 *   subscribe: (cb: (value: Object) => void) => () => void,
 *   reset: () => Object,
 * }}
 */
export function createLocalStore(key, defaults, sanitize = (v) => v) {
  const storage = getStorage();
  const listeners = new Set();

  function load() {
    if (storage) {
      try {
        const raw = storage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            return sanitize({ ...defaults, ...parsed });
          }
        }
      } catch (err) {
        console.warn(`[store:${key}] failed to load, using defaults:`, err);
      }
    }
    return sanitize({ ...defaults });
  }

  let value = load();

  function persist() {
    if (!storage) return;
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn(`[store:${key}] failed to persist:`, err);
    }
  }

  function notify() {
    for (const cb of [...listeners]) {
      try {
        cb(get());
      } catch (err) {
        console.error(`[store:${key}] subscriber threw:`, err);
      }
    }
  }

  /** @returns {Object} Shallow copy of the current value. */
  function get() {
    return { ...value };
  }

  /**
   * Merge a patch into the value, sanitize, persist, and notify subscribers.
   * @param {Object} patch
   * @returns {Object} The new value.
   */
  function set(patch) {
    if (!patch || typeof patch !== 'object') return get();
    value = sanitize({ ...value, ...patch });
    persist();
    notify();
    return get();
  }

  /**
   * @param {(value: Object) => void} cb
   * @returns {() => void} Unsubscribe.
   */
  function subscribe(cb) {
    if (typeof cb !== 'function') throw new Error(`[store:${key}] subscribe expects a function`);
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  /** Reset to defaults (persists + notifies). */
  function reset() {
    value = sanitize({ ...defaults });
    persist();
    notify();
    return get();
  }

  return { get, set, subscribe, reset };
}

/* ------------------------------------------------------------------ */
/* Settings sanitization                                               */
/* ------------------------------------------------------------------ */

function clamp01(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

function sanitizeBool(v, fallback) {
  return typeof v === 'boolean' ? v : fallback;
}

/**
 * Resolve colorblindMode with legacy back-compat: stores written before the
 * mode existed only carry `colorblind: true|false`. A truthy legacy flag
 * upgrades an 'off' (or missing/invalid) mode to 'deuteranopia'.
 *
 * NOTE for writers: because of this mapping, turning the mode off must
 * clear the legacy flag in the same set() (`{ colorblindMode: 'off',
 * colorblind: false }`) - the settings screen does exactly that.
 */
function sanitizeColorblindMode(raw) {
  let mode = COLORBLIND_MODES.includes(raw.colorblindMode) ? raw.colorblindMode : 'off';
  if (mode === 'off' && raw.colorblind === true) mode = 'deuteranopia';
  return mode;
}

/** Strictly validate { kb1|kb2|kb3: { up|down|left|right|a|b: 'KeyW' } }. */
function sanitizeKeyBindings(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const device of KEY_BINDING_DEVICES) {
    const map = raw[device];
    if (!map || typeof map !== 'object' || Array.isArray(map)) continue;
    const clean = {};
    for (const action of KEY_BINDING_ACTIONS) {
      const code = map[action];
      if (typeof code === 'string' && KEY_CODE_RE.test(code)) clean[action] = code;
    }
    if (Object.keys(clean).length > 0) out[device] = clean;
  }
  return out;
}

function sanitizeSettings(raw) {
  const d = DEFAULT_SETTINGS;
  const colorblindMode = sanitizeColorblindMode(raw);
  const textScale = TEXT_SCALES.includes(Number(raw.textScale)) ? Number(raw.textScale) : d.textScale;
  return {
    masterVolume: clamp01(raw.masterVolume, d.masterVolume),
    musicVolume: clamp01(raw.musicVolume, d.musicVolume),
    sfxVolume: clamp01(raw.sfxVolume, d.sfxVolume),
    quality: QUALITY_LEVELS.includes(raw.quality) ? raw.quality : d.quality,
    // Legacy boolean stays derived from the mode so older consumers
    // (body.colorblind class) keep working.
    colorblind: colorblindMode !== 'off',
    colorblindMode,
    language: LANGUAGES.includes(raw.language) ? raw.language : d.language,
    reducedMotion: sanitizeBool(raw.reducedMotion, d.reducedMotion),
    screenShake: sanitizeBool(raw.screenShake, d.screenShake),
    textScale,
    fpsMeter: sanitizeBool(raw.fpsMeter, d.fpsMeter),
    seatBindings: raw.seatBindings && typeof raw.seatBindings === 'object' && !Array.isArray(raw.seatBindings)
      ? { ...raw.seatBindings }
      : { ...d.seatBindings },
    keyBindings: sanitizeKeyBindings(raw.keyBindings),
  };
}

/** The app-wide settings store singleton. */
export const settingsStore = createLocalStore(STORAGE_KEY, DEFAULT_SETTINGS, sanitizeSettings);
