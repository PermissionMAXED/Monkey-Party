/**
 * Shops + the item economy (stock, hooked prices, buy validation, grants).
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 */

import { items as itemsRegistry } from '../registries.js';
import { runHook } from './effects.js';
import { addCoins } from './scoring.js';

/** Maximum items a player may hold. */
export const ITEM_CAP = 3;

/** Rarity weights for random item grants (item fields, ghost steals, ...). */
export const RARITY_WEIGHTS = { common: 0.7, rare: 0.25, epic: 0.05 };

/**
 * Is this item def allowed under the current rules?
 * @param {Object} sim
 * @param {Object} def ItemDef
 * @returns {boolean}
 */
export function itemAllowed(sim, def) {
  if (!def) return false;
  const { rules } = sim.state;
  if (rules.items === 'off') return false;
  if (rules.competitive && !def.competitiveSafe) return false;
  if (def.phase === 'trapPlace' && !rules.traps) return false;
  return true;
}

/**
 * The current stock of the shop at `nodeId`, priced for `pid` through the
 * onShopPrice hook chain (character perks, shop_coupon, ...).
 *
 * Stock = BoardDef.shops entry + MatchState.board.shopStockOverrides[nodeId].
 * Items not allowed under the rules are filtered out.
 *
 * @param {Object} sim
 * @param {string} pid Shopper.
 * @param {string} nodeId
 * @returns {{id: string, price: number, rarity: string}[]}
 */
export function computeStock(sim, pid, nodeId) {
  const boardShop = sim.board.shops?.find((s) => s.node === nodeId);
  const override = sim.state.board.shopStockOverrides[nodeId];
  const ids = [...(boardShop?.stock ?? []), ...(Array.isArray(override) ? override : [])];
  const seen = new Set();
  const stock = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const def = itemsRegistry.get(id);
    if (!itemAllowed(sim, def)) continue;
    stock.push({ id, price: priceFor(sim, pid, def, nodeId), rarity: def.rarity });
  }
  return stock;
}

/**
 * Could the shopper actually buy at least one stock entry right now
 * (affordable price + a free bag slot)? Used by fastMode to skip shop
 * prompts that could only be answered with "leave".
 *
 * @param {Object} sim
 * @param {string} pid
 * @param {string} nodeId
 * @returns {boolean}
 */
export function canBuyAny(sim, pid, nodeId) {
  const player = sim.state.players[pid];
  if (!player || player.items.length >= ITEM_CAP) return false;
  return computeStock(sim, pid, nodeId).some((entry) => player.coins >= entry.price);
}

/**
 * Hooked price of one item for one shopper (clamped to >= 0 integer).
 * @param {Object} sim
 * @param {string} pid
 * @param {Object} def ItemDef
 * @param {string} nodeId
 * @returns {number}
 */
export function priceFor(sim, pid, def, nodeId) {
  const price = runHook(sim, 'onShopPrice', pid, def.price, { itemId: def.id, node: nodeId });
  return Math.max(0, Math.round(Number(price) || 0));
}

/**
 * Validate + execute a shop purchase. On success the item is granted, coins
 * are deducted and a held shop_coupon (whose passive onShopPrice hook just
 * discounted the price) is consumed.
 *
 * @param {Object} sim
 * @param {string} pid
 * @param {string} nodeId
 * @param {string} itemId
 * @returns {{ok: boolean, error?: string, price?: number}}
 */
export function executeBuy(sim, pid, nodeId, itemId) {
  const player = sim.state.players[pid];
  const entry = computeStock(sim, pid, nodeId).find((s) => s.id === itemId);
  if (!entry) return { ok: false, error: `item "${itemId}" is not in stock` };
  if (player.items.length >= ITEM_CAP) return { ok: false, error: 'item bag is full (3 items max)' };
  if (player.coins < entry.price) return { ok: false, error: 'not enough coins' };

  const hadCoupon = player.items.includes('shop_coupon');
  addCoins(sim, pid, -entry.price, 'shop');
  grantItem(sim, pid, itemId, 'shop');
  // The coupon discounts exactly one purchase, then disappears.
  if (hadCoupon && itemId !== 'shop_coupon') {
    const idx = player.items.indexOf('shop_coupon');
    if (idx !== -1) {
      player.items.splice(idx, 1);
      sim.emit('item', { kind: 'consumed', playerId: pid, itemId: 'shop_coupon', reason: 'coupon_redeemed' });
    }
  }
  sim.emit('shop', { kind: 'buy', playerId: pid, node: nodeId, itemId, price: entry.price });
  return { ok: true, price: entry.price };
}

/**
 * Put an item into a player's bag (or run its onAcquire behavior). When the
 * bag is full the grant converts to +5 coins.
 *
 * @param {Object} sim
 * @param {string} pid
 * @param {string} itemId
 * @param {string} [source] 'shop' | 'field' | 'item' | 'start' ...
 * @returns {string|null} The granted item id, or null when converted/invalid.
 */
export function grantItem(sim, pid, itemId, source = 'field') {
  const player = sim.state.players[pid];
  const def = itemsRegistry.get(itemId);
  if (!player || !def) return null;

  // Items may hook their acquisition (e.g. magnet_banana starts its passive
  // effect immediately and never occupies a bag slot).
  if (typeof def.onAcquire === 'function') {
    const out = def.onAcquire(sim, pid) ?? {};
    if (out.consumed) {
      sim.emit('item', { kind: 'granted', playerId: pid, itemId, source, consumedOnAcquire: true });
      return itemId;
    }
  }

  if (player.items.length >= ITEM_CAP) {
    addCoins(sim, pid, 5, 'item_bag_full');
    sim.emit('item', { kind: 'grant_converted', playerId: pid, itemId, source, coins: 5 });
    return null;
  }
  player.items.push(itemId);
  sim.emit('item', { kind: 'granted', playerId: pid, itemId, source });
  return itemId;
}

/**
 * Rarity-weighted random item id for grants, honoring the rules item mode:
 * 'allSame' cycles a shared deterministic rotation so every grant sequence
 * is identical for all players; 'normal'/'infinite' roll rarity then pick.
 *
 * @param {Object} sim
 * @returns {string|null} Item id, or null when no item is available.
 */
export function pickRandomItemId(sim) {
  const pool = itemsRegistry.all().filter((def) => itemAllowed(sim, def));
  if (pool.length === 0) return null;

  if (sim.state.rules.items === 'allSame') {
    const sorted = pool.map((d) => d.id).sort();
    const idx = sim.internal.allSameIndex % sorted.length;
    sim.internal.allSameIndex += 1;
    return sorted[idx];
  }

  const roll = sim.rng.next();
  let rarity;
  if (roll < RARITY_WEIGHTS.common) rarity = 'common';
  else if (roll < RARITY_WEIGHTS.common + RARITY_WEIGHTS.rare) rarity = 'rare';
  else rarity = 'epic';

  // Fall back down the rarity ladder when a tier is empty.
  const ladder = { epic: ['epic', 'rare', 'common'], rare: ['rare', 'common', 'epic'], common: ['common', 'rare', 'epic'] };
  for (const tier of ladder[rarity]) {
    const tierPool = pool.filter((d) => d.rarity === tier);
    if (tierPool.length > 0) return sim.rng.pick(tierPool).id;
  }
  return sim.rng.pick(pool).id;
}
