/**
 * Shared mashRace view (serves every variant), covering all three submodes:
 *   solo - lane race toward a finish banner, tokens advance with progress,
 *   tug  - two teams heave a rope whose golden knot slides with state.rope,
 *   team - two carts crawl toward the goal line on combined team power.
 * Tokens hop on every registered press so the mash is readable at a glance.
 *
 * Reads def.params.theme ({palette, propSet, skyColor}) for the backdrop,
 * so tug_of_banana, wall_climbers, cart_chaos etc. all look distinct.
 */

import * as THREE from 'three';
import {
  createViewBase, makePlayerToken, simpleMesh, kitProp, lerp, PLAYER_COLORS,
} from '../../viewHarness.js';

const PROPS_BY_SET = {
  jungle: ['palm', 'bush'],
  volcano: ['rock', 'torch'],
  city: ['crate', 'platform'],
  ice: ['ice_spike'],
  ghost: ['statue', 'torch'],
  factory: ['gear', 'crate'],
};

const TEAM_HEX = ['#42a5f5', '#ef5350'];
const TRACK_LEN = 12;

export function createView({ sim, engine, def }) {
  const theme = def?.params?.theme ?? {};
  const accent = theme.palette?.accent ?? '#ffe135';
  const base = createViewBase({
    engine,
    sim,
    cameraPreset: { pos: [0, 10, 13], look: [0, 1, 0] },
  });
  const tokens = new Map();
  let mode = 'solo';
  let ropeKnot = null;
  const carts = [];

  function addBackdrop(half) {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(60, 12, 8),
      new THREE.MeshBasicMaterial({ color: theme.skyColor ?? '#87ceeb', side: THREE.BackSide }),
    );
    sky.material.userData.__mgOwned = true;
    base.group.add(sky);
    const names = PROPS_BY_SET[theme.propSet] ?? PROPS_BY_SET.jungle;
    base.withKit((kit) => {
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + 0.2;
        const prop = kitProp(kit, names[i % names.length], { scale: 0.9 + (i % 3) * 0.2 })
          ?? simpleMesh(new THREE.IcosahedronGeometry(0.6, 0), theme.palette?.secondary ?? '#8d6e63');
        prop.position.set(Math.cos(a) * (half + 3), 0, Math.sin(a) * (half + 3));
        base.group.add(prop);
      }
    });
  }

  function buildArena(state) {
    mode = state.mode ?? 'solo';
    const ground = simpleMesh(
      new THREE.BoxGeometry(24, 0.6, 18),
      theme.palette?.primary ?? '#2e7d32',
    );
    ground.position.y = -0.3;
    base.group.add(ground);
    addBackdrop(10);

    if (mode === 'tug') {
      const rope = simpleMesh(new THREE.CylinderGeometry(0.09, 0.09, 14, 6), '#8d6e63');
      rope.rotation.z = Math.PI / 2;
      rope.position.y = 0.9;
      base.group.add(rope);
      ropeKnot = simpleMesh(new THREE.SphereGeometry(0.42, 10, 8), accent,
        { emissive: accent, emissiveIntensity: 0.5 });
      ropeKnot.position.y = 0.9;
      base.group.add(ropeKnot);
      for (const side of [-1, 1]) {
        const mark = simpleMesh(new THREE.BoxGeometry(0.2, 0.1, 3), TEAM_HEX[side < 0 ? 1 : 0]);
        mark.position.set(side * 5, 0.06, 0);
        base.group.add(mark);
      }
    } else if (mode === 'team') {
      for (let teamIdx = 0; teamIdx < 2; teamIdx += 1) {
        const cart = simpleMesh(new THREE.BoxGeometry(1.6, 1, 1.2), TEAM_HEX[teamIdx]);
        cart.position.set(-TRACK_LEN / 2, 0.5, teamIdx === 0 ? -3 : 3);
        carts.push(cart);
        base.group.add(cart);
        const rail = simpleMesh(new THREE.BoxGeometry(TRACK_LEN + 2, 0.08, 0.14), '#5d4037');
        rail.position.set(0, 0.05, teamIdx === 0 ? -3 : 3);
        base.group.add(rail);
      }
      const finish = simpleMesh(new THREE.BoxGeometry(0.25, 2.4, 8), accent,
        { emissive: accent, emissiveIntensity: 0.4 });
      finish.position.set(TRACK_LEN / 2 + 0.8, 1.2, 0);
      base.group.add(finish);
    } else {
      // Solo lanes along x, one strip per player.
      const n = (state.order ?? []).length || 2;
      for (let i = 0; i < n; i += 1) {
        const lane = simpleMesh(new THREE.BoxGeometry(TRACK_LEN + 2, 0.08, 1.4),
          i % 2 === 0 ? '#7a6a55' : '#6b5b48');
        lane.position.set(0, 0.05, (i - (n - 1) / 2) * 1.8);
        base.group.add(lane);
      }
      const finish = simpleMesh(new THREE.BoxGeometry(0.25, 2.2, n * 1.8 + 1), accent,
        { emissive: accent, emissiveIntensity: 0.4 });
      finish.position.set(TRACK_LEN / 2 + 0.6, 1.1, 0);
      base.group.add(finish);
    }
  }

  function tokenHome(state, p, i, count) {
    if (mode === 'tug') {
      const dir = p.team === 0 ? 1 : -1;
      const rank = Math.floor(i / 2) + 1;
      return { x: dir * (1.6 + rank * 1.4), z: 0 };
    }
    if (mode === 'team') {
      return { x: -TRACK_LEN / 2, z: (p.team === 0 ? -3 : 3) + (i % 2 === 0 ? -1.2 : 1.2) };
    }
    return { x: -TRACK_LEN / 2, z: (i - (count - 1) / 2) * 1.8 };
  }

  function mount(sceneRoot) {
    const state = base.tracker.sample().curr ?? {};
    buildArena(state);
    const ids = state.order ?? [];
    ids.forEach((pid, i) => {
      const p = state.players?.[pid] ?? { team: i % 2, slot: i };
      const color = mode === 'solo'
        ? PLAYER_COLORS[i % PLAYER_COLORS.length]
        : TEAM_HEX[p.team];
      const token = makePlayerToken(base, { id: pid, name: pid, color });
      const home = tokenHome(state, p, i, ids.length);
      token.position.set(home.x, 0, home.z);
      if (mode === 'tug') token.rotation.y = p.team === 0 ? -Math.PI / 2 : Math.PI / 2;
      else token.rotation.y = Math.PI / 2;
      tokens.set(pid, token);
      base.group.add(token);
    });
    (sceneRoot ?? engine?.scene)?.add(base.group);
    base.applyCamera();
  }

  function update(dtRender) {
    const { prev, curr } = base.tracker.sample();
    if (curr) {
      if (mode === 'tug' && ropeKnot) {
        const shift = (curr.rope / (curr.ropeGoal || 1)) * 5;
        ropeKnot.position.x = lerp(ropeKnot.position.x, shift, Math.min(1, dtRender * 8));
      }
      if (mode === 'team' && carts.length === 2 && curr.teams) {
        curr.teams.forEach((team, i) => {
          const frac = Math.min(1, (team.score ?? 0) / (curr.goal || 1));
          carts[i].position.x = lerp(carts[i].position.x, -TRACK_LEN / 2 + frac * TRACK_LEN,
            Math.min(1, dtRender * 8));
        });
      }

      const ids = curr.order ?? [];
      ids.forEach((pid, i) => {
        const token = tokens.get(pid);
        const p = curr.players[pid];
        const q = prev?.players?.[pid] ?? p;
        if (!token || !p) return;
        const home = tokenHome(curr, p, i, ids.length);
        if (mode === 'solo') {
          const frac = Math.min(1, (p.progress ?? 0) / (curr.goal || 1));
          token.position.x = lerp(token.position.x, home.x + frac * TRACK_LEN, Math.min(1, dtRender * 8));
        } else if (mode === 'tug' && ropeKnot) {
          token.position.x = home.x + ropeKnot.position.x;
        } else if (mode === 'team' && carts.length === 2) {
          token.position.x = carts[p.team].position.x - 1.4;
        }
        // Mash hop: one little jump per registered press.
        const sincePress = p.lastPressTick >= 0 ? curr.tick - p.lastPressTick : 99;
        token.position.y = sincePress < 5 ? Math.sin((sincePress / 5) * Math.PI) * 0.35 : 0;
        if (p.finished && !(q.finished ?? false)) {
          base.burst({ colors: [theme.palette?.accent ?? '#ffe135'], spread: 1, up: 2.4, life: 0.8, size: 0.14, count: 20 },
            { pos: { x: token.position.x, y: 1, z: token.position.z } });
          base.sfx('ding', { vol: 0.8 });
        }
      });
    }
    base.update(dtRender);
  }

  function dispose() {
    tokens.clear();
    carts.length = 0;
    base.dispose();
  }

  return { mount, update, dispose };
}

export default createView;
