/**
 * Snapshot / clone helpers for the match simulation.
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 *
 * Everything the sim persists is JSON-safe, so JSON round-tripping is a
 * correct (and deterministic - key order is preserved) deep clone. Snapshots
 * carry the mutable MatchState, the sim-internal continuation data, the RNG
 * state, and the append-only event log so a restored sim keeps producing a
 * byte-identical event log.
 */

export const SNAPSHOT_VERSION = 1;

/**
 * Deterministic deep clone of a JSON-safe value.
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function deepClone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

/**
 * Recursively freeze an object graph in place.
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return value;
}

/**
 * Build a serializable snapshot of the full sim.
 *
 * @param {{state: Object, internal: Object, rngState: number, eventLog: Object[]}} parts
 * @returns {Object}
 */
export function createSnapshot({ state, internal, rngState, eventLog }) {
  return {
    v: SNAPSHOT_VERSION,
    state: deepClone(state),
    internal: deepClone(internal),
    rngState,
    eventLog: deepClone(eventLog),
  };
}

/**
 * Validate + deep-clone a snapshot back into its parts.
 *
 * @param {Object} snap A value previously returned by createSnapshot().
 * @returns {{state: Object, internal: Object, rngState: number, eventLog: Object[]}}
 */
export function restoreSnapshot(snap) {
  if (snap === null || typeof snap !== 'object') {
    throw new Error('[sim] restore(): snapshot must be an object');
  }
  if (snap.v !== SNAPSHOT_VERSION) {
    throw new Error(`[sim] restore(): unsupported snapshot version ${snap.v}`);
  }
  if (snap.state === null || typeof snap.state !== 'object') {
    throw new Error('[sim] restore(): snapshot has no state');
  }
  return {
    state: deepClone(snap.state),
    internal: deepClone(snap.internal ?? {}),
    rngState: Number(snap.rngState) >>> 0,
    eventLog: deepClone(snap.eventLog ?? []),
  };
}
