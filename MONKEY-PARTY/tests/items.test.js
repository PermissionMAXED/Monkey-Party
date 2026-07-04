/**
 * Item system tests (package P3): all 14 items in scripted scenarios plus
 * hook-chain ordering (character perk + shop_coupon stack multiplicatively).
 *
 * Board fixtures (simple rings) are defined inside this file - no dependency
 * on the boards content package.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createMatchSim } from '#shared/sim/match.js';
import registerAllItems, { ITEM_DEFS } from '#shared/content/items/index.js';
import { CHAOS_OUTCOMES } from '#shared/content/items/chaos_box.js';
import { boards, characters, items } from '#shared/registries.js';
import { ITEM_RARITIES, ITEM_PHASES, ITEM_TARGETS } from '#shared/constants.js';
import { HOOK_NAMES, registerEffectDef, assertHookNames } from '#shared/sim/effects.js';

registerAllItems();

/* ------------------------------------------------------------------ */
/* Fixtures: 24-node rings                                             */
/* ------------------------------------------------------------------ */

function ringBoard(id, { shopNode = null, stock = [] } = {}) {
  const N = 24;
  const nid = (i) => `r${String(((i % N) + N) % N).padStart(2, '0')}`;
  const nodes = [];
  for (let i = 0; i < N; i += 1) {
    nodes.push({
      id: nid(i),
      pos: [i, 0, 0],
      type: i === 0 ? 'start' : (nid(i) === shopNode ? 'shop' : 'blue'),
      next: [nid(i + 1)],
    });
  }
  return {
    id,
    name: { en: id, de: id },
    description: { en: '', de: '' },
    difficulty: 1,
    theme: { sky: null, fog: null, ambient: null, palette: { primary: '#166534', secondary: '#0c4a6e', accent: '#f59e0b' } },
    music: { tempo: 100, scale: null, pattern: null },
    nodes,
    starSpawns: ['r20'],
    shops: shopNode ? [{ node: shopNode, stock }] : [],
    events: {},
    mechanics: [],
    bossEvent: null,
    view: null,
  };
}

boards.register(ringBoard('test_ring'));
boards.register(ringBoard('test_shop_ring', { shopNode: 'r05', stock: ['double_dice'] }));

characters.register({
  id: '__haggler__',
  name: 'Haggler',
  species: 'capuchin',
  blurb: { en: 'Loves a bargain.', de: 'Liebt Schnaeppchen.' },
  build: { scale: 1, furColor: '#888', faceColor: '#caa', bellyColor: '#eee', earStyle: 'round', tail: 'long', snout: 'short', brow: 'flat', armLen: 1, potbelly: 0 },
  perk: {
    id: 'bargain_hunter',
    description: { en: '-20% shop prices', de: '-20% Ladenpreise' },
    hooks: { onShopPrice: (price) => Math.round(price * 0.8) },
  },
  voice: { pitch: 1, style: 'chirpy' },
  emotes: [],
  unlock: { bananas: 0 },
});

/**
 * 2-player sim on a ring. Turn order is seat order: p1 then p2.
 * startItems are granted to BOTH players (Rules.startItems semantics).
 */
function makeSim({ seed = 7, boardId = 'test_ring', rules = {}, p1 = {}, p2 = {} } = {}) {
  return createMatchSim({
    seed,
    boardId,
    rules: { rounds: 3, minigameEvery: 0, ...rules },
    players: [
      { id: 'p1', name: 'One', ...p1 },
      { id: 'p2', name: 'Two', ...p2 },
    ],
  });
}

const act = (type, playerId, payload = {}) => ({ type, playerId, payload });

/* ------------------------------------------------------------------ */
/* Registry & contract                                                 */
/* ------------------------------------------------------------------ */

test('registerAll() registers exactly 14 items (idempotently)', () => {
  assert.equal(registerAllItems(), 14, 'second call stays at 14');
  assert.equal(items.count(), 14);
  assert.deepEqual(items.ids().sort(), [
    'banana_peel', 'chaos_box', 'coconut_trap', 'dice_curse', 'double_dice',
    'ghost_banana', 'golden_ticket', 'lucky_mask', 'magnet_banana',
    'mini_gorilla', 'shield_shell', 'shop_coupon', 'swap_totem', 'turbo_banana',
  ]);
});

