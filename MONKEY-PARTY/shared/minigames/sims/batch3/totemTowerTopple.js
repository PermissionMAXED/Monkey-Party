/**
 * Totem Tower Topple - duel of nerves, exactly 2 players, 60s.
 *
 * An ancient totem tower of stacked stone blocks. The players take turns
 * yanking one block out (steer the highlight with left/right, confirm
 * with A - dawdle and the timer yanks your pick for you). Every block
 * secretly weighs on the tower's stability; carved glyphs hint at the
 * risk but sometimes lie. Whoever makes the totem topple loses.
 *
 * Hidden block weights = push-your-luck, so competitiveSafe is false.
 *
 * Pure ESM sim. No DOM, no three.js, no Math.random, no Date.now.
 * Fixed 30Hz steps; all randomness through shared/rng.js (tower at init).
 */

import { createRng } from '../../../rng.js';
import { clampFrame, emptyFrame } from '../../inputs.js';
import {
  defineMinigame, rankByScoreGrouped, coinsForRanking, MINIGAME_HZ, COUNTDOWN_TICKS,
} from '../../framework.js';
import { minigames } from '../../../registries.js';

const ID = 'totem_tower_topple';

const DEFAULTS = {
  layers: 8,
  slotsPerLayer: 3,
  turnTicks: 90, // 3s to pick, then the timer pulls for you.
  threshold: 13, // Instability that topples the totem.
  weightMin: 0.8,
  weightSpan: 1.8, // Weight in [weightMin, weightMin + weightSpan].
  hintLiePct: 25, // Chance a glyph shows the neighboring risk tier.
  depthFactor: 0.1, // Lower layers are riskier to disturb.
  lastInLayerPenalty: 2.0, // Emptying a layer really rocks the totem.
  secondInLayerPenalty: 0.9,
};

