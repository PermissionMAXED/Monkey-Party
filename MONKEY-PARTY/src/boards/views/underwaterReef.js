/**
 * Underwater Reef board view: coral clusters, kelp, air-bubble streams -
 * and a translucent water surface that rises/falls with the
 * ur_water_level mechanic, tinting whichever zone is closed off.
 */

import * as THREE from 'three';
import { createBaseView, prop, scatterProps, mechState, kitProp } from '../index.js';

export function buildBoardView(engine, boardDef) {
  const base = createBaseView(engine, boardDef);
  const { group } = base;

  /* --- themed props ------------------------------------------------------------- */
  const props = new THREE.Group();
  props.name = 'props:underwater_reef';
  group.add(props);

  const CORAL = [0xff7f50, 0xff5aa0, 0xf5a623, 0x3ecf8e];
  scatterProps(props, 14, (rand, i) => prop.crystal({
    h: 1 + rand() * 1.2,
    color: CORAL[i % CORAL.length],
    emissive: 0x11202a,
  }), { rMin: 19, rMax: 26, seed: 71 });
  scatterProps(props, 10, (rand) => {
    const kelp = prop.column({ r: 0.12, h: 3 + rand() * 3, color: 0x2e7d4f });
    kelp.rotation.z = (rand() - 0.5) * 0.3;
    return kelp;
  }, { rMin: 18.5, rMax: 24, seed: 72 });
  scatterProps(props, 8, () => prop.rock({ r: 0.9, color: 0x54707a }), { rMin: 20, rMax: 27, seed: 73 });

  // Air-bubble streams at the bubble garden.
  const bubbles = new THREE.Group();
  bubbles.name = 'mech:bubbles';
  const bubbleGeo = new THREE.SphereGeometry(0.16, 6, 5);
  const bubbleMat = new THREE.MeshStandardMaterial({ color: 0xcfefff, transparent: true, opacity: 0.55 });
  const anchor = base.nodeWorldPos('ur_g01');
  for (let i = 0; i < 9; i += 1) {
    const b = new THREE.Mesh(bubbleGeo, bubbleMat);
    b.position.set(anchor.x + (i % 3 - 1) * 0.5, anchor.y + (i * 0.7) % 4, anchor.z + (Math.floor(i / 3) - 1) * 0.5);
    bubbles.add(b);
  }
  group.add(bubbles);

  base.withKit((kit) => {
    for (const [x, z] of [[0, 0], [-16, 8], [14, -12]]) {
      const tentacle = kitProp(kit, 'tentacle');
      if (tentacle) {
        tentacle.position.set(x, -1.5, z);
        props.add(tentacle);
      }
    }
  });

  /* --- mechanic visuals: shifting water surface ------------------------------------ */
  const surface = new THREE.Mesh(
    new THREE.CylinderGeometry(27, 27, 0.15, 48),
    new THREE.MeshStandardMaterial({ color: 0x2d86c4, transparent: true, opacity: 0.35 }),
  );
  surface.name = 'mech:water_surface';
  surface.position.y = 6.5;
  group.add(surface);
  const SURFACE_HIGH = 6.5; // trench blocked (too deep/dark below)
  const SURFACE_LOW = 2.6; // shelf blocked (exposed above the surface)

  let time = 0;
  function updateMechanics(state, dt = 0) {
    time += dt;
    base.updateBlocked(state);
    const high = mechState(state, boardDef, 'ur_water_level').high ?? true;
    const target = high ? SURFACE_HIGH : SURFACE_LOW;
    surface.position.y += (target - surface.position.y) * Math.min(1, dt * 1.5 || 0.15);
    bubbles.children.forEach((b, i) => {
      b.position.y += (dt || 0.016) * (0.8 + (i % 3) * 0.3);
      if (b.position.y > anchor.y + 4.5) b.position.y = anchor.y;
    });
    surface.rotation.y = time * 0.05;
  }

  return { group, updateMechanics, nodeWorldPos: base.nodeWorldPos, dispose: base.dispose };
}

export default buildBoardView;
