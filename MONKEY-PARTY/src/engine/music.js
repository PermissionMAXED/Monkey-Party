/**
 * Data-driven procedural music sequencer for MONKEY-PARTY.
 *
 * playTheme({ tempo, scale, pattern }) loops a 16th-note step pattern through
 * the shared AudioContext from src/engine/audio.js (music bus):
 *   - tempo: BPM. Each step is a 16th note (tempo/60/4 sec).
 *   - scale: semitone offsets, e.g. [0,2,4,7,9]; `note` values are scale
 *     degrees (negative/overflow degrees shift octaves). `root` (optional)
 *     is the base frequency in Hz (default 220).
 *   - pattern: [{ step, note, len, wave, vol, minIntensity }]. len is in
 *     steps. wave 'noise' = percussion: note 0 = kick, 1 = snare, 2+ =
 *     hi-hat. Other waves play two detuned oscillator layers per note.
 *     minIntensity (optional, 0..1) tags a note as an intensity layer: it
 *     only schedules while the current intensity (setIntensity) is >= the
 *     tag, so music thickens live (drums/bass untagged = always play; arps
 *     and leads tagged higher).
 *   - steps (optional): loop length in steps (default: fits the pattern,
 *     rounded up to a multiple of 16).
 *
 * Dynamic-music additions:
 *   - setIntensity(v 0..1) drives the intensity layers live (default 0.5).
 *   - stinger(name) plays a short one-shot phrase ('star', 'gameover',
 *     'win', 'lose', 'countdown') and briefly ducks the loop under it.
 *     Unknown names are silent no-ops.
 *
 * stop(fadeSec) fades out and stops; duck(on) dips the music (e.g. under
 * dialogue or fanfares). Fallback themes ship in FALLBACK_THEMES:
 * 'menu', 'board_generic', 'minigame_generic', 'victory', 'board_spooky',
 * 'board_ice', 'board_city', 'minigame_tense' - all selectable by name via
 * playTheme('board_spooky').
 */

import { initAudio, getContext, getMusicBus } from './audio.js';

const LOOKAHEAD_SEC = 0.15;
const TIMER_MS = 40;
const DETUNE_CENTS = 7;

/** @type {null | { gain: GainNode, duckGain: GainNode, stingerDuck: GainNode, timer: *, theme: Object }} */
let current = null;
let noiseBuf = null;

/** Live intensity for tagged pattern layers (0..1). */
let intensity = 0.5;

