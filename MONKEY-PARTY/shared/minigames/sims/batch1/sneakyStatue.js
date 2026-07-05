/**
 * Sneaky Statue - FFA reaction, 2-8 players, 45s.
 *
 * Red-light-green-light toward the golden idol. While the idol watches,
 * anyone caught moving is sent back to the start line. The first three
 * monkeys to touch the idol win.
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

const ID = 'sneaky_statue';
const DT = 1 / MINIGAME_HZ;

const DEFAULTS = {
  courseLength: 26,
  laneHalfWidth: 6,
  moveSpeed: 6,
  greenMinTicks: 55,
  greenMaxTicks: 115,
  turnTicks: 12, // Telegraph before the idol snaps around.
  redMinTicks: 40,
  redMaxTicks: 70,
  caughtThreshold: 0.2,
  winners: 3,
};

function createSim({ seed, players, params = {}, rules = {} } = {}) {
  const cfg = { ...DEFAULTS, ...params };
  const rng = createRng(seed ?? 0);
  const pids = (players ?? []).slice();
  const durationTicks = 45 * MINIGAME_HZ;
  const chaos = Boolean(rules.chaosMode);

  let state = null;

  function init() {
    rng.setState(Number(seed ?? 0) >>> 0);
    const ps = {};
    pids.forEach((pid, i) => {
      ps[pid] = {
        x: ((i + 0.5) / pids.length - 0.5) * cfg.laneHalfWidth * 2,
        z: 0,
        finished: false,
        finishTick: -1,
        caught: 0,
        caughtTick: -1,
      };
    });
    state = {
      id: ID,
      tick: 0,
      durationTicks,
      countdownTicks: COUNTDOWN_TICKS,
      finished: false,
      courseLength: cfg.courseLength,
      turnTicks: cfg.turnTicks,
      phase: 'green', // 'green' | 'turning' | 'red'
      phaseTick: COUNTDOWN_TICKS,
      phaseDur: cfg.greenMinTicks,
      finishedCount: 0,
      players: ps,
      order: pids.slice(),
      rngState: rng.state(),
    };
  }

  function nextPhase(t) {
    if (state.phase === 'green') {
      state.phase = 'turning';
      state.phaseDur = cfg.turnTicks;
    } else if (state.phase === 'turning') {
      state.phase = 'red';
      state.phaseDur = rng.int(cfg.redMinTicks, cfg.redMaxTicks);
    } else {
      state.phase = 'green';
      state.phaseDur = rng.int(cfg.greenMinTicks, cfg.greenMaxTicks);
    }
    state.phaseTick = t;
  }

  function step(inputsMap = {}) {
    if (state.finished) return;
    rng.setState(state.rngState);
    state.tick += 1;
    const t = state.tick;
    const playing = t > state.countdownTicks;

    if (playing) {
      if (t - state.phaseTick >= state.phaseDur) nextPhase(t);

      for (const pid of state.order) {
        const p = state.players[pid];
        if (p.finished) continue;
        const frame = clampFrame(inputsMap[pid] ?? emptyFrame());
        const mx = frame.move.x;
        const mz = frame.move.y; // Stick up = toward the idol.
        const mag = Math.hypot(mx, mz);

        if (state.phase === 'red' && mag > cfg.caughtThreshold) {
          // Caught moving: back to the start line.
          p.z = 0;
          p.caught += 1;
          p.caughtTick = t;
          continue;
        }
        if (mag > 0.05) {
          p.x += mx * cfg.moveSpeed * 0.6 * DT;
          p.z += Math.max(0, mz) * cfg.moveSpeed * DT;
          p.x = Math.max(-cfg.laneHalfWidth, Math.min(cfg.laneHalfWidth, p.x));
        }

        if (p.z >= cfg.courseLength) {
          p.z = cfg.courseLength;
          p.finished = true;
          state.finishedCount += 1;
          p.finishTick = t;
        }
      }
    }

    const remaining = state.order.length - state.finishedCount;
    const winnersHit = state.finishedCount >= Math.min(cfg.winners, state.order.length);
    if (winnersHit || remaining === 0 || t >= state.durationTicks) state.finished = true;
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
      scores[pid] = p.finished ? 1000000 - p.finishTick : p.z;
    }
    const ranking = rankByScore(scores);
    const coins = coinsForRanking(ranking, { chaos });
    const stats = {};
    for (const pid of state.order) {
      const p = state.players[pid];
      stats[pid] = { reachedIdol: p.finished, timesCaught: p.caught, progress: Math.round(p.z) };
    }
    return { ranking, coins, stats };
  }

  return { init, step, getState, applyState, isFinished, getResults };
}

// Base reaction, jittered +/-4 ticks per phase (see bot below) around the
// 12-tick telegraph: easy is caught on most red lights but sometimes sneaks
// through, normal gets clipped occasionally, hard/wild always stop in time.
const REACT = { easy: 13, normal: 8, hard: 5, wild: 3 };

function ihash(a, b) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

function bot(publicState, playerId, difficulty, rng) {
  const frame = emptyFrame();
  const s = publicState;
  const me = s?.players?.[playerId];
  if (!me || me.finished || s.tick <= s.countdownTicks) return frame;

  // Deterministic per-phase jitter: reaction varies with each light change
  // so the same bot is sometimes sharp and sometimes sluggish. The anchor
  // is the tick the telegraph began, so one roll covers a whole turn+red
  // cycle (no mid-light re-roll).
  const slot = s.order?.indexOf?.(playerId) ?? 0;
  const anchor = s.phase === 'red' ? s.phaseTick - (s.turnTicks ?? 12) : s.phaseTick;
  const react = (REACT[difficulty] ?? REACT.normal)
    + (ihash(anchor, slot) % 9) - 4;
  const sincePhase = s.tick - s.phaseTick;

  if (s.phase === 'red') {
    // The idol started turning turnTicks before red began; only bots whose
    // reaction lag exceeds the whole telegraph are still moving (and caught).
    const sinceTurn = sincePhase + (s.turnTicks ?? 12);
    if (sinceTurn >= react) return frame;
    frame.move.y = 1;
    return frame;
  }
  if (s.phase === 'turning') {
    // Careful bots stop on the telegraph; slow bots keep running into it.
    if (sincePhase >= react) return frame;
    frame.move.y = 1;
    return frame;
  }
  // Green: run (after noticing), with slight lane drift as decision noise.
  if (sincePhase < react) return frame;
  frame.move.y = 1;
  frame.move.x = (rng.next() - 0.5) * 0.2;
  return frame;
}

export function register() {
  if (minigames.get(ID)) return minigames.get(ID);
  return defineMinigame({
    id: ID,
    name: { en: 'Sneaky Statue', de: 'Schleich-Statue' },
    description: {
      en: 'Creep toward the golden idol - freeze whenever it turns around!',
      de: 'Schleich dich zum goldenen Idol - erstarre, wenn es sich umdreht!',
    },
    howTo: {
      en: 'Push up to advance while the idol looks away. Move while it watches and you restart. First 3 to touch it win!',
      de: 'Stick nach oben, solange das Idol wegschaut. Bewegst du dich waehrend es schaut, geht es zurueck zum Start. Die ersten 3 gewinnen!',
    },
    category: 'ffa',
    tags: ['reaction'],
    players: { min: 2, max: 8 },
    durationSec: 45,
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
