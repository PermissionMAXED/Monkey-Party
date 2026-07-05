/**
 * Core three.js engine wrapper for MONKEY-PARTY.
 *
 * createEngine(canvas, settings) builds a WebGLRenderer (shadows, ACES tone
 * mapping), a scene + perspective camera, a clamped-delta render loop, and a
 * resize observer. Quality knobs come from src/engine/quality.js.
 *
 * When the active quality preset has `postfx: true` the frame is rendered
 * through src/engine/postfx.js (bloom + vignette/grade); postfx.js is only
 * ever loaded in a browser (dynamic import behind a window/document guard)
 * so node tests never touch it.
 *
 * engine.fx = { shake, flash, hitStop, setEnabled } provides juice helpers:
 *   - shake(intensity, durSec): decaying noise offset applied to the camera
 *     AFTER frame callbacks and BEFORE render; the camera transform is
 *     restored right after render so game code never observes the offset.
 *   - flash(color, durSec): full-screen color flash (postfx uniform when the
 *     composer is live, additive full-screen quad otherwise).
 *   - hitStop(sec): scales the dt passed to frame callbacks to 0 for at most
 *     0.12s of real time (rendering only; fixed-step sims just catch up).
 *   - setEnabled(bool): global fx kill-switch. Shake/flash also no-op while
 *     document.body has the 'reduced-motion' class.
 */

import * as THREE from 'three';
import { getQuality } from './quality.js';

/** Maximum frame delta fed to onFrame callbacks (seconds). */
const MAX_DT = 0.05;

/** Hard cap for fx.hitStop (seconds of real time). */
const HIT_STOP_MAX = 0.12;

/** World-space shake amplitude per unit of intensity. */
const SHAKE_AMPLITUDE = 0.22;

/** Peak opacity of a full-strength flash (never fully blinds). */
const FLASH_MAX_OPACITY = 0.85;

const IS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';

/**
 * @param {HTMLCanvasElement} canvas Target canvas.
 * @param {Object} [settings] Settings snapshot ({ quality: 'low'|'med'|'high', ... }).
 * @returns {{
 *   renderer: THREE.WebGLRenderer,
 *   scene: THREE.Scene,
 *   camera: THREE.PerspectiveCamera,
 *   clock: THREE.Clock,
 *   quality: Object,
 *   fx: {
 *     shake: (intensity?: number, durSec?: number) => void,
 *     flash: (color?: *, durSec?: number) => void,
 *     hitStop: (sec?: number) => void,
 *     setEnabled: (on: boolean) => void,
 *   },
 *   onFrame: (cb: (dt: number, elapsed: number) => void) => () => void,
 *   offFrame: (cb: Function) => void,
 *   start: () => void,
 *   stop: () => void,
 *   resize: () => void,
 *   setQuality: (q: string|Object) => Object,
 *   dispose: () => void,
 * }}
 */
