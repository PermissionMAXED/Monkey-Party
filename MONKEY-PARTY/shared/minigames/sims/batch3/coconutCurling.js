/**
 * Coconut Curling - FFA precision sliding, 2-8 players, 60s.
 *
 * A polished ice sheet with a painted target house at the far end. In two
 * waves everyone charges up (hold A) and lets a coconut fly toward the
 * rings; stones collide fully elastically, so a well-placed shot can
 * bowl a rival's coconut clean out of the house. When the last wave
 * settles, every coconut in the rings scores its ring's points.
 *
 * Pure ESM sim. No DOM, no three.js, no Math.random, no Date.now.
 * Fixed 30Hz steps; no in-step randomness (pure physics + inputs).
 */

import { createRng } from '../../../rng.js';
import { clampFrame, emptyFrame } from '../../inputs.js';
import {
  defineMinigame, rankByScoreGrouped, coinsForRanking, MINIGAME_HZ, COUNTDOWN_TICKS,
} from '../../framework.js';
import { minigames } from '../../../registries.js';

const ID = 'coconut_curling';
const DT = 1 / MINIGAME_HZ;

const DEFAULTS = {
  houseZ: 20,
  rings: [1.3, 2.7, 4.2], // Ring radii; points 3 / 2 / 1.
  wavesPerGame: 2,
  aimTicks: 165, // 5.5s to aim + charge.
  slideTicks: 240, // Max 8s of sliding per wave.
  maxAngle: 0.55, // Radians either side of straight ahead.
  aimSpeed: 1.1, // Radians/sec of steering.
  chargeRate: 0.55, // Charge/sec while holding A.
  minSpeed: 6,
  chargeSpan: 9, // Launch speed = minSpeed + charge * chargeSpan.
  frictionDecel: 2.2, // Speed lost per second on the ice.
  stoneRadius: 0.55,
  restitution: 0.9,
  sheetHalfW: 8,
};

