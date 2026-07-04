/**
 * 3D dice presentation for the board-play view (P4).
 *
 * The die tumbles above the rolling player and lands showing the rolled
 * face. Up to 4 dice (double_dice etc.) are shown side by side; the final
 * total floats above them as a canvas-texture sprite.
 *
 * Choreography-driven: the queue calls begin(pos, values, sides, total)
 * once, setProgress(k) with k in [0,1] every frame, then end(). No wall
 * clock, so it is fully deterministic in headless tests.
 *
 * Perf: one shared BoxGeometry; the standard 1-6 pip face materials are
 * built once and shared by every die. Non-d6 values fall back to a number
 * texture on all faces.
 */

import * as THREE from 'three';
import { makeTextSprite, disposeSprite, makeTextTexture } from './fieldFx.js';

const DIE_GEO = new THREE.BoxGeometry(0.55, 0.55, 0.55);
const MAX_DICE = 4;

/* Face order for BoxGeometry material groups: +x, -x, +y, -y, +z, -z.
 * Standard die: opposite faces sum to 7. */
const FACE_VALUES = [1, 6, 2, 5, 3, 4];

/** Rotation (euler) that brings the face showing `value` to the top (+y). */
const TOP_ROTATIONS = {
  1: [0, 0, Math.PI / 2],
  6: [0, 0, -Math.PI / 2],
  2: [0, 0, 0],
  5: [Math.PI, 0, 0],
  3: [-Math.PI / 2, 0, 0],
  4: [Math.PI / 2, 0, 0],
};

/** Pip layouts on a 3x3 grid (cell indices 0..8, row-major). */
const PIP_CELLS = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};

let pipMaterials = null;
const numberMats = new Map();

