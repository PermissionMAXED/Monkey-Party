/**
 * Banana Scramble - FFA chaos/race, 2-8 players, 45s.
 *
 * Bananas rain onto a slowly tilting circular arena. Run into them to grab
 * them (+1); rare golden bananas are worth 3. Players bump each other on
 * contact. Highest banana count wins.
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

const ID = 'banana_scramble';
const DT = 1 / MINIGAME_HZ;

const DEFAULTS = {
  arenaRadius: 8,
  playerSpeed: 6,
  spawnEveryTicks: 10,
  goldenChance: 0.08,
  fallSpeed: 9,
  groundTtlTicks: 180,
  grabRadius: 0.9,
  bumpRadius: 0.95,
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
        x: Math.cos(a) * cfg.arenaRadius * 0.6,
        z: Math.sin(a) * cfg.arenaRadius * 0.6,
        vx: 0,
        vz: 0,
        score: 0,
        lastGrabTick: -1,
        lastGrabGolden: false,
        bumpedTick: -1,
      };
    });
    state = {
      id: ID,
      tick: 0,
      durationTicks,
      countdownTicks: COUNTDOWN_TICKS,
      finished: false,
      arenaRadius: cfg.arenaRadius,
      tiltAngle: 0, // Radians; direction bananas drift toward on landing.
      players: ps,
      order: pids.slice(),
      bananas: [],
      nextBananaId: 1,
      rngState: rng.state(),
    };
  }

  function step(inputsMap = {}) {
    if (state.finished) return;
    rng.setState(state.rngState);
    state.tick += 1;
    const t = state.tick;
    const playing = t > state.countdownTicks;

    // Arena tilt slowly rotates.
    state.tiltAngle = (state.tiltAngle + 0.35 * DT) % (Math.PI * 2);

    if (playing) {
      // Spawn falling bananas.
      if (t % cfg.spawnEveryTicks === 0) {
        const a = rng.next() * Math.PI * 2;
        const r = Math.sqrt(rng.next()) * (cfg.arenaRadius - 0.8);
        state.bananas.push({
          id: state.nextBananaId,
          x: Math.cos(a) * r,
          z: Math.sin(a) * r,
          y: 12,
          golden: rng.next() < cfg.goldenChance,
          ttl: cfg.groundTtlTicks,
        });
        state.nextBananaId += 1;
      }

      // Move players.
      for (const pid of state.order) {
        const p = state.players[pid];
        const frame = clampFrame(inputsMap[pid] ?? emptyFrame());
        p.vx = p.vx * 0.78 + frame.move.x * cfg.playerSpeed * 0.22;
        p.vz = p.vz * 0.78 + (-frame.move.y) * cfg.playerSpeed * 0.22;
        p.x += p.vx * DT;
        p.z += p.vz * DT;
        // Tilt gives a slight downhill drift.
        p.x += Math.cos(state.tiltAngle) * 0.35 * DT;
        p.z += Math.sin(state.tiltAngle) * 0.35 * DT;
        const d = Math.hypot(p.x, p.z);
        const maxR = cfg.arenaRadius - 0.4;
        if (d > maxR) {
          p.x = (p.x / d) * maxR;
          p.z = (p.z / d) * maxR;
        }
      }

      // Player-player bumps: push apart symmetrically.
      for (let i = 0; i < state.order.length; i += 1) {
        for (let j = i + 1; j < state.order.length; j += 1) {
          const a = state.players[state.order[i]];
          const b = state.players[state.order[j]];
          const dx = b.x - a.x;
          const dz = b.z - a.z;
          const d = Math.hypot(dx, dz);
          if (d > 0.0001 && d < cfg.bumpRadius) {
            const push = (cfg.bumpRadius - d) * 0.5 + 0.02;
            const nx = dx / d;
            const nz = dz / d;
            a.x -= nx * push;
            a.z -= nz * push;
            b.x += nx * push;
            b.z += nz * push;
            a.vx -= nx * 2.2;
            a.vz -= nz * 2.2;
            b.vx += nx * 2.2;
            b.vz += nz * 2.2;
            a.bumpedTick = t;
            b.bumpedTick = t;
          }
        }
      }
    }

    // Banana physics + grabbing + expiry.
    const kept = [];
    for (const banana of state.bananas) {
      if (banana.y > 0) {
        banana.y = Math.max(0, banana.y - cfg.fallSpeed * DT);
        // Drift downhill while falling.
        banana.x += Math.cos(state.tiltAngle) * 0.5 * DT;
        banana.z += Math.sin(state.tiltAngle) * 0.5 * DT;
      } else {
        banana.ttl -= 1;
      }
      let grabbed = false;
      if (playing && banana.y <= 0.6) {
        for (const pid of state.order) {
          const p = state.players[pid];
          if (Math.hypot(p.x - banana.x, p.z - banana.z) <= cfg.grabRadius) {
            p.score += banana.golden ? 3 : 1;
            p.lastGrabTick = t;
            p.lastGrabGolden = banana.golden;
            grabbed = true;
            break;
          }
        }
      }
      if (!grabbed && banana.ttl > 0) kept.push(banana);
    }
    state.bananas = kept;

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
    for (const pid of state.order) scores[pid] = state.players[pid].score;
    const ranking = rankByScore(scores);
    const coins = coinsForRanking(ranking, { chaos });
    const stats = {};
    for (const pid of state.order) stats[pid] = { bananas: state.players[pid].score };
    return { ranking, coins, stats };
  }

  return { init, step, getState, applyState, isFinished, getResults };
}

const REACT = { easy: 15, normal: 9, hard: 6, wild: 4 };
const AIM_ERR = { easy: 2.2, normal: 1.1, hard: 0.5, wild: 0.15 };

function bot(publicState, playerId, difficulty, rng) {
  const frame = emptyFrame();
  const s = publicState;
  const me = s?.players?.[playerId];
  if (!me || s.tick <= s.countdownTicks) return frame;

  const react = REACT[difficulty] ?? REACT.normal;
  const err = AIM_ERR[difficulty] ?? AIM_ERR.normal;

  // Pick the juiciest banana (value over distance), re-aimed with noise.
  let best = null;
  let bestScore = -Infinity;
  for (const banana of s.bananas ?? []) {
    const d = Math.hypot(banana.x - me.x, banana.z - me.z) + banana.y * 0.5;
    const v = (banana.golden ? 3 : 1) / (d + 0.5);
    if (v > bestScore) {
      bestScore = v;
      best = banana;
    }
  }
  if (!best) return frame;

  // Reaction delay: freeze heading between re-decisions.
  const jitterA = (rng.next() - 0.5) * err;
  const wobble = Math.sin((Math.floor(s.tick / react) * react) * 0.7) * err * 0.2;
  const dx = best.x - me.x + jitterA + wobble;
  const dz = best.z - me.z + (rng.next() - 0.5) * err;
  const mag = Math.hypot(dx, dz) || 1;
  frame.move.x = dx / mag;
  frame.move.y = -(dz / mag);
  return frame;
}

export function register() {
  if (minigames.get(ID)) return minigames.get(ID);
  return defineMinigame({
    id: ID,
    name: { en: 'Banana Scramble', de: 'Bananen-Gerangel' },
    description: {
      en: 'Bananas rain onto a tilting arena - grab more than anyone else!',
      de: 'Bananen regnen auf eine kippende Arena - schnapp dir mehr als alle anderen!',
    },
    howTo: {
      en: 'Move to grab falling bananas. Golden bananas are worth 3. Bump rivals out of your way!',
      de: 'Lauf zu fallenden Bananen und sammle sie ein. Goldene Bananen zaehlen 3. Remple Rivalen weg!',
    },
    category: 'ffa',
    tags: ['chaos', 'race'],
    players: { min: 2, max: 8 },
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
