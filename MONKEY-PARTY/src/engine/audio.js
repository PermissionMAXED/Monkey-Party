/**
 * WebAudio-only synth SFX for MONKEY-PARTY - no audio files, everything is
 * oscillators + filtered noise.
 *
 * initAudio(settingsStore?) creates one shared AudioContext (resumed on the
 * first user gesture) and three gain buses: master -> destination, with
 * music and sfx feeding master. Bus gains track the settings store
 * (masterVolume / musicVolume / sfxVolume).
 *
 * sfx(name, { pitch, vol }) plays one of the named presets; voice(cfg, kind)
 * synthesizes monkey chirps from a CharacterDef voice { pitch, style }.
 */

let ctx = null;
let masterGain = null;
let musicBus = null;
let sfxBus = null;
let noiseBuffer = null;
let settingsUnsub = null;
let gestureBound = false;

function createContext() {
  const AC = typeof window !== 'undefined'
    ? (window.AudioContext || window.webkitAudioContext)
    : (typeof AudioContext !== 'undefined' ? AudioContext : null);
  return AC ? new AC() : null;
}

function bindGestureResume() {
  if (gestureBound || typeof window === 'undefined') return;
  gestureBound = true;
  const resume = () => {
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    window.removeEventListener('pointerdown', resume);
    window.removeEventListener('keydown', resume);
    window.removeEventListener('touchstart', resume);
  };
  window.addEventListener('pointerdown', resume);
  window.addEventListener('keydown', resume);
  window.addEventListener('touchstart', resume);
}

/**
 * Initialize (or return) the shared audio graph. Safe to call repeatedly.
 * @param {{ get: Function, subscribe: Function }} [settingsStore]
 * @returns {{ ctx: AudioContext, masterGain: GainNode, musicBus: GainNode, sfxBus: GainNode }|null}
 */
export function initAudio(settingsStore = null) {
  if (!ctx) {
    ctx = createContext();
    if (!ctx) return null; // No WebAudio (tests/node) - everything no-ops.
    masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.connect(masterGain);
    sfxBus = ctx.createGain();
    sfxBus.connect(masterGain);
    bindGestureResume();
  }
  if (settingsStore && !settingsUnsub) {
    const apply = (s) => {
      const t = ctx.currentTime;
      masterGain.gain.setTargetAtTime(s.masterVolume ?? 0.8, t, 0.05);
      musicBus.gain.setTargetAtTime(s.musicVolume ?? 0.7, t, 0.05);
      sfxBus.gain.setTargetAtTime(s.sfxVolume ?? 0.8, t, 0.05);
    };
    apply(settingsStore.get());
    settingsUnsub = settingsStore.subscribe?.(apply) ?? null;
  }
  return { ctx, masterGain, musicBus, sfxBus };
}

/** Shared AudioContext (null until initAudio() and WebAudio available). */
export function getContext() {
  return ctx;
}

/** Music bus GainNode for the sequencer in src/engine/music.js. */
export function getMusicBus() {
  initAudio();
  return musicBus;
}

/* ------------------------------------------------------------------ */
/* Synth building blocks                                               */
/* ------------------------------------------------------------------ */