function getNoise(ctx) {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function degreeToFreq(root, scale, degree) {
  const n = scale.length;
  const idx = ((degree % n) + n) % n;
  const octave = Math.floor(degree / n);
  return root * 2 ** ((scale[idx] + octave * 12) / 12);
}

function scheduleNote(ctx, out, ev, t, stepDur, theme) {
  const dur = Math.max(0.05, (ev.len ?? 1) * stepDur);
  const vol = ev.vol ?? 0.5;

  if (ev.wave === 'noise') {
    // Percussion: note 0 = kick, 1 = snare, 2+ = hat.
    const src = ctx.createBufferSource();
    src.buffer = getNoise(ctx);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    if ((ev.note ?? 2) === 0) {
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(220, t);
      filter.frequency.exponentialRampToValueAtTime(50, t + 0.12);
    } else if (ev.note === 1) {
      filter.type = 'bandpass';
      filter.frequency.value = 1800;
      filter.Q.value = 0.8;
    } else {
      filter.type = 'highpass';
      filter.frequency.value = 6500;
    }
    const d = Math.min(dur, ev.note === 0 ? 0.14 : ev.note === 1 ? 0.12 : 0.05);
    gain.gain.setValueAtTime(vol * 0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(filter).connect(gain).connect(out);
    src.start(t);
    src.stop(t + d + 0.05);
    if ((ev.note ?? 2) === 0) {
      // Add a sine thump under the kick.
      const osc = ctx.createOscillator();
      const og = ctx.createGain();
      osc.frequency.setValueAtTime(130, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      og.gain.setValueAtTime(vol * 0.7, t);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      osc.connect(og).connect(out);
      osc.start(t);
      osc.stop(t + 0.2);
    }
    return;
  }

  const freq = degreeToFreq(theme.root, theme.scale, ev.note ?? 0);
  for (const detune of [-DETUNE_CENTS, DETUNE_CENTS]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = ev.wave ?? 'square';
    osc.frequency.value = freq;
    osc.detune.value = detune;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol * 0.22, t + 0.015);
    gain.gain.setValueAtTime(vol * 0.22, t + Math.max(0.02, dur - 0.05));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }
}

function normalizeTheme(themeOrName) {
  const theme = typeof themeOrName === 'string'
    ? FALLBACK_THEMES[themeOrName] ?? FALLBACK_THEMES.menu
    : themeOrName ?? FALLBACK_THEMES.menu;
  const pattern = Array.isArray(theme.pattern) ? theme.pattern : [];
  let steps = theme.steps;
  if (!steps) {
    const last = pattern.reduce((m, ev) => Math.max(m, (ev.step ?? 0) + (ev.len ?? 1)), 16);
    steps = Math.ceil(last / 16) * 16;
  }
  return {
    tempo: theme.tempo ?? 110,
    scale: Array.isArray(theme.scale) && theme.scale.length ? theme.scale : [0, 2, 4, 7, 9],
    root: theme.root ?? 220,
    pattern,
    steps,
  };
}

/**
 * Start looping a theme (name or {tempo,scale,pattern} object). Replaces any
 * currently playing theme with a quick crossfade.
 */
export function playTheme(themeOrName) {
  initAudio();
  const ctx = getContext();
  const bus = getMusicBus();
  if (!ctx || !bus) return null;

  stop(0.15);

  const theme = normalizeTheme(themeOrName);
  const stepDur = 60 / theme.tempo / 4;

  // Bucket events by step for fast lookup.
  const byStep = new Map();
  for (const ev of theme.pattern) {
    const s = ((ev.step ?? 0) % theme.steps + theme.steps) % theme.steps;
    if (!byStep.has(s)) byStep.set(s, []);
    byStep.get(s).push(ev);
  }

  const gain = ctx.createGain();
  const duckGain = ctx.createGain();
  const stingerDuck = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 0.3);
  gain.connect(duckGain).connect(stingerDuck).connect(bus);

  let nextStep = 0;
  let nextTime = ctx.currentTime + 0.05;

  const timer = setInterval(() => {
    while (nextTime < ctx.currentTime + LOOKAHEAD_SEC) {
      const events = byStep.get(nextStep);
      if (events) {
        for (const ev of events) {
          // Intensity layers: tagged notes only schedule while the live
          // intensity is at or above their tag (evaluated per loop pass).
          if (ev.minIntensity != null && intensity < ev.minIntensity) continue;
          scheduleNote(ctx, gain, ev, nextTime, stepDur, theme);
        }
      }
      nextTime += stepDur;
      nextStep = (nextStep + 1) % theme.steps;
    }
  }, TIMER_MS);

  current = { gain, duckGain, stingerDuck, timer, theme };
  return current;
}

/**
 * Set the dynamic-music intensity (0..1, clamped; default 0.5). Pattern notes
 * tagged with { minIntensity } only play while intensity >= their tag, so the
 * running loop thickens/thins live without restarting.
 * @param {number} v
 */
export function setIntensity(v) {
  const n = Number(v);
  intensity = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : intensity;
}

/** Current dynamic-music intensity (0..1). */
export function getIntensity() {
  return intensity;
}

/**
 * Fade out and stop the current theme.
 * @param {number} [fadeSec]
 */
export function stop(fadeSec = 0.4) {
  if (!current) return;
  const ctx = getContext();
  const { gain, timer } = current;
  current = null;
  clearInterval(timer);
  if (!ctx) return;
  const t = ctx.currentTime;
  gain.gain.cancelScheduledValues(t);
  gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.02, fadeSec));
  setTimeout(() => gain.disconnect(), (fadeSec + 0.1) * 1000);
}

/**
 * Duck (dip) the music, e.g. under announcements or big SFX.
 * @param {boolean} on
 */
export function duck(on) {
  if (!current) return;
  const ctx = getContext();
  if (!ctx) return;
  current.duckGain.gain.setTargetAtTime(on ? 0.3 : 1, ctx.currentTime, 0.12);
}

