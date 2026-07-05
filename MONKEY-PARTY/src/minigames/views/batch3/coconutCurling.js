/**
 * Coconut Curling view: a pale-blue ice sheet with a painted three-ring
 * house, aim arrows with charge bars during the aim phase, and hairy
 * coconut stones that glide, clack and knock each other around.
 */

import * as THREE from 'three';
import {
  createViewBase, makePlayerToken, simpleMesh, kitProp, lerp, PLAYER_COLORS,
  disposeObject,
} from '../../viewHarness.js';

export function createView({ sim, engine }) {
  const base = createViewBase({
    engine,
    sim,
    cameraPreset: { pos: [0, 17, -9], look: [0, 0, 12], fov: 55 },
  });
  const tokens = new Map();
  const aimRigs = new Map(); // pid -> { group, arrow, chargeFill }
  const stoneMeshes = new Map(); // stone id -> mesh

  function launchX(slot, n) {
    return n <= 1 ? 0 : -4 + (8 * slot) / (n - 1);
  }

  function buildScene(state) {
    const houseZ = state.houseZ ?? 20;
    const rings = state.rings ?? [1.3, 2.7, 4.2];

    // Ice sheet.
    const sheet = simpleMesh(new THREE.BoxGeometry(17, 0.5, houseZ + 12), '#cfe8f5',
      { rough: 0.35 });
    sheet.position.set(0, -0.25, houseZ / 2 + 1);
    base.group.add(sheet);
    // Snow banks along the sides.
    for (const side of [-1, 1]) {
      const bank = simpleMesh(new THREE.BoxGeometry(1.6, 0.9, houseZ + 12), '#f5fbff');
      bank.position.set(side * 9.2, 0.2, houseZ / 2 + 1);
      base.group.add(bank);
    }
    // The painted house (outer -> inner so rings stack visibly).
    const ringColors = ['#90caf9', '#ffffff', '#ef5350'];
    rings.slice().reverse().forEach((radius, i) => {
      const ring = simpleMesh(new THREE.CylinderGeometry(radius, radius, 0.06 + i * 0.012, 32),
        ringColors[i % ringColors.length]);
      ring.position.set(0, 0.03 + i * 0.006, houseZ);
      base.group.add(ring);
    });
    const button = simpleMesh(new THREE.CylinderGeometry(0.28, 0.28, 0.12, 16), '#ffe135',
      { emissive: '#ffe135', emissiveIntensity: 0.4 });
    button.position.set(0, 0.08, houseZ);
    base.group.add(button);
    // Hog line.
    const hog = simpleMesh(new THREE.BoxGeometry(17, 0.04, 0.16), '#5c6bc0');
    hog.position.set(0, 0.03, 5);
    base.group.add(hog);

    base.withKit((kit) => {
      for (const side of [-1, 1]) {
        const tree = kitProp(kit, 'palmTree', { scale: 0.8 })
          ?? simpleMesh(new THREE.ConeGeometry(0.8, 2.4, 6), '#7d9aa5');
        tree.position.set(side * 9.2, 0.6, houseZ + 6);
        base.group.add(tree);
      }
    });
  }

  function makeAimRig(color) {
    const group = new THREE.Group();
    const arrow = new THREE.Group();
    const shaft = simpleMesh(new THREE.BoxGeometry(0.12, 0.05, 2.2), color,
      { emissive: color, emissiveIntensity: 0.6 });
    shaft.position.z = 1.1;
    arrow.add(shaft);
    const head = simpleMesh(new THREE.ConeGeometry(0.22, 0.5, 6), color,
      { emissive: color, emissiveIntensity: 0.6 });
    head.rotation.x = Math.PI / 2;
    head.position.z = 2.4;
    arrow.add(head);
    group.add(arrow);
    // Charge bar floating beside the thrower.
    const barBack = simpleMesh(new THREE.BoxGeometry(0.18, 1.3, 0.1), '#263238');
    barBack.position.set(0.8, 1.2, 0);
    group.add(barBack);
    const chargeFill = simpleMesh(new THREE.BoxGeometry(0.14, 1.26, 0.06), '#ffca28',
      { emissive: '#ffca28', emissiveIntensity: 0.7 });
    chargeFill.position.set(0.8, 1.2, 0);
    chargeFill.scale.y = 0.01;
    group.add(chargeFill);
    return { group, arrow, chargeFill };
  }

  function stoneMesh(ownerColor) {
    const g = new THREE.Group();
    const body = simpleMesh(new THREE.SphereGeometry(0.55, 12, 10), '#6d4c41');
    body.position.y = 0.55;
    g.add(body);
    const band = simpleMesh(new THREE.TorusGeometry(0.56, 0.07, 8, 20), ownerColor,
      { emissive: ownerColor, emissiveIntensity: 0.5 });
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.55;
    g.add(band);
    return g;
  }

  function mount(sceneRoot) {
    const state = base.tracker.sample().curr ?? {};
    buildScene(state);
    const n = (state.order ?? []).length;
    (state.order ?? []).forEach((pid, i) => {
      const color = PLAYER_COLORS[i % PLAYER_COLORS.length];
      const token = makePlayerToken(base, {
        id: pid, name: pid, color, scale: 0.8,
      });
      const x = launchX(state.players?.[pid]?.slot ?? i, n);
      token.position.set(x, 0, -1.2);
      tokens.set(pid, token);
      base.group.add(token);
      const rig = makeAimRig(color);
      rig.group.position.set(x, 0.15, 0);
      aimRigs.set(pid, rig);
      base.group.add(rig.group);
    });
    (sceneRoot ?? engine?.scene)?.add(base.group);
    base.applyCamera();
  }

  function update(dtRender, alpha) {
    const { prev, curr } = base.tracker.sample();
    if (curr) {
      const colorOf = (pid) => PLAYER_COLORS[(curr.players?.[pid]?.slot ?? 0) % PLAYER_COLORS.length];

      // Aim arrows + charge bars only matter during the aim phase.
      for (const pid of curr.order ?? []) {
        const p = curr.players[pid];
        const rig = aimRigs.get(pid);
        if (!p || !rig) continue;
        // Launch slots rotate one place per wave (sim fairness fix): keep
        // the token and aim rig on the player's current lane.
        if (typeof p.launchX === 'number') {
          rig.group.position.x = p.launchX;
          const token = tokens.get(pid);
          if (token) token.position.x = p.launchX;
        }
        const aiming = curr.phase === 'aim' && !p.thrown;
        rig.group.visible = aiming;
        if (aiming) {
          // The camera sits behind the sheet (screen-right = world -x), so
          // rotation.y = +angle makes the arrow tilt the way the stone will
          // actually travel on screen (angle > 0 -> world +x -> screen-left).
          rig.arrow.rotation.y = p.angle;
          rig.chargeFill.scale.y = Math.max(0.01, p.charge);
          rig.chargeFill.position.y = 0.57 + (p.charge * 1.26) / 2;
        }
        if (p.throwTick === curr.tick
          && p.throwTick !== (prev?.players?.[pid]?.throwTick ?? -1)) {
          base.sfx('whoosh', { vol: 0.6, pitch: 1.1 });
        }
      }

      // Stones glide; new stones pop in on launch.
      const live = new Set();
      for (const stone of curr.stones ?? []) {
        live.add(stone.id);
        let mesh = stoneMeshes.get(stone.id);
        if (!mesh) {
          mesh = stoneMesh(colorOf(stone.owner));
          stoneMeshes.set(stone.id, mesh);
          base.group.add(mesh);
        }
        const qs = (prev?.stones ?? []).find((s) => s.id === stone.id) ?? stone;
        mesh.position.set(lerp(qs.x, stone.x, alpha), 0, lerp(qs.z, stone.z, alpha));
        mesh.visible = !stone.out;
        if (stone.out && !qs.out) {
          base.sfx('error', { vol: 0.4 });
          base.burst('snow', { pos: { x: stone.x, y: 0.4, z: stone.z }, count: 8 });
        }
      }
      for (const [id, mesh] of stoneMeshes) {
        if (!live.has(id)) {
          disposeObject(mesh);
          stoneMeshes.delete(id);
        }
      }

      // A fresh knock = an audible clack.
      for (const pid of curr.order ?? []) {
        const p = curr.players[pid];
        const q = prev?.players?.[pid] ?? p;
        if ((p?.knocks ?? 0) > (q?.knocks ?? 0)) {
          base.sfx('click', { vol: 0.8, pitch: 0.7 });
        }
      }

      if (curr.phase === 'aim' && prev?.phase === 'slide') {
        base.sfx('sparkle', { vol: 0.6 }); // Next wave.
      }
      if (curr.finished && !(prev?.finished ?? false)) {
        base.sfx('fanfare', { vol: 0.9 });
        base.burst('confetti', { pos: { x: 0, y: 2, z: curr.houseZ ?? 20 } });
      }
    }
    base.update(dtRender);
  }

  function dispose() {
    tokens.clear();
    aimRigs.clear();
    stoneMeshes.clear();
    base.dispose();
  }

  return { mount, update, dispose };
}

export default createView;
