/**
 * Dice rolling through the hook chain, plus the competitive dice draft.
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 *
 * Flow: base pool {count:1, sides:6, bonus:0} -> onDicePool hooks (e.g.
 * double_dice sets count:2, dice_curse sets sides:3) -> roll -> onDiceRoll
 * hooks (e.g. lucky_mask rerolls once and keeps the better total).
 *
 * Competitive matches use a dice draft instead of a plain roll: three values
 * are drawn up front and the player picks one (awaiting 'dicePick'). The
 * picked value still runs through the onDiceRoll chain; pool count is
 * ignored in draft mode (the draft always draws exactly 3 singles).
 */

import { runHook } from './effects.js';

/**
 * Build the dice pool for a player through the onDicePool chain, then
 * sanitize it so hooks can't produce a degenerate pool.
 *
 * @param {Object} sim
 * @param {string} pid
 * @returns {{count: number, sides: number, bonus: number}}
 */
export function buildDicePool(sim, pid) {
  const base = { count: 1, sides: 6, bonus: 0 };
  const pool = runHook(sim, 'onDicePool', pid, base, {}) ?? base;
  return {
    count: Math.min(4, Math.max(1, Math.trunc(Number(pool.count) || 1))),
    sides: Math.min(20, Math.max(1, Math.trunc(Number(pool.sides) || 6))),
    bonus: Math.trunc(Number(pool.bonus) || 0),
  };
}

/**
 * Roll the dice for a player, run the onDiceRoll chain, emit the 'dice'
 * event and return the final step total.
 *
 * @param {Object} sim
 * @param {string} pid
 * @returns {number} Final step total (>= 0).
 */
export function rollDice(sim, pid) {
  const pool = buildDicePool(sim, pid);
  const values = [];
  for (let i = 0; i < pool.count; i += 1) values.push(sim.rng.int(1, pool.sides));
  let roll = {
    values,
    total: values.reduce((a, b) => a + b, 0) + pool.bonus,
    sides: pool.sides,
    count: pool.count,
    rerolled: false,
  };
  roll = runHook(sim, 'onDiceRoll', pid, roll, { pool }) ?? roll;
  const total = Math.max(0, Math.trunc(roll.total));
  sim.emit('dice', {
    playerId: pid,
    values: roll.values,
    total,
    sides: roll.sides,
    count: roll.count,
    rerolled: !!roll.rerolled,
    draft: false,
  });
  return total;
}

/**
 * Competitive dice draft: draw 3 candidate values (using the hooked pool's
 * sides, so dice_curse still bites in competitive).
 *
 * @param {Object} sim
 * @param {string} pid
 * @returns {number[]} Exactly 3 drawn values.
 */
export function drawDiceDraft(sim, pid) {
  const pool = buildDicePool(sim, pid);
  return [sim.rng.int(1, pool.sides), sim.rng.int(1, pool.sides), sim.rng.int(1, pool.sides)];
}

/**
 * Resolve the player's dice-draft pick through the onDiceRoll chain, emit
 * the 'dice' event, return the final step total.
 *
 * @param {Object} sim
 * @param {string} pid
 * @param {number} value The picked draft value.
 * @returns {number}
 */
export function resolveDraftPick(sim, pid, value) {
  const pool = buildDicePool(sim, pid);
  let roll = {
    values: [value],
    total: value + pool.bonus,
    sides: pool.sides,
    count: 1,
    rerolled: false,
  };
  roll = runHook(sim, 'onDiceRoll', pid, roll, { pool }) ?? roll;
  const total = Math.max(0, Math.trunc(roll.total));
  sim.emit('dice', {
    playerId: pid,
    values: roll.values,
    total,
    sides: roll.sides,
    count: roll.count,
    rerolled: !!roll.rerolled,
    draft: true,
  });
  return total;
}
