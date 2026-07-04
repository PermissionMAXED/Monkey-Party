/**
 * Banana Scramble view: tilting jungle disc ringed with palms, raining
 * bananas (golden ones sparkle), monkey tokens with bump/grab feedback.
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
    cameraPreset: { pos: [0, 13, 13], look: [0, 0, 0] },
  });
  const tokens = new Map();
  const bananaMeshes = new Map();
  const arena = new THREE.Group();
  let bananaProto = null;
  let arenaDisc = null;

  function bananaMesh(golden) {
    if (bananaProto) {
      const m = bananaProto.clone();
      if (golden) {
        m.traverse((o) => {
          if (o.isMesh) o.material = o.material.clone();
          if (o.isMesh) {
            o.material.userData.__mgOwned = true;
            o.material.color = new THREE.Color('#ffd54f');
            o.material.emissive = new THREE.Color('#8a6a00');
            o.material.emissiveIntensity = 0.8;
          }
        });
        m.scale.multiplyScalar(1.35);
      }
      return m;
    }
    const geo = new THREE.TorusGeometry(0.28, 0.09, 5, 8, Math.PI * 1.4);
    const mesh = simpleMesh(geo, golden ? '#ffd54f' : '#ffe135', golden
      ? { emissive: '#8a6a00', emissiveIntensity: 0.8 }
      : {});
    if (golden) mesh.scale.multiplyScalar(1.35);
    return mesh;
  }

  function buildArena(radius) {
    arenaDisc = simpleMesh(new THREE.CylinderGeometry(radius, radius * 1.12, 0.7, 24), '#4caf50');
    arenaDisc.position.y = -0.35;
    arena.add(arenaDisc);
    const rim = simpleMesh(new THREE.TorusGeometry(radius, 0.22, 6, 24), '#8d6e63');
    rim.rotation.x = Math.PI / 2;
    arena.add(rim);
    base.withKit((kit) => {
      for (let i = 0; i < 7; i += 1) {
        const a = (i / 7) * Math.PI * 2;
        const palm = kitProp(kit, 'palm', { scale: 0.9 })
          ?? simpleMesh(new THREE.ConeGeometry(0.7, 2.4, 6), '#2e7d32');
        palm.position.set(Math.cos(a) * (radius + 2.2), 0, Math.sin(a) * (radius + 2.2));
        arena.add(palm);
      }
      const bananaViaKit = kitProp(kit, 'banana', {});
      if (bananaViaKit) bananaProto = bananaViaKit;
    });
    base.group.add(arena);
  }

  function mount(sceneRoot) {
    const state = base.tracker.sample().curr ?? {};
    buildArena(state.arenaRadius ?? 8);
    (state.order ?? []).forEach((pid, i) => {
      const token = makePlayerToken(base, {
        id: pid, name: pid, color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      });
      tokens.set(pid, token);
      base.group.add(token);
    });
    (sceneRoot ?? engine?.scene)?.add(base.group);
    base.applyCamera();
  }

  function update(dtRender, alpha) {
    const { prev, curr } = base.tracker.sample();
    if (curr) {
      // Gentle visual tilt following the sim's tilt angle.
      arena.rotation.z = Math.cos(curr.tiltAngle ?? 0) * 0.05;
      arena.rotation.x = Math.sin(curr.tiltAngle ?? 0) * 0.05;

      for (const pid of curr.order ?? []) {
        const token = tokens.get(pid);
        const p = curr.players[pid];
        const q = prev?.players?.[pid] ?? p;
        if (!token || !p) continue;
        token.position.set(lerp(q.x, p.x, alpha), 0, lerp(q.z, p.z, alpha));
        const speed = Math.hypot(p.vx ?? 0, p.vz ?? 0);
        if (speed > 0.2) token.rotation.y = Math.atan2(p.vx, p.vz);
        // Grab feedback.
        if (p.lastGrabTick === curr.tick && p.lastGrabTick !== (q.lastGrabTick ?? -1)) {
          base.sfx(p.lastGrabGolden ? 'star' : 'coin', { pitch: p.lastGrabGolden ? 1 : 1.1 });
          base.burst(p.lastGrabGolden ? 'coinSparkle' : 'bananaBits', { pos: { x: p.x, y: 1, z: p.z } });
        }
        if (p.bumpedTick === curr.tick && p.bumpedTick !== (q.bumpedTick ?? -1)) {
          base.sfx('pop', { vol: 0.5 });
          base.burst('dust', { pos: { x: p.x, y: 0.4, z: p.z }, count: 6 });
        }
      }

      // Sync banana meshes with sim state.
      const liveIds = new Set();
      for (const banana of curr.bananas ?? []) {
        liveIds.add(banana.id);
        let mesh = bananaMeshes.get(banana.id);
        if (!mesh) {
          mesh = bananaMesh(banana.golden);
          bananaMeshes.set(banana.id, mesh);
          base.group.add(mesh);
        }
        const qb = (prev?.bananas ?? []).find((b) => b.id === banana.id) ?? banana;
        mesh.position.set(
          lerp(qb.x, banana.x, alpha),
          Math.max(0.25, lerp(qb.y, banana.y, alpha)),
          lerp(qb.z, banana.z, alpha),
        );
        mesh.rotation.y += dtRender * 2;
      }
      for (const [id, mesh] of bananaMeshes) {
        if (!liveIds.has(id)) {
          disposeObject(mesh);
          bananaMeshes.delete(id);
        }
      }
    }
    base.update(dtRender);
  }

  function dispose() {
    bananaMeshes.clear();
    tokens.clear();
    base.dispose();
  }

  return { mount, update, dispose };
}

export default createView;
