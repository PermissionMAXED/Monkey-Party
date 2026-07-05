/**
 * Board-decision bot: picks an Action for any awaiting state.
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 *
 * decideBoardAction(state, legalActions, playerId, difficulty, rng) scores
 * every legal action with utility heuristics (path progress toward the
 * star, shop desire, hazard avoidance, item value) and returns one of the
 * given legal actions - ALWAYS, for every possible awaiting state. The
 * difficulty profile adds seeded decision noise and occasional random picks
 * among the top-K actions (easy = 35% among top-3, hard = near-optimal,
 * wild = erratic chaos-monkey; see shared/ai/difficulty.js).
 *
 * Scoring note: plain 'roll' scores a flat 10, so situationally-STRONG item
 * plays must score above 10 (12 for star-race boosters and leader curses,
 * 11 for traps aimed at high-traffic nodes) or low-noise bots would never
 * use items at all.
 */

import { createRng } from '../rng.js';
import { boards } from '../registries.js';
import { distanceToNode, forwardTargets, nodeById, predecessorIds } from '../sim/movement.js';
import { legalActionsFromState } from '../sim/actions.js';
import { getDifficultyProfile, jitterScore } from './difficulty.js';

/* ------------------------------------------------------------------ */
/* Board reading helpers                                               */
/* ------------------------------------------------------------------ */

function boardOf(state) {
  return boards.get(state.boardId) ?? null;
}

function distToStar(board, state, fromId, maxDepth) {
  if (!board || !state.board.starNode) return Infinity;
  return distanceToNode(board, fromId, state.board.starNode, maxDepth);
}

/** Reds + other players' traps + blocked nodes reachable within `depth`. */
function hazardScore(board, state, pid, fromId, depth) {
  if (!board) return 0;
  let hazards = 0;
  for (const { id } of forwardTargets(board, fromId, depth)) {
    const node = nodeById(board, id);
    if (node.type === 'red' || node.type === 'trap' || node.type === 'boss') hazards += 1;
    const trap = state.board.traps[id];
    if (trap && trap.ownerId !== pid) hazards += 2;
  }
  return hazards;
}

/** Nice-to-visit fields (shops, item fields) reachable within `depth`. */
function goodieScore(board, state, pid, fromId, depth) {
  if (!board) return 0;
  const me = state.players[pid];
  let goodies = 0;
  for (const { id } of forwardTargets(board, fromId, depth)) {
    const node = nodeById(board, id);
    if (node.type === 'item' && me.items.length < 3) goodies += 1;
    if (node.type === 'shop' && me.items.length < 3 && me.coins >= 8) goodies += 1;
    if (node.type === 'blue') goodies += 0.25;
  }
  return goodies;
}

/** How many edges feed into a node - proxy for foot traffic (trap placement). */
function trafficScore(board, nodeId) {
  return board ? predecessorIds(board, nodeId).length : 0;
}

/** The current leader (bananas desc, coins desc), excluding `pid`. */
function leaderId(state, pid) {
  let best = null;
  for (const other of state.turnOrder) {
    if (other === pid) continue;
    const p = state.players[other];
    const b = best ? state.players[best] : null;
    if (!b || p.goldenBananas > b.goldenBananas
      || (p.goldenBananas === b.goldenBananas && p.coins > b.coins)) {
      best = other;
    }
  }
  return best;
}