/* ------------------------------------------------------------------ */
/* Stingers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Short one-shot phrases, scheduled immediately on the music bus. Each is a
 * mini-theme { tempo, root, scale, pattern } played exactly once.
 */
const STINGERS = {
  // Bright ascending sparkle (star get / big pickup).
  star: {
    tempo: 150,
    root: 262,
    scale: [0, 2, 4, 7, 9],
    pattern: [
      ev(0, 0, 1, 'square', 0.3), ev(1, 2, 1, 'square', 0.3),
      ev(2, 4, 1, 'square', 0.32), ev(3, 5, 1, 'square', 0.34),
      ev(4, 7, 4, 'sine', 0.4), ev(4, 9, 4, 'triangle', 0.26),
      ev(0, 2, 1, 'noise', 0.14), ev(2, 2, 1, 'noise', 0.14), ev(4, 1, 1, 'noise', 0.3),
    ],
  },
  // Short triumphant fanfare.
  win: {
    tempo: 132,
    root: 262,
    scale: [0, 2, 4, 5, 7, 9, 11],
    pattern: [
      ev(0, 0, 2, 'square', 0.32), ev(2, 2, 2, 'square', 0.32),
      ev(4, 4, 2, 'square', 0.34), ev(6, 7, 6, 'square', 0.4),
      ev(6, 4, 6, 'triangle', 0.3), ev(6, 2, 6, 'triangle', 0.22),
      ev(0, 0, 1, 'noise', 0.4), ev(6, 1, 1, 'noise', 0.35),
    ],
  },
  // Drooping descend (missed it / last place).
  lose: {
    tempo: 96,
    root: 220,
    scale: [0, 2, 3, 5, 7, 8, 10],
    pattern: [
      ev(0, 4, 2, 'triangle', 0.32), ev(2, 2, 2, 'triangle', 0.3),
      ev(4, 1, 2, 'triangle', 0.28), ev(6, 0, 5, 'triangle', 0.3),
      ev(6, -7, 5, 'sine', 0.32),
    ],
  },
  // Slow dramatic minor cadence.
  gameover: {
    tempo: 76,
    root: 196,
    scale: [0, 2, 3, 5, 7, 8, 11],
    pattern: [
      ev(0, 0, 3, 'square', 0.3), ev(0, -7, 3, 'triangle', 0.34),
      ev(4, -1, 3, 'square', 0.28), ev(8, -2, 3, 'square', 0.28),
      ev(12, -7, 8, 'triangle', 0.4), ev(12, 0, 8, 'sine', 0.26),
      ev(12, 0, 1, 'noise', 0.4),
    ],
  },
  // "3, 2, 1..." style tick-tick-GO.
  countdown: {
    tempo: 120,
    root: 440,
    scale: [0, 2, 4, 7, 9],
    pattern: [
      ev(0, 0, 1, 'sine', 0.34), ev(4, 0, 1, 'sine', 0.34),
      ev(8, 0, 1, 'sine', 0.34), ev(12, 5, 4, 'square', 0.4),
      ev(0, 2, 1, 'noise', 0.18), ev(4, 2, 1, 'noise', 0.18),
      ev(8, 2, 1, 'noise', 0.18), ev(12, 1, 1, 'noise', 0.3),
    ],
  },
};

/** Available stinger names (for tooling/tests). */
export const STINGER_NAMES = Object.freeze(Object.keys(STINGERS));

/**
 * Play a short one-shot phrase on the music bus, briefly ducking the looping
 * theme underneath it. Unknown names are silent no-ops (never throw).
 * @param {'star'|'gameover'|'win'|'lose'|'countdown'|string} name
 */
