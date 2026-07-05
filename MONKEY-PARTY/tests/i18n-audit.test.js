/**
 * Release QA: LOCALIZATION AUDIT (release engineering package).
 *
 * (a) The main UI dictionary in src/ui/i18n.js: every key must carry a
 *     non-empty English AND German string. The DICT object is module-
 *     private, so it is extracted from the source text (a plain object
 *     literal) and evaluated - the module itself is also imported to
 *     prove it stays DOM-free / Node-loadable.
 * (b) Package dictionaries following the src/ui/** /strings.js convention
 *     (e.g. src/ui/help/strings.js) get the same audit. Zero matches are
 *     tolerated - sibling packages add these over time.
 * (c) Every LITERAL t('...') key used in src/ui source must exist in the
 *     union of all dictionaries. A small whitelist covers dynamically
 *     constructed key families (hud.phase.*, mg.place.*, ...).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const UI_DIR = path.join(ROOT, 'src', 'ui');
const I18N_FILE = path.join(UI_DIR, 'i18n.js');

/** Dynamically constructed key families that a literal scan cannot see. */
const DYNAMIC_KEY_PREFIXES = [
  'hud.phase.', // t(`hud.phase.${state.phase}`)
  'mg.place.', // t(`mg.place.${i + 1}`)
  'lobby.difficulty.',
  'rules.preset.',
  'rules.items.',
  'char.slot.',
  'net.conn.',
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Recursively collect .js files under dir (sync, no globbing deps). */
function collectJs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectJs(full);
    return full.endsWith('.js') ? [full] : [];
  });
}

/**
 * Extract the module-private `const DICT = { ... };` object literal from
 * i18n.js source and evaluate it (plain data, no code).
 */
function extractMainDict() {
  const src = fs.readFileSync(I18N_FILE, 'utf8');
  const start = src.indexOf('const DICT = {');
  assert.ok(start !== -1, 'src/ui/i18n.js must define `const DICT = {`');
  const end = src.indexOf('\n};', start);
  assert.ok(end !== -1, 'DICT object literal must close with `};`');
  const objText = src.slice(start + 'const DICT ='.length, end + '\n}'.length);
  const dict = new Function(`return (${objText});`)();
  assert.equal(typeof dict, 'object');
  return dict;
}

/** True for a {en, de} localized entry candidate. */
function looksLocalized(value) {
  return value !== null && typeof value === 'object' && ('en' in value || 'de' in value);
}

function assertEntryLocalized(dictName, key, value) {
  assert.ok(value !== null && typeof value === 'object', `${dictName}: "${key}" must be an object`);
  assert.ok(typeof value.en === 'string' && value.en.length > 0, `${dictName}: "${key}" is missing a non-empty en string`);
  assert.ok(typeof value.de === 'string' && value.de.length > 0, `${dictName}: "${key}" is missing a non-empty de string`);
}

/** Dictionaries exported by a strings.js module (default and/or named). */
function dictsFromModule(mod) {
  const found = [];
  for (const [name, value] of Object.entries(mod)) {
    if (value === null || typeof value !== 'object') continue;
    const entries = Object.values(value);
    if (entries.length > 0 && entries.every(looksLocalized)) found.push({ name, dict: value });
  }
  return found;
}

/* ------------------------------------------------------------------ */
/* (a) main dictionary                                                 */
/* ------------------------------------------------------------------ */

const mainDict = extractMainDict();
const unionKeys = new Set(Object.keys(mainDict));

test('i18n: module is DOM-free and Node-importable', async () => {
  const mod = await import('../src/ui/i18n.js');
  assert.equal(typeof mod.t, 'function');
  assert.equal(mod.t('app.title'), mainDict['app.title'].en, 'extracted DICT matches the live t()');
});

test('i18n: every main dictionary key has non-empty en AND de', () => {
  const keys = Object.keys(mainDict);
  assert.ok(keys.length > 100, `main dictionary looks implausibly small (${keys.length} keys)`);
  for (const key of keys) assertEntryLocalized('DICT', key, mainDict[key]);
});

/* ------------------------------------------------------------------ */
/* (b) src/ui/** /strings.js convention                                */
/* ------------------------------------------------------------------ */

const stringsFiles = collectJs(UI_DIR).filter((f) => path.basename(f) === 'strings.js');

test('i18n: every src/ui/**/strings.js dictionary has non-empty en AND de', async () => {
  // Tolerated: the convention may have zero adopters at any point in time.
  for (const file of stringsFiles) {
    const rel = path.relative(ROOT, file);
    const mod = await import(`../${rel.split(path.sep).join('/')}`);
    const dicts = dictsFromModule(mod);
    assert.ok(dicts.length > 0, `${rel} exports no recognizable {key: {en,de}} dictionary`);
    for (const { name, dict } of dicts) {
      for (const [key, value] of Object.entries(dict)) {
        assertEntryLocalized(`${rel}#${name}`, key, value);
        unionKeys.add(key);
      }
    }
  }
});

/* ------------------------------------------------------------------ */
/* (c) literal t('...') usage scan                                     */
/* ------------------------------------------------------------------ */

test("i18n: every literal t('...') key in src/ui resolves in the dictionary union", async () => {
  // Build the union first (strings.js dicts registered above may not have
  // run yet depending on test order, so gather them here too).
  for (const file of stringsFiles) {
    const rel = path.relative(ROOT, file);
    const mod = await import(`../${rel.split(path.sep).join('/')}`);
    for (const { dict } of dictsFromModule(mod)) {
      for (const key of Object.keys(dict)) unionKeys.add(key);
    }
  }

  const used = new Map(); // key -> first "file:line" seen
  const keyRe = /\bt\(\s*(['"])([^'"`]+?)\1/g;
  for (const file of collectJs(UI_DIR)) {
    const src = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT, file);
    for (const match of src.matchAll(keyRe)) {
      const key = match[2];
      const line = src.slice(0, match.index).split('\n').length;
      if (!used.has(key)) used.set(key, `${rel}:${line}`);
    }
  }
  assert.ok(used.size > 50, `literal key scan looks broken (only ${used.size} keys found)`);

  const missing = [];
  for (const [key, where] of used) {
    if (unionKeys.has(key)) continue;
    if (DYNAMIC_KEY_PREFIXES.some((p) => key === p || key.startsWith(p))) continue;
    missing.push(`${key} (${where})`);
  }
  assert.deepEqual(missing, [], `t() keys missing from every dictionary:\n  ${missing.join('\n  ')}`);
});