function createSim({ seed, players, params = {}, rules = {} } = {}) {
  const cfg = { ...DEFAULTS, ...params };
  const rng = createRng(seed ?? 0);
  const pids = (players ?? []).slice();
  const durationTicks = 60 * MINIGAME_HZ;
  const chaos = Boolean(rules.chaosMode);

  let state = null;

  function launchX(slot, n) {
    return n <= 1 ? 0 : -4 + (8 * slot) / (n - 1);
  }

  function init() {
    rng.setState(Number(seed ?? 0) >>> 0);
    const ps = {};
    pids.forEach((pid, i) => {
      ps[pid] = {
        slot: i,
        angle: 0,
        charge: 0,
        thrown: false,
        prevA: false,
        score: 0, // Live house points (HUD chip).
        knocks: 0,
        throwTick: -1,
        launchX: launchX(i, pids.length), // Rotated per wave (see beginAim).
      };
    });
    state = {
      id: ID,
      tick: 0,
      durationTicks,
      countdownTicks: COUNTDOWN_TICKS,
      finished: false,
      houseZ: cfg.houseZ,
      rings: cfg.rings.slice(),
      phase: 'aim', // 'aim' | 'slide'
      phaseTick: COUNTDOWN_TICKS,
      wave: 1,
      waves: cfg.wavesPerGame,
      stones: [], // { id, owner, x, z, vx, vz, moving, out }
      nextStoneId: 1,
      players: ps,
      order: pids.slice(),
      rngState: rng.state(),
    };
  }

  function launch(pid, t) {
    const p = state.players[pid];
    if (p.thrown) return;
    p.thrown = true;
    p.throwTick = t;
    const speed = cfg.minSpeed + Math.max(0, Math.min(1, p.charge)) * cfg.chargeSpan;
    state.stones.push({
      id: state.nextStoneId,
      owner: pid,
      x: p.launchX ?? launchX(p.slot, state.order.length),
      z: 0,
      vx: Math.sin(p.angle) * speed,
      vz: Math.cos(p.angle) * speed,
      moving: true,
      out: false,
    });
    state.nextStoneId += 1;
  }

  function ringPoints(stone) {
    if (stone.out) return 0;
    const d = Math.hypot(stone.x, stone.z - cfg.houseZ);
    for (let i = 0; i < cfg.rings.length; i += 1) {
      if (d <= cfg.rings[i]) return cfg.rings.length - i;
    }
    return 0;
  }

  function refreshScores() {
    for (const pid of state.order) state.players[pid].score = 0;
    for (const stone of state.stones) {
      state.players[stone.owner].score += ringPoints(stone);
    }
  }

  function beginAim(t) {
    state.phase = 'aim';
    state.phaseTick = t;
    const n = state.order.length;
    for (const pid of state.order) {
      const p = state.players[pid];
      p.angle = 0;
      p.charge = 0;
      p.thrown = false;
      // Fairness: rotate the launch slots one place per wave so nobody
      // keeps the easy straight-ahead center lane all game (deterministic).
      p.launchX = launchX((p.slot + state.wave - 1) % n, n);
    }
  }

  function step(inputsMap = {}) {
    if (state.finished) return;
    state.tick += 1;
    const t = state.tick;

    if (t === state.countdownTicks + 1) beginAim(t);

    if (t > state.countdownTicks) {
      const elapsed = t - state.phaseTick;

      if (state.phase === 'aim') {
        for (const pid of state.order) {
          const p = state.players[pid];
          const frame = clampFrame(inputsMap[pid] ?? emptyFrame());
          if (!p.thrown) {
            // The view camera sits behind the sheet at -z looking toward
            // +z (the house), so screen-right = world -x. move.x is
            // negated so pressing right steers the stone right ON SCREEN
            // (angle > 0 launches toward world +x = screen-left).
            p.angle = Math.max(-cfg.maxAngle,
              Math.min(cfg.maxAngle, p.angle + (-frame.move.x) * cfg.aimSpeed * DT));
            if (frame.a) p.charge = Math.min(1, p.charge + cfg.chargeRate * DT);
            const released = !frame.a && p.prevA && p.charge > 0;
            if (released) launch(pid, t);
          }
          p.prevA = frame.a;
        }
        if (elapsed >= cfg.aimTicks) {
          for (const pid of state.order) launch(pid, t); // Auto-throw stragglers.
          state.phase = 'slide';
          state.phaseTick = t;
        }
      } else if (state.phase === 'slide') {
        // Friction + integration.
        let anyMoving = false;
        for (const stone of state.stones) {
          if (!stone.moving || stone.out) continue;
          const sp = Math.hypot(stone.vx, stone.vz);
          const dec = cfg.frictionDecel * DT;
          if (sp <= dec) {
            stone.vx = 0;
            stone.vz = 0;
            stone.moving = false;
          } else {
            const k = (sp - dec) / sp;
            stone.vx *= k;
            stone.vz *= k;
            stone.x += stone.vx * DT;
            stone.z += stone.vz * DT;
            if (Math.abs(stone.x) > cfg.sheetHalfW || stone.z > cfg.houseZ + 6.5 || stone.z < -1.5) {
              stone.out = true;
              stone.moving = false;
              stone.vx = 0;
              stone.vz = 0;
            } else {
              anyMoving = true;
            }
          }
        }
        // Equal-mass elastic collisions (pairwise).
        const live = state.stones.filter((s) => !s.out);
        for (let i = 0; i < live.length; i += 1) {
          for (let j = i + 1; j < live.length; j += 1) {
            const a = live[i];
            const b = live[j];
            const dx = b.x - a.x;
            const dz = b.z - a.z;
            const d = Math.hypot(dx, dz);
            const minD = cfg.stoneRadius * 2;
            if (d <= 0.0001 || d >= minD) continue;
            const nx = dx / d;
            const nz = dz / d;
            const push = (minD - d) / 2;
            a.x -= nx * push;
            a.z -= nz * push;
            b.x += nx * push;
            b.z += nz * push;
            const va = a.vx * nx + a.vz * nz;
            const vb = b.vx * nx + b.vz * nz;
            const rel = va - vb;
            if (rel > 0) {
              // Knock credit goes to the STRIKER: the stone moving faster
              // along the collision normal (pre-fix the credit always went
              // to stone `a`, i.e. the earlier-thrown - usually stationary
              // - stone that got hit).
              const striker = va + vb >= 0 ? a : b;
              const imp = ((1 + cfg.restitution) / 2) * rel;
              a.vx -= imp * nx;
              a.vz -= imp * nz;
              b.vx += imp * nx;
              b.vz += imp * nz;
              a.moving = true;
              b.moving = true;
              if (a.owner !== b.owner) {
                state.players[striker.owner].knocks += 1;
              }
              anyMoving = true;
            }
          }
        }
        refreshScores();
        if (!anyMoving || elapsed >= cfg.slideTicks) {
          if (state.wave >= cfg.wavesPerGame) {
            state.finished = true;
          } else {
            state.wave += 1;
            beginAim(t);
          }
        }
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
    refreshScores();
    const scores = {};
    for (const pid of state.order) {
      const p = state.players[pid];
      scores[pid] = p.score * 1000 + p.knocks;
    }
    const ranking = rankByScoreGrouped(scores);
    const coins = coinsForRanking(ranking, { chaos });
    const stats = {};
    for (const pid of state.order) {
      const p = state.players[pid];
      stats[pid] = { points: p.score, knocks: p.knocks };
    }
    return { ranking, coins, stats };
  }

  return { init, step, getState, applyState, isFinished, getResults };
}

const ANGLE_ERR = { easy: 0.16, normal: 0.08, hard: 0.035, wild: 0.012 };
const CHARGE_ERR = { easy: 0.2, normal: 0.11, hard: 0.05, wild: 0.02 };
const THINK = { easy: 40, normal: 28, hard: 18, wild: 10 };

function ihash(a, b) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** Stable pseudo-random in [-1, 1] derived from (a, b). */
function snoise(a, b) {
  return (ihash(a, b) % 2001) / 1000 - 1;
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

function bot(publicState, playerId, difficulty, _rng) {
  const frame = emptyFrame();
  const s = publicState;
  const me = s?.players?.[playerId];
  if (!me || s.phase !== 'aim' || me.thrown || s.tick <= s.countdownTicks) return frame;

  const row = difficulty === 'wild' ? wildRow(s, me) : difficulty;
  const think = THINK[row] ?? THINK.normal;
  if (s.tick - s.phaseTick < think + me.slot * 3) return frame; // Line up in your own time.

  const aErr = ANGLE_ERR[row] ?? ANGLE_ERR.normal;
  const cErr = CHARGE_ERR[row] ?? CHARGE_ERR.normal;
  const n = s.order.length;
  const x0 = me.launchX ?? (n <= 1 ? 0 : -4 + (8 * me.slot) / (n - 1));

  // Aim at the button with a per-wave stable error. The desired angle is a
  // world-space plan; the sim maps stick right (+x) to -angle, so the
  // emitted x is negated to keep the bot functionally identical.
  const houseZ = s.houseZ ?? 20;
  const desired = Math.atan2(0 - x0, houseZ) + snoise(s.wave * 31 + 5, me.slot) * aErr;
  const da = desired - me.angle;
  if (Math.abs(da) > 0.01) frame.move.x = -Math.max(-1, Math.min(1, da * 8));

  // Charge to the speed that dies right on the button (v^2 = 2*a*d).
  const dist = Math.hypot(x0, houseZ);
  const wantSpeed = Math.sqrt(2 * 2.2 * dist * 0.98);
  const targetCharge = Math.max(0.08, Math.min(1, (wantSpeed - 6) / 9
    + snoise(s.wave * 17 + 3, me.slot) * cErr));
  if (me.charge < targetCharge) frame.a = true; // Release edge fires the throw.
  return frame;
}

export function register() {
  if (minigames.get(ID)) return minigames.get(ID);
  return defineMinigame({
    id: ID,
    name: { en: 'Coconut Curling', de: 'Kokosnuss-Curling' },
    description: {
      en: 'Slide coconuts into the target rings - and bowl your rivals\' stones out of the house.',
      de: 'Lass Kokosnuesse in die Zielringe gleiten - und kegel die Steine deiner Rivalen aus dem Haus.',
    },
    howTo: {
      en: 'Steer your aim left/right, hold A to charge and release to slide. Inner ring scores 3, middle 2, outer 1 - after two waves the house is counted. Knocking rivals out is fair game!',
      de: 'Ziele mit links/rechts, halte A zum Aufladen und lass los zum Gleiten. Innerer Ring zaehlt 3, mittlerer 2, aeusserer 1 - nach zwei Wellen wird das Haus gezaehlt. Rivalen rauszukegeln ist erlaubt!',
    },
    category: 'ffa',
    tags: ['skill', 'aim', 'physics'],
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
