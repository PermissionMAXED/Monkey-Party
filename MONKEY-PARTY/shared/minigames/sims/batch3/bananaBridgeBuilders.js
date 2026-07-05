/**
 * Banana Bridge Builders - 2v2 carry/build race, exactly 4 players, 60s.
 *
 * Each team ferries planks from its supply pile to its own rope bridge
 * over the gorge. Carrying a plank slows you down, and the bridge deck is
 * narrow - drift off the edge and you tumble into the gorge, losing the
 * plank. The first team to nail down all planks (or the team with the
 * longer bridge at the horn) wins.
 *
 * Team convention: team A = players[0..1], team B = players[2..3]
 * (the launcher passes teams in this flat order - see makeTeams('2v2')).
 *
 * Pure ESM sim. No DOM, no three.js, no Math.random, no Date.now.
 * Fixed 30Hz steps; no in-step randomness (fully input-driven).
 */

import { createRng } from '../../../rng.js';
import { clampFrame, emptyFrame } from '../../inputs.js';
import {
  defineMinigame, rankByScoreGrouped, coinsForRanking, MINIGAME_HZ, COUNTDOWN_TICKS,
} from '../../framework.js';
import { minigames } from '../../../registries.js';

const ID = 'banana_bridge_builders';
const DT = 1 / MINIGAME_HZ;

