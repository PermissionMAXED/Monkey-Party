/**
 * MONKEY-PARTY boards package (P5).
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 *
 * Exports:
 *  - default registerAll(): loads the 12 board defs and registers them into
 *    the singleton boards registry (idempotent).
 *  - graph-building helpers shared by every board def file.
 *  - BOARD_IDS / ITEM_IDS constants.
 *
 * Board files are loaded with dynamic imports from registerAll() so this
 * module never forms an import cycle with them (they statically import the
 * helpers below).
 */

import { boards } from '../../registries.js';
import { NODE_TYPES } from '../../constants.js';

/** Canonical board ids, in registration order. */
export const BOARD_IDS = [
  'jungle_ruins',
  'volcano_island',
  'neon_monkey_city',
  'pirate_lagoon',
  'golden_temple',
  'cloud_canopy',
  'underwater_reef',
  'icy_coconut_peak',
  'ghost_jungle',
  'monkey_funfair',
  'robo_banana_factory',
  'gorilla_palace',
];

/** Item ids the item package (P6) ships; shop stocks draw from these. */
export const ITEM_IDS = [
  'double_dice',
  'turbo_banana',
  'coconut_trap',
  'banana_peel',
  'swap_totem',
  'lucky_mask',
  'mini_gorilla',
  'ghost_banana',
  'shop_coupon',
  'dice_curse',
  'magnet_banana',
  'chaos_box',
  'golden_ticket',
  'shield_shell',
];

/* ------------------------------------------------------------------ */
/* Graph builder                                                       */
/* ------------------------------------------------------------------ */

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Create a small mutable board-graph builder.
 *
 * @returns {{
 *   add: (id: string, pos: number[], type: string, extra?: Object) => Object,
 *   get: (id: string) => Object,
 *   link: (from: string, ...tos: string[]) => void,
 *   chain: (ids: string[], opts?: {loop?: boolean}) => string[],
 *   run: (ids: string[], posFn: (i: number) => number[],
 *         type: string|((i: number) => string), extraFn?: (i: number) => Object) => string[],
 *   setType: (id: string, type: string) => void,
 *   setEvent: (id: string, eventKey: string, params?: Object) => void,
 *   build: () => Object[],
 * }}
 */
export function graph() {
  /** @type {Object[]} */
  const nodes = [];
  const byId = new Map();

  function add(id, pos, type, extra = {}) {
    if (byId.has(id)) throw new Error(`[boards] duplicate node id "${id}"`);
    if (!NODE_TYPES.includes(type)) throw new Error(`[boards] invalid node type "${type}" on "${id}"`);
    const node = {
      id,
      pos: [round2(Number(pos[0])), round2(Number(pos[1])), round2(Number(pos[2]))],
      type,
      next: [],
      ...extra,
    };
    byId.set(id, node);
    nodes.push(node);
    return node;
  }

  function get(id) {
    const node = byId.get(id);
    if (!node) throw new Error(`[boards] unknown node id "${id}"`);
    return node;
  }

  function link(from, ...tos) {
    const node = get(from);
    for (const to of tos) {
      if (!node.next.includes(to)) node.next.push(to);
    }
  }

  function chain(ids, { loop = false } = {}) {
    for (let i = 0; i < ids.length - 1; i += 1) link(ids[i], ids[i + 1]);
    if (loop && ids.length > 1) link(ids[ids.length - 1], ids[0]);
    return ids;
  }

  function run(ids, posFn, type, extraFn) {
    ids.forEach((id, i) => {
      add(id, posFn(i), typeof type === 'function' ? type(i) : type, extraFn ? extraFn(i) : {});
    });
    chain(ids);
    return ids;
  }

  function setType(id, type) {
    if (!NODE_TYPES.includes(type)) throw new Error(`[boards] invalid node type "${type}"`);
    get(id).type = type;
  }

  function setEvent(id, eventKey, params) {
    const node = get(id);
    node.type = 'event';
    node.event = eventKey;
    if (params) node.params = { ...(node.params ?? {}), ...params };
  }

  function build() {
    for (const node of nodes) {
      if (node.next.length === 0) {
        throw new Error(`[boards] node "${node.id}" has no next (dead end)`);
      }
      for (const to of node.next) {
        if (!byId.has(to)) throw new Error(`[boards] node "${node.id}" links to unknown "${to}"`);
      }
    }
    return nodes;
  }

  return { add, get, link, chain, run, setType, setEvent, build };
}

