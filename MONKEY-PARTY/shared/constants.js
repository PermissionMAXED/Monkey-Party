/**
 * MONKEY-PARTY shared constants.
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 * Safe to import from browser client, node server, sims, and tests.
 */

export const GAME_NAME = 'MONKEY-PARTY';

/** Simulation tick rate for minigames (steps per second). */
export const TICK_RATE = 30;
/** Fixed simulation delta in seconds (exactly 1/30s per step). */
export const TICK_DT = 1 / TICK_RATE;

export const MIN_PLAYERS = 2;
export const MAX_SEATS = 8;

/** Supported UI languages. */
export const LANGUAGES = ['en', 'de'];

/** Match phases, in canonical order (see MatchState.phase in shared/types.js). */
export const PHASES = [
  'turn_start',
  'item',
  'roll',
  'move',
  'field',
  'shop',
  'minigame_select',
  'minigame',
  'round_end',
  'bonus',
  'game_over',
];

/** Board node types (see BoardDef.nodes[].type in shared/types.js). */
export const NODE_TYPES = [
  'start',
  'blue',
  'red',
  'event',
  'item',
  'shop',
  'star',
  'boss',
  'trap',
  'junction',
  'special',
];

/** Item rarities (see ItemDef.rarity). */
export const ITEM_RARITIES = ['common', 'rare', 'epic'];
/** Item usage phases (see ItemDef.phase). */
export const ITEM_PHASES = ['preRoll', 'anytime', 'passive', 'trapPlace'];
/** Item target kinds (see ItemDef.target). */
export const ITEM_TARGETS = ['none', 'self', 'player', 'node'];
/** Rules.items modes. */
export const ITEM_MODES = ['normal', 'off', 'infinite', 'allSame'];

/** Minigame categories (see MinigameDef.category). */
export const MINIGAME_CATEGORIES = ['ffa', '2v2', '1v3', 'team', 'duel', 'boss'];

/** Bot difficulty levels (see Rules.botDifficulty). */
export const BOT_DIFFICULTIES = ['easy', 'normal', 'hard', 'wild'];

/** Action types accepted by the match sim (see Action in shared/types.js). */
export const ACTION_TYPES = [
  'roll',
  'useItem',
  'skipItem',
  'junction',
  'buyStar',
  'declineStar',
  'shopBuy',
  'shopLeave',
  'dicePick',
  'itemTarget',
  'emote',
  'minigameResults',
];

/** Decision kinds a MatchState.awaiting entry may ask for. */
export const DECISION_TYPES = ['roll', 'junction', 'buyStar', 'shop', 'itemTarget', 'dicePick'];

/** Render quality levels used by the settings store / renderer. */
export const QUALITY_LEVELS = ['low', 'med', 'high'];

/** Banana multiplier options allowed by the rules. */
export const BANANA_MULTIPLIERS = [1, 2];
