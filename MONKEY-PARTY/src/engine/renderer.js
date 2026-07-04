/**
 * Core three.js engine wrapper for MONKEY-PARTY.
 *
 * createEngine(canvas, settings) builds a WebGLRenderer (shadows, ACES tone
 * mapping), a scene + perspective camera, a clamped-delta render loop, and a
 * resize observer. Quality knobs come from src/engine/quality.js.
 */

import * as THREE from 'three';
import { getQuality } from './quality.js';

/** Maximum frame delta fed to onFrame callbacks (seconds). */
const MAX_DT = 0.05;

/**
 * @param {HTMLCanvasElement} canvas Target canvas.
 * @param {Object} [settings] Settings snapshot ({ quality: 'low'|'med'|'high', ... }).
 * @returns {{
 *   renderer: THREE.WebGLRenderer,
 *   scene: THREE.Scene,
 *   camera: THREE.PerspectiveCamera,
 *   clock: THREE.Clock,
 *   quality: Object,
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
    return quality;
  }

  function resize() {
    const width = canvas.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1);
    const height = canvas.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 1);
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  }

  function frame() {
    rafId = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), MAX_DT);
    const elapsed = clock.elapsedTime;
    for (const cb of frameCallbacks) {
      try {
        cb(dt, elapsed);
      } catch (err) {
        console.error('[engine] frame callback threw:', err);
      }
    }
    renderer.render(scene, camera);
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
  return engine;
}

export default createRenderer;
