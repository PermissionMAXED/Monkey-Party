/**
 * dodgeRain template - "survive the falling hazards" (package P8).
 *
 * Hazards rain onto a circular arena on a ramping seeded schedule; each
 * one telegraphs its impact spot before slamming down. Get caught in the
 * blast and you lose a life; out of lives means out of the game. Last
 * monkey standing wins, near-misses break survivor ties.
 *
 * makeDodgeRainVariant(variant) stamps out a themed MinigameDef; params
 * control hazard size/pace/lives and the theme ({palette, propSet,
 * skyColor}) read by the shared view.
 *
 * Pure ESM sim. No DOM, no three.js, no Math.random, no Date.now.
 * Fixed 30Hz steps; all randomness through shared/rng.js.
 */

import { createRng } from '../../../rng.js';
import { clampFrame, emptyFrame } from '../../inputs.js';
import {
  defineMinigame, rankByScoreGrouped, coinsForRanking, MINIGAME_HZ, COUNTDOWN_TICKS,
} from '../../framework.js';
import { minigames } from '../../../registries.js';

const DT = 1 / MINIGAME_HZ;

export const DODGE_RAIN_DEFAULTS = {
  arenaRadius: 8,
  moveSpeed: 6,
  hazardRadius: 1.6,
  telegraphTicks: 42,
  spawnEveryStart: 24,
  spawnEveryEnd: 7,
  spawnBurst: 1,
  lives: 1,
  durationSec: 60,
  theme: {
    palette: { primary: '#2e7d32', secondary: '#8d6e63', accent: '#ffe135' },
    propSet: 'jungle',
    skyColor: '#87ceeb',
  },
};

