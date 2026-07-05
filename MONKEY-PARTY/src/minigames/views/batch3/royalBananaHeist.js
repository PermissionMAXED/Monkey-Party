/**
 * Royal Banana Heist view: a torch-lit throne clearing where a huge
 * gorilla king snores on a golden banana hoard. Monkeys visibly carry
 * stolen bananas to their dens; a wake-o-meter of orbs circles the king,
 * he glows red when he stirs, and caught thieves get zapped in a puff.
 */

import * as THREE from 'three';
import {
  createViewBase, makePlayerToken, simpleMesh, kitProp, lerp, PLAYER_COLORS,
} from '../../viewHarness.js';

const WAKE_ORBS = 10;

export function createView({ sim, engine }) {
  const base = createViewBase({
    engine,
    sim,
    cameraPreset: { pos: [0, 15, 14], look: [0, 0.5, 0], fov: 55 },
  });
  const tokens = new Map();
  const carryBunches = new Map(); // pid -> [banana meshes]
  const denMeshes = new Map(); // pid -> den marker
  const wakeOrbs = [];
  let king = null;
  let kingBody = null;
  let hoardPile = null;

  function buildScene(state) {
    const radius = state.arenaRadius ?? 9.5;

    // Jungle clearing at dusk.
    const floor = simpleMesh(new THREE.CylinderGeometry(radius + 1.2, radius + 1.8, 0.6, 24),
      '#33691e');
    floor.position.y = -0.3;
    base.group.add(floor);

    // Golden banana hoard around the king.
    hoardPile = new THREE.Group();
    for (let i = 0; i < 14; i += 1) {
      const a = (i / 14) * Math.PI * 2;
      const r = 2.4 + (i % 3) * 0.35;
      const nana = simpleMesh(new THREE.TorusGeometry(0.28, 0.09, 6, 10, Math.PI), '#ffe135',
        { emissive: '#ffe135', emissiveIntensity: 0.25 });
      nana.position.set(Math.cos(a) * r, 0.15 + (i % 2) * 0.14, Math.sin(a) * r);
      nana.rotation.set(Math.PI / 2, 0, a);
      hoardPile.add(nana);
    }
    base.group.add(hoardPile);

    // The Gorilla King, snoozing on his throne mound.
    king = new THREE.Group();
    const mound = simpleMesh(new THREE.CylinderGeometry(1.9, 2.2, 0.7, 12), '#5d4037');
    mound.position.y = 0.35;
    king.add(mound);
    kingBody = simpleMesh(new THREE.SphereGeometry(1.25, 12, 10), '#37474f');
    kingBody.position.y = 1.7;
    kingBody.scale.set(1, 0.92, 0.9);
    king.add(kingBody);
    const head = simpleMesh(new THREE.SphereGeometry(0.72, 12, 10), '#455a64');
    head.position.set(0, 2.85, 0.35);
    king.add(head);
    const muzzle = simpleMesh(new THREE.SphereGeometry(0.34, 8, 6), '#90a4ae');
    muzzle.position.set(0, 2.7, 0.95);
    king.add(muzzle);
    for (const side of [-1, 1]) {
      const arm = simpleMesh(new THREE.CapsuleGeometry(0.3, 1, 2, 8), '#37474f');
      arm.rotation.z = side * 1.2;
      arm.position.set(side * 1.25, 1.35, 0.3);
      king.add(arm);
    }
    const crown = simpleMesh(new THREE.CylinderGeometry(0.42, 0.5, 0.34, 8), '#ffd700',
      { emissive: '#ffd700', emissiveIntensity: 0.5, metal: 0.6, rough: 0.3 });
    crown.position.set(0, 3.4, 0.3);
    king.add(crown);
    base.group.add(king);

    // Wake-o-meter: a ring of orbs that light up as the king gets angrier.
    for (let i = 0; i < WAKE_ORBS; i += 1) {
      const a = (i / WAKE_ORBS) * Math.PI * 2;
      const orb = simpleMesh(new THREE.SphereGeometry(0.2, 8, 6), '#4a3b2a',
        { emissive: '#ff5722', emissiveIntensity: 0 });
      orb.position.set(Math.cos(a) * 4.6, 4.6, Math.sin(a) * 4.6);
      wakeOrbs.push(orb);
      base.group.add(orb);
    }

    // Torches around the rim.
    base.withKit((kit) => {
      for (let i = 0; i < 4; i += 1) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const torch = kitProp(kit, 'torch', { withFlickerLight: false })
          ?? simpleMesh(new THREE.ConeGeometry(0.2, 1.6, 5), '#ff9231');
        torch.position.set(Math.cos(a) * (radius + 0.4), 0, Math.sin(a) * (radius + 0.4));
        base.group.add(torch);
      }
    });
  }

  function mount(sceneRoot) {
    const state = base.tracker.sample().curr ?? {};
    buildScene(state);
    (state.order ?? []).forEach((pid, i) => {
      const color = PLAYER_COLORS[i % PLAYER_COLORS.length];
      const p = state.players?.[pid];
      const token = makePlayerToken(base, {
        id: pid, name: pid, color, scale: 0.8,
      });
      // Carried banana bunch floats over the shoulder, one per banana.
      const bunch = [];
      for (let b = 0; b < (state.carryMax ?? 3); b += 1) {
        const nana = simpleMesh(new THREE.TorusGeometry(0.2, 0.07, 6, 10, Math.PI), '#ffe135',
          { emissive: '#ffe135', emissiveIntensity: 0.4 });
        nana.position.set((b - 1) * 0.34, 1.95, -0.2);
        nana.rotation.x = Math.PI / 2;
        nana.visible = false;
        token.add(nana);
        bunch.push(nana);
      }
      carryBunches.set(pid, bunch);
      tokens.set(pid, token);
      base.group.add(token);
      // Den marker at the player's home spot.
      const den = simpleMesh(new THREE.TorusGeometry(1, 0.14, 8, 20), color,
        { emissive: color, emissiveIntensity: 0.5 });
      den.rotation.x = -Math.PI / 2;
      den.position.set(p?.denX ?? 0, 0.06, p?.denZ ?? 0);
      denMeshes.set(pid, den);
      base.group.add(den);
    });
    (sceneRoot ?? engine?.scene)?.add(base.group);
    base.applyCamera();
  }

  function update(dtRender, alpha) {
    const { prev, curr } = base.tracker.sample();
    if (curr) {
      // King mood: gentle snore-breathing asleep, red glow on warn/stir.
      const phase = curr.king?.phase ?? 'sleep';
      if (kingBody) {
        const breathe = 1 + Math.sin(curr.tick * 0.08) * (phase === 'sleep' ? 0.05 : 0.015);
        kingBody.scale.set(1, 0.92 * breathe, 0.9);
        kingBody.material.emissive.set(phase === 'stir' ? '#d32f2f' : '#000000');
        kingBody.material.emissiveIntensity = phase === 'stir' ? 0.55 : 0;
      }
      if (king && phase === 'stir') {
        king.rotation.y = Math.sin(curr.tick * 0.5) * 0.09; // Grumbling shake.
      } else if (king) {
        king.rotation.y *= Math.max(0, 1 - dtRender * 4);
      }
      if (phase === 'warn' && prev && (prev.king?.phase ?? 'sleep') === 'sleep') {
        base.sfx('zap', { vol: 0.55, pitch: 0.6 }); // The warning snort.
        base.burst('smoke', { pos: { x: 0, y: 3.2, z: 1 }, count: 6 });
      }
      if (phase === 'stir' && prev && (prev.king?.phase ?? '') === 'warn') {
        base.sfx('buzzer', { vol: 0.5, pitch: 0.7 });
      }

      // Wake-o-meter orbs.
      const lit = Math.round(((curr.wake ?? 0) / (curr.wakeMax ?? 100)) * WAKE_ORBS);
      wakeOrbs.forEach((orb, i) => {
        orb.material.emissiveIntensity = i < lit ? 1.1 : 0;
      });

      // The hoard visibly shrinks.
      if (hoardPile) {
        const total = (curr.order?.length ?? 2) * 10;
        const f = Math.max(0.15, (curr.hoard ?? total) / total);
        hoardPile.scale.setScalar(0.4 + 0.6 * f);
      }

      // Monkeys, loot and mishaps.
      for (const pid of curr.order ?? []) {
        const token = tokens.get(pid);
        const p = curr.players[pid];
        const q = prev?.players?.[pid] ?? p;
        if (!token || !p) continue;
        token.position.set(lerp(q.x, p.x, alpha), 0, lerp(q.z, p.z, alpha));
        if (Math.hypot(p.vx ?? 0, p.vz ?? 0) > 0.3) {
          token.rotation.y = Math.atan2(p.vx, p.vz);
        }
        // Stunned thieves wobble.
        token.rotation.z = curr.tick < (p.stunUntil ?? -1)
          ? Math.sin(curr.tick * 0.6) * 0.25
          : token.rotation.z * Math.max(0, 1 - dtRender * 6);

        const bunch = carryBunches.get(pid) ?? [];
        bunch.forEach((nana, b) => {
          nana.visible = b < (p.carried ?? 0);
        });

        if (p.grabTick === curr.tick && p.grabTick !== (q.grabTick ?? -1)) {
          base.sfx('pop', { vol: 0.6, pitch: 1.2 });
        }
        if (p.bankTick === curr.tick && p.bankTick !== (q.bankTick ?? -1)) {
          base.sfx('coin', { vol: 0.8 });
          base.burst('bananaBits', { pos: { x: p.denX, y: 1, z: p.denZ }, count: 10 });
        }
        if (p.caughtTick === curr.tick && p.caughtTick !== (q.caughtTick ?? -1)) {
          base.sfx('zap', { vol: 0.85 });
          base.sfx('boo', { vol: 0.4 });
          base.burst('shockwave', { pos: { x: p.x, y: 0.4, z: p.z } });
        }
      }

      if (curr.kingWoke && !(prev?.kingWoke ?? false)) {
        base.sfx('impact_heavy', { vol: 1 });
        base.sfx('boo', { vol: 0.8 });
        base.burst('explosion', { pos: { x: 0, y: 2.5, z: 0 }, count: 26 });
      }
      if (curr.finished && !(prev?.finished ?? false) && !curr.kingWoke) {
        base.sfx('fanfare', { vol: 0.9 });
        base.burst('confetti', { pos: { x: 0, y: 4, z: 0 } });
      }
    }
    base.update(dtRender);
  }

  function dispose() {
    tokens.clear();
    carryBunches.clear();
    denMeshes.clear();
    wakeOrbs.length = 0;
    king = null;
    kingBody = null;
    hoardPile = null;
    base.dispose();
  }

  return { mount, update, dispose };
}

export default createView;
