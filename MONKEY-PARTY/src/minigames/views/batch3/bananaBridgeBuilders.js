/**
 * Banana Bridge Builders view: a jungle gorge with two rope bridges that
 * grow plank by plank, supply piles on the bank and monkeys that visibly
 * shoulder golden planks (and tumble into the mist when they slip).
 */

import * as THREE from 'three';
import {
  createViewBase, makePlayerToken, simpleMesh, kitProp, lerp, PLAYER_COLORS,
} from '../../viewHarness.js';

export function createView({ sim, engine }) {
  const base = createViewBase({
    engine,
    sim,
    cameraPreset: { pos: [0, 21, -19], look: [0, 0, 5], fov: 55 },
  });
  const tokens = new Map();
  const carryPlanks = new Map();
  const bridgePlanks = [[], []]; // Per team, one mesh per plank slot.

  function buildScene(state) {
    const plankLen = state.plankLen ?? 1.5;
    const goal = state.planksToWin ?? 8;
    const spanZ = goal * plankLen;

    // Near bank, gorge floor far below, far bank.
    const bank = simpleMesh(new THREE.BoxGeometry(24, 1, 12.6), '#3f7d3a');
    bank.position.set(0, -0.5, -6.2);
    base.group.add(bank);
    const farBank = simpleMesh(new THREE.BoxGeometry(24, 1, 6), '#356b31');
    farBank.position.set(0, -0.5, spanZ + 3);
    base.group.add(farBank);
    const gorge = simpleMesh(new THREE.BoxGeometry(24, 0.4, spanZ + 0.5), '#1d2b23');
    gorge.position.set(0, -4, spanZ / 2);
    base.group.add(gorge);

    for (const team of state.teams ?? []) {
      const ti = state.teams.indexOf(team);
      const teamColor = ti === 0 ? '#42a5f5' : '#ef5350';
      // Bridge posts + ropes.
      for (const side of [-1, 1]) {
        const post = simpleMesh(new THREE.CylinderGeometry(0.14, 0.16, 1.6, 6), '#6d4c41');
        post.position.set(team.bridgeX + side * 1.0, 0.8, -0.4);
        base.group.add(post);
        const rope = simpleMesh(new THREE.BoxGeometry(0.08, 0.08, spanZ), '#8d6e63');
        rope.position.set(team.bridgeX + side * 1.0, 1.1, spanZ / 2);
        base.group.add(rope);
      }
      // Plank slots (revealed as the team builds).
      for (let i = 0; i < goal; i += 1) {
        const plank = simpleMesh(new THREE.BoxGeometry(2.2, 0.18, plankLen * 0.92), '#ffca28');
        plank.position.set(team.bridgeX, 0.05, i * plankLen + plankLen / 2);
        plank.visible = false;
        base.group.add(plank);
        bridgePlanks[ti].push(plank);
      }
      // Supply pile.
      for (let i = 0; i < 4; i += 1) {
        const stack = simpleMesh(new THREE.BoxGeometry(2, 0.22, 0.7), '#ffb300');
        stack.position.set(team.pileX, 0.15 + i * 0.24, team.pileZ + (i % 2) * 0.2);
        stack.rotation.y = (i % 2) * 0.4;
        base.group.add(stack);
      }
      // Team flag.
      const flag = simpleMesh(new THREE.ConeGeometry(0.4, 0.9, 4), teamColor,
        { emissive: teamColor, emissiveIntensity: 0.4 });
      flag.position.set(team.pileX, 2.2, team.pileZ);
      base.group.add(flag);
    }

    base.withKit((kit) => {
      for (let i = 0; i < 5; i += 1) {
        const palm = kitProp(kit, 'palmTree', { scale: 0.9 })
          ?? simpleMesh(new THREE.ConeGeometry(0.9, 2.6, 6), '#2e7d32');
        palm.position.set(-10 + i * 5, 0, -11.4);
        base.group.add(palm);
      }
    });
  }

  function mount(sceneRoot) {
    const state = base.tracker.sample().curr ?? {};
    buildScene(state);
    (state.order ?? []).forEach((pid, i) => {
      const token = makePlayerToken(base, {
        id: pid, name: pid, color: PLAYER_COLORS[i % PLAYER_COLORS.length], scale: 0.85,
      });
      const carry = simpleMesh(new THREE.BoxGeometry(1.5, 0.14, 0.5), '#ffca28');
      carry.position.set(0, 1.9, 0);
      carry.visible = false;
      token.add(carry);
      carryPlanks.set(pid, carry);
      tokens.set(pid, token);
      base.group.add(token);
    });
    (sceneRoot ?? engine?.scene)?.add(base.group);
    base.applyCamera();
  }

  function update(dtRender, alpha) {
    const { prev, curr } = base.tracker.sample();
    if (curr) {
      (curr.teams ?? []).forEach((team, ti) => {
        bridgePlanks[ti].forEach((plank, i) => {
          plank.visible = i < team.planks;
        });
      });
      for (const pid of curr.order ?? []) {
        const token = tokens.get(pid);
        const p = curr.players[pid];
        const q = prev?.players?.[pid] ?? p;
        if (!token || !p) continue;
        token.position.set(lerp(q.x, p.x, alpha), 0.1, lerp(q.z, p.z, alpha));
        if (Math.hypot(p.vx ?? 0, p.vz ?? 0) > 0.3) {
          token.rotation.y = Math.atan2(p.vx, p.vz);
        }
        const carry = carryPlanks.get(pid);
        if (carry) carry.visible = Boolean(p.carrying);

        if (p.pickTick === curr.tick && p.pickTick !== (q.pickTick ?? -1)) {
          base.sfx('pop', { vol: 0.6 });
        }
        if (p.placeTick === curr.tick && p.placeTick !== (q.placeTick ?? -1)) {
          base.sfx('impact_heavy', { vol: 0.7 });
          base.burst('dust', { pos: { x: p.x, y: 0.4, z: p.z }, count: 10 });
        }
        if (p.fallTick === curr.tick && p.fallTick !== (q.fallTick ?? -1)) {
          base.sfx('boo', { vol: 0.7 });
          base.burst('leaves', { pos: { x: p.x, y: 0.6, z: p.z }, count: 14 });
        }
      }
      if (curr.finished && curr.winnerTeam >= 0 && !(prev?.finished ?? false)) {
        base.sfx('fanfare', { vol: 0.9 });
        const team = curr.teams[curr.winnerTeam];
        base.burst('confetti', { pos: { x: team.bridgeX, y: 2, z: team.planks * curr.plankLen } });
      }
    }
    base.update(dtRender);
  }

  function dispose() {
    tokens.clear();
    carryPlanks.clear();
    bridgePlanks[0].length = 0;
    bridgePlanks[1].length = 0;
    base.dispose();
  }

  return { mount, update, dispose };
}

export default createView;
