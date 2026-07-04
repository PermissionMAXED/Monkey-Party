/**
 * MONKEY-PARTY board views (P5).
 *
 * Exports `boardViews`, a map of board id -> buildBoardView(engine, boardDef)
 * -> { group, updateMechanics(state, dt), nodeWorldPos(nodeId), dispose }.
 *
 * Also exports the shared scaffolding every per-board view uses: the base
 * view (node discs colored by type + path ribbons + blocked markers), a
 * deterministic scatter RNG, primitive fallback prop factories, and a
 * guarded loader for the engine kit (src/engine/*). The engine package is
 * built in parallel, so ALL engine imports are dynamic + try/catch with
 * plain-THREE fallbacks: these views load and render even when the engine
 * kit is absent.
 */

import * as THREE from 'three';

import { buildBoardView as jungleRuins } from './views/jungleRuins.js';
import { buildBoardView as volcanoIsland } from './views/volcanoIsland.js';
import { buildBoardView as neonMonkeyCity } from './views/neonMonkeyCity.js';
import { buildBoardView as pirateLagoon } from './views/pirateLagoon.js';
import { buildBoardView as goldenTemple } from './views/goldenTemple.js';
import { buildBoardView as cloudCanopy } from './views/cloudCanopy.js';
import { buildBoardView as underwaterReef } from './views/underwaterReef.js';
import { buildBoardView as icyCoconutPeak } from './views/icyCoconutPeak.js';
import { buildBoardView as ghostJungle } from './views/ghostJungle.js';
import { buildBoardView as monkeyFunfair } from './views/monkeyFunfair.js';
import { buildBoardView as roboBananaFactory } from './views/roboBananaFactory.js';
import { buildBoardView as gorillaPalace } from './views/gorillaPalace.js';

/** Map board id -> scene builder. */
export const boardViews = {
  jungle_ruins: jungleRuins,
  volcano_island: volcanoIsland,
  neon_monkey_city: neonMonkeyCity,
  pirate_lagoon: pirateLagoon,
  golden_temple: goldenTemple,
  cloud_canopy: cloudCanopy,
  underwater_reef: underwaterReef,
  icy_coconut_peak: icyCoconutPeak,
  ghost_jungle: ghostJungle,
  monkey_funfair: monkeyFunfair,
  robo_banana_factory: roboBananaFactory,
  gorilla_palace: gorillaPalace,
};

export default boardViews;

/* ------------------------------------------------------------------ */
/* Field color code (consistent across every board)                    */
/* ------------------------------------------------------------------ */

export const NODE_COLORS = {
  blue: 0x3a7bd5,
  red: 0xe5484d,
  event: 0xf5a623,
  shop: 0x3ecf8e,
  star: 0xffd23f,
  item: 0x9b59b6,
  boss: 0x8b0000,
  trap: 0x7f8c8d,
  start: 0xffffff,
  junction: 0xf39c12,
  special: 0xe056fd,
};

/* ------------------------------------------------------------------ */
/* Deterministic scatter RNG (views only; sims must use shared/rng.js) */
/* ------------------------------------------------------------------ */

/**
 * Tiny deterministic mulberry32 for prop scattering (render-only).
 * @param {number} seed
 * @returns {() => number} float in [0, 1)
 */
