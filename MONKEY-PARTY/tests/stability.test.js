/**
 * Stability package tests (node, no jsdom):
 *   - screenRouter: mount/unmount lifecycle + throwing-screen fallback,
 *     driven by tiny fake elements implementing only what the router uses
 *     (classList, dataset, appendChild, remove, ownerDocument.createElement).
 *   - perfMonitor: rolling fps / p95 math and the auto-quality downgrade
 *     governor, driven through a fake engine.onFrame.
 *   - errorOverlay: pure crash-loop counting logic (no DOM).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createScreenRouter } from '../src/app/screenRouter.js';
import { createPerfCore, createPerfMonitor, AUTO_QUALITY } from '../src/engine/perfMonitor.js';
import { createCrashLoopCounter, installErrorOverlay, CRASH_LOOP } from '../src/app/errorOverlay.js';

/* ------------------------------------------------------------------ */
/* Fakes                                                               */
/* ------------------------------------------------------------------ */

/** Minimal element fake covering exactly the router's element usage. */
function fakeElement(tag = 'div') {
  const classes = new Set();
  const el = {
    tagName: String(tag).toUpperCase(),
    parent: null,
    children: [],
    className: '',
    textContent: '',
    dataset: {},
    ownerDocument: null,
    classList: {
      add: (...cs) => cs.forEach((c) => classes.add(c)),
      remove: (...cs) => cs.forEach((c) => classes.delete(c)),
      contains: (c) => classes.has(c),
    },
    appendChild(child) {
      child.parent = el;
      el.children.push(child);
      return child;
    },
    remove() {
      if (!el.parent) return;
      const i = el.parent.children.indexOf(el);
      if (i >= 0) el.parent.children.splice(i, 1);
      el.parent = null;
    },
  };
  return el;
}

/** Root element wired to a fake document (the router resolves ownerDocument). */
function fakeRoot() {
  const root = fakeElement('div');
  root.ownerDocument = { createElement: (tag) => fakeElement(tag) };
  return root;
}

/** Screen stub that records lifecycle calls; mount can be made to throw. */
function fakeScreen({ throwOnMount = false } = {}) {
  const screen = {
    mounts: [],
    unmounts: 0,
    mount(el, params) {
      if (throwOnMount) throw new Error('mount exploded');
      screen.mounts.push({ el, params });
    },
    unmount() {
      screen.unmounts += 1;
    },
  };
  return screen;
}

/** Fake engine exposing the public onFrame/setQuality surface. */
function fakeEngine() {
  const callbacks = new Set();
  const engine = {
    callbacks,
    setQualityCalls: [],
    onFrame(cb) {
      callbacks.add(cb);
      return () => callbacks.delete(cb);
    },
    setQuality(q) {
      engine.setQualityCalls.push(q);
      return q;
    },
    /** Test driver: emit one frame to every registered callback. */
    step(dt, elapsed) {
      for (const cb of [...callbacks]) cb(dt, elapsed);
    },
  };
  return engine;
}

