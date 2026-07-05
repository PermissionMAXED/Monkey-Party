/**
 * Firefly Catchers view: a moonlit night glade in deep blues with glowing
 * fireflies (the golden one burns bright), monkeys swinging visible nets,
 * and sparkles whenever a swing connects.
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
    cameraPreset: { pos: [0, 14, 13], look: [0, 0, 0], fov: 55 },
  });
  const tokens = new Map();
  const nets = new Map(); // pid -> net group (visible during swings)
  const flyMeshes = new Map(); // fly id -> mesh

  function buildScene(state) {
    const radius = state.meadowRadius ?? 9;
    // Night meadow: deep blue-green disc under a dark ring of forest.
    const meadow = simpleMesh(new THREE.CylinderGeometry(radius + 1, radius + 1.5, 0.5, 24),
      '#12324a');
    meadow.position.y = -0.25;
    base.group.add(meadow);
    const grassRing = simpleMesh(new THREE.TorusGeometry(radius + 0.4, 0.25, 8, 32), '#0c2233');
    grassRing.rotation.x = Math.PI / 2;
    grassRing.position.y = 0.1;
    base.group.add(grassRing);
    // Moon.
    const moon = simpleMesh(new THREE.SphereGeometry(1.4, 12, 10), '#f5f3ce',
      { emissive: '#f5f3ce', emissiveIntensity: 1 });
    moon.position.set(-9, 11, -10);
    base.group.add(moon);
    // Dark tree silhouettes around the rim.
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2 + 0.35;
      const tree = simpleMesh(new THREE.ConeGeometry(1.1, 3.4, 6), '#0a1c2b');
      tree.position.set(Math.cos(a) * (radius + 2.4), 1.4, Math.sin(a) * (radius + 2.4));
      base.group.add(tree);
    }
    // Scattered glowing mushrooms for night flavor.
    base.withKit((kit) => {
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2 + 1.1;
        const shroom = kitProp(kit, 'mushroom', { scale: 0.7 })
          ?? simpleMesh(new THREE.ConeGeometry(0.3, 0.5, 6), '#7e57c2',
            { emissive: '#7e57c2', emissiveIntensity: 0.6 });
        shroom.position.set(Math.cos(a) * (radius - 1.2), 0, Math.sin(a) * (radius - 1.2));
        base.group.add(shroom);
      }
    });
  }

  function makeNet(color) {
    const net = new THREE.Group();
    const handle = simpleMesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 6), '#8d6e63');
    handle.rotation.z = Math.PI / 3;
    handle.position.set(0.5, 1.1, 0);
    net.add(handle);
    const hoop = simpleMesh(new THREE.TorusGeometry(0.5, 0.05, 6, 16), color,
      { emissive: color, emissiveIntensity: 0.5 });
    hoop.rotation.x = Math.PI / 2;
    hoop.position.set(1.05, 1.4, 0);
    net.add(hoop);
    net.visible = false;
    return net;
  }

  function flyMesh(golden) {
    const color = golden ? '#ffd54f' : '#aef58a';
    const mesh = simpleMesh(new THREE.SphereGeometry(golden ? 0.22 : 0.14, 8, 6), color,
      { emissive: color, emissiveIntensity: golden ? 1.4 : 1 });
    return mesh;
  }

  function mount(sceneRoot) {
    const state = base.tracker.sample().curr ?? {};
    buildScene(state);
    (state.order ?? []).forEach((pid, i) => {
      const color = PLAYER_COLORS[i % PLAYER_COLORS.length];
      const token = makePlayerToken(base, {
        id: pid, name: pid, color, scale: 0.8,
      });
      const net = makeNet(color);
      token.add(net);
      nets.set(pid, net);
      tokens.set(pid, token);
      base.group.add(token);
    });
    (sceneRoot ?? engine?.scene)?.add(base.group);
    base.applyCamera();
  }

  function update(dtRender, alpha) {
    const { prev, curr } = base.tracker.sample();
    if (curr) {
      // Fireflies bob and glow; goldens pulse.
      const live = new Set();
      for (const fly of curr.flies ?? []) {
        live.add(fly.id);
        let mesh = flyMeshes.get(fly.id);
        if (!mesh) {
          mesh = flyMesh(fly.golden);
          flyMeshes.set(fly.id, mesh);
          base.group.add(mesh);
          if (fly.golden) base.sfx('star', { vol: 0.6, pitch: 1.3 });
        }
        const qf = (prev?.flies ?? []).find((f) => f.id === fly.id) ?? fly;
        const bob = 1.1 + Math.sin((curr.tick + fly.id * 13) * 0.25) * 0.25;
        mesh.position.set(lerp(qf.x, fly.x, alpha), bob, lerp(qf.z, fly.z, alpha));
        if (fly.golden) {
          mesh.scale.setScalar(1 + Math.sin(curr.tick * 0.4) * 0.25);
        }
      }
      for (const [id, mesh] of flyMeshes) {
        if (!live.has(id)) {
          disposeObject(mesh);
          flyMeshes.delete(id);
        }
      }

      // Monkeys + net swings.
      for (const pid of curr.order ?? []) {
        const token = tokens.get(pid);
        const p = curr.players[pid];
        const q = prev?.players?.[pid] ?? p;
        if (!token || !p) continue;
        token.position.set(lerp(q.x, p.x, alpha), 0, lerp(q.z, p.z, alpha));
        if (Math.hypot(p.vx ?? 0, p.vz ?? 0) > 0.3) {
          token.rotation.y = Math.atan2(p.vx, p.vz);
        }
        const net = nets.get(pid);
        if (net) {
          const swinging = p.swingTick >= 0 && curr.tick - p.swingTick < 8;
          net.visible = swinging;
          if (swinging) net.rotation.y = (curr.tick - p.swingTick) * 0.5;
        }
        if (p.swingTick === curr.tick && p.swingTick !== (q.swingTick ?? -1)) {
          base.sfx('whoosh', { vol: 0.5, pitch: 1.2 });
        }
        if (p.catchTick === curr.tick && p.catchTick !== (q.catchTick ?? -1)) {
          const gotGolden = (p.goldenCatches ?? 0) > (q.goldenCatches ?? 0);
          base.sfx(gotGolden ? 'star' : 'pop', { vol: 0.8 });
          base.burst('starburst', { pos: { x: p.x, y: 1.3, z: p.z }, count: gotGolden ? 18 : 8 });
        }
        if ((p.whiffs ?? 0) > (q.whiffs ?? 0)) {
          base.sfx('error', { vol: 0.35 });
        }
      }

      if (curr.finished && !(prev?.finished ?? false)) {
        base.sfx('fanfare', { vol: 0.9 });
        base.burst('fireworks', { pos: { x: 0, y: 4, z: 0 } });
      }
    }
    base.update(dtRender);
  }

  function dispose() {
    tokens.clear();
    nets.clear();
    flyMeshes.clear();
    base.dispose();
  }

  return { mount, update, dispose };
}

export default createView;
