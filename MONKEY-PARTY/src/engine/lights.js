/**
 * Scene lighting + atmosphere for MONKEY-PARTY boards and minigames.
 *
 * setupLights(scene, theme) wires a hemisphere light, a shadow-casting
 * directional "sun", a soft ambient fill, sky background, and fog, all driven
 * by the BoardDef theme shape: { sky, fog, ambient }.
 */

import * as THREE from 'three';

const DEFAULT_THEME = {
  sky: '#7ec8e3',
  fog: '#9fd6c2',
  ambient: '#405a4a',
};

/**
 * @param {THREE.Scene} scene
 * @param {{ sky?: *, fog?: *, ambient?: * }} [theme] Board theme colors.
 * @param {{ shadowMapSize?: number }} [quality] Optional quality preset
 *   (see src/engine/quality.js) for shadow map sizing.
 * @returns {{
 *   hemi: THREE.HemisphereLight,
 *   sun: THREE.DirectionalLight,
 *   ambient: THREE.AmbientLight,
 *   setTheme: (theme: Object) => void,
 *   dispose: () => void,
 * }}
 */
export function setupLights(scene, theme = {}, quality = {}) {
  const shadowMapSize = quality.shadowMapSize ?? 1024;

  const hemi = new THREE.HemisphereLight('#ffffff', '#334422', 0.85);
  hemi.position.set(0, 40, 0);

  const ambient = new THREE.AmbientLight('#ffffff', 0.25);

  const sun = new THREE.DirectionalLight('#fff6e0', 2.2);
  sun.position.set(14, 24, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 80;
  sun.shadow.camera.left = -28;
  sun.shadow.camera.right = 28;
  sun.shadow.camera.top = 28;
  sun.shadow.camera.bottom = -28;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;

  function setTheme(next = {}) {
    const t = { ...DEFAULT_THEME, ...next };
    const skyColor = new THREE.Color(t.sky);
    const fogColor = new THREE.Color(t.fog ?? t.sky);
    const ambientColor = new THREE.Color(t.ambient);

    scene.background = skyColor;
    scene.fog = new THREE.Fog(fogColor, 25, 110);

    hemi.color.copy(skyColor).lerp(new THREE.Color('#ffffff'), 0.4);
    hemi.groundColor.copy(ambientColor);
    ambient.color.copy(ambientColor).lerp(new THREE.Color('#ffffff'), 0.5);
  }

  setTheme(theme);
  scene.add(hemi, ambient, sun, sun.target);

  function dispose() {
    scene.remove(hemi, ambient, sun, sun.target);
    if (sun.shadow.map) {
      sun.shadow.map.dispose();
      sun.shadow.map = null;
    }
    scene.fog = null;
    scene.background = null;
  }

  return { hemi, sun, ambient, setTheme, dispose };
}