export function makeRand(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* Guarded engine kit loader                                           */
/* ------------------------------------------------------------------ */

/**
 * Engine module paths kept in variables (with @vite-ignore below) so
 * bundlers don't hard-fail while src/engine/* doesn't exist yet.
 */
const ENGINE_MODULE_PATHS = {
  propKit: '../engine/propKit.js',
  materials: '../engine/materials.js',
  primitives: '../engine/primitives.js',
  particles: '../engine/particles.js',
};

let kitPromise = null;

/**
 * Load the engine kit modules. Never rejects: missing/broken modules
 * resolve to null entries and the views fall back to plain THREE meshes.
 *
 * @returns {Promise<{propKit: *, materials: *, primitives: *, particles: *}>}
 */
export function loadEngineKit() {
  if (!kitPromise) {
    kitPromise = (async () => {
      const kit = {};
      for (const [name, path] of Object.entries(ENGINE_MODULE_PATHS)) {
        try {
          kit[name] = await import(/* @vite-ignore */ path);
        } catch {
          kit[name] = null;
        }
      }
      return kit;
    })();
  }
  return kitPromise;
}

/**
 * Try to build a themed prop through the engine propKit, guarding against
 * any missing/mismatched API. Returns null when the kit can't provide one
 * (callers then keep their primitive fallback).
 *
 * @param {Object} kit Resolved engine kit (from loadEngineKit()).
 * @param {string} name Prop name, e.g. 'palm', 'rock', 'lantern'.
 * @param {Object} [opts]
 * @returns {*} THREE.Object3D or null.
 */
export function kitProp(kit, name, opts = {}) {
  try {
    const pk = kit?.propKit;
    if (!pk) return null;
    // Convention A: named factories like makePalm / makeStatue / makeTorch.
    const pascal = String(name)
      .split(/[_\s-]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join('');
    const named = pk[`make${pascal}`];
    if (typeof named === 'function') {
      const obj = named(opts);
      if (obj && obj.isObject3D) return obj;
    }
    // Convention B: a generic factory taking the prop name.
    const make = pk.createProp ?? pk.makeProp ?? pk.prop ?? pk.default;
    if (typeof make === 'function') {
      const obj = make(name, opts);
      if (obj && obj.isObject3D) return obj;
    }
  } catch {
    /* engine kit is optional - primitive fallbacks cover us */
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Primitive fallback props (plain THREE meshes)                       */
/* ------------------------------------------------------------------ */

function mesh(geo, color, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.85,
    metalness: opts.metalness ?? 0.05,
    ...(opts.emissive ? { emissive: opts.emissive, emissiveIntensity: opts.emissiveIntensity ?? 0.6 } : {}),
    ...(opts.transparent ? { transparent: true, opacity: opts.opacity ?? 0.6 } : {}),
  });
  return new THREE.Mesh(geo, mat);
}

/** Primitive fallback prop factories. Every factory returns an Object3D. */
export const prop = {
  /** Palm/conifer-ish tree: trunk + 1-3 crown blobs. */
  tree({ trunkH = 2.2, crownR = 1.1, trunk = 0x6b4a2b, crown = 0x2e8b57, shape = 'cone' } = {}) {
    const grp = new THREE.Group();
    const t = mesh(new THREE.CylinderGeometry(0.14, 0.22, trunkH, 6), trunk);
    t.position.y = trunkH / 2;
    grp.add(t);
    const crownGeo = shape === 'cone'
      ? new THREE.ConeGeometry(crownR, crownR * 1.6, 7)
      : new THREE.SphereGeometry(crownR, 8, 6);
    const c = mesh(crownGeo, crown);
    c.position.y = trunkH + crownR * 0.7;
    grp.add(c);
    return grp;
  },
  rock({ r = 0.7, color = 0x8a8a80 } = {}) {
    return mesh(new THREE.DodecahedronGeometry(r, 0), color, { roughness: 1 });
  },
  column({ r = 0.4, h = 3, color = 0xcfc3a8 } = {}) {
    const grp = new THREE.Group();
    const shaft = mesh(new THREE.CylinderGeometry(r, r * 1.1, h, 8), color);
    shaft.position.y = h / 2;
    grp.add(shaft);
    const cap = mesh(new THREE.BoxGeometry(r * 2.6, r * 0.6, r * 2.6), color);
    cap.position.y = h + r * 0.3;
    grp.add(cap);
    return grp;
  },
  crystal({ h = 1.4, color = 0x9fe8ff, emissive = null } = {}) {
    const m = mesh(new THREE.OctahedronGeometry(h * 0.5, 0), color, emissive ? { emissive } : {});
    m.scale.y = 1.8;
    m.position.y = h * 0.7;
    return m;
  },
  lamp({ h = 2.4, pole = 0x444450, glow = 0xffe08a } = {}) {
    const grp = new THREE.Group();
    const p = mesh(new THREE.CylinderGeometry(0.07, 0.1, h, 6), pole);
    p.position.y = h / 2;
    grp.add(p);
    const bulb = mesh(new THREE.SphereGeometry(0.28, 8, 6), glow, { emissive: glow, emissiveIntensity: 1 });
    bulb.position.y = h + 0.2;
    grp.add(bulb);
    return grp;
  },
  box({ w = 1, h = 1, d = 1, color = 0xa0764b } = {}) {
    const m = mesh(new THREE.BoxGeometry(w, h, d), color);
    m.position.y = h / 2;
    return m;
  },
  cone({ r = 0.6, h = 1.4, color = 0xcccccc } = {}) {
    const m = mesh(new THREE.ConeGeometry(r, h, 8), color);
    m.position.y = h / 2;
    return m;
  },
  blob({ r = 0.8, color = 0xffffff, flat = 0.55, transparent = false } = {}) {
    const m = mesh(new THREE.SphereGeometry(r, 8, 6), color, transparent ? { transparent: true, opacity: 0.8 } : {});
    m.scale.y = flat;
    m.position.y = r * flat;
    return m;
  },
  torus({ R = 1.2, r = 0.12, color = 0xffd23f } = {}) {
    return mesh(new THREE.TorusGeometry(R, r, 8, 24), color);
  },
};

/* ------------------------------------------------------------------ */
/* Base board view                                                     */
/* ------------------------------------------------------------------ */

/**
 * Build the layer every board shares: colored node discs, path ribbons,
 * per-node blocked markers, position lookup and full disposal. The engine
 * kit is attempted asynchronously via base.withKit(cb).
 *
 * @param {*} engine Engine handle (opaque; may be null in tests/headless).
 * @param {Object} def BoardDef.
 * @returns {Object} base view helper bag.
 */
export function createBaseView(engine, def) {
  const group = new THREE.Group();
  group.name = `board:${def.id}`;

  const nodePos = new Map(def.nodes.map((n) => [n.id, new THREE.Vector3(n.pos[0], n.pos[1], n.pos[2])]));
  const discByNode = new Map();
  const blockMarkers = new Map();
  const state = { disposed: false };

  /* Node discs, colored by field type. */
  const discGeo = new THREE.CylinderGeometry(0.85, 0.95, 0.18, 20);
  const matByType = new Map();
  for (const node of def.nodes) {
    if (!matByType.has(node.type)) {
      matByType.set(node.type, new THREE.MeshStandardMaterial({
        color: NODE_COLORS[node.type] ?? 0xffffff,
        roughness: 0.6,
        metalness: 0.1,
      }));
    }
    const disc = new THREE.Mesh(discGeo, matByType.get(node.type));
    disc.position.copy(nodePos.get(node.id));
    disc.name = `node:${node.id}`;
    group.add(disc);
    discByNode.set(node.id, disc);
  }

  /* Path ribbons between connected nodes. */
  const ribbonGeo = new THREE.BoxGeometry(1, 0.07, 0.55);
  const ribbonMat = new THREE.MeshStandardMaterial({ color: 0xd9cfa8, roughness: 0.9 });
  const X_AXIS = new THREE.Vector3(1, 0, 0);
  for (const node of def.nodes) {
    const a = nodePos.get(node.id);
    for (const to of node.next) {
      const b = nodePos.get(to);
      if (!b) continue;
      const dir = new THREE.Vector3().subVectors(b, a);
      const len = dir.length();
      if (len < 0.001) continue;
      const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
      ribbon.scale.x = Math.max(0.1, len - 1.5);
      ribbon.position.copy(a).addScaledVector(dir, 0.5);
      ribbon.quaternion.setFromUnitVectors(X_AXIS, dir.clone().normalize());
      group.add(ribbon);
    }
  }

  /* Blocked-node markers (hidden until updateBlocked shows them). */
  const blockGeo = new THREE.OctahedronGeometry(0.45, 0);
  const blockMat = new THREE.MeshStandardMaterial({
    color: 0x7f8c8d,
    emissive: 0x2b2b2b,
    transparent: true,
    opacity: 0.9,
  });
  for (const node of def.nodes) {
    const marker = new THREE.Mesh(blockGeo, blockMat);
    marker.position.copy(nodePos.get(node.id));
    marker.position.y += 1.1;
    marker.visible = false;
    group.add(marker);
    blockMarkers.set(node.id, marker);
  }

  /**
   * Show/hide blocked markers from MatchState.board.blockedNodes.
   * @param {Object} matchState
   */
  function updateBlocked(matchState) {
    const blocked = new Set(matchState?.board?.blockedNodes ?? []);
    for (const [id, marker] of blockMarkers) marker.visible = blocked.has(id);
  }

  /**
   * @param {string} nodeId
   * @returns {THREE.Vector3} World position (clone) of the node.
   */
  function nodeWorldPos(nodeId) {
    const p = nodePos.get(nodeId);
    return p ? p.clone() : new THREE.Vector3();
  }

  /** Release every geometry/material under the group and detach it. */
  function dispose() {
    if (state.disposed) return;
    state.disposed = true;
    const geos = new Set();
    const mats = new Set();
    group.traverse((obj) => {
      if (obj.geometry) geos.add(obj.geometry);
      if (obj.material) {
        for (const m of Array.isArray(obj.material) ? obj.material : [obj.material]) mats.add(m);
      }
    });
    for (const geo of geos) geo.dispose();
    for (const mat of mats) mat.dispose();
    group.parent?.remove(group);
    group.clear();
  }

  /**
   * Run cb with the engine kit once it resolves (or with nulls when the
   * engine package is absent). Errors in cb never propagate.
   * @param {(kit: Object) => void} cb
   */
  function withKit(cb) {
    loadEngineKit().then((kit) => {
      if (state.disposed) return;
      try {
        cb(kit);
      } catch {
        /* keep primitive fallbacks */
      }
    });
  }

  return {
    engine,
    def,
    group,
    nodePos,
    discByNode,
    blockMarkers,
    nodeWorldPos,
    updateBlocked,
    withKit,
    dispose,
    state,
  };
}

/* ------------------------------------------------------------------ */
/* Scatter helper                                                      */
/* ------------------------------------------------------------------ */

/**
 * Deterministically scatter `count` props in a ring band around the board
 * center and add them to `parent`.
 *
 * @param {*} parent THREE.Object3D to add to.
 * @param {number} count
 * @param {(rand: () => number, i: number) => *} factory Prop factory.
 * @param {{rMin?: number, rMax?: number, y?: number|((r: () => number) => number), seed?: number}} [opts]
 * @returns {number} Number of props added.
 */
export function scatterProps(parent, count, factory, opts = {}) {
  const { rMin = 20, rMax = 27, seed = 7 } = opts;
  const rand = makeRand(seed);
  let added = 0;
  for (let i = 0; i < count; i += 1) {
    const obj = factory(rand, i);
    if (!obj) continue;
    const a = rand() * Math.PI * 2;
    const r = rMin + rand() * (rMax - rMin);
    const y = typeof opts.y === 'function' ? opts.y(rand) : (opts.y ?? 0);
    obj.position.x += Math.cos(a) * r;
    obj.position.z += Math.sin(a) * r;
    obj.position.y += y;
    obj.rotation.y = rand() * Math.PI * 2;
    const s = 0.75 + rand() * 0.6;
    obj.scale.multiplyScalar(s);
    parent.add(obj);
    added += 1;
  }
  return added;
}

/**
 * Read a mechanic's live state from MatchState with a fallback to the
 * def's initialState (pre-match / headless).
 *
 * @param {Object} matchState MatchState (may be null).
 * @param {Object} def BoardDef.
 * @param {string} mechId
 * @returns {Object} Mechanic state object (possibly the initialState).
 */
export function mechState(matchState, def, mechId) {
  const live = matchState?.board?.mechanics?.[mechId];
  if (live && typeof live === 'object') return live;
  return def.mechanics?.find((m) => m.id === mechId)?.initialState ?? {};
}
