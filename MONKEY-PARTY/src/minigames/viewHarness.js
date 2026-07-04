/**
 * Minigame view harness (package P7, client side).
 *
 * runMinigame({ engine, input, def, driver, localSeats, players, onFinish })
 * owns the full client lifecycle of one minigame:
 *
 *   intro card (name/howTo/controls + 3-2-1 countdown synced to the sim)
 *   -> live HUD (timer + scores/team bars) rendered into #ui-root .mg-hud
 *   -> results freeze-frame with the final ranking
 *   -> onFinish(results)
 *
 * Drivers:
 *   { type:'local', sim }          - steps the sim at a fixed 30Hz
 *     (accumulator with capped 0.5s catch-up, so tab-blur never spirals),
 *     sampling local InputFrames per seat and calling def.bot for bots.
 *   { type:'net', on, sendInput }  - applies mg_state snapshots onto a
 *     display sim via applyState, interpolates between snapshots, and
 *     forwards local frames upstream.
 *
 * This module also exports the shared scenery/props toolkit used by every
 * batch-1 view (guarded engine-kit loading, monkey tokens with fallback
 * capsules + name tags, particles/sfx wrappers, camera presets).
 */

import * as THREE from 'three';
import { createRng } from '#shared/rng.js';
import { createFixedStepper, MINIGAME_HZ, COUNTDOWN_TICKS } from '#shared/minigames/framework.js';
import { clampFrame, emptyFrame } from '#shared/minigames/inputs.js';

/* ------------------------------------------------------------------ */
/* Guarded engine-kit loader                                           */
/* ------------------------------------------------------------------ */

/** Paths kept in variables (with @vite-ignore) so missing siblings never
 * break the bundle. monkeyFactory belongs to the characters package. */
const KIT_PATHS = {
  propKit: '../engine/propKit.js',
  primitives: '../engine/primitives.js',
  materials: '../engine/materials.js',
  particles: '../engine/particles.js',
  audio: '../engine/audio.js',
  cameraRig: '../engine/cameraRig.js',
  monkeyFactory: '../characters/monkeyFactory.js',
};

let kitPromise = null;

/**
 * Load every optional client module once. Never rejects; missing modules
 * resolve to null entries and callers keep their fallbacks.
 * @returns {Promise<Object>}
 */
