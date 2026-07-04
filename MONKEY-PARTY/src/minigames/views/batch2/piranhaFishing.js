/**
 * Piranha Fishing view: monkeys on a dock over dark water, one power
 * meter pillar per angler, bending rods while reeling, and piranhas
 * leaping when landed.
 */

import * as THREE from 'three';
import {
  createViewBase, makePlayerToken, simpleMesh, kitProp, PLAYER_COLORS,
} from '../../viewHarness.js';

export function createView({ sim, engine }) {
  const base = createViewBase({
    engine,
    sim,
    cameraPreset: { pos: [0, 7, 11], look: [0, 1, -2], fov: 50 },
  });
  const tokens = new Map();
  const meters = new Map();
  const rods = new Map();

  function slotX(i, n) {
    return ((i + 0.5) / n - 0.5) * 12;
  }

  function buildArena(state) {
    const n = (state.order ?? []).length || 4;
    const dock = simpleMesh(new THREE.BoxGeometry(Math.max(12, n * 3.2), 0.5, 4), '#8d6e63');
    dock.position.set(0, -0.25, 1);
    base.group.add(dock);
    const water = simpleMesh(new THREE.BoxGeometry(30, 0.3, 14), '#0d4f66');
    water.position.set(0, -0.7, -7);
    base.group.add(water);
    base.withKit((kit) => {
      for (const side of [-1, 1]) {
        const palm = kitProp(kit, 'palm', { scale: 1 })
          ?? simpleMesh(new THREE.ConeGeometry(0.7, 2.6, 6), '#2e7d32');
        palm.position.set(side * (n * 1.9 + 2), 0, 2.4);
        base.group.add(palm);
      }
    });
  }

  function mount(sceneRoot) {
    const state = base.tracker.sample().curr ?? {};
    buildArena(state);
    const n = (state.order ?? []).length || 1;
    (state.order ?? []).forEach((pid, i) => {
      const x = slotX(i, n);
      const token = makePlayerToken(base, {
        id: pid, name: pid, color: PLAYER_COLORS[i % PLAYER_COLORS.length], scale: 0.85,
      });
      token.position.set(x, 0, 1);
      token.rotation.y = Math.PI; // Face the water.
      tokens.set(pid, token);
      base.group.add(token);

      const rod = simpleMesh(new THREE.CylinderGeometry(0.035, 0.05, 2.4, 6), '#4e342e');
      rod.position.set(x + 0.45, 1.4, 0.4);
      rod.rotation.x = -0.7;
      rods.set(pid, rod);
      base.group.add(rod);

      // Power meter pillar behind each angler: fill + shell.
      const fill = simpleMesh(new THREE.BoxGeometry(0.42, 1, 0.42), '#66bb6a',
        { emissive: '#2e7d32', emissiveIntensity: 0.4 });
      fill.position.set(x - 0.9, 0.5, 2.4);
      meters.set(pid, fill);
      base.group.add(fill);
      const shell = simpleMesh(new THREE.BoxGeometry(0.55, 2.6, 0.55), '#263238',
        { transparent: true, opacity: 0.35 });
      shell.position.set(x - 0.9, 1.3, 2.4);
      base.group.add(shell);
    });
    (sceneRoot ?? engine?.scene)?.add(base.group);
    base.applyCamera();
  }

  function update(dtRender, _alpha) {
    const { prev, curr } = base.tracker.sample();
    if (curr) {
      const n = (curr.order ?? []).length || 1;
      (curr.order ?? []).forEach((pid, i) => {
        const p = curr.players[pid];
        const q = prev?.players?.[pid] ?? p;
        const meter = meters.get(pid);
        const rod = rods.get(pid);
        const token = tokens.get(pid);
        if (!p || !meter || !rod || !token) return;

        // Meter fill: height + green->red gradient by power.
        const v = p.phase === 'cast' ? (p.meter ?? 0) : 1;
        meter.scale.y = Math.max(0.05, v * 2.5);
        meter.position.y = (v * 2.5) / 2;
        meter.material.color.setHSL(0.33 - v * 0.28, 0.75, 0.5);

        // Rod bends while reeling; angler wiggles with the fight.
        const reeling = p.phase === 'reel';
        rod.rotation.x = reeling ? -1.15 + Math.sin(curr.tick * 0.4) * 0.1 : -0.7;
        token.rotation.z = reeling ? Math.sin(curr.tick * 0.35) * 0.08 : 0;

        // Event feedback.
        if (p.lastEventTick === curr.tick && p.lastEventTick !== (q.lastEventTick ?? -1)) {
          const x = slotX(i, n);
          if (p.lastEventKind === 'hook') {
            base.sfx('click', { pitch: 1.2 });
            base.burst('splash', { pos: { x, y: -0.4, z: -2.5 }, count: 8 });
          } else if (p.lastEventKind === 'land') {
            base.sfx('coin', { pitch: 0.9 + (p.fishValue ?? 1) * 0.15 });
            base.burst('splash', { pos: { x, y: -0.2, z: -2 } });
            base.burst('coinSparkle', { pos: { x, y: 1.6, z: 0.6 }, count: 8 + (p.fishValue ?? 1) * 6 });
          } else if (p.lastEventKind === 'escape') {
            base.sfx('error', { vol: 0.6 });
            base.burst('splash', { pos: { x, y: -0.4, z: -3 }, count: 6 });
          }
        }
      });
    }
    base.update(dtRender);
  }

  function dispose() {
    tokens.clear();
    meters.clear();
    rods.clear();
    base.dispose();
  }

  return { mount, update, dispose };
}

export default createView;
