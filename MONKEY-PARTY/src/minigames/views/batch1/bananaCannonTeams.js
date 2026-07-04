/**
 * Banana Cannon Teams view: two wooden cannons on a beach firing banana
 * shells at parrot-ring targets gliding along a sky wall; loader pumps and
 * hits get chunky feedback, team score bars live in the HUD.
 */

import * as THREE from 'three';
import {
  createViewBase, makePlayerToken, simpleMesh, kitProp, lerp, PLAYER_COLORS,
  disposeObject,
} from '../../viewHarness.js';

const TEAM_COLORS = ['#42a5f5', '#ff7043'];

export function createView({ sim, engine }) {
  const base = createViewBase({
    engine,
    sim,
    cameraPreset: { pos: [0, 7, 15], look: [0, 4, -8], fov: 60 },
  });
  const tokens = new Map();
  const cannons = [];
  const targetMeshes = [];
  const projMeshes = new Map();

  function buildCannon(teamIdx, x) {
    const g = new THREE.Group();
    g.position.set(x, 0, 6);
    const barrel = simpleMesh(new THREE.CylinderGeometry(0.35, 0.5, 2.4, 10), '#5d4037');
    barrel.position.y = 1.4;
    barrel.rotation.x = -0.5;
    const pivot = new THREE.Group();
    pivot.add(barrel);
    pivot.position.y = 0.4;
    g.add(pivot);
    const carriage = simpleMesh(new THREE.BoxGeometry(1.6, 0.7, 1.6), TEAM_COLORS[teamIdx]);
    carriage.position.y = 0.35;
    g.add(carriage);
    for (const side of [-1, 1]) {
      const wheel = simpleMesh(new THREE.CylinderGeometry(0.45, 0.45, 0.2, 10), '#3e2723');
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(side * 0.9, 0.45, 0.5);
      g.add(wheel);
    }
    const loadLamp = simpleMesh(new THREE.IcosahedronGeometry(0.18, 0), '#777777',
      { emissive: '#333333', emissiveIntensity: 0.4 });
    loadLamp.position.set(0, 1.1, 0.9);
    g.add(loadLamp);
    base.group.add(g);
    return { group: g, pivot, loadLamp };
  }

  function buildArena(state) {
    const sand = simpleMesh(new THREE.BoxGeometry(34, 0.5, 18), '#e8d1a0');
    sand.position.set(0, -0.25, 2);
    base.group.add(sand);

    // Sky wall the targets glide across.
    const wall = simpleMesh(new THREE.BoxGeometry(32, 12, 0.4), '#7fb7d9',
      { transparent: true, opacity: 0.35 });
    wall.position.set(0, 6, -8);
    base.group.add(wall);

    (state.teams ?? []).forEach((team, i) => cannons.push(buildCannon(i, team.x ?? (i === 0 ? -5 : 5))));

    for (let i = 0; i < (state.targets?.length ?? 3); i += 1) {
      const ring = simpleMesh(new THREE.TorusGeometry(1, 0.18, 6, 14), '#ffe135',
        { emissive: '#8a6a00', emissiveIntensity: 0.4 });
      base.group.add(ring);
      targetMeshes.push(ring);
    }

    base.withKit((kit) => {
      for (const side of [-1, 1]) {
        const palm = kitProp(kit, 'palm', { scale: 1.1 })
          ?? simpleMesh(new THREE.ConeGeometry(0.7, 2.6, 6), '#2e7d32');
        palm.position.set(side * 14, 0, 4);
        base.group.add(palm);
      }
      const crate = kitProp(kit, 'crate', { scale: 0.8 });
      if (crate) {
        crate.position.set(0, 0, 8);
        base.group.add(crate);
      }
    });
  }

  function mount(sceneRoot) {
    const state = base.tracker.sample().curr ?? {};
    buildArena(state);
    (state.order ?? []).forEach((pid, i) => {
      const teamIdx = state.players?.[pid]?.team ?? (i < 2 ? 0 : 1);
      const token = makePlayerToken(base, {
        id: pid, name: pid, color: TEAM_COLORS[teamIdx] ?? PLAYER_COLORS[i], scale: 0.85,
      });
      const teamX = state.teams?.[teamIdx]?.x ?? (teamIdx === 0 ? -5 : 5);
      token.position.set(teamX + (i % 2 === 0 ? -1.6 : 1.6), 0, 7.5);
      tokens.set(pid, token);
      base.group.add(token);
    });
    (sceneRoot ?? engine?.scene)?.add(base.group);
    base.applyCamera();
  }

  function update(dtRender, alpha) {
    const { prev, curr } = base.tracker.sample();
    if (curr) {
      // Cannons: aim + load lamp; players cluster by role.
      (curr.teams ?? []).forEach((team, i) => {
        const cannon = cannons[i];
        if (!cannon) return;
        const qTeam = prev?.teams?.[i] ?? team;
        cannon.pivot.rotation.z = -lerp(qTeam.angle, team.angle, alpha);
        const lamp = cannon.loadLamp.material;
        lamp.emissive = new THREE.Color(team.loaded ? '#39d353' : '#333333');
        lamp.emissiveIntensity = team.loaded ? 1.6 : 0.4;
        if ((qTeam.pumps ?? 0) < team.pumps) base.sfx('click', { pitch: 0.8 + team.pumps * 0.2 });
        if (qTeam.loaded === false && team.loaded === true) base.sfx('buy', { vol: 0.5 });

        // Shooter stands at the cannon, loader behind it.
        const shooter = team.members[curr.rolePhase % 2];
        const loader = team.members[1 - (curr.rolePhase % 2)];
        const shooterToken = tokens.get(shooter);
        const loaderToken = tokens.get(loader);
        if (shooterToken) shooterToken.position.set(team.x + 1.4, 0, 6);
        if (loaderToken) loaderToken.position.set(team.x - 1.4, 0, 7.2);
      });

      // Targets.
      (curr.targets ?? []).forEach((target, i) => {
        const mesh = targetMeshes[i];
        if (!mesh) return;
        const qt = prev?.targets?.[i] ?? target;
        mesh.position.set(lerp(qt.x, target.x, alpha), lerp(qt.y, target.y, alpha), -8);
        mesh.scale.setScalar(target.radius);
        mesh.rotation.y += dtRender * 2;
      });

      // Projectiles (pooled by id).
      const live = new Set();
      for (const proj of curr.projectiles ?? []) {
        live.add(proj.id);
        let mesh = projMeshes.get(proj.id);
        if (!mesh) {
          mesh = simpleMesh(new THREE.SphereGeometry(0.3, 8, 6), '#ffe135');
          projMeshes.set(proj.id, mesh);
          base.group.add(mesh);
          base.sfx('pop', { pitch: 1.3 });
          base.burst('dust', { pos: { x: proj.x, y: 1.4, z: 6 }, count: 6 });
        }
        const qp = (prev?.projectiles ?? []).find((p) => p.id === proj.id) ?? proj;
        // Map sim (x, y-progress) onto the beach->wall flight path.
        const k = Math.min(1, proj.y / 12);
        mesh.position.set(
          lerp(qp.x, proj.x, alpha),
          1.2 + lerp(qp.y, proj.y, alpha) * 0.55,
          6 - k * 14,
        );
      }
      for (const [id, mesh] of projMeshes) {
        if (!live.has(id)) {
          disposeObject(mesh);
          projMeshes.delete(id);
        }
      }

      // Hit fanfare.
      if (curr.lastHit && curr.lastHit.tick === curr.tick
        && curr.lastHit.tick !== (prev?.lastHit?.tick ?? -1)) {
        base.sfx('star', { vol: 0.7, pitch: 0.9 + curr.lastHit.value * 0.15 });
        base.burst('confetti', { pos: { x: 0, y: 6, z: -8 }, count: 30 });
      }
    }
    base.update(dtRender);
  }

  function dispose() {
    tokens.clear();
    cannons.length = 0;
    targetMeshes.length = 0;
    projMeshes.clear();
    base.dispose();
  }

  return { mount, update, dispose };
}

export default createView;
