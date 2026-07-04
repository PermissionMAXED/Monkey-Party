/**
 * Neon Monkey City board view: glowing skyscraper blocks, neon signs and
 * street lamps. The subway platform mesh glides to whichever of the 3
 * stations the nc_subway mechanic currently targets.
 */

import * as THREE from 'three';
import { createBaseView, prop, scatterProps, mechState, kitProp } from '../index.js';

export function buildBoardView(engine, boardDef) {
  const base = createBaseView(engine, boardDef);
  const { group } = base;

  /* --- themed props ----------------------------------------------------- */
  const props = new THREE.Group();
  props.name = 'props:neon_monkey_city';
  group.add(props);

  const NEON = [0xe056fd, 0x00ffd0, 0x3a7bd5, 0xff5aa0];
  scatterProps(props, 14, (r, i) => {
    const h = 4 + r() * 8;
    const tower = prop.box({ w: 2.2 + r() * 1.6, h, d: 2.2 + r() * 1.6, color: 0x1c2033 });
    const sign = prop.box({ w: 1.2, h: 0.5, d: 0.2, color: NEON[i % NEON.length] });
    sign.position.y = h * 0.7;
    tower.add(sign);
    return tower;
  }, { rMin: 21, rMax: 28, seed: 32 });
  scatterProps(props, 10, () => prop.lamp({ h: 2.6, glow: 0x00ffd0 }), { rMin: 18.5, rMax: 20, seed: 33 });
  scatterProps(props, 8, (r) => prop.crystal({ h: 1 + r() * 0.6, color: NEON[Math.floor(r() * 4)], emissive: 0x220033 }), { rMin: 7, rMax: 12, seed: 34 });

  // Casino marquee near the casino event field.
  const marquee = prop.torus({ R: 1.4, r: 0.16, color: 0xff5aa0 });
  marquee.position.copy(base.nodeWorldPos('nc_m06')).add(new THREE.Vector3(0, 2.4, 0));
  props.add(marquee);

  base.withKit((kit) => {
    const banana = kitProp(kit, 'golden_banana') ?? kitProp(kit, 'banana');
    if (banana) {
      banana.position.set(0, 9, 0);
      banana.scale.setScalar(3); // giant rooftop billboard banana
      props.add(banana);
    }
  });

  /* --- mechanic visuals: gliding subway platform --------------------------- */
  const stations = ['nc_stA', 'nc_stB', 'nc_stC'].map((id) => base.nodeWorldPos(id));
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.25, 2.6),
    new THREE.MeshStandardMaterial({ color: 0x3a7bd5, emissive: 0x0a2a55, emissiveIntensity: 0.8 }),
  );
  platform.name = 'mech:subway_platform';
  platform.position.copy(base.nodeWorldPos('nc_sub')).add(new THREE.Vector3(0, -0.35, 0));
  group.add(platform);
  // Rail line hinting at the circuit.
  const railMat = new THREE.MeshStandardMaterial({ color: 0x222633, roughness: 1 });
  for (let i = 0; i < stations.length; i += 1) {
    const a = stations[i];
    const b = stations[(i + 1) % stations.length];
    const dir = new THREE.Vector3().subVectors(b, a);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(dir.length(), 0.06, 0.3), railMat);
    rail.position.copy(a).addScaledVector(dir, 0.5).add(new THREE.Vector3(0, -0.5, 0));
    rail.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.clone().normalize());
    group.add(rail);
  }

  let time = 0;
  function updateMechanics(state, dt = 0) {
    time += dt;
    base.updateBlocked(state);
    const station = mechState(state, boardDef, 'nc_subway').station ?? 0;
    const target = stations[station % stations.length];
    platform.position.lerp(new THREE.Vector3(target.x, target.y - 0.35, target.z), Math.min(1, dt * 2 || 0.15));
    marquee.rotation.y = time * 0.8;
  }

  return { group, updateMechanics, nodeWorldPos: base.nodeWorldPos, dispose: base.dispose };
}

export default buildBoardView;
