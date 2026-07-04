/**
 * Banana Cannon Teams - 2v2 skill/aim, exactly 4 players, 45s.
 *
 * Two teams, two banana cannons. On each team one player loads (pump A
 * three times) while the other aims and fires at moving targets; roles
 * swap every 15 seconds. Highest team score wins.
 *
 * Team convention: team A = players[0..1], team B = players[2..3]
 * (the launcher passes teams in this flat order - see makeTeams('2v2')).
 *
 * Pure ESM sim. No DOM, no three.js, no Math.random, no Date.now.
 * Fixed 30Hz steps; all randomness through shared/rng.js.
 */

import { createRng } from '../../../rng.js';
import { clampFrame, emptyFrame } from '../../inputs.js';
import {
  defineMinigame, coinsForRanking, MINIGAME_HZ, COUNTDOWN_TICKS,
} from '../../framework.js';
import { minigames } from '../../../registries.js';

const ID = 'banana_cannon_teams';
const DT = 1 / MINIGAME_HZ;

const DEFAULTS = {
  pumpsToLoad: 3,
  roleSwapTicks: 450, // 15s.
  aimSpeed: 1.6, // Radians/sec of cannon rotation.
  maxAim: 1.05, // ~60 degrees each way.
  projectileSpeed: 26,
  targetDistance: 20,
  targetCount: 3,
  fireCooldownTicks: 12,
};

