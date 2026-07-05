/**
 * Ice Slide Race - FFA race, 2-8 players, 60s.
 *
 * A frozen slalom run: skid through every flag gate in order, snag the
 * golden boost gates for a burst of speed, and glide across the finish
 * line. The ice barely grips - plan your drifts early. Missing a gate
 * drags you back for another attempt.
 *
 * Pure ESM sim. No DOM, no three.js, no Math.random, no Date.now.
 * Fixed 30Hz steps; all randomness through shared/rng.js (course at init).
 */

import { createRng } from '../../../rng.js';
import { clampFrame, emptyFrame } from '../../inputs.js';
import {
  defineMinigame, rankByScoreGrouped, coinsForRanking, MINIGAME_HZ, COUNTDOWN_TICKS,
} from '../../framework.js';
import { minigames } from '../../../registries.js';

const ID = 'ice_slide_race';
const DT = 1 / MINIGAME_HZ;

const DEFAULTS = {
  courseLength: 70,
  trackHalfWidth: 8,
  accel: 5,
  friction: 0.985, // Per-tick velocity keep (icy!).
  maxSpeed: 11,
  firstGateZ: 10,
  gateSpacing: 8,
  gateHalfWidth: 2.4,
  boostEvery: 3, // Every 3rd gate is a golden boost gate.
  boostPower: 4.5,
  missPenaltyZ: 5,
};

function createSim({ seed, players, params = {}, rules = {} } = {}) {
  const cfg = { ...DEFAULTS, ...params };
  const rng = createRng(seed ?? 0);
  const pids = (players ?? []).slice();
  const durationTicks = 60 * MINIGAME_HZ;
  const chaos = Boolean(rules.chaosMode);

  let state = null;

  function init() {
    rng.setState(Number(seed ?? 0) >>> 0);
    const gates = [];
    for (let z = cfg.firstGateZ, i = 0; z <= cfg.courseLength - 6; z += cfg.gateSpacing, i += 1) {
      gates.push({
        z,
        x: (rng.next() * 2 - 1) * (cfg.trackHalfWidth - 3),
        halfWidth: cfg.gateHalfWidth,
        boost: i % cfg.boostEvery === cfg.boostEvery - 1,
      });
    }
    const ps = {};
    pids.forEach((pid, i) => {
      ps[pid] = {
        slot: i,
        // Everyone launches from the center line: with a randomly placed
        // first gate, spread-out lanes would hand some seats a head start.
        x: 0,
        z: 0,
        vx: 0,
        vz: 0,
        nextGate: 0,
        finished: false,
        finishTick: -1,
        misses: 0,
        missTick: -1,
        boostTick: -1,
        wallTick: -1,
      };
    });
    state = {
      id: ID,
      tick: 0,
      durationTicks,
      countdownTicks: COUNTDOWN_TICKS,
      finished: false,
      courseLength: cfg.courseLength,
      trackHalfWidth: cfg.trackHalfWidth,
      gates,
      finishedCount: 0,
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
        if (p.finished) continue;
        const frame = clampFrame(inputsMap[pid] ?? emptyFrame());
        p.vx = (p.vx + frame.move.x * cfg.accel * DT) * cfg.friction;
        p.vz = (p.vz + frame.move.y * cfg.accel * DT) * cfg.friction;
        const speed = Math.hypot(p.vx, p.vz);
        const cap = cfg.maxSpeed + (t <= p.boostTick + 60 ? 3 : 0);
        if (speed > cap) {
          p.vx = (p.vx / speed) * cap;
          p.vz = (p.vz / speed) * cap;
        }
        const prevZ = p.z;
        p.x += p.vx * DT;
        p.z += p.vz * DT;
        p.z = Math.max(0, p.z);

        // Icy walls bounce you back in.
        if (Math.abs(p.x) > cfg.trackHalfWidth) {
          p.x = Math.sign(p.x) * cfg.trackHalfWidth;
          p.vx *= -0.4;
          p.wallTick = t;
        }

        // Gate checks: crossing the gate plane going forward.
        const gate = state.gates[p.nextGate];
        if (gate && prevZ < gate.z && p.z >= gate.z) {
          if (Math.abs(p.x - gate.x) <= gate.halfWidth) {
            p.nextGate += 1;
            if (gate.boost) {
              p.vz = Math.min(cfg.maxSpeed + 3, p.vz + cfg.boostPower);
              p.boostTick = t;
            }
          } else {
            p.misses += 1;
            p.missTick = t;
            p.z = Math.max(0, gate.z - cfg.missPenaltyZ);
            p.vx *= 0.25;
            p.vz *= 0.25;
          }
        }

        if (p.nextGate >= state.gates.length && p.z >= cfg.courseLength) {
          p.z = cfg.courseLength;
          p.finished = true;
          p.finishTick = t;
          state.finishedCount += 1;
        }
      }
    }

    if (state.finishedCount >= state.order.length || t >= state.durationTicks) {
      state.finished = true;
    }
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
      scores[pid] = p.finished ? 1000000 - p.finishTick : p.nextGate * 1000 + p.z;
    }
    const ranking = rankByScoreGrouped(scores);
    const coins = coinsForRanking(ranking, { chaos });
    const stats = {};
    for (const pid of state.order) {
      const p = state.players[pid];
      stats[pid] = {
        finished: p.finished,
        gatesCleared: p.nextGate,
        missedGates: p.misses,
        timeSec: p.finished ? Math.round((p.finishTick / MINIGAME_HZ) * 10) / 10 : null,
      };
    }
    return { ranking, coins, stats };
  }

  return { init, step, getState, applyState, isFinished, getResults };
}

