/**
 * MONKEY-PARTY authoritative game server (Node + ws).
 *
 * Boot: registerAllContent() -> log registry counts -> listen on PORT env
 * (default 8081). Every wire message is a JSON protocol frame (see
 * shared/protocol.js); the server:
 *  - rejects mismatched protocol versions with error{code:'version'},
 *  - silently ignores (and counts) malformed frames - it NEVER crashes on
 *    hostile input,
 *  - heartbeats each connection (ping every 5s, drop after 15s silence),
 *  - rate-limits per connection (warn at 30 msg/s, kick at 60),
 *  - shuts down gracefully on SIGINT/SIGTERM (error{code:'shutdown'} to
 *    every socket, rooms closed, then exit; see server.shutdown()).
 *
 * `npm run server` boots it; tests import createGameServer({port: 0}).
 * Ops guide: docs/SERVER-OPS.md.
 */

import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';

import { PROTOCOL_VERSION, MSG, SRV, decode } from '#shared/protocol.js';
import { registerAllContent } from '#shared/content/index.js';
import { registries } from '#shared/registries.js';

import { makeConfig, createLogger } from './config.js';
import { createConnectionManager } from './connections.js';
import { createLobbyManager } from './lobbies.js';
import { createMatchmaking } from './matchmaking.js';
import { relayChat, relayEmote } from './room.js';

/**
 * Create + start a game server.
 *
 * @param {{port?: number, config?: Object, silent?: boolean}} [opts]
 *   port 0 = ephemeral (tests). `config` overlays DEFAULT_CONFIG.
 * @returns {Promise<{port: number, wss: Object, config: Object,
 *   connections: Object, lobbies: Object, matchmaking: Object,
 *   stats: Object, close: () => Promise<void>}>}
 */
