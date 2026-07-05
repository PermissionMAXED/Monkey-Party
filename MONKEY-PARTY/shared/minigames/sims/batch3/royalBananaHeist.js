/**
 * Royal Banana Heist - boss push-your-luck, 2-8 players, 60s.
 *
 * The Gorilla King snoozes on his golden banana hoard. Creep to the pile
 * and hold A to pry bananas loose, then sprint them back to your own den
 * to bank them. When the King stirs (he snorts first as a warning),
 * FREEZE: anyone still moving or grabbing gets caught, drops everything
 * they carry and nudges the royal wake-o-meter. If the meter fills, the
 * King wakes for good and every unbanked banana is lost. Greed pays -
 * until it doesn't.
 *
 * Seeded sleep/stir timing = push-your-luck, so competitiveSafe is false.
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

const ID = 'royal_banana_heist';
const DT = 1 / MINIGAME_HZ;

const DEFAULTS = {
  arenaRadius: 9.5,
  kingRadius: 2.1,
  grabMin: 2.5, // Grab ring around the hoard.
  grabMax: 3.9,
  moveSpeed: 5.8,
  grabTicks: 26, // Held-A ticks to pry one banana loose.
  carryMax: 3,
  hoardPerPlayer: 10,
  denRadius: 1.5,
  sleepMinTicks: 105,
  sleepSpanTicks: 80,
  warnTicks: 20, // The King snorts before he stirs.
  stirMinTicks: 50,
  stirSpanTicks: 30,
  wakeMax: 100,
  wakePerGrab: 0.8, // Greed slowly fills the meter...
  wakePerOffense: 0.15, // ...moving/grabbing during a stir fills it fast...
  wakePerCatch: 4, // ...and getting caught really rattles him.
  caughtStunTicks: 35,
  moveEps: 0.6, // Residual drift below this speed still counts as frozen.
};

function createSim({ seed, players, params = {}, rules = {} } = {}) {
  const cfg = { ...DEFAULTS, ...params };
  const rng = createRng(seed ?? 0);
  const pids = (players ?? []).slice();
  const durationTicks = 60 * MINIGAME_HZ;
  const chaos = Boolean(rules.chaosMode);

  let state = null;

  function init() {
    rng.setState(Number(seed ?? 0) >>> 0);
    const ps = {};
    pids.forEach((pid, i) => {
      const a = (i / pids.length) * Math.PI * 2;
      const dx = Math.cos(a) * (cfg.arenaRadius - 1);
      const dz = Math.sin(a) * (cfg.arenaRadius - 1);
      ps[pid] = {
        slot: i,
        x: dx,
        z: dz,
        vx: 0,
        vz: 0,
        denX: dx,
        denZ: dz,
        carried: 0,
        score: 0, // Banked bananas (HUD chip).
        stolen: 0,
        caughtCount: 0,
        lostToKing: 0,
        grabProgress: 0,
        stunUntil: -1,
        caughtThisStir: false,
        grabTick: -1,
        bankTick: -1,
        caughtTick: -1,
      };
    });
    state = {
      id: ID,
      tick: 0,
      durationTicks,
      countdownTicks: COUNTDOWN_TICKS,
      finished: false,
      arenaRadius: cfg.arenaRadius,
      grabMin: cfg.grabMin,
      grabMax: cfg.grabMax,
      grabTicks: cfg.grabTicks,
      warnTicks: cfg.warnTicks,
      carryMax: cfg.carryMax,
      hoard: cfg.hoardPerPlayer * pids.length,
      wake: 0,
      wakeMax: cfg.wakeMax,
      kingWoke: false,
      wokeTick: -1,
      king: {
        phase: 'sleep', // 'sleep' | 'warn' | 'stir'
        phaseTick: 0,
        nextChangeTick: COUNTDOWN_TICKS + cfg.sleepMinTicks,
      },
      players: ps,
      order: pids.slice(),
      rngState: rng.state(),
    };
    state.king.nextChangeTick = COUNTDOWN_TICKS + cfg.sleepMinTicks
      + rng.int(0, cfg.sleepSpanTicks);
    state.rngState = rng.state();
  }

  function advanceKing(t) {
    const king = state.king;
    if (t < king.nextChangeTick) return;
    if (king.phase === 'sleep') {
      king.phase = 'warn';
      king.phaseTick = t;
      king.nextChangeTick = t + cfg.warnTicks;
    } else if (king.phase === 'warn') {
      king.phase = 'stir';
      king.phaseTick = t;
      king.nextChangeTick = t + cfg.stirMinTicks + rng.int(0, cfg.stirSpanTicks);
      for (const pid of state.order) state.players[pid].caughtThisStir = false;
    } else {
      king.phase = 'sleep';
      king.phaseTick = t;
      king.nextChangeTick = t + cfg.sleepMinTicks + rng.int(0, cfg.sleepSpanTicks);
    }
  }

  function step(inputsMap = {}) {
    if (state.finished) return;
    rng.setState(state.rngState);
    state.tick += 1;
    const t = state.tick;
    const playing = t > state.countdownTicks;

    if (playing) {
      advanceKing(t);
      const stirring = state.king.phase === 'stir';
      let allBanked = true;

      for (const pid of state.order) {
        const p = state.players[pid];
        const stunned = t < p.stunUntil;
        const frame = stunned ? emptyFrame() : clampFrame(inputsMap[pid] ?? emptyFrame());

        // Move (up = away from the camera side; standard arena mapping).
        p.vx = p.vx * 0.76 + frame.move.x * cfg.moveSpeed * 0.24;
        p.vz = p.vz * 0.76 + (-frame.move.y) * cfg.moveSpeed * 0.24;
        p.x += p.vx * DT;
        p.z += p.vz * DT;
        const rd = Math.hypot(p.x, p.z);
        if (rd > cfg.arenaRadius) {
          p.x = (p.x / rd) * cfg.arenaRadius;
          p.z = (p.z / rd) * cfg.arenaRadius;
        }
        const kd = Math.hypot(p.x, p.z);
        if (kd < cfg.kingRadius + 0.35 && kd > 0.0001) {
          p.x = (p.x / kd) * (cfg.kingRadius + 0.35);
          p.z = (p.z / kd) * (cfg.kingRadius + 0.35);
        }

        // Grab bananas from the hoard (hold A inside the grab ring).
        const dist = Math.hypot(p.x, p.z);
        const inRing = dist >= cfg.grabMin && dist <= cfg.grabMax;
        const grabbing = frame.a && inRing && !stunned
          && p.carried < cfg.carryMax && state.hoard > 0;
        if (grabbing) {
          p.grabProgress += 1;
          if (p.grabProgress >= cfg.grabTicks) {
            p.grabProgress = 0;
            p.carried += 1;
            p.stolen += 1;
            p.grabTick = t;
            state.hoard -= 1;
            state.wake = Math.min(cfg.wakeMax, state.wake + cfg.wakePerGrab);
          }
        } else if (!frame.a) {
          p.grabProgress = 0;
        }

        // Stir check: freeze or get caught.
        if (stirring && !stunned) {
          const speed = Math.hypot(p.vx, p.vz);
          const offending = grabbing || speed > cfg.moveEps
            || Math.hypot(frame.move.x, frame.move.y) > 0.25;
          if (offending) {
            state.wake = Math.min(cfg.wakeMax, state.wake + cfg.wakePerOffense);
            if (!p.caughtThisStir) {
              p.caughtThisStir = true;
              p.caughtCount += 1;
              p.lostToKing += p.carried;
              state.hoard += p.carried; // Dropped loot rolls back onto the pile.
              p.carried = 0;
              p.grabProgress = 0;
              p.stunUntil = t + cfg.caughtStunTicks;
              p.caughtTick = t;
              state.wake = Math.min(cfg.wakeMax, state.wake + cfg.wakePerCatch);
            }
          }
        }

        // Bank carried bananas at your own den.
        if (p.carried > 0
          && Math.hypot(p.x - p.denX, p.z - p.denZ) <= cfg.denRadius) {
          p.score += p.carried;
          p.carried = 0;
          p.grabProgress = 0;
          p.bankTick = t;
        }

        if (p.carried > 0) allBanked = false;
      }

      // The King wakes for good: unbanked loot is lost.
      if (state.wake >= cfg.wakeMax && !state.kingWoke) {
        state.kingWoke = true;
        state.wokeTick = t;
        for (const pid of state.order) {
          const p = state.players[pid];
          p.lostToKing += p.carried;
          p.carried = 0;
          p.grabProgress = 0;
        }
        state.finished = true;
      }

      // Hoard emptied and every banana banked: nothing left to steal.
      if (!state.finished && state.hoard <= 0 && allBanked) state.finished = true;
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
      // The horn without a full wake-up: whatever you carry still counts.
      const loot = p.score + (state.kingWoke ? 0 : p.carried);
      scores[pid] = loot * 1000 - p.caughtCount;
    }
    const ranking = rankByScoreGrouped(scores);
    const coins = coinsForRanking(ranking, { chaos });
    const stats = {};
    for (const pid of state.order) {
      const p = state.players[pid];
      stats[pid] = {
        banked: p.score,
        stolen: p.stolen,
        lostToKing: p.lostToKing,
        timesCaught: p.caughtCount,
        kingWoke: state.kingWoke,
      };
    }
    return { ranking, coins, stats };
  }

  return { init, step, getState, applyState, isFinished, getResults };
}

const REACT = { easy: 22, normal: 8, hard: 5, wild: 2 };
const RESUME = { easy: 22, normal: 13, hard: 7, wild: 2 }; // Dawdle after the all-clear.

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

  // The snort is the cue: freeze once it registers (skill = reacting fast).
  const king = s.king ?? {};
  if (king.phase === 'warn' || king.phase === 'stir') {
    const warned = king.phase === 'warn'
      ? s.tick - king.phaseTick
      : (s.tick - king.phaseTick) + (s.warnTicks ?? 20);
    const myReact = react + (ihash(king.phaseTick, me.slot * 7 + 1) % 5);
    if (warned >= myReact) return frame; // Statue mode.
  } else if (s.tick - king.phaseTick < (RESUME[difficulty] ?? RESUME.normal)) {
    return frame; // Make sure he is really asleep again before moving.
  }

  const carryTarget = s.carryMax ?? 3;
  let tx;
  let tz;
  let wantGrab = false;
  if (me.carried >= carryTarget || ((s.hoard ?? 0) <= 0 && me.carried > 0)) {
    tx = me.denX;
    tz = me.denZ;
  } else if ((s.hoard ?? 0) > 0) {
    // Nearest point of the grab ring along my den's direction.
    const a = Math.atan2(me.denZ, me.denX);
    const ringR = ((s.grabMin ?? 2.5) + (s.grabMax ?? 3.9)) / 2;
    tx = Math.cos(a) * ringR;
    tz = Math.sin(a) * ringR;
    wantGrab = true;
  } else {
    tx = me.denX;
    tz = me.denZ;
  }

  const dx = tx - me.x + (rng.next() - 0.5) * 0.3;
  const dz = tz - me.z + (rng.next() - 0.5) * 0.3;
  const mag = Math.hypot(dx, dz);
  if (mag > 0.45) {
    frame.move.x = dx / mag;
    frame.move.y = -(dz / mag);
  } else if (wantGrab) {
    frame.a = true; // Park and pry.
  }
  return frame;
}

export function register() {
  if (minigames.get(ID)) return minigames.get(ID);
  return defineMinigame({
    id: ID,
    name: { en: 'Royal Banana Heist', de: 'Koeniglicher Bananenraub' },
    description: {
      en: 'Steal the Gorilla King\'s bananas while he sleeps - and freeze when he stirs.',
      de: 'Stehlt die Bananen des Gorillakoenigs, waehrend er schlaeft - und erstarrt, wenn er sich regt.',
    },
    howTo: {
      en: 'Hold A at the hoard to pry bananas loose, carry up to three and bank them in your den. When the King snorts, FREEZE - anyone caught moving drops their loot and riles him. If the wake-o-meter fills he wakes up and all unbanked bananas are gone. Most bananas wins!',
      de: 'Halte A am Bananenberg, um Bananen zu loesen, trage bis zu drei und bring sie in deine Hoehle. Wenn der Koenig schnaubt: ERSTARREN - wer sich bewegt, verliert seine Beute und reizt ihn. Ist das Aufwach-O-Meter voll, wacht er auf und alle ungesicherten Bananen sind weg. Die meisten Bananen gewinnen!',
    },
    category: 'boss',
    tags: ['boss', 'luck', 'nerves', 'push-your-luck'],
    players: { min: 2, max: 8 },
    durationSec: 60,
    competitiveSafe: false,
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
