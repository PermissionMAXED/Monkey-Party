/**
 * Pirate Lagoon board view: a water plane that rises over the sandbank on
 * high tide (pl_tide mechanic), a beached galleon hull, palms, barrels and
 * cannons.
 */

import * as THREE from 'three';
import { createBaseView, prop, scatterProps, mechState, kitProp } from '../index.js';

export function buildBoardView(engine, boardDef) {
  const base = createBaseView(engine, boardDef);
  const { group } = base;

  /* --- themed props ------------------------------------------------------ */
  const props = new THREE.Group();
  props.name = 'props:pirate_lagoon';
  group.add(props);

  scatterProps(props, 12, (rand) => prop.tree({
    trunkH: 2.4 + rand() * 1.2,
    crownR: 1.1,
    trunk: 0x9a7b4f,
    crown: 0x3aa06b,
    shape: 'sphere',
  }), { rMin: 20, rMax: 27, seed: 41 });
  scatterProps(props, 8, () => prop.box({ w: 0.8, h: 1.0, d: 0.8, color: 0x7a5230 }), { rMin: 18.5, rMax: 22, seed: 42 });
  scatterProps(props, 6, () => prop.rock({ r: 0.8, color: 0xb8a888 }), { rMin: 19, rMax: 25, seed: 43 });
  scatterProps(props, 5, () => prop.cone({ r: 0.4, h: 0.9, color: 0xc2a878 }), { rMin: 5, rMax: 9, seed: 44 });

  // Galleon hull under the ship loop.
  const hull = prop.box({ w: 9, h: 2.2, d: 3.4, color: 0x5c3a24 });
  hull.position.set(1.5, 0.6, -6.5);
  props.add(hull);
  const mast = prop.column({ r: 0.18, h: 7, color: 0x6e4a2e });
  mast.position.set(1.5, 2.8, -6.5);
  props.add(mast);
  // Two cannons flanking the cannon-travel fields.
  for (const id of ['pl_s04', 'pl_v02']) {
    const cannon = prop.cone({ r: 0.35, h: 1.5, color: 0x2f2f33 });
    cannon.rotation.z = Math.PI / 3;
    cannon.position.copy(base.nodeWorldPos(id)).add(new THREE.Vector3(0.9, 0.4, 0));
    props.add(cannon);
  }

  base.withKit((kit) => {
    const chest = kitProp(kit, 'chest');
    if (chest) {
      chest.position.set(1.5, 2.9, -6.5);
      props.add(chest);
    }
    const tentacle = kitProp(kit, 'tentacle');
    if (tentacle) {
      tentacle.position.set(-8, -0.4, -10);
      props.add(tentacle);
    }
  });

  /* --- mechanic visuals: tide water plane ---------------------------------- */
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(26, 26, 0.2, 48),
    new THREE.MeshStandardMaterial({ color: 0x1e6f9f, transparent: true, opacity: 0.55 }),
  );
  water.name = 'mech:tide_water';
  water.position.y = -0.9;
  group.add(water);
  const TIDE_LOW = -0.9;
  const TIDE_HIGH = 0.35; // above the sandbank discs (y ~= 0.1)

  let time = 0;
  function updateMechanics(state, dt = 0) {
    time += dt;
    base.updateBlocked(state);
    const highTide = !!mechState(state, boardDef, 'pl_tide').highTide;
    const target = highTide ? TIDE_HIGH : TIDE_LOW;
    water.position.y += (target - water.position.y) * Math.min(1, dt * 1.5 || 0.15);
    water.position.y += Math.sin(time * 1.4) * 0.004;
  }

  return { group, updateMechanics, nodeWorldPos: base.nodeWorldPos, dispose: base.dispose };
}

export default buildBoardView;
