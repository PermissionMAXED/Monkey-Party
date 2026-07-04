/**
 * MATCH CONTROLLER - the integration core (P9).
 *
 * Given a started ISession it:
 *   - mounts createBoardPlayView({engine, session, ui, input}) and drives it
 *     from engine.onFrame,
 *   - mounts the in-match HUD + item bar + emote wheel,
 *   - answers boardPlayView's ui.request(decision, options, cb) prompts
 *     (roll/junction/buyStar/shop/itemTarget/dicePick) with DOM prompts
 *     that always auto-default (~20s) so the game never hangs,
 *   - orchestrates the minigame phase: intro roulette -> viewHarness
 *     runMinigame -> results overlay -> back to the board,
 *   - on game_over: victory scene -> stats screen; folds the results into
 *     the profile store.
 *
 * OFFLINE MINIGAME COORDINATION: src/app/session.js runs its own 30Hz
 * minigame stepper (bots + sendInput frames) and submits the results
 * itself. To render the REAL sim (and feed real per-seat inputs) without
 * double-stepping, we wrap def.createSim just before the session's runner
 * creates the sim (the 'minigame_start' sim event fires synchronously
 * before session.checkMinigame()): the session receives a facade whose
 * step() is a no-op while getState/isFinished/getResults delegate to the
 * real sim. The view harness (driver {type:'local'}) is then the ONLY
 * stepper; the session still detects the finish and submits the results
 * exactly once.
 */

import * as THREE from 'three';
import { t } from './i18n.js';
import { div, button, clearNode, toast, playSfx } from './dom.js';
import { createMatchHud } from './hud.js';
import { buildItemBar } from './itemBar.js';
import { promptFrame, showJunctionPrompt, showDicePickPrompt } from './junctionPrompt.js';
import { showShopModal, showBuyStarPrompt, showItemTargetPrompt } from './shopModal.js';
import { showMinigameIntro } from './minigameIntro.js';
import { showMinigameResults } from './resultsScreen.js';
import { showVictoryScene, applyMatchToProfile } from './victoryScene.js';
import { attachEmoteWheel } from './emoteWheel.js';

const BOARDPLAY_PATH = '../boardplay/boardPlayView.js';
const HARNESS_PATH = '../minigames/viewHarness.js';

/* Minigame 3D views wire themselves into their sims via attachView() at
 * import time; the integration hub (this file) must load them once. */
const VIEW_PACK_PATHS = [
  '../minigames/views/batch1/index.js',
  '../minigames/views/batch2/index.js',
  '../minigames/views/templates/index.js',
];

async function tryImport(path) {
  try {
    return await import(/* @vite-ignore */ path);
  } catch (err) {
    console.warn(`[match] optional module missing: ${path}`, err?.message ?? err);
    return null;
  }
}

let viewPacksPromise = null;
function ensureViewPacks() {
  if (!viewPacksPromise) {
    viewPacksPromise = Promise.all(VIEW_PACK_PATHS.map(async (path) => {
      try {
        await import(/* @vite-ignore */ path);
      } catch { /* sibling batch not installed - sims render nothing */ }
    }));
  }
  return viewPacksPromise;
}

