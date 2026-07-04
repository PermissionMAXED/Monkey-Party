/**
 * Sneaky Statue view: a temple runway toward a giant idol whose "gaze
 * lamp" flips green/amber/red with the sim phases; caught monkeys puff
 * back to the start, finishers trigger fanfare + confetti.
 */

import * as THREE from 'three';
import {
  createViewBase, makePlayerToken, simpleMesh, kitProp, lerp, PLAYER_COLORS,
} from '../../viewHarness.js';

const PHASE_COLORS = { green: '#39d353', turning: '#ffb300', red: '#ef5350' };

export function createView({ sim, engine }) {
  const base = createViewBase({
    engine,
    sim,
    cameraPreset: { pos: [0, 12, -8], look: [0, 1, 14], fov: 60 },
  });
  const tokens = new Map();
  let gazeLamp = null;
  let idolGroup = null;
  let courseLength = 26;

  function buildArena(state) {
    courseLength = state.courseLength ?? 26;
    const width = 15;

    const runway = simpleMesh(new THREE.BoxGeometry(width, 0.6, courseLength + 8), '#c9b27c');
    runway.position.set(0, -0.3, courseLength / 2);
    base.group.add(runway);

    // Start + goal stripes.
    for (const [z, color] of [[0, '#ffffff'], [courseLength, '#ffe135']]) {
      const stripe = simpleMesh(new THREE.BoxGeometry(width, 0.08, 0.5), color);
      stripe.position.set(0, 0.05, z);
      base.group.add(stripe);
    }

    idolGroup = new THREE.Group();
    idolGroup.position.set(0, 0, courseLength + 2.5);
    const pedestal = simpleMesh(new THREE.CylinderGeometry(1.6, 2, 1.2, 8), '#8f9a96');
    pedestal.position.y = 0.6;
    idolGroup.add(pedestal);
    base.withKit((kit) => {
      const statue = kitProp(kit, 'statue', { scale: 1.5 })
        ?? simpleMesh(new THREE.ConeGeometry(1.1, 3, 6), '#8f9a96');
      statue.position.y = 1.2;
      statue.rotation.y = Math.PI; // Face the runners.
      idolGroup.add(statue);
      for (const side of [-1, 1]) {
        const torch = kitProp(kit, 'torch', { withFlickerLight: false })
          ?? simpleMesh(new THREE.ConeGeometry(0.2, 1.4, 5), '#ff9231');
        torch.position.set(side * 3, 0, -1);
        idolGroup.add(torch);
      }
    });
    // The "gaze lamp" everyone watches.
    gazeLamp = simpleMesh(new THREE.IcosahedronGeometry(0.55, 1), PHASE_COLORS.green,
      { emissive: PHASE_COLORS.green, emissiveIntensity: 1.4 });
    gazeLamp.position.y = 4.4;
    idolGroup.add(gazeLamp);
    base.group.add(idolGroup);
  }

  function mount(sceneRoot) {
    const state = base.tracker.sample().curr ?? {};
    buildArena(state);
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

  let lastPhase = 'green';

  function update(dtRender, alpha) {
    const { prev, curr } = base.tracker.sample();
    if (curr) {
      // Gaze lamp + idol twist per phase.
      if (curr.phase !== lastPhase) {
        lastPhase = curr.phase;
        if (gazeLamp) {
          const c = new THREE.Color(PHASE_COLORS[curr.phase] ?? '#ffffff');
          gazeLamp.material.color = c;
          gazeLamp.material.emissive = c;
        }
        if (curr.phase === 'turning') base.sfx('tick', { vol: 0.8 });
        if (curr.phase === 'red') base.sfx('zap', { vol: 0.5, pitch: 0.8 });
        if (curr.phase === 'green') base.sfx('click', { pitch: 1.4 });
      }
      if (idolGroup) {
        const targetY = curr.phase === 'red' ? Math.PI : (curr.phase === 'turning' ? Math.PI / 2 : 0);
        idolGroup.rotation.y += (targetY - idolGroup.rotation.y) * Math.min(1, dtRender * 6);
      }

      for (const pid of curr.order ?? []) {
        const token = tokens.get(pid);
        const p = curr.players[pid];
        const q = prev?.players?.[pid] ?? p;
        if (!token || !p) continue;
        token.position.set(lerp(q.x, p.x, alpha), 0, lerp(q.z, p.z, alpha));
        token.rotation.y = 0;

        if (p.caughtTick === curr.tick && p.caughtTick !== (q.caughtTick ?? -1)) {
          base.sfx('error', { vol: 0.7 });
          base.burst('dust', { pos: { x: q.x, y: 0.6, z: q.z }, count: 14 });
          base.burst('dust', { pos: { x: p.x, y: 0.6, z: 0 }, count: 8 });
        }
        if (p.finished && !q.finished) {
          base.sfx('fanfare', { vol: 0.8 });
          base.burst('confetti', { pos: { x: p.x, y: 2, z: courseLength } });
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