test('every ItemDef fulfills the contract (localized en/de, icon, effect, ...)', () => {
  assert.equal(ITEM_DEFS.length, 14);
  for (const def of ITEM_DEFS) {
    assert.equal(typeof def.id, 'string');
    for (const text of [def.name, def.description]) {
      assert.equal(typeof text.en, 'string');
      assert.equal(typeof text.de, 'string');
      assert.ok(text.en.length > 0 && text.de.length > 0, `${def.id} localization`);
    }
    assert.ok(Number.isFinite(def.price) && def.price > 0, `${def.id} price`);
    assert.ok(ITEM_RARITIES.includes(def.rarity), `${def.id} rarity`);
    assert.ok(ITEM_PHASES.includes(def.phase), `${def.id} phase`);
    assert.ok(ITEM_TARGETS.includes(def.target), `${def.id} target`);
    assert.equal(typeof def.competitiveSafe, 'boolean', `${def.id} competitiveSafe`);
    assert.equal(typeof def.effect, 'function', `${def.id} effect`);
    for (const key of ['bg', 'glyph', 'fg']) {
      assert.equal(typeof def.icon[key], 'string', `${def.id} icon.${key}`);
    }
  }
  assert.equal(items.get('chaos_box').competitiveSafe, false);
  assert.equal(items.get('ghost_banana').competitiveSafe, false);
  assert.equal(items.get('golden_ticket').rarity, 'epic');
});

test('effect registration throws on unknown hook names', () => {
  assert.throws(
    () => registerEffectDef({ id: '__bad__', hooks: { onFullMoon: () => {} } }),
    /unknown hook name "onFullMoon"/,
  );
  assert.throws(() => assertHookNames({ onSneeze: () => {} }), /unknown hook name/);
  assert.equal(HOOK_NAMES.length, 13);
});

/* ------------------------------------------------------------------ */
/* 1. double_dice                                                      */
/* ------------------------------------------------------------------ */

test('double_dice: rolls 2d6 (preRoll)', () => {
  const sim = makeSim({ rules: { startItems: ['double_dice'] } });
  assert.equal(sim.getState().phase, 'item');
  assert.deepEqual(sim.getState().awaiting.options.usableItems, ['double_dice']);
  sim.apply(act('useItem', 'p1', { itemId: 'double_dice' }));
  assert.equal(sim.getState().awaiting.decision, 'roll');
  const { events } = sim.apply(act('roll', 'p1'));
  const dice = events.find((e) => e.type === 'dice');
  assert.equal(dice.count, 2);
  assert.equal(dice.values.length, 2);
  assert.equal(dice.total, dice.values[0] + dice.values[1]);
  assert.ok(dice.total >= 2 && dice.total <= 12);
});

/* ------------------------------------------------------------------ */
/* 2. turbo_banana                                                     */
/* ------------------------------------------------------------------ */

test('turbo_banana: +4 movement steps', () => {
  const sim = makeSim({ rules: { startItems: ['turbo_banana'] } });
  sim.apply(act('useItem', 'p1', { itemId: 'turbo_banana' }));
  const { events } = sim.apply(act('roll', 'p1'));
  const dice = events.find((e) => e.type === 'dice');
  const steps = events.filter((e) => e.type === 'move_step' && e.kind === undefined && e.playerId === 'p1');
  assert.equal(steps.length, dice.total + 4);
});

/* ------------------------------------------------------------------ */
/* 3. coconut_trap                                                     */
/* ------------------------------------------------------------------ */