/** The richest other player. */
function richestId(state, pid) {
  let best = null;
  for (const other of state.turnOrder) {
    if (other === pid) continue;
    if (best === null || state.players[other].coins > state.players[best].coins) best = other;
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Item heuristics                                                     */
/* ------------------------------------------------------------------ */

function itemUseScore(state, board, pid, itemId, profile) {
  const me = state.players[pid];
  const dist = distToStar(board, state, me.node, profile.lookahead * 2);
  const canAffordStar = me.coins >= state.rules.starPrice;
  const leader = leaderId(state, pid);
  const richest = richestId(state, pid);

  switch (itemId) {
    case 'golden_ticket':
      return canAffordStar ? 100 : 1;
    case 'double_dice':
    case 'turbo_banana':
      // Decisive when the star is affordable AND within a boosted roll's
      // reach this turn (>10 so it beats a plain roll); merely nice when
      // the star is further out.
      if (canAffordStar && Number.isFinite(dist) && dist > 6 && dist <= 12) return 12;
      return canAffordStar && dist > 6 ? 9 : 5;
    case 'lucky_mask':
      return 6;
    case 'dice_curse':
      // Hexing the banana leader is a top play (>10 beats a plain roll).
      return leader && state.players[leader].goldenBananas >= me.goldenBananas ? 12 : 4;
    case 'ghost_banana':
      return richest && state.players[richest].coins >= 10 ? 9 : 3;
    case 'swap_totem': {
      if (!leader) return 2;
      const theirDist = distToStar(board, state, state.players[leader].node, profile.lookahead * 2);
      return Number.isFinite(theirDist) && theirDist + 3 < dist && canAffordStar ? 12 : 2;
    }
    case 'mini_gorilla': {
      if (!leader) return 2;
      const theirDist = distToStar(board, state, state.players[leader].node, profile.lookahead * 2);
      return Number.isFinite(theirDist) && theirDist <= 6 ? 8 : 3;
    }
    case 'coconut_trap':
    case 'banana_peel': {
      // Worth the turn when a high-traffic node (>=2 inbound edges) is in
      // placement range; otherwise a modest hold.
      const hot = board && forwardTargets(board, me.node, 5)
        .some(({ id }) => trafficScore(board, id) >= 2);
      return hot ? 11 : 6;
    }
    case 'chaos_box':
      // Gambling appeals less the smarter the bot is.
      return profile.randomChance > 0.2 ? 6 : 3;
    case 'shop_coupon':
    case 'shield_shell':
    case 'magnet_banana':
      return 0; // passive - not actively usable anyway
    default:
      return 3;
  }
}

function shopBuyScore(state, board, pid, itemId, price, profile) {
  const me = state.players[pid];
  const dist = distToStar(board, state, me.node, profile.lookahead * 2);
  const base = {
    golden_ticket: me.coins >= state.rules.starPrice + price ? 14 : 2,
    shield_shell: 8,
    double_dice: 7,
    lucky_mask: 6,
    turbo_banana: 6,
    magnet_banana: 6,
    swap_totem: 5,
    ghost_banana: 5,
    dice_curse: 5,
    mini_gorilla: 5,
    coconut_trap: 4,
    banana_peel: 4,
    shop_coupon: 4,
    chaos_box: 3,
  }[itemId] ?? 4;
  // Keep a reserve when the star is nearby and almost affordable.
  const reserve = Number.isFinite(dist) && dist <= profile.lookahead ? state.rules.starPrice : 5;
  const affordabilityPenalty = me.coins - price < reserve ? 6 : 0;
  return base - price * 0.15 - affordabilityPenalty;
}

function itemTargetScore(state, board, pid, itemId, target, profile) {
  const leader = leaderId(state, pid);
  const richest = richestId(state, pid);
  switch (itemId) {
    case 'dice_curse':
    case 'mini_gorilla':
      return target === leader ? 10 : 2;
    case 'ghost_banana':
      return target === richest ? 10 : state.players[target] ? state.players[target].coins * 0.2 : 0;
    case 'swap_totem': {
      const p = state.players[target];
      if (!p) return 0;
      const myDist = distToStar(board, state, state.players[pid].node, profile.lookahead * 2);
      const theirDist = distToStar(board, state, p.node, profile.lookahead * 2);
      return Number.isFinite(theirDist) && theirDist < myDist ? 10 + (myDist - theirDist) : 1;
    }
    case 'coconut_trap':
    case 'banana_peel':
      // High-traffic nodes catch the most monkeys.
      return trafficScore(board, target) * 3 + 1;
    default:
      return 1;
  }
}

/* ------------------------------------------------------------------ */
/* Action scoring                                                      */
/* ------------------------------------------------------------------ */

function scoreAction(state, board, action, pid, profile) {
  const me = state.players[pid];
  switch (action.type) {
    case 'roll':
      return 10;
    case 'skipItem':
      return 5;
    case 'useItem':
      return itemUseScore(state, board, pid, action.payload.itemId, profile);
    case 'junction': {
      const choice = action.payload.choice;
      const dist = distToStar(board, state, choice, profile.lookahead * 4);
      const canAffordStar = me.coins >= state.rules.starPrice;
      const starPull = Number.isFinite(dist)
        ? (canAffordStar ? 30 : 12) - dist * (canAffordStar ? 1.5 : 0.5)
        : 0;
      const goodies = goodieScore(board, state, pid, choice, profile.lookahead);
      const hazards = hazardScore(board, state, pid, choice, profile.lookahead);
      return starPull + goodies * 1.5 - hazards * 2;
    }
    case 'buyStar':
      return 1000; // always buy the star when affordable
    case 'declineStar':
      return 0;
    case 'shopBuy':
      return shopBuyScore(state, board, pid, action.payload.itemId,
        priceOf(state, action.payload.itemId), profile);
    case 'shopLeave':
      return 4;
    case 'dicePick': {
      const value = action.payload.value;
      const dist = distToStar(board, state, me.node, profile.lookahead * 2);
      const exactStar = me.coins >= state.rules.starPrice && dist === value ? 8 : 0;
      return value + exactStar;
    }
    case 'itemTarget':
      return itemTargetScore(state, board, pid, state.awaiting?.itemId, action.payload.target, profile);
    case 'minigameResults':
      return 1;
    default:
      return 0;
  }
}

function priceOf(state, itemId) {
  const stock = state.awaiting?.options?.stock ?? [];
  return stock.find((s) => s.id === itemId)?.price ?? 10;
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Pick an Action for `playerId` out of `legalActions`.
 *
 * @param {import('../types.js').MatchState} state Public match state.
 * @param {import('../types.js').Action[]} legalActions From sim.legalActions(pid).
 * @param {string} playerId
 * @param {'easy'|'normal'|'hard'|'wild'} [difficulty]
 * @param {Object} [rng] Seeded RNG; when omitted one is derived from state.rngState.
 * @returns {import('../types.js').Action|null} One of legalActions (null only
 *   when legalActions is empty).
 */
export function decideBoardAction(state, legalActions, playerId, difficulty = 'normal', rng) {
  if (!Array.isArray(legalActions) || legalActions.length === 0) return null;
  const r = rng ?? createRng((state?.rngState ?? state?.seed ?? 0) >>> 0);
  const profile = getDifficultyProfile(difficulty);
  const board = boardOf(state);

  let scored;
  try {
    scored = legalActions.map((action, index) => ({
      action,
      index,
      score: jitterScore(scoreAction(state, board, action, playerId, profile), profile, r),
    }));
  } catch {
    return legalActions[0]; // heuristics must never break legality
  }
  scored.sort((a, b) => (b.score - a.score) || (a.index - b.index));

  if (profile.randomChance > 0 && r.next() < profile.randomChance) {
    const top = scored.slice(0, Math.min(profile.topK, scored.length));
    return r.pick(top).action;
  }
  return scored[0].action;
}

/**
 * Convenience adapter with the session-facing signature: derives the legal
 * actions from the public state, then defers to decideBoardAction.
 *
 * @param {import('../types.js').MatchState} state
 * @param {string} playerId
 * @param {'easy'|'normal'|'hard'|'wild'} [difficulty]
 * @param {Object} [rng]
 * @returns {import('../types.js').Action|null}
 */
export function decide(state, playerId, difficulty = 'normal', rng) {
  const legal = legalActionsFromState(state, playerId);
  return decideBoardAction(state, legal, playerId, difficulty, rng);
}

export default decide;
