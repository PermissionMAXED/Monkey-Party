/**
 * Monkey Cannonball Dodge - 1v3 artillery duel, exactly 4 players, 45s.
 *
 * One monkey mans the coconut cannon on the cliff (players[0], the solo
 * team) and lobs cannonballs at a raft where the other three dodge. Every
 * shot telegraphs its splash spot during the flight; the solo wins by
 * sinking all three dodgers (two hits each) before the horn.
 *
 * Pure ESM sim. No DOM, no three.js, no Math.random, no Date.now.
 * Fixed 30Hz steps; no in-step randomness (fully input-driven).
 */

import { createRng } from '../../../rng.js';
import { clampFrame, emptyFrame } from '../../inputs.js';
import {
  defineMinigame, rankByScoreGrouped, coinsForRanking, MINIGAME_HZ, COUNTDOWN_TICKS,
} from '../../framework.js';
import { minigames } from '../../../registries.js';

const ID = 'monkey_cannonball_dodge';
const DT = 1 / MINIGAME_HZ;

const DEFAULTS = {
  raftHalfW: 6, // x extent of the raft.
  raftHalfD: 4, // z extent of the raft.
  crossSpeed: 7.5,
  flightTicks: 27,
  blastRadius: 1.8,
  cooldownTicks: 42,
  dodgerSpeed: 5.6,
  lives: 2,
  invulnTicks: 45,
};

