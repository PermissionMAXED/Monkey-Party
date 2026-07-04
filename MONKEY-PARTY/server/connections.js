/**
 * Connection / player identity management.
 *
 * - hello{name}  -> assign playerId + signed resume token, reply welcome.
 * - socket drop  -> during a match: mark disconnected, broadcast
 *   player_conn, start a resume-grace timer (the room's bot host drives the
 *   seat meanwhile). In an unstarted lobby: same grace, seat greyed out.
 * - resume{token} -> verify HMAC signature, rebind the socket, replay
 *   lobby_state or a full state_sync (room handles the mid-match case).
 *
 * The manager never touches ws directly beyond socket.send/terminate, so
 * it stays trivially testable.
 */

import crypto from 'node:crypto';
import { SRV, encode } from '#shared/protocol.js';

/**
 * @param {{config: Object, log: Object}} deps
 */
export function createConnectionManager({ config, log }) {
  /** Per-process token-signing secret (tokens die with the process). */
  const secret = crypto.randomBytes(32);

  /** @type {Map<string, Object>} playerId -> player record. */
  const players = new Map();
  /** @type {Map<string, string>} resumeToken -> playerId. */
  const tokens = new Map();

  /** Late-bound lobby manager (avoids a module cycle). */
  let lobbies = null;

  function bindLobbies(lobbyManager) {
    lobbies = lobbyManager;
  }

  /* ---------------- send helpers ---------------------------------- */

  function sendSocket(socket, t, payload = {}) {
    if (!socket || socket.readyState !== 1 /* OPEN */) return false;
    try {
      socket.send(encode(t, payload));
      return true;
    } catch (err) {
      log.warn('send_failed', { t, err: err?.message });
      return false;
    }
  }

  /** Send to a player's live socket (no-op while disconnected). */
  function send(player, t, payload = {}) {
    return sendSocket(player?.conn?.socket, t, payload);
  }

  function sendError(target, code, msg) {
    const socket = target?.socket ?? target?.conn?.socket ?? target;
    return sendSocket(socket, SRV.ERROR, { code, msg });
  }

  /* ---------------- tokens ---------------------------------------- */

  function sign(body) {
    return crypto.createHmac('sha256', secret).update(body).digest('base64url');
  }

  function issueToken(playerId) {
    const body = `${playerId}.${crypto.randomBytes(12).toString('base64url')}`;
    return `${body}.${sign(body)}`;
  }

  /** @returns {string|null} playerId when the signature checks out. */
  function verifyToken(token) {
    if (typeof token !== 'string' || token.length < 10 || token.length > 256) return null;
    const cut = token.lastIndexOf('.');
    if (cut <= 0) return null;
    const body = token.slice(0, cut);
    const sig = Buffer.from(token.slice(cut + 1));
    const expected = Buffer.from(sign(body));
    if (sig.length !== expected.length || !crypto.timingSafeEqual(sig, expected)) return null;
    return body.split('.')[0] ?? null;
  }

  /* ---------------- player records --------------------------------- */

  function sanitizeName(name) {
    const cleaned = String(name ?? '')
      .replace(/[^\S ]/g, ' ') // control chars / newlines -> space
      .trim()
      .slice(0, config.maxNameLen);
    return cleaned.length > 0 ? cleaned : 'Monkey';
  }

  function newPlayerId() {
    let id;
    do {
      id = `p_${crypto.randomBytes(4).toString('hex')}`;
    } while (players.has(id));
    return id;
  }

  /**
   * hello{name}: create (or re-announce) the player bound to this conn.
   * @param {Object} conn Per-socket record from index.js ({socket, player}).
   */
  function handleHello(conn, payload) {
    if (conn.player) {
      // Repeat hello: just re-send the identity (idempotent).
      send(conn.player, SRV.WELCOME, {
        playerId: conn.player.id,
        resumeToken: conn.player.resumeToken,
      });
      return conn.player;
    }
    const id = newPlayerId();
    const player = {
      id,
      name: sanitizeName(payload?.name),
      resumeToken: issueToken(id),
      conn,
      lobby: null,
      graceTimer: null,
      lastChatAt: 0,
    };
    players.set(id, player);
    tokens.set(player.resumeToken, id);
    conn.player = player;
    log.info('player_hello', { pid: id, name: player.name });
    send(player, SRV.WELCOME, { playerId: id, resumeToken: player.resumeToken });
    return player;
  }

  /** Remove a player entirely (token no longer resumable). */
  function forget(player) {
    if (player.graceTimer) {
      clearTimeout(player.graceTimer);
      player.graceTimer = null;
    }
    tokens.delete(player.resumeToken);
    players.delete(player.id);
    if (player.lobby && lobbies) lobbies.handleGraceExpired(player);
    log.info('player_forgotten', { pid: player.id });
  }

  /* ---------------- disconnect / resume ----------------------------- */

  /** Socket dropped (index.js calls this from ws 'close'). */
  function handleDisconnect(conn) {
    const player = conn.player;
    if (!player || player.conn !== conn) return; // stale socket, already rebound
    player.conn = null;

    if (!player.lobby) {
      forget(player); // nothing to come back to
      return;
    }

    // In a lobby (started or not): grace window, bot host covers the seat.
    log.info('player_disconnected', { pid: player.id, lobby: player.lobby.code });
    if (lobbies) lobbies.handlePlayerDisconnect(player);
    if (player.graceTimer) clearTimeout(player.graceTimer);
    player.graceTimer = setTimeout(() => {
      player.graceTimer = null;
      if (!player.conn) {
        log.info('resume_grace_expired', { pid: player.id });
        forget(player);
      }
    }, config.resumeGraceMs);
    player.graceTimer.unref?.();
  }

  /** resume{token}: rebind this socket to the existing player. */
  function handleResume(conn, payload) {
    const pid = verifyToken(payload?.token);
    const player = pid ? players.get(pid) : null;
    if (!player || player.resumeToken !== payload.token) {
      sendError(conn, 'resume', 'invalid or expired resume token');
      return null;
    }
    if (conn.player && conn.player !== player) {
      sendError(conn, 'resume', 'connection already identifies another player');
      return null;
    }
    // Rebind: kill any zombie socket still attached.
    if (player.conn && player.conn !== conn) {
      try {
        player.conn.player = null;
        player.conn.socket?.terminate?.();
      } catch { /* already gone */ }
    }
    if (player.graceTimer) {
      clearTimeout(player.graceTimer);
      player.graceTimer = null;
    }
    conn.player = player;
    player.conn = conn;
    log.info('player_resumed', { pid: player.id, lobby: player.lobby?.code ?? null });
    send(player, SRV.WELCOME, { playerId: player.id, resumeToken: player.resumeToken });
    if (player.lobby && lobbies) lobbies.handlePlayerResume(player);
    return player;
  }

  /* ---------------- teardown ---------------------------------------- */

  function dispose() {
    for (const player of players.values()) {
      if (player.graceTimer) clearTimeout(player.graceTimer);
      player.graceTimer = null;
    }
    players.clear();
    tokens.clear();
  }

  return {
    bindLobbies,
    handleHello,
    handleResume,
    handleDisconnect,
    send,
    sendSocket,
    sendError,
    getPlayer: (pid) => players.get(pid) ?? null,
    playerCount: () => players.size,
    dispose,
  };
}
