/**
 * Jungle Painters - team territory painting, 4-8 players, 45s.
 *
 * Two teams of monkeys with dripping paint buckets sprint across a tiled
 * jungle clearing. Every tile you cross is painted in your team color -
 * including tiles the other team already claimed. The team covering the
 * most tiles when the horn blows wins.
 *
 * Team convention: team A = first half of the player order, team B = the
 * rest (see makeTeams('team')).
 *
 * Pure ESM sim. No DOM, no three.js, no Math.random, no Date.now.
 * Fixed 30Hz steps; all randomness through shared/rng.js.
 */

import { clampFrame, emptyFrame } from '../../inputs.js';
import {
  defineMinigame, rankByScore, coinsForRanking, MINIGAME_HZ, COUNTDOWN_TICKS,
} from '../../framework.js';
import { minigames } from '../../../registries.js';

const ID = 'jungle_painters';
const DT = 1 / MINIGAME_HZ;

const DEFAULTS = {
  gridSize: 12,
  tileSize: 1.5,
  playerSpeed: 6,
  bumpRadius: 0.95,
};

function createSim({ players, params = {}, rules = {} } = {}) {
  // No RNG needed: the paint grid is fully input-driven and deterministic.
  const cfg = { ...DEFAULTS, ...params };
  const pids = (players ?? []).slice();
  const durationTicks = 45 * MINIGAME_HZ;
  const chaos = Boolean(rules.chaosMode);
  const half = cfg.gridSize * cfg.tileSize * 0.5;
  const teamAOf = Math.ceil(pids.length / 2);

  let state = null;

  function tileIndex(x, z) {
    const ix = Math.max(0, Math.min(cfg.gridSize - 1, Math.floor((x + half) / cfg.tileSize)));
    const iz = Math.max(0, Math.min(cfg.gridSize - 1, Math.floor((z + half) / cfg.tileSize)));
    return iz * cfg.gridSize + ix;
  }

  function init() {
    const ps = {};
    pids.forEach((pid, i) => {
      const team = i < teamAOf ? 0 : 1;
      const within = team === 0 ? i : i - teamAOf;
      ps[pid] = {
        slot: i,
        team,
        x: (team === 0 ? -1 : 1) * (half - 1.2),
        z: ((within + 0.5) / Math.max(1, team === 0 ? teamAOf : pids.length - teamAOf) - 0.5)
          * (half * 1.4),
        vx: 0,
        vz: 0,
        painted: 0,
        lastPaintTick: -1,
        bumpedTick: -1,
      };
    });
    state = {
      id: ID,
      tick: 0,
      durationTicks,
      countdownTicks: COUNTDOWN_TICKS,
      finished: false,
      gridSize: cfg.gridSize,
      tileSize: cfg.tileSize,
      tiles: new Array(cfg.gridSize * cfg.gridSize).fill(-1),
      teams: [{ score: 0 }, { score: 0 }],
      players: ps,
      order: pids.slice(),
    };
  }

  function step(inputsMap = {}) {
    if (state.finished) return;
    state.tick += 1;
    const t = state.tick;
    const playing = t > state.countdownTicks;

    if (playing) {
      for (const pid of state.order) {
        const p = state.players[pid];
        const frame = clampFrame(inputsMap[pid] ?? emptyFrame());
        p.vx = p.vx * 0.78 + frame.move.x * cfg.playerSpeed * 0.22;
        p.vz = p.vz * 0.78 + (-frame.move.y) * cfg.playerSpeed * 0.22;
        p.x += p.vx * DT;
        p.z += p.vz * DT;
        const lim = half - 0.4;
        p.x = Math.max(-lim, Math.min(lim, p.x));
        p.z = Math.max(-lim, Math.min(lim, p.z));

        // Paint the tile under my feet.
        const idx = tileIndex(p.x, p.z);
        const owner = state.tiles[idx];
        if (owner !== p.team) {
          if (owner >= 0) state.teams[owner].score -= 1;
          state.tiles[idx] = p.team;
          state.teams[p.team].score += 1;
          p.painted += 1;
          p.lastPaintTick = t;
        }
      }

      // Player-player bumps: push apart symmetrically.
      for (let i = 0; i < state.order.length; i += 1) {
        for (let j = i + 1; j < state.order.length; j += 1) {
          const a = state.players[state.order[i]];
          const b = state.players[state.order[j]];
          const dx = b.x - a.x;
          const dz = b.z - a.z;
          const d = Math.hypot(dx, dz);
          if (d > 0.0001 && d < cfg.bumpRadius) {
            const push = (cfg.bumpRadius - d) * 0.5 + 0.02;
            const nx = dx / d;
            const nz = dz / d;
            a.x -= nx * push;
            a.z -= nz * push;
            b.x += nx * push;
            b.z += nz * push;
            a.vx -= nx * 2;
            a.vz -= nz * 2;
            b.vx += nx * 2;
            b.vz += nz * 2;
            a.bumpedTick = t;
            b.bumpedTick = t;
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
    const scores = {};
    for (const pid of state.order) {
      const p = state.players[pid];
      scores[pid] = state.teams[p.team].score * 10000 + p.painted;
    }
    const ranking = rankByScore(scores);
    const coins = coinsForRanking(ranking, { chaos });
    const stats = {};
    for (const pid of state.order) {
      const p = state.players[pid];
      stats[pid] = { team: p.team, teamTiles: state.teams[p.team].score, tilesPainted: p.painted };
    }
    return { ranking, coins, stats };
  }

  return { init, step, getState, applyState, isFinished, getResults };
}

const REACT = { easy: 16, normal: 10, hard: 6, wild: 4 };
const NOISE = { easy: 1.6, normal: 0.9, hard: 0.4, wild: 0.12 };

function bot(publicState, playerId, difficulty, rng) {
  const frame = emptyFrame();
  const s = publicState;
  const me = s?.players?.[playerId];
  if (!me || s.tick <= s.countdownTicks) return frame;

  const react = REACT[difficulty] ?? REACT.normal;
  const noise = NOISE[difficulty] ?? NOISE.normal;
  const grid = s.gridSize;
  const tile = s.tileSize;
  const half = grid * tile * 0.5;

  // Head for the closest tile that is not ours yet; re-aim only every
  // `react` ticks so slower bots wobble on stale targets.
  const bucket = Math.floor(s.tick / react);
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < s.tiles.length; i += 1) {
    if (s.tiles[i] === me.team) continue;
    const tx = -half + ((i % grid) + 0.5) * tile;
    const tz = -half + (Math.floor(i / grid) + 0.5) * tile;
    const d = Math.hypot(tx - me.x, tz - me.z) + (s.tiles[i] === -1 ? 0 : 0.4);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  if (best < 0) return frame;

  const tx = -half + ((best % grid) + 0.5) * tile + (rng.next() - 0.5) * noise;
  const tz = -half + (Math.floor(best / grid) + 0.5) * tile + (rng.next() - 0.5) * noise;
  const wob = Math.sin(bucket * 1.7 + me.slot) * noise * 0.3;
  const dx = tx - me.x + wob;
  const dz = tz - me.z;
  const mag = Math.hypot(dx, dz) || 1;
  frame.move.x = dx / mag;
  frame.move.y = -(dz / mag);
  return frame;
}

export function register() {
  if (minigames.get(ID)) return minigames.get(ID);
  return defineMinigame({
    id: ID,
    name: { en: 'Jungle Painters', de: 'Dschungel-Maler' },
    description: {
      en: 'Two teams race to paint the most jungle tiles in their color.',
      de: 'Zwei Teams wetteifern, die meisten Dschungel-Felder in ihrer Farbe zu bemalen.',
    },
    howTo: {
      en: 'Run around - every tile you cross turns your team color. Repaint enemy tiles and cover the most ground before time runs out!',
      de: 'Lauf herum - jedes Feld unter dir nimmt deine Teamfarbe an. Uebermale gegnerische Felder und sichere die groesste Flaeche!',
    },
    category: 'team',
    tags: ['chaos', 'team'],
    players: { min: 4, max: 8 },
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
