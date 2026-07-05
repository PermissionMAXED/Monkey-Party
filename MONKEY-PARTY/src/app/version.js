/**
 * App version + build stamp (release engineering package).
 *
 * Importable everywhere: no DOM access at import time, and safe under plain
 * Node (tests, server) where import.meta.env does not exist.
 */

/** Semantic app version. Keep in sync with package.json "version". */
export const VERSION = '1.0.0';

/**
 * Human-readable build stamp, resolved once at module load.
 * In a Vite context MODE is 'development' | 'production'; under plain Node
 * import.meta.env is undefined, so the stamp falls back to 'node'.
 */
export const BUILD_STAMP = `v${VERSION} (${import.meta.env?.MODE ?? 'node'})`;

export default VERSION;
