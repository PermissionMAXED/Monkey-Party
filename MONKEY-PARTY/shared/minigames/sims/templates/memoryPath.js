/**
 * memoryPath template - "repeat the shown tile path" (package P8).
 *
 * A path lights up across a tile grid, one step at a time, then everyone
 * repeats it from memory by flicking the stick step by step. Each round
 * the path grows by one tile; a wrong step (or running out of time)
 * eliminates you. The longest memory wins.
 *
 * makeMemoryPathVariant(variant) stamps out a themed MinigameDef; params
 * control grid size, pacing and the theme ({palette, propSet, skyColor})
 * read by the shared view.
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

/** Direction index -> grid delta (N, E, S, W), stick up = N. */
export const PATH_DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export const MEMORY_PATH_DEFAULTS = {
  gridW: 5,
  gridH: 5,
  startLen: 2,
  showTicksPerStep: 13,
  gapTicks: 6,
  inputTicksPerStep: 42,
  interRoundTicks: 24,
  durationSec: 60,
  theme: {
    palette: { primary: '#2e7d32', secondary: '#8d6e63', accent: '#ffe135' },
    propSet: 'jungle',
    skyColor: '#87ceeb',
  },
};

/** Stick vector -> direction index (0..3) or -1 when neutral. */
function dirOf(move) {
  const { x, y } = move;
  if (Math.hypot(x, y) < 0.5) return -1;
  if (Math.abs(y) >= Math.abs(x)) return y > 0 ? 0 : 2;
  return x > 0 ? 1 : 3;
}

