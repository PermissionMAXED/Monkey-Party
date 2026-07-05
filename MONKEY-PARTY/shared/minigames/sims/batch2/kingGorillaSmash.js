/**
 * King Gorilla Smash - boss co-op, 2-8 players, 60s.
 *
 * King Gorilla pounds the arena, sending expanding shockwave rings that
 * knock down anyone who does not jump in time. Grab coconuts from the
 * jungle floor and hurl them (B) at the boss - throws during the glowing
 * weak-point window deal double damage. Bring him down together, but the
 * podium ranks whoever dealt the most damage while staying on their feet.
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

const ID = 'king_gorilla_smash';
const DT = 1 / MINIGAME_HZ;

const DEFAULTS = {
  arenaRadius: 9,
  moveSpeed: 6,
  bossRadius: 2.2,
  hpBase: 10,
  hpPerPlayer: 12,
  coconutMax: 4,
  coconutRespawnTicks: 70,
  throwRange: 7,
  jumpTicks: 12,
  jumpCooldownTicks: 8,
  stunTicks: 36,
  ringSpeed: 7.5,
  ringMaxRadius: 10.5,
  ringThickness: 0.55,
  slamEveryStart: 160,
  slamEveryEnd: 85,
  weakEvery: 170,
  weakTicks: 55,
};

function createSim({ seed, players, params = {}, rules = {} } = {}) {
  const cfg = { ...DEFAULTS, ...params };
  const rng = createRng(seed ?? 0);
  const pids = (players ?? []).slice();
  const durationTicks = 60 * MINIGAME_HZ;
  const chaos = Boolean(rules.chaosMode);

  let state = null;

  function spawnCoconut(t) {
    const a = rng.next() * Math.PI * 2;
    const r = cfg.bossRadius + 2 + rng.next() * (cfg.arenaRadius - cfg.bossRadius - 3);
    return {
      id: state.nextCoconutId,
      x: Math.cos(a) * r,
      z: Math.sin(a) * r,
      activeFrom: t,
    };
  }

  function init() {
    rng.setState(Number(seed ?? 0) >>> 0);
    const ps = {};
    pids.forEach((pid, i) => {
      const a = (i / pids.length) * Math.PI * 2;
      ps[pid] = {
        slot: i,
        x: Math.cos(a) * (cfg.arenaRadius - 2),
        z: Math.sin(a) * (cfg.arenaRadius - 2),
        vx: 0,
        vz: 0,
        carrying: false,
        airUntil: -1,
        jumpReadyAt: 0,
        stunUntil: -1,
        damage: 0,
        throws: 0,
        hitsTaken: 0,
        prevA: false,
        prevB: false,
        lastThrowTick: -1,
        lastThrowDmg: 0,
        lastHitTick: -1,
        lastPickTick: -1,
      };
    });
    state = {
      id: ID,
      tick: 0,
      durationTicks,
      countdownTicks: COUNTDOWN_TICKS,
      finished: false,
      arenaRadius: cfg.arenaRadius,
      // Public sim constants: bots read these instead of hardcoding, so
      // param overrides (variant tuning) do not break bot dodging/aiming.
      bossRadius: cfg.bossRadius,
      ringSpeed: cfg.ringSpeed,
      throwRange: cfg.throwRange,
      boss: {
        maxHp: cfg.hpBase + cfg.hpPerPlayer * pids.length,
        hp: cfg.hpBase + cfg.hpPerPlayer * pids.length,
        defeated: false,
        defeatTick: -1,
        slamTick: -1,
        hitTick: -1,
        nextSlamTick: COUNTDOWN_TICKS + cfg.slamEveryStart,
        weakUntil: -1,
        nextWeakTick: COUNTDOWN_TICKS + 60,
      },
      rings: [], // { id, r }
      nextRingId: 1,
      coconuts: [],
      nextCoconutId: 1,
      players: ps,
      order: pids.slice(),
      rngState: rng.state(),
    };
    for (let i = 0; i < cfg.coconutMax; i += 1) {
      state.coconuts.push(spawnCoconut(0));
      state.nextCoconutId += 1;
    }
    state.rngState = rng.state();
  }

  function step(inputsMap = {}) {
    if (state.finished) return;
    rng.setState(state.rngState);
    state.tick += 1;
    const t = state.tick;
    const playing = t > state.countdownTicks;
    const boss = state.boss;

    if (playing && !boss.defeated) {
      const progress = Math.min(1, t / state.durationTicks);

      // Boss slams on a ramping schedule -> expanding shockwave rings.
      if (t >= boss.nextSlamTick) {
        state.rings.push({ id: state.nextRingId, r: cfg.bossRadius });
        state.nextRingId += 1;
        boss.slamTick = t;
        boss.nextSlamTick = t + Math.round(cfg.slamEveryStart
          + (cfg.slamEveryEnd - cfg.slamEveryStart) * progress);
      }
      // Weak-point window schedule.
      if (t >= boss.nextWeakTick) {
        boss.weakUntil = t + cfg.weakTicks;
        boss.nextWeakTick = t + cfg.weakEvery + rng.int(-20, 20);
      }

      // Rings expand and fade at the arena edge.
      state.rings = state.rings.filter((ring) => {
        ring.r += cfg.ringSpeed * DT;
        return ring.r <= cfg.ringMaxRadius;
      });

      for (const pid of state.order) {
        const p = state.players[pid];
        const stunned = t < p.stunUntil;
        const frame = stunned
          ? emptyFrame()
          : clampFrame(inputsMap[pid] ?? emptyFrame());

        // Move.
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
        // Keep out of the boss body.
        const bd = Math.hypot(p.x, p.z);
        if (bd < cfg.bossRadius + 0.4 && bd > 0.0001) {
          p.x = (p.x / bd) * (cfg.bossRadius + 0.4);
          p.z = (p.z / bd) * (cfg.bossRadius + 0.4);
        }

        // Jump (A).
        const edgeA = frame.a && !p.prevA;
        p.prevA = frame.a;
        if (edgeA && t > p.airUntil && t >= p.jumpReadyAt && !stunned) {
          p.airUntil = t + cfg.jumpTicks;
          p.jumpReadyAt = t + cfg.jumpTicks + cfg.jumpCooldownTicks;
        }

        // Shockwave hits grounded, unstunned players.
        if (!stunned && t > p.airUntil) {
          const pd = Math.hypot(p.x, p.z);
          for (const ring of state.rings) {
            if (Math.abs(pd - ring.r) < cfg.ringThickness) {
              p.stunUntil = t + cfg.stunTicks;
              p.hitsTaken += 1;
              p.carrying = false;
              p.lastHitTick = t;
              break;
            }
          }
        }

        // Pick up coconuts.
        if (!p.carrying && t >= p.stunUntil) {
          for (const nut of state.coconuts) {
            if (t < nut.activeFrom) continue;
            if (Math.hypot(p.x - nut.x, p.z - nut.z) <= 0.9) {
              p.carrying = true;
              p.lastPickTick = t;
              const fresh = spawnCoconut(t + cfg.coconutRespawnTicks);
              fresh.activeFrom = t + cfg.coconutRespawnTicks;
              nut.id = fresh.id;
              nut.x = fresh.x;
              nut.z = fresh.z;
              nut.activeFrom = fresh.activeFrom;
              state.nextCoconutId += 1;
              break;
            }
          }
        }

        // Throw (B) at the boss.
        const edgeB = frame.b && !p.prevB;
        p.prevB = frame.b;
        if (edgeB && p.carrying && t >= p.stunUntil
          && Math.hypot(p.x, p.z) <= cfg.throwRange) {
          p.carrying = false;
          const dmg = t < boss.weakUntil ? 2 : 1;
          boss.hp -= dmg;
          boss.hitTick = t;
          p.damage += dmg;
          p.throws += 1;
          p.lastThrowTick = t;
          p.lastThrowDmg = dmg;
          if (boss.hp <= 0) {
            boss.hp = 0;
            boss.defeated = true;
            boss.defeatTick = t;
          }
        }
      }
    }

    if (boss.defeated || t >= state.durationTicks) state.finished = true;
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
      scores[pid] = p.damage * 1000 - p.hitsTaken * 150;
    }
    const ranking = rankByScoreGrouped(scores);
    // Co-op stakes: actually toppling the boss doubles every payout
    // (chaos-style), so winning the fight matters beyond the podium order.
    const coins = coinsForRanking(ranking, { chaos });
    if (state.boss.defeated) {
      for (const pid of Object.keys(coins)) coins[pid] *= 2;
    }
    const stats = {};
    for (const pid of state.order) {
      const p = state.players[pid];
      stats[pid] = {
        damage: p.damage,
        hitsTaken: p.hitsTaken,
        bossDefeated: state.boss.defeated,
      };
    }
    return { ranking, coins, stats };
  }

  return { init, step, getState, applyState, isFinished, getResults };
}

const REACT = { easy: 15, normal: 9, hard: 5, wild: 3 };
const NOISE = { easy: 0.5, normal: 0.25, hard: 0.1, wild: 0.03 };
const IMPATIENCE_PCT = { easy: 70, normal: 38, hard: 14, wild: 6 };

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

  const react = REACT[difficulty] ?? REACT.normal;
  const noise = NOISE[difficulty] ?? NOISE.normal;
  const bossRadius = s.bossRadius ?? 2.2;
  const ringSpeed = s.ringSpeed ?? 7.5;
  const throwRange = s.throwRange ?? 7;

  // Jump over incoming shockwaves (noticing them takes `react` ticks).
  const myDist = Math.hypot(me.x, me.z);
  for (const ring of s.rings ?? []) {
    const ringAge = Math.round((ring.r - bossRadius) / (ringSpeed / MINIGAME_HZ));
    if (ringAge < react) continue;
    const ticksToHit = ((myDist - ring.r) / ringSpeed) * MINIGAME_HZ;
    if (ticksToHit >= 0 && ticksToHit <= 7 + (ihash(ring.id, me.slot) % 3)) {
      frame.a = true;
      break;
    }
  }

  let tx;
  let tz;
  if (me.carrying) {
    // Close to throwing range, then let fly (patience depends on skill).
    if (myDist <= throwRange - 0.8) {
      const weakOpen = s.tick < (s.boss?.weakUntil ?? -1);
      const impatient = ihash(Math.floor(s.tick / 30), me.slot * 17 + 3) % 100
        < (IMPATIENCE_PCT[difficulty] ?? IMPATIENCE_PCT.normal);
      if (weakOpen || impatient) frame.b = true;
      tx = me.x;
      tz = me.z;
    } else {
      tx = me.x * 0.4;
      tz = me.z * 0.4;
    }
  } else {
    // Fetch the nearest active coconut.
    let best = null;
    let bestD = Infinity;
    for (const nut of s.coconuts ?? []) {
      if (s.tick < nut.activeFrom) continue;
      const dd = Math.hypot(nut.x - me.x, nut.z - me.z);
      if (dd < bestD) {
        bestD = dd;
        best = nut;
      }
    }
    if (!best) return frame;
    tx = best.x;
    tz = best.z;
  }

  const dx = tx - me.x + (rng.next() - 0.5) * noise;
  const dz = tz - me.z + (rng.next() - 0.5) * noise;
  const mag = Math.hypot(dx, dz);
  if (mag > 0.1) {
    frame.move.x = dx / mag;
    frame.move.y = -(dz / mag);
  }
  return frame;
}

export function register() {
  if (minigames.get(ID)) return minigames.get(ID);
  return defineMinigame({
    id: ID,
    name: { en: 'King Gorilla Smash', de: 'King-Gorilla-Klopper' },
    description: {
      en: 'Dodge the boss\'s shockwaves and pelt him with coconuts - together.',
      de: 'Weicht den Schockwellen des Bosses aus und bewerft ihn gemeinsam mit Kokosnuessen.',
    },
    howTo: {
      en: 'Jump (A) over the expanding shockwaves, grab coconuts and throw them (B) at King Gorilla. Throws during his glowing weak-point window count double. Most damage tops the podium!',
      de: 'Springe (A) ueber die Schockwellen, sammle Kokosnuesse und wirf sie (B) auf King Gorilla. Wuerfe waehrend des leuchtenden Schwachpunkt-Fensters zaehlen doppelt. Der meiste Schaden gewinnt!',
    },
    category: 'boss',
    tags: ['boss', 'coop', 'dodge'],
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