const DEFAULTS = {
  moveSpeed: 6,
  carrySpeed: 3.7,
  plankLen: 1.5,
  planksToWin: 8,
  bridgeHalfWidth: 0.85,
  pickRadius: 1.6,
  placeRadius: 0.6,
  respawnTicks: 40,
  bankDepth: 12, // Bank area: z in [-bankDepth, 0]; the gorge starts at z=0.
  bankHalfWidth: 11,
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
    const teams = [0, 1].map((ti) => ({
      bridgeX: ti === 0 ? -4.5 : 4.5,
      pileX: ti === 0 ? -8.5 : 8.5,
      pileZ: -8,
      planks: 0,
    }));
    const ps = {};
    pids.forEach((pid, i) => {
      const ti = i < half ? 0 : 1;
      ps[pid] = {
        slot: i,
        team: ti,
        x: teams[ti].bridgeX + (i % 2 === 0 ? -1.4 : 1.4),
        z: -3,
        vx: 0,
        vz: 0,
        carrying: false,
        score: 0, // Planks personally placed (HUD chip).
        falls: 0,
        frozenUntil: -1,
        prevA: false,
        pickTick: -1,
        placeTick: -1,
        fallTick: -1,
      };
    });
    state = {
      id: ID,
      tick: 0,
      durationTicks,
      countdownTicks: COUNTDOWN_TICKS,
      finished: false,
      plankLen: cfg.plankLen,
      planksToWin: cfg.planksToWin,
      bridgeHalfWidth: cfg.bridgeHalfWidth,
      teams,
      winnerTeam: -1,
      finishTick: -1,
      players: ps,
      order: pids.slice(),
      rngState: rng.state(),
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
        const team = state.teams[p.team];
        const frozen = t < p.frozenUntil;
        const frame = frozen ? emptyFrame() : clampFrame(inputsMap[pid] ?? emptyFrame());

        // Move. The view camera sits BEHIND the bank at -z looking toward
        // +z, so stick up (+y) = +z = toward the gorge = up-screen, and
        // screen-right = world -x (camera right = cross(up, pos-look) =
        // -x): move.x is negated so pressing right moves right ON SCREEN.
        const speed = p.carrying ? cfg.carrySpeed : cfg.moveSpeed;
        p.vx = p.vx * 0.75 + (-frame.move.x) * speed * 0.25;
        p.vz = p.vz * 0.75 + frame.move.y * speed * 0.25;
        const zPrev = p.z;
        p.x += p.vx * DT;
        p.z += p.vz * DT;

        const tipZ = team.planks * cfg.plankLen;
        // Gorge-lip wall: stepping past z=0 is only possible over your own
        // bridge. Clamp BEFORE the bank/deck branch so a misaligned player
        // coming from the bank is walled at the lip (per howTo) instead of
        // entering the deck branch and tumbling. (Pre-fix this check lived
        // inside the z<=0 branch where Math.min(p.z, 0) was a no-op.)
        if (p.z > 0 && zPrev <= 0 && Math.abs(p.x - team.bridgeX) > cfg.bridgeHalfWidth) {
          p.z = 0;
        }
        if (p.z <= 0) {
          // Bank area: free movement.
          p.x = Math.max(-cfg.bankHalfWidth, Math.min(cfg.bankHalfWidth, p.x));
          p.z = Math.max(-cfg.bankDepth, p.z);
        } else {
          // On the bridge deck: don't run past the tip...
          p.z = Math.min(p.z, Math.max(0, tipZ));
          // ...and drifting off the narrow deck means a tumble.
          if (Math.abs(p.x - team.bridgeX) > cfg.bridgeHalfWidth) {
            p.falls += 1;
            p.fallTick = t;
            p.carrying = false;
            p.x = team.bridgeX + (p.slot % 2 === 0 ? -1.4 : 1.4);
            p.z = -3;
            p.vx = 0;
            p.vz = 0;
            p.frozenUntil = t + cfg.respawnTicks;
            continue;
          }
        }

        // Pick up a plank at the team pile (fresh A press).
        const edgeA = frame.a && !p.prevA;
        p.prevA = frame.a;
        if (edgeA && !p.carrying && !frozen
          && Math.hypot(p.x - team.pileX, p.z - team.pileZ) <= cfg.pickRadius) {
          p.carrying = true;
          p.pickTick = t;
        }

        // Place automatically at the bridge tip.
        if (p.carrying && team.planks < cfg.planksToWin
          && Math.abs(p.x - team.bridgeX) <= cfg.bridgeHalfWidth
          && p.z >= tipZ - cfg.placeRadius && p.z >= -0.2) {
          p.carrying = false;
          team.planks += 1;
          p.score += 1;
          p.placeTick = t;
          if (team.planks >= cfg.planksToWin && state.winnerTeam < 0) {
            state.winnerTeam = p.team;
            state.finishTick = t;
            state.finished = true;
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
      scores[pid] = state.teams[p.team].planks * 100000 + p.score * 100 - p.falls;
    }
    const ranking = rankByScoreGrouped(scores);
    const coins = coinsForRanking(ranking, { chaos });
    const stats = {};
    for (const pid of state.order) {
      const p = state.players[pid];
      stats[pid] = {
        team: p.team,
        teamPlanks: state.teams[p.team].planks,
        planksPlaced: p.score,
        falls: p.falls,
        bridgeDone: state.winnerTeam === p.team,
      };
    }
    return { ranking, coins, stats };
  }

  return { init, step, getState, applyState, isFinished, getResults };
}

const STEER_ERR = { easy: 0.55, normal: 0.28, hard: 0.12, wild: 0.04 };
const PRESS_PACE = { easy: 14, normal: 9, hard: 6, wild: 4 };

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

function bot(publicState, playerId, difficulty, rng) {
  const frame = emptyFrame();
  const s = publicState;
  const me = s?.players?.[playerId];
  if (!me || s.tick <= s.countdownTicks || s.tick < me.frozenUntil) return frame;

  const row = difficulty === 'wild' ? wildRow(s, me) : difficulty;
  const err = STEER_ERR[row] ?? STEER_ERR.normal;
  const pace = PRESS_PACE[row] ?? PRESS_PACE.normal;
  const team = s.teams[me.team];
  const tipZ = team.planks * s.plankLen;

  // Bots plan in world coords; the sim maps stick right (+x) to world -x
  // (the camera sits behind the bank), so every emitted x is negated.
  if (me.carrying) {
    if (me.z < -0.4 && Math.abs(me.x - team.bridgeX) > 0.45) {
      // Line up with the bridge mouth before heading north.
      frame.move.x = -Math.max(-1, Math.min(1, (team.bridgeX - me.x) * 1.2));
      frame.move.y = 0.25;
    } else {
      // March up the deck; sloppy monkeys wobble toward the edge.
      const wobble = (rng.next() - 0.5) * err * 2;
      frame.move.x = -Math.max(-1, Math.min(1, (team.bridgeX - me.x) * 1.6 + wobble));
      frame.move.y = 1;
    }
    if (tipZ >= (s.planksToWin ?? 8) * s.plankLen) frame.move.y = 0; // Nothing left to place.
    return frame;
  }

  // Fetch the next plank from the pile.
  const dx = team.pileX - me.x + (rng.next() - 0.5) * err;
  const dz = team.pileZ - me.z + (rng.next() - 0.5) * err;
  const mag = Math.hypot(dx, dz);
  if (mag > 0.25) {
    frame.move.x = -(dx / mag);
    frame.move.y = dz / mag;
  }
  if (mag <= 1.2 && s.tick % pace < Math.ceil(pace / 2)) frame.a = true;
  return frame;
}

export function register() {
  if (minigames.get(ID)) return minigames.get(ID);
  return defineMinigame({
    id: ID,
    name: { en: 'Banana Bridge Builders', de: 'Bananenbruecken-Bauer' },
    description: {
      en: 'Ferry planks across the bank and nail your team\'s rope bridge together first.',
      de: 'Schleppt Planken ueber das Ufer und nagelt die Haengebruecke eures Teams zuerst zusammen.',
    },
    howTo: {
      en: 'Grab a plank at your pile (A), carry it up your bridge and it snaps onto the tip. Carrying slows you down, and the deck is narrow - fall off and the plank is gone. First finished bridge wins!',
      de: 'Schnapp dir eine Planke am Stapel (A) und trage sie auf eure Bruecke - an der Spitze rastet sie ein. Tragen macht langsam, und das Deck ist schmal: Wer abstuerzt, verliert die Planke. Die zuerst fertige Bruecke gewinnt!',
    },
    category: '2v2',
    tags: ['team', 'carry', 'race'],
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
