/**
 * Generic content registry.
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 *
 * Content packages (boards, characters, items, minigames) register their
 * definitions into named registries at boot (see shared/content/index.js and
 * the singletons in shared/registries.js).
 */

/**
 * Create a registry for defs with unique string `id`s.
 *
 * @param {string} name Registry name, used in error messages.
 * @returns {{
 *   name: string,
 *   register: (def: {id: string}) => {id: string},
 *   get: (id: string) => Object|null,
 *   all: () => Object[],
 *   ids: () => string[],
 *   count: () => number,
 * }}
 */
export function createRegistry(name) {
  if (typeof name !== 'string' || name.length === 0) {
    throw new Error('createRegistry(name): name must be a non-empty string');
  }

  /** @type {Map<string, Object>} */
  const entries = new Map();

  /**
   * Register a definition. Throws on missing/invalid id or duplicate id.
   * @param {{id: string}} def
   * @returns {{id: string}} The registered def (for chaining).
   */
  function register(def) {
    if (def === null || typeof def !== 'object') {
      throw new Error(`[registry:${name}] register() expects a def object, got ${typeof def}`);
    }
    if (typeof def.id !== 'string' || def.id.length === 0) {
      throw new Error(`[registry:${name}] def is missing a non-empty string "id"`);
    }
    if (entries.has(def.id)) {
      throw new Error(`[registry:${name}] duplicate id "${def.id}"`);
    }
    entries.set(def.id, def);
    return def;
  }

  /**
   * @param {string} id
   * @returns {Object|null} The def, or null if unknown.
   */
  function get(id) {
    return entries.get(id) ?? null;
  }

  /** @returns {Object[]} All defs, in registration order. */
  function all() {
    return [...entries.values()];
  }

  /** @returns {string[]} All ids, in registration order. */
  function ids() {
    return [...entries.keys()];
  }

  /** @returns {number} */
  function count() {
    return entries.size;
  }

  return { name, register, get, all, ids, count };
}
