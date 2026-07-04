/**
 * Monkey Funfair board view: striped tents, balloons, a bumper arena -
 * and a spinning ferris wheel whose glowing gondola marker points at the
 * current mf_ferris drop-off stop.
 */

import * as THREE from 'three';
import { createBaseView, prop, scatterProps, mechState, kitProp } from '../index.js';

export function buildBoardView(engine, boardDef) {
  const base = createBaseView(engine, boardDef);
  const { group } = base;

  /* --- themed props ------------------------------------------------------------------ */
  const props = new THREE.Group();
  props.name = 'props:monkey_funfair';
  group.add(props);

  const CANDY = [0xff5aa0, 0xffd23f, 0x3ecf8e, 0x3a7bd5];
  scatterProps(props, 10, (rand, i) => {
    const tent = new THREE.Group();
    const wall = prop.box({ w: 2.2, h: 1.4, d: 2.2, color: 0xfff4e0 });
    tent.add(wall);
    const roof = prop.cone({ r: 1.8, h: 1.6, color: CANDY[i % CANDY.length] });
    roof.position.y = 1.4 + 0.1;
    tent.add(roof);
    tent.rotation.y = rand() * Math.PI;
    return tent;
  }, { rMin: 21, rMax: 27, seed: 101 });
  scatterProps(props, 12, (rand, i) => {
    const balloon = new THREE.Group();
    const b = prop.blob({ r: 0.45, color: CANDY[(i + 1) % CANDY.length], flat: 1.1 });
    b.position.y = 2.2 + rand();
    balloon.add(b);
    const string = prop.column({ r: 0.02, h: 2.2, color: 0xdddddd });
    balloon.add(string);
    return balloon;
  }, { rMin: 18.5, rMax: 23, seed: 102 });
  scatterProps(props, 8, () => prop.lamp({ h: 2.6, pole: 0xb04a6a, glow: 0xfff1a8 }), { rMin: 7, rMax: 16, seed: 103 });

  // Bumper arena ring around the shortcut.
  const arenaCenter = base.nodeWorldPos('mf_x01').lerp(base.nodeWorldPos('mf_x02'), 0.5);
  const arena = prop.torus({ R: 3.2, r: 0.18, color: 0xe5484d });
  arena.rotation.x = Math.PI / 2;
  arena.position.set(arenaCenter.x, arenaCenter.y + 0.3, arenaCenter.z);
  props.add(arena);

  base.withKit((kit) => {
    const banana = kitProp(kit, 'banana');
    if (banana) {
      banana.position.set(-6, 3, 5);
      banana.scale.setScalar(2.5); // prize-booth super banana
      props.add(banana);
    }
    const crate = kitProp(kit, 'crate');
    if (crate) {
      crate.position.set(6.5, 0.5, -3);
      props.add(crate);
    }
  });

  /* --- mechanic visuals: rotating ferris wheel + stop marker ---------------------------- */
  const wheelBase = base.nodeWorldPos('mf_f01');
  const wheel = new THREE.Group();
  wheel.name = 'mech:ferris_wheel';
  const rim = prop.torus({ R: 4.2, r: 0.16, color: 0xffd23f });
  wheel.add(rim);
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xff5aa0 });
  for (let i = 0; i < 6; i += 1) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.08, 0.08), hubMat);
    spoke.rotation.z = (i * Math.PI) / 6;
    wheel.add(spoke);
    const gondola = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: CANDY[i % CANDY.length] }));
    const a = (i * Math.PI * 2) / 6;
    gondola.position.set(Math.cos(a) * 4.2, Math.sin(a) * 4.2, 0);
    wheel.add(gondola);
  }
  wheel.position.set(wheelBase.x * 1.15, wheelBase.y + 4.6, wheelBase.z * 1.15);
  group.add(wheel);

  // Marker beacon over the active gondola stop.
  const stops = (boardDef.mechanics.find((m) => m.id === 'mf_ferris')?.initialState?.stops ?? []).map((id) => base.nodeWorldPos(id));
  const beacon = prop.cone({ r: 0.45, h: 1.2, color: 0xffd23f });
  beacon.rotation.x = Math.PI;
  beacon.name = 'mech:gondola_beacon';
  group.add(beacon);

  let time = 0;
  function updateMechanics(state, dt = 0) {
    time += dt;
    base.updateBlocked(state);
    wheel.rotation.z = time * 0.4;
    const angle = mechState(state, boardDef, 'mf_ferris').angle ?? 0;
    const stop = stops[angle % Math.max(1, stops.length)];
    if (stop) {
      beacon.visible = true;
      beacon.position.lerp(new THREE.Vector3(stop.x, stop.y + 2.2 + Math.sin(time * 3) * 0.2, stop.z), Math.min(1, dt * 3 || 0.2));
    } else {
      beacon.visible = false;
    }
  }

  return { group, updateMechanics, nodeWorldPos: base.nodeWorldPos, dispose: base.dispose };
}

export default buildBoardView;
