/**
 * mashRace template - "alternate A/B mashing race" (package P8).
 *
 * Hammer A and B in strict alternation to build power. Three submodes
 * share the sim (chosen via params.mode):
 *   'solo' - every player races their own meter to the goal (ffa/duel),
 *   'tug'  - two teams pull one rope; drag it past the mark to win (2v2),
 *   'team' - two team carts race their combined progress to the goal.
 *
 * makeMashRaceVariant(variant) stamps out a themed MinigameDef; params
 * control goal/decay/mode and the theme ({palette, propSet, skyColor})
 * read by the shared view.
 *
 * Pure ESM sim. No DOM, no three.js, no Math.random, no Date.now.
 * Fixed 30Hz steps; deterministic (no RNG needed).
 */

import { clampFrame, emptyFrame } from '../../inputs.js';
import {
  defineMinigame, rankByScoreGrouped, coinsForRanking, MINIGAME_HZ, COUNTDOWN_TICKS,
} from '../../framework.js';
import { minigames } from '../../../registries.js';

const DT = 1 / MINIGAME_HZ;

export const MASH_RACE_DEFAULTS = {
  mode: 'solo', // 'solo' | 'tug' | 'team'
  goal: 46, // Net presses to finish (solo/team).
  decayPerSec: 0.35,
  ropeGoal: 9,
  pullPower: 0.45,
  freezeEveryTicks: 0, // >0: mash for this long, then a freeze window...
  freezeTicks: 0, // ...of this length where presses do nothing.
  durationSec: 40,
  theme: {
    palette: { primary: '#2e7d32', secondary: '#8d6e63', accent: '#ffe135' },
    propSet: 'jungle',
    skyColor: '#87ceeb',
  },
};

function createTemplateSim({ id, seed, players, params = {}, rules = {} } = {}) {
  const cfg = { ...MASH_RACE_DEFAULTS, ...params };
  const pids = (players ?? []).slice();
  const durationTicks = Math.round(cfg.durationSec * MINIGAME_HZ);
  const chaos = Boolean(rules.chaosMode);
  const teamAOf = Math.ceil(pids.length / 2);
  void seed; // Pure mash - deterministic without RNG.

  let state = null;

  function init() {
    const ps = {};
    pids.forEach((pid, i) => {
      ps[pid] = {
        slot: i,
        team: i < teamAOf ? 0 : 1,
        presses: 0,
        wrong: 0,
        lastBtn: 0, // 0 none, 1 A, 2 B - alternation tracker.
        prevA: false,
        prevB: false,
        progress: 0,
        finished: false,
        finishTick: -1,
        lastPressTick: -1,
      };
    });
    state = {
      id,
      tick: 0,
      durationTicks,
      countdownTicks: COUNTDOWN_TICKS,
      finished: false,
      theme: cfg.theme,
      mode: cfg.mode,
      goal: cfg.goal,
      ropeGoal: cfg.ropeGoal,
      freezeEveryTicks: cfg.freezeEveryTicks,
      freezeTicks: cfg.freezeTicks,
      frozen: false, // True during a freeze window (presses do nothing).
      rope: 0,
      winnerTeam: -1,
      teams: cfg.mode === 'solo' ? null : [{ score: 0 }, { score: 0 }],
      finishedCount: 0,
      players: ps,
      order: pids.slice(),
    };
  }

  function teamSize(team) {
    return team === 0 ? teamAOf : pids.length - teamAOf;
  }

  function step(inputsMap = {}) {
    if (state.finished) return;
    state.tick += 1;
    const t = state.tick;
    const playing = t > state.countdownTicks;

    if (playing) {
      // Freeze-window variants (e.g. drawbridge_dash): the mechanism locks
      // on a fixed cadence and presses during the lock are simply ignored.
      if (cfg.freezeEveryTicks > 0 && cfg.freezeTicks > 0) {
        const cycle = cfg.freezeEveryTicks + cfg.freezeTicks;
        state.frozen = ((t - state.countdownTicks) % cycle) >= cfg.freezeEveryTicks;
      }
      for (const pid of state.order) {
        const p = state.players[pid];
        if (p.finished) continue;
        const frame = clampFrame(inputsMap[pid] ?? emptyFrame());
        const edgeA = frame.a && !p.prevA;
        const edgeB = frame.b && !p.prevB;
        p.prevA = frame.a;
        p.prevB = frame.b;
        if (state.frozen) continue; // Locked: presses neither help nor hurt.

        let hits = 0;
        if (edgeA) {
          if (p.lastBtn !== 1) {
            hits += 1;
            p.lastBtn = 1;
          } else {
            p.wrong += 1;
          }
        }
        if (edgeB) {
          if (p.lastBtn !== 2) {
            hits += 1;
            p.lastBtn = 2;
          } else {
            p.wrong += 1;
          }
        }
        if (hits === 0) continue;
        p.presses += hits;
        p.lastPressTick = t;

        // Even teams stay fair when the split is odd: scale per-head power.
        const share = state.mode === 'solo' ? 1 : (pids.length / 2) / teamSize(p.team);
        if (state.mode === 'solo') {
          p.progress += hits;
        } else if (state.mode === 'tug') {
          state.rope += (p.team === 0 ? 1 : -1) * cfg.pullPower * share * hits;
        } else {
          state.teams[p.team].score += hits * share;
        }
      }

      if (state.mode === 'solo') {
        for (const pid of state.order) {
          const p = state.players[pid];
          if (p.finished) continue;
          p.progress = Math.max(0, p.progress - cfg.decayPerSec * DT);
          if (p.progress >= state.goal) {
            p.progress = state.goal;
            p.finished = true;
            p.finishTick = t;
            state.finishedCount += 1;
          }
        }
        if (state.finishedCount >= state.order.length) state.finished = true;
      } else if (state.mode === 'tug') {
        if (Math.abs(state.rope) >= cfg.ropeGoal) {
          state.winnerTeam = state.rope > 0 ? 0 : 1;
          state.finished = true;
        }
      } else if (state.teams[0].score >= state.goal || state.teams[1].score >= state.goal) {
        state.winnerTeam = state.teams[0].score >= state.goal ? 0 : 1;
        state.finished = true;
      }
    }

    if (t >= state.durationTicks) {
      if (state.mode === 'tug' && state.winnerTeam < 0 && state.rope !== 0) {
        state.winnerTeam = state.rope > 0 ? 0 : 1;
      }
      if (state.mode === 'team' && state.winnerTeam < 0
        && state.teams[0].score !== state.teams[1].score) {
        state.winnerTeam = state.teams[0].score > state.teams[1].score ? 0 : 1;
      }
      state.finished = true;
    }
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
      if (state.mode === 'solo') {
        scores[pid] = p.finished ? 1000000 - p.finishTick : p.progress * 100;
      } else {
        // Team modes: teammates win or lose together, so they share one
        // payout tier instead of splitting it by individual mash count.
        scores[pid] = state.winnerTeam >= 0 && p.team === state.winnerTeam ? 1 : 0;
      }
    }
    const ranking = rankByScoreGrouped(scores);
    const coins = coinsForRanking(ranking, { chaos });
    const stats = {};
    for (const pid of state.order) {
      const p = state.players[pid];
      stats[pid] = state.mode === 'solo'
        ? { finished: p.finished, presses: p.presses, wrongPresses: p.wrong }
        : {
          team: p.team,
          wonTug: state.winnerTeam >= 0 && p.team === state.winnerTeam,
          presses: p.presses,
          wrongPresses: p.wrong,
        };
    }
    return { ranking, coins, stats };
  }

  return { init, step, getState, applyState, isFinished, getResults };
}

