/**
 * Online-layer tests (package P10): authoritative ws server end to end.
 *
 * - Full short online match: 2 ws clients + 2 lobby bots play a fastMode
 *   3-round match to game_over. Both clients maintain deterministic sim
 *   replicas from action_applied; their event logs must match EXACTLY.
 * - Mid-match disconnect: one client drops, the bot host covers the seat,
 *   the client resumes via its signed token and receives state_sync.
 * - quick_match pairing + auto-start countdown.
 * - Fuzz: 500 malformed/random frames; the server must stay up.
 *
 * Every test closes its server + sockets so the process exits cleanly.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';

import { MSG, SRV, encode, decode, PROTOCOL_VERSION } from '#shared/protocol.js';
import { createMatchSim } from '#shared/sim/match.js';
import { legalActionsFromState } from '#shared/sim/actions.js';
import { decideBoardAction } from '#shared/ai/boardBot.js';
import { createRng } from '#shared/rng.js';

import { createGameServer } from '../server/index.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Fast-bot config so tests don't sit through humanized delays. */
const FAST_CONFIG = { botDelayMinMs: 30, botDelayMaxMs: 90 };

/* ------------------------------------------------------------------ */
/* Test client: ws + protocol codec + deterministic sim replica        */
/* ------------------------------------------------------------------ */

class TestClient {
  constructor(url, name, seed = 1) {
    this.url = url;
    this.name = name;
    this.ws = null;
    this.msgs = [];
    this.counts = new Map();
    this.waiters = [];
    this.pid = null;
    this.token = null;
    this.lastLobby = null;
    this.matchStart = null;
    this.replica = null;
    this.replicaErrors = [];
    this.appliedCount = 0;
    this.gameOver = false;
    this.lastAnswered = -1;
    this.rng = createRng(seed);
    this.mgInputTimer = null;
    this.mgSeq = 0;
  }

  openSocket() {
    this.ws = new WebSocket(this.url);
    this.ws.on('message', (data) => {
      try {
        this.handleRaw(data.toString());
      } catch (err) {
        this.replicaErrors.push(`handler threw: ${err.message}`);
      }
    });
    this.ws.on('error', () => { /* close follows */ });
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

  /** Fresh socket + resume{token} (mid-match reconnect). */
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
    this.handle(msg.t, msg.payload);
  }

  handle(t, payload) {
    this.msgs.push({ t, payload });
    this.counts.set(t, (this.counts.get(t) ?? 0) + 1);

    switch (t) {
      case SRV.WELCOME:
        this.pid = payload.playerId;
        this.token = payload.resumeToken;
        break;
      case SRV.PING:
        this.send(MSG.PONG, {});
        break;
      case SRV.LOBBY_STATE:
        this.lastLobby = payload.lobby;
        break;
      case SRV.MATCH_START:
        this.matchStart = payload;
        this.replica = createMatchSim({
          seed: payload.seed,
          rules: payload.rules,
          boardId: payload.boardId,
          players: payload.players,
        });
        this.lastAnswered = -1;
        this.checkReplica();
        break;
      case SRV.ACTION_APPLIED:
        this.appliedCount += 1;
        if (this.replica) {
          try {
            this.replica.apply(payload.action);
          } catch (err) {
            this.replicaErrors.push(`apply(${payload.action?.type}): ${err.message}`);
          }
          this.checkReplica();
        }
        break;
      case SRV.STATE_SYNC:
        if (this.matchStart) {
          this.replica = createMatchSim({
            seed: this.matchStart.seed,
            rules: this.matchStart.rules,
            boardId: this.matchStart.boardId,
            players: this.matchStart.players,
          });
          this.replica.restore(payload.snapshot);
          this.lastAnswered = -1;
          this.checkReplica();
        }
        break;
      case SRV.MG_START:
        this.startMgInputs();
        break;
      case SRV.MG_END:
        this.stopMgInputs();
        break;
      default:
        break;
    }

    const matched = this.waiters.filter((w) => w.type === t);
    for (const w of matched) {
      this.waiters.splice(this.waiters.indexOf(w), 1);
      clearTimeout(w.timer);
      w.resolve(payload);
    }
  }

