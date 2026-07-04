/**
 * Board-play view (P4) tests.
 *
 * WebGL cannot run headless, so these tests exercise the pure choreography
 * queue logic plus the full view constructed against a stub session and a
 * renderer-less engine stub (plain THREE scene graph). Everything is
 * driven by explicit update(dt) calls - no wall clock, no RAF.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import {
  createChoreoQueue,
  createBoardPlayView,
  buildFallbackBoard,
  decisionToAction,
} from '../src/boardplay/boardPlayView.js';

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const NODES = [
  { id: 'a', pos: [0, 0, 0], type: 'start', next: ['b'] },
  { id: 'b', pos: [4, 0, 0], type: 'blue', next: ['c'] },
  { id: 'c', pos: [8, 0, 0], type: 'junction', next: ['d', 'e'] },
  { id: 'd', pos: [12, 0, 2], type: 'red', next: ['a'] },
  { id: 'e', pos: [12, 0, -2], type: 'star', next: ['a'] },
];

const BOARD = {
  id: 'test_board',
  name: { en: 'Test Board', de: 'Testbrett' },
  nodes: NODES,
  starSpawns: ['e'],
  shops: [],
  events: {},
  mechanics: [],
};

function makeState({ node = 'a', botNode = 'a', awaiting = null, phase = 'roll', round = 1, currentTurn = 0 } = {}) {
  return {
    matchId: 'm_test',
    seed: 1,
    boardId: 'test_board',
    rules: {},
    protocolVersion: 1,
    round,
    phase,
    turnOrder: ['p1', 'bot1'],
    currentTurn,
    players: {
      p1: {
        id: 'p1', name: 'You', characterId: null, cosmetics: {}, isBot: false, difficulty: null,
        node, facingNext: null, coins: 10, goldenBananas: 0, items: [], effects: [],
        lastFieldColor: null, connected: true, stats: {},
      },
      bot1: {
        id: 'bot1', name: 'Bongo (bot)', characterId: null, cosmetics: {}, isBot: true, difficulty: 'normal',
        node: botNode, facingNext: null, coins: 10, goldenBananas: 0, items: [], effects: [],
        lastFieldColor: null, connected: true, stats: {},
      },
    },
    board: { starNode: 'e', traps: {}, mechanics: {}, blockedNodes: [], shopStockOverrides: {} },
    minigame: null,
    awaiting,
    rngState: 0,
  };
}

/** Stub ISession: records submits, lets tests emit session events. */
function makeSession(initialState, board = BOARD) {
  const listeners = new Map();
  const submitted = [];
  const stateBox = { current: initialState };
  let unsubCalls = 0;
  const sim = { board, getState: () => stateBox.current };
  const session = {
    mode: 'offline',
    getSim: () => sim,
    submit: (action) => submitted.push(action),
    on: (evt, cb) => {
      if (!listeners.has(evt)) listeners.set(evt, new Set());
      listeners.get(evt).add(cb);
      return () => {
        unsubCalls += 1;
        listeners.get(evt).delete(cb);
      };
    },
    localSeats: () => new Map([['p1', 0]]),
    sendEmote: () => {},
  };
  const emit = (evt, msg) => {
    for (const cb of [...(listeners.get(evt) ?? [])]) cb(msg);
  };
  return { session, emit, submitted, stateBox, unsubCount: () => unsubCalls };
}

/** Renderer-less engine stub: a real scene graph, no WebGL. */
function makeEngine() {
  return {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(55, 1, 0.1, 500),
    quality: 'low',
  };
}

/** Stub ui bus that records every request. */
function makeUi() {
  const requests = [];
  return {
    requests,
    request(decision, options, cb) {
      requests.push({ decision, options, cb });
    },
  };
}

function pump(view, seconds, step = 0.05) {
  for (let t = 0; t < seconds; t += step) view.update(step);
}

/* ------------------------------------------------------------------ */
/* Choreography queue (pure logic)                                     */
/* ------------------------------------------------------------------ */

