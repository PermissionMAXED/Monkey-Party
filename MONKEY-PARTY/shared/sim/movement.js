/**
 * Step-wise movement along the board graph.
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 *
 * Movement walks BoardDef.nodes one step at a time via next[]:
 *  - junctions (more than one unblocked next) pause with awaiting 'junction'
 *  - entering the star node with enough coins pauses with awaiting 'buyStar'
 *    (at the onStarPrice-hooked price)
 *  - passing a shop node pauses with awaiting 'shop'
 *  - blocked nodes are never entered; when every next node is blocked the
 *    player lands where they stand (remaining steps are lost)
 *  - placed traps trigger on pass or land and may cancel the move
 *    (e.g. banana_peel skids the victim and ends their movement)
 */

import { bumpStat } from './stats.js';
import { runHook } from './effects.js';
import { triggerPlacedTrap } from './fields.js';

/**
 * @param {Object} board BoardDef.
 * @param {string} id
 * @returns {Object} BoardNode (throws when unknown - boards are static data).
 */
export function nodeById(board, id) {
  const node = board.nodes.find((n) => n.id === id);
  if (!node) throw new Error(`[sim] unknown board node "${id}"`);
  return node;
}

/**
 * Unblocked next-node ids from a node.
 * @param {Object} sim
 * @param {string} nodeId
 * @returns {string[]}
 */
export function openNextIds(sim, nodeId) {
  const node = nodeById(sim.board, nodeId);
  return (node.next ?? []).filter((id) => !sim.state.board.blockedNodes.includes(id));
}

/**
 * Breadth-first forward walk. Returns reachable node ids with their depth
 * (1..maxDepth), in deterministic BFS order.
 *
 * @param {Object} board BoardDef.
 * @param {string} fromId
 * @param {number} maxDepth
 * @returns {{id: string, depth: number}[]}
 */
export function forwardTargets(board, fromId, maxDepth) {
  const out = [];
  const seen = new Set([fromId]);
  let frontier = [fromId];
  for (let depth = 1; depth <= maxDepth; depth += 1) {
    const nextFrontier = [];
    for (const id of frontier) {
      for (const nid of nodeById(board, id).next ?? []) {
        if (seen.has(nid)) continue;
        seen.add(nid);
        out.push({ id: nid, depth });
        nextFrontier.push(nid);
      }
    }
    frontier = nextFrontier;
    if (frontier.length === 0) break;
  }
  return out;
}

/**
 * Forward BFS distance from one node to another.
 *
 * @param {Object} board BoardDef.
 * @param {string} fromId
 * @param {string} targetId
 * @param {number} [maxDepth]
 * @returns {number} Steps, or Infinity when unreachable within maxDepth.
 */
export function distanceToNode(board, fromId, targetId, maxDepth = 64) {
  if (fromId === targetId) return 0;
  for (const { id, depth } of forwardTargets(board, fromId, maxDepth)) {
    if (id === targetId) return depth;
  }
  return Infinity;
}

/**
 * Deterministic predecessors of a node (nodes listing it in next[]),
 * sorted by id.
 * @param {Object} board BoardDef.
 * @param {string} nodeId
 * @returns {string[]}
 */
export function predecessorIds(board, nodeId) {
  return board.nodes.filter((n) => (n.next ?? []).includes(nodeId)).map((n) => n.id).sort();
}

/* ------------------------------------------------------------------ */
/* The walk                                                            */
/* ------------------------------------------------------------------ */

/**
 * Start a move of `total` steps (after the onMoveSteps hook chain, e.g.
 * turbo_banana +4) and walk until landing or an awaiting pause.
 *
 * @param {Object} sim
 * @param {string} pid
 * @param {number} total Raw step total from the dice.
 */
export function beginMove(sim, pid, total) {
  const hooked = runHook(sim, 'onMoveSteps', pid, total, {});
  sim.internal.moveSteps = Math.max(0, Math.trunc(Number(hooked) || 0));
  continueMove(sim);
}

/**
 * Walk steps until the player lands, or an awaiting decision pauses the
 * move (junction / buyStar / shop). Safe to call again after the decision
 * resolves.
 *
 * @param {Object} sim
 */
