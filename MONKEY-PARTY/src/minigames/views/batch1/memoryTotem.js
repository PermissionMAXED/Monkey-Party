/**
 * Memory Totem view: a carved totem with four color lamps (matching the
 * four stick directions) that light up during the show phase; players
 * stand in a half-circle and puff out in red smoke when eliminated.
 */

import * as THREE from 'three';
import { TOTEM_COLORS } from '#shared/minigames/sims/batch1/memoryTotem.js';
import {
  createViewBase, makePlayerToken, simpleMesh, kitProp, PLAYER_COLORS,
} from '../../viewHarness.js';

const LAMP_HEX = { green: '#39d353', yellow: '#ffe135', red: '#ef5350', blue: '#42a5f5' };
/** Lamp placement mirrors the stick mapping: up/right/down/left. */
const LAMP_OFFSETS = [[0, 1.1], [1.1, 0], [0, -1.1], [-1.1, 0]];
const SHOW_TICKS = 14;
const GAP_TICKS = 7;

export function createView({ sim, engine }) {
  const base = createViewBase({
    engine,
    sim,
    cameraPreset: { pos: [0, 7, 11], look: [0, 3, 0], fov: 50 },
  });
  const tokens = new Map();
  const lamps = [];
  let totem = null;

  function buildArena() {
    const floor = simpleMesh(new THREE.CylinderGeometry(9, 9.6, 0.5, 20), '#5d4037');
    floor.position.y = -0.25;
    base.group.add(floor);

    totem = new THREE.Group();
    for (let i = 0; i < 3; i += 1) {
      const block = simpleMesh(new THREE.BoxGeometry(1.6 - i * 0.25, 1.3, 1.6 - i * 0.25), i % 2 ? '#6d4c41' : '#8d6e63');
      block.position.y = 0.65 + i * 1.3;
      totem.add(block);
    }
    const crown = simpleMesh(new THREE.ConeGeometry(1, 0.9, 6), '#ffb300');
    crown.position.y = 4.4;
    totem.add(crown);
    // Four color lamps facing the players.
    TOTEM_COLORS.forEach((color, i) => {
      const lamp = simpleMesh(new THREE.IcosahedronGeometry(0.34, 1), LAMP_HEX[color],
        { emissive: LAMP_HEX[color], emissiveIntensity: 0.15 });
      const [ox, oy] = LAMP_OFFSETS[i];
      lamp.position.set(ox, 2.6 + oy, 1.0);
      totem.add(lamp);
      lamps.push(lamp);
    });
    totem.position.z = -2;
    base.group.add(totem);

    base.withKit((kit) => {
      for (const side of [-1, 1]) {
        const torch = kitProp(kit, 'torch', { withFlickerLight: false })
          ?? simpleMesh(new THREE.ConeGeometry(0.2, 1.5, 5), '#ff9231');
        torch.position.set(side * 4.5, 0, -2);
        base.group.add(torch);
      }
      const mush = kitProp(kit, 'mushroom', { scale: 1.4 });
      if (mush) {
        mush.position.set(6, 0, 2);
        base.group.add(mush);
      }
    });
  }

  function seatPos(i, n) {
    const a = Math.PI * (0.25 + (0.5 * i) / Math.max(1, n - 1));
    return { x: Math.cos(a + Math.PI / 2) * 5.5, z: 2.5 + Math.sin(a) * 2.5 };
  }

  function mount(sceneRoot) {
    const state = base.tracker.sample().curr ?? {};
    buildArena();
    const n = (state.order ?? []).length;
    (state.order ?? []).forEach((pid, i) => {
      const token = makePlayerToken(base, {
        id: pid, name: pid, color: PLAYER_COLORS[i % PLAYER_COLORS.length], scale: 0.85,
      });
      const pos = seatPos(i, n);
      token.position.set(pos.x, 0, pos.z);
      token.rotation.y = Math.PI; // Face the totem.
      tokens.set(pid, token);
      base.group.add(token);
    });
    (sceneRoot ?? engine?.scene)?.add(base.group);
    base.applyCamera();
  }

  function litLampIndex(state) {
    if (state.phase !== 'show') return -1;
    const elapsed = state.tick - state.phaseTick;
    const slot = Math.floor(elapsed / (SHOW_TICKS + GAP_TICKS));
    const within = elapsed % (SHOW_TICKS + GAP_TICKS);
    if (slot >= (state.sequence?.length ?? 0) || within >= SHOW_TICKS) return -1;
    return state.sequence[slot];
  }

  let lastLit = -1;

  function update(dtRender, _alpha) {
    const { prev, curr } = base.tracker.sample();
    if (curr) {
      // Light the lamp being shown.
      const lit = litLampIndex(curr);
      lamps.forEach((lamp, i) => {
        lamp.material.emissiveIntensity = i === lit ? 2.2 : 0.15;
        lamp.scale.setScalar(i === lit ? 1.35 : 1);
      });
      if (lit !== -1 && lit !== lastLit) {
        base.sfx('countdown', { pitch: 0.8 + lit * 0.2, vol: 0.6 });
      }
      lastLit = lit;
      if (totem) totem.rotation.y = Math.sin(curr.tick * 0.01) * 0.1;

      for (const pid of curr.order ?? []) {
        const token = tokens.get(pid);
        const p = curr.players[pid];
        const q = prev?.players?.[pid] ?? p;
        if (!token || !p) continue;

        // Input feedback: hop on a correct entry, smoke on elimination.
        if (p.lastInputTick === curr.tick && p.lastInputTick !== (q.lastInputTick ?? -1)) {
          if (p.lastInputOk) {
            base.sfx('click', { pitch: 1.3 });
            token.position.y = 0.35;
          } else {
            base.sfx('error');
            base.burst({ colors: ['#ef5350', '#b71c1c'], spread: 1.6, up: 2.5, life: 1, size: 0.14, count: 24 },
              { pos: { x: token.position.x, y: 1, z: token.position.z } });
          }
        }
        token.position.y = Math.max(0, token.position.y - dtRender * 2);

        if (!p.alive) {
          token.rotation.z += (1.35 - token.rotation.z) * Math.min(1, dtRender * 5);
        } else if (p.done && curr.phase === 'input') {
          token.rotation.z = Math.sin(curr.tick * 0.2) * 0.12; // Happy wiggle.
        } else {
          token.rotation.z = 0;
        }
      }

      // Round transitions.
      if (prev && prev.round !== curr.round) base.sfx('buy', { vol: 0.7 });
    }
    base.update(dtRender);
  }

  function dispose() {
    tokens.clear();
    lamps.length = 0;
    base.dispose();
  }

  return { mount, update, dispose };
}

export default createView;
