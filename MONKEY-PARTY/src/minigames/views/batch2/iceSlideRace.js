/**
 * Ice Slide Race view: a long frosted piste with slalom gate flags
 * (golden boost gates glow), a finish banner and drifting monkeys that
 * lean into their slides.
 */

import * as THREE from 'three';
import {
  createViewBase, makePlayerToken, simpleMesh, kitProp, lerp, PLAYER_COLORS,
} from '../../viewHarness.js';

export function createView({ sim, engine }) {
  const base = createViewBase({
    engine,
    sim,
    cameraPreset: { pos: [0, 26, -16], look: [0, 0, 30], fov: 55 },
  });
  const tokens = new Map();

  function gatePair(gate) {
    const group = new THREE.Group();
    const color = gate.boost ? '#ffd54f' : '#ef5350';
    for (const side of [-1, 1]) {
      const pole = simpleMesh(new THREE.CylinderGeometry(0.09, 0.09, 2.2, 6), color,
        gate.boost ? { emissive: '#ffb300', emissiveIntensity: 0.8 } : {});
      pole.position.set(gate.x + side * gate.halfWidth, 1.1, gate.z);
      group.add(pole);
      const flag = simpleMesh(new THREE.ConeGeometry(0.22, 0.5, 4), color);
      flag.position.set(gate.x + side * gate.halfWidth, 2.35, gate.z);
      group.add(flag);
    }
    return group;
  }

  function buildCourse(state) {
    const length = state.courseLength ?? 70;
    const halfW = state.trackHalfWidth ?? 8;
    const piste = simpleMesh(new THREE.BoxGeometry(halfW * 2 + 2, 0.4, length + 14), '#dbeefc');
    piste.position.set(0, -0.2, length / 2);
    base.group.add(piste);
    for (const side of [-1, 1]) {
      const bank = simpleMesh(new THREE.BoxGeometry(0.8, 1, length + 14), '#f4fbff');
      bank.position.set(side * (halfW + 1.2), 0.3, length / 2);
      base.group.add(bank);
    }
    for (const gate of state.gates ?? []) base.group.add(gatePair(gate));

    const banner = simpleMesh(new THREE.BoxGeometry(halfW * 2, 0.5, 0.3), '#66bb6a',
      { emissive: '#2e7d32', emissiveIntensity: 0.5 });
    banner.position.set(0, 2.6, length);
    base.group.add(banner);

    base.withKit((kit) => {
      for (let i = 0; i < 6; i += 1) {
        const spike = kitProp(kit, 'iceSpike', { scale: 0.9 })
          ?? simpleMesh(new THREE.ConeGeometry(0.5, 1.8, 5), '#bfe3f7');
        const side = i % 2 === 0 ? -1 : 1;
        spike.position.set(side * (halfW + 2.4), 0, 8 + i * 11);
        base.group.add(spike);
      }
    });
  }

  function mount(sceneRoot) {
    const state = base.tracker.sample().curr ?? {};
    buildCourse(state);
    (state.order ?? []).forEach((pid, i) => {
      const token = makePlayerToken(base, {
        id: pid, name: pid, color: PLAYER_COLORS[i % PLAYER_COLORS.length], scale: 0.9,
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
      for (const pid of curr.order ?? []) {
        const token = tokens.get(pid);
        const p = curr.players[pid];
        const q = prev?.players?.[pid] ?? p;
        if (!token || !p) continue;
        token.position.set(lerp(q.x, p.x, alpha), 0, lerp(q.z, p.z, alpha));
        token.rotation.y = Math.atan2(p.vx ?? 0, Math.max(0.6, p.vz ?? 0.6));
        token.rotation.z = -(p.vx ?? 0) * 0.06; // Lean into the drift.

        if (p.boostTick === curr.tick && p.boostTick !== (q.boostTick ?? -1)) {
          base.sfx('boost', { vol: 0.8 });
          base.burst('coinSparkle', { pos: { x: p.x, y: 0.8, z: p.z }, count: 12 });
        }
        if (p.missTick === curr.tick && p.missTick !== (q.missTick ?? -1)) {
          base.sfx('error', { vol: 0.6 });
          base.burst('dust', { pos: { x: p.x, y: 0.4, z: p.z }, count: 8 });
        }
        if (p.wallTick === curr.tick && p.wallTick !== (q.wallTick ?? -1)) {
          base.sfx('thud', { vol: 0.4 });
        }
        if (p.finished && !(q.finished ?? false)) {
          base.sfx('fanfare', { vol: 0.8 });
          base.burst('confetti', { pos: { x: p.x, y: 2, z: p.z } });
        }
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
