/**
 * Template variant catalog (package P8).
 *
 * Pure data: every entry stamps one playable minigame out of a template
 * factory (see sims/templates/index.js). Each variant carries
 *   { templateId, id, name: {en, de}, params }
 * plus optional def-level overrides (category, players, tags,
 * competitiveSafe). params always includes a theme
 * ({palette: {primary, secondary, accent}, propSet, skyColor}) that the
 * template's shared view reads so every variant looks distinct.
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 */

/** Reusable theme presets keyed by propSet flavor. */
export const THEMES = {
  jungle: {
    palette: { primary: '#2e7d32', secondary: '#8d6e63', accent: '#ffe135' },
    propSet: 'jungle',
    skyColor: '#87ceeb',
  },
  volcano: {
    palette: { primary: '#4e342e', secondary: '#ff7043', accent: '#ffab00' },
    propSet: 'volcano',
    skyColor: '#3e2723',
  },
  city: {
    palette: { primary: '#546e7a', secondary: '#90a4ae', accent: '#ffee58' },
    propSet: 'city',
    skyColor: '#263238',
  },
  ice: {
    palette: { primary: '#b3e5fc', secondary: '#e1f5fe', accent: '#4fc3f7' },
    propSet: 'ice',
    skyColor: '#cfe8ff',
  },
  ghost: {
    palette: { primary: '#4a148c', secondary: '#7e57c2', accent: '#b39ddb' },
    propSet: 'ghost',
    skyColor: '#1a1030',
  },
  factory: {
    palette: { primary: '#616161', secondary: '#8d6e63', accent: '#ffca28' },
    propSet: 'factory',
    skyColor: '#37474f',
  },
};