const MASH_HALF = { easy: 9, normal: 7, hard: 5, wild: 4 };
const STUMBLE_PCT = { easy: 25, normal: 12, hard: 4, wild: 1 };

function ihash(a, b) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

function bot(publicState, playerId, difficulty, _rng) {
  const frame = emptyFrame();
  const s = publicState;
  const me = s?.players?.[playerId];
  if (!me || me.finished || s.tick <= s.countdownTicks) return frame;

  // Square-wave alternation: A for half a cycle, then B, phase-shifted per
  // seat so team tugs do not cancel out in lockstep. Stumbles skip a beat.
  const half = MASH_HALF[difficulty] ?? MASH_HALF.normal;
  const local = (s.tick + me.slot * 3) % (half * 2);
  const beat = Math.floor((s.tick + me.slot * 3) / half);
  if (ihash(beat, me.slot * 13 + 5) % 100 < (STUMBLE_PCT[difficulty] ?? 12)) return frame;
  if (local < half) frame.a = true;
  else frame.b = true;
  return frame;
}

/**
 * Create + register one mashRace variant.
 *
 * @param {Object} variant See reactionDuel.js for the accepted shape.
 * @returns {import('../../../types.js').MinigameDef}
 */
export function makeMashRaceVariant(variant = {}) {
  const id = variant.id;
  const existing = minigames.get(id);
  if (existing) return existing;
  const params = { ...MASH_RACE_DEFAULTS, ...(variant.params ?? {}) };
  return defineMinigame({
    id,
    name: variant.name,
    description: variant.description ?? {
      en: 'Hammer A and B in alternation - fastest rhythm wins the race.',
      de: 'Haemmere A und B im Wechsel - der schnellste Rhythmus gewinnt.',
    },
    howTo: variant.howTo ?? {
      en: 'Alternate A, B, A, B as fast as you can. Double-tapping the same button does nothing, so keep the rhythm clean!',
      de: 'Druecke abwechselnd A, B, A, B so schnell du kannst. Zweimal dieselbe Taste bringt nichts - halte den Rhythmus sauber!',
    },
    category: variant.category ?? 'ffa',
    tags: variant.tags ?? ['mash', 'race'],
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

export default makeMashRaceVariant;