const AIM_ERR = { easy: 1.3, normal: 0.7, hard: 0.3, wild: 0.1 };

function bot(publicState, playerId, difficulty, rng) {
  const frame = emptyFrame();
  const s = publicState;
  const me = s?.players?.[playerId];
  if (!me || me.finished || s.tick <= s.countdownTicks) return frame;

  const err = AIM_ERR[difficulty] ?? AIM_ERR.normal;
  const gate = s.gates?.[me.nextGate];
  const targetX = (gate ? gate.x : 0) + (rng.next() - 0.5) * err * 2;
  const targetZ = gate ? gate.z : s.courseLength + 3;

  // Ice control: aim where I will be, not where I am.
  const ex = targetX - (me.x + me.vx * 0.45);
  frame.move.x = Math.max(-1, Math.min(1, ex * 0.8));

  // Ease off the gas when badly misaligned close to the gate.
  const closing = targetZ - me.z;
  const misaligned = Math.abs(ex) > (gate ? gate.halfWidth * 0.9 : 3);
  frame.move.y = misaligned && closing < 6 ? 0.2 : 1;
  return frame;
}

export function register() {
  if (minigames.get(ID)) return minigames.get(ID);
  return defineMinigame({
    id: ID,
    name: { en: 'Ice Slide Race', de: 'Eisrutsch-Rennen' },
    description: {
      en: 'Skid through every slalom gate on slippery ice and hit the boost gates.',
      de: 'Schlittere durch jedes Slalomtor auf glattem Eis und triff die Boost-Tore.',
    },
    howTo: {
      en: 'Push up to skate, steer through the flag gates in order. Golden gates grant a speed boost; missing a gate drags you back. First across the line wins!',
      de: 'Stick hoch zum Gleiten, steuere der Reihe nach durch die Tore. Goldene Tore geben Tempo; verpasste Tore werfen dich zurueck. Wer zuerst im Ziel ist, gewinnt!',
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

/** Late-bound view factory: the real view lives in src/minigames/views/. */
let viewFactory = () => ({ mount() {}, update() {}, dispose() {} });

/** Called by the client views package to attach the real 3D view. */
export function attachView(factory) {
  if (typeof factory === 'function') viewFactory = factory;
}

export default register;