test('coconut_trap: placed within 5 steps, victim loses 10 coins to owner', () => {
  const sim = makeSim({ rules: { startItems: ['coconut_trap'] } });
  sim.apply(act('useItem', 'p1', { itemId: 'coconut_trap' }));
  const awaiting = sim.getState().awaiting;
  assert.equal(awaiting.decision, 'itemTarget');
  assert.equal(awaiting.itemId, 'coconut_trap');
  assert.deepEqual(awaiting.options, ['r01', 'r02', 'r03', 'r04', 'r05'], 'targets = nodes within 5 steps');

  sim.apply(act('itemTarget', 'p1', { target: 'r01' }));
  assert.deepEqual(sim.getState().board.traps.r01, { itemId: 'coconut_trap', ownerId: 'p1' });

  sim.apply(act('roll', 'p1')); // p1 passes their own trap without triggering it
  assert.deepEqual(sim.getState().board.traps.r01, { itemId: 'coconut_trap', ownerId: 'p1' });

  sim.apply(act('skipItem', 'p2'));
  const { events } = sim.apply(act('roll', 'p2')); // p2 walks into r01
  const trap = events.find((e) => e.type === 'trap' && e.cancelled === false);
  assert.deepEqual(
    { playerId: trap.playerId, ownerId: trap.ownerId, itemId: trap.itemId, node: trap.node },
    { playerId: 'p2', ownerId: 'p1', itemId: 'coconut_trap', node: 'r01' },
  );
  const state = sim.getState();
  assert.equal(state.board.traps.r01, undefined, 'trap consumed');
  assert.equal(state.players.p1.coins, 10 + 3 + 10, 'start + blue landing + stolen 10');
  assert.equal(state.players.p2.coins, 0 + 3, 'lost all 10 coins, then blue landing');
  assert.equal(state.players.p2.stats.coinsLost, 10);
});

/* ------------------------------------------------------------------ */
/* 4. banana_peel                                                      */
/* ------------------------------------------------------------------ */

test('banana_peel: victim loses 5 coins and skids 3 nodes, move cancelled', () => {
  const sim = makeSim({ rules: { startItems: ['banana_peel'] } });
  sim.apply(act('useItem', 'p1', { itemId: 'banana_peel', target: 'r01' }));
  sim.apply(act('roll', 'p1'));
  sim.apply(act('skipItem', 'p2'));
  const { events } = sim.apply(act('roll', 'p2'));
  const slides = events.filter((e) => e.type === 'move_step' && e.kind === 'slide' && e.playerId === 'p2');
  assert.equal(slides.length, 3, 'skids exactly 3 nodes');
  const state = sim.getState();
  assert.equal(state.players.p2.node, 'r04', 'r01 + 3-node skid');
  assert.equal(state.players.p2.coins, 10 - 5 + 3, 'lost 5, then blue landing at r04');
});

/* ------------------------------------------------------------------ */
/* 5. swap_totem                                                       */
/* ------------------------------------------------------------------ */

test('swap_totem: swaps positions with the target player', () => {
  const sim = makeSim({ rules: { startItems: ['swap_totem'] } });
  sim.teleport('p2', 'r10');
  sim.apply(act('useItem', 'p1', { itemId: 'swap_totem', target: 'p2' }));
  const state = sim.getState();
  assert.equal(state.players.p1.node, 'r10');
  assert.equal(state.players.p2.node, 'r00');
  assert.equal(state.awaiting.decision, 'roll', 'turn continues with the roll');
});

/* ------------------------------------------------------------------ */
/* 6. lucky_mask                                                       */
/* ------------------------------------------------------------------ */

test('lucky_mask: rerolls once and keeps the better total', () => {
  const sim = makeSim({ rules: { startItems: ['lucky_mask'] } });
  sim.apply(act('useItem', 'p1', { itemId: 'lucky_mask' }));
  const { events } = sim.apply(act('roll', 'p1'));
  const dice = events.find((e) => e.type === 'dice');
  assert.equal(dice.rerolled, true);
  const steps = events.filter((e) => e.type === 'move_step' && e.kind === undefined);
  assert.equal(steps.length, dice.total, 'kept total drives the movement');
});

test('lucky_mask keeps max(original, reroll) - verified across seeds', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const plain = makeSim({ seed });
    const plainDice = plain.apply(act('roll', 'p1')).events.find((e) => e.type === 'dice');
    const masked = makeSim({ seed, rules: { startItems: ['lucky_mask'] } });
    masked.apply(act('useItem', 'p1', { itemId: 'lucky_mask' }));
    const maskedDice = masked.apply(act('roll', 'p1')).events.find((e) => e.type === 'dice');
    assert.ok(maskedDice.total >= plainDice.total, `mask can only improve (seed ${seed})`);
  }
});

