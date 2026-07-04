/**
 * Shared material cache for MONKEY-PARTY's flat-shaded low-poly look.
 *
 * mat(color, opts) returns a cached MeshStandardMaterial so identical
 * color/param combos share one GPU program + uniform set across all props.
 * Do NOT mutate or dispose returned materials directly; use
 * clearMaterialCache() on full teardown.
 */

import * as THREE from 'three';

/** @type {Map<string, THREE.MeshStandardMaterial>} */
const cache = new Map();

/**
 * Get (or create) a shared flat-shaded standard material.
 *
 * @param {string|number} color CSS color string or hex number.
 * @param {{
 *   flat?: boolean,       Flat shading (default true - low-poly look).
 *   metal?: number,       Metalness 0..1 (default 0).
 *   rough?: number,       Roughness 0..1 (default 0.85).
 *   emissive?: string|number|null, Emissive color (default none).
 *   emissiveIntensity?: number,
 *   transparent?: boolean,
 *   opacity?: number,
 *   side?: number,        THREE side constant (default FrontSide).
 * }} [opts]
 * @returns {THREE.MeshStandardMaterial}
 */
export function mat(color = '#ffffff', opts = {}) {
  const {
    flat = true,
    metal = 0,
    rough = 0.85,
    emissive = null,
    emissiveIntensity = 1,
    transparent = false,
    opacity = 1,
    side = THREE.FrontSide,
  } = opts;

  const key = [
    typeof color === 'number' ? color.toString(16) : String(color),
    flat ? 'f' : 's',
    metal,
    rough,
    emissive == null ? '-' : (typeof emissive === 'number' ? emissive.toString(16) : String(emissive)),
    emissiveIntensity,
    transparent ? `t${opacity}` : 'o',
    side,
  ].join('|');

  let material = cache.get(key);
  if (!material) {
    material = new THREE.MeshStandardMaterial({
      color,
      flatShading: flat,
      metalness: metal,
      roughness: rough,
      transparent,
      opacity,
      side,
    });
    if (emissive != null) {
      material.emissive = new THREE.Color(emissive);
      material.emissiveIntensity = emissiveIntensity;
    }
    cache.set(key, material);
  }
  return material;
}

/** Number of cached materials (for debugging / tests). */
export function materialCacheSize() {
  return cache.size;
}

/** Dispose every cached material and empty the cache. */
export function clearMaterialCache() {
  for (const material of cache.values()) material.dispose();
  cache.clear();
}
