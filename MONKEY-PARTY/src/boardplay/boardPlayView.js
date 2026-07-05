/**
 * BOARD-PLAY 3D VIEW (package P4) for MONKEY-PARTY.
 *
 * createBoardPlayView({ engine, session, ui, input }) renders and animates
 * the board phase of a match: the board (via src/boards views, with an
 * auto-generated readable fallback), one monkey token per player, the
 * golden-banana star, dice rolls, movement hops, coin/field/trap/boss
 * effects, turn banners, emotes and the camera direction.
 *
 * It NEVER mutates game state. Sim events arrive instantly from the
 * session; a choreography queue (createChoreoQueue) serializes them into
 * timed animations and only acknowledges afterwards - UI decision prompts
 * (ui.request(decision, options, cb)) fire once the preceding animations
 * have drained, and the cb submits the chosen Action back to the session.
 *
 * Headless-safe: everything is driven by explicit update(dt) calls (no
 * wall clock, no RAF), engine/camera/particles are optional, and the
 * characters/boards packages are guarded dynamic imports with plain-THREE
 * fallbacks (capsule tokens, disc+ribbon board).
 */

import * as THREE from 'three';
import {
  characters as characterRegistry,
  items as itemRegistry,
  boards as boardRegistry,
  minigames as minigameRegistry,
} from '#shared/registries.js';
import { t, localized } from '../ui/i18n.js';
import { onPaletteChange } from '../app/playerPalette.js';
import { sfx, voice } from '../engine/audio.js';
import { prefersReducedMotion } from '../engine/tween.js';
import { createParticles } from '../engine/particles.js';
import { createTokenActor } from './tokenActor.js';
import { createDiceView } from './diceView.js';
import { createCameraDirector } from './cameraDirector.js';
import { createFieldFx } from './fieldFx.js';
import { createStarActor } from './starActor.js';
import { createTurnBanner } from './turnBanner.js';

/* ------------------------------------------------------------------ */
/* Guarded dynamic imports (boards + characters are sibling packages)  */
/* ------------------------------------------------------------------ */

const BOARDS_PATH = '../boards/index.js';
const MONKEY_FACTORY_PATH = '../characters/monkeyFactory.js';
const ANIMATOR_PATH = '../characters/animator.js';
/** Optional prompt-navigation hook (ui package): gamepad/keyboard parity. */
const PROMPT_NAV_PATH = '../ui/junctionPrompt.js';

async function tryImport(path) {
  try {
    return await import(/* @vite-ignore */ path);
  } catch {
    return null;
  }
}

let monkeyKitPromise = null;
/** Load { buildMonkey, createAnimator } once (null members when missing). */
function loadMonkeyKit() {
  if (!monkeyKitPromise) {
    monkeyKitPromise = (async () => {
      const factory = await tryImport(MONKEY_FACTORY_PATH);
      const animator = await tryImport(ANIMATOR_PATH);
      const buildMonkey = factory?.buildMonkey ?? factory?.default ?? null;
      const createAnimator = animator?.createAnimator ?? animator?.default ?? null;
      if (typeof buildMonkey !== 'function') return null;
      return {
        buildMonkey,
        createAnimator: typeof createAnimator === 'function' ? createAnimator : null,
      };
    })();
  }
  return monkeyKitPromise;
}

/* ------------------------------------------------------------------ */
/* Choreography queue (pure logic - exported for tests)                */
/* ------------------------------------------------------------------ */

/**
 * Serializes instant sim events into timed animation steps.
 *
 * Steps: { name?, duration? (s, default 0), onStart?(), onUpdate?(k, dt),
 * onEnd?() }. Steps run strictly one at a time in enqueue order; onUpdate
 * always receives a final k === 1 before onEnd. Zero-duration steps
 * (acknowledgements, camera cuts) complete within the same update().
 *
 * When many events pile up (bots playing fast) the queue gently
 * fast-forwards so the presentation never falls minutes behind.
 *
 * @returns {{
 *   enqueue: (step: Object|Function) => void,
 *   update: (dt: number) => void,
 *   onIdle: (cb: Function) => () => void,
 *   clear: () => void,
 *   size: number, idle: boolean, processed: number,
 * }}
 */
