/**
 * Echo Cavern - team memory relay, 4-8 players, 60s.
 *
 * The cave wall flashes a growing drum melody over four glowing pads.
 * Both teams then echo the SAME melody on their own pad row - but the
 * pads are split between teammates, so the right monkey has to hit the
 * right pad at the right moment while everyone else stays quiet. A wrong
 * hit breaks the team's echo. The team with the longest clean echo wins.
 *
 * Team convention: team A = first half of players, team B = second half
 * (the launcher passes teams in this flat order - see makeTeams('team')).
 *
 * Pure ESM sim. No DOM, no three.js, no Math.random, no Date.now.
 * Fixed 30Hz steps; all randomness through shared/rng.js (rngState in
 * the snapshot, so netsync/applyState stays in lockstep).
 */

import { createRng } from '../../../rng.js';
import { clampFrame, emptyFrame } from '../../inputs.js';
import {
  defineMinigame, rankByScoreGrouped, coinsForRanking, MINIGAME_HZ, COUNTDOWN_TICKS,
} from '../../framework.js';
import { minigames } from '../../../registries.js';

const ID = 'echo_cavern';

const DEFAULTS = {
  pads: 4,
  startLen: 3,
  // 5 rounds fit the 60s cap worst-case (countdown 90 + show/replay for
  // seq lengths 3..7 + 4 inter breaks = ~1770 of 1800 ticks); 6 rounds
  // could not finish and the last melody was routinely cut off by the horn.
  maxRounds: 5,
  showTicks: 12, // Flash per melody note.
  gapTicks: 4,
  replayTicksPerNote: 34,
  replayGraceTicks: 50,
  interTicks: 30,
};

function createSim({ seed, players, params = {}, rules = {} } = {}) {
  const cfg = { ...DEFAULTS, ...params };
  const rng = createRng(seed ?? 0);
  const pids = (players ?? []).slice();
  const durationTicks = 60 * MINIGAME_HZ;
  const chaos = Boolean(rules.chaosMode);

  let state = null;

  function init() {
    rng.setState(Number(seed ?? 0) >>> 0);
    const half = Math.ceil(pids.length / 2);
    const teamsMembers = [pids.slice(0, half), pids.slice(half)];
    const ps = {};
    pids.forEach((pid, i) => {
      const team = i < half ? 0 : 1;
      const memberIdx = team === 0 ? i : i - half;
      const teamSize = teamsMembers[team].length;
      const owned = [];
      for (let pad = 0; pad < cfg.pads; pad += 1) {
        if (pad % teamSize === memberIdx) owned.push(pad);
      }
      ps[pid] = {
        slot: i,
        team,
        memberIdx,
        ownedPads: owned, // owned[0] -> A button, owned[1] -> B button.
        score: 0, // Correct notes personally drummed (HUD chip).
        wrongs: 0,
        prevA: false,
        prevB: false,
        hitTick: -1,
        failTick: -1,
      };
    });
    const seq = [];
    for (let i = 0; i < cfg.startLen; i += 1) seq.push(rng.int(0, cfg.pads - 1));
    state = {
      id: ID,
      tick: 0,
      durationTicks,
      countdownTicks: COUNTDOWN_TICKS,
      finished: false,
      pads: cfg.pads,
      round: 1,
      maxRounds: cfg.maxRounds,
      seq,
      phase: 'show', // 'show' | 'replay' | 'inter'
      phaseTick: COUNTDOWN_TICKS,
      showStep: cfg.showTicks + cfg.gapTicks,
      teams: [0, 1].map((ti) => ({
        members: teamsMembers[ti],
        progress: 0,
        done: false,
        broken: false,
        best: 0,
        total: 0,
        score: 0, // Live "best chain" readout for the HUD team bars.
        lastAdvanceTick: -1,
        doneTick: -1,
      })),
      players: ps,
      order: pids.slice(),
      rngState: rng.state(),
    };
  }

  function replayBudget() {
    return state.seq.length * cfg.replayTicksPerNote + cfg.replayGraceTicks;
  }

  function endReplay(t) {
    for (const team of state.teams) {
      team.best = Math.max(team.best, team.progress);
      team.total += team.progress;
      team.score = team.best;
    }
    if (state.round >= cfg.maxRounds) {
      state.finished = true;
      return;
    }
    state.phase = 'inter';
    state.phaseTick = t;
  }

  function step(inputsMap = {}) {
    if (state.finished) return;
    rng.setState(state.rngState);
    state.tick += 1;
    const t = state.tick;

    if (t > state.countdownTicks) {
      const elapsed = t - state.phaseTick;

      // Track button edges in EVERY phase, so a button held through a phase
      // change never registers as a fresh hit when the replay starts.
      const edges = {};
      for (const pid of state.order) {
        const p = state.players[pid];
        const frame = clampFrame(inputsMap[pid] ?? emptyFrame());
        edges[pid] = { a: frame.a && !p.prevA, b: frame.b && !p.prevB };
        p.prevA = frame.a;
        p.prevB = frame.b;
      }

      if (state.phase === 'show') {
        if (elapsed >= state.seq.length * state.showStep + 12) {
          state.phase = 'replay';
          state.phaseTick = t;
          for (const team of state.teams) {
            team.progress = 0;
            team.done = false;
            team.broken = false;
            team.lastAdvanceTick = t;
            team.doneTick = -1;
          }
        }
      } else if (state.phase === 'replay') {
        for (const pid of state.order) {
          const p = state.players[pid];
          const team = state.teams[p.team];
          if (team.done || team.broken) continue;
          const presses = [];
          if (edges[pid].a && p.ownedPads.length > 0) presses.push(p.ownedPads[0]);
          if (edges[pid].b && p.ownedPads.length > 1) presses.push(p.ownedPads[1]);
          for (const pad of presses) {
            if (pad === state.seq[team.progress]) {
              team.progress += 1;
              team.lastAdvanceTick = t;
              p.score += 1;
              p.hitTick = t;
              if (team.progress >= state.seq.length) {
                team.done = true;
                team.doneTick = t;
              }
            } else {
              team.broken = true;
              p.wrongs += 1;
              p.failTick = t;
            }
          }
        }
        const allDone = state.teams.every((team) => team.done || team.broken);
        if (allDone || elapsed >= replayBudget()) endReplay(t);
      } else if (state.phase === 'inter' && elapsed >= cfg.interTicks) {
        state.round += 1;
        state.seq.push(rng.int(0, cfg.pads - 1));
        state.phase = 'show';
        state.phaseTick = t;
      }
    }

    if (t >= state.durationTicks) {
      // Hard cap: bank any half-finished echo before the horn.
      for (const team of state.teams) {
        team.best = Math.max(team.best, team.progress);
        team.score = team.best;
      }
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
      const team = state.teams[p.team];
      // Team score: best chain, then cumulative notes, then SPEED - the
      // tick the team completed its latest clean echo (earlier = better).
      // Without the speed term two perfect teams tie on best+total and the
      // ranking fell through to p.score, i.e. which pads each player
      // happened to own (a lottery). Speed < 4096 and personal < 1024, so
      // the components can never bleed into each other.
      const speed = team.doneTick >= 0 ? state.durationTicks - team.doneTick : 0;
      scores[pid] = ((team.best * 1000 + team.total) * 4096 + speed) * 1024
        + p.score * 10 - p.wrongs;
    }
    const ranking = rankByScoreGrouped(scores);
    const coins = coinsForRanking(ranking, { chaos });
    const stats = {};
    for (const pid of state.order) {
      const p = state.players[pid];
      const team = state.teams[p.team];
      stats[pid] = {
        team: p.team,
        longestEcho: team.best,
        notesHit: p.score,
        wrongNotes: p.wrongs,
      };
    }
    return { ranking, coins, stats };
  }

  return { init, step, getState, applyState, isFinished, getResults };
}

