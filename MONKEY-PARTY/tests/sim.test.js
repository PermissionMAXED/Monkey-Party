/**
 * Match simulation tests (package P3).
 *
 * Uses a self-contained ~20-node board fixture defined INSIDE this file
 * (no dependency on the boards content package) plus the real item content
 * and the board bot. Runs full 10-round matches with 4 bots.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createMatchSim } from '#shared/sim/match.js';
import { decideBoardAction } from '#shared/ai/boardBot.js';
import { getDifficultyProfile, PROFILES } from '#shared/ai/difficulty.js';
import registerAllItems from '#shared/content/items/index.js';
import { boards, minigames } from '#shared/registries.js';
import { createRng } from '#shared/rng.js';
import { PHASES, DECISION_TYPES } from '#shared/constants.js';

registerAllItems();

/* ------------------------------------------------------------------ */
/* Board fixture (20 nodes, junction + two branches + loop)            */
/* ------------------------------------------------------------------ */

const NODES = [
  { id: 'n00', pos: [0, 0, 0], type: 'start', next: ['n01'] },
  { id: 'n01', pos: [1, 0, 0], type: 'blue', next: ['n02'] },
  { id: 'n02', pos: [2, 0, 0], type: 'item', next: ['n03'] },
  { id: 'n03', pos: [3, 0, 0], type: 'junction', next: ['n04', 'n12'] },
  // Branch A (sunny side): shop + star
  { id: 'n04', pos: [4, 0, 1], type: 'blue', next: ['n05'] },
  { id: 'n05', pos: [5, 0, 1], type: 'shop', next: ['n06'] },
  { id: 'n06', pos: [6, 0, 1], type: 'blue', next: ['n07'] },
  { id: 'n07', pos: [7, 0, 1], type: 'star', next: ['n08'] },
  { id: 'n08', pos: [8, 0, 1], type: 'event', next: ['n09'], event: 'coin_gift' },
  { id: 'n09', pos: [9, 0, 1], type: 'red', next: ['n10'] },
  { id: 'n10', pos: [10, 0, 1], type: 'blue', next: ['n17'] },
  // Branch B (swamp side): hazards
  { id: 'n12', pos: [4, 0, -1], type: 'red', next: ['n13'] },
  { id: 'n13', pos: [5, 0, -1], type: 'trap', next: ['n14'] },
  { id: 'n14', pos: [6, 0, -1], type: 'item', next: ['n15'] },
  { id: 'n15', pos: [7, 0, -1], type: 'boss', next: ['n16'] },
  { id: 'n16', pos: [8, 0, -1], type: 'special', next: ['n11'] },
  { id: 'n11', pos: [9, 0, -1], type: 'blue', next: ['n17'] },
  // Merge + tail back to start
  { id: 'n17', pos: [10, 0, 0], type: 'blue', next: ['n18'] },
  { id: 'n18', pos: [11, 0, 0], type: 'event', next: ['n19'], event: 'monkey_thief' },
  { id: 'n19', pos: [12, 0, 0], type: 'blue', next: ['n00'] },
];

const TEST_BOARD = {
  id: 'test_jungle',
  name: { en: 'Test Jungle', de: 'Test-Dschungel' },
  description: { en: 'Fixture board for sim tests.', de: 'Testbrett fuer Sim-Tests.' },
  difficulty: 1,
  theme: { sky: null, fog: null, ambient: null, palette: { primary: '#166534', secondary: '#0c4a6e', accent: '#f59e0b' } },
  music: { tempo: 110, scale: null, pattern: null },
  nodes: NODES,
  starSpawns: ['n07', 'n01', 'n19'],
  shops: [
    { node: 'n05', stock: ['double_dice', 'turbo_banana', 'shop_coupon', 'shield_shell', 'banana_peel', 'golden_ticket'] },
  ],
  events: {
    coin_gift: {
      description: { en: 'A friendly toucan drops 5 coins.', de: 'Ein Tukan wirft 5 Muenzen ab.' },
      handler(sim, playerId) {
        sim.coins(playerId, 5, 'event:coin_gift');
      },
    },
    monkey_thief: {
      description: { en: 'A thieving monkey grabs 4 coins.', de: 'Ein Diebaffe klaut 4 Muenzen.' },
      handler(sim, playerId) {
        sim.coins(playerId, -4, 'event:monkey_thief');
      },
    },
  },
  mechanics: [
    {
      id: 'jungle_wind',
      everyRounds: 3,
      onRoundStart(sim, mechState) {
        mechState.gusts = (mechState.gusts ?? 0) + 1;
        sim.blockNodes(['n13'], 1);
      },
      initialState: { gusts: 0 },
    },
  ],
  bossEvent: {
    id: 'kong',
    everyRounds: 4,
    handler(sim) {
      for (const pid of sim.state.turnOrder) sim.coins(pid, -3, 'boss:kong');
    },
  },
  view: null,
};

