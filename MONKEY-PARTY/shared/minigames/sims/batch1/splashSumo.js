/**
 * Splash Sumo - 1v3 fight, exactly 4 players, 45s.
 *
 * One big gorilla (players[0], the solo team) versus three small monkeys
 * on a raft. The gorilla is slower but shoves much harder; it wins by
 * splashing all three monkeys before time runs out.
 *
 * Pure ESM sim. No DOM, no three.js, no Math.random, no Date.now.
 * Fixed 30Hz steps; all randomness through shared/rng.js.
 */

import { createRng } from '../../../rng.js';
import { clampFrame, emptyFrame } from '../../inputs.js';
import {
  defineMinigame, coinsForRanking, MINIGAME_HZ, COUNTDOWN_TICKS,
} from '../../framework.js';
import { minigames } from '../../../registries.js';

const ID = 'splash_sumo';
const DT = 1 / MINIGAME_HZ;

const DEFAULTS = {
  raftRadius: 7,
  gorillaSpeed: 3.8,
  monkeySpeed: 5.4,
  gorillaDash: 12,
  monkeyDash: 14,
  dashTicks: 8,
  gorillaCooldown: 30,
  monkeyCooldown: 42,
  gorillaHitRadius: 1.7,
  monkeyHitRadius: 1.0,
  gorillaKnockback: 20,
  monkeyKnockback: 7,
  braceFactor: 0.3,
};

function createSim({ seed, players, params = {}, rules = {} } = {}) {
  const cfg = { ...DEFAULTS, ...params };
  const rng = createRng(seed ?? 0);
  const pids = (players ?? []).slice();
  const durationTicks = 45 * MINIGAME_HZ;
  const chaos = Boolean(rules.chaosMode);
  const gorillaId = params.soloId && pids.includes(params.soloId) ? params.soloId : pids[0];

  let state = null;

  function init() {
    rng.setState(Number(seed ?? 0) >>> 0);
    const ps = {};
    const monkeys = pids.filter((pid) => pid !== gorillaId);
    ps[gorillaId] = {
      role: 'gorilla',
      x: 0,
      z: 0,
      vx: 0,
      vz: 0,
      faceX: 0,
      faceZ: 1,
      alive: true,
      elimTick: -1,
      bracing: false,
      dashUntil: -1,
      cooldownUntil: -1,
      shoves: 0,
      prevA: false,
    };
    monkeys.forEach((pid, i) => {
      const a = (i / monkeys.length) * Math.PI * 2 + 0.7;
      ps[pid] = {
        role: 'monkey',
        x: Math.cos(a) * cfg.raftRadius * 0.65,
        z: Math.sin(a) * cfg.raftRadius * 0.65,
        vx: 0,
        vz: 0,
        faceX: -Math.cos(a),
        faceZ: -Math.sin(a),
        alive: true,
        elimTick: -1,
        bracing: false,
        dashUntil: -1,
        cooldownUntil: -1,
        shoves: 0,
        prevA: false,
      };
    });
    state = {
      id: ID,
      tick: 0,
      durationTicks,
      countdownTicks: COUNTDOWN_TICKS,
      finished: false,
      raftRadius: cfg.raftRadius,
      gorillaId,
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
        if (!p.alive) continue;
        const isGorilla = p.role === 'gorilla';
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

        const cooldown = isGorilla ? cfg.gorillaCooldown : cfg.monkeyCooldown;
        const dashSpeed = isGorilla ? cfg.gorillaDash : cfg.monkeyDash;
        if (aPressed && t >= p.cooldownUntil && !p.bracing) {
          p.dashUntil = t + cfg.dashTicks;
          p.cooldownUntil = t + cooldown;
          p.vx = p.faceX * dashSpeed;
          p.vz = p.faceZ * dashSpeed;
        }

        if (t >= p.dashUntil) {
          const base = isGorilla ? cfg.gorillaSpeed : cfg.monkeySpeed;
          const speed = p.bracing ? base * 0.25 : base;
          p.vx = p.vx * 0.72 + mx * speed * 0.28;
          p.vz = p.vz * 0.72 + mz * speed * 0.28;
        }
        p.x += p.vx * DT;
        p.z += p.vz * DT;
      }

      // Dash impacts (asymmetric power and reach).
      for (const pid of state.order) {
        const p = state.players[pid];
        if (!p.alive || t >= p.dashUntil) continue;
        const isGorilla = p.role === 'gorilla';
        const reach = isGorilla ? cfg.gorillaHitRadius : cfg.monkeyHitRadius;
        const power = isGorilla ? cfg.gorillaKnockback : cfg.monkeyKnockback;
        for (const oid of state.order) {
          if (oid === pid) continue;
          const o = state.players[oid];
          if (!o.alive) continue;
          const dx = o.x - p.x;
          const dz = o.z - p.z;
          const d = Math.hypot(dx, dz);
          if (d > 0.0001 && d < reach) {
            const factor = o.bracing ? cfg.braceFactor : 1;
            // Shoving the heavy gorilla is extra hard.
            const massFactor = o.role === 'gorilla' ? 0.45 : 1;
            o.vx += (dx / d) * power * factor * massFactor;
            o.vz += (dz / d) * power * factor * massFactor;
            p.shoves += 1;
            p.dashUntil = t;
          }
        }
      }

      // Splash! Anyone off the raft is out.
      for (const pid of state.order) {
        const p = state.players[pid];
        if (!p.alive) continue;
        if (Math.hypot(p.x, p.z) > state.raftRadius) {
          p.alive = false;
          p.elimTick = t;
        }
      }
    }

    const gorilla = state.players[state.gorillaId];
    const aliveMonkeys = state.order.filter(
      (pid) => pid !== state.gorillaId && state.players[pid].alive,
    );
    if (!gorilla.alive || aliveMonkeys.length === 0 || t >= state.durationTicks) {
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
    const monkeys = state.order.filter((pid) => pid !== state.gorillaId);
    const byElimDesc = (a, b) => (state.players[b].elimTick - state.players[a].elimTick);
    const gorillaWins = monkeys.every((pid) => !state.players[pid].alive);

    let ranking;
    if (gorillaWins) {
      ranking = [state.gorillaId, ...monkeys.slice().sort(byElimDesc)];
    } else {
      const aliveM = monkeys.filter((pid) => state.players[pid].alive)
        .sort((a, b) => state.players[b].shoves - state.players[a].shoves);
      const deadM = monkeys.filter((pid) => !state.players[pid].alive).sort(byElimDesc);
      ranking = [...aliveM, ...deadM, state.gorillaId];
    }
    const coins = coinsForRanking(ranking, { chaos });
    const stats = {};
    for (const pid of state.order) {
      const p = state.players[pid];
      stats[pid] = { role: p.role, shoves: p.shoves, survived: p.alive, gorillaWins };
    }
    return { ranking, coins, stats };
  }

  return { init, step, getState, applyState, isFinished, getResults };
}

