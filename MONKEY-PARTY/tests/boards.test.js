import test from 'node:test';
import assert from 'node:assert/strict';

import { boards } from '#shared/registries.js';
import { NODE_TYPES } from '#shared/constants.js';
import registerAll, { BOARD_IDS, ITEM_IDS } from '#shared/content/boards/index.js';

const ITEM_ID_SET = new Set(ITEM_IDS);

await registerAll();
const defs = BOARD_IDS.map((id) => boards.get(id));

test('registerAll registers exactly the 12 boards (idempotently)', async () => {
  assert.equal(boards.count(), 12, 'boards registry count is 12');
  assert.deepEqual(boards.ids(), BOARD_IDS, 'registration order matches BOARD_IDS');
  await registerAll(); // second call must be a no-op
  assert.equal(boards.count(), 12, 'still 12 after a repeat registerAll()');
  for (const def of defs) assert.ok(def, 'every board id resolves to a def');
});

test('board ids and node ids are globally unique', () => {
  const boardIds = new Set(defs.map((d) => d.id));
  assert.equal(boardIds.size, 12, 'board ids unique');
  const nodeIds = [];
  for (const def of defs) for (const node of def.nodes) nodeIds.push(node.id);
  assert.equal(new Set(nodeIds).size, nodeIds.length, 'node ids unique across all boards');
});

for (const boardId of BOARD_IDS) {
  test(`board def: ${boardId}`, () => {
    const def = boards.get(boardId);
    assert.ok(def, 'def registered');
    assert.equal(def.id, boardId);

    /* --- metadata ------------------------------------------------- */
    for (const field of ['name', 'description']) {
      assert.equal(typeof def[field]?.en, 'string', `${field}.en`);
      assert.equal(typeof def[field]?.de, 'string', `${field}.de`);
      assert.ok(def[field].en.length > 0 && def[field].de.length > 0, `${field} non-empty`);
    }
    assert.ok(Number.isInteger(def.difficulty) && def.difficulty >= 1 && def.difficulty <= 5, 'difficulty 1-5');
    assert.equal(typeof def.theme?.palette?.primary, 'string', 'theme.palette.primary');
    assert.equal(typeof def.theme?.palette?.secondary, 'string', 'theme.palette.secondary');
    assert.equal(typeof def.theme?.palette?.accent, 'string', 'theme.palette.accent');
    assert.ok(def.theme.sky !== undefined && def.theme.fog !== undefined && def.theme.ambient !== undefined, 'theme sky/fog/ambient');
    assert.equal(typeof def.music?.tempo, 'number', 'music.tempo');
    assert.ok(def.music.scale !== undefined && def.music.pattern !== undefined, 'music scale/pattern');
    assert.ok(def.view, 'view descriptor present');

    /* --- nodes ------------------------------------------------------ */
    const nodes = def.nodes;
    assert.ok(Array.isArray(nodes), 'nodes is an array');
    assert.ok(nodes.length >= 45 && nodes.length <= 70, `node count 45-70 (got ${nodes.length})`);

    const byId = new Map();
    for (const node of nodes) {
      assert.equal(typeof node.id, 'string', 'node id is a string');
      assert.ok(!byId.has(node.id), `node id "${node.id}" unique within board`);
      byId.set(node.id, node);
      assert.ok(NODE_TYPES.includes(node.type), `node "${node.id}" type "${node.type}" valid`);
      assert.ok(Array.isArray(node.pos) && node.pos.length === 3, `node "${node.id}" pos is [x,y,z]`);
      for (const c of node.pos) assert.ok(Number.isFinite(c), `node "${node.id}" pos finite`);
      assert.ok(Array.isArray(node.next) && node.next.length >= 1, `node "${node.id}" has next`);
    }

    // Height variation: the layout must actually be 3D.
    const ys = nodes.map((n) => n.pos[1]);
    assert.ok(Math.max(...ys) - Math.min(...ys) >= 1.5, 'layout has height variation');

    // Every next id exists.
    for (const node of nodes) {
      for (const to of node.next) {
        assert.ok(byId.has(to), `node "${node.id}" next "${to}" exists`);
      }
    }

    // Junctions/loops: at least 3 nodes fork (2 loops + 1 shortcut).
    const forks = nodes.filter((n) => n.next.length >= 2);
    assert.ok(forks.length >= 3, `at least 3 forking junctions (got ${forks.length})`);

    /* --- start + BFS reachability ------------------------------------ */
    const starts = nodes.filter((n) => n.type === 'start');
    assert.equal(starts.length, 1, 'exactly one start node');
    const seen = new Set([starts[0].id]);
    const queue = [starts[0].id];
    while (queue.length > 0) {
      const cur = byId.get(queue.shift());
      for (const to of cur.next) {
        if (!seen.has(to)) {
          seen.add(to);
          queue.push(to);
        }
      }
    }
    assert.ok(
      seen.size >= Math.ceil(nodes.length * 0.9),
      `start reaches >=90% of nodes (${seen.size}/${nodes.length})`,
    );

    /* --- star spawns --------------------------------------------------- */
    assert.ok(Array.isArray(def.starSpawns) && def.starSpawns.length >= 3, '>=3 star spawns');
    for (const id of def.starSpawns) assert.ok(byId.has(id), `starSpawn "${id}" exists`);
    assert.equal(new Set(def.starSpawns).size, def.starSpawns.length, 'star spawns unique');

    /* --- shops ---------------------------------------------------------- */
    assert.ok(Array.isArray(def.shops) && def.shops.length === 2, 'exactly 2 shops');
    const stocks = [];
    for (const shop of def.shops) {
      assert.ok(byId.has(shop.node), `shop node "${shop.node}" exists`);
      assert.equal(byId.get(shop.node).type, 'shop', `shop node "${shop.node}" has type shop`);
      assert.ok(Array.isArray(shop.stock) && shop.stock.length > 0, 'shop stock non-empty');
      for (const itemId of shop.stock) {
        assert.ok(ITEM_ID_SET.has(itemId), `stock item "${itemId}" is a known item id`);
      }
      stocks.push(shop.stock.slice().sort().join(','));
    }
    assert.notEqual(stocks[0], stocks[1], 'the two shops carry distinct stock');

    /* --- events ------------------------------------------------------------ */
    const eventKeys = Object.keys(def.events ?? {});
    assert.ok(eventKeys.length >= 4 && eventKeys.length <= 8, `4-8 unique events (got ${eventKeys.length})`);
    for (const key of eventKeys) {
      const evt = def.events[key];
      assert.equal(typeof evt.handler, 'function', `event "${key}" has handler`);
      assert.equal(typeof evt.description?.en, 'string', `event "${key}" description.en`);
      assert.equal(typeof evt.description?.de, 'string', `event "${key}" description.de`);
    }
    const eventNodes = nodes.filter((n) => n.type === 'event');
    assert.ok(eventNodes.length > 0, 'board has event nodes');
    for (const node of eventNodes) {
      assert.ok(node.event && def.events[node.event], `event node "${node.id}" key "${node.event}" valid`);
    }

    /* --- mechanics + boss ----------------------------------------------------- */
    assert.ok(Array.isArray(def.mechanics) && def.mechanics.length >= 1, '>=1 mechanic');
    for (const mech of def.mechanics) {
      assert.equal(typeof mech.id, 'string', 'mechanic id');
      assert.ok(Number.isInteger(mech.everyRounds) && mech.everyRounds >= 1, 'mechanic everyRounds');
      assert.equal(typeof mech.onRoundStart, 'function', 'mechanic onRoundStart');
      assert.ok(mech.initialState && typeof mech.initialState === 'object', 'mechanic initialState');
    }
    assert.equal(typeof def.bossEvent?.id, 'string', 'bossEvent id');
    assert.ok(Number.isInteger(def.bossEvent.everyRounds) && def.bossEvent.everyRounds >= 1, 'bossEvent everyRounds');
    assert.equal(typeof def.bossEvent.handler, 'function', 'bossEvent handler');
  });
}

