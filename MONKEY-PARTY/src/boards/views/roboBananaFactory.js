/**
 * Robo Banana Factory board view: pipes, vats, chimneys and crusher
 * pistons. The conveyor belt under the rf_conveyor nodes scrolls with
 * animated chevrons so the auto-move direction is always visible.
 */

import * as THREE from 'three';
import { createBaseView, prop, scatterProps, mechState, kitProp } from '../index.js';

export function buildBoardView(engine, boardDef) {
  const base = createBaseView(engine, boardDef);
  const { group } = base;

  /* --- themed props --------------------------------------------------------------------- */
  const props = new THREE.Group();
  props.name = 'props:robo_banana_factory';
  group.add(props);

  scatterProps(props, 10, (rand) => {
    const chimney = prop.column({ r: 0.5, h: 4 + rand() * 3, color: 0x6a7077 });
    return chimney;
  }, { rMin: 20, rMax: 27, seed: 111 });
  scatterProps(props, 8, (rand) => prop.box({ w: 2 + rand(), h: 2.4, d: 2 + rand(), color: 0x4c5259 }), { rMin: 21, rMax: 26, seed: 112 });
  scatterProps(props, 8, () => prop.crystal({ h: 0.9, color: 0xf5a623, emissive: 0x332200 }), { rMin: 18.5, rMax: 22, seed: 113 });
  scatterProps(props, 6, () => prop.lamp({ h: 2.8, pole: 0x3a3f45, glow: 0x3ecf8e }), { rMin: 7, rMax: 15, seed: 114 });

  // Banana mash vat under the catwalk.
  const vat = new THREE.Mesh(
    new THREE.CylinderGeometry(3.4, 3.4, 2.2, 20),
    new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.5, metalness: 0.5 }),
  );
  vat.position.set(-5, 1.1, 5.5);
  props.add(vat);
  const mash = prop.blob({ r: 3.1, color: 0xffe135, flat: 0.12 });
  mash.position.set(-5, 2.15, 5.5);
  props.add(mash);

  // Crusher pistons over the crusher event fields.
  const crushers = [];
  for (const id of ['rf_a02', 'rf_a05']) {
    const piston = prop.box({ w: 1.6, h: 1.2, d: 1.6, color: 0xe5484d });
    const pos = base.nodeWorldPos(id);
    piston.position.set(pos.x, pos.y + 2.6, pos.z);
    piston.userData.homeY = pos.y + 2.6;
    piston.userData.lowY = pos.y + 0.9;
    group.add(piston);
    crushers.push(piston);
  }

  base.withKit((kit) => {
    for (const [x, y, z] of [[6, 1.2, 6], [-9, 1.4, -8], [12, 1.0, -4]]) {
      const gear = kitProp(kit, 'gear');
      if (gear) {
        gear.position.set(x, y, z);
        props.add(gear);
      }
    }
  });

  /* --- mechanic visuals: scrolling conveyor chevrons -------------------------------------- */
  const beltIds = boardDef.mechanics.find((m) => m.id === 'rf_conveyor')?.initialState?.belt ?? [];
  const chevrons = new THREE.Group();
  chevrons.name = 'mech:conveyor_chevrons';
  const chevMat = new THREE.MeshStandardMaterial({ color: 0xf5a623, emissive: 0x442d00, emissiveIntensity: 0.7 });
  const beltPts = beltIds.map((id) => base.nodeWorldPos(id));
  for (let i = 0; i < beltPts.length - 1; i += 1) {
    const chev = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 4), chevMat);
    chev.userData.a = beltPts[i];
    chev.userData.b = beltPts[i + 1];
    chev.userData.phase = i / Math.max(1, beltPts.length - 1);
    chevrons.add(chev);
  }
  group.add(chevrons);

  let time = 0;
  function updateMechanics(state, dt = 0) {
    time += dt;
    base.updateBlocked(state);
    // Chevrons slide from node to node, always signalling "forward +2".
    const t = (time * 0.6) % 1;
    for (const chev of chevrons.children) {
      const { a, b } = chev.userData;
      const k = (t + chev.userData.phase) % 1;
      chev.position.lerpVectors(a, b, k);
      chev.position.y += 0.55;
      const dir = new THREE.Vector3().subVectors(b, a).normalize();
      chev.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    }
    // Crushers slam on a steady factory rhythm.
    crushers.forEach((piston, i) => {
      const cycle = (Math.sin(time * 2.2 + i * 1.6) + 1) / 2;
      piston.position.y = piston.userData.lowY + (piston.userData.homeY - piston.userData.lowY) * cycle;
    });
    // A d8 overclock round makes the whole belt glow hotter.
    const moved = mechState(state, boardDef, 'rf_conveyor').moved ?? [];
    chevMat.emissiveIntensity = 0.7 + (moved.length > 0 ? 0.5 : 0) + Math.sin(time * 4) * 0.1;
  }

  return { group, updateMechanics, nodeWorldPos: base.nodeWorldPos, dispose: base.dispose };
}

export default buildBoardView;