const REACT = { easy: 15, normal: 9, hard: 6, wild: 4 };
const AIM_ERR = { easy: 1.8, normal: 0.9, hard: 0.4, wild: 0.12 };

function bot(publicState, playerId, difficulty, rng) {
  const frame = emptyFrame();
  const s = publicState;
  const me = s?.players?.[playerId];
  if (!me || !me.alive || s.tick <= s.countdownTicks) return frame;

  const react = REACT[difficulty] ?? REACT.normal;
  const err = AIM_ERR[difficulty] ?? AIM_ERR.normal;
  const gorilla = s.players[s.gorillaId];

  let dx;
  let dz;
  if (me.role === 'gorilla') {
    // Chase the nearest living monkey.
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
    if (!target) return frame;
    dx = target.x - me.x + (rng.next() - 0.5) * err;
    dz = target.z - me.z + (rng.next() - 0.5) * err;
    if (bestD < 2.2 && s.tick >= (me.cooldownUntil ?? -1) && s.tick % react === 0) frame.a = true;
  } else {
    const dG = Math.hypot(gorilla.x - me.x, gorilla.z - me.z);
    // Brace when the gorilla is dashing at us (after reaction lag).
    if (gorilla.alive && dG < 2.6 && s.tick < (gorilla.dashUntil ?? -1) + react
      && s.tick >= (gorilla.dashUntil ?? -1) - 8 + react) {
      frame.b = true;
      return frame;
    }
    // Orbit away from the gorilla while staying clear of the water.
    const away = gorilla.alive ? Math.atan2(me.z - gorilla.z, me.x - gorilla.x) : 0;
    const orbitA = away + 0.9;
    const safeR = s.raftRadius * 0.62;
    const tx = Math.cos(orbitA) * safeR;
    const tz = Math.sin(orbitA) * safeR;
    dx = tx - me.x + (rng.next() - 0.5) * err;
    dz = tz - me.z + (rng.next() - 0.5) * err;
    // Opportunistic counter-shove from behind.
    if (gorilla.alive && dG < 1.6 && s.tick >= (me.cooldownUntil ?? -1)
      && s.tick % (react * 2) === 0 && rng.next() < 0.4) {
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
    name: { en: 'Splash Sumo', de: 'Platsch-Sumo' },
    description: {
      en: 'One giant gorilla against three nimble monkeys on a wobbly raft.',
      de: 'Ein riesiger Gorilla gegen drei flinke Affen auf einem wackligen Floss.',
    },
    howTo: {
      en: 'Gorilla: shove (A) all three monkeys into the water. Monkeys: dodge, brace (B), and survive until time runs out!',
      de: 'Gorilla: schubse (A) alle drei Affen ins Wasser. Affen: ausweichen, abstuetzen (B) und bis zum Ende ueberleben!',
    },
    category: '1v3',
    tags: ['fight'],
    players: { min: 4, max: 4 },
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
