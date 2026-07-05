/**
 * Bluff Banana - FFA memory/bluff, 2-8 players, 3 rounds (~30s).
 *
 * Five crates, one hides the golden banana - and it never hides in the
 * same crate twice in a row (remember!). Everyone secretly slides their
 * marker to a crate; at the reveal, the golden pot is split between all
 * players on the right crate, while anyone on the rotten crate loses
 * points. Read the room: a crate everyone wants pays almost nothing.
 *
 * Luck and mind games galore, so competitiveSafe is false.
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

const ID = 'bluff_banana';
const DT = 1 / MINIGAME_HZ;

const DEFAULTS = {
  crates: 5,
  rounds: 3,
  pickTicks: 150, // 5s to slide your marker.
  revealTicks: 75,
  interTicks: 30,
  cursorSpeed: 4,
  goldenPot: 6,
  rottenPenalty: 2,
};

function createSim({ seed, players, params = {}, rules = {} } = {}) {
  const cfg = { ...DEFAULTS, ...params };
  const rng = createRng(seed ?? 0);
  const pids = (players ?? []).slice();
  const durationTicks = 30 * MINIGAME_HZ;
  const chaos = Boolean(rules.chaosMode);

  let state = null;

  function init() {
    rng.setState(Number(seed ?? 0) >>> 0);
    const ps = {};
    pids.forEach((pid, i) => {
      ps[pid] = {
        slot: i,
        cur: (cfg.crates - 1) / 2,
        sel: Math.round((cfg.crates - 1) / 2),
        locked: -1, // Locked crate for the current reveal.
        score: 0,
        goldenHits: 0,
        rottenHits: 0,
        lastDelta: 0,
        lastDeltaTick: -1,
      };
    });
    state = {
      id: ID,
      tick: 0,
      durationTicks,
      countdownTicks: COUNTDOWN_TICKS,
      finished: false,
      crates: cfg.crates,
      phase: 'pick', // 'pick' | 'reveal' | 'inter'
      phaseTick: COUNTDOWN_TICKS,
      round: 1,
      golden: -1, // Assigned when the round's pick phase starts.
      rotten: -1,
      prevGolden: -1,
      roundSalt: 0, // Public per-round salt bots hash their choices from.
      players: ps,
      order: pids.slice(),
      rngState: rng.state(),
    };
  }

  function rollCrates() {
    let g = rng.int(0, cfg.crates - 1);
    while (g === state.prevGolden) g = rng.int(0, cfg.crates - 1);
    let r = rng.int(0, cfg.crates - 1);
    while (r === g) r = rng.int(0, cfg.crates - 1);
    state.golden = g;
    state.rotten = r;
    state.roundSalt = rng.int(0, 2 ** 30);
  }

  function beginPick(t) {
    state.phase = 'pick';
    state.phaseTick = t;
    rollCrates();
    for (const pid of state.order) {
      const p = state.players[pid];
      p.cur = (cfg.crates - 1) / 2;
      p.sel = Math.round(p.cur);
      p.locked = -1;
    }
  }

  function reveal(t) {
    state.phase = 'reveal';
    state.phaseTick = t;
    const winners = [];
    for (const pid of state.order) {
      const p = state.players[pid];
      p.locked = p.sel;
      if (p.locked === state.golden) winners.push(pid);
    }
    const share = winners.length > 0 ? Math.floor(cfg.goldenPot / winners.length) : 0;
    for (const pid of state.order) {
      const p = state.players[pid];
      let delta = 0;
      if (p.locked === state.golden) {
        delta = Math.max(1, share);
        p.goldenHits += 1;
      } else if (p.locked === state.rotten) {
        delta = -cfg.rottenPenalty;
        p.rottenHits += 1;
      }
      p.score += delta;
      p.lastDelta = delta;
      p.lastDeltaTick = t;
    }
  }

  function step(inputsMap = {}) {
    if (state.finished) return;
    rng.setState(state.rngState);
    state.tick += 1;
    const t = state.tick;

    if (t === state.countdownTicks + 1) beginPick(t);

    if (t > state.countdownTicks) {
      const elapsed = t - state.phaseTick;
      if (state.phase === 'pick') {
        for (const pid of state.order) {
          const p = state.players[pid];
          const frame = clampFrame(inputsMap[pid] ?? emptyFrame());
          p.cur = Math.max(0, Math.min(cfg.crates - 1, p.cur + frame.move.x * cfg.cursorSpeed * DT));
          p.sel = Math.round(p.cur);
        }
        if (elapsed >= cfg.pickTicks) reveal(t);
      } else if (state.phase === 'reveal' && elapsed >= cfg.revealTicks) {
        if (state.round >= cfg.rounds) {
          state.finished = true;
        } else {
          state.phase = 'inter';
          state.phaseTick = t;
          state.prevGolden = state.golden;
        }
      } else if (state.phase === 'inter' && elapsed >= cfg.interTicks) {
        state.round += 1;
        beginPick(t);
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
      scores[pid] = p.score * 100 + p.goldenHits;
    }
    const ranking = rankByScoreGrouped(scores);
    const coins = coinsForRanking(ranking, { chaos });
    const stats = {};
    for (const pid of state.order) {
      const p = state.players[pid];
      stats[pid] = { points: p.score, goldenHits: p.goldenHits, rottenHits: p.rottenHits };
    }
    return { ranking, coins, stats };
  }

  return { init, step, getState, applyState, isFinished, getResults };
}

const REACT = { easy: 20, normal: 12, hard: 7, wild: 4 };
const REMEMBER_PCT = { easy: 45, normal: 72, hard: 90, wild: 98 };

function ihash(a, b) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

function bot(publicState, playerId, difficulty, _rng) {
  const frame = emptyFrame();
  const s = publicState;
  const me = s?.players?.[playerId];
  if (!me || s.phase !== 'pick' || s.tick <= s.countdownTicks) return frame;

  const react = REACT[difficulty] ?? REACT.normal;
  if (s.tick - s.phaseTick < react * 2) return frame; // Think first.

  // Stable per-round pick derived from the public salt; good bots remember
  // that the golden banana never repeats last round's crate.
  const salt = s.roundSalt >>> 0;
  let choice = ihash(salt, me.slot * 13 + 1) % s.crates;
  const remembers = ihash(salt, me.slot * 29 + 5) % 100
    < (REMEMBER_PCT[difficulty] ?? REMEMBER_PCT.normal);
  if (choice === s.prevGolden && remembers) {
    choice = (choice + 1 + (ihash(salt, me.slot + 11) % (s.crates - 1))) % s.crates;
  }

  const diff = choice - me.cur;
  if (Math.abs(diff) > 0.12) frame.move.x = Math.max(-1, Math.min(1, diff * 2.5));
  return frame;
}

export function register() {
  if (minigames.get(ID)) return minigames.get(ID);
  return defineMinigame({
    id: ID,
    name: { en: 'Bluff Banana', de: 'Bluff-Banane' },
    description: {
      en: 'Five crates, one golden banana, three rounds of secret picks and bluffing.',
      de: 'Fuenf Kisten, eine goldene Banane, drei Runden geheimes Tippen und Bluffen.',
    },
    howTo: {
      en: 'Slide your marker left/right to secretly pick a crate. The golden pot is split between everyone on the right crate - and it never repeats its spot. Dodge the rotten one!',
      de: 'Schiebe deine Marke mit links/rechts heimlich zu einer Kiste. Der Goldtopf wird unter allen richtigen Tipps geteilt - und die Banane bleibt nie am selben Ort. Meide die faule Kiste!',
    },
    category: 'ffa',
    tags: ['luck', 'bluff', 'mindgames'],
    players: { min: 2, max: 8 },
    durationSec: 30,
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
