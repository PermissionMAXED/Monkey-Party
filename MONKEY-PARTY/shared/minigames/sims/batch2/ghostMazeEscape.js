/**
 * Ghost Maze Escape - 1v3 chase, exactly 4 players, 60s.
 *
 * One spooky ghost monkey haunts a procedurally carved hedge maze while
 * three escapees scramble for the glowing exit. The ghost is a little
 * faster and catches anyone it touches; escapees win by reaching the
 * exit before the clock (or the ghost) gets them.
 *
 * Team convention: players[0] is the ghost, players[1..3] the escapees
 * (see makeTeams('1v3')).
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

const ID = 'ghost_maze_escape';
const DT = 1 / MINIGAME_HZ;

/** Direction index -> cell delta (N, E, S, W). Wall bit = 1 << dir. */
export const MAZE_DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

const DEFAULTS = {
  mazeW: 9,
  mazeH: 9,
  escapeeSpeed: 3.3, // Cells per second.
  ghostSpeed: 3.9,
  catchRadius: 0.55, // In cell units.
};

/** Carve a perfect maze with an iterative backtracker. */
function carveMaze(w, h, rng) {
  const walls = new Array(w * h).fill(15);
  const visited = new Array(w * h).fill(false);
  const stack = [0];
  visited[0] = true;
  while (stack.length > 0) {
    const cur = stack[stack.length - 1];
    const cx = cur % w;
    const cy = Math.floor(cur / w);
    const options = [];
    for (let d = 0; d < 4; d += 1) {
      const nx = cx + MAZE_DIRS[d][0];
      const ny = cy + MAZE_DIRS[d][1];
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && !visited[ny * w + nx]) options.push(d);
    }
    if (options.length === 0) {
      stack.pop();
      continue;
    }
    const d = options[rng.int(0, options.length - 1)];
    const nx = cx + MAZE_DIRS[d][0];
    const ny = cy + MAZE_DIRS[d][1];
    const next = ny * w + nx;
    walls[cur] &= ~(1 << d);
    walls[next] &= ~(1 << ((d + 2) % 4));
    visited[next] = true;
    stack.push(next);
  }
  // Punch a few extra openings so the ghost cannot fully corner anyone.
  const extra = Math.floor((w * h) / 12);
  for (let i = 0; i < extra; i += 1) {
    const cx = rng.int(1, w - 2);
    const cy = rng.int(1, h - 2);
    const d = rng.int(0, 3);
    const nx = cx + MAZE_DIRS[d][0];
    const ny = cy + MAZE_DIRS[d][1];
    if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
    walls[cy * w + cx] &= ~(1 << d);
    walls[ny * w + nx] &= ~(1 << ((d + 2) % 4));
  }
  return walls;
}

/** BFS distance map from (sx, sy) over the wall grid. */
function bfsDist(walls, w, h, sx, sy) {
  const dist = new Array(w * h).fill(-1);
  const queue = [sy * w + sx];
  dist[sy * w + sx] = 0;
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head];
    head += 1;
    const cx = cur % w;
    const cy = Math.floor(cur / w);
    for (let d = 0; d < 4; d += 1) {
      if ((walls[cur] & (1 << d)) !== 0) continue;
      const next = (cy + MAZE_DIRS[d][1]) * w + (cx + MAZE_DIRS[d][0]);
      if (dist[next] === -1) {
        dist[next] = dist[cur] + 1;
        queue.push(next);
      }
    }
  }
  return dist;
}

