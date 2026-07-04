/**
 * Character content registrar (package P6): registers all 16 CharacterDefs
 * into the singleton characters registry (see shared/registries.js).
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 *
 * Loaded by shared/content/index.js registerAllContent(), which expects a
 * default-exported registerAll(). registerAll() is idempotent (already
 * registered ids are skipped) and SELF-CHECKS every def before touching the
 * registry: any perk hook name outside ALLOWED_PERK_HOOKS throws, as does a
 * non-function hook, so a bad def can never reach the sim.
 */

import { characters } from '../../registries.js';
import { HOOK_NAMES } from '../../sim/effects.js';

import kiko from './kiko.js';
import rilla from './rilla.js';
import momo from './momo.js';
import zaza from './zaza.js';
import bongo from './bongo.js';
import nana from './nana.js';
import gibbs from './gibbs.js';
import chichi from './chichi.js';
import babu from './babu.js';
import tika from './tika.js';
import loko from './loko.js';
import kumo from './kumo.js';
import mango from './mango.js';
import koko from './koko.js';
import charli from './charli.js';
import pip from './pip.js';

/**
 * Hook names a character perk may use. Mirrors the sim's canonical
 * HOOK_NAMES (shared/sim/effects.js) - the sim is the source of truth.
 */
export const ALLOWED_PERK_HOOKS = [...HOOK_NAMES];

/** All 16 character defs: 10 starters first, then unlockables by cost. */
export const CHARACTER_DEFS = [
  kiko,
  rilla,
  momo,
  zaza,
  bongo,
  nana,
  gibbs,
  chichi,
  babu,
  tika,
  loko,
  kumo,
  mango,
  koko,
  charli,
  pip,
];

/** Canonical id list, in registration order. */
export const CHARACTER_IDS = CHARACTER_DEFS.map((def) => def.id);

/**
 * Throw when a def's perk hooks use an unknown name or a non-function.
 * @param {import('../../types.js').CharacterDef} def
 */
export function assertPerkHooks(def) {
  const hooks = def?.perk?.hooks;
  if (hooks === null || typeof hooks !== 'object') {
    throw new Error(`[characters] "${def?.id}": perk.hooks must be an object`);
  }
  for (const name of Object.keys(hooks)) {
    if (!ALLOWED_PERK_HOOKS.includes(name)) {
      throw new Error(`[characters] "${def.id}": unknown perk hook "${name}" (allowed: ${ALLOWED_PERK_HOOKS.join(', ')})`);
    }
    if (typeof hooks[name] !== 'function') {
      throw new Error(`[characters] "${def.id}": perk hook "${name}" must be a function`);
    }
  }
}

/**
 * Validate + register every character def (skipping already registered
 * ids). Throws before registering anything when any def is invalid.
 *
 * @returns {number} The characters registry count after registration.
 */
export default function registerAll() {
  for (const def of CHARACTER_DEFS) assertPerkHooks(def); // self-check first, all-or-nothing
  for (const def of CHARACTER_DEFS) {
    if (!characters.get(def.id)) characters.register(def);
  }
  return characters.count();
}
