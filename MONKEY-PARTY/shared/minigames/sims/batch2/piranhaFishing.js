/**
 * Piranha Fishing - FFA skill, 2-8 players, 45s.
 *
 * Monkeys line a dock over piranha waters. A power meter swings back and
 * forth: press A at the top of the swing for a perfect cast that hooks a
 * fat piranha, then mash A to reel it in before it wriggles free. The
 * meter is a pure function of time - no dice, all timing - so the game
 * is fully deterministic and competition-safe.
 *
 * Pure ESM sim. No DOM, no three.js, no Math.random, no Date.now.
 * Fixed 30Hz steps; no RNG at all (deterministic skill game).
 */

import { clampFrame, emptyFrame } from '../../inputs.js';
import {
  defineMinigame, rankByScore, coinsForRanking, MINIGAME_HZ, COUNTDOWN_TICKS,
} from '../../framework.js';
import { minigames } from '../../../registries.js';

const ID = 'piranha_fishing';

const DEFAULTS = {
  meterSpeedStart: 0.09, // Radians per tick.
  meterSpeedEnd: 0.14,
  perfectAt: 0.93, // Meter value for a 3-point piranha.
  goodAt: 0.72, // Meter value for a 2-point piranha.
  reelBasePresses: 3,
  reelPressesPerPoint: 2,
  reelWindowPerPress: 24, // Ticks allowed per required press.
};

function createSim({ seed, players, params = {}, rules = {} } = {}) {
  const cfg = { ...DEFAULTS, ...params };
  const pids = (players ?? []).slice();
  const durationTicks = 45 * MINIGAME_HZ;
  const chaos = Boolean(rules.chaosMode);
  void seed; // Fully deterministic: the meter is a pure function of time.

  let state = null;

  function init() {
    const ps = {};
    pids.forEach((pid, i) => {
      ps[pid] = {
        slot: i,
        phase: 'cast', // 'cast' | 'reel'
        phaseTick: COUNTDOWN_TICKS,
        meter: 0,
        fishValue: 0,
        reelNeed: 0,
        reelPresses: 0,
        reelDeadline: -1,
        score: 0,
        landed: 0,
        escaped: 0,
        prevA: false,
        lastEventTick: -1,
        lastEventKind: null, // 'hook' | 'land' | 'escape'
      };
    });
    state = {
      id: ID,
      tick: 0,
      durationTicks,
      countdownTicks: COUNTDOWN_TICKS,
      finished: false,
      players: ps,
      order: pids.slice(),
    };
  }

  function meterValue(p, t) {
    const speed = cfg.meterSpeedStart
      + (cfg.meterSpeedEnd - cfg.meterSpeedStart) * Math.min(1, t / state.durationTicks);
    return 0.5 + 0.5 * Math.sin((t - p.phaseTick) * speed - Math.PI / 2);
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
        const pressed = frame.a && !p.prevA;
        p.prevA = frame.a;

        if (p.phase === 'cast') {
          p.meter = meterValue(p, t);
          if (pressed) {
            const q = p.meter;
            p.fishValue = q >= cfg.perfectAt ? 3 : q >= cfg.goodAt ? 2 : 1;
            p.reelNeed = cfg.reelBasePresses + p.fishValue * cfg.reelPressesPerPoint;
            p.reelPresses = 0;
            p.reelDeadline = t + p.reelNeed * cfg.reelWindowPerPress;
            p.phase = 'reel';
            p.phaseTick = t;
            p.lastEventTick = t;
            p.lastEventKind = 'hook';
          }
        } else {
          // Reeling: mash fresh A presses before the piranha wriggles free.
          if (pressed) {
            p.reelPresses += 1;
            if (p.reelPresses >= p.reelNeed) {
              p.score += p.fishValue;
              p.landed += 1;
              p.phase = 'cast';
              p.phaseTick = t;
              p.meter = 0;
              p.lastEventTick = t;
              p.lastEventKind = 'land';
            }
          }
          if (p.phase === 'reel' && t >= p.reelDeadline) {
            p.escaped += 1;
            p.phase = 'cast';
            p.phaseTick = t;
            p.meter = 0;
            p.lastEventTick = t;
            p.lastEventKind = 'escape';
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
      scores[pid] = p.score * 10000 + p.landed * 10 - p.escaped;
    }
    const ranking = rankByScore(scores);
    const coins = coinsForRanking(ranking, { chaos });
    const stats = {};
    for (const pid of state.order) {
      const p = state.players[pid];
      stats[pid] = { points: p.score, landed: p.landed, escaped: p.escaped };
    }
    return { ranking, coins, stats };
  }

  return { init, step, getState, applyState, isFinished, getResults };
}

const CAST_AT = { easy: 0.68, normal: 0.82, hard: 0.92, wild: 0.955 };
const MASH_HALF = { easy: 11, normal: 8, hard: 6, wild: 4 };

function bot(publicState, playerId, difficulty, rng) {
  const frame = emptyFrame();
  const s = publicState;
  const me = s?.players?.[playerId];
  if (!me || s.tick <= s.countdownTicks) return frame;

  // Stable per-seat quirk so equal-difficulty bots are not carbon copies.
  const quirk = ((me.slot * 2654435761) >>> 24) % 7;

  if (me.phase === 'cast') {
    // Wait for the swing to reach my threshold, with a wobbly eye.
    const threshold = (CAST_AT[difficulty] ?? CAST_AT.normal)
      - quirk * 0.012 + (rng.next() - 0.5) * 0.04;
    if (me.meter >= threshold) frame.a = true;
    return frame;
  }
  // Reel: square-wave mashing so each cycle lands one fresh press.
  const half = (MASH_HALF[difficulty] ?? MASH_HALF.normal) + (quirk % 3);
  frame.a = ((s.tick + quirk) % (half * 2)) < half;
  return frame;
}

export function register() {
  if (minigames.get(ID)) return minigames.get(ID);
  return defineMinigame({
    id: ID,
    name: { en: 'Piranha Fishing', de: 'Piranha-Angeln' },
    description: {
      en: 'Nail the power meter to hook fat piranhas, then mash to reel them in.',
      de: 'Triff das Power-Meter fuer fette Piranhas und kurbel sie schnell ein.',
    },
    howTo: {
      en: 'Press A when the meter peaks to cast - the better the timing, the bigger the fish. Then mash A to reel it in before it escapes!',
      de: 'Druecke A am hoechsten Punkt des Meters - je besser das Timing, desto groesser der Fisch. Dann A haemmern, bevor er entkommt!',
    },
    category: 'ffa',
    tags: ['skill', 'timing'],
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
