/**
 * Procedural low-poly monkey factory (package P6).
 *
 * buildMonkey(def, cosmetics) assembles a ~500-900 triangle monkey from
 * primitives, driven entirely by CharacterDef.build (scale, fur/face/belly
 * colors, ear/tail/snout/brow styles, armLen, potbelly) plus a handful of
 * species differentiators (gorilla bulk, gibbon arms, proboscis nose cone,
 * mandrill face stripes, howler throat sac).
 *
 * NO skeletons: every animatable part (root/torso/head/ears/arms/hands/
 * legs/tail/face) is its own Object3D, transform-animated by the animator
 * (src/characters/animator.js). Each part's rest transform is stored in
 * part.userData.basePos/baseRot/baseScale.
 *
 * The engine kit (src/engine/primitives.js + materials.js) is built in
 * parallel, so it is loaded with guarded dynamic imports; every helper has
 * a plain-THREE fallback and the factory works without the engine package.
 */

import * as THREE from 'three';
import { applyCosmetics } from './cosmetics.js';

/* ------------------------------------------------------------------ */
/* Guarded engine kit                                                  */
/* ------------------------------------------------------------------ */

const ENGINE_PRIMITIVES_PATH = '../engine/primitives.js';
const ENGINE_MATERIALS_PATH = '../engine/materials.js';

let enginePrimitives = null;
let engineMaterials = null;
try {
  enginePrimitives = await import(/* @vite-ignore */ ENGINE_PRIMITIVES_PATH);
} catch {
  enginePrimitives = null;
}
try {
  engineMaterials = await import(/* @vite-ignore */ ENGINE_MATERIALS_PATH);
} catch {
  engineMaterials = null;
}

/** Local material cache for the plain-THREE fallback path. */
const fallbackMats = new Map();

/**
 * Shared flat-shaded material (engine cache when present).
 * @param {string|number} color
 * @param {Object} [opts] mat() opts (metal, rough, emissive, ...).
 * @returns {THREE.MeshStandardMaterial}
 */
export function matFor(color, opts = {}) {
  try {
    if (typeof engineMaterials?.mat === 'function') return engineMaterials.mat(color, opts);
  } catch {
    /* fall through to the local cache */
  }
  const key = `${color}|${opts.metal ?? 0}|${opts.rough ?? 0.85}|${opts.emissive ?? '-'}`;
  let material = fallbackMats.get(key);
  if (!material) {
    material = new THREE.MeshStandardMaterial({
      color,
      flatShading: true,
      metalness: opts.metal ?? 0,
      roughness: opts.rough ?? 0.85,
    });
    if (opts.emissive != null) {
      material.emissive = new THREE.Color(opts.emissive);
      material.emissiveIntensity = opts.emissiveIntensity ?? 1;
    }
    fallbackMats.set(key, material);
  }
  return material;
}

function finishMesh(mesh, tintRole) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (tintRole) mesh.userData.tintRole = tintRole;
  return mesh;
}

function capsuleMesh(radius, length, color, tintRole) {
  try {
    if (typeof enginePrimitives?.capsule === 'function') {
      return finishMesh(enginePrimitives.capsule(radius, length, color), tintRole);
    }
  } catch { /* fallback below */ }
  const geo = new THREE.CapsuleGeometry(radius, length, 2, 6);
  return finishMesh(new THREE.Mesh(geo, matFor(color)), tintRole);
}

function sphereMesh(radius, color, tintRole, detail = 1) {
  try {
    if (typeof enginePrimitives?.sphereLow === 'function') {
      return finishMesh(enginePrimitives.sphereLow(radius, color, { detail }), tintRole);
    }
  } catch { /* fallback below */ }
  const geo = new THREE.IcosahedronGeometry(radius, detail);
  return finishMesh(new THREE.Mesh(geo, matFor(color)), tintRole);
}

function coneMesh(radius, height, color, tintRole) {
  try {
    if (typeof enginePrimitives?.cone === 'function') {
      return finishMesh(enginePrimitives.cone(radius, height, color), tintRole);
    }
  } catch { /* fallback below */ }
  const geo = new THREE.ConeGeometry(radius, height, 6, 1);
  return finishMesh(new THREE.Mesh(geo, matFor(color)), tintRole);
}