/* ------------------------------------------------------------------ */
/* 7. mini_gorilla                                                     */
/* ------------------------------------------------------------------ */

test('mini_gorilla: pushes the target 5 nodes back', () => {
  const sim = makeSim({ rules: { startItems: ['mini_gorilla'] } });
  sim.teleport('p2', 'r10');
  const { events } = sim.apply(act('useItem', 'p1', { itemId: 'mini_gorilla', target: 'p2' }));
  assert.equal(events.filter((e) => e.type === 'move_step' && e.kind === 'pushback').length, 5);
  assert.equal(sim.getState().players.p2.node, 'r05');
});

/* ------------------------------------------------------------------ */
/* 8. ghost_banana                                                     */
/* ------------------------------------------------------------------ */

test('ghost_banana: steals 1d6+4 coins (or an item on the 20% branch)', () => {
  const sim = makeSim({ seed: 11, rules: { startItems: ['ghost_banana'], startCoins: 30 } });
  const before = sim.getState();
  const { events } = sim.apply(act('useItem', 'p1', { itemId: 'ghost_banana', target: 'p2' }));
  const outcome = events.find((e) => e.type === 'item' && ['coins_stolen', 'item_stolen', 'steal_blocked'].includes(e.kind));
  const after = sim.getState();
  if (outcome.kind === 'coins_stolen') {
    assert.ok(outcome.amount >= 5 && outcome.amount <= 10, '1d6+4 range');
    assert.equal(after.players.p1.coins, before.players.p1.coins + outcome.amount);
    assert.equal(after.players.p2.coins, before.players.p2.coins - outcome.amount);
  } else if (outcome.kind === 'item_stolen') {
    assert.ok(after.players.p1.items.includes(outcome.stolen));
    assert.ok(!after.players.p2.items.includes(outcome.stolen));
  }
  // Deterministic: the same seed reproduces the same outcome.
  const sim2 = makeSim({ seed: 11, rules: { startItems: ['ghost_banana'], startCoins: 30 } });
  const { events: events2 } = sim2.apply(act('useItem', 'p1', { itemId: 'ghost_banana', target: 'p2' }));
  assert.equal(JSON.stringify(events2), JSON.stringify(events));
});

/* ------------------------------------------------------------------ */
/* 9. shop_coupon (+ hook chain ordering)                              */
/* ------------------------------------------------------------------ */

test('shop_coupon: -30% on the next purchase, then consumed', () => {
  const sim = makeSim({ boardId: 'test_shop_ring', rules: { startItems: ['shop_coupon'] } });
  // Passive item -> not usable -> the item phase auto-advanced to roll.
  assert.equal(sim.getState().phase, 'roll');
  sim.teleport('p1', 'r04'); // any roll >= 1 enters the shop node r05
  sim.apply(act('roll', 'p1'));
  let awaiting = sim.getState().awaiting;
  assert.equal(awaiting.decision, 'shop');
  assert.deepEqual(awaiting.options.stock, [{ id: 'double_dice', price: 7, rarity: 'rare' }], '10 * 0.7 = 7');

  sim.apply(act('shopBuy', 'p1', { itemId: 'double_dice' }));
  const state = sim.getState();
  assert.ok(state.players.p1.items.includes('double_dice'));
  assert.ok(!state.players.p1.items.includes('shop_coupon'), 'coupon consumed by the purchase');
  assert.equal(state.players.p1.coins, 10 - 7);
  awaiting = state.awaiting;
  assert.equal(awaiting.options.stock[0].price, 10, 'price back to normal without the coupon');
  sim.apply(act('shopLeave', 'p1')); // movement/turn resumes without errors
});

test('hook chain ordering: character perk then coupon stack multiplicatively', () => {
  const sim = makeSim({
    boardId: 'test_shop_ring',
    rules: { startItems: ['shop_coupon'] },
    p1: { characterId: '__haggler__' },
  });
  sim.teleport('p1', 'r04');
  sim.apply(act('roll', 'p1'));
  const awaiting = sim.getState().awaiting;
  assert.equal(awaiting.decision, 'shop');
  // perk first: round(10 * 0.8) = 8, then coupon: round(8 * 0.7) = 6.
  // (multiplicative stacking - additive would give 10 - 2 - 3 = 5)
  assert.equal(awaiting.options.stock[0].price, 6);

  sim.apply(act('shopBuy', 'p1', { itemId: 'double_dice' }));
  const after = sim.getState();
  assert.equal(after.players.p1.coins, 10 - 6);
  assert.equal(after.awaiting.options.stock[0].price, 8, 'coupon gone, perk remains');
});