export function stinger(name) {
  initAudio();
  const ctx = getContext();
  const bus = getMusicBus();
  if (!ctx || !bus) return;
  const def = STINGERS[name];
  if (!def) return;

  const out = ctx.createGain();
  out.connect(bus);
  const t0 = ctx.currentTime + 0.02;
  const stepDur = 60 / def.tempo / 4;
  const theme = { root: def.root ?? 220, scale: def.scale ?? [0, 2, 4, 7, 9] };
  let endStep = 0;
  for (const note of def.pattern) {
    scheduleNote(ctx, out, note, t0 + (note.step ?? 0) * stepDur, stepDur, theme);
    endStep = Math.max(endStep, (note.step ?? 0) + (note.len ?? 1));
  }
  const durSec = endStep * stepDur + 0.25;

  // Duck the loop under the stinger, then recover before it fully ends.
  if (current) {
    const g = current.stingerDuck.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setTargetAtTime(0.35, ctx.currentTime, 0.05);
    g.setTargetAtTime(1, t0 + durSec * 0.75, 0.18);
  }
  setTimeout(() => out.disconnect(), (durSec + 1) * 1000);
}

/* ------------------------------------------------------------------ */
/* Fallback themes                                                     */
/* ------------------------------------------------------------------ */

function ev(step, note, len = 1, wave = 'square', vol = 0.5, minIntensity) {
  return { step, note, len, wave, vol, minIntensity };
}

function buildMenuTheme() {
  const pattern = [];
  // Laid-back bass every half note.
  for (const [i, deg] of [0, 0, -2, -1].entries()) {
    pattern.push(ev(i * 8, deg - 5, 6, 'triangle', 0.55));
  }
  // Sparse pentatonic melody.
  const melody = [[0, 2], [3, 3], [6, 4], [10, 2], [12, 5], [16, 4], [19, 3], [22, 2], [26, 1], [28, 2]];
  for (const [step, deg] of melody) pattern.push(ev(step, deg, 2, 'sine', 0.4));
  // Soft hats on off-beats.
  for (let s = 2; s < 32; s += 4) pattern.push(ev(s, 2, 1, 'noise', 0.16));
  return { tempo: 92, root: 196, scale: [0, 2, 4, 7, 9], pattern, steps: 32 };
}

function buildBoardTheme() {
  const pattern = [];
  // Always-on layer: bass roots + kick/snare groove.
  for (const [i, deg] of [0, 0, 1, -1].entries()) pattern.push(ev(i * 8, deg - 5, 7, 'square', 0.4));
  for (let s = 0; s < 32; s += 8) pattern.push(ev(s, 0, 1, 'noise', 0.5));
  for (let s = 4; s < 32; s += 8) pattern.push(ev(s, 1, 1, 'noise', 0.3));
  // Marimba-ish minor-pentatonic arps (mid intensity).
  const arp = [0, 2, 4, 2, 1, 3, 5, 3];
  for (let bar = 0; bar < 4; bar += 1) {
    for (let i = 0; i < 8; i += 1) {
      pattern.push(ev(bar * 8 + i, arp[i] + (bar === 2 ? 1 : 0), 1, 'triangle', 0.32, 0.35));
    }
  }
  // Off-beat hats join at mid intensity, lead line only near full tilt.
  for (let s = 2; s < 32; s += 4) pattern.push(ev(s, 2, 1, 'noise', 0.14, 0.35));
  const lead = [[0, 7], [3, 9], [8, 8], [12, 7], [16, 9], [19, 10], [24, 8], [28, 7]];
  for (const [step, deg] of lead) pattern.push(ev(step, deg, 2, 'square', 0.2, 0.75));
  for (let s = 0; s < 32; s += 2) pattern.push(ev(s + 1, 2, 1, 'noise', 0.08, 0.75));
  return { tempo: 112, root: 220, scale: [0, 3, 5, 7, 10], pattern, steps: 32 };
}

function buildMinigameTheme() {
  const pattern = [];
  // Driving 8th-note bass.
  const bassLine = [0, 0, 3, 0, 4, 0, 3, 2];
  for (let bar = 0; bar < 2; bar += 1) {
    for (let i = 0; i < 8; i += 1) {
      pattern.push(ev(bar * 16 + i * 2, bassLine[i] - 7, 2, 'sawtooth', 0.4));
    }
  }
  // Energetic melody stabs.
  const melody = [[0, 7], [2, 7], [6, 9], [8, 8], [12, 7], [16, 10], [18, 9], [22, 8], [24, 7], [28, 9]];
  for (const [step, deg] of melody) pattern.push(ev(step, deg, 2, 'square', 0.3));
  // Four-on-the-floor kick, snare backbeat, 8th hats.
  for (let s = 0; s < 32; s += 4) pattern.push(ev(s, 0, 1, 'noise', 0.55));
  for (let s = 4; s < 32; s += 8) pattern.push(ev(s, 1, 1, 'noise', 0.35));
  for (let s = 0; s < 32; s += 2) pattern.push(ev(s, 2, 1, 'noise', 0.12));
  return { tempo: 140, root: 262, scale: [0, 2, 4, 5, 7, 9, 11], pattern, steps: 32 };
}

