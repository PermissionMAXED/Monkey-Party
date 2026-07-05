/**
 * Batch-3 minigame views (client side).
 *
 * Exports `views`, a map of minigame id -> createView factory, and wires
 * each factory into its sim module via attachView() at import time so
 * that MinigameDef.createView (which delegates to the attached factory)
 * renders the real three.js view once this module has been loaded.
 *
 * Keep this import out of shared/ and tests: sims must stay renderer-free.
 */

import { attachView as attachBananaBridgeBuilders } from '#shared/minigames/sims/batch3/bananaBridgeBuilders.js';
import { attachView as attachMonkeyCannonballDodge } from '#shared/minigames/sims/batch3/monkeyCannonballDodge.js';
import { attachView as attachCoconutCurling } from '#shared/minigames/sims/batch3/coconutCurling.js';
import { attachView as attachFireflyCatchers } from '#shared/minigames/sims/batch3/fireflyCatchers.js';
import { attachView as attachTotemTowerTopple } from '#shared/minigames/sims/batch3/totemTowerTopple.js';
import { attachView as attachStampedeSurfers } from '#shared/minigames/sims/batch3/stampedeSurfers.js';
import { attachView as attachEchoCavern } from '#shared/minigames/sims/batch3/echoCavern.js';
import { attachView as attachRoyalBananaHeist } from '#shared/minigames/sims/batch3/royalBananaHeist.js';

import { createView as bananaBridgeBuilders } from './bananaBridgeBuilders.js';
import { createView as monkeyCannonballDodge } from './monkeyCannonballDodge.js';
import { createView as coconutCurling } from './coconutCurling.js';
import { createView as fireflyCatchers } from './fireflyCatchers.js';
import { createView as totemTowerTopple } from './totemTowerTopple.js';
import { createView as stampedeSurfers } from './stampedeSurfers.js';
import { createView as echoCavern } from './echoCavern.js';
import { createView as royalBananaHeist } from './royalBananaHeist.js';

/** @type {Object<string, (opts: Object) => import('#shared/types.js').IMinigameView>} */
export const views = {
  banana_bridge_builders: bananaBridgeBuilders,
  monkey_cannonball_dodge: monkeyCannonballDodge,
  coconut_curling: coconutCurling,
  firefly_catchers: fireflyCatchers,
  totem_tower_topple: totemTowerTopple,
  stampede_surfers: stampedeSurfers,
  echo_cavern: echoCavern,
  royal_banana_heist: royalBananaHeist,
};

attachBananaBridgeBuilders(bananaBridgeBuilders);
attachMonkeyCannonballDodge(monkeyCannonballDodge);
attachCoconutCurling(coconutCurling);
attachFireflyCatchers(fireflyCatchers);
attachTotemTowerTopple(totemTowerTopple);
attachStampedeSurfers(stampedeSurfers);
attachEchoCavern(echoCavern);
attachRoyalBananaHeist(royalBananaHeist);

export default views;