const REACT = { easy: 17, normal: 11, hard: 6, wild: 3 };
const WRONG_PCT = { easy: 15, normal: 7, hard: 2, wild: 0 };

function ihash(a, b) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Wild bots are erratic, not superhuman: per ~1s window they swing between
 * peak reflexes (the old 'wild' row), solid play ('hard') and outright
 * blunders ('easy'), so the MEANS land near 'hard' while the variance is
 * loud. Seeded hash only, so replays stay deterministic.
 */
function wildRow(s, me) {
  const roll = ihash(Math.floor(s.tick / 30), me.slot * 29 + 11) % 100;
  if (roll < 30) return 'wild';
  return roll < 72 ? 'hard' : 'easy';
}

function bot(publicState, playerId, difficulty, _rng) {
  const frame = emptyFrame();
  const s = publicState;
  const me = s?.players?.[playerId];
  if (!me || s.phase !== 'replay' || s.tick <= s.countdownTicks) return frame;

  const team = s.teams?.[me.team];
  if (!team || team.done || team.broken) return frame;
  const expected = s.seq[team.progress];
  const padIdx = me.ownedPads.indexOf(expected);
  if (padIdx < 0) return frame; // Not my drum - stay quiet.

  const row = difficulty === 'wild' ? wildRow(s, me) : difficulty;
  const react = REACT[row] ?? REACT.normal;
  const jitter = ihash(s.round * 37 + team.progress, me.slot) % 5;
  const pressAt = team.lastAdvanceTick + react + jitter;
  if (s.tick < pressAt || s.tick > pressAt + 1) return frame;

  // Occasionally fat-finger the other owned drum.
  let idx = padIdx;
  if (me.ownedPads.length > 1
    && ihash(s.round * 53 + team.progress * 7, me.slot * 11 + 3) % 100
      < (WRONG_PCT[row] ?? WRONG_PCT.normal)) {
    idx = 1 - padIdx;
  }
  if (idx === 0) frame.a = true;
  else frame.b = true;
  return frame;
}

export function register() {
  if (minigames.get(ID)) return minigames.get(ID);
  return defineMinigame({
    id: ID,
    name: { en: 'Echo Cavern', de: 'Echo-Hoehle' },
    description: {
      en: 'The cave drums a melody - echo it as a team, one pad per monkey.',
      de: 'Die Hoehle trommelt eine Melodie - gebt sie als Team wieder, jede Trommel gehoert einem Affen.',
    },
    howTo: {
      en: 'Watch the pads flash the melody, then echo it in order: each teammate owns specific pads (A = your first pad, B = your second). A wrong hit breaks the echo! The melody grows each round - longest clean echo wins.',
      de: 'Merkt euch die aufblinkende Melodie und trommelt sie der Reihe nach: Jedem Mitspieler gehoeren bestimmte Pads (A = dein erstes, B = dein zweites). Ein falscher Schlag bricht das Echo ab! Die Melodie waechst jede Runde - das laengste saubere Echo gewinnt.',
    },
    category: 'team',
    tags: ['team', 'memory', 'music', 'coop'],
    players: { min: 4, max: 8 },
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