function buildVictoryTheme() {
  const pattern = [];
  // Big major fanfare chords + walking bass (always on).
  const chords = [[0, [0, 2, 4]], [8, [3, 5, 7]], [16, [4, 6, 8]], [24, [0, 2, 4, 7]]];
  for (const [step, degs] of chords) {
    for (const d of degs) pattern.push(ev(step, d, 6, 'square', 0.18));
  }
  for (const [i, deg] of [0, 3, 4, 0].entries()) pattern.push(ev(i * 8, deg - 7, 7, 'triangle', 0.42));
  for (let s = 0; s < 32; s += 4) pattern.push(ev(s, 0, 1, 'noise', 0.45));
  for (let s = 4; s < 32; s += 8) pattern.push(ev(s, 1, 1, 'noise', 0.32));
  // Celebration arps + glitter at higher intensity.
  const arp = [0, 4, 7, 9, 7, 4];
  for (let i = 0; i < 16; i += 1) pattern.push(ev(i * 2, arp[i % arp.length], 1, 'sine', 0.24, 0.4));
  for (let s = 2; s < 32; s += 4) pattern.push(ev(s, 2, 1, 'noise', 0.16, 0.4));
  for (const [i, d] of [9, 11, 12, 14].entries()) pattern.push(ev(i * 8 + 6, d, 2, 'sine', 0.2, 0.7));
  return { tempo: 128, root: 262, scale: [0, 2, 4, 5, 7, 9, 11], pattern, steps: 32 };
}

function buildSpookyTheme() {
  const pattern = [];
  // Slow harmonic-minor dirge: droning low bass + sparse toms (always on).
  for (const [i, deg] of [0, 0, -1, -2].entries()) pattern.push(ev(i * 8, deg - 7, 8, 'triangle', 0.5));
  for (let s = 0; s < 32; s += 16) pattern.push(ev(s, 0, 1, 'noise', 0.4));
  for (let s = 12; s < 32; s += 16) pattern.push(ev(s, 1, 1, 'noise', 0.2));
  // Creeping melody (mid intensity).
  const creep = [[0, 4], [5, 3], [8, 6], [13, 4], [16, 7], [21, 6], [24, 3], [28, 2]];
  for (const [step, deg] of creep) pattern.push(ev(step, deg, 3, 'sine', 0.26, 0.35));
  // Ghostly high wisps + rattling hats (high intensity).
  for (const [i, d] of [11, 13, 12, 14].entries()) pattern.push(ev(i * 8 + 4, d, 3, 'sine', 0.14, 0.7));
  for (let s = 2; s < 32; s += 4) pattern.push(ev(s, 2, 1, 'noise', 0.1, 0.7));
  return { tempo: 88, root: 175, scale: [0, 2, 3, 5, 7, 8, 11], pattern, steps: 32 };
}

function buildIceTheme() {
  const pattern = [];
  // Glassy lydian bells over a soft half-time pulse (always on).
  for (const [i, deg] of [0, 2, 3, 2].entries()) pattern.push(ev(i * 8, deg - 7, 7, 'sine', 0.4));
  for (let s = 0; s < 32; s += 8) pattern.push(ev(s, 0, 1, 'noise', 0.32));
  const bells = [[0, 7], [6, 9], [10, 8], [16, 11], [22, 9], [26, 10]];
  for (const [step, deg] of bells) pattern.push(ev(step, deg, 3, 'sine', 0.24));
  // Shimmering triangle arps (mid) + crystalline hats (high).
  const arp = [7, 9, 11, 14, 11, 9];
  for (let i = 0; i < 16; i += 1) pattern.push(ev(i * 2 + 1, arp[i % arp.length], 1, 'triangle', 0.14, 0.4));
  for (let s = 2; s < 32; s += 4) pattern.push(ev(s, 2, 1, 'noise', 0.1, 0.7));
  for (let s = 4; s < 32; s += 8) pattern.push(ev(s, 1, 1, 'noise', 0.16, 0.7));
  return { tempo: 100, root: 233, scale: [0, 2, 4, 6, 7, 9, 11], pattern, steps: 32 };
}

