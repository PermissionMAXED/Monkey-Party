/**
 * Online Robustness package: server hardening tests.
 *
 * Uses the same createGameServer factory + real ws clients as
 * tests/server.test.js. Covers:
 *  - idle-lobby reaping (config.lobbyIdleMs, tiny override),
 *  - lobby caps: config.maxLobbies -> error{code:'full'}, one lobby per
 *    connection -> error{code:'lobby'},
 *  - a malformed-frame flood below the kick rate: the connection survives
 *    and stats.malformed counts every frame,
 *  - resume flow: create lobby -> kill socket -> resume with the signed
 *    token -> same player, still host, host powers intact,
 *  - mid-match resume-grace expiry broadcasts a pid:'' system chat notice,
 *  - graceful shutdown: sockets get error{code:'shutdown'} and the
 *    shutdown promise resolves.
 *
 * Every test closes its server + sockets so the process exits cleanly.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';

import { MSG, SRV, encode, decode, PROTOCOL_VERSION } from '#shared/protocol.js';
import { createGameServer } from '../server/index.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Fast-bot config so tests don't sit through humanized delays. */
const FAST_CONFIG = { botDelayMinMs: 30, botDelayMaxMs: 90 };

async function waitUntil(fn, timeoutMs = 10000, label = 'condition', every = 25) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (fn()) return;
    await sleep(every);
  }
  throw new Error(`waitUntil timeout: ${label}`);
}

/* ------------------------------------------------------------------ */
/* Minimal test client (protocol codec + typed waiters)                */
/* ------------------------------------------------------------------ */

class TestClient {
  constructor(url, name) {
    this.url = url;
    this.name = name;
    this.ws = null;
    this.msgs = [];
    this.waiters = [];
    this.pid = null;
    this.token = null;
    this.lastLobby = null;
    this.closed = false;
  }

  openSocket() {
    this.ws = new WebSocket(this.url);
    this.closed = false;
    this.ws.on('message', (data) => {
      try {
        this.handleRaw(data.toString());
      } catch { /* decode errors are the server's problem, not ours */ }
    });
    this.ws.on('error', () => { /* close follows */ });
    this.ws.on('close', () => {
      this.closed = true;
    });
    return new Promise((resolve, reject) => {
      this.ws.once('open', resolve);
      this.ws.once('error', reject);
    });
  }

  async connect() {
    await this.openSocket();
    this.send(MSG.HELLO, { name: this.name });
    await this.once(SRV.WELCOME);
  }

  /** Fresh socket + resume{token} (reconnect). */
  async resume() {
    await this.openSocket();
    this.send(MSG.RESUME, { token: this.token });
  }

  send(t, payload = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(encode(t, payload));
    }
  }

  handleRaw(str) {
    const msg = decode(str);
    if (!msg) return;
    this.msgs.push({ t: msg.t, payload: msg.payload });
    if (msg.t === SRV.WELCOME) {
      this.pid = msg.payload.playerId;
      this.token = msg.payload.resumeToken;
    }
    if (msg.t === SRV.PING) this.send(MSG.PONG, {});
    if (msg.t === SRV.LOBBY_STATE) this.lastLobby = msg.payload.lobby;
    const matched = this.waiters.filter((w) => w.type === msg.t && (!w.match || w.match(msg.payload)));
    for (const w of matched) {
      this.waiters.splice(this.waiters.indexOf(w), 1);
      clearTimeout(w.timer);
      w.resolve(msg.payload);
    }
  }

  /** Resolve with the NEXT message of this type (received after the call). */
  next(type, timeoutMs = 10000, label = '', match = null) {
    return new Promise((resolve, reject) => {
      const w = { type, resolve, match, timer: null };
      w.timer = setTimeout(() => {
        const i = this.waiters.indexOf(w);
        if (i >= 0) this.waiters.splice(i, 1);
        reject(new Error(`[${this.name}] timeout waiting for "${type}" ${label}`));
      }, timeoutMs);
      this.waiters.push(w);
    });
  }

  /** First message of this type, past or future. */
  once(type, timeoutMs = 10000) {
    const found = this.msgs.find((m) => m.t === type);
    return found ? Promise.resolve(found.payload) : this.next(type, timeoutMs);
  }

  count(type) {
    return this.msgs.filter((m) => m.t === type).length;
  }

  dispose() {
    for (const w of this.waiters) clearTimeout(w.timer);
    this.waiters.length = 0;
    try {
      this.ws?.terminate();
    } catch { /* already gone */ }
  }
}

