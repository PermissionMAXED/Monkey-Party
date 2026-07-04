import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MSG,
  SRV,
  MSG_VALIDATORS,
  SRV_VALIDATORS,
  PROTOCOL_VERSION,
  encode,
  decode,
  validatePayload,
  isKnownType,
} from '#shared/protocol.js';

/* ------------------------------------------------------------------ */
/* Sample payloads (valid) for every message type                      */
/* ------------------------------------------------------------------ */

const CLIENT_SAMPLES = {
  [MSG.HELLO]: { name: 'Kong' },
  [MSG.CREATE_LOBBY]: { isPublic: true, rules: { rounds: 10 }, boardId: 'jungle_temple' },
  [MSG.JOIN_LOBBY]: { code: 'BNNA' },
  [MSG.LEAVE_LOBBY]: {},
  [MSG.LIST_LOBBIES]: {},
  [MSG.QUICK_MATCH]: {},
  [MSG.LOBBY_SET]: { rules: { rounds: 5 }, boardId: 'canopy' },
  [MSG.ADD_BOT]: { difficulty: 'normal' },
  [MSG.REMOVE_BOT]: { seat: 3 },
  [MSG.SELECT_CHARACTER]: { characterId: 'kiki', cosmetics: { hat: 'crown', skin: null, accessory: null } },
  [MSG.READY]: { ready: true },
  [MSG.START_GAME]: {},
  [MSG.ACTION]: { action: { type: 'roll', playerId: 'p1', payload: {} } },
  [MSG.MG_INPUT]: { seq: 12, frame: { move: { x: 0.5, y: -1 }, a: true, b: false } },
  [MSG.EMOTE]: { emoteId: 'wave' },
  [MSG.CHAT]: { text: 'go bananas' },
  [MSG.RESUME]: { token: 'resume-token-123' },
  [MSG.PONG]: {},
};

const SERVER_SAMPLES = {
  [SRV.WELCOME]: { playerId: 'p1', resumeToken: 'tok-1' },
  [SRV.ERROR]: { code: 'lobby_full', msg: 'The lobby is full' },
  [SRV.LOBBY_STATE]: { lobby: { code: 'BNNA', seats: [] } },
  [SRV.LOBBY_LIST]: { lobbies: [{ code: 'BNNA', players: 2 }] },
  [SRV.MATCH_START]: { seed: 42, rules: { rounds: 10 }, boardId: 'jungle_temple', players: [] },
  [SRV.ACTION_APPLIED]: { action: { type: 'roll', playerId: 'p1', payload: {} }, events: [{ type: 'dice', value: 6 }] },
  [SRV.STATE_SYNC]: { snapshot: { round: 3 } },
  [SRV.MG_START]: { minigameId: 'vine_race', seed: 7, params: {}, teams: [['p1', 'p2'], ['p3', 'p4']] },
  [SRV.MG_STATE]: { tick: 30, snapshot: {} },
  [SRV.MG_END]: { results: { ranking: ['p1', 'p2'], coins: { p1: 10 }, stats: {} } },
  [SRV.PLAYER_CONN]: { pid: 'p2', connected: false },
  [SRV.EMOTE]: { pid: 'p1', emoteId: 'wave' },
  [SRV.CHAT]: { pid: 'p1', text: 'hi' },
  [SRV.PING]: {},
};

/* Invalid payloads for every type with required fields. */
const CLIENT_INVALID = {
  [MSG.HELLO]: { name: 42 },
  [MSG.CREATE_LOBBY]: { isPublic: 'yes', rules: {}, boardId: 'b' },
  [MSG.JOIN_LOBBY]: {},
  [MSG.LOBBY_SET]: { rules: 'not-an-object' },
  [MSG.ADD_BOT]: { difficulty: 7 },
  [MSG.REMOVE_BOT]: { seat: 'two' },
  [MSG.SELECT_CHARACTER]: { characterId: 9, cosmetics: {} },
  [MSG.READY]: { ready: 'yep' },
  [MSG.ACTION]: { action: 'roll' },
  [MSG.MG_INPUT]: { seq: 'x', frame: {} },
  [MSG.EMOTE]: {},
  [MSG.CHAT]: { text: 5 },
  [MSG.RESUME]: { token: null },
};

