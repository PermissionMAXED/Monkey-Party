/**
 * Memory Totem - FFA memory, 2-8 players, 60s.
 *
 * The totem flashes a growing sequence of 4 colors. Repeat it by flicking
 * the stick in the matching direction (up/right/down/left). One wrong
 * input (or running out of time) eliminates you; the longest memory wins.
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

const ID = 'memory_totem';

/** Direction index -> color name (0 up, 1 right, 2 down, 3 left). */
export const TOTEM_COLORS = ['green', 'yellow', 'red', 'blue'];

const DEFAULTS = {
  startLength: 2,
  showTicksPerItem: 14,
  gapTicks: 7,
  inputTicksPerItem: 45, // Generous per-item budget for the input phase.
  interRoundTicks: 24,
};

/** Stick vector -> direction index (0..3) or -1 when neutral/ambiguous. */
function dirOf(move) {
  const { x, y } = move;
  if (Math.hypot(x, y) < 0.5) return -1;
  if (Math.abs(y) >= Math.abs(x)) return y > 0 ? 0 : 2;
  return x > 0 ? 1 : 3;
}

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
      ps[pid] = {
        slot: i,
        alive: true,
        progress: 0, // Items entered this round.
        done: false, // Completed the current round's input.
        roundsCleared: 0,
        elimTick: -1,
        inputTicks: 0, // Total ticks spent inputting (speed tie-break).
        lastDir: -1,
        lastInputTick: -1,
        lastInputOk: true,
      };
    });
    state = {
      id: ID,
      tick: 0,
      durationTicks,
      countdownTicks: COUNTDOWN_TICKS,
      finished: false,
      phase: 'show', // 'show' | 'input' | 'between'
      phaseTick: COUNTDOWN_TICKS,
      round: 1,
      sequence: [],
      players: ps,
      order: pids.slice(),
      rngState: rng.state(),
    };
  }

  function growSequence() {
    const target = cfg.startLength + (state.round - 1);
    while (state.sequence.length < target) {
      state.sequence.push(rng.int(0, TOTEM_COLORS.length - 1));
    }
  }

  function showDuration() {
    return state.sequence.length * (cfg.showTicksPerItem + cfg.gapTicks) + cfg.gapTicks;
  }

  function inputDuration() {
    return state.sequence.length * cfg.inputTicksPerItem;
  }

  function beginInput(t) {
    state.phase = 'input';
    state.phaseTick = t;
    for (const pid of state.order) {
      const p = state.players[pid];
      p.progress = 0;
      p.done = !p.alive; // Dead players never block the round.
      p.lastDir = -1;
    }
  }

  function endRound(t) {
    // Anyone alive who didn't finish the sequence in time is eliminated.
    for (const pid of state.order) {
      const p = state.players[pid];
      if (p.alive && !p.done) {
        p.alive = false;
        p.elimTick = t;
      } else if (p.alive) {
        p.roundsCleared = state.round;
      }
    }
    const alive = state.order.filter((pid) => state.players[pid].alive);
    if (alive.length <= 1) {
      state.finished = true;
      return;
    }
    state.round += 1;
    state.phase = 'between';
    state.phaseTick = t;
  }

  function step(inputsMap = {}) {
    if (state.finished) return;
    rng.setState(state.rngState);
    state.tick += 1;
    const t = state.tick;

    if (t === state.countdownTicks + 1) {
      growSequence();
      state.phase = 'show';
      state.phaseTick = t;
    }

    if (t > state.countdownTicks) {
      const elapsed = t - state.phaseTick;

      if (state.phase === 'show' && elapsed >= showDuration()) {
        beginInput(t);
      } else if (state.phase === 'between' && elapsed >= cfg.interRoundTicks) {
        growSequence();
        state.phase = 'show';
        state.phaseTick = t;
      } else if (state.phase === 'input') {
        for (const pid of state.order) {
          const p = state.players[pid];
          if (!p.alive || p.done) continue;
          p.inputTicks += 1;
          const frame = clampFrame(inputsMap[pid] ?? emptyFrame());
          const dir = dirOf(frame.move);
          const edge = dir !== -1 && dir !== p.lastDir;
          p.lastDir = dir;
          if (!edge) continue;

          if (dir === state.sequence[p.progress]) {
            p.progress += 1;
            p.lastInputTick = t;
            p.lastInputOk = true;
            if (p.progress >= state.sequence.length) p.done = true;
          } else {
            p.alive = false;
            p.elimTick = t;
            p.lastInputTick = t;
            p.lastInputOk = false;
          }
        }
        const allDone = state.order.every((pid) => state.players[pid].done || !state.players[pid].alive);
        if (allDone || elapsed >= inputDuration()) endRound(t);
      }
    }

    if (t >= state.durationTicks) {
      // Time cap: everyone alive banks the rounds they have fully cleared.
      state.finished = true;
    }
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
      const aliveBonus = p.alive ? 500000 : 0;
      // Longest sequence first; among equals, later elimination and faster
      // inputs rank higher.
      scores[pid] = aliveBonus + p.roundsCleared * 100000 + Math.max(0, p.elimTick) - p.inputTicks * 0.001;
    }
    const ranking = rankByScore(scores);
    const coins = coinsForRanking(ranking, { chaos });
    const stats = {};
    for (const pid of state.order) {
      const p = state.players[pid];
      stats[pid] = { roundsCleared: p.roundsCleared, survived: p.alive };
    }
    return { ranking, coins, stats };
  }

  return { init, step, getState, applyState, isFinished, getResults };
}

