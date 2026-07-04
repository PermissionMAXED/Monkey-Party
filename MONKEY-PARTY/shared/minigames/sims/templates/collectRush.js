/**
 * collectRush template - "grab the goodies before the clock" (package P8).
 *
 * Pickups litter a circular arena: most are worth points (rare shiny
 * ones are worth 3), but some are booby-trapped and stun you while
 * draining your haul. Grabbed pickups respawn elsewhere after a beat.
 * Solo mode ranks personal scores; 'teams' mode (2v2) sums team hauls.
 * Optional magnetRadius makes nearby pickups drift toward players.
 *
 * makeCollectRushVariant(variant) stamps out a themed MinigameDef;
 * params control counts/traps/magnet and the theme ({palette, propSet,
 * skyColor}) read by the shared view.
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

const DT = 1 / MINIGAME_HZ;

export const COLLECT_RUSH_DEFAULTS = {
  mode: 'solo', // 'solo' | 'teams'
  arenaRadius: 8.5,
  moveSpeed: 6,
  pickupCount: 12,
  trapChance: 0.2,
  bigChance: 0.25,
  respawnTicks: 45,
  stunTicks: 40,
  trapPenalty: 2,
  magnetRadius: 0,
  grabRadius: 0.95,
  durationSec: 45,
  theme: {
    palette: { primary: '#2e7d32', secondary: '#8d6e63', accent: '#ffe135' },
    propSet: 'jungle',
    skyColor: '#87ceeb',
  },
};

function createTemplateSim({ id, seed, players, params = {}, rules = {} } = {}) {
  const cfg = { ...COLLECT_RUSH_DEFAULTS, ...params };
  const rng = createRng(seed ?? 0);
  const pids = (players ?? []).slice();
  const durationTicks = Math.round(cfg.durationSec * MINIGAME_HZ);
  const chaos = Boolean(rules.chaosMode);
  const teamAOf = Math.ceil(pids.length / 2);

  let state = null;

  function rollPickup(activeFrom) {
    const a = rng.next() * Math.PI * 2;
    const r = Math.sqrt(rng.next()) * (cfg.arenaRadius - 1);
    const trapped = rng.next() < cfg.trapChance;
    return {
      id: state.nextPickupId,
      x: Math.cos(a) * r,
      z: Math.sin(a) * r,
      trapped,
      value: trapped ? 0 : (rng.next() < cfg.bigChance ? 3 : 1),
      activeFrom,
    };
  }

  function init() {
    rng.setState(Number(seed ?? 0) >>> 0);
    const ps = {};
    pids.forEach((pid, i) => {
      const a = (i / pids.length) * Math.PI * 2;
      ps[pid] = {
        slot: i,
        team: i < teamAOf ? 0 : 1,
        x: Math.cos(a) * cfg.arenaRadius * 0.6,
        z: Math.sin(a) * cfg.arenaRadius * 0.6,
        vx: 0,
        vz: 0,
        score: 0,
        grabs: 0,
        trapsHit: 0,
        stunUntil: -1,
        lastGrabTick: -1,
        lastGrabValue: 0,
      };
    });
    state = {
      id,
      tick: 0,
      durationTicks,
      countdownTicks: COUNTDOWN_TICKS,
      finished: false,
      theme: cfg.theme,
      mode: cfg.mode,
      arenaRadius: cfg.arenaRadius,
      pickups: [],
      nextPickupId: 1,
      teams: cfg.mode === 'teams' ? [{ score: 0 }, { score: 0 }] : null,
      players: ps,
      order: pids.slice(),
      rngState: rng.state(),
    };
    for (let i = 0; i < cfg.pickupCount; i += 1) {
      state.pickups.push(rollPickup(0));
      state.nextPickupId += 1;
    }
    state.rngState = rng.state();
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
        const stunned = t < p.stunUntil;
        const frame = stunned ? emptyFrame() : clampFrame(inputsMap[pid] ?? emptyFrame());
        p.vx = p.vx * 0.78 + frame.move.x * cfg.moveSpeed * 0.22;
        p.vz = p.vz * 0.78 + (-frame.move.y) * cfg.moveSpeed * 0.22;
        p.x += p.vx * DT;
        p.z += p.vz * DT;
        const d = Math.hypot(p.x, p.z);
        const maxR = cfg.arenaRadius - 0.4;
        if (d > maxR) {
          p.x = (p.x / d) * maxR;
          p.z = (p.z / d) * maxR;
        }
      }

      for (const pk of state.pickups) {
        if (t < pk.activeFrom) continue;

        // Magnet variants: pickups slide toward the nearest player.
        if (cfg.magnetRadius > 0) {
          let near = null;
          let nearD = Infinity;
          for (const pid of state.order) {
            const p = state.players[pid];
            const dd = Math.hypot(p.x - pk.x, p.z - pk.z);
            if (dd < nearD) {
              nearD = dd;
              near = p;
            }
          }
          if (near && nearD < cfg.magnetRadius && nearD > 0.05) {
            pk.x += ((near.x - pk.x) / nearD) * 2.2 * DT;
            pk.z += ((near.z - pk.z) / nearD) * 2.2 * DT;
          }
        }

        // Grabs (same-tick races resolve in player order, deterministically).
        for (const pid of state.order) {
          const p = state.players[pid];
          if (t < p.stunUntil) continue;
          if (Math.hypot(p.x - pk.x, p.z - pk.z) > cfg.grabRadius) continue;
          if (pk.trapped) {
            p.stunUntil = t + cfg.stunTicks;
            p.trapsHit += 1;
            p.score -= cfg.trapPenalty;
            p.lastGrabTick = t;
            p.lastGrabValue = -cfg.trapPenalty;
          } else {
            p.score += pk.value;
            p.grabs += 1;
            p.lastGrabTick = t;
            p.lastGrabValue = pk.value;
          }
          const fresh = rollPickup(t + cfg.respawnTicks);
          pk.id = fresh.id;
          pk.x = fresh.x;
          pk.z = fresh.z;
          pk.trapped = fresh.trapped;
          pk.value = fresh.value;
          pk.activeFrom = fresh.activeFrom;
          state.nextPickupId += 1;
          break;
        }
      }

      if (state.teams) {
        state.teams[0].score = 0;
        state.teams[1].score = 0;
        for (const pid of state.order) {
          const p = state.players[pid];
          state.teams[p.team].score += p.score;
        }
      }
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
      scores[pid] = state.mode === 'teams'
        ? state.teams[p.team].score * 10000 + p.score * 10 + p.grabs
        : p.score * 100 + p.grabs;
    }
    const ranking = rankByScore(scores);
    const coins = coinsForRanking(ranking, { chaos });
    const stats = {};
    for (const pid of state.order) {
      const p = state.players[pid];
      stats[pid] = state.mode === 'teams'
        ? { team: p.team, teamScore: state.teams[p.team].score, points: p.score, trapsHit: p.trapsHit }
        : { points: p.score, grabs: p.grabs, trapsHit: p.trapsHit };
    }
    return { ranking, coins, stats };
  }

  return { init, step, getState, applyState, isFinished, getResults };
}

const NOISE = { easy: 1.4, normal: 0.8, hard: 0.35, wild: 0.1 };
const DETECT_PCT = { easy: 55, normal: 78, hard: 93, wild: 99 };

function ihash(a, b) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

function bot(publicState, playerId, difficulty, rng) {
  const frame = emptyFrame();
  const s = publicState;
  const me = s?.players?.[playerId];
  if (!me || s.tick <= s.countdownTicks || s.tick < me.stunUntil) return frame;

  const noise = NOISE[difficulty] ?? NOISE.normal;
  const detectPct = DETECT_PCT[difficulty] ?? DETECT_PCT.normal;

  // Chase the juiciest pickup; sharp eyes skip the booby-trapped ones.
  let best = null;
  let bestV = -Infinity;
  for (const pk of s.pickups ?? []) {
    if (s.tick < pk.activeFrom) continue;
    const spotted = ihash(pk.id * 7 + 1, me.slot) % 100 < detectPct;
    if (pk.trapped && spotted) continue;
    const d = Math.hypot(pk.x - me.x, pk.z - me.z);
    const v = (pk.trapped ? 1 : pk.value) / (d + 0.6);
    if (v > bestV) {
      bestV = v;
      best = pk;
    }
  }
  if (!best) return frame;

  const dx = best.x - me.x + (rng.next() - 0.5) * noise;
  const dz = best.z - me.z + (rng.next() - 0.5) * noise;
  const mag = Math.hypot(dx, dz) || 1;
  frame.move.x = dx / mag;
  frame.move.y = -(dz / mag);
  return frame;
}

/**
 * Create + register one collectRush variant.
 *
 * @param {Object} variant See reactionDuel.js for the accepted shape.
 * @returns {import('../../../types.js').MinigameDef}
 */
export function makeCollectRushVariant(variant = {}) {
  const id = variant.id;
  const existing = minigames.get(id);
  if (existing) return existing;
  const params = { ...COLLECT_RUSH_DEFAULTS, ...(variant.params ?? {}) };
  return defineMinigame({
    id,
    name: variant.name,
    description: variant.description ?? {
      en: 'Scoop up scattered treasure before the clock - but some pieces are booby-trapped.',
      de: 'Sammle verstreute Schaetze gegen die Uhr - aber einige sind mit Fallen praepariert.',
    },
    howTo: variant.howTo ?? {
      en: 'Run into pickups to collect them (shiny ones are worth 3). Trapped ones wobble suspiciously and stun you - keep your eyes open!',
      de: 'Lauf in die Schaetze, um sie einzusammeln (glaenzende zaehlen 3). Praeparierte wackeln verdaechtig und betaeuben dich - Augen auf!',
    },
    category: variant.category ?? 'ffa',
    tags: variant.tags ?? ['race', 'collect'],
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

export default makeCollectRushVariant;