  /** Answer the replica's awaiting decision when it is ours. */
  checkReplica() {
    const state = this.replica.getState();
    if (state.phase === 'game_over') {
      this.gameOver = true;
      this.stopMgInputs();
      return;
    }
    const awaiting = state.awaiting;
    if (!awaiting || awaiting.playerId !== this.pid) return;
    const key = this.replica.getEventLog().length;
    if (key === this.lastAnswered) return;
    this.lastAnswered = key;
    const legal = legalActionsFromState(state, this.pid);
    if (legal.length === 0) return;
    let action = null;
    try {
      action = decideBoardAction(state, legal, this.pid, 'normal', this.rng.fork('act'));
    } catch { /* fall back below */ }
    if (!action) action = legal[0];
    this.send(MSG.ACTION, { action });
  }

  startMgInputs() {
    this.stopMgInputs();
    this.mgInputTimer = setInterval(() => {
      this.send(MSG.MG_INPUT, {
        seq: ++this.mgSeq,
        frame: { move: { x: 1, y: 0 }, a: true, b: false },
      });
    }, 150);
  }

  stopMgInputs() {
    if (this.mgInputTimer) {
      clearInterval(this.mgInputTimer);
      this.mgInputTimer = null;
    }
  }

  /** Resolve with the NEXT message of this type (received after the call). */
  next(type, timeoutMs = 20000, label = '') {
    return new Promise((resolve, reject) => {
      const w = { type, resolve, timer: null };
      w.timer = setTimeout(() => {
        const i = this.waiters.indexOf(w);
        if (i >= 0) this.waiters.splice(i, 1);
        reject(new Error(`[${this.name}] timeout waiting for "${type}" ${label}`));
      }, timeoutMs);
      this.waiters.push(w);
    });
  }

  /** First message of this type, past or future. */
  once(type, timeoutMs = 20000) {
    const found = this.msgs.find((m) => m.t === type);
    return found ? Promise.resolve(found.payload) : this.next(type, timeoutMs);
  }

  count(type) {
    return this.counts.get(type) ?? 0;
  }

  closeSocket() {
    this.stopMgInputs();
    this.ws?.close();
  }

  dispose() {
    this.stopMgInputs();
    for (const w of this.waiters) clearTimeout(w.timer);
    this.waiters.length = 0;
    try {
      this.ws?.terminate();
    } catch { /* already gone */ }
  }
}

async function waitUntil(fn, timeoutMs = 30000, label = 'condition', every = 50) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (fn()) return;
    await sleep(every);
  }
  throw new Error(`waitUntil timeout: ${label}`);
}

/* ------------------------------------------------------------------ */
/* Full match end to end                                               */
/* ------------------------------------------------------------------ */