test('event handlers and mechanics run against a stub sim without touching global randomness', async () => {
  const { createRng } = await import('#shared/rng.js');

  for (const def of defs) {
    const start = def.nodes.find((n) => n.type === 'start');
    const players = {
      p1: { id: 'p1', node: start.id, coins: 20, goldenBananas: 1, items: ['banana_peel'], effects: [] },
      p2: { id: 'p2', node: def.nodes[3].id, coins: 5, goldenBananas: 0, items: [], effects: [] },
    };
    const calls = [];
    const sim = {
      rng: createRng(1234),
      state: {
        players,
        turnOrder: ['p1', 'p2'],
        board: { starNode: def.starSpawns[0], traps: {}, mechanics: {}, blockedNodes: [], shopStockOverrides: {} },
      },
      coins: (pid, n) => { players[pid].coins += n; calls.push(['coins', pid, n]); },
      giveItem: (pid, item) => { players[pid].items.push(item); calls.push(['giveItem', pid, item]); },
      movePlayer: (pid, node) => { players[pid].node = node; calls.push(['movePlayer', pid, node]); },
      teleport: (pid, node) => { players[pid].node = node; calls.push(['teleport', pid, node]); },
      stealCoins: (from, to, n) => { players[from].coins -= n; players[to].coins += n; calls.push(['stealCoins', from, to, n]); },
      addEffect: (pid, effect) => { players[pid].effects.push(effect); calls.push(['addEffect', pid, effect]); },
      blockNodes: (ids, rounds) => { calls.push(['blockNodes', ids, rounds]); },
      relocateStar: () => { calls.push(['relocateStar']); },
      emit: (type, payload) => { calls.push(['emit', type, payload]); },
    };

    const nodeIds = new Set(def.nodes.map((n) => n.id));
    for (const [key, evt] of Object.entries(def.events)) {
      assert.doesNotThrow(() => evt.handler(sim, 'p1', {}), `${def.id}: event "${key}" handler runs`);
      assert.ok(nodeIds.has(players.p1.node), `${def.id}: event "${key}" leaves p1 on a valid node`);
    }
    for (const mech of def.mechanics) {
      const state = structuredClone
        ? structuredClone(mech.initialState)
        : JSON.parse(JSON.stringify(mech.initialState));
      sim.state.board.mechanics[mech.id] = state;
      for (let round = 0; round < 4; round += 1) {
        assert.doesNotThrow(() => mech.onRoundStart(sim, state), `${def.id}: mechanic "${mech.id}" round ${round}`);
      }
      for (const [name, ids] of calls.filter((c) => c[0] === 'blockNodes').map((c) => [c[0], c[1]])) {
        assert.ok(name === 'blockNodes');
        for (const id of ids) assert.ok(nodeIds.has(id), `${def.id}: blocked node "${id}" exists`);
      }
    }
    assert.doesNotThrow(() => def.bossEvent.handler(sim), `${def.id}: boss handler runs`);
    for (const pid of ['p1', 'p2']) {
      assert.ok(nodeIds.has(players[pid].node), `${def.id}: ${pid} ends on a valid node`);
    }
  }
});

