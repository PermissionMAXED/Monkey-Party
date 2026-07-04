/**
 * Keyframe clips for the monkey characters (package P6) - pure data, no
 * three.js. Each clip is:
 *
 *   { duration, loop, tracks: { partName: [{t, pos?, rot?, scale?}, ...] } }
 *
 * - t        seconds within the clip (keys sorted ascending, first at 0)
 * - pos      [x,y,z] offset ADDED to the part's rest position
 * - rot      [x,y,z] euler offset ADDED to the part's rest rotation
 * - scale    [x,y,z] multiplier applied to the part's rest scale
 *
 * Parts are the named Object3Ds from buildMonkey(): root, torso, head,
 * earL, earR, armL, armR, handL, handR, legL, legR, tail, face.
 *
 * Victory has 3 variants and lose has 2, picked deterministically from the
 * character id hash via getClip('victory'|'lose', charId).
 */

/** Emote clip ids (CharacterDef.emotes entries must come from this list). */
export const EMOTE_CLIPS = ['dance', 'taunt', 'laugh', 'cry', 'flex', 'facepalm'];

/** Deterministic FNV-1a hash of a string (variant picking). */
export function hashId(str) {
  let h = 2166136261 >>> 0;
  const s = String(str ?? '');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const TAU = Math.PI * 2;

/** All clips, keyed by name. */
export const CLIPS = {
  /* ---- locomotion / reactions ------------------------------------ */

  idle: {
    duration: 2.4,
    loop: true,
    tracks: {
      torso: [
        { t: 0, scale: [1, 1, 1] },
        { t: 1.2, scale: [1.015, 1.04, 1.015] },
        { t: 2.4, scale: [1, 1, 1] },
      ],
      head: [
        { t: 0, rot: [0.02, 0, 0] },
        { t: 1.2, rot: [-0.04, 0.05, 0] },
        { t: 2.4, rot: [0.02, 0, 0] },
      ],
      tail: [
        { t: 0, rot: [0, 0.25, 0] },
        { t: 1.2, rot: [0, -0.25, 0.05] },
        { t: 2.4, rot: [0, 0.25, 0] },
      ],
      armL: [
        { t: 0, rot: [0, 0, 0.04] },
        { t: 1.2, rot: [0.05, 0, 0.09] },
        { t: 2.4, rot: [0, 0, 0.04] },
      ],
      armR: [
        { t: 0, rot: [0, 0, -0.04] },
        { t: 1.2, rot: [0.05, 0, -0.09] },
        { t: 2.4, rot: [0, 0, -0.04] },
      ],
    },
  },

  walk: {
    duration: 0.8,
    loop: true,
    tracks: {
      root: [
        { t: 0, pos: [0, 0, 0] },
        { t: 0.2, pos: [0, 0.025, 0] },
        { t: 0.4, pos: [0, 0, 0] },
        { t: 0.6, pos: [0, 0.025, 0] },
        { t: 0.8, pos: [0, 0, 0] },
      ],
      legL: [
        { t: 0, rot: [0.55, 0, 0] },
        { t: 0.4, rot: [-0.55, 0, 0] },
        { t: 0.8, rot: [0.55, 0, 0] },
      ],
      legR: [
        { t: 0, rot: [-0.55, 0, 0] },
        { t: 0.4, rot: [0.55, 0, 0] },
        { t: 0.8, rot: [-0.55, 0, 0] },
      ],
      armL: [
        { t: 0, rot: [-0.4, 0, 0.06] },
        { t: 0.4, rot: [0.4, 0, 0.06] },
        { t: 0.8, rot: [-0.4, 0, 0.06] },
      ],
      armR: [
        { t: 0, rot: [0.4, 0, -0.06] },
        { t: 0.4, rot: [-0.4, 0, -0.06] },
        { t: 0.8, rot: [0.4, 0, -0.06] },
      ],
      tail: [
        { t: 0, rot: [0, 0.2, 0] },
        { t: 0.4, rot: [0, -0.2, 0] },
        { t: 0.8, rot: [0, 0.2, 0] },
      ],
    },
  },

  run: {
    duration: 0.5,
    loop: true,
    tracks: {
      root: [
        { t: 0, pos: [0, 0, 0] },
        { t: 0.125, pos: [0, 0.05, 0] },
        { t: 0.25, pos: [0, 0, 0] },
        { t: 0.375, pos: [0, 0.05, 0] },
        { t: 0.5, pos: [0, 0, 0] },
      ],
      torso: [
        { t: 0, rot: [0.25, 0, 0] },
        { t: 0.5, rot: [0.25, 0, 0] },
      ],
      legL: [
        { t: 0, rot: [0.95, 0, 0] },
        { t: 0.25, rot: [-0.95, 0, 0] },
        { t: 0.5, rot: [0.95, 0, 0] },
      ],
      legR: [
        { t: 0, rot: [-0.95, 0, 0] },
        { t: 0.25, rot: [0.95, 0, 0] },
        { t: 0.5, rot: [-0.95, 0, 0] },
      ],
      armL: [
        { t: 0, rot: [-0.8, 0, 0.1] },
        { t: 0.25, rot: [0.8, 0, 0.1] },
        { t: 0.5, rot: [-0.8, 0, 0.1] },
      ],
      armR: [
        { t: 0, rot: [0.8, 0, -0.1] },
        { t: 0.25, rot: [-0.8, 0, -0.1] },
        { t: 0.5, rot: [0.8, 0, -0.1] },
      ],
      tail: [
        { t: 0, rot: [-0.35, 0.15, 0] },
        { t: 0.25, rot: [-0.35, -0.15, 0] },
        { t: 0.5, rot: [-0.35, 0.15, 0] },
      ],
    },
  },

  jump: {
    duration: 0.5,
    loop: false,
    tracks: {
      root: [
        { t: 0, pos: [0, 0, 0] },
        { t: 0.1, pos: [0, -0.06, 0] },
        { t: 0.3, pos: [0, 0.28, 0] },
        { t: 0.5, pos: [0, 0.16, 0] },
      ],
      legL: [
        { t: 0, rot: [0, 0, 0] },
        { t: 0.3, rot: [-0.9, 0, 0] },
        { t: 0.5, rot: [-0.5, 0, 0] },
      ],
      legR: [
        { t: 0, rot: [0, 0, 0] },
        { t: 0.3, rot: [-0.9, 0, 0] },
        { t: 0.5, rot: [-0.5, 0, 0] },
      ],
      armL: [
        { t: 0, rot: [0, 0, 0.1] },
        { t: 0.3, rot: [0, 0, 2.2] },
        { t: 0.5, rot: [0, 0, 1.8] },
      ],
      armR: [
        { t: 0, rot: [0, 0, -0.1] },
        { t: 0.3, rot: [0, 0, -2.2] },
        { t: 0.5, rot: [0, 0, -1.8] },
      ],
      tail: [
        { t: 0, rot: [0, 0, 0] },
        { t: 0.3, rot: [0.6, 0, 0] },
        { t: 0.5, rot: [0.4, 0, 0] },
      ],
    },
  },

  land: {
    duration: 0.35,
    loop: false,
    tracks: {
      root: [
        { t: 0, pos: [0, 0.1, 0] },
        { t: 0.12, pos: [0, -0.07, 0] },
        { t: 0.35, pos: [0, 0, 0] },
      ],
      torso: [
        { t: 0, scale: [1, 1, 1] },
        { t: 0.12, scale: [1.1, 0.82, 1.1] },
        { t: 0.35, scale: [1, 1, 1] },
      ],
      armL: [
        { t: 0, rot: [0, 0, 1.2] },
        { t: 0.35, rot: [0, 0, 0.1] },
      ],
      armR: [
        { t: 0, rot: [0, 0, -1.2] },
        { t: 0.35, rot: [0, 0, -0.1] },
      ],
    },
  },

  hit: {
    duration: 0.4,
    loop: false,
    tracks: {
      root: [
        { t: 0, pos: [0, 0, 0] },
        { t: 0.1, pos: [0, 0, -0.09] },
        { t: 0.4, pos: [0, 0, 0] },
      ],
      torso: [
        { t: 0, rot: [0, 0, 0] },
        { t: 0.1, rot: [-0.25, 0, 0] },
        { t: 0.4, rot: [0, 0, 0] },
      ],
      head: [
        { t: 0, rot: [0, 0, 0] },
        { t: 0.1, rot: [-0.45, 0, 0.12] },
        { t: 0.25, rot: [0.15, 0, -0.08] },
        { t: 0.4, rot: [0, 0, 0] },
      ],
      earL: [
        { t: 0, rot: [0, 0, 0] },
        { t: 0.1, rot: [0, 0, 0.4] },
        { t: 0.4, rot: [0, 0, 0] },
      ],
      earR: [
        { t: 0, rot: [0, 0, 0] },
        { t: 0.1, rot: [0, 0, -0.4] },
        { t: 0.4, rot: [0, 0, 0] },
      ],
    },
  },

  cheer: {
    duration: 0.9,
    loop: true,
    tracks: {
      root: [
        { t: 0, pos: [0, 0, 0] },
        { t: 0.225, pos: [0, 0.09, 0] },
        { t: 0.45, pos: [0, 0, 0] },
        { t: 0.675, pos: [0, 0.09, 0] },
        { t: 0.9, pos: [0, 0, 0] },
      ],
      armL: [
        { t: 0, rot: [0, 0, 2.5] },
        { t: 0.45, rot: [0, 0, 1.7] },
        { t: 0.9, rot: [0, 0, 2.5] },
      ],
      armR: [
        { t: 0, rot: [0, 0, -1.7] },
        { t: 0.45, rot: [0, 0, -2.5] },
        { t: 0.9, rot: [0, 0, -1.7] },
      ],
      head: [
        { t: 0, rot: [-0.2, 0, 0] },
        { t: 0.9, rot: [-0.2, 0, 0] },
      ],
      tail: [
        { t: 0, rot: [0.5, 0.3, 0] },
        { t: 0.45, rot: [0.5, -0.3, 0] },
        { t: 0.9, rot: [0.5, 0.3, 0] },
      ],
    },
  },

  sad: {
    duration: 2,
    loop: true,
    tracks: {
      torso: [
        { t: 0, rot: [0.25, 0, 0] },
        { t: 2, rot: [0.25, 0, 0] },
      ],
      head: [
        { t: 0, rot: [0.5, 0, -0.06] },
        { t: 1, rot: [0.55, 0, 0.06] },
        { t: 2, rot: [0.5, 0, -0.06] },
      ],
      armL: [
        { t: 0, rot: [0.15, 0, 0.22] },
        { t: 2, rot: [0.15, 0, 0.22] },
      ],
      armR: [
        { t: 0, rot: [0.15, 0, -0.22] },
        { t: 2, rot: [0.15, 0, -0.22] },
      ],
      tail: [
        { t: 0, rot: [-0.55, 0.08, 0] },
        { t: 1, rot: [-0.6, -0.08, 0] },
        { t: 2, rot: [-0.55, 0.08, 0] },
      ],
      earL: [
        { t: 0, rot: [0, 0, 0.3] },
        { t: 2, rot: [0, 0, 0.3] },
      ],
      earR: [
        { t: 0, rot: [0, 0, -0.3] },
        { t: 2, rot: [0, 0, -0.3] },
      ],
    },
  },

  /* ---- victory variants (picked by char id hash) ------------------ */

  /** Fist-pump hops. */
  victory_0: {
    duration: 0.8,
    loop: true,
    tracks: {
      root: [
        { t: 0, pos: [0, 0, 0] },
        { t: 0.2, pos: [0, 0.12, 0] },
        { t: 0.4, pos: [0, 0, 0] },
        { t: 0.6, pos: [0, 0.12, 0] },
        { t: 0.8, pos: [0, 0, 0] },
      ],
      armR: [
        { t: 0, rot: [0, 0, -2.7] },
        { t: 0.4, rot: [0, 0, -1.9] },
        { t: 0.8, rot: [0, 0, -2.7] },
      ],
      armL: [
        { t: 0, rot: [0, 0, 0.5] },
        { t: 0.8, rot: [0, 0, 0.5] },
      ],
      head: [
        { t: 0, rot: [-0.25, 0, 0] },
        { t: 0.8, rot: [-0.25, 0, 0] },
      ],
      tail: [
        { t: 0, rot: [0.5, 0.35, 0] },
        { t: 0.4, rot: [0.5, -0.35, 0] },
        { t: 0.8, rot: [0.5, 0.35, 0] },
      ],
    },
  },

  /** Full spin with open arms. */
  victory_1: {
    duration: 1.2,
    loop: true,
    tracks: {
      root: [
        { t: 0, rot: [0, 0, 0], pos: [0, 0, 0] },
        { t: 0.6, rot: [0, TAU / 2, 0], pos: [0, 0.1, 0] },
        { t: 1.2, rot: [0, TAU, 0], pos: [0, 0, 0] },
      ],
      armL: [
        { t: 0, rot: [0, 0, 1.4] },
        { t: 1.2, rot: [0, 0, 1.4] },
      ],
      armR: [
        { t: 0, rot: [0, 0, -1.4] },
        { t: 1.2, rot: [0, 0, -1.4] },
      ],
      tail: [
        { t: 0, rot: [0.4, 0, 0] },
        { t: 1.2, rot: [0.4, 0, 0] },
      ],
    },
  },

  /** Chest-drumming (gorilla style). */
  victory_2: {
    duration: 0.6,
    loop: true,
    tracks: {
      armL: [
        { t: 0, rot: [-1.5, 0, 0.7] },
        { t: 0.15, rot: [-1.1, 0, 0.25] },
        { t: 0.3, rot: [-1.5, 0, 0.7] },
        { t: 0.6, rot: [-1.5, 0, 0.7] },
      ],
      armR: [
        { t: 0, rot: [-1.5, 0, -0.7] },
        { t: 0.3, rot: [-1.5, 0, -0.7] },
        { t: 0.45, rot: [-1.1, 0, -0.25] },
        { t: 0.6, rot: [-1.5, 0, -0.7] },
      ],
      head: [
        { t: 0, rot: [-0.3, 0, 0] },
        { t: 0.6, rot: [-0.3, 0, 0] },
      ],
      torso: [
        { t: 0, scale: [1.04, 1, 1.04] },
        { t: 0.6, scale: [1.04, 1, 1.04] },
      ],
    },
  },

  /* ---- lose variants ---------------------------------------------- */

  /** Slumped head-shake. */
  lose_0: {
    duration: 1.6,
    loop: true,
    tracks: {
      root: [
        { t: 0, pos: [0, -0.05, 0] },
        { t: 1.6, pos: [0, -0.05, 0] },
      ],
      torso: [
        { t: 0, rot: [0.35, 0, 0] },
        { t: 1.6, rot: [0.35, 0, 0] },
      ],
      head: [
        { t: 0, rot: [0.55, -0.25, 0] },
        { t: 0.8, rot: [0.55, 0.25, 0] },
        { t: 1.6, rot: [0.55, -0.25, 0] },
      ],
      armL: [
        { t: 0, rot: [0.2, 0, 0.25] },
        { t: 1.6, rot: [0.2, 0, 0.25] },
      ],
      armR: [
        { t: 0, rot: [0.2, 0, -0.25] },
        { t: 1.6, rot: [0.2, 0, -0.25] },
      ],
      tail: [
        { t: 0, rot: [-0.6, 0, 0] },
        { t: 1.6, rot: [-0.6, 0, 0] },
      ],
    },
  },

  /** Collapse into a defeated sit. */
  lose_1: {
    duration: 1.2,
    loop: false,
    tracks: {
      root: [
        { t: 0, pos: [0, 0, 0] },
        { t: 0.4, pos: [0, -0.3, 0] },
        { t: 1.2, pos: [0, -0.3, 0] },
      ],
      legL: [
        { t: 0, rot: [0, 0, 0] },
        { t: 0.4, rot: [-1.35, 0.25, 0] },
        { t: 1.2, rot: [-1.35, 0.25, 0] },
      ],
      legR: [
        { t: 0, rot: [0, 0, 0] },
        { t: 0.4, rot: [-1.35, -0.25, 0] },
        { t: 1.2, rot: [-1.35, -0.25, 0] },
      ],
      torso: [
        { t: 0, rot: [0, 0, 0] },
        { t: 0.5, rot: [0.3, 0, 0] },
        { t: 1.2, rot: [0.3, 0, 0] },
      ],
      head: [
        { t: 0, rot: [0, 0, 0] },
        { t: 0.6, rot: [0.6, 0, 0] },
        { t: 1.2, rot: [0.6, 0, 0] },
      ],
      armL: [
        { t: 0, rot: [0, 0, 0.1] },
        { t: 0.5, rot: [0.35, 0, 0.3] },
        { t: 1.2, rot: [0.35, 0, 0.3] },
      ],
      armR: [
        { t: 0, rot: [0, 0, -0.1] },
        { t: 0.5, rot: [0.35, 0, -0.3] },
        { t: 1.2, rot: [0.35, 0, -0.3] },
      ],
    },
  },

  /* ---- emotes ------------------------------------------------------ */

  dance: {
    duration: 1.6,
    loop: true,
    tracks: {
      root: [
        { t: 0, rot: [0, -0.45, 0], pos: [0, 0, 0] },
        { t: 0.4, rot: [0, 0, 0], pos: [0, 0.07, 0] },
        { t: 0.8, rot: [0, 0.45, 0], pos: [0, 0, 0] },
        { t: 1.2, rot: [0, 0, 0], pos: [0, 0.07, 0] },
        { t: 1.6, rot: [0, -0.45, 0], pos: [0, 0, 0] },
      ],
      armL: [
        { t: 0, rot: [0, 0, 2.3] },
        { t: 0.8, rot: [0, 0, 0.4] },
        { t: 1.6, rot: [0, 0, 2.3] },
      ],
      armR: [
        { t: 0, rot: [0, 0, -0.4] },
        { t: 0.8, rot: [0, 0, -2.3] },
        { t: 1.6, rot: [0, 0, -0.4] },
      ],
      head: [
        { t: 0, rot: [0, 0, 0.15] },
        { t: 0.8, rot: [0, 0, -0.15] },
        { t: 1.6, rot: [0, 0, 0.15] },
      ],
      tail: [
        { t: 0, rot: [0.3, 0.4, 0] },
        { t: 0.8, rot: [0.3, -0.4, 0] },
        { t: 1.6, rot: [0.3, 0.4, 0] },
      ],
    },
  },

  taunt: {
    duration: 1,
    loop: true,
    tracks: {
      armR: [
        { t: 0, rot: [-1.7, 0, -0.2] },
        { t: 0.5, rot: [-1.3, 0, -0.2] },
        { t: 1, rot: [-1.7, 0, -0.2] },
      ],
      handR: [
        { t: 0, rot: [0, 0, 0.5] },
        { t: 0.5, rot: [0, 0, -0.5] },
        { t: 1, rot: [0, 0, 0.5] },
      ],
      armL: [
        { t: 0, rot: [0, 0, 0.9] },
        { t: 1, rot: [0, 0, 0.9] },
      ],
      head: [
        { t: 0, rot: [-0.1, 0.2, 0.15] },
        { t: 1, rot: [-0.1, 0.2, 0.15] },
      ],
      torso: [
        { t: 0, rot: [0, 0.15, 0] },
        { t: 1, rot: [0, 0.15, 0] },
      ],
    },
  },

  laugh: {
    duration: 0.7,
    loop: true,
    tracks: {
      torso: [
        { t: 0, scale: [1, 1, 1] },
        { t: 0.175, scale: [1.03, 0.93, 1.03] },
        { t: 0.35, scale: [1, 1, 1] },
        { t: 0.525, scale: [1.03, 0.93, 1.03] },
        { t: 0.7, scale: [1, 1, 1] },
      ],
      head: [
        { t: 0, rot: [-0.35, 0, 0] },
        { t: 0.35, rot: [-0.2, 0, 0] },
        { t: 0.7, rot: [-0.35, 0, 0] },
      ],
      armL: [
        { t: 0, rot: [-0.5, 0, 0.5] },
        { t: 0.7, rot: [-0.5, 0, 0.5] },
      ],
      armR: [
        { t: 0, rot: [-0.5, 0, -0.5] },
        { t: 0.7, rot: [-0.5, 0, -0.5] },
      ],
    },
  },

  cry: {
    duration: 1.4,
    loop: true,
    tracks: {
      armL: [
        { t: 0, rot: [-2.3, 0, 0.35] },
        { t: 1.4, rot: [-2.3, 0, 0.35] },
      ],
      armR: [
        { t: 0, rot: [-2.3, 0, -0.35] },
        { t: 1.4, rot: [-2.3, 0, -0.35] },
      ],
      head: [
        { t: 0, rot: [0.4, 0, -0.08] },
        { t: 0.35, rot: [0.45, 0, 0.08] },
        { t: 0.7, rot: [0.4, 0, -0.08] },
        { t: 1.05, rot: [0.45, 0, 0.08] },
        { t: 1.4, rot: [0.4, 0, -0.08] },
      ],
      torso: [
        { t: 0, scale: [1, 1, 1] },
        { t: 0.35, scale: [1, 0.97, 1] },
        { t: 0.7, scale: [1, 1, 1] },
        { t: 1.05, scale: [1, 0.97, 1] },
        { t: 1.4, scale: [1, 1, 1] },
      ],
      tail: [
        { t: 0, rot: [-0.6, 0, 0] },
        { t: 1.4, rot: [-0.6, 0, 0] },
      ],
    },
  },

  flex: {
    duration: 1.2,
    loop: true,
    tracks: {
      armL: [
        { t: 0, rot: [0, 0, 2.05] },
        { t: 0.6, rot: [0, 0, 2.35] },
        { t: 1.2, rot: [0, 0, 2.05] },
      ],
      armR: [
        { t: 0, rot: [0, 0, -2.05] },
        { t: 0.6, rot: [0, 0, -2.35] },
        { t: 1.2, rot: [0, 0, -2.05] },
      ],
      handL: [
        { t: 0, pos: [0.05, 0.14, 0] },
        { t: 1.2, pos: [0.05, 0.14, 0] },
      ],
      handR: [
        { t: 0, pos: [-0.05, 0.14, 0] },
        { t: 1.2, pos: [-0.05, 0.14, 0] },
      ],
      torso: [
        { t: 0, scale: [1.05, 1, 1.05] },
        { t: 0.6, scale: [1.09, 0.99, 1.09] },
        { t: 1.2, scale: [1.05, 1, 1.05] },
      ],
      head: [
        { t: 0, rot: [-0.15, 0, 0] },
        { t: 1.2, rot: [-0.15, 0, 0] },
      ],
    },
  },

  facepalm: {
    duration: 1.5,
    loop: false,
    tracks: {
      armR: [
        { t: 0, rot: [0, 0, -0.1] },
        { t: 0.35, rot: [-2.55, 0, -0.35] },
        { t: 1.5, rot: [-2.55, 0, -0.35] },
      ],
      head: [
        { t: 0, rot: [0, 0, 0] },
        { t: 0.4, rot: [0.42, 0, 0] },
        { t: 1.5, rot: [0.42, 0, 0] },
      ],
      torso: [
        { t: 0, rot: [0, 0, 0] },
        { t: 0.4, rot: [0.12, 0, 0] },
        { t: 1.5, rot: [0.12, 0, 0] },
      ],
      earL: [
        { t: 0, rot: [0, 0, 0] },
        { t: 0.4, rot: [0, 0, 0.25] },
        { t: 1.5, rot: [0, 0, 0.25] },
      ],
      earR: [
        { t: 0, rot: [0, 0, 0] },
        { t: 0.4, rot: [0, 0, -0.25] },
        { t: 1.5, rot: [0, 0, -0.25] },
      ],
    },
  },
};

/** Number of victory / lose variants shipped above. */
export const VICTORY_VARIANTS = 3;
export const LOSE_VARIANTS = 2;

/** All clip names (including resolved variants). */
export function clipNames() {
  return Object.keys(CLIPS);
}

/**
 * Resolve a clip by name. 'victory' and 'lose' resolve to a deterministic
 * per-character variant via the char id hash; every other name looks up
 * CLIPS directly. Returns null for unknown names.
 *
 * @param {string} name Clip name, e.g. 'idle', 'victory', 'dance'.
 * @param {string} [charId] Character id (variant selection only).
 * @returns {{duration: number, loop: boolean, tracks: Object}|null}
 */
export function getClip(name, charId = '') {
  if (name === 'victory') return CLIPS[`victory_${hashId(charId) % VICTORY_VARIANTS}`];
  if (name === 'lose') return CLIPS[`lose_${hashId(charId) % LOSE_VARIANTS}`];
  return CLIPS[name] ?? null;
}

export default CLIPS;
