/**
 * Echo Cavern view: a crystal-lit cave. Four big wall pads flash the
 * melody, each team has its own row of echo drums below, and correct
 * echoes ripple light down the cavern while wrong hits flash red.
 */

import * as THREE from 'three';
import {
  createViewBase, makePlayerToken, simpleMesh, kitProp, PLAYER_COLORS,
} from '../../viewHarness.js';

const PAD_HEX = ['#ef5350', '#42a5f5', '#ffe135', '#66bb6a'];
const TEAM_HEX = ['#7fd4ff', '#ffab91'];

export function createView({ sim, engine }) {
  const base = createViewBase({
    engine,
    sim,
    cameraPreset: { pos: [0, 9, 12], look: [0, 2, -2], fov: 55 },
  });
  const tokens = new Map();
  const wallPads = []; // Melody display pads on the cave wall.
  const teamPads = [[], []]; // Echo drums per team.

  function buildScene(state) {
    const pads = state.pads ?? 4;

    // Cave floor + back wall.
    const floor = simpleMesh(new THREE.CylinderGeometry(11, 11.5, 0.6, 20), '#2e2a3a');
    floor.position.y = -0.3;
    base.group.add(floor);
    const wall = simpleMesh(new THREE.BoxGeometry(16, 9, 1), '#241f31');
    wall.position.set(0, 4, -6.5);
    base.group.add(wall);
    // Stalactites hanging off-screen top.
    for (let i = 0; i < 6; i += 1) {
      const stal = simpleMesh(new THREE.ConeGeometry(0.4, 1.6 + (i % 3) * 0.5, 6), '#3a3350');
      stal.rotation.x = Math.PI;
      stal.position.set(-7 + i * 2.8, 7.5, -5.6);
      base.group.add(stal);
    }
    // Glowing crystals for cave flavor.
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2 + 0.7;
      const crystal = simpleMesh(new THREE.OctahedronGeometry(0.45, 0), '#9575cd',
        { emissive: '#9575cd', emissiveIntensity: 0.8 });
      crystal.position.set(Math.cos(a) * 9.4, 0.5, Math.sin(a) * 7.2 - 1);
      base.group.add(crystal);
    }

    // Wall pads: the cave's melody display.
    for (let i = 0; i < pads; i += 1) {
      const pad = simpleMesh(new THREE.CylinderGeometry(0.9, 0.9, 0.3, 16), PAD_HEX[i],
        { emissive: PAD_HEX[i], emissiveIntensity: 0.1 });
      pad.rotation.x = Math.PI / 2;
      pad.position.set((i - (pads - 1) / 2) * 2.4, 4.4, -5.9);
      wallPads.push(pad);
      base.group.add(pad);
    }

    // Team echo drums: two rows facing the wall.
    for (const ti of [0, 1]) {
      const rowZ = ti === 0 ? 1.2 : 4.6;
      for (let i = 0; i < pads; i += 1) {
        const drum = simpleMesh(new THREE.CylinderGeometry(0.72, 0.85, 0.7, 12), PAD_HEX[i],
          { emissive: PAD_HEX[i], emissiveIntensity: 0.08 });
        drum.position.set((i - (pads - 1) / 2) * 2.4, 0.35, rowZ);
        teamPads[ti].push(drum);
        base.group.add(drum);
      }
      // Team banner stone.
      const banner = simpleMesh(new THREE.ConeGeometry(0.4, 1, 4), TEAM_HEX[ti],
        { emissive: TEAM_HEX[ti], emissiveIntensity: 0.4 });
      banner.position.set(-(pads / 2) * 2.4 - 1.6, 1, rowZ);
      base.group.add(banner);
    }

    base.withKit((kit) => {
      const rock = kitProp(kit, 'rock', { scale: 1.4 })
        ?? simpleMesh(new THREE.DodecahedronGeometry(1, 0), '#443c5c');
      rock.position.set(8.6, 0.4, -3.5);
      base.group.add(rock);
    });
  }

  function mount(sceneRoot) {
    const state = base.tracker.sample().curr ?? {};
    buildScene(state);
    const pads = state.pads ?? 4;
    (state.order ?? []).forEach((pid, i) => {
      const p = state.players?.[pid] ?? { team: 0, memberIdx: i };
      const token = makePlayerToken(base, {
        id: pid, name: pid, color: PLAYER_COLORS[i % PLAYER_COLORS.length], scale: 0.75,
      });
      const members = state.teams?.[p.team]?.members?.length ?? 1;
      const x = (p.memberIdx - (members - 1) / 2) * ((pads * 2.4) / Math.max(1, members));
      token.position.set(x, 0, p.team === 0 ? 2.6 : 6);
      token.rotation.y = Math.PI; // Face the cave wall.
      tokens.set(pid, token);
      base.group.add(token);
    });
    (sceneRoot ?? engine?.scene)?.add(base.group);
    base.applyCamera();
  }

  function update(dtRender, _alpha) {
    const { prev, curr } = base.tracker.sample();
    if (curr) {
      const showStep = curr.showStep ?? 16;

      // Wall pads flash the melody during the show phase.
      const elapsed = curr.tick - curr.phaseTick;
      let litPad = -1;
      if (curr.phase === 'show' && curr.tick > curr.countdownTicks) {
        const noteIdx = Math.floor(elapsed / showStep);
        const within = elapsed % showStep;
        if (noteIdx >= 0 && noteIdx < (curr.seq ?? []).length && within < showStep * 0.72) {
          litPad = curr.seq[noteIdx];
          if (within === 0) base.sfx('drum', { pitch: 0.9 + litPad * 0.15, vol: 0.55 });
        }
      }
      wallPads.forEach((pad, i) => {
        pad.material.emissiveIntensity = i === litPad ? 1.4 : 0.1;
        pad.scale.setScalar(i === litPad ? 1.15 : 1);
      });

      // Echo drums pulse back down and flash on team hits.
      teamPads.forEach((row) => {
        row.forEach((drum) => {
          drum.material.emissiveIntensity = Math.max(
            0.08, drum.material.emissiveIntensity - dtRender * 3,
          );
          drum.scale.y = Math.max(1, drum.scale.y - dtRender * 4);
        });
      });
      for (const pid of curr.order ?? []) {
        const p = curr.players[pid];
        const q = prev?.players?.[pid] ?? p;
        const token = tokens.get(pid);
        if (!p) continue;
        if (p.hitTick === curr.tick && p.hitTick !== (q.hitTick ?? -1)) {
          const team = curr.teams[p.team];
          const pad = curr.seq[Math.max(0, team.progress - 1)];
          const drum = teamPads[p.team]?.[pad];
          if (drum) {
            drum.material.emissiveIntensity = 1.5;
            drum.scale.y = 1.35;
          }
          base.sfx('drum', { pitch: 1 + pad * 0.15, vol: 0.8 });
          if (token) token.position.y = 0.45;
        }
        if (p.failTick === curr.tick && p.failTick !== (q.failTick ?? -1)) {
          base.sfx('error', { vol: 0.7 });
          base.burst('smoke', {
            pos: { x: token?.position.x ?? 0, y: 1, z: token?.position.z ?? 0 }, count: 8,
          });
          if (token) token.rotation.z = 0.3;
        }
        if (token) {
          token.position.y = Math.max(0, token.position.y - dtRender * 3);
          token.rotation.z *= Math.max(0, 1 - dtRender * 5);
        }
      }

      // Team completes the echo: sparkle over their row.
      (curr.teams ?? []).forEach((team, ti) => {
        const qTeam = prev?.teams?.[ti];
        if (team.done && qTeam && !qTeam.done) {
          base.sfx('ding', { vol: 0.8, pitch: 1.2 });
          base.burst('starburst', { pos: { x: 0, y: 2, z: ti === 0 ? 1.2 : 4.6 }, count: 14 });
        }
      });

      if (curr.phase === 'show' && prev?.phase === 'inter') {
        base.sfx('countdown', { vol: 0.5 }); // New, longer melody incoming.
      }
      if (curr.finished && !(prev?.finished ?? false)) {
        base.sfx('fanfare', { vol: 0.9 });
        base.burst('confetti', { pos: { x: 0, y: 4, z: 2 } });
      }
    }
    base.update(dtRender);
  }

  function dispose() {
    tokens.clear();
    wallPads.length = 0;
    teamPads[0].length = 0;
    teamPads[1].length = 0;
    base.dispose();
  }

  return { mount, update, dispose };
}

export default createView;