/* ------------------------------------------------------------------ */
/* Layout helpers                                                      */
/* ------------------------------------------------------------------ */

/**
 * Generate `count` sequential ids: prefix + zero-padded index.
 * @param {string} prefix
 * @param {number} count
 * @param {number} [start]
 * @returns {string[]}
 */
export function seq(prefix, count, start = 0) {
  return Array.from({ length: count }, (_, i) => prefix + String(start + i).padStart(2, '0'));
}

/**
 * Position function for `count` points on a (partial) circle.
 * `y` may be a constant or a function (i, t) => height.
 *
 * @param {number} count
 * @param {number} radius
 * @param {{cx?: number, cz?: number, start?: number, sweep?: number,
 *   y?: number|((i: number, t: number) => number)}} [opts]
 * @returns {(i: number) => number[]}
 */
export function circle(count, radius, opts = {}) {
  const { cx = 0, cz = 0, start = -Math.PI / 2, sweep = Math.PI * 2, y = 0 } = opts;
  return (i) => {
    const t = count > 0 ? i / count : 0;
    const a = start + sweep * t;
    const yy = typeof y === 'function' ? y(i, t) : y;
    return [cx + Math.cos(a) * radius, yy, cz + Math.sin(a) * radius];
  };
}

/**
 * Position function interpolating `count` points along a 3D polyline.
 *
 * @param {number[][]} points Waypoints [x, y, z] (at least 2).
 * @param {number} count Number of samples (>= 2).
 * @returns {(i: number) => number[]}
 */
export function alongPath(points, count) {
  const lengths = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const [ax, ay, az] = points[i];
    const [bx, by, bz] = points[i + 1];
    const len = Math.hypot(bx - ax, by - ay, bz - az);
    lengths.push(len);
    total += len;
  }
  return (i) => {
    const target = (count > 1 ? i / (count - 1) : 0) * total;
    let acc = 0;
    for (let s = 0; s < lengths.length; s += 1) {
      if (target <= acc + lengths[s] || s === lengths.length - 1) {
        const t = lengths[s] > 0 ? (target - acc) / lengths[s] : 0;
        const [ax, ay, az] = points[s];
        const [bx, by, bz] = points[s + 1];
        return [ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t];
      }
      acc += lengths[s];
    }
    return points[points.length - 1].slice();
  };
}

/**
 * Type function cycling through a pattern array.
 * @param {string[]} pattern
 * @returns {(i: number) => string}
 */
export function cycle(pattern) {
  return (i) => pattern[i % pattern.length];
}

/**
 * @param {string} en
 * @param {string} de
 * @returns {{en: string, de: string}}
 */
export function loc(en, de) {
  return { en, de };
}

/* ------------------------------------------------------------------ */
/* Runtime navigation helpers (used inside event/mechanic handlers)    */
/* ------------------------------------------------------------------ */

/**
 * Build a navigation helper over a finished node list. Handlers close over
 * this to walk players forward (movePlayer, triggers pass-by rules) or
 * knock them backward (teleport, ignores pass-by rules).
 *
 * @param {Object[]} nodes Board nodes (the array stored on the def).
 * @returns {{
 *   byId: Map<string, Object>,
 *   ahead: (fromId: string, steps: number) => string,
 *   behind: (fromId: string, steps: number) => string,
 *   playerNode: (sim: Object, pid: string) => string,
 *   forward: (sim: Object, pid: string, steps: number) => string,
 *   back: (sim: Object, pid: string, steps: number) => string,
 * }}
 */