test('view builders: all 12 build headless, honor the contract, and dispose', async () => {
  // Views import three (pure JS, no DOM needed for Group/Mesh construction)
  // and guard all src/engine/* imports, so they must load even though the
  // engine package does not exist yet.
  const { boardViews } = await import('../src/boards/index.js');
  const THREE = await import('three');

  assert.deepEqual(Object.keys(boardViews).sort(), [...BOARD_IDS].sort(), 'one view builder per board id');

  for (const def of defs) {
    const build = boardViews[def.id];
    assert.equal(typeof build, 'function', `${def.id}: builder is a function`);
    const view = build(null, def);
    assert.ok(view.group?.isObject3D, `${def.id}: group is an Object3D`);
    assert.equal(typeof view.updateMechanics, 'function', `${def.id}: updateMechanics`);
    assert.equal(typeof view.nodeWorldPos, 'function', `${def.id}: nodeWorldPos`);
    assert.equal(typeof view.dispose, 'function', `${def.id}: dispose`);

    // Every node resolves to its world position.
    for (const node of def.nodes) {
      const p = view.nodeWorldPos(node.id);
      assert.ok(p instanceof THREE.Vector3, `${def.id}: nodeWorldPos(${node.id}) is a Vector3`);
      assert.ok(
        Math.abs(p.x - node.pos[0]) < 1e-6 && Math.abs(p.y - node.pos[1]) < 1e-6 && Math.abs(p.z - node.pos[2]) < 1e-6,
        `${def.id}: nodeWorldPos(${node.id}) matches def pos`,
      );
    }

    // Themed props: a meaningful amount of extra scenery beyond the discs.
    let meshCount = 0;
    view.group.traverse((obj) => { if (obj.isMesh) meshCount += 1; });
    assert.ok(meshCount >= def.nodes.length + 30, `${def.id}: >=30 props beyond node discs (${meshCount} meshes)`);

    // updateMechanics runs with empty, initial-like and live-ish states.
    const mechanics = {};
    for (const mech of def.mechanics) mechanics[mech.id] = JSON.parse(JSON.stringify(mech.initialState));
    assert.doesNotThrow(() => view.updateMechanics(null, 1 / 60), `${def.id}: updateMechanics(null)`);
    assert.doesNotThrow(
      () => view.updateMechanics({ board: { mechanics, blockedNodes: [def.nodes[1].id] } }, 1 / 60),
      `${def.id}: updateMechanics(state)`,
    );
    assert.doesNotThrow(() => view.dispose(), `${def.id}: dispose()`);
  }
});

test('gorilla_palace exposes the onStarPrice mechanic hook (+10)', () => {
  const def = boards.get('gorilla_palace');
  const mech = def.mechanics.find((m) => typeof m.onStarPrice === 'function' || typeof m.hooks?.onStarPrice === 'function');
  assert.ok(mech, 'a mechanic carries the onStarPrice hook');
  const hook = mech.onStarPrice ?? mech.hooks.onStarPrice;
  assert.equal(hook(20), 30, 'starPrice 20 -> 30 at the throne');
});