const SERVER_INVALID = {
  [SRV.WELCOME]: { playerId: 'p1' },
  [SRV.ERROR]: { code: 500, msg: 'nope' },
  [SRV.LOBBY_STATE]: { lobby: 'nope' },
  [SRV.LOBBY_LIST]: { lobbies: {} },
  [SRV.MATCH_START]: { seed: 'x', rules: {}, boardId: 'b', players: [] },
  [SRV.ACTION_APPLIED]: { action: {}, events: 'nope' },
  [SRV.STATE_SYNC]: { snapshot: null },
  [SRV.MG_START]: { minigameId: 'm', seed: 7, params: {}, teams: 'red-vs-blue' },
  [SRV.MG_STATE]: { tick: '30', snapshot: {} },
  [SRV.MG_END]: { results: [] },
  [SRV.PLAYER_CONN]: { pid: 'p2', connected: 'no' },
  [SRV.EMOTE]: { emoteId: 'wave' },
  [SRV.CHAT]: { pid: 'p1' },
};

/* ------------------------------------------------------------------ */
/* Basics                                                              */
/* ------------------------------------------------------------------ */

test('PROTOCOL_VERSION is 1', () => {
  assert.equal(PROTOCOL_VERSION, 1);
});

test('MSG covers every client message type', () => {
  assert.deepEqual(Object.values(MSG).sort(), [
    'action', 'add_bot', 'chat', 'create_lobby', 'emote', 'hello', 'join_lobby',
    'leave_lobby', 'list_lobbies', 'lobby_set', 'mg_input', 'pong', 'quick_match',
    'ready', 'remove_bot', 'resume', 'select_character', 'start_game',
  ]);
});

test('SRV covers every server message type', () => {
  assert.deepEqual(Object.values(SRV).sort(), [
    'action_applied', 'chat', 'emote', 'error', 'lobby_list', 'lobby_state',
    'match_start', 'mg_end', 'mg_start', 'mg_state', 'ping', 'player_conn',
    'state_sync', 'welcome',
  ]);
});

/* ------------------------------------------------------------------ */
/* Encode / decode round-trips for every type                          */
/* ------------------------------------------------------------------ */

test('encode produces flat {t, v, ...payload} JSON', () => {
  const parsed = JSON.parse(encode(MSG.HELLO, { name: 'Kong' }));
  assert.deepEqual(parsed, { t: 'hello', v: 1, name: 'Kong' });
});

test('round-trip: every client message type', () => {
  for (const [t, payload] of Object.entries(CLIENT_SAMPLES)) {
    const decoded = decode(encode(t, payload));
    assert.ok(decoded, `decode failed for client "${t}"`);
    assert.equal(decoded.t, t);
    assert.equal(decoded.v, PROTOCOL_VERSION);
    assert.deepEqual(decoded.payload, payload, `payload mismatch for client "${t}"`);
  }
});

test('round-trip: every server message type', () => {
  for (const [t, payload] of Object.entries(SERVER_SAMPLES)) {
    const decoded = decode(encode(t, payload));
    assert.ok(decoded, `decode failed for server "${t}"`);
    assert.equal(decoded.t, t);
    assert.equal(decoded.v, PROTOCOL_VERSION);
    assert.deepEqual(decoded.payload, payload, `payload mismatch for server "${t}"`);
  }
});

/* ------------------------------------------------------------------ */
/* Malformed input rejection                                           */
/* ------------------------------------------------------------------ */

test('decode rejects malformed input', () => {
  assert.equal(decode('not json at all'), null, 'invalid JSON');
  assert.equal(decode('42'), null, 'JSON but not an object');
  assert.equal(decode('"hello"'), null, 'JSON string');
  assert.equal(decode('[1,2,3]'), null, 'JSON array');
  assert.equal(decode('null'), null, 'JSON null');
  assert.equal(decode('{}'), null, 'missing t');
  assert.equal(decode('{"t":"no_such_message","v":1}'), null, 'unknown type');
  assert.equal(decode('{"t":42,"v":1}'), null, 'non-string t');
  assert.equal(decode('{"t":"hello","name":"Kong"}'), null, 'missing version');
  assert.equal(decode('{"t":"hello","v":999,"name":"Kong"}'), null, 'wrong version');
  assert.equal(decode('{"t":"hello","v":1,"name":42}'), null, 'payload fails validator');
  assert.equal(decode(undefined), null, 'undefined input');
  assert.equal(decode(null), null, 'null input');
  assert.equal(decode(12345), null, 'non-string input');
});

