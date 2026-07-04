/**
 * Shared memoryPath view (serves every variant): a raised tile grid where
 * the secret path flashes tile by tile in the theme accent during the show
 * phase, then players' mini-tokens hop cell to cell as they retrace it.
 * Correct steps glow green under the token, mistakes flash red and drop
 * the offender off the board.
 *
 * Reads def.params ({theme, showTicksPerStep, gapTicks}) so temple_tiles,
 * neon_steps, ice_floes, ghost_lanterns and simon_supreme pace and look
 * like their own games.
 */

import * as THREE from 'three';
import {
  createViewBase, makePlayerToken, simpleMesh, kitProp, PLAYER_COLORS,
} from '../../viewHarness.js';

const PROPS_BY_SET = {
  jungle: ['palm', 'statue'],
  volcano: ['rock', 'torch'],
  city: ['crate', 'platform'],
  ice: ['ice_spike'],
  ghost: ['statue', 'torch'],
  factory: ['gear', 'crate'],
};

const TILE = 1.7;

export function createView({ sim, engine, def }) {
  const theme = def?.params?.theme ?? {};
  const accent = theme.palette?.accent ?? '#ffe135';
  const showTicks = def?.params?.showTicksPerStep ?? 13;
  const gapTicks = def?.params?.gapTicks ?? 6;
  const base = createViewBase({
    engine,
    sim,
    cameraPreset: { pos: [0, 12, 10], look: [0, 0, 0] },
  });
  const tokens = new Map();
  const tiles = []; // Row-major grid of tile meshes.
  let gridW = 5;
  let gridH = 5;

  const tileAt = (cx, cy) => tiles[cy * gridW + cx] ?? null;
  const worldX = (cx) => (cx - (gridW - 1) / 2) * TILE;
  const worldZ = (cy) => (cy - (gridH - 1) / 2) * TILE;

  function buildArena(state) {
    gridW = state.gridW ?? 5;
    gridH = state.gridH ?? 5;
    for (let cy = 0; cy < gridH; cy += 1) {
      for (let cx = 0; cx < gridW; cx += 1) {
        const tile = simpleMesh(
          new THREE.BoxGeometry(TILE * 0.92, 0.4, TILE * 0.92),
          theme.palette?.primary ?? '#2e7d32',
        );
        tile.position.set(worldX(cx), -0.2, worldZ(cy));
        tiles.push(tile);
        base.group.add(tile);
      }
    }
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(60, 12, 8),
      new THREE.MeshBasicMaterial({ color: theme.skyColor ?? '#87ceeb', side: THREE.BackSide }),
    );
    sky.material.userData.__mgOwned = true;
    base.group.add(sky);
    const names = PROPS_BY_SET[theme.propSet] ?? PROPS_BY_SET.jungle;
    base.withKit((kit) => {
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + 0.5;
        const r = Math.max(gridW, gridH) * TILE * 0.5 + 2.4;
        const prop = kitProp(kit, names[i % names.length], { scale: 0.9 + (i % 3) * 0.2 })
          ?? simpleMesh(new THREE.IcosahedronGeometry(0.6, 0), theme.palette?.secondary ?? '#8d6e63');
        prop.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        base.group.add(prop);
      }
    });
  }

  function mount(sceneRoot) {
    const state = base.tracker.sample().curr ?? {};
    buildArena(state);
    const ids = state.order ?? [];
    ids.forEach((pid, i) => {
      const token = makePlayerToken(base, {
        id: pid, name: pid, color: PLAYER_COLORS[i % PLAYER_COLORS.length], scale: 0.62,
      });
      tokens.set(pid, token);
      base.group.add(token);
    });
    (sceneRoot ?? engine?.scene)?.add(base.group);
    base.applyCamera();
  }

  const baseColor = new THREE.Color(theme.palette?.primary ?? '#2e7d32');
  const accentColor = new THREE.Color(accent);
  const goodColor = new THREE.Color('#66bb6a');

  function update(dtRender) {
    const { prev, curr } = base.tracker.sample();
    if (curr) {
      // Fade every tile back toward the base color, then re-light actives.
      for (const tile of tiles) {
        tile.material.color.lerp(baseColor, Math.min(1, dtRender * 6));
        tile.material.emissive?.set?.(0x000000);
        tile.position.y = THREE.MathUtils.lerp(tile.position.y, -0.2, Math.min(1, dtRender * 6));
      }

      if (curr.phase === 'show') {
        // Replay pacing mirrors the sim: showTicks lit + gapTicks dark per step.
        const elapsed = curr.tick - curr.phaseTick;
        const cycle = showTicks + gapTicks;
        const stepIdx = Math.floor(elapsed / cycle);
        const within = elapsed % cycle;
        const cell = curr.cells?.[stepIdx + 1];
        if (cell && within < showTicks) {
          const tile = tileAt(cell.x, cell.y);
          if (tile) {
            tile.material.color.copy(accentColor);
            tile.position.y = 0;
          }
        }
        // Start tile stays softly marked for orientation.
        const startTile = curr.start ? tileAt(curr.start.x, curr.start.y) : null;
        if (startTile) startTile.material.color.lerp(accentColor, 0.35);
      }

      const ids = curr.order ?? [];
      ids.forEach((pid, i) => {
        const token = tokens.get(pid);
        const p = curr.players[pid];
        const q = prev?.players?.[pid] ?? p;
        if (!token || !p) return;
        // Tiny per-seat offset so stacked tokens stay readable.
        const ox = ((i % 2) - 0.5) * 0.5;
        const oz = (Math.floor(i / 2) % 2 - 0.5) * 0.5;
        token.position.x = THREE.MathUtils.lerp(token.position.x, worldX(p.cx) + ox, Math.min(1, dtRender * 10));
        token.position.z = THREE.MathUtils.lerp(token.position.z, worldZ(p.cy) + oz, Math.min(1, dtRender * 10));
        if (!p.alive) {
          token.position.y = Math.max(-3, token.position.y - dtRender * 3);
        } else {
          const sinceStep = p.lastInputTick >= 0 ? curr.tick - p.lastInputTick : 99;
          token.position.y = sinceStep < 7 ? Math.sin((sinceStep / 7) * Math.PI) * 0.45 : 0;
          if (curr.phase === 'input' && p.lastInputOk && sinceStep < 5) {
            const under = tileAt(p.cx, p.cy);
            if (under) under.material.color.lerp(goodColor, 0.6);
          }
        }
        if (!p.alive && (q.alive ?? true)) {
          const under = tileAt(p.cx, p.cy);
          if (under) under.material.color.set('#ef5350');
          base.burst({ colors: ['#ef5350'], spread: 0.8, up: 1.6, life: 0.6, size: 0.12, count: 14 },
            { pos: { x: token.position.x, y: 0.6, z: token.position.z } });
          base.sfx('buzz', { vol: 0.7 });
        } else if (p.done && !(q.done ?? false) && p.alive) {
          base.burst({ colors: [accent], spread: 0.7, up: 2, life: 0.7, size: 0.12, count: 14 },
            { pos: { x: token.position.x, y: 1, z: token.position.z } });
          base.sfx('ding', { vol: 0.7 });
        }
      });
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
