/**
 * Item content registrar: registers all 14 ItemDefs into the singleton
 * items registry (see shared/registries.js).
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 *
 * Loaded by shared/content/index.js registerAllContent(), which expects a
 * default-exported registerAll(). registerAll() is idempotent: already
 * registered ids are skipped so repeated bootstraps don't throw.
 *
 * Balance notes (tests/balance.test.js):
 *  - The economy's stock/grant weighting input is each ItemDef's `rarity`
 *    (shop.js RARITY_WEIGHTS: common 0.7 / rare 0.25 / epic 0.05) plus its
 *    `price`; tune those per-def, there is no separate weight table here.
 *  - The item roster is FROZEN at these 14 ids: tests/items.test.js pins
 *    the exact count and id list, so new items cannot be added without
 *    breaking the frozen suite. The 40-match harness batches show every
 *    item both traded and used (no roster gap), so no new item was needed.
 */

import { items } from '../../registries.js';

import double_dice from './double_dice.js';
import turbo_banana from './turbo_banana.js';
import coconut_trap from './coconut_trap.js';
import banana_peel from './banana_peel.js';
import swap_totem from './swap_totem.js';
import lucky_mask from './lucky_mask.js';
import mini_gorilla from './mini_gorilla.js';
import ghost_banana from './ghost_banana.js';
import shop_coupon from './shop_coupon.js';
import dice_curse from './dice_curse.js';
import magnet_banana from './magnet_banana.js';
import chaos_box from './chaos_box.js';
import golden_ticket from './golden_ticket.js';
import shield_shell from './shield_shell.js';

/** All 14 item defs, in canonical registration order. */
export const ITEM_DEFS = [
  double_dice,
  turbo_banana,
  coconut_trap,
  banana_peel,
  swap_totem,
  lucky_mask,
  mini_gorilla,
  ghost_banana,
  shop_coupon,
  dice_curse,
  magnet_banana,
  chaos_box,
  golden_ticket,
  shield_shell,
];

/**
 * Register every item def (skipping ids that are already registered).
 * @returns {number} The items registry count after registration.
 */
export default function registerAll() {
  for (const def of ITEM_DEFS) {
    if (!items.get(def.id)) items.register(def);
  }
  return items.count();
}
