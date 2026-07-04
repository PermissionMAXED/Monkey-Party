import test from 'node:test';
import assert from 'node:assert/strict';

import { createRegistry } from '#shared/registry.js';
import { boards, characters, items, minigames, registries } from '#shared/registries.js';

test('createRegistry: register + lookup', () => {
  const reg = createRegistry('test');
  const def = { id: 'banana_bomb', name: { en: 'Banana Bomb', de: 'Bananenbombe' } };

  const returned = reg.register(def);
  assert.equal(returned, def, 'register returns the def');
  assert.equal(reg.get('banana_bomb'), def);
  assert.deepEqual(reg.ids(), ['banana_bomb']);
  assert.deepEqual(reg.all(), [def]);
  assert.equal(reg.count(), 1);
});

test('createRegistry: preserves registration order', () => {
  const reg = createRegistry('test');
  reg.register({ id: 'c' });
  reg.register({ id: 'a' });
  reg.register({ id: 'b' });
  assert.deepEqual(reg.ids(), ['c', 'a', 'b']);
  assert.equal(reg.count(), 3);
});

test('createRegistry: unknown id returns null', () => {
  const reg = createRegistry('test');
  assert.equal(reg.get('nope'), null);
});

test('createRegistry: rejects duplicate ids', () => {
  const reg = createRegistry('test');
  reg.register({ id: 'twin' });
  assert.throws(() => reg.register({ id: 'twin' }), /duplicate id "twin"/);
  assert.equal(reg.count(), 1, 'duplicate register does not overwrite');
});

test('createRegistry: rejects missing/invalid ids', () => {
  const reg = createRegistry('test');
  assert.throws(() => reg.register({}), /missing a non-empty string "id"/);
  assert.throws(() => reg.register({ id: '' }), /missing a non-empty string "id"/);
  assert.throws(() => reg.register({ id: 42 }), /missing a non-empty string "id"/);
  assert.throws(() => reg.register(null), /expects a def object/);
  assert.throws(() => reg.register('board'), /expects a def object/);
  assert.equal(reg.count(), 0);
});

test('createRegistry: requires a name', () => {
  assert.throws(() => createRegistry(), /non-empty string/);
  assert.throws(() => createRegistry(''), /non-empty string/);
});

test('singleton registries exist with the expected names', () => {
  assert.equal(boards.name, 'boards');
  assert.equal(characters.name, 'characters');
  assert.equal(items.name, 'items');
  assert.equal(minigames.name, 'minigames');
  assert.deepEqual(Object.keys(registries), ['boards', 'characters', 'items', 'minigames']);
  for (const reg of Object.values(registries)) {
    assert.equal(typeof reg.register, 'function');
    assert.equal(typeof reg.get, 'function');
    assert.equal(typeof reg.all, 'function');
    assert.equal(typeof reg.ids, 'function');
    assert.equal(typeof reg.count, 'function');
  }
});

test('singleton registries accept defs and enforce duplicates independently', () => {
  const def = { id: '__test_character__', name: 'Testy' };
  characters.register(def);
  assert.equal(characters.get('__test_character__'), def);
  assert.throws(() => characters.register({ id: '__test_character__' }), /duplicate/);
  // Other singletons are unaffected by the characters registration.
  assert.equal(boards.get('__test_character__'), null);
  assert.equal(items.get('__test_character__'), null);
  assert.equal(minigames.get('__test_character__'), null);
});
