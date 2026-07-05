/**
 * ISession implementations (see shared/types.js):
 *
 *  - createOfflineSession(cfg): owns a local match sim, answers bot
 *    `awaiting` decisions via the board bot after a 400-900ms randomized
 *    delay, and runs minigame sims with a 30Hz fixed stepper (calling each
 *    MinigameDef.bot() for bot seats).
 *  - createOnlineSession(netClient): thin forwarding layer that maintains a
 *    sim replica by applying `action_applied` events from the server.
 *
 * The match sim (#shared/sim/match.js) and board bot (#shared/ai/boardBot.js)
 * are later packages; both are dynamic-imported with try/catch so this
 * foundation package boots standalone. When the sim is missing, getSim()
 * returns a stub whose methods throw with a clear message.
 */

import { TICK_RATE, MIN_PLAYERS } from '#shared/constants.js';
import { createEmitter } from '#shared/events.js';
import { createRng } from '#shared/rng.js';
import { validateRules } from '#shared/rules.js';
import { minigames as minigameRegistry, characters as characterRegistry } from '#shared/registries.js';
import { MSG, SRV } from '#shared/protocol.js';

/* ------------------------------------------------------------------ */
/* Guarded dynamic imports                                             */
/* ------------------------------------------------------------------ */

// Paths are relative to THIS module's URL (/src/app/session.js) so the
// browser resolves them to /shared/... via the Vite dev server. Kept in
// variables with @vite-ignore so missing files fail at runtime (caught)
// instead of at bundle time.
const MATCH_SIM_PATH = '../../shared/sim/match.js';
const BOARD_BOT_PATH = '../../shared/ai/boardBot.js';

async function tryImport(path) {
  try {
    return await import(/* @vite-ignore */ path);
  } catch (err) {
    console.info(`[session] optional module not available: ${path} (${err?.message ?? err})`);
    return null;
  }
}

/** Sim stub used when #shared/sim/match.js does not exist yet. */
function createMissingSimStub() {
  const explode = () => {
    throw new Error(
      'Match simulation is not available: "#shared/sim/match.js" is missing. '
      + 'Install/build the sim package (P2) to start matches; the foundation '
      + 'package (P1) only provides lobby, content registries, and protocol.',
    );
  };
  return {
    __missing: true,
    getState: explode,
    submit: explode,
    apply: explode,
    applyState: explode,
    on: explode,
  };
}

const BOT_NAMES = ['Bongo', 'Kiki', 'Mango', 'Chimpy', 'Nana', 'Tarzana', 'Coco', 'Peel'];

/**
 * Give every character-less bot seat a random UNUSED character so bots get
 * perks + a distinct look instead of the generic fallback monkey.
 *
 * @param {{isBot: boolean, characterId: string|null}[]} seats
 * @param {{next: () => number}} rng
 */
function assignBotCharacters(seats, rng) {
  const allIds = characterRegistry.ids();
  if (allIds.length === 0) return;
  const used = new Set(seats.map((s) => s.characterId).filter(Boolean));
  for (const seat of seats) {
    if (!seat.isBot || seat.characterId) continue;
    let pool = allIds.filter((id) => !used.has(id));
    if (pool.length === 0) pool = allIds; // more bots than characters: reuse
    const pick = pool[Math.floor(rng.next() * pool.length) % pool.length];
    seat.characterId = pick;
    used.add(pick);
  }
}

/* ------------------------------------------------------------------ */
/* Offline session                                                     */
/* ------------------------------------------------------------------ */

/**
 * @param {{
 *   seed?: number,
 *   boardId?: string|null,
 *   rules?: Object,
 *   localPlayers?: {pid?: string, name?: string}[],
 * }} [cfg]
 * @returns {import('#shared/types.js').ISession}
 */
