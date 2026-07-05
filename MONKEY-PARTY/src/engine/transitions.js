/**
 * Full-screen DOM/CSS transitions for MONKEY-PARTY screen changes.
 *
 * All transitions overlay the whole viewport (above the canvas + UI):
 *   - wipe(midCb)     diagonal jungle-green panel slides across; midCb runs
 *                     while the screen is fully covered.
 *   - iris(midCb)     black circle closes over the screen, midCb, reopens.
 *   - starWipe(midCb) star-shaped iris: a star grows to cover the screen
 *                     (with a little spin), midCb, then shrinks away.
 *   - fadeToBlack(dur) -> Promise (stays black until fadeIn()).
 *   - fadeIn(dur)     -> Promise.
 *
 * midCb may be async; each transition returns a Promise resolved when the
 * animation fully completes. When document.body has the 'reduced-motion'
 * class every transition degrades to an instant cut (midCb still runs).
 */

import { prefersReducedMotion } from './tween.js';

const OVERLAY_ID = 'mp-transitions';
const WIPE_COLOR = '#123d1f';
const STAR_COLOR = '#120d2e';

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

/** Reduced-motion path: no animation, just run midCb (instant cut). */
async function instantCut(midCb) {
  try {
    await midCb?.();
  } catch (err) {
    console.error('[transitions] midCb threw:', err);
  }
}

/**
 * clip-path polygon string for a 5-point star centered at 50%/50%.
 * @param {number} outer Outer radius in % (inner is 45% of it).
 * @param {number} rotDeg Rotation offset in degrees.
 */
function starPolygon(outer, rotDeg = 0) {
  const pts = [];
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? outer : outer * 0.45;
    const a = ((i * 36 - 90 + rotDeg) * Math.PI) / 180;
    pts.push(`${(50 + Math.cos(a) * r).toFixed(2)}% ${(50 + Math.sin(a) * r).toFixed(2)}%`);
  }
  return `polygon(${pts.join(',')})`;
}

/**
 * Slide a full-screen panel across the viewport; run midCb while covered.
 *
 * @param {() => (void|Promise<void>)} [midCb] Called at full cover.
 * @param {{ dur?: number, color?: string }} [opts] dur = total seconds.
 * @returns {Promise<void>}
 */
export async function wipe(midCb, opts = {}) {
  if (prefersReducedMotion()) return instantCut(midCb);
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
  if (prefersReducedMotion()) return instantCut(midCb);
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
 * Star wipe: a star-shaped iris (clip-path polygon) grows with a slight spin
 * until it covers the screen, midCb runs, then it shrinks back out.
 *
 * @param {() => (void|Promise<void>)} [midCb]
 * @param {{ dur?: number, color?: string }} [opts] dur = total seconds.
 * @returns {Promise<void>}
 */
export async function starWipe(midCb, opts = {}) {
  if (prefersReducedMotion()) return instantCut(midCb);
  const dur = opts.dur ?? 1.1;
  const half = dur / 2;
  const root = ensureOverlay();

  // 160% outer radius overshoots every corner even on wide screens (clip-path
  // percentages track element width/height, so the star stretches with the
  // viewport, which reads as intentional squash for a wipe).
  const panel = document.createElement('div');
  panel.style.cssText = `position:absolute;inset:0;background:${opts.color ?? STAR_COLOR};`
    + `clip-path:${starPolygon(0.001, -20)};will-change:clip-path;`;
  root.appendChild(panel);

  await nextFrame();
  panel.style.transition = `clip-path ${half}s cubic-bezier(0.5,0,0.75,0.6)`;
  panel.style.clipPath = starPolygon(160, 20);
  await wait(half + 0.02);

  try {
    await midCb?.();
  } catch (err) {
    console.error('[transitions] starWipe midCb threw:', err);
  }

  panel.style.transition = `clip-path ${half}s cubic-bezier(0.25,0.4,0.5,1)`;
  panel.style.clipPath = starPolygon(0.001, 60);
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
  if (prefersReducedMotion()) dur = 0;
  if (!fadeEl || !fadeEl.isConnected) {
    fadeEl = document.createElement('div');
    fadeEl.style.cssText = 'position:absolute;inset:0;background:#000;opacity:0;will-change:opacity;';
    root.appendChild(fadeEl);
    await nextFrame();
  }
  fadeEl.style.transition = dur > 0 ? `opacity ${dur}s ease` : 'none';
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
  if (prefersReducedMotion()) dur = 0;
  fadeEl.style.transition = dur > 0 ? `opacity ${dur}s ease` : 'none';
  fadeEl.style.opacity = '0';
  await wait(dur + 0.02);
  fadeEl.remove();
  fadeEl = null;
}
