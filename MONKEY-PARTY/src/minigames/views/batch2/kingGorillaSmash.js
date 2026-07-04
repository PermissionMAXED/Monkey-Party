/**
 * King Gorilla Smash view: a hulking boss gorilla in the arena center,
 * expanding shockwave rings, coconut pickups, a floating HP bar and a
 * glowing chest gem during weak-point windows.
 */

import * as THREE from 'three';
import {
  createViewBase, makePlayerToken, simpleMesh, kitProp, lerp, PLAYER_COLORS,
  buildFallbackMonkey, disposeObject,
} from '../../viewHarness.js';

export function createView({ sim, engine }) {
  const base = createViewBase({
    engine,
    sim,
    cameraPreset: { pos: [0, 13, 14], look: [0, 1.5, 0] },
  });
  const tokens = new Map();
  const ringMeshes = new Map();
  const nutMeshes = new Map();
  let boss = null;
  let weakGem = null;
  let hpFill = null;

  function buildArena(state) {
    const radius = state.arenaRadius ?? 9;
    const floor = simpleMesh(new THREE.CylinderGeometry(radius, radius * 1.1, 0.7, 24), '#5d4037');
    floor.position.y = -0.35;
    base.group.add(floor);

    boss = buildFallbackMonkey({ color: '#4e342e', name: 'KING GORILLA', scale: 2.6 });
    base.group.add(boss);

    weakGem = simpleMesh(new THREE.IcosahedronGeometry(0.4, 1), '#ffe135',
      { emissive: '#ffd600', emissiveIntensity: 0.2 });
    weakGem.position.set(0, 2.4, 1.05);
    base.group.add(weakGem);

    const hpBack = simpleMesh(new THREE.BoxGeometry(5.2, 0.35, 0.1), '#263238');
    hpBack.position.set(0, 6.2, 0);
    base.group.add(hpBack);
    hpFill = simpleMesh(new THREE.BoxGeometry(5, 0.28, 0.14), '#ef5350',
      { emissive: '#b71c1c', emissiveIntensity: 0.5 });
    hpFill.position.set(0, 6.2, 0.02);
    base.group.add(hpFill);

    base.withKit((kit) => {
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        const rock = kitProp(kit, 'rock', { scale: 1.1 })
          ?? simpleMesh(new THREE.IcosahedronGeometry(0.7, 0), '#78909c');
        rock.position.set(Math.cos(a) * (radius + 1.8), 0, Math.sin(a) * (radius + 1.8));
        base.group.add(rock);
      }
    });
  }

  function nutMesh() {
    return simpleMesh(new THREE.IcosahedronGeometry(0.32, 1), '#6d4c41');
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
      const b = curr.boss ?? {};

      // Boss: slam crouch + hit flinch + defeat topple.
      if (boss) {
        const sinceSlam = curr.tick - (b.slamTick ?? -100);
        const crouch = sinceSlam >= 0 && sinceSlam < 8 ? -0.35 : 0;
        boss.position.y = b.defeated ? Math.max(-1.2, boss.position.y - dtRender) : crouch;
        boss.rotation.z = b.defeated ? Math.min(1.4, boss.rotation.z + dtRender * 2) : 0;
        boss.rotation.y = Math.sin(curr.tick * 0.02) * 0.25;
        if (b.slamTick === curr.tick && b.slamTick !== (prev?.boss?.slamTick ?? -1)) {
          base.sfx('thud', { vol: 1 });
          base.burst('dust', { pos: { x: 0, y: 0.3, z: 0 }, count: 20 });
        }
        if (b.hitTick === curr.tick && b.hitTick !== (prev?.boss?.hitTick ?? -1)) {
          base.sfx('pop', { pitch: 0.7 });
          base.burst('bananaBits', { pos: { x: 0, y: 3, z: 0.8 }, count: 10 });
        }
        if (b.defeated && !(prev?.boss?.defeated ?? false)) {
          base.sfx('fanfare');
          base.burst('confetti', { pos: { x: 0, y: 3, z: 0 } });
        }
      }
      if (weakGem) {
        const weakOpen = curr.tick < (b.weakUntil ?? -1);
        weakGem.material.emissiveIntensity = weakOpen ? 2.4 : 0.2;
        weakGem.scale.setScalar(weakOpen ? 1.35 + Math.sin(curr.tick * 0.3) * 0.15 : 1);
      }
      if (hpFill) {
        const frac = Math.max(0, (b.hp ?? 0) / Math.max(1, b.maxHp ?? 1));
        hpFill.scale.x = Math.max(0.01, frac);
        hpFill.position.x = -(1 - frac) * 2.5;
      }

      // Shockwave rings.
      const liveRings = new Set();
      for (const ring of curr.rings ?? []) {
        liveRings.add(ring.id);
        let mesh = ringMeshes.get(ring.id);
        if (!mesh) {
          mesh = simpleMesh(new THREE.TorusGeometry(1, 0.16, 6, 32), '#ffab40',
            { emissive: '#ff6d00', emissiveIntensity: 1 });
          mesh.rotation.x = Math.PI / 2;
          mesh.position.y = 0.15;
          ringMeshes.set(ring.id, mesh);
          base.group.add(mesh);
        }
        const qr = (prev?.rings ?? []).find((r) => r.id === ring.id) ?? ring;
        mesh.scale.setScalar(lerp(qr.r, ring.r, alpha));
      }
      for (const [id, mesh] of ringMeshes) {
        if (!liveRings.has(id)) {
          disposeObject(mesh);
          ringMeshes.delete(id);
        }
      }

      // Coconuts.
      const liveNuts = new Set();
      for (const nut of curr.coconuts ?? []) {
        if (curr.tick < nut.activeFrom) continue;
        liveNuts.add(nut.id);
        let mesh = nutMeshes.get(nut.id);
        if (!mesh) {
          mesh = nutMesh();
          nutMeshes.set(nut.id, mesh);
          base.group.add(mesh);
        }
        mesh.position.set(nut.x, 0.32 + Math.sin(curr.tick * 0.1 + nut.id) * 0.06, nut.z);
      }
      for (const [id, mesh] of nutMeshes) {
        if (!liveNuts.has(id)) {
          disposeObject(mesh);
          nutMeshes.delete(id);
        }
      }

      // Players.
      for (const pid of curr.order ?? []) {
        const token = tokens.get(pid);
        const p = curr.players[pid];
        const q = prev?.players?.[pid] ?? p;
        if (!token || !p) continue;
        const air = curr.tick <= (p.airUntil ?? -1);
        const stunned = curr.tick < (p.stunUntil ?? -1);
        token.position.set(
          lerp(q.x, p.x, alpha),
          air ? 0.9 : 0,
          lerp(q.z, p.z, alpha),
        );
        token.rotation.z = stunned ? 1.2 : 0;
        const speed = Math.hypot(p.vx ?? 0, p.vz ?? 0);
        if (speed > 0.2 && !stunned) token.rotation.y = Math.atan2(p.vx, p.vz);

        if (p.lastHitTick === curr.tick && p.lastHitTick !== (q.lastHitTick ?? -1)) {
          base.sfx('error', { vol: 0.6 });
          base.burst('dust', { pos: { x: p.x, y: 0.5, z: p.z }, count: 10 });
        }
        if (p.lastThrowTick === curr.tick && p.lastThrowTick !== (q.lastThrowTick ?? -1)) {
          base.sfx('woosh', { pitch: p.lastThrowDmg > 1 ? 1.3 : 1 });
        }
        if (p.lastPickTick === curr.tick && p.lastPickTick !== (q.lastPickTick ?? -1)) {
          base.sfx('click', { pitch: 0.9, vol: 0.5 });
        }
      }
    }
    base.update(dtRender);
  }

  function dispose() {
    tokens.clear();
    ringMeshes.clear();
    nutMeshes.clear();
    base.dispose();
  }

  return { mount, update, dispose };
}

export default createView;
