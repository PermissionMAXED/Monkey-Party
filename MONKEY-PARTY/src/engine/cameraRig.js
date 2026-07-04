/**
 * Smooth-damped camera rig for MONKEY-PARTY.
 *
 * Wraps a THREE.PerspectiveCamera with follow / orbit / fly behaviors plus
 * screen shake. The rig must be driven every frame:
 *
 *   const rig = createCameraRig(engine.camera);
 *   engine.onFrame((dt) => rig.update(dt));
 */

import * as THREE from 'three';

/**
 * Named camera presets: world-space offset from the target, look offset, and
 * damping (higher = snappier).
 */
export const CAMERA_PRESETS = {
  board: { offset: new THREE.Vector3(0, 20, 16), lookOffset: new THREE.Vector3(0, 0, 0), damp: 2.5 },
  player: { offset: new THREE.Vector3(0, 5, 7.5), lookOffset: new THREE.Vector3(0, 1, 0), damp: 6 },
  minigame: { offset: new THREE.Vector3(0, 13, 12), lookOffset: new THREE.Vector3(0, 0, 0), damp: 4.5 },
  podium: { offset: new THREE.Vector3(0, 2.5, 7), lookOffset: new THREE.Vector3(0, 1.5, 0), damp: 3.5 },
};

const _v = new THREE.Vector3();

/** Resolve an Object3D | Vector3 | [x,y,z] into `out`. */
function worldPos(target, out) {
  if (!target) return out.set(0, 0, 0);
  if (target.isObject3D) return target.getWorldPosition(out);
  if (target.isVector3) return out.copy(target);
  if (Array.isArray(target)) return out.set(target[0] ?? 0, target[1] ?? 0, target[2] ?? 0);
  return out.set(target.x ?? 0, target.y ?? 0, target.z ?? 0);
}

/** Frame-rate independent damping factor. */
function dampFactor(lambda, dt) {
  return 1 - Math.exp(-lambda * dt);
}

/**
 * @param {THREE.PerspectiveCamera} camera
 * @returns {{
 *   follow: (target: *, preset?: string|Object) => void,
 *   lookAt: (target: *) => void,
 *   orbit: (center: *, radius?: number, speed?: number, height?: number) => void,
 *   shake: (intensity?: number, dur?: number) => void,
 *   flyTo: (pose: {position: *, lookAt?: *, fov?: number}, dur?: number) => Promise<void>,
 *   snap: () => void,
 *   update: (dt: number) => void,
 *   presets: Object,
 * }}
 */
