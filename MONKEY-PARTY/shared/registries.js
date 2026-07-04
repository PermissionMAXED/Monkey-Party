/**
 * Singleton content registries.
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 *
 * Import these anywhere content needs to be looked up. Content packages fill
 * them via shared/content/index.js registerAllContent().
 */

import { createRegistry } from './registry.js';

/** @type {ReturnType<typeof createRegistry>} BoardDef registry. */
export const boards = createRegistry('boards');

/** @type {ReturnType<typeof createRegistry>} CharacterDef registry. */
export const characters = createRegistry('characters');

/** @type {ReturnType<typeof createRegistry>} ItemDef registry. */
export const items = createRegistry('items');

/** @type {ReturnType<typeof createRegistry>} MinigameDef registry. */
export const minigames = createRegistry('minigames');

/** All singletons, keyed by registry name (handy for iteration/diagnostics). */
export const registries = { boards, characters, items, minigames };
