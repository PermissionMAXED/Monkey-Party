/**
 * Volcano Island board view: a glowing lava pool in the caldera that
 * visibly rises with the vi_lava_rise mechanic level, plus basalt rocks,
 * obsidian shards and scorched trees.
 */

import * as THREE from 'three';
import { createBaseView, prop, scatterProps, mechState, kitProp } from '../index.js';

export function buildBoardView(engine, boardDef) {
  const base = createBaseView(engine, boardDef);
  const { group } = base;

  /* --- themed props --------------------------------------------------- */
  const props = new THREE.Group();
  props.name = 'props:volcano_island';
  group.add(props);

  scatterProps(props, 12, (rand) => prop.rock({ r: 0.7 + rand() * 0.5, color: 0x3d3a38 }), { rMin: 20, rMax: 26, seed: 21 });
  scatterProps(props, 8, (rand) => prop.crystal({ h: 1 + rand(), color: 0x1c1a1f, emissive: 0x330000 }), { rMin: 19, rMax: 24, seed: 22 });
  scatterProps(props, 8, (rand) => prop.tree({
    trunkH: 1.6 + rand(),
    crownR: 0.5,
    trunk: 0x2f2620,
    crown: 0x4a3428,
    shape: 'cone',
  }), { rMin: 21, rMax: 27, seed: 23 });
  scatterProps(props, 6, () => prop.cone({ r: 0.5, h: 1.2, color: 0x5c3a2e }), { rMin: 6, rMax: 10, seed: 24 });

  // Volcano cone centerpiece.
  const cone = prop.cone({ r: 5.5, h: 7.5, color: 0x4a3428 });
  cone.position.set(0, -0.5, 0);
  props.add(cone);
  const glow = prop.blob({ r: 1.6, color: 0xff5a1f, flat: 0.4, transparent: true });
  glow.position.set(0, 6.6, 0);
  props.add(glow);

  base.withKit((kit) => {
    for (const [x, z] of [[16, -8], [-15, 10], [4, 18]]) {
      const torch = kitProp(kit, 'torch');
      if (torch) {
        torch.position.set(x, 0.6, z);
        props.add(torch);
      }
    }
  });

  /* --- mechanic visuals: rising lava pool ------------------------------- */
  const lavaGeo = new THREE.CylinderGeometry(14.5, 14.5, 0.3, 40);
  const lavaMat = new THREE.MeshStandardMaterial({
    color: 0xff4500,
    emissive: 0xcc2200,
    emissiveIntensity: 0.9,
    transparent: true,
    opacity: 0.85,
  });
  const lava = new THREE.Mesh(lavaGeo, lavaMat);
  lava.name = 'mech:lava_pool';
  lava.position.y = -1.6;
  group.add(lava);
  const LAVA_Y_BY_LEVEL = [-1.6, -0.4, 0.15, 0.7];

  let time = 0;
  function updateMechanics(state, dt = 0) {
    time += dt;
    base.updateBlocked(state);
    const level = mechState(state, boardDef, 'vi_lava_rise').level ?? 0;
    const target = LAVA_Y_BY_LEVEL[Math.max(0, Math.min(3, level))];
    lava.position.y += (target - lava.position.y) * Math.min(1, dt * 2 || 0.2);
    lavaMat.emissiveIntensity = 0.8 + Math.sin(time * 3) * 0.2 + level * 0.15;
    glow.scale.setScalar(1 + Math.sin(time * 2.2) * 0.12);
  }

  return { group, updateMechanics, nodeWorldPos: base.nodeWorldPos, dispose: base.dispose };
}

export default buildBoardView;
