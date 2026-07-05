/**
 * Help package (onboarding & help): registered through the buildUI
 * extension point in src/ui/index.js. register(ctx) adds the How-to-Play
 * and Credits screens to the router and returns their main-menu buttons
 * ({menuItems}), dogfooding the same contract every optional UI extension
 * (netStatus, progression, tournament, ...) uses.
 */

import './help.css';
import './strings.js'; // registers the 'help.*' i18n entries at load time
import { createHowToPlayScreen } from './howToPlay.js';
import { createCreditsScreen } from './credits.js';

/**
 * @param {Object} ctx The UI context assembled in buildUI (src/ui/index.js).
 * @returns {{menuItems: {id: string, labelKey: string, screen: string, order: number}[]}}
 */
export default function register(ctx) {
  const router = ctx.app?.router ?? ctx.router;
  router.register('howToPlay', createHowToPlayScreen(ctx));
  router.register('credits', createCreditsScreen(ctx));
  return {
    menuItems: [
      { id: 'howToPlay', labelKey: 'help.menu.howToPlay', screen: 'howToPlay', order: 10 },
      { id: 'credits', labelKey: 'help.menu.credits', screen: 'credits', order: 20 },
    ],
  };
}
