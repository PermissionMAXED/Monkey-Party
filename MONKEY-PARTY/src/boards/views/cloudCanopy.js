/**
 * Cloud Canopy board view: giant trunks below the platforms, drifting
 * cloud puffs, trampoline leaves - and a big wind vane arrow that flips
 * with the announced cc_wind direction while the clouds drift along it.
 */

import * as THREE from 'three';
import { createBaseView, prop, scatterProps, mechState, kitProp } from '../index.js';

export function buildBoardView(engine, boardDef) {
  const base = createBaseView(engine, boardDef);
  const { group } = base;

  /* --- themed props ---------------------------------------------------------- */
  const props = new THREE.Group();
  props.name = 'props:cloud_canopy';
  group.add(props);

  // Supporting giant trunks below the ring.
  scatterProps(props, 10, (rand) => {
    const trunk = prop.column({ r: 0.9, h: 6 + rand() * 3, color: 0x77553a });
    trunk.position.y = -6;
    return trunk;
  }, { rMin: 12, rMax: 17, seed: 61 });

  const clouds = new THREE.Group();
  clouds.name = 'mech:drifting_clouds';
  group.add(clouds);
  scatterProps(clouds, 12, (rand) => prop.blob({ r: 1.6 + rand() * 1.2, color: 0xffffff, flat: 0.5, transparent: true }), { rMin: 8, rMax: 24, seed: 62, y: (r) => 1 + r() * 3 });

  scatterProps(props, 8, () => prop.blob({ r: 1.1, color: 0x8fd07a, flat: 0.35 }), { rMin: 18.5, rMax: 22, seed: 63 });
  scatterProps(props, 6, (rand) => prop.tree({ trunkH: 1.4 + rand(), crownR: 1.2, crown: 0x9fdc8a, shape: 'sphere' }), { rMin: 20, rMax: 26, seed: 64 });

  // Trampoline leaves at the trampoline event fields.
  for (const id of ['cc_m03', 'cc_b05']) {
    const leaf = prop.blob({ r: 1.0, color: 0x5fbf5a, flat: 0.25 });
    leaf.position.copy(base.nodeWorldPos(id)).add(new THREE.Vector3(0, -0.15, 1.4));
    props.add(leaf);
  }

  base.withKit((kit) => {
    for (const [x, y, z] of [[10, 4.5, 14], [-13, 4.2, 9], [3, 4.8, -16]]) {
      const bush = kitProp(kit, 'bush');
      if (bush) {
        bush.position.set(x, y, z);
        props.add(bush);
      }
    }
  });

  /* --- mechanic visuals: wind vane + cloud drift -------------------------------- */
  const vane = new THREE.Group();
  vane.name = 'mech:wind_vane';
  const arrow = prop.cone({ r: 0.5, h: 1.6, color: 0xffb6c1 });
  arrow.rotation.x = Math.PI / 2; // point along +z, rotated by vane
  arrow.position.y = 0;
  vane.add(arrow);
  const pole = prop.column({ r: 0.12, h: 3, color: 0xd9e8f5 });
  pole.position.y = -3;
  vane.add(pole);
  vane.position.set(0, 10.5, 0);
  group.add(vane);

  let time = 0;
  let vaneTarget = 0;
  function updateMechanics(state, dt = 0) {
    time += dt;
    base.updateBlocked(state);
    const dir = mechState(state, boardDef, 'cc_wind').dir ?? 1;
    vaneTarget = dir > 0 ? 0 : Math.PI; // forward = with the path, back = against
    vane.rotation.y += (vaneTarget - vane.rotation.y) * Math.min(1, dt * 3 || 0.2);
    // Clouds drift around the board in the wind direction.
    clouds.rotation.y += (dt || 0.016) * 0.08 * dir;
    clouds.children.forEach((puff, i) => {
      puff.position.y += Math.sin(time * 0.8 + i * 2.1) * 0.002;
    });
  }

  return { group, updateMechanics, nodeWorldPos: base.nodeWorldPos, dispose: base.dispose };
}

export default buildBoardView;
