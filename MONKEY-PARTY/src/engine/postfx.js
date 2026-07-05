/**
 * Post-processing chain for MONKEY-PARTY (browser-only).
 *
 * createPostFx(renderer, scene, camera, qualityPreset) builds an
 * EffectComposer pipeline:
 *   RenderPass -> UnrealBloomPass (subtle) -> grade pass (vignette +
 *   saturation + flash uniform) -> OutputPass (tone mapping + sRGB).
 *
 * IMPORTANT: this module must only ever be imported from
 * src/engine/renderer.js behind a browser guard (dynamic import). Node tests
 * never load it.
 *
 * If composer construction throws (old GPUs / WebGL1), the returned object
 * falls back to direct renderer.render() and every other method no-ops, so
 * callers never need their own try/catch.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const BLOOM_STRENGTH = 0.35;
const BLOOM_RADIUS = 0.4;
const BLOOM_THRESHOLD = 0.85;

/**
 * Cheap vignette + color-grade + flash shader (runs in linear space, before
 * OutputPass applies tone mapping and the sRGB transform).
 */
const GradeShader = {
  name: 'MonkeyGradeShader',
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: 0.42 },
    uSaturation: { value: 1.06 },
    uFlashColor: { value: new THREE.Color(1, 1, 1) },
    uFlash: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform float uSaturation;
    uniform vec3 uFlashColor;
    uniform float uFlash;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, uSaturation);
      vec2 d = vUv - 0.5;
      float vig = 1.0 - uVignette * smoothstep(0.18, 0.85, dot(d, d) * 2.0);
      c.rgb *= vig;
      c.rgb = mix(c.rgb, uFlashColor, clamp(uFlash, 0.0, 1.0));
      gl_FragColor = c;
    }
  `,
};

/**
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 * @param {Object} [qualityPreset] Preset from src/engine/quality.js.
 * @returns {{
 *   render: (dt?: number) => void,
 *   setQuality: (p: Object) => void,
 *   resize: (w: number, h: number) => void,
 *   setFlash: (color: *, amount: number) => void,
 *   dispose: () => void,
 *   active: boolean,
 * }}
 */
export function createPostFx(renderer, scene, camera, qualityPreset = {}) {
  let composer = null;
  let bloomPass = null;
  let gradePass = null;
  let passes = [];
  let failed = false;
  let disposed = false;

  function directRender() {
    renderer.render(scene, camera);
  }

  function currentSize() {
    const size = renderer.getSize(new THREE.Vector2());
    return { w: Math.max(1, size.x), h: Math.max(1, size.y) };
  }

  function teardown() {
    for (const pass of passes) {
      try {
        pass.dispose?.();
      } catch { /* best effort */ }
    }
    passes = [];
    try {
      composer?.dispose?.();
    } catch { /* best effort */ }
    composer = null;
    bloomPass = null;
    gradePass = null;
  }

  try {
    const { w, h } = currentSize();
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);

    const renderPass = new RenderPass(scene, camera);
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(w, h),
      BLOOM_STRENGTH,
      BLOOM_RADIUS,
      BLOOM_THRESHOLD,
    );
    gradePass = new ShaderPass(GradeShader);
    const outputPass = new OutputPass();

    passes = [renderPass, bloomPass, gradePass, outputPass];
    for (const pass of passes) composer.addPass(pass);

    // Force a first compile now so shader/RT failures surface here and we
    // fall back instead of throwing mid-frame.
    composer.render(0);
  } catch (err) {
    console.warn('[postfx] disabled (composer construction failed):', err?.message ?? err);
    failed = true;
    teardown();
  }

  const fx = {
    /** True when the composer pipeline is live (false = direct fallback). */
    active: !failed,

    /** Render one frame (composer when active, direct render otherwise). */
    render(dt = 0) {
      if (disposed) return;
      if (failed || !composer) {
        directRender();
        return;
      }
      try {
        composer.render(dt);
      } catch (err) {
        // Runtime loss (context, driver): permanently drop to direct render.
        console.warn('[postfx] render failed, falling back to direct render:', err?.message ?? err);
        failed = true;
        fx.active = false;
        teardown();
        directRender();
      }
    },

    /** React to a quality preset change (pixel ratio may have changed). */
    setQuality() {
      if (disposed || failed || !composer) return;
      const { w, h } = currentSize();
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
    },

    /** Resize the composer chain (logical CSS pixels, like renderer.setSize). */
    resize(w, h) {
      if (disposed || failed || !composer) return;
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(Math.max(1, w), Math.max(1, h));
    },

    /**
     * Drive the full-screen flash uniform (0 = off, 1 = solid color).
     * @param {*} color Anything THREE.Color accepts (or null to keep).
     * @param {number} amount 0..1
     */
    setFlash(color, amount) {
      if (disposed || failed || !gradePass) return;
      if (color != null) gradePass.uniforms.uFlashColor.value.set(color);
      gradePass.uniforms.uFlash.value = Math.max(0, Math.min(1, amount ?? 0));
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      fx.active = false;
      teardown();
    },
  };

  // qualityPreset is accepted for future per-preset bloom tuning; current
  // chain is constant apart from size/pixel-ratio (handled above).
  void qualityPreset;

  return fx;
}

export default createPostFx;
