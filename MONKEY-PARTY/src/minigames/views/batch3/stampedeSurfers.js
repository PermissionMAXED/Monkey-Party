/**
 * Stampede Surfers view: a golden savanna crossing with four dirt run
 * lanes, warning dust plumes at the field edge, charging boars with
 * tusks, and monkeys that hop lanes and leap with a visible jump arc.
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
    cameraPreset: { pos: [0, 14, 14], look: [0, 0, -1], fov: 55 },
  });
  const tokens = new Map();
  const boarMeshes = new Map(); // boar id -> group
  const warnPlumes = new Map(); // boar id -> plume mesh (pre-charge dust)

  const laneZ = (state, lane) => (lane - ((state.lanes ?? 4) - 1) / 2) * (state.laneGap ?? 2.6);

  function buildScene(state) {
    const hw = state.fieldHalfW ?? 9;
    const lanes = state.lanes ?? 4;
    const gap = state.laneGap ?? 2.6;

    // Savanna ground with dirt lanes.
    const ground = simpleMesh(new THREE.BoxGeometry(hw * 2 + 14, 0.5, lanes * gap + 8), '#c9b458');
    ground.position.y = -0.25;
    base.group.add(ground);
    for (let lane = 0; lane < lanes; lane += 1) {
      const strip = simpleMesh(new THREE.BoxGeometry(hw * 2 + 10, 0.06, gap * 0.72), '#b98d4f');
      strip.position.set(0, 0.03, laneZ(state, lane));
      base.group.add(strip);
    }
    // Dry grass tufts between lanes.
    for (let i = 0; i < 10; i += 1) {
      const tuft = simpleMesh(new THREE.ConeGeometry(0.22, 0.6, 5), '#a8a04d');
      tuft.position.set(
        -hw + (i * (hw * 2)) / 9,
        0.3,
        (i % 2 === 0 ? -1 : 1) * (lanes * gap) / 2 + (i % 2 === 0 ? -1 : 1) * 1.2,
      );
      base.group.add(tuft);
    }
    // Acacia-style flat-top trees on the horizon.
    base.withKit((kit) => {
      for (const side of [-1, 1]) {
        const trunk = simpleMesh(new THREE.CylinderGeometry(0.2, 0.3, 2.4, 6), '#6d4c41');
        trunk.position.set(side * (hw + 4.5), 1.2, -(lanes * gap) / 2 - 2.6);
        base.group.add(trunk);
        const crown = simpleMesh(new THREE.CylinderGeometry(2.2, 1.2, 0.8, 8), '#7a8f3c');
        crown.position.set(side * (hw + 4.5), 2.8, -(lanes * gap) / 2 - 2.6);
        base.group.add(crown);
        const rock = kitProp(kit, 'rock', { scale: 1.2 })
          ?? simpleMesh(new THREE.DodecahedronGeometry(0.8, 0), '#8d8468');
        rock.position.set(side * (hw + 3), 0.3, (lanes * gap) / 2 + 2);
        base.group.add(rock);
      }
    });
  }

  function boarGroup() {
    const g = new THREE.Group();
    const body = simpleMesh(new THREE.CapsuleGeometry(0.5, 0.9, 2, 8), '#5d4037');
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.55;
    g.add(body);
    const snout = simpleMesh(new THREE.BoxGeometry(0.42, 0.34, 0.42), '#4e342e');
    snout.position.set(0.95, 0.45, 0);
    g.add(snout);
    for (const side of [-1, 1]) {
      const tusk = simpleMesh(new THREE.ConeGeometry(0.07, 0.32, 5), '#f5f0dc');
      tusk.rotation.z = -Math.PI / 2.4;
      tusk.position.set(1.1, 0.35, side * 0.2);
      g.add(tusk);
    }
    return g;
  }

  function mount(sceneRoot) {
    const state = base.tracker.sample().curr ?? {};
    buildScene(state);
    (state.order ?? []).forEach((pid, i) => {
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
      const hw = curr.fieldHalfW ?? 9;

      // Boars: waiting ones sit at the edge behind a pulsing dust plume.
      const live = new Set();
      for (const boar of curr.boars ?? []) {
        live.add(boar.id);
        let mesh = boarMeshes.get(boar.id);
        if (!mesh) {
          mesh = boarGroup();
          mesh.rotation.y = boar.dir > 0 ? 0 : Math.PI; // Snout faces the charge.
          boarMeshes.set(boar.id, mesh);
          base.group.add(mesh);
          // Telegraph plume at the charge edge.
          const plume = simpleMesh(new THREE.SphereGeometry(0.7, 8, 6), '#d7c08c',
            { transparent: true, opacity: 0.7 });
          plume.position.set(boar.dir > 0 ? -(hw + 2.5) : hw + 2.5, 0.8, laneZ(curr, boar.lane));
          warnPlumes.set(boar.id, plume);
          base.group.add(plume);
          base.sfx('tick', { vol: 0.4, pitch: 0.8 });
        }
        const qb = (prev?.boars ?? []).find((b) => b.id === boar.id) ?? boar;
        mesh.position.set(lerp(qb.x, boar.x, alpha), 0, laneZ(curr, boar.lane));
        const charging = curr.tick >= boar.activeFrom;
        const plume = warnPlumes.get(boar.id);
        if (plume) {
          if (charging) {
            disposeObject(plume);
            warnPlumes.delete(boar.id);
            base.sfx('whoosh', { vol: 0.45, pitch: 0.7 });
          } else {
            plume.scale.setScalar(1 + Math.abs(Math.sin(curr.tick * 0.3)) * 0.5);
          }
        }
        if (charging) {
          mesh.position.y = Math.abs(Math.sin(curr.tick * 0.6 + boar.id)) * 0.12; // Gallop.
        }
      }
      for (const [id, mesh] of boarMeshes) {
        if (!live.has(id)) {
          disposeObject(mesh);
          boarMeshes.delete(id);
          const plume = warnPlumes.get(id);
          if (plume) {
            disposeObject(plume);
            warnPlumes.delete(id);
          }
        }
      }

      // Monkeys: lane hops ease, jumps arc, hits flash.
      for (const pid of curr.order ?? []) {
        const token = tokens.get(pid);
        const p = curr.players[pid];
        const q = prev?.players?.[pid] ?? p;
        if (!token || !p) continue;
        const targetZ = laneZ(curr, p.lane);
        token.position.x = lerp(q.x, p.x, alpha);
        token.position.z += (targetZ - token.position.z) * Math.min(1, dtRender * 14);
        // Jump arc while airborne.
        if (curr.tick <= (p.airUntil ?? -1)) {
          const total = 13;
          const remain = p.airUntil - curr.tick;
          const f = 1 - remain / total;
          token.position.y = Math.sin(Math.PI * Math.max(0, Math.min(1, f))) * 1.35;
        } else {
          token.position.y = Math.max(0, token.position.y - dtRender * 6);
        }
        if ((p.airUntil ?? -1) > (q.airUntil ?? -1)) {
          base.sfx('jump', { vol: 0.5 });
        }
        if (p.hitTick === curr.tick && p.hitTick !== (q.hitTick ?? -1)) {
          base.sfx('impact_heavy', { vol: 0.85 });
          base.burst('dust', { pos: { x: p.x, y: 0.5, z: targetZ }, count: 14 });
        }
        if (!p.alive && (q.alive ?? true)) {
          base.sfx('boo', { vol: 0.6 });
          token.rotation.z = Math.PI / 2;
        }
        token.visible = p.alive || (curr.tick - (p.elimTick ?? 0)) < 50;
        if (p.alive && curr.tick < (p.invulnUntil ?? -1)) {
          token.visible = Math.floor(curr.tick / 4) % 2 === 0; // Mercy blink.
        }
      }

      if (curr.finished && !(prev?.finished ?? false)) {
        base.sfx('fanfare', { vol: 0.9 });
        base.burst('confetti', { pos: { x: 0, y: 3, z: 0 } });
      }
    }
    base.update(dtRender);
  }

  function dispose() {
    tokens.clear();
    boarMeshes.clear();
    warnPlumes.clear();
    base.dispose();
  }

  return { mount, update, dispose };
}

export default createView;