// Always a plain 12-tri box: the engine's roundedBox costs ~108 tris per
// box, which would blow the ~500-900 tri budget on muzzle/brow details.
function boxMesh(w, h, d, color, tintRole) {
  const geo = new THREE.BoxGeometry(w, h, d);
  return finishMesh(new THREE.Mesh(geo, matFor(color)), tintRole);
}

function tubeMesh(points, radius, color, tintRole) {
  try {
    if (typeof enginePrimitives?.tube === 'function') {
      return finishMesh(enginePrimitives.tube(points, radius, color, { tubularSegments: 8, radialSegments: 5 }), tintRole);
    }
  } catch { /* fallback below */ }
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
  const geo = new THREE.TubeGeometry(curve, 8, radius, 5, false);
  return finishMesh(new THREE.Mesh(geo, matFor(color)), tintRole);
}

/* ------------------------------------------------------------------ */
/* Body pieces                                                         */
/* ------------------------------------------------------------------ */

function buildEars(build, headR) {
  const { earStyle, furColor, faceColor } = build;
  const make = () => {
    const ear = new THREE.Group();
    switch (earStyle) {
      case 'big': {
        const m = sphereMesh(headR * 0.42, furColor, 'fur', 0);
        m.scale.z = 0.35;
        ear.add(m);
        const inner = sphereMesh(headR * 0.24, faceColor, 'face', 0);
        inner.scale.z = 0.3;
        inner.position.z = headR * 0.06;
        ear.add(inner);
        break;
      }
      case 'small': {
        const m = sphereMesh(headR * 0.22, furColor, 'fur', 0);
        m.scale.z = 0.5;
        ear.add(m);
        break;
      }
      case 'tufted': {
        const m = sphereMesh(headR * 0.26, furColor, 'fur', 0);
        m.scale.z = 0.5;
        ear.add(m);
        const tuft = coneMesh(headR * 0.18, headR * 0.5, '#f5f2ea', 'fur');
        tuft.rotation.z = Math.PI / 2.4;
        tuft.position.set(headR * 0.12, headR * 0.1, 0);
        ear.add(tuft);
        break;
      }
      case 'pointy': {
        const m = coneMesh(headR * 0.26, headR * 0.6, furColor, 'fur');
        ear.add(m);
        break;
      }
      case 'round':
      default: {
        const m = sphereMesh(headR * 0.32, furColor, 'fur', 0);
        m.scale.z = 0.4;
        ear.add(m);
        const inner = sphereMesh(headR * 0.18, faceColor, 'face', 0);
        inner.scale.z = 0.35;
        inner.position.z = headR * 0.05;
        ear.add(inner);
        break;
      }
    }
    return ear;
  };
  const earL = make();
  const earR = make();
  return { earL, earR };
}

function buildSnout(build, headR) {
  const { snout, faceColor } = build;
  const grp = new THREE.Group();
  switch (snout) {
    case 'long': { // baboon / mandrill muzzle
      const muzzle = boxMesh(headR * 0.62, headR * 0.5, headR * 0.8, faceColor, 'face');
      muzzle.position.set(0, -headR * 0.18, headR * 0.42);
      grp.add(muzzle);
      const nose = boxMesh(headR * 0.3, headR * 0.18, headR * 0.12, '#2e2028');
      nose.position.set(0, -headR * 0.06, headR * 0.85);
      grp.add(nose);
      break;
    }
    case 'wide': {
      const muzzle = sphereMesh(headR * 0.42, faceColor, 'face', 0);
      muzzle.scale.set(1.5, 0.8, 0.9);
      muzzle.position.set(0, -headR * 0.22, headR * 0.55);
      grp.add(muzzle);
      break;
    }
    case 'flat': {
      const muzzle = sphereMesh(headR * 0.34, faceColor, 'face', 0);
      muzzle.scale.set(1.3, 0.9, 0.35);
      muzzle.position.set(0, -headR * 0.2, headR * 0.72);
      grp.add(muzzle);
      break;
    }
    case 'cone': { // proboscis nose cone
      const nose = coneMesh(headR * 0.3, headR * 1.05, '#d97b52');
      nose.rotation.x = Math.PI * 0.62;
      nose.position.set(0, -headR * 0.12, headR * 0.78);
      grp.add(nose);
      break;
    }
    case 'short':
    default: {
      const muzzle = sphereMesh(headR * 0.32, faceColor, 'face', 0);
      muzzle.scale.set(1.1, 0.75, 0.7);
      muzzle.position.set(0, -headR * 0.24, headR * 0.6);
      grp.add(muzzle);
      break;
    }
  }
  return grp;
}

