/**
 * Shared dodgeRain view (serves every variant): a shrinking arena disc,
 * pulsing telegraph rings on the ground, themed projectiles plunging in
 * from the sky and impact bursts when they land. Eliminated monkeys are
 * knocked flat and fade out of play.
 *
 * Reads def.params.theme ({palette, propSet, skyColor}); the propSet also
 * picks the projectile look (coconuts, meteors, icicles, ghosts, gears,
 * confetti) so coconut_rain and meteor_madness feel nothing alike.
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

function makeProjectile(propSet, radius) {
  const s = Math.max(0.3, radius * 0.4);
  switch (propSet) {
    case 'volcano':
      return simpleMesh(new THREE.IcosahedronGeometry(s, 0), '#ff7043',
        { emissive: '#ff3d00', emissiveIntensity: 0.9 });
    case 'ice':
      return simpleMesh(new THREE.ConeGeometry(s * 0.7, s * 2.6, 6), '#e1f5fe',
        { emissive: '#4fc3f7', emissiveIntensity: 0.25 });
    case 'ghost':
      return simpleMesh(new THREE.SphereGeometry(s, 10, 8), '#b39ddb',
        { transparent: true, opacity: 0.65, emissive: '#7e57c2', emissiveIntensity: 0.5 });
    case 'factory':
      return simpleMesh(new THREE.CylinderGeometry(s, s, s * 0.5, 8), '#90a4ae',
        { metal: 0.6, rough: 0.4 });
    case 'city':
      return simpleMesh(new THREE.BoxGeometry(s * 1.2, s * 1.2, s * 1.2), '#ffee58',
        { emissive: '#f06292', emissiveIntensity: 0.4 });
    default:
      return simpleMesh(new THREE.SphereGeometry(s, 10, 8), '#6d4c41');
  }
}

export function createView({ sim, engine, def }) {
  const theme = def?.params?.theme ?? {};
  const accent = theme.palette?.accent ?? '#ffe135';
  const propSet = theme.propSet ?? 'jungle';
  const base = createViewBase({
    engine,
    sim,
    cameraPreset: { pos: [0, 14, 12], look: [0, 0, 0] },
  });
  const tokens = new Map();
  const hazardMeshes = new Map(); // id -> { ring, proj, impactTick, spawnTick }
  let floor = null;
  let floorRadius = 8;

  function buildArena(state) {
    floorRadius = state.arenaRadius ?? 8;
    floor = simpleMesh(
      new THREE.CylinderGeometry(1, 1.08, 0.6, 28),
      theme.palette?.primary ?? '#2e7d32',
    );
    floor.scale.set(floorRadius, 1, floorRadius);
    floor.position.y = -0.3;
    base.group.add(floor);

    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(60, 12, 8),
      new THREE.MeshBasicMaterial({ color: theme.skyColor ?? '#87ceeb', side: THREE.BackSide }),
    );
    sky.material.userData.__mgOwned = true;
    base.group.add(sky);

    const names = PROPS_BY_SET[propSet] ?? PROPS_BY_SET.jungle;
    base.withKit((kit) => {
      for (let i = 0; i < 7; i += 1) {
        const a = (i / 7) * Math.PI * 2 + 0.4;
        const prop = kitProp(kit, names[i % names.length], { scale: 0.9 + (i % 3) * 0.2 })
          ?? simpleMesh(new THREE.IcosahedronGeometry(0.6, 0), theme.palette?.secondary ?? '#8d6e63');
        prop.position.set(Math.cos(a) * (floorRadius + 2.6), 0, Math.sin(a) * (floorRadius + 2.6));
        base.group.add(prop);
      }
    });
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

  function syncHazards(curr) {
    const seen = new Set();
    for (const hz of curr.hazards ?? []) {
      seen.add(hz.id);
      let entry = hazardMeshes.get(hz.id);
      if (!entry) {
        const ring = simpleMesh(new THREE.RingGeometry(hz.radius * 0.7, hz.radius, 24), accent,
          { emissive: accent, emissiveIntensity: 0.7, transparent: true, opacity: 0.8 });
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(hz.x, 0.06, hz.z);
        const proj = makeProjectile(propSet, hz.radius);
        proj.position.set(hz.x, 16, hz.z);
        base.group.add(ring, proj);
        entry = {
          ring, proj, impactTick: hz.impactTick, spawnTick: curr.tick, exploded: false,
        };
        hazardMeshes.set(hz.id, entry);
      }
      // Projectile plunges so it lands exactly on the impact tick.
      const total = Math.max(1, entry.impactTick - entry.spawnTick);
      const fall = Math.min(1, (curr.tick - entry.spawnTick) / total);
      entry.proj.position.y = Math.max(0.2, 16 * (1 - fall * fall));
      entry.ring.material.opacity = 0.45 + 0.4 * Math.sin(curr.tick * 0.4);
      if (hz.exploded && !entry.exploded) {
        entry.exploded = true;
        base.burst({
          colors: [accent, theme.palette?.secondary ?? '#8d6e63'],
          spread: hz.radius, up: 2.2, life: 0.6, size: 0.13, count: 18,
        }, { pos: { x: hz.x, y: 0.3, z: hz.z } });
        base.sfx('thud', { vol: 0.6 });
      }
    }
    for (const [id, entry] of hazardMeshes) {
      if (!seen.has(id)) {
        disposeObject(entry.ring);
        disposeObject(entry.proj);
        hazardMeshes.delete(id);
      }
    }
  }

  function update(dtRender, alpha) {
    const { prev, curr } = base.tracker.sample();
    if (curr) {
      // Shrinking safe ground.
      const r = curr.arenaRadius ?? floorRadius;
      if (floor) {
        floor.scale.x = lerp(floor.scale.x, r, Math.min(1, dtRender * 4));
        floor.scale.z = floor.scale.x;
      }
      syncHazards(curr);

      for (const pid of curr.order ?? []) {
        const token = tokens.get(pid);
        const p = curr.players[pid];
        const q = prev?.players?.[pid] ?? p;
        if (!token || !p) continue;
        token.position.x = lerp(q.x, p.x, alpha);
        token.position.z = lerp(q.z, p.z, alpha);
        const speed = Math.hypot(p.vx ?? 0, p.vz ?? 0);
        if (p.alive && speed > 0.2) token.rotation.y = Math.atan2(p.vx, p.vz);
        if (!p.alive) {
          // Knocked flat, sinking away.
          const since = curr.tick - p.elimTick;
          token.rotation.x = THREE.MathUtils.lerp(token.rotation.x, -Math.PI / 2, Math.min(1, dtRender * 6));
          token.position.y = Math.max(-2, -since * 0.02);
        } else if (p.hitTick > 0 && curr.tick - p.hitTick < 10) {
          token.position.y = Math.sin(((curr.tick - p.hitTick) / 10) * Math.PI) * 0.5;
        } else {
          token.position.y = 0;
        }
        if (!p.alive && (q.alive ?? true)) {
          base.burst({ colors: ['#ef5350'], spread: 1, up: 2, life: 0.7, size: 0.14, count: 16 },
            { pos: { x: p.x, y: 0.6, z: p.z } });
          base.sfx('buzz', { vol: 0.7 });
        }
      }
    }
    base.update(dtRender);
  }

  function dispose() {
    tokens.clear();
    hazardMeshes.clear();
    base.dispose();
  }

  return { mount, update, dispose };
}

export default createView;
