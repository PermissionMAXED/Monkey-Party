/**
 * Barrel Blast Arena view: a barrel-ringed platform floating over water
 * that visibly shrinks, with dash whooshes, brace stances, and big
 * splash-outs (plus camera shake on eliminations).
 */

import * as THREE from 'three';
import {
  createViewBase, makePlayerToken, simpleMesh, kitProp, lerp, PLAYER_COLORS,
} from '../../viewHarness.js';

export function createView({ sim, engine }) {
  const base = createViewBase({
    engine,
    sim,
    cameraPreset: { pos: [0, 14, 12], look: [0, 0, 0] },
  });
  const tokens = new Map();
  let platform = null;
  let rim = null;
  let startRadius = 8.5;
  let shakeTime = 0;

  function buildArena(state) {
    startRadius = state.radius ?? 8.5;

    const water = simpleMesh(new THREE.CylinderGeometry(startRadius * 2.4, startRadius * 2.4, 0.2, 24),
      '#2277aa', { transparent: true, opacity: 0.85, rough: 0.4 });
    water.position.y = -1.6;
    base.group.add(water);

    platform = simpleMesh(new THREE.CylinderGeometry(1, 1.08, 0.9, 28), '#a9746e');
    platform.position.y = -0.45;
    platform.scale.set(startRadius, 1, startRadius);
    base.group.add(platform);

    rim = new THREE.Group();
    base.withKit((kit) => {
      for (let i = 0; i < 10; i += 1) {
        const a = (i / 10) * Math.PI * 2;
        const barrel = kitProp(kit, 'crate', { scale: 0.7 })
          ?? simpleMesh(new THREE.CylinderGeometry(0.4, 0.4, 0.8, 8), '#7a5230');
        barrel.position.set(Math.cos(a), 0, Math.sin(a));
        rim.add(barrel);
      }
    });
    base.group.add(rim);
  }

  function mount(sceneRoot) {
    const state = base.tracker.sample().curr ?? {};
    buildArena(state);
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
      // Platform mirrors the shrinking sim radius; barrels ride the edge.
      const r = curr.radius ?? startRadius;
      if (platform) platform.scale.set(r, 1, r);
      if (rim) {
        rim.children.forEach((barrel, i) => {
          const a = (i / rim.children.length) * Math.PI * 2;
          barrel.position.set(Math.cos(a) * (r + 0.6), 0, Math.sin(a) * (r + 0.6));
        });
      }

      for (const pid of curr.order ?? []) {
        const token = tokens.get(pid);
        const p = curr.players[pid];
        const q = prev?.players?.[pid] ?? p;
        if (!token || !p) continue;

        if (!p.alive) {
          if (q.alive) {
            // Splash out!
            base.sfx('splash');
            base.burst('splash', { pos: { x: p.x, y: 0.4, z: p.z } });
            shakeTime = 0.35; // Quick camera shake.
          }
          token.position.y = Math.max(token.position.y - dtRender * 6, -3.2);
          token.rotation.x += dtRender * 3;
          continue;
        }

        token.position.set(lerp(q.x, p.x, alpha), 0, lerp(q.z, p.z, alpha));
        const speed = Math.hypot(p.vx ?? 0, p.vz ?? 0);
        if (speed > 0.2) token.rotation.y = Math.atan2(p.vx, p.vz);
        // Brace = crouch; dash = lean.
        const crouch = p.bracing ? 0.75 : 1;
        token.scale.y += (crouch - token.scale.y) * Math.min(1, dtRender * 10);
        token.rotation.x = curr.tick < (p.dashUntil ?? -1) ? -0.35 : 0;

        if ((q.dashUntil ?? -1) < (p.dashUntil ?? -1)) {
          base.sfx('whoosh', { vol: 0.8 });
          base.burst('dust', { pos: { x: p.x, y: 0.3, z: p.z }, count: 8 });
        }
        if (p.lastHitTick === curr.tick && p.lastHitTick !== (q.lastHitTick ?? -1)) {
          base.sfx('drum', { pitch: 1.3, vol: 0.8 });
        }
      }

      // Decaying elimination shake on top of the preset camera pose.
      const cam = engine?.camera;
      if (cam) {
        if (shakeTime > 0) {
          shakeTime = Math.max(0, shakeTime - dtRender);
          const k = shakeTime * 0.8;
          cam.position.set(
            (Math.random() * 2 - 1) * k,
            14 + (Math.random() * 2 - 1) * k * 0.5,
            12 + (Math.random() * 2 - 1) * k,
          );
        } else {
          cam.position.set(0, 14, 12);
        }
        cam.lookAt(0, 0, 0);
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