function getNoiseBuffer() {
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

/**
 * One enveloped oscillator note.
 * freq -> end over dur (exponential); gain: attack then exponential decay.
 */
function tone(out, t, { freq = 440, end = null, dur = 0.15, type = 'sine', vol = 0.4, attack = 0.005 }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(20, freq), t);
  if (end != null && end !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** Filtered noise burst (percussion, whooshes, splashes). */
function noiseHit(out, t, { dur = 0.2, vol = 0.4, type = 'lowpass', from = 4000, to = null, q = 0.8, attack = 0.003 }) {
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer();
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(Math.max(30, from), t);
  if (to != null && to !== from) filter.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(gain).connect(out);
  src.start(t);
  src.stop(t + dur + 0.05);
}

/** A short "boing" - oscillating pitch curve with decay. */
function boingTone(out, t, { freq = 420, dur = 0.4, vol = 0.4 }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  const steps = 24;
  const curve = new Float32Array(steps);
  for (let i = 0; i < steps; i += 1) {
    const k = i / (steps - 1);
    curve[i] = Math.max(40, freq * (0.4 + 0.6 * Math.exp(-k * 3)) * (1 + Math.sin(k * 22) * 0.35 * (1 - k)));
  }
  osc.frequency.setValueCurveAtTime(curve, t, dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/* ------------------------------------------------------------------ */
/* SFX presets                                                         */
/* ------------------------------------------------------------------ */

/**
 * Each preset: (out, t, p, v) where p multiplies pitch, v multiplies volume.
 */
const PRESETS = {
  dice: (out, t, p, v) => {
    for (let i = 0; i < 3; i += 1) {
      noiseHit(out, t + i * 0.055, { dur: 0.04, vol: 0.28 * v, type: 'highpass', from: 2500 * p });
      tone(out, t + i * 0.055, { freq: (300 + i * 60) * p, dur: 0.05, type: 'square', vol: 0.14 * v });
    }
  },
  coin: (out, t, p, v) => {
    tone(out, t, { freq: 988 * p, dur: 0.07, type: 'square', vol: 0.25 * v });
    tone(out, t + 0.07, { freq: 1319 * p, dur: 0.22, type: 'square', vol: 0.25 * v });
  },
  coinLoss: (out, t, p, v) => {
    tone(out, t, { freq: 660 * p, dur: 0.1, type: 'triangle', vol: 0.3 * v });
    tone(out, t + 0.1, { freq: 494 * p, dur: 0.1, type: 'triangle', vol: 0.28 * v });
    tone(out, t + 0.2, { freq: 330 * p, dur: 0.22, type: 'triangle', vol: 0.26 * v });
  },
  jump: (out, t, p, v) => {
    tone(out, t, { freq: 240 * p, end: 620 * p, dur: 0.18, type: 'square', vol: 0.25 * v });
  },
  land: (out, t, p, v) => {
    tone(out, t, { freq: 130 * p, end: 55 * p, dur: 0.12, type: 'sine', vol: 0.5 * v });
    noiseHit(out, t, { dur: 0.09, vol: 0.2 * v, from: 500 * p, to: 180 * p });
  },
  boing: (out, t, p, v) => boingTone(out, t, { freq: 420 * p, dur: 0.42, vol: 0.35 * v }),
  whoosh: (out, t, p, v) => {
    noiseHit(out, t, { dur: 0.28, vol: 0.35 * v, type: 'bandpass', from: 350 * p, to: 2600 * p, q: 1.6 });
  },
  pop: (out, t, p, v) => {
    tone(out, t, { freq: 520 * p, end: 160 * p, dur: 0.08, type: 'sine', vol: 0.45 * v });
    noiseHit(out, t, { dur: 0.025, vol: 0.15 * v, type: 'highpass', from: 3000 });
  },
  click: (out, t, p, v) => tone(out, t, { freq: 800 * p, dur: 0.04, type: 'square', vol: 0.18 * v }),
  hover: (out, t, p, v) => tone(out, t, { freq: 540 * p, dur: 0.035, type: 'sine', vol: 0.12 * v }),
  buy: (out, t, p, v) => {
    for (const [i, f] of [523, 659, 784].entries()) {
      tone(out, t + i * 0.07, { freq: f * p, dur: 0.09, type: 'square', vol: 0.2 * v });
    }
  },
  error: (out, t, p, v) => {
    tone(out, t, { freq: 170 * p, dur: 0.12, type: 'square', vol: 0.28 * v });
    tone(out, t + 0.15, { freq: 140 * p, dur: 0.18, type: 'square', vol: 0.28 * v });
  },
  star: (out, t, p, v) => {
    for (const [i, f] of [523, 659, 784, 1047, 1319].entries()) {
      tone(out, t + i * 0.07, { freq: f * p, dur: 0.16, type: 'sine', vol: 0.22 * v });
    }
    noiseHit(out, t, { dur: 0.5, vol: 0.06 * v, type: 'highpass', from: 6000 });
  },
  fanfare: (out, t, p, v) => {
    const seq = [[392, 0, 0.14], [523, 0.15, 0.14], [659, 0.3, 0.14], [784, 0.45, 0.5]];
    for (const [f, dt, dur] of seq) {
      tone(out, t + dt, { freq: f * p, dur, type: 'square', vol: 0.2 * v });
      tone(out, t + dt, { freq: f * p * 1.005, dur, type: 'triangle', vol: 0.18 * v });
    }
  },
  drum: (out, t, p, v) => {
    tone(out, t, { freq: 150 * p, end: 42 * p, dur: 0.25, type: 'sine', vol: 0.6 * v, attack: 0.002 });
    noiseHit(out, t, { dur: 0.03, vol: 0.15 * v, type: 'highpass', from: 2000 });
  },
  splash: (out, t, p, v) => {
    noiseHit(out, t, { dur: 0.45, vol: 0.35 * v, from: 1400 * p, to: 300 * p });
    tone(out, t + 0.12, { freq: 700 * p, end: 1100 * p, dur: 0.09, type: 'sine', vol: 0.1 * v });
    tone(out, t + 0.24, { freq: 900 * p, end: 1300 * p, dur: 0.07, type: 'sine', vol: 0.08 * v });
  },
  zap: (out, t, p, v) => {
    tone(out, t, { freq: 1300 * p, end: 90 * p, dur: 0.14, type: 'sawtooth', vol: 0.3 * v });
    noiseHit(out, t, { dur: 0.1, vol: 0.12 * v, type: 'highpass', from: 4000 });
  },
  explosion: (out, t, p, v) => {
    noiseHit(out, t, { dur: 0.7, vol: 0.55 * v, from: 2800 * p, to: 90, attack: 0.005 });
    tone(out, t, { freq: 90 * p, end: 28, dur: 0.6, type: 'sine', vol: 0.5 * v, attack: 0.004 });
  },
  tick: (out, t, p, v) => noiseHit(out, t, { dur: 0.02, vol: 0.25 * v, type: 'highpass', from: 3500 * p }),
  countdown: (out, t, p, v) => tone(out, t, { freq: 880 * p, dur: 0.12, type: 'sine', vol: 0.3 * v }),
  cheer: (out, t, p, v) => {
    for (let i = 0; i < 6; i += 1) {
      const f = (550 + Math.random() * 700) * p;
      tone(out, t + i * 0.05 + Math.random() * 0.03, { freq: f, end: f * 1.3, dur: 0.12, type: 'triangle', vol: 0.12 * v });
    }
    noiseHit(out, t, { dur: 0.55, vol: 0.1 * v, type: 'bandpass', from: 1200, to: 2400, q: 0.6 });
  },
  sad: (out, t, p, v) => {
    for (const [i, f] of [392, 349, 294].entries()) {
      tone(out, t + i * 0.22, { freq: f * p, dur: 0.24, type: 'triangle', vol: 0.24 * v });
    }
  },
};

/** All available sfx preset names. */
export const SFX_NAMES = Object.freeze(Object.keys(PRESETS));

/**
 * Play a named sound effect.
 * @param {string} name One of SFX_NAMES.
 * @param {{ pitch?: number, vol?: number }} [opts] Multipliers (default 1).
 */
export function sfx(name, opts = {}) {
  initAudio();
  if (!ctx) return;
  const preset = PRESETS[name];
  if (!preset) {
    console.warn(`[audio] unknown sfx "${name}"`);
    return;
  }
  const pitch = opts.pitch ?? 1;
  const vol = opts.vol ?? 1;
  preset(sfxBus, ctx.currentTime + 0.001, pitch, vol);
}

/* ------------------------------------------------------------------ */
/* Monkey voice                                                        */
/* ------------------------------------------------------------------ */

const VOICE_WAVES = {
  chirp: 'sine',
  hoot: 'triangle',
  screech: 'sawtooth',
  grunt: 'square',
};

/**
 * Procedural monkey chirps from a CharacterDef voice config.
 * @param {{ pitch?: number, style?: string }} [voiceCfg]
 * @param {'happy'|'sad'|'hit'|'taunt'} [kind]
 */
export function voice(voiceCfg = {}, kind = 'happy') {
  initAudio();
  if (!ctx) return;
  const pitch = voiceCfg.pitch ?? 1;
  const type = VOICE_WAVES[voiceCfg.style] ?? 'sine';
  const f0 = 430 * pitch;
  const t = ctx.currentTime + 0.001;
  const out = sfxBus;
  const jitter = () => 1 + (Math.random() - 0.5) * 0.08;

  if (kind === 'sad') {
    tone(out, t, { freq: f0 * jitter(), end: f0 * 0.6, dur: 0.28, type, vol: 0.24 });
    tone(out, t + 0.32, { freq: f0 * 0.8 * jitter(), end: f0 * 0.5, dur: 0.34, type, vol: 0.2 });
  } else if (kind === 'hit') {
    tone(out, t, { freq: f0 * 2.1 * jitter(), end: f0 * 1.2, dur: 0.09, type: 'square', vol: 0.3 });
    noiseHit(out, t, { dur: 0.05, vol: 0.1, type: 'bandpass', from: 1800 * pitch, q: 2 });
  } else if (kind === 'taunt') {
    // "ooh-ooh-AH!"
    tone(out, t, { freq: f0 * 0.9 * jitter(), end: f0 * 1.05, dur: 0.11, type, vol: 0.22 });
    tone(out, t + 0.15, { freq: f0 * 0.9 * jitter(), end: f0 * 1.05, dur: 0.11, type, vol: 0.22 });
    tone(out, t + 0.32, { freq: f0 * 1.5 * jitter(), end: f0 * 1.9, dur: 0.2, type, vol: 0.3 });
  } else {
    // happy: 2-3 quick rising chirps
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i += 1) {
      tone(out, t + i * 0.12, { freq: f0 * jitter(), end: f0 * 1.55, dur: 0.1, type, vol: 0.24 });
    }
  }
}