export function makeNav(nodes) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const prev = new Map();
  for (const n of nodes) {
    for (const to of n.next) {
      if (!prev.has(to)) prev.set(to, n.id);
    }
  }

  function ahead(fromId, steps) {
    let cur = fromId;
    for (let i = 0; i < steps; i += 1) {
      const node = byId.get(cur);
      cur = node?.next?.[0] ?? cur;
    }
    return cur;
  }

  function behind(fromId, steps) {
    let cur = fromId;
    for (let i = 0; i < steps; i += 1) {
      cur = prev.get(cur) ?? cur;
    }
    return cur;
  }

  function playerNode(sim, pid) {
    return sim?.state?.players?.[pid]?.node ?? nodes[0].id;
  }

  function forward(sim, pid, steps) {
    const target = ahead(playerNode(sim, pid), steps);
    sim.movePlayer(pid, target);
    return target;
  }

  function back(sim, pid, steps) {
    const target = behind(playerNode(sim, pid), steps);
    sim.teleport(pid, target);
    return target;
  }

  return { byId, ahead, behind, playerNode, forward, back };
}

/**
 * All player ids in deterministic turn order (falls back to object key
 * order when turnOrder is absent).
 *
 * @param {Object} sim
 * @returns {string[]}
 */
export function allPlayers(sim) {
  const state = sim?.state ?? {};
  if (Array.isArray(state.turnOrder) && state.turnOrder.length > 0) return state.turnOrder.slice();
  return Object.keys(state.players ?? {});
}

/**
 * The current leader: most golden bananas, then most coins, then turn order.
 *
 * @param {Object} sim
 * @returns {string|null}
 */
export function leaderOf(sim) {
  const players = sim?.state?.players ?? {};
  let best = null;
  for (const pid of allPlayers(sim)) {
    const p = players[pid];
    if (!p) continue;
    if (
      best === null
      || (p.goldenBananas ?? 0) > (players[best].goldenBananas ?? 0)
      || ((p.goldenBananas ?? 0) === (players[best].goldenBananas ?? 0)
        && (p.coins ?? 0) > (players[best].coins ?? 0))
    ) {
      best = pid;
    }
  }
  return best;
}

/**
 * Remove one held item from a player (there is no sim.removeItem API, so
 * mutate the items array in place). Returns the removed item id or null.
 *
 * @param {Object} sim
 * @param {string} pid
 * @param {number} index Index into the items array (clamped).
 * @returns {string|null}
 */
export function takeItem(sim, pid, index = 0) {
  const items = sim?.state?.players?.[pid]?.items;
  if (!Array.isArray(items) || items.length === 0) return null;
  const i = Math.max(0, Math.min(items.length - 1, Math.floor(index)));
  return items.splice(i, 1)[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* registerAll                                                         */
/* ------------------------------------------------------------------ */

const LOADERS = {
  jungle_ruins: () => import('./jungleRuins.js'),
  volcano_island: () => import('./volcanoIsland.js'),
  neon_monkey_city: () => import('./neonMonkeyCity.js'),
  pirate_lagoon: () => import('./pirateLagoon.js'),
  golden_temple: () => import('./goldenTemple.js'),
  cloud_canopy: () => import('./cloudCanopy.js'),
  underwater_reef: () => import('./underwaterReef.js'),
  icy_coconut_peak: () => import('./icyCoconutPeak.js'),
  ghost_jungle: () => import('./ghostJungle.js'),
  monkey_funfair: () => import('./monkeyFunfair.js'),
  robo_banana_factory: () => import('./roboBananaFactory.js'),
  gorilla_palace: () => import('./gorillaPalace.js'),
};

let registered = false;

/**
 * Register all 12 board defs into the singleton boards registry.
 * Idempotent: repeat calls are no-ops.
 *
 * @returns {Promise<typeof boards>}
 */
export default async function registerAll() {
  if (registered) return boards;
  registered = true;
  for (const id of BOARD_IDS) {
    const mod = await LOADERS[id]();
    const def = mod.def ?? mod.default;
    if (!def || def.id !== id) {
      throw new Error(`[boards] module for "${id}" exported wrong def "${def?.id}"`);
    }
    boards.register(def);
  }
  return boards;
}