export function continueMove(sim) {
  const pid = sim.currentPlayerId();
  const player = sim.state.players[pid];
  for (;;) {
    if (sim.internal.moveSteps <= 0) {
      sim.land();
      return;
    }
    const options = openNextIds(sim, player.node);
    if (options.length === 0) {
      // Dead end or everything ahead is blocked: land here.
      sim.emit('move_step', { kind: 'blocked', playerId: pid, node: player.node, stepsLost: sim.internal.moveSteps });
      sim.internal.moveSteps = 0;
      sim.land();
      return;
    }
    if (options.length > 1) {
      sim.setAwaiting({ playerId: pid, decision: 'junction', options }, 'move');
      return;
    }
    if (performStep(sim, pid, options[0]) !== 'continue') return;
  }
}

/**
 * Advance the player one node and run the entry triggers (pass hooks, placed
 * traps, star prompt, shop prompt).
 *
 * @param {Object} sim
 * @param {string} pid
 * @param {string} toId Node being entered (must be a legal next node).
 * @returns {'continue'|'paused'|'landed'}
 */
export function performStep(sim, pid, toId) {
  const player = sim.state.players[pid];
  const from = player.node;
  sim.internal.moveSteps -= 1;
  player.node = toId;
  player.facingNext = openNextIds(sim, toId)[0] ?? nodeById(sim.board, toId).next?.[0] ?? null;
  bumpStat(sim, pid, 'fieldsMoved');
  sim.emit('move_step', { playerId: pid, from, to: toId, stepsLeft: sim.internal.moveSteps });
  runHook(sim, 'onPassNode', pid, null, { node: toId, stepsLeft: sim.internal.moveSteps });

  // Placed item traps spring on pass AND land.
  const trap = triggerPlacedTrap(sim, pid, toId);
  if (trap.cancelMove) {
    sim.internal.moveSteps = 0;
    sim.land();
    return 'landed';
  }

  // Star purchase prompt (pass or land) at the hooked star price.
  if (toId === sim.state.board.starNode) {
    const price = sim.starPriceFor(pid);
    if (player.coins >= price) {
      sim.setAwaiting({ playerId: pid, decision: 'buyStar', options: { price, node: toId } }, 'move');
      return 'paused';
    }
    sim.emit('star', { kind: 'passed', playerId: pid, node: toId, price });
  }

  // Shop prompt when passing (landing opens the shop in the field phase).
  const node = nodeById(sim.board, toId);
  if (node.type === 'shop' && sim.internal.moveSteps > 0 && sim.state.rules.items !== 'off') {
    if (sim.openShop(pid, toId, 'move')) return 'paused';
  }

  return 'continue';
}

/* ------------------------------------------------------------------ */
/* Forced relocations (items)                                          */
/* ------------------------------------------------------------------ */

/**
 * Slide a player forward without any entry triggers (banana_peel skid).
 * Follows the first unblocked next each step.
 *
 * @param {Object} sim
 * @param {string} pid
 * @param {number} steps
 * @returns {string} Final node id.
 */
export function slidePlayer(sim, pid, steps) {
  const player = sim.state.players[pid];
  for (let i = 0; i < steps; i += 1) {
    const options = openNextIds(sim, player.node);
    if (options.length === 0) break;
    const to = options[0];
    sim.emit('move_step', { kind: 'slide', playerId: pid, from: player.node, to });
    player.node = to;
  }
  player.facingNext = openNextIds(sim, player.node)[0] ?? null;
  return player.node;
}

/**
 * Push a player backwards along the graph (mini_gorilla). Uses the
 * deterministic first predecessor at each step; no entry triggers.
 *
 * @param {Object} sim
 * @param {string} pid
 * @param {number} steps
 * @returns {string} Final node id.
 */
export function pushBack(sim, pid, steps) {
  const player = sim.state.players[pid];
  for (let i = 0; i < steps; i += 1) {
    const preds = predecessorIds(sim.board, player.node)
      .filter((id) => !sim.state.board.blockedNodes.includes(id));
    if (preds.length === 0) break;
    const to = preds[0];
    sim.emit('move_step', { kind: 'pushback', playerId: pid, from: player.node, to });
    player.node = to;
  }
  player.facingNext = openNextIds(sim, player.node)[0] ?? null;
  return player.node;
}
