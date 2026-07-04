/**
 * Timed status effects + the named hook chain.
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 *
 * A hook chain resolves a value through every hook of a given name that
 * applies to a player, sourced in this fixed order:
 *
 *   1. character perk hooks   (characters registry, CharacterDef.perk.hooks)
 *   2. passive item hooks     (held items whose ItemDef has .passiveHooks)
 *   3. active effect hooks    (player.effects -> registered effect defs)
 *
 * Every hook has the signature (value, ctx) => newValue|undefined, where
 * returning undefined keeps the incoming value. ctx always carries
 * {sim, playerId} plus call-site extras.
 *
 * Effect defs are code (hooks can't be serialized); only {id, turnsLeft}
 * lives in MatchState. Effect defs are registered at module-load time by the
 * item files (and may be registered by boards/characters for their own
 * mechanics). Registration THROWS on unknown hook names.
 *
 * Effects with turnsLeft < 0 are permanent until removed explicitly.
 */

import { characters, items as itemsRegistry } from '../registries.js';

/** All hook names the sim resolves, in canonical order. */
export const HOOK_NAMES = [
  'onTurnStart',
  'onDicePool',
  'onDiceRoll',
  'onMoveSteps',
  'onShopPrice',
  'onCoinsGained',
  'onCoinsLost',
  'onPassNode',
  'onLandNode',
  'onTrapTriggered',
  'onMinigameCoins',
  'onStarPrice',
  'onItemUse',
];

/**
 * Throw when any key of `hooks` is not a known hook name.
 * @param {Object<string, Function>} hooks
 * @param {string} [source] Label used in the error message.
 */
export function assertHookNames(hooks, source = 'effect') {
  if (hooks === null || typeof hooks !== 'object') {
    throw new Error(`[sim] ${source}: hooks must be an object`);
  }
  for (const name of Object.keys(hooks)) {
    if (!HOOK_NAMES.includes(name)) {
      throw new Error(`[sim] ${source}: unknown hook name "${name}"`);
    }
    if (typeof hooks[name] !== 'function') {
      throw new Error(`[sim] ${source}: hook "${name}" must be a function`);
    }
  }
}

/** @type {Map<string, {id: string, hooks: Object<string, Function>}>} */
const effectDefs = new Map();

/**
 * Register (or re-register - registration is idempotent by id) an effect
 * definition. Throws on unknown hook names.
 *
 * @param {{id: string, hooks?: Object<string, Function>}} def
 * @returns {{id: string, hooks: Object<string, Function>}}
 */
export function registerEffectDef(def) {
  if (def === null || typeof def !== 'object' || typeof def.id !== 'string' || def.id.length === 0) {
    throw new Error('[sim] registerEffectDef: def needs a non-empty string id');
  }
  const hooks = def.hooks ?? {};
  assertHookNames(hooks, `effect "${def.id}"`);
  const stored = { id: def.id, hooks };
  effectDefs.set(def.id, stored);
  return stored;
}

/**
 * @param {string} id
 * @returns {{id: string, hooks: Object<string, Function>}|null}
 */
export function getEffectDef(id) {
  return effectDefs.get(id) ?? null;
}

/* ------------------------------------------------------------------ */
/* Effect lifecycle                                                    */
/* ------------------------------------------------------------------ */

/**
 * Attach a timed status effect to a player.
 *
 * @param {Object} sim
 * @param {string} pid
 * @param {{id: string, turnsLeft?: number, data?: Object}} effect
 */
export function addEffect(sim, pid, effect) {
  if (!effect || typeof effect.id !== 'string' || effect.id.length === 0) {
    throw new Error('[sim] addEffect: effect needs a string id');
  }
  const player = sim.state.players[pid];
  if (!player) throw new Error(`[sim] addEffect: unknown player "${pid}"`);
  const entry = { id: effect.id, turnsLeft: Number.isFinite(effect.turnsLeft) ? effect.turnsLeft : 1 };
  if (effect.data !== undefined) entry.data = effect.data;
  player.effects.push(entry);
  sim.emit('item', { kind: 'effect_added', playerId: pid, effectId: entry.id, turnsLeft: entry.turnsLeft });
}

/**
 * Remove the first effect with the given id from a player (if present).
 *
 * @param {Object} sim
 * @param {string} pid
 * @param {string} effectId
 * @returns {boolean} true when an effect was removed.
 */
export function removeEffect(sim, pid, effectId) {
  const player = sim.state.players[pid];
  if (!player) return false;
  const idx = player.effects.findIndex((e) => e.id === effectId);
  if (idx === -1) return false;
  player.effects.splice(idx, 1);
  sim.emit('item', { kind: 'effect_removed', playerId: pid, effectId });
  return true;
}

/**
 * Tick down every timed effect on a player (called at the end of that
 * player's turn). Effects with turnsLeft < 0 never expire by time.
 *
 * @param {Object} sim
 * @param {string} pid
 */
export function tickEffects(sim, pid) {
  const player = sim.state.players[pid];
  if (!player) return;
  const kept = [];
  for (const effect of player.effects) {
    if (effect.turnsLeft < 0) {
      kept.push(effect);
      continue;
    }
    effect.turnsLeft -= 1;
    if (effect.turnsLeft > 0) {
      kept.push(effect);
    } else {
      sim.emit('item', { kind: 'effect_expired', playerId: pid, effectId: effect.id });
    }
  }
  player.effects = kept;
}

/* ------------------------------------------------------------------ */
/* Hook chain resolution                                               */
/* ------------------------------------------------------------------ */

/**
 * Collect every hook function of `hookName` that applies to `pid`, in
 * canonical source order (perk -> passive items -> active effects).
 *
 * @param {Object} sim
 * @param {string} hookName
 * @param {string} pid
 * @returns {Function[]}
 */
function collectHooks(sim, hookName, pid) {
  const player = sim.state.players[pid];
  const chain = [];
  if (!player) return chain;

  // 1. Character perk.
  const character = player.characterId ? characters.get(player.characterId) : null;
  const perkHook = character?.perk?.hooks?.[hookName];
  if (typeof perkHook === 'function') chain.push(perkHook);

  // 2. Passive hooks from held items.
  for (const itemId of player.items) {
    const def = itemsRegistry.get(itemId);
    const hook = def?.passiveHooks?.[hookName];
    if (typeof hook === 'function') chain.push(hook);
  }

  // 3. Active timed effects, in acquisition order.
  for (const effect of player.effects) {
    const def = effectDefs.get(effect.id);
    const hook = def?.hooks?.[hookName];
    if (typeof hook === 'function') chain.push(hook);
  }

  return chain;
}

/**
 * Resolve a value through the hook chain for one player.
 *
 * @param {Object} sim
 * @param {string} hookName One of HOOK_NAMES (unknown names throw).
 * @param {string} pid Player the chain applies to.
 * @param {*} value Initial value (may be null for notification hooks).
 * @param {Object} [extraCtx] Extra context merged into ctx.
 * @returns {*} The final value after every hook ran.
 */
export function runHook(sim, hookName, pid, value, extraCtx = {}) {
  if (!HOOK_NAMES.includes(hookName)) {
    throw new Error(`[sim] runHook: unknown hook name "${hookName}"`);
  }
  const ctx = { sim, playerId: pid, ...extraCtx };
  let current = value;
  for (const hook of collectHooks(sim, hookName, pid)) {
    const out = hook(current, ctx);
    if (out !== undefined) current = out;
  }
  return current;
}
