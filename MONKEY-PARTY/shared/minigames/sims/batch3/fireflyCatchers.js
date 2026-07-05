/**
 * Firefly Catchers - FFA net-timing chase, 2-8 players, 45s. Night scene.
 *
 * Fireflies drift across a moonlit glade and scatter when a monkey gets
 * close. Swing your net (A) to snap up everything inside the swing circle
 * - but a whiffed swing leaves you stumbling for a moment. A golden
 * firefly flits in now and then and is worth three.
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

const ID = 'firefly_catchers';
const DT = 1 / MINIGAME_HZ;

const DEFAULTS = {
  meadowRadius: 9,
  flyBase: 3, // Normal fireflies = flyBase + one per player.
  flySpeed: 3.4,
  goldenSpeed: 4.9,
  fleeRadius: 2.7,
  turnJitter: 0.4,
  playerSpeed: 5.4,
  whiffSpeed: 2.4,
  whiffTicks: 10,
  swingRadius: 1.6,
  swingCooldown: 26,
  goldenEvery: 270,
  goldenLife: 240,
  goldenWorth: 3,
};

function createSim({ seed, players, params = {}, rules = {} } = {}) {
  const cfg = { ...DEFAULTS, ...params };
  const rng = createRng(seed ?? 0);
  const pids = (players ?? []).slice();
  const durationTicks = 45 * MINIGAME_HZ;
  const chaos = Boolean(rules.chaosMode);

  let state = null;

  function spawnFly(golden, t) {
    const a = rng.next() * Math.PI * 2;
    const r = 4.5 + rng.next() * (cfg.meadowRadius - 5);
    const fly = {
      id: state.nextFlyId,
      x: Math.cos(a) * r,
      z: Math.sin(a) * r,
      a: rng.next() * Math.PI * 2, // Heading.
      golden,
      expireTick: golden ? t + cfg.goldenLife : -1,
    };
    state.nextFlyId += 1;
    return fly;
  }

  function init() {
    rng.setState(Number(seed ?? 0) >>> 0);
    const ps = {};
    pids.forEach((pid, i) => {
      const a = (i / pids.length) * Math.PI * 2;
      ps[pid] = {
        slot: i,
        x: Math.cos(a) * (cfg.meadowRadius - 2),
        z: Math.sin(a) * (cfg.meadowRadius - 2),
        vx: 0,
        vz: 0,
        score: 0,
        catches: 0,
        goldenCatches: 0,
        whiffs: 0,
        swingReadyAt: 0,
        slowUntil: -1,
        swingTick: -1,
        catchTick: -1,
        prevA: false,
      };
    });
    state = {
      id: ID,
      tick: 0,
      durationTicks,
      countdownTicks: COUNTDOWN_TICKS,
      finished: false,
      meadowRadius: cfg.meadowRadius,
      swingRadius: cfg.swingRadius,
      flies: [],
      nextFlyId: 1,
      nextGoldenTick: COUNTDOWN_TICKS + cfg.goldenEvery,
      players: ps,
      order: pids.slice(),
      rngState: rng.state(),
    };
    const flyCount = cfg.flyBase + pids.length;
    for (let i = 0; i < flyCount; i += 1) state.flies.push(spawnFly(false, 0));
    state.rngState = rng.state();
  }

  function step(inputsMap = {}) {
    if (state.finished) return;
    rng.setState(state.rngState);
    state.tick += 1;
    const t = state.tick;
    const playing = t > state.countdownTicks;

    if (playing) {
      // Golden firefly schedule.
      if (t >= state.nextGoldenTick) {
        state.flies.push(spawnFly(true, t));
        state.nextGoldenTick = t + cfg.goldenEvery + rng.int(-40, 40);
      }
      state.flies = state.flies.filter((fly) => !(fly.golden && t >= fly.expireTick));

      // Fireflies wander and scatter away from nearby monkeys.
      for (const fly of state.flies) {
        fly.a += (rng.next() - 0.5) * cfg.turnJitter;
        let nearest = null;
        let nearestD = Infinity;
        for (const pid of state.order) {
          const p = state.players[pid];
          const d = Math.hypot(fly.x - p.x, fly.z - p.z);
          if (d < nearestD) {
            nearestD = d;
            nearest = p;
          }
        }
        if (nearest && nearestD < cfg.fleeRadius) {
          const away = Math.atan2(fly.z - nearest.z, fly.x - nearest.x);
          fly.a = away + (rng.next() - 0.5) * 0.5;
        }
        const speed = fly.golden ? cfg.goldenSpeed : cfg.flySpeed;
        fly.x += Math.cos(fly.a) * speed * DT;
        fly.z += Math.sin(fly.a) * speed * DT;
        const rd = Math.hypot(fly.x, fly.z);
        if (rd > cfg.meadowRadius - 0.5) {
          fly.a = Math.atan2(-fly.z, -fly.x) + (rng.next() - 0.5) * 0.6;
        }
      }

      // Monkeys move and swing.
      for (const pid of state.order) {
        const p = state.players[pid];
        const frame = clampFrame(inputsMap[pid] ?? emptyFrame());
        const speed = t < p.slowUntil ? cfg.whiffSpeed : cfg.playerSpeed;
        p.vx = p.vx * 0.74 + frame.move.x * speed * 0.26;
        p.vz = p.vz * 0.74 + (-frame.move.y) * speed * 0.26;
        p.x += p.vx * DT;
        p.z += p.vz * DT;
        const rd = Math.hypot(p.x, p.z);
        if (rd > cfg.meadowRadius) {
          p.x = (p.x / rd) * cfg.meadowRadius;
          p.z = (p.z / rd) * cfg.meadowRadius;
        }

        const edgeA = frame.a && !p.prevA;
        p.prevA = frame.a;
        if (edgeA && t >= p.swingReadyAt) {
          p.swingTick = t;
          p.swingReadyAt = t + cfg.swingCooldown;
          let caught = 0;
          state.flies = state.flies.filter((fly) => {
            if (Math.hypot(fly.x - p.x, fly.z - p.z) <= cfg.swingRadius) {
              const worth = fly.golden ? cfg.goldenWorth : 1;
              p.score += worth;
              p.catches += 1;
              if (fly.golden) p.goldenCatches += 1;
              caught += 1;
              return false;
            }
            return true;
          });
          if (caught > 0) {
            p.catchTick = t;
            // Keep the glade lively: replace caught normal fireflies.
            const flyCount = cfg.flyBase + state.order.length;
            while (state.flies.filter((f) => !f.golden).length < flyCount) {
              state.flies.push(spawnFly(false, t));
            }
          } else {
            p.whiffs += 1;
            p.slowUntil = t + cfg.whiffTicks;
          }
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
      scores[pid] = p.score * 1000 + p.goldenCatches * 10 - Math.min(9, p.whiffs);
    }
    const ranking = rankByScoreGrouped(scores);
    const coins = coinsForRanking(ranking, { chaos });
    const stats = {};
    for (const pid of state.order) {
      const p = state.players[pid];
      stats[pid] = {
        points: p.score, catches: p.catches, goldenCatches: p.goldenCatches, whiffs: p.whiffs,
      };
    }
    return { ranking, coins, stats };
  }

  return { init, step, getState, applyState, isFinished, getResults };
}

const CHASE_NOISE = { easy: 1.5, normal: 0.8, hard: 0.35, wild: 0.12 };
const SWING_TOL = { easy: 0.55, normal: 0.75, hard: 0.9, wild: 0.98 };
const HESITATE_PCT = { easy: 30, normal: 14, hard: 5, wild: 1 };

function ihash(a, b) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Wild bots are erratic, not superhuman: per ~1s window they swing between
 * peak reflexes (the old 'wild' row), solid play ('hard') and outright
 * blunders ('easy'), so the MEANS land near 'hard' while the variance is
 * loud. Seeded hash only, so replays stay deterministic.
 */