/* ------------------------------------------------------------------ */
/* Idle-lobby reaping                                                  */
/* ------------------------------------------------------------------ */

test('idle-lobby reaping: a lobby with zero connected humans and no room is disposed after lobbyIdleMs; active lobbies are not', { timeout: 30000 }, async () => {
  // Long resume grace so the grace-expiry path CANNOT be the one cleaning
  // up - only the reaper can dispose the lobby here.
  const server = await createGameServer({
    port: 0,
    silent: true,
    config: { ...FAST_CONFIG, lobbyIdleMs: 150, resumeGraceMs: 60000 },
  });
  const url = `ws://127.0.0.1:${server.port}`;
  const ghost = new TestClient(url, 'Ghost');
  const stayer = new TestClient(url, 'Stayer');

  try {
    await ghost.connect();
    await stayer.connect();
    ghost.send(MSG.CREATE_LOBBY, { isPublic: false, rules: {}, boardId: 'jungle_ruins' });
    const ghostLobby = (await ghost.next(SRV.LOBBY_STATE)).lobby;
    stayer.send(MSG.CREATE_LOBBY, { isPublic: false, rules: {}, boardId: 'jungle_ruins' });
    const stayerLobby = (await stayer.next(SRV.LOBBY_STATE)).lobby;
    assert.equal(server.lobbies.all().length, 2, 'both lobbies exist');

    // Ghost's socket dies; its 60s grace keeps the player record alive, so
    // the lobby sits with one DISCONNECTED human and no room.
    ghost.ws.terminate();
    await waitUntil(
      () => server.lobbies.all().length === 1,
      10000,
      'idle lobby reaped',
    );
    assert.equal(server.lobbies.get(ghostLobby.code), null, 'the ghost lobby is gone');
    assert.ok(server.lobbies.get(stayerLobby.code), 'the active lobby survived the sweep');

    // The grace-window player was detached, so a late resume cannot land
    // inside a zombie lobby.
    const ghostPlayer = server.connections.getPlayer(ghost.pid);
    assert.ok(ghostPlayer, 'ghost player record still resumable (grace not expired)');
    assert.equal(ghostPlayer.lobby, null, 'ghost player was detached from the reaped lobby');

    // A connected-but-idle lobby must NEVER be reaped: wait several idle
    // windows and confirm it is still there.
    await sleep(600);
    assert.ok(server.lobbies.get(stayerLobby.code), 'connected lobby not reaped after 4x lobbyIdleMs');
  } finally {
    ghost.dispose();
    stayer.dispose();
    await server.close();
  }
});

/* ------------------------------------------------------------------ */
/* Lobby caps                                                          */
/* ------------------------------------------------------------------ */

