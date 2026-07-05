/**
 * The deterministic board-game match simulation (IMatchSim).
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 *
 * createMatchSim({seed, rules, boardId, players}) drives the phase machine:
 *
 *   turn_start -> item -> roll -> move -> field -> (shop) -> next player
 *   ... after the last player: round_end -> minigame_select -> minigame
 *   -> round++ ... after the final round: bonus -> game_over
 *
 * The sim NEVER waits on wall-clock time. Whenever a player decision is
 * needed it sets state.awaiting = {playerId, decision, options} and stops
 * advancing until the matching Action arrives via apply(). The minigame
 * phase blocks (awaiting = null) until a 'minigameResults' action arrives.
 *
 * All randomness flows through the injected seeded RNG whose state is part
 * of every snapshot, so a fixed seed yields a byte-identical event log.
 */

import { createRng } from '../rng.js';
import { validateRules } from '../rules.js';
import { PROTOCOL_VERSION } from '../protocol.js';
import { createEmitter } from '../events.js';
import { MIN_PLAYERS, MAX_SEATS } from '../constants.js';
import { boards, items as itemsRegistry, minigames as minigamesRegistry } from '../registries.js';
import { assertActionShape, legalActionsFromState } from './actions.js';
import { rollDice, drawDiceDraft, resolveDraftPick } from './dice.js';
import { nodeById, openNextIds, forwardTargets, predecessorIds, beginMove, continueMove, performStep } from './movement.js';
import { applyField, triggerPlacedTrap } from './fields.js';
import { computeStock, canBuyAny, executeBuy, grantItem, pickRandomItemId, itemAllowed } from './shop.js';
import { runHook, addEffect as fxAddEffect, removeEffect as fxRemoveEffect, tickEffects } from './effects.js';
import { addCoins, addBananas, addMinigameCoins, awardBonuses, evaluateWinner, pickBonusCategoryIds } from './scoring.js';
import { initStats, bumpStat } from './stats.js';
import { deepClone, deepFreeze, createSnapshot, restoreSnapshot } from './serialize.js';

/* ------------------------------------------------------------------ */
/* Optional external minigame selector                                 */
/* ------------------------------------------------------------------ */

// shared/minigames/select.js belongs to a later package. Import it once at
// module load (guarded); when missing, the built-in fallback picker is used.
const SELECT_PATH = '../minigames/select.js';
let externalSelect = null;
try {
  const mod = await import(/* @vite-ignore */ SELECT_PATH);
  externalSelect = mod?.selectMinigame ?? mod?.default ?? null;
} catch {
  externalSelect = null;
}

/* ------------------------------------------------------------------ */
/* Factory                                                             */
/* ------------------------------------------------------------------ */

/**
 * @param {{
 *   seed: number,
 *   rules?: Partial<import('../types.js').Rules>,
 *   boardId: string,
 *   players: {id: string, name?: string, characterId?: string|null,
 *     cosmetics?: Object, isBot?: boolean, difficulty?: string|null}[],
 * }} cfg
 * @returns {Object} IMatchSim (see shared/types.js).
 */