function createSim({ seed, players, params = {}, rules = {} } = {}) {
  const cfg = { ...DEFAULTS, ...params };
  const rng = createRng(seed ?? 0);
  const pids = (players ?? []).slice();
  const durationTicks = 45 * MINIGAME_HZ;
  const chaos = Boolean(rules.chaosMode);
  const soloId = params.soloId && pids.includes(params.soloId) ? params.soloId : pids[0];

  let state = null;

  function init() {
    rng.setState(Number(seed ?? 0) >>> 0);
    const dodgers = pids.filter((pid) => pid !== soloId);
    const ps = {};
    ps[soloId] = {
      slot: pids.indexOf(soloId),
      role: 'solo',
      x: 0, // Crosshair position on the raft.
      z: 0,
      vx: 0,
      vz: 0,
      score: 0, // Hits landed (HUD chip).
      shots: 0,
      readyAt: 0,
      prevA: false,
      alive: true,
      lives: 0,
      elimTick: -1,
      hitTick: -1,
      invulnUntil: -1,
    };
    dodgers.forEach((pid, i) => {
      ps[pid] = {
        slot: pids.indexOf(pid),
        role: 'dodger',
        x: (i - (dodgers.length - 1) / 2) * 3.4,
        z: 0,
        vx: 0,
        vz: 0,
        score: cfg.lives, // Lives left (HUD chip).
        shots: 0,
        readyAt: 0,
        prevA: false,
        alive: true,
        lives: cfg.lives,
        elimTick: -1,
        hitTick: -1,
        invulnUntil: -1,
      };
    });
    state = {
      id: ID,
      tick: 0,
      durationTicks,
      countdownTicks: COUNTDOWN_TICKS,
      finished: false,
      raftHalfW: cfg.raftHalfW,
      raftHalfD: cfg.raftHalfD,
      blastRadius: cfg.blastRadius,
      flightTicks: cfg.flightTicks,
      soloId,
      aliveDodgers: dodgers.length,
      soloWon: false,
      shots: [], // { id, x, z, landTick }
      nextShotId: 1,
      lastSplash: null, // { x, z, tick, hits } for view feedback.
      players: ps,
      order: pids.slice(),
      rngState: rng.state(),
    };
  }

  function step(inputsMap = {}) {
    if (state.finished) return;
    state.tick += 1;
    const t = state.tick;
    const playing = t > state.countdownTicks;

    if (playing) {
      // Solo: steer the crosshair (aim stick preferred) and fire.
      const solo = state.players[state.soloId];
      const soloFrame = clampFrame(inputsMap[state.soloId] ?? emptyFrame());
      const ax = soloFrame.aim ? soloFrame.aim.x : soloFrame.move.x;
      const az = soloFrame.aim ? soloFrame.aim.y : soloFrame.move.y;
      solo.x = Math.max(-cfg.raftHalfW, Math.min(cfg.raftHalfW, solo.x + ax * cfg.crossSpeed * DT));
      solo.z = Math.max(-cfg.raftHalfD, Math.min(cfg.raftHalfD, solo.z + az * cfg.crossSpeed * DT));
      const soloEdgeA = soloFrame.a && !solo.prevA;
      solo.prevA = soloFrame.a;
      if (soloEdgeA && t >= solo.readyAt) {
        state.shots.push({ id: state.nextShotId, x: solo.x, z: solo.z, landTick: t + cfg.flightTicks });
        state.nextShotId += 1;
        solo.shots += 1;
        solo.readyAt = t + cfg.cooldownTicks;
      }

      // Dodgers: run around the raft.
      for (const pid of state.order) {
        const p = state.players[pid];
        if (p.role !== 'dodger' || !p.alive) continue;
        const frame = clampFrame(inputsMap[pid] ?? emptyFrame());
        p.vx = p.vx * 0.72 + frame.move.x * cfg.dodgerSpeed * 0.28;
        p.vz = p.vz * 0.72 + frame.move.y * cfg.dodgerSpeed * 0.28;
        p.x = Math.max(-cfg.raftHalfW, Math.min(cfg.raftHalfW, p.x + p.vx * DT));
        p.z = Math.max(-cfg.raftHalfD, Math.min(cfg.raftHalfD, p.z + p.vz * DT));
      }

      // Cannonballs splash down.
      const landed = [];
      state.shots = state.shots.filter((shot) => {
        if (t < shot.landTick) return true;
        landed.push(shot);
        return false;
      });
      for (const shot of landed) {
        let hits = 0;
        for (const pid of state.order) {
          const p = state.players[pid];
          if (p.role !== 'dodger' || !p.alive || t < p.invulnUntil) continue;
          if (Math.hypot(p.x - shot.x, p.z - shot.z) <= cfg.blastRadius) {
            p.lives -= 1;
            p.score = p.lives;
            p.hitTick = t;
            p.invulnUntil = t + cfg.invulnTicks;
            solo.score += 1;
            hits += 1;
            if (p.lives <= 0) {
              p.alive = false;
              p.elimTick = t;
              state.aliveDodgers -= 1;
            }
          }
        }
        state.lastSplash = { x: shot.x, z: shot.z, tick: t, hits };
      }

      if (state.aliveDodgers <= 0) {
        state.soloWon = true;
        state.finished = true;
      }
    }

    if (t >= state.durationTicks) state.finished = true;
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
      if (p.role === 'solo') {
        scores[pid] = (state.soloWon ? 2000000000 : 0) + p.score * 1000;
      } else {
        scores[pid] = (state.soloWon ? 0 : 1000000000)
          + p.lives * 1000000
          + (p.alive ? state.durationTicks : p.elimTick);
      }
    }
    const ranking = rankByScoreGrouped(scores);
    const coins = coinsForRanking(ranking, { chaos });
    const stats = {};
    for (const pid of state.order) {
      const p = state.players[pid];
      stats[pid] = p.role === 'solo'
        ? { role: 'solo', hits: p.score, shots: p.shots, sankAll: state.soloWon }
        : {
          role: 'dodger',
          livesLeft: p.lives,
          survived: p.alive,
          surviveSec: Math.round(((p.alive ? state.tick : p.elimTick) / MINIGAME_HZ) * 10) / 10,
        };
    }
    return { ranking, coins, stats };
  }

  return { init, step, getState, applyState, isFinished, getResults };
}

const REACT = { easy: 18, normal: 12, hard: 7, wild: 4 };
const AIM_ERR = { easy: 2.4, normal: 1.4, hard: 0.7, wild: 0.25 };
const LEAD_Q = { easy: 0.2, normal: 0.55, hard: 0.85, wild: 1.0 };

