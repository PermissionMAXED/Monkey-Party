/**
 * Full-screen DOM/CSS transitions for MONKEY-PARTY screen changes.
 *
 * All transitions overlay the whole viewport (above the canvas + UI):
 *   - wipe(midCb)   diagonal jungle-green panel slides across; midCb runs
 *                   while the screen is fully covered.
 *   - iris(midCb)   black circle closes over the screen, midCb, reopens.
 *   - fadeToBlack(dur) -> Promise (stays black until fadeIn()).
 *   - fadeIn(dur)   -> Promise.
 *
 * midCb may be async; each transition returns a Promise resolved when the
 * animation fully completes.
 */

const OVERLAY_ID = 'mp-transitions';
const WIPE_COLOR = '#123d1f';

let overlayEl = null;
let fadeEl = null;

function ensureOverlay() {
  if (overlayEl && overlayEl.isConnected) return overlayEl;
  overlayEl = document.createElement('div');
  overlayEl.id = OVERLAY_ID;
  overlayEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:1000;overflow:hidden;';
  document.body.appendChild(overlayEl);
  return overlayEl;
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function wait(sec) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, sec * 1000)));
}

/**
 * Slide a full-screen panel across the viewport; run midCb while covered.
 *
 * @param {() => (void|Promise<void>)} [midCb] Called at full cover.
 * @param {{ dur?: number, color?: string }} [opts] dur = total seconds.
 * @returns {Promise<void>}
 */
export async function wipe(midCb, opts = {}) {
  const dur = opts.dur ?? 0.9;
  const half = dur / 2;
  const root = ensureOverlay();

  const panel = document.createElement('div');
  panel.style.cssText = `position:absolute;inset:-10%;background:${opts.color ?? WIPE_COLOR};`
    + 'transform:translateX(-115%) skewX(-8deg);will-change:transform;';
  root.appendChild(panel);

  await nextFrame();
  panel.style.transition = `transform ${half}s cubic-bezier(0.65,0,0.35,1)`;
  panel.style.transform = 'translateX(0) skewX(-8deg)';
  await wait(half + 0.02);

  try {
    await midCb?.();
  } catch (err) {
    console.error('[transitions] wipe midCb threw:', err);
  }

  panel.style.transform = 'translateX(115%) skewX(-8deg)';
  await wait(half + 0.02);
  panel.remove();
}

/**
 * Iris: a black circle closes over the screen, midCb runs, then it reopens.
 *
 * @param {() => (void|Promise<void>)} [midCb]
 * @param {{ dur?: number }} [opts] dur = total seconds.
 * @returns {Promise<void>}
 */
export async function iris(midCb, opts = {}) {
  const dur = opts.dur ?? 1.0;
  const half = dur / 2;
  const root = ensureOverlay();

  const panel = document.createElement('div');
  panel.style.cssText = 'position:absolute;inset:0;background:#000;'
    + 'clip-path:circle(0% at 50% 50%);will-change:clip-path;';
  root.appendChild(panel);

  await nextFrame();
  panel.style.transition = `clip-path ${half}s ease-in`;
  panel.style.clipPath = 'circle(75% at 50% 50%)';
  await wait(half + 0.02);

  try {
    await midCb?.();
  } catch (err) {
    console.error('[transitions] iris midCb threw:', err);
  }

  panel.style.transition = `clip-path ${half}s ease-out`;
  panel.style.clipPath = 'circle(0% at 50% 50%)';
  await wait(half + 0.02);
  panel.remove();
}

/**
 * Fade the screen to black and keep it black (until fadeIn()).
 * @param {number} [dur] Seconds.
 * @returns {Promise<void>}
 */
export async function fadeToBlack(dur = 0.4) {
  const root = ensureOverlay();
  if (!fadeEl || !fadeEl.isConnected) {
    fadeEl = document.createElement('div');
    fadeEl.style.cssText = 'position:absolute;inset:0;background:#000;opacity:0;will-change:opacity;';
    root.appendChild(fadeEl);
    await nextFrame();
  }
  fadeEl.style.transition = `opacity ${dur}s ease`;
  fadeEl.style.opacity = '1';
  await wait(dur + 0.02);
}

/**
 * Fade back in from black (after fadeToBlack()).
 * @param {number} [dur] Seconds.
 * @returns {Promise<void>}
 */
export async function fadeIn(dur = 0.4) {
  if (!fadeEl || !fadeEl.isConnected) return;
  fadeEl.style.transition = `opacity ${dur}s ease`;
  fadeEl.style.opacity = '0';
  await wait(dur + 0.02);
  fadeEl.remove();
  fadeEl = null;
}
