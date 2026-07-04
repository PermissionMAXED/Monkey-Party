/**
 * Tiny dependency-free tween engine for MONKEY-PARTY.
 *
 * tween(target, props, dur, { ease, delay, onUpdate, onDone }) animates
 * numeric properties (nested objects supported, e.g. { position: { y: 2 } }).
 * Drive with update(dt) once per frame:
 *
 *   engine.onFrame((dt) => tweenUpdate(dt));
 *
 * Eases: linear, quadOut, quadInOut, cubicOut, backOut, bounceOut, elasticOut.
 */

export const eases = {
  linear: (k) => k,
  quadOut: (k) => k * (2 - k),
  quadInOut: (k) => (k < 0.5 ? 2 * k * k : -1 + (4 - 2 * k) * k),
  cubicOut: (k) => 1 + (k - 1) ** 3,
  backOut: (k) => {
    const s = 1.70158;
    const t = k - 1;
    return t * t * ((s + 1) * t + s) + 1;
  },
  bounceOut: (k) => {
    if (k < 1 / 2.75) return 7.5625 * k * k;
    if (k < 2 / 2.75) {
      const t = k - 1.5 / 2.75;
      return 7.5625 * t * t + 0.75;
    }
    if (k < 2.5 / 2.75) {
      const t = k - 2.25 / 2.75;
      return 7.5625 * t * t + 0.9375;
    }
    const t = k - 2.625 / 2.75;
    return 7.5625 * t * t + 0.984375;
  },
  elasticOut: (k) => {
    if (k === 0 || k === 1) return k;
    return 2 ** (-10 * k) * Math.sin((k - 0.075) * (2 * Math.PI) / 0.3) + 1;
  },
};

/** @type {Set<Object>} */
const active = new Set();

/** Recursively collect [holder, key, from, to] tracks for numeric leaves. */
function collectTracks(target, props, tracks) {
  for (const [key, to] of Object.entries(props)) {
    if (typeof to === 'number') {
      const from = Number(target?.[key]) || 0;
      tracks.push([target, key, from, to]);
    } else if (to && typeof to === 'object' && target?.[key] && typeof target[key] === 'object') {
      collectTracks(target[key], to, tracks);
    }
  }
}

/**
 * Start a tween. Values are captured at call time.
 *
 * @param {Object} target Object whose numeric properties are animated.
 * @param {Object} props Destination values (nested objects ok).
 * @param {number} [dur] Duration in seconds.
 * @param {{
 *   ease?: string|((k:number)=>number),
 *   delay?: number,
 *   onUpdate?: (k: number) => void,
 *   onDone?: () => void,
 * }} [opts]
 * @returns {{ stop: (jumpToEnd?: boolean) => void, promise: Promise<void> }}
 */
export function tween(target, props, dur = 0.3, opts = {}) {
  const tracks = [];
  collectTracks(target, props, tracks);

  const ease = typeof opts.ease === 'function' ? opts.ease : (eases[opts.ease] ?? eases.quadOut);

  let resolveDone;
  const promise = new Promise((resolve) => {
    resolveDone = resolve;
  });

  const item = {
    target,
    tracks,
    dur: Math.max(0.0001, dur),
    delay: opts.delay ?? 0,
    t: 0,
    ease,
    onUpdate: opts.onUpdate ?? null,
    onDone: opts.onDone ?? null,
    resolveDone,
  };
  active.add(item);

  return {
    stop(jumpToEnd = false) {
      if (!active.has(item)) return;
      active.delete(item);
      if (jumpToEnd) {
        for (const [holder, key, , to] of item.tracks) holder[key] = to;
        item.onDone?.();
      }
      item.resolveDone();
    },
    promise,
  };
}

/** Cancel every active tween animating `target` (no onDone). */
export function cancelTweensOf(target) {
  for (const item of [...active]) {
    if (item.target === target) {
      active.delete(item);
      item.resolveDone();
    }
  }
}

/** Number of running tweens (for tests/debug). */
export function activeTweenCount() {
  return active.size;
}

/**
 * Advance all tweens. Call once per frame with the frame delta (seconds).
 * @param {number} dt
 */
export function update(dt) {
  if (!(dt > 0) || active.size === 0) return;
  for (const item of [...active]) {
    item.t += dt;
    const local = item.t - item.delay;
    if (local <= 0) continue;
    const k = Math.min(local / item.dur, 1);
    const e = item.ease(k);
    for (const [holder, key, from, to] of item.tracks) {
      holder[key] = from + (to - from) * e;
    }
    try {
      item.onUpdate?.(k);
    } catch (err) {
      console.error('[tween] onUpdate threw:', err);
    }
    if (k >= 1) {
      active.delete(item);
      try {
        item.onDone?.();
      } catch (err) {
        console.error('[tween] onDone threw:', err);
      }
      item.resolveDone();
    }
  }
}
