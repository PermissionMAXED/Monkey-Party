/**
 * Monkey Cannonball Dodge view: a sea cliff with a coconut cannon, a
 * bamboo raft below, a roaming crosshair, falling cannonballs with
 * telegraphed splash markers, and dodgers that flash when clipped.
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
    cameraPreset: { pos: [0, 15, 15], look: [0, 0, -1], fov: 55 },
  });
  const tokens = new Map();
  const shotMeshes = new Map(); // shot id -> { marker, ball }
  let crosshair = null;
  let cannonBarrel = null;
  let soloId = null;

  function buildScene(state) {
    const hw = state.raftHalfW ?? 6;
    const hd = state.raftHalfD ?? 4;

    // Open sea.
    const sea = simpleMesh(new THREE.CylinderGeometry(26, 26, 0.4, 24), '#1565c0');
    sea.position.y = -0.55;
    base.group.add(sea);

    // Bamboo raft: alternating log strips.
    for (let i = 0; i < 9; i += 1) {
      const log = simpleMesh(
        new THREE.CylinderGeometry(0.42, 0.42, hw * 2 + 0.6, 8),
        i % 2 === 0 ? '#c8a165' : '#b5915a',
      );
      log.rotation.z = Math.PI / 2;
      log.position.set(0, -0.15, -hd + (i * (hd * 2)) / 8);
      base.group.add(log);
    }

    // Cliff with the cannon behind the raft (view feedback only).
    const cliff = simpleMesh(new THREE.BoxGeometry(7, 6, 4), '#6d6258');
    cliff.position.set(0, 2.6, -(hd + 8));
    base.group.add(cliff);
    const mount = simpleMesh(new THREE.CylinderGeometry(1, 1.3, 1, 8), '#4e4438');
    mount.position.set(0, 6, -(hd + 8));
    base.group.add(mount);
    cannonBarrel = simpleMesh(new THREE.CylinderGeometry(0.42, 0.55, 3.2, 10), '#37474f',
      { metal: 0.4, rough: 0.5 });
    cannonBarrel.rotation.x = Math.PI / 3;
    cannonBarrel.position.set(0, 7, -(hd + 7));
    base.group.add(cannonBarrel);

    // Crosshair the cannoneer steers over the raft.
    crosshair = new THREE.Group();
    const ring = simpleMesh(new THREE.TorusGeometry(0.7, 0.07, 8, 24), '#ff1744',
      { emissive: '#ff1744', emissiveIntensity: 0.9 });
    ring.rotation.x = -Math.PI / 2;
    crosshair.add(ring);
    for (const rot of [0, Math.PI / 2]) {
      const tick = simpleMesh(new THREE.BoxGeometry(0.5, 0.04, 0.08), '#ff1744',
        { emissive: '#ff1744', emissiveIntensity: 0.9 });
      tick.rotation.y = rot;
      crosshair.add(tick);
    }
    crosshair.position.y = 0.25;
    base.group.add(crosshair);

    base.withKit((kit) => {
      const palm = kitProp(kit, 'palmTree', { scale: 1.1 })
        ?? simpleMesh(new THREE.ConeGeometry(1, 3, 6), '#2e7d32');
      palm.position.set(-4.6, 5.6, -(hd + 8.6));
      base.group.add(palm);
    });
  }

  function shotVisual(shot) {
    const marker = simpleMesh(new THREE.RingGeometry(0.4, 1.8, 20), '#ff5252',
      { emissive: '#ff5252', emissiveIntensity: 0.8, transparent: true, opacity: 0.55 });
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(shot.x, 0.12, shot.z);
    base.group.add(marker);
    const ball = simpleMesh(new THREE.IcosahedronGeometry(0.4, 1), '#263238',
      { metal: 0.3, rough: 0.6 });
    base.group.add(ball);
    return { marker, ball };
  }

  function mount(sceneRoot) {
    const state = base.tracker.sample().curr ?? {};
    soloId = state.soloId ?? null;
    buildScene(state);
    (state.order ?? []).forEach((pid, i) => {
      const p = state.players?.[pid];
      if (p?.role === 'solo') return; // The cannoneer is the crosshair + cannon.
      const token = makePlayerToken(base, {
        id: pid, name: pid, color: PLAYER_COLORS[i % PLAYER_COLORS.length], scale: 0.8,
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
      const flight = curr.flightTicks ?? 27;
      const hd = curr.raftHalfD ?? 4;

      // Crosshair follows the cannoneer's aim; the barrel tracks it.
      const solo = curr.players?.[soloId ?? curr.soloId];
      const soloQ = prev?.players?.[soloId ?? curr.soloId] ?? solo;
      if (crosshair && solo) {
        crosshair.position.x = lerp(soloQ.x, solo.x, alpha);
        crosshair.position.z = lerp(soloQ.z, solo.z, alpha);
        crosshair.rotation.y += dtRender * 1.2;
        if (cannonBarrel) {
          cannonBarrel.rotation.z = -Math.atan2(solo.x, hd + 8) * 0.9;
        }
      }

      // Live shots: splash marker on the deck, ball arcing down.
      const live = new Set();
      for (const shot of curr.shots ?? []) {
        live.add(shot.id);
        let vis = shotMeshes.get(shot.id);
        if (!vis) {
          vis = shotVisual(shot);
          shotMeshes.set(shot.id, vis);
          base.sfx('whoosh', { vol: 0.5, pitch: 0.8 });
        }
        const remain = Math.max(0, shot.landTick - curr.tick);
        const f = 1 - remain / flight; // 0 = just fired, 1 = landing.
        vis.marker.scale.setScalar(0.4 + f * 0.6);
        vis.ball.position.set(
          lerp(0, shot.x, f),
          10 - 9.4 * f * f, // Steep fall from the cliff.
          lerp(-(hd + 7), shot.z, f),
        );
      }
      for (const [id, vis] of shotMeshes) {
        if (!live.has(id)) {
          disposeObject(vis.marker);
          disposeObject(vis.ball);
          shotMeshes.delete(id);
        }
      }

      // Splash-down feedback.
      if (curr.lastSplash && curr.lastSplash.tick === curr.tick
        && (prev?.lastSplash?.tick ?? -1) !== curr.tick) {
        base.sfx(curr.lastSplash.hits > 0 ? 'impact_heavy' : 'splash', { vol: 0.85 });
        base.burst('splash', {
          pos: { x: curr.lastSplash.x, y: 0.3, z: curr.lastSplash.z }, count: 24,
        });
      }

      // Dodgers.
      for (const pid of curr.order ?? []) {
        const token = tokens.get(pid);
        const p = curr.players[pid];
        const q = prev?.players?.[pid] ?? p;
        if (!token || !p) continue;
        token.position.set(lerp(q.x, p.x, alpha), 0.15, lerp(q.z, p.z, alpha));
        if (Math.hypot(p.vx ?? 0, p.vz ?? 0) > 0.3) {
          token.rotation.y = Math.atan2(p.vx, p.vz);
        }
        if (p.hitTick === curr.tick && p.hitTick !== (q.hitTick ?? -1)) {
          base.sfx('impact_heavy', { vol: 0.8 });
          base.burst('dust', { pos: { x: p.x, y: 0.6, z: p.z }, count: 12 });
        }
        if (!p.alive && (q.alive ?? true)) {
          base.sfx('boo', { vol: 0.6 });
          token.rotation.z = Math.PI / 2; // Floats off on their back.
        }
        token.visible = p.alive || (curr.tick - (p.elimTick ?? 0)) < 60;
        // Blink during post-hit mercy invulnerability.
        if (p.alive && curr.tick < (p.invulnUntil ?? -1)) {
          token.visible = Math.floor(curr.tick / 4) % 2 === 0;
        }
      }

      if (curr.finished && !(prev?.finished ?? false)) {
        base.sfx(curr.soloWon ? 'fanfare' : 'star', { vol: 0.9 });
        base.burst('confetti', { pos: { x: 0, y: 3, z: 0 } });
      }
    }
    base.update(dtRender);
  }

  function dispose() {
    tokens.clear();
    shotMeshes.clear();
    crosshair = null;
    cannonBarrel = null;
    base.dispose();
  }

  return { mount, update, dispose };
}

export default createView;