/** Fake settings store matching the get/set/subscribe surface. */
function fakeSettingsStore(initial = {}) {
  let value = { quality: 'high', fpsMeter: false, ...initial };
  const subs = new Set();
  const store = {
    setCalls: [],
    get: () => ({ ...value }),
    set(patch) {
      store.setCalls.push({ ...patch });
      value = { ...value, ...patch };
      for (const cb of [...subs]) cb({ ...value });
      return { ...value };
    },
    subscribe(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
  };
  return store;
}

/**
 * Drive constant-frame-time frames from the current time up to `untilSec`.
 * @returns {number} The new current time.
 */
function runFrames(engine, fromSec, untilSec, dt) {
  let t = fromSec;
  while (t + dt <= untilSec) {
    t += dt;
    engine.step(dt, t);
  }
  return t;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Poll until cond() is true (timers can lag under CI load). */
async function waitFor(cond, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (!cond() && Date.now() < deadline) await wait(10);
  return cond();
}

/* ------------------------------------------------------------------ */
/* screenRouter                                                        */
/* ------------------------------------------------------------------ */

test('router: register + go mounts the screen and tracks current()', async () => {
  const root = fakeRoot();
  const router = createScreenRouter(root);
  const home = fakeScreen();
  router.register('home', home);

  assert.equal(router.has('home'), true);
  assert.equal(router.has('nope'), false);
  assert.equal(router.currentName(), null);
  assert.equal(router.current(), null);

  await router.go('home', { greeting: 'ook' });
  assert.equal(home.mounts.length, 1);
  assert.deepEqual(home.mounts[0].params, { greeting: 'ook' });
  assert.equal(root.children.length, 1);
  assert.equal(root.children[0].dataset.screen, 'home');
  assert.equal(router.currentName(), 'home');
  assert.equal(router.current(), 'home');

  // Fade-in class lands after the double-raf fallback ticks.
  const visible = await waitFor(() => root.children[0].classList.contains('screen--visible'));
  assert.equal(visible, true);
});

test('router: navigation unmounts the old screen and back() returns to it', async () => {
  const root = fakeRoot();
  const router = createScreenRouter(root);
  const a = fakeScreen();
  const b = fakeScreen();
  router.register('a', a);
  router.register('b', b);

  await router.go('a');
  const aEl = root.children[0];
  await router.go('b');

  assert.equal(a.unmounts, 1, 'old screen unmounted');
  assert.equal(aEl.parent, null, 'old element removed from the root');
  assert.equal(root.children.length, 1);
  assert.equal(router.current(), 'b');

  await router.back();
  assert.equal(b.unmounts, 1);
  assert.equal(router.current(), 'a');
  assert.equal(a.mounts.length, 2, 'back() re-mounts the previous screen');
});

test('router: throwing mount falls back to mainMenu and dispatches a window error', async () => {
  const root = fakeRoot();
  const router = createScreenRouter(root);
  const mainMenu = fakeScreen();
  const broken = fakeScreen({ throwOnMount: true });
  router.register('mainMenu', mainMenu);
  router.register('broken', broken);

  const dispatched = [];
  globalThis.window = { dispatchEvent: (e) => dispatched.push(e) };
  try {
    await router.go('mainMenu');
    await router.go('broken');
  } finally {
    delete globalThis.window;
  }

  assert.equal(router.current(), 'mainMenu', 'navigation recovered to mainMenu');
  assert.equal(mainMenu.mounts.length, 2);
  assert.equal(root.children.length, 1);
  assert.equal(root.children[0].dataset.screen, 'mainMenu');
  assert.equal(dispatched.length, 1, 'the failure surfaced as one window error event');
  assert.match(String(dispatched[0].message), /"broken"/);
  assert.match(String(dispatched[0].error?.message), /mount exploded/);
});

test('router: falls back to placeholder when mainMenu is unregistered', async () => {
  const root = fakeRoot();
  const router = createScreenRouter(root);
  const placeholder = fakeScreen();
  router.register('placeholder', placeholder);
  router.register('broken', fakeScreen({ throwOnMount: true }));

  await router.go('broken');
  assert.equal(router.current(), 'placeholder');
  assert.equal(placeholder.mounts.length, 1);
});

test('router: gives up cleanly (no infinite loop) when every fallback throws', async () => {
  const root = fakeRoot();
  const router = createScreenRouter(root);
  router.register('mainMenu', fakeScreen({ throwOnMount: true }));
  router.register('placeholder', fakeScreen({ throwOnMount: true }));
  router.register('broken', fakeScreen({ throwOnMount: true }));

  await router.go('broken'); // Must resolve instead of recursing forever.
  assert.equal(router.current(), null);
  assert.equal(root.children.length, 0, 'no broken element left behind');
});

test('router: existing API semantics stay intact', async () => {
  const root = fakeRoot();
  const router = createScreenRouter(root);
  assert.throws(() => createScreenRouter(null), /rootEl is required/);
  assert.throws(() => router.register('', fakeScreen()), /non-empty string/);
  assert.throws(() => router.register('x', {}), /mount\(el, params\)/);
  await assert.rejects(() => router.go('ghost'), /unknown screen "ghost"/);
  await router.back(); // Empty history stays a no-op.
  assert.equal(router.current(), null);
});

/* ------------------------------------------------------------------ */
/* perfMonitor                                                         */
/* ------------------------------------------------------------------ */

test('perfMonitor: rolling fps average and p95 frame time', () => {
  const engine = fakeEngine();
  const core = createPerfCore(engine, fakeSettingsStore());

  assert.equal(core.fps(), 0, 'no samples yet');
  assert.equal(core.p95(), 0);

  runFrames(engine, 0, 2, 1 / 60);
  assert.ok(Math.abs(core.fps() - 60) < 0.5, `expected ~60 fps, got ${core.fps()}`);
  assert.ok(Math.abs(core.p95() - 1000 / 60) < 0.5, `expected ~16.7ms p95, got ${core.p95()}`);

  // 90 quick frames (10ms) + 10 slow frames (50ms) inside one window:
  // p95 (nearest-rank over 100 sorted samples) must surface the slow tier.
  const engine2 = fakeEngine();
  const core2 = createPerfCore(engine2, fakeSettingsStore());
  let t = 100;
  for (let i = 0; i < 90; i++) { t += 0.01; engine2.step(0.01, t); }
  for (let i = 0; i < 10; i++) { t += 0.05; engine2.step(0.05, t); }
  assert.ok(Math.abs(core2.p95() - 50) < 0.01, `expected 50ms p95, got ${core2.p95()}`);
  assert.ok(Math.abs(core2.fps() - 100 / 1.4) < 1, `expected ~71.4 fps, got ${core2.fps()}`);

  // Only the rolling 2s window counts: after 2s of slow frames the earlier
  // fast frames must be gone.
  runFrames(engine2, t, t + 2.2, 0.05);
  assert.ok(Math.abs(core2.fps() - 20) < 0.5, `expected ~20 fps, got ${core2.fps()}`);

  core.dispose();
  core2.dispose();
});

test('perfMonitor: sustained low fps steps quality down once per cooldown, floor low', () => {
  const engine = fakeEngine();
  const store = fakeSettingsStore({ quality: 'high' });
  const core = createPerfCore(engine, store);
  const dt = 1 / 30; // ~30 fps, under the 45 fps threshold.

  // Under threshold but sustain not reached yet -> no step.
  let t = runFrames(engine, 0, AUTO_QUALITY.sustainSec - 1, dt);
  assert.equal(engine.setQualityCalls.length, 0);

  // Sustain reached -> exactly ONE step high -> med.
  t = runFrames(engine, t, 12, dt);
  assert.deepEqual(engine.setQualityCalls, ['med']);
  assert.deepEqual(store.setCalls, [{ quality: 'med' }]);
  assert.equal(store.get().quality, 'med');

  // Still slow, but inside the 30s cooldown -> still just one step.
  t = runFrames(engine, t, 35, dt);
  assert.equal(engine.setQualityCalls.length, 1, 'no second step inside the cooldown');

  // Cooldown over (first step fired ~10s in) -> second step med -> low.
  t = runFrames(engine, t, 45, dt);
  assert.deepEqual(engine.setQualityCalls, ['med', 'low']);
  assert.equal(store.get().quality, 'low');

  // 'low' is the floor: never steps below, never steps up automatically.
  t = runFrames(engine, t, 90, dt);
  assert.equal(engine.setQualityCalls.length, 2);
  runFrames(engine, t, 100, 1 / 120); // Fast again - must NOT step back up.
  assert.equal(engine.setQualityCalls.length, 2);
  assert.equal(store.get().quality, 'low');

  core.dispose();
});

test('perfMonitor: a manual quality change blocks auto steps for 30s', () => {
  const engine = fakeEngine();
  const store = fakeSettingsStore({ quality: 'high' });
  const core = createPerfCore(engine, store);
  const dt = 1 / 30;

  let t = runFrames(engine, 0, 5, dt);
  store.set({ quality: 'med' }); // Manual change at t=5 (not an auto step).
  const manualCalls = store.setCalls.length;

  // Sustain passes at ~10s, but the manual grace runs until t=35.
  t = runFrames(engine, t, 34, dt);
  assert.equal(engine.setQualityCalls.length, 0, 'auto step held back by manual grace');

  // Grace over -> one step med -> low.
  runFrames(engine, t, 38, dt);
  assert.deepEqual(engine.setQualityCalls, ['low']);
  assert.equal(store.setCalls.length, manualCalls + 1);
  assert.equal(store.get().quality, 'low');

  core.dispose();
});

test('perfMonitor: recovered fps resets the sustain streak', () => {
  const engine = fakeEngine();
  const store = fakeSettingsStore({ quality: 'high' });
  const core = createPerfCore(engine, store);

  // 8s slow, then fast frames clear the streak, then 8s slow again:
  // no single continuous 10s under threshold -> no step.
  let t = runFrames(engine, 0, 8, 1 / 30);
  t = runFrames(engine, t, 11, 1 / 120);
  runFrames(engine, t, 19, 1 / 30);
  assert.equal(engine.setQualityCalls.length, 0);

  core.dispose();
});

test('perfMonitor: createPerfMonitor is inert without a window (headless node)', () => {
  const engine = fakeEngine();
  const monitor = createPerfMonitor(engine, fakeSettingsStore());
  assert.equal(engine.callbacks.size, 0, 'no frame callback registered headless');
  assert.equal(monitor.fps(), 0);
  assert.equal(monitor.p95(), 0);
  monitor.dispose(); // Must be safe to call.
});

test('perfMonitor: dispose() detaches from the engine and the store', () => {
  const engine = fakeEngine();
  const store = fakeSettingsStore();
  const core = createPerfCore(engine, store);
  assert.equal(engine.callbacks.size, 1);
  core.dispose();
  assert.equal(engine.callbacks.size, 0);
  store.set({ quality: 'low' }); // Subscriber gone - must not throw.
  runFrames(engine, 0, 1, 1 / 60);
  assert.equal(core.fps(), 0, 'no samples collected after dispose');
});

/* ------------------------------------------------------------------ */
/* errorOverlay crash-loop counter                                     */
/* ------------------------------------------------------------------ */

test('crash loop: fatal only after MORE THAN threshold errors inside the window', () => {
  const counter = createCrashLoopCounter({ threshold: 8, windowMs: 10_000 });
  for (let i = 0; i < 8; i++) {
    assert.equal(counter.record(1000 + i * 100), false, `error #${i + 1} stays non-fatal`);
  }
  assert.equal(counter.count(1800), 8);
  assert.equal(counter.record(1900), true, 'the 9th error inside 10s trips the loop');
  assert.equal(counter.record(1950), true, 'stays tripped while the burst continues');
});

test('crash loop: the window slides - spread-out errors never trip it', () => {
  const counter = createCrashLoopCounter({ threshold: 8, windowMs: 10_000 });
  for (let i = 0; i < 30; i++) {
    assert.equal(counter.record(i * 2000), false, 'errors 2s apart never accumulate to >8');
  }
  assert.equal(counter.count(30 * 2000), 4, 'only the last 10s worth of errors is retained');
});

test('crash loop: old burst expires, reset() clears state', () => {
  const counter = createCrashLoopCounter({ threshold: 3, windowMs: 1000 });
  assert.equal(counter.record(0), false);
  assert.equal(counter.record(10), false);
  assert.equal(counter.record(20), false);
  assert.equal(counter.record(30), true, '4th error in the window is fatal');
  // 2s later the burst has aged out entirely.
  assert.equal(counter.record(2030), false);
  counter.reset();
  assert.equal(counter.count(2030), 0);
});

test('crash loop: defaults match the documented tuning', () => {
  assert.equal(CRASH_LOOP.threshold, 8);
  assert.equal(CRASH_LOOP.windowMs, 10_000);
  const counter = createCrashLoopCounter(); // Date.now-based defaults.
  let fatal = false;
  for (let i = 0; i < 9; i++) fatal = counter.record();
  assert.equal(fatal, true, '9 rapid-fire errors with default tuning are fatal');
});

test('errorOverlay: installErrorOverlay is a safe no-op headless', () => {
  const handle = installErrorOverlay();
  assert.equal(typeof handle.showFatal, 'function');
  assert.equal(typeof handle.markBootComplete, 'function');
  assert.equal(typeof handle.dispose, 'function');
  assert.equal(handle.isShown(), false);
  handle.showFatal(new Error('nope')); // Must not touch a DOM that isn't there.
  handle.markBootComplete();
  handle.dispose();
  assert.equal(handle.isShown(), false);
});
