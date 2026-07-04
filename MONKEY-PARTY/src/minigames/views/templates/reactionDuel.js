/**
 * Shared reactionDuel view (serves every variant): players fan out in an
 * arc around a signal totem whose lamp flashes the theme accent on the
 * real signal (and the secondary color on fake-outs). Tokens hop on a
 * valid press and keel over after a false start.
 *
 * Reads def.params.theme ({palette, propSet, skyColor}) so firework_flinch,
 * drum_duel, snake_pop, cannon_call, gong_gambit and mirror_match each get
 * their own backdrop, props and flash colors.
 */

import * as THREE from 'three';
import {
  createViewBase, makePlayerToken, simpleMesh, kitProp, PLAYER_COLORS,
} from '../../viewHarness.js';

const PROPS_BY_SET = {
  jungle: ['palm', 'bush'],
  volcano: ['rock', 'torch'],
  city: ['crate', 'platform'],
  ice: ['ice_spike'],
  ghost: ['statue', 'torch'],
  factory: ['gear', 'crate'],
};

function addThemeBackdrop(base, theme, radius) {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(60, 12, 8),
    new THREE.MeshBasicMaterial({ color: theme?.skyColor ?? '#87ceeb', side: THREE.BackSide }),
  );
  sky.material.userData.__mgOwned = true;
  base.group.add(sky);
  const names = PROPS_BY_SET[theme?.propSet] ?? PROPS_BY_SET.jungle;
  base.withKit((kit) => {
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2 + 0.3;
      const prop = kitProp(kit, names[i % names.length], { scale: 0.9 + (i % 3) * 0.15 })
        ?? simpleMesh(new THREE.IcosahedronGeometry(0.6, 0), theme?.palette?.secondary ?? '#8d6e63');
      prop.position.set(Math.cos(a) * (radius + 2.4), 0, Math.sin(a) * (radius + 2.4));
      base.group.add(prop);
    }
  });
}

export function createView({ sim, engine, def }) {
  const theme = def?.params?.theme ?? {};
  const accent = theme.palette?.accent ?? '#ffe135';
  const secondary = theme.palette?.secondary ?? '#8d6e63';
  const base = createViewBase({
    engine,
    sim,
    cameraPreset: { pos: [0, 8.5, 11], look: [0, 1.5, 0] },
  });
  const tokens = new Map();
  let lamp = null;
  let signalFlashed = -1;

  function buildArena() {
    const floor = simpleMesh(
      new THREE.CylinderGeometry(8, 8.6, 0.6, 24),
      theme.palette?.primary ?? '#2e7d32',
    );
    floor.position.y = -0.3;
    base.group.add(floor);

    const pole = simpleMesh(new THREE.CylinderGeometry(0.16, 0.22, 3.2, 8), secondary);
    pole.position.y = 1.6;
    base.group.add(pole);
    lamp = simpleMesh(new THREE.SphereGeometry(0.62, 14, 10), '#5d5d5d',
      { emissive: '#222222', emissiveIntensity: 0.2 });
    lamp.position.y = 3.5;
    base.group.add(lamp);

    addThemeBackdrop(base, theme, 8);
  }

  function mount(sceneRoot) {
    const state = base.tracker.sample().curr ?? {};
    buildArena();
    const ids = state.order ?? [];
    ids.forEach((pid, i) => {
      const token = makePlayerToken(base, {
        id: pid, name: pid, color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      });
      const a = Math.PI * (0.25 + (0.5 * i) / Math.max(1, ids.length - 1));
      token.position.set(Math.cos(a) * 5.2, 0, Math.sin(a) * 5.2);
      token.lookAt(0, 0, 0);
      tokens.set(pid, token);
      base.group.add(token);
    });
    (sceneRoot ?? engine?.scene)?.add(base.group);
    base.applyCamera();
  }

  const idleColor = new THREE.Color('#5d5d5d');
  const accentColor = new THREE.Color(accent);
  const fakeColor = new THREE.Color(secondary);

  function update(dtRender) {
    const { prev, curr } = base.tracker.sample();
    if (curr) {
      // Lamp: accent during the live window, fake flash mid-wait, idle gray.
      const fakeActive = curr.phase === 'wait' && curr.fakeAt > 0
        && curr.tick >= curr.fakeAt && curr.tick <= curr.fakeAt + 7;
      const target = curr.phase === 'window' ? accentColor : fakeActive ? fakeColor : idleColor;
      if (lamp) {
        lamp.material.color.lerp(target, Math.min(1, dtRender * 14));
        lamp.material.emissive.lerp(target, Math.min(1, dtRender * 14));
        lamp.material.emissiveIntensity = curr.phase === 'window' ? 1.1 : fakeActive ? 0.7 : 0.2;
      }
      if (curr.phase === 'window' && prev?.phase === 'wait' && signalFlashed !== curr.round) {
        signalFlashed = curr.round;
        base.burst({ colors: [accent], spread: 1.6, up: 2.4, life: 0.7, size: 0.14, count: 24 },
          { pos: { x: 0, y: 3.5, z: 0 } });
        base.sfx('ding', { vol: 0.8 });
      }

      for (const pid of curr.order ?? []) {
        const token = tokens.get(pid);
        const p = curr.players[pid];
        const q = prev?.players?.[pid] ?? p;
        if (!token || !p) continue;
        // Hop for a few ticks after a valid press.
        const sincePress = p.pressedTick >= 0 ? curr.tick - p.pressedTick : 99;
        token.position.y = sincePress < 8 ? Math.sin((sincePress / 8) * Math.PI) * 0.6 : 0;
        // Keel sideways while locked out from a false start.
        token.rotation.z = THREE.MathUtils.lerp(
          token.rotation.z, p.locked ? 0.5 : 0, Math.min(1, dtRender * 8),
        );
        if (p.locked && !q.locked) {
          base.burst({ colors: ['#ef5350'], spread: 0.8, up: 1.2, life: 0.5, size: 0.1, count: 10 },
            { pos: { x: token.position.x, y: 1, z: token.position.z } });
          base.sfx('buzz', { vol: 0.6 });
        }
        if (p.pressedTick === curr.tick && p.pressedTick !== (q.pressedTick ?? -1)) {
          base.sfx('pop', { vol: 0.7 });
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
