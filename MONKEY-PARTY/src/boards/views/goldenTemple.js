/**
 * Golden Temple board view: a tiered ziggurat with three stairway ramps.
 * The gt_rotating_stairs mechanic highlights the open stairway (bright
 * gold) and dims/sinks glyph gates over the two blocked ones.
 */

import * as THREE from 'three';
import { createBaseView, prop, scatterProps, mechState, kitProp } from '../index.js';

export function buildBoardView(engine, boardDef) {
  const base = createBaseView(engine, boardDef);
  const { group } = base;

  /* --- themed props -------------------------------------------------------- */
  const props = new THREE.Group();
  props.name = 'props:golden_temple';
  group.add(props);

  // Ziggurat tiers under the terrace/top loops.
  const tierMat = [0xd8c690, 0xcdb977, 0xc2a95e];
  [12.5, 7.5, 3.2].forEach((r, i) => {
    const tier = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r + 1.2, 2.6, 8),
      new THREE.MeshStandardMaterial({ color: tierMat[i], roughness: 0.8 }),
    );
    tier.position.y = i * 2.9 + 0.4;
    props.add(tier);
  });

  scatterProps(props, 10, (rand) => prop.column({ r: 0.4, h: 2.4 + rand() * 1.4, color: 0xd9c893 }), { rMin: 19, rMax: 24, seed: 51 });
  scatterProps(props, 10, (rand) => prop.tree({ trunkH: 2 + rand(), crownR: 1, crown: 0x6b8f3d }), { rMin: 21, rMax: 27, seed: 52 });
  scatterProps(props, 6, () => prop.lamp({ h: 2.2, pole: 0x8a6d2f, glow: 0xffd23f }), { rMin: 18.5, rMax: 20.5, seed: 53 });

  // Star shrine on the temple top.
  const shrine = prop.torus({ R: 1.1, r: 0.14, color: 0xffd23f });
  shrine.position.copy(base.nodeWorldPos('gt_p02')).add(new THREE.Vector3(0, 1.8, 0));
  props.add(shrine);

  base.withKit((kit) => {
    const statue = kitProp(kit, 'statue');
    if (statue) {
      statue.position.set(0, 9.4, 0);
      props.add(statue);
    }
    const banana = kitProp(kit, 'golden_banana');
    if (banana) {
      banana.position.copy(base.nodeWorldPos('gt_p02')).add(new THREE.Vector3(0, 2.6, 0));
      props.add(banana);
    }
  });

  /* --- mechanic visuals: rotating stairways ---------------------------------- */
  const stairSets = boardDef.mechanics.find((m) => m.id === 'gt_rotating_stairs')?.initialState?.stairways ?? [];
  const rampMats = stairSets.map(() => new THREE.MeshStandardMaterial({
    color: 0xffd23f,
    emissive: 0x000000,
    roughness: 0.5,
  }));
  const gates = [];
  stairSets.forEach((ids, s) => {
    const gateGroup = new THREE.Group();
    for (const id of ids) {
      const gate = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 0.18), rampMats[s]);
      gate.position.copy(base.nodeWorldPos(id)).add(new THREE.Vector3(0, 0.8, 0));
      gate.userData.homeY = gate.position.y;
      gateGroup.add(gate);
    }
    group.add(gateGroup);
    gates.push(gateGroup);
  });

  let time = 0;
  function updateMechanics(state, dt = 0) {
    time += dt;
    base.updateBlocked(state);
    const open = mechState(state, boardDef, 'gt_rotating_stairs').open ?? 0;
    gates.forEach((gateGroup, s) => {
      const isOpen = s === open;
      rampMats[s].emissive.setHex(isOpen ? 0x8a6d00 : 0x000000);
      rampMats[s].color.setHex(isOpen ? 0xffd23f : 0x6f6a55);
      gateGroup.children.forEach((gate, i) => {
        // Open stairway: gates lift out of the way; blocked: they bar the path.
        const target = gate.userData.homeY + (isOpen ? 1.6 : 0);
        gate.position.y += (target + Math.sin(time * 2 + i) * 0.05 - gate.position.y) * Math.min(1, dt * 3 || 0.2);
      });
    });
    shrine.rotation.y = time;
  }

  return { group, updateMechanics, nodeWorldPos: base.nodeWorldPos, dispose: base.dispose };
}

export default buildBoardView;