function bot(publicState, playerId, difficulty, rng) {
  const frame = emptyFrame();
  const s = publicState;
  const me = s?.players?.[playerId];
  if (!me || s.tick <= s.countdownTicks) return frame;

  const react = REACT[difficulty] ?? REACT.normal;

  if (me.role === 'solo') {
    // Aim ahead of the closest living dodger and fire when lined up.
    const err = AIM_ERR[difficulty] ?? AIM_ERR.normal;
    const lead = LEAD_Q[difficulty] ?? LEAD_Q.normal;
    let best = null;
    let bestD = Infinity;
    for (const pid of s.order) {
      const p = s.players[pid];
      if (p.role !== 'dodger' || !p.alive) continue;
      const d = Math.hypot(p.x - me.x, p.z - me.z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (!best) return frame;
    const flightSec = (s.flightTicks ?? 27) / MINIGAME_HZ;
    const tx = best.x + best.vx * flightSec * lead + (rng.next() - 0.5) * err;
    const tz = best.z + best.vz * flightSec * lead + (rng.next() - 0.5) * err;
    frame.move.x = Math.max(-1, Math.min(1, (tx - me.x) * 1.4));
    frame.move.y = Math.max(-1, Math.min(1, (tz - me.z) * 1.4));
    if (s.tick >= me.readyAt && Math.hypot(tx - me.x, tz - me.z) < 0.9
      && s.tick % react < Math.ceil(react / 2)) frame.a = true;
    return frame;
  }

  if (!me.alive) return frame;

  // Dodger: flee any splash marker that threatens me (noticing takes time).
  let threat = null;
  let threatD = Infinity;
  for (const shot of s.shots ?? []) {
    const age = s.tick - (shot.landTick - (s.flightTicks ?? 27));
    if (age < react) continue;
    const d = Math.hypot(me.x - shot.x, me.z - shot.z);
    if (d <= (s.blastRadius ?? 1.8) + 1.3 && d < threatD) {
      threatD = d;
      threat = shot;
    }
  }
  if (threat) {
    let fx = me.x - threat.x;
    let fz = me.z - threat.z;
    const mag = Math.hypot(fx, fz);
    if (mag < 0.05) {
      fx = me.x >= 0 ? -1 : 1; // Dead-center: bail toward the middle.
      fz = 0;
    } else {
      fx /= mag;
      fz /= mag;
    }
    // Cornered? Push back toward the raft center instead of into the rail.
    if (Math.abs(me.x + fx) > (s.raftHalfW ?? 6) - 0.3) fx = -Math.sign(me.x);
    if (Math.abs(me.z + fz) > (s.raftHalfD ?? 4) - 0.3) fz = -Math.sign(me.z);
    frame.move.x = fx;
    frame.move.y = fz;
    return frame;
  }
  // No threat: drift loosely toward a wandering anchor point.
  frame.move.x = Math.max(-1, Math.min(1, (-me.x * 0.2) + (rng.next() - 0.5) * 0.8));
  frame.move.y = Math.max(-1, Math.min(1, (-me.z * 0.2) + (rng.next() - 0.5) * 0.8));
  return frame;
}

export function register() {
  if (minigames.get(ID)) return minigames.get(ID);
  return defineMinigame({
    id: ID,
    name: { en: 'Monkey Cannonball Dodge', de: 'Affen-Kanonenkugel-Tanz' },
    description: {
      en: 'One monkey rains cannonballs on the raft, three monkeys dance between the splashes.',
      de: 'Ein Affe laesst Kanonenkugeln auf das Floss regnen, drei Affen tanzen zwischen den Einschlaegen.',
    },
    howTo: {
      en: 'Cannoneer: steer the crosshair and fire (A) - every shot shows its splash spot while it flies. Dodgers: sprint clear before it lands! Two hits sink a dodger; sink all three to win as the cannoneer.',
      de: 'Kanonier: Fadenkreuz steuern und feuern (A) - jeder Schuss zeigt im Flug seinen Einschlagpunkt. Ausweicher: rennt weg, bevor er landet! Zwei Treffer versenken einen Ausweicher; versenke alle drei, um als Kanonier zu gewinnen.',
    },
    category: '1v3',
    tags: ['aim', 'dodge', 'asymmetric'],
    players: { min: 4, max: 4 },
    durationSec: 45,
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
