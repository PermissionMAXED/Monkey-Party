/**
 * Solo Modes package (Tournament cups + Minigame Practice): registered
 * through the buildUI extension point in src/ui/index.js. register(ctx)
 * adds the tournament and practice screens to the router and returns
 * their main-menu buttons ({menuItems}) - the same contract every
 * optional UI extension (help, netStatus, progression, ...) uses.
 */

import './tournament.css';
import './strings.js'; // registers the 'tour.*' / 'prac.*' i18n entries at load time
import { createTournamentScreen } from './tournamentScreen.js';
import { createPracticeScreen } from './practiceScreen.js';

/**
 * @param {Object} ctx The UI context assembled in buildUI (src/ui/index.js).
 * @returns {{menuItems: {id: string, labelKey: string, screen: string, order: number}[]}}
 */
export default function register(ctx) {
  const router = ctx.app?.router ?? ctx.router;
  router.register('tournament', createTournamentScreen(ctx));
  router.register('practice', createPracticeScreen(ctx));
  return {
    menuItems: [
      { id: 'tournament', labelKey: 'tour.menu', screen: 'tournament', order: 30 },
      { id: 'practice', labelKey: 'tour.practiceMenu', screen: 'practice', order: 31 },
    ],
  };
}
