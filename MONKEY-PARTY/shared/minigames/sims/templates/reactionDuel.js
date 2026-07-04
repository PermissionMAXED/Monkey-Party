/**
 * reactionDuel template - "tap A when the signal fires" (package P8).
 *
 * Several rounds of pure reaction: after a seeded random wait the signal
 * fires and the earliest valid A press earns the most points. Pressing
 * before the signal (or on a fake-out flash) is a false start that costs
 * a point and locks you out of the round.
 *
 * makeReactionDuelVariant(variant) stamps out a themed MinigameDef; the
 * variant's params control waits, fake-out chance, round count and the
 * theme ({palette, propSet, skyColor}) read by the shared view.
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

const PRESS_POINTS = [5, 3, 2, 1, 1, 1, 1, 1];

export const REACTION_DUEL_DEFAULTS = {
  rounds: 5,
  waitMinTicks: 40,
  waitMaxTicks: 110,
  windowTicks: 70,
  interTicks: 30,
  fakeChance: 0.3,
  theme: {
    palette: { primary: '#2e7d32', secondary: '#8d6e63', accent: '#ffe135' },
    propSet: 'jungle',
    skyColor: '#87ceeb',
  },
};

function createTemplateSim({ id, seed, players, params = {}, rules = {} } = {}) {
  const cfg = { ...REACTION_DUEL_DEFAULTS, ...params };
  const rng = createRng(seed ?? 0);
  const pids = (players ?? []).slice();
  const durationTicks = Math.round((cfg.durationSec ?? 45) * MINIGAME_HZ);
  const chaos = Boolean(rules.chaosMode);

  let state = null;

  function init() {
    rng.setState(Number(seed ?? 0) >>> 0);
    const ps = {};
    pids.forEach((pid, i) => {
      ps[pid] = {
        slot: i,
        score: 0,
        pressedTick: -1,
        locked: false,
        falseStarts: 0,
        wins: 0,
        reactSum: 0,
        bestReact: -1,
        prevA: false,
      };
    });
    state = {
      id,
      tick: 0,
      durationTicks,
      countdownTicks: COUNTDOWN_TICKS,
      finished: false,
      theme: cfg.theme,
      rounds: cfg.rounds,
      round: 0,
      phase: 'idle', // 'wait' | 'window' | 'inter'
      phaseTick: COUNTDOWN_TICKS,
      signalAt: -1,
      fakeAt: -1,
      pressCount: 0,
      players: ps,
      order: pids.slice(),
      rngState: rng.state(),
    };
  }

  function startRound(t) {
    state.round += 1;
    state.phase = 'wait';
    state.phaseTick = t;
    const waitDur = rng.int(cfg.waitMinTicks, cfg.waitMaxTicks);
    state.signalAt = t + waitDur;
    state.fakeAt = rng.next() < cfg.fakeChance && waitDur > 46
      ? t + rng.int(16, waitDur - 22)
      : -1;
    state.pressCount = 0;
    for (const pid of state.order) {
      const p = state.players[pid];
      p.pressedTick = -1;
      p.locked = false;
    }
  }

  function step(inputsMap = {}) {
    if (state.finished) return;
    rng.setState(state.rngState);
    state.tick += 1;
    const t = state.tick;

    if (t === state.countdownTicks + 1) startRound(t);

    if (t > state.countdownTicks && state.round > 0) {
      const edges = {};
      for (const pid of state.order) {
        const p = state.players[pid];
        const frame = clampFrame(inputsMap[pid] ?? emptyFrame());
        edges[pid] = frame.a && !p.prevA;
        p.prevA = frame.a;
      }

      if (state.phase === 'wait') {
        for (const pid of state.order) {
          const p = state.players[pid];
          if (edges[pid] && !p.locked) {
            p.locked = true;
            p.falseStarts += 1;
            p.score -= 1;
          }
        }
        if (t >= state.signalAt) {
          state.phase = 'window';
          state.phaseTick = t;
        }
      } else if (state.phase === 'window') {
        for (const pid of state.order) {
          const p = state.players[pid];
          if (edges[pid] && !p.locked && p.pressedTick < 0) {
            p.pressedTick = t;
            const react = t - state.signalAt;
            p.reactSum += react;
            p.bestReact = p.bestReact < 0 ? react : Math.min(p.bestReact, react);
            p.score += PRESS_POINTS[Math.min(state.pressCount, PRESS_POINTS.length - 1)];
            if (state.pressCount === 0) p.wins += 1;
            state.pressCount += 1;
          }
        }
        const allDone = state.order.every((pid) => {
          const p = state.players[pid];
          return p.locked || p.pressedTick >= 0;
        });
        if (allDone || t - state.phaseTick >= cfg.windowTicks) {
          state.phase = 'inter';
          state.phaseTick = t;
        }
      } else if (state.phase === 'inter' && t - state.phaseTick >= cfg.interTicks) {
        if (state.round >= cfg.rounds) state.finished = true;
        else startRound(t);
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
      scores[pid] = p.score * 10000 - p.reactSum;
    }
    const ranking = rankByScore(scores);
    const coins = coinsForRanking(ranking, { chaos });
    const stats = {};
    for (const pid of state.order) {
      const p = state.players[pid];
      stats[pid] = {
        points: p.score,
        roundWins: p.wins,
        falseStarts: p.falseStarts,
        bestReactionMs: p.bestReact < 0 ? null : Math.round((p.bestReact / MINIGAME_HZ) * 1000),
      };
    }
    return { ranking, coins, stats };
  }

  return { init, step, getState, applyState, isFinished, getResults };
}

const REACT = { easy: 11, normal: 7, hard: 4, wild: 2 };
const FAKE_FALL_PCT = { easy: 50, normal: 28, hard: 10, wild: 3 };

function ihash(a, b) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

function bot(publicState, playerId, difficulty, _rng) {
  const frame = emptyFrame();
  const s = publicState;
  const me = s?.players?.[playerId];
  if (!me || s.tick <= s.countdownTicks || me.locked) return frame;

  const react = REACT[difficulty] ?? REACT.normal;
  if (s.phase === 'wait') {
    // Jumpy bots flinch at fake-out flashes.
    if (s.fakeAt > 0 && s.tick >= s.fakeAt + react && s.tick <= s.fakeAt + react + 1
      && ihash(s.round * 17 + 1, me.slot) % 100 < (FAKE_FALL_PCT[difficulty] ?? 28)) {
      frame.a = true;
    }
    return frame;
  }
  if (s.phase === 'window' && me.pressedTick < 0) {
    const target = s.signalAt + react + (ihash(s.round, me.slot) % 3);
    if (s.tick >= target) frame.a = true;
  }
  return frame;
}

/**
 * Create + register one reactionDuel variant.
 *
 * @param {{
 *   id: string, name: {en: string, de: string},
 *   description?: Object, howTo?: Object, category?: string,
 *   players?: {min: number, max: number}, competitiveSafe?: boolean,
 *   tags?: string[], params?: Object,
 * }} variant
 * @returns {import('../../../types.js').MinigameDef}
 */
export function makeReactionDuelVariant(variant = {}) {
  const id = variant.id;
  const existing = minigames.get(id);
  if (existing) return existing;
  const params = { ...REACTION_DUEL_DEFAULTS, ...(variant.params ?? {}) };
  params.durationSec = params.durationSec ?? Math.ceil(
    (COUNTDOWN_TICKS + params.rounds
      * (params.waitMaxTicks + params.windowTicks + params.interTicks)) / MINIGAME_HZ,
  ) + 2;
  return defineMinigame({
    id,
    name: variant.name,
    description: variant.description ?? {
      en: 'Wait for the signal, then slap A faster than anyone else.',
      de: 'Warte auf das Signal und druecke A schneller als alle anderen.',
    },
    howTo: variant.howTo ?? {
      en: 'Keep your finger ready: when the real signal fires, press A first for the most points. Pressing early or on a fake-out costs a point!',
      de: 'Finger bereit: Wenn das echte Signal kommt, druecke als Erster A fuer die meisten Punkte. Zu frueh oder auf einen Fake gedrueckt kostet einen Punkt!',
    },
    category: variant.category ?? 'ffa',
    tags: variant.tags ?? ['reaction', 'skill'],
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

export default makeReactionDuelVariant;
