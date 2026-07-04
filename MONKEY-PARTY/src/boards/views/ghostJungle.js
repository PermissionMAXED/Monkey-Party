/**
 * Ghost Jungle board view: gnarled trees, tombstones and lanterns. Four
 * glowing ghost wisps hover over whichever nodes the gj_ghost_fields
 * mechanic currently haunts, gliding to their new fields every round.
 */

import * as THREE from 'three';
import { createBaseView, prop, scatterProps, mechState, kitProp } from '../index.js';

export function buildBoardView(engine, boardDef) {
  const base = createBaseView(engine, boardDef);
  const { group } = base;

  /* --- themed props --------------------------------------------------------------- */
  const props = new THREE.Group();
  props.name = 'props:ghost_jungle';
  group.add(props);

  scatterProps(props, 14, (rand) => prop.tree({
    trunkH: 2.4 + rand() * 1.6,
    crownR: 1.1,
    trunk: 0x3b3244,
    crown: 0x2f4f4f,
    shape: 'sphere',
  }), { rMin: 20, rMax: 27, seed: 91 });
  scatterProps(props, 8, () => prop.box({ w: 0.7, h: 1.1, d: 0.25, color: 0x707a7a }), { rMin: 18.5, rMax: 23, seed: 92 });
  scatterProps(props, 8, () => prop.lamp({ h: 2.2, pole: 0x2f2a3a, glow: 0xaefc4e }), { rMin: 8, rMax: 20, seed: 93 });
  scatterProps(props, 4, () => prop.rock({ r: 0.8, color: 0x4c465a }), { rMin: 19, rMax: 24, seed: 94 });

  base.withKit((kit) => {
    for (const [x, z] of [[0, -19], [15, 8], [-13, 12]]) {
      const shroom = kitProp(kit, 'mushroom');
      if (shroom) {
        shroom.position.set(x, 0.4, z);
        props.add(shroom);
      }
    }
  });

  /* --- mechanic visuals: relocating ghost wisps -------------------------------------- */
  const wisps = [];
  const wispMat = new THREE.MeshStandardMaterial({
    color: 0xd9ccff,
    emissive: 0x8a7fd0,
    emissiveIntensity: 0.9,
    transparent: true,
    opacity: 0.65,
  });
  for (let i = 0; i < 4; i += 1) {
    const wisp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), wispMat);
    body.scale.y = 1.4;
    wisp.add(body);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 8), wispMat);
    tail.rotation.x = Math.PI;
    tail.position.y = -0.8;
    wisp.add(tail);
    wisp.position.set(0, 3 + i, 0);
    wisp.name = `mech:ghost_wisp_${i}`;
    group.add(wisp);
    wisps.push(wisp);
  }

  let time = 0;
  function updateMechanics(state, dt = 0) {
    time += dt;
    base.updateBlocked(state);
    const ghostNodes = mechState(state, boardDef, 'gj_ghost_fields').ghostNodes ?? [];
    wisps.forEach((wisp, i) => {
      const nodeId = ghostNodes[i];
      if (nodeId) {
        const target = base.nodeWorldPos(nodeId);
        target.y += 1.6 + Math.sin(time * 2 + i * 1.7) * 0.25;
        wisp.position.lerp(target, Math.min(1, dt * 2.5 || 0.15));
        wisp.visible = true;
      } else {
        // Pre-match: idle circle around the board center.
        const a = time * 0.5 + (i * Math.PI) / 2;
        wisp.position.set(Math.cos(a) * 6, 3.5 + Math.sin(time + i) * 0.4, Math.sin(a) * 6);
      }
      wisp.rotation.y = time + i;
    });
    wispMat.opacity = 0.5 + (Math.sin(time * 3) + 1) * 0.1;
  }

  return { group, updateMechanics, nodeWorldPos: base.nodeWorldPos, dispose: base.dispose };
}

export default buildBoardView;
