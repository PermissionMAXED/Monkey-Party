/**
 * Stampede Surfers - FFA survival, 2-8 players, 60s.
 *
 * A savanna crossing with four run lanes. Boars thunder through single
 * lanes - a dust cloud at the field edge telegraphs each charge. Hop
 * between lanes (stick up/down) or leap over a boar with a well-timed
 * jump (A). Three trampled hits and you are out; the last monkeys
 * standing rank by survival.
 *
 * Pure ESM sim. No DOM, no three.js, no Math.random, no Date.now.
 * Fixed 30Hz steps; all randomness through shared/rng.js (rngState in
 * the snapshot, so netsync/applyState stays in lockstep).
 */

import { createRng } from '../../../rng.js';
import { clampFrame, emptyFrame } from '../../inputs.js';
import {
  defineMinigame, rankByScoreGrouped, coinsForRanking, MINIGAME_HZ, COUNTDOWN_TICKS,
} from '../../framework.js';
import { minigames } from '../../../registries.js';

const ID = 'stampede_surfers';
const DT = 1 / MINIGAME_HZ;

const DEFAULTS = {
  lanes: 4,
  laneGap: 2.6,
  fieldHalfW: 9,
  runSpeed: 6,
  hopCooldown: 12,
  jumpTicks: 13,
  jumpCooldown: 9,
  lives: 3,
  invulnTicks: 40,
  warnTicks: 33,
  boarHitHalfW: 1.15,
  boarSpeedMin: 13,
  boarSpeedSpan: 6,
  spawnEveryStart: 58,
  spawnEveryEnd: 20,
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
        x: -6 + (12 * i) / Math.max(1, pids.length - 1),
        lane: i % cfg.lanes,
        alive: true,
        lives: cfg.lives,
        score: cfg.lives, // Lives left (HUD chip).
        hits: 0,
        elimTick: -1,
        hitTick: -1,
        invulnUntil: -1,
        hopReadyAt: 0,
        airUntil: -1,
        jumpReadyAt: 0,
        prevA: false,
        prevY: 0,
      };
    });
    state = {
      id: ID,
      tick: 0,
      durationTicks,
      countdownTicks: COUNTDOWN_TICKS,
      finished: false,
      lanes: cfg.lanes,
      laneGap: cfg.laneGap,
      fieldHalfW: cfg.fieldHalfW,
      warnTicks: cfg.warnTicks,
      boars: [], // { id, lane, dir, speed, x, activeFrom }
      nextBoarId: 1,
      nextSpawnTick: COUNTDOWN_TICKS + 50,
      aliveCount: pids.length,
      players: ps,
      order: pids.slice(),
      rngState: rng.state(),
    };
  }

  function spawnBoar(t) {
    const dir = rng.next() < 0.5 ? 1 : -1;
    state.boars.push({
      id: state.nextBoarId,
      lane: rng.int(0, cfg.lanes - 1),
      dir,
      speed: cfg.boarSpeedMin + rng.next() * cfg.boarSpeedSpan,
      x: dir > 0 ? -(cfg.fieldHalfW + 4) : cfg.fieldHalfW + 4,
      activeFrom: t + cfg.warnTicks,
    });
    state.nextBoarId += 1;
  }

  function step(inputsMap = {}) {
    if (state.finished) return;
    rng.setState(state.rngState);
    state.tick += 1;
    const t = state.tick;
    const playing = t > state.countdownTicks;

    if (playing) {
      const progress = Math.min(1, (t - state.countdownTicks)
        / (state.durationTicks - state.countdownTicks));

      // Ramping stampede schedule.
      if (t >= state.nextSpawnTick) {
        spawnBoar(t);
        if (progress > 0.45 && rng.next() < 0.5) spawnBoar(t);
        state.nextSpawnTick = t + Math.round(cfg.spawnEveryStart
          + (cfg.spawnEveryEnd - cfg.spawnEveryStart) * progress);
      }

      // Boars charge through their lane.
      state.boars = state.boars.filter((boar) => {
        if (t >= boar.activeFrom) boar.x += boar.dir * boar.speed * DT;
        return Math.abs(boar.x) <= cfg.fieldHalfW + 4.5;
      });

      for (const pid of state.order) {
        const p = state.players[pid];
        if (!p.alive) continue;
        const frame = clampFrame(inputsMap[pid] ?? emptyFrame());

        // Run along the lane.
        p.x = Math.max(-cfg.fieldHalfW,
          Math.min(cfg.fieldHalfW, p.x + frame.move.x * cfg.runSpeed * DT));

        // Hop lanes with fresh up/down pushes (up = +1 = higher lane).
        const y = frame.move.y;
        if (t >= p.hopReadyAt && t > p.airUntil) {
          if (y > 0.6 && p.prevY <= 0.6 && p.lane < cfg.lanes - 1) {
            p.lane += 1;
            p.hopReadyAt = t + cfg.hopCooldown;
          } else if (y < -0.6 && p.prevY >= -0.6 && p.lane > 0) {
            p.lane -= 1;
            p.hopReadyAt = t + cfg.hopCooldown;
          }
        }
        p.prevY = y;

        // Jump (A) over a charging boar.
        const edgeA = frame.a && !p.prevA;
        p.prevA = frame.a;
        if (edgeA && t > p.airUntil && t >= p.jumpReadyAt) {
          p.airUntil = t + cfg.jumpTicks;
          p.jumpReadyAt = t + cfg.jumpTicks + cfg.jumpCooldown;
        }

        // Trampled?
        if (t <= p.airUntil || t < p.invulnUntil) continue;
        for (const boar of state.boars) {
          if (t < boar.activeFrom || boar.lane !== p.lane) continue;
          if (Math.abs(boar.x - p.x) <= cfg.boarHitHalfW) {
            p.lives -= 1;
            p.score = p.lives;
            p.hits += 1;
            p.hitTick = t;
            p.invulnUntil = t + cfg.invulnTicks;
            if (p.lives <= 0) {
              p.alive = false;
              p.elimTick = t;
              state.aliveCount -= 1;
            }
            break;
          }
        }
      }

      if (state.aliveCount <= 1) state.finished = true;
    }

    if (t >= state.durationTicks) state.finished = true;
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
      scores[pid] = p.alive
        ? 1000000 + p.lives * 1000
        : p.elimTick;
    }
    const ranking = rankByScoreGrouped(scores);
    const coins = coinsForRanking(ranking, { chaos });
    const stats = {};
    for (const pid of state.order) {
      const p = state.players[pid];
      stats[pid] = {
        survived: p.alive,
        livesLeft: Math.max(0, p.lives),
        timesTrampled: p.hits,
        surviveSec: Math.round(((p.alive ? state.tick : p.elimTick) / MINIGAME_HZ) * 10) / 10,
      };
    }
    return { ranking, coins, stats };
  }

  return { init, step, getState, applyState, isFinished, getResults };
}

