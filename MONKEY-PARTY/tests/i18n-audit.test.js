/**
 * Release QA: LOCALIZATION AUDIT (release engineering package).
 *
 * (a) The main UI dictionary in src/ui/i18n.js: every key must carry a
 *     non-empty English AND German string. The DICT object is module-
 *     private, so it is extracted from the source text (a plain object
 *     literal) and evaluated - the module itself is also imported to
 *     prove it stays DOM-free / Node-loadable.
 * (b) EVERY dictionary module whose basename ends in "strings.js"
 *     (case-insensitive: src/ui/** /strings.js packages AND the
 *     *Strings.js modules at the src/ui root - settingsStrings.js,
 *     netStrings.js, matchStrings.js, spectacleStrings.js) gets the same
 *     en+de audit. The root modules are additionally asserted to EXIST so
 *     a rename can never silently drop them out of the audit.
 * (c) Every literal key passed to any of the translation helpers -
 *     t(), ts(), tm(), tNet() - in src/ui source must exist in the union
 *     of all dictionaries.
 * (d) Dynamically constructed key families (template literals like
 *     t(`hud.phase.${state.phase}`)) cannot be literal-scanned; each
 *     known family is whitelisted AND its enumerated variants are
 *     asserted to exist in the union, so a raw key can never render.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PHASES,
  BOT_DIFFICULTIES,
  ITEM_MODES,
  ITEM_RARITIES,
  ITEM_PHASES,
  MINIGAME_CATEGORIES,
  QUALITY_LEVELS,
} from '#shared/constants.js';
import { PRESETS } from '#shared/rules.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const UI_DIR = path.join(ROOT, 'src', 'ui');
const I18N_FILE = path.join(UI_DIR, 'i18n.js');

/** Directories whose t()/ts()/tm()/tNet() literals are usage-scanned.
 * boardplay + minigames render localized gameplay text (banners, minigame
 * HUD) through the same dictionaries. */
const USAGE_SCAN_DIRS = [
  UI_DIR,
  path.join(ROOT, 'src', 'boardplay'),
  path.join(ROOT, 'src', 'minigames'),
];

/** Root-level dictionary modules that MUST exist and be audited. */
const ROOT_STRINGS_FILES = [
  'settingsStrings.js',
  'netStrings.js',
  'matchStrings.js',
  'spectacleStrings.js',
];

/**
 * Dynamically constructed key families (template-literal keys a literal
 * scan cannot see): prefix -> the enumerated variants that MUST exist in
 * the dictionary union. Sourced from shared/constants.js enumerations
 * where one exists, so the lists cannot drift from the sim.
 */
const DYNAMIC_KEY_FAMILIES = {
  'hud.phase.': PHASES, // t(`hud.phase.${state.phase}`)
  'mg.place.': ['1', '2', '3', 'n'], // t(`mg.place.${i + 1}`) (capped at 3)
  'lobby.difficulty.': BOT_DIFFICULTIES,
  'rules.preset.': Object.keys(PRESETS),
  'rules.items.': ITEM_MODES,
  'char.slot.': ['hat', 'glasses', 'accessory', 'skin'],
  'char.filter.': ['all', 'owned', 'locked'],
  'net.conn.': ['good', 'warn', 'bad'],
  'settings.quality.': QUALITY_LEVELS,
  'settings.colorblind.': ['off', 'deuteranopia', 'protanopia', 'tritanopia'],
  'settings.action.': ['up', 'down', 'left', 'right', 'a', 'b'],
  'prac.category.': MINIGAME_CATEGORIES,
  'help.tab.': ['party', 'boards', 'items', 'minigames', 'online'],
  'help.rarity.': ITEM_RARITIES,
  'help.itemPhase.': ITEM_PHASES,
  'help.mgcat.': MINIGAME_CATEGORIES,
  // Legend chips: the player-facing NODE_TYPES (start/special are
  // neutral and skipped by howToPlay.js), each with a .desc variant.
  'help.node.': ['blue', 'red', 'event', 'item', 'shop', 'star', 'boss', 'trap', 'junction']
    .flatMap((type) => [type, `${type}.desc`]),
};

const DYNAMIC_KEY_PREFIXES = Object.keys(DYNAMIC_KEY_FAMILIES);

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

/** Every dictionary entry must carry BOTH a non-empty en AND de string. */
function assertEntryLocalized(dictName, key, value) {
  assert.ok(value !== null && typeof value === 'object', `${dictName}: "${key}" must be an object`);
  assert.ok(typeof value.en === 'string' && value.en.length > 0, `${dictName}: "${key}" is missing a non-empty en string`);
  assert.ok(typeof value.de === 'string' && value.de.length > 0, `${dictName}: "${key}" is missing a non-empty de string`);
}

/** Dictionaries exported by a strings module (default and/or named). */
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
/* (b) every *strings.js dictionary module under src/ui               */
/* ------------------------------------------------------------------ */

/** Any basename ending in "strings.js", case-insensitive: catches the
 * src/ui/** /strings.js package convention AND the settingsStrings.js /
 * netStrings.js / matchStrings.js / spectacleStrings.js root modules. */
const stringsFiles = collectJs(UI_DIR).filter((f) => /strings\.js$/i.test(path.basename(f)));

/** Import a repo file and register its dictionaries into the union. */
async function auditStringsFile(file) {
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

test('i18n: the src/ui root *Strings.js dictionaries exist and are audited', () => {
  const basenames = new Set(stringsFiles.map((f) => path.basename(f)));
  for (const expected of ROOT_STRINGS_FILES) {
    assert.ok(
      basenames.has(expected),
      `src/ui/${expected} is missing from the strings-file scan - the audit went blind`,
    );
  }
});

test('i18n: every src/ui *strings.js dictionary has non-empty en AND de', async () => {
  assert.ok(
    stringsFiles.length >= ROOT_STRINGS_FILES.length,
    `strings-file discovery looks broken (only ${stringsFiles.length} files found)`,
  );
  for (const file of stringsFiles) await auditStringsFile(file);
});

/* ------------------------------------------------------------------ */
/* (c) literal t()/ts()/tm()/tNet() usage scan                         */
/* ------------------------------------------------------------------ */

test('i18n: every literal t()/ts()/tm()/tNet() key in src/ui resolves in the dictionary union', async () => {
  // Build the union first (test execution order must not matter).
  for (const file of stringsFiles) await auditStringsFile(file);

  const used = new Map(); // key -> first "file:line" seen
  const keyRe = /\b(?:t|ts|tm|tNet)\(\s*['"]([^'"]+)['"]/g;
  for (const file of USAGE_SCAN_DIRS.flatMap(collectJs)) {
    const src = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT, file);
    for (const match of src.matchAll(keyRe)) {
      const key = match[1];
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

/* ------------------------------------------------------------------ */
/* (d) dynamic key families: enumerated variants must exist            */
/* ------------------------------------------------------------------ */

test('i18n: every enumerated variant of the dynamic key families exists', async () => {
  for (const file of stringsFiles) await auditStringsFile(file);

  const missing = [];
  for (const [prefix, variants] of Object.entries(DYNAMIC_KEY_FAMILIES)) {
    assert.ok(variants.length > 0, `dynamic family "${prefix}" has no enumerated variants`);
    for (const variant of variants) {
      const key = `${prefix}${variant}`;
      if (!unionKeys.has(key)) missing.push(key);
    }
  }
  assert.deepEqual(
    missing,
    [],
    `dynamic-family keys missing from every dictionary (a raw key would render):\n  ${missing.join('\n  ')}`,
  );
});
