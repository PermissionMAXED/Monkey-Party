/**
 * Browser net client for the MONKEY-PARTY ws server.
 *
 * createNetClient(url?) -> { connect()->Promise, send(t,payload), on(t,cb),
 *   off(t,cb), state, playerId, resumeToken, latencyMs, close() }
 *
 * - Auto-reconnects with exponential backoff (1s doubling to a 10s cap,
 *   10 tries) and re-identifies via resume{token} on every reopen.
 * - The resume token is persisted in sessionStorage so a page reload can
 *   rejoin a running match.
 * - Outbound messages are queued while (re)connecting and flushed in order
 *   once the socket is open (after the resume frame).
 * - A protocol version mismatch is fatal: reconnection stops and a typed
 *   error (err.code === 'version') is emitted via the 'fatal' event and
 *   rejects any pending connect() promise.
 *
 * Event names passed to on()/off() are the SRV.* message types plus the
 * client lifecycle events: 'open', 'close', 'reconnecting',
 * 'reconnect_failed', 'fatal'.
 */

import { PROTOCOL_VERSION, MSG, SRV, encode, decode } from '#shared/protocol.js';

const STORAGE_TOKEN = 'mp.resumeToken';
const STORAGE_PID = 'mp.playerId';

const RECONNECT_BASE_MS = 1000;
const RECONNECT_CAP_MS = 10000;
const RECONNECT_MAX_TRIES = 10;
const QUEUE_CAP = 256;

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function defaultUrl() {
  const host = typeof location !== 'undefined' && location.hostname ? location.hostname : 'localhost';
  return `ws://${host}:8081`;
}

function storageGet(key) {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function storageSet(key, value) {
  try {
    if (typeof sessionStorage === 'undefined') return;
    if (value === null || value === undefined) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch { /* storage may be unavailable (private mode etc.) */ }
}

/** Typed client error (err.code: 'version' | 'reconnect_failed' | ...). */
export class NetClientError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'NetClientError';
    this.code = code;
    this.fatal = true;
  }
}

/**
 * @param {string} [url] ws endpoint; defaults to ws://<location.hostname>:8081.
 */
