/**
 * Bomb Banana view: a torch-lit jungle clearing at dusk, monkeys sat in a
 * circle on stumps, a fizzing banana-bomb that hops holder to holder with
 * a whoosh, and a big boom (flash + shake + charred token) on detonation.
 *
 * The fuse length stays hidden: the fizz visuals are driven purely by the
 * tick, never by the remaining fuse.
 */

import * as THREE from 'three';
import {
  createViewBase, makePlayerToken, simpleMesh, kitProp, lerp, PLAYER_COLORS,
} from '../../viewHarness.js';

const CIRCLE_RADIUS = 5.5;

export function createView({ sim, engine }) {
  const base = createViewBase({
    engine,
    sim,
    cameraPreset: { pos: [0, 10, 11.5], look: [0, 0.6, 0], fov: 50 },
  });
  const tokens = new Map();
  const seatPos = new Map();
  let bomb = null;
  let fuseSpark = null;
  let shakeTime = 0;
  let lastHolder = null;
  let lastBoomAt = -1;

  function seatXZ(i, n) {
    const a = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
    return { x: Math.cos(a) * CIRCLE_RADIUS, z: Math.sin(a) * CIRCLE_RADIUS };
  }

  function buildArena(state) {
    const n = (state.order ?? []).length || 4;

    const clearing = simpleMesh(new THREE.CylinderGeometry(CIRCLE_RADIUS + 3.5, CIRCLE_RADIUS + 4.2, 0.6, 22), '#33691e');
    clearing.position.y = -0.3;
    base.group.add(clearing);

    // Center powder-keg pedestal (pure set dressing, hints at the theme).
    const keg = simpleMesh(new THREE.CylinderGeometry(0.8, 0.9, 1.1, 10), '#5d4037');
    keg.position.y = 0.55;
    base.group.add(keg);

    for (let i = 0; i < n; i += 1) {
      const { x, z } = seatXZ(i, n);
      const stump = simpleMesh(new THREE.CylinderGeometry(0.55, 0.65, 0.5, 9), '#6d4c41');
      stump.position.set(x, 0.25, z);
      base.group.add(stump);
    }

    base.withKit((kit) => {
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2 + 0.3;
        const torch = kitProp(kit, 'torch', { scale: 1 })
          ?? (() => {
            const g = new THREE.Group();
            const pole = simpleMesh(new THREE.CylinderGeometry(0.08, 0.1, 2, 6), '#4e342e');
            pole.position.y = 1;
            g.add(pole);
            const flame = simpleMesh(new THREE.ConeGeometry(0.22, 0.5, 6), '#ff9800',
              { emissive: '#ff6d00', emissiveIntensity: 1.2 });
            flame.position.y = 2.2;
            g.add(flame);
            return g;
          })();
        torch.position.set(Math.cos(a) * (CIRCLE_RADIUS + 2.6), 0, Math.sin(a) * (CIRCLE_RADIUS + 2.6));
        base.group.add(torch);
      }
      for (let i = 0; i < 4; i += 1) {
        const a = (i / 4) * Math.PI * 2 + 1.1;
        const palm = kitProp(kit, 'palm', { scale: 1.1 })
          ?? simpleMesh(new THREE.ConeGeometry(0.8, 2.6, 6), '#1b5e20');
        palm.position.set(Math.cos(a) * (CIRCLE_RADIUS + 4.5), 0, Math.sin(a) * (CIRCLE_RADIUS + 4.5));
        base.group.add(palm);
      }
    });

    // The bomb: a fat banana with a stubby black fuse cap.
    bomb = new THREE.Group();
    const body = simpleMesh(new THREE.TorusGeometry(0.34, 0.13, 6, 10, Math.PI * 1.35), '#ffe135');
    body.rotation.z = Math.PI / 5;
    bomb.add(body);
    const cap = simpleMesh(new THREE.CylinderGeometry(0.07, 0.09, 0.22, 6), '#212121');
    cap.position.set(0.28, 0.3, 0);
    bomb.add(cap);
    fuseSpark = simpleMesh(new THREE.IcosahedronGeometry(0.09, 0), '#ffab00',
      { emissive: '#ff6d00', emissiveIntensity: 1.6 });
    fuseSpark.position.set(0.28, 0.48, 0);
    bomb.add(fuseSpark);
    bomb.visible = false;
    base.group.add(bomb);
  }

  function mount(sceneRoot) {
    const state = base.tracker.sample().curr ?? {};
    buildArena(state);
    const n = (state.order ?? []).length;
    (state.order ?? []).forEach((pid, i) => {
      const { x, z } = seatXZ(i, n);
      seatPos.set(pid, { x, z });
      const token = makePlayerToken(base, {
        id: pid, name: pid, color: PLAYER_COLORS[i % PLAYER_COLORS.length], scale: 0.9,
      });
      token.position.set(x, 0.5, z);
      token.lookAt(0, 0.5, 0);
      tokens.set(pid, token);
      base.group.add(token);
    });
    (sceneRoot ?? engine?.scene)?.add(base.group);
    base.applyCamera();
  }

  function update(dtRender, alpha) {
    const { prev, curr } = base.tracker.sample();
    if (curr) {
      const holder = curr.bomb?.holder ?? null;

      // Bomb hops toward its holder (smooth chase gives a nice pass arc).
      if (bomb) {
        bomb.visible = Boolean(holder);
        if (holder) {
          const target = seatPos.get(holder);
          if (target) {
            if (lastHolder === null) bomb.position.set(target.x, 2.2, target.z);
            const k = Math.min(1, dtRender * 9);
            bomb.position.x = lerp(bomb.position.x, target.x, k);
            bomb.position.z = lerp(bomb.position.z, target.z, k);
            // Hop while traveling, hover + wobble while held.
            const travel = Math.hypot(bomb.position.x - target.x, bomb.position.z - target.z);
            bomb.position.y = 2.2 + Math.min(1.3, travel * 0.45) + Math.sin(curr.tick * 0.4 + alpha) * 0.08;
            bomb.rotation.y += dtRender * (3 + travel * 4);
          }
          // Fizz: constant, deterministic-looking, never reveals the fuse.
          if (fuseSpark) {
            const pulse = 1 + Math.sin(curr.tick * 0.9 + alpha) * 0.45;
            fuseSpark.scale.setScalar(pulse);
          }
          if (curr.tick % 6 === 0 && prev && prev.tick !== curr.tick) {
            base.burst('spark', { pos: { x: bomb.position.x, y: bomb.position.y + 0.5, z: bomb.position.z }, count: 2 });
          }
        }

        // Pass feedback.
        if (holder && lastHolder && holder !== lastHolder) {
          base.sfx('whoosh', { vol: 0.7, pitch: 1.2 });
          const from = seatPos.get(lastHolder);
          if (from) base.burst('dust', { pos: { x: from.x, y: 1.4, z: from.z }, count: 5 });
        }
        lastHolder = holder;
      }

      // BOOM.
      if ((curr.boomAt ?? -1) > lastBoomAt) {
        lastBoomAt = curr.boomAt;
        const at = seatPos.get(curr.boomHolder) ?? { x: 0, z: 0 };
        base.sfx('boom', { vol: 1 });
        base.burst('explosion', { pos: { x: at.x, y: 1, z: at.z }, count: 40 });
        base.burst('smoke', { pos: { x: at.x, y: 1.4, z: at.z }, count: 20 });
        shakeTime = 0.45;
      }

      // Tokens: nervous idle bounce for the holder, charred fall when out.
      for (const pid of curr.order ?? []) {
        const token = tokens.get(pid);
        const p = curr.players?.[pid];
        const home = seatPos.get(pid);
        if (!token || !p || !home) continue;
        if (!p.alive) {
          token.position.y = Math.max(token.position.y - dtRender * 3, -0.1);
          token.rotation.x = Math.min(token.rotation.x + dtRender * 2, Math.PI / 2);
          continue;
        }
        const isHolder = pid === holder;
        token.position.y = 0.5 + (isHolder ? Math.abs(Math.sin(curr.tick * 0.5 + alpha)) * 0.22 : 0);
        const s = isHolder ? 0.98 : 0.9;
        token.scale.x += (s - token.scale.x) * Math.min(1, dtRender * 8);
        token.scale.z = token.scale.x;
      }

      // Decaying boom shake around the camera preset.
      const cam = engine?.camera;
      if (cam) {
        if (shakeTime > 0) {
          shakeTime = Math.max(0, shakeTime - dtRender);
          const k = shakeTime * 1.1;
          cam.position.set(
            (Math.random() * 2 - 1) * k,
            10 + (Math.random() * 2 - 1) * k * 0.6,
            11.5 + (Math.random() * 2 - 1) * k,
          );
          cam.lookAt(0, 0.6, 0);
        }
      }
    }
    base.update(dtRender);
  }

  function dispose() {
    tokens.clear();
    seatPos.clear();
    base.dispose();
  }

  return { mount, update, dispose };
}

export default createView;
