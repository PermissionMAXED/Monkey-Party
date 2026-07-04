/**
 * Rolling Log Run - FFA survival, 2-8 players, 60s.
 *
 * Everyone balances on one giant spinning log over a piranha river. The
 * log spins faster and faster; hold against the spin to stay on top and
 * jump (A) over branches that sweep across the trunk. Fall behind the
 * roll or get clipped by a branch and you are in the water. Last monkey
 * rolling wins.
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

const ID = 'rolling_log_run';
const DT = 1 / MINIGAME_HZ;

const DEFAULTS = {
  logHalfLength: 6,
  logRadius: 1.4,
  fallAngle: 0.9, // |off| beyond this = splash.
  runPower: 2.6, // Counter-rotation at full stick (rad/s).
  spinStart: 0.55,
  spinEnd: 1.75,
  strafeSpeed: 3.2,
  jumpTicks: 13,
  jumpCooldownTicks: 8,
  branchEveryStart: 110,
  branchEveryEnd: 46,
  branchTelegraphTicks: 42,
  branchWidth: 4.6,
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
    const ps = {};
    pids.forEach((pid, i) => {
      ps[pid] = {
        slot: i,
        x: ((i + 0.5) / pids.length - 0.5) * cfg.logHalfLength * 1.7,
        off: 0, // Angular offset from the top of the log.
        alive: true,
        elimTick: -1,
        cause: null, // 'fall' | 'branch'
        airUntil: -1,
        jumpReadyAt: 0,
        jumps: 0,
        dodges: 0,
        prevA: false,
      };
    });
    state = {
      id: ID,
      tick: 0,
      durationTicks,
      countdownTicks: COUNTDOWN_TICKS,
      finished: false,
      logHalfLength: cfg.logHalfLength,
      logRadius: cfg.logRadius,
      fallAngle: cfg.fallAngle,
      spin: cfg.spinStart,
      nextBranchTick: COUNTDOWN_TICKS + cfg.branchEveryStart,
      branches: [], // { id, x0, x1, hitTick }
      nextBranchId: 1,
      aliveCount: pids.length,
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

    const progress = Math.min(1, t / state.durationTicks);
    state.spin = cfg.spinStart + (cfg.spinEnd - cfg.spinStart) * progress;

    if (playing) {
      // Spawn sweeping branches on a ramping schedule.
      if (t >= state.nextBranchTick) {
        const x0 = -cfg.logHalfLength + rng.next() * (cfg.logHalfLength * 2 - cfg.branchWidth);
        state.branches.push({
          id: state.nextBranchId,
          x0,
          x1: x0 + cfg.branchWidth,
          hitTick: t + cfg.branchTelegraphTicks,
        });
        state.nextBranchId += 1;
        const every = Math.round(cfg.branchEveryStart
          + (cfg.branchEveryEnd - cfg.branchEveryStart) * progress);
        state.nextBranchTick = t + every;
      }

      for (const pid of state.order) {
        const p = state.players[pid];
        if (!p.alive) continue;
        const frame = clampFrame(inputsMap[pid] ?? emptyFrame());
        const airborne = t <= p.airUntil;

        // Jump on a fresh A press.
        const pressed = frame.a && !p.prevA;
        p.prevA = frame.a;
        if (pressed && !airborne && t >= p.jumpReadyAt) {
          p.airUntil = t + cfg.jumpTicks;
          p.jumpReadyAt = t + cfg.jumpTicks + cfg.jumpCooldownTicks;
          p.jumps += 1;
        }

        // Spin drags grounded players; stick-up runs against it.
        if (!airborne) {
          p.off += (state.spin - frame.move.y * cfg.runPower) * DT;
        }
        p.x += frame.move.x * cfg.strafeSpeed * DT;
        p.x = Math.max(-cfg.logHalfLength + 0.3, Math.min(cfg.logHalfLength - 0.3, p.x));

        if (Math.abs(p.off) >= cfg.fallAngle) {
          p.alive = false;
          p.elimTick = t;
          p.cause = 'fall';
          state.aliveCount -= 1;
        }
      }

      // Branch impacts.
      const kept = [];
      for (const branch of state.branches) {
        if (t === branch.hitTick) {
          for (const pid of state.order) {
            const p = state.players[pid];
            if (!p.alive) continue;
            if (p.x >= branch.x0 - 0.35 && p.x <= branch.x1 + 0.35) {
              if (t <= p.airUntil) {
                p.dodges += 1;
              } else {
                p.alive = false;
                p.elimTick = t;
                p.cause = 'branch';
                state.aliveCount -= 1;
              }
            }
          }
        }
        if (t <= branch.hitTick + 8) kept.push(branch);
      }
      state.branches = kept;
    }

    if (state.aliveCount <= 1 || t >= state.durationTicks) state.finished = true;
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
      scores[pid] = (p.alive ? 1000000 : p.elimTick) + p.dodges;
    }
    const ranking = rankByScore(scores);
    const coins = coinsForRanking(ranking, { chaos });
    const stats = {};
    for (const pid of state.order) {
      const p = state.players[pid];
      stats[pid] = { survived: p.alive, branchesDodged: p.dodges, jumps: p.jumps };
    }
    return { ranking, coins, stats };
  }

  return { init, step, getState, applyState, isFinished, getResults };
}

const REACT = { easy: 16, normal: 10, hard: 6, wild: 3 };
const NOISE = { easy: 0.35, normal: 0.18, hard: 0.07, wild: 0.02 };
const FREEZE_PCT = { easy: 24, normal: 9, hard: 3, wild: 0 };

function ihash(a, b) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

function bot(publicState, playerId, difficulty, rng) {
  const frame = emptyFrame();
  const s = publicState;
  const me = s?.players?.[playerId];
  if (!me || !me.alive || s.tick <= s.countdownTicks) return frame;

  const react = REACT[difficulty] ?? REACT.normal;
  const noise = NOISE[difficulty] ?? NOISE.normal;
  const freezePct = FREEZE_PCT[difficulty] ?? FREEZE_PCT.normal;

  // Hold against the roll, correcting the current offset.
  const hold = (s.spin ?? 1) / 2.6 + me.off * 3;
  frame.move.y = Math.max(-1, Math.min(1, hold + (rng.next() - 0.5) * noise));
  // Drift gently back toward the middle of the log.
  frame.move.x = Math.max(-1, Math.min(1, -me.x * 0.25 + (rng.next() - 0.5) * noise));

  // Jump over branches sweeping through my section.
  for (const branch of s.branches ?? []) {
    if (me.x < branch.x0 - 0.5 || me.x > branch.x1 + 0.5) continue;
    const untilHit = branch.hitTick - s.tick;
    const telegraphAge = s.tick - (branch.hitTick - 42);
    if (telegraphAge < react) continue; // Have not noticed it yet.
    if (ihash(branch.id * 31 + 7, me.slot) % 100 < freezePct) continue; // Panic freeze.
    const lead = 7 + (ihash(branch.id, me.slot) % 4);
    if (untilHit >= 0 && untilHit <= lead) {
      frame.a = true;
      break;
    }
  }
  return frame;
}

export function register() {
  if (minigames.get(ID)) return minigames.get(ID);
  return defineMinigame({
    id: ID,
    name: { en: 'Rolling Log Run', de: 'Rollender-Stamm-Lauf' },
    description: {
      en: 'Stay on top of a spinning log while branches sweep across it.',
      de: 'Bleib auf dem rotierenden Stamm, waehrend Aeste darueber fegen.',
    },
    howTo: {
      en: 'Push up to run against the spin, left/right to shift along the log, and press A to jump over branches. Last one on the log wins!',
      de: 'Stick hoch, um gegen die Drehung zu laufen, links/rechts zum Verschieben, A zum Springen ueber Aeste. Wer zuletzt auf dem Stamm steht, gewinnt!',
    },
    category: 'ffa',
    tags: ['survival', 'reaction'],
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
