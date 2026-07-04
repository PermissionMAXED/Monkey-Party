/**
 * Deterministic, serializable RNG (mulberry32).
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 *
 * The full generator state is a single uint32, exposed via state()/setState()
 * so match snapshots can serialize it (see MatchState.rngState).
 */

const UINT32_RANGE = 4294967296; // 2 ** 32

/**
 * FNV-1a hash of a string to a uint32 (used to derive fork seeds).
 * @param {string} str
 * @returns {number}
 */
function hashLabel(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Create a deterministic RNG seeded with `seed`.
 *
 * @param {number} seed Any number; coerced to uint32.
 * @returns {{
 *   next: () => number,
 *   int: (min: number, max: number) => number,
 *   pick: <T>(arr: T[]) => T|undefined,
 *   shuffle: <T>(arr: T[]) => T[],
 *   fork: (label?: string) => ReturnType<typeof createRng>,
 *   state: () => number,
 *   setState: (s: number) => void,
 * }}
 */
export function createRng(seed = 0) {
  let s = Number(seed) >>> 0;

  /** Advance and return the next uint32. */
  function nextUint32() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  /** @returns {number} float in [0, 1). */
  function next() {
    return nextUint32() / UINT32_RANGE;
  }

  /**
   * Integer in [min, max], inclusive on both ends.
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  function int(min, max) {
    const lo = Math.ceil(Math.min(min, max));
    const hi = Math.floor(Math.max(min, max));
    return lo + Math.floor(next() * (hi - lo + 1));
  }

  /**
   * Pick a uniformly random element. Returns undefined for empty arrays.
   * @template T
   * @param {T[]} arr
   * @returns {T|undefined}
   */
  function pick(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return undefined;
    return arr[int(0, arr.length - 1)];
  }

  /**
   * Fisher-Yates shuffle. Returns a NEW array; the input is not mutated.
   * @template T
   * @param {T[]} arr
   * @returns {T[]}
   */
  function shuffle(arr) {
    const out = Array.isArray(arr) ? arr.slice() : [];
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = int(0, i);
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  /**
   * Derive an independent child RNG. Deterministic: depends only on the
   * current state and the label. Advances this RNG's state by one draw.
   * @param {string} [label]
   * @returns {ReturnType<typeof createRng>}
   */
  function fork(label = 'fork') {
    const mixed = (hashLabel(String(label)) ^ nextUint32()) >>> 0;
    return createRng(mixed);
  }

  /** @returns {number} Serializable state (uint32). */
  function state() {
    return s;
  }

  /** @param {number} value Previously captured state(). */
  function setState(value) {
    s = Number(value) >>> 0;
  }

  return { next, int, pick, shuffle, fork, state, setState };
}
