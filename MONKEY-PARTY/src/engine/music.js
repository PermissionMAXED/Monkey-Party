/**
 * Data-driven procedural music sequencer for MONKEY-PARTY.
 *
 * playTheme({ tempo, scale, pattern }) loops a 16th-note step pattern through
 * the shared AudioContext from src/engine/audio.js (music bus):
 *   - tempo: BPM. Each step is a 16th note (tempo/60/4 sec).
 *   - scale: semitone offsets, e.g. [0,2,4,7,9]; `note` values are scale
 *     degrees (negative/overflow degrees shift octaves). `root` (optional)
 *     is the base frequency in Hz (default 220).
 *   - pattern: [{ step, note, len, wave, vol }]. len is in steps.
 *     wave 'noise' = percussion: note 0 = kick, 1 = snare, 2+ = hi-hat.
 *     Other waves play two detuned oscillator layers per note.
 *   - steps (optional): loop length in steps (default: fits the pattern,
 *     rounded up to a multiple of 16).
 *
 * stop(fadeSec) fades out and stops; duck(on) dips the music (e.g. under
 * dialogue or fanfares). Three fallback themes ship in FALLBACK_THEMES:
 * 'menu', 'board_generic', 'minigame_generic'.
 */

import { initAudio, getContext, getMusicBus } from './audio.js';

const LOOKAHEAD_SEC = 0.15;
const TIMER_MS = 40;
const DETUNE_CENTS = 7;

/** @type {null | { gain: GainNode, duckGain: GainNode, timer: *, theme: Object }} */
let current = null;
let noiseBuf = null;

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
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 0.3);
  gain.connect(duckGain).connect(bus);

  let nextStep = 0;
  let nextTime = ctx.currentTime + 0.05;

  const timer = setInterval(() => {
    while (nextTime < ctx.currentTime + LOOKAHEAD_SEC) {
      const events = byStep.get(nextStep);
      if (events) {
        for (const ev of events) scheduleNote(ctx, gain, ev, nextTime, stepDur, theme);
      }
      nextTime += stepDur;
      nextStep = (nextStep + 1) % theme.steps;
    }
  }, TIMER_MS);

  current = { gain, duckGain, timer, theme };
  return current;
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
/* Fallback themes                                                     */
/* ------------------------------------------------------------------ */

function ev(step, note, len = 1, wave = 'square', vol = 0.5) {
  return { step, note, len, wave, vol };
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
  // Marimba-ish minor-pentatonic arps.
  const arp = [0, 2, 4, 2, 1, 3, 5, 3];
  for (let bar = 0; bar < 4; bar += 1) {
    for (let i = 0; i < 8; i += 1) {
      pattern.push(ev(bar * 8 + i, arp[i] + (bar === 2 ? 1 : 0), 1, 'triangle', 0.32));
    }
  }
  // Bass roots.
  for (const [i, deg] of [0, 0, 1, -1].entries()) pattern.push(ev(i * 8, deg - 5, 7, 'square', 0.4));
  // Kick + hat groove.
  for (let s = 0; s < 32; s += 8) pattern.push(ev(s, 0, 1, 'noise', 0.5));
  for (let s = 4; s < 32; s += 8) pattern.push(ev(s, 1, 1, 'noise', 0.3));
  for (let s = 2; s < 32; s += 4) pattern.push(ev(s, 2, 1, 'noise', 0.14));
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

/** Built-in fallback themes: menu, board_generic, minigame_generic. */
export const FALLBACK_THEMES = {
  menu: buildMenuTheme(),
  board_generic: buildBoardTheme(),
  minigame_generic: buildMinigameTheme(),
};
