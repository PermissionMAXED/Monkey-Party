/**
 * Server configuration + tiny structured logger.
 *
 * Node-only (the server package may use process/Date.now freely; only
 * shared/ must stay environment-free).
 *
 * makeConfig(overrides) merges over DEFAULT_CONFIG so tests/ops can tune
 * timings (e.g. bot delays) without touching production defaults.
 */

/** Production defaults; every timing knob the server uses lives here. */
export const DEFAULT_CONFIG = Object.freeze({
  /** Listen port (PORT env wins at boot; 0 = ephemeral for tests). */
  port: 8081,

  /* -------- connection hygiene -------- */
  /** How often the server sends SRV.PING to each connection. */
  heartbeatIntervalMs: 5000,
  /** Drop a connection after this much inbound silence. */
  heartbeatTimeoutMs: 15000,
  /** Messages/second that trigger a rate warning. */
  rateWarnPerSec: 30,
  /** Messages/second that get the connection kicked. */
  rateKickPerSec: 60,
  /** Max wire frame size accepted by ws (bytes). The largest legitimate
   *  client frame is a maxed-out chat/action at a few KB; 16KB leaves
   *  ample headroom while a hostile megabyte blob is refused by ws
   *  itself (the socket closes with 1009) before it pins any memory. */
  maxPayloadBytes: 16384,

  /* -------- players / resume -------- */
  /** Grace window to resume after a mid-match socket drop. */
  resumeGraceMs: 90000,
  /** Display-name length cap. */
  maxNameLen: 24,

  /* -------- lobbies -------- */
  /** Unambiguous alphabet for lobby codes (no I/L/O/0/1). */
  lobbyCodeAlphabet: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789',
  lobbyCodeLength: 4,
  /** Quick-match auto-start countdown once >= 2 humans are seated. */
  quickMatchCountdownMs: 30000,
  /** Reap lobbies with zero connected humans and no running room after
   *  this long (backstop against leaked lobbies pinning memory). */
  lobbyIdleMs: 600000,
  /** Hard cap on concurrently existing lobbies; create_lobby beyond it is
   *  rejected with error{code:'full'}. */
  maxLobbies: 500,

  /* -------- shutdown -------- */
  /** Graceful shutdown: how long to wait for the error{code:'shutdown'}
   *  notice to flush before sockets are torn down. */
  shutdownFlushMs: 250,

  /* -------- match rooms -------- */
  /** A human gets this long to answer an awaited decision. */
  decisionTimeoutMs: 25000,
  /** Humanized bot decision delay range. */
  botDelayMinMs: 500,
  botDelayMaxMs: 1200,
  /** Delay before a room re-arms scheduling after a FAILED server action
   *  (bot pick / minigame results the sim rejected). Deferred so a
   *  persistent failure retries calmly instead of spinning, and a match
   *  can never hang on a consumed decision timer. */
  actionRetryMs: 250,
  /** Minigame fixed-step rate (must match shared TICK_RATE = 30). */
  mgTickHz: 30,
  /** mg_state broadcast rate. */
  mgBroadcastHz: 15,
  /** Max fixed steps recovered per interval fire (drift catch-up cap). */
  mgMaxCatchUpSteps: 5,
  /** Chat message length cap. */
  chatMaxLen: 200,
  /** Minimum interval between chat messages per player. */
  chatIntervalMs: 1000,
  /** Minimum interval between emote relays per player (mirrors chat). */
  emoteIntervalMs: 500,
  /** Keep a finished room alive this long for a rematch. */
  rematchKeepMs: 60000,
});

/**
 * Build a config: DEFAULT_CONFIG overlaid with `overrides` (unknown keys
 * are kept, so callers can piggyback extra knobs if ever needed).
 *
 * @param {Partial<typeof DEFAULT_CONFIG>} [overrides]
 * @returns {typeof DEFAULT_CONFIG}
 */
export function makeConfig(overrides = {}) {
  const src = overrides !== null && typeof overrides === 'object' ? overrides : {};
  return { ...DEFAULT_CONFIG, ...src };
}

/* ------------------------------------------------------------------ */
/* Logger                                                              */
/* ------------------------------------------------------------------ */

function fmtFields(fields) {
  if (fields === null || typeof fields !== 'object') return '';
  const parts = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    const v = typeof value === 'object' ? JSON.stringify(value) : String(value);
    parts.push(`${key}=${v}`);
  }
  return parts.length ? ` ${parts.join(' ')}` : '';
}

/**
 * Concise structured logger: `[mp:scope] event key=value ...`.
 *
 * @param {string} [scope]
 * @param {{silent?: boolean}} [opts] silent = swallow output (tests).
 * @returns {{
 *   info: (evt: string, fields?: Object) => void,
 *   warn: (evt: string, fields?: Object) => void,
 *   error: (evt: string, fields?: Object) => void,
 *   child: (subScope: string) => Object,
 * }}
 */
export function createLogger(scope = 'srv', opts = {}) {
  const silent = Boolean(opts.silent);
  const emit = (sink, evt, fields) => {
    if (silent) return;
    sink(`[mp:${scope}] ${evt}${fmtFields(fields)}`);
  };
  return {
    info: (evt, fields) => emit(console.log, evt, fields),
    warn: (evt, fields) => emit(console.warn, evt, fields),
    error: (evt, fields) => emit(console.error, evt, fields),
    child: (subScope) => createLogger(`${scope}:${subScope}`, opts),
  };
}