function createTemplateSim({ id, seed, players, params = {}, rules = {} } = {}) {
  const cfg = { ...MEMORY_PATH_DEFAULTS, ...params };
  const rng = createRng(seed ?? 0);
  const pids = (players ?? []).slice();
  const durationTicks = Math.round(cfg.durationSec * MINIGAME_HZ);
  const chaos = Boolean(rules.chaosMode);
  const startCell = { x: Math.floor(cfg.gridW / 2), y: Math.floor(cfg.gridH / 2) };

  let state = null;

  function init() {
    rng.setState(Number(seed ?? 0) >>> 0);
    const ps = {};
    pids.forEach((pid, i) => {
      ps[pid] = {
        slot: i,
        alive: true,
        progress: 0,
        done: false,
        roundsCleared: 0,
        elimTick: -1,
        inputTicks: 0,
        lastDir: -1,
        lastInputTick: -1,
        lastInputOk: true,
        cx: startCell.x,
        cy: startCell.y,
      };
    });
    state = {
      id,
      tick: 0,
      durationTicks,
      countdownTicks: COUNTDOWN_TICKS,
      finished: false,
      theme: cfg.theme,
      gridW: cfg.gridW,
      gridH: cfg.gridH,
      start: { ...startCell },
      phase: 'show', // 'show' | 'input' | 'between'
      phaseTick: COUNTDOWN_TICKS,
      round: 1,
      path: [], // Direction indices.
      cells: [{ ...startCell }], // Path cells incl. the start tile.
      players: ps,
      order: pids.slice(),
      rngState: rng.state(),
    };
  }

  function growPath() {
    const target = cfg.startLen + (state.round - 1);
    while (state.path.length < target) {
      const last = state.cells[state.cells.length - 1];
      const prevDir = state.path.length > 0 ? state.path[state.path.length - 1] : -1;
      const options = [];
      for (let d = 0; d < 4; d += 1) {
        if (prevDir >= 0 && d === (prevDir + 2) % 4) continue; // No backtracking.
        const nx = last.x + PATH_DIRS[d][0];
        const ny = last.y + PATH_DIRS[d][1];
        if (nx >= 0 && nx < cfg.gridW && ny >= 0 && ny < cfg.gridH) options.push(d);
      }
      const d = options[rng.int(0, options.length - 1)];
      state.path.push(d);
      state.cells.push({
        x: last.x + PATH_DIRS[d][0],
        y: last.y + PATH_DIRS[d][1],
      });
    }
  }

  function showDuration() {
    return state.path.length * (cfg.showTicksPerStep + cfg.gapTicks) + cfg.gapTicks;
  }

  function beginInput(t) {
    state.phase = 'input';
    state.phaseTick = t;
    for (const pid of state.order) {
      const p = state.players[pid];
      p.progress = 0;
      p.done = !p.alive;
      p.lastDir = -1;
      p.cx = startCell.x;
      p.cy = startCell.y;
    }
  }

  function endRound(t) {
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
      growPath();
      state.phase = 'show';
      state.phaseTick = t;
    }

    if (t > state.countdownTicks) {
      const elapsed = t - state.phaseTick;
      if (state.phase === 'show' && elapsed >= showDuration()) {
        beginInput(t);
      } else if (state.phase === 'between' && elapsed >= cfg.interRoundTicks) {
        growPath();
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

          if (dir === state.path[p.progress]) {
            p.progress += 1;
            const cell = state.cells[p.progress];
            p.cx = cell.x;
            p.cy = cell.y;
            p.lastInputTick = t;
            p.lastInputOk = true;
            if (p.progress >= state.path.length) p.done = true;
          } else {
            p.alive = false;
            p.elimTick = t;
            p.lastInputTick = t;
            p.lastInputOk = false;
          }
        }
        const allDone = state.order.every(
          (pid) => state.players[pid].done || !state.players[pid].alive,
        );
        if (allDone || elapsed >= state.path.length * cfg.inputTicksPerStep) endRound(t);
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
      const aliveBonus = p.alive ? 500000 : 0;
      scores[pid] = aliveBonus + p.roundsCleared * 100000
        + Math.max(0, p.elimTick) - p.inputTicks * 0.001;
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

  // Pulse cadence: one step per window (hold, then release so the edge
  // detector re-arms). Reaction delay scales the window length.
  const elapsed = s.tick - s.phaseTick;
  const cadence = react * 2;
  const stepIdx = Math.floor(elapsed / cadence);
  const phase = elapsed % cadence;
  if (phase >= react) return frame;
  if (me.progress > stepIdx) return frame;
  const windowStart = s.phaseTick + stepIdx * cadence;
  if (me.lastInputTick >= windowStart) return frame;

  let dir = s.path[me.progress];
  const errChance = errBase * (1 + s.path.length * 0.1);
  if (rng.next() < errChance) {
    dir = (dir + rng.int(1, 3)) % 4; // Misremembered a step!
  }
  if (dir === 0) frame.move.y = 1;
  else if (dir === 1) frame.move.x = 1;
  else if (dir === 2) frame.move.y = -1;
  else frame.move.x = -1;
  return frame;
}

/**
 * Create + register one memoryPath variant.
 *
 * @param {Object} variant See reactionDuel.js for the accepted shape.
 * @returns {import('../../../types.js').MinigameDef}
 */
export function makeMemoryPathVariant(variant = {}) {
  const id = variant.id;
  const existing = minigames.get(id);
  if (existing) return existing;
  const params = { ...MEMORY_PATH_DEFAULTS, ...(variant.params ?? {}) };
  return defineMinigame({
    id,
    name: variant.name,
    description: variant.description ?? {
      en: 'Memorize the glowing tile path and walk it back flawlessly - it keeps growing.',
      de: 'Merke dir den leuchtenden Plattenpfad und laufe ihn fehlerfrei nach - er waechst jede Runde.',
    },
    howTo: variant.howTo ?? {
      en: 'Watch the tiles light up, then flick the stick step by step (up/right/down/left) to retrace the path. One wrong step and you are out!',
      de: 'Sieh zu, wie die Platten aufleuchten, und tippe den Weg Schritt fuer Schritt mit dem Stick nach (hoch/rechts/runter/links). Ein falscher Schritt und du bist raus!',
    },
    category: variant.category ?? 'ffa',
    tags: variant.tags ?? ['memory'],
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

export default makeMemoryPathVariant;