function createSim({ seed, players, params = {}, rules = {} } = {}) {
  const cfg = { ...DEFAULTS, ...params };
  const rng = createRng(seed ?? 0);
  const pids = (players ?? []).slice();
  const durationTicks = 60 * MINIGAME_HZ;
  const chaos = Boolean(rules.chaosMode);

  let state = null;

  function tierOf(weight) {
    if (weight < cfg.weightMin + cfg.weightSpan / 3) return 1;
    if (weight < cfg.weightMin + (2 * cfg.weightSpan) / 3) return 2;
    return 3;
  }

  function init() {
    rng.setState(Number(seed ?? 0) >>> 0);
    const blocks = [];
    for (let layer = 0; layer < cfg.layers; layer += 1) {
      for (let slot = 0; slot < cfg.slotsPerLayer; slot += 1) {
        const weight = Math.round((cfg.weightMin + rng.next() * cfg.weightSpan) * 100) / 100;
        const tier = tierOf(weight);
        let hint = tier;
        if (rng.int(0, 99) < cfg.hintLiePct) {
          hint = Math.max(1, Math.min(3, tier + (rng.next() < 0.5 ? -1 : 1)));
        }
        blocks.push({
          id: layer * cfg.slotsPerLayer + slot,
          layer,
          slot,
          weight,
          hint, // Public glyph tier 1..3 (mostly honest).
          removed: false,
        });
      }
    }
    const ps = {};
    pids.forEach((pid, i) => {
      ps[pid] = {
        slot: i,
        score: 0, // Blocks pulled (HUD chip).
        added: 0, // Instability personally added.
        prevA: false,
        prevX: 0,
      };
    });
    state = {
      id: ID,
      tick: 0,
      durationTicks,
      countdownTicks: COUNTDOWN_TICKS,
      finished: false,
      layers: cfg.layers,
      slotsPerLayer: cfg.slotsPerLayer,
      threshold: cfg.threshold,
      blocks,
      candidates: [], // Selectable block ids, refreshed after each pull.
      instability: 0,
      turn: 0, // Index into order.
      turnStartTick: COUNTDOWN_TICKS,
      turnTicks: cfg.turnTicks,
      cursor: 0, // Highlight index into candidates.
      pulls: 0,
      lastPull: null, // { id, by, eff, tick } for view feedback.
      topplerSlot: -1,
      players: ps,
      order: pids.slice(),
      rngState: rng.state(),
    };
    refreshCandidates();
  }

  function refreshCandidates() {
    let topLayer = -1;
    for (const b of state.blocks) {
      if (!b.removed && b.layer > topLayer) topLayer = b.layer;
    }
    let ids = state.blocks
      .filter((b) => !b.removed && b.layer < topLayer)
      .map((b) => b.id);
    if (ids.length === 0) {
      ids = state.blocks.filter((b) => !b.removed).map((b) => b.id);
    }
    state.candidates = ids;
    state.cursor = 0;
  }

  function pull(blockId, t) {
    const block = state.blocks[blockId];
    if (!block || block.removed) return;
    block.removed = true;
    const remainingInLayer = state.blocks
      .filter((b) => b.layer === block.layer && !b.removed).length;
    let eff = block.weight * (1 + (cfg.layers - 1 - block.layer) * cfg.depthFactor);
    if (remainingInLayer === 0) eff += cfg.lastInLayerPenalty;
    else if (remainingInLayer === 1) eff += cfg.secondInLayerPenalty;
    eff = Math.round(eff * 100) / 100;

    const pid = state.order[state.turn];
    const p = state.players[pid];
    p.score += 1;
    p.added = Math.round((p.added + eff) * 100) / 100;
    state.instability = Math.round((state.instability + eff) * 100) / 100;
    state.pulls += 1;
    state.lastPull = { id: blockId, by: pid, eff, tick: t };

    if (state.instability >= state.threshold) {
      state.topplerSlot = state.turn;
      state.finished = true;
      return;
    }
    state.turn = (state.turn + 1) % state.order.length;
    state.turnStartTick = t;
    refreshCandidates();
  }

  function step(inputsMap = {}) {
    if (state.finished) return;
    state.tick += 1;
    const t = state.tick;
    const playing = t > state.countdownTicks;

    if (playing && state.candidates.length > 0) {
      const activePid = state.order[state.turn];
      const p = state.players[activePid];
      const frame = clampFrame(inputsMap[activePid] ?? emptyFrame());

      // Cycle the highlighted block with fresh left/right pushes.
      const x = frame.move.x;
      if (x > 0.5 && p.prevX <= 0.5) {
        state.cursor = (state.cursor + 1) % state.candidates.length;
      } else if (x < -0.5 && p.prevX >= -0.5) {
        state.cursor = (state.cursor - 1 + state.candidates.length) % state.candidates.length;
      }
      p.prevX = x;

      const edgeA = frame.a && !p.prevA;
      p.prevA = frame.a;
      const timedOut = t - state.turnStartTick >= state.turnTicks;
      if (edgeA || timedOut) {
        pull(state.candidates[state.cursor], t);
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
      if (state.topplerSlot >= 0) {
        scores[pid] = state.order[state.topplerSlot] === pid ? 0 : 1000;
      } else {
        // Timer ran out: steadier hands (less added instability) win.
        scores[pid] = Math.round((1000 - p.added) * 100) / 100;
      }
    }
    const ranking = rankByScoreGrouped(scores);
    const coins = coinsForRanking(ranking, { chaos });
    const stats = {};
    for (const pid of state.order) {
      const p = state.players[pid];
      stats[pid] = {
        pulls: p.score,
        instabilityAdded: p.added,
        toppled: state.topplerSlot >= 0 && state.order[state.topplerSlot] === pid,
      };
    }
    return { ranking, coins, stats };
  }

  return { init, step, getState, applyState, isFinished, getResults };
}

const THINK = { easy: 45, normal: 32, hard: 22, wild: 14 };
const BLUNDER_PCT = { easy: 45, normal: 20, hard: 8, wild: 2 };

function ihash(a, b) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

function bot(publicState, playerId, difficulty, _rng) {
  const frame = emptyFrame();
  const s = publicState;
  const me = s?.players?.[playerId];
  if (!me || s.tick <= s.countdownTicks || s.finished) return frame;
  if (s.order[s.turn] !== playerId) return frame;
  if (!Array.isArray(s.candidates) || s.candidates.length === 0) return frame;

  const think = THINK[difficulty] ?? THINK.normal;
  const elapsed = s.tick - s.turnStartTick;
  if (elapsed < think) return frame;

  // Score every candidate by its public glyph + structural common sense.
  let bestIdx = 0;
  let bestCost = Infinity;
  for (let i = 0; i < s.candidates.length; i += 1) {
    const b = s.blocks[s.candidates[i]];
    if (!b) continue;
    const remaining = s.blocks
      .filter((o) => o.layer === b.layer && !o.removed).length;
    let cost = b.hint + (s.layers - 1 - b.layer) * 0.1;
    if (remaining <= 1) cost += 2;
    else if (remaining === 2) cost += 0.9;
    if (cost < bestCost) {
      bestCost = cost;
      bestIdx = i;
    }
  }
  // Sloppier monkeys sometimes just grab whatever is shiny.
  const salt = s.pulls * 131 + me.slot * 17;
  if (ihash(salt, 9) % 100 < (BLUNDER_PCT[difficulty] ?? BLUNDER_PCT.normal)) {
    bestIdx = ihash(salt, 23) % s.candidates.length;
  }

  if (s.cursor !== bestIdx) {
    // Pulse right in fresh pushes; the cursor wraps around to any target.
    frame.move.x = elapsed % 4 < 2 ? 1 : 0;
    return frame;
  }
  if (elapsed % 4 < 2) frame.a = true;
  return frame;
}

export function register() {
  if (minigames.get(ID)) return minigames.get(ID);
  return defineMinigame({
    id: ID,
    name: { en: 'Totem Tower Topple', de: 'Totem-Turm-Sturz' },
    description: {
      en: 'Take turns yanking blocks from the ancient totem - whoever topples it loses.',
      de: 'Zieht abwechselnd Bloecke aus dem alten Totem - wer ihn umstuerzt, verliert.',
    },
    howTo: {
      en: 'On your turn, steer the highlight with left/right and pull the block with A (the timer pulls for you if you stall). Glyphs hint how heavy a block sits - but they sometimes lie. Don\'t be the one who topples the totem!',
      de: 'Bist du dran, waehle mit links/rechts einen Block und zieh ihn mit A (bei Zoegern zieht der Timer fuer dich). Glyphen deuten an, wie schwer ein Block traegt - aber manchmal luegen sie. Sei nicht der, der das Totem umstuerzt!',
    },
    category: 'duel',
    tags: ['nerves', 'luck', 'turns'],
    players: { min: 2, max: 2 },
    durationSec: 60,
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