function pipTexture(value) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fdf6e3';
  ctx.fillRect(0, 0, 96, 96);
  ctx.strokeStyle = '#d9cfa8';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 90, 90);
  ctx.fillStyle = '#26221c';
  for (const cell of PIP_CELLS[value] ?? []) {
    const cx = 24 + (cell % 3) * 24;
    const cy = 24 + Math.floor(cell / 3) * 24;
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Shared 1-6 pip materials in BoxGeometry face order. */
function getPipMaterials() {
  if (!pipMaterials) {
    pipMaterials = FACE_VALUES.map((v) => new THREE.MeshStandardMaterial({
      map: pipTexture(v),
      color: pipTexture(v) ? '#ffffff' : '#fdf6e3',
      roughness: 0.5,
    }));
  }
  return pipMaterials;
}

/** Shared all-faces number material for values outside 1..6 (d8/d20/...). */
function numberMaterial(value) {
  let m = numberMats.get(value);
  if (!m) {
    const entry = makeTextTexture(String(value), { color: '#26221c', bg: '#fdf6e3', size: 56 });
    m = new THREE.MeshStandardMaterial({
      map: entry?.texture ?? null,
      color: entry ? '#ffffff' : '#fdf6e3',
      roughness: 0.5,
    });
    numberMats.set(value, m);
  }
  return m;
}

/** Deterministic per-die tumble parameters seeded by value + index. */
function tumbleSpin(value, index) {
  const s = (value * 7 + index * 13) % 11;
  return {
    x: 7 + s * 0.8,
    y: 5 + ((s * 3) % 7),
    z: 6 + ((s * 5) % 5),
  };
}

/**
 * @param {THREE.Object3D|null} parent Scene node to attach to.
 */
export function createDiceView(parent = null) {
  const group = new THREE.Group();
  group.name = 'diceView';
  group.visible = false;
  parent?.add?.(group);

  /** @type {{mesh: THREE.Mesh, value: number, spin: Object, target: THREE.Quaternion,
   *   settleFrom: THREE.Quaternion|null, offsetX: number}[]} */
  let active = [];
  let basePos = new THREE.Vector3();
  let totalSprite = null;
  let rolling = false;

  // Pool of MAX_DICE meshes, reused across rolls.
  const pool = [];
  for (let i = 0; i < MAX_DICE; i += 1) {
    const mesh = new THREE.Mesh(DIE_GEO, getPipMaterials());
    mesh.castShadow = true;
    mesh.visible = false;
    group.add(mesh);
    pool.push(mesh);
  }

  /**
   * Start a roll presentation above `pos`.
   * @param {THREE.Vector3} pos World position of the rolling player.
   * @param {number[]} values Rolled values.
   * @param {number} [sides]
   * @param {number} [total]
   */
  function begin(pos, values, sides = 6, total = null) {
    endInternal();
    basePos = pos?.clone?.() ?? new THREE.Vector3();
    const vals = (Array.isArray(values) && values.length > 0 ? values : [1]).slice(0, MAX_DICE);
    active = vals.map((value, i) => {
      const mesh = pool[i];
      mesh.visible = true;
      const standard = value >= 1 && value <= 6 && sides === 6;
      mesh.material = standard ? getPipMaterials() : new Array(6).fill(numberMaterial(value));
      const rot = standard ? TOP_ROTATIONS[value] : [0, 0, 0];
      const target = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2]));
      return {
        mesh,
        value,
        spin: tumbleSpin(value, i),
        target,
        settleFrom: null,
        offsetX: (i - (vals.length - 1) / 2) * 0.75,
      };
    });
    if (total != null) {
      totalSprite = makeTextSprite(String(total), {
        color: '#ffe135', stroke: 'rgba(0,0,0,0.85)', size: 72, height: 0.7,
      });
      totalSprite.material.opacity = 0;
      group.add(totalSprite);
    }
    group.visible = true;
    rolling = true;
  }

  /** Apply the roll pose for progress k in [0,1]. */
  function setProgress(k) {
    if (!rolling) return;
    const kk = Math.min(1, Math.max(0, k));
    const SETTLE = 0.62;
    // Height: toss up, then drop with a small bounce.
    const riseY = basePos.y + 2.1;
    const restY = basePos.y + 1.05;
    let y;
    if (kk < SETTLE) {
      y = basePos.y + 1.1 + Math.sin((kk / SETTLE) * Math.PI) * 1.1;
      if (kk / SETTLE > 0.5) y = Math.min(y, riseY);
    } else {
      const j = (kk - SETTLE) / (1 - SETTLE);
      const bounce = Math.abs(Math.sin(j * Math.PI * 2)) * 0.18 * (1 - j);
      y = restY + bounce;
    }

    for (const die of active) {
      die.mesh.position.set(basePos.x + die.offsetX, y, basePos.z);
      if (kk < SETTLE) {
        const t = kk;
        die.mesh.rotation.set(die.spin.x * t, die.spin.y * t, die.spin.z * t);
        die.settleFrom = null;
      } else {
        if (!die.settleFrom) die.settleFrom = die.mesh.quaternion.clone();
        const j = Math.min(1, (kk - SETTLE) / (1 - SETTLE) * 1.6);
        const e = 1 - (1 - j) ** 3;
        die.mesh.quaternion.slerpQuaternions(die.settleFrom, die.target, e);
      }
    }

    if (totalSprite) {
      const show = kk < 0.72 ? 0 : Math.min(1, (kk - 0.72) / 0.15);
      totalSprite.material.opacity = show;
      totalSprite.position.set(basePos.x, y + 0.75 + show * 0.25, basePos.z);
    }
  }

  function endInternal() {
    for (const mesh of pool) mesh.visible = false;
    if (totalSprite) {
      disposeSprite(totalSprite);
      totalSprite = null;
    }
    active = [];
    rolling = false;
    group.visible = false;
  }

  /** Hide the dice (call when the choreography step ends). */
  function end() {
    endInternal();
  }

  function dispose() {
    endInternal();
    group.parent?.remove(group);
    group.clear();
  }

  return { group, begin, setProgress, end, dispose, get rolling() { return rolling; } };
}

export default createDiceView;
