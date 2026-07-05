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
 *   - mounts the pause menu (Esc / HUD button; online never pauses the
 *     shared sim - offline it render-pauses the board, holds decision
 *     prompts (freezing their auto-default countdowns) and defers
 *     minigame starts until resume) and the in-match chat (online
 *     sessions),
 *   - drives dynamic music (setIntensity ramp by round, star/gameover
 *     stingers) and screen shake on boss hits / trap triggers,
 *   - on game_over: victory scene -> stats screen (passing the offline
 *     progression payoff so the XP bar / achievement banners animate);
 *     folds the results into the profile store (or the optional
 *     progression package) and offers a rematch (offline: recreate from
 *     ctx.lastOfflineConfig; online: back to the lobby the server
 *     reopens; tournament legs instead get a "Continue Cup" button back
 *     to the tournament screen).
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
import './match.css';
import { createOfflineSession } from '../app/session.js';
import { t } from './i18n.js';
import { tm } from './matchStrings.js';
import { div, button, clearNode, toast, playSfx } from './dom.js';
import { createMatchHud } from './hud.js';
import { buildItemBar } from './itemBar.js';
import { promptFrame, showJunctionPrompt, showDicePickPrompt } from './junctionPrompt.js';
import { showShopModal, showBuyStarPrompt, showItemTargetPrompt } from './shopModal.js';
import { showMinigameIntro } from './minigameIntro.js';
import { showMinigameResults } from './resultsScreen.js';
import { showVictoryScene, applyMatchToProfile } from './victoryScene.js';
import { attachEmoteWheel } from './emoteWheel.js';
import { attachPauseMenu } from './pauseMenu.js';
import { attachMatchChat } from './matchChat.js';

const BOARDPLAY_PATH = '../boardplay/boardPlayView.js';
const HARNESS_PATH = '../minigames/viewHarness.js';
/** Optional progression package: supersedes applyMatchToProfile if present. */
const PROGRESSION_PATH = '../app/progression.js';

/** How long the post-match "Play Again" offer stays up (dismissible). */
const REMATCH_OFFER_TTL_MS = 45000;

/* Minigame 3D views wire themselves into their sims via attachView() at
 * import time; the integration hub (this file) must load them once. */