test('full online match: 2 humans + 2 bots, identical replication, resume via token, game_over', { timeout: 240000 }, async () => {
  const server = await createGameServer({ port: 0, silent: true, config: FAST_CONFIG });
  const url = `ws://127.0.0.1:${server.port}`;
  const c1 = new TestClient(url, 'Alice', 11);
  const c2 = new TestClient(url, 'Bob', 22);

  try {
    await c1.connect();
    await c2.connect();
    assert.ok(c1.pid && c1.token, 'c1 got playerId + resumeToken');
    assert.notEqual(c1.pid, c2.pid);

    // Private lobby with a short fastMode ruleset (one minigame at round 3).
    c1.send(MSG.CREATE_LOBBY, {
      isPublic: false,
      rules: {
        rounds: 3,
        minigameEvery: 3,
        fastMode: true,
        botsFill: false,
        maxSeats: 4,
        items: 'off',
        startCoins: 20,
      },
      boardId: 'jungle_ruins',
    });
    const lobby1 = (await c1.next(SRV.LOBBY_STATE)).lobby;
    assert.match(lobby1.code, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/, 'unambiguous 4-char code');
    assert.equal(lobby1.isPublic, false);
    assert.equal(lobby1.rules.rounds, 3);

    // Second human joins, host adds 2 bots.
    c2.send(MSG.JOIN_LOBBY, { code: lobby1.code });
    await c2.once(SRV.LOBBY_STATE);
    c1.send(MSG.ADD_BOT, { difficulty: 'normal' });
    c1.send(MSG.ADD_BOT, { difficulty: 'easy' });
    await waitUntil(() => c1.lastLobby?.seats.length === 4, 10000, '4 seats filled');
    assert.equal(c1.lastLobby.seats.filter((s) => s.isBot).length, 2);

    // Both humans ready -> host starts.
    c1.send(MSG.READY, { ready: true });
    c2.send(MSG.READY, { ready: true });
    await waitUntil(
      () => c1.lastLobby?.seats.filter((s) => !s.isBot).every((s) => s.ready),
      10000,
      'humans ready',
    );
    c1.send(MSG.START_GAME, {});

    const ms1 = await c1.once(SRV.MATCH_START, 15000);
    const ms2 = await c2.once(SRV.MATCH_START, 15000);
    assert.equal(ms1.seed, ms2.seed, 'both clients get the same seed');
    assert.equal(ms1.boardId, 'jungle_ruins');
    assert.equal(ms1.players.length, 4);

    // Chat relay: 200-char cap + 1/s rate limit.
    const chatP = c2.next(SRV.CHAT, 10000);
    c1.send(MSG.CHAT, { text: 'B'.repeat(300) });
    const chat = await chatP;
    assert.equal(chat.pid, c1.pid);
    assert.equal(chat.text.length, 200, 'chat capped at 200 chars');
    c1.send(MSG.CHAT, { text: 'rate limited away' });
    const emoteP = c2.next(SRV.EMOTE, 10000);
    c1.send(MSG.EMOTE, { emoteId: 'wave' });
    const emote = await emoteP;
    assert.deepEqual({ pid: emote.pid, emoteId: emote.emoteId }, { pid: c1.pid, emoteId: 'wave' });
    assert.equal(c2.count(SRV.CHAT), 1, 'second chat within 1s was dropped');

    // Server must reject acting for somebody else.
    const errP = c2.next(SRV.ERROR, 10000);
    c2.send(MSG.ACTION, { action: { type: 'roll', playerId: c1.pid, payload: {} } });
    const err = await errP;
    assert.equal(err.code, 'action', 'impersonated action rejected');

    // Let the match run a bit, then drop c2 mid-match.
    await waitUntil(() => c2.appliedCount >= 6, 60000, 'match under way (6 actions applied)');
    const connDownP = c1.next(SRV.PLAYER_CONN, 15000, '(disconnect)');
    c2.closeSocket();
    const down = await connDownP;
    assert.deepEqual({ pid: down.pid, connected: down.connected }, { pid: c2.pid, connected: false });

    // Bot host keeps the match moving while c2 is gone.
    const appliedWhenDown = c1.appliedCount;
    await waitUntil(
      () => c1.gameOver || c1.appliedCount > appliedWhenDown,
      30000,
      'bot host acts for the disconnected seat',
    );

    // Resume with the signed token: welcome + full state_sync snapshot.
    const connUpP = c1.next(SRV.PLAYER_CONN, 15000, '(reconnect)');
    const syncP = c2.next(SRV.STATE_SYNC, 15000);
    await c2.resume();
    const sync = await syncP;
    assert.ok(sync.snapshot?.state, 'state_sync carries a full snapshot');
    assert.equal(sync.snapshot.state.seed, ms1.seed);
    const up = await connUpP;
    assert.deepEqual({ pid: up.pid, connected: up.connected }, { pid: c2.pid, connected: true });
    assert.equal(c2.count(SRV.STATE_SYNC), 1);

    // Play to the end (includes the round-3 minigame, up to ~60s realtime).
    await waitUntil(() => c1.gameOver && c2.gameOver, 180000, 'match reaches game_over', 100);

    // Minigame pipeline ran and streamed state at 15Hz.
    assert.ok(c1.count(SRV.MG_START) >= 1, 'mg_start broadcast');
    assert.ok(c1.count(SRV.MG_END) >= 1, 'mg_end broadcast');
    assert.ok(c1.count(SRV.MG_STATE) > 20, `mg_state streamed (got ${c1.count(SRV.MG_STATE)})`);
    assert.ok(c2.count(SRV.MG_STATE) > 0, 'resumed client also gets mg_state');

    // No replica ever failed to apply a broadcast action.
    assert.deepEqual(c1.replicaErrors, []);
    assert.deepEqual(c2.replicaErrors, []);

    // THE core assertion: both replicas produced byte-identical event logs.
    const log1 = c1.replica.getEventLog();
    const log2 = c2.replica.getEventLog();
    assert.ok(log1.length > 50, `event log has substance (${log1.length} events)`);
    assert.deepEqual(log1, log2, 'event logs replicate identically to both clients');

    const s1 = c1.replica.getState();
    const s2 = c2.replica.getState();
    assert.equal(s1.phase, 'game_over');
    assert.equal(s2.phase, 'game_over');
    const gameOverEvt = log1[log1.length - 1];
    assert.equal(gameOverEvt.type, 'game_over');
    assert.ok(Array.isArray(gameOverEvt.ranking) && gameOverEvt.ranking.length === 4);
  } finally {
    c1.dispose();
    c2.dispose();
    await server.close();
  }
});

