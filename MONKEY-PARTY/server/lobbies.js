/**
 * Lobby management: create / join / leave / list, host powers, and the
 * transition into an authoritative match room.
 *
 * - Private lobbies get a 4-char join code from an unambiguous alphabet;
 *   public lobbies (also code-addressable) show up in lobby_list.
 * - Host powers: lobby_set rules/board (validateRules-checked), add_bot /
 *   remove_bot, start_game (all humans ready, >= 2 seats after optional
 *   bot fill).
 * - lobby_state is broadcast to every member on every change.
 *
 * Per-lobby isolation: every broadcast goes through the seat list of one
 * lobby only; nothing here can leak into another lobby.
 */

import crypto from 'node:crypto';
import { SRV } from '#shared/protocol.js';
import { validateRules } from '#shared/rules.js';
import { MIN_PLAYERS, BOT_DIFFICULTIES } from '#shared/constants.js';
import { boards, characters } from '#shared/registries.js';
import { createRoom } from './room.js';

const BOT_NAMES = ['Bongo', 'Kiki', 'Mango', 'Chimpy', 'Nana', 'Tarzana', 'Coco', 'Peel'];

/** Cosmetic slots a client may set (see src/ui/charSelect.js). */
const COSMETIC_SLOTS = ['hat', 'glasses', 'accessory', 'skin'];
const COSMETIC_MAX_LEN = 32;

/**
 * @param {{config: Object, log: Object, connections: Object}} deps
 */