/* ------------------------------------------------------------------ */
/* 10. dice_curse                                                      */
/* ------------------------------------------------------------------ */

test('dice_curse: target rolls a d3 on their next turn, then the curse expires', () => {
  const sim = makeSim({ rules: { startItems: ['dice_curse'] } });
  sim.apply(act('useItem', 'p1', { itemId: 'dice_curse', target: 'p2' }));
  assert.deepEqual(sim.getState().players.p2.effects, [{ id: 'dice_curse', turnsLeft: 1 }]);
  sim.apply(act('roll', 'p1'));

  sim.apply(act('skipItem', 'p2'));
  const { events } = sim.apply(act('roll', 'p2'));
  const dice = events.find((e) => e.type === 'dice' && e.playerId === 'p2');
  assert.equal(dice.sides, 3, 'cursed die is a d3');
  assert.equal(dice.count, 1);
  assert.ok(dice.total >= 1 && dice.total <= 3);
  assert.equal(sim.getState().players.p2.effects.length, 0, 'curse expired after the turn');
});

/* ------------------------------------------------------------------ */
/* 11. magnet_banana                                                   */
/* ------------------------------------------------------------------ */

test('magnet_banana: passive 3 turns, +1 coin per node passed, no bag slot', () => {
  const sim = makeSim({ rules: { startItems: ['magnet_banana'] } });
  let state = sim.getState();
  assert.equal(state.players.p1.items.length, 0, 'consumed on acquisition');
  assert.deepEqual(state.players.p1.effects, [{ id: 'magnet_banana', turnsLeft: 3 }]);
  assert.equal(state.phase, 'roll', 'passive items are not actively usable');

  const { events } = sim.apply(act('roll', 'p1'));
  const dice = events.find((e) => e.type === 'dice');
  const magnetCoins = events.filter((e) => e.type === 'coins' && e.reason === 'magnet_banana' && e.playerId === 'p1');
  assert.equal(magnetCoins.length, dice.total, '+1 per passed node');
  state = sim.getState();
  assert.equal(state.players.p1.coins, 10 + dice.total + 3, 'start + magnet + blue landing');
  assert.deepEqual(state.players.p1.effects, [{ id: 'magnet_banana', turnsLeft: 2 }], 'ticked down after the turn');
});

/* ------------------------------------------------------------------ */
/* 12. chaos_box                                                       */
/* ------------------------------------------------------------------ */

test('chaos_box: seeded pick from the 8-outcome table, deterministic per seed', () => {
  const seen = new Set();
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]) {
    const sim = makeSim({ seed, rules: { startItems: ['chaos_box'] } });
    const { events } = sim.apply(act('useItem', 'p1', { itemId: 'chaos_box' }));
    const chaos = events.find((e) => e.type === 'item' && e.kind === 'chaos');
    assert.ok(CHAOS_OUTCOMES.includes(chaos.outcome), `outcome "${chaos.outcome}" is in the table`);
    seen.add(chaos.outcome);

    const sim2 = makeSim({ seed, rules: { startItems: ['chaos_box'] } });
    const { events: events2 } = sim2.apply(act('useItem', 'p1', { itemId: 'chaos_box' }));
    assert.equal(JSON.stringify(events2), JSON.stringify(events), `seed ${seed} is deterministic`);
  }
  assert.equal(CHAOS_OUTCOMES.length, 8);
  assert.ok(seen.size >= 4, `seeded table produces variety (saw ${seen.size} outcomes)`);
});

/* ------------------------------------------------------------------ */
/* 13. golden_ticket                                                   */
/* ------------------------------------------------------------------ */