test('lobby caps: create beyond maxLobbies fails with error{code:"full"}; a connection can only hold one lobby', { timeout: 30000 }, async () => {
  const server = await createGameServer({
    port: 0,
    silent: true,
    config: { ...FAST_CONFIG, maxLobbies: 2 },
  });
  const url = `ws://127.0.0.1:${server.port}`;
  const a = new TestClient(url, 'Cap-A');
  const b = new TestClient(url, 'Cap-B');
  const c = new TestClient(url, 'Cap-C');

  try {
    await a.connect();
    await b.connect();
    await c.connect();

    a.send(MSG.CREATE_LOBBY, { isPublic: false, rules: {}, boardId: 'jungle_ruins' });
    await a.next(SRV.LOBBY_STATE);

    // Per-connection cap (1): creating while already seated is refused.
    const errLobbyP = a.next(SRV.ERROR);
    a.send(MSG.CREATE_LOBBY, { isPublic: false, rules: {}, boardId: 'jungle_ruins' });
    const errLobby = await errLobbyP;
    assert.equal(errLobby.code, 'lobby', 'second create from the same connection rejected');
    assert.equal(server.lobbies.all().length, 1, 'no extra lobby was created');

    b.send(MSG.CREATE_LOBBY, { isPublic: false, rules: {}, boardId: 'jungle_ruins' });
    await b.next(SRV.LOBBY_STATE);
    assert.equal(server.lobbies.all().length, 2, 'at capacity');

    // Global cap: the third lobby is refused with the typed 'full' error.
    const errFullP = c.next(SRV.ERROR);
    c.send(MSG.CREATE_LOBBY, { isPublic: false, rules: {}, boardId: 'jungle_ruins' });
    const errFull = await errFullP;
    assert.equal(errFull.code, 'full', 'create beyond maxLobbies rejected with code "full"');
    assert.equal(server.lobbies.all().length, 2, 'capacity was not exceeded');

    // Freeing a slot makes creation work again.
    a.send(MSG.LEAVE_LOBBY, {});
    await waitUntil(() => server.lobbies.all().length === 1, 5000, 'lobby freed');
    c.send(MSG.CREATE_LOBBY, { isPublic: false, rules: {}, boardId: 'jungle_ruins' });
    const lobbyC = (await c.next(SRV.LOBBY_STATE)).lobby;
    assert.ok(lobbyC.code, 'creation succeeds once below the cap');
  } finally {
    a.dispose();
    b.dispose();
    c.dispose();
    await server.close();
  }
});

/* ------------------------------------------------------------------ */
/* Malformed flood below the kick rate                                 */
/* ------------------------------------------------------------------ */

test('malformed flood: a connection spamming garbage below the kick rate survives and every frame is counted', { timeout: 30000 }, async () => {
  const server = await createGameServer({ port: 0, silent: true, config: FAST_CONFIG });
  const url = `ws://127.0.0.1:${server.port}`;
  const c = new TestClient(url, 'Flooder');

  try {
    await c.openSocket();
    const garbage = [
      'not json {{{',
      '',
      'null',
      '[]',
      JSON.stringify({}),
      JSON.stringify({ t: 'hello' }), // missing v
      JSON.stringify({ t: 'nonsense_type', v: PROTOCOL_VERSION }),
      JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, name: 12345 }), // bad payload
      '\u0000\u0001\u0002',
      'x'.repeat(200),
    ];
    const before = server.stats.malformed;
    const beforeVersion = server.stats.versionRejected;
    // 20 frames in one window: comfortably below rateWarnPerSec (30).
    // NOTE: frames that parse as an object with a wrong/missing `v` (like
    // '{}' and {t:'hello'}) are counted as versionRejected, not malformed -
    // assert on the SUM so every hostile frame is accounted for.
    for (let i = 0; i < 20; i += 1) {
      if (i % 7 === 3) c.ws.send(Buffer.from([0xde, 0xad, 0xbe, 0xef])); // binary
      else c.ws.send(garbage[i % garbage.length]);
    }
    await waitUntil(
      () => (server.stats.malformed - before) + (server.stats.versionRejected - beforeVersion) >= 20,
      5000,
      'all 20 hostile frames counted (malformed + versionRejected)',
    );
    assert.ok(server.stats.malformed - before >= 14, 'the bulk was counted as malformed');
    assert.ok(server.stats.versionRejected - beforeVersion >= 1, 'wrong-version frames were counted separately');

    // The SAME socket still works: a valid hello gets a welcome, and the
    // connection was neither kicked nor warned.
    c.send(MSG.HELLO, { name: 'Flooder' });
    await c.once(SRV.WELCOME);
    assert.ok(c.pid, 'connection survived the flood and identified');
    assert.equal(c.closed, false, 'socket was not closed');
    assert.equal(server.stats.rateKicked, 0, 'no rate kick for a below-threshold flood');
    const rateErrors = c.msgs.filter((m) => m.t === SRV.ERROR && m.payload?.code === 'rate');
    assert.deepEqual(rateErrors, [], 'no rate warnings were sent');

    // And it still does real work.
    c.send(MSG.CREATE_LOBBY, { isPublic: false, rules: {}, boardId: 'jungle_ruins' });
    const lobby = (await c.next(SRV.LOBBY_STATE)).lobby;
    assert.equal(lobby.seats.length, 1);
  } finally {
    c.dispose();
    await server.close();
  }
});

