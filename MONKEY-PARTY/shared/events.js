/**
 * Sim event type constants + a tiny dependency-free event emitter.
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 */

/**
 * SimEvent type constants (see SimEvent in shared/types.js).
 * The match sim emits these as it applies actions.
 */
export const EVT = {
  DICE: 'dice',
  MOVE_STEP: 'move_step',
  COINS: 'coins',
  FIELD: 'field',
  SHOP: 'shop',
  STAR: 'star',
  TRAP: 'trap',
  ITEM: 'item',
  MECHANIC: 'mechanic',
  BOSS: 'boss',
  MINIGAME_START: 'minigame_start',
  MINIGAME_RESULT: 'minigame_result',
  PHASE: 'phase',
  BONUS: 'bonus',
  GAME_OVER: 'game_over',
  EMOTE: 'emote',
};

/** All SimEvent type strings. */
export const SIM_EVENT_TYPES = Object.freeze(Object.values(EVT));

/**
 * Create a minimal event emitter.
 *
 * @returns {{
 *   on: (evt: string, cb: Function) => () => void,
 *   once: (evt: string, cb: Function) => () => void,
 *   off: (evt: string, cb: Function) => void,
 *   emit: (evt: string, ...args: *[]) => void,
 *   clear: () => void,
 * }}
 */
export function createEmitter() {
  /** @type {Map<string, Set<Function>>} */
  const listeners = new Map();

  function on(evt, cb) {
    if (typeof cb !== 'function') throw new Error(`emitter.on("${evt}"): callback must be a function`);
    let set = listeners.get(evt);
    if (!set) {
      set = new Set();
      listeners.set(evt, set);
    }
    set.add(cb);
    return () => off(evt, cb);
  }

  function once(evt, cb) {
    const unsub = on(evt, (...args) => {
      unsub();
      cb(...args);
    });
    return unsub;
  }

  function off(evt, cb) {
    listeners.get(evt)?.delete(cb);
  }

  function emit(evt, ...args) {
    const set = listeners.get(evt);
    if (!set) return;
    // Copy so listeners may unsubscribe during emit.
    for (const cb of [...set]) {
      try {
        cb(...args);
      } catch (err) {
        // Never let one listener break the others.
        console.error(`[emitter] listener for "${evt}" threw:`, err);
      }
    }
  }

  function clear() {
    listeners.clear();
  }

  return { on, once, off, emit, clear };
}
