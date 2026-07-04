/**
 * targetShoot template - "aim and shoot the moving targets" (package P8).
 *
 * Everyone stands on a firing line and steers a crosshair across a
 * target wall where seeded targets glide back and forth - the smaller
 * the target, the more it scores. Press A to shoot (with a cooldown).
 * Optional flicker params hide targets periodically (night ops!), and
 * mode '1v3' pits one sharpshooter (triple score weight) against three.
 *
 * makeTargetShootVariant(variant) stamps out a themed MinigameDef;
 * params control target counts/speeds/flicker and the theme
 * ({palette, propSet, skyColor}) read by the shared view.
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

export const TARGET_SHOOT_DEFAULTS = {
  mode: 'solo', // 'solo' | '1v3'
  fieldHalfWidth: 12,
  wallDistance: 16,
  targetCount: 4,
  speedMin: 3,
  speedMax: 6.5,
  radiusMin: 0.7,
  radiusMax: 1.5,
  cooldownTicks: 16,
  aimSpeed: 9, // Crosshair speed in wall units/s.
  flickerCycleTicks: 0, // 0 = always visible.
  flickerOnTicks: 0,
  durationSec: 45,
  theme: {
    palette: { primary: '#2e7d32', secondary: '#8d6e63', accent: '#ffe135' },
    propSet: 'jungle',
    skyColor: '#87ceeb',
  },
};

function createTemplateSim({ id, seed, players, params = {}, rules = {} } = {}) {
  const cfg = { ...TARGET_SHOOT_DEFAULTS, ...params };
  const rng = createRng(seed ?? 0);
  const pids = (players ?? []).slice();
  const durationTicks = Math.round(cfg.durationSec * MINIGAME_HZ);
  const chaos = Boolean(rules.chaosMode);

  let state = null;

  function rollTarget() {
    const radius = cfg.radiusMin + rng.next() * (cfg.radiusMax - cfg.radiusMin);
    return {
      id: state.nextTargetId,
      x: (rng.next() * 2 - 1) * cfg.fieldHalfWidth,
      y: 2 + rng.next() * 5.5,
      dir: rng.next() < 0.5 ? -1 : 1,
      speed: cfg.speedMin + rng.next() * (cfg.speedMax - cfg.speedMin),
      radius,
      value: radius < 0.95 ? 3 : radius < 1.25 ? 2 : 1,
      flickerPhase: rng.int(0, Math.max(0, cfg.flickerCycleTicks - 1)),
      visible: true,
    };
  }

  function init() {
    rng.setState(Number(seed ?? 0) >>> 0);
    const ps = {};
    pids.forEach((pid, i) => {
      ps[pid] = {
        slot: i,
        team: cfg.mode === '1v3' ? (i === 0 ? 0 : 1) : 0,
        lineX: ((i + 0.5) / pids.length - 0.5) * 20,
        ax: ((i + 0.5) / pids.length - 0.5) * 20,
        ay: 4,
        cooldownUntil: 0,
        score: 0,
        hits: 0,
        shots: 0,
        prevA: false,
        lastShot: null, // { tick, ax, ay, hit, value }
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
      fieldHalfWidth: cfg.fieldHalfWidth,
      wallDistance: cfg.wallDistance,
      targets: [],
      nextTargetId: 1,
      teams: cfg.mode === '1v3' ? [{ score: 0 }, { score: 0 }] : null,
      players: ps,
      order: pids.slice(),
      rngState: rng.state(),
    };
    for (let i = 0; i < cfg.targetCount; i += 1) {
      state.targets.push(rollTarget());
      state.nextTargetId += 1;
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
      // Targets glide back and forth (and flicker, when configured).
      for (const target of state.targets) {
        target.x += target.dir * target.speed * DT;
        if (target.x > cfg.fieldHalfWidth) target.dir = -1;
        if (target.x < -cfg.fieldHalfWidth) target.dir = 1;
        target.visible = cfg.flickerCycleTicks <= 0
          || ((t + target.flickerPhase) % cfg.flickerCycleTicks) < cfg.flickerOnTicks;
      }

      for (const pid of state.order) {
        const p = state.players[pid];
        const frame = clampFrame(inputsMap[pid] ?? emptyFrame());
        const aimX = frame.aim ? frame.aim.x : frame.move.x;
        const aimY = frame.aim ? frame.aim.y : frame.move.y;
        p.ax = Math.max(-cfg.fieldHalfWidth - 2,
          Math.min(cfg.fieldHalfWidth + 2, p.ax + aimX * cfg.aimSpeed * DT));
        p.ay = Math.max(0.5, Math.min(8.5, p.ay + aimY * cfg.aimSpeed * DT));

        const edgeA = frame.a && !p.prevA;
        p.prevA = frame.a;
        if (edgeA && t >= p.cooldownUntil) {
          p.shots += 1;
          p.cooldownUntil = t + cfg.cooldownTicks;
          let hit = null;
          for (const target of state.targets) {
            if (!target.visible) continue;
            const dx = p.ax - target.x;
            const dy = p.ay - target.y;
            if (dx * dx + dy * dy <= (target.radius + 0.15) ** 2) {
              hit = target;
              break;
            }
          }
          if (hit) {
            p.score += hit.value;
            p.hits += 1;
            p.lastShot = { tick: t, ax: p.ax, ay: p.ay, hit: true, value: hit.value };
            const fresh = rollTarget();
            hit.id = fresh.id;
            hit.x = fresh.x;
            hit.y = fresh.y;
            hit.dir = fresh.dir;
            hit.speed = fresh.speed;
            hit.radius = fresh.radius;
            hit.value = fresh.value;
            hit.flickerPhase = fresh.flickerPhase;
            state.nextTargetId += 1;
          } else {
            p.lastShot = { tick: t, ax: p.ax, ay: p.ay, hit: false, value: 0 };
          }
        }
      }

      if (state.teams) {
        // The lone sharpshooter's points weigh triple against the trio.
        state.teams[0].score = state.players[state.order[0]].score * 3;
        state.teams[1].score = state.order.slice(1)
          .reduce((acc, pid) => acc + state.players[pid].score, 0);
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
      if (state.mode === '1v3') {
        const mine = state.teams[p.team].score;
        const theirs = state.teams[1 - p.team].score;
        const teamBonus = mine > theirs ? 1000000 : mine === theirs ? 500000 : 0;
        scores[pid] = teamBonus + p.score * 1000 - p.shots;
      } else {
        scores[pid] = p.score * 1000 - p.shots;
      }
    }
    const ranking = rankByScore(scores);
    const coins = coinsForRanking(ranking, { chaos });
    const stats = {};
    for (const pid of state.order) {
      const p = state.players[pid];
      stats[pid] = {
        points: p.score,
        hits: p.hits,
        shots: p.shots,
        accuracyPct: p.shots > 0 ? Math.round((p.hits / p.shots) * 100) : 0,
      };
    }
    return { ranking, coins, stats };
  }

  return { init, step, getState, applyState, isFinished, getResults };
}

const AIM_ERR = { easy: 1.5, normal: 0.8, hard: 0.3, wild: 0.1 };
const FIRE_CADENCE = { easy: 14, normal: 9, hard: 6, wild: 4 };

function bot(publicState, playerId, difficulty, rng) {
  const frame = emptyFrame();
  const s = publicState;
  const me = s?.players?.[playerId];
  if (!me || s.tick <= s.countdownTicks) return frame;

  const err = AIM_ERR[difficulty] ?? AIM_ERR.normal;
  const cadence = FIRE_CADENCE[difficulty] ?? FIRE_CADENCE.normal;

  // Chase a valuable target near my crosshair; weighting distance heavily
  // (and biasing per seat) spreads bots across different targets instead
  // of piling onto one.
  let best = null;
  let bestV = -Infinity;
  for (const target of s.targets ?? []) {
    if (!target.visible) continue;
    const seatBias = (ihash(target.id, me.slot) % 100) / 150;
    const v = target.value + seatBias
      - Math.hypot(target.x - me.ax, target.y - me.ay) * 0.4;
    if (v > bestV) {
      bestV = v;
      best = target;
    }
  }
  if (!best) return frame;

  // Slight lead plus difficulty-scaled hand shake.
  const lead = best.dir * best.speed * 0.12;
  const tx = best.x + lead + (rng.next() - 0.5) * err * 2;
  const ty = best.y + (rng.next() - 0.5) * err * 2;
  frame.move.x = Math.max(-1, Math.min(1, (tx - me.ax) * 1.2));
  frame.move.y = Math.max(-1, Math.min(1, (ty - me.ay) * 1.2));

  const onTarget = Math.hypot(best.x - me.ax, best.y - me.ay) <= best.radius * 0.95;
  if (onTarget && (s.tick + me.slot * 3) % cadence === 0) frame.a = true;
  return frame;
}

function ihash(a, b) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Create + register one targetShoot variant.
 *
 * @param {Object} variant See reactionDuel.js for the accepted shape.
 * @returns {import('../../../types.js').MinigameDef}
 */
export function makeTargetShootVariant(variant = {}) {
  const id = variant.id;
  const existing = minigames.get(id);
  if (existing) return existing;
  const params = { ...TARGET_SHOOT_DEFAULTS, ...(variant.params ?? {}) };
  return defineMinigame({
    id,
    name: variant.name,
    description: variant.description ?? {
      en: 'Track the gliding targets with your crosshair and shoot - small targets pay big.',
      de: 'Verfolge die gleitenden Ziele mit dem Fadenkreuz und schiesse - kleine Ziele zahlen gross.',
    },
    howTo: variant.howTo ?? {
      en: 'Steer your crosshair with the stick and press A to shoot (short cooldown). Small fast targets score 3, big slow ones 1. Sharpest shot wins!',
      de: 'Steuere dein Fadenkreuz mit dem Stick und druecke A zum Schiessen (kurze Abklingzeit). Kleine flinke Ziele zaehlen 3, grosse traege 1. Der beste Schuetze gewinnt!',
    },
    category: variant.category ?? 'ffa',
    tags: variant.tags ?? ['skill', 'aim'],
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

export default makeTargetShootVariant;