/* ------------------------------------------------------------------ */
/* Resume flow: still host after a socket drop                         */
/* ------------------------------------------------------------------ */

test('resume flow: connect -> create lobby -> kill socket -> resume with token -> same player, still host', { timeout: 30000 }, async () => {
  const server = await createGameServer({ port: 0, silent: true, config: FAST_CONFIG });
  const url = `ws://127.0.0.1:${server.port}`;
  const host = new TestClient(url, 'Host');
  const guest = new TestClient(url, 'Guest');

  try {
    await host.connect();
    await guest.connect();
    host.send(MSG.CREATE_LOBBY, { isPublic: false, rules: {}, boardId: 'jungle_ruins' });
    const lobby = (await host.next(SRV.LOBBY_STATE)).lobby;
    assert.equal(lobby.hostId, host.pid);
    guest.send(MSG.JOIN_LOBBY, { code: lobby.code });
    await guest.once(SRV.LOBBY_STATE);

    // Kill the host's socket without leaving; the guest sees the seat grey
    // out (connected=false) while the resume grace runs.
    const hostPid = host.pid;
    const hostToken = host.token;
    host.ws.terminate();
    await waitUntil(
      () => guest.lastLobby?.seats.some((s) => s.pid === hostPid && s.connected === false),
      10000,
      'host seat marked disconnected',
    );
    assert.ok(server.lobbies.get(lobby.code), 'lobby survives the drop (grace window)');

    // Fresh socket + resume{token}: identity and host powers come back.
    const stateP = host.next(SRV.LOBBY_STATE);
    await host.resume();
    const welcome = await host.next(SRV.WELCOME, 10000, '(resume welcome)');
    assert.equal(welcome.playerId, hostPid, 'resume returns the SAME player id');
    assert.equal(welcome.resumeToken, hostToken, 'token is stable across resume');
    const resumed = (await stateP).lobby;
    assert.equal(resumed.hostId, hostPid, 'still the host after resume');
    assert.equal(
      resumed.seats.find((s) => s.pid === hostPid)?.connected,
      true,
      'seat is connected again',
    );

    // Host powers actually work: add_bot succeeds.
    host.send(MSG.ADD_BOT, { difficulty: 'easy' });
    await waitUntil(
      () => (host.lastLobby?.seats.length ?? 0) === 3,
      5000,
      'resumed host can add a bot',
    );
  } finally {
    host.dispose();
    guest.dispose();
    await server.close();
  }
});

/* ------------------------------------------------------------------ */
/* Mid-match grace expiry -> system chat notice                        */
/* ------------------------------------------------------------------ */

