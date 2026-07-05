/**
 * Frame-performance monitor + auto-quality governor (stability package).
 *
 * createPerfMonitor(engine, settingsStore) hooks engine.onFrame (public API)
 * to keep a rolling 2s window of frame samples:
 *   - fps():  rolling average frames-per-second over that window
 *   - p95():  95th-percentile frame time (milliseconds) over that window
 *
 * While settings.fpsMeter is true (field read defensively - missing means
 * false) a tiny fixed-corner readout element shows both numbers. The element
 * uses inline styles only, so it renders even if the stylesheet is broken.
 *
 * AUTO-QUALITY: when the rolling average stays under 45 fps for 10s straight,
 * and the user hasn't manually changed quality in the last 30s, the monitor
 * steps quality down ONE tier (high -> med -> low) via engine.setQuality +
 * settingsStore.set({ quality }) and logs a console notice. At most one step
 * per 30s cooldown, floor is 'low', and it NEVER steps quality up.
 *
 * All timing runs off the `elapsed` clock passed to frame callbacks, so the
 * logic is deterministic and node-testable. createPerfCore carries the whole
 * DOM-free measurement/governor logic (exported for tests); createPerfMonitor
 * adds the DOM readout and is inert without a window (headless/node).
 */

import { QUALITY_LEVELS } from './quality.js';

/** Rolling stats window (seconds). */
export const WINDOW_SEC = 2;
/** Auto-quality tuning knobs (exported for tests). */
export const AUTO_QUALITY = Object.freeze({
  /** Rolling average must stay below this (fps) ... */
  fpsThreshold: 45,
  /** ... for this long (seconds) before a step fires. */
  sustainSec: 10,
  /** Minimum spacing between auto steps (seconds). */
  cooldownSec: 30,
  /** No auto step within this long after a MANUAL quality change (seconds). */
  manualGraceSec: 30,
});

/** How often the on-screen readout refreshes (seconds). */
const READOUT_INTERVAL_SEC = 0.25;

const IS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';

/**
 * DOM-free perf core: frame stats + auto-quality governor.
 *
 * Exported so node tests can drive it with a fake engine (engine.onFrame
 * hands out the frame callback) and a fake settings store. Everything is
 * timed with the `elapsed` argument of the frame callback.
 *
 * @param {{ onFrame: Function, setQuality?: Function }} engine
 * @param {{ get?: Function, set?: Function, subscribe?: Function }} [settingsStore]
 * @returns {{ fps: () => number, p95: () => number, dispose: () => void }}
 */
export function createPerfCore(engine, settingsStore) {
  /** @type {{t: number, dt: number}[]} Samples inside the rolling window. */
  const samples = [];
  let lastElapsed = 0;

  // Auto-quality state (all in frame-callback `elapsed` seconds).
  let lowSince = null; // When the rolling average first dipped under threshold.
  let lastAutoStepAt = -Infinity;
  let lastManualChangeAt = -Infinity;
  let applyingAutoStep = false; // Marks our own store writes as non-manual.
  let knownQuality = readQuality(settingsStore);

  function readQuality(store) {
    try {
      const q = store?.get?.()?.quality;
      return QUALITY_LEVELS.includes(q) ? q : null;
    } catch {
      return null;
    }
  }

  function prune(now) {
    const cutoff = now - WINDOW_SEC;
    while (samples.length > 0 && samples[0].t < cutoff) samples.shift();
  }

  function fps() {
    if (samples.length === 0) return 0;
    let total = 0;
    for (const s of samples) total += s.dt;
    return total > 0 ? samples.length / total : 0;
  }

  /** 95th-percentile frame time in milliseconds (nearest-rank method). */
  function p95() {
    if (samples.length === 0) return 0;
    const sorted = samples.map((s) => s.dt).sort((a, b) => a - b);
    const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * 0.95) - 1));
    return sorted[rank] * 1000;
  }

  function maybeStepDown(now) {
    const avg = fps();
    if (avg <= 0 || avg >= AUTO_QUALITY.fpsThreshold) {
      lowSince = null;
      return;
    }
    if (lowSince === null) lowSince = now;
    if (now - lowSince < AUTO_QUALITY.sustainSec) return;
    if (now - lastAutoStepAt < AUTO_QUALITY.cooldownSec) return;
    if (now - lastManualChangeAt < AUTO_QUALITY.manualGraceSec) return;

    const current = readQuality(settingsStore) ?? knownQuality;
    const idx = QUALITY_LEVELS.indexOf(current);
    if (idx <= 0) return; // Already at the 'low' floor (or unknown tier).
    const next = QUALITY_LEVELS[idx - 1];

    lastAutoStepAt = now;
    lowSince = null; // A fresh 10s-under-threshold streak is required next time.
    knownQuality = next;
    console.info(
      `[perf] auto-quality: average ${avg.toFixed(1)} fps stayed under `
      + `${AUTO_QUALITY.fpsThreshold} fps - stepping quality "${current}" -> "${next}"`,
    );
    applyingAutoStep = true;
    try {
      engine?.setQuality?.(next);
      settingsStore?.set?.({ quality: next });
    } catch (err) {
      console.warn('[perf] auto-quality step failed:', err);
    } finally {
      applyingAutoStep = false;
    }
  }

  function onFrame(dt, elapsed) {
    if (Number.isFinite(elapsed)) lastElapsed = elapsed;
    // Ignore degenerate samples (hit-stop feeds dt = 0 to callbacks).
    if (Number.isFinite(dt) && dt > 0) samples.push({ t: lastElapsed, dt });
    prune(lastElapsed);
    maybeStepDown(lastElapsed);
  }

  const offFrame = typeof engine?.onFrame === 'function' ? engine.onFrame(onFrame) : null;

  // Manual quality changes (anything not written by our own auto step) reset
  // the grace period so the player's explicit choice sticks for a while.
  const unsubscribe = typeof settingsStore?.subscribe === 'function'
    ? settingsStore.subscribe((s) => {
      const q = QUALITY_LEVELS.includes(s?.quality) ? s.quality : null;
      if (q === knownQuality) return;
      knownQuality = q;
      if (!applyingAutoStep) lastManualChangeAt = lastElapsed;
    })
    : null;

  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    if (typeof offFrame === 'function') offFrame();
    else engine?.offFrame?.(onFrame);
    unsubscribe?.();
    samples.length = 0;
  }

  return { fps, p95, dispose };
}

