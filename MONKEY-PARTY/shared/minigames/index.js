/**
 * Minigame content registrar.
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 *
 * Default-exports registerAll(), loaded by shared/content/index.js. Each
 * batch is dynamic-imported inside try/catch: batch1 ships with this
 * package (P7); batch2 and templates belong to a sibling team and may not
 * exist yet - their absence is tolerated silently.
 */

/** Batch registrar sources (each default-exports its own registerAll()). */
const BATCH_SOURCES = [
  { label: 'batch1', path: './sims/batch1/index.js' },
  { label: 'batch2', path: './sims/batch2/index.js' },
  { label: 'templates', path: './sims/templates/index.js' },
  { label: 'batch3', path: './sims/batch3/index.js' },
];

/** @type {{loaded: string[], missing: string[]}|null} */
let cachedReport = null;

/**
 * Register every available minigame batch. Idempotent: a second call
 * returns the first call's report without re-registering.
 *
 * @returns {Promise<{loaded: string[], missing: string[]}>}
 */
export default async function registerAll() {
  if (cachedReport) return cachedReport;

  const loaded = [];
  const missing = [];

  for (const { label, path } of BATCH_SOURCES) {
    try {
      const mod = await import(/* @vite-ignore */ path);
      const register = mod?.default;
      if (typeof register !== 'function') {
        throw new Error(`minigame batch "${label}" has no default-exported register function`);
      }
      await register();
      loaded.push(label);
    } catch (err) {
      missing.push(label);
      if (label === 'batch1') {
        // Our own batch failing to load is a real bug, not a missing sibling.
        console.warn(`[minigames] batch1 failed to register: ${err?.message ?? err}`);
      }
    }
  }

  cachedReport = { loaded, missing };
  return cachedReport;
}