export function loadViewKit() {
  if (!kitPromise) {
    kitPromise = (async () => {
      const kit = {};
      for (const [name, path] of Object.entries(KIT_PATHS)) {
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

/* ------------------------------------------------------------------ */
/* Small shared utilities                                              */
/* ------------------------------------------------------------------ */

/** Distinct per-seat player colors (8 seats). */
export const PLAYER_COLORS = [
  '#ef5350', '#42a5f5', '#ffca28', '#66bb6a',
  '#ab47bc', '#ff7043', '#26c6da', '#ec407a',
];

/** Linear interpolation. */
export const lerp = (a, b, t) => a + (b - a) * t;

/** Dispose every geometry/material below root and detach it. */
export function disposeObject(root) {
  if (!root) return;
  const geos = new Set();
  const mats = new Set();
  root.traverse((obj) => {
    if (obj.geometry) geos.add(obj.geometry);
    if (obj.material) {
      for (const m of Array.isArray(obj.material) ? obj.material : [obj.material]) mats.add(m);
    }
  });
  for (const g of geos) g.dispose();
  // Materials may be shared through the engine material cache; only dispose
  // ones we created ourselves (marked with userData.__mgOwned).
  for (const m of mats) {
    if (m.userData?.__mgOwned) m.dispose();
  }
  root.parent?.remove(root);
}

/** Owned (safe-to-dispose) MeshStandardMaterial. */
export function ownMat(color, opts = {}) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.rough ?? 0.85,
    metalness: opts.metal ?? 0,
    flatShading: opts.flat ?? true,
    transparent: Boolean(opts.transparent),
    opacity: opts.opacity ?? 1,
  });
  if (opts.emissive) {
    material.emissive = new THREE.Color(opts.emissive);
    material.emissiveIntensity = opts.emissiveIntensity ?? 0.8;
  }
  material.userData.__mgOwned = true;
  return material;
}

/** Shadow-casting mesh with an owned material. */
export function simpleMesh(geometry, color, opts = {}) {
  const mesh = new THREE.Mesh(geometry, ownMat(color, opts));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Floating name tag sprite (canvas texture). Returns null headless.
 * @param {string} text
 * @param {string} [color]
 */
export function makeNameTag(text, color = '#ffffff') {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = 'rgba(20,24,18,0.55)';
    ctx.beginPath();
    ctx.roundRect(8, 8, 240, 48, 14);
    ctx.fill();
    ctx.font = '700 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(String(text).slice(0, 12), 128, 33);
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    material.userData.__mgOwned = true;
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1.9, 0.48, 1);
    return sprite;
  } catch {
    return null;
  }
}

/** Fallback monkey: colored capsule body + head + ears, with a name tag. */
export function buildFallbackMonkey({ color = '#ef5350', name = '', scale = 1 } = {}) {
  const g = new THREE.Group();
  const body = simpleMesh(new THREE.CapsuleGeometry(0.38, 0.55, 2, 8), color);
  body.position.y = 0.72;
  g.add(body);
  const head = simpleMesh(new THREE.IcosahedronGeometry(0.3, 1), color);
  head.position.y = 1.42;
  g.add(head);
  const face = simpleMesh(new THREE.IcosahedronGeometry(0.16, 0), '#f3d5b3');
  face.position.set(0, 1.38, 0.2);
  g.add(face);
  for (const side of [-1, 1]) {
    const ear = simpleMesh(new THREE.IcosahedronGeometry(0.1, 0), color);
    ear.position.set(side * 0.3, 1.55, 0);
    g.add(ear);
  }
  const tag = makeNameTag(name, color);
  if (tag) {
    tag.position.y = 2.1;
    g.add(tag);
  }
  if (scale !== 1) g.scale.multiplyScalar(scale);
  return g;
}

/** Try the characters package's monkey factory (any plausible API). */
function tryMonkeyFactory(kit, { id, name, color, scale = 1 } = {}) {
  try {
    const mod = kit?.monkeyFactory;
    if (!mod) return null;
    const make = mod.createMonkey ?? mod.makeMonkey ?? mod.buildMonkey ?? mod.monkeyFactory ?? mod.default;
    if (typeof make !== 'function') return null;
    const obj = make({ characterId: id, name, build: { furColor: color, scale }, furColor: color, scale });
    if (obj && obj.isObject3D) {
      if (scale !== 1) obj.scale.multiplyScalar(scale);
      return obj;
    }
  } catch {
    /* fall back to the capsule monkey */
  }
  return null;
}

/**
 * Player token: fallback capsule immediately, upgraded to a monkeyFactory
 * mesh (plus name tag) when/if the characters package resolves.
 *
 * @param {ReturnType<typeof createViewBase>} base
 * @param {{id: string, name?: string, color?: string, scale?: number}} opts
 * @returns {THREE.Group} wrapper whose position/rotation the view drives.
 */
export function makePlayerToken(base, opts = {}) {
  const color = opts.color ?? PLAYER_COLORS[0];
  const wrapper = new THREE.Group();
  wrapper.name = `player:${opts.id}`;
  let current = buildFallbackMonkey({ color, name: opts.name ?? opts.id, scale: opts.scale ?? 1 });
  wrapper.add(current);
  base.withKit((kit) => {
    const fancy = tryMonkeyFactory(kit, { ...opts, color });
    if (!fancy) return;
    disposeObject(current);
    current = new THREE.Group();
    current.add(fancy);
    const tag = makeNameTag(opts.name ?? opts.id, color);
    if (tag) {
      tag.position.y = 2.1 * (opts.scale ?? 1);
      current.add(tag);
    }
    wrapper.add(current);
  });
  return wrapper;
}

/**
 * Themed prop through the engine propKit, guarded. Null when unavailable
 * (callers keep their primitive fallback).
 */
export function kitProp(kit, name, opts = {}) {
  try {
    const pk = kit?.propKit;
    if (!pk) return null;
    const pascal = String(name)
      .split(/[_\s-]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join('');
    const make = pk[`make${pascal}`];
    if (typeof make === 'function') {
      const obj = make(opts);
      if (obj && obj.isObject3D) return obj;
    }
  } catch {
    /* optional */
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* View base: state tracking, particles, sfx, camera                   */
/* ------------------------------------------------------------------ */

/**
 * Track sim snapshots for interpolation: sample() re-reads getState() and
 * shifts prev/curr when the tick advances.
 */
export function createStateTracker(sim) {
  let prev = null;
  let curr = null;
  function sample() {
    let s = null;
    try {
      s = sim.getState();
    } catch {
      return { prev, curr, changed: false };
    }
    if (!s) return { prev, curr, changed: false };
    if (!curr || s.tick !== curr.tick) {
      prev = curr ?? s;
      curr = s;
      return { prev, curr, changed: true };
    }
    return { prev, curr, changed: false };
  }
  return { sample, latest: () => curr };
}

/**
 * Shared scaffolding for every minigame view: a root group, guarded kit
 * loading, one particle system, sfx, and a per-game camera preset.
 *
 * @param {{engine: *, sim: *, cameraPreset?: {pos: number[], look: number[], fov?: number}}} opts
 */
export function createViewBase({ engine, sim, cameraPreset = null } = {}) {
  const group = new THREE.Group();
  group.name = 'minigame';
  const tracker = createStateTracker(sim);
  const state = { disposed: false, kit: null, particles: null, sfx: null };
  const kitQueue = [];

  loadViewKit().then((kit) => {
    if (state.disposed) return;
    state.kit = kit;
    try {
      if (kit.particles?.createParticles && engine?.scene) {
        state.particles = kit.particles.createParticles(engine.scene, engine.quality ?? 'med');
      }
    } catch {
      state.particles = null;
    }
    state.sfx = typeof kit.audio?.sfx === 'function' ? kit.audio.sfx : null;
    for (const cb of kitQueue.splice(0)) {
      try {
        cb(kit);
      } catch {
        /* decorations are optional */
      }
    }
  });

  /** Run cb once the kit resolves (immediately if it already has). */
  function withKit(cb) {
    if (state.kit) {
      try {
        cb(state.kit);
      } catch {
        /* optional */
      }
    } else {
      kitQueue.push(cb);
    }
  }

  /** One-shot particle burst (preset name or spec); no-op headless. */
  function burst(presetOrSpec, overrides) {
    try {
      state.particles?.burst(presetOrSpec, overrides);
    } catch {
      /* optional */
    }
  }

  /** Play a named engine sfx; no-op headless. */
  function sfx(name, opts) {
    try {
      state.sfx?.(name, opts);
    } catch {
      /* optional */
    }
  }

  /** Snap the engine camera to this game's preset. */
  function applyCamera(preset = cameraPreset) {
    const cam = engine?.camera;
    if (!cam || !preset) return;
    const [px, py, pz] = preset.pos ?? [0, 13, 12];
    const [lx, ly, lz] = preset.look ?? [0, 0, 0];
    cam.position.set(px, py, pz);
    if (preset.fov && cam.fov !== preset.fov) {
      cam.fov = preset.fov;
      cam.updateProjectionMatrix();
    }
    cam.lookAt(lx, ly, lz);
  }

  /** Per-frame housekeeping (drive particles). Call from view.update(). */
  function update(dt) {
    try {
      state.particles?.update(dt);
    } catch {
      /* optional */
    }
  }

  function dispose() {
    if (state.disposed) return;
    state.disposed = true;
    try {
      state.particles?.dispose();
    } catch {
      /* optional */
    }
    disposeObject(group);
  }

  return {
    group, tracker, withKit, burst, sfx, applyCamera, update, dispose, engine, state,
  };
}

/* ------------------------------------------------------------------ */
/* HUD (DOM overlay)                                                   */
/* ------------------------------------------------------------------ */

function el(tag, css, text) {
  const node = document.createElement(tag);
  if (css) node.style.cssText = css;
  if (text !== undefined) node.textContent = text;
  return node;
}

const HUD_CSS = 'position:absolute;inset:0;pointer-events:none;z-index:30;'
  + 'font-family:system-ui,sans-serif;color:#fff;';

function createHud(def, roster) {
  if (typeof document === 'undefined') return null;
  const uiRoot = document.getElementById('ui-root') ?? document.body;
  const hud = el('div', HUD_CSS);
  hud.className = 'mg-hud';

  /* Intro card */
  const intro = el('div', 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);'
    + 'background:rgba(12,20,12,0.88);border:2px solid rgba(255,225,53,0.6);border-radius:18px;'
    + 'padding:26px 34px;text-align:center;max-width:520px;');
  intro.className = 'mg-intro';
  intro.append(
    el('div', 'font-size:30px;font-weight:800;color:#ffe135;margin-bottom:6px;', def.name?.en ?? def.id),
    el('div', 'font-size:15px;opacity:0.9;margin-bottom:12px;', def.howTo?.en ?? ''),
    el('div', 'font-size:13px;opacity:0.7;margin-bottom:10px;',
      'Move: stick / WASD - A: primary - B: secondary'),
  );
  const countdownEl = el('div', 'font-size:64px;font-weight:900;color:#ffe135;', '3');
  countdownEl.className = 'mg-countdown';
  intro.appendChild(countdownEl);
  hud.appendChild(intro);

  /* Top bar: timer + scores */
  const bar = el('div', 'position:absolute;left:0;right:0;top:10px;display:flex;'
    + 'justify-content:center;gap:14px;align-items:center;flex-wrap:wrap;');
  bar.className = 'mg-bar';
  const timerEl = el('div', 'background:rgba(0,0,0,0.55);border-radius:12px;padding:6px 16px;'
    + 'font-size:24px;font-weight:800;color:#ffe135;', '');
  timerEl.className = 'mg-timer';
  bar.appendChild(timerEl);
  const scoreEls = new Map();
  roster.forEach((p, i) => {
    const chip = el('div', 'background:rgba(0,0,0,0.45);border-radius:10px;padding:4px 10px;'
      + `font-size:14px;font-weight:700;border-bottom:3px solid ${PLAYER_COLORS[i % PLAYER_COLORS.length]};`);
    chip.className = 'mg-score';
    chip.textContent = `${p.name}: -`;
    bar.appendChild(chip);
    scoreEls.set(p.id, chip);
  });
  hud.appendChild(bar);

  /* Team bars (hidden until a team game reports team scores) */
  const teamWrap = el('div', 'position:absolute;left:50%;top:56px;transform:translateX(-50%);'
    + 'display:none;gap:10px;');
  teamWrap.className = 'mg-teams';
  hud.appendChild(teamWrap);

  /* Results overlay (hidden) */
  const results = el('div', 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);'
    + 'background:rgba(12,20,12,0.92);border:2px solid rgba(255,225,53,0.6);border-radius:18px;'
    + 'padding:24px 40px;text-align:center;display:none;min-width:320px;');
  results.className = 'mg-results';
  hud.appendChild(results);

  uiRoot.appendChild(hud);
  return {
    root: hud,
    intro,
    countdownEl,
    timerEl,
    scoreEls,
    teamWrap,
    results,
    remove: () => hud.remove(),
  };
}

/** Best-effort generic "score" readout for the HUD chip. */
function hudValue(stateP) {
  if (!stateP || typeof stateP !== 'object') return '-';
  if (stateP.alive === false) return 'OUT';
  if (typeof stateP.score === 'number') return String(stateP.score);
  if (typeof stateP.roundsCleared === 'number') return `rd ${stateP.roundsCleared}`;
  if (typeof stateP.hits === 'number') return `${stateP.hits} hits`;
  if (typeof stateP.holdTicks === 'number') return `${(stateP.holdTicks / MINIGAME_HZ).toFixed(1)}s`;
  if (typeof stateP.x === 'number' && typeof stateP.finishTick === 'number') {
    return stateP.finishTick >= 0 ? 'FIN' : `${Math.round(stateP.x)}m`;
  }
  if (typeof stateP.z === 'number' && typeof stateP.finished === 'boolean') {
    return stateP.finished ? 'IDOL!' : `${Math.round(stateP.z)}m`;
  }
  return '-';
}

/* ------------------------------------------------------------------ */
/* runMinigame                                                         */
/* ------------------------------------------------------------------ */

function normalizeRoster(players, localSeats) {
  return (players ?? []).map((p, i) => {
    if (typeof p === 'string') {
      return {
        id: p,
        name: p,
        isBot: !(localSeats?.has?.(p)),
        difficulty: 'normal',
        seatColor: PLAYER_COLORS[i % PLAYER_COLORS.length],
      };
    }
    return {
      id: p.id,
      name: p.name ?? p.id,
      isBot: p.isBot ?? !(localSeats?.has?.(p.id)),
      difficulty: p.difficulty ?? 'normal',
      seatColor: PLAYER_COLORS[i % PLAYER_COLORS.length],
    };
  });
}

function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Run one minigame end-to-end on the client.
 *
 * @param {{
 *   engine: *,
 *   input: *,
 *   def: import('#shared/types.js').MinigameDef,
 *   driver: {type: 'local', sim: *}|{type: 'net', on: Function, sendInput: Function, seed?: number, params?: Object},
 *   localSeats: Map<string, number>,
 *   players: Array<string|{id: string, name?: string, isBot?: boolean, difficulty?: string}>,
 *   onFinish: (results: Object) => void,
 * }} opts
 * @returns {{ stop: () => void, dispose: () => void, sim: * }}
 */
export function runMinigame({ engine, input, def, driver, localSeats, players, onFinish } = {}) {
  const roster = normalizeRoster(players, localSeats);
  const ids = roster.map((p) => p.id);
  const isNet = driver?.type === 'net';

  /* -------- sim: authoritative (local) or display replica (net) ------ */
  let sim = null;
  if (isNet) {
    try {
      sim = def.createSim({
        seed: driver.seed ?? 0,
        players: ids,
        params: { ...def.params, ...(driver.params ?? {}) },
        rules: driver.rules ?? {},
      });
      sim.init();
    } catch {
      sim = null;
    }
  } else {
    sim = driver?.sim ?? null;
  }
  if (!sim) throw new Error(`[mg] runMinigame(${def?.id}): no sim available`);

  /* ------------------------------ view ------------------------------ */
  let view = null;
  try {
    view = def.createView({ sim, engine, input, localSeats });
  } catch {
    view = null;
  }
  if (view?.mount) {
    try {
      view.mount(engine?.scene ?? null);
    } catch {
      view = null;
    }
  }

  /* ------------------------------ HUD ------------------------------- */
  const hud = createHud(def, roster);
  const durationTicks = Math.round(def.durationSec * MINIGAME_HZ);

  /* ------------------------- local stepping -------------------------- */
  const botRngs = new Map();
  for (const p of roster) {
    if (p.isBot) botRngs.set(p.id, createRng(hashSeed(`${def.id}:${p.id}`)));
  }

  function collectInputs() {
    let publicState = null;
    try {
      publicState = sim.getState();
    } catch {
      publicState = null;
    }
    const inputs = {};
    for (const p of roster) {
      if (p.isBot) {
        try {
          inputs[p.id] = clampFrame(def.bot(publicState, p.id, p.difficulty, botRngs.get(p.id)));
        } catch {
          inputs[p.id] = emptyFrame();
        }
      } else {
        const seat = localSeats?.get?.(p.id);
        inputs[p.id] = clampFrame(input?.getFrame ? input.getFrame(seat ?? 0) : emptyFrame());
      }
    }
    return inputs;
  }

  // Fixed 30Hz stepper with capped catch-up (tab-blur safety).
  const stepper = createFixedStepper(sim, { hz: MINIGAME_HZ, maxCatchUpSec: 0.5 });

  /* --------------------------- net driver ---------------------------- */
  const unsubs = [];
  let netAlpha = 0;
  let lastSnapshotAt = 0;
  let netResults = null;
  if (isNet) {
    const now = () => (typeof performance !== 'undefined' ? performance.now() : 0);
    if (typeof driver.on === 'function') {
      const offState = driver.on('mg_state', (msg) => {
        const snapshot = msg?.snapshot ?? msg;
        if (!snapshot) return;
        try {
          sim.applyState(snapshot);
          lastSnapshotAt = now();
        } catch {
          /* keep the previous display state */
        }
      });
      const offEnd = driver.on('mg_end', (msg) => {
        netResults = msg?.results ?? null;
      });
      if (typeof offState === 'function') unsubs.push(offState);
      if (typeof offEnd === 'function') unsubs.push(offEnd);
    }
  }

  let netSendAcc = 0;
  function forwardLocalFrames(dt) {
    if (!isNet || typeof driver.sendInput !== 'function') return;
    netSendAcc += dt;
    const interval = 1 / MINIGAME_HZ;
    if (netSendAcc < interval) return;
    netSendAcc %= interval;
    for (const p of roster) {
      if (p.isBot) continue;
      const seat = localSeats?.get?.(p.id);
      const frame = clampFrame(input?.getFrame ? input.getFrame(seat ?? 0) : emptyFrame());
      try {
        driver.sendInput(frame, p.id);
      } catch {
        /* transport hiccups are the session's problem */
      }
    }
  }

  /* --------------------------- lifecycle ----------------------------- */
  let phase = 'playing'; // 'playing' | 'results' | 'done'
  let stopped = false;
  let resultsShownAt = -1;
  let elapsedSec = 0;

  function showResults(results) {
    phase = 'results';
    resultsShownAt = elapsedSec;
    if (hud) {
      hud.intro.style.display = 'none';
      hud.results.style.display = 'block';
      hud.results.textContent = '';
      hud.results.append(el('div', 'font-size:26px;font-weight:900;color:#ffe135;margin-bottom:12px;', 'Results'));
      const flat = (results?.ranking ?? []).flat();
      flat.forEach((pid, i) => {
        const p = roster.find((r) => r.id === pid);
        const coins = results?.coins?.[pid] ?? 0;
        hud.results.append(el(
          'div',
          `font-size:17px;font-weight:700;margin:3px 0;color:${p?.seatColor ?? '#fff'};`,
          `${i + 1}. ${p?.name ?? pid}  +${coins} coins`,
        ));
      });
    }
  }

  function finish(results) {
    if (phase === 'done') return;
    phase = 'done';
    try {
      onFinish?.(results);
    } catch {
      /* the host owns its own errors */
    }
  }

  function updateHud(state) {
    if (!hud || !state) return;
    const tick = state.tick ?? 0;
    // Intro card + countdown (synced to the sim's own countdown ticks).
    const cdTotal = state.countdownTicks ?? COUNTDOWN_TICKS;
    if (tick < cdTotal) {
      hud.intro.style.display = 'block';
      const remaining = Math.max(1, Math.ceil((cdTotal - tick) / MINIGAME_HZ));
      hud.countdownEl.textContent = String(remaining);
    } else if (phase === 'playing') {
      if (tick < cdTotal + MINIGAME_HZ) hud.countdownEl.textContent = 'GO!';
      else hud.intro.style.display = 'none';
    }
    // Timer.
    const total = state.durationTicks ?? durationTicks;
    const left = Math.max(0, Math.ceil((total - tick) / MINIGAME_HZ));
    hud.timerEl.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    // Score chips.
    for (const p of roster) {
      const chip = hud.scoreEls.get(p.id);
      if (chip) chip.textContent = `${p.name}: ${hudValue(state.players?.[p.id])}`;
    }
    // Team bars when the sim exposes team scores.
    if (Array.isArray(state.teams) && state.teams.some((t) => typeof t?.score === 'number')) {
      hud.teamWrap.style.display = 'flex';
      while (hud.teamWrap.children.length < state.teams.length) {
        hud.teamWrap.appendChild(el('div', 'background:rgba(0,0,0,0.5);border-radius:9px;'
          + 'padding:4px 14px;font-size:15px;font-weight:800;'));
      }
      state.teams.forEach((team, i) => {
        const bar = hud.teamWrap.children[i];
        bar.textContent = `Team ${i + 1}: ${team.score}`;
        bar.style.color = i === 0 ? '#7fd4ff' : '#ffab91';
      });
    }
  }

  function frame(dt) {
    if (stopped || phase === 'done') return;
    elapsedSec += dt;

    let alpha = 0;
    if (phase === 'playing') {
      if (isNet) {
        forwardLocalFrames(dt);
        // Interpolate between snapshots (assume snapshot cadence = tick rate).
        const now = typeof performance !== 'undefined' ? performance.now() : 0;
        netAlpha = lastSnapshotAt > 0
          ? Math.min(1, (now - lastSnapshotAt) / (1000 / MINIGAME_HZ))
          : 0;
        alpha = netAlpha;
        if (netResults) {
          showResults(netResults);
        }
      } else {
        stepper.advance(dt, () => collectInputs());
        alpha = stepper.alpha();
        if (sim.isFinished()) {
          let results = null;
          try {
            results = sim.getResults();
          } catch {
            results = { ranking: ids.slice(), coins: {}, stats: {} };
          }
          showResults(results);
        }
      }
    }

    let state = null;
    try {
      state = sim.getState();
    } catch {
      state = null;
    }
    updateHud(state);

    try {
      view?.update?.(dt, alpha);
    } catch {
      /* views must never take the loop down */
    }

    // Freeze-frame the results for a moment, then hand off.
    if (phase === 'results' && elapsedSec - resultsShownAt >= 3.5) {
      let results = netResults;
      if (!results) {
        try {
          results = sim.getResults();
        } catch {
          results = { ranking: ids.slice(), coins: {}, stats: {} };
        }
      }
      finish(results);
    }
  }

  /* ------------------------- drive the loop -------------------------- */
  let offFrame = null;
  let intervalId = null;
  if (engine?.onFrame) {
    offFrame = engine.onFrame((dt) => frame(dt));
  } else if (typeof setInterval === 'function') {
    // Headless / engine-less fallback keeps the sim honest.
    let last = typeof performance !== 'undefined' ? performance.now() : 0;
    intervalId = setInterval(() => {
      const now = typeof performance !== 'undefined' ? performance.now() : last + 33.3;
      frame((now - last) / 1000);
      last = now;
    }, 1000 / MINIGAME_HZ);
  }

  function stop() {
    stopped = true;
    if (offFrame) offFrame();
    if (intervalId !== null) clearInterval(intervalId);
    for (const off of unsubs.splice(0)) {
      try {
        off();
      } catch {
        /* already gone */
      }
    }
  }

  function dispose() {
    stop();
    try {
      view?.dispose?.();
    } catch {
      /* view owns its own teardown errors */
    }
    hud?.remove();
  }

  return { stop, dispose, sim };
}

export default runMinigame;