function buildBrow(build, headR) {
  const { brow, furColor } = build;
  const grp = new THREE.Group();
  if (brow === 'soft') return grp; // no visible ridge
  if (brow === 'arched') {
    for (const side of [-1, 1]) {
      const b = boxMesh(headR * 0.34, headR * 0.1, headR * 0.12, furColor, 'fur');
      b.position.set(side * headR * 0.28, headR * 0.34, headR * 0.62);
      b.rotation.z = side * -0.35;
      grp.add(b);
    }
    return grp;
  }
  const thick = brow === 'heavy' ? headR * 0.22 : headR * 0.1;
  const ridge = boxMesh(headR * 1.0, thick, headR * 0.24, furColor, 'fur');
  ridge.position.set(0, headR * 0.34, headR * 0.55);
  grp.add(ridge);
  return grp;
}

function buildTail(build) {
  const { tail, furColor } = build;
  const grp = new THREE.Group();
  grp.name = 'tail';
  switch (tail) {
    case 'none':
      break; // empty pivot keeps animator tracks harmless
    case 'short': {
      const stub = coneMesh(0.09, 0.28, furColor, 'fur');
      stub.rotation.x = -Math.PI / 2.4;
      stub.position.set(0, 0.03, -0.14);
      grp.add(stub);
      break;
    }
    case 'thick': {
      const m = tubeMesh([[0, 0, 0], [0, 0.12, -0.3], [0, 0.42, -0.42], [0, 0.7, -0.32]], 0.09, furColor, 'fur');
      grp.add(m);
      break;
    }
    case 'curl': {
      const m = tubeMesh(
        [[0, 0, 0], [0, 0.1, -0.32], [0, 0.45, -0.5], [0, 0.75, -0.3], [0, 0.72, -0.05]],
        0.055,
        furColor,
        'fur',
      );
      grp.add(m);
      break;
    }
    case 'long':
    default: {
      const m = tubeMesh([[0, 0, 0], [0, 0.08, -0.35], [0, 0.4, -0.55], [0, 0.85, -0.5]], 0.055, furColor, 'fur');
      grp.add(m);
      break;
    }
  }
  return grp;
}

/* ------------------------------------------------------------------ */
/* Static poses                                                        */
/* ------------------------------------------------------------------ */

/**
 * Named static poses: per-part additive offsets over the rest transform.
 * pos = added to basePos, rot = added to baseRot (radians).
 */
const POSES = {
  idle: {},
  walk: {
    armL: { rot: [0.5, 0, 0] },
    armR: { rot: [-0.5, 0, 0] },
    legL: { rot: [-0.5, 0, 0] },
    legR: { rot: [0.5, 0, 0] },
  },
  victory: {
    root: { pos: [0, 0.06, 0] },
    armL: { rot: [0, 0, 2.6] },
    armR: { rot: [0, 0, -2.6] },
    head: { rot: [-0.25, 0, 0] },
    tail: { rot: [0.4, 0, 0] },
  },
  lose: {
    root: { pos: [0, -0.06, 0] },
    torso: { rot: [0.35, 0, 0] },
    head: { rot: [0.5, 0, 0] },
    armL: { rot: [0, 0, 0.25] },
    armR: { rot: [0, 0, -0.25] },
    tail: { rot: [-0.5, 0, 0] },
  },
  cheer: {
    armL: { rot: [-2.6, 0, -0.3] },
    armR: { rot: [-2.6, 0, 0.3] },
    head: { rot: [-0.2, 0, 0] },
  },
  sad: {
    torso: { rot: [0.25, 0, 0] },
    head: { rot: [0.45, 0, 0] },
    armL: { rot: [0, 0, 0.2] },
    armR: { rot: [0, 0, -0.2] },
  },
  sit: {
    root: { pos: [0, -0.28, 0] },
    legL: { rot: [-1.4, 0.3, 0] },
    legR: { rot: [-1.4, -0.3, 0] },
    armL: { rot: [0.3, 0, 0.2] },
    armR: { rot: [0.3, 0, -0.2] },
  },
};

