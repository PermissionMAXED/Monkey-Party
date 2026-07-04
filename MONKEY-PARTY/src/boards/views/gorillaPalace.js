/**
 * Gorilla Palace board view: marble columns, banners and a golden throne.
 * Banana bolts rain over the 5 gp_banana_storm nodes each storm, and the
 * throne aura pulses to advertise the +10 star markup.
 */

import * as THREE from 'three';
import { createBaseView, prop, scatterProps, mechState, kitProp } from '../index.js';

export function buildBoardView(engine, boardDef) {
  const base = createBaseView(engine, boardDef);
  const { group } = base;

  /* --- themed props ------------------------------------------------------------------------ */
  const props = new THREE.Group();
  props.name = 'props:gorilla_palace';
  group.add(props);

  scatterProps(props, 12, () => prop.column({ r: 0.5, h: 4.4, color: 0xf2ead6 }), { rMin: 20, rMax: 24, seed: 121 });
  scatterProps(props, 8, (rand, i) => {
    const banner = prop.box({ w: 0.9, h: 1.8, d: 0.08, color: i % 2 ? 0x8b0000 : 0xffd23f });
    banner.position.y = 2.4 + rand() * 0.5;
    return banner;
  }, { rMin: 19, rMax: 23, seed: 122 });
  scatterProps(props, 8, (rand) => prop.tree({ trunkH: 1.8 + rand(), crownR: 0.9, crown: 0x4d7a3a, shape: 'sphere' }), { rMin: 22, rMax: 27, seed: 123 });
  scatterProps(props, 5, () => prop.lamp({ h: 2.6, pole: 0xa88d4d, glow: 0xffe9b0 }), { rMin: 7, rMax: 14, seed: 124 });

  // The golden throne at the summit star.
  const thronePos = base.nodeWorldPos('gp_t03');
  const throne = new THREE.Group();
  const seat = prop.box({ w: 1.6, h: 0.7, d: 1.4, color: 0xffd23f });
  throne.add(seat);
  const back = prop.box({ w: 1.6, h: 2.2, d: 0.25, color: 0xffd23f });
  back.position.z = -0.6;
  throne.add(back);
  throne.position.set(thronePos.x, thronePos.y + 0.1, thronePos.z - 1.8);
  props.add(throne);
  const aura = prop.torus({ R: 1.5, r: 0.1, color: 0xffffff });
  aura.rotation.x = Math.PI / 2;
  aura.position.set(thronePos.x, thronePos.y + 0.6, thronePos.z);
  group.add(aura);

  base.withKit((kit) => {
    const statue = kitProp(kit, 'statue');
    if (statue) {
      statue.position.set(thronePos.x + 3, thronePos.y, thronePos.z);
      props.add(statue);
    }
    const banana = kitProp(kit, 'golden_banana');
    if (banana) {
      banana.position.set(thronePos.x, thronePos.y + 2.4, thronePos.z - 1.8);
      props.add(banana);
    }
  });

  /* --- mechanic visuals: banana storm bolts --------------------------------------------------- */
  const bolts = [];
  const boltMat = new THREE.MeshStandardMaterial({
    color: 0xffe135,
    emissive: 0x8a7500,
    emissiveIntensity: 0.9,
  });
  for (let i = 0; i < 5; i += 1) {
    const bolt = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.14, 6, 12, Math.PI * 1.2), boltMat);
    bolt.visible = false;
    bolt.name = `mech:banana_bolt_${i}`;
    group.add(bolt);
    bolts.push(bolt);
  }

  let time = 0;
  function updateMechanics(state, dt = 0) {
    time += dt;
    base.updateBlocked(state);
    const stormNodes = mechState(state, boardDef, 'gp_banana_storm').stormNodes ?? [];
    bolts.forEach((bolt, i) => {
      const nodeId = stormNodes[i];
      if (nodeId) {
        const p = base.nodeWorldPos(nodeId);
        bolt.visible = true;
        // Bananas rain down in a loop over the blessed field.
        const fall = 2.4 - ((time * 1.5 + i * 0.45) % 2.4);
        bolt.position.set(p.x, p.y + 0.6 + fall, p.z);
        bolt.rotation.set(time * 3 + i, 0, time * 2);
      } else {
        bolt.visible = false;
      }
    });
    // Throne aura pulses with the royal +10 markup.
    const markup = mechState(state, boardDef, 'gp_throne_star').markup ?? 10;
    aura.scale.setScalar(1 + Math.sin(time * 2) * 0.08 * (markup / 10));
    aura.rotation.z = time * 0.6;
  }

  return { group, updateMechanics, nodeWorldPos: base.nodeWorldPos, dispose: base.dispose };
}

export default buildBoardView;
