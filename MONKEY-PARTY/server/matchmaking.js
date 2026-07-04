/**
 * Quick-match matchmaking.
 *
 * quick_match{} drops the player into the fullest public, non-started
 * lobby that still has a free seat; when none exists a fresh public lobby
 * is created with the PRESETS.party ruleset. Quick-match lobbies auto-start
 * after a 30s countdown once at least 2 humans are seated (bots fill the
 * remaining seats on start when rules.botsFill).
 */

import { PRESETS } from '#shared/rules.js';

/**
 * @param {{config: Object, log: Object, lobbies: Object, connections: Object}} deps
 */
export function createMatchmaking({ config, log, lobbies }) {
  /* ---------------- countdown ---------------------------------------- */

  function humanCount(lobby) {
    return lobby.seats.filter((s) => !s.isBot && s.connected).length;
  }

  /** (Re)evaluate the auto-start countdown of a quick-match lobby. */
  function checkCountdown(lobby) {
    if (!lobby.quickMatch || lobby.started) return;
    const humans = humanCount(lobby);
    if (humans >= 2 && !lobby.countdownTimer) {
      lobby.countdownEndsAt = Date.now() + config.quickMatchCountdownMs;
      lobby.countdownTimer = setTimeout(() => {
        lobby.countdownTimer = null;
        lobby.countdownEndsAt = null;
        if (humanCount(lobby) >= 2) {
          log.info('quickmatch_autostart', { code: lobby.code });
          lobbies.startLobby(lobby, { force: true });
        }
      }, config.quickMatchCountdownMs);
      lobby.countdownTimer.unref?.();
      log.info('quickmatch_countdown_started', { code: lobby.code, ms: config.quickMatchCountdownMs });
      lobbies.broadcastState(lobby);
    } else if (humans < 2 && lobby.countdownTimer) {
      lobbies.cancelCountdown(lobby);
      log.info('quickmatch_countdown_cancelled', { code: lobby.code });
      lobbies.broadcastState(lobby);
    }
  }

  // React to every seat change in every lobby (only quick-match lobbies
  // actually do anything in checkCountdown).
  lobbies.setHooks({ onSeatsChanged: checkCountdown });

  /* ---------------- quick_match --------------------------------------- */

  /** quick_match{}: join the fullest joinable public lobby or open one. */
  function quickMatch(player) {
    if (player.lobby) lobbies.leave(player);

    const candidates = lobbies.all()
      .filter((l) => l.isPublic && !l.started && l.seats.length < l.rules.maxSeats)
      .sort((a, b) => b.seats.length - a.seats.length);

    if (candidates.length > 0) {
      const lobby = lobbies.join(player, { code: candidates[0].code });
      if (lobby) {
        log.info('quickmatch_joined', { code: lobby.code, pid: player.id });
        return lobby;
      }
      // Join raced with a fill-up; fall through and open a fresh lobby.
    }

    const lobby = lobbies.create(
      player,
      { isPublic: true, rules: { ...PRESETS.party }, boardId: undefined },
      { quickMatch: true },
    );
    if (lobby) log.info('quickmatch_created', { code: lobby.code, pid: player.id });
    return lobby;
  }

  return { quickMatch, checkCountdown };
}