export function createChoreoQueue({ catchupStart = 6, maxCatchup = 3 } = {}) {
  const pending = [];
  let active = null;
  let processed = 0;
  let wasIdle = true;
  const idleCbs = new Set();

  function enqueue(step) {
    const s = typeof step === 'function' ? { onEnd: step } : (step ?? {});
    pending.push({
      name: s.name ?? 'step',
      duration: Math.max(0, Number(s.duration) || 0),
      onStart: s.onStart ?? null,
      onUpdate: s.onUpdate ?? null,
      onEnd: s.onEnd ?? null,
      elapsed: 0,
    });
    wasIdle = false;
  }

  function safeCall(fn, ...args) {
    if (!fn) return;
    try {
      fn(...args);
    } catch (err) {
      console.error('[boardplay] choreography step threw:', err);
    }
  }

  function finishActive() {
    const step = active;
    active = null;
    processed += 1;
    safeCall(step.onUpdate, 1, 0);
    safeCall(step.onEnd);
  }

  function update(dt) {
    let t = Math.max(0, Number(dt) || 0);
    // Fast-forward when a burst of events piles up.
    const backlog = pending.length + (active ? 1 : 0);
    if (backlog > catchupStart) {
      t *= Math.min(maxCatchup, 1 + (backlog - catchupStart) * 0.35);
    }
    let guard = 256;
    while (guard-- > 0) {
      if (!active) {
        if (pending.length === 0) break;
        active = pending.shift();
        safeCall(active.onStart);
        if (active.duration <= 0) {
          finishActive();
          continue;
        }
      }
      if (t <= 0) break;
      const use = Math.min(t, active.duration - active.elapsed);
      active.elapsed += use;
      t -= use;
      const k = active.elapsed / active.duration;
      if (k < 1) {
        safeCall(active.onUpdate, k, use);
        break;
      }
      finishActive();
    }
    const nowIdle = !active && pending.length === 0;
    if (nowIdle && !wasIdle) {
      wasIdle = true;
      for (const cb of [...idleCbs]) safeCall(cb);
    }
  }

  function onIdle(cb) {
    idleCbs.add(cb);
    return () => idleCbs.delete(cb);
  }

  function clear() {
    pending.length = 0;
    active = null;
    wasIdle = true;
  }

  return {
    enqueue,
    update,
    onIdle,
    clear,
    get size() {
      return pending.length + (active ? 1 : 0);
    },
    get idle() {
      return !active && pending.length === 0;
    },
    get processed() {
      return processed;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Fallback board (readable discs + ribbons from BoardDef.nodes)       */
/* ------------------------------------------------------------------ */

const FALLBACK_NODE_COLORS = {
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

/**
 * Auto-generate a readable board when the boards package (or the board's
 * view builder) is unavailable: colored discs at node positions plus
 * straight ribbons along every next link. Same contract as boardViews.
 *
 * @param {*} engine (unused; kept for contract parity)
 * @param {Object} def BoardDef-ish ({ id, nodes }).
 */
export function buildFallbackBoard(engine, def) {
  const group = new THREE.Group();
  group.name = `board-fallback:${def?.id ?? 'unknown'}`;
  const nodes = Array.isArray(def?.nodes) ? def.nodes : [];
  const nodePos = new Map(nodes.map((n) => [n.id, new THREE.Vector3(n.pos[0], n.pos[1], n.pos[2])]));

  const discGeo = new THREE.CylinderGeometry(0.85, 0.95, 0.18, 18);
  const ribbonGeo = new THREE.BoxGeometry(1, 0.07, 0.5);
  const matByType = new Map();
  const ribbonMat = new THREE.MeshStandardMaterial({ color: 0xd9cfa8, roughness: 0.9 });
  const X_AXIS = new THREE.Vector3(1, 0, 0);

  for (const node of nodes) {
    if (!matByType.has(node.type)) {
      matByType.set(node.type, new THREE.MeshStandardMaterial({
        color: FALLBACK_NODE_COLORS[node.type] ?? 0xffffff,
        roughness: 0.6,
      }));
    }
    const disc = new THREE.Mesh(discGeo, matByType.get(node.type));
    disc.name = `node:${node.id}`;
    disc.position.copy(nodePos.get(node.id));
    group.add(disc);

    for (const to of node.next ?? []) {
      const b = nodePos.get(to);
      if (!b) continue;
      const a = nodePos.get(node.id);
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

  return {
    group,
    updateMechanics() {},
    nodeWorldPos(nodeId) {
      const p = nodePos.get(nodeId);
      return p ? p.clone() : new THREE.Vector3();
    },
    dispose() {
      discGeo.dispose();
      ribbonGeo.dispose();
      ribbonMat.dispose();
      for (const m of matByType.values()) m.dispose();
      group.parent?.remove(group);
      group.clear();
    },
  };
}

/* ------------------------------------------------------------------ */
/* Decision -> Action mapping (pure - exported for tests)              */
/* ------------------------------------------------------------------ */

/**
 * Map a UI decision answer to the Action to submit. `choice` semantics:
 *  - roll:       null -> roll; {itemId, target?} -> useItem
 *  - junction:   node id string -> junction
 *  - buyStar:    truthy -> buyStar, falsy -> declineStar
 *  - shop:       item id string -> shopBuy, null -> shopLeave
 *  - itemTarget: target -> itemTarget, null -> skipItem (cancel)
 *  - dicePick:   index number -> dicePick
 * A full Action object ({type, ...}) passes through unchanged.
 *
 * @param {{playerId: string, decision: string}} awaiting
 * @param {*} choice
 * @returns {import('#shared/types.js').Action|null}
 */
export function decisionToAction(awaiting, choice) {
  if (!awaiting) return null;
  if (choice && typeof choice === 'object' && typeof choice.type === 'string') {
    return { playerId: awaiting.playerId, payload: {}, ...choice };
  }
  const pid = awaiting.playerId;
  switch (awaiting.decision) {
    case 'roll':
      if (choice && typeof choice === 'object' && choice.itemId) {
        return { type: 'useItem', playerId: pid, payload: { itemId: choice.itemId, target: choice.target } };
      }
      return { type: 'roll', playerId: pid, payload: {} };
    case 'junction':
      return { type: 'junction', playerId: pid, payload: { choice } };
    case 'buyStar':
      return choice
        ? { type: 'buyStar', playerId: pid, payload: {} }
        : { type: 'declineStar', playerId: pid, payload: {} };
    case 'shop':
      return choice == null
        ? { type: 'shopLeave', playerId: pid, payload: {} }
        : { type: 'shopBuy', playerId: pid, payload: { itemId: choice } };
    case 'itemTarget':
      return choice == null
        ? { type: 'skipItem', playerId: pid, payload: {} }
        : { type: 'itemTarget', playerId: pid, payload: { target: choice } };
    case 'dicePick':
      return { type: 'dicePick', playerId: pid, payload: { index: Number(choice) || 0 } };
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Match-state snapshot (read-only, for the spectacle UI package)      */
/* ------------------------------------------------------------------ */

/* The minigame intro / results overlays (src/ui) want portraits + teams
 * but are called with a minimal options object; they read this snapshot
 * through a guarded dynamic import instead of widening their call sites.
 * Strictly read-only presentation data - never used to mutate the sim. */
let publishedState = null;

/** Latest MatchState the active board-play view has seen (or null). */
export function getLatestMatchState() {
  return publishedState;
}

/* ------------------------------------------------------------------ */
/* The view                                                            */
/* ------------------------------------------------------------------ */

const HOP_SECONDS = 0.35;

/**
 * @param {{
 *   engine: *|null Engine handle from createEngine() (scene/camera/quality),
 *   session: import('#shared/types.js').ISession,
 *   ui: {request: (decision: string, options: *, cb: (choice: *) => void) => void}|null,
 *   input: *|null Local input system (src/engine/input.js) - b button emotes,
 * }} deps
 * @returns {{mount: () => Promise<*>, update: (dt: number) => void, dispose: () => void}}
 */
export function createBoardPlayView({ engine = null, session = null, ui = null, input = null } = {}) {
  const queue = createChoreoQueue();
  const root = new THREE.Group();
  root.name = 'boardplay';

  let mounted = false;
  let disposed = false;
  let boardsMod = null;
  let monkeyKit = null;
  let promptNavMod = null;

  let boardView = null;
  let boardDef = null;
  let latestState = null;
  /** @type {Map<string, ReturnType<typeof createTokenActor>>} */
  const tokens = new Map();
  let star = null;
  let dice = null;
  let fx = null;
  let banner = null;
  let director = null;
  let particles = null;

  const unsubs = [];
  const seenEvents = new WeakSet();
  let lastPromptKey = null;
  let lastTurnKey = null;
  let lastRoundSeen = 0;
  const prevEmoteButton = new Map(); // pid -> bool (input edge detection)

  const boardCenter = new THREE.Vector3();
  let boardRadius = 20;

  /* ---------------- helpers ---------------------------------------- */

  function getSim() {
    try {
      return session?.getSim?.() ?? null;
    } catch {
      return null;
    }
  }

  function safeGetState(sim = getSim()) {
    try {
      return sim?.getState?.() ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Spectacle pacing discipline: reduced-motion cuts choreography to
   * near-instant (prompts fire immediately, nothing gates on animation),
   * fastMode (from the sim rules, surfaced as state.fastMode) halves every
   * duration. Deterministic - no wall clock, no randomness.
   */
  function pace(seconds) {
    if (prefersReducedMotion()) return Math.min(seconds, 0.05);
    return latestState?.fastMode ? seconds * 0.5 : seconds;
  }

  /** Skip decorative screen shake/flash under reduced-motion. */
  function juiceFx() {
    return prefersReducedMotion() ? null : (engine?.fx ?? null);
  }

  function nodePos(nodeId) {
    if (!nodeId || !boardView) return boardCenter.clone();
    try {
      return boardView.nodeWorldPos(nodeId);
    } catch {
      return boardCenter.clone();
    }
  }

  function tokenOf(pid) {
    return tokens.get(pid) ?? null;
  }

  function playerName(pid) {
    return latestState?.players?.[pid]?.name ?? pid ?? '?';
  }

  function localHumanIds() {
    try {
      const seats = session?.localSeats?.();
      if (seats && seats.size > 0) return new Set(seats.keys());
    } catch { /* fall through */ }
    const set = new Set();
    for (const [pid, p] of Object.entries(latestState?.players ?? {})) {
      if (!p.isBot) set.add(pid);
    }
    return set;
  }

  function currentPid(state = latestState) {
    return state?.turnOrder?.[state.currentTurn] ?? null;
  }

  function characterDefOf(player) {
    if (!player?.characterId) return null;
    try {
      return characterRegistry.get(player.characterId);
    } catch {
      return null;
    }
  }

  function itemName(itemId) {
    try {
      return localized(itemRegistry.get(itemId)?.name) || itemId;
    } catch {
      return itemId;
    }
  }

  function minigameName(minigameId) {
    try {
      return localized(minigameRegistry.get(minigameId)?.name) || minigameId;
    } catch {
      return minigameId;
    }
  }

  /* ---------------- scene construction ------------------------------ */

  function computeBounds() {
    const nodes = boardDef?.nodes ?? [];
    if (nodes.length === 0) {
      boardCenter.set(0, 0, 0);
      boardRadius = 20;
      return;
    }
    const box = new THREE.Box3();
    for (const n of nodes) box.expandByPoint(new THREE.Vector3(n.pos[0], n.pos[1], n.pos[2]));
    box.getCenter(boardCenter);
    boardRadius = Math.max(10, box.getSize(new THREE.Vector3()).length() * 0.5);
  }

  function buildScene() {
    latestState = safeGetState();
    publishedState = latestState ?? publishedState;
    const sim = getSim();
    boardDef = (sim && !sim.__missing && sim.board) ? sim.board : null;
    if (!boardDef && latestState?.boardId) {
      try {
        boardDef = boardRegistry.get(latestState.boardId);
      } catch {
        boardDef = null;
      }
    }

    // Board view via the boards package, else the readable fallback.
    const boardId = boardDef?.id ?? latestState?.boardId ?? null;
    const builder = boardsMod?.boardViews?.[boardId];
    boardView = null;
    if (typeof builder === 'function' && boardDef) {
      try {
        boardView = builder(engine, boardDef);
      } catch {
        boardView = null;
      }
    }
    if (!boardView?.group) boardView = buildFallbackBoard(engine, boardDef ?? { id: boardId, nodes: [] });
    root.add(boardView.group);
    computeBounds();

    // Tokens: one per player, in turn order (seat colors follow the
    // active colorblind palette - see src/app/playerPalette.js).
    (latestState?.turnOrder ?? []).forEach((pid, i) => {
      const player = latestState.players[pid];
      const token = createTokenActor({
        player,
        characterDef: characterDefOf(player),
        seat: i,
        monkeyKit,
      });
      token.placeAt(nodePos(player.node));
      root.add(token.group);
      tokens.set(pid, token);
    });

    // Star.
    star = createStarActor();
    star.placeAt(nodePos(latestState?.board?.starNode));
    root.add(star.group);

    // Presentation helpers.
    particles = engine?.scene ? createParticles(engine.scene, engine.quality ?? 'med') : null;
    director = createCameraDirector({ engine, center: boardCenter.clone(), radius: boardRadius });
    fx = createFieldFx({
      scene: root,
      particles,
      audio: sfx,
      shake: (i, d) => director.shake(i, d),
      flash: (c, d) => juiceFx()?.flash?.(c, d),
      camera: engine?.camera ?? null,
    });
    dice = createDiceView(root);
    banner = createTurnBanner(engine, root);

    engine?.scene?.add?.(root);

    director.setPhase(latestState?.phase ?? 'turn_start');
    const cur = tokenOf(currentPid());
    if (cur) director.setFocus(cur.group);
    director.applyShot();
    updateTurnHighlight();
    lastRoundSeen = latestState?.round ?? 1;
  }

  function teardownScene() {
    for (const token of tokens.values()) token.dispose();
    tokens.clear();
    star?.dispose();
    star = null;
    dice?.dispose();
    dice = null;
    fx?.dispose();
    fx = null;
    banner?.dispose();
    banner = null;
    director?.dispose();
    director = null;
    particles?.dispose();
    particles = null;
    try {
      boardView?.dispose?.();
    } catch { /* fallback boards always dispose */ }
    boardView = null;
  }

  /* ---------------- hot-seat clarity -------------------------------- */

  function updateTurnHighlight() {
    const cur = currentPid();
    const locals = localHumanIds();
    const over = latestState?.phase === 'game_over';
    for (const [pid, token] of tokens) {
      const isCurrent = !over && pid === cur;
      token.setCurrent(isCurrent);
      token.setLocalTurn(isCurrent && locals.has(pid));
    }
  }

  /* ---------------- decision prompts (ui bus) ----------------------- */

  function checkAwaiting() {
    const awaiting = latestState?.awaiting;
    if (!awaiting) {
      lastPromptKey = null;
      return;
    }
    if (!localHumanIds().has(awaiting.playerId)) return; // bots: session answers
    let key;
    try {
      key = JSON.stringify(awaiting);
    } catch {
      key = `${awaiting.playerId}:${awaiting.decision}`;
    }
    if (key === lastPromptKey) return;
    lastPromptKey = key;
    // Input parity: point the DOM prompts' d-pad/stick navigation at the
    // DECIDING local seat before the request fires (optional ui hook; the
    // prompts poll the source lazily, so late module resolution is fine).
    try {
      const seat = session?.localSeats?.()?.get?.(awaiting.playerId);
      promptNavMod?.setPromptInputSource?.(
        typeof input?.getFrame === 'function' && typeof seat === 'number'
          ? { input, seat }
          : null,
      );
    } catch { /* pad navigation is presentation-only */ }
    const respond = (choice) => {
      const action = decisionToAction(awaiting, choice);
      if (!action) return;
      try {
        session.submit(action);
      } catch (err) {
        console.warn('[boardplay] submit rejected:', err?.message ?? err);
      }
    };
    try {
      ui?.request?.(awaiting.decision, awaiting.options, respond);
    } catch (err) {
      console.error('[boardplay] ui.request threw:', err);
    }
  }

  /* ---------------- event choreography ------------------------------- */

  function enqueueBanner(text, opts = {}) {
    const dur = pace(opts.duration ?? 1.6);
    queue.enqueue({
      name: `banner:${text}`,
      duration: dur,
      onStart() {
        if (opts.sfx) sfx(opts.sfx);
        // Under reduced-motion the queue step is near-zero but the banner
        // itself stays readable briefly; it never gates acknowledgements.
        banner?.show(text, { ...opts, duration: Math.max(dur, prefersReducedMotion() ? 0.6 : 0) });
      },
    });
  }

  /**
   * Round banner with the final-round special treatment (red/gold kinetic
   * banner + drum roll) whenever `round` is the match's last one - also
   * true from the very start of 1-round matches.
   * @param {number} round
   * @param {string} [subtitle] Fallback subtitle for regular rounds.
   */
  function enqueueRoundBanner(round, subtitle = undefined) {
    const totalRounds = Number(latestState?.rules?.rounds) || 0;
    if (totalRounds > 0 && round >= totalRounds) {
      enqueueBanner(t('hud.finalRound'), {
        style: 'final',
        subtitle: t('hud.finalRoundSub'),
        duration: 2.0,
        sfx: 'drumroll',
      });
    } else {
      enqueueBanner(t('hud.roundN', { r: round }), { color: '#ffd23f', subtitle });
    }
  }

  function enqueueDice(evt) {
    const token = tokenOf(evt.playerId);
    queue.enqueue({
      name: 'dice',
      duration: pace(1.7),
      onStart() {
        sfx('dice');
        if (token) {
          director?.setFocus(token.group);
          director?.follow(token.group);
        }
        const at = token?.worldPos() ?? boardCenter.clone();
        dice?.begin(at, evt.values ?? [evt.total ?? 1], evt.sides ?? 6, evt.total ?? null, {
          onLand() {
            // Touchdown juice: dust + spark burst and a light screen kick.
            particles?.burst('dust', { pos: at.clone().setY(at.y + 0.9), count: 10 });
            particles?.burst('starburst', { pos: at.clone().setY(at.y + 1.1), count: 16 });
            sfx('land', { vol: 0.6 });
            juiceFx()?.shake?.(0.3);
          },
        });
      },
      onUpdate(k) {
        dice?.setProgress(k);
      },
      onEnd() {
        dice?.end();
      },
    });
  }

  /**
   * @param {*} evt move_step SimEvent.
   * @param {Array|null} batch Full event batch (lead-room lookahead).
   * @param {number} index Position of evt inside the batch.
   */
  function enqueueMoveStep(evt, batch = null, index = -1) {
    const token = tokenOf(evt.playerId);
    if (!token) return;
    const kind = evt.kind ?? 'step';

    if (kind === 'blocked') {
      queue.enqueue({
        name: 'move:blocked',
        duration: pace(0.5),
        onStart() {
          sfx('error', { vol: 0.7 });
          fx?.floatText(t('hud.blocked'), token.worldPos(), { color: '#ff8a80' });
        },
        onUpdate(k) {
          token.setWiggle(k);
        },
      });
      return;
    }

    const from = nodePos(evt.from);
    const to = nodePos(evt.to);
    const cfg = {
      step: { dur: HOP_SECONDS, height: 0.55, jumpSfx: 'jump', landSfx: 'land' },
      slide: { dur: 0.22, height: 0.12, jumpSfx: null, landSfx: null },
      pushback: { dur: 0.3, height: 0.4, jumpSfx: null, landSfx: 'land' },
      relocate: { dur: 0.6, height: 1.6, jumpSfx: 'whoosh', landSfx: 'land' },
      teleport: { dur: 0.55, height: 2.2, jumpSfx: 'whoosh', landSfx: 'pop' },
    }[kind] ?? { dur: HOP_SECONDS, height: 0.55, jumpSfx: 'jump', landSfx: 'land' };

    // Camera lead-room: frame the mover plus the next 1-2 nodes on its path
    // (peeked from the same instant event batch - purely presentational).
    let ahead = null;
    if (Array.isArray(batch) && index >= 0) {
      const nexts = [];
      for (let i = index + 1; i < batch.length && nexts.length < 2; i += 1) {
        const e = batch[i];
        if (e?.type === 'move_step' && e.playerId === evt.playerId && e.to) nexts.push(e.to);
      }
      if (nexts.length > 0) {
        ahead = new THREE.Vector3();
        for (const id of nexts) ahead.add(nodePos(id));
        ahead.multiplyScalar(1 / nexts.length);
      }
    }

    queue.enqueue({
      name: `move:${kind}`,
      duration: pace(cfg.dur),
      onStart() {
        token.startHop(from, to, { height: cfg.height });
        if (cfg.jumpSfx) sfx(cfg.jumpSfx, { vol: 0.45, pitch: 0.95 + Math.random() * 0.1 });
        director?.setFocus(token.group);
        director?.lead(token.group, ahead ?? to);
      },
      onUpdate(k) {
        token.setHop(k);
      },
      onEnd() {
        token.endHop();
        if (cfg.landSfx) sfx(cfg.landSfx, { vol: 0.5 });
        // Footstep dust puff on every landing.
        particles?.burst('dust', { pos: to.clone().setY(to.y + 0.1) });
        // Pass-by star sparkle when the hop lands on the star node.
        if (evt.to && evt.to === latestState?.board?.starNode) {
          particles?.burst('starburst', { pos: to.clone().setY(to.y + 1), count: 18 });
          sfx('sparkle', { vol: 0.4 });
        }
      },
    });
  }

  function enqueueCoins(evt) {
    const token = tokenOf(evt.playerId);
    queue.enqueue({
      name: 'coins',
      duration: pace(0.7),
      onStart() {
        fx?.coinBurst(token?.worldPos() ?? boardCenter.clone(), evt.delta ?? 0);
      },
    });
  }

  function enqueueField(evt) {
    const token = tokenOf(evt.playerId);
    const pos = evt.node ? nodePos(evt.node) : (token?.worldPos() ?? boardCenter.clone());
    const type = evt.fieldType ?? 'event';
    queue.enqueue({
      name: `field:${type}`,
      duration: pace(0.9),
      onStart() {
        director?.punch(pos);
        fx?.play(type, pos, evt);
      },
      onEnd() {
        director?.applyShot();
      },
    });
  }

  function enqueueShop(evt) {
    if (evt.kind === 'open') {
      const pos = evt.node ? nodePos(evt.node) : boardCenter.clone();
      queue.enqueue({
        name: 'shop:open',
        duration: pace(0.6),
        onStart() {
          fx?.play('shop', pos, evt);
        },
      });
    } else if (evt.kind === 'buy') {
      const token = tokenOf(evt.playerId);
      queue.enqueue({
        name: 'shop:buy',
        duration: pace(0.6),
        onStart() {
          sfx('buy');
          fx?.floatText(itemName(evt.itemId), token?.worldPos() ?? boardCenter.clone(), { color: '#9ff0c8' });
        },
      });
    }
    // 'leave'/'closed' need no presentation.
  }

  function enqueueStar(evt) {
    const kind = evt.kind ?? 'passed';
    if (kind === 'bought') {
      // Star purchase set-piece: camera orbits the star, grand fanfare,
      // golden fountain + beacon, banana flies to the buyer, banner.
      // Total budget: 2.0s + 1.5s banner = 3.5s (halved to 1.75s by
      // fastMode via pace(); near-instant under reduced-motion).
      const token = tokenOf(evt.playerId);
      const from = evt.node ? nodePos(evt.node) : (star?.worldPos() ?? boardCenter.clone());
      queue.enqueue({
        name: 'star:bought',
        duration: pace(2.0),
        onStart() {
          sfx('fanfare_big');
          director?.orbitPoint(from, { radius: 6, speed: 1.1, height: 2.6 });
          const to = token?.worldPos() ?? boardCenter.clone();
          star?.beginFlight(from, to.setY(to.y + 0.8));
          fx?.fountain(from, { dur: 1.1 });
          fx?.beacon(from, '#ffe27a');
          juiceFx()?.flash?.('#ffe135', 0.3);
        },
        onUpdate(k) {
          star?.setFlight(k);
        },
        onEnd() {
          star?.endFlight({ hide: true });
          const pos = token?.worldPos() ?? boardCenter.clone();
          particles?.burst('confetti', { pos: pos.clone().setY(pos.y + 1) });
          particles?.burst('starburst', { pos: pos.clone().setY(pos.y + 1.4), count: 30 });
          sfx('star');
          director?.applyShot();
        },
      });
      enqueueBanner(t('hud.gotBanana', { name: playerName(evt.playerId) }), { color: '#ffe135', duration: 1.5 });
    } else if (kind === 'relocated') {
      const to = nodePos(evt.node);
      queue.enqueue({
        name: 'star:relocated',
        duration: pace(1.0),
        onStart() {
          star?.beginFlight(star.worldPos(), to);
          sfx('whoosh', { vol: 0.6 });
        },
        onUpdate(k) {
          star?.setFlight(k);
        },
        onEnd() {
          star?.endFlight();
          star?.placeAt(to);
          fx?.play('star', to, evt);
          // Beacon beam marks the new star spawn from across the board.
          fx?.beacon(to, '#ffe27a');
        },
      });
    } else if (kind === 'passed' || kind === 'ticket_arrival') {
      const pos = evt.node ? nodePos(evt.node) : boardCenter.clone();
      queue.enqueue({
        name: 'star:passed',
        duration: pace(0.4),
        onStart() {
          fx?.pulse(pos, '#ffd23f', { scale: 1.4 });
          particles?.burst('starburst', { pos: pos.clone().setY(pos.y + 1), count: 14 });
          sfx('sparkle', { vol: 0.5 });
        },
      });
    } else if (kind === 'bananas' && evt.reason !== 'star') {
      // Banana deltas outside a purchase (bonuses, boss steals, ...).
      const token = tokenOf(evt.playerId);
      queue.enqueue({
        name: 'star:bananas',
        duration: pace(0.5),
        onStart() {
          const gain = (evt.delta ?? 0) >= 0;
          fx?.floatText(t('hud.bananaDelta', { n: `${gain ? '+' : ''}${evt.delta}` }), token?.worldPos() ?? boardCenter.clone(), {
            color: gain ? '#ffe135' : '#ff8a80',
          });
        },
      });
    }
    // 'declined' needs no presentation.
  }

  function enqueueTrap(evt) {
    const pos = evt.node ? nodePos(evt.node) : boardCenter.clone();
    if (evt.kind === 'placed') {
      queue.enqueue({
        name: 'trap:placed',
        duration: pace(0.5),
        onStart() {
          fx?.pulse(pos, '#9aa2ad', { scale: 1.1 });
          sfx('click');
        },
      });
      return;
    }
    queue.enqueue({
      name: 'trap:sprung',
      duration: pace(0.8),
      onStart() {
        if (evt.cancelled) {
          fx?.floatText(t('hud.blocked'), pos, { color: '#9ff0c8' });
          sfx('pop');
        } else {
          director?.punch(pos);
          fx?.play('trap', pos, evt); // shockwave burst + shake 0.6
        }
      },
      onEnd() {
        if (!evt.cancelled) director?.applyShot();
      },
    });
  }

  function enqueueItem(evt) {
    const token = tokenOf(evt.playerId);
    const pos = token?.worldPos() ?? boardCenter.clone();
    queue.enqueue({
      name: `item:${evt.kind ?? 'event'}`,
      duration: pace(0.6),
      onStart() {
        if (evt.kind === 'used') {
          sfx('pop');
          fx?.play('item', pos, evt);
          if (evt.itemId) fx?.floatText(itemName(evt.itemId), pos, { color: '#d6b4ff' });
        } else if (evt.kind === 'gained') {
          sfx('pop', { pitch: 1.2 });
          if (evt.itemId) fx?.floatText(`+ ${itemName(evt.itemId)}`, pos, { color: '#d6b4ff' });
        } else {
          fx?.pulse(pos, '#c084fc', { scale: 1.1 });
        }
      },
    });
  }

  function enqueueMechanic(evt) {
    queue.enqueue({
      name: 'mechanic',
      duration: pace(0.6),
      onStart() {
        // Refresh the board's mechanic visuals right away.
        try {
          boardView?.updateMechanics?.(latestState, 0);
        } catch { /* mechanics are cosmetic */ }
        if (evt.kind === 'blocked' && Array.isArray(evt.nodes)) {
          for (const id of evt.nodes) fx?.pulse(nodePos(id), '#9aa2ad', { scale: 1.2 });
          sfx('zap', { vol: 0.5 });
        } else {
          fx?.pulse(boardCenter.clone(), '#e0d7b8', { scale: 2.2, dur: 0.8 });
          sfx('whoosh', { vol: 0.4 });
        }
      },
    });
  }

  function enqueueBoss(evt) {
    const pos = evt.node ? nodePos(evt.node) : boardCenter.clone();
    queue.enqueue({
      name: 'boss',
      duration: pace(1.4),
      onStart() {
        // Dramatic boss slam: fly-in + fov punch, heavy impact + hit-stop.
        director?.punch(pos, 0.6);
        director?.zoomPunch(1.3, 0.6);
        fx?.play('boss', pos, evt); // 'impact_heavy' + shockwave + big shake
        juiceFx()?.hitStop?.(0.09);
      },
      onEnd() {
        director?.applyShot();
      },
    });
  }

  function enqueuePhase(evt) {
    // Turn/round banners (deduped by round+player key).
    if (evt.phase === 'turn_start') {
      const key = `${evt.round}:${evt.playerId}`;
      if (key !== lastTurnKey) {
        lastTurnKey = key;
        if (evt.round !== lastRoundSeen) {
          lastRoundSeen = evt.round;
          enqueueRoundBanner(evt.round, t('hud.roundStart'));
        }
        const isLocal = localHumanIds().has(evt.playerId);
        enqueueBanner(t('hud.turn', { name: playerName(evt.playerId) }), {
          color: isLocal ? '#9ff0c8' : '#ffe135',
          subtitle: isLocal ? t('hud.yourTurn') : undefined,
          duration: 1.3,
        });
      }
    }
    queue.enqueue({
      name: `phase:${evt.phase}`,
      onEnd() {
        director?.setPhase(evt.phase);
        const cur = tokenOf(evt.playerId ?? currentPid());
        if (cur) director?.setFocus(cur.group);
        director?.applyShot();
        updateTurnHighlight();
      },
    });
  }

  function enqueueBonus(evt) {
    const token = tokenOf(evt.playerId);
    enqueueBanner(`${localized(evt.name) || evt.category}: ${playerName(evt.playerId)} +${evt.bananas ?? 1}`, {
      color: '#ffd23f',
      duration: 1.6,
    });
    queue.enqueue({
      name: 'bonus:confetti',
      duration: pace(0.6),
      onStart() {
        sfx('star');
        const pos = token?.worldPos() ?? boardCenter.clone();
        particles?.burst('confetti', { pos: pos.clone().setY(pos.y + 1) });
      },
    });
  }

  function enqueueGameOver(evt) {
    const winner = evt.winner ?? evt.ranking?.[0];
    const winnerToken = tokenOf(winner);
    queue.enqueue({
      name: 'game_over',
      duration: pace(2.4),
      onStart() {
        sfx('fanfare');
        director?.setPhase('game_over');
        if (winnerToken) director?.setFocus(winnerToken.group);
        director?.applyShot();
        for (const [pid, token] of tokens) token.celebrate(pid === winner);
        updateTurnHighlight();
        const pos = winnerToken?.worldPos() ?? boardCenter.clone();
        particles?.burst('confetti', { pos: pos.clone().setY(pos.y + 1.6), count: 80 });
        particles?.burst('fireworks', { pos: pos.clone().setY(pos.y + 2.2) });
      },
      onEnd() {
        sfx('crowd_cheer');
      },
    });
    enqueueBanner(t('hud.wins', { name: playerName(winner) }), {
      color: '#ffe135',
      subtitle: t('hud.champion'),
      duration: 2.4,
    });
  }

  function enqueueEmote(evt) {
    const pid = evt.playerId ?? evt.pid;
    const token = tokenOf(pid);
    if (!token) return;
    queue.enqueue({
      name: 'emote',
      duration: pace(1.2),
      onStart() {
        token.playEmote(evt.emoteId ?? 'taunt', 1.2);
        const def = characterDefOf(latestState?.players?.[pid]);
        try {
          voice(def?.voice ?? {}, evt.emoteId === 'cry' ? 'sad' : 'taunt');
        } catch { /* voice is best-effort */ }
      },
    });
  }

  function enqueueMinigame(evt) {
    if (evt.type === 'minigame_start') {
      enqueueBanner(t('mg.incoming'), { color: '#8ecbff', subtitle: minigameName(evt.minigameId), duration: 1.4 });
      queue.enqueue({
        name: 'minigame:overview',
        onEnd() {
          director?.setPhase('minigame_select');
          director?.applyShot();
        },
      });
    }
    // minigame_result payouts arrive as coins events (handled above).
  }

  /**
   * Translate one SimEvent into choreography steps.
   * @param {*} evt
   * @param {number} [index] Position inside the batch (lead-room lookahead).
   * @param {Array|null} [batch] The full instant event batch.
   */
  function enqueueEvent(evt, index = -1, batch = null) {
    if (!evt || typeof evt.type !== 'string') return;
    switch (evt.type) {
      case 'dice': enqueueDice(evt); break;
      case 'move_step': enqueueMoveStep(evt, batch, index); break;
      case 'coins': enqueueCoins(evt); break;
      case 'field': enqueueField(evt); break;
      case 'shop': enqueueShop(evt); break;
      case 'star': enqueueStar(evt); break;
      case 'trap': enqueueTrap(evt); break;
      case 'item': enqueueItem(evt); break;
      case 'mechanic': enqueueMechanic(evt); break;
      case 'boss': enqueueBoss(evt); break;
      case 'phase': enqueuePhase(evt); break;
      case 'bonus': enqueueBonus(evt); break;
      case 'game_over': enqueueGameOver(evt); break;
      case 'emote': enqueueEmote(evt); break;
      case 'minigame_start':
      case 'minigame_result': enqueueMinigame(evt); break;
      default: break;
    }
  }

  /* ---------------- session wiring ----------------------------------- */

  function onActionApplied(msg) {
    if (disposed) return;
    // A successfully applied non-emote action always resolved the pending
    // awaiting decision, so the next identical-looking awaiting (e.g. "roll"
    // again next round) is a NEW prompt and must not be deduped away.
    if (msg?.action?.type && msg.action.type !== 'emote') lastPromptKey = null;
    latestState = safeGetState() ?? latestState;
    publishedState = latestState ?? publishedState;
    // sim.apply() hands the events as an iterable batch object (the tests
    // feed plain arrays): materialize so move lookahead can index into it.
    const events = [...(msg?.events ?? [])];
    events.forEach((evt, i) => {
      if (evt && typeof evt === 'object') seenEvents.add(evt);
      enqueueEvent(evt, i, events);
    });
    // Acknowledge only after every queued animation has played out.
    queue.enqueue({ name: 'ack', onEnd: checkAwaiting });
  }

  function onLooseEmote(evt) {
    // session.sendEmote() emits emotes outside action batches; sim emotes
    // already arrived through action_applied (deduped via seenEvents).
    if (disposed || !evt || seenEvents.has(evt)) return;
    enqueueEvent({ ...evt, type: 'emote' });
  }

  function onMatchStart() {
    if (disposed) return;
    // Late start (mounted before session.start()): build the scene now.
    if (tokens.size === 0) {
      try {
        boardView?.dispose?.();
      } catch { /* nothing built yet */ }
      root.clear();
      buildScene();
      enqueueRoundBanner(latestState?.round ?? 1);
      queue.enqueue({ name: 'ack', onEnd: checkAwaiting });
    }
  }

  /* ---------------- input: emote hot-key (b button) ------------------ */

  function pollEmoteInput() {
    if (!input?.getFrame || !session?.sendEmote || !latestState) return;
    let seats;
    try {
      seats = session.localSeats?.();
    } catch {
      return;
    }
    if (!seats) return;
    for (const [pid, seat] of seats) {
      let frame;
      try {
        frame = input.getFrame(seat);
      } catch {
        continue;
      }
      const prev = prevEmoteButton.get(pid) ?? false;
      if (frame?.b && !prev) {
        const def = characterDefOf(latestState.players?.[pid]);
        try {
          session.sendEmote(def?.emotes?.[0] ?? 'taunt', pid);
        } catch { /* emotes are best-effort */ }
      }
      prevEmoteButton.set(pid, !!frame?.b);
    }
  }

  /* ---------------- public surface ----------------------------------- */

  /** ui bus 'fireworks' (victoryScene emits it): burst at the winner. */
  function onFireworks(evt) {
    if (disposed) return;
    const token = tokenOf(evt?.playerId);
    const pos = token?.worldPos() ?? boardCenter.clone();
    particles?.burst('fireworks', { pos: pos.clone().setY(pos.y + 2.2) });
    particles?.burst('starburst', { pos: pos.clone().setY(pos.y + 1.4), count: 24 });
  }

  async function mount() {
    if (mounted || disposed) return api;
    mounted = true;
    boardsMod = await tryImport(BOARDS_PATH);
    monkeyKit = await loadMonkeyKit();
    tryImport(PROMPT_NAV_PATH).then((mod) => {
      promptNavMod = mod;
    });
    buildScene();

    const subscribe = (evt, cb) => {
      try {
        const unsub = session?.on?.(evt, cb);
        if (typeof unsub === 'function') unsubs.push(unsub);
      } catch { /* session without events (tests) */ }
    };
    subscribe('action_applied', onActionApplied);
    subscribe('emote', onLooseEmote);
    subscribe('match_start', onMatchStart);

    // Victory fireworks over the winner token (bus event, optional).
    try {
      const off = ui?.on?.('fireworks', onFireworks);
      if (typeof off === 'function') unsubs.push(off);
    } catch { /* ui without events (tests) */ }

    // Live re-tint when the colorblind palette changes (presentation-only).
    unsubs.push(onPaletteChange((palette) => {
      for (const token of tokens.values()) {
        token.setColor(palette[(token.seat ?? 0) % palette.length]);
      }
    }));

    if (latestState) {
      enqueueRoundBanner(latestState.round ?? 1, localized(boardDef?.name) || undefined);
      queue.enqueue({ name: 'ack', onEnd: checkAwaiting });
    }
    return api;
  }

  function update(dt) {
    if (!mounted || disposed) return;
    const step = Math.max(0, Number(dt) || 0);
    queue.update(step);
    for (const token of tokens.values()) token.update(step);
    star?.update(step);
    fx?.update(step);
    banner?.update(step);
    particles?.update(step);
    director?.update(step);
    pollEmoteInput();
    try {
      boardView?.updateMechanics?.(latestState, step);
    } catch { /* mechanics are cosmetic */ }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    try {
      promptNavMod?.setPromptInputSource?.(null);
    } catch { /* optional */ }
    for (const unsub of unsubs) {
      try {
        unsub();
      } catch { /* already gone */ }
    }
    unsubs.length = 0;
    queue.clear();
    teardownScene();
    root.parent?.remove(root);
    root.clear();
    mounted = false;
  }

  const api = {
    mount,
    update,
    dispose,
    /** Choreography queue (observability for tests/tools). */
    choreo: queue,
    /** Scene root (board + tokens + fx). */
    group: root,
    get state() {
      return latestState;
    },
  };
  return api;
}

/* ------------------------------------------------------------------ */
/* Scratch-page demo                                                   */
/* ------------------------------------------------------------------ */

/**
 * Self-contained demo a scratch page can run (does NOT touch src/main.js):
 *
 *   import { createDemo } from './src/boardplay/boardPlayView.js';
 *   createDemo(); // full-screen canvas, offline match vs bots, auto-play
 *
 * Registers content, starts an offline session (1 local human + bots),
 * mounts the board-play view and answers the local player's prompts with a
 * simple auto-picker so the whole match plays out hands-free. Pass
 * { autoPlay: false, ui } to drive prompts from a real UI instead.
 *
 * @param {{canvas?: HTMLCanvasElement, boardId?: string, bots?: number,
 *   autoPlay?: boolean, ui?: Object, rules?: Object}} [opts]
 */
export async function createDemo(opts = {}) {
  if (typeof document === 'undefined') {
    throw new Error('createDemo() needs a DOM (run it from a browser page)');
  }
  const boardId = opts.boardId ?? 'jungle_ruins';
  const bots = Math.min(7, Math.max(1, opts.bots ?? 3));

  let canvas = opts.canvas ?? null;
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block;';
    document.body.appendChild(canvas);
  }

  const { registerAllContent } = await import('#shared/content/index.js');
  await registerAllContent();
  const { createEngine } = await import('../engine/renderer.js');
  const { createOfflineSession } = await import('../app/session.js');

  const engine = createEngine(canvas, { quality: 'med' });
  engine.scene.background = new THREE.Color('#12241a');
  engine.scene.add(new THREE.HemisphereLight(0xdfeee2, 0x2a3a24, 1.1));
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
  sun.position.set(18, 30, 12);
  sun.castShadow = true;
  engine.scene.add(sun);

  const session = createOfflineSession({
    boardId,
    rules: { rounds: 3, minigameEvery: 0, botsFill: false, ...(opts.rules ?? {}) },
    localPlayers: [{ pid: 'p1', name: 'You' }],
  });
  session.setBoard(boardId);
  for (let i = 0; i < bots; i += 1) session.addBot('normal');
  // Give every seat a monkey.
  const charIds = characterRegistry.ids();
  session.getLobby().seats.forEach((seat, i) => {
    if (charIds.length > 0) session.selectCharacter(seat.pid, charIds[i % charIds.length]);
  });
  await session.start();

  const autoPlay = opts.autoPlay ?? true;
  const ui = opts.ui ?? {
    request(decision, options, cb) {
      console.info(`[demo] prompt: ${decision}`, options);
      if (!autoPlay) return;
      setTimeout(() => {
        switch (decision) {
          case 'junction': cb(Array.isArray(options) ? options[0] : null); break;
          case 'buyStar': cb(true); break;
          case 'shop': cb(null); break;
          case 'itemTarget': cb(Array.isArray(options) ? options[0] : null); break;
          case 'dicePick': cb(0); break;
          default: cb(null); break; // 'roll'
        }
      }, 650);
    },
  };

  const view = createBoardPlayView({ engine, session, ui, input: null });
  await view.mount();
  const offFrame = engine.onFrame((dt) => view.update(dt));
  engine.start();

  return {
    engine,
    session,
    view,
    ui,
    dispose() {
      offFrame();
      view.dispose();
      session.leave();
      engine.dispose();
    },
  };
}

export default createBoardPlayView;