test('golden_ticket: teleports to the star node and prompts the purchase', () => {
  const sim = makeSim({ rules: { startItems: ['golden_ticket'], startCoins: 30 } });
  sim.apply(act('useItem', 'p1', { itemId: 'golden_ticket' }));
  let state = sim.getState();
  assert.equal(state.players.p1.node, 'r20', 'teleported to the star');
  assert.equal(state.awaiting.decision, 'buyStar');
  assert.equal(state.awaiting.options.price, 20);

  sim.apply(act('buyStar', 'p1'));
  state = sim.getState();
  assert.equal(state.players.p1.goldenBananas, 1);
  assert.equal(state.players.p1.coins, 30 - 20);
  assert.equal(state.awaiting.decision, 'roll', 'turn continues after the purchase');
});

test('golden_ticket: without enough coins there is no star prompt', () => {
  const sim = makeSim({ rules: { startItems: ['golden_ticket'], startCoins: 5 } });
  sim.apply(act('useItem', 'p1', { itemId: 'golden_ticket' }));
  const state = sim.getState();
  assert.equal(state.players.p1.node, 'r20');
  assert.equal(state.awaiting.decision, 'roll', 'no buyStar prompt when broke');
});

/* ------------------------------------------------------------------ */
/* 14. shield_shell                                                    */
/* ------------------------------------------------------------------ */

test('shield_shell: blocks the next trap, then shatters', () => {
  const sim = makeSim({ rules: { startItems: ['coconut_trap', 'shield_shell'] } });
  sim.apply(act('useItem', 'p1', { itemId: 'coconut_trap', target: 'r01' }));
  sim.apply(act('roll', 'p1'));

  sim.apply(act('skipItem', 'p2'));
  const { events } = sim.apply(act('roll', 'p2'));
  const trap = events.find((e) => e.type === 'trap' && e.node === 'r01');
  assert.equal(trap.cancelled, true, 'shield cancelled the trap');
  const state = sim.getState();
  assert.ok(!state.players.p2.items.includes('shield_shell'), 'shield consumed');
  assert.equal(state.players.p1.coins, 10 + 3, 'owner got nothing (blue landing only)');
  assert.equal(state.players.p2.stats.coinsLost, 0, 'victim lost nothing');
});

test('shield_shell: blocks a coin steal once', () => {
  const sim = makeSim();
  sim.state.players.p2.items.push('shield_shell');
  assert.equal(sim.stealCoins('p2', 'p1', 5), 0, 'first steal blocked');
  assert.ok(!sim.getState().players.p2.items.includes('shield_shell'));
  assert.equal(sim.stealCoins('p2', 'p1', 5), 5, 'second steal succeeds');
  assert.equal(sim.getState().players.p1.coins, 15);
});

/* ------------------------------------------------------------------ */
/* Rules interactions                                                  */
/* ------------------------------------------------------------------ */

test('competitive rules filter out non-competitiveSafe items', () => {
  const sim = makeSim({ rules: { competitive: true, startItems: ['chaos_box', 'double_dice'] } });
  const state = sim.getState();
  assert.ok(!state.players.p1.items.includes('chaos_box'), 'chaos_box banned in competitive');
  assert.ok(state.players.p1.items.includes('double_dice'));
});

test('items "off" disables the item phase and start items', () => {
  const sim = makeSim({ rules: { items: 'off', startItems: ['double_dice'] } });
  const state = sim.getState();
  assert.equal(state.players.p1.items.length, 0);
  assert.equal(state.phase, 'roll');
});

test('trapPlace items are unusable when rules.traps is false', () => {
  const sim = makeSim({ rules: { traps: false, startItems: ['coconut_trap'] } });
  assert.equal(sim.getState().phase, 'roll', 'no usable items -> straight to roll');
  assert.deepEqual(sim.legalActions('p1'), [{ type: 'roll', playerId: 'p1', payload: {} }]);
});

test('item bag cap: a 4th item converts to +5 coins', () => {
  const sim = makeSim({ rules: { startItems: ['double_dice', 'lucky_mask', 'swap_totem'] } });
  const before = sim.getState().players.p1.coins;
  const granted = sim.giveItem('p1', 'turbo_banana');
  assert.equal(granted, null);
  const state = sim.getState();
  assert.equal(state.players.p1.items.length, 3);
  assert.equal(state.players.p1.coins, before + 5);
});
