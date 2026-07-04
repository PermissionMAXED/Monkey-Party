/**
 * Batch-2 minigame views (package P8, client side).
 *
 * Exports `views`, a map of minigame id -> createView factory, and wires
 * each factory into its sim module via attachView() at import time so
 * that MinigameDef.createView (which delegates to the attached factory)
 * renders the real three.js view once this module has been loaded.
 *
 * Keep this import out of shared/ and tests: sims must stay renderer-free.
 */

import { attachView as attachRollingLogRun } from '#shared/minigames/sims/batch2/rollingLogRun.js';
import { attachView as attachJunglePainters } from '#shared/minigames/sims/batch2/junglePainters.js';
import { attachView as attachGhostMazeEscape } from '#shared/minigames/sims/batch2/ghostMazeEscape.js';
import { attachView as attachPiranhaFishing } from '#shared/minigames/sims/batch2/piranhaFishing.js';
import { attachView as attachRhythmDrums } from '#shared/minigames/sims/batch2/rhythmDrums.js';
import { attachView as attachIceSlideRace } from '#shared/minigames/sims/batch2/iceSlideRace.js';
import { attachView as attachBluffBanana } from '#shared/minigames/sims/batch2/bluffBanana.js';
import { attachView as attachKingGorillaSmash } from '#shared/minigames/sims/batch2/kingGorillaSmash.js';

import { createView as rollingLogRun } from './rollingLogRun.js';
import { createView as junglePainters } from './junglePainters.js';
import { createView as ghostMazeEscape } from './ghostMazeEscape.js';
import { createView as piranhaFishing } from './piranhaFishing.js';
import { createView as rhythmDrums } from './rhythmDrums.js';
import { createView as iceSlideRace } from './iceSlideRace.js';
import { createView as bluffBanana } from './bluffBanana.js';
import { createView as kingGorillaSmash } from './kingGorillaSmash.js';

/** @type {Object<string, (opts: Object) => import('#shared/types.js').IMinigameView>} */
export const views = {
  rolling_log_run: rollingLogRun,
  jungle_painters: junglePainters,
  ghost_maze_escape: ghostMazeEscape,
  piranha_fishing: piranhaFishing,
  rhythm_drums: rhythmDrums,
  ice_slide_race: iceSlideRace,
  bluff_banana: bluffBanana,
  king_gorilla_smash: kingGorillaSmash,
};

attachRollingLogRun(rollingLogRun);
attachJunglePainters(junglePainters);
attachGhostMazeEscape(ghostMazeEscape);
attachPiranhaFishing(piranhaFishing);
attachRhythmDrums(rhythmDrums);
attachIceSlideRace(iceSlideRace);
attachBluffBanana(bluffBanana);
attachKingGorillaSmash(kingGorillaSmash);

export default views;