test('encode rejects invalid arguments', () => {
  assert.throws(() => encode('', {}), /non-empty string/);
  assert.throws(() => encode(MSG.HELLO, 'not-an-object'), /plain object/);
});

/* ------------------------------------------------------------------ */
/* Validator coverage: every MSG/SRV type has a working validator      */
/* ------------------------------------------------------------------ */

test('every MSG type has a validator that accepts its sample payload', () => {
  for (const t of Object.values(MSG)) {
    assert.equal(typeof MSG_VALIDATORS[t], 'function', `missing MSG validator for "${t}"`);
    assert.ok(t in CLIENT_SAMPLES, `missing client sample for "${t}"`);
    assert.equal(MSG_VALIDATORS[t](CLIENT_SAMPLES[t]), true, `validator rejects valid client "${t}"`);
    assert.equal(validatePayload(t, CLIENT_SAMPLES[t], 'client'), true);
    assert.equal(isKnownType(t), true);
  }
});

test('every SRV type has a validator that accepts its sample payload', () => {
  for (const t of Object.values(SRV)) {
    assert.equal(typeof SRV_VALIDATORS[t], 'function', `missing SRV validator for "${t}"`);
    assert.ok(t in SERVER_SAMPLES, `missing server sample for "${t}"`);
    assert.equal(SRV_VALIDATORS[t](SERVER_SAMPLES[t]), true, `validator rejects valid server "${t}"`);
    assert.equal(validatePayload(t, SERVER_SAMPLES[t], 'server'), true);
    assert.equal(isKnownType(t), true);
  }
});

test('validators reject bad payloads (client)', () => {
  for (const [t, payload] of Object.entries(CLIENT_INVALID)) {
    assert.equal(MSG_VALIDATORS[t](payload), false, `client "${t}" accepted invalid payload`);
    assert.equal(validatePayload(t, payload, 'client'), false);
  }
});

test('validators reject bad payloads (server)', () => {
  for (const [t, payload] of Object.entries(SERVER_INVALID)) {
    assert.equal(SRV_VALIDATORS[t](payload), false, `server "${t}" accepted invalid payload`);
    assert.equal(validatePayload(t, payload, 'server'), false);
  }
});

test('validators reject non-object payloads', () => {
  for (const t of Object.values(MSG)) {
    assert.equal(MSG_VALIDATORS[t](null), false);
    assert.equal(MSG_VALIDATORS[t]('x'), false);
    assert.equal(MSG_VALIDATORS[t]([]), false);
  }
  for (const t of Object.values(SRV)) {
    assert.equal(SRV_VALIDATORS[t](null), false);
    assert.equal(SRV_VALIDATORS[t]('x'), false);
    assert.equal(SRV_VALIDATORS[t]([]), false);
  }
});

/* ------------------------------------------------------------------ */
/* Direction-aware validation (emote/chat exist in both directions)    */
/* ------------------------------------------------------------------ */

test('emote/chat payloads validate per direction', () => {
  assert.equal(MSG.EMOTE, SRV.EMOTE, 'emote is intentionally shared across directions');
  assert.equal(MSG.CHAT, SRV.CHAT, 'chat is intentionally shared across directions');

  // Client emote has no pid; server emote requires one.
  assert.equal(validatePayload('emote', { emoteId: 'wave' }, 'client'), true);
  assert.equal(validatePayload('emote', { emoteId: 'wave' }, 'server'), false);
  assert.equal(validatePayload('emote', { pid: 'p1', emoteId: 'wave' }, 'server'), true);

  assert.equal(validatePayload('chat', { text: 'hi' }, 'client'), true);
  assert.equal(validatePayload('chat', { text: 'hi' }, 'server'), false);
  assert.equal(validatePayload('chat', { pid: 'p1', text: 'hi' }, 'server'), true);

  // Direction omitted: accepted if either direction validates.
  assert.equal(validatePayload('emote', { emoteId: 'wave' }), true);
  assert.equal(validatePayload('emote', {}), false);

  // Unknown types are always invalid.
  assert.equal(validatePayload('no_such_message', {}), false);
  assert.equal(isKnownType('no_such_message'), false);
});