export function createOfflineSession(cfg = {}) {
  const emitter = createEmitter();
  // Client-side; wall-clock seeding is fine here (determinism lives in shared/).
  const rng = createRng(cfg.seed ?? Math.floor(Math.random() * 0xffffffff));

  let rules = validateRules(cfg.rules ?? {});
  let boardId = cfg.boardId ?? null;
  let started = false;
  let sim = null;

  /** @type {Set<ReturnType<typeof setTimeout>>} */
  const timers = new Set();
  /** @type {{intervalId: *, sim: Object|null}} */
  const minigameRunner = { intervalId: null, sim: null };
  /** Latest InputFrame per local player id (fed to the minigame stepper). */
  const inputFrames = new Map();

  let nextSeat = 0;
  let botCounter = 0;
  /** @type {{pid: string, seat: number, name: string, isBot: boolean,
   *   difficulty: string|null, characterId: string|null, cosmetics: Object,
   *   ready: boolean}[]} */
  const seats = [];

  function addSeat({ pid, name, isBot, difficulty }) {
    const seat = {
      pid,
      seat: nextSeat++,
      name,
      isBot,
      difficulty: isBot ? difficulty : null,
      characterId: null,
      cosmetics: {},
      ready: isBot, // bots are always ready
    };
    seats.push(seat);
    return seat;
  }

  const localPlayers = Array.isArray(cfg.localPlayers) && cfg.localPlayers.length > 0
    ? cfg.localPlayers
    : [{ name: 'Player 1' }];
  localPlayers.forEach((p, i) => {
    addSeat({ pid: p.pid ?? `p${i + 1}`, name: p.name ?? `Player ${i + 1}`, isBot: false });
  });

  function delay(fn, ms) {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
    return id;
  }

  function getLobby() {
    return {
      mode: 'offline',
      code: null,
      isPublic: false,
      boardId,
      rules: { ...rules },
      started,
      seats: seats.map((s) => ({ ...s, cosmetics: { ...s.cosmetics } })),
    };
  }

  function emitLobby() {
    emitter.emit('lobby_state', getLobby());
  }

  /* ---------------- bots answering awaiting decisions --------------- */

  function fallbackDecision(awaiting) {
    const first = Array.isArray(awaiting.options) ? awaiting.options[0] : undefined;
    switch (awaiting.decision) {
      case 'roll': return { type: 'roll', playerId: awaiting.playerId, payload: {} };
      case 'junction': return { type: 'junction', playerId: awaiting.playerId, payload: { choice: first } };
      case 'buyStar': return { type: 'buyStar', playerId: awaiting.playerId, payload: {} };
      case 'shop': return { type: 'shopLeave', playerId: awaiting.playerId, payload: {} };
      case 'itemTarget': return { type: 'itemTarget', playerId: awaiting.playerId, payload: { target: first } };
      // dicePick expects the INDEX of the drafted die, not the option value.
      case 'dicePick': return { type: 'dicePick', playerId: awaiting.playerId, payload: { index: 0 } };
      default: return null;
    }
  }

  let pendingBotDecision = null;

  function checkAwaiting() {
    if (!sim || sim.__missing) return;
    let state;
    try {
      state = sim.getState();
    } catch {
      return;
    }
    const awaiting = state?.awaiting;
    if (!awaiting) return;
    const seat = seats.find((s) => s.pid === awaiting.playerId);
    if (!seat?.isBot) return;

    // Only one scheduled answer per awaiting entry.
    const key = `${awaiting.playerId}:${awaiting.decision}:${state.round}:${state.phase}`;
    if (pendingBotDecision === key) return;
    pendingBotDecision = key;

    const ms = 400 + Math.floor(rng.next() * 500); // 400-900ms
    delay(async () => {
      pendingBotDecision = null;
      const botMod = await tryImport(BOARD_BOT_PATH);
      let action = null;
      try {
        const decide = botMod?.decide ?? botMod?.default;
        if (typeof decide === 'function') {
          action = decide(sim.getState(), awaiting.playerId, seat.difficulty ?? rules.botDifficulty, rng.fork(`bot:${awaiting.playerId}`));
        }
      } catch (err) {
        console.warn('[session] board bot threw, using fallback decision:', err);
      }
      if (!action) action = fallbackDecision(awaiting);
      if (!action) return;
      // This runs inside a setTimeout: an uncaught throw would hang the
      // match with no visible error. Fall back to a safe default and
      // re-check so the game always keeps moving.
      try {
        submit(action);
      } catch (err) {
        console.warn('[session] bot decision rejected by the sim:', err);
        const fb = fallbackDecision(awaiting);
        try {
          if (fb && JSON.stringify(fb) !== JSON.stringify(action)) submit(fb);
        } catch (err2) {
          console.warn('[session] fallback decision also rejected:', err2);
        }
        checkAwaiting();
      }
    }, ms);
  }

  /* ---------------- minigame fixed stepper --------------------------- */

  function stopMinigameRunner() {
    if (minigameRunner.intervalId !== null) {
      clearInterval(minigameRunner.intervalId);
      minigameRunner.intervalId = null;
    }
    minigameRunner.sim = null;
  }

  /**
   * Run a minigame sim at a fixed 30Hz. Bot seats are driven by
   * MinigameDef.bot(publicState, playerId, difficulty, rng); human seats use
   * the latest frame passed to sendInput().
   */
  function startMinigameRunner({ minigameId, seed, players, params, teams }) {
    const def = minigameRegistry.get(minigameId);
    if (!def) {
      console.warn(`[session] unknown minigame "${minigameId}" - skipping`);
      return;
    }
    stopMinigameRunner();

    let mgSim;
    try {
      mgSim = def.createSim({ seed, players, params: { ...def.params, ...params }, rules });
      mgSim.init();
    } catch (err) {
      // A broken minigame must never hang the match: award neutral results
      // and let the board move on.
      console.error(`[session] minigame "${minigameId}" failed to create:`, err);
      try {
        submit({
          type: 'minigameResults',
          playerId: players[0],
          payload: { results: { ranking: players.slice(), coins: {}, stats: {} } },
        });
      } catch (err2) {
        console.error('[session] fallback minigame results rejected:', err2);
      }
      return;
    }
    minigameRunner.sim = mgSim;
    emitter.emit('mg_start', { minigameId, seed, params, teams });

    const botRngs = new Map();
    for (const pid of players) {
      const seat = seats.find((s) => s.pid === pid);
      if (seat?.isBot) botRngs.set(pid, rng.fork(`mg:${minigameId}:${pid}`));
    }

    const stepMs = 1000 / TICK_RATE;
    let last = performance.now();
    let acc = 0;

    minigameRunner.intervalId = setInterval(() => {
      const now = performance.now();
      acc += now - last;
      last = now;
      // Fixed timestep with catch-up; each step() is exactly 1/30s of sim time.
      let steps = 0;
      while (acc >= stepMs && steps < 5) {
        acc -= stepMs;
        steps += 1;
        const inputs = {};
        const publicState = minigameRunner.sim.getState();
        for (const pid of players) {
          const botRng = botRngs.get(pid);
          if (botRng) {
            const seat = seats.find((s) => s.pid === pid);
            inputs[pid] = def.bot(publicState, pid, seat?.difficulty ?? rules.botDifficulty, botRng);
          } else {
            inputs[pid] = inputFrames.get(pid) ?? { move: { x: 0, y: 0 }, a: false, b: false };
          }
        }
        minigameRunner.sim.step(inputs);
        if (minigameRunner.sim.isFinished()) {
          const results = minigameRunner.sim.getResults();
          const reporter = players[0];
          stopMinigameRunner();
          emitter.emit('mg_end', { results });
          submit({ type: 'minigameResults', playerId: reporter, payload: { results } });
          return;
        }
      }
    }, stepMs);
  }

  function checkMinigame() {
    if (!sim || sim.__missing || minigameRunner.sim) return;
    let state;
    try {
      state = sim.getState();
    } catch {
      return;
    }
    const mg = state?.minigame;
    if (state?.phase !== 'minigame' || !mg?.pendingId || mg.results) return;
    const players = mg.teams && Array.isArray(mg.teams) ? mg.teams.flat() : state.turnOrder;
    startMinigameRunner({
      minigameId: mg.pendingId,
      seed: rng.fork(`mg:${mg.pendingId}:${state.round}`).state(),
      players,
      params: mg.params ?? {},
      teams: mg.teams ?? null,
    });
  }

  /* ---------------- ISession surface --------------------------------- */

  function setRules(r) {
    rules = validateRules({ ...rules, ...r });
    emitLobby();
  }

  function setBoard(id) {
    boardId = id;
    emitLobby();
  }

  function addBot(difficulty = rules.botDifficulty) {
    if (seats.length >= rules.maxSeats) {
      console.warn('[session] lobby is full, cannot add bot');
      return null;
    }
    botCounter += 1;
    const name = BOT_NAMES[(botCounter - 1) % BOT_NAMES.length];
    const seat = addSeat({ pid: `bot${botCounter}`, name: `${name} (bot)`, isBot: true, difficulty });
    emitLobby();
    return seat;
  }

  function removeBot(seatIndex) {
    const idx = seats.findIndex((s) => s.seat === seatIndex && s.isBot);
    if (idx === -1) return;
    seats.splice(idx, 1);
    emitLobby();
  }

  function selectCharacter(pid, charId, cosmetics = {}) {
    const seat = seats.find((s) => s.pid === pid);
    if (!seat) return;
    seat.characterId = charId;
    seat.cosmetics = { ...cosmetics };
    emitLobby();
  }

  function setReady(pid, ready = true) {
    const seat = seats.find((s) => s.pid === pid);
    if (!seat) return;
    seat.ready = !!ready;
    emitLobby();
  }

  async function start() {
    if (started) return;
    if (rules.botsFill) {
      while (seats.length < Math.max(MIN_PLAYERS, rules.maxSeats)) {
        if (seats.length >= rules.maxSeats) break;
        addBot(rules.botDifficulty);
      }
    }
    started = true;

    // Bots without a chosen character get a random unused one (perks + look).
    assignBotCharacters(seats, rng.fork('botChars'));

    const seed = rng.fork('match').state();
    const players = seats.map((s) => ({
      id: s.pid,
      name: s.name,
      characterId: s.characterId,
      cosmetics: { ...s.cosmetics },
      isBot: s.isBot,
      difficulty: s.difficulty,
    }));

    const simMod = await tryImport(MATCH_SIM_PATH);
    const createMatchSim = simMod?.createMatchSim ?? simMod?.default;
    if (typeof createMatchSim === 'function') {
      sim = createMatchSim({ seed, boardId, rules: { ...rules }, players });
      emitter.emit('match_start', { seed, rules: { ...rules }, boardId, players });
      checkAwaiting();
      checkMinigame();
    } else {
      sim = createMissingSimStub();
      console.warn('[session] started without a match sim (shared/sim/match.js missing) - getSim() is a throwing stub');
      emitter.emit('match_start', { seed, rules: { ...rules }, boardId, players, simMissing: true });
    }
    emitLobby();
  }

  function getSim() {
    return sim;
  }

  /** @param {import('#shared/types.js').Action} action */
  function submit(action) {
    if (!sim) throw new Error('[session] no match in progress - call start() first');
    const apply = sim.apply ?? sim.submit;
    const events = apply.call(sim, action);
    emitter.emit('action_applied', { action, events: events ?? [] });
    for (const evt of events ?? []) {
      if (evt && typeof evt.type === 'string') emitter.emit(evt.type, evt);
    }
    checkAwaiting();
    checkMinigame();
    return events;
  }

  /**
   * @param {import('#shared/types.js').InputFrame} frame
   * @param {string} [pid] Defaults to the first local (human) player.
   */
  function sendInput(frame, pid) {
    const target = pid ?? seats.find((s) => !s.isBot)?.pid;
    if (target) inputFrames.set(target, frame);
  }

  function sendEmote(id, pid) {
    const from = pid ?? seats.find((s) => !s.isBot)?.pid;
    emitter.emit('emote', { type: 'emote', pid: from, emoteId: id });
  }

  function localSeats() {
    const map = new Map();
    for (const s of seats) {
      if (!s.isBot) map.set(s.pid, s.seat);
    }
    return map;
  }

  function leave() {
    for (const id of timers) clearTimeout(id);
    timers.clear();
    stopMinigameRunner();
    emitter.emit('left', {});
    emitter.clear();
    sim = null;
    started = false;
  }

  return {
    mode: 'offline',
    getLobby,
    setRules,
    setBoard,
    addBot,
    removeBot,
    selectCharacter,
    setReady,
    start,
    getSim,
    submit,
    sendInput,
    sendEmote,
    on: emitter.on,
    localSeats,
    leave,
  };
}

