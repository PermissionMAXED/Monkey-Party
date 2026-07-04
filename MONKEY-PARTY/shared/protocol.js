/**
 * MONKEY-PARTY network protocol.
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 *
 * Wire format: every message is a single JSON object `{ t, v, ...payload }`
 * where `t` is the message type string and `v` is PROTOCOL_VERSION.
 *
 * Client -> Server types live in MSG, Server -> Client types in SRV.
 * Note that `emote` and `chat` exist in both directions with different
 * payloads, so validators are kept in per-direction maps.
 */

export const PROTOCOL_VERSION = 1;

/** Client -> Server message types. */
export const MSG = {
  HELLO: 'hello', // {name}
  CREATE_LOBBY: 'create_lobby', // {isPublic,rules,boardId}
  JOIN_LOBBY: 'join_lobby', // {code}
  LEAVE_LOBBY: 'leave_lobby', // {}
  LIST_LOBBIES: 'list_lobbies', // {}
  QUICK_MATCH: 'quick_match', // {}
  LOBBY_SET: 'lobby_set', // {rules?,boardId?}
  ADD_BOT: 'add_bot', // {difficulty}
  REMOVE_BOT: 'remove_bot', // {seat}
  SELECT_CHARACTER: 'select_character', // {characterId,cosmetics}
  READY: 'ready', // {ready}
  START_GAME: 'start_game', // {}
  ACTION: 'action', // {action}
  MG_INPUT: 'mg_input', // {seq,frame}
  EMOTE: 'emote', // {emoteId}
  CHAT: 'chat', // {text}
  RESUME: 'resume', // {token}
  PONG: 'pong', // {}
};

/** Server -> Client message types. */
export const SRV = {
  WELCOME: 'welcome', // {playerId,resumeToken}
  ERROR: 'error', // {code,msg}
  LOBBY_STATE: 'lobby_state', // {lobby}
  LOBBY_LIST: 'lobby_list', // {lobbies}
  MATCH_START: 'match_start', // {seed,rules,boardId,players}
  ACTION_APPLIED: 'action_applied', // {action,events}
  STATE_SYNC: 'state_sync', // {snapshot}
  MG_START: 'mg_start', // {minigameId,seed,params,teams}
  MG_STATE: 'mg_state', // {tick,snapshot}
  MG_END: 'mg_end', // {results}
  PLAYER_CONN: 'player_conn', // {pid,connected}
  EMOTE: 'emote', // {pid,emoteId}
  CHAT: 'chat', // {pid,text}
  PING: 'ping', // {}
};

/* ------------------------------------------------------------------ */
/* Predicates                                                          */
/* ------------------------------------------------------------------ */

const isStr = (v) => typeof v === 'string';
const isBool = (v) => typeof v === 'boolean';
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isArr = (v) => Array.isArray(v);
const opt = (pred) => (v) => v === undefined || pred(v);

/* ------------------------------------------------------------------ */
/* Per-type payload validators                                         */
/* ------------------------------------------------------------------ */

/**
 * Build a validator that checks payload is a plain object and each listed
 * field satisfies its predicate. Extra fields are allowed.
 * @param {Object<string, (v: *) => boolean>} shape
 * @returns {(payload: *) => boolean}
 */
function shapeOf(shape = {}) {
  const keys = Object.keys(shape);
  return (payload) => {
    if (!isObj(payload)) return false;
    for (const key of keys) {
      if (!shape[key](payload[key])) return false;
    }
    return true;
  };
}

const anyObject = shapeOf({});

/** Client -> Server payload validators, keyed by type string. */
export const MSG_VALIDATORS = {
  [MSG.HELLO]: shapeOf({ name: isStr }),
  [MSG.CREATE_LOBBY]: shapeOf({ isPublic: isBool, rules: isObj, boardId: isStr }),
  [MSG.JOIN_LOBBY]: shapeOf({ code: isStr }),
  [MSG.LEAVE_LOBBY]: anyObject,
  [MSG.LIST_LOBBIES]: anyObject,
  [MSG.QUICK_MATCH]: anyObject,
  [MSG.LOBBY_SET]: shapeOf({ rules: opt(isObj), boardId: opt(isStr) }),
  [MSG.ADD_BOT]: shapeOf({ difficulty: isStr }),
  [MSG.REMOVE_BOT]: shapeOf({ seat: isNum }),
  [MSG.SELECT_CHARACTER]: shapeOf({ characterId: isStr, cosmetics: isObj }),
  [MSG.READY]: shapeOf({ ready: isBool }),
  [MSG.START_GAME]: anyObject,
  [MSG.ACTION]: shapeOf({ action: isObj }),
  [MSG.MG_INPUT]: shapeOf({ seq: isNum, frame: isObj }),
  [MSG.EMOTE]: shapeOf({ emoteId: isStr }),
  [MSG.CHAT]: shapeOf({ text: isStr }),
  [MSG.RESUME]: shapeOf({ token: isStr }),
  [MSG.PONG]: anyObject,
};

