/**
 * Bomb Banana - hot-potato luck/bluff, 2-8 players, 30s.
 *
 * A fizzing banana-bomb gets passed around the circle with A. Its fuse is
 * hidden (seeded 8-20s). Whoever holds it at the boom is out, a fresh bomb
 * appears, and the chaos repeats until one monkey remains (or time's up).
 *
 * Not competitiveSafe: pure luck-and-bluff coin swings.
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

const ID = 'bomb_banana';

const DEFAULTS = {
  fuseMinSec: 8,
  fuseMaxSec: 20,
  passCooldownTicks: 15, // Must hold at least 0.5s before passing on.
  boomPauseTicks: 45, // Dramatic pause before the next bomb spawns.
};

function createSim({ seed, players, params = {}, rules = {} } = {}) {
  const cfg = { ...DEFAULTS, ...params };
  const rng = createRng(seed ?? 0);
  const pids = (players ?? []).slice();
  const durationTicks = 30 * MINIGAME_HZ;
  const chaos = Boolean(rules.chaosMode);

  let state = null;

  function aliveIds() {
    return state.order.filter((pid) => state.players[pid].alive);
  }

  function armBomb(t) {
    const alive = aliveIds();
    if (alive.length <= 1) return;
    const holder = alive[rng.int(0, alive.length - 1)];
    const remaining = state.durationTicks - t;
    let fuse = rng.int(cfg.fuseMinSec * MINIGAME_HZ, cfg.fuseMaxSec * MINIGAME_HZ);
    // Keep the last boom inside the match; tiny remainders skip the bomb.
    if (fuse > remaining - 30) fuse = Math.max(45, remaining - 45);
    if (remaining < 90) {
      state.bomb = null;
      return;
    }
    state.bomb = { holder, fuseLeft: fuse, receivedTick: t, passes: 0 };
    state.players[holder].receivedTick = t;
  }

  function nextAliveFrom(pid, dir) {
    const alive = aliveIds();
    const i = alive.indexOf(pid);
    if (i === -1 || alive.length < 2) return pid;
    return alive[(i + (dir < 0 ? alive.length - 1 : 1)) % alive.length];
  }

  function init() {
    rng.setState(Number(seed ?? 0) >>> 0);
    const ps = {};
    pids.forEach((pid, i) => {
      ps[pid] = {
        seat: i,
        alive: true,
        elimTick: -1,
        holdTicks: 0,
        passes: 0,
        receivedTick: -1,
        prevA: false,
      };
    });
    state = {
      id: ID,
      tick: 0,
      durationTicks,
      countdownTicks: COUNTDOWN_TICKS,
      finished: false,
      bomb: null,
      boomAt: -1, // Tick of the last boom (view feedback).
      boomHolder: null,
      nextBombTick: -1,
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

    if (t === state.countdownTicks + 1) armBomb(t);

    if (t > state.countdownTicks) {
      if (!state.bomb && state.nextBombTick > 0 && t >= state.nextBombTick) {
        state.nextBombTick = -1;
        armBomb(t);
      }

      if (state.bomb) {
        const bomb = state.bomb;
        const holder = state.players[bomb.holder];
        holder.holdTicks += 1;
        bomb.fuseLeft -= 1;

        // Update prevA for everyone; only the holder's press matters.
        for (const pid of state.order) {
          const p = state.players[pid];
          if (!p.alive) continue;
          const frame = clampFrame(inputsMap[pid] ?? emptyFrame());
          const pressed = frame.a && !p.prevA;
          p.prevA = frame.a;
          if (pid !== bomb.holder || !pressed) continue;
          if (t - bomb.receivedTick < cfg.passCooldownTicks) continue;
          // Pass! move.x < -0.3 flips the direction (a little bluffing room).
          const dir = frame.move.x < -0.3 ? -1 : 1;
          const to = nextAliveFrom(pid, dir);
          if (to !== pid) {
            bomb.holder = to;
            bomb.receivedTick = t;
            bomb.passes += 1;
            p.passes += 1;
            state.players[to].receivedTick = t;
          }
        }

        if (bomb.fuseLeft <= 0) {
          // BOOM: the holder is out.
          const out = state.players[bomb.holder];
          out.alive = false;
          out.elimTick = t;
          state.boomAt = t;
          state.boomHolder = bomb.holder;
          state.bomb = null;
          state.nextBombTick = t + cfg.boomPauseTicks;
        }
      }
    }

    if (aliveIds().length <= 1 || t >= state.durationTicks) state.finished = true;
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
      // Survivors first (shorter total holding = braver bluffing), then the
      // later you blew up, the better.
      scores[pid] = p.alive ? 1000000 - p.holdTicks : p.elimTick;
    }
    const ranking = rankByScore(scores);
    const coins = coinsForRanking(ranking, { chaos });
    const stats = {};
    for (const pid of state.order) {
      const p = state.players[pid];
      stats[pid] = { survived: p.alive, passes: p.passes, holdTicks: p.holdTicks };
    }
    return { ranking, coins, stats };
  }

  return { init, step, getState, applyState, isFinished, getResults };
}

const REACT = { easy: 15, normal: 9, hard: 6, wild: 4 };
/** Per-tick pass probability once ready (higher = hotter hands). */
const PASS_P = { easy: 0.05, normal: 0.12, hard: 0.2, wild: 0.3 };

function bot(publicState, playerId, difficulty, rng) {
  const frame = emptyFrame();
  const s = publicState;
  const me = s?.players?.[playerId];
  if (!me || !me.alive || s.tick <= s.countdownTicks) return frame;
  if (!s.bomb || s.bomb.holder !== playerId) return frame;

  const react = REACT[difficulty] ?? REACT.normal;
  const held = s.tick - s.bomb.receivedTick;
  if (held < react) return frame; // Haven't registered the catch yet.

  // Geometric hold: each tick, chance to flick it on; sometimes reversed
  // for the bluff.
  if (rng.next() < (PASS_P[difficulty] ?? 0.12)) {
    frame.a = true;
    if (rng.next() < 0.25) frame.move.x = -1;
  }
  return frame;
}

export function register() {
  if (minigames.get(ID)) return minigames.get(ID);
  return defineMinigame({
    id: ID,
    name: { en: 'Bomb Banana', de: 'Bomben-Banane' },
    description: {
      en: 'Hot-potato with a fizzing banana-bomb on a hidden fuse.',
      de: 'Heisse Kartoffel mit einer zischenden Bombenbanane an verdeckter Zuendschnur.',
    },
    howTo: {
      en: 'Press A to pass the bomb on (hold left to reverse direction). Whoever holds it at the boom is out!',
      de: 'A druecken, um die Bombe weiterzugeben (Stick links = Richtungswechsel). Wer sie beim Knall haelt, fliegt raus!',
    },
    // Plays as a duel with 2 players and as a full-circle ffa otherwise.
    category: 'ffa',
    tags: ['luck', 'bluff', 'chaos', 'duel'],
    players: { min: 2, max: 8 },
    durationSec: 30,
    competitiveSafe: false,
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
