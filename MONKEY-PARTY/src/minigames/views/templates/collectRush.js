/**
 * Shared collectRush view (serves every variant): a circular arena strewn
 * with themed pickups (bananas, coins, gems, gears, wisps...). Shiny
 * 3-pointers glow, booby-trapped ones wobble suspiciously, and grabbing
 * pops a burst in the theme accent. Stunned monkeys wobble in place with
 * their heads spinning.
 *
 * Reads def.params.theme ({palette, propSet, skyColor}) so banana_bonanza,
 * coin_dive, gem_grab_teams, magnet_mayhem, dark_harvest and golden_rush
 * each get their own arena and loot.
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

const PICKUP_KIT_BY_SET = {
  jungle: 'banana',
  volcano: 'golden_banana',
  city: 'coin',
  factory: 'gear',
};

const TEAM_HEX = ['#42a5f5', '#ef5350'];

export function createView({ sim, engine, def }) {
  const theme = def?.params?.theme ?? {};
  const accent = theme.palette?.accent ?? '#ffe135';
  const propSet = theme.propSet ?? 'jungle';
  const base = createViewBase({
    engine,
    sim,
    cameraPreset: { pos: [0, 13, 12], look: [0, 0, 0] },
  });
  const tokens = new Map();
  const pickupMeshes = []; // Parallel to state.pickups (fixed-length pool).
  const pickupIds = [];

  function pickupMesh(pk) {
    const wrap = new THREE.Group();
    const s = pk.value >= 3 ? 0.42 : 0.32;
    const body = propSet === 'ice'
      ? simpleMesh(new THREE.IcosahedronGeometry(s, 0), '#80deea',
        { emissive: '#4fc3f7', emissiveIntensity: pk.value >= 3 ? 0.9 : 0.3 })
      : propSet === 'ghost'
        ? simpleMesh(new THREE.SphereGeometry(s, 10, 8), '#b39ddb',
          { transparent: true, opacity: 0.7, emissive: '#7e57c2', emissiveIntensity: 0.8 })
        : simpleMesh(new THREE.SphereGeometry(s, 10, 8), pk.value >= 3 ? accent : '#ffca28',
          { emissive: pk.value >= 3 ? accent : '#000000', emissiveIntensity: 0.8 });
    wrap.add(body);
    // Prefer a themed kit prop when the engine kit is around.
    const kitName = PICKUP_KIT_BY_SET[propSet];
    if (kitName) {
      base.withKit((kit) => {
        const fancy = kitProp(kit, kitName, { scale: pk.value >= 3 ? 1.15 : 0.85 });
        if (fancy) {
          body.visible = false;
          wrap.add(fancy);
        }
      });
    }
    return wrap;
  }

  function buildArena(state) {
    const radius = state.arenaRadius ?? 8.5;
    const floor = simpleMesh(
      new THREE.CylinderGeometry(radius, radius * 1.08, 0.6, 28),
      theme.palette?.primary ?? '#2e7d32',
    );
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
        const a = (i / 7) * Math.PI * 2 + 0.3;
        const prop = kitProp(kit, names[i % names.length], { scale: 0.9 + (i % 3) * 0.2 })
          ?? simpleMesh(new THREE.IcosahedronGeometry(0.6, 0), theme.palette?.secondary ?? '#8d6e63');
        prop.position.set(Math.cos(a) * (radius + 2.6), 0, Math.sin(a) * (radius + 2.6));
        base.group.add(prop);
      }
    });
  }

  function mount(sceneRoot) {
    const state = base.tracker.sample().curr ?? {};
    buildArena(state);
    const teamMode = state.mode === 'teams';
    (state.order ?? []).forEach((pid, i) => {
      const p = state.players?.[pid];
      const token = makePlayerToken(base, {
        id: pid,
        name: pid,
        color: teamMode && p ? TEAM_HEX[p.team] : PLAYER_COLORS[i % PLAYER_COLORS.length],
      });
      tokens.set(pid, token);
      base.group.add(token);
    });
    (state.pickups ?? []).forEach((pk) => {
      const mesh = pickupMesh(pk);
      mesh.position.set(pk.x, 0.45, pk.z);
      pickupMeshes.push(mesh);
      pickupIds.push(pk.id);
      base.group.add(mesh);
    });
    (sceneRoot ?? engine?.scene)?.add(base.group);
    base.applyCamera();
  }

  function update(dtRender, alpha) {
    const { prev, curr } = base.tracker.sample();
    if (curr) {
      (curr.pickups ?? []).forEach((pk, i) => {
        let mesh = pickupMeshes[i];
        if (!mesh) return;
        if (pickupIds[i] !== pk.id) {
          // Grabbed and respawned elsewhere: rebuild the look for the new roll.
          disposeObject(mesh);
          mesh = pickupMesh(pk);
          pickupMeshes[i] = mesh;
          pickupIds[i] = pk.id;
          base.group.add(mesh);
        }
        const waiting = curr.tick < pk.activeFrom;
        mesh.visible = !waiting;
        mesh.position.set(pk.x, 0.45 + Math.sin(curr.tick * 0.12 + i) * 0.08, pk.z);
        mesh.rotation.y += dtRender * 1.6;
        // The tell: trapped loot wobbles suspiciously.
        mesh.rotation.z = pk.trapped ? Math.sin(curr.tick * 0.45 + i * 2) * 0.3 : 0;
      });

      for (const pid of curr.order ?? []) {
        const token = tokens.get(pid);
        const p = curr.players[pid];
        const q = prev?.players?.[pid] ?? p;
        if (!token || !p) continue;
        token.position.x = lerp(q.x, p.x, alpha);
        token.position.z = lerp(q.z, p.z, alpha);
        const stunned = curr.tick < p.stunUntil;
        if (stunned) {
          token.rotation.y += dtRender * 9; // Dizzy spin.
          token.position.y = Math.abs(Math.sin(curr.tick * 0.3)) * 0.15;
        } else {
          const speed = Math.hypot(p.vx ?? 0, p.vz ?? 0);
          if (speed > 0.2) token.rotation.y = Math.atan2(p.vx, p.vz);
          token.position.y = 0;
        }
        if (p.lastGrabTick === curr.tick && p.lastGrabTick !== (q.lastGrabTick ?? -1)) {
          if (p.lastGrabValue > 0) {
            base.burst({
              colors: [accent], spread: 0.7, up: 1.8, life: 0.6,
              size: p.lastGrabValue >= 3 ? 0.16 : 0.11, count: p.lastGrabValue >= 3 ? 18 : 9,
            }, { pos: { x: p.x, y: 0.7, z: p.z } });
            base.sfx('pop', { vol: 0.6 });
          } else {
            base.burst({ colors: ['#ef5350', '#4a148c'], spread: 1, up: 1.4, life: 0.7, size: 0.13, count: 14 },
              { pos: { x: p.x, y: 0.7, z: p.z } });
            base.sfx('buzz', { vol: 0.7 });
          }
        }
      }
    }
    base.update(dtRender);
  }

  function dispose() {
    tokens.clear();
    pickupMeshes.length = 0;
    pickupIds.length = 0;
    base.dispose();
  }

  return { mount, update, dispose };
}

export default createView;