export function createCameraRig(camera) {
  let mode = 'idle';
  let followTarget = null;
  let preset = CAMERA_PRESETS.player;

  // Current smoothed pose.
  const pos = camera.position.clone();
  const look = new THREE.Vector3();
  camera.getWorldDirection(_v);
  look.copy(pos).add(_v.multiplyScalar(10));

  // Goals the smoothed pose is damped towards.
  const posGoal = pos.clone();
  const lookGoal = look.clone();

  // Orbit state.
  const orbitCenter = new THREE.Vector3();
  let orbitRadius = 10;
  let orbitSpeed = 0.5;
  let orbitHeight = 6;
  let orbitAngle = 0;

  // Fly state.
  let fly = null; // { fromPos, toPos, fromLook, toLook, fromFov, toFov, t, dur, resolve }

  // Shake state.
  let shakeTime = 0;
  let shakeDur = 0;
  let shakeIntensity = 0;
  const shakeOffset = new THREE.Vector3();

  function resolvePreset(p) {
    if (typeof p === 'string') return CAMERA_PRESETS[p] ?? CAMERA_PRESETS.player;
    if (p && typeof p === 'object') {
      return {
        offset: worldPos(p.offset ?? CAMERA_PRESETS.player.offset, new THREE.Vector3()),
        lookOffset: worldPos(p.lookOffset ?? CAMERA_PRESETS.player.lookOffset, new THREE.Vector3()),
        damp: p.damp ?? 5,
      };
    }
    return CAMERA_PRESETS.player;
  }

  /** Smoothly follow a target (Object3D / Vector3 / [x,y,z]) with a preset. */
  function follow(target, presetName = 'player') {
    followTarget = target;
    preset = resolvePreset(presetName);
    mode = 'follow';
  }

  /** Point the camera (smoothly) at a target without changing position goals. */
  function lookAt(target) {
    worldPos(target, lookGoal);
    if (mode === 'follow') mode = 'followLook'; // Keep following position, custom look.
    else if (mode !== 'orbit' && mode !== 'fly') mode = 'idle';
  }

  /** Circle around a center point at radius, speed rad/s. */
  function orbit(center, radius = 10, speed = 0.5, height = radius * 0.6) {
    worldPos(center, orbitCenter);
    orbitRadius = radius;
    orbitSpeed = speed;
    orbitHeight = height;
    // Start from the current angle relative to the center to avoid pops.
    orbitAngle = Math.atan2(pos.x - orbitCenter.x, pos.z - orbitCenter.z);
    mode = 'orbit';
  }

  /** Trigger a decaying screen shake. */
  function shake(intensity = 0.3, dur = 0.4) {
    shakeIntensity = Math.max(shakeIntensity * (shakeTime > 0 ? shakeTime / shakeDur : 0), intensity);
    shakeDur = Math.max(dur, 0.01);
    shakeTime = shakeDur;
  }

  /**
   * Fly to a pose { position, lookAt?, fov? } over dur seconds (smoothstep).
   * Returns a promise resolved when the flight completes (or is superseded).
   */
  function flyTo(pose = {}, dur = 1) {
    if (fly) fly.resolve();
    return new Promise((resolve) => {
      fly = {
        fromPos: pos.clone(),
        toPos: worldPos(pose.position ?? pos, new THREE.Vector3()),
        fromLook: look.clone(),
        toLook: pose.lookAt != null ? worldPos(pose.lookAt, new THREE.Vector3()) : look.clone(),
        fromFov: camera.fov,
        toFov: pose.fov ?? camera.fov,
        t: 0,
        dur: Math.max(dur, 0.001),
        resolve,
      };
      mode = 'fly';
    });
  }

  /** Jump the smoothed pose straight to its goals (no easing). */
  function snap() {
    pos.copy(posGoal);
    look.copy(lookGoal);
  }

  function update(dt) {
    if (!(dt > 0)) dt = 0.0001;

    if (mode === 'follow' || mode === 'followLook') {
      worldPos(followTarget, _v);
      posGoal.copy(_v).add(preset.offset);
      if (mode === 'follow') lookGoal.copy(_v).add(preset.lookOffset);
      const f = dampFactor(preset.damp, dt);
      pos.lerp(posGoal, f);
      look.lerp(lookGoal, f);
    } else if (mode === 'orbit') {
      orbitAngle += orbitSpeed * dt;
      posGoal.set(
        orbitCenter.x + Math.sin(orbitAngle) * orbitRadius,
        orbitCenter.y + orbitHeight,
        orbitCenter.z + Math.cos(orbitAngle) * orbitRadius,
      );
      lookGoal.copy(orbitCenter);
      const f = dampFactor(4, dt);
      pos.lerp(posGoal, f);
      look.lerp(lookGoal, f);
    } else if (mode === 'fly' && fly) {
      fly.t += dt;
      const k = Math.min(fly.t / fly.dur, 1);
      const e = k * k * (3 - 2 * k); // smoothstep
      pos.lerpVectors(fly.fromPos, fly.toPos, e);
      look.lerpVectors(fly.fromLook, fly.toLook, e);
      if (fly.fromFov !== fly.toFov) {
        camera.fov = fly.fromFov + (fly.toFov - fly.fromFov) * e;
        camera.updateProjectionMatrix();
      }
      if (k >= 1) {
        posGoal.copy(fly.toPos);
        lookGoal.copy(fly.toLook);
        fly.resolve();
        fly = null;
        mode = 'idle';
      }
    } else {
      // idle: still ease towards goals (lookAt() nudges lookGoal).
      const f = dampFactor(5, dt);
      pos.lerp(posGoal, f);
      look.lerp(lookGoal, f);
    }

    // Shake: random offset with linear decay.
    if (shakeTime > 0) {
      shakeTime = Math.max(0, shakeTime - dt);
      const k = shakeIntensity * (shakeTime / shakeDur);
      shakeOffset.set(
        (Math.random() * 2 - 1) * k,
        (Math.random() * 2 - 1) * k * 0.6,
        (Math.random() * 2 - 1) * k,
      );
    } else {
      shakeOffset.set(0, 0, 0);
    }

    camera.position.copy(pos).add(shakeOffset);
    _v.copy(look).addScaledVector(shakeOffset, 0.5);
    camera.lookAt(_v);
  }

  return { follow, lookAt, orbit, shake, flyTo, snap, update, presets: CAMERA_PRESETS };
}
