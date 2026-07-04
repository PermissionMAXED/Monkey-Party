/**
 * Authoritative match room.
 *
 * Owns the ONLY sim that matters (clients keep replicas):
 * - start: random seed -> match_start{seed,rules,boardId,players} -> build
 *   createMatchSim. Clients replay the same inputs deterministically.
 * - board phase: accepts action{action} exclusively from the awaited
 *   player (or the bot host), re-validates against sim.legalActions, then
 *   applies + broadcasts action_applied{action,events}. Humans get a 25s
 *   decision timeout after which the bot host decides for them.
 * - minigame phase: the sim (via shared/minigames/select.js) picks the
 *   game; the room broadcasts mg_start, runs the registry sim at a fixed
 *   30Hz (setInterval + accumulator drift correction), consumes the latest
 *   mg_input{seq,frame} per player (stale seqs ignored), asks the bot host
 *   for bot/disconnected frames, broadcasts mg_state at 15Hz, and on
 *   finish broadcasts mg_end{results} + injects the minigameResults action.
 * - game over: the room lingers for a rematch window, then disposes all
 *   timers and reopens the lobby.
 *
 * Nothing a client sends is trusted: payloads are sanitized, actions are
 * re-validated, inputs from non-participants are ignored.
 */

import crypto from 'node:crypto';
import { SRV } from '#shared/protocol.js';
import { createMatchSim } from '#shared/sim/match.js';
import { minigames as minigameRegistry } from '#shared/registries.js';
import { clampFrame, emptyFrame } from '#shared/minigames/inputs.js';
import { createBotHost } from './botHost.js';

/* ------------------------------------------------------------------ */
/* Chat / emote relay (also used pre-match by the lobby router)        */
/* ------------------------------------------------------------------ */

/**
 * Relay a chat line to a lobby/room audience: 200-char cap, 1 msg/s per
 * player (drops silently when over the rate).
 */
export function relayChat({ config, broadcast }, player, text) {
  const now = Date.now();
  if (now - (player.lastChatAt ?? 0) < config.chatIntervalMs) return;
  const clean = String(text ?? '').slice(0, config.chatMaxLen).trim();
  if (clean.length === 0) return;
  player.lastChatAt = now;
  broadcast(SRV.CHAT, { pid: player.id, text: clean });
}

/** Relay an emote (id length-capped, no rate limit beyond the socket's). */
export function relayEmote({ broadcast }, player, emoteId) {
  const id = String(emoteId ?? '').slice(0, 32);
  if (id.length === 0) return;
  broadcast(SRV.EMOTE, { pid: player.id, emoteId: id });
}

/* ------------------------------------------------------------------ */
/* Action payload sanitizing                                           */
/* ------------------------------------------------------------------ */

/** Rebuild the payload keeping only the fields each action type uses. */
function sanitizePayload(type, payload) {
  const p = payload !== null && typeof payload === 'object' ? payload : {};
  switch (type) {
    case 'useItem': {
      const out = { itemId: String(p.itemId ?? '') };
      if (typeof p.target === 'string') out.target = p.target;
      return out;
    }
    case 'junction':
      return { choice: String(p.choice ?? '') };
    case 'shopBuy':
      return { itemId: String(p.itemId ?? '') };
    case 'dicePick':
      return { index: Number(p.index) };
    case 'itemTarget':
      return { target: typeof p.target === 'string' ? p.target : String(p.target ?? '') };
    default:
      // roll / skipItem / buyStar / declineStar / shopLeave carry nothing.
      return {};
  }
}

/** Does `action` match one of the enumerated legal actions? */
function matchesLegal(legal, action) {
  const p = action.payload ?? {};
  return legal.some((l) => {
    if (l.type !== action.type) return false;
    const lp = l.payload ?? {};
    switch (l.type) {
      case 'useItem': return lp.itemId === p.itemId;
      case 'junction': return lp.choice === p.choice;
      case 'shopBuy': return lp.itemId === p.itemId;
      case 'dicePick': return lp.index === p.index;
      case 'itemTarget': return lp.target === p.target;
      default: return true;
    }
  });
}

/* ------------------------------------------------------------------ */
/* Room factory                                                        */
/* ------------------------------------------------------------------ */

/**
 * @param {{
 *   lobby: Object,
 *   config: Object,
 *   log: Object,
 *   connections: Object,
 *   broadcast: (t: string, payload: Object) => void,
 *   onDispose: () => void,
 * }} deps
 */