/* ------------------------------------------------------------------ */
/* quick_match matchmaking                                             */
/* ------------------------------------------------------------------ */

test('quick_match pairs two humans into one public lobby and auto-starts', { timeout: 60000 }, async () => {
  const server = await createGameServer({
    port: 0,
    silent: true,
    config: { ...FAST_CONFIG, quickMatchCountdownMs: 400 },
  });
  const url = `ws://127.0.0.1:${server.port}`;
  const a = new TestClient(url, 'Quick-A', 31);
  const b = new TestClient(url, 'Quick-B', 32);
  const c = new TestClient(url, 'Lister', 33);

  try {
    await a.connect();
    await b.connect();
    await c.connect();

    a.send(MSG.QUICK_MATCH, {});
    const lobbyA = (await a.next(SRV.LOBBY_STATE)).lobby;
    assert.equal(lobbyA.isPublic, true, 'quick-match lobby is public');

    // The public lobby is listable.
    const listP = c.next(SRV.LOBBY_LIST, 10000);
    c.send(MSG.LIST_LOBBIES, {});
    const list = await listP;
    assert.ok(list.lobbies.some((l) => l.code === lobbyA.code), 'lobby appears in lobby_list');

    b.send(MSG.QUICK_MATCH, {});
    const lobbyB = (await b.next(SRV.LOBBY_STATE)).lobby;
    assert.equal(lobbyB.code, lobbyA.code, 'second player joins the same public lobby');

    // >= 2 humans: countdown runs, bots fill the remaining seats on start.
    const msA = await a.once(SRV.MATCH_START, 20000);
    const msB = await b.once(SRV.MATCH_START, 20000);
    assert.equal(msA.seed, msB.seed);
    assert.ok(msA.players.length >= 2);
    assert.ok(msA.players.some((p) => p.isBot), 'bots auto-filled the party lobby');
  } finally {
    a.dispose();
    b.dispose();
    c.dispose();
    await server.close();
  }
});

/* ------------------------------------------------------------------ */
/* Fuzz: hostile input never brings the server down                    */
/* ------------------------------------------------------------------ */

