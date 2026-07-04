/**
 * Vine Swing Sprint view: side-scrolling canopy run - a long mossy track,
 * hanging vines at each swing point, and a camera that chases the leader.
 */

import * as THREE from 'three';
import {
  createViewBase, makePlayerToken, simpleMesh, kitProp, lerp, PLAYER_COLORS,
} from '../../viewHarness.js';

const LANE_GAP = 2.2;

export function createView({ sim, engine }) {
  const base = createViewBase({
    engine,
    sim,
    cameraPreset: { pos: [0, 8, 18], look: [10, 2, 0], fov: 55 },
  });
  const tokens = new Map();
  const vineMarkers = [];
  let trackLength = 90;
  let laneCount = 4;

  function laneZ(lane) {
    return (lane - (laneCount - 1) / 2) * LANE_GAP;
  }

  function buildArena(state) {
    trackLength = state.trackLength ?? 90;
    laneCount = (state.order ?? []).length || 4;
    const width = laneCount * LANE_GAP + 3;

    const track = simpleMesh(new THREE.BoxGeometry(trackLength + 14, 0.6, width), '#3e7c3a');
    track.position.set(trackLength / 2, -0.3, 0);
    base.group.add(track);

    const finish = simpleMesh(new THREE.BoxGeometry(0.6, 0.1, width), '#ffe135',
      { emissive: '#8a6a00', emissiveIntensity: 0.5 });
    finish.position.set(trackLength, 0.06, 0);
    base.group.add(finish);

    // Canopy beam + vines at every swing point.
    const beam = simpleMesh(new THREE.CylinderGeometry(0.25, 0.25, trackLength + 10, 6), '#6d4c41');
    beam.rotation.z = Math.PI / 2;
    beam.position.set(trackLength / 2, 7, 0);
    base.group.add(beam);
    for (const x of state.vines ?? []) {
      const vine = simpleMesh(new THREE.CylinderGeometry(0.07, 0.05, 6, 5), '#7cb342');
      vine.position.set(x, 4, 0);
      base.group.add(vine);
      vineMarkers.push({ x, mesh: vine });
    }

    base.withKit((kit) => {
      for (let i = 0; i < 6; i += 1) {
        const bush = kitProp(kit, 'bush', { scale: 1.2 })
          ?? simpleMesh(new THREE.IcosahedronGeometry(0.8, 0), '#2e7d32');
        bush.position.set(8 + i * (trackLength / 6), 0, (i % 2 ? 1 : -1) * (width / 2 + 1.5));
        base.group.add(bush);
      }
    });
  }

  function mount(sceneRoot) {
    const state = base.tracker.sample().curr ?? {};
    buildArena(state);
    (state.order ?? []).forEach((pid, i) => {
      const token = makePlayerToken(base, {
        id: pid, name: pid, color: PLAYER_COLORS[i % PLAYER_COLORS.length], scale: 0.9,
      });
      token.rotation.y = Math.PI / 2;
      tokens.set(pid, token);
      base.group.add(token);
    });
    (sceneRoot ?? engine?.scene)?.add(base.group);
    base.applyCamera();
  }

  function update(dtRender, alpha) {
    const { prev, curr } = base.tracker.sample();
    if (curr) {
      let leadX = 0;
      (curr.order ?? []).forEach((pid, i) => {
        const token = tokens.get(pid);
        const p = curr.players[pid];
        const q = prev?.players?.[pid] ?? p;
        if (!token || !p) return;
        const x = lerp(q.x, p.x, alpha);
        leadX = Math.max(leadX, x);
        let y = 0;
        if (p.mode === 'window') y = 2.6; // Hanging on the vine.
        else if (p.mode === 'stunned') y = -0.15;
        token.position.set(x, y, laneZ(i));
        token.rotation.z = p.mode === 'stunned' ? 0.9 : 0;

        // Swing / miss / finish feedback on transitions.
        if (q.mode === 'window' && p.mode === 'run' && p.swings > (q.swings ?? 0)) {
          base.sfx('boing', { pitch: 1.1 });
          base.burst('confetti', { pos: { x: p.x, y: 3, z: laneZ(i) }, count: 10 });
        }
        if (q.mode === 'window' && p.mode === 'stunned') {
          base.sfx('land', { pitch: 0.8 });
          base.burst('dust', { pos: { x: p.x, y: 0.4, z: laneZ(i) } });
        }
        if (q.mode !== 'finished' && p.mode === 'finished') {
          base.sfx('fanfare', { vol: 0.7 });
          base.burst('confetti', { pos: { x: p.x, y: 2, z: laneZ(i) } });
        }
      });

      // Chase camera: keep the leading monkey framed.
      const cam = engine?.camera;
      if (cam) {
        const targetX = Math.min(Math.max(leadX, 6), trackLength - 6);
        cam.position.x += (targetX - cam.position.x) * Math.min(1, dtRender * 3);
        cam.lookAt(cam.position.x + 2, 2, 0);
      }

      // Vines glow while their window is hot for anyone.
      for (const marker of vineMarkers) {
        const hot = (curr.order ?? []).some((pid) => {
          const p = curr.players[pid];
          return p.mode === 'window' && Math.abs(p.x - marker.x) < 0.5;
        });
        marker.mesh.material.emissive = new THREE.Color(hot ? '#9ccc65' : '#000000');
        marker.mesh.material.emissiveIntensity = hot ? 0.9 : 0;
      }
    }
    base.update(dtRender);
  }

  function dispose() {
    tokens.clear();
    vineMarkers.length = 0;
    base.dispose();
  }

  return { mount, update, dispose };
}

export default createView;
