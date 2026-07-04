/**
 * Drop-in turn/round banner for the board-play view (P4).
 *
 * A canvas-texture sprite (title + optional subtitle) anchored to the
 * camera so it stays screen-fixed through camera cuts; when no camera is
 * available (headless tests) it floats above the board root instead.
 *
 * show(title, opts) starts a self-driven timeline (drop-in with overshoot,
 * hold, rise-and-fade) advanced by update(dt) and returns the total
 * duration, so the choreography queue can serialize around it.
 */

import * as THREE from 'three';
import { makeTextSprite, disposeSprite } from './fieldFx.js';

const DROP_IN = 0.32;
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

  /**
   * Show a banner. Returns the total duration in seconds.
   * @param {string} text
   * @param {{subtitle?: string, color?: string, duration?: number}} [opts]
   */
  function show(text, opts = {}) {
    if (disposed) return 0;
    clearSprites();
    const scale = camera ? 1 : 2.2; // world-space fallback needs to be bigger
    title = makeTextSprite(String(text), {
      color: opts.color ?? '#ffe135',
      bg: 'rgba(12,16,10,0.78)',
      stroke: 'rgba(0,0,0,0.9)',
      size: 64,
      height: 0.42 * scale,
    });
    anchor.add(title);
    if (opts.subtitle) {
      subtitle = makeTextSprite(String(opts.subtitle), {
        color: '#e8f0dc',
        bg: 'rgba(12,16,10,0.6)',
        size: 40,
        height: 0.22 * scale,
      });
      subtitle.position.y = -0.36 * scale;
      anchor.add(subtitle);
    }
    timeline = { t: 0, dur: Math.max(0.8, opts.duration ?? 1.8) };
    applyPose(0);
    return timeline.dur;
  }

  function applyPose(t) {
    const { dur } = timeline;
    let y = 0;
    let opacity = 1;
    if (t < DROP_IN) {
      // Drop from above with a small overshoot (backOut-ish).
      const k = t / DROP_IN;
      const s = 1.70158;
      const e = ((k - 1) ** 2) * ((s + 1) * (k - 1) + s) + 1;
      y = 0.9 * (1 - e);
      opacity = Math.min(1, k * 2);
    } else if (t > dur - FADE_OUT) {
      const k = (t - (dur - FADE_OUT)) / FADE_OUT;
      y = 0.35 * k;
      opacity = 1 - k;
    }
    if (title) {
      title.position.y = y;
      title.material.opacity = opacity;
    }
    if (subtitle) {
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