function garbageFrame(rng, i) {
  const kinds = [
    () => 'not json at all {{{',
    () => '',
    () => 'null',
    () => '[]',
    () => '42',
    () => '"a string"',
    () => JSON.stringify({}),
    () => JSON.stringify({ t: 'hello' }), // missing v
    () => JSON.stringify({ t: 'hello', v: 999, name: 'x' }), // wrong v
    () => JSON.stringify({ t: 'nonsense_type', v: PROTOCOL_VERSION }),
    () => JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, name: 12345 }), // bad payload
    () => JSON.stringify({ t: 'action', v: PROTOCOL_VERSION, action: 'not-an-object' }),
    () => JSON.stringify({ t: 'mg_input', v: PROTOCOL_VERSION, seq: 'NaN', frame: null }),
    () => JSON.stringify({ t: 'join_lobby', v: PROTOCOL_VERSION, code: { deep: { nested: true } } }),
    () => JSON.stringify({ t: 'resume', v: PROTOCOL_VERSION, token: 'forged.token.aaaa' }),
    () => JSON.stringify({ t: 'chat', v: PROTOCOL_VERSION, text: 'x'.repeat(5000) }),
    () => `{"t":"hello","v":${PROTOCOL_VERSION},"name":"trunc`, // cut-off JSON
    () => '\u0000\u0001\u0002', // control garbage
    () => JSON.stringify({ v: PROTOCOL_VERSION }), // no t
    () => `x`.repeat(1 + (i % 300)),
  ];
  return kinds[Math.floor(rng.next() * kinds.length)]();
}

test('fuzz: 500 malformed/random messages leave the server healthy', { timeout: 60000 }, async () => {
  const server = await createGameServer({ port: 0, silent: true, config: FAST_CONFIG });
  const url = `ws://127.0.0.1:${server.port}`;
  const rng = createRng(0xf00d);
  const sockets = [];
  const health = new TestClient(url, 'Health', 44);

  try {
    // A well-formed frame with a wrong protocol version gets a typed error.
    const probe = new WebSocket(url);
    await new Promise((resolve, reject) => {
      probe.once('open', resolve);
      probe.once('error', reject);
    });
    const versionErr = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('no version error received')), 5000);
      probe.on('message', (data) => {
        const msg = decode(data.toString());
        if (msg?.t === SRV.ERROR && msg.payload.code === 'version') {
          clearTimeout(timer);
          resolve(msg.payload);
        }
      });
    });
    probe.send(JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION + 1, name: 'old-client' }));
    await versionErr;
    sockets.push(probe);

    // 500 garbage frames across 10 sockets (some sockets may get rate-kicked
    // or closed - that is fine, the SERVER has to survive).
    for (let i = 0; i < 10; i += 1) {
      const ws = new WebSocket(url);
      await new Promise((resolve, reject) => {
        ws.once('open', resolve);
        ws.once('error', reject);
      });
      ws.on('error', () => {});
      sockets.push(ws);
    }
    for (let i = 0; i < 500; i += 1) {
      const ws = sockets[1 + (i % 10)];
      if (ws.readyState !== WebSocket.OPEN) continue;
      if (i % 37 === 0) ws.send(Buffer.from([0xde, 0xad, 0xbe, 0xef])); // binary frame
      else ws.send(garbageFrame(rng, i));
      if (i % 40 === 39) await sleep(30); // spread across rate windows
    }
    await sleep(300);

    // Health check: a fresh client can still hello and gets a welcome.
    await health.connect();
    assert.ok(health.pid, 'server still welcomes new players after fuzzing');
    assert.ok(server.stats.malformed > 100, `malformed frames were counted (${server.stats.malformed})`);
    assert.ok(server.stats.versionRejected >= 1, 'version mismatches were rejected');

    // And it still does real work: create a lobby.
    health.send(MSG.CREATE_LOBBY, { isPublic: false, rules: {}, boardId: 'jungle_ruins' });
    const lobby = (await health.next(SRV.LOBBY_STATE, 10000)).lobby;
    assert.equal(lobby.seats.length, 1);
  } finally {
    for (const ws of sockets) {
      try {
        ws.terminate();
      } catch { /* gone */ }
    }
    health.dispose();
    await server.close();
  }
});