const VIEW_PACK_PATHS = [
  '../minigames/views/batch1/index.js',
  '../minigames/views/batch2/index.js',
  '../minigames/views/batch3/index.js',
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
  let netOffs = [];
  let emoteWheel = null;
  let activePrompt = null;
  let requestOffs = [];
  /** Latest unanswered ui.request; held (not rendered) while the offline
   *  pause menu is open and re-presented on resume. */
  let pendingRequest = null;

  /* minigame flow state */
  let capturedMgSim = null;
  let mgFlow = null; // {intro?, harness?, results?}
  let minigamesPlayed = 0;
  let paused = false;

  /* pause menu / chat */
  let pauseMenu = null;
  let chat = null;
  /** Render-pause from the pause menu (offline only; the sim never stops). */
  let menuPaused = false;
  /** mg_start deferred because the offline pause menu is open. */
  let pendingMgStart = null;

  /* dynamic music state */
  let lastIntensity = -1;

  /* end of match */
  let bonuses = [];
  let gameOverEvt = null;
  let victory = null;
  /** Zombie-flow watchdog: game over arrived but a minigame flow hangs. */
  let mgZombieTimer = null;

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
    const request = { decision, options, cb };
    pendingRequest = request;
    // Offline pause: hold the prompt (and its auto-default countdown)
    // until the player resumes - the offline sim just waits on `awaiting`.
    if (menuPaused) return;
    presentRequest(request);
  }

  function presentRequest(request) {
    const { decision, options } = request;
    playSfx('hover', { vol: 0.3 });
    const answer = (choice) => {
      activePrompt = null;
      if (pendingRequest === request) pendingRequest = null;
      request.cb(choice);
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
  /* Music direction + screen-shake juice                                 */
  /* ------------------------------------------------------------------ */

  function setMusicIntensity(v) {
    const clamped = Math.max(0, Math.min(1, v));
    if (Math.abs(clamped - lastIntensity) < 0.001) return;
    lastIntensity = clamped;
    ctx.music.setIntensity?.(clamped);
  }

  /** 0.3 in the early rounds, ramping by round/rules.rounds up to 1.0 on
   *  the final round; always 1.0 during minigames. */
  function updateMusicIntensity(state = simState()) {
    if (!state) return;
    if (state.phase === 'minigame' || mgFlow) {
      setMusicIntensity(1);
      return;
    }
    const rounds = Math.max(1, Number(state.rules?.rounds) || 10);
    const round = Math.max(1, Number(state.round) || 1);
    setMusicIntensity(round >= rounds ? 1 : Math.max(0.3, Math.min(1, round / rounds)));
  }

  function shakeFx(intensity, durSec) {
    try {
      // The a11y package forwards screenShake to engine.fx.setEnabled;
      // the settings check covers builds without it.
      if (ctx.settings?.get?.()?.screenShake === false) return;
      ctx.engine?.fx?.shake?.(intensity, durSec);
    } catch { /* fx are optional juice */ }
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
    updateMusicIntensity();
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

  /** Tear down whatever part of the minigame flow is currently live. */
  function disposeMgFlow() {
    const flow = mgFlow;
    if (!flow) return;
    mgFlow = null;
    try {
      flow.intro?.close?.();
      flow.harness?.dispose?.();
      flow.results?.close?.();
    } catch { /* teardown is best-effort */ }
  }

  async function startMinigame(evt) {
    if (disposed) return;
    if (mgFlow) {
      // Duplicate mg_start for the SAME minigame (the server re-sends it on
      // resume): keep the running flow. A DIFFERENT minigame means the old
      // flow is a zombie left over from a reconnect gap - replace it.
      if (mgFlow.minigameId === evt?.minigameId) return;
      console.warn('[match] replacing a stale minigame flow with', evt?.minigameId);
      disposeMgFlow();
    }
    const minigameId = evt?.minigameId;
    const def = ctx.registries.minigames.get(minigameId);
    minigamesPlayed += 1;
    pauseBoard();
    closePrompt();
    ctx.music.play('minigame');
    setMusicIntensity(1);

    if (!def) {
      // Unknown minigame: never strand the match.
      submitFallbackResults(`unknown minigame "${minigameId}"`);
      resumeBoard();
      return;
    }

    const flow = { minigameId };
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

  /** First game_over sighting: remember it, fire the stinger once. */
  function noteGameOver(evt) {
    const first = !gameOverEvt;
    gameOverEvt = evt;
    if (first) ctx.music.stinger?.('gameover');
    if (first && mgFlow && !mgFlow.results) {
      // The match ended while a minigame flow is still waiting for results.
      // Normally the harness finishes within a frame of mg_end and the flow
      // proceeds results -> victory. But when the server's minigame ended
      // BEFORE this client's net harness subscribed (idle client, long
      // intro), mg_end was missed and the flow would gate the victory
      // scene forever. Grace period, then drop the zombie and move on.
      clearTimeout(mgZombieTimer);
      mgZombieTimer = setTimeout(() => {
        if (disposed || !mgFlow || mgFlow.results || victory) return;
        console.warn('[match] minigame flow never finished after game over - dropping it');
        disposeMgFlow();
        resumeBoard();
        maybeShowVictory();
      }, 8000);
    }
    maybeShowVictory();
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
          concludeMatch(state, over);
        },
      });
    }, delayMs);
  }

  /**
   * Victory scene finished: fold the match into the profile (progression
   * package first, built-in fold otherwise), hand off to the stats screen
   * (with the progression payoff for local results, so the XP bar /
   * level-up / achievement banners animate) and offer a rematch. Online
   * sessions stay alive so "Play Again" can rejoin the lobby the server
   * reopens after game over.
   */
  async function concludeMatch(state, over) {
    const match = buildMatchSummary(state, over);
    const pids = localPids();
    const endedSession = session();
    const mode = endedSession?.mode ?? null;
    let progression = null;
    try {
      const prog = await tryImport(PROGRESSION_PATH);
      if (typeof prog?.applyMatchResults === 'function') {
        const result = prog.applyMatchResults(ctx.profile, { state, gameOver: over, bonuses, localPids: pids });
        // Progression is local-only: only LOCAL/offline results carry the
        // payoff to the stats screen (it tolerates absence forever).
        if (mode === 'offline' && result) progression = result;
      } else {
        applyMatchToProfile(ctx.profile, state, over, pids, minigamesPlayed);
      }
    } catch (err) {
      console.warn('[match] profile update failed:', err);
    }
    if (mode !== 'online') ctx.setSession(null);
    ctx.router.go('stats', progression ? { match, progression } : { match });
    offerRematch({ mode, state, endedSession });
  }

  /**
   * Non-blocking "Play Again" offer over the stats screen. Offline it
   * recreates a session from ctx.lastOfflineConfig (hidden when the menu
   * package never set one); online it returns to the lobby screen (the
   * server keeps the room for a rematch window, then reopens the lobby).
   * Tournament legs (session.origin === 'tournament', tagged by
   * tournamentScreen's startNextRace) never get the couch "Play Again"
   * (which would restart a stale ctx.lastOfflineConfig game with the
   * wrong seats/board, outside the cup) - they get a "Continue Cup"
   * button back to the tournament screen, whose game_over subscription
   * already folded the leg into the standings. Always dismissible - it
   * can never hang anything.
   */
  function offerRematch({ mode, state, endedSession }) {
    const fromTournament = endedSession?.origin === 'tournament';
    const canTournament = fromTournament && ctx.router.has?.('tournament');
    const canOffline = mode === 'offline' && !fromTournament && Boolean(ctx.lastOfflineConfig);
    const canOnline = mode === 'online' && !fromTournament;
    if (!canOffline && !canOnline && !canTournament) return;

    const host = document.getElementById('ui-root') ?? document.body;
    const panel = div('match-again');
    let ttlTimer = null;
    let pollTimer = null;
    let done = false;

    function cleanup() {
      if (done) return;
      done = true;
      clearTimeout(ttlTimer);
      clearInterval(pollTimer);
      panel.remove();
    }

    function dismiss() {
      if (done) return;
      cleanup();
      // Walking away from an online rematch releases the lobby seat.
      if (mode === 'online' && ctx.session === endedSession) ctx.setSession(null);
    }

    panel.appendChild(div('match-again__title', canTournament
      ? `🏆 ${t('tour.title')}`
      : `🔄 ${tm('match.again.title')}`));
    const again = button(canTournament ? t('tour.continue') : tm('match.again.play'), 'ui-btn--green', () => {
      cleanup();
      if (canTournament) ctx.router.go('tournament');
      else if (canOffline) playAgainOffline(state);
      else ctx.router.go('lobby');
    });
    if (canOnline) again.title = tm('match.again.lobbyHint');
    panel.appendChild(again);
    panel.appendChild(button('✕', 'ui-btn--ghost ui-btn--small', dismiss));

    // The tournament continue offer never self-expires (expiring it would
    // dead-end the leg on the stats screen); it still dismisses on any
    // navigation via the poll below, and manually via ✕.
    if (!canTournament) ttlTimer = setTimeout(dismiss, REMATCH_OFFER_TTL_MS);
    // Leaving the stats screen (any navigation) also dismisses the offer.
    pollTimer = setInterval(() => {
      const name = ctx.router.currentName?.();
      if (name && name !== 'stats') dismiss();
    }, 1000);
    host.appendChild(panel);
  }

  /** Offline rematch: same seats (ctx.lastOfflineConfig), same board and
   *  rules as the match that just ended, fresh seed. */
  async function playAgainOffline(finalState) {
    const base = ctx.lastOfflineConfig;
    if (!base) return;
    try {
      const cfg = { ...base };
      delete cfg.seed; // a rematch must not replay the identical match
      if (finalState?.rules) cfg.rules = { ...finalState.rules };
      if (finalState?.boardId) cfg.boardId = finalState.boardId;
      const next = createOfflineSession(cfg);
      for (const seat of next.getLobby().seats) next.setReady(seat.pid, true);
      if (!cfg.boardId) {
        const boards = ctx.registries.boards.ids();
        if (boards.length > 0) next.setBoard(boards[0]);
      }
      // Undecided humans get a monkey (same trick as the lobby start).
      const charIds = ctx.registries.characters.ids();
      next.getLobby().seats.forEach((seat, i) => {
        if (!seat.characterId && charIds.length > 0) {
          next.selectCharacter(seat.pid, charIds[(i * 3) % charIds.length]);
        }
      });
      await next.start();
      ctx.setSession(next);
      ctx.router.go('match');
    } catch (err) {
      console.error('[match] play again failed:', err);
      toast(`${tm('match.again.failed')} ${err?.message ?? ''}`.trim(), 'error');
    }
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

    const quitToMenu = () => {
      ctx.setSession(null);
      ctx.router.go('mainMenu');
    };

    /* HUD */
    hud = createMatchHud(ctx, s, {
      onQuit: quitToMenu,
      onPause: () => pauseMenu?.open(),
    });
    root.appendChild(hud.root);
    hud.update(simState());
    updateMusicIntensity();

    /* In-match chat (online sessions only; returns null offline). */
    chat = attachMatchChat(ctx, s, root);

    /* Pause menu (Esc / HUD pause button). Pausing NEVER pauses the shared
     * sim online (the server keeps running; the menu shows a note).
     * Offline it render-pauses the board AND freezes the decision flow:
     * the open prompt closes (cancelling its auto-default countdown) but
     * stays pending, new prompts are held unrendered, and mg_start is
     * deferred (the captured facade means nothing steps the real minigame
     * sim until the harness starts). Resume re-presents the pending
     * prompt with a fresh countdown and starts the deferred minigame, so
     * the match still can never hang. */
    pauseMenu = attachPauseMenu(ctx, {
      getSession: session,
      isChatOpen: () => Boolean(chat?.isOpen?.()),
      closeChat: () => chat?.close?.(),
      isMinigameLive: () => Boolean(mgFlow),
      onQuit: quitToMenu,
      onPauseChange: (isPaused) => {
        const offline = session()?.mode === 'offline';
        menuPaused = isPaused && offline;
        if (offline) {
          if (isPaused) {
            // Freeze the prompt countdown; the request stays pending.
            closePrompt();
          } else {
            const mgEvt = pendingMgStart;
            pendingMgStart = null;
            if (mgEvt) startMinigame(mgEvt);
            if (pendingRequest && !activePrompt) presentRequest(pendingRequest);
          }
        }
        ctx.bus.emit(isPaused ? 'match:paused' : 'match:resumed', { mode: session()?.mode ?? null });
      },
    });

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
      if (disposed) return;
      const state = simState();
      hud?.update(state);
      updateMusicIntensity(state);
    });
    sub('star', (evt) => {
      // Star (golden banana) purchase: musical sting.
      if (evt?.kind === 'bought') ctx.music.stinger?.('star');
    });
    sub('boss', (evt) => {
      if (!evt?.neutralized) shakeFx(1, 0.6);
    });
    sub('trap', (evt) => {
      // Only actual trap TRIGGERS shake (not placements or disarms).
      if (evt?.kind === 'placed' || evt?.cancelled || evt?.disarmed) return;
      shakeFx(0.7, 0.45);
    });
    sub('minigame_start', (evt) => {
      // Fires synchronously BEFORE the session's runner creates the sim.
      armSimCapture(evt?.minigameId);
    });
    sub('mg_start', (evt) => {
      if (menuPaused) {
        // Offline pause: defer the whole flow (intro + harness). The
        // session runner only holds the step-noop facade, so the real
        // minigame sim stays frozen until the player resumes.
        pendingMgStart = evt;
        return;
      }
      startMinigame(evt);
    });
    sub('state_sync', () => {
      // A state_sync means we (re)joined the authoritative timeline; the
      // replica may have skipped events (missed mg_end, phase changes).
      if (disposed) return;
      const state = simState();
      hud?.update(state);
      updateMusicIntensity(state);
      if (!state) return;
      if (mgFlow && !mgFlow.results) {
        const stillLive = state.phase === 'minigame'
          && state.minigame?.pendingId === mgFlow.minigameId
          && !state.minigame?.results;
        if (!stillLive) {
          // The reconnect straddled the minigame's end: treat the gap as an
          // implicit mg_end - drop the zombie overlay, resume the board.
          console.warn('[match] minigame flow is stale after state_sync - resuming the board');
          disposeMgFlow();
          resumeBoard();
        }
      }
      if (!mgFlow && state.phase === 'minigame' && state.minigame?.pendingId && !state.minigame.results
        && session()?.mode === 'online') {
        // Resumed INTO a live minigame; the server re-sends mg_start too,
        // but don't depend on message ordering.
        startMinigame({
          minigameId: state.minigame.pendingId,
          teams: state.minigame.teams,
          params: state.minigame.params,
        });
      }
      if (state.phase === 'game_over' && !gameOverEvt) {
        noteGameOver({ ranking: state.turnOrder.slice(), winner: state.turnOrder[0] });
      }
    });
    sub('bonus', (evt) => {
      bonuses.push(evt);
    });
    sub('game_over', (evt) => {
      noteGameOver(evt);
    });
    sub('error', (msg) => {
      // Server errors arrive as {code, msg} (see shared/protocol.js).
      const text = msg?.msg ?? msg?.message ?? 'Server error';
      toast(msg?.code ? `${text} (${msg.code})` : text, 'error');
    });

    /* Connection feedback (online sessions only). */
    const net = s.mode === 'online' ? ctx.getNetClient?.() : null;
    if (net?.on) {
      let reconnectFailed = false;
      const nsub = (evt, cb) => {
        const off = net.on(evt, cb);
        if (typeof off === 'function') netOffs.push(off);
      };
      nsub('reconnecting', (info) => {
        if (!disposed && (info?.attempt ?? 1) === 1) toast('Connection lost – reconnecting…', 'info');
      });
      nsub('reconnect_failed', () => {
        reconnectFailed = true;
        if (!disposed) toast('Could not reconnect to the server. Check your connection and reload the page.', 'error');
      });
      nsub('close', () => {
        if (!disposed && !reconnectFailed) toast('Connection to the server was closed.', 'error');
      });
    }

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

    /* Frame loop. menuPaused only ever render-pauses OFFLINE boards (the
     * pause menu never touches the sim; online keeps rendering live). */
    if (ctx.engine?.onFrame && !disposed) {
      offFrame = ctx.engine.onFrame((dt) => {
        if (!paused && !menuPaused) boardView?.update(dt);
      });
    }

    /* Emote wheel (hold Tab). */
    emoteWheel = attachEmoteWheel(ctx, s, root);

    /* If we mounted into an already-pending minigame (e.g. hot reload, or
     * a page reload that resumed straight into a live online minigame). */
    const state = simState();
    if (state?.phase === 'minigame' && state.minigame?.pendingId && !state.minigame.results && !mgFlow) {
      const mode = session()?.mode;
      // Offline: the session runner already owns the real sim; run the
      // fallback so the match cannot hang if the runner never started.
      // Online: spectate/rejoin the server-driven minigame via the net
      // driver (mg_state snapshots keep the display sim honest).
      if ((mode === 'offline' && !capturedMgSim) || mode === 'online') {
        startMinigame({
          minigameId: state.minigame.pendingId,
          teams: state.minigame.teams,
          params: state.minigame.params,
        });
      }
    }
    if (state?.phase === 'game_over' && !gameOverEvt) {
      noteGameOver({ ranking: state.turnOrder, winner: state.turnOrder[0] });
    }
  }

  return {
    mount(elHost) {
      root = elHost;
      disposed = false;
      paused = false;
      menuPaused = false;
      pendingRequest = null;
      pendingMgStart = null;
      lastIntensity = -1;
      bonuses = [];
      gameOverEvt = null;
      victory = null;
      clearTimeout(mgZombieTimer);
      mgZombieTimer = null;
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
      pendingRequest = null;
      pendingMgStart = null;
      clearTimeout(mgZombieTimer);
      mgZombieTimer = null;
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
      for (const off of netOffs) {
        try {
          off();
        } catch { /* gone */ }
      }
      netOffs = [];
      offFrame?.();
      offFrame = null;
      boardView?.dispose();
      boardView = null;
      hud?.dispose();
      hud = null;
      emoteWheel?.dispose();
      emoteWheel = null;
      pauseMenu?.dispose();
      pauseMenu = null;
      chat?.dispose();
      chat = null;
      menuPaused = false;
      root?.classList.remove('screen--match');
      root = null;
    },
  };
}

export default createMatchScreen;
