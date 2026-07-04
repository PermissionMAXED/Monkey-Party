/**
 * Splash Sumo view: a plank raft bobbing on open water, one oversized
 * gorilla token versus three small monkeys, splash bursts + camera thunk
 * on knock-offs.
 */

import * as THREE from 'three';
import {
  createViewBase, makePlayerToken, simpleMesh, kitProp, lerp, PLAYER_COLORS,
} from '../../viewHarness.js';

export function createView({ sim, engine }) {
  const base = createViewBase({
    engine,
    sim,
    cameraPreset: { pos: [0, 12, 12], look: [0, 0, 0] },
  });
  const tokens = new Map();
  let raft = null;
  let water = null;

  function buildArena(state) {
    const r = state.raftRadius ?? 7;

    water = simpleMesh(new THREE.CylinderGeometry(r * 3, r * 3, 0.25, 24), '#1e88e5',
      { transparent: true, opacity: 0.9, rough: 0.35 });
    water.position.y = -1.3;
    base.group.add(water);

    raft = new THREE.Group();
    const planks = 9;
    for (let i = 0; i < planks; i += 1) {
      const w = 2 * Math.sqrt(Math.max(0.2, r * r - ((i - (planks - 1) / 2) * (2 * r / planks)) ** 2));
      const plank = simpleMesh(new THREE.BoxGeometry(w, 0.5, (2 * r) / planks - 0.15), i % 2 ? '#8d6e63' : '#a1887f');
      plank.position.set(0, -0.25, (i - (planks - 1) / 2) * ((2 * r) / planks));
      raft.add(plank);
    }
    base.group.add(raft);

    base.withKit((kit) => {
      const chest = kitProp(kit, 'chest', { scale: 0.8 });
      if (chest) {
        chest.position.set(r * 1.8, -1.1, -r * 1.4);
        base.group.add(chest);
      }
      for (let i = 0; i < 4; i += 1) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        const palm = kitProp(kit, 'palm', { scale: 0.8 })
          ?? simpleMesh(new THREE.ConeGeometry(0.6, 2, 6), '#2e7d32');
        palm.position.set(Math.cos(a) * r * 2.4, -1.1, Math.sin(a) * r * 2.4);
        base.group.add(palm);
      }
    });
  }

  function mount(sceneRoot) {
    const state = base.tracker.sample().curr ?? {};
    buildArena(state);
    (state.order ?? []).forEach((pid, i) => {
      const isGorilla = pid === state.gorillaId;
      const token = makePlayerToken(base, {
        id: pid,
        name: isGorilla ? `${pid} (GORILLA)` : pid,
        color: isGorilla ? '#37474f' : PLAYER_COLORS[i % PLAYER_COLORS.length],
        scale: isGorilla ? 1.7 : 0.85,
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
      // Raft bobs gently; more when the gorilla dashes.
      const g = curr.players?.[curr.gorillaId];
      const gDashing = g && curr.tick < (g.dashUntil ?? -1);
      if (raft) {
        raft.rotation.x = Math.sin(curr.tick * 0.05) * (gDashing ? 0.045 : 0.02);
        raft.rotation.z = Math.cos(curr.tick * 0.04) * (gDashing ? 0.04 : 0.015);
      }

      for (const pid of curr.order ?? []) {
        const token = tokens.get(pid);
        const p = curr.players[pid];
        const q = prev?.players?.[pid] ?? p;
        if (!token || !p) continue;

        if (!p.alive) {
          if (q.alive) {
            base.sfx('splash', { vol: 1 });
            base.burst('splash', { pos: { x: p.x, y: 0.3, z: p.z }, count: 40 });
          }
          token.position.y = Math.max(token.position.y - dtRender * 5, -2.6);
          token.rotation.x += dtRender * 2.5;
          continue;
        }

        token.position.set(lerp(q.x, p.x, alpha), 0, lerp(q.z, p.z, alpha));
        const speed = Math.hypot(p.vx ?? 0, p.vz ?? 0);
        if (speed > 0.2) token.rotation.y = Math.atan2(p.vx, p.vz);
        token.scale.y += ((p.bracing ? 0.8 : 1) - token.scale.y) * Math.min(1, dtRender * 10);

        if ((q.dashUntil ?? -1) < (p.dashUntil ?? -1)) {
          base.sfx(p.role === 'gorilla' ? 'drum' : 'whoosh', { vol: p.role === 'gorilla' ? 1 : 0.6 });
          base.burst('dust', { pos: { x: p.x, y: 0.3, z: p.z }, count: p.role === 'gorilla' ? 14 : 7 });
        }
        if (p.shoves > (q.shoves ?? 0)) base.sfx('pop', { pitch: p.role === 'gorilla' ? 0.7 : 1.2 });
      }
    }
    base.update(dtRender);
  }

  function dispose() {
    tokens.clear();
    base.dispose();
  }

  return { mount, update, dispose };
}

export default createView;
