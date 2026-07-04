/**
 * Shared targetShoot view (serves every variant): monkeys line up on a
 * firing platform facing a target wall where seeded discs glide back and
 * forth (small = shiny = 3 points). Each player steers a colored ring
 * crosshair; shots draw a quick tracer from the muzzle and hits pop the
 * target with an accent burst. Flicker variants blink targets in and out.
 *
 * Reads def.params.theme ({palette, propSet, skyColor}) so balloon_blitz,
 * robo_ducks, barrel_targets, snow_snipe, funfair_frenzy and night_ops
 * all read as different shooting galleries.
 */

import * as THREE from 'three';
import {
  createViewBase, makePlayerToken, simpleMesh, kitProp, lerp, PLAYER_COLORS,
  disposeObject,
} from '../../viewHarness.js';

const PROPS_BY_SET = {
  jungle: ['palm', 'bush'],
  volcano: ['rock', 'torch'],
  city: ['crate', 'platform'],
  ice: ['ice_spike'],
  ghost: ['statue', 'torch'],
  factory: ['gear', 'crate'],
};

const TEAM_HEX = ['#ffca28', '#ef5350'];

export function createView({ sim, engine, def }) {
  const theme = def?.params?.theme ?? {};
  const accent = theme.palette?.accent ?? '#ffe135';
  const base = createViewBase({
    engine,
    sim,
    cameraPreset: { pos: [0, 6.5, 9], look: [0, 4, -16] },
  });
  const tokens = new Map();
  const crosshairs = new Map();
  const targetMeshes = new Map(); // id -> mesh
  const tracers = []; // { line, ttl }
  let wallZ = -16;

  function targetColor(value) {
    return value >= 3 ? accent : value === 2 ? '#ff7043' : theme.palette?.secondary ?? '#8d6e63';
  }

  function makeTargetMesh(target) {
    const mesh = simpleMesh(
      new THREE.CylinderGeometry(target.radius, target.radius, 0.18, 18),
      targetColor(target.value),
      { emissive: target.value >= 3 ? accent : '#000000', emissiveIntensity: 0.5 },
    );
    mesh.rotation.x = Math.PI / 2;
    const pip = simpleMesh(new THREE.CylinderGeometry(target.radius * 0.3, target.radius * 0.3, 0.2, 12), '#ffffff');
    pip.position.y = 0.02;
    mesh.add(pip);
    return mesh;
  }

  function buildArena(state) {
    wallZ = -(state.wallDistance ?? 16);
    const halfW = (state.fieldHalfWidth ?? 12) + 3;
    const deck = simpleMesh(new THREE.BoxGeometry(halfW * 2, 0.6, 8), theme.palette?.primary ?? '#2e7d32');
    deck.position.set(0, -0.3, 1);
    base.group.add(deck);
    const wall = simpleMesh(new THREE.BoxGeometry(halfW * 2, 11, 0.5), theme.palette?.secondary ?? '#8d6e63');
    wall.position.set(0, 4.5, wallZ - 0.5);
    base.group.add(wall);
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(70, 12, 8),
      new THREE.MeshBasicMaterial({ color: theme.skyColor ?? '#87ceeb', side: THREE.BackSide }),
    );
    sky.material.userData.__mgOwned = true;
    base.group.add(sky);
    const names = PROPS_BY_SET[theme.propSet] ?? PROPS_BY_SET.jungle;
    base.withKit((kit) => {
      for (let i = 0; i < 5; i += 1) {
        const prop = kitProp(kit, names[i % names.length], { scale: 0.9 + (i % 3) * 0.2 })
          ?? simpleMesh(new THREE.IcosahedronGeometry(0.6, 0), theme.palette?.secondary ?? '#8d6e63');
        prop.position.set(-halfW + (i / 4) * halfW * 2, 0, 4.5);
        base.group.add(prop);
      }
    });
  }

  function seatColor(state, pid, i) {
    const p = state.players?.[pid];
    if (state.mode === '1v3' && p) return TEAM_HEX[p.team];
    return PLAYER_COLORS[i % PLAYER_COLORS.length];
  }

  function mount(sceneRoot) {
    const state = base.tracker.sample().curr ?? {};
    buildArena(state);
    (state.order ?? []).forEach((pid, i) => {
      const color = seatColor(state, pid, i);
      const token = makePlayerToken(base, { id: pid, name: pid, color, scale: 0.8 });
      const p = state.players?.[pid];
      token.position.set(p?.lineX ?? 0, 0, 0.5);
      tokens.set(pid, token);
      base.group.add(token);

      const ring = simpleMesh(new THREE.TorusGeometry(0.45, 0.06, 8, 20), color,
        { emissive: color, emissiveIntensity: 0.9 });
      ring.position.set(p?.ax ?? 0, p?.ay ?? 4, wallZ + 0.3);
      crosshairs.set(pid, ring);
      base.group.add(ring);
    });
    (sceneRoot ?? engine?.scene)?.add(base.group);
    base.applyCamera();
  }

  function fireTracer(from, to, color) {
    const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
    material.userData.__mgOwned = true;
    const line = new THREE.Line(geometry, material);
    base.group.add(line);
    tracers.push({ line, ttl: 0.12 });
  }

  function update(dtRender, alpha) {
    const { prev, curr } = base.tracker.sample();
    if (curr) {
      // Targets: create/update/remove and apply flicker visibility.
      const seen = new Set();
      for (const target of curr.targets ?? []) {
        seen.add(target.id);
        let mesh = targetMeshes.get(target.id);
        if (!mesh) {
          mesh = makeTargetMesh(target);
          targetMeshes.set(target.id, mesh);
          base.group.add(mesh);
        }
        const qt = (prev?.targets ?? []).find((x) => x.id === target.id);
        mesh.position.set(lerp(qt?.x ?? target.x, target.x, alpha), target.y, wallZ + 0.2);
        mesh.visible = target.visible !== false;
      }
      for (const [id, mesh] of targetMeshes) {
        if (!seen.has(id)) {
          // Popped: burst where it was, then drop the mesh.
          base.burst({ colors: [accent], spread: 0.8, up: 1.4, life: 0.5, size: 0.13, count: 14 },
            { pos: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z } });
          disposeObject(mesh);
          targetMeshes.delete(id);
        }
      }

      (curr.order ?? []).forEach((pid, i) => {
        const p = curr.players[pid];
        const q = prev?.players?.[pid] ?? p;
        const ring = crosshairs.get(pid);
        const token = tokens.get(pid);
        if (!p || !ring || !token) return;
        ring.position.x = lerp(q.ax, p.ax, alpha);
        ring.position.y = lerp(q.ay, p.ay, alpha);
        // Dim the ring while the trigger cools down.
        ring.material.emissiveIntensity = curr.tick < p.cooldownUntil ? 0.25 : 0.9;

        if (p.lastShot && p.lastShot.tick === curr.tick
          && p.lastShot.tick !== (q.lastShot?.tick ?? -1)) {
          const muzzle = new THREE.Vector3(token.position.x, 1.2, token.position.z);
          const impact = new THREE.Vector3(p.lastShot.ax, p.lastShot.ay, wallZ + 0.25);
          fireTracer(muzzle, impact, seatColor(curr, pid, i));
          base.sfx(p.lastShot.hit ? 'pop' : 'thud', { vol: p.lastShot.hit ? 0.7 : 0.4 });
          if (p.lastShot.hit) {
            base.burst({
              colors: [accent, '#ffffff'], spread: 0.7, up: 1.2, life: 0.5,
              size: 0.12, count: 10 + p.lastShot.value * 4,
            }, { pos: { x: impact.x, y: impact.y, z: impact.z } });
          }
          // Recoil hop.
          token.position.y = 0.18;
        }
        token.position.y = THREE.MathUtils.lerp(token.position.y, 0, Math.min(1, dtRender * 10));
      });
    }

    // Age out tracers.
    for (let i = tracers.length - 1; i >= 0; i -= 1) {
      tracers[i].ttl -= dtRender;
      tracers[i].line.material.opacity = Math.max(0, tracers[i].ttl / 0.12);
      if (tracers[i].ttl <= 0) {
        disposeObject(tracers[i].line);
        tracers.splice(i, 1);
      }
    }
    base.update(dtRender);
  }

  function dispose() {
    tokens.clear();
    crosshairs.clear();
    targetMeshes.clear();
    tracers.length = 0;
    base.dispose();
  }

  return { mount, update, dispose };
}

export default createView;