export function createNetClient(url = defaultUrl()) {
  let ws = null;
  let state = 'idle'; // idle | connecting | open | reconnecting | closed | fatal
  let playerId = storageGet(STORAGE_PID);
  let resumeToken = storageGet(STORAGE_TOKEN);
  let latencyMs = null;

  let attempts = 0;
  let reconnectTimer = null;
  let manuallyClosed = false;

  /** RTT probe: set when hello/resume goes out, resolved by the reply. */
  let probeSentAt = null;

  /** @type {[string, Object][]} outbound queue while not open. */
  const queue = [];

  /** @type {Map<string, Set<Function>>} event type -> callbacks. */
  const listeners = new Map();

  /** @type {{resolve: Function, reject: Function}|null} pending connect(). */
  let pendingConnect = null;

  /* ---------------- events ------------------------------------------ */

  function on(t, cb) {
    if (typeof cb !== 'function') throw new Error(`netClient.on("${t}"): callback must be a function`);
    let set = listeners.get(t);
    if (!set) {
      set = new Set();
      listeners.set(t, set);
    }
    set.add(cb);
    return () => off(t, cb);
  }

  function off(t, cb) {
    listeners.get(t)?.delete(cb);
  }

  function emit(t, payload) {
    const set = listeners.get(t);
    if (!set) return;
    for (const cb of [...set]) {
      try {
        cb(payload);
      } catch (err) {
        console.error(`[net] listener for "${t}" threw:`, err);
      }
    }
  }

  /* ---------------- send path ---------------------------------------- */

  function rawSend(t, payload) {
    ws.send(encode(t, payload));
    if (t === MSG.HELLO || t === MSG.RESUME) probeSentAt = nowMs();
  }

  function flushQueue() {
    while (queue.length > 0 && ws && ws.readyState === 1) {
      const [t, payload] = queue.shift();
      rawSend(t, payload);
    }
  }

  /**
   * Send a protocol message; queued while the socket is (re)connecting.
   * @param {string} t MSG.* type.
   * @param {Object} [payload]
   */
  function send(t, payload = {}) {
    if (state === 'fatal' || state === 'closed') {
      console.warn(`[net] dropped "${t}" - client is ${state}`);
      return;
    }
    if (ws && ws.readyState === 1 && state === 'open') {
      rawSend(t, payload);
    } else {
      if (queue.length >= QUEUE_CAP) queue.shift(); // drop oldest
      queue.push([t, payload]);
    }
  }

  /* ---------------- failure modes ------------------------------------- */

  function fatal(code, message) {
    const err = new NetClientError(message, code);
    state = 'fatal';
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
    queue.length = 0;
    emit('fatal', err);
    if (pendingConnect) {
      pendingConnect.reject(err);
      pendingConnect = null;
    }
    try {
      ws?.close();
    } catch { /* already closing */ }
    return err;
  }

  function scheduleReconnect() {
    attempts += 1;
    if (attempts > RECONNECT_MAX_TRIES) {
      state = 'closed';
      const err = new NetClientError('reconnect failed after 10 tries', 'reconnect_failed');
      emit('reconnect_failed', err);
      emit('close', {});
      if (pendingConnect) {
        pendingConnect.reject(err);
        pendingConnect = null;
      }
      return;
    }
    state = 'reconnecting';
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** (attempts - 1), RECONNECT_CAP_MS);
    emit('reconnecting', { attempt: attempts, delayMs: delay });
    reconnectTimer = setTimeout(openSocket, delay);
  }

  /* ---------------- socket lifecycle ----------------------------------- */

  function handleMessage(event) {
    const data = typeof event.data === 'string' ? event.data : String(event.data);
    const msg = decode(data);
    if (!msg) {
      // A server speaking another protocol version produces undecodable
      // frames; detect that case and stop hammering it.
      try {
        const raw = JSON.parse(data);
        if (raw !== null && typeof raw === 'object' && raw.v !== PROTOCOL_VERSION) {
          fatal('version', `protocol version mismatch (client v${PROTOCOL_VERSION})`);
        }
      } catch { /* garbage frame: ignore */ }
      return;
    }

    if (probeSentAt !== null) {
      latencyMs = Math.max(0, Math.round(nowMs() - probeSentAt));
      probeSentAt = null;
    }

    if (msg.t === SRV.ERROR && msg.payload?.code === 'version') {
      fatal('version', msg.payload.msg ?? 'protocol version mismatch');
      return;
    }
    if (msg.t === SRV.PING) {
      if (ws && ws.readyState === 1) rawSend(MSG.PONG, {});
      emit(SRV.PING, msg.payload);
      return;
    }
    if (msg.t === SRV.WELCOME) {
      playerId = msg.payload.playerId;
      resumeToken = msg.payload.resumeToken;
      storageSet(STORAGE_PID, playerId);
      storageSet(STORAGE_TOKEN, resumeToken);
    }
    emit(msg.t, msg.payload);
  }

  function openSocket() {
    reconnectTimer = null;
    if (state !== 'reconnecting') state = 'connecting';
    let socket;
    try {
      socket = new WebSocket(url);
    } catch (err) {
      // Bad URL etc.: treat like a failed attempt.
      console.warn('[net] WebSocket constructor failed:', err?.message ?? err);
      scheduleReconnect();
      return;
    }
    ws = socket;

    socket.onopen = () => {
      if (ws !== socket) return;
      state = 'open';
      attempts = 0;
      if (resumeToken) rawSend(MSG.RESUME, { token: resumeToken });
      flushQueue();
      emit('open', { url });
      if (pendingConnect) {
        pendingConnect.resolve();
        pendingConnect = null;
      }
    };
    socket.onmessage = handleMessage;
    socket.onerror = () => { /* the close event carries the outcome */ };
    socket.onclose = () => {
      if (ws !== socket) return;
      ws = null;
      if (state === 'fatal') return;
      if (manuallyClosed) {
        state = 'closed';
        emit('close', {});
        return;
      }
      scheduleReconnect();
    };
  }

  /* ---------------- public API ------------------------------------------ */

  /**
   * Open the connection. Resolves once the socket is open; rejects on a
   * fatal error (version mismatch) or when every reconnect try failed.
   * @returns {Promise<void>}
   */
  function connect() {
    if (state === 'open') return Promise.resolve();
    if (state === 'fatal') return Promise.reject(new NetClientError('client is in a fatal state', 'fatal'));
    manuallyClosed = false;
    const promise = new Promise((resolve, reject) => {
      pendingConnect = { resolve, reject };
    });
    if (state === 'idle' || state === 'closed') {
      attempts = 0;
      openSocket();
    }
    return promise;
  }

  /** Close for good (no reconnect). */
  function close() {
    manuallyClosed = true;
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
    if (ws) ws.close();
    else state = 'closed';
  }

  return {
    connect,
    send,
    on,
    off,
    close,
    get url() { return url; },
    get state() { return state; },
    get playerId() { return playerId; },
    get resumeToken() { return resumeToken; },
    get latencyMs() { return latencyMs; },
  };
}

export default createNetClient;