export function createEngine(canvas, settings = {}) {
  let quality = getQuality(settings.quality);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: quality.antialias,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
  camera.position.set(0, 10, 16);
  camera.lookAt(0, 0, 0);

  const clock = new THREE.Clock(false);

  const frameCallbacks = new Set();
  let rafId = 0;
  let running = false;
  let disposed = false;

  /* ---------------------------- postfx ----------------------------- */

  /** @type {null | { render: Function, setQuality: Function, resize: Function, setFlash: Function, dispose: Function, active: boolean }} */
  let postfx = null;
  let postfxLoadSeq = 0; // Invalidates in-flight loads on toggle/dispose.

  function syncPostFx() {
    if (!IS_BROWSER || disposed) {
      return;
    }
    if (quality.postfx) {
      if (postfx) {
        postfx.setQuality(quality);
        return;
      }
      const seq = ++postfxLoadSeq;
      import('./postfx.js')
        .then((mod) => {
          if (disposed || seq !== postfxLoadSeq || !quality.postfx || postfx) return;
          const created = mod.createPostFx(renderer, scene, camera, quality);
          if (created.active) {
            postfx = created;
          } else {
            created.dispose(); // Old GPU / WebGL1: stay on direct render.
          }
        })
        .catch((err) => {
          console.info(`[engine] postfx unavailable: ${err?.message ?? err}`);
        });
    } else {
      postfxLoadSeq += 1;
      if (postfx) {
        postfx.dispose();
        postfx = null;
      }
    }
  }

  /* ------------------------------ fx ------------------------------- */

  let fxEnabled = true;
  let shakeTime = 0;
  let shakeDur = 0;
  let shakeIntensity = 0;
  let hitStopLeft = 0;
  let flashTime = 0;
  let flashDur = 0;
  let flashColor = '#ffffff';

  const camSavePos = new THREE.Vector3();
  const camSaveQuat = new THREE.Quaternion();

  // Fallback flash quad (used when the postfx composer isn't live).
  let flashScene = null;
  let flashCam = null;
  let flashMat = null;
  let flashQuad = null;

  function reducedMotion() {
    return IS_BROWSER && !!document.body?.classList?.contains('reduced-motion');
  }

  const fx = {
    /**
     * Decaying camera shake (applied after frame callbacks, before render;
     * the camera transform is restored each frame).
     */
    shake(intensity = 1, durSec = 0.4) {
      if (!fxEnabled || reducedMotion()) return;
      // Blend with any shake still in flight so overlapping hits stack up.
      const remaining = shakeDur > 0 ? shakeIntensity * (shakeTime / shakeDur) : 0;
      shakeIntensity = Math.max(remaining, intensity);
      shakeDur = Math.max(durSec, 0.01);
      shakeTime = shakeDur;
    },

    /** Full-screen color flash fading out over durSec. */
    flash(color = '#ffffff', durSec = 0.15) {
      if (!fxEnabled || reducedMotion()) return;
      flashColor = color ?? '#ffffff';
      flashDur = Math.max(durSec, 0.02);
      flashTime = flashDur;
    },

    /** Freeze frame-callback dt to 0 for at most 0.12s of real time. */
    hitStop(sec = 0.08) {
      if (!fxEnabled) return;
      hitStopLeft = Math.min(Math.max(sec ?? 0, 0), HIT_STOP_MAX);
    },

    /** Global kill-switch for shake/flash/hitStop (default enabled). */
    setEnabled(on) {
      fxEnabled = !!on;
      if (!fxEnabled) {
        shakeTime = 0;
        shakeIntensity = 0;
        hitStopLeft = 0;
        flashTime = 0;
        if (postfx) postfx.setFlash(null, 0);
      }
    },
  };

  function renderFlashQuad(opacity) {
    if (!flashQuad) {
      flashMat = new THREE.MeshBasicMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      flashQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), flashMat);
      flashQuad.frustumCulled = false;
      flashScene = new THREE.Scene();
      flashScene.add(flashQuad);
      flashCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    }
    flashMat.color.set(flashColor);
    flashMat.opacity = opacity;
    const prevAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.render(flashScene, flashCam);
    renderer.autoClear = prevAutoClear;
  }

  /* --------------------------- main loop ---------------------------- */

  function applyQuality(preset) {
    quality = preset;
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    renderer.setPixelRatio(Math.min(dpr, preset.pixelRatioCap));
    renderer.shadowMap.enabled = preset.shadows;
    renderer.shadowMap.type = preset.id === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    renderer.shadowMap.needsUpdate = true;
    // Re-allocate shadow maps on lights already in the scene.
    scene.traverse((obj) => {
      if (obj.isLight && obj.shadow) {
        obj.shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
        if (obj.shadow.map) {
          obj.shadow.map.dispose();
          obj.shadow.map = null;
        }
      }
    });
    engine.quality = quality;
    syncPostFx();
    return quality;
  }

  function resize() {
    const width = canvas.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1);
    const height = canvas.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 1);
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    if (postfx) postfx.resize(width, height);
  }

  function frame() {
    rafId = requestAnimationFrame(frame);
    const rawDt = clock.getDelta();
    const realDt = Math.min(rawDt, MAX_DT);
    const elapsed = clock.elapsedTime;

    // Hit-stop: rendering keeps going, callbacks see dt = 0 (fixed-step sims
    // accumulate real time themselves and simply catch up afterwards). The
    // budget burns down in UNCLAMPED real time so a hit-stop never freezes
    // callbacks for longer than HIT_STOP_MAX wall-clock seconds, even at
    // very low frame rates.
    let dt = realDt;
    if (hitStopLeft > 0) {
      hitStopLeft = Math.max(0, hitStopLeft - rawDt);
      dt = 0;
    }

    for (const cb of frameCallbacks) {
      try {
        cb(dt, elapsed);
      } catch (err) {
        console.error('[engine] frame callback threw:', err);
      }
    }

    // Shake: applied after frame callbacks so game code (camera rigs etc.)
    // has already posed the camera; restored after render.
    let camShaken = false;
    if (shakeTime > 0 && fxEnabled && !reducedMotion()) {
      const k = shakeIntensity * (shakeTime / shakeDur) ** 1.5 * SHAKE_AMPLITUDE;
      camSavePos.copy(camera.position);
      camSaveQuat.copy(camera.quaternion);
      camera.position.x += (Math.random() * 2 - 1) * k;
      camera.position.y += (Math.random() * 2 - 1) * k * 0.7;
      camera.position.z += (Math.random() * 2 - 1) * k * 0.5;
      camera.rotateZ((Math.random() * 2 - 1) * k * 0.06);
      camShaken = true;
    }
    if (shakeTime > 0) shakeTime = Math.max(0, shakeTime - rawDt);

    // Flash amount (linear fade-out).
    if (flashTime > 0) flashTime = Math.max(0, flashTime - rawDt);
    const flashAmount = flashDur > 0 && flashTime > 0
      ? (flashTime / flashDur) * FLASH_MAX_OPACITY
      : 0;

    if (postfx) {
      postfx.setFlash(flashColor, flashAmount);
      postfx.render(realDt);
    } else {
      renderer.render(scene, camera);
      if (flashAmount > 0) renderFlashQuad(flashAmount);
    }

    if (camShaken) {
      camera.position.copy(camSavePos);
      camera.quaternion.copy(camSaveQuat);
    }
  }

  function start() {
    if (running || disposed) return;
    running = true;
    clock.start();
    clock.getDelta(); // Zero the delta so the first frame isn't huge.
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(rafId);
    clock.stop();
  }

  /**
   * Register a per-frame callback (called before render with clamped dt).
   * @returns {() => void} Unsubscribe.
   */
  function onFrame(cb) {
    frameCallbacks.add(cb);
    return () => frameCallbacks.delete(cb);
  }

  function offFrame(cb) {
    frameCallbacks.delete(cb);
  }

  // Resize plumbing: observe the canvas element + window resizes as fallback.
  const RO = typeof globalThis !== 'undefined' ? globalThis.ResizeObserver : undefined;
  const resizeObserver = RO ? new RO(() => resize()) : null;
  if (resizeObserver) resizeObserver.observe(canvas);
  const onWindowResize = () => resize();
  if (typeof window !== 'undefined') window.addEventListener('resize', onWindowResize);

  function dispose() {
    if (disposed) return;
    disposed = true;
    stop();
    postfxLoadSeq += 1;
    if (postfx) {
      postfx.dispose();
      postfx = null;
    }
    if (flashQuad) {
      flashQuad.geometry.dispose();
      flashMat.dispose();
      flashScene = null;
      flashCam = null;
      flashQuad = null;
      flashMat = null;
    }
    if (resizeObserver) resizeObserver.disconnect();
    if (typeof window !== 'undefined') window.removeEventListener('resize', onWindowResize);
    frameCallbacks.clear();
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      // Materials may be shared via the materials.js cache; the cache owns
      // their lifecycle (see clearMaterialCache).
    });
    scene.clear();
    renderer.dispose();
  }

  const engine = {
    renderer,
    scene,
    camera,
    clock,
    quality,
    fx,
    onFrame,
    offFrame,
    start,
    stop,
    resize,
    setQuality: (q) => applyQuality(getQuality(q)),
    dispose,
  };

  applyQuality(quality);
  resize();
  return engine;
}

/**
 * Boot-compat wrapper matching src/main.js, which calls
 * `createRenderer({ canvas, settings })`. Creates and starts an engine.
 *
 * @param {{ canvas: HTMLCanvasElement, settings?: Object }} opts
 */
export function createRenderer({ canvas, settings } = {}) {
  const engine = createEngine(canvas, settings);
  engine.start();
  // Devtools/a11y handle: src/app/a11y.js forwards the screenShake setting
  // to window.__mpEngine.fx.setEnabled when a host exposes the engine here.
  if (IS_BROWSER) window.__mpEngine = engine;
  return engine;
}

export default createRenderer;