/** Continuous cell-space position of a maze walker. */
function posOf(p) {
  return {
    x: p.cx + (p.tx - p.cx) * p.prog,
    y: p.cy + (p.ty - p.cy) * p.prog,
  };
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
    const w = cfg.mazeW;
    const h = cfg.mazeH;
    const walls = carveMaze(w, h, rng);
    const starts = [
      [Math.floor(w / 2), Math.floor(h / 2)], // Ghost in the middle.
      [0, 0],
      [w - 1, 0],
      [0, h - 1],
    ];
    const ps = {};
    pids.forEach((pid, i) => {
      const [cx, cy] = starts[Math.min(i, starts.length - 1)];
      ps[pid] = {
        slot: i,
        role: i === 0 ? 'ghost' : 'escapee',
        cx,
        cy,
        tx: cx,
        ty: cy,
        prog: 0,
        moving: false,
        caught: false,
        catchTick: -1,
        escaped: false,
        escapeTick: -1,
        catches: 0,
      };
    });
    state = {
      id: ID,
      tick: 0,
      durationTicks,
      countdownTicks: COUNTDOWN_TICKS,
      finished: false,
      mazeW: w,
      mazeH: h,
      walls,
      exit: { x: w - 1, y: h - 1 },
      players: ps,
      order: pids.slice(),
      rngState: rng.state(),
    };
  }

  function dirFromMove(move) {
    const { x, y } = move;
    if (Math.hypot(x, y) < 0.45) return -1;
    if (Math.abs(y) >= Math.abs(x)) return y > 0 ? 0 : 2;
    return x > 0 ? 1 : 3;
  }

  function step(inputsMap = {}) {
    if (state.finished) return;
    rng.setState(state.rngState);
    state.tick += 1;
    const t = state.tick;
    const playing = t > state.countdownTicks;

    if (playing) {
      const w = state.mazeW;
      for (const pid of state.order) {
        const p = state.players[pid];
        if (p.caught || p.escaped) continue;
        const speed = p.role === 'ghost' ? cfg.ghostSpeed : cfg.escapeeSpeed;
        if (p.moving) {
          p.prog += speed * DT;
          if (p.prog >= 1) {
            p.cx = p.tx;
            p.cy = p.ty;
            p.prog = 0;
            p.moving = false;
          }
        }
        if (!p.moving) {
          const frame = clampFrame(inputsMap[pid] ?? emptyFrame());
          const dir = dirFromMove(frame.move);
          if (dir !== -1 && (state.walls[p.cy * w + p.cx] & (1 << dir)) === 0) {
            p.tx = p.cx + MAZE_DIRS[dir][0];
            p.ty = p.cy + MAZE_DIRS[dir][1];
            p.moving = true;
            p.prog = 0;
          }
          if (p.role === 'escapee' && p.cx === state.exit.x && p.cy === state.exit.y) {
            p.escaped = true;
            p.escapeTick = t;
          }
        }
      }

      // Ghost catches escapees on touch.
      const ghost = state.players[state.order[0]];
      const gp = posOf(ghost);
      for (const pid of state.order.slice(1)) {
        const p = state.players[pid];
        if (p.caught || p.escaped) continue;
        const ep = posOf(p);
        if (Math.hypot(gp.x - ep.x, gp.y - ep.y) <= cfg.catchRadius) {
          p.caught = true;
          p.catchTick = t;
          ghost.catches += 1;
        }
      }

      const unresolved = state.order.slice(1)
        .filter((pid) => !state.players[pid].caught && !state.players[pid].escaped);
      if (unresolved.length === 0) state.finished = true;
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
    const numEscapees = state.order.length - 1;
    const exitDist = bfsDist(state.walls, state.mazeW, state.mazeH, state.exit.x, state.exit.y);
    const scores = {};
    for (const pid of state.order) {
      const p = state.players[pid];
      if (p.role === 'ghost') {
        scores[pid] = p.catches >= numEscapees ? 3000000 : p.catches * 400000;
      } else if (p.escaped) {
        scores[pid] = 2000000 - p.escapeTick;
      } else if (p.caught) {
        scores[pid] = p.catchTick;
      } else {
        const d = exitDist[p.cy * state.mazeW + p.cx];
        scores[pid] = 1000000 - (d < 0 ? 999 : d) * 100;
      }
    }
    const ranking = rankByScore(scores);
    const coins = coinsForRanking(ranking, { chaos });
    const stats = {};
    for (const pid of state.order) {
      const p = state.players[pid];
      stats[pid] = p.role === 'ghost'
        ? { role: 'ghost', catches: p.catches }
        : { role: 'escapee', escaped: p.escaped, caught: p.caught };
    }
    return { ranking, coins, stats };
  }

  return { init, step, getState, applyState, isFinished, getResults };
}

const NOISE_PCT = { easy: 24, normal: 12, hard: 5, wild: 1 };
const FLEE_RADIUS = { easy: 1.6, normal: 2.4, hard: 3.2, wild: 4 };

function ihash(a, b) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

function pushDir(frame, dir) {
  if (dir === 0) frame.move.y = 1;
  else if (dir === 1) frame.move.x = 1;
  else if (dir === 2) frame.move.y = -1;
  else if (dir === 3) frame.move.x = -1;
}

