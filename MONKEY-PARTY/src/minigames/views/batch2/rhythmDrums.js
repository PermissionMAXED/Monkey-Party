/**
 * Rhythm Drums view: a torch-lit drum circle with two big lane drums;
 * beat pucks slide down toward the hit line and drummers flash green on
 * perfects, yellow on goods, red on misses/strays.
 */

import * as THREE from 'three';
import {
  createViewBase, makePlayerToken, simpleMesh, kitProp, PLAYER_COLORS,
  disposeObject,
} from '../../viewHarness.js';

const LANE_X = [-1.7, 1.7];
const LANE_HEX = ['#ef5350', '#42a5f5'];
const LOOKAHEAD = 90; // Ticks of beats visible above the drums.

export function createView({ sim, engine }) {
  const base = createViewBase({
    engine,
    sim,
    cameraPreset: { pos: [0, 6, 10], look: [0, 2.4, 0], fov: 52 },
  });
  const tokens = new Map();
  const beatMeshes = new Map();
  const drums = [];

  function buildArena() {
    const floor = simpleMesh(new THREE.CylinderGeometry(8.5, 9, 0.5, 18), '#5d4037');
    floor.position.y = -0.25;
    base.group.add(floor);
    LANE_X.forEach((x, lane) => {
      const drum = simpleMesh(new THREE.CylinderGeometry(1.15, 1.35, 1.1, 12), LANE_HEX[lane],
        { emissive: LANE_HEX[lane], emissiveIntensity: 0.12 });
      drum.position.set(x, 0.55, -1);
      drums.push(drum);
      base.group.add(drum);
    });
    base.withKit((kit) => {
      for (const side of [-1, 1]) {
        const torch = kitProp(kit, 'torch', { withFlickerLight: false })
          ?? simpleMesh(new THREE.ConeGeometry(0.2, 1.6, 5), '#ff9231');
        torch.position.set(side * 5.5, 0, -2.5);
        base.group.add(torch);
      }
    });
  }

  function seatPos(i, n) {
    const a = Math.PI * (0.2 + (0.6 * i) / Math.max(1, n - 1));
    return { x: Math.cos(a + Math.PI / 2) * 5.5, z: 3 + Math.sin(a) * 2 };
  }

  function mount(sceneRoot) {
    const state = base.tracker.sample().curr ?? {};
    buildArena();
    const n = (state.order ?? []).length;
    (state.order ?? []).forEach((pid, i) => {
      const token = makePlayerToken(base, {
        id: pid, name: pid, color: PLAYER_COLORS[i % PLAYER_COLORS.length], scale: 0.8,
      });
      const pos = seatPos(i, n);
      token.position.set(pos.x, 0, pos.z);
      token.rotation.y = Math.PI;
      tokens.set(pid, token);
      base.group.add(token);
    });
    (sceneRoot ?? engine?.scene)?.add(base.group);
    base.applyCamera();
  }

  function update(dtRender, _alpha) {
    const { prev, curr } = base.tracker.sample();
    if (curr) {
      // Beat pucks approaching the drums (shared chart -> one lane rail each).
      const live = new Set();
      for (let i = 0; i < (curr.beats ?? []).length; i += 1) {
        const beat = curr.beats[i];
        const dt = beat.tick - curr.tick;
        if (dt < -8 || dt > LOOKAHEAD) continue;
        live.add(i);
        let mesh = beatMeshes.get(i);
        if (!mesh) {
          mesh = simpleMesh(new THREE.CylinderGeometry(0.32, 0.32, 0.14, 10), LANE_HEX[beat.lane],
            { emissive: LANE_HEX[beat.lane], emissiveIntensity: 0.7 });
          beatMeshes.set(i, mesh);
          base.group.add(mesh);
        }
        mesh.position.set(LANE_X[beat.lane], 1.2 + (dt / LOOKAHEAD) * 6, -1);
        if (dt <= 0) mesh.scale.setScalar(Math.max(0.3, 1 + dt * 0.1));
      }
      for (const [i, mesh] of beatMeshes) {
        if (!live.has(i)) {
          disposeObject(mesh);
          beatMeshes.delete(i);
        }
      }

      // Drum pulse on any fresh press this tick.
      drums.forEach((drum) => {
        drum.scale.y = Math.max(1, drum.scale.y - dtRender * 4);
      });

      for (const pid of curr.order ?? []) {
        const token = tokens.get(pid);
        const p = curr.players[pid];
        const q = prev?.players?.[pid] ?? p;
        if (!token || !p) continue;
        const judged = p.lastJudge && p.lastJudge.tick === curr.tick
          && (q.lastJudge?.tick ?? -1) !== curr.tick;
        if (judged) {
          const kind = p.lastJudge.kind;
          if (kind === 'perfect') {
            base.sfx('drum', { pitch: 1.2, vol: 0.8 });
            token.position.y = 0.45;
            base.burst('coinSparkle', { pos: { x: token.position.x, y: 1.8, z: token.position.z }, count: 8 });
          } else if (kind === 'good') {
            base.sfx('drum', { pitch: 1, vol: 0.6 });
            token.position.y = 0.3;
          } else {
            base.sfx('error', { vol: 0.4 });
            token.rotation.z = 0.25;
          }
          const drum = drums[curr.beats?.[Math.max(0, p.next - 1)]?.lane ?? 0];
          if (drum && kind !== 'miss') drum.scale.y = 1.25;
        }
        token.position.y = Math.max(0, token.position.y - dtRender * 2);
        token.rotation.z *= Math.max(0, 1 - dtRender * 5);
      }
    }
    base.update(dtRender);
  }

  function dispose() {
    tokens.clear();
    beatMeshes.clear();
    drums.length = 0;
    base.dispose();
  }

  return { mount, update, dispose };
}

export default createView;
