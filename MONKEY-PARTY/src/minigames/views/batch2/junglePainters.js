/**
 * Jungle Painters view: a tile grid clearing that recolors live in the
 * two team paints, with monkeys sprinting and bumping over it.
 */

import * as THREE from 'three';
import {
  createViewBase, makePlayerToken, simpleMesh, kitProp, lerp, PLAYER_COLORS,
} from '../../viewHarness.js';

const TEAM_HEX = ['#42a5f5', '#ef5350'];
const UNPAINTED = '#66584a';

export function createView({ sim, engine }) {
  const base = createViewBase({
    engine,
    sim,
    cameraPreset: { pos: [0, 15, 13], look: [0, 0, 0] },
  });
  const tokens = new Map();
  const tiles = [];
  let grid = 12;
  let tileSize = 1.5;

  function buildArena(state) {
    grid = state.gridSize ?? 12;
    tileSize = state.tileSize ?? 1.5;
    const half = (grid * tileSize) / 2;
    for (let iz = 0; iz < grid; iz += 1) {
      for (let ix = 0; ix < grid; ix += 1) {
        const tile = simpleMesh(
          new THREE.BoxGeometry(tileSize * 0.94, 0.25, tileSize * 0.94),
          UNPAINTED,
        );
        tile.position.set(
          -half + (ix + 0.5) * tileSize,
          -0.125,
          -half + (iz + 0.5) * tileSize,
        );
        tiles.push(tile);
        base.group.add(tile);
      }
    }
    base.withKit((kit) => {
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        const bush = kitProp(kit, 'bush', { scale: 1.1 })
          ?? simpleMesh(new THREE.IcosahedronGeometry(0.7, 1), '#2e7d32');
        bush.position.set(Math.cos(a) * (half + 1.6), 0, Math.sin(a) * (half + 1.6));
        base.group.add(bush);
      }
    });
  }

  function mount(sceneRoot) {
    const state = base.tracker.sample().curr ?? {};
    buildArena(state);
    (state.order ?? []).forEach((pid, i) => {
      const p = state.players?.[pid];
      const token = makePlayerToken(base, {
        id: pid, name: pid, color: p ? TEAM_HEX[p.team] : PLAYER_COLORS[i % PLAYER_COLORS.length],
      });
      tokens.set(pid, token);
      base.group.add(token);
    });
    (sceneRoot ?? engine?.scene)?.add(base.group);
    base.applyCamera();
  }

  const teamColors = TEAM_HEX.map((hex) => new THREE.Color(hex));
  const unpaintedColor = new THREE.Color(UNPAINTED);

  function update(dtRender, alpha) {
    const { prev, curr } = base.tracker.sample();
    if (curr) {
      // Recolor tiles from the sim grid.
      const cells = curr.tiles ?? [];
      for (let i = 0; i < tiles.length && i < cells.length; i += 1) {
        const owner = cells[i];
        const target = owner < 0 ? unpaintedColor : teamColors[owner];
        tiles[i].material.color.lerp(target, Math.min(1, dtRender * 10));
      }

      for (const pid of curr.order ?? []) {
        const token = tokens.get(pid);
        const p = curr.players[pid];
        const q = prev?.players?.[pid] ?? p;
        if (!token || !p) continue;
        token.position.set(lerp(q.x, p.x, alpha), 0, lerp(q.z, p.z, alpha));
        const speed = Math.hypot(p.vx ?? 0, p.vz ?? 0);
        if (speed > 0.2) token.rotation.y = Math.atan2(p.vx, p.vz);
        if (p.lastPaintTick === curr.tick && p.lastPaintTick !== (q.lastPaintTick ?? -1)
          && curr.tick % 4 === 0) {
          base.burst({
            colors: [TEAM_HEX[p.team]], spread: 0.7, up: 1.2, life: 0.5, size: 0.1, count: 5,
          }, { pos: { x: p.x, y: 0.2, z: p.z } });
        }
        if (p.bumpedTick === curr.tick && p.bumpedTick !== (q.bumpedTick ?? -1)) {
          base.sfx('pop', { vol: 0.5 });
        }
      }
    }
    base.update(dtRender);
  }

  function dispose() {
    tokens.clear();
    tiles.length = 0;
    base.dispose();
  }

  return { mount, update, dispose };
}

export default createView;