/** Inert monitor handed out in headless/node contexts. */
function createInertMonitor() {
  return { fps: () => 0, p95: () => 0, dispose() {} };
}

/**
 * Full perf monitor: core stats/governor + fixed-corner FPS readout that is
 * only visible while settings.fpsMeter is true.
 *
 * @param {{ onFrame: Function, setQuality?: Function }} engine
 * @param {{ get?: Function, set?: Function, subscribe?: Function }} [settingsStore]
 * @returns {{ fps: () => number, p95: () => number, dispose: () => void }}
 */
export function createPerfMonitor(engine, settingsStore) {
  if (!IS_BROWSER || typeof engine?.onFrame !== 'function') return createInertMonitor();

  const core = createPerfCore(engine, settingsStore);

  /* ----------------------- FPS readout element ---------------------- */

  let meterEl = null;
  let lastReadoutAt = -Infinity;

  function ensureMeterEl() {
    if (meterEl) return meterEl;
    meterEl = document.createElement('div');
    meterEl.id = 'mp-fps-meter';
    meterEl.setAttribute('aria-hidden', 'true');
    // Inline styles only: the readout must survive a broken stylesheet.
    meterEl.style.cssText = [
      'position:fixed', 'left:8px', 'bottom:8px', 'z-index:9990',
      'padding:2px 7px', 'border-radius:4px',
      'background:rgba(8,20,12,0.78)', 'color:#9ed76a',
      'font:600 11px/1.5 ui-monospace,Menlo,Consolas,monospace',
      'letter-spacing:0.04em', 'pointer-events:none', 'user-select:none',
    ].join(';');
    document.body.appendChild(meterEl);
    return meterEl;
  }

  function meterWanted(settings) {
    // Field may be absent on older persisted settings - treat as false.
    return settings?.fpsMeter === true;
  }

  function syncMeter(settings) {
    if (meterWanted(settings)) {
      const el = ensureMeterEl();
      el.style.display = 'block';
      lastReadoutAt = -Infinity; // Repaint on the next frame.
    } else if (meterEl) {
      meterEl.style.display = 'none';
    }
  }

  function updateReadout(_dt, elapsed) {
    if (!meterEl || meterEl.style.display === 'none') return;
    if (elapsed - lastReadoutAt < READOUT_INTERVAL_SEC) return;
    lastReadoutAt = elapsed;
    meterEl.textContent = `${Math.round(core.fps())} FPS \u00b7 p95 ${core.p95().toFixed(1)} ms`;
  }

  const offReadout = engine.onFrame(updateReadout);

  let settingsSnapshot = null;
  try {
    settingsSnapshot = settingsStore?.get?.() ?? null;
  } catch { /* defensive: settings store optional */ }
  syncMeter(settingsSnapshot);

  const unsubscribe = typeof settingsStore?.subscribe === 'function'
    ? settingsStore.subscribe((s) => syncMeter(s))
    : null;

  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    core.dispose();
    if (typeof offReadout === 'function') offReadout();
    unsubscribe?.();
    if (meterEl) {
      meterEl.remove();
      meterEl = null;
    }
  }

  return { fps: core.fps, p95: core.p95, dispose };
}

export default createPerfMonitor;
