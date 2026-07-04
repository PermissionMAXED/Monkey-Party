/**
 * Pooled GPU particle system (one THREE.Points draw call) for MONKEY-PARTY.
 *
 * createParticles(scene, quality) allocates a fixed pool sized by the quality
 * preset's particleBudget and returns:
 *   - burst(spec | presetName, overrides?) - one-shot spawn
 *   - emitter(spec) -> { stop, setPos } - continuous spawner
 *   - update(dt) - integrate + upload (call every frame)
 *   - dispose()
 *
 * Burst/emitter spec fields: { pos, count, color (or colors: []), spread,
 * up, gravity, life, size, rate (emitters only) }.
 * Presets: confetti, coinSparkle, dust, splash, lavaEmber, snow, ghostWisp,
 * bananaBits (see PARTICLE_PRESETS).
 */

import * as THREE from 'three';
import { getQuality } from './quality.js';

export const PARTICLE_PRESETS = {
  confetti: {
    count: 60,
    colors: ['#ff5252', '#ffd740', '#69f0ae', '#40c4ff', '#e040fb'],
    spread: 4.5,
    up: 5,
    gravity: -7,
    life: 1.6,
    size: 0.14,
  },
  coinSparkle: {
    count: 18,
    colors: ['#ffd54f', '#fff59d', '#ffe082'],
    spread: 1.4,
    up: 2.2,
    gravity: -2.5,
    life: 0.7,
    size: 0.1,
  },
  dust: {
    count: 12,
    colors: ['#c8b89a', '#b0a088'],
    spread: 1.2,
    up: 0.8,
    gravity: 0.4,
    life: 0.9,
    size: 0.2,
  },
  splash: {
    count: 30,
    colors: ['#7fd4ff', '#c9efff', '#4fb3e8'],
    spread: 2.4,
    up: 4,
    gravity: -9,
    life: 0.8,
    size: 0.11,
  },
  lavaEmber: {
    count: 16,
    colors: ['#ff7043', '#ffab40', '#ff3d00'],
    spread: 0.9,
    up: 2.6,
    gravity: 1.2,
    life: 1.4,
    size: 0.12,
  },
  snow: {
    count: 40,
    colors: ['#ffffff', '#e3f2fd'],
    spread: 1.6,
    up: -0.4,
    gravity: -0.9,
    life: 3.5,
    size: 0.1,
  },
  ghostWisp: {
    count: 14,
    colors: ['#b2fff0', '#80deea', '#e0f7fa'],
    spread: 0.7,
    up: 1.4,
    gravity: 0.6,
    life: 1.8,
    size: 0.18,
  },
  bananaBits: {
    count: 22,
    colors: ['#ffe135', '#fff176', '#d4b02a'],
    spread: 3,
    up: 3.5,
    gravity: -8,
    life: 1.1,
    size: 0.12,
  },
};