test('mid-match grace expiry broadcasts a pid:"" system chat notice ("X left — bot takes over")', { timeout: 60000 }, async () => {
  const server = await createGameServer({
    port: 0,
    silent: true,
    config: { ...FAST_CONFIG, resumeGraceMs: 250 },
  });
  const url = `ws://127.0.0.1:${server.port}`;
  const stayer = new TestClient(url, 'Stayer');
  const leaver = new TestClient(url, 'Leaver');

  try {
    await stayer.connect();
    await leaver.connect();
    stayer.send(MSG.CREATE_LOBBY, {
      isPublic: false,
      rules: { rounds: 3, minigameEvery: 0, fastMode: true, botsFill: false, maxSeats: 4, items: 'off' },
      boardId: 'jungle_ruins',
    });
    const lobby = (await stayer.next(SRV.LOBBY_STATE)).lobby;
    leaver.send(MSG.JOIN_LOBBY, { code: lobby.code });
    await leaver.once(SRV.LOBBY_STATE);
    stayer.send(MSG.READY, { ready: true });
    leaver.send(MSG.READY, { ready: true });
    await waitUntil(
      () => stayer.lastLobby?.seats.filter((s) => !s.isBot).every((s) => s.ready),
      10000,
      'humans ready',
    );
    stayer.send(MSG.START_GAME, {});
    await stayer.once(SRV.MATCH_START, 15000);
    await leaver.once(SRV.MATCH_START, 15000);

    // Leaver vanishes mid-match; after the 250ms grace the survivors get
    // the system notice. The SRV.CHAT validator requires pid to be a
    // string, so the system line uses pid:'' (never null).
    const noticeP = stayer.next(SRV.CHAT, 15000, '(system notice)', (p) => p.pid === '');
    leaver.ws.terminate();
    const notice = await noticeP;
    assert.equal(notice.pid, '', 'system notice uses the empty-string pid');
    assert.match(notice.text, /Leaver left — bot takes over/, 'notice names the player and the bot takeover');
  } finally {
    stayer.dispose();
    leaver.dispose();
    await server.close();
  }
});

/* ------------------------------------------------------------------ */
/* Graceful shutdown                                                   */
/* ------------------------------------------------------------------ */

test('graceful shutdown: sockets get error{code:"shutdown"}, rooms close, and shutdown() resolves', { timeout: 30000 }, async () => {
  const server = await createGameServer({
    port: 0,
    silent: true,
    config: { ...FAST_CONFIG, shutdownFlushMs: 300 },
  });
  const url = `ws://127.0.0.1:${server.port}`;
  const a = new TestClient(url, 'Down-A');
  const b = new TestClient(url, 'Down-B');

  try {
    await a.connect();
    await b.connect();

    // Put a real match room on the server so shutdown has rooms to close.
    a.send(MSG.CREATE_LOBBY, {
      isPublic: false,
      rules: { rounds: 3, minigameEvery: 0, fastMode: true, botsFill: false, maxSeats: 4, items: 'off' },
      boardId: 'jungle_ruins',
    });
    const lobby = (await a.next(SRV.LOBBY_STATE)).lobby;
    b.send(MSG.JOIN_LOBBY, { code: lobby.code });
    await b.once(SRV.LOBBY_STATE);
    a.send(MSG.READY, { ready: true });
    b.send(MSG.READY, { ready: true });
    await waitUntil(
      () => a.lastLobby?.seats.filter((s) => !s.isBot).every((s) => s.ready),
      10000,
      'humans ready',
    );
    a.send(MSG.START_GAME, {});
    await a.once(SRV.MATCH_START, 15000);
    assert.ok(server.lobbies.all()[0]?.room, 'a room is running');

    const errAP = a.next(SRV.ERROR, 10000, '(shutdown notice A)', (p) => p.code === 'shutdown');
    const errBP = b.next(SRV.ERROR, 10000, '(shutdown notice B)', (p) => p.code === 'shutdown');

    // shutdown() must resolve (idempotently) and notify every socket first.
    const shutdownP = server.shutdown();
    const [errA, errB] = await Promise.all([errAP, errBP]);
    assert.equal(errA.code, 'shutdown');
    assert.equal(errB.code, 'shutdown');
    await shutdownP;
    assert.equal(server.shutdown(), shutdownP, 'shutdown() is idempotent (same promise)');

    // Sockets were closed by the server.
    await waitUntil(() => a.closed && b.closed, 5000, 'both client sockets closed');
    assert.equal(server.lobbies.all().length, 0, 'all lobbies (and their rooms) were disposed');

    // The listener is gone: a fresh connection must fail.
    await assert.rejects(async () => {
      const probe = new WebSocket(url);
      await new Promise((resolve, reject) => {
        probe.once('open', () => {
          probe.terminate();
          resolve();
        });
        probe.once('error', reject);
      });
    }, 'server no longer accepts connections after shutdown');
  } finally {
    a.dispose();
    b.dispose();
    // close() after shutdown() is a no-op-ish double call; guard with catch.
    await server.close().catch(() => {});
  }
});
