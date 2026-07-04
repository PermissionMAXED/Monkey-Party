/**
 * Bluff Banana view: five crates in a row, colored pick arrows sliding
 * secretly along the line, then the reveal - a golden banana pops from
 * the right crate while the rotten one belches green smoke.
 */

import * as THREE from 'three';
import {
  createViewBase, makePlayerToken, simpleMesh, kitProp, lerp, PLAYER_COLORS,
} from '../../viewHarness.js';

const CRATE_GAP = 2.4;

export function createView({ sim, engine }) {
  const base = createViewBase({
    engine,
    sim,
    cameraPreset: { pos: [0, 6.5, 10], look: [0, 1, -1], fov: 50 },
  });
  const tokens = new Map();
  const cursors = new Map();
  const crates = [];
  let banana = null;

  function crateX(i, count) {
    return (i - (count - 1) / 2) * CRATE_GAP;
  }

  function buildArena(state) {
    const count = state.crates ?? 5;
    const floor = simpleMesh(new THREE.BoxGeometry(count * CRATE_GAP + 4, 0.5, 12), '#4caf50');
    floor.position.set(0, -0.25, 1);
    base.group.add(floor);

    base.withKit((kit) => {
      for (let i = 0; i < count; i += 1) {
        const crate = kitProp(kit, 'crate', { size: 1.4 })
          ?? simpleMesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), '#a1887f');
        crate.position.set(crateX(i, count), 0.7, -2);
        crates.push(crate);
        base.group.add(crate);
      }
      const bananaProto = kitProp(kit, 'goldenBanana', {}) ?? kitProp(kit, 'banana', {});
      banana = bananaProto ?? simpleMesh(
        new THREE.TorusGeometry(0.35, 0.12, 6, 10, Math.PI * 1.4),
        '#ffd54f',
        { emissive: '#8a6a00', emissiveIntensity: 0.9 },
      );
      banana.visible = false;
      base.group.add(banana);
    });
  }

  function mount(sceneRoot) {
    const state = base.tracker.sample().curr ?? {};
    buildArena(state);
    const n = (state.order ?? []).length || 1;
    (state.order ?? []).forEach((pid, i) => {
      const color = PLAYER_COLORS[i % PLAYER_COLORS.length];
      const token = makePlayerToken(base, { id: pid, name: pid, color, scale: 0.8 });
      token.position.set(((i + 0.5) / n - 0.5) * 10, 0, 4.2);
      token.rotation.y = Math.PI;
      tokens.set(pid, token);
      base.group.add(token);

      const cursor = simpleMesh(new THREE.ConeGeometry(0.22, 0.55, 5), color,
        { emissive: color, emissiveIntensity: 0.5 });
      cursor.rotation.x = Math.PI; // Point down at the crate.
      cursor.position.set(0, 2.2 + i * 0.28, -2);
      cursors.set(pid, cursor);
      base.group.add(cursor);
    });
    (sceneRoot ?? engine?.scene)?.add(base.group);
    base.applyCamera();
  }

  function update(dtRender, alpha) {
    const { prev, curr } = base.tracker.sample();
    if (curr) {
      const count = curr.crates ?? 5;
      const reveal = curr.phase === 'reveal';

      // Golden banana pops out of the winning crate during the reveal.
      if (banana) {
        banana.visible = reveal;
        if (reveal) {
          const elapsed = curr.tick - curr.phaseTick;
          banana.position.set(
            crateX(curr.golden, count),
            1.6 + Math.min(1, elapsed / 12) * 0.9 + Math.sin(curr.tick * 0.15) * 0.1,
            -2,
          );
          banana.rotation.y += dtRender * 3;
        }
      }
      if (reveal && prev && prev.phase === 'pick') {
        base.sfx('chest', { vol: 0.9 });
        base.burst('coinSparkle', { pos: { x: crateX(curr.golden, count), y: 2, z: -2 } });
        base.burst({ colors: ['#7cb342', '#33691e'], spread: 1.2, up: 1.8, life: 0.9, size: 0.13, count: 18 },
          { pos: { x: crateX(curr.rotten, count), y: 1.4, z: -2 } });
      }

      // Crate wobble teases during the pick phase.
      crates.forEach((crate, i) => {
        crate.rotation.z = curr.phase === 'pick'
          ? Math.sin(curr.tick * 0.08 + i * 1.9) * 0.03
          : 0;
      });

      for (const pid of curr.order ?? []) {
        const p = curr.players[pid];
        const q = prev?.players?.[pid] ?? p;
        const cursor = cursors.get(pid);
        const token = tokens.get(pid);
        if (!p || !cursor || !token) continue;
        const cx = crateX(lerp(q.cur ?? p.cur, p.cur, alpha), count);
        cursor.position.x = cx;
        cursor.visible = curr.phase !== 'inter';

        // Score feedback at the reveal.
        if (p.lastDeltaTick === curr.tick && p.lastDeltaTick !== (q.lastDeltaTick ?? -1)) {
          if (p.lastDelta > 0) {
            base.sfx('coin', { pitch: 1.1 });
            token.position.y = 0.5;
          } else if (p.lastDelta < 0) {
            base.sfx('error', { vol: 0.5 });
            token.rotation.z = 0.3;
          }
        }
        token.position.y = Math.max(0, token.position.y - dtRender * 2);
        token.rotation.z *= Math.max(0, 1 - dtRender * 4);
      }
    }
    base.update(dtRender);
  }

  function dispose() {
    tokens.clear();
    cursors.clear();
    crates.length = 0;
    base.dispose();
  }

  return { mount, update, dispose };
}

export default createView;