function bot(publicState, playerId, difficulty, rng) {
  const frame = emptyFrame();
  const s = publicState;
  const me = s?.players?.[playerId];
  if (!me || me.caught || me.escaped || s.tick <= s.countdownTicks) return frame;

  const w = s.mazeW;
  const h = s.mazeH;
  const noisePct = NOISE_PCT[difficulty] ?? NOISE_PCT.normal;
  const openDirs = [];
  for (let d = 0; d < 4; d += 1) {
    if ((s.walls[me.cy * w + me.cx] & (1 << d)) === 0) openDirs.push(d);
  }
  if (openDirs.length === 0) return frame;

  // Decision noise: occasionally wander through a random open corridor.
  const bucket = Math.floor(s.tick / 10);
  if (ihash(bucket, me.slot * 13 + 1) % 100 < noisePct) {
    pushDir(frame, openDirs[ihash(bucket, me.slot * 7 + 3) % openDirs.length]);
    if (rng.next() < 0.001) frame.b = true; // Keep rng signature warm.
    return frame;
  }

  const ghost = s.players[s.order[0]];
  if (me.role === 'ghost') {
    // Hunt the nearest free escapee by maze distance.
    const myDist = bfsDist(s.walls, w, h, me.cx, me.cy);
    let target = null;
    let bestD = Infinity;
    for (const pid of s.order.slice(1)) {
      const p = s.players[pid];
      if (p.caught || p.escaped) continue;
      const d = myDist[p.cy * w + p.cx];
      if (d >= 0 && d < bestD) {
        bestD = d;
        target = p;
      }
    }
    if (!target) return frame;
    const toTarget = bfsDist(s.walls, w, h, target.cx, target.cy);
    let bestDir = -1;
    let best = Infinity;
    for (const d of openDirs) {
      const v = toTarget[(me.cy + MAZE_DIRS[d][1]) * w + (me.cx + MAZE_DIRS[d][0])];
      if (v >= 0 && v < best) {
        best = v;
        bestDir = d;
      }
    }
    if (bestDir !== -1) pushDir(frame, bestDir);
    return frame;
  }

  // Escapee: flee if the ghost is close, otherwise run the exit path.
  const gPos = posOf(ghost);
  const ghostNear = Math.hypot(gPos.x - me.cx, gPos.y - me.cy)
    <= (FLEE_RADIUS[difficulty] ?? FLEE_RADIUS.normal);
  if (ghostNear) {
    let bestDir = -1;
    let best = -Infinity;
    for (const d of openDirs) {
      const nx = me.cx + MAZE_DIRS[d][0];
      const ny = me.cy + MAZE_DIRS[d][1];
      const v = Math.hypot(gPos.x - nx, gPos.y - ny);
      if (v > best) {
        best = v;
        bestDir = d;
      }
    }
    if (bestDir !== -1) pushDir(frame, bestDir);
    return frame;
  }
  const exitDist = bfsDist(s.walls, w, h, s.exit.x, s.exit.y);
  let bestDir = -1;
  let best = Infinity;
  for (const d of openDirs) {
    const v = exitDist[(me.cy + MAZE_DIRS[d][1]) * w + (me.cx + MAZE_DIRS[d][0])];
    if (v >= 0 && v < best) {
      best = v;
      bestDir = d;
    }
  }
  if (bestDir !== -1) pushDir(frame, bestDir);
  return frame;
}

/** Continuous cell-space position helper shared with the view. */
export { posOf as mazePosOf };

export function register() {
  if (minigames.get(ID)) return minigames.get(ID);
  return defineMinigame({
    id: ID,
    name: { en: 'Ghost Maze Escape', de: 'Geister-Labyrinth-Flucht' },
    description: {
      en: 'One ghost hunts three escapees through a haunted hedge maze.',
      de: 'Ein Geist jagt drei Fluechtende durch ein Spuk-Labyrinth.',
    },
    howTo: {
      en: 'Escapees: reach the glowing exit before the ghost touches you. Ghost: you are faster - catch all three before they slip away!',
      de: 'Fluechtende: erreicht den leuchtenden Ausgang, bevor der Geist euch beruehrt. Geist: du bist schneller - schnapp dir alle drei!',
    },
    category: '1v3',
    tags: ['chase', 'maze'],
    players: { min: 4, max: 4 },
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