test('board mechanic hooks + effect defs are live in the sim (throne +10, d8, trap immunity)', async () => {
  const { createMatchSim } = await import('#shared/sim/match.js');
  const { buildDicePool } = await import('#shared/sim/dice.js');
  const { applyField } = await import('#shared/sim/fields.js');
  const players = [{ id: 'p1' }, { id: 'p2' }];

  // 1. gorilla_palace: the throne markup flows through the mechanic hook chain.
  const gp = createMatchSim({ seed: 5, boardId: 'gorilla_palace', players });
  gp.state.board.starNode = 'gp_t03';
  assert.equal(gp.starPriceFor('p1'), 30, 'throne star costs starPrice + 10');
  gp.state.board.starNode = 'gp_t05';
  assert.equal(gp.starPriceFor('p1'), 30, 'both throne-ascent spawns carry the markup');
  gp.state.board.starNode = 'gp_b03';
  assert.equal(gp.starPriceFor('p1'), 20, 'the gallery star has no royal markup');

  // 2. robo_banana_factory: the overclock dice_d8 effect changes the pool.
  const rf = createMatchSim({ seed: 5, boardId: 'robo_banana_factory', players });
  assert.equal(buildDicePool(rf, 'p1').sides, 6);
  rf.addEffect('p1', { id: 'dice_d8', turnsLeft: 1 });
  assert.equal(buildDicePool(rf, 'p1').sides, 8, 'overclocked players roll a d8');

  // 3. icy_coconut_peak: cozy_warmth cancels built-in trap fields.
  const ip = createMatchSim({ seed: 5, boardId: 'icy_coconut_peak', players });
  const ipTrap = ip.board.nodes.find((n) => n.type === 'trap');
  ip.addEffect('p1', { id: 'cozy_warmth', turnsLeft: 2 });
  const warmBefore = ip.state.players.p1.coins;
  applyField(ip, 'p1', ipTrap);
  assert.equal(ip.state.players.p1.coins, warmBefore, 'cozy_warmth cancels the trap');
  const coldBefore = ip.state.players.p2.coins;
  applyField(ip, 'p2', ipTrap);
  assert.ok(ip.state.players.p2.coins < coldBefore, 'without the effect the trap still bites');

  // 4. ghost_jungle: lantern_light gives the same immunity (checked against
  // a placed trap - the board has no built-in trap fields).
  const { triggerPlacedTrap } = await import('#shared/sim/fields.js');
  const gj = createMatchSim({ seed: 5, boardId: 'ghost_jungle', players });
  gj.placeTrap('p2', 'gj_m01', 'banana_peel');
  gj.addEffect('p1', { id: 'lantern_light', turnsLeft: 3 });
  const out = triggerPlacedTrap(gj, 'p1', 'gj_m01');
  assert.equal(out.triggered, true, 'the trap sprang');
  assert.equal(out.cancelMove, false, 'lantern_light neutralized it');
  const trapEvt = gj.getEventLog().filter((e) => e.type === 'trap').pop();
  assert.equal(trapEvt.cancelled, true, 'trap trigger was cancelled by lantern_light');
});

test('volcano_island: rising lava never strands a player and the star stays reachable', async () => {
  const { createMatchSim } = await import('#shared/sim/match.js');
  const sim = createMatchSim({ seed: 11, boardId: 'volcano_island', players: [{ id: 'p1' }, { id: 'p2' }] });

  // Simulate lava level 2: the caldera floor plus vi_o10 - every exit of
  // junction vi_o09 - is flooded.
  sim.blockNodes(['vi_c00', 'vi_c01', 'vi_c02', 'vi_c03', 'vi_c04', 'vi_o10'], 3);
  sim.state.players.p1.node = 'vi_o09';
  sim.apply({ type: 'roll', playerId: 'p1', payload: {} });
  const rescued = sim.getEventLog().find((e) => e.type === 'move_step' && e.kind === 'rescued' && e.playerId === 'p1');
  assert.ok(rescued, 'the walled-in player was rescued instead of stranded');
  assert.ok(!sim.state.board.blockedNodes.includes(sim.state.players.p1.node), 'rescue node is open');
  assert.notEqual(sim.state.players.p1.node, 'vi_o09', 'the player actually moved');

  // Star relocation skips spawns swallowed by the lava.
  sim.state.board.starNode = 'vi_o22';
  sim.blockNodes(['vi_a05'], 3);
  for (let i = 0; i < 5; i += 1) {
    assert.notEqual(sim.relocateStar(), 'vi_a05', 'a blocked spawn is never chosen');
  }
});
