/**
 * Camera shot logic for the board-play view (P4), built on the engine
 * cameraRig (src/engine/cameraRig.js).
 *
 * Shots:
 *  - overview: slow orbit around the board center (minigame_select,
 *    round_end, bonus, and whenever there is nothing to follow)
 *  - follow:   damped follow-cam on the moving/current token
 *  - punch:    quick fly-in on an event position (field/boss/star), the
 *    choreography calls applyShot() afterwards to resume the phase shot
 *  - podium:   slow close orbit framing the winner on game_over
 *
 * Headless-safe: without an engine camera every method no-ops.
 */

import * as THREE from 'three';
import { createCameraRig } from '../engine/cameraRig.js';

const _v = new THREE.Vector3();

function worldPosOf(target, out = new THREE.Vector3()) {
  if (!target) return out.set(0, 0, 0);
  if (target.isObject3D) return target.getWorldPosition(out);
  if (target.isVector3) return out.copy(target);
  return out.set(target.x ?? 0, target.y ?? 0, target.z ?? 0);
}

/**
 * @param {{
 *   engine: {camera?: THREE.PerspectiveCamera}|null,
 *   center?: THREE.Vector3 Board center,
 *   radius?: number Board bounding radius,
 * }} opts
 */
export function createCameraDirector({ engine = null, center = new THREE.Vector3(), radius = 20 } = {}) {
  let rig = null;
  if (engine?.camera) {
    try {
      rig = createCameraRig(engine.camera);
    } catch {
      rig = null;
    }
  }

  let phase = 'turn_start';
  let focus = null; // Object3D (current token) or null
  let mode = 'overview';

  /** Slow establishing orbit around the whole board. */
  function overview() {
    mode = 'overview';
    rig?.orbit(center, radius * 1.35, 0.12, radius * 0.95);
  }

  /** Damped follow-cam on a token (falls back to overview). */
  function follow(target = focus) {
    if (!target) {
      overview();
      return;
    }
    focus = target;
    mode = 'follow';
    rig?.follow(target, 'player');
  }

  /** Quick punch-in on an event position. Resume via applyShot(). */
  function punch(pos, dur = 0.45) {
    if (!pos) return;
    mode = 'punch';
    const p = worldPosOf(pos, _v);
    rig?.flyTo({
      position: new THREE.Vector3(p.x + 2.6, p.y + 2.8, p.z + 3.6),
      lookAt: new THREE.Vector3(p.x, p.y + 0.8, p.z),
    }, dur);
  }

  /** Winner framing for game_over: tight low orbit around the podium. */
  function podium(target = focus) {
    mode = 'podium';
    const p = worldPosOf(target, new THREE.Vector3());
    rig?.orbit(p.clone().add(new THREE.Vector3(0, 1.1, 0)), 5.5, 0.28, 2.4);
  }

  /** Remember the sim phase (drives applyShot()). */
  function setPhase(p) {
    if (typeof p === 'string') phase = p;
  }

  /** Remember the token/object the phase shots should frame. */
  function setFocus(obj) {
    if (obj) focus = obj;
  }

  /** Re-apply the shot appropriate for the current phase + focus. */
  function applyShot() {
    switch (phase) {
      case 'minigame_select':
      case 'minigame':
      case 'round_end':
      case 'bonus':
        overview();
        break;
      case 'game_over':
        podium(focus);
        break;
      default:
        follow(focus);
        break;
    }
  }

  function shake(intensity = 0.3, dur = 0.4) {
    rig?.shake(intensity, dur);
  }

  /** Drive the rig; call once per frame. */
  function update(dt) {
    rig?.update(Math.max(0.0001, Number(dt) || 0));
  }

  function dispose() {
    rig = null;
    focus = null;
  }

  overview();

  return {
    overview,
    follow,
    punch,
    podium,
    setPhase,
    setFocus,
    applyShot,
    shake,
    update,
    dispose,
    get mode() {
      return mode;
    },
    get phase() {
      return phase;
    },
  };
}

export default createCameraDirector;
