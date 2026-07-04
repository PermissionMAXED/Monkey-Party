/**
 * Field resolution: dispatch by board node type when a player lands, plus
 * placed-trap triggering (on pass or land).
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 *
 * Node types (see BoardDef in shared/types.js):
 *   blue    +3 * rules.bananaMultiplier coins
 *   red     -3 coins
 *   item    rarity-weighted item grant ('off' item mode: +2 coins instead)
 *   event   board event handler (skipped when rules.randomEvents is false)
 *   boss    BoardDef.bossEvent.handler, or a default seeded coin loss
 *   shop    opens the shop (handled by the caller via openShop)
 *   trap    built-in board trap: seeded coin loss
 *   star / start / junction / special: neutral (star buying happens on pass)
 */

import { items as itemsRegistry } from '../registries.js';
import { addCoins } from './scoring.js';
import { bumpStat } from './stats.js';
import { runHook } from './effects.js';
import { pickRandomItemId, grantItem } from './shop.js';

/**
 * lastFieldColor value for a node type (used e.g. for minigame teams).
 * @param {string} nodeType
 * @returns {string}
 */
export function fieldColor(nodeType) {
  if (nodeType === 'blue' || nodeType === 'start') return 'blue';
  if (nodeType === 'red') return 'red';
  return 'neutral';
}

/**
 * Apply the landing effect of the node the player stopped on. May open a
 * shop (via sim.openShop -> sets awaiting); the caller must check
 * sim.state.awaiting afterwards.
 *
 * @param {Object} sim
 * @param {string} pid
 * @param {Object} node BoardNode.
 */
export function applyField(sim, pid, node) {
  const player = sim.state.players[pid];
  player.lastFieldColor = fieldColor(node.type);
  const multiplier = sim.state.rules.bananaMultiplier;
  sim.emit('field', { playerId: pid, node: node.id, fieldType: node.type });

  switch (node.type) {
    case 'blue':
      addCoins(sim, pid, 3 * multiplier, 'field_blue');
      break;
    case 'red':
      addCoins(sim, pid, -3, 'field_red');
      break;
    case 'item': {
      if (sim.state.rules.items === 'off') {
        addCoins(sim, pid, 2, 'field_item_off');
        break;
      }
      const itemId = pickRandomItemId(sim);
      if (itemId) grantItem(sim, pid, itemId, 'field');
      else addCoins(sim, pid, 2, 'field_item_empty');
      break;
    }
    case 'event': {
      if (!sim.state.rules.randomEvents) break;
      const eventDef = node.event ? sim.board.events?.[node.event] : null;
      bumpStat(sim, pid, 'eventsHit');
      if (eventDef?.handler) eventDef.handler(sim, pid, node.params);
      break;
    }
    case 'boss': {
      sim.emit('boss', { kind: 'field', playerId: pid, node: node.id });
      if (sim.board.bossEvent?.handler) {
        sim.board.bossEvent.handler(sim);
      } else {
        addCoins(sim, pid, -(sim.rng.int(1, 6) + 2), 'boss');
      }
      break;
    }
    case 'shop':
      sim.openShop(pid, node.id, 'field');
      break;
    case 'trap': {
      // A built-in board hazard (distinct from placed item traps).
      const blocked = runHook(sim, 'onTrapTriggered', pid, { cancelled: false }, { node: node.id, builtin: true });
      if (blocked?.cancelled || sim.tryBlockWithShield(pid, 'board_trap')) {
        sim.emit('trap', { playerId: pid, node: node.id, builtin: true, cancelled: true });
        break;
      }
      const loss = sim.rng.int(3, 8);
      sim.emit('trap', { playerId: pid, node: node.id, builtin: true, cancelled: false, coins: loss });
      addCoins(sim, pid, -loss, 'board_trap');
      break;
    }
    case 'special': {
      // Boards may wire specials to an event handler via node.event.
      const eventDef = node.event ? sim.board.events?.[node.event] : null;
      if (eventDef?.handler) {
        bumpStat(sim, pid, 'eventsHit');
        eventDef.handler(sim, pid, node.params);
      }
      break;
    }
    default:
      // start / star / junction: neutral on landing.
      break;
  }
}

/**
 * Trigger a placed item trap when `pid` enters `nodeId` (pass or land).
 * The trap owner never triggers their own trap. Shield/hook cancellation is
 * checked before the trap item's onTrigger runs. The trap is consumed either
 * way once sprung.
 *
 * @param {Object} sim
 * @param {string} pid The victim entering the node.
 * @param {string} nodeId
 * @returns {{triggered: boolean, cancelMove: boolean}}
 */
export function triggerPlacedTrap(sim, pid, nodeId) {
  const trap = sim.state.board.traps[nodeId];
  if (!trap || trap.ownerId === pid) return { triggered: false, cancelMove: false };

  delete sim.state.board.traps[nodeId];

  const chain = runHook(sim, 'onTrapTriggered', pid, { cancelled: false }, {
    node: nodeId,
    itemId: trap.itemId,
    ownerId: trap.ownerId,
    builtin: false,
  });
  if (chain?.cancelled || sim.tryBlockWithShield(pid, 'trap')) {
    sim.emit('trap', { playerId: pid, ownerId: trap.ownerId, itemId: trap.itemId, node: nodeId, cancelled: true });
    return { triggered: true, cancelMove: false };
  }

  sim.emit('trap', { playerId: pid, ownerId: trap.ownerId, itemId: trap.itemId, node: nodeId, cancelled: false });
  const def = itemsRegistry.get(trap.itemId);
  const out = typeof def?.onTrigger === 'function'
    ? def.onTrigger(sim, pid, trap.ownerId, nodeId) ?? {}
    : {};
  return { triggered: true, cancelMove: !!out.cancelMove };
}