boards.register(TEST_BOARD);

// Dummy minigames so the round loop exercises minigame_select/minigame,
// anti-repeat (2 ffa games) and the boss cadence (1 boss game).
function registerTestMinigame(id, category) {
  minigames.register({
    id,
    name: { en: id, de: id },
    description: { en: '', de: '' },
    howTo: { en: '', de: '' },
    category,
    tags: [],
    players: { min: 2, max: 8 },
    durationSec: 30,
    competitiveSafe: true,
    params: {},
    createSim: () => { throw new Error('not used by the match sim'); },
    createView: () => { throw new Error('not used by the match sim'); },
    bot: () => ({ move: { x: 0, y: 0 }, a: false, b: false }),
  });
}
registerTestMinigame('mg_test_race', 'ffa');
registerTestMinigame('mg_test_climb', 'ffa');
registerTestMinigame('mg_test_boss', 'boss');

/* ------------------------------------------------------------------ */
/* Harness                                                             */
/* ------------------------------------------------------------------ */

const BOT_PLAYERS = [
  { id: 'b1', name: 'Bongo', isBot: true, difficulty: 'easy' },
  { id: 'b2', name: 'Kiki', isBot: true, difficulty: 'normal' },
  { id: 'b3', name: 'Mango', isBot: true, difficulty: 'hard' },
  { id: 'b4', name: 'Chimpy', isBot: true, difficulty: 'wild' },
];

function makeSim(seed, rules = {}) {
  return createMatchSim({
    seed,
    boardId: 'test_jungle',
    rules: { rounds: 10, ...rules },
    players: BOT_PLAYERS.map((p) => ({ ...p })),
  });
}

/**
 * Drive the match with the board bot (and a fake minigame reporter) until
 * game_over or until `stopAfterApplies` actions were applied.
 * Asserts every applied action was one of sim.legalActions().
 */
function drive(sim, botRng, { stopAfterApplies = Infinity } = {}) {
  let applies = 0;
  let guard = 0;
  while (applies < stopAfterApplies) {
    guard += 1;
    assert.ok(guard < 20000, 'match must terminate');
    const state = sim.getState();
    assert.ok(PHASES.includes(state.phase), `unknown phase "${state.phase}"`);
    if (state.phase === 'game_over') break;

    if (state.phase === 'minigame') {
      const ranking = botRng.shuffle(state.turnOrder);
      const coins = {};
      ranking.forEach((pid, i) => { coins[pid] = Math.max(0, 10 - i * 3); });
      sim.apply({
        type: 'minigameResults',
        playerId: state.turnOrder[0],
        payload: { results: { ranking, coins, stats: {} } },
      });
      applies += 1;
      continue;
    }

    const awaiting = state.awaiting;
    assert.ok(awaiting, `sim stalled in phase "${state.phase}" with no awaiting`);
    assert.ok(DECISION_TYPES.includes(awaiting.decision), `unknown decision "${awaiting.decision}"`);
    const legal = sim.legalActions(awaiting.playerId);
    assert.ok(legal.length > 0, `no legal actions for awaiting ${awaiting.decision}`);
    const difficulty = state.players[awaiting.playerId].difficulty ?? 'normal';
    const action = decideBoardAction(state, legal, awaiting.playerId, difficulty, botRng);
    assert.ok(legal.includes(action), 'bot must return one of the legal actions');
    sim.apply(action); // throws on any illegal action
    applies += 1;
  }
  return applies;
}

/* ------------------------------------------------------------------ */
/* Static purity guard                                                 */
/* ------------------------------------------------------------------ */

