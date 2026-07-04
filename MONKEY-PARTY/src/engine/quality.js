/**
 * Render-quality presets for MONKEY-PARTY.
 *
 * Maps the settings-store quality level ('low' | 'med' | 'high') to concrete
 * renderer knobs: shadow map size, device pixel ratio cap, and the particle
 * budget consumed by src/engine/particles.js.
 */

export const QUALITY_LEVELS = ['low', 'med', 'high'];

export const QUALITY_PRESETS = Object.freeze({
  low: Object.freeze({
    id: 'low',
    shadows: false,
    shadowMapSize: 512,
    pixelRatioCap: 1,
    particleBudget: 400,
    antialias: false,
    anisotropy: 1,
  }),
  med: Object.freeze({
    id: 'med',
    shadows: true,
    shadowMapSize: 1024,
    pixelRatioCap: 1.5,
    particleBudget: 1500,
    antialias: true,
    anisotropy: 2,
  }),
  high: Object.freeze({
    id: 'high',
    shadows: true,
    shadowMapSize: 2048,
    pixelRatioCap: 2,
    particleBudget: 4000,
    antialias: true,
    anisotropy: 4,
  }),
});

/**
 * Resolve a quality level (string) or partial preset object to a full preset.
 * Unknown values fall back to 'med'.
 *
 * @param {string|Object} q Quality level id or preset-like object.
 * @returns {Object} A full quality preset (frozen for the built-ins).
 */
export function getQuality(q) {
  if (q && typeof q === 'object') {
    return { ...QUALITY_PRESETS.med, ...q };
  }
  return QUALITY_PRESETS[q] ?? QUALITY_PRESETS.med;
}
