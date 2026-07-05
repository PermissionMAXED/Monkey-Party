/**
 * Bot host: drives every non-human (or disconnected) seat of one room.
 *
 * - Board decisions come from shared/ai/boardBot.js decideBoardAction with
 *   a humanized 500-1200ms delay (config-tunable) so matches feel alive.
 * - Minigame input frames come from each MinigameDef.bot() at tick rate.
 * - Difficulty honors the lobby: a bot seat's own difficulty, and
 *   rules.botDifficulty for disconnected humans it covers.
 *
 * All randomness flows through a seeded shared/rng.js instance so bot
 * behavior is reproducible given the same seed.
 */

import crypto from 'node:crypto';
import { createRng } from '#shared/rng.js';
import { decideBoardAction } from '#shared/ai/boardBot.js';
import { emptyFrame } from '#shared/minigames/inputs.js';

/**
 * @param {Object} room The room this host belongs to. Uses: room.getSim(),
 *   room.lobby (seats + rules), room.config, room.log,
 *   room.applyServerAction(action, meta).
 */
export function createBotHost(room) {
  const { config, log } = room;
  const rng = createRng(crypto.randomInt(0, 0xffffffff));

  /** @type {Map<string, ReturnType<typeof setTimeout>>} pid -> pending decision timer. */
  const timers = new Map();
  /** @type {Map<string, Object>} pid -> per-minigame bot RNG. */
  let mgRngs = new Map();
  /** @type {Object|null} MinigameDef currently being played. */
  let mgDef = null;
  let disposed = false;

  /** Seat difficulty for bots; lobby default for covered humans. */
  function difficultyFor(pid) {
    const seat = room.lobby.seats.find((s) => s.pid === pid);
    return (seat?.isBot && seat.difficulty) || room.lobby.rules.botDifficulty;
  }

  /* ---------------- board decisions --------------------------------- */

  function cancel(pid) {
    const timer = timers.get(pid);
    if (timer) {
      clearTimeout(timer);
      timers.delete(pid);
    }
  }

  function cancelAll() {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
  }

  /**
   * Decide + apply for `pid` right now (used by the decision timeout and
   * by scheduleDecision's timer). Aborts silently when the decision is no
   * longer pid's to make.
   */
  function decideNow(pid) {
    cancel(pid);
    if (disposed) return;
    const sim = room.getSim();
    if (!sim) return;
    const state = sim.getState();
    if (state.phase === 'game_over' || state.awaiting?.playerId !== pid) return;

    const legal = sim.legalActions(pid);
    if (!Array.isArray(legal) || legal.length === 0) return;
    let action = null;
    try {
      action = decideBoardAction(state, legal, pid, difficultyFor(pid), rng.fork(`board:${pid}`));
    } catch (err) {
      log.warn('bot_decide_threw', { pid, err: err?.message });
    }
    if (!action) action = legal[0];
    const applied = room.applyServerAction(action, { source: 'botHost' });
    if (!applied) {
      // The sim's deeper validation rejected the bot's pick (targets,
      // prices, ...). Retry once with the first enumerated legal action
      // before giving up - the room's deferred re-arm (scheduleNext in
      // applyServerAction's catch) is the final anti-hang backstop.
      const fallback = legal[0];
      if (JSON.stringify(fallback) !== JSON.stringify(action)) {
        log.warn('bot_pick_rejected', { pid, type: action?.type });
        room.applyServerAction(fallback, { source: 'botHost:fallback' });
      }
    }
  }

  /**
   * Schedule a humanized board decision for `pid`.
   * @param {string} pid
   * @param {number} [delayMs] Override; default 500-1200ms (config).
   */
  function scheduleDecision(pid, delayMs) {
    if (disposed) return;
    cancel(pid);
    const span = Math.max(0, config.botDelayMaxMs - config.botDelayMinMs);
    const ms = delayMs ?? config.botDelayMinMs + Math.floor(rng.next() * (span + 1));
    const timer = setTimeout(() => {
      timers.delete(pid);
      try {
        decideNow(pid);
      } catch (err) {
        log.error('bot_decision_failed', { pid, err: err?.message });
      }
    }, ms);
    timers.set(pid, timer);
  }

  /* ---------------- minigame frames ---------------------------------- */

  /** Called by the room when a minigame launches. */
  function beginMinigame(def, players) {
    mgDef = def;
    mgRngs = new Map();
    for (const pid of players) {
      mgRngs.set(pid, rng.fork(`mg:${def.id}:${pid}`));
    }
  }

  /** InputFrame for one covered seat at the current tick. */
  function minigameFrame(pid, publicState) {
    if (!mgDef) return emptyFrame();
    const botRng = mgRngs.get(pid) ?? rng.fork(`mg:late:${pid}`);
    try {
      return mgDef.bot(publicState, pid, difficultyFor(pid), botRng) ?? emptyFrame();
    } catch (err) {
      log.warn('bot_frame_threw', { pid, mg: mgDef.id, err: err?.message });
      return emptyFrame();
    }
  }

  function endMinigame() {
    mgDef = null;
    mgRngs.clear();
  }

  function dispose() {
    disposed = true;
    cancelAll();
    endMinigame();
  }

  return {
    scheduleDecision,
    decideNow,
    cancel,
    cancelAll,
    beginMinigame,
    minigameFrame,
    endMinigame,
    difficultyFor,
    dispose,
  };
}
