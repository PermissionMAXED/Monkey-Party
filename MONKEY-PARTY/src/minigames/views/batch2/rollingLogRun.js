/**
 * Rolling Log Run view: a giant spinning log over a piranha river,
 * monkeys balancing on top, telegraphed branches sweeping across, and
 * splashes when someone goes under.
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
    cameraPreset: { pos: [0, 8, 12], look: [0, 1, 0] },
  });
  const tokens = new Map();
  const branchMeshes = new Map();
  let log = null;
  let logRadius = 1.4;
  let halfLen = 6;

  function buildArena(state) {
    logRadius = state.logRadius ?? 1.4;
    halfLen = state.logHalfLength ?? 6;
    const water = simpleMesh(new THREE.BoxGeometry(halfLen * 5, 0.4, 18), '#1e6f9c');
    water.position.y = -1.6;
    base.group.add(water);
    log = simpleMesh(new THREE.CylinderGeometry(logRadius, logRadius, halfLen * 2 + 1.2, 14), '#8d6e63');
    log.rotation.z = Math.PI / 2;
    base.group.add(log);
    for (const side of [-1, 1]) {
      const stump = simpleMesh(new THREE.CylinderGeometry(logRadius * 1.15, logRadius * 1.3, 1, 10), '#6d4c41');
      stump.rotation.z = Math.PI / 2;
      stump.position.x = side * (halfLen + 0.9);
      base.group.add(stump);
    }
    base.withKit((kit) => {
      for (let i = 0; i < 5; i += 1) {
        const palm = kitProp(kit, 'palm', { scale: 0.8 })
          ?? simpleMesh(new THREE.ConeGeometry(0.6, 2.2, 6), '#2e7d32');
        palm.position.set(-10 + i * 5, -1.2, -6.5);
        base.group.add(palm);
      }
    });
  }

  function branchMesh() {
    return simpleMesh(new THREE.BoxGeometry(1, 0.5, 0.5), '#4e342e');
  }

  function mount(sceneRoot) {
    const state = base.tracker.sample().curr ?? {};
    buildArena(state);
    (state.order ?? []).forEach((pid, i) => {
      const token = makePlayerToken(base, {
        id: pid, name: pid, color: PLAYER_COLORS[i % PLAYER_COLORS.length], scale: 0.85,
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
      if (log) log.rotation.x += (curr.spin ?? 1) * dtRender;

      for (const pid of curr.order ?? []) {
        const token = tokens.get(pid);
        const p = curr.players[pid];
        const q = prev?.players?.[pid] ?? p;
        if (!token || !p) continue;
        if (p.alive) {
          const off = lerp(q.off ?? 0, p.off ?? 0, alpha);
          const air = curr.tick <= (p.airUntil ?? -1);
          const hop = air ? 0.9 : 0;
          token.position.set(
            lerp(q.x, p.x, alpha),
            Math.cos(off) * logRadius + hop,
            Math.sin(off) * logRadius,
          );
          token.rotation.z = -off * 0.6;
          if (air && curr.tick !== (q.airUntil ?? -1) && p.airUntil !== q.airUntil) {
            base.sfx('jump', { vol: 0.5 });
          }
        } else {
          // Splash once, then bob in the river.
          if ((q.alive ?? true) && !p.alive) {
            base.sfx('splash');
            base.burst('splash', { pos: { x: p.x, y: -0.6, z: 0.8 } });
          }
          token.position.set(p.x, -1.15 + Math.sin(curr.tick * 0.1 + p.slot) * 0.08, 1.6);
          token.rotation.z = 1.2;
        }
      }

      // Branch telegraphs sweep in over the log.
      const live = new Set();
      for (const branch of curr.branches ?? []) {
        live.add(branch.id);
        let mesh = branchMeshes.get(branch.id);
        if (!mesh) {
          mesh = branchMesh();
          branchMeshes.set(branch.id, mesh);
          base.group.add(mesh);
        }
        const width = branch.x1 - branch.x0;
        mesh.scale.set(width, 1, 1);
        const untilHit = branch.hitTick - curr.tick;
        const drop = Math.max(0, untilHit / 42) * 4;
        mesh.position.set((branch.x0 + branch.x1) / 2, logRadius + 0.4 + drop, 0);
        mesh.material.emissive = new THREE.Color(untilHit < 12 ? '#ff5252' : '#3e2723');
        mesh.material.emissiveIntensity = untilHit < 12 ? 0.9 : 0.2;
        if (untilHit === 0) {
          base.sfx('thud', { vol: 0.7 });
          base.burst('dust', { pos: { x: mesh.position.x, y: logRadius, z: 0 }, count: 10 });
        }
      }
      for (const [id, mesh] of branchMeshes) {
        if (!live.has(id)) {
          disposeObject(mesh);
          branchMeshes.delete(id);
        }
      }
    }
    base.update(dtRender);
  }

  function dispose() {
    tokens.clear();
    branchMeshes.clear();
    base.dispose();
  }

  return { mount, update, dispose };
}

export default createView;