test('choreo queue: serializes steps in order, drains and acknowledges', () => {
  const queue = createChoreoQueue();
  const log = [];
  let lastK = 0;
  let idleFired = 0;
  queue.onIdle(() => {
    idleFired += 1;
  });

  queue.enqueue({
    name: 'anim1',
    duration: 0.3,
    onStart: () => log.push('anim1:start'),
    onUpdate: (k) => {
      lastK = k;
    },
    onEnd: () => log.push('anim1:end'),
  });
  queue.enqueue({ name: 'cut', onEnd: () => log.push('cut') }); // zero-duration
  queue.enqueue({
    name: 'anim2',
    duration: 0.5,
    onStart: () => log.push('anim2:start'),
    onEnd: () => log.push('anim2:end'),
  });
  queue.enqueue(() => log.push('ack')); // function form = instant ack

  assert.equal(queue.idle, false);
  assert.equal(queue.size, 4);

  // Steps must not overlap: after 0.1s only anim1 has started.
  queue.update(0.1);
  assert.deepEqual(log, ['anim1:start']);

  // Finish anim1 -> the zero-duration cut runs in the same update, anim2 starts.
  queue.update(0.25);
  assert.deepEqual(log, ['anim1:start', 'anim1:end', 'cut', 'anim2:start']);
  assert.equal(lastK, 1, 'onUpdate always sees a final k === 1');

  // Drain the rest; the ack runs only after every animation completed.
  for (let i = 0; i < 20 && !queue.idle; i += 1) queue.update(0.1);
  assert.deepEqual(log, ['anim1:start', 'anim1:end', 'cut', 'anim2:start', 'anim2:end', 'ack']);
  assert.equal(queue.idle, true);
  assert.equal(queue.size, 0);
  assert.equal(queue.processed, 4);
  assert.equal(idleFired, 1, 'idle callback fires once per drain');

  // A new burst re-arms the idle notification.
  queue.enqueue({ duration: 0.1, onEnd: () => log.push('later') });
  queue.update(0.2);
  assert.equal(idleFired, 2);
});

test('choreo queue: errors in steps never break the queue', () => {
  const queue = createChoreoQueue();
  const log = [];
  queue.enqueue({
    duration: 0.1,
    onStart: () => {
      throw new Error('boom');
    },
    onEnd: () => log.push('one'),
  });
  queue.enqueue(() => log.push('two'));
  for (let i = 0; i < 10 && !queue.idle; i += 1) queue.update(0.1);
  assert.deepEqual(log, ['one', 'two']);
});

/* ------------------------------------------------------------------ */
/* Decision -> Action mapping                                          */
/* ------------------------------------------------------------------ */

test('decisionToAction maps every decision to the right Action', () => {
  const p = (decision, options = null) => ({ playerId: 'p1', decision, options });
  assert.deepEqual(decisionToAction(p('roll'), null), { type: 'roll', playerId: 'p1', payload: {} });
  assert.deepEqual(
    decisionToAction(p('roll'), { itemId: 'double_dice' }),
    { type: 'useItem', playerId: 'p1', payload: { itemId: 'double_dice', target: undefined } },
  );
  assert.deepEqual(decisionToAction(p('junction'), 'd'), { type: 'junction', playerId: 'p1', payload: { choice: 'd' } });
  assert.deepEqual(decisionToAction(p('buyStar'), true), { type: 'buyStar', playerId: 'p1', payload: {} });
  assert.deepEqual(decisionToAction(p('buyStar'), false), { type: 'declineStar', playerId: 'p1', payload: {} });
  assert.deepEqual(decisionToAction(p('shop'), 'banana_peel'), { type: 'shopBuy', playerId: 'p1', payload: { itemId: 'banana_peel' } });
  assert.deepEqual(decisionToAction(p('shop'), null), { type: 'shopLeave', playerId: 'p1', payload: {} });
  assert.deepEqual(decisionToAction(p('itemTarget'), 'bot1'), { type: 'itemTarget', playerId: 'p1', payload: { target: 'bot1' } });
  assert.deepEqual(decisionToAction(p('dicePick'), 2), { type: 'dicePick', playerId: 'p1', payload: { index: 2 } });
  // Full Action objects pass through.
  assert.deepEqual(
    decisionToAction(p('roll'), { type: 'skipItem', payload: {} }),
    { type: 'skipItem', playerId: 'p1', payload: {} },
  );
});