/** Server -> Client payload validators, keyed by type string. */
export const SRV_VALIDATORS = {
  [SRV.WELCOME]: shapeOf({ playerId: isStr, resumeToken: isStr }),
  [SRV.ERROR]: shapeOf({ code: isStr, msg: isStr }),
  [SRV.LOBBY_STATE]: shapeOf({ lobby: isObj }),
  [SRV.LOBBY_LIST]: shapeOf({ lobbies: isArr }),
  [SRV.MATCH_START]: shapeOf({ seed: isNum, rules: isObj, boardId: isStr, players: isArr }),
  [SRV.ACTION_APPLIED]: shapeOf({ action: isObj, events: isArr }),
  [SRV.STATE_SYNC]: shapeOf({ snapshot: isObj }),
  [SRV.MG_START]: shapeOf({ minigameId: isStr, seed: isNum, params: isObj, teams: (v) => isArr(v) || isObj(v) }),
  [SRV.MG_STATE]: shapeOf({ tick: isNum, snapshot: isObj }),
  [SRV.MG_END]: shapeOf({ results: isObj }),
  [SRV.PLAYER_CONN]: shapeOf({ pid: isStr, connected: isBool }),
  [SRV.EMOTE]: shapeOf({ pid: isStr, emoteId: isStr }),
  [SRV.CHAT]: shapeOf({ pid: isStr, text: isStr }),
  [SRV.PING]: anyObject,
};

/* ------------------------------------------------------------------ */
/* Encode / decode                                                     */
/* ------------------------------------------------------------------ */

/**
 * Is `t` a known message type (in either direction)?
 * @param {string} t
 * @returns {boolean}
 */
export function isKnownType(t) {
  return Object.prototype.hasOwnProperty.call(MSG_VALIDATORS, t)
    || Object.prototype.hasOwnProperty.call(SRV_VALIDATORS, t);
}

/**
 * Validate a payload for a message type.
 *
 * @param {string} t Message type.
 * @param {*} payload Payload object (without t/v).
 * @param {'client'|'server'} [direction] Restrict to one direction;
 *   omitted = valid if it passes for either direction the type exists in.
 * @returns {boolean}
 */
export function validatePayload(t, payload, direction) {
  const client = Object.prototype.hasOwnProperty.call(MSG_VALIDATORS, t) ? MSG_VALIDATORS[t] : null;
  const server = Object.prototype.hasOwnProperty.call(SRV_VALIDATORS, t) ? SRV_VALIDATORS[t] : null;
  if (direction === 'client') return client ? client(payload) : false;
  if (direction === 'server') return server ? server(payload) : false;
  if (client && client(payload)) return true;
  if (server && server(payload)) return true;
  return false;
}

/**
 * Encode a message to its wire JSON string `{t, v, ...payload}`.
 *
 * @param {string} t Message type (a MSG or SRV value).
 * @param {Object} [payload]
 * @returns {string}
 */
export function encode(t, payload = {}) {
  if (!isStr(t) || t.length === 0) {
    throw new Error('protocol.encode: message type must be a non-empty string');
  }
  if (!isObj(payload)) {
    throw new Error(`protocol.encode("${t}"): payload must be a plain object`);
  }
  return JSON.stringify({ t, v: PROTOCOL_VERSION, ...payload });
}

/**
 * Decode a wire string. Returns null when malformed:
 * - not a string / not valid JSON / not a plain object
 * - missing or unknown `t`
 * - `v` !== PROTOCOL_VERSION
 * - payload fails the type's validator (either direction)
 *
 * @param {string} str
 * @returns {{t: string, v: number, payload: Object}|null}
 */
export function decode(str) {
  if (!isStr(str)) return null;
  let raw;
  try {
    raw = JSON.parse(str);
  } catch {
    return null;
  }
  if (!isObj(raw)) return null;
  const { t, v, ...payload } = raw;
  if (!isStr(t) || !isKnownType(t)) return null;
  if (v !== PROTOCOL_VERSION) return null;
  if (!validatePayload(t, payload)) return null;
  return { t, v, payload };
}
