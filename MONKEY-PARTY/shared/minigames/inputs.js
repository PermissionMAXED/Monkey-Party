/**
 * InputFrame helpers for minigames (see the InputFrame typedef in
 * shared/types.js: { move:{x,y}, a, b, aim? }).
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 *
 * packFrame/unpackFrame use a compact array form for the wire:
 *   [moveX, moveY, buttonBits] or [moveX, moveY, buttonBits, aimX, aimY]
 * with axes quantized to 3 decimals and buttons packed as bit 0 = a,
 * bit 1 = b.
 */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number(v) || 0));
const q3 = (v) => Math.round(clamp(v, -1, 1) * 1000) / 1000;

/**
 * A fresh neutral InputFrame.
 * @returns {import('../types.js').InputFrame}
 */
export function emptyFrame() {
  return { move: { x: 0, y: 0 }, a: false, b: false };
}

/**
 * Sanitize an arbitrary value into a well-formed InputFrame: axes clamped
 * to [-1,1] (NaN -> 0), buttons coerced to booleans, aim kept only when
 * present and clamped. Never throws; returns a NEW frame.
 *
 * @param {*} f
 * @returns {import('../types.js').InputFrame}
 */
export function clampFrame(f) {
  const src = f !== null && typeof f === 'object' ? f : {};
  const move = src.move !== null && typeof src.move === 'object' ? src.move : {};
  const out = {
    move: { x: clamp(move.x, -1, 1), y: clamp(move.y, -1, 1) },
    a: Boolean(src.a),
    b: Boolean(src.b),
  };
  if (src.aim !== null && typeof src.aim === 'object') {
    out.aim = { x: clamp(src.aim.x, -1, 1), y: clamp(src.aim.y, -1, 1) };
  }
  return out;
}

/**
 * Pack a frame into its compact array form (see module docs).
 * @param {import('../types.js').InputFrame} f
 * @returns {number[]}
 */
export function packFrame(f) {
  const frame = clampFrame(f);
  const bits = (frame.a ? 1 : 0) | (frame.b ? 2 : 0);
  const out = [q3(frame.move.x), q3(frame.move.y), bits];
  if (frame.aim) out.push(q3(frame.aim.x), q3(frame.aim.y));
  return out;
}

/**
 * Unpack a compact array back into an InputFrame. Malformed input yields a
 * neutral frame (never throws).
 *
 * @param {number[]} arr
 * @returns {import('../types.js').InputFrame}
 */
export function unpackFrame(arr) {
  if (!Array.isArray(arr) || arr.length < 3) return emptyFrame();
  const bits = Number(arr[2]) || 0;
  const frame = {
    move: { x: clamp(arr[0], -1, 1), y: clamp(arr[1], -1, 1) },
    a: (bits & 1) !== 0,
    b: (bits & 2) !== 0,
  };
  if (arr.length >= 5) {
    frame.aim = { x: clamp(arr[3], -1, 1), y: clamp(arr[4], -1, 1) };
  }
  return frame;
}