export function createRoom({ lobby, config, log, connections, broadcast, onDispose }) {
  let sim = null;
  let disposed = false;
  let decisionTimer = null;
  let disposeTimer = null;
  /** @type {Object|null} Live minigame runner. */
  let mg = null;

  const room = {
    lobby,
    config,
    log,
    getSim: () => sim,
  };
  const botHost = createBotHost(room);

  const seatOf = (pid) => lobby.seats.find((s) => s.pid === pid) ?? null;

  /* ---------------- start -------------------------------------------- */

  function start() {
    const seed = crypto.randomInt(0, 0xffffffff);
    const players = lobby.seats.map((s) => ({
      id: s.pid,
      name: s.name,
      characterId: s.characterId,
      cosmetics: { ...s.cosmetics },
      isBot: s.isBot,
      difficulty: s.difficulty,
    }));
    broadcast(SRV.MATCH_START, {
      seed,
      rules: { ...lobby.rules },
      boardId: lobby.boardId,
      players,
    });
    try {
      sim = createMatchSim({ seed, rules: { ...lobby.rules }, boardId: lobby.boardId, players });
    } catch (err) {
      log.error('sim_create_failed', { err: err?.message });
      broadcast(SRV.ERROR, { code: 'match', msg: 'failed to start the match' });
      dispose();
      return;
    }
    log.info('match_started', { seed, board: lobby.boardId, players: players.length });
    scheduleNext();
  }

  /* ---------------- turn scheduling ----------------------------------- */

  /** Re-evaluate what the sim is waiting for; arm bots and timeouts. */
  function scheduleNext() {
    if (disposed || !sim) return;
    if (decisionTimer) {
      clearTimeout(decisionTimer);
      decisionTimer = null;
    }
    botHost.cancelAll();

    const state = sim.getState();
    if (state.phase === 'game_over') {
      handleGameOver(state);
      return;
    }
    if (state.phase === 'minigame' && state.minigame?.pendingId && !mg) {
      startMinigame(state);
      return;
    }
    const awaiting = state.awaiting;
    if (!awaiting) return;
    const seat = seatOf(awaiting.playerId);
    if (!seat || seat.isBot || !seat.connected) {
      botHost.scheduleDecision(awaiting.playerId);
    } else {
      decisionTimer = setTimeout(() => {
        decisionTimer = null;
        log.info('decision_timeout', { pid: awaiting.playerId, decision: awaiting.decision });
        botHost.decideNow(awaiting.playerId);
      }, config.decisionTimeoutMs);
    }
  }

  /* ---------------- applying actions ----------------------------------- */

  function applyAndBroadcast(action) {
    const result = sim.apply(action); // throws on anything illegal
    broadcast(SRV.ACTION_APPLIED, { action, events: result.events });
    scheduleNext();
    return result;
  }

  /** Server-originated actions (bot host, minigame results). */
  function applyServerAction(action, meta = {}) {
    if (disposed || !sim) return;
    try {
      applyAndBroadcast(action);
    } catch (err) {
      log.error('server_action_failed', {
        type: action?.type, pid: action?.playerId, source: meta.source, err: err?.message,
      });
    }
  }
  room.applyServerAction = applyServerAction;

  /** action{action} from a client. */
  function handleAction(player, payload) {
    if (disposed || !sim) {
      connections.sendError(player, 'match', 'no match in progress');
      return;
    }
    const seat = seatOf(player.id);
    if (!seat || seat.isBot) {
      connections.sendError(player, 'action', 'you are not a participant of this match');
      return;
    }
    const action = payload?.action;
    if (!action || typeof action !== 'object' || typeof action.type !== 'string') {
      connections.sendError(player, 'action', 'malformed action');
      return;
    }
    // Authoritative identity: clients only ever act for themselves.
    if (action.playerId !== player.id) {
      connections.sendError(player, 'action', 'you can only act for yourself');
      return;
    }
    if (action.type === 'minigameResults' || action.type === 'emote') {
      connections.sendError(player, 'action', `"${action.type}" is server-controlled`);
      return;
    }
    const sanitized = {
      type: action.type,
      playerId: player.id,
      payload: sanitizePayload(action.type, action.payload),
    };
    const legal = sim.legalActions(player.id);
    if (!matchesLegal(legal, sanitized)) {
      connections.sendError(player, 'action', `"${action.type}" is not a legal action right now`);
      return;
    }
    try {
      applyAndBroadcast(sanitized);
    } catch (err) {
      // The sim re-validated deeper (targets, prices, ...) and refused.
      log.warn('action_rejected', { pid: player.id, type: sanitized.type, err: err?.message });
      connections.sendError(player, 'action', err?.message ?? 'action rejected');
    }
  }

  /* ---------------- minigames ------------------------------------------ */

  function startMinigame(state) {
    const info = state.minigame;
    const def = minigameRegistry.get(info.pendingId);
    const teams = Array.isArray(info.teams) ? info.teams : null;
    const players = teams ? teams.flat() : state.turnOrder.slice();

    if (!def) {
      // Unknown minigame: award nothing and keep the match moving.
      log.error('minigame_missing', { id: info.pendingId });
      applyServerAction({
        type: 'minigameResults',
        playerId: players[0],
        payload: { results: { ranking: players.slice(), coins: {}, stats: {} } },
      }, { source: 'minigame_fallback' });
      return;
    }

    const seed = crypto.randomInt(0, 0xffffffff);
    const params = { ...def.params, ...(info.params ?? {}) };
    let mgSim;
    try {
      mgSim = def.createSim({ seed, players, params, rules: state.rules });
      mgSim.init();
    } catch (err) {
      log.error('minigame_create_failed', { id: def.id, err: err?.message });
      applyServerAction({
        type: 'minigameResults',
        playerId: players[0],
        payload: { results: { ranking: players.slice(), coins: {}, stats: {} } },
      }, { source: 'minigame_fallback' });
      return;
    }

    botHost.beginMinigame(def, players);
    broadcast(SRV.MG_START, { minigameId: def.id, seed, params, teams: teams ?? [] });
    log.info('minigame_started', { id: def.id, seed, players: players.length });

    const stepMs = 1000 / config.mgTickHz;
    const broadcastEvery = Math.max(1, Math.round(config.mgTickHz / config.mgBroadcastHz));
    mg = {
      def,
      sim: mgSim,
      players,
      teams,
      minigameId: def.id,
      seed,
      params,
      tick: 0,
      /** @type {Map<string, {seq: number, frame: Object}>} latest input per pid. */
      inputs: new Map(),
      acc: 0,
      last: performance.now(),
      interval: null,
    };

    // Fixed 30Hz stepping with drift correction: an accumulator absorbs
    // setInterval jitter; catch-up is capped so a hitch can't spiral.
    mg.interval = setInterval(() => {
      if (disposed || !mg) return;
      const now = performance.now();
      mg.acc += now - mg.last;
      mg.last = now;
      if (mg.acc > 1000) mg.acc = 1000; // hard hitch: drop the excess
      let steps = 0;
      while (mg && mg.acc >= stepMs && steps < config.mgMaxCatchUpSteps) {
        mg.acc -= stepMs;
        steps += 1;
        stepMinigame(broadcastEvery);
      }
    }, stepMs);
  }

  function stepMinigame(broadcastEvery) {
    const runner = mg;
    const publicState = runner.sim.getState();
    const inputs = {};
    for (const pid of runner.players) {
      const seat = seatOf(pid);
      if (!seat || seat.isBot || !seat.connected) {
        inputs[pid] = botHost.minigameFrame(pid, publicState);
      } else {
        inputs[pid] = runner.inputs.get(pid)?.frame ?? emptyFrame();
      }
    }
    try {
      runner.sim.step(inputs);
    } catch (err) {
      log.error('minigame_step_failed', { id: runner.minigameId, err: err?.message });
      finishMinigame({ ranking: runner.players.slice(), coins: {}, stats: {} });
      return;
    }
    runner.tick += 1;
    if (runner.tick % broadcastEvery === 0) {
      broadcast(SRV.MG_STATE, { tick: runner.tick, snapshot: runner.sim.getState() });
    }
    if (runner.sim.isFinished()) {
      let results;
      try {
        results = runner.sim.getResults();
      } catch (err) {
        log.error('minigame_results_failed', { id: runner.minigameId, err: err?.message });
        results = { ranking: runner.players.slice(), coins: {}, stats: {} };
      }
      finishMinigame(results);
    }
  }

  function stopMinigameRunner() {
    if (!mg) return null;
    clearInterval(mg.interval);
    const players = mg.players;
    mg = null;
    botHost.endMinigame();
    return players;
  }

  function finishMinigame(results) {
    const minigameId = mg?.minigameId;
    const players = stopMinigameRunner();
    if (!players) return;
    log.info('minigame_finished', { id: minigameId, winner: results?.ranking?.[0] });
    broadcast(SRV.MG_END, { results });
    // Feed the outcome back into the board sim; broadcast as a normal
    // action so replicas stay in lockstep.
    applyServerAction({
      type: 'minigameResults',
      playerId: players[0],
      payload: { results },
    }, { source: 'minigame' });
  }

  /** mg_input{seq,frame}: keep only the freshest frame per participant. */
  function handleMgInput(player, payload) {
    if (disposed || !mg) return;
    if (!mg.players.includes(player.id)) return; // non-participant: ignore
    const seq = Number(payload?.seq);
    if (!Number.isFinite(seq)) return;
    const prev = mg.inputs.get(player.id);
    if (prev && seq <= prev.seq) return; // stale
    mg.inputs.set(player.id, { seq, frame: clampFrame(payload?.frame) });
  }

  /* ---------------- chat / emote --------------------------------------- */

  function handleChat(player, payload) {
    relayChat({ config, broadcast }, player, payload?.text);
  }

  function handleEmote(player, payload) {
    relayEmote({ broadcast }, player, payload?.emoteId);
  }

  /* ---------------- connection churn ------------------------------------ */

  /** Socket dropped mid-match: bot host covers the seat immediately. */
  function handleDisconnect(pid) {
    if (disposed || !sim) return;
    if (sim.state.players[pid]) sim.state.players[pid].connected = false;
    broadcast(SRV.PLAYER_CONN, { pid, connected: false });
    const state = sim.getState();
    if (state.awaiting?.playerId === pid) {
      if (decisionTimer) {
        clearTimeout(decisionTimer);
        decisionTimer = null;
      }
      botHost.scheduleDecision(pid);
    }
  }

  /** Resumed mid-match: full snapshot + live minigame context. */
  function handleResume(player) {
    if (disposed || !sim) return;
    const pid = player.id;
    if (sim.state.players[pid]) sim.state.players[pid].connected = true;
    botHost.cancel(pid);
    connections.send(player, SRV.STATE_SYNC, { snapshot: sim.snapshot() });
    if (mg) {
      connections.send(player, SRV.MG_START, {
        minigameId: mg.minigameId,
        seed: mg.seed,
        params: mg.params,
        teams: mg.teams ?? [],
      });
      connections.send(player, SRV.MG_STATE, { tick: mg.tick, snapshot: mg.sim.getState() });
    }
    broadcast(SRV.PLAYER_CONN, { pid, connected: true });
    // If it is this player's decision, restore the human timeout path.
    if (!mg) scheduleNext();
  }

  /* ---------------- game over / teardown --------------------------------- */

  function handleGameOver(state) {
    botHost.cancelAll();
    stopMinigameRunner();
    const ranking = Object.values(state.players)
      .sort((a, b) => (b.goldenBananas - a.goldenBananas) || (b.coins - a.coins))
      .map((p) => p.id);
    log.info('game_over', { code: lobby.code, winner: ranking[0] });
    if (disposeTimer) clearTimeout(disposeTimer);
    disposeTimer = setTimeout(() => dispose(), config.rematchKeepMs);
    disposeTimer.unref?.();
  }

  function isFinished() {
    try {
      return Boolean(sim) && sim.getState().phase === 'game_over';
    } catch {
      return false;
    }
  }

  /**
   * Tear down every timer. `silent` skips the onDispose callback (used
   * when the lobby itself is being destroyed).
   */
  function dispose({ silent = false } = {}) {
    if (disposed) return;
    disposed = true;
    if (decisionTimer) clearTimeout(decisionTimer);
    decisionTimer = null;
    if (disposeTimer) clearTimeout(disposeTimer);
    disposeTimer = null;
    stopMinigameRunner();
    botHost.dispose();
    log.info('room_disposed', { code: lobby.code });
    if (!silent) onDispose?.();
  }

  Object.assign(room, {
    start,
    handleAction,
    handleMgInput,
    handleChat,
    handleEmote,
    handleDisconnect,
    handleResume,
    isFinished,
    dispose,
  });
  return room;
}