test('shared/ has zero imports from /src and no Math.random/Date.now in sim, ai, items', () => {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const collect = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? collect(full) : (full.endsWith('.js') ? [full] : []);
  });
  for (const file of collect(path.join(root, 'shared'))) {
    const src = fs.readFileSync(file, 'utf8');
    assert.ok(!/from\s+['"][^'"]*\/src\//.test(src), `${file} imports from /src`);
    assert.ok(!/import\s*\(\s*['"][^'"]*\/src\//.test(src), `${file} dynamic-imports from /src`);
    if (/shared[/\\](sim|ai|content[/\\]items)[/\\]/.test(file)) {
      assert.ok(!/Math\.random\s*\(/.test(src), `${file} calls Math.random()`);
      assert.ok(!/Date\.now\s*\(/.test(src), `${file} calls Date.now()`);
    }
  }
});

/* ------------------------------------------------------------------ */
/* Phase machine + awaiting basics                                     */
/* ------------------------------------------------------------------ */

test('createMatchSim: initial state and turn_start -> item -> roll phases', () => {
  const sim = makeSim(101);
  const state = sim.getState();
  assert.equal(state.boardId, 'test_jungle');
  assert.equal(state.round, 1);
  assert.equal(state.phase, 'roll'); // no start items -> item phase auto-advances
  assert.deepEqual(state.turnOrder, ['b1', 'b2', 'b3', 'b4']);
  assert.equal(state.awaiting.playerId, 'b1');
  assert.equal(state.awaiting.decision, 'roll');
  assert.ok(Object.isFrozen(state), 'getState() must be frozen');
  assert.ok(Object.isFrozen(state.players.b1), 'getState() must be deep-frozen');
  assert.ok(TEST_BOARD.starSpawns.includes(state.board.starNode));

  const phaseEvents = sim.getEventLog().filter((e) => e.type === 'phase').map((e) => e.phase);
  assert.deepEqual(phaseEvents.slice(0, 3), ['turn_start', 'item', 'roll']);
});

test('apply: rejects malformed and illegal actions', () => {
  const sim = makeSim(102);
  assert.throws(() => sim.apply(null), /action must be an object/);
  assert.throws(() => sim.apply({ type: 'nope', playerId: 'b1' }), /unknown action type/);
  assert.throws(() => sim.apply({ type: 'roll', playerId: 'ghost' }), /unknown player/);
  assert.throws(() => sim.apply({ type: 'roll', playerId: 'b2' }), /not "b2"'s decision/);
  assert.throws(() => sim.apply({ type: 'buyStar', playerId: 'b1' }), /expected a "roll" decision/);
  assert.throws(() => sim.apply({ type: 'minigameResults', playerId: 'b1', payload: { results: { ranking: [] } } }), /no minigame is pending/);
  // legal roll works and returns {events} (also iterable)
  const result = sim.apply({ type: 'roll', playerId: 'b1', payload: {} });
  assert.ok(Array.isArray(result.events) && result.events.length > 0);
  assert.deepEqual([...result], result.events);
  assert.ok(result.events.some((e) => e.type === 'dice' && e.playerId === 'b1'));
});

test('legalActions matches the awaiting decision for every state', () => {
  const sim = makeSim(103);
  const state = sim.getState();
  const legal = sim.legalActions('b1');
  assert.deepEqual(legal, [{ type: 'roll', playerId: 'b1', payload: {} }]);
  assert.deepEqual(sim.legalActions('b2'), [], 'not b2\'s turn');
  assert.equal(state.awaiting.decision, 'roll');
});

test('competitive rules use the dice draft (awaiting dicePick, 3 options)', () => {
  const sim = makeSim(104, { competitive: true });
  const state = sim.getState();
  assert.equal(state.phase, 'roll');
  assert.equal(state.awaiting.decision, 'dicePick');
  assert.equal(state.awaiting.options.length, 3);
  for (const v of state.awaiting.options) assert.ok(v >= 1 && v <= 6);
  const legal = sim.legalActions('b1');
  assert.equal(legal.length, 3);
  const result = sim.apply(legal[1]);
  const dice = result.events.find((e) => e.type === 'dice');
  assert.equal(dice.draft, true);
  assert.equal(dice.total, state.awaiting.options[1]);
});

/* ------------------------------------------------------------------ */
/* Full match with 4 bots                                              */
/* ------------------------------------------------------------------ */

test('full 10-round match with 4 bots runs to game_over with no illegal actions', () => {
  const sim = makeSim(0xC0FFEE);
  drive(sim, createRng(0xB0B));

  const state = sim.getState();
  assert.equal(state.phase, 'game_over');
  assert.equal(state.round, 10);
  assert.equal(state.awaiting, null);

  const log = sim.getEventLog();
  const over = log.filter((e) => e.type === 'game_over');
  assert.equal(over.length, 1);
  assert.equal(over[0].ranking.length, 4);
  assert.deepEqual([...over[0].ranking].sort(), ['b1', 'b2', 'b3', 'b4']);
  // Standings are sorted: bananas desc, then coins desc.
  const standings = over[0].standings;
  for (let i = 1; i < standings.length; i += 1) {
    const a = standings[i - 1];
    const b = standings[i];
    assert.ok(
      a.goldenBananas > b.goldenBananas
      || (a.goldenBananas === b.goldenBananas && a.coins >= b.coins)
      || (a.goldenBananas === b.goldenBananas && a.coins === b.coins),
      'ranking must follow bananas -> coins',
    );
  }
  // 10 rounds with minigameEvery=1 -> 10 minigames played (and recorded).
  assert.equal(log.filter((e) => e.type === 'minigame_start').length, 10);
  assert.equal(log.filter((e) => e.type === 'minigame_result').length, 10);
  assert.equal(state.minigameHistory.length, 10, 'played minigames are recorded in state');
  // Board mechanics fired on their cadence (rounds 3,6,9 / 4,8).
  assert.equal(log.filter((e) => e.type === 'mechanic' && e.id === 'jungle_wind').length, 3);
  assert.equal(log.filter((e) => e.type === 'boss' && e.id === 'kong').length, 2);
  // Bonus phase: 2 announced categories (minigame_king + 1 random), at most
  // one banana each.
  assert.equal(state.bonusCategories.length, 2);
  assert.equal(state.bonusCategories[0], 'minigame_king');
  const bonuses = log.filter((e) => e.type === 'bonus');
  assert.ok(bonuses.length >= 1 && bonuses.length <= 2, `1-2 bonus bananas (got ${bonuses.length})`);
  for (const b of bonuses) assert.ok(state.bonusCategories.includes(b.category), 'bonus matches an announced category');
  // The winner decision records whether a tiebreak decided it.
  assert.equal(typeof over[0].tiebreak, 'boolean');
  assert.ok(over[0].tiebreakBy === null || ['coins', 'minigameWins', 'turnOrder'].includes(over[0].tiebreakBy));
  // Coins never went negative anywhere along the way.
  for (const evt of log.filter((e) => e.type === 'coins')) {
    assert.ok(evt.total >= 0, 'coin totals must be clamped >= 0');
  }
  // Stats accumulated.
  const moved = state.turnOrder.reduce((sum, pid) => sum + state.players[pid].stats.fieldsMoved, 0);
  assert.ok(moved > 50, 'players actually moved');

  assert.throws(() => sim.apply({ type: 'roll', playerId: 'b1' }), /match is over/);
});

test('determinism: same seed twice -> byte-identical event log', () => {
  const simA = makeSim(424242);
  const simB = makeSim(424242);
  drive(simA, createRng(777));
  drive(simB, createRng(777));
  const logA = JSON.stringify(simA.getEventLog());
  const logB = JSON.stringify(simB.getEventLog());
  assert.equal(logA, logB);
  assert.equal(JSON.stringify(simA.getState()), JSON.stringify(simB.getState()));

  // ...and a different seed produces a different log.
  const simC = makeSim(424243);
  drive(simC, createRng(777));
  assert.notEqual(logA, JSON.stringify(simC.getEventLog()));
});

test('snapshot/restore mid-match resumes byte-identically (incl. RNG state)', () => {
  const sim = makeSim(0x5EED);
  const botRng = createRng(1234);

  drive(sim, botRng, { stopAfterApplies: 60 });
  const midState = JSON.stringify(sim.getState());
  const snap = sim.snapshot();
  const botState = botRng.state();

  drive(sim, botRng); // play run #1 to the end
  const finalLogA = JSON.stringify(sim.getEventLog());
  const finalStateA = JSON.stringify(sim.getState());
  assert.equal(sim.getState().phase, 'game_over');

  sim.restore(snap);
  botRng.setState(botState);
  assert.equal(JSON.stringify(sim.getState()), midState, 'restore returns to the snapshot state');

  drive(sim, botRng); // play run #2 to the end
  assert.equal(JSON.stringify(sim.getEventLog()), finalLogA, 'event logs must match byte-for-byte');
  assert.equal(JSON.stringify(sim.getState()), finalStateA);
});

test('snapshot survives JSON round-tripping (network-safe)', () => {
  const sim = makeSim(9911);
  const botRng = createRng(42);
  drive(sim, botRng, { stopAfterApplies: 25 });
  const snap = JSON.parse(JSON.stringify(sim.snapshot()));
  const before = JSON.stringify(sim.getState());
  drive(sim, botRng, { stopAfterApplies: 10 });
  sim.restore(snap);
  assert.equal(JSON.stringify(sim.getState()), before);
});

/* ------------------------------------------------------------------ */
/* Sim events / emitter                                                */
/* ------------------------------------------------------------------ */

test('on/off: emitter delivers typed events and wildcard, unsubscribes cleanly', () => {
  const sim = makeSim(31337);
  const dice = [];
  const all = [];
  const offDice = sim.on('dice', (e) => dice.push(e));
  sim.on('*', (e) => all.push(e));
  sim.apply({ type: 'roll', playerId: 'b1', payload: {} });
  assert.equal(dice.length, 1);
  assert.ok(all.length > 1);
  offDice();
  const countBefore = dice.length;
  // The next player also rolls at some point; simulate by driving one action.
  drive(sim, createRng(1), { stopAfterApplies: 5 });
  assert.equal(dice.length, countBefore, 'unsubscribed listener stays silent');
});

test('board bot returns a legal action for every awaiting state at every difficulty', () => {
  for (const difficulty of Object.keys(PROFILES)) {
    const sim = makeSim(555, { startItems: ['coconut_trap', 'swap_totem'] });
    const botRng = createRng(99);
    let guard = 0;
    while (sim.getState().phase !== 'game_over' && guard < 3000) {
      guard += 1;
      const state = sim.getState();
      if (state.phase === 'minigame') {
        sim.apply({
          type: 'minigameResults',
          playerId: state.turnOrder[0],
          payload: { results: { ranking: botRng.shuffle(state.turnOrder), coins: {}, stats: {} } },
        });
        continue;
      }
      const legal = sim.legalActions(state.awaiting.playerId);
      const action = decideBoardAction(state, legal, state.awaiting.playerId, difficulty, botRng);
      assert.ok(legal.includes(action), `bot(${difficulty}) returned an illegal action for ${state.awaiting.decision}`);
      sim.apply(action);
    }
    assert.equal(sim.getState().phase, 'game_over', `bot(${difficulty}) finished the match`);
  }
  assert.ok(getDifficultyProfile('wild').randomChance >= 0.3, 'wild is the erratic chaos profile');
  assert.ok(getDifficultyProfile('wild').noise > getDifficultyProfile('hard').noise, 'wild gambles louder than hard');
  assert.ok(
    getDifficultyProfile('hard').randomChance < getDifficultyProfile('normal').randomChance,
    'hard is the most consistent (strongest) profile',
  );
  assert.equal(getDifficultyProfile('easy').randomChance, 0.35);
  assert.equal(getDifficultyProfile('easy').topK, 3);
});

/* ------------------------------------------------------------------ */
/* Rules toggles: traps off, competitive neutralization, hardcore,     */
/* fastMode                                                            */
/* ------------------------------------------------------------------ */

test('rules.traps=false disarms built-in board traps; competitive neutralizes boss swings', () => {
  const sim = makeSim(0xACE, { competitive: true, traps: false });
  drive(sim, createRng(31));
  const log = sim.getEventLog();
  assert.equal(sim.getState().phase, 'game_over');

  const builtinTraps = log.filter((e) => e.type === 'trap' && e.builtin);
  for (const t of builtinTraps) assert.equal(t.disarmed, true, 'board trap fired despite traps:false');
  assert.ok(!log.some((e) => e.type === 'coins' && e.reason === 'board_trap'), 'no board-trap coin losses');

  // Round-cadence boss handler is announced but not run; boss FIELDS are a
  // fixed small -3 instead of the RNG handler.
  for (const b of log.filter((e) => e.type === 'boss')) {
    assert.equal(b.neutralized, true, `boss event not neutralized in competitive: ${JSON.stringify(b)}`);
  }
  assert.ok(!log.some((e) => e.type === 'coins' && e.reason === 'boss:kong'), 'kong handler never ran');
  for (const c of log.filter((e) => e.type === 'coins' && e.reason === 'boss')) {
    assert.ok(c.delta >= -3 && c.delta < 0, `boss field is a fixed small toll (got ${c.delta})`);
  }
  // No bonus bananas in competitive; categories announced as empty.
  assert.equal(log.filter((e) => e.type === 'bonus').length, 0);
  assert.deepEqual(sim.getState().bonusCategories, []);
});

test('hardcore: red fields cost -5 and no end-game bonus bananas', () => {
  const sim = makeSim(0xBEEF, { hardcore: true });
  drive(sim, createRng(32));
  const log = sim.getEventLog();
  assert.equal(sim.getState().phase, 'game_over');

  const reds = log.filter((e) => e.type === 'coins' && e.reason === 'field_red');
  assert.ok(reds.length > 0, 'someone landed on a red field');
  for (const c of reds) assert.ok(c.delta >= -5 && c.delta < 0, `red field delta -5..-1 (got ${c.delta})`);
  assert.ok(reds.some((c) => c.delta === -5), 'unclamped red field losses are -5 in hardcore');

  assert.equal(log.filter((e) => e.type === 'bonus').length, 0, 'no bonus bananas in hardcore');
  assert.deepEqual(sim.getState().bonusCategories, []);

  // Sanity: the same seed WITHOUT hardcore loses only -3 on red fields.
  const soft = makeSim(0xBEEF, {});
  drive(soft, createRng(32));
  const softReds = soft.getEventLog().filter((e) => e.type === 'coins' && e.reason === 'field_red');
  for (const c of softReds) assert.ok(c.delta >= -3, `normal red field delta >= -3 (got ${c.delta})`);
});

test('fastMode: state flag set, shop prompts the player cannot buy from are skipped', () => {
  const fast = makeSim(2024, { fastMode: true, startCoins: 0 });
  assert.equal(fast.getState().fastMode, true, 'views can read state.fastMode');
  // b1 has 0 coins: opening the shop must NOT stop the game in fastMode.
  assert.equal(fast.openShop('b1', 'n05', 'field'), false);
  assert.ok(fast.getEventLog().some((e) => e.type === 'shop' && e.kind === 'skipped' && e.reason === 'fast_mode'));
  assert.equal(fast.getState().awaiting.decision, 'roll', 'awaiting untouched by the skipped shop');

  // Without fastMode the same broke player still gets the (leave-only) prompt.
  const slow = makeSim(2024, { startCoins: 0 });
  assert.equal(slow.getState().fastMode, false);
  assert.equal(slow.openShop('b1', 'n05', 'field'), true);
  assert.equal(slow.getState().awaiting.decision, 'shop');
});

/* ------------------------------------------------------------------ */
/* Minigame selection: anti-repeat, boss cadence, crescendo, duel comp */
/* ------------------------------------------------------------------ */

test('minigame anti-repeat + boss cadence (every 4th and the final round)', () => {
  const sim = makeSim(0xFACE);
  drive(sim, createRng(41));
  const ids = sim.getEventLog().filter((e) => e.type === 'minigame_start').map((e) => e.minigameId);
  assert.equal(ids.length, 10);
  assert.deepEqual(sim.getState().minigameHistory, ids, 'history matches the played sequence');
  // Anti-repeat: the selector sees the history now, so the second pick must
  // differ from the first (2 ffa games rotate; boss only enters via cadence).
  assert.notEqual(ids[1], ids[0], 'anti-repeat forces a different second minigame');
  // Boss cadence: minigames #4 and #8, plus the final round, are boss games.
  assert.equal(ids[3], 'mg_test_boss', '4th minigame is a boss game');
  assert.equal(ids[7], 'mg_test_boss', '8th minigame is a boss game');
  assert.equal(ids[9], 'mg_test_boss', 'final-round minigame is a boss game');
});

test('endgame crescendo: minigame payouts double in the final 2 rounds', () => {
  const sim = makeSim(0xD1CE);
  drive(sim, createRng(42));
  const log = sim.getEventLog();
  const results = log.filter((e) => e.type === 'minigame_result');
  assert.equal(results.length, 10);
  results.forEach((r, i) => {
    assert.equal(r.crescendo, i >= 8, `minigame ${i + 1} crescendo flag`);
  });
  // The drive harness always reports coins {10,7,4,1}; the applied deltas
  // must be doubled for the last two minigames only.
  const starts = [];
  log.forEach((e, idx) => { if (e.type === 'minigame_start') starts.push(idx); });
  const deltasAfter = (idx) => log.slice(idx).filter((e) => e.type === 'coins' && e.reason === 'minigame')
    .slice(0, 4).map((e) => e.delta);
  for (const d of deltasAfter(starts[0])) assert.ok([10, 7, 4, 1].includes(d), `round-1 minigame delta ${d}`);
  for (const d of deltasAfter(starts[9])) assert.ok([20, 14, 8, 2].includes(d), `final-round minigame delta ${d}`);
});

test('duel minigames with >2 players pay sidelined players a consolation', () => {
  const sim = makeSim(0xD0E1);
  // Force a pending duel between b1 and b2 (b3/b4 sidelined).
  sim.state.phase = 'minigame';
  sim.state.minigame = { pendingId: 'mg_fake_duel', teams: [['b1'], ['b2']], params: {}, results: null };
  const before3 = sim.state.players.b3.coins;
  const before4 = sim.state.players.b4.coins;
  sim.apply({
    type: 'minigameResults',
    playerId: 'b1',
    payload: { results: { ranking: ['b1', 'b2'], coins: { b1: 10, b2: 3 }, stats: {} } },
  });
  assert.equal(sim.state.players.b3.coins, before3 + 3, 'sidelined b3 got 3 consolation coins');
  assert.equal(sim.state.players.b4.coins, before4 + 3, 'sidelined b4 got 3 consolation coins');
  const consolations = sim.getEventLog().filter((e) => e.type === 'coins' && e.reason === 'minigame_consolation');
  assert.deepEqual(consolations.map((e) => e.playerId).sort(), ['b3', 'b4']);
});

/* ------------------------------------------------------------------ */
/* Effect ticking semantics                                            */
/* ------------------------------------------------------------------ */

test('timed effects last exactly turnsLeft of the OWNER\'s turns, whenever applied', () => {
  const diceOf = (sim, pid) => sim.getEventLog().filter((e) => e.type === 'dice' && e.playerId === pid);

  // Case A: cursed BEFORE the victim's turn this round (items off = no
  // other effect sources interfere).
  const simA = makeSim(0xE1, { items: 'off' });
  simA.addEffect('b2', { id: 'dice_curse', turnsLeft: 1 });
  const rngA = createRng(51);
  let guard = 0;
  while (diceOf(simA, 'b2').length < 2 && guard++ < 3000) drive(simA, rngA, { stopAfterApplies: 1 });
  const rollsA = diceOf(simA, 'b2');
  assert.equal(rollsA[0].sides, 3, 'the very next roll is cursed (d3)');
  assert.equal(rollsA[1].sides, 6, 'the curse expired after exactly one of the owner\'s turns');

  // Case B: cursed AFTER the victim already moved this round - it must
  // still bite exactly one (the next) roll.
  const simB = makeSim(0xE2, { items: 'off' });
  const rngB = createRng(52);
  guard = 0;
  while (diceOf(simB, 'b2').length < 1 && guard++ < 3000) drive(simB, rngB, { stopAfterApplies: 1 });
  // b2 has rolled, so b1's turn is definitely over: curse b1 now.
  simB.addEffect('b1', { id: 'dice_curse', turnsLeft: 1 });
  guard = 0;
  while (diceOf(simB, 'b1').length < 3 && guard++ < 3000) drive(simB, rngB, { stopAfterApplies: 1 });
  const rollsB = diceOf(simB, 'b1');
  assert.equal(rollsB[0].sides, 6, 'roll before the curse was normal');
  assert.equal(rollsB[1].sides, 3, 'the next roll (following round) is cursed');
  assert.equal(rollsB[2].sides, 6, 'exactly one cursed roll, then back to a d6');
});

/* ------------------------------------------------------------------ */
/* Bot item usage                                                      */
/* ------------------------------------------------------------------ */

test('bots use double_dice when the star is affordable and within boosted reach', () => {
  // Constructed state: p1 on n00, star on n07 (distance 7 - beyond a d6,
  // within a boosted roll), 25 coins vs starPrice 20, holding double_dice.
  const initLikeStats = () => (
    { fieldsMoved: 0, coinsLost: 0, itemsUsed: 0, minigameWins: 0, minigameCoins: 0, eventsHit: 0 }
  );
  const state = {
    matchId: 'm_fix', seed: 1, boardId: 'test_jungle',
    rules: { starPrice: 20 },
    protocolVersion: 1,
    round: 1,
    phase: 'item',
    turnOrder: ['p1', 'p2'],
    currentTurn: 0,
    players: {
      p1: {
        id: 'p1', name: 'P1', characterId: null, cosmetics: {}, isBot: true, difficulty: 'wild',
        node: 'n00', facingNext: 'n01', coins: 25, goldenBananas: 0, items: ['double_dice'],
        effects: [], lastFieldColor: null, connected: true, stats: initLikeStats(),
      },
      p2: {
        id: 'p2', name: 'P2', characterId: null, cosmetics: {}, isBot: true, difficulty: 'wild',
        node: 'n12', facingNext: 'n13', coins: 5, goldenBananas: 1, items: [],
        effects: [], lastFieldColor: null, connected: true, stats: initLikeStats(),
      },
    },
    board: { starNode: 'n07', traps: {}, mechanics: {}, blockedNodes: [], shopStockOverrides: {} },
    minigame: null,
    awaiting: { playerId: 'p1', decision: 'roll', options: { usableItems: ['double_dice'] } },
    rngState: 0,
  };
  const legal = [
    { type: 'useItem', playerId: 'p1', payload: { itemId: 'double_dice' } },
    { type: 'skipItem', playerId: 'p1', payload: {} },
    { type: 'roll', playerId: 'p1', payload: {} },
  ];

  const usage = (difficulty) => {
    let used = 0;
    for (let seed = 1; seed <= 50; seed += 1) {
      const action = decideBoardAction(state, legal, 'p1', difficulty, createRng(seed));
      if (action.type === 'useItem' && action.payload.itemId === 'double_dice') used += 1;
    }
    return used;
  };
  assert.ok(usage('hard') >= 45, `hard bots almost always boost the star race (got ${usage('hard')}/50)`);
  assert.ok(usage('wild') >= 15, `erratic wild bots still use items regularly (got ${usage('wild')}/50)`);
  assert.ok(usage('normal') >= 30, `normal bots usually boost (got ${usage('normal')}/50)`);
});

/* ------------------------------------------------------------------ */
/* Stranding rescue + star reachability                                */
/* ------------------------------------------------------------------ */

test('a player whose every exit is blocked is rescued to the nearest open node', () => {
  const sim = makeSim(0x0B57);
  sim.blockNodes(['n13'], 1); // n12's only exit
  sim.state.players.b1.node = 'n12';
  sim.apply({ type: 'roll', playerId: 'b1', payload: {} });
  const log = sim.getEventLog();
  assert.ok(
    log.some((e) => e.type === 'move_step' && e.kind === 'rescued' && e.playerId === 'b1' && e.to === 'n14'),
    'b1 was teleported past the blockade to the nearest open node',
  );
  assert.equal(sim.state.players.b1.node, 'n14', 'b1 landed on the rescue node');
  assert.ok(!sim.state.board.blockedNodes.includes(sim.state.players.b1.node));
});

test('relocateStar only picks star spawns that are open and enterable', () => {
  const sim = makeSim(0x57A2);
  sim.state.board.starNode = 'n01';
  sim.blockNodes(['n07'], 3); // wall off one of the three spawns
  assert.equal(sim.relocateStar(), 'n19', 'the only reachable other spawn is chosen');
  assert.equal(sim.relocateStar(), 'n01', 'and back - n07 is never picked while blocked');
});