function buildCityTheme() {
  const pattern = [];
  // Funky dorian groove: syncopated saw bass + tight kit (always on).
  const bassSteps = [[0, 0], [3, 0], [6, 3], [8, 0], [11, 4], [14, 3], [16, 0], [19, 0], [22, 5], [24, 4], [27, 3], [30, 1]];
  for (const [step, deg] of bassSteps) pattern.push(ev(step, deg - 7, 2, 'sawtooth', 0.36));
  for (let s = 0; s < 32; s += 8) pattern.push(ev(s, 0, 1, 'noise', 0.5));
  for (let s = 4; s < 32; s += 8) pattern.push(ev(s, 1, 1, 'noise', 0.34));
  // Off-beat organ stabs (mid) + horn-ish lead (high).
  for (let s = 2; s < 32; s += 8) {
    pattern.push(ev(s, 4, 1, 'square', 0.18, 0.4));
    pattern.push(ev(s, 6, 1, 'square', 0.16, 0.4));
  }
  for (let s = 0; s < 32; s += 2) pattern.push(ev(s, 2, 1, 'noise', 0.1, 0.4));
  const lead = [[0, 9], [3, 10], [6, 9], [12, 7], [16, 9], [20, 12], [24, 11], [28, 9]];
  for (const [step, deg] of lead) pattern.push(ev(step, deg, 2, 'sawtooth', 0.16, 0.75));
  return { tempo: 124, root: 196, scale: [0, 2, 3, 5, 7, 9, 10], pattern, steps: 32 };
}

function buildTenseTheme() {
  const pattern = [];
  // Urgent phrygian pulse: driving 8th bass + relentless kit (always on).
  const bassLine = [0, 0, 1, 0, 0, 3, 1, 0];
  for (let bar = 0; bar < 2; bar += 1) {
    for (let i = 0; i < 8; i += 1) {
      pattern.push(ev(bar * 16 + i * 2, bassLine[i] - 7, 2, 'sawtooth', 0.38));
    }
  }
  for (let s = 0; s < 32; s += 4) pattern.push(ev(s, 0, 1, 'noise', 0.5));
  for (let s = 4; s < 32; s += 8) pattern.push(ev(s, 1, 1, 'noise', 0.32));
  // Nervous stabs (mid) + shrieking 16th hats and alarm lead (high).
  const stabs = [[2, 5], [6, 4], [10, 5], [14, 6], [18, 5], [22, 4], [26, 7], [30, 6]];
  for (const [step, deg] of stabs) pattern.push(ev(step, deg, 1, 'square', 0.2, 0.35));
  for (let s = 0; s < 32; s += 2) pattern.push(ev(s, 2, 1, 'noise', 0.12, 0.6));
  const alarm = [[0, 8], [4, 9], [8, 8], [12, 9], [16, 8], [20, 10], [24, 9], [28, 11]];
  for (const [step, deg] of alarm) pattern.push(ev(step, deg, 2, 'square', 0.16, 0.8));
  return { tempo: 156, root: 220, scale: [0, 1, 3, 5, 7, 8, 10], pattern, steps: 32 };
}

/**
 * Built-in fallback themes, all selectable by name via playTheme(name):
 * menu, board_generic, minigame_generic, victory, board_spooky, board_ice,
 * board_city, minigame_tense.
 */
export const FALLBACK_THEMES = {
  menu: buildMenuTheme(),
  board_generic: buildBoardTheme(),
  minigame_generic: buildMinigameTheme(),
  victory: buildVictoryTheme(),
  board_spooky: buildSpookyTheme(),
  board_ice: buildIceTheme(),
  board_city: buildCityTheme(),
  minigame_tense: buildTenseTheme(),
};
