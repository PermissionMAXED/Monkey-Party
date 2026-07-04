/**
 * Content bootstrap: register all boards, characters, items, and minigames
 * into the singleton registries (see shared/registries.js).
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 *
 * Each content package is loaded with a guarded dynamic import so the app
 * still boots while sibling packages don't exist yet (empty registries are
 * fine). Registrar modules must default-export a registerAll() function.
 */

/**
 * Registrar sources, loaded relative to this module. Paths are kept in
 * variables (with @vite-ignore) so bundlers don't fail on missing files.
 */
const REGISTRAR_SOURCES = [
  { label: 'boards', path: './boards/index.js' },
  { label: 'characters', path: './characters/index.js' },
  { label: 'items', path: './items/index.js' },
  { label: 'minigames', path: '../minigames/index.js' },
];

/** @type {{loaded: string[], missing: string[]}|null} */
let cachedReport = null;

/**
 * Import and run every content registrar that exists. Idempotent: a second
 * call returns the first call's report without re-registering (registries
 * would throw on duplicate ids).
 *
 * @returns {Promise<{loaded: string[], missing: string[]}>}
 */
export async function registerAllContent() {
  if (cachedReport) return cachedReport;

  const loaded = [];
  const missing = [];

  for (const { label, path } of REGISTRAR_SOURCES) {
    try {
      const mod = await import(/* @vite-ignore */ path);
      const registerAll = mod?.default;
      if (typeof registerAll !== 'function') {
        throw new Error(`registrar "${label}" has no default-exported registerAll()`);
      }
      await registerAll();
      loaded.push(label);
    } catch (err) {
      missing.push(label);
      console.info(`[content] registrar "${label}" not loaded (${path}): ${err?.message ?? err}`);
    }
  }

  console.info(
    `[content] registrars loaded: [${loaded.join(', ') || 'none'}]`
    + (missing.length ? ` | missing: [${missing.join(', ')}]` : ''),
  );

  cachedReport = { loaded, missing };
  return cachedReport;
}