function createSim({ seed, players, params = {}, rules = {} } = {}) {
  const cfg = { ...DEFAULTS, ...params };
  const rng = createRng(seed ?? 0);
  const pids = (players ?? []).slice();
  const durationTicks = 45 * MINIGAME_HZ;
  const chaos = Boolean(rules.chaosMode);

  let state = null;

  function spawnTarget() {
    const speed = 3 + rng.next() * 5;
    const radius = 1.6 - rng.next() * 0.9; // Smaller = faster-ish = juicier.
    return {
      x: (rng.next() * 2 - 1) * 12,
      y: 2 + rng.next() * 6,
      dir: rng.next() < 0.5 ? -1 : 1,
      speed,
      radius: Math.max(0.6, radius),
      value: radius < 0.9 ? 3 : radius < 1.25 ? 2 : 1,
    };
  }

  function init() {
    rng.setState(Number(seed ?? 0) >>> 0);
    const teams = [
      { members: [pids[0], pids[1]], score: 0, angle: 0, pumps: 0, loaded: false, cooldownUntil: -1, x: -5 },
      { members: [pids[2], pids[3]], score: 0, angle: 0, pumps: 0, loaded: false, cooldownUntil: -1, x: 5 },
    ];
    const ps = {};
    pids.forEach((pid, i) => {
      ps[pid] = { team: i < 2 ? 0 : 1, hits: 0, pumps: 0, shots: 0, prevA: false };
    });
    const targets = [];
    for (let i = 0; i < cfg.targetCount; i += 1) targets.push(spawnTarget());
    state = {
      id: ID,
      tick: 0,
      durationTicks,
      countdownTicks: COUNTDOWN_TICKS,
      finished: false,
      teams,
      players: ps,
      order: pids.slice(),
      targets,
      projectiles: [],
      nextProjectileId: 1,
      rolePhase: 0,
      lastHit: null, // { team, value, tick } for view feedback.
      rngState: rng.state(),
    };
  }

  /** shooter/loader for a team in the current role phase. */
  function rolesOf(team, rolePhase) {
    const shooterIdx = rolePhase % 2;
    return { shooter: team.members[shooterIdx], loader: team.members[1 - shooterIdx] };
  }

  function step(inputsMap = {}) {
    if (state.finished) return;
    rng.setState(state.rngState);
    state.tick += 1;
    const t = state.tick;
    const playing = t > state.countdownTicks;

    if (playing) {
      state.rolePhase = Math.floor((t - state.countdownTicks) / cfg.roleSwapTicks);

      // Targets glide back and forth across the sky wall.
      for (const target of state.targets) {
        target.x += target.dir * target.speed * DT;
        if (target.x > 13) target.dir = -1;
        if (target.x < -13) target.dir = 1;
      }

      for (let ti = 0; ti < state.teams.length; ti += 1) {
        const team = state.teams[ti];
        const { shooter, loader } = rolesOf(team, state.rolePhase);
        const shooterFrame = clampFrame(inputsMap[shooter] ?? emptyFrame());
        const loaderFrame = clampFrame(inputsMap[loader] ?? emptyFrame());
        const sp = state.players[shooter];
        const lp = state.players[loader];

        // Loader pumps the cannon with fresh A presses.
        const loadPressed = loaderFrame.a && !lp.prevA;
        lp.prevA = loaderFrame.a;
        if (loadPressed && !team.loaded) {
          team.pumps += 1;
          lp.pumps += 1;
          if (team.pumps >= cfg.pumpsToLoad) {
            team.loaded = true;
            team.pumps = cfg.pumpsToLoad;
          }
        }

        // Shooter aims (aim vector wins over the stick) and fires.
        const aimX = shooterFrame.aim ? shooterFrame.aim.x : shooterFrame.move.x;
        team.angle += aimX * cfg.aimSpeed * DT;
        team.angle = Math.max(-cfg.maxAim, Math.min(cfg.maxAim, team.angle));
        const firePressed = shooterFrame.a && !sp.prevA;
        sp.prevA = shooterFrame.a;
        if (firePressed && team.loaded && t >= team.cooldownUntil) {
          team.loaded = false;
          team.pumps = 0;
          team.cooldownUntil = t + cfg.fireCooldownTicks;
          sp.shots += 1;
          state.projectiles.push({
            id: state.nextProjectileId,
            team: ti,
            shooter,
            x: team.x,
            y: 1.2,
            angle: team.angle,
          });
          state.nextProjectileId += 1;
        }
      }

      // Fly projectiles; check target hits at the wall plane.
      const kept = [];
      for (const proj of state.projectiles) {
        proj.x += Math.sin(proj.angle) * cfg.projectileSpeed * DT;
        proj.y += Math.cos(proj.angle) * cfg.projectileSpeed * DT * 0.55 + 0.02;
        const progress = proj.y;
        let hit = false;
        if (progress >= 2) {
          for (const target of state.targets) {
            if (Math.abs(proj.x - target.x) < target.radius
              && Math.abs(proj.y - target.y) < target.radius) {
              const team = state.teams[proj.team];
              team.score += target.value;
              state.players[proj.shooter].hits += 1;
              state.lastHit = { team: proj.team, value: target.value, tick: t };
              Object.assign(target, spawnTarget());
              hit = true;
              break;
            }
          }
        }
        if (!hit && proj.y < 12 && Math.abs(proj.x) < 16) kept.push(proj);
      }
      state.projectiles = kept;
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
    // Team score dominates; personal contribution orders within the team.
    const scored = state.order.map((pid, index) => {
      const p = state.players[pid];
      const team = state.teams[p.team];
      return { pid, index, score: team.score * 10000 + p.hits * 10 + p.pumps };
    });
    scored.sort((a, b) => (b.score - a.score) || (a.index - b.index));
    const ranking = scored.map((e) => e.pid);
    const coins = coinsForRanking(ranking, { chaos });
    const stats = {};
    for (const pid of state.order) {
      const p = state.players[pid];
      stats[pid] = { team: p.team, teamScore: state.teams[p.team].score, hits: p.hits, pumps: p.pumps };
    }
    return { ranking, coins, stats };
  }

  return { init, step, getState, applyState, isFinished, getResults };
}

const REACT = { easy: 15, normal: 9, hard: 6, wild: 4 };
const AIM_ERR = { easy: 0.35, normal: 0.16, hard: 0.07, wild: 0.02 };

function bot(publicState, playerId, difficulty, rng) {
  const frame = emptyFrame();
  const s = publicState;
  const me = s?.players?.[playerId];
  if (!me || s.tick <= s.countdownTicks) return frame;

  const react = REACT[difficulty] ?? REACT.normal;
  const err = AIM_ERR[difficulty] ?? AIM_ERR.normal;
  const team = s.teams[me.team];
  const shooterIdx = s.rolePhase % 2;
  const iAmShooter = team.members[shooterIdx] === playerId;

  if (!iAmShooter) {
    // Loader: pump with paced fresh presses.
    if (!team.loaded && s.tick % react < Math.ceil(react / 2)) frame.a = true;
    return frame;
  }

  // Shooter: pick the highest-value target, lead it, and fire when lined up.
  let best = null;
  let bestV = -Infinity;
  for (const target of s.targets ?? []) {
    const v = target.value - Math.abs(target.x - team.x) * 0.05;
    if (v > bestV) {
      bestV = v;
      best = target;
    }
  }
  if (!best) return frame;

  const lead = best.dir * best.speed * (best.y / 14); // Rough flight-time lead.
  // Invert the projectile kinematics (x-rate=sin(a)*S, y-rate=cos(a)*S*0.55):
  // tan(desired) = 0.55 * dx / dy.
  const dy = Math.max(0.5, best.y - 1.2);
  const desired = Math.atan2(0.55 * ((best.x + lead) - team.x), dy)
    + (rng.next() - 0.5) * err * 2;
  const diff = desired - team.angle;
  frame.move.x = Math.max(-1, Math.min(1, diff * 6));
  if (team.loaded && Math.abs(diff) < 0.06 + err && s.tick % react === 0) frame.a = true;
  return frame;
}

export function register() {
  if (minigames.get(ID)) return minigames.get(ID);
  return defineMinigame({
    id: ID,
    name: { en: 'Banana Cannon Teams', de: 'Bananenkanonen-Teams' },
    description: {
      en: 'Load and fire your team\'s banana cannon at flying targets.',
      de: 'Ladet und feuert die Bananenkanone eures Teams auf fliegende Ziele.',
    },
    howTo: {
      en: 'Loader: pump A three times. Shooter: steer the cannon and press A to fire at targets. Roles swap every 15s!',
      de: 'Lader: dreimal A pumpen. Schuetze: Kanone ausrichten und mit A auf Ziele feuern. Rollen wechseln alle 15s!',
    },
    category: '2v2',
    tags: ['skill', 'aim'],
    players: { min: 4, max: 4 },
    durationSec: 45,
    competitiveSafe: true,
    params: { ...DEFAULTS },
    createSim,
    createView: (opts) => viewFactory(opts),
    bot,
  });
}

let viewFactory = () => ({ mount() {}, update() {}, dispose() {} });

export function attachView(factory) {
  if (typeof factory === 'function') viewFactory = factory;
}

export default register;
