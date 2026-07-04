/**
 * Template minigame views (package P8, client side).
 *
 * One shared view per template serves every registered variant: the sim's
 * createView passes the variant's MinigameDef through, and the view reads
 * def.params.theme ({palette, propSet, skyColor}) plus pacing params to
 * make each variant look and feel distinct.
 *
 * Exports `views`, a map of templateId -> createView factory, and wires
 * each factory into its template module via attachView() at import time.
 * Keep this import out of shared/ and tests: sims must stay renderer-free.
 */

import { attachView as attachReactionDuel } from '#shared/minigames/sims/templates/reactionDuel.js';
import { attachView as attachDodgeRain } from '#shared/minigames/sims/templates/dodgeRain.js';
import { attachView as attachMashRace } from '#shared/minigames/sims/templates/mashRace.js';
import { attachView as attachMemoryPath } from '#shared/minigames/sims/templates/memoryPath.js';
import { attachView as attachCollectRush } from '#shared/minigames/sims/templates/collectRush.js';
import { attachView as attachTargetShoot } from '#shared/minigames/sims/templates/targetShoot.js';

import { createView as reactionDuel } from './reactionDuel.js';
import { createView as dodgeRain } from './dodgeRain.js';
import { createView as mashRace } from './mashRace.js';
import { createView as memoryPath } from './memoryPath.js';
import { createView as collectRush } from './collectRush.js';
import { createView as targetShoot } from './targetShoot.js';

/** @type {Object<string, (opts: Object) => import('#shared/types.js').IMinigameView>} */
export const views = {
  reactionDuel,
  dodgeRain,
  mashRace,
  memoryPath,
  collectRush,
  targetShoot,
};

attachReactionDuel(reactionDuel);
attachDodgeRain(dodgeRain);
attachMashRace(mashRace);
attachMemoryPath(memoryPath);
attachCollectRush(collectRush);
attachTargetShoot(targetShoot);

export default views;