export async function createGameServer(opts = {}) {
  const config = makeConfig(opts.config);
  const log = createLogger('srv', { silent: Boolean(opts.silent) });

  // Content first: rooms need boards/items/minigames in the registries.
  const report = await registerAllContent();
  log.info('content_registered', {
    boards: registries.boards.count(),
    characters: registries.characters.count(),
    items: registries.items.count(),
    minigames: registries.minigames.count(),
    loaded: report.loaded.join(',') || 'none',
    missing: report.missing.join(',') || 'none',
  });

  const connections = createConnectionManager({ config, log: log.child('conn') });
  const lobbies = createLobbyManager({ config, log: log.child('lobby'), connections });
  const matchmaking = createMatchmaking({ config, log: log.child('mm'), lobbies, connections });
  connections.bindLobbies(lobbies);

  const stats = { received: 0, malformed: 0, versionRejected: 0, rateKicked: 0 };

  /** @type {Set<Object>} live per-socket conn records. */
  const conns = new Set();

  /* ---------------- message routing ---------------------------------- */

  function requirePlayer(conn) {
    if (conn.player) return conn.player;
    connections.sendSocket(conn.socket, SRV.ERROR, { code: 'hello', msg: 'send hello or resume first' });
    return null;
  }

  function lobbyBroadcaster(player) {
    return (t, payload) => lobbies.broadcast(player.lobby, t, payload);
  }

  function route(conn, t, payload) {
    switch (t) {
      case MSG.PONG:
        return; // lastSeen was already refreshed
      case MSG.HELLO:
        connections.handleHello(conn, payload);
        return;
      case MSG.RESUME:
        connections.handleResume(conn, payload);
        return;
      default:
        break;
    }

    const player = requirePlayer(conn);
    if (!player) return;
    const room = player.lobby?.room ?? null;

    switch (t) {
      case MSG.CREATE_LOBBY: lobbies.create(player, payload); return;
      case MSG.JOIN_LOBBY: lobbies.join(player, payload); return;
      case MSG.LEAVE_LOBBY: lobbies.leave(player); return;
      case MSG.LIST_LOBBIES: lobbies.list(player); return;
      case MSG.QUICK_MATCH: matchmaking.quickMatch(player); return;
      case MSG.LOBBY_SET: lobbies.setLobby(player, payload); return;
      case MSG.ADD_BOT: lobbies.addBot(player, payload); return;
      case MSG.REMOVE_BOT: lobbies.removeBot(player, payload); return;
      case MSG.SELECT_CHARACTER: lobbies.selectCharacter(player, payload); return;
      case MSG.READY: lobbies.setReady(player, payload); return;
      case MSG.START_GAME: lobbies.startGame(player); return;
      case MSG.ACTION:
        if (room) room.handleAction(player, payload);
        else connections.sendError(player, 'match', 'no match in progress');
        return;
      case MSG.MG_INPUT:
        room?.handleMgInput(player, payload); // no room / not playing: ignore
        return;
      case MSG.CHAT:
        if (player.lobby) relayChat({ config, broadcast: lobbyBroadcaster(player) }, player, payload?.text);
        return;
      case MSG.EMOTE:
        if (player.lobby) relayEmote({ broadcast: lobbyBroadcaster(player) }, player, payload?.emoteId);
        return;
      default:
        // Known protocol type without a server handler: ignore.
        return;
    }
  }

  /* ---------------- per-connection intake ------------------------------ */

  function onMessage(conn, data, isBinary) {
    conn.lastSeen = Date.now();
    stats.received += 1;

    // Rate limit: fixed 1s windows per connection.
    const now = Date.now();
    if (now - conn.rate.windowStart >= 1000) {
      conn.rate.windowStart = now;
      conn.rate.count = 0;
      conn.rate.warned = false;
    }
    conn.rate.count += 1;
    if (conn.rate.count >= config.rateKickPerSec) {
      if (!conn.kicked) {
        conn.kicked = true;
        stats.rateKicked += 1;
        log.warn('rate_kick', { pid: conn.player?.id ?? null, count: conn.rate.count });
        connections.sendSocket(conn.socket, SRV.ERROR, { code: 'rate', msg: 'rate limit exceeded - disconnecting' });
        conn.socket.close(1008, 'rate limit');
      }
      return;
    }
    if (conn.rate.count >= config.rateWarnPerSec && !conn.rate.warned) {
      conn.rate.warned = true;
      log.warn('rate_warn', { pid: conn.player?.id ?? null, count: conn.rate.count });
      connections.sendSocket(conn.socket, SRV.ERROR, { code: 'rate', msg: 'slow down (rate warning)' });
    }

    if (isBinary) {
      conn.malformed += 1;
      stats.malformed += 1;
      return;
    }

    const str = typeof data === 'string' ? data : data.toString('utf8');
    const msg = decode(str);
    if (!msg) {
      // Distinguish a clean version mismatch from garbage.
      let raw = null;
      try {
        raw = JSON.parse(str);
      } catch { /* not JSON */ }
      if (raw !== null && typeof raw === 'object' && !Array.isArray(raw) && raw.v !== PROTOCOL_VERSION) {
        stats.versionRejected += 1;
        connections.sendSocket(conn.socket, SRV.ERROR, {
          code: 'version',
          msg: `protocol version mismatch (server v${PROTOCOL_VERSION})`,
        });
        return;
      }
      conn.malformed += 1;
      stats.malformed += 1;
      return; // malformed: ignore, never throw
    }

    route(conn, msg.t, msg.payload);
  }

  /* ---------------- ws server ------------------------------------------ */

  const wss = new WebSocketServer({
    port: opts.port ?? config.port,
    maxPayload: config.maxPayloadBytes,
  });

  await new Promise((resolve, reject) => {
    wss.once('listening', resolve);
    wss.once('error', reject);
  });
  const port = wss.address().port;

  wss.on('connection', (socket) => {
    const conn = {
      socket,
      player: null,
      lastSeen: Date.now(),
      rate: { windowStart: Date.now(), count: 0, warned: false },
      kicked: false,
      malformed: 0,
    };
    conns.add(conn);

    socket.on('message', (data, isBinary) => {
      try {
        onMessage(conn, data, isBinary);
      } catch (err) {
        // Absolute backstop: one bad message must never take the server down.
        log.error('message_handler_crashed', { pid: conn.player?.id ?? null, err: err?.message });
      }
    });
    socket.on('close', () => {
      conns.delete(conn);
      try {
        connections.handleDisconnect(conn);
      } catch (err) {
        log.error('disconnect_handler_crashed', { err: err?.message });
      }
    });
    socket.on('error', (err) => {
      log.warn('socket_error', { err: err?.message });
    });
  });

  wss.on('error', (err) => {
    log.error('wss_error', { err: err?.message });
  });

  // Heartbeat: ping everyone, drop the silent.
  const heartbeat = setInterval(() => {
    const now = Date.now();
    for (const conn of conns) {
      if (now - conn.lastSeen > config.heartbeatTimeoutMs) {
        log.info('heartbeat_drop', { pid: conn.player?.id ?? null });
        conn.socket.terminate();
      } else {
        connections.sendSocket(conn.socket, SRV.PING, {});
      }
    }
  }, config.heartbeatIntervalMs);
  heartbeat.unref?.();

  log.info('listening', { port, protocol: PROTOCOL_VERSION });

  async function close() {
    clearInterval(heartbeat);
    lobbies.dispose();
    connections.dispose();
    for (const conn of conns) {
      try {
        conn.socket.terminate();
      } catch { /* already gone */ }
    }
    conns.clear();
    await new Promise((resolve) => wss.close(() => resolve()));
    log.info('closed', { stats: JSON.stringify(stats) });
  }

  /**
   * Graceful shutdown (SIGINT/SIGTERM in CLI mode): notify every socket
   * with error{code:'shutdown'}, give the notice config.shutdownFlushMs to
   * flush, then close rooms/lobbies and the ws server. Idempotent.
   */
  let shutdownPromise = null;
  function shutdown() {
    if (!shutdownPromise) shutdownPromise = doShutdown();
    return shutdownPromise;
  }

  async function doShutdown() {
    log.info('shutting_down', { conns: conns.size, lobbies: lobbies.all().length });
    for (const conn of conns) {
      connections.sendSocket(conn.socket, SRV.ERROR, { code: 'shutdown', msg: 'server is shutting down' });
      try {
        conn.socket.close(1001, 'server shutdown');
      } catch { /* already gone */ }
    }
    // Let the notice + close frames flush before the hard teardown.
    const deadline = Date.now() + config.shutdownFlushMs;
    while (conns.size > 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    await close();
  }

  return { port, wss, config, connections, lobbies, matchmaking, stats, close, shutdown };
}

/* ------------------------------------------------------------------ */
/* CLI boot (`npm run server`)                                         */
/* ------------------------------------------------------------------ */

const isMain = (() => {
  try {
    return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
})();

if (isMain) {
  const port = Number(process.env.PORT) > 0 ? Number(process.env.PORT) : undefined;
  createGameServer({ port })
    .then((server) => {
      // Graceful shutdown: notify sockets (error{code:'shutdown'}), close
      // rooms/lobbies, then exit. A watchdog force-exits if teardown hangs.
      const onSignal = (signal) => {
        console.log(`[mp:srv] ${signal} received - shutting down gracefully`);
        const watchdog = setTimeout(() => process.exit(1), 5000);
        watchdog.unref?.();
        server.shutdown()
          .then(() => process.exit(0))
          .catch((err) => {
            console.error('[mp:srv] shutdown error:', err);
            process.exit(1);
          });
      };
      process.once('SIGINT', () => onSignal('SIGINT'));
      process.once('SIGTERM', () => onSignal('SIGTERM'));
    })
    .catch((err) => {
      console.error('[mp:srv] fatal boot error:', err);
      process.exit(1);
    });
}