function wildRow(s, me) {
  const roll = ihash(Math.floor(s.tick / 30), me.slot * 29 + 11) % 100;
  if (roll < 30) return 'wild';
  return roll < 72 ? 'hard' : 'easy';
}

function bot(publicState, playerId, difficulty, rng) {
  const frame = emptyFrame();
  const s = publicState;
  const me = s?.players?.[playerId];
  if (!me || s.tick <= s.countdownTicks) return frame;

  const row = difficulty === 'wild' ? wildRow(s, me) : difficulty;

  // Momentary hesitation (worse monkeys daydream more).
  if (ihash(Math.floor(s.tick / 20), me.slot * 7 + 1) % 100
    < (HESITATE_PCT[row] ?? HESITATE_PCT.normal)) return frame;

  const noise = CHASE_NOISE[row] ?? CHASE_NOISE.normal;
  const tol = SWING_TOL[row] ?? SWING_TOL.normal;

  // Chase the juiciest firefly (goldens pull hard).
  let best = null;
  let bestCost = Infinity;
  for (const fly of s.flies ?? []) {
    const d = Math.hypot(fly.x - me.x, fly.z - me.z);
    const cost = fly.golden ? d * 0.4 : d;
    if (cost < bestCost) {
      bestCost = cost;
      best = fly;
    }
  }
  if (!best) return frame;

  // Lead the firefly a touch, with difficulty-scaled slop.
  const speed = best.golden ? 4.9 : 3.4;
  const lead = 6 * DT;
  const tx = best.x + Math.cos(best.a) * speed * lead * 4 + (rng.next() - 0.5) * noise;
  const tz = best.z + Math.sin(best.a) * speed * lead * 4 + (rng.next() - 0.5) * noise;
  const dx = tx - me.x;
  const dz = tz - me.z;
  const mag = Math.hypot(dx, dz);
  if (mag > 0.1) {
    frame.move.x = dx / mag;
    frame.move.y = -(dz / mag);
  }
  const trueDist = Math.hypot(best.x - me.x, best.z - me.z);
  if (s.tick >= me.swingReadyAt && trueDist <= (s.swingRadius ?? 1.6) * tol) frame.a = true;
  return frame;
}

export function register() {
  if (minigames.get(ID)) return minigames.get(ID);
  return defineMinigame({
    id: ID,
    name: { en: 'Firefly Catchers', de: 'Gluehwuermchen-Faenger' },
    description: {
      en: 'Swing your net through the night glade - the golden firefly is worth three.',
      de: 'Schwing dein Netz durch die naechtliche Lichtung - das goldene Gluehwuermchen zaehlt dreifach.',
    },
    howTo: {
      en: 'Chase the glowing fireflies and swing your net with A - they scatter when you get close! A missed swing slows you briefly. Most fireflies at the horn wins; the golden one counts triple.',
      de: 'Jage die leuchtenden Gluehwuermchen und schwinge dein Netz mit A - sie stieben auseinander, wenn du nah kommst! Ein Fehlschlag bremst dich kurz. Die meisten Faenge gewinnen; das goldene zaehlt dreifach.',
    },
    category: 'ffa',
    tags: ['skill', 'chase', 'night'],
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
