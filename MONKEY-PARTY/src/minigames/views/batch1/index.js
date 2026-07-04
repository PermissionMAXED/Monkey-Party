/**
 * Batch-1 minigame views (package P7, client side).
 *
 * Exports `views`, a map of minigame id -> createView factory, and wires
 * each factory into its sim module via attachView() at import time so that
 * MinigameDef.createView (which delegates to the attached factory) renders
 * the real three.js view once this module has been loaded by the client.
 *
 * Keep this import out of shared/ and tests: sims must stay renderer-free.
 */

import { attachView as attachBananaScramble } from '#shared/minigames/sims/batch1/bananaScramble.js';
import { attachView as attachVineSwingSprint } from '#shared/minigames/sims/batch1/vineSwingSprint.js';
import { attachView as attachBarrelBlastArena } from '#shared/minigames/sims/batch1/barrelBlastArena.js';
import { attachView as attachSneakyStatue } from '#shared/minigames/sims/batch1/sneakyStatue.js';
import { attachView as attachMemoryTotem } from '#shared/minigames/sims/batch1/memoryTotem.js';
import { attachView as attachSplashSumo } from '#shared/minigames/sims/batch1/splashSumo.js';
import { attachView as attachBananaCannonTeams } from '#shared/minigames/sims/batch1/bananaCannonTeams.js';
import { attachView as attachBombBanana } from '#shared/minigames/sims/batch1/bombBanana.js';

import { createView as bananaScramble } from './bananaScramble.js';
import { createView as vineSwingSprint } from './vineSwingSprint.js';
import { createView as barrelBlastArena } from './barrelBlastArena.js';
import { createView as sneakyStatue } from './sneakyStatue.js';
import { createView as memoryTotem } from './memoryTotem.js';
import { createView as splashSumo } from './splashSumo.js';
import { createView as bananaCannonTeams } from './bananaCannonTeams.js';
import { createView as bombBanana } from './bombBanana.js';

/** @type {Object<string, (opts: Object) => import('#shared/types.js').IMinigameView>} */
export const views = {
  banana_scramble: bananaScramble,
  vine_swing_sprint: vineSwingSprint,
  barrel_blast_arena: barrelBlastArena,
  sneaky_statue: sneakyStatue,
  memory_totem: memoryTotem,
  splash_sumo: splashSumo,
  banana_cannon_teams: bananaCannonTeams,
  bomb_banana: bombBanana,
};

attachBananaScramble(bananaScramble);
attachVineSwingSprint(vineSwingSprint);
attachBarrelBlastArena(barrelBlastArena);
attachSneakyStatue(sneakyStatue);
attachMemoryTotem(memoryTotem);
attachSplashSumo(splashSumo);
attachBananaCannonTeams(bananaCannonTeams);
attachBombBanana(bombBanana);

export default views;
