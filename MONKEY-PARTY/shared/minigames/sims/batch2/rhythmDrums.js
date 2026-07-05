/**
 * Rhythm Drums - FFA skill, 2-8 players, 45s.
 *
 * The jungle drum circle pounds out a seeded beat chart with two lanes:
 * left drum (A) and right drum (B). Hit your drum exactly on the beat -
 * perfects score 3, close hits 1, stray slaps cost a point and break
 * your combo. Everyone plays the same chart; best rhythm wins.
 *
 * Pure ESM sim. No DOM, no three.js, no Math.random, no Date.now.
 * Fixed 30Hz steps; all randomness through shared/rng.js (chart at init).
 */

import { createRng } from '../../../rng.js';
import { clampFrame, emptyFrame } from '../../inputs.js';
import {
  defineMinigame, rankByScoreGrouped, coinsForRanking, MINIGAME_HZ, COUNTDOWN_TICKS,
} from '../../framework.js';
import { minigames } from '../../../registries.js';

const ID = 'rhythm_drums';

const DEFAULTS = {
  perfectWindow: 3, // Ticks either side of the beat.
  goodWindow: 7,
  minGapTicks: 13,
  maxGapTicks: 26,
  leadInTicks: 30, // Quiet ticks after the countdown before the first beat.
};

function createSim({ seed, players, params = {}, rules = {} } = {}) {
  const cfg = { ...DEFAULTS, ...params };
  const rng = createRng(seed ?? 0);
  const pids = (players ?? []).slice();
  const durationTicks = 45 * MINIGAME_HZ;
  const chaos = Boolean(rules.chaosMode);

  let state = null;

  function init() {
    rng.setState(Number(seed ?? 0) >>> 0);
    const beats = [];
    let bt = COUNTDOWN_TICKS + cfg.leadInTicks;
    while (bt < durationTicks - 20) {
      beats.push({ tick: bt, lane: rng.int(0, 1) });
      bt += rng.int(cfg.minGapTicks, cfg.maxGapTicks);
    }
    const ps = {};
    pids.forEach((pid, i) => {
      ps[pid] = {
        slot: i,
        next: 0, // Index of my next unjudged beat.
        score: 0,
        combo: 0,
        maxCombo: 0,
        perfects: 0,
        goods: 0,
        misses: 0,
        strays: 0,
        prevA: false,
        prevB: false,
        lastJudge: null, // { tick, kind: 'perfect'|'good'|'miss'|'stray' }
      };
    });
    state = {
      id: ID,
      tick: 0,
      durationTicks,
      countdownTicks: COUNTDOWN_TICKS,
      finished: false,
      beats,
      players: ps,
      order: pids.slice(),
      rngState: rng.state(),
    };
  }

  function judge(p, kind, t) {
    p.lastJudge = { tick: t, kind };
  }

  function handlePress(p, lane, t) {
    const beat = state.beats[p.next];
    if (beat && beat.lane === lane && Math.abs(beat.tick - t) <= cfg.goodWindow) {
      const delta = Math.abs(beat.tick - t);
      if (delta <= cfg.perfectWindow) {
        p.score += 3;
        p.perfects += 1;
        judge(p, 'perfect', t);
      } else {
        p.score += 1;
        p.goods += 1;
        judge(p, 'good', t);
      }
      p.combo += 1;
      p.maxCombo = Math.max(p.maxCombo, p.combo);
      p.next += 1;
    } else {
      p.score -= 1;
      p.strays += 1;
      p.combo = 0;
      judge(p, 'stray', t);
    }
  }

  function step(inputsMap = {}) {
    if (state.finished) return;
    state.tick += 1;
    const t = state.tick;
    const playing = t > state.countdownTicks;

    if (playing) {
      for (const pid of state.order) {
        const p = state.players[pid];
        // Beats that drifted past the window are misses.
        while (p.next < state.beats.length && state.beats[p.next].tick < t - cfg.goodWindow) {
          p.misses += 1;
          p.combo = 0;
          p.next += 1;
          judge(p, 'miss', t);
        }
        const frame = clampFrame(inputsMap[pid] ?? emptyFrame());
        const edgeA = frame.a && !p.prevA;
        const edgeB = frame.b && !p.prevB;
        p.prevA = frame.a;
        p.prevB = frame.b;
        if (edgeA) handlePress(p, 0, t);
        if (edgeB) handlePress(p, 1, t);
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
      scores[pid] = p.score * 1000 + p.maxCombo;
    }
    const ranking = rankByScoreGrouped(scores);
    const coins = coinsForRanking(ranking, { chaos });
    const stats = {};
    for (const pid of state.order) {
      const p = state.players[pid];
      stats[pid] = {
        points: p.score, perfects: p.perfects, maxCombo: p.maxCombo, misses: p.misses,
      };
    }
    return { ranking, coins, stats };
  }

  return { init, step, getState, applyState, isFinished, getResults };
}

// Timing error spans BEYOND the 3-tick perfect window for every tier below
// wild, so bots land a human-like mix of perfects and goods (easy ~54%
// perfect, normal ~64%, hard ~78%) instead of 100% frame-perfect hits.
const TIMING_ERR = { easy: 6, normal: 5, hard: 4, wild: 1 };
// Even wild whiffs ~2% of beats: a flawless human can beat every tier.
const MISS_PCT = { easy: 22, normal: 10, hard: 4, wild: 2 };

function ihash(a, b) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

function bot(publicState, playerId, difficulty, _rng) {
  const frame = emptyFrame();
  const s = publicState;
  const me = s?.players?.[playerId];
  if (!me || s.tick <= s.countdownTicks) return frame;

  const beat = s.beats?.[me.next];
  if (!beat) return frame;

  // Deterministic per-beat plan: sometimes whiff, otherwise hit with a
  // difficulty-scaled timing offset.
  if (ihash(me.next * 31 + 7, me.slot) % 100 < (MISS_PCT[difficulty] ?? MISS_PCT.normal)) {
    return frame;
  }
  const err = TIMING_ERR[difficulty] ?? TIMING_ERR.normal;
  const offset = err > 0 ? (ihash(me.next, me.slot) % (2 * err + 1)) - err : 0;
  const target = beat.tick + offset;
  if (s.tick >= target && s.tick <= target + 1) {
    if (beat.lane === 0) frame.a = true;
    else frame.b = true;
  }
  return frame;
}

export function register() {
  if (minigames.get(ID)) return minigames.get(ID);
  return defineMinigame({
    id: ID,
    name: { en: 'Rhythm Drums', de: 'Rhythmus-Trommeln' },
    description: {
      en: 'Pound the jungle drums exactly on the beat - perfects build big combos.',
      de: 'Schlage die Dschungeltrommeln genau im Takt - Perfekte bauen grosse Combos.',
    },
    howTo: {
      en: 'Beats roll toward two drums: hit A for the left lane and B for the right lane, right on the beat. Stray slaps cost a point!',
      de: 'Beats rollen auf zwei Trommeln zu: A fuer die linke Spur, B fuer die rechte - genau im Takt. Danebenschlagen kostet einen Punkt!',
    },
    category: 'ffa',
    tags: ['skill', 'rhythm', 'music'],
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