export function createMatchSim({ seed, rules: rawRules, boardId, players: playerCfgs }) {
  const rules = validateRules(rawRules ?? {});
  const board = boards.get(boardId);
  if (!board) throw new Error(`[sim] createMatchSim: unknown board "${boardId}"`);
  if (!Array.isArray(playerCfgs) || playerCfgs.length < MIN_PLAYERS || playerCfgs.length > MAX_SEATS) {
    throw new Error(`[sim] createMatchSim: players must be an array of ${MIN_PLAYERS}..${MAX_SEATS}`);
  }
  const ids = playerCfgs.map((p) => p?.id);
  if (ids.some((id) => typeof id !== 'string' || id.length === 0) || new Set(ids).size !== ids.length) {
    throw new Error('[sim] createMatchSim: player ids must be unique non-empty strings');
  }

  const seedU = Number(seed) >>> 0;
  const rng = createRng(seedU);
  const emitter = createEmitter();

  const startNode = board.nodes.find((n) => n.type === 'start') ?? board.nodes[0];
  const starSpawns = board.starSpawns?.length ? board.starSpawns : [startNode.id];

  /** @type {import('../types.js').MatchState} */
  const state = {
    matchId: `m_${seedU.toString(36)}`,
    seed: seedU,
    boardId,
    rules,
    protocolVersion: PROTOCOL_VERSION,
    round: 1,
    phase: 'turn_start',
    turnOrder: ids.slice(), // seat order == turn order (deterministic)
    currentTurn: 0,
    players: {},
    board: {
      starNode: rng.pick(starSpawns),
      traps: {},
      mechanics: {},
      blockedNodes: [],
      shopStockOverrides: {},
    },
    minigame: null,
    minigameHistory: [], // ids of minigames already played (anti-repeat)
    bonusCategories: [], // end-game bonus categories, announced up front
    fastMode: rules.fastMode, // surfaced top-level so views can shorten timers
    awaiting: null,
    rngState: 0,
  };
  state.bonusCategories = pickBonusCategoryIds(rng, rules);
  for (const cfg of playerCfgs) {
    state.players[cfg.id] = {
      id: cfg.id,
      name: cfg.name ?? cfg.id,
      characterId: cfg.characterId ?? null,
      cosmetics: { hat: null, skin: null, accessory: null, ...(cfg.cosmetics ?? {}) },
      isBot: !!cfg.isBot,
      difficulty: cfg.isBot ? (cfg.difficulty ?? rules.botDifficulty) : null,
      node: startNode.id,
      facingNext: startNode.next?.[0] ?? null,
      coins: rules.startCoins,
      goldenBananas: 0,
      items: [],
      effects: [],
      lastFieldColor: null,
      connected: true,
      stats: initStats(),
    };
  }
  for (const mech of board.mechanics ?? []) {
    state.board.mechanics[mech.id] = deepClone(mech.initialState ?? {});
  }

  /** Sim-internal (but fully serializable) continuation data. */
  const internal = {
    moveSteps: 0,
    resume: null, // 'move' | 'field' | 'item' - what to do after the awaiting resolves
    allSameIndex: 0,
    blockedUntil: {},
  };

  /** @type {Object[]} Append-only log of every SimEvent ever emitted. */
  const eventLog = [];
  /** @type {Object[]|null} Events of the apply() currently executing. */
  let currentBatch = null;

  /** The sim object handed to items, boards, hooks, and modules. */
  const sim = {};

  /* ---------------- events -------------------------------------- */

  function emit(type, payload = {}) {
    const evt = { type, ...payload };
    eventLog.push(evt);
    if (currentBatch) currentBatch.push(evt);
    emitter.emit(type, evt);
    emitter.emit('*', evt);
    return evt;
  }

  /* ---------------- small helpers -------------------------------- */

  function currentPlayerId() {
    return state.turnOrder[state.currentTurn] ?? state.turnOrder[0];
  }

  function otherPlayerIds(pid) {
    return state.turnOrder.filter((p) => p !== pid);
  }

  function setPhase(phase) {
    state.phase = phase;
    emit('phase', { phase, round: state.round, playerId: currentPlayerId() });
  }

  function setAwaiting(awaiting, resume = null) {
    state.awaiting = awaiting;
    internal.resume = resume;
  }

  function clearAwaiting() {
    state.awaiting = null;
    internal.resume = null;
  }

  function starPriceFor(pid) {
    const price = runHook(sim, 'onStarPrice', pid, rules.starPrice, {});
    return Math.max(0, Math.round(Number(price) || 0));
  }

  /* ---------------- sim helper surface (for items/boards) -------- */

  function coins(pid, delta, reason = 'helper') {
    return addCoins(sim, pid, delta, reason);
  }

  function giveItem(pid, itemIdOrRandom = 'random') {
    if (rules.items === 'off') return null;
    const itemId = itemIdOrRandom === 'random' ? pickRandomItemId(sim) : itemIdOrRandom;
    if (itemId === null) return null;
    const def = itemsRegistry.get(itemId);
    if (!def) throw new Error(`[sim] giveItem: unknown item "${itemId}"`);
    return grantItem(sim, pid, itemId, 'grant');
  }

  /** Relocation WITH landing triggers (placed traps spring, onLandNode runs). */
  function movePlayer(pid, nodeId) {
    nodeById(board, nodeId);
    const player = state.players[pid];
    if (!player) throw new Error(`[sim] movePlayer: unknown player "${pid}"`);
    const from = player.node;
    player.node = nodeId;
    player.facingNext = openNextIds(sim, nodeId)[0] ?? null;
    emit('move_step', { kind: 'relocate', playerId: pid, from, to: nodeId });
    triggerPlacedTrap(sim, pid, nodeId);
    runHook(sim, 'onLandNode', pid, null, { node: nodeId, relocated: true });
    return nodeId;
  }

  /** Silent relocation - no triggers at all (golden_ticket, chaos_box). */
  function teleport(pid, nodeId) {
    nodeById(board, nodeId);
    const player = state.players[pid];
    if (!player) throw new Error(`[sim] teleport: unknown player "${pid}"`);
    const from = player.node;
    player.node = nodeId;
    player.facingNext = openNextIds(sim, nodeId)[0] ?? null;
    emit('move_step', { kind: 'teleport', playerId: pid, from, to: nodeId });
    return nodeId;
  }

  /** Consume a held shield_shell to block a trap/steal. */
  function tryBlockWithShield(pid, source) {
    const player = state.players[pid];
    if (!player) return false;
    const idx = player.items.indexOf('shield_shell');
    if (idx === -1) return false;
    player.items.splice(idx, 1);
    emit('item', { kind: 'consumed', playerId: pid, itemId: 'shield_shell', blocked: source });
    return true;
  }

  function stealCoins(fromPid, toPid, n) {
    if (!state.players[fromPid] || !state.players[toPid]) {
      throw new Error('[sim] stealCoins: unknown player');
    }
    const amount = Math.min(state.players[fromPid].coins, Math.max(0, Math.trunc(Number(n) || 0)));
    if (amount <= 0) return 0;
    if (tryBlockWithShield(fromPid, 'steal')) return 0;
    addCoins(sim, fromPid, -amount, 'steal');
    addCoins(sim, toPid, amount, 'steal');
    return amount;
  }

  function addEffect(pid, effect) {
    fxAddEffect(sim, pid, effect);
  }

  function removeEffect(pid, effectId) {
    return fxRemoveEffect(sim, pid, effectId);
  }

  function blockNodes(nodeIds, rounds = 1) {
    const until = state.round + Math.max(1, Math.trunc(rounds));
    for (const id of nodeIds) {
      nodeById(board, id);
      if (!state.board.blockedNodes.includes(id)) state.board.blockedNodes.push(id);
      internal.blockedUntil[id] = until;
    }
    emit('mechanic', { kind: 'blocked', nodes: [...nodeIds], rounds });
  }

  /** A star spawn is reachable when it is open and has an open predecessor. */
  function starSpawnReachable(id) {
    const blocked = state.board.blockedNodes;
    if (blocked.includes(id)) return false;
    return predecessorIds(board, id).some((pred) => !blocked.includes(pred));
  }

  function relocateStar() {
    let candidates = starSpawns.filter((id) => id !== state.board.starNode && starSpawnReachable(id));
    if (candidates.length === 0) {
      // Everything else is walled off: allow re-picking the current node too.
      candidates = starSpawns.filter((id) => starSpawnReachable(id));
    }
    const next = candidates.length > 0 ? rng.pick(candidates) : state.board.starNode;
    state.board.starNode = next;
    emit('star', { kind: 'relocated', node: next });
    return next;
  }

  function placeTrap(ownerId, nodeId, itemId) {
    nodeById(board, nodeId);
    if (state.board.traps[nodeId]) throw new Error(`[sim] placeTrap: node "${nodeId}" already has a trap`);
    state.board.traps[nodeId] = { itemId, ownerId };
    emit('trap', { kind: 'placed', playerId: ownerId, itemId, node: nodeId });
  }

  /**
   * Prompt the current player to buy the star where they stand (used by
   * golden_ticket after teleporting). Returns false when not affordable.
   */
  function promptStar(pid) {
    const price = starPriceFor(pid);
    if (state.players[pid].coins < price) return false;
    setAwaiting({ playerId: pid, decision: 'buyStar', options: { price, node: state.board.starNode } }, 'item');
    return true;
  }

  function openShop(pid, nodeId, resume) {
    const stock = computeStock(sim, pid, nodeId);
    if (stock.length === 0) {
      emit('shop', { kind: 'closed', playerId: pid, node: nodeId });
      return false;
    }
    // fastMode: never stop the game for a shop the player cannot buy from
    // anyway (no affordable item / bag full) - the only answer would be
    // "leave".
    if (rules.fastMode && !canBuyAny(sim, pid, nodeId)) {
      emit('shop', { kind: 'skipped', playerId: pid, node: nodeId, reason: 'fast_mode' });
      return false;
    }
    emit('shop', { kind: 'open', playerId: pid, node: nodeId });
    setAwaiting({ playerId: pid, decision: 'shop', options: { node: nodeId, stock } }, resume);
    return true;
  }

  /* ---------------- item usability ------------------------------- */

  function trapTargets(pid) {
    const player = state.players[pid];
    return forwardTargets(board, player.node, 5)
      .filter(({ id }) => !state.board.traps[id]
        && id !== state.board.starNode
        && !state.board.blockedNodes.includes(id)
        && nodeById(board, id).type !== 'start')
      .map(({ id }) => id);
  }

  function usableItems(pid) {
    if (rules.items === 'off') return [];
    const player = state.players[pid];
    const seen = new Set();
    const usable = [];
    for (const itemId of player.items) {
      if (seen.has(itemId)) continue;
      seen.add(itemId);
      const def = itemsRegistry.get(itemId);
      if (!def || def.phase === 'passive') continue;
      if (!itemAllowed(sim, def)) continue;
      if (def.phase === 'trapPlace' && trapTargets(pid).length === 0) continue;
      if (def.target === 'player' && otherPlayerIds(pid).length === 0) continue;
      usable.push(itemId);
    }
    return usable;
  }

  /* ---------------- phase machine -------------------------------- */

  function startTurn() {
    const pid = currentPlayerId();
    setPhase('turn_start');
    runHook(sim, 'onTurnStart', pid, null, {});
    enterItemPhase();
  }

  function enterItemPhase() {
    const pid = currentPlayerId();
    setPhase('item');
    const usable = usableItems(pid);
    if (usable.length === 0) {
      enterRollPhase();
      return;
    }
    setAwaiting({ playerId: pid, decision: 'roll', options: { usableItems: usable } }, null);
  }

  function enterRollPhase() {
    const pid = currentPlayerId();
    setPhase('roll');
    if (rules.competitive) {
      const draft = drawDiceDraft(sim, pid);
      setAwaiting({ playerId: pid, decision: 'dicePick', options: draft }, null);
    } else {
      setAwaiting({ playerId: pid, decision: 'roll', options: null }, null);
    }
  }

  function rollAndMove(pid, total) {
    setPhase('move');
    beginMove(sim, pid, total);
  }

  /** Landing: field phase, node effect, then next player (unless a shop opened). */
  function land() {
    const pid = currentPlayerId();
    const player = state.players[pid];
    const node = nodeById(board, player.node);
    setPhase('field');
    applyField(sim, pid, node);
    runHook(sim, 'onLandNode', pid, null, { node: node.id, fieldType: node.type });
    if (state.awaiting) return; // shop opened with resume 'field'
    endTurn();
  }

  function endTurn() {
    const pid = currentPlayerId();
    // Effects tick at the END of their OWNER's turn (per-owner turn
    // semantics): an effect with turnsLeft N affects exactly N of the
    // owner's rolls/turns, no matter where in the turn order it was applied.
    tickEffects(sim, pid);
    clearAwaiting();
    if (state.currentTurn + 1 < state.turnOrder.length) {
      state.currentTurn += 1;
      startTurn();
    } else {
      roundEnd();
    }
  }

  function roundEnd() {
    state.currentTurn = 0;
    setPhase('round_end');
    // Board mechanics + boss event fire on their everyRounds cadence.
    for (const mech of board.mechanics ?? []) {
      if (mech.everyRounds > 0 && state.round % mech.everyRounds === 0) {
        emit('mechanic', { id: mech.id, round: state.round });
        mech.onRoundStart?.(sim, state.board.mechanics[mech.id]);
      }
    }
    const boss = board.bossEvent;
    if (boss && boss.everyRounds > 0 && state.round % boss.everyRounds === 0) {
      if (rules.competitive) {
        // Competitive: boss coin swings are pure RNG - announce, don't run.
        emit('boss', { kind: 'event', id: boss.id, round: state.round, neutralized: true });
      } else {
        emit('boss', { kind: 'event', id: boss.id, round: state.round });
        boss.handler?.(sim);
      }
    }
    // Expire node blocks whose time is up.
    state.board.blockedNodes = state.board.blockedNodes.filter((id) => {
      const until = internal.blockedUntil[id];
      if (until !== undefined && until <= state.round) {
        delete internal.blockedUntil[id];
        return false;
      }
      return true;
    });
    // A mechanic may have walled the star in - move it somewhere buyable.
    if (!starSpawnReachable(state.board.starNode)) relocateStar();
    enterMinigameSelect();
  }

  function buildTeams(category) {
    const pids = rng.shuffle(state.turnOrder);
    switch (category) {
      case '2v2':
      case 'team': {
        const half = Math.ceil(pids.length / 2);
        return [pids.slice(0, half), pids.slice(half)];
      }
      case 'duel':
        return [[pids[0]], [pids[1]]];
      case '1v3':
        return [[pids[0]], pids.slice(1)];
      default:
        return null; // ffa / boss: everyone for themselves
    }
  }

  /** Every Nth minigame (and the final round) forces a boss game. */
  const BOSS_MINIGAME_EVERY = 4;
  /** Recent minigame ids hard-excluded by the built-in fallback picker. */
  const ANTI_REPEAT_WINDOW = 8;

  /** Run the external selector under (possibly overridden) rules. */
  function selectViaExternal(effectiveRules) {
    if (!externalSelect) return null;
    try {
      const picked = externalSelect({
        state: getState(),
        rng,
        minigames: minigamesRegistry,
        rules: effectiveRules,
        history: state.minigameHistory.slice(),
      });
      if (picked && typeof picked.id === 'string' && minigamesRegistry.get(picked.id)) {
        const def = minigamesRegistry.get(picked.id);
        return {
          id: picked.id,
          teams: picked.teams ?? buildTeams(def.category),
          params: deepClone(picked.params ?? def.params ?? {}),
        };
      }
    } catch {
      // fall through to the built-in picker
    }
    return null;
  }

  /** Built-in registry picker (anti-repeat + soft duel guard at >2 players). */
  function pickFromRegistry(categories) {
    const count = state.turnOrder.length;
    let pool = minigamesRegistry.all().filter((def) => {
      if (rules.competitive && !def.competitiveSafe) return false;
      if (!(categories.includes('*') || categories.includes(def.category))) return false;
      const min = def.players?.min ?? 1;
      const max = def.players?.max ?? MAX_SEATS;
      return min <= count && count <= max;
    });
    // Duel games sideline everyone but 2 players - avoid them at >2 players
    // whenever anything else is available.
    if (count > 2) {
      const nonDuel = pool.filter((def) => def.category !== 'duel');
      if (nonDuel.length > 0) pool = nonDuel;
    }
    // Anti-repeat: exclude recently played ids unless that empties the pool.
    const recent = new Set(state.minigameHistory.slice(-ANTI_REPEAT_WINDOW));
    const fresh = pool.filter((def) => !recent.has(def.id));
    if (fresh.length > 0) pool = fresh;
    const def = rng.pick(pool);
    if (!def) return null;
    return { id: def.id, teams: buildTeams(def.category), params: deepClone(def.params ?? {}) };
  }

  function pickMinigame() {
    // Boss cadence: every BOSS_MINIGAME_EVERY-th minigame - and the final
    // round - forces a boss-category game when the rules allow one and any
    // fits the table. Selection preference is passed via minigameCategories.
    const bossAllowed = rules.minigameCategories.includes('*') || rules.minigameCategories.includes('boss');
    const bossDue = bossAllowed
      && ((state.minigameHistory.length + 1) % BOSS_MINIGAME_EVERY === 0 || state.round >= rules.rounds);
    if (bossDue) {
      const boss = selectViaExternal({ ...rules, minigameCategories: ['boss'] }) ?? pickFromRegistry(['boss']);
      if (boss) return boss;
    }
    return selectViaExternal(rules) ?? pickFromRegistry(rules.minigameCategories);
  }

  function enterMinigameSelect() {
    if (!rules.minigameEvery || state.round % rules.minigameEvery !== 0) {
      nextRound();
      return;
    }
    setPhase('minigame_select');
    const picked = pickMinigame();
    if (!picked) {
      nextRound();
      return;
    }
    state.minigame = { pendingId: picked.id, teams: picked.teams, params: picked.params, results: null };
    emit('minigame_start', {
      minigameId: picked.id, teams: picked.teams, params: picked.params, round: state.round,
    });
    setPhase('minigame');
    clearAwaiting(); // blocks until a 'minigameResults' action arrives
  }

  function nextRound() {
    state.minigame = null;
    if (state.round >= rules.rounds) {
      enterBonus();
      return;
    }
    state.round += 1;
    state.currentTurn = 0;
    startTurn();
  }

  function enterBonus() {
    setPhase('bonus');
    awardBonuses(sim); // no-op in competitive/hardcore
    const { ranking, tiebreak } = evaluateWinner(sim);
    setPhase('game_over');
    clearAwaiting();
    emit('game_over', {
      ranking,
      winner: ranking[0],
      tiebreak: tiebreak !== null, // true when bananas alone did not decide it
      tiebreakBy: tiebreak, // 'coins' | 'minigameWins' | 'turnOrder' | null
      standings: ranking.map((pid) => ({
        playerId: pid,
        goldenBananas: state.players[pid].goldenBananas,
        coins: state.players[pid].coins,
        minigameWins: state.players[pid].stats.minigameWins,
      })),
    });
  }

  /* ---------------- action handlers ------------------------------ */

  function requireDecision(decision, pid) {
    const awaiting = state.awaiting;
    if (!awaiting) throw new Error(`[sim] apply(): no decision pending (phase "${state.phase}")`);
    if (awaiting.playerId !== pid) throw new Error(`[sim] apply(): it is not "${pid}"'s decision`);
    if (awaiting.decision !== decision) {
      throw new Error(`[sim] apply(): expected a "${awaiting.decision}" decision, got "${decision}"`);
    }
    return awaiting;
  }

  function resumeAfter(tag) {
    switch (tag) {
      case 'move': continueMove(sim); return;
      case 'field': endTurn(); return;
      case 'item': enterRollPhase(); return;
      default:
        throw new Error(`[sim] internal: unknown resume tag "${tag}"`);
    }
  }

  function executeItem(pid, itemId, target) {
    clearAwaiting();
    const def = itemsRegistry.get(itemId);
    const player = state.players[pid];
    if (rules.items !== 'infinite') {
      const idx = player.items.indexOf(itemId);
      if (idx !== -1) player.items.splice(idx, 1);
    }
    emit('item', { kind: 'used', playerId: pid, itemId, target: target ?? null });
    def.effect(sim, pid, target ?? undefined);
    bumpStat(sim, pid, 'itemsUsed');
    runHook(sim, 'onItemUse', pid, { itemId, target: target ?? null }, {});
    // The item may itself open a prompt (golden_ticket -> buyStar, resume 'item').
    if (state.awaiting) return;
    enterRollPhase();
  }

  function handleUseItem(pid, payload) {
    const awaiting = requireDecision('roll', pid);
    if (state.phase !== 'item') throw new Error('[sim] useItem: items can only be used in the item phase');
    const itemId = payload.itemId;
    const usable = awaiting.options?.usableItems ?? [];
    if (!usable.includes(itemId)) throw new Error(`[sim] useItem: "${itemId}" cannot be used now`);
    const def = itemsRegistry.get(itemId);

    if (def.target === 'player' || def.target === 'node') {
      const options = def.target === 'player' ? otherPlayerIds(pid) : trapTargets(pid);
      const chosen = payload.target;
      if (chosen !== undefined && chosen !== null) {
        if (!options.includes(chosen)) throw new Error(`[sim] useItem: invalid target "${chosen}"`);
        executeItem(pid, itemId, chosen);
        return;
      }
      setAwaiting({ playerId: pid, decision: 'itemTarget', options, itemId }, 'item');
      return;
    }
    executeItem(pid, itemId, payload.target ?? null);
  }

  function handleMinigameResults(pid, payload) {
    if (state.phase !== 'minigame' || !state.minigame) {
      throw new Error('[sim] minigameResults: no minigame is pending');
    }
    const results = payload.results;
    if (!results || typeof results !== 'object' || !Array.isArray(results.ranking)) {
      throw new Error('[sim] minigameResults: payload.results.ranking must be an array');
    }
    state.minigame.results = deepClone(results);
    const coinsMap = results.coins ?? {};
    // Endgame crescendo: minigame payouts double in the final 2 rounds so
    // late games stay winnable.
    const crescendo = state.round >= rules.rounds - 1 ? 2 : 1;
    for (const p of state.turnOrder) {
      const n = Number(coinsMap[p] ?? 0) * crescendo;
      if (n !== 0) addMinigameCoins(sim, p, n);
    }
    // Consolation for players a team split sidelined entirely (duel with
    // more than 2 players at the table).
    if (Array.isArray(state.minigame.teams)) {
      const participants = new Set(state.minigame.teams.flat());
      for (const p of state.turnOrder) {
        if (!participants.has(p)) addCoins(sim, p, 3, 'minigame_consolation');
      }
    }
    const first = results.ranking[0];
    for (const w of Array.isArray(first) ? first : [first]) {
      if (state.players[w]) bumpStat(sim, w, 'minigameWins');
    }
    emit('minigame_result', {
      minigameId: state.minigame.pendingId,
      results: deepClone(results),
      crescendo: crescendo > 1,
    });
    state.minigameHistory.push(state.minigame.pendingId);
    nextRound();
  }

  function dispatch(type, pid, payload) {
    if (type === 'emote') {
      emit('emote', { playerId: pid, emoteId: payload.emoteId ?? null });
      return;
    }
    if (state.phase === 'game_over') throw new Error('[sim] apply(): the match is over');
    if (type === 'minigameResults') {
      handleMinigameResults(pid, payload);
      return;
    }

    switch (type) {
      case 'roll': {
        requireDecision('roll', pid);
        const fromItemPhase = state.phase === 'item';
        clearAwaiting();
        if (fromItemPhase && rules.competitive) {
          enterRollPhase(); // dice draft
          return;
        }
        if (fromItemPhase) setPhase('roll');
        rollAndMove(pid, rollDice(sim, pid));
        return;
      }
      case 'useItem':
        handleUseItem(pid, payload);
        return;
      case 'skipItem': {
        const awaiting = state.awaiting;
        if (awaiting?.playerId === pid && awaiting.decision === 'itemTarget') {
          clearAwaiting();
          enterItemPhase(); // cancel targeting, back to the item menu
          return;
        }
        requireDecision('roll', pid);
        if (state.phase !== 'item') throw new Error('[sim] skipItem: not in the item phase');
        clearAwaiting();
        enterRollPhase();
        return;
      }
      case 'junction': {
        const awaiting = requireDecision('junction', pid);
        const choice = payload.choice;
        if (!awaiting.options.includes(choice)) {
          throw new Error(`[sim] junction: "${choice}" is not one of the open paths`);
        }
        clearAwaiting();
        if (performStep(sim, pid, choice) === 'continue') continueMove(sim);
        return;
      }
      case 'buyStar': {
        const awaiting = requireDecision('buyStar', pid);
        const resume = internal.resume;
        const price = awaiting.options.price;
        clearAwaiting();
        addCoins(sim, pid, -price, 'star');
        addBananas(sim, pid, 1, 'star');
        emit('star', { kind: 'bought', playerId: pid, node: state.board.starNode, price });
        relocateStar();
        resumeAfter(resume);
        return;
      }
      case 'declineStar': {
        requireDecision('buyStar', pid);
        const resume = internal.resume;
        clearAwaiting();
        emit('star', { kind: 'declined', playerId: pid, node: state.board.starNode });
        resumeAfter(resume);
        return;
      }
      case 'shopBuy': {
        const awaiting = requireDecision('shop', pid);
        const result = executeBuy(sim, pid, awaiting.options.node, payload.itemId);
        if (!result.ok) throw new Error(`[sim] shopBuy: ${result.error}`);
        // Refresh prices/stock (coupon may be gone now); keep the resume tag.
        const stock = computeStock(sim, pid, awaiting.options.node);
        setAwaiting(
          { playerId: pid, decision: 'shop', options: { node: awaiting.options.node, stock } },
          internal.resume,
        );
        return;
      }
      case 'shopLeave': {
        requireDecision('shop', pid);
        const resume = internal.resume;
        clearAwaiting();
        emit('shop', { kind: 'leave', playerId: pid });
        resumeAfter(resume);
        return;
      }
      case 'dicePick': {
        const awaiting = requireDecision('dicePick', pid);
        const index = payload.index;
        if (!Number.isInteger(index) || index < 0 || index >= awaiting.options.length) {
          throw new Error('[sim] dicePick: payload.index out of range');
        }
        const value = awaiting.options[index];
        clearAwaiting();
        rollAndMove(pid, resolveDraftPick(sim, pid, value));
        return;
      }
      case 'itemTarget': {
        const awaiting = requireDecision('itemTarget', pid);
        const target = payload.target;
        if (!awaiting.options.includes(target)) {
          throw new Error(`[sim] itemTarget: invalid target "${target}"`);
        }
        executeItem(pid, awaiting.itemId, target);
        return;
      }
      default:
        throw new Error(`[sim] apply(): unhandled action type "${type}"`);
    }
  }

  /* ---------------- IMatchSim surface ----------------------------- */

  /** @returns {Object} Deep-frozen public snapshot of the MatchState. */
  function getState() {
    state.rngState = rng.state();
    return deepFreeze(deepClone(state));
  }

  /**
   * Every legal Action for a player right now.
   * @param {string} pid
   * @returns {import('../types.js').Action[]}
   */
  function legalActions(pid) {
    state.rngState = rng.state();
    return legalActionsFromState(state, pid);
  }

  /**
   * Validate -> mutate -> emit SimEvents -> return {events}.
   * The returned object is also iterable over the events for convenience.
   * @param {import('../types.js').Action} action
   * @returns {{events: Object[]}}
   */
  function apply(action) {
    assertActionShape(action);
    if (!state.players[action.playerId]) {
      throw new Error(`[sim] apply(): unknown player "${action.playerId}"`);
    }
    const batch = [];
    currentBatch = batch;
    try {
      dispatch(action.type, action.playerId, action.payload ?? {});
    } finally {
      currentBatch = null;
    }
    return {
      events: batch,
      [Symbol.iterator]() {
        return batch[Symbol.iterator]();
      },
    };
  }

  function snapshot() {
    state.rngState = rng.state();
    return createSnapshot({ state, internal, rngState: rng.state(), eventLog });
  }

  function restore(snap) {
    const parts = restoreSnapshot(snap);
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, parts.state);
    for (const key of Object.keys(internal)) delete internal[key];
    Object.assign(internal, parts.internal);
    rng.setState(parts.rngState);
    eventLog.length = 0;
    eventLog.push(...parts.eventLog);
  }

  Object.assign(sim, {
    // IMatchSim
    getState,
    legalActions,
    apply,
    on: emitter.on,
    off: emitter.off,
    snapshot,
    restore,
    applyState: restore, // alias used by session replicas

    // helper surface for board/item handlers
    coins,
    giveItem,
    movePlayer,
    teleport,
    stealCoins,
    addEffect,
    removeEffect,
    blockNodes,
    relocateStar,
    emit,
    placeTrap,
    promptStar,
    tryBlockWithShield,
    openShop,
    starPriceFor,
    currentPlayerId,

    // direct access for handlers and sim modules
    rng,
    state,
    internal,
    board,
    rules,

    // internal plumbing used by movement/fields
    setAwaiting,
    land,

    // observability
    getEventLog: () => deepClone(eventLog),
  });

  /* ---------------- kickoff --------------------------------------- */

  if (rules.items !== 'off') {
    for (const pid of state.turnOrder) {
      for (const itemId of rules.startItems) {
        const def = itemsRegistry.get(itemId);
        if (def && itemAllowed(sim, def)) grantItem(sim, pid, itemId, 'start');
      }
    }
  }
  startTurn();

  return sim;
}

export default createMatchSim;