export function createLobbyManager({ config, log, connections }) {
  /** @type {Map<string, Object>} code -> lobby. */
  const lobbies = new Map();

  /** Optional listeners other modules attach (matchmaking countdown). */
  const hooks = { onSeatsChanged: null };

  function setHooks(h) {
    Object.assign(hooks, h);
  }

  /* ---------------- helpers ---------------------------------------- */

  function generateCode() {
    const alphabet = config.lobbyCodeAlphabet;
    let code;
    do {
      code = '';
      for (let i = 0; i < config.lobbyCodeLength; i += 1) {
        code += alphabet[crypto.randomInt(alphabet.length)];
      }
    } while (lobbies.has(code));
    return code;
  }

  function defaultBoardId() {
    return boards.ids()[0] ?? null;
  }

  function seatOf(lobby, pid) {
    return lobby.seats.find((s) => s.pid === pid) ?? null;
  }

  function humanSeats(lobby) {
    return lobby.seats.filter((s) => !s.isBot);
  }

  function publicView(lobby) {
    return {
      code: lobby.code,
      isPublic: lobby.isPublic,
      hostId: lobby.hostId,
      boardId: lobby.boardId,
      rules: { ...lobby.rules },
      started: lobby.started,
      countdownEndsAt: lobby.countdownEndsAt,
      seats: lobby.seats.map((s) => ({ ...s, cosmetics: { ...s.cosmetics } })),
    };
  }

  /** Send to every human member with a live socket. */
  function broadcast(lobby, t, payload) {
    for (const seat of humanSeats(lobby)) {
      const member = connections.getPlayer(seat.pid);
      if (member) connections.send(member, t, payload);
    }
  }

  function broadcastState(lobby) {
    broadcast(lobby, SRV.LOBBY_STATE, { lobby: publicView(lobby) });
  }

  function seatsChanged(lobby) {
    broadcastState(lobby);
    hooks.onSeatsChanged?.(lobby);
  }

  function fail(player, code, msg) {
    connections.sendError(player, code, msg);
    return null;
  }

  /* ---------------- create / join / leave / list -------------------- */

  /**
   * create_lobby{isPublic, rules, boardId}.
   * @returns {Object|null} The lobby, or null (error already sent).
   */
  function create(player, payload, opts = {}) {
    if (player.lobby) return fail(player, 'lobby', 'already in a lobby - leave first');
    const boardId = typeof payload?.boardId === 'string' && boards.get(payload.boardId)
      ? payload.boardId
      : defaultBoardId();
    if (!boardId) return fail(player, 'board', 'no boards registered');

    const lobby = {
      code: generateCode(),
      isPublic: Boolean(payload?.isPublic),
      quickMatch: Boolean(opts.quickMatch),
      hostId: player.id,
      boardId,
      rules: validateRules(payload?.rules ?? {}),
      seats: [],
      started: false,
      room: null,
      countdownTimer: null,
      countdownEndsAt: null,
      nextSeat: 0,
      botCounter: 0,
    };
    lobbies.set(lobby.code, lobby);
    addHumanSeat(lobby, player);
    log.info('lobby_created', {
      code: lobby.code, host: player.id, isPublic: lobby.isPublic, board: boardId,
    });
    seatsChanged(lobby);
    return lobby;
  }

  function addHumanSeat(lobby, player) {
    lobby.seats.push({
      pid: player.id,
      seat: lobby.nextSeat++,
      name: player.name,
      isBot: false,
      difficulty: null,
      characterId: null,
      cosmetics: {},
      ready: false,
      connected: true,
    });
    player.lobby = lobby;
  }

  function addBotSeat(lobby, difficulty) {
    lobby.botCounter += 1;
    const name = BOT_NAMES[(lobby.botCounter - 1) % BOT_NAMES.length];
    lobby.seats.push({
      pid: `bot_${lobby.code.toLowerCase()}_${lobby.botCounter}`,
      seat: lobby.nextSeat++,
      name: `${name} (bot)`,
      isBot: true,
      difficulty: BOT_DIFFICULTIES.includes(difficulty) ? difficulty : lobby.rules.botDifficulty,
      characterId: null,
      cosmetics: {},
      ready: true,
      connected: true,
    });
  }

  /** join_lobby{code}. */
  function join(player, payload) {
    if (player.lobby) return fail(player, 'lobby', 'already in a lobby - leave first');
    const code = String(payload?.code ?? '').trim().toUpperCase();
    const lobby = lobbies.get(code);
    if (!lobby) return fail(player, 'join', `no lobby with code "${code}"`);
    if (lobby.started) return fail(player, 'join', 'that match already started');
    if (lobby.seats.length >= lobby.rules.maxSeats) return fail(player, 'join', 'lobby is full');
    addHumanSeat(lobby, player);
    log.info('lobby_joined', { code, pid: player.id });
    seatsChanged(lobby);
    return lobby;
  }

  /** leave_lobby{} - also used on grace expiry and quick-match hops. */
  function leave(player) {
    const lobby = player.lobby;
    if (!lobby) return;
    player.lobby = null;
    const seat = seatOf(lobby, player.id);
    if (!seat) return;

    if (lobby.started && lobby.room) {
      // Mid-match: the seat must survive (the sim's roster is fixed); the
      // room's bot host takes over the seat.
      seat.connected = false;
      seat.ready = false;
      lobby.room.handleDisconnect(player.id);
      log.info('lobby_left_midmatch', { code: lobby.code, pid: player.id });
    } else {
      lobby.seats.splice(lobby.seats.indexOf(seat), 1);
      if (lobby.hostId === player.id) {
        lobby.hostId = humanSeats(lobby)[0]?.pid ?? null;
      }
      log.info('lobby_left', { code: lobby.code, pid: player.id });
      if (humanSeats(lobby).length === 0) {
        disposeLobby(lobby);
        return;
      }
      seatsChanged(lobby);
    }
  }

  /** list_lobbies{} -> lobby_list with public, joinable lobbies. */
  function list(player) {
    const view = [...lobbies.values()]
      .filter((l) => l.isPublic && !l.started && l.seats.length < l.rules.maxSeats)
      .map((l) => ({
        code: l.code,
        boardId: l.boardId,
        players: l.seats.length,
        humans: humanSeats(l).length,
        maxSeats: l.rules.maxSeats,
        hostName: seatOf(l, l.hostId)?.name ?? '?',
      }));
    connections.send(player, SRV.LOBBY_LIST, { lobbies: view });
  }

  /* ---------------- host powers -------------------------------------- */

  function requireHost(player, { allowStarted = false } = {}) {
    const lobby = player.lobby;
    if (!lobby) return fail(player, 'lobby', 'not in a lobby');
    if (lobby.hostId !== player.id) return fail(player, 'host', 'only the host can do that');
    if (!allowStarted && lobby.started) return fail(player, 'lobby', 'match already started');
    return lobby;
  }

  /** lobby_set{rules?, boardId?}. */
  function setLobby(player, payload) {
    const lobby = requireHost(player);
    if (!lobby) return;
    if (payload?.rules !== undefined) {
      const merged = validateRules({ ...lobby.rules, ...payload.rules });
      if (merged.maxSeats < lobby.seats.length) {
        return fail(player, 'rules', `maxSeats ${merged.maxSeats} < ${lobby.seats.length} seated players`);
      }
      lobby.rules = merged;
    }
    if (payload?.boardId !== undefined) {
      if (!boards.get(payload.boardId)) return fail(player, 'board', `unknown board "${payload.boardId}"`);
      lobby.boardId = payload.boardId;
    }
    seatsChanged(lobby);
  }

  /** add_bot{difficulty}. */
  function addBot(player, payload) {
    const lobby = requireHost(player);
    if (!lobby) return;
    if (lobby.seats.length >= lobby.rules.maxSeats) return fail(player, 'full', 'lobby is full');
    addBotSeat(lobby, payload?.difficulty);
    seatsChanged(lobby);
  }

  /** remove_bot{seat}. */
  function removeBot(player, payload) {
    const lobby = requireHost(player);
    if (!lobby) return;
    const idx = lobby.seats.findIndex((s) => s.seat === payload?.seat && s.isBot);
    if (idx === -1) return fail(player, 'bot', `no bot on seat ${payload?.seat}`);
    lobby.seats.splice(idx, 1);
    seatsChanged(lobby);
  }

  /* ---------------- member state ------------------------------------- */

  /** select_character{characterId, cosmetics} - fully validated, nothing a
   * client sends is trusted (unknown characters/slots are dropped). */
  function selectCharacter(player, payload) {
    const lobby = player.lobby;
    const seat = lobby ? seatOf(lobby, player.id) : null;
    if (!seat || lobby.started) return;
    const charId = String(payload?.characterId ?? '').slice(0, 64);
    if (charId && !characters.get(charId)) {
      return fail(player, 'character', `unknown character "${charId}"`);
    }
    seat.characterId = charId || null;
    const cosmetics = {};
    const raw = payload?.cosmetics;
    if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const slot of COSMETIC_SLOTS) {
        const value = raw[slot];
        if (typeof value === 'string' && value.length > 0) {
          cosmetics[slot] = value.slice(0, COSMETIC_MAX_LEN);
        } else if (value === null) {
          cosmetics[slot] = null;
        }
      }
    }
    seat.cosmetics = cosmetics;
    broadcastState(lobby);
  }

  /** ready{ready}. */
  function setReady(player, payload) {
    const lobby = player.lobby;
    const seat = lobby ? seatOf(lobby, player.id) : null;
    if (!seat || lobby.started) return;
    seat.ready = Boolean(payload?.ready);
    seatsChanged(lobby);
  }

  /* ---------------- starting a match --------------------------------- */

  /** start_game{} from the host. */
  function startGame(player) {
    const lobby = requireHost(player, { allowStarted: true });
    if (!lobby) return;
    startLobby(lobby, { force: false, starter: player });
  }

  /**
   * Start (or auto-start) a lobby's match.
   * @param {Object} lobby
   * @param {{force?: boolean, starter?: Object}} opts force = skip the
   *   ready check (quick-match countdown).
   */
  function startLobby(lobby, { force = false, starter = null } = {}) {
    if (lobby.started) {
      if (starter) fail(starter, 'start', 'match already started');
      return;
    }
    const humans = humanSeats(lobby);
    if (!force && humans.some((s) => s.connected && !s.ready)) {
      if (starter) fail(starter, 'start', 'all players must be ready');
      return;
    }
    if (lobby.rules.botsFill) {
      while (lobby.seats.length < lobby.rules.maxSeats) addBotSeat(lobby, lobby.rules.botDifficulty);
    }
    if (lobby.seats.length < MIN_PLAYERS) {
      if (starter) fail(starter, 'start', `need at least ${MIN_PLAYERS} seats filled`);
      return;
    }
    assignBotCharacters(lobby);
    cancelCountdown(lobby);
    lobby.started = true;
    broadcastState(lobby);
    lobby.room = createRoom({
      lobby,
      config,
      log: log.child(`room:${lobby.code}`),
      connections,
      broadcast: (t, payload) => broadcast(lobby, t, payload),
      onDispose: () => onRoomDisposed(lobby),
    });
    log.info('match_starting', { code: lobby.code, seats: lobby.seats.length });
    lobby.room.start();
  }

  /** Give every character-less bot a random UNUSED character (perks +
   * distinct look) right before the match starts. */
  function assignBotCharacters(lobby) {
    const allIds = characters.ids();
    if (allIds.length === 0) return;
    const used = new Set(lobby.seats.map((s) => s.characterId).filter(Boolean));
    for (const seat of lobby.seats) {
      if (!seat.isBot || seat.characterId) continue;
      let pool = allIds.filter((id) => !used.has(id));
      if (pool.length === 0) pool = allIds; // more bots than characters: reuse
      const pick = pool[crypto.randomInt(pool.length)];
      seat.characterId = pick;
      used.add(pick);
    }
  }

  /** Room finished + rematch window elapsed: reopen the lobby. */
  function onRoomDisposed(lobby) {
    lobby.room = null;
    lobby.started = false;
    // Prune zombie human seats: their grace expired mid-match (player record
    // forgotten or re-homed), so nobody can ever reclaim them. Keeping them
    // would leave phantom seats and could pin hostId on a dead player.
    for (let i = lobby.seats.length - 1; i >= 0; i -= 1) {
      const seat = lobby.seats[i];
      if (seat.isBot) continue;
      const player = connections.getPlayer(seat.pid);
      if (!player || player.lobby !== lobby) {
        lobby.seats.splice(i, 1);
        log.info('seat_pruned', { code: lobby.code, pid: seat.pid });
      } else {
        seat.ready = false;
      }
    }
    // Mirror the pre-start leave logic: a gone host hands off to the first
    // remaining human, otherwise the lobby would soft-lock (nobody could
    // start, kick bots or edit rules).
    if (!humanSeats(lobby).some((s) => s.pid === lobby.hostId)) {
      lobby.hostId = humanSeats(lobby)[0]?.pid ?? null;
      if (lobby.hostId) log.info('host_reassigned', { code: lobby.code, host: lobby.hostId });
    }
    if (humanSeats(lobby).length === 0 || humanSeats(lobby).every((s) => !s.connected)) {
      disposeLobby(lobby);
      return;
    }
    seatsChanged(lobby);
  }

  /* ---------------- countdown plumbing (used by matchmaking) --------- */

  function cancelCountdown(lobby) {
    if (lobby.countdownTimer) {
      clearTimeout(lobby.countdownTimer);
      lobby.countdownTimer = null;
      lobby.countdownEndsAt = null;
    }
  }

  /* ---------------- connection events -------------------------------- */

  function handlePlayerDisconnect(player) {
    const lobby = player.lobby;
    const seat = lobby ? seatOf(lobby, player.id) : null;
    if (!seat) return;
    seat.connected = false;
    if (lobby.started && lobby.room) {
      lobby.room.handleDisconnect(player.id);
    } else {
      seatsChanged(lobby);
    }
  }

  function handlePlayerResume(player) {
    const lobby = player.lobby;
    const seat = lobby ? seatOf(lobby, player.id) : null;
    if (!seat) return;
    seat.connected = true;
    if (lobby.started && lobby.room) {
      lobby.room.handleResume(player);
    } else {
      seatsChanged(lobby);
    }
  }

  /** Resume grace ran out: free the seat if the match never started. */
  function handleGraceExpired(player) {
    const lobby = player.lobby;
    if (!lobby) return;
    if (!lobby.started) {
      leave(player);
    } else {
      // Seat stays bot-driven for the rest of the match.
      player.lobby = null;
    }
  }

  /* ---------------- teardown ------------------------------------------ */

  function disposeLobby(lobby) {
    cancelCountdown(lobby);
    lobby.room?.dispose({ silent: true });
    lobby.room = null;
    lobbies.delete(lobby.code);
    log.info('lobby_disposed', { code: lobby.code });
  }

  function dispose() {
    for (const lobby of [...lobbies.values()]) disposeLobby(lobby);
  }

  return {
    setHooks,
    create,
    join,
    leave,
    list,
    setLobby,
    addBot,
    removeBot,
    selectCharacter,
    setReady,
    startGame,
    startLobby,
    cancelCountdown,
    broadcast,
    broadcastState,
    handlePlayerDisconnect,
    handlePlayerResume,
    handleGraceExpired,
    all: () => [...lobbies.values()],
    get: (code) => lobbies.get(String(code ?? '').toUpperCase()) ?? null,
    dispose,
  };
}
