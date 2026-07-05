/**
 * Kinetic turn/round banner for the board-play view (P4).
 *
 * A canvas-texture sprite (title + optional subtitle) anchored to the
 * camera so it stays screen-fixed through camera cuts; when no camera is
 * available (headless tests) it floats above the board root instead.
 *
 * show(title, opts) starts a self-driven timeline - kinetic typography:
 * the title slides in from the left with overshoot while scale-popping,
 * the subtitle counter-slides from the right, hold, then both rise and
 * fade - advanced by update(dt); it returns the total duration so the
 * choreography queue can serialize around it. opts.style === 'final'
 * applies the red/gold FINAL ROUND treatment (bigger type, red backdrop,
 * gold stroke). Under body.reduced-motion the pose is static (no slide).
 */

import * as THREE from 'three';
import { prefersReducedMotion } from '../engine/tween.js';
import { makeTextSprite, disposeSprite } from './fieldFx.js';

const SLIDE_IN = 0.34;
const FADE_OUT = 0.35;

/**
 * @param {*} engine Engine handle ({ camera, scene }) - may be null.
 * @param {THREE.Object3D|null} [sceneRoot] Fallback parent when no camera.
 */
export function createTurnBanner(engine = null, sceneRoot = null) {
  const anchor = new THREE.Group();
  anchor.name = 'turnBanner';

  const camera = engine?.camera ?? null;
  if (camera) {
    // Camera-attached sprites only render when the camera is in the graph.
    if (!camera.parent && engine?.scene?.add) engine.scene.add(camera);
    camera.add(anchor);
    anchor.position.set(0, 1.0, -3.4);
  } else if (sceneRoot) {
    sceneRoot.add(anchor);
    anchor.position.set(0, 7, 0);
  }

  let title = null;
  let subtitle = null;
  let timeline = null; // { t, dur }
  let disposed = false;

  function clearSprites() {
    if (title) disposeSprite(title);
    if (subtitle) disposeSprite(subtitle);
    title = null;
    subtitle = null;
  }

  let titleBaseScale = null;

  /**
   * Show a banner. Returns the total duration in seconds.
   * @param {string} text
   * @param {{subtitle?: string, color?: string, duration?: number,
   *   style?: 'final'}} [opts] style 'final' = red/gold FINAL ROUND look.
   */
  function show(text, opts = {}) {
    if (disposed) return 0;
    clearSprites();
    const scale = camera ? 1 : 2.2; // world-space fallback needs to be bigger
    const final = opts.style === 'final';
    title = makeTextSprite(String(text), {
      color: opts.color ?? (final ? '#ffd23f' : '#ffe135'),
      bg: final ? 'rgba(84,8,8,0.88)' : 'rgba(12,16,10,0.78)',
      stroke: final ? '#e5484d' : 'rgba(0,0,0,0.9)',
      size: final ? 76 : 64,
      height: (final ? 0.52 : 0.42) * scale,
    });
    titleBaseScale = title.scale.clone();
    anchor.add(title);
    if (opts.subtitle) {
      subtitle = makeTextSprite(String(opts.subtitle), {
        color: final ? '#ffd23f' : '#e8f0dc',
        bg: final ? 'rgba(84,8,8,0.7)' : 'rgba(12,16,10,0.6)',
        size: 40,
        height: 0.22 * scale,
      });
      subtitle.position.y = -0.36 * scale;
      anchor.add(subtitle);
    }
    timeline = { t: 0, dur: Math.max(0.5, opts.duration ?? 1.8) };
    applyPose(0);
    return timeline.dur;
  }

  function applyPose(t) {
    const { dur } = timeline;
    let x = 0;
    let y = 0;
    let pop = 1;
    let opacity = 1;
    if (prefersReducedMotion()) {
      // Static pose: readable immediately, no slides or pops.
      if (t > dur - FADE_OUT) opacity = 1 - (t - (dur - FADE_OUT)) / FADE_OUT;
    } else if (t < SLIDE_IN) {
      // Kinetic entry: slide from the left with overshoot + scale pop.
      const k = t / SLIDE_IN;
      const s = 1.70158;
      const e = ((k - 1) ** 2) * ((s + 1) * (k - 1) + s) + 1;
      x = -1.6 * (1 - e);
      pop = 0.6 + 0.4 * e;
      opacity = Math.min(1, k * 2.5);
    } else if (t > dur - FADE_OUT) {
      const k = (t - (dur - FADE_OUT)) / FADE_OUT;
      y = 0.35 * k;
      opacity = 1 - k;
    }
    if (title) {
      title.position.x = x;
      title.position.y = y;
      if (titleBaseScale) title.scale.set(titleBaseScale.x * pop, titleBaseScale.y * pop, 1);
      title.material.opacity = opacity;
    }
    if (subtitle) {
      subtitle.position.x = -x; // counter-slide from the right
      subtitle.position.y = -(camera ? 0.36 : 0.8) + y;
      subtitle.material.opacity = opacity;
    }
  }

  /** Advance the banner timeline; call once per frame. */
  function update(dt) {
    if (disposed || !timeline) return;
    timeline.t += Math.max(0, Number(dt) || 0);
    if (timeline.t >= timeline.dur) {
      clearSprites();
      timeline = null;
      return;
    }
    applyPose(timeline.t);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    clearSprites();
    timeline = null;
    anchor.parent?.remove(anchor);
  }

  return {
    group: anchor,
    show,
    update,
    dispose,
    get visible() {
      return !!timeline;
    },
  };
}

export default createTurnBanner;
