/**
 * Action shape validation + legal-action enumeration.
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 *
 * legalActionsFromState() is a pure function of the (public) MatchState:
 * every option a decision needs is embedded in state.awaiting.options, so
 * bots and remote clients can enumerate without the board def or the sim.
 */

import { ACTION_TYPES } from '../constants.js';

/**
 * Throw when the value is not a structurally valid Action.
 * @param {*} action
 * @returns {import('../types.js').Action}
 */
export function assertActionShape(action) {
  if (action === null || typeof action !== 'object') {
    throw new Error('[sim] apply(): action must be an object');
  }
  if (!ACTION_TYPES.includes(action.type)) {
    throw new Error(`[sim] apply(): unknown action type "${action.type}"`);
  }
  if (typeof action.playerId !== 'string' || action.playerId.length === 0) {
    throw new Error('[sim] apply(): action.playerId must be a non-empty string');
  }
  if (action.payload !== undefined && (action.payload === null || typeof action.payload !== 'object')) {
    throw new Error('[sim] apply(): action.payload must be an object when present');
  }
  return action;
}

/**
 * Enumerate every legal Action for a player given the current public state.
 * Returns [] when it is not this player's decision. 'emote' is always
 * accepted by apply() but intentionally not enumerated (it is not a
 * decision).
 *
 * @param {import('../types.js').MatchState} state
 * @param {string} pid
 * @returns {import('../types.js').Action[]}
 */
export function legalActionsFromState(state, pid) {
  if (!state || state.phase === 'game_over' || !state.players?.[pid]) return [];

  // Minigame results are reported by any participant once the sim is
  // blocked in the minigame phase.
  if (state.phase === 'minigame') {
    return [{ type: 'minigameResults', playerId: pid, payload: {} }];
  }

  const awaiting = state.awaiting;
  if (!awaiting || awaiting.playerId !== pid) return [];

  switch (awaiting.decision) {
    case 'roll': {
      const actions = [];
      const usable = awaiting.options?.usableItems ?? [];
      for (const itemId of usable) {
        actions.push({ type: 'useItem', playerId: pid, payload: { itemId } });
      }
      if (usable.length > 0) actions.push({ type: 'skipItem', playerId: pid, payload: {} });
      actions.push({ type: 'roll', playerId: pid, payload: {} });
      return actions;
    }
    case 'junction':
      return (awaiting.options ?? []).map((choice) => ({
        type: 'junction', playerId: pid, payload: { choice },
      }));
    case 'buyStar':
      return [
        { type: 'buyStar', playerId: pid, payload: {} },
        { type: 'declineStar', playerId: pid, payload: {} },
      ];
    case 'shop': {
      const player = state.players[pid];
      const actions = [];
      for (const entry of awaiting.options?.stock ?? []) {
        if (player.coins >= entry.price && player.items.length < 3) {
          actions.push({ type: 'shopBuy', playerId: pid, payload: { itemId: entry.id } });
        }
      }
      actions.push({ type: 'shopLeave', playerId: pid, payload: {} });
      return actions;
    }
    case 'itemTarget': {
      const actions = (awaiting.options ?? []).map((target) => ({
        type: 'itemTarget', playerId: pid, payload: { target },
      }));
      // Cancelling back out of targeting is always allowed.
      actions.push({ type: 'skipItem', playerId: pid, payload: {} });
      return actions;
    }
    case 'dicePick':
      return (awaiting.options ?? []).map((value, index) => ({
        type: 'dicePick', playerId: pid, payload: { index, value },
      }));
    default:
      return [];
  }
}
