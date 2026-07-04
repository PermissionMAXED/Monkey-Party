/**
 * MONKEY-PARTY character system (package P6) - client-side entry.
 *
 * Re-exports the monkey factory, animator, clips and cosmetics, plus
 * buildCharacterPreview(def, cosmetics): a self-rotating, idle-animated
 * monkey group for menus / character select.
 *
 * Character DATA (defs, perks, unlocks) lives in shared/content/characters
 * and registers into shared/registries.js `characters`; this package only
 * renders and animates.
 */

import * as THREE from 'three';

import { buildMonkey } from './monkeyFactory.js';
import { createAnimator } from './animator.js';

export { buildMonkey, matFor } from './monkeyFactory.js';
export { createAnimator, DEFAULT_FADE } from './animator.js';
export {
  CLIPS, getClip, clipNames, hashId, EMOTE_CLIPS, VICTORY_VARIANTS, LOSE_VARIANTS,
} from './clips.js';
export {
  COSMETICS, applyCosmetics, getCosmetic, cosmeticsBySlot,
} from './cosmetics.js';

/** Preview turntable speed (rad/s). */
const PREVIEW_SPIN = 0.7;

/**
 * Build a self-rotating character preview for menus.
 *
 * The returned group spins on a turntable and breathes (idle clip). It
 * drives itself through onBeforeRender while it is being rendered; hosts
 * with their own frame loop can instead call group.userData.update(dt)
 * (doing so takes over and disables the self-driving path).
 *
 * group.userData also exposes {monkey, animator, dispose()}.
 *
 * @param {import('#shared/types.js').CharacterDef} def
 * @param {{hat?: string|null, glasses?: string|null, accessory?: string|null,
 *   skin?: string|null}} [cosmetics]
 * @returns {THREE.Group}
 */
export function buildCharacterPreview(def, cosmetics = null) {
  const monkey = buildMonkey(def, cosmetics);
  const animator = createAnimator(monkey);
  animator.play('idle', { fade: 0 });

  const group = new THREE.Group();
  group.name = `preview:${def?.id ?? 'unknown'}`;
  group.add(monkey.group);

  let externallyDriven = false;
  let lastAutoMs = null;
  let disposed = false;

  function tick(dt) {
    if (disposed) return;
    group.rotation.y += dt * PREVIEW_SPIN;
    animator.update(dt);
  }

  // Self-driving path: hook the first mesh we find (onBeforeRender fires
  // per rendered mesh, not per group) and derive dt from wall-clock time.
  const proxy = (() => {
    let found = null;
    monkey.group.traverse((obj) => {
      if (!found && obj.isMesh) found = obj;
    });
    return found;
  })();
  if (proxy) {
    proxy.onBeforeRender = () => {
      if (externallyDriven || disposed) return;
      const now = typeof performance !== 'undefined' ? performance.now() : null;
      if (now !== null && lastAutoMs !== null) tick(Math.min(0.1, (now - lastAutoMs) / 1000));
      if (now !== null) lastAutoMs = now;
    };
  }

  group.userData.monkey = monkey;
  group.userData.animator = animator;
  group.userData.update = (dt) => {
    externallyDriven = true;
    tick(Math.max(0, Number(dt) || 0));
  };
  group.userData.dispose = () => {
    disposed = true;
    if (proxy) proxy.onBeforeRender = () => {};
    group.parent?.remove(group);
  };

  return group;
}

export default {
  buildMonkey,
  createAnimator,
  buildCharacterPreview,
};
