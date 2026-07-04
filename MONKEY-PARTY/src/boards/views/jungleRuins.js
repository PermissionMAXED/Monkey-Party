/**
 * Jungle Ruins board view: mossy stone, palms, and a rope bridge that
 * visibly sags and drops its planks while the collapsing-bridge mechanic
 * has it blocked.
 */

import * as THREE from 'three';
import { createBaseView, prop, scatterProps, mechState, kitProp } from '../index.js';

export function buildBoardView(engine, boardDef) {
  const base = createBaseView(engine, boardDef);
  const { group } = base;

  /* --- themed props (>=30, primitive fallbacks) --------------------- */
  const props = new THREE.Group();
  props.name = 'props:jungle_ruins';
  group.add(props);

  scatterProps(props, 18, (rand) => prop.tree({
    trunkH: 2 + rand() * 1.6,
    crownR: 1 + rand() * 0.8,
    crown: rand() < 0.5 ? 0x2e8b57 : 0x3aa06b,
  }), { rMin: 20, rMax: 27, seed: 11 });
  scatterProps(props, 8, () => prop.rock({ r: 0.6, color: 0x7d8471 }), { rMin: 19, rMax: 24, seed: 12 });
  scatterProps(props, 6, (rand) => prop.column({ r: 0.35, h: 1.6 + rand() * 1.8, color: 0xb9ac8a }), { rMin: 8, rMax: 14, seed: 13 });

  // Ruined temple gate at the plateau.
  const gate = new THREE.Group();
  gate.add(prop.column({ r: 0.45, h: 3.4, color: 0xcabf9d }));
  const gr = prop.column({ r: 0.45, h: 3.4, color: 0xcabf9d });
  gr.position.x = 2.4;
  gate.add(gr);
  const lintel = prop.box({ w: 3.6, h: 0.6, d: 1.1, color: 0xb5aa88 });
  lintel.position.set(1.2, 3.4, 0);
  gate.add(lintel);
  gate.position.set(0.5, 4.8, -6.0);
  props.add(gate);

  // Golden idol near the star spawn on the ring.
  const idol = prop.crystal({ h: 1.6, color: 0xffd23f, emissive: 0x8a6d00 });
  idol.position.copy(base.nodeWorldPos('jr_m08')).add(new THREE.Vector3(0, 0.4, -1.6));
  props.add(idol);

  // Optional engine-kit upgrade: swap in fancier jungle props when present.
  base.withKit((kit) => {
    for (const [name, pos] of [
      ['palm', [12, 0.5, 20]],
      ['statue', [-14, 0.5, 18]],
      ['torch', [18, 0.5, -12]],
    ]) {
      const obj = kitProp(kit, name);
      if (obj) {
        obj.position.set(pos[0], pos[1], pos[2]);
        props.add(obj);
      }
    }
  });

  /* --- mechanic visuals: collapsing rope bridge ---------------------- */
  const mech = boardDef.mechanics.find((m) => m.id === 'jr_collapsing_bridge');
  const bridgeIds = mech?.initialState?.bridge ?? [];
  const planks = new THREE.Group();
  planks.name = 'mech:bridge_planks';
  const plankGeo = new THREE.BoxGeometry(1.6, 0.12, 0.9);
  const plankMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 1 });
  const plankHome = [];
  for (const id of bridgeIds) {
    const plank = new THREE.Mesh(plankGeo, plankMat);
    plank.position.copy(base.nodeWorldPos(id)).add(new THREE.Vector3(0, -0.25, 0));
    planks.add(plank);
    plankHome.push(plank.position.y);
  }
  group.add(planks);

  let time = 0;
  function updateMechanics(state, dt = 0) {
    time += dt;
    base.updateBlocked(state);
    const collapsed = !!mechState(state, boardDef, 'jr_collapsing_bridge').collapsed;
    planks.children.forEach((plank, i) => {
      const target = collapsed ? plankHome[i] - 1.4 : plankHome[i];
      plank.position.y += (target - plank.position.y) * Math.min(1, dt * 3 || 0.2);
      const wobble = collapsed ? 0.35 : 0.03;
      plank.rotation.z = Math.sin(time * 2 + i * 1.3) * wobble;
    });
  }

  return { group, updateMechanics, nodeWorldPos: base.nodeWorldPos, dispose: base.dispose };
}

export default buildBoardView;