const VERT = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aAlpha;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (280.0 / max(0.1, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.32, d) * vAlpha;
    if (a < 0.02) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

/**
 * @param {THREE.Scene} scene
 * @param {string|Object} [quality] Quality level id or preset (particleBudget).
 */
export function createParticles(scene, quality = 'med') {
  const budget = getQuality(quality).particleBudget;

  const positions = new Float32Array(budget * 3);
  const colors = new Float32Array(budget * 3);
  const sizes = new Float32Array(budget);
  const alphas = new Float32Array(budget);
  const velocities = new Float32Array(budget * 3);
  const gravities = new Float32Array(budget);
  const lives = new Float32Array(budget);
  const maxLives = new Float32Array(budget);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setDrawRange(0, 0);

  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.name = 'particles';
  scene.add(points);

  let active = 0;
  const tmpColor = new THREE.Color();

  function spawnOne(spec, px, py, pz) {
    let i;
    if (active < budget) {
      i = active;
      active += 1;
    } else {
      i = Math.floor(Math.random() * budget); // Pool full: recycle randomly.
    }
    const i3 = i * 3;

    positions[i3] = px + (Math.random() - 0.5) * (spec.jitter ?? 0.25);
    positions[i3 + 1] = py + (Math.random() - 0.5) * (spec.jitter ?? 0.25);
    positions[i3 + 2] = pz + (Math.random() - 0.5) * (spec.jitter ?? 0.25);

    const spread = spec.spread ?? 2;
    velocities[i3] = (Math.random() - 0.5) * spread;
    velocities[i3 + 1] = (spec.up ?? 2) * (0.6 + Math.random() * 0.6);
    velocities[i3 + 2] = (Math.random() - 0.5) * spread;

    const colorList = spec.colors;
    tmpColor.set(colorList ? colorList[Math.floor(Math.random() * colorList.length)] : (spec.color ?? '#ffffff'));
    colors[i3] = tmpColor.r;
    colors[i3 + 1] = tmpColor.g;
    colors[i3 + 2] = tmpColor.b;

    sizes[i] = (spec.size ?? 0.12) * (0.7 + Math.random() * 0.6);
    gravities[i] = spec.gravity ?? -9.8;
    maxLives[i] = (spec.life ?? 1) * (0.75 + Math.random() * 0.5);
    lives[i] = maxLives[i];
    alphas[i] = 1;
  }

  function resolveSpec(specOrName, overrides) {
    const base = typeof specOrName === 'string'
      ? PARTICLE_PRESETS[specOrName] ?? {}
      : specOrName ?? {};
    return overrides ? { ...base, ...overrides } : { ...base };
  }

  /**
   * One-shot burst. Either burst({ pos, count, color, ... }) or
   * burst('confetti', { pos }).
   */
  function burst(specOrName, overrides) {
    const spec = resolveSpec(specOrName, overrides);
    const p = spec.pos ?? { x: 0, y: 0, z: 0 };
    const px = p.x ?? p[0] ?? 0;
    const py = p.y ?? p[1] ?? 0;
    const pz = p.z ?? p[2] ?? 0;
    const count = spec.count ?? 20;
    for (let n = 0; n < count; n += 1) spawnOne(spec, px, py, pz);
  }

  const emitters = new Set();

  /**
   * Continuous emitter: spec = burst spec + { rate: particles/sec }.
   * @returns {{ stop: () => void, setPos: (pos: *) => void }}
   */
  function emitter(specOrName, overrides) {
    const spec = resolveSpec(specOrName, overrides);
    const state = { spec, accum: 0, rate: spec.rate ?? 20 };
    emitters.add(state);
    return {
      stop: () => emitters.delete(state),
      setPos: (pos) => {
        state.spec.pos = pos;
      },
    };
  }

  /** Integrate particles + emitters; call once per frame. */
  function update(dt) {
    if (!(dt > 0)) return;

    for (const em of emitters) {
      em.accum += em.rate * dt;
      const n = Math.floor(em.accum);
      if (n > 0) {
        em.accum -= n;
        const p = em.spec.pos ?? { x: 0, y: 0, z: 0 };
        for (let k = 0; k < n; k += 1) {
          spawnOne(em.spec, p.x ?? p[0] ?? 0, p.y ?? p[1] ?? 0, p.z ?? p[2] ?? 0);
        }
      }
    }

    let i = 0;
    while (i < active) {
      lives[i] -= dt;
      if (lives[i] <= 0) {
        // Swap-remove with the last active particle.
        active -= 1;
        const j = active;
        if (i !== j) {
          const i3 = i * 3;
          const j3 = j * 3;
          for (let c = 0; c < 3; c += 1) {
            positions[i3 + c] = positions[j3 + c];
            velocities[i3 + c] = velocities[j3 + c];
            colors[i3 + c] = colors[j3 + c];
          }
          sizes[i] = sizes[j];
          gravities[i] = gravities[j];
          lives[i] = lives[j];
          maxLives[i] = maxLives[j];
          alphas[i] = alphas[j];
        }
        continue; // Re-process index i (now holds the swapped particle).
      }
      const i3 = i * 3;
      velocities[i3 + 1] += gravities[i] * dt;
      positions[i3] += velocities[i3] * dt;
      positions[i3 + 1] += velocities[i3 + 1] * dt;
      positions[i3 + 2] += velocities[i3 + 2] * dt;
      const k = lives[i] / maxLives[i];
      alphas[i] = k < 0.35 ? k / 0.35 : 1;
      i += 1;
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.aColor.needsUpdate = true;
    geometry.attributes.aSize.needsUpdate = true;
    geometry.attributes.aAlpha.needsUpdate = true;
    geometry.setDrawRange(0, active);
  }

  function dispose() {
    emitters.clear();
    scene.remove(points);
    geometry.dispose();
    material.dispose();
  }

  return {
    burst,
    emitter,
    update,
    dispose,
    presets: PARTICLE_PRESETS,
    activeCount: () => active,
    budget,
  };
}
