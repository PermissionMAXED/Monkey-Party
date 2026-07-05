/**
 * Progression package (achievements, match history, XP/level meta):
 * registered through the buildUI extension point in src/ui/index.js.
 * register(ctx) adds the Achievements and Match History screens to the
 * router and returns their main-menu buttons ({menuItems}) - the same
 * contract as every optional UI extension (help, netStatus, tournament).
 *
 * The match-side entry point lives in src/app/progression.js
 * (applyMatchResults), which the in-match package guard-imports after
 * game over.
 */

import './progression.css';
import './strings.js'; // registers the 'prog.*' i18n entries at load time
import { createAchievementsScreen } from './achievementsScreen.js';
import { createHistoryScreen } from './historyScreen.js';

/**
 * @param {Object} ctx The UI context assembled in buildUI (src/ui/index.js).
 * @returns {{menuItems: {id: string, labelKey: string, screen: string, order: number}[]}}
 */
export default function register(ctx) {
  const router = ctx.app?.router ?? ctx.router;
  router.register('achievements', createAchievementsScreen(ctx));
  router.register('history', createHistoryScreen(ctx));
  return {
    menuItems: [
      { id: 'achievements', labelKey: 'prog.menu.achievements', screen: 'achievements', order: 12 },
      { id: 'history', labelKey: 'prog.menu.history', screen: 'history', order: 14 },
    ],
  };
}