export function createMatchScreen(ctx) {
  let root = null;
  let disposed = false;
  let boardView = null;
  let hud = null;
  let offFrame = null;
  let unsubs = [];
  let emoteWheel = null;
  let activePrompt = null;
  let requestOffs = [];

  /* minigame flow state */
  let capturedMgSim = null;
  let mgFlow = null; // {intro?, harness?, results?}
  let minigamesPlayed = 0;
  let paused = false;

  /* end of match */
  let bonuses = [];
  let gameOverEvt = null;
  let victory = null;

  const session = () => ctx.session;

  function sim() {
    try {
      return session()?.getSim?.() ?? null;
    } catch {
      return null;
    }
  }

  function simState() {
    const s = sim();
    if (!s || s.__missing) return null;
    try {
      return s.getState();
    } catch {
      return null;
    }
  }

  function localPids() {
    try {
      return session()?.localSeats?.() ?? new Map();
    } catch {
      return new Map();
    }
  }

  function closePrompt() {
    try {
      activePrompt?.close?.();
    } catch { /* already gone */ }
    activePrompt = null;
  }

  /* ------------------------------------------------------------------ */
  /* Decision prompts (answering boardPlayView's ui.request)             */
  /* ------------------------------------------------------------------ */

  function playerLabel(pid) {
    return simState()?.players?.[pid]?.name ?? pid;
  }

  /** Screen-space angle from the awaiting player's node to a target node. */
  function junctionAngleFor(nodeId) {
    const state = simState();
    const s = sim();
    const board = s?.board;
    const cam = ctx.engine?.camera;
    if (!state || !board || !cam) return null;
    const fromId = state.players?.[state.awaiting?.playerId]?.node;
    const fromNode = board.nodes?.find((n) => n.id === fromId);
    const toNode = board.nodes?.find((n) => n.id === nodeId);
    if (!fromNode || !toNode) return null;
    const a = new THREE.Vector3(...fromNode.pos).project(cam);
    const b = new THREE.Vector3(...toNode.pos).project(cam);
    // NDC y is up; screen y is down.
    return Math.atan2(-(b.y - a.y), b.x - a.x);
  }

  /** Roll prompt: big dice button + item bar (item phase only). */
  function showRollPrompt(options, answer) {
    let done = false;
    const frame = promptFrame(t('prompt.roll'), {
      onDefault: () => respond(null),
    });
    function respond(choice) {
      if (done) return;
      done = true;
      frame.close();
      answer(choice);
    }

    const row = div('prompt-row');
    row.appendChild(button(`🎲 ${t('prompt.roll')}`, 'ui-btn--green ui-btn--big', () => respond(null)));
    frame.body.appendChild(row);

    const usable = options?.usableItems ?? [];
    if (usable.length > 0) {
      const state = simState();
      const pid = state?.awaiting?.playerId;
      const player = state?.players?.[pid];
      const hint = div('ui-dim', t('prompt.rollHint'));
      hint.style.margin = '10px 0 6px';
      frame.body.appendChild(hint);
      const barWrap = div('ui-row');
      barWrap.appendChild(buildItemBar({
        player,
        usable,
        onUse: (itemId) => respond({ itemId }),
      }));
      frame.body.appendChild(barWrap);
    }
    return { close: frame.close };
  }

  function handleRequest(decision, options, cb) {
    closePrompt();
    playSfx('hover', { vol: 0.3 });
    const answer = (choice) => {
      activePrompt = null;
      cb(choice);
    };
    switch (decision) {
      case 'roll':
        activePrompt = showRollPrompt(options, answer);
        break;
      case 'junction':
        activePrompt = showJunctionPrompt({
          options: Array.isArray(options) ? options : [],
          angleFor: junctionAngleFor,
          labelFor: (id) => id,
          onPick: answer,
        });
        break;
      case 'buyStar': {
        const state = simState();
        const coins = state?.players?.[state?.awaiting?.playerId]?.coins ?? 0;
        activePrompt = showBuyStarPrompt({
          price: options?.price ?? 20,
          coins,
          onAnswer: answer,
        });
        break;
      }
      case 'shop': {
        const state = simState();
        const coins = state?.players?.[state?.awaiting?.playerId]?.coins ?? 0;
        activePrompt = showShopModal({
          stock: options?.stock ?? [],
          coins,
          onBuy: answer, // sim re-prompts with fresh stock
          onLeave: () => answer(null),
        });
        break;
      }
      case 'itemTarget': {
        const state = simState();
        const arr = Array.isArray(options) ? options : [];
        const arePlayers = arr.every((x) => state?.players?.[x]);
        activePrompt = showItemTargetPrompt({
          options: arr,
          labelFor: arePlayers ? playerLabel : (id) => id,
          onPick: answer,
        });
        break;
      }
      case 'dicePick':
        activePrompt = showDicePickPrompt({
          options: Array.isArray(options) ? options : [],
          onPick: answer,
        });
        break;
      default:
        console.warn(`[match] unknown decision "${decision}" - auto-answering null`);
        answer(null);
        break;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Offline minigame sim capture (see module docblock)                  */
  /* ------------------------------------------------------------------ */

  function armSimCapture(minigameId) {
    capturedMgSim = null;
    const def = ctx.registries.minigames.get(minigameId);
    if (!def || session()?.mode !== 'offline') return;
    const original = def.createSim;
    def.createSim = (cfg) => {
      def.createSim = original; // one-shot
      const real = original.call(def, cfg);
      capturedMgSim = real;
      let inited = false;
      return {
        init() {
          if (inited) return;
          inited = true;
          real.init();
        },
        step() { /* no-op: the view harness steps the real sim */ },
        getState: () => real.getState(),
        isFinished: () => real.isFinished(),
        getResults: () => real.getResults(),
        applyState: (s) => real.applyState?.(s),
      };
    };
    // Safety: if the session never creates the sim (unexpected), restore.
    setTimeout(() => {
      if (def.createSim !== original) def.createSim = original;
    }, 1000);
  }

  /* ------------------------------------------------------------------ */
  /* Minigame flow                                                       */
  /* ------------------------------------------------------------------ */

  function pauseBoard() {
    paused = true;
    if (boardView?.group) boardView.group.visible = false;
    ctx.music.duck(true);
  }

  function resumeBoard() {
    paused = false;
    if (boardView?.group) boardView.group.visible = true;
    ctx.music.duck(false);
    ctx.music.play('board');
  }

  function mgRoster(evt) {
    const state = simState();
    const pids = Array.isArray(evt?.teams) && evt.teams.length > 0
      ? evt.teams.flat()
      : (state?.turnOrder ?? []);
    return pids.map((pid) => {
      const p = state?.players?.[pid];
      return {
        id: pid,
        name: p?.name ?? pid,
        isBot: p?.isBot ?? !localPids().has(pid),
        difficulty: p?.difficulty ?? 'normal',
      };
    });
  }

  function localSeatNames() {
    const state = simState();
    const bindings = ctx.input.bindings?.() ?? {};
    const names = [];
    for (const [pid, seat] of localPids()) {
      names.push({
        seat,
        name: state?.players?.[pid]?.name ?? pid,
        device: bindings[seat] ?? null,
      });
    }
    return names;
  }

  /** The match sim never hangs: report a neutral result if all else fails. */
  function submitFallbackResults(reason) {
    const state = simState();
    if (!state || state.phase !== 'minigame') return;
    console.warn(`[match] minigame fallback results (${reason})`);
    const ranking = state.turnOrder.slice();
    const reporter = ranking[0];
    try {
      session().submit({
        type: 'minigameResults',
        playerId: reporter,
        payload: { results: { ranking, coins: {}, stats: {} } },
      });
    } catch (err) {
      console.error('[match] fallback results rejected:', err);
    }
  }

  async function startMinigame(evt) {
    if (disposed || mgFlow) return;
    const minigameId = evt?.minigameId;
    const def = ctx.registries.minigames.get(minigameId);
    minigamesPlayed += 1;
    pauseBoard();
    closePrompt();
    ctx.music.play('minigame');

    if (!def) {
      // Unknown minigame: never strand the match.
      submitFallbackResults(`unknown minigame "${minigameId}"`);
      resumeBoard();
      return;
    }

    const flow = {};
    mgFlow = flow;

    flow.intro = showMinigameIntro({
      minigameId,
      localSeatNames: localSeatNames(),
      onDone: async () => {
        if (disposed || mgFlow !== flow) return;
        flow.intro = null;
        await ensureViewPacks(); // def.createView must be attached first
        const harnessMod = await tryImport(HARNESS_PATH);
        const runMinigame = harnessMod?.runMinigame ?? harnessMod?.default;
        const isOffline = session()?.mode === 'offline';

        let driver = null;
        if (isOffline && capturedMgSim) {
          driver = { type: 'local', sim: capturedMgSim };
        } else if (!isOffline) {
          driver = {
            type: 'net',
            on: (name, cb) => session().on(name, cb),
            sendInput: (frame) => session().sendInput(frame),
            seed: evt?.seed ?? 0,
            params: evt?.params ?? {},
          };
        }

        if (typeof runMinigame !== 'function' || !driver) {
          // No view available. Offline: the session's own runner (facade
          // not captured -> it steps the real sim itself) finishes the
          // game with bot inputs; humans idle. Worst case: fallback.
          if (isOffline && !capturedMgSim) {
            submitFallbackResults('view harness unavailable');
            finishMinigame(flow, null);
          }
          return;
        }

        try {
          flow.harness = runMinigame({
            engine: ctx.engine,
            input: ctx.input,
            def,
            driver,
            localSeats: localPids(),
            players: mgRoster(evt),
            onFinish: (results) => finishMinigame(flow, results),
          });
        } catch (err) {
          console.error('[match] runMinigame failed:', err);
          submitFallbackResults('harness crashed');
          finishMinigame(flow, null);
        }
      },
    });
  }

  function finishMinigame(flow, results) {
    if (mgFlow !== flow || disposed) return;
    try {
      flow.harness?.dispose?.();
    } catch { /* harness owns its teardown */ }
    flow.harness = null;

    // By now the session has submitted the results and the match sim moved
    // on (nextRound / bonus / game_over). Show the rich results overlay.
    const state = simState();
    if (results && state) {
      flow.results = showMinigameResults({
        results,
        state,
        onDone: () => {
          if (mgFlow === flow) mgFlow = null;
          resumeBoard();
          maybeShowVictory();
        },
      });
    } else {
      mgFlow = null;
      resumeBoard();
      maybeShowVictory();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Game over -> victory -> stats                                       */
  /* ------------------------------------------------------------------ */

  function buildMatchSummary(state, over) {
    const ranking = over?.ranking ?? state?.turnOrder ?? [];
    return {
      winner: over?.winner ?? ranking[0],
      rows: ranking.map((pid) => {
        const p = state?.players?.[pid] ?? {};
        return {
          playerId: pid,
          name: p.name ?? pid,
          goldenBananas: p.goldenBananas ?? 0,
          coins: p.coins ?? 0,
          minigameWins: p.stats?.minigameWins ?? 0,
          itemsUsed: p.stats?.itemsUsed ?? 0,
          fieldsMoved: p.stats?.fieldsMoved ?? 0,
        };
      }),
    };
  }

  function maybeShowVictory() {
    if (!gameOverEvt || victory || disposed || mgFlow) return;
    const over = gameOverEvt;
    // Let the board-play celebration choreo play underneath first.
    const delayMs = 3200;
    setTimeout(() => {
      if (disposed || victory) return;
      const state = simState();
      ctx.music.play('victory');
      victory = showVictoryScene({
        gameOver: over,
        bonuses,
        state,
        bus: ctx.bus,
        onDone: () => {
          const match = buildMatchSummary(state, over);
          try {
            applyMatchToProfile(ctx.profile, state, over, localPids(), minigamesPlayed);
          } catch (err) {
            console.warn('[match] profile update failed:', err);
          }
          ctx.setSession(null);
          ctx.router.go('stats', { match });
        },
      });
    }, delayMs);
  }

  /* ------------------------------------------------------------------ */
  /* Screen lifecycle                                                    */
  /* ------------------------------------------------------------------ */

  async function mountMatch() {
    const s = session();
    if (!s || !sim()) {
      toast(t('menu.connectFail'), 'error');
      ctx.router.go('mainMenu');
      return;
    }

    ctx.stage.hide();
    ctx.music.play('board');
    ensureViewPacks(); // minigame 3D views attach in the background

    /* HUD */
    hud = createMatchHud(ctx, s, {
      onQuit: () => {
        ctx.setSession(null);
        ctx.router.go('mainMenu');
      },
    });
    root.appendChild(hud.root);
    hud.update(simState());

    /* Decision prompt handlers on the shared bus. */
    for (const name of ['roll', 'junction', 'buyStar', 'shop', 'itemTarget', 'dicePick']) {
      requestOffs.push(ctx.bus.onRequest(name, handleRequest));
    }

    /* Session events. */
    const sub = (evt, cb) => {
      try {
        const off = s.on(evt, cb);
        if (typeof off === 'function') unsubs.push(off);
      } catch { /* sessions without events */ }
    };
    sub('action_applied', () => {
      if (!disposed) hud?.update(simState());
    });
    sub('minigame_start', (evt) => {
      // Fires synchronously BEFORE the session's runner creates the sim.
      armSimCapture(evt?.minigameId);
    });
    sub('mg_start', (evt) => {
      startMinigame(evt);
    });
    sub('bonus', (evt) => {
      bonuses.push(evt);
    });
    sub('game_over', (evt) => {
      gameOverEvt = evt;
      maybeShowVictory();
    });
    sub('error', (msg) => {
      toast(msg?.message ?? 'Server error', 'error');
    });

    /* Board view. */
    const boardMod = await tryImport(BOARDPLAY_PATH);
    const createBoardPlayView = boardMod?.createBoardPlayView ?? boardMod?.default;
    if (typeof createBoardPlayView === 'function' && !disposed) {
      boardView = createBoardPlayView({
        engine: ctx.engine,
        session: s,
        ui: ctx.bus,
        input: ctx.input,
      });
      await boardView.mount();
    } else if (!disposed) {
      console.warn('[match] boardPlayView unavailable - HUD-only match');
    }

    /* Frame loop. */
    if (ctx.engine?.onFrame && !disposed) {
      offFrame = ctx.engine.onFrame((dt) => {
        if (!paused) boardView?.update(dt);
      });
    }

    /* Emote wheel (hold Tab). */
    emoteWheel = attachEmoteWheel(ctx, s, root);

    /* If we mounted into an already-pending minigame (e.g. hot reload). */
    const state = simState();
    if (state?.phase === 'minigame' && state.minigame?.pendingId && !state.minigame.results && !mgFlow) {
      // The session runner already owns the real sim; run the fallback so
      // the match cannot hang if the runner never started.
      if (session()?.mode === 'offline' && !capturedMgSim) {
        startMinigame({
          minigameId: state.minigame.pendingId,
          teams: state.minigame.teams,
          params: state.minigame.params,
        });
      }
    }
    if (state?.phase === 'game_over' && !gameOverEvt) {
      gameOverEvt = { ranking: state.turnOrder, winner: state.turnOrder[0] };
      maybeShowVictory();
    }
  }

  return {
    mount(elHost) {
      root = elHost;
      disposed = false;
      paused = false;
      bonuses = [];
      gameOverEvt = null;
      victory = null;
      mgFlow = null;
      capturedMgSim = null;
      minigamesPlayed = 0;
      clearNode(root);
      root.classList.add('screen--match');
      mountMatch();
    },
    unmount() {
      disposed = true;
      closePrompt();
      try {
        mgFlow?.intro?.close?.();
        mgFlow?.harness?.dispose?.();
        mgFlow?.results?.close?.();
      } catch { /* teardown is best-effort */ }
      mgFlow = null;
      victory?.close?.();
      victory = null;
      for (const off of requestOffs) {
        try {
          off();
        } catch { /* gone */ }
      }
      requestOffs = [];
      for (const off of unsubs) {
        try {
          off();
        } catch { /* gone */ }
      }
      unsubs = [];
      offFrame?.();
      offFrame = null;
      boardView?.dispose();
      boardView = null;
      hud?.dispose();
      hud = null;
      emoteWheel?.dispose();
      emoteWheel = null;
      root?.classList.remove('screen--match');
      root = null;
    },
  };
}

export default createMatchScreen;