/* ------------------------------------------------------------------ */
/* Factory                                                             */
/* ------------------------------------------------------------------ */

/**
 * Build a monkey from a CharacterDef.
 *
 * @param {import('#shared/types.js').CharacterDef} def
 * @param {{hat?: string|null, glasses?: string|null, accessory?: string|null,
 *   skin?: string|null}} [cosmetics] Optional cosmetic loadout (see cosmetics.js).
 * @returns {{
 *   group: THREE.Group,
 *   parts: {root: THREE.Object3D, torso: THREE.Object3D, head: THREE.Object3D,
 *     earL: THREE.Object3D, earR: THREE.Object3D, armL: THREE.Object3D,
 *     armR: THREE.Object3D, handL: THREE.Object3D, handR: THREE.Object3D,
 *     legL: THREE.Object3D, legR: THREE.Object3D, tail: THREE.Object3D,
 *     face: THREE.Object3D},
 *   setPose: (name: string) => void,
 * }}
 */
export function buildMonkey(def, cosmetics = null) {
  const build = def?.build ?? {};
  const species = def?.species ?? '';
  const scale = Math.min(1.6, Math.max(0.8, Number(build.scale) || 1));
  const furColor = build.furColor ?? '#8a5a33';
  const faceColor = build.faceColor ?? '#f0d9b5';
  const bellyColor = build.bellyColor ?? '#e8c9a0';
  const armLen = Math.min(1.6, Math.max(0.8, Number(build.armLen) || 1));
  const potbelly = Math.min(1, Math.max(0, Number(build.potbelly) || 0));

  const isGorilla = species === 'gorilla';
  const bulk = isGorilla ? 1.3 : 1;

  const group = new THREE.Group();
  group.name = `monkey:${def?.id ?? 'unknown'}`;
  group.userData.characterId = def?.id ?? '';

  const root = new THREE.Group();
  root.name = 'root';
  group.add(root);

  /* ---- torso ----------------------------------------------------- */
  const torso = new THREE.Group();
  torso.name = 'torso';
  torso.position.y = 0.72;
  root.add(torso);

  const torsoR = 0.3 * bulk * (1 + potbelly * 0.18);
  const chest = capsuleMesh(torsoR, 0.36, furColor, 'fur');
  chest.scale.z = 0.85 + potbelly * 0.3;
  torso.add(chest);

  const belly = sphereMesh(torsoR * (0.72 + potbelly * 0.35), bellyColor, 'belly', 1);
  belly.scale.set(0.8, 0.95, 0.62);
  belly.position.set(0, -0.08, torsoR * 0.62);
  torso.add(belly);

  if (species === 'howler') {
    // Howler throat sac, resting on the chest below the chin.
    const throat = sphereMesh(0.17, bellyColor, 'belly', 0);
    throat.scale.set(1, 0.85, 0.85);
    throat.position.set(0, 0.3, torsoR * 0.7);
    torso.add(throat);
  }

  /* ---- head ------------------------------------------------------ */
  const headR = 0.28 * (isGorilla ? 1.1 : 1);
  const head = new THREE.Group();
  head.name = 'head';
  head.position.y = 0.36 + headR * (isGorilla ? 0.55 : 0.85); // gorillas sit low-necked
  torso.add(head);

  const skull = sphereMesh(headR, furColor, 'fur', 1);
  head.add(skull);

  const face = new THREE.Group();
  face.name = 'face';
  head.add(face);

  const facePlate = sphereMesh(headR * 0.78, faceColor, 'face', 0);
  facePlate.scale.set(0.95, 1, 0.45);
  facePlate.position.z = headR * 0.55;
  face.add(facePlate);

  for (const side of [-1, 1]) {
    const eye = sphereMesh(headR * 0.11, '#1c1c22', null, 0);
    eye.position.set(side * headR * 0.3, headR * 0.14, headR * 0.85);
    face.add(eye);
  }

  face.add(buildSnout({ ...build, faceColor }, headR));
  face.add(buildBrow({ ...build, furColor }, headR));

  if (species === 'mandrill') {
    // Mandrill muzzle flanks: ribbed blue stripes on both sides of the nose.
    for (const side of [-1, 1]) {
      const stripe = boxMesh(headR * 0.16, headR * 0.42, headR * 0.5, '#3a6ed8', null);
      stripe.position.set(side * headR * 0.42, -headR * 0.18, headR * 0.6);
      stripe.rotation.y = side * 0.35;
      face.add(stripe);
    }
  }

  const { earL, earR } = buildEars({ ...build, furColor, faceColor }, headR);
  earL.name = 'earL';
  earR.name = 'earR';
  const earY = build.earStyle === 'pointy' || build.earStyle === 'tufted' ? headR * 0.62 : headR * 0.25;
  earL.position.set(-headR * 0.92, earY, 0);
  earR.position.set(headR * 0.92, earY, 0);
  earR.scale.x = -1; // mirror the tuft/inner detail
  head.add(earL, earR);

  /* ---- arms ------------------------------------------------------ */
  const armLength = 0.5 * armLen;
  const armR3 = 0.085 * bulk * (isGorilla ? 1.25 : 1);
  const makeArm = (side, name) => {
    const arm = new THREE.Group();
    arm.name = name;
    arm.position.set(side * (torsoR + armR3 * 0.5), 0.22, 0);
    const limb = capsuleMesh(armR3, armLength, furColor, 'fur');
    limb.position.y = -armLength / 2;
    arm.add(limb);
    const hand = new THREE.Group();
    hand.name = `hand${name.slice(-1)}`;
    hand.position.y = -armLength - armR3 * 0.4;
    const palm = sphereMesh(armR3 * 1.5, faceColor, 'face', 0);
    hand.add(palm);
    arm.add(hand);
    return { arm, hand };
  };
  const { arm: armL, hand: handL } = makeArm(-1, 'armL');
  const { arm: armR, hand: handR } = makeArm(1, 'armR');
  torso.add(armL, armR);

  /* ---- legs ------------------------------------------------------ */
  const legLength = isGorilla ? 0.3 : 0.38;
  const legR3 = 0.1 * bulk;
  const makeLeg = (side, name) => {
    const leg = new THREE.Group();
    leg.name = name;
    leg.position.set(side * torsoR * 0.55, 0.46, 0);
    const limb = capsuleMesh(legR3, legLength, furColor, 'fur');
    limb.position.y = -legLength / 2;
    leg.add(limb);
    const foot = sphereMesh(legR3 * 1.3, faceColor, 'face', 0);
    foot.scale.set(1, 0.6, 1.4);
    foot.position.set(0, -legLength - legR3 * 0.35, legR3 * 0.4);
    leg.add(foot);
    return leg;
  };
  const legL = makeLeg(-1, 'legL');
  const legR = makeLeg(1, 'legR');
  root.add(legL, legR);

  /* ---- tail ------------------------------------------------------ */
  const tail = buildTail({ ...build, furColor });
  tail.position.set(0, 0.52, -torsoR * 0.85);
  root.add(tail);

  group.scale.setScalar(scale);

  const parts = {
    root, torso, head, earL, earR, armL, armR, handL, handR, legL, legR, tail, face,
  };

  /* Rest transforms: the animator/poses offset from these. */
  for (const part of Object.values(parts)) {
    part.userData.basePos = part.position.clone();
    part.userData.baseRot = part.rotation.clone();
    part.userData.baseScale = part.scale.clone();
  }

  /**
   * Snap the monkey into a named static pose ('idle' resets). Unknown
   * names reset to idle. Poses and animator playback both work from the
   * stored rest transforms, so they never accumulate.
   * @param {string} name
   */
  function setPose(name) {
    const pose = POSES[name] ?? POSES.idle;
    for (const [partName, part] of Object.entries(parts)) {
      part.position.copy(part.userData.basePos);
      part.rotation.copy(part.userData.baseRot);
      part.scale.copy(part.userData.baseScale);
      const offsets = pose[partName];
      if (!offsets) continue;
      if (offsets.pos) {
        part.position.x += offsets.pos[0];
        part.position.y += offsets.pos[1];
        part.position.z += offsets.pos[2];
      }
      if (offsets.rot) {
        part.rotation.x += offsets.rot[0];
        part.rotation.y += offsets.rot[1];
        part.rotation.z += offsets.rot[2];
      }
    }
  }

  const monkey = { group, parts, setPose };
  if (cosmetics) applyCosmetics(monkey, cosmetics);
  return monkey;
}

export default buildMonkey;