const REACT = { easy: 16, normal: 10, hard: 7, wild: 4 };
const ERR = { easy: 0.05, normal: 0.02, hard: 0.006, wild: 0.001 };

function bot(publicState, playerId, difficulty, rng) {
  const frame = emptyFrame();
  const s = publicState;
  const me = s?.players?.[playerId];
  if (!me || !me.alive || me.done || s.phase !== 'input') return frame;

  const react = REACT[difficulty] ?? REACT.normal;
  const errBase = ERR[difficulty] ?? ERR.normal;

  // Pulse cadence: one item per window (hold direction, then release so the
  // edge detector re-arms). Reaction delay scales the window length.
  const elapsed = s.tick - s.phaseTick;
  const cadence = react * 2;
  const step = Math.floor(elapsed / cadence);
  const phase = elapsed % cadence;
  if (phase >= react) return frame; // Neutral half of the pulse.
  if (me.progress > step) return frame; // Ahead of schedule - wait.
  const windowStart = s.phaseTick + step * cadence;
  if (me.lastInputTick >= windowStart) return frame; // Already answered.

  let dir = s.sequence[me.progress];
  const errChance = errBase * (1 + s.sequence.length * 0.12);
  if (rng.next() < errChance) {
    dir = (dir + rng.int(1, 3)) % 4; // Misremembered!
  }
  if (dir === 0) frame.move.y = 1;
  else if (dir === 1) frame.move.x = 1;
  else if (dir === 2) frame.move.y = -1;
  else frame.move.x = -1;
  return frame;
}

export function register() {
  if (minigames.get(ID)) return minigames.get(ID);
  return defineMinigame({
    id: ID,
    name: { en: 'Memory Totem', de: 'Gedaechtnis-Totem' },
    description: {
      en: 'Repeat the totem\'s growing color sequence - one slip and you are out.',
      de: 'Wiederhole die wachsende Farbfolge des Totems - ein Fehler und du bist raus.',
    },
    howTo: {
      en: 'Watch the colors flash, then flick the stick: up=green, right=yellow, down=red, left=blue. Wrong input eliminates you!',
      de: 'Merke dir die Farben, dann Stick antippen: hoch=gruen, rechts=gelb, runter=rot, links=blau. Falsche Eingabe scheidet aus!',
    },
    category: 'ffa',
    tags: ['memory'],
    players: { min: 2, max: 8 },
    durationSec: 60,
    competitiveSafe: true,
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
