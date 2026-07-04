/**
 * localStorage-backed settings store.
 *
 * Guards for the absence of localStorage (SSR, tests, privacy modes): the
 * store then works in-memory only.
 */

const STORAGE_KEY = 'monkey-party:settings:v1';

const QUALITY_LEVELS = ['low', 'med', 'high'];
const LANGUAGES = ['en', 'de'];

export const DEFAULT_SETTINGS = Object.freeze({
  masterVolume: 0.8,
  musicVolume: 0.7,
  sfxVolume: 0.8,
  quality: 'med',
  colorblind: false,
  language: 'en',
  /** seat index -> input device id, e.g. { 0: 'keyboard:wasd', 1: 'gamepad:0' } */
  seatBindings: {},
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

function sanitizeSettings(raw) {
  const d = DEFAULT_SETTINGS;
  return {
    masterVolume: clamp01(raw.masterVolume, d.masterVolume),
    musicVolume: clamp01(raw.musicVolume, d.musicVolume),
    sfxVolume: clamp01(raw.sfxVolume, d.sfxVolume),
    quality: QUALITY_LEVELS.includes(raw.quality) ? raw.quality : d.quality,
    colorblind: typeof raw.colorblind === 'boolean' ? raw.colorblind : d.colorblind,
    language: LANGUAGES.includes(raw.language) ? raw.language : d.language,
    seatBindings: raw.seatBindings && typeof raw.seatBindings === 'object' && !Array.isArray(raw.seatBindings)
      ? { ...raw.seatBindings }
      : { ...d.seatBindings },
  };
}

/** The app-wide settings store singleton. */
export const settingsStore = createLocalStore(STORAGE_KEY, DEFAULT_SETTINGS, sanitizeSettings);
