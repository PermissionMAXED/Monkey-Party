/**
 * Vine Swing Sprint - FFA race/skill, 2-8 players, 60s.
 *
 * A side-scrolling sprint through the canopy. At every vine a short timing
 * window opens: press A inside it to swing forward with a speed boost;
 * miss and you drop, losing ~1.5 seconds. First across the line wins.
 *
 * Pure ESM sim. No DOM, no three.js, no Math.random, no Date.now.
 * Fixed 30Hz steps; all randomness through shared/rng.js.
 */

import { createRng } from '../../../rng.js';
import { clampFrame, emptyFrame } from '../../inputs.js';
import {
  defineMinigame, rankByScore, coinsForRanking, MINIGAME_HZ, COUNTDOWN_TICKS,
} from '../../framework.js';
import { minigames } from '../../../registries.js';

const ID = 'vine_swing_sprint';
const DT = 1 / MINIGAME_HZ;

const DEFAULTS = {
  trackLength: 90,
  vineSpacing: 10,
  runSpeed: 6,
  boostSpeed: 10,
  boostTicks: 30,
  windowTicks: 18, // 0.6s timing window at each vine.
  stunTicks: 45, // ~1.5s lost on a miss.
  swingLeap: 4,
};

function createSim({ seed, players, params = {}, rules = {} } = {}) {
  const cfg = { ...DEFAULTS, ...params };
  const rng = createRng(seed ?? 0);
  const pids = (players ?? []).slice();
  const durationTicks = 60 * MINIGAME_HZ;
  const chaos = Boolean(rules.chaosMode);

  let state = null;

  function vinesFor() {
    const vines = [];
    for (let x = cfg.vineSpacing; x < cfg.trackLength; x += cfg.vineSpacing) vines.push(x);
    return vines;
  }

  function init() {
    rng.setState(Number(seed ?? 0) >>> 0);
    const ps = {};
    pids.forEach((pid, i) => {
      ps[pid] = {
        lane: i,
        x: 0,
        mode: 'run', // 'run' | 'window' | 'stunned' | 'finished'
        modeTick: 0, // Tick the current mode began.
        nextVine: 0, // Index into vines.
        boostUntil: -1,
        finishTick: -1,
        misses: 0,
        swings: 0,
        prevA: false,
      };
    });
    state = {
      id: ID,
      tick: 0,
      durationTicks,
      countdownTicks: COUNTDOWN_TICKS,
      finished: false,
      trackLength: cfg.trackLength,
      windowTicks: cfg.windowTicks,
      vines: vinesFor(),
      players: ps,
      order: pids.slice(),
      rngState: rng.state(),
    };
  }

  function step(inputsMap = {}) {
    if (state.finished) return;
    rng.setState(state.rngState);
    state.tick += 1;
    const t = state.tick;
    const playing = t > state.countdownTicks;

    if (playing) {
      for (const pid of state.order) {
        const p = state.players[pid];
        if (p.mode === 'finished') continue;
        const frame = clampFrame(inputsMap[pid] ?? emptyFrame());
        const aPressed = frame.a && !p.prevA;
        p.prevA = frame.a;

        if (p.mode === 'stunned') {
          if (t - p.modeTick >= cfg.stunTicks) {
            p.mode = 'run';
            p.modeTick = t;
          }
          continue;
        }

        if (p.mode === 'window') {
          if (aPressed) {
            // Swing! Leap past the vine with a boost.
            p.x += cfg.swingLeap;
            p.boostUntil = t + cfg.boostTicks;
            p.swings += 1;
            p.nextVine += 1;
            p.mode = 'run';
            p.modeTick = t;
          } else if (t - p.modeTick >= cfg.windowTicks) {
            // Missed the window: drop.
            p.misses += 1;
            p.nextVine += 1;
            p.mode = 'stunned';
            p.modeTick = t;
          }
          continue;
        }

        // mode === 'run': forward speed scaled by stick (idle players stand still).
        const throttle = Math.max(0, Math.min(1, Math.hypot(frame.move.x, frame.move.y)));
        const speed = (t < p.boostUntil ? cfg.boostSpeed : cfg.runSpeed) * throttle;
        p.x += speed * DT;

        const vineX = state.vines[p.nextVine];
        if (vineX !== undefined && p.x >= vineX) {
          p.x = vineX;
          p.mode = 'window';
          p.modeTick = t;
        }

        if (p.x >= cfg.trackLength) {
          p.x = cfg.trackLength;
          p.mode = 'finished';
          p.finishTick = t;
        }
      }
    }

    const allDone = state.order.every((pid) => state.players[pid].mode === 'finished');
    if (t >= state.durationTicks || allDone) state.finished = true;
    state.rngState = rng.state();
  }

  const getState = () => JSON.parse(JSON.stringify(state));
  const applyState = (snap) => {
    state = JSON.parse(JSON.stringify(snap));
  };
  const isFinished = () => Boolean(state?.finished);

  function getResults() {
    const scores = {};
    for (const pid of state.order) {
      const p = state.players[pid];
      scores[pid] = p.finishTick >= 0 ? 1000000 - p.finishTick : p.x;
    }
    const ranking = rankByScore(scores);
    const coins = coinsForRanking(ranking, { chaos });
    const stats = {};
    for (const pid of state.order) {
      const p = state.players[pid];
      stats[pid] = { distance: Math.round(p.x), swings: p.swings, misses: p.misses, finishTick: p.finishTick };
    }
    return { ranking, coins, stats };
  }

  return { init, step, getState, applyState, isFinished, getResults };
}

