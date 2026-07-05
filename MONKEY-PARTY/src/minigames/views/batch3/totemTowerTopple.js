/**
 * Totem Tower Topple view: a jungle temple courtyard with a stacked stone
 * totem. Blocks wear their glyph tier as carved color bands, the active
 * player's highlight pulses, the whole tower leans as instability grows,
 * and it crashes down in dust when someone topples it.
 */

import * as THREE from 'three';
import {
  createViewBase, makePlayerToken, simpleMesh, kitProp, PLAYER_COLORS,
} from '../../viewHarness.js';

const TIER_HEX = ['#81c784', '#ffd54f', '#e57373']; // Glyph tier 1..3.
const BLOCK_W = 1.05;
const BLOCK_H = 0.52;

export function createView({ sim, engine }) {
  const base = createViewBase({
    engine,
    sim,
    cameraPreset: { pos: [0, 6.5, 10.5], look: [0, 2.6, 0], fov: 52 },
  });
  const tokens = new Map();
  const blockMeshes = new Map(); // block id -> mesh
  let tower = null;
  let highlight = null;
  let toppled = false;

  function buildScene(state) {
    // Temple courtyard.
    const floor = simpleMesh(new THREE.CylinderGeometry(9, 9.5, 0.6, 20), '#8a7f63');
    floor.position.y = -0.3;
    base.group.add(floor);
    const plinth = simpleMesh(new THREE.BoxGeometry(4.4, 0.5, 4.4), '#6f6449');
    plinth.position.y = 0.25;
    base.group.add(plinth);
    // Mossy ruin pillars behind the totem.
    for (const side of [-1, 1]) {
      const pillar = simpleMesh(new THREE.CylinderGeometry(0.45, 0.55, 4.6, 8), '#7c8a6e');
      pillar.position.set(side * 5.4, 2.3, -3.4);
      base.group.add(pillar);
      const cap = simpleMesh(new THREE.BoxGeometry(1.4, 0.4, 1.4), '#66755b');
      cap.position.set(side * 5.4, 4.8, -3.4);
      base.group.add(cap);
    }

    // The totem itself: one mesh per block, color-banded by glyph hint.
    tower = new THREE.Group();
    tower.position.y = 0.5;
    base.group.add(tower);
    for (const block of state.blocks ?? []) {
      const mesh = simpleMesh(new THREE.BoxGeometry(BLOCK_W, BLOCK_H - 0.04, BLOCK_W), '#9e9276');
      const band = simpleMesh(
        new THREE.BoxGeometry(BLOCK_W * 0.55, 0.1, BLOCK_W + 0.02),
        TIER_HEX[(block.hint ?? 1) - 1],
        { emissive: TIER_HEX[(block.hint ?? 1) - 1], emissiveIntensity: 0.25 },
      );
      band.position.y = 0;
      mesh.add(band);
      mesh.position.set(
        (block.slot - ((state.slotsPerLayer ?? 3) - 1) / 2) * (BLOCK_W + 0.06),
        block.layer * BLOCK_H + BLOCK_H / 2,
        0,
      );
      blockMeshes.set(block.id, mesh);
      tower.add(mesh);
    }

    // Highlight frame for the selectable block.
    highlight = simpleMesh(new THREE.BoxGeometry(BLOCK_W + 0.22, BLOCK_H + 0.16, BLOCK_W + 0.22),
      '#ffffff', {
        emissive: '#ffe135', emissiveIntensity: 1, transparent: true, opacity: 0.35,
      });
    tower.add(highlight);

    base.withKit((kit) => {
      for (const side of [-1, 1]) {
        const torch = kitProp(kit, 'torch', { withFlickerLight: false })
          ?? simpleMesh(new THREE.ConeGeometry(0.2, 1.5, 5), '#ff9231');
        torch.position.set(side * 3.2, 0, 2.6);
        base.group.add(torch);
      }
    });
  }

  function mount(sceneRoot) {
    const state = base.tracker.sample().curr ?? {};
    buildScene(state);
    (state.order ?? []).forEach((pid, i) => {
      const token = makePlayerToken(base, {
        id: pid, name: pid, color: PLAYER_COLORS[i % PLAYER_COLORS.length], scale: 0.9,
      });
      token.position.set(i === 0 ? -3.6 : 3.6, 0, 2.2);
      token.rotation.y = i === 0 ? Math.PI / 3 : -Math.PI / 3;
      tokens.set(pid, token);
      base.group.add(token);
    });
    (sceneRoot ?? engine?.scene)?.add(base.group);
    base.applyCamera();
  }

  function update(dtRender, _alpha) {
    const { prev, curr } = base.tracker.sample();
    if (curr) {
      // Removed blocks vanish (with a thud on the fresh pull).
      for (const block of curr.blocks ?? []) {
        const mesh = blockMeshes.get(block.id);
        if (mesh) mesh.visible = !block.removed;
      }
      if (curr.lastPull && curr.lastPull.tick === curr.tick
        && (prev?.lastPull?.tick ?? -1) !== curr.tick) {
        base.sfx('thud', { vol: 0.7, pitch: 1 - Math.min(0.35, curr.lastPull.eff * 0.1) });
        const mesh = blockMeshes.get(curr.lastPull.id);
        if (mesh && tower) {
          base.burst('dust', {
            pos: {
              x: mesh.position.x, y: tower.position.y + mesh.position.y, z: 0.6,
            },
            count: 10,
          });
        }
      }

      // Highlight sits on the active player's cursor candidate.
      if (highlight) {
        const targetId = curr.candidates?.[curr.cursor];
        const mesh = targetId !== undefined ? blockMeshes.get(targetId) : null;
        highlight.visible = Boolean(mesh) && !curr.finished;
        if (mesh) {
          highlight.position.copy(mesh.position);
          const pulse = 0.3 + Math.abs(Math.sin(curr.tick * 0.2)) * 0.25;
          highlight.material.opacity = pulse;
          // Tint by whose turn it is.
          const activeSlot = curr.turn ?? 0;
          highlight.material.emissive.set(PLAYER_COLORS[activeSlot % PLAYER_COLORS.length]);
        }
      }

      // The tower leans further as instability builds.
      if (tower) {
        const strain = Math.min(1, (curr.instability ?? 0) / (curr.threshold ?? 13));
        const wobble = Math.sin(curr.tick * 0.11) * 0.012 * strain;
        tower.rotation.z = strain * 0.1 + wobble;
        tower.rotation.x = strain * 0.035;
      }

      // Topple!
      if (curr.finished && !(prev?.finished ?? false)) {
        if (curr.topplerSlot >= 0 && !toppled) {
          toppled = true;
          if (tower) tower.rotation.z = 1.25; // Crash sideways.
          base.sfx('impact_heavy', { vol: 1 });
          base.sfx('boo', { vol: 0.6 });
          base.burst('dust', { pos: { x: 1.5, y: 0.6, z: 0 }, count: 30 });
          base.burst('shockwave', { pos: { x: 0, y: 0.4, z: 0 } });
        } else {
          base.sfx('fanfare', { vol: 0.8 }); // Timer survival: steadier hands win.
          base.burst('confetti', { pos: { x: 0, y: 4, z: 0 } });
        }
      }

      // The waiting player idles, the active one leans in.
      (curr.order ?? []).forEach((pid, i) => {
        const token = tokens.get(pid);
        if (!token) return;
        const active = curr.turn === i && !curr.finished;
        const targetZ = active ? 1.3 : 2.2;
        token.position.z += (targetZ - token.position.z) * Math.min(1, dtRender * 5);
      });
    }
    base.update(dtRender);
  }

  function dispose() {
    tokens.clear();
    blockMeshes.clear();
    tower = null;
    highlight = null;
    base.dispose();
  }

  return { mount, update, dispose };
}

export default createView;