/* ------------------------------------------------------------------ */
/* Fallback board                                                      */
/* ------------------------------------------------------------------ */

test('buildFallbackBoard: readable discs + ribbons from BoardDef.nodes', () => {
  const view = buildFallbackBoard(null, BOARD);
  assert.ok(view.group.isObject3D);
  let meshes = 0;
  view.group.traverse((obj) => {
    if (obj.isMesh) meshes += 1;
  });
  // 5 discs + 6 next-links.
  assert.equal(meshes, 11);
  const p = view.nodeWorldPos('c');
  assert.ok(p instanceof THREE.Vector3);
  assert.deepEqual([p.x, p.y, p.z], [8, 0, 0]);
  assert.doesNotThrow(() => view.updateMechanics(null, 0.016));
  assert.doesNotThrow(() => view.dispose());
  assert.equal(view.group.children.length, 0);
});

/* ------------------------------------------------------------------ */
/* Full view against stub session/engine                               */
/* ------------------------------------------------------------------ */

test('board-play view: mounts, choreographs events, prompts and disposes', async () => {
  const initial = makeState({ awaiting: { playerId: 'p1', decision: 'roll', options: null } });
  const { session, emit, submitted, stateBox, unsubCount } = makeSession(initial);
  const engine = makeEngine();
  const ui = makeUi();

  const view = createBoardPlayView({ engine, session, ui, input: null });
  await view.mount();

  // Scene contents: board (fallback - unknown board id), 2 tokens, star.
  assert.ok(engine.scene.children.includes(view.group), 'root added to the engine scene');
  const tokenP1 = view.group.getObjectByName('token:p1');
  const tokenBot = view.group.getObjectByName('token:bot1');
  assert.ok(tokenP1 && tokenBot, 'one token per player');
  assert.ok(view.group.getObjectByName('starActor'), 'star actor placed');
  assert.ok(view.group.getObjectByName('board-fallback:test_board'), 'fallback board built');

  // The initial prompt is acknowledged only after the opening banner drains.
  assert.equal(ui.requests.length, 0, 'no prompt before the queue drains');
  pump(view, 3);
  assert.equal(view.choreo.idle, true, 'queue drained');
  assert.equal(ui.requests.length, 1, 'roll prompt acknowledged after drain');
  assert.equal(ui.requests[0].decision, 'roll');

  // Answer the roll prompt -> the Action is submitted to the session.
  ui.requests[0].cb(null);
  assert.deepEqual(submitted[0], { type: 'roll', playerId: 'p1', payload: {} });

  // The "sim" applies the roll: p1 walks a -> b -> c and waits at a junction.
  stateBox.current = makeState({
    node: 'c',
    phase: 'move',
    awaiting: { playerId: 'p1', decision: 'junction', options: ['d', 'e'] },
  });
  emit('action_applied', {
    action: submitted[0],
    events: [
      { type: 'dice', playerId: 'p1', values: [2], total: 2, sides: 6, count: 1, rerolled: false, draft: false },
      { type: 'move_step', playerId: 'p1', from: 'a', to: 'b', stepsLeft: 1 },
      { type: 'move_step', playerId: 'p1', from: 'b', to: 'c', stepsLeft: 0 },
    ],
  });

  // Events arrived instantly, but the junction prompt must wait for the
  // dice + hop animations to play out.
  assert.equal(view.choreo.idle, false, 'events queued as timed animations');
  assert.equal(ui.requests.length, 1, 'junction prompt NOT fired before animations');
  pump(view, 4);
  assert.equal(view.choreo.idle, true, 'movement choreography drained');
  assert.equal(ui.requests.length, 2, 'junction prompt acknowledged after drain');
  assert.equal(ui.requests[1].decision, 'junction');
  assert.deepEqual(ui.requests[1].options, ['d', 'e'], 'junction options forwarded');

  // Token hopped node-to-node and ended exactly on the junction node.
  assert.deepEqual(
    [tokenP1.position.x, tokenP1.position.y, tokenP1.position.z],
    [8, 0, 0],
    'p1 token landed on node c',
  );

  // Answer the junction -> junction Action submitted.
  ui.requests[1].cb('d');
  assert.deepEqual(submitted[1], { type: 'junction', playerId: 'p1', payload: { choice: 'd' } });

  // Landing on the red field: hop + field fx + coin loss, no new prompt.
  stateBox.current = makeState({ node: 'd', phase: 'field', awaiting: null });
  emit('action_applied', {
    action: submitted[1],
    events: [
      { type: 'move_step', playerId: 'p1', from: 'c', to: 'd', stepsLeft: 0 },
      { type: 'field', playerId: 'p1', node: 'd', fieldType: 'red' },
      { type: 'coins', playerId: 'p1', delta: -3, total: 7, reason: 'field_red' },
      { type: 'phase', phase: 'turn_start', round: 1, playerId: 'bot1' },
    ],
  });
  pump(view, 5);
  assert.equal(view.choreo.idle, true);
  assert.equal(ui.requests.length, 2, 'no prompt while nothing is awaited from a local human');
  assert.deepEqual(
    [tokenP1.position.x, tokenP1.position.z],
    [12, 2],
    'p1 token landed on node d',
  );

  // Trap, boss, mechanic, item and shop events choreograph without error.
  stateBox.current = makeState({ node: 'd', botNode: 'b', phase: 'field', awaiting: null, currentTurn: 1 });
  emit('action_applied', {
    action: { type: 'roll', playerId: 'bot1', payload: {} },
    events: [
      { type: 'trap', playerId: 'bot1', ownerId: 'p1', itemId: 'banana_peel', node: 'b', cancelled: false },
      { type: 'move_step', kind: 'slide', playerId: 'bot1', from: 'b', to: 'c' },
      { type: 'boss', kind: 'field', playerId: 'bot1', node: 'c' },
      { type: 'mechanic', kind: 'blocked', nodes: ['d'], rounds: 1 },
      { type: 'item', kind: 'gained', playerId: 'bot1', itemId: 'banana_peel' },
      { type: 'shop', kind: 'open', playerId: 'bot1', node: 'b' },
      { type: 'shop', kind: 'buy', playerId: 'bot1', node: 'b', itemId: 'shield_shell', price: 6 },
    ],
  });
  pump(view, 8);
  assert.equal(view.choreo.idle, true, 'trap/boss/mechanic choreography drained');
  assert.deepEqual(
    [tokenBot.position.x, tokenBot.position.z],
    [8, 0],
    'bot token slid to node c',
  );

  // Star purchase + relocation + game over choreography runs clean.
  stateBox.current = makeState({ node: 'e', phase: 'game_over', awaiting: null });
  emit('action_applied', {
    action: { type: 'buyStar', playerId: 'p1', payload: {} },
    events: [
      { type: 'star', kind: 'bought', playerId: 'p1', node: 'e', price: 20 },
      { type: 'star', kind: 'relocated', node: 'b' },
      { type: 'bonus', category: 'travel_monkey', name: { en: 'Travel Monkey' }, playerId: 'p1', score: 4, bananas: 1 },
      { type: 'game_over', ranking: ['p1', 'bot1'], winner: 'p1', standings: [] },
    ],
  });
  emit('emote', { type: 'emote', pid: 'p1', emoteId: 'dance' });
  pump(view, 14);
  assert.equal(view.choreo.idle, true, 'endgame choreography drained');

  // Dispose: unsubscribes, empties the scene root, further updates no-op.
  view.dispose();
  assert.equal(unsubCount(), 3, 'all session subscriptions released');
  assert.ok(!engine.scene.children.includes(view.group), 'root removed from the scene');
  assert.equal(view.group.children.length, 0, 'scene root emptied');
  assert.doesNotThrow(() => view.update(0.016), 'update after dispose is a no-op');
});

test('board-play view: headless without engine (null) still mounts and updates', async () => {
  const initial = makeState({ awaiting: null, phase: 'turn_start' });
  const { session } = makeSession(initial);
  const view = createBoardPlayView({ engine: null, session, ui: null, input: null });
  await view.mount();
  assert.doesNotThrow(() => pump(view, 3));
  assert.equal(view.choreo.idle, true);
  view.dispose();
});