const REACT = { easy: 14, normal: 9, hard: 6, wild: 4 };
/** Per-window whiff chance in per-mille (12% / 5% / 1.5% / 0.3%). */
const WHIFF_PER_MILLE = { easy: 120, normal: 50, hard: 15, wild: 3 };

function ihash(a, b) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

function bot(publicState, playerId, difficulty, _rng) {
  const frame = emptyFrame();
  const s = publicState;
  const me = s?.players?.[playerId];
  if (!me || s.tick <= s.countdownTicks || me.mode === 'finished') return frame;

  const react = REACT[difficulty] ?? REACT.normal;

  if (me.mode === 'window') {
    // Decide ONCE per timing window (hashed on the tick it opened) whether
    // this swing whiffs; re-rolling per tick meant bots ~never dropped.
    const whiff = ihash(me.modeTick * 31 + 7, me.lane * 13 + 5) % 1000
      < (WHIFF_PER_MILLE[difficulty] ?? WHIFF_PER_MILLE.normal);
    if (whiff) return frame; // Let the window lapse: a real miss.
    const waited = s.tick - me.modeTick;
    if (waited >= react) frame.a = true;
    return frame;
  }

  if (me.mode === 'run') {
    frame.move.x = 1; // Sprint forward at full tilt.
  }
  return frame;
}

export function register() {
  if (minigames.get(ID)) return minigames.get(ID);
  return defineMinigame({
    id: ID,
    name: { en: 'Vine Swing Sprint', de: 'Lianen-Sprint' },
    description: {
      en: 'Sprint through the canopy, timing each vine swing perfectly.',
      de: 'Sprinte durchs Blaetterdach und triff jeden Lianenschwung perfekt.',
    },
    howTo: {
      en: 'Hold the stick to run. At each vine, press A inside the timing window to swing. Miss and you drop!',
      de: 'Stick halten zum Rennen. An jeder Liane A im Zeitfenster druecken. Verpasst - und du faellst!',
    },
    category: 'ffa',
    tags: ['race', 'skill'],
    players: { min: 2, max: 8 },
    durationSec: 60,
    competitiveSafe: true,
    params: { ...DEFAULTS },
    createSim,
    createView: (opts) => viewFactory(opts),
    bot,
  });
}

let viewFactory = () => ({ mount() {}, update() {}, dispose() {} });

export function attachView(factory) {
  if (typeof factory === 'function') viewFactory = factory;
}

export default register;