function createTemplateSim({ id, seed, players, params = {}, rules = {} } = {}) {
  const cfg = { ...DODGE_RAIN_DEFAULTS, ...params };
  const rng = createRng(seed ?? 0);
  const pids = (players ?? []).slice();
  const durationTicks = Math.round(cfg.durationSec * MINIGAME_HZ);
  const chaos = Boolean(rules.chaosMode);

  let state = null;

  function init() {
    rng.setState(Number(seed ?? 0) >>> 0);
    const ps = {};
    pids.forEach((pid, i) => {
      const a = (i / pids.length) * Math.PI * 2;
      ps[pid] = {
        slot: i,
        x: Math.cos(a) * cfg.arenaRadius * 0.55,
        z: Math.sin(a) * cfg.arenaRadius * 0.55,
        vx: 0,
        vz: 0,
        lives: cfg.lives,
        alive: true,
        elimTick: -1,
        hitTick: -1,
        dodges: 0,
      };
    });
    state = {
      id,
      tick: 0,
      durationTicks,
      countdownTicks: COUNTDOWN_TICKS,
      finished: false,
      theme: cfg.theme,
      arenaRadius: cfg.arenaRadius,
      telegraphTicks: cfg.telegraphTicks,
      hazards: [], // { id, x, z, radius, impactTick, exploded }
      nextHazardId: 1,
      nextSpawnTick: COUNTDOWN_TICKS + 20,
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

    if (playing) {
      const progress = Math.min(1, t / state.durationTicks);
      // The safe ground shrinks over time, packing survivors together.
      state.arenaRadius = cfg.arenaRadius * (1 - 0.55 * progress);

      // Ramping spawn schedule.
      if (t >= state.nextSpawnTick) {
        for (let i = 0; i < cfg.spawnBurst; i += 1) {
          const a = rng.next() * Math.PI * 2;
          const r = Math.sqrt(rng.next()) * Math.max(1, state.arenaRadius - 0.4);
          state.hazards.push({
            id: state.nextHazardId,
            x: Math.cos(a) * r,
            z: Math.sin(a) * r,
            radius: cfg.hazardRadius,
            impactTick: t + cfg.telegraphTicks,
            exploded: false,
          });
          state.nextHazardId += 1;
        }
        state.nextSpawnTick = t + Math.max(3, Math.round(cfg.spawnEveryStart
          + (cfg.spawnEveryEnd - cfg.spawnEveryStart) * progress));
      }

      // Move the survivors.
      for (const pid of state.order) {
        const p = state.players[pid];
        if (!p.alive) continue;
        const frame = clampFrame(inputsMap[pid] ?? emptyFrame());
        p.vx = p.vx * 0.78 + frame.move.x * cfg.moveSpeed * 0.22;
        p.vz = p.vz * 0.78 + (-frame.move.y) * cfg.moveSpeed * 0.22;
        p.x += p.vx * DT;
        p.z += p.vz * DT;
        const d = Math.hypot(p.x, p.z);
        const maxR = state.arenaRadius - 0.2;
        if (d > maxR) {
          p.x = (p.x / d) * maxR;
          p.z = (p.z / d) * maxR;
        }
      }

      // Impacts.
      const kept = [];
      for (const hz of state.hazards) {
        if (t === hz.impactTick) {
          hz.exploded = true;
          for (const pid of state.order) {
            const p = state.players[pid];
            if (!p.alive) continue;
            const d = Math.hypot(p.x - hz.x, p.z - hz.z);
            if (d <= hz.radius) {
              p.lives -= 1;
              p.hitTick = t;
              if (p.lives <= 0) {
                p.alive = false;
                p.elimTick = t;
                state.aliveCount -= 1;
              }
            } else if (d <= hz.radius * 2) {
              p.dodges += 1;
            }
          }
        }
        if (t <= hz.impactTick + 12) kept.push(hz);
      }
      state.hazards = kept;
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
    // Grouped: players eliminated by the same blast (same tick, same
    // near-miss count) tie for the place instead of paying by seat order.
    const ranking = rankByScoreGrouped(scores);
    const coins = coinsForRanking(ranking, { chaos });
    const stats = {};
    for (const pid of state.order) {
      const p = state.players[pid];
      stats[pid] = { survived: p.alive, nearMisses: p.dodges, livesLeft: Math.max(0, p.lives) };
    }
    return { ranking, coins, stats };
  }

  return { init, step, getState, applyState, isFinished, getResults };
}

const REACT = { easy: 14, normal: 9, hard: 5, wild: 2 };
const NOISE = { easy: 0.8, normal: 0.45, hard: 0.2, wild: 0.08 };
const MISS_PCT = { easy: 38, normal: 20, hard: 7, wild: 0 };

/** Small stable integer hash so a bot "misses" the same hazards every run. */
function ihash(a, b) {
  let h = (a * 374761393 + b * 668265263) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = (h * 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

function bot(publicState, playerId, difficulty, rng) {
  const frame = emptyFrame();
  const s = publicState;
  const me = s?.players?.[playerId];
  if (!me || !me.alive || s.tick <= s.countdownTicks) return frame;

  const react = REACT[difficulty] ?? REACT.normal;
  const noise = NOISE[difficulty] ?? NOISE.normal;
  const missPct = MISS_PCT[difficulty] ?? MISS_PCT.normal;
  const telegraph = s.telegraphTicks ?? 42;

  // Sum repulsion from every telegraphed impact zone I have noticed.
  let fx = 0;
  let fz = 0;
  for (const hz of s.hazards ?? []) {
    if (hz.exploded) continue;
    const telegraphAge = s.tick - (hz.impactTick - telegraph);
    if (telegraphAge < react) continue;
    // Sometimes a marker just goes unnoticed - stable per hazard/bot pair.
    if (ihash(hz.id * 17 + 3, me.slot) % 100 < missPct) continue;
    const dx = me.x - hz.x;
    const dz = me.z - hz.z;
    const d = Math.hypot(dx, dz);
    const danger = hz.radius + 1.6;
    if (d < danger) {
      const w = (danger - d) / danger + 0.25;
      fx += (d > 0.001 ? dx / d : 1) * w;
      fz += (d > 0.001 ? dz / d : 0) * w;
    }
  }

  if (Math.hypot(fx, fz) > 0.05) {
    const mag = Math.hypot(fx, fz);
    frame.move.x = Math.max(-1, Math.min(1, fx / mag + (rng.next() - 0.5) * noise));
    frame.move.y = Math.max(-1, Math.min(1, -(fz / mag) + (rng.next() - 0.5) * noise));
    return frame;
  }

  // No immediate threat: orbit gently near the middle of the shrinking arena.
  const a = s.tick / 55 + me.slot * 1.3;
  const orbitR = Math.min(3, (s.arenaRadius ?? 8) * 0.45);
  const tx = Math.cos(a) * orbitR;
  const tz = Math.sin(a) * orbitR;
  const dx = tx - me.x + (rng.next() - 0.5) * noise;
  const dz = tz - me.z + (rng.next() - 0.5) * noise;
  const mag = Math.hypot(dx, dz);
  if (mag > 0.4) {
    frame.move.x = dx / mag;
    frame.move.y = -(dz / mag);
  }
  return frame;
}

/**
 * Create + register one dodgeRain variant.
 *
 * @param {Object} variant See reactionDuel.js for the accepted shape.
 * @returns {import('../../../types.js').MinigameDef}
 */
export function makeDodgeRainVariant(variant = {}) {
  const id = variant.id;
  const existing = minigames.get(id);
  if (existing) return existing;
  const params = { ...DODGE_RAIN_DEFAULTS, ...(variant.params ?? {}) };
  return defineMinigame({
    id,
    name: variant.name,
    description: variant.description ?? {
      en: 'Hazards rain from above - dodge the marked impact zones and outlast everyone.',
      de: 'Gefahren regnen von oben - weiche den markierten Einschlagzonen aus und ueberlebe alle.',
    },
    howTo: variant.howTo ?? {
      en: 'Watch the warning markers and sprint clear before the impact. Last one standing wins!',
      de: 'Achte auf die Warnmarkierungen und lauf rechtzeitig weg. Wer zuletzt steht, gewinnt!',
    },
    category: variant.category ?? 'ffa',
    tags: variant.tags ?? ['survival', 'dodge'],
    players: variant.players ?? { min: 2, max: 8 },
    durationSec: params.durationSec,
    competitiveSafe: variant.competitiveSafe ?? true,
    params,
    createSim: (opts) => createTemplateSim({ ...opts, id }),
    createView: (opts) => viewFactory({ ...opts, def: minigames.get(id) }),
    bot,
  });
}

/** Late-bound shared view factory (one view file serves every variant). */
let viewFactory = () => ({ mount() {}, update() {}, dispose() {} });

/** Called by the client views package to attach the real 3D view. */
export function attachView(factory) {
  if (typeof factory === 'function') viewFactory = factory;
}

export default makeDodgeRainVariant;
