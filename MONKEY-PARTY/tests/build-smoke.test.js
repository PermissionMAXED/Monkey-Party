/**
 * Release QA: BUILD OUTPUT SMOKE TEST (release engineering package).
 *
 * Validates the vite production build in dist/ WHEN it exists. CI runs
 * `npm run build` after `npm test`, and dev machines may not have built at
 * all, so a missing dist/ skips gracefully instead of failing.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const INDEX = path.join(DIST, 'index.html');

const hasBuild = fs.existsSync(INDEX);
const skip = hasBuild ? false : 'dist/ not present - run `npm run build` first';

test('build: dist/index.html references hashed entry assets', { skip }, () => {
  const html = fs.readFileSync(INDEX, 'utf8');

  // Hashed entry script + stylesheet (vite emits assets/<name>-<hash>.<ext>).
  const scriptRefs = [...html.matchAll(/src="\/?(assets\/[\w.-]+\.js)"/g)].map((m) => m[1]);
  const cssRefs = [...html.matchAll(/href="\/?(assets\/[\w.-]+\.css)"/g)].map((m) => m[1]);
  assert.ok(scriptRefs.length >= 1, 'index.html must reference at least one built script');
  assert.ok(cssRefs.length >= 1, 'index.html must reference at least one built stylesheet');

  const hashed = /-[\w-]{8,}\.(js|css)$/;
  for (const ref of [...scriptRefs, ...cssRefs]) {
    assert.match(ref, hashed, `asset reference "${ref}" must carry a content hash`);
    assert.ok(fs.existsSync(path.join(DIST, ref)), `referenced asset "${ref}" must exist in dist/`);
  }

  // No dev-server-only references may leak into the build.
  assert.ok(!html.includes('/src/main.js'), 'index.html must not reference raw /src modules');
});

test('build: bundle contains the content registrars (guarded imports resolved)', { skip }, () => {
  const assetsDir = path.join(DIST, 'assets');
  const chunks = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
  assert.ok(chunks.length > 10, `expected many hashed chunks, got ${chunks.length}`);

  // Distinctive content strings that only appear when the board/character/
  // item/minigame packs made it into the bundle.
  const needles = ['jungle_ruins', 'banana_scramble', 'golden_ticket'];
  const found = new Set();
  for (const chunk of chunks) {
    const src = fs.readFileSync(path.join(assetsDir, chunk), 'utf8');
    for (const needle of needles) {
      if (src.includes(needle)) found.add(needle);
    }
  }
  assert.deepEqual([...found].sort(), [...needles].sort(),
    'all content packs must be reachable from the built bundle');
});