/* ------------------------------------------------------------------ */
/* Online session                                                      */
/* ------------------------------------------------------------------ */

/**
 * Thin forwarding session over a net client. The net client is expected to
 * expose `send(type, payload)` and `on(type, cb) => unsubscribe` keyed by the
 * SRV.* message types (the net package, P-later, provides this).
 *
 * A local sim replica is maintained by applying every `action_applied` event
 * from the server; `state_sync` snapshots hard-reset the replica.
 *
 * @param {{send: (type: string, payload?: Object) => void,
 *          on: (type: string, cb: Function) => (() => void)|void,
 *          playerId?: string, seat?: number}} netClient
 * @returns {import('#shared/types.js').ISession}
 */
export function createOnlineSession(netClient) {
  if (!netClient || typeof netClient.send !== 'function' || typeof netClient.on !== 'function') {
    throw new Error('createOnlineSession: netClient must expose send(type, payload) and on(type, cb)');
  }

  const emitter = createEmitter();
  let lobby = null;
  let sim = null;
  let localPid = netClient.playerId ?? null;
  let inputSeq = 0;
  /** True while a sim replica build (dynamic import) is in flight. */
  let simBuilding = false;
  /** Guards overlapping async builds: the newest one wins. */
  let buildToken = 0;
  /** @type {Object[]} action_applied received while the sim module loads. */
  const pendingActions = [];
  /** @type {Object|null} Snapshot received before the sim replica was ready. */
  let pendingSnapshot = null;
  let resyncRequested = false;

  function forward(type, payload) {
    netClient.send(type, payload);
  }

  /**
   * The replica diverged from the authoritative sim (an apply() threw).
   * Re-identifying via the resume token on the live socket makes the server
   * send a fresh state_sync (plus live minigame context) that we rebuild
   * from - no reconnect needed.
   */
  function requestResync(reason) {
    if (resyncRequested) return;
    resyncRequested = true;
    console.warn(`[session:online] replica desync (${reason}) - requesting a state_sync`);
    sim = null; // stop applying further actions onto a corrupt replica
    const token = netClient.resumeToken;
    if (token) {
      forward(MSG.RESUME, { token });
    } else if (typeof netClient.close === 'function' && typeof netClient.connect === 'function') {
      // No token to resync with: bounce the socket, resume happens on open.
      try {
        netClient.close();
      } catch { /* already closed */ }
      netClient.connect?.().catch?.(() => {});
    }
  }

  async function buildReplica(cfg) {
    const simMod = await tryImport(MATCH_SIM_PATH);
    const createMatchSim = simMod?.createMatchSim ?? simMod?.default;
    if (typeof createMatchSim !== 'function') return null;
    return createMatchSim(cfg);
  }

  netClient.on(SRV.WELCOME, (msg) => {
    localPid = msg?.playerId ?? localPid;
    emitter.emit('welcome', msg);
  });

  netClient.on(SRV.LOBBY_STATE, (msg) => {
    lobby = msg?.lobby ?? null;
    emitter.emit('lobby_state', lobby);
  });

  netClient.on(SRV.MATCH_START, async (msg) => {
    const token = ++buildToken;
    sim = null;
    simBuilding = true;
    pendingActions.length = 0;
    let replica = null;
    try {
      replica = await buildReplica({
        seed: msg.seed,
        boardId: msg.boardId,
        rules: msg.rules,
        players: msg.players,
      });
    } catch (err) {
      console.error('[session:online] failed to build the sim replica:', err);
    }
    if (token !== buildToken) return; // superseded by a newer build
    simBuilding = false;
    if (!replica) {
      sim = createMissingSimStub();
      console.warn('[session:online] match started without a local sim replica (shared/sim/match.js missing)');
      emitter.emit('match_start', msg);
      return;
    }
    try {
      if (pendingSnapshot) {
        replica.applyState?.(pendingSnapshot);
        pendingSnapshot = null;
      }
      // Replay actions broadcast while the module import was in flight;
      // dropping them would permanently desync the replica.
      for (const action of pendingActions.splice(0)) {
        const apply = replica.apply ?? replica.submit;
        apply.call(replica, action);
      }
      sim = replica;
    } catch (err) {
      console.warn('[session:online] replica catch-up failed:', err);
      sim = replica;
      requestResync('startup catch-up failed');
    }
    emitter.emit('match_start', msg);
  });

  netClient.on(SRV.ACTION_APPLIED, (msg) => {
    // Keep the replica in lockstep with the authoritative server sim.
    if (msg?.action) {
      if (sim && !sim.__missing) {
        try {
          const apply = sim.apply ?? sim.submit;
          apply.call(sim, msg.action);
        } catch (err) {
          console.warn('[session:online] replica failed to apply action:', err);
          requestResync(`apply(${msg.action?.type}) failed`);
        }
      } else if (simBuilding) {
        pendingActions.push(msg.action);
      }
    }
    emitter.emit('action_applied', msg);
    for (const evt of msg?.events ?? []) {
      if (evt && typeof evt.type === 'string') emitter.emit(evt.type, evt);
    }
  });

  netClient.on(SRV.STATE_SYNC, async (msg) => {
    const snapshot = msg?.snapshot ?? null;
    resyncRequested = false;
    if (sim && !sim.__missing) {
      try {
        sim.applyState?.(snapshot);
      } catch (err) {
        console.warn('[session:online] state_sync failed to apply:', err);
      }
      emitter.emit('state_sync', msg);
      return;
    }
    if (simBuilding || !snapshot?.state) {
      // A match_start build is in flight - it applies this snapshot when
      // it finishes (or the snapshot is unusable).
      pendingSnapshot = snapshot;
      emitter.emit('state_sync', msg);
      return;
    }
    // No replica at all (page reload resumed straight into a running match):
    // the snapshot carries everything needed to rebuild the sim from scratch
    // (seed / rules / boardId / players + full internal state).
    const token = ++buildToken;
    simBuilding = true;
    pendingActions.length = 0;
    const st = snapshot.state;
    const players = (st.turnOrder ?? Object.keys(st.players ?? {})).map((pid) => {
      const p = st.players?.[pid] ?? {};
      return {
        id: pid,
        name: p.name ?? pid,
        characterId: p.characterId ?? null,
        cosmetics: p.cosmetics ?? {},
        isBot: !!p.isBot,
        difficulty: p.difficulty ?? null,
      };
    });
    let replica = null;
    try {
      replica = await buildReplica({
        seed: st.seed,
        boardId: st.boardId,
        rules: st.rules,
        players,
      });
    } catch (err) {
      console.error('[session:online] failed to rebuild the sim from state_sync:', err);
    }
    if (token !== buildToken) return; // superseded by a newer build
    simBuilding = false;
    if (replica) {
      try {
        replica.applyState?.(snapshot);
        for (const action of pendingActions.splice(0)) {
          const apply = replica.apply ?? replica.submit;
          apply.call(replica, action);
        }
        sim = replica;
      } catch (err) {
        console.warn('[session:online] snapshot restore failed:', err);
        pendingSnapshot = snapshot;
      }
    } else {
      pendingSnapshot = snapshot;
    }
    emitter.emit('state_sync', msg);
  });

  for (const [srvType, evtName] of [
    [SRV.LOBBY_LIST, 'lobby_list'],
    [SRV.MG_START, 'mg_start'],
    [SRV.MG_STATE, 'mg_state'],
    [SRV.MG_END, 'mg_end'],
    [SRV.PLAYER_CONN, 'player_conn'],
    [SRV.EMOTE, 'emote'],
    [SRV.CHAT, 'chat'],
    [SRV.ERROR, 'error'],
  ]) {
    netClient.on(srvType, (msg) => emitter.emit(evtName, msg));
  }

  // NOTE: no PING handler here - the transport (src/net/client.js) owns the
  // keepalive and already answers every server ping with a single pong.

  return {
    mode: 'online',
    getLobby: () => lobby,
    setRules: (r) => forward(MSG.LOBBY_SET, { rules: r }),
    setBoard: (id) => forward(MSG.LOBBY_SET, { boardId: id }),
    addBot: (difficulty = 'normal') => forward(MSG.ADD_BOT, { difficulty }),
    removeBot: (seat) => forward(MSG.REMOVE_BOT, { seat }),
    selectCharacter: (pid, charId, cosmetics = {}) => forward(MSG.SELECT_CHARACTER, { characterId: charId, cosmetics }),
    setReady: (pid, ready = true) => forward(MSG.READY, { ready: !!ready }),
    start: () => forward(MSG.START_GAME, {}),
    getSim: () => sim,
    submit: (action) => forward(MSG.ACTION, { action }),
    sendInput: (frame) => forward(MSG.MG_INPUT, { seq: ++inputSeq, frame }),
    sendEmote: (id) => forward(MSG.EMOTE, { emoteId: id }),
    on: emitter.on,
    // Online play has exactly ONE local human; they always drive DEVICE
    // seat 0 (WASD / first bound device). The lobby seat index is a
    // different concept - using it here gave non-host players wrong or no
    // controls (device seats >= 4 read no input at all).
    localSeats: () => (localPid ? new Map([[localPid, 0]]) : new Map()),
    leave: () => {
      forward(MSG.LEAVE_LOBBY, {});
      emitter.emit('left', {});
      emitter.clear();
      sim = null;
      lobby = null;
      pendingActions.length = 0;
      pendingSnapshot = null;
    },
  };
}
