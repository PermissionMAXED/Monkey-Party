/**
 * Transform-track animator for factory monkeys (package P6).
 *
 * createAnimator(monkey) plays the data clips from clips.js on the
 * monkey's named parts. No THREE.AnimationMixer, no skeletons: every
 * frame each part is set to rest-transform + interpolated clip offsets
 * (pos/rot add, scale multiplies), so clips can never accumulate drift.
 *
 * - play(name, {loop, fade}) crossfades into the clip (default 0.15s).
 *   'victory'/'lose' resolve to the character's deterministic variant.
 * - Looping clips wrap; one-shot clips hold their final frame (callers
 *   decide what comes next, e.g. play('idle') after 'land').
 * - update(dt) advances time; dt is in seconds.
 * - current is the name of the active clip (null before the first play).
 */

import { getClip } from './clips.js';

/** Default crossfade duration in seconds. */
export const DEFAULT_FADE = 0.15;

const DEFAULT_POS = [0, 0, 0];
const DEFAULT_ROT = [0, 0, 0];
const DEFAULT_SCALE = [1, 1, 1];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerp3(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/**
 * Sample one channel ('pos'|'rot'|'scale') of a track at time t.
 * Keys missing the channel are skipped; outside the covered range the
 * nearest key's value holds.
 */
function sampleChannel(keys, channel, t, fallback) {
  let prev = null;
  let next = null;
  for (const key of keys) {
    if (key[channel] === undefined) continue;
    if (key.t <= t && (!prev || key.t >= prev.t)) prev = key;
    if (key.t >= t && (!next || key.t < next.t)) next = key;
  }
  if (!prev && !next) return fallback;
  if (!prev) return next[channel];
  if (!next || next === prev || next.t === prev.t) return prev[channel];
  const alpha = (t - prev.t) / (next.t - prev.t);
  return lerp3(prev[channel], next[channel], alpha);
}

/**
 * Evaluate a playing clip into per-part offsets.
 * @returns {Object<string, {pos: number[], rot: number[], scale: number[]}>}
 */
function evaluate(playing) {
  const out = {};
  if (!playing) return out;
  const { clip, time, loop } = playing;
  const duration = Math.max(1e-6, clip.duration);
  const t = loop ? ((time % duration) + duration) % duration : Math.min(time, duration);
  for (const [partName, keys] of Object.entries(clip.tracks)) {
    out[partName] = {
      pos: sampleChannel(keys, 'pos', t, DEFAULT_POS),
      rot: sampleChannel(keys, 'rot', t, DEFAULT_ROT),
      scale: sampleChannel(keys, 'scale', t, DEFAULT_SCALE),
    };
  }
  return out;
}

const NEUTRAL = { pos: DEFAULT_POS, rot: DEFAULT_ROT, scale: DEFAULT_SCALE };

/**
 * Create an animator bound to a buildMonkey() result.
 *
 * @param {{group: *, parts: Object<string, *>}} monkey
 * @returns {{play: (name: string, opts?: {loop?: boolean, fade?: number}) => void,
 *   update: (dt: number) => void, current: string|null}}
 */
export function createAnimator(monkey) {
  const parts = monkey.parts;
  const charId = monkey.group?.userData?.characterId ?? '';

  // Rest transforms (factory stores them; capture as a fallback).
  for (const part of Object.values(parts)) {
    if (!part.userData.basePos) {
      part.userData.basePos = part.position.clone();
      part.userData.baseRot = part.rotation.clone();
      part.userData.baseScale = part.scale.clone();
    }
  }

  /** @type {{name: string, clip: Object, time: number, loop: boolean}|null} */
  let current = null;
  let previous = null;
  let fadeElapsed = 0;
  let fadeDuration = 0;

  /**
   * Crossfade into a clip. Re-playing the current looping clip is a no-op;
   * re-playing a one-shot restarts it.
   * @param {string} name Clip name ('victory'/'lose' pick the char variant).
   * @param {{loop?: boolean, fade?: number}} [opts]
   */
  function play(name, opts = {}) {
    const clip = getClip(name, charId);
    if (!clip) return;
    const loop = opts.loop ?? clip.loop;
    if (current && current.name === name && current.loop && loop) return;
    previous = current;
    current = { name, clip, time: 0, loop };
    fadeDuration = Math.max(0, opts.fade ?? DEFAULT_FADE);
    fadeElapsed = 0;
    if (!previous || fadeDuration === 0) previous = null;
  }

  /**
   * Advance and apply the animation.
   * @param {number} dt Seconds since the last update.
   */
  function update(dt) {
    const step = Math.max(0, Number(dt) || 0);
    if (current) current.time += step;
    if (previous) previous.time += step;

    let alpha = 1;
    if (previous) {
      fadeElapsed += step;
      alpha = fadeDuration > 0 ? Math.min(1, fadeElapsed / fadeDuration) : 1;
      if (alpha >= 1) previous = null;
    }

    const curPose = evaluate(current);
    const prevPose = previous ? evaluate(previous) : null;

    for (const [partName, part] of Object.entries(parts)) {
      const cur = curPose[partName] ?? NEUTRAL;
      const prev = prevPose ? (prevPose[partName] ?? NEUTRAL) : null;
      const pos = prev ? lerp3(prev.pos, cur.pos, alpha) : cur.pos;
      const rot = prev ? lerp3(prev.rot, cur.rot, alpha) : cur.rot;
      const scl = prev ? lerp3(prev.scale, cur.scale, alpha) : cur.scale;

      const { basePos, baseRot, baseScale } = part.userData;
      part.position.set(basePos.x + pos[0], basePos.y + pos[1], basePos.z + pos[2]);
      part.rotation.set(baseRot.x + rot[0], baseRot.y + rot[1], baseRot.z + rot[2]);
      part.scale.set(baseScale.x * scl[0], baseScale.y * scl[1], baseScale.z * scl[2]);
    }
  }

  return {
    play,
    update,
    /** Name of the active clip (null before the first play). */
    get current() {
      return current?.name ?? null;
    },
  };
}

export default createAnimator;
