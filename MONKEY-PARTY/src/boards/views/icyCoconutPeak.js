/**
 * Icy Coconut Peak board view: a snowy summit cone, pines, ice crystals,
 * a steaming hot spring - and a frozen lake sheet whose ice visibly melts
 * away while the ip_freeze_thaw mechanic has the crossing thawed shut.
 */

import * as THREE from 'three';
import { createBaseView, prop, scatterProps, mechState, kitProp } from '../index.js';

export function buildBoardView(engine, boardDef) {
  const base = createBaseView(engine, boardDef);
  const { group } = base;

  /* --- themed props ---------------------------------------------------------------- */
  const props = new THREE.Group();
  props.name = 'props:icy_coconut_peak';
  group.add(props);

  scatterProps(props, 12, (rand) => prop.tree({
    trunkH: 1.6 + rand(),
    crownR: 1,
    trunk: 0x5d4a37,
    crown: 0x3f6f52,
    shape: 'cone',
  }), { rMin: 20, rMax: 27, seed: 81 });
  scatterProps(props, 10, (rand) => prop.crystal({ h: 0.9 + rand() * 0.8, color: 0xbfe8ff, emissive: 0x224455 }), { rMin: 18.5, rMax: 24, seed: 82 });
  scatterProps(props, 8, () => prop.blob({ r: 1.0, color: 0xf4fbff, flat: 0.45 }), { rMin: 19, rMax: 25, seed: 83 });

  // Summit cone with a snowy cap.
  const peak = prop.cone({ r: 4.5, h: 9, color: 0x8fb4c9 });
  peak.position.set(1, -0.4, -3);
  props.add(peak);
  const cap = prop.cone({ r: 1.9, h: 3.2, color: 0xffffff });
  cap.position.set(1, 6.1, -3);
  props.add(cap);

  // Steaming hot spring at the safe-zone spur.
  const springPos = base.nodeWorldPos('ip_h00');
  const pool = prop.blob({ r: 1.3, color: 0x63c7c2, flat: 0.18, transparent: true });
  pool.position.set(springPos.x, springPos.y - 0.3, springPos.z + 1.6);
  props.add(pool);
  const steam = new THREE.Group();
  for (let i = 0; i < 4; i += 1) {
    const puff = prop.blob({ r: 0.35 + i * 0.08, color: 0xffffff, flat: 0.8, transparent: true });
    puff.position.set(springPos.x, springPos.y + 0.4 + i * 0.6, springPos.z + 1.6);
    steam.add(puff);
  }
  group.add(steam);

  base.withKit((kit) => {
    for (const [x, z] of [[-14, -10], [12, 14], [-6, 17]]) {
      const spike = kitProp(kit, 'ice_spike');
      if (spike) {
        spike.position.set(x, 0.4, z);
        props.add(spike);
      }
    }
  });

  /* --- mechanic visuals: freezing/thawing lake sheet ---------------------------------- */
  const lakeIds = boardDef.mechanics.find((m) => m.id === 'ip_freeze_thaw')?.initialState?.lake ?? [];
  const center = lakeIds
    .map((id) => base.nodeWorldPos(id))
    .reduce((acc, p) => acc.add(p), new THREE.Vector3())
    .multiplyScalar(lakeIds.length ? 1 / lakeIds.length : 1);
  const iceMat = new THREE.MeshStandardMaterial({
    color: 0xd6f2ff,
    transparent: true,
    opacity: 0.85,
    roughness: 0.2,
  });
  const ice = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 0.18, 32), iceMat);
  ice.name = 'mech:lake_ice';
  ice.position.set(center.x, 0.05, center.z);
  group.add(ice);

  let time = 0;
  function updateMechanics(state, dt = 0) {
    time += dt;
    base.updateBlocked(state);
    const frozen = mechState(state, boardDef, 'ip_freeze_thaw').frozen ?? true;
    const targetOpacity = frozen ? 0.85 : 0.15;
    iceMat.opacity += (targetOpacity - iceMat.opacity) * Math.min(1, dt * 2 || 0.15);
    iceMat.color.setHex(frozen ? 0xd6f2ff : 0x2d86c4);
    steam.children.forEach((puff, i) => {
      puff.position.y += (dt || 0.016) * 0.4;
      puff.material.opacity = 0.5 - (i * 0.1) - (Math.sin(time + i) + 1) * 0.05;
      if (puff.position.y > springPos.y + 3) puff.position.y = springPos.y + 0.4;
    });
  }

  return { group, updateMechanics, nodeWorldPos: base.nodeWorldPos, dispose: base.dispose };
}

export default buildBoardView;
