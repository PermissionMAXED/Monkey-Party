/**
 * Ghost Maze Escape view: hedge-wall maze built from the sim's wall
 * bitmasks, a glowing exit tile, a translucent ghost hunter and three
 * escapee monkeys that sink away when caught.
 */

import * as THREE from 'three';
import {
  createViewBase, makePlayerToken, simpleMesh, kitProp, lerp, PLAYER_COLORS,
} from '../../viewHarness.js';

const CELL = 2;

export function createView({ sim, engine }) {
  const base = createViewBase({
    engine,
    sim,
    cameraPreset: { pos: [0, 20, 14], look: [0, 0, 0], fov: 52 },
  });
  const tokens = new Map();
  let originX = 0;
  let originZ = 0;

  function cellPos(cx, cy) {
    return { x: originX + cx * CELL, z: originZ + cy * CELL };
  }

  function wallBox(x, z, alongX) {
    const geo = alongX
      ? new THREE.BoxGeometry(CELL + 0.15, 1.4, 0.3)
      : new THREE.BoxGeometry(0.3, 1.4, CELL + 0.15);
    const wall = simpleMesh(geo, '#2f5d34');
    wall.position.set(x, 0.7, z);
    return wall;
  }

  function buildMaze(state) {
    const w = state.mazeW ?? 9;
    const h = state.mazeH ?? 9;
    originX = -((w - 1) * CELL) / 2;
    originZ = -((h - 1) * CELL) / 2;

    const floor = simpleMesh(
      new THREE.BoxGeometry(w * CELL + 1.5, 0.4, h * CELL + 1.5),
      '#3a4a2f',
    );
    floor.position.y = -0.2;
    base.group.add(floor);

    for (let cy = 0; cy < h; cy += 1) {
      for (let cx = 0; cx < w; cx += 1) {
        const bits = state.walls[cy * w + cx];
        const c = cellPos(cx, cy);
        if ((bits & 4) !== 0) base.group.add(wallBox(c.x, c.z + CELL / 2, true)); // S
        if ((bits & 2) !== 0) base.group.add(wallBox(c.x + CELL / 2, c.z, false)); // E
        if (cy === 0 && (bits & 1) !== 0) base.group.add(wallBox(c.x, c.z - CELL / 2, true)); // N rim
        if (cx === 0 && (bits & 8) !== 0) base.group.add(wallBox(c.x - CELL / 2, c.z, false)); // W rim
      }
    }

    const exit = cellPos(state.exit?.x ?? w - 1, state.exit?.y ?? h - 1);
    const pad = simpleMesh(new THREE.CylinderGeometry(0.8, 0.8, 0.1, 12), '#ffe135',
      { emissive: '#ffd600', emissiveIntensity: 1.4 });
    pad.position.set(exit.x, 0.06, exit.z);
    base.group.add(pad);

    base.withKit((kit) => {
      const statue = kitProp(kit, 'statue', { scale: 0.8 });
      if (statue) {
        statue.position.set(exit.x, 0, exit.z - CELL);
        base.group.add(statue);
      }
    });
  }

  function mount(sceneRoot) {
    const state = base.tracker.sample().curr ?? {};
    buildMaze(state);
    (state.order ?? []).forEach((pid, i) => {
      const p = state.players?.[pid];
      const isGhost = p?.role === 'ghost';
      const token = makePlayerToken(base, {
        id: pid,
        name: isGhost ? `${pid} (ghost)` : pid,
        color: isGhost ? '#d1c4e9' : PLAYER_COLORS[i % PLAYER_COLORS.length],
        scale: isGhost ? 1.15 : 0.8,
      });
      if (isGhost) {
        token.traverse((o) => {
          if (o.isMesh && o.material) {
            o.material.transparent = true;
            o.material.opacity = 0.65;
          }
        });
      }
      tokens.set(pid, token);
      base.group.add(token);
    });
    (sceneRoot ?? engine?.scene)?.add(base.group);
    base.applyCamera();
  }

  function walkerPos(p, q, alpha) {
    const px = lerp(q.cx + (q.tx - q.cx) * q.prog, p.cx + (p.tx - p.cx) * p.prog, alpha);
    const py = lerp(q.cy + (q.ty - q.cy) * q.prog, p.cy + (p.ty - p.cy) * p.prog, alpha);
    return cellPos(px, py);
  }

  function update(dtRender, alpha) {
    const { prev, curr } = base.tracker.sample();
    if (curr) {
      for (const pid of curr.order ?? []) {
        const token = tokens.get(pid);
        const p = curr.players[pid];
        const q = prev?.players?.[pid] ?? p;
        if (!token || !p) continue;
        const pos = walkerPos(p, q, alpha);

        if (p.caught) {
          if (!(q.caught ?? false)) {
            base.sfx('error');
            base.burst({ colors: ['#b39ddb', '#4a148c'], spread: 1.4, up: 2, life: 0.9, size: 0.13, count: 20 },
              { pos: { x: pos.x, y: 1, z: pos.z } });
          }
          token.position.set(pos.x, Math.max(-1.4, token.position.y - dtRender * 1.5), pos.z);
          continue;
        }
        if (p.escaped) {
          if (!(q.escaped ?? false)) {
            base.sfx('star');
            base.burst('coinSparkle', { pos: { x: pos.x, y: 1, z: pos.z } });
          }
          token.position.set(pos.x, Math.min(3, token.position.y + dtRender * 2), pos.z);
          token.rotation.y += dtRender * 4;
          continue;
        }
        token.position.set(pos.x, p.role === 'ghost' ? 0.25 + Math.sin(curr.tick * 0.12) * 0.12 : 0, pos.z);
        if (p.moving) token.rotation.y = Math.atan2(p.tx - p.cx, p.ty - p.cy);
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