/** @type {Array<Object>} All template variants, grouped by template. */
export const VARIANTS = [
  /* ---------------------------- reactionDuel ---------------------------- */
  {
    templateId: 'reactionDuel',
    id: 'firework_flinch',
    name: { en: 'Firework Flinch', de: 'Feuerwerk-Zucken' },
    params: { theme: THEMES.city, fakeChance: 0.35, waitMaxTicks: 115 },
  },
  {
    templateId: 'reactionDuel',
    id: 'drum_duel',
    name: { en: 'Drum Duel', de: 'Trommel-Duell' },
    params: { theme: THEMES.jungle, fakeChance: 0.15, waitMinTicks: 32, waitMaxTicks: 90 },
  },
  {
    templateId: 'reactionDuel',
    id: 'snake_pop',
    name: { en: 'Snake Pop', de: 'Schlangen-Schreck' },
    params: { theme: THEMES.volcano, fakeChance: 0.45, waitMaxTicks: 125 },
  },
  {
    templateId: 'reactionDuel',
    id: 'cannon_call',
    name: { en: 'Cannon Call', de: 'Kanonen-Kommando' },
    params: { theme: THEMES.factory, fakeChance: 0.3, windowTicks: 60, rounds: 5 },
  },
  {
    templateId: 'reactionDuel',
    id: 'gong_gambit',
    name: { en: 'Gong Gambit', de: 'Gong-Gambit' },
    params: { theme: THEMES.ghost, rounds: 6, waitMaxTicks: 130, fakeChance: 0.25 },
  },
  {
    templateId: 'reactionDuel',
    id: 'mirror_match',
    name: { en: 'Mirror Match', de: 'Spiegel-Duell' },
    params: { theme: THEMES.ice, fakeChance: 0.55, windowTicks: 55, waitMinTicks: 50 },
  },

  /* ------------------------------ dodgeRain ----------------------------- */
  {
    templateId: 'dodgeRain',
    id: 'coconut_rain',
    name: { en: 'Coconut Rain', de: 'Kokosnuss-Regen' },
    params: { theme: THEMES.jungle },
  },
  {
    templateId: 'dodgeRain',
    id: 'meteor_madness',
    name: { en: 'Meteor Madness', de: 'Meteoriten-Wahnsinn' },
    params: {
      theme: THEMES.volcano, hazardRadius: 2.3, telegraphTicks: 50,
      spawnEveryStart: 30, spawnEveryEnd: 10,
    },
  },
  {
    templateId: 'dodgeRain',
    id: 'icicle_drop',
    name: { en: 'Icicle Drop', de: 'Eiszapfen-Sturz' },
    params: {
      theme: THEMES.ice, hazardRadius: 1.2, telegraphTicks: 30,
      spawnEveryStart: 18, spawnEveryEnd: 6,
    },
  },
  {
    templateId: 'dodgeRain',
    id: 'ghost_hail',
    name: { en: 'Ghost Hail', de: 'Geister-Hagel' },
    params: { theme: THEMES.ghost, hazardRadius: 1.5, telegraphTicks: 36, moveSpeed: 5.4 },
  },
  {
    templateId: 'dodgeRain',
    id: 'gear_storm',
    name: { en: 'Gear Storm', de: 'Zahnrad-Sturm' },
    params: { theme: THEMES.factory, hazardRadius: 1.8, spawnEveryStart: 26, spawnEveryEnd: 8 },
  },
  {
    templateId: 'dodgeRain',
    id: 'confetti_bombs',
    name: { en: 'Confetti Bombs', de: 'Konfetti-Bomben' },
    params: {
      theme: THEMES.city, hazardRadius: 1.1, spawnBurst: 2, lives: 2,
      spawnEveryStart: 22, spawnEveryEnd: 8,
    },
  },
  {
    templateId: 'dodgeRain',
    id: 'lava_leap',
    name: { en: 'Lava Leap', de: 'Lava-Sprung' },
    params: {
      theme: THEMES.volcano, hazardRadius: 2, telegraphTicks: 45,
      spawnEveryStart: 20, spawnEveryEnd: 6, arenaRadius: 7,
    },
  },

  /* ------------------------------ mashRace ------------------------------ */
  {
    templateId: 'mashRace',
    id: 'tug_of_banana',
    name: { en: 'Tug of Banana', de: 'Bananen-Tauziehen' },
    category: '2v2',
    players: { min: 4, max: 4 },
    tags: ['mash', 'team'],
    params: { theme: THEMES.jungle, mode: 'tug', ropeGoal: 9, durationSec: 35 },
  },
  {
    templateId: 'mashRace',
    id: 'wall_climbers',
    name: { en: 'Wall Climbers', de: 'Wand-Kletterer' },
    params: { theme: THEMES.city, goal: 50 },
  },
  {
    templateId: 'mashRace',
    id: 'cart_chaos',
    name: { en: 'Cart Chaos', de: 'Loren-Chaos' },
    category: 'team',
    players: { min: 4, max: 8 },
    tags: ['mash', 'team'],
    params: { theme: THEMES.factory, mode: 'team', goal: 95, durationSec: 35 },
  },
  {
    templateId: 'mashRace',
    id: 'coconut_crank',
    name: { en: 'Coconut Crank', de: 'Kokosnuss-Kurbel' },
    category: 'duel',
    players: { min: 2, max: 2 },
    tags: ['mash', 'duel'],
    params: { theme: THEMES.jungle, goal: 40, durationSec: 30 },
  },
  {
    templateId: 'mashRace',
    id: 'drawbridge_dash',
    name: { en: 'Drawbridge Dash', de: 'Zugbruecken-Sprint' },
    params: { theme: THEMES.ghost, goal: 46, decayPerSec: 0.6 },
  },

  /* ----------------------------- memoryPath ----------------------------- */
  {
    templateId: 'memoryPath',
    id: 'temple_tiles',
    name: { en: 'Temple Tiles', de: 'Tempel-Platten' },
    params: { theme: THEMES.jungle },
  },
  {
    templateId: 'memoryPath',
    id: 'neon_steps',
    name: { en: 'Neon Steps', de: 'Neon-Stufen' },
    params: { theme: THEMES.city, showTicksPerStep: 10, gapTicks: 5 },
  },
  {
    templateId: 'memoryPath',
    id: 'ice_floes',
    name: { en: 'Ice Floes', de: 'Eisschollen' },
    params: { theme: THEMES.ice, inputTicksPerStep: 36, gridW: 6, gridH: 4 },
  },
  {
    templateId: 'memoryPath',
    id: 'ghost_lanterns',
    name: { en: 'Ghost Lanterns', de: 'Geister-Laternen' },
    params: { theme: THEMES.ghost, showTicksPerStep: 12, gapTicks: 4 },
  },
  {
    templateId: 'memoryPath',
    id: 'simon_supreme',
    name: { en: 'Simon Supreme', de: 'Simon Supreme' },
    params: { theme: THEMES.factory, startLen: 3, showTicksPerStep: 11 },
  },

  /* ----------------------------- collectRush ---------------------------- */
  {
    templateId: 'collectRush',
    id: 'banana_bonanza',
    name: { en: 'Banana Bonanza', de: 'Bananen-Bonanza' },
    params: { theme: THEMES.jungle },
  },
  {
    templateId: 'collectRush',
    id: 'coin_dive',
    name: { en: 'Coin Dive', de: 'Muenzen-Tauchgang' },
    params: { theme: THEMES.city, pickupCount: 15, bigChance: 0.2, trapChance: 0.15 },
  },
  {
    templateId: 'collectRush',
    id: 'gem_grab_teams',
    name: { en: 'Gem Grab Teams', de: 'Juwelen-Teams' },
    category: '2v2',
    players: { min: 4, max: 4 },
    tags: ['collect', 'team'],
    params: { theme: THEMES.ice, mode: 'teams', pickupCount: 14, bigChance: 0.3 },
  },
  {
    templateId: 'collectRush',
    id: 'magnet_mayhem',
    name: { en: 'Magnet Mayhem', de: 'Magnet-Chaos' },
    params: { theme: THEMES.factory, magnetRadius: 3, pickupCount: 10 },
  },
  {
    templateId: 'collectRush',
    id: 'dark_harvest',
    name: { en: 'Dark Harvest', de: 'Dunkle Ernte' },
    competitiveSafe: false, // Traps hide in the gloom - luck-heavy.
    params: { theme: THEMES.ghost, trapChance: 0.32, stunTicks: 55, pickupCount: 13 },
  },
  {
    templateId: 'collectRush',
    id: 'golden_rush',
    name: { en: 'Golden Rush', de: 'Gold-Rausch' },
    params: { theme: THEMES.volcano, bigChance: 0.4, respawnTicks: 60, trapChance: 0.25 },
  },

  /* ----------------------------- targetShoot ---------------------------- */
  {
    templateId: 'targetShoot',
    id: 'balloon_blitz',
    name: { en: 'Balloon Blitz', de: 'Ballon-Blitz' },
    params: { theme: THEMES.jungle },
  },
  {
    templateId: 'targetShoot',
    id: 'robo_ducks',
    name: { en: 'Robo Ducks', de: 'Robo-Enten' },
    params: { theme: THEMES.factory, speedMin: 4, speedMax: 7.5, targetCount: 5 },
  },
  {
    templateId: 'targetShoot',
    id: 'barrel_targets',
    name: { en: 'Barrel Targets', de: 'Fass-Ziele' },
    category: '1v3',
    players: { min: 4, max: 4 },
    tags: ['skill', 'aim', 'team'],
    params: { theme: THEMES.volcano, mode: '1v3', targetCount: 5 },
  },
  {
    templateId: 'targetShoot',
    id: 'snow_snipe',
    name: { en: 'Snow Snipe', de: 'Schnee-Schuss' },
    params: {
      theme: THEMES.ice, radiusMin: 0.6, radiusMax: 1.2,
      cooldownTicks: 22, speedMin: 2.5, speedMax: 5,
    },
  },
  {
    templateId: 'targetShoot',
    id: 'funfair_frenzy',
    name: { en: 'Funfair Frenzy', de: 'Jahrmarkt-Trubel' },
    params: { theme: THEMES.city, targetCount: 6, cooldownTicks: 12, speedMax: 8 },
  },
  {
    templateId: 'targetShoot',
    id: 'night_ops',
    name: { en: 'Night Ops', de: 'Nacht-Einsatz' },
    params: {
      theme: THEMES.ghost, flickerCycleTicks: 90, flickerOnTicks: 55, targetCount: 5,
    },
  },
];

export default VARIANTS;
