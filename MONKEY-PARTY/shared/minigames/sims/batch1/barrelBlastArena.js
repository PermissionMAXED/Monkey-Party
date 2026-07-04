/**
 * Barrel Blast Arena - FFA fight, 2-8 players, 45s.
 *
 * A barrel-ringed platform shrinks while players dash-shove (A) each other
 * toward the edge. Brace (B) to resist knockback at the cost of speed.
 * Last monkey standing wins; everyone else ranks by survival time.
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

const ID = 'barrel_blast_arena';
const DT = 1 / MINIGAME_HZ;

const DEFAULTS = {
  startRadius: 8.5,
  endRadius: 3,
  playerSpeed: 5,
  braceSpeed: 1.2,
  dashSpeed: 15,
  dashTicks: 8,
  dashCooldownTicks: 36,
  hitRadius: 1.25,
  knockback: 14,
  braceFactor: 0.25,
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
      const a = (i / pids.length) * Math.PI * 2;
      ps[pid] = {
        x: Math.cos(a) * cfg.startRadius * 0.55,
        z: Math.sin(a) * cfg.startRadius * 0.55,
        vx: 0,
        vz: 0,
        faceX: -Math.cos(a),
        faceZ: -Math.sin(a),
        alive: true,
        elimTick: -1,
        bracing: false,
        dashUntil: -1,
        cooldownUntil: -1,
        knockouts: 0,
        lastHitBy: null,
        lastHitTick: -1,
        prevA: false,
      };
    });
    state = {
      id: ID,
      tick: 0,
      durationTicks,
      countdownTicks: COUNTDOWN_TICKS,
      finished: false,
      radius: cfg.startRadius,
      players: ps,
      order: pids.slice(),
      rngState: rng.state(),
    };
  }

  function currentRadius(t) {
    const shrinkStart = state.countdownTicks;
    const k = Math.max(0, Math.min(1, (t - shrinkStart) / (state.durationTicks - shrinkStart)));
    return cfg.startRadius + (cfg.endRadius - cfg.startRadius) * k;
  }

  function step(inputsMap = {}) {
    if (state.finished) return;
    rng.setState(state.rngState);
    state.tick += 1;
    const t = state.tick;
    const playing = t > state.countdownTicks;
    state.radius = currentRadius(t);

    if (playing) {
      for (const pid of state.order) {
        const p = state.players[pid];
        if (!p.alive) continue;
        const frame = clampFrame(inputsMap[pid] ?? emptyFrame());
        const aPressed = frame.a && !p.prevA;
        p.prevA = frame.a;
        p.bracing = frame.b;

        const mx = frame.move.x;
        const mz = -frame.move.y;
        const mag = Math.hypot(mx, mz);
        if (mag > 0.1) {
          p.faceX = mx / mag;
          p.faceZ = mz / mag;
        }

        if (aPressed && t >= p.cooldownUntil && !p.bracing) {
          p.dashUntil = t + cfg.dashTicks;
          p.cooldownUntil = t + cfg.dashCooldownTicks;
          p.vx = p.faceX * cfg.dashSpeed;
          p.vz = p.faceZ * cfg.dashSpeed;
        }

        if (t >= p.dashUntil) {
          const speed = p.bracing ? cfg.braceSpeed : cfg.playerSpeed;
          p.vx = p.vx * 0.72 + mx * speed * 0.28;
          p.vz = p.vz * 0.72 + mz * speed * 0.28;
        }
        p.x += p.vx * DT;
        p.z += p.vz * DT;
      }

      // Dash impacts: a dashing player shoves anyone in reach.
      for (const pid of state.order) {
        const p = state.players[pid];
        if (!p.alive || t >= p.dashUntil) continue;
        for (const oid of state.order) {
          if (oid === pid) continue;
          const o = state.players[oid];
          if (!o.alive) continue;
          const dx = o.x - p.x;
          const dz = o.z - p.z;
          const d = Math.hypot(dx, dz);
          if (d > 0.0001 && d < cfg.hitRadius) {
            const factor = o.bracing ? cfg.braceFactor : 1;
            o.vx += (dx / d) * cfg.knockback * factor;
            o.vz += (dz / d) * cfg.knockback * factor;
            o.lastHitBy = pid;
            o.lastHitTick = t;
            p.dashUntil = t; // A dash spends itself on impact.
          }
        }
      }

      // Falls: outside the shrinking platform = eliminated.
      for (const pid of state.order) {
        const p = state.players[pid];
        if (!p.alive) continue;
        if (Math.hypot(p.x, p.z) > state.radius) {
          p.alive = false;
          p.elimTick = t;
          const credit = t - p.lastHitTick <= 90 ? p.lastHitBy : null;
          if (credit && state.players[credit]) state.players[credit].knockouts += 1;
        }
      }
    }

    const alive = state.order.filter((pid) => state.players[pid].alive);
    if (alive.length <= 1 || t >= state.durationTicks) state.finished = true;
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
      // Survivors first (knockouts break ties), then by later elimination.
      scores[pid] = p.alive ? 1000000 + p.knockouts * 10 : p.elimTick;
    }
    const ranking = rankByScore(scores);
    const coins = coinsForRanking(ranking, { chaos });
    const stats = {};
    for (const pid of state.order) {
      const p = state.players[pid];
      stats[pid] = { knockouts: p.knockouts, survived: p.alive, elimTick: p.elimTick };
    }
    return { ranking, coins, stats };
  }

  return { init, step, getState, applyState, isFinished, getResults };
}

const REACT = { easy: 15, normal: 9, hard: 6, wild: 4 };
const AIM_ERR = { easy: 1.6, normal: 0.8, hard: 0.35, wild: 0.12 };

function bot(publicState, playerId, difficulty, rng) {
  const frame = emptyFrame();
  const s = publicState;
  const me = s?.players?.[playerId];
  if (!me || !me.alive || s.tick <= s.countdownTicks) return frame;

  const react = REACT[difficulty] ?? REACT.normal;
  const err = AIM_ERR[difficulty] ?? AIM_ERR.normal;

  // Nearest living opponent.
  let target = null;
  let bestD = Infinity;
  for (const oid of s.order) {
    if (oid === playerId) continue;
    const o = s.players[oid];
    if (!o.alive) continue;
    const d = Math.hypot(o.x - me.x, o.z - me.z);
    if (d < bestD) {
      bestD = d;
      target = o;
    }
  }

  // Brace when an opponent is mid-dash right next to us (after reaction lag).
  if (target && bestD < 2.4 && s.tick >= (target.dashUntil ?? -1) - 8 + react
    && s.tick < (target.dashUntil ?? -1) + react) {
    frame.b = true;
    return frame;
  }

  // Head for safety when near the edge; otherwise hunt the target.
  const myR = Math.hypot(me.x, me.z);
  let dx;
  let dz;
  if (myR > s.radius - 1.6 || !target) {
    dx = -me.x;
    dz = -me.z;
  } else {
    dx = target.x - me.x + (rng.next() - 0.5) * err;
    dz = target.z - me.z + (rng.next() - 0.5) * err;
    // Shove when close, off cooldown, and past the reaction delay window.
    if (bestD < 1.8 && s.tick >= (me.cooldownUntil ?? -1) && s.tick % react === 0
      && rng.next() > 0.15) {
      frame.a = true;
    }
  }
  const mag = Math.hypot(dx, dz) || 1;
  frame.move.x = dx / mag;
  frame.move.y = -(dz / mag);
  return frame;
}

export function register() {
  if (minigames.get(ID)) return minigames.get(ID);
  return defineMinigame({
    id: ID,
    name: { en: 'Barrel Blast Arena', de: 'Fass-Krawall-Arena' },
    description: {
      en: 'Shove rivals off a shrinking barrel platform and be the last monkey standing.',
      de: 'Schubse Rivalen von der schrumpfenden Fass-Plattform und bleib als letzter Affe stehen.',
    },
    howTo: {
      en: 'Move to run, press A to dash-shove, hold B to brace against hits. Stay on the platform!',
      de: 'Bewegen zum Laufen, A zum Rempel-Dash, B halten zum Abstuetzen. Bleib auf der Plattform!',
    },
    category: 'ffa',
    tags: ['fight'],
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