const REACT = { easy: 20, normal: 12, hard: 7, wild: 4 };
const PANIC_PCT = { easy: 32, normal: 13, hard: 5, wild: 1 };

function ihash(a, b) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** Ticks until this boar's snout reaches x (Infinity when receding). */
function ticksToHit(boar, x, t) {
  const gap = (x - boar.x) * boar.dir; // Warned boars wait at the field edge.
  if (!Number.isFinite(gap)) return Infinity;
  if (gap < -1.5) return Infinity;
  const wait = Math.max(0, boar.activeFrom - t);
  return wait + (Math.max(0, gap) / boar.speed) * MINIGAME_HZ;
}

function laneDanger(s, lane, x, horizon, t) {
  let danger = 0;
  for (const boar of s.boars ?? []) {
    if (boar.lane !== lane) continue;
    const eta = ticksToHit(boar, x, t);
    if (eta <= horizon) danger += 1;
  }
  return danger;
}

function bot(publicState, playerId, difficulty, rng) {
  const frame = emptyFrame();
  const s = publicState;
  const me = s?.players?.[playerId];
  if (!me || !me.alive || s.tick <= s.countdownTicks) return frame;

  const react = REACT[difficulty] ?? REACT.normal;

  // Closest incoming boar in my lane (I only notice it after `react` ticks
  // of it existing - the dust cloud needs to register).
  let eta = Infinity;
  for (const boar of s.boars ?? []) {
    if (boar.lane !== me.lane) continue;
    const age = s.tick - (boar.activeFrom - (s.warnTicks ?? 33));
    if (age < react) continue;
    const e = ticksToHit(boar, me.x, s.tick);
    if (e < eta) eta = e;
  }

  if (eta < 34) {
    // Panic check: sloppy monkeys freeze or pick a bad lane.
    const panicked = ihash(Math.floor(s.tick / 15), me.slot * 13 + 5) % 100
      < (PANIC_PCT[difficulty] ?? PANIC_PCT.normal);
    if (!panicked) {
      // Prefer a clean hop to a safer lane, otherwise time a jump.
      const horizon = 45;
      const options = [];
      if (me.lane + 1 < (s.lanes ?? 4)) options.push(me.lane + 1);
      if (me.lane - 1 >= 0) options.push(me.lane - 1);
      let bestLane = -1;
      let bestDanger = laneDanger(s, me.lane, me.x, horizon, s.tick);
      for (const lane of options) {
        const d = laneDanger(s, lane, me.x, horizon, s.tick);
        if (d < bestDanger) {
          bestDanger = d;
          bestLane = lane;
        }
      }
      if (bestLane >= 0 && s.tick >= me.hopReadyAt && s.tick > me.airUntil) {
        frame.move.y = bestLane > me.lane ? 1 : -1;
        return frame;
      }
      // Jump just before the boar arrives (skill = tighter timing).
      const jumpAt = 6 + (ihash(me.slot, Math.floor(s.tick / 60)) % 4);
      if (eta <= jumpAt && s.tick > me.airUntil && s.tick >= me.jumpReadyAt) {
        frame.a = true;
        return frame;
      }
    }
  }

  // Idle drift back toward the middle of the field.
  frame.move.x = Math.max(-1, Math.min(1, -me.x * 0.15 + (rng.next() - 0.5) * 0.5));
  return frame;
}

export function register() {
  if (minigames.get(ID)) return minigames.get(ID);
  return defineMinigame({
    id: ID,
    name: { en: 'Stampede Surfers', de: 'Stampede-Surfer' },
    description: {
      en: 'Boars thunder through the run lanes - hop away or leap over them and outlast everyone.',
      de: 'Keiler donnern durch die Laufspuren - spring zur Seite oder drueber und halte am laengsten durch.',
    },
    howTo: {
      en: 'Dust clouds at the field edge warn where the next boar charges. Hop lanes with up/down, run with left/right, and leap over a boar with A. Three tramplings and you are out - survive the longest!',
      de: 'Staubwolken am Feldrand verraten, wo der naechste Keiler angreift. Wechsle die Spur mit hoch/runter, lauf mit links/rechts und spring mit A ueber einen Keiler. Dreimal ueberrannt und du bist raus - ueberlebe am laengsten!',
    },
    category: 'ffa',
    tags: ['dodge', 'timing', 'survival'],
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
