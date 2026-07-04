/**
 * Cosmetics for the monkey characters (package P6): a procedural catalog
 * (hats / glasses / accessories / skins, unlocked with golden bananas) and
 * applyCosmetics(monkey, loadout) which attaches low-poly props to the
 * monkey's parts and re-tints fur for skins.
 *
 * All attachments are built from plain primitives and named
 * 'cosmetic:<slot>' so re-applying a loadout swaps them cleanly. Skins
 * REPLACE fur mesh materials (never mutate them - fur materials may come
 * from the shared engine cache); the original material is stashed in
 * mesh.userData.baseMaterial and restored when the skin comes off.
 *
 * The engine material cache (src/engine/materials.js) is loaded with a
 * guarded dynamic import; a plain-THREE fallback covers its absence.
 */

import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/* Guarded engine materials                                            */
/* ------------------------------------------------------------------ */

const ENGINE_MATERIALS_PATH = '../engine/materials.js';
let engineMaterials = null;
try {
  engineMaterials = await import(/* @vite-ignore */ ENGINE_MATERIALS_PATH);
} catch {
  engineMaterials = null;
}

const fallbackMats = new Map();

function cmat(color, opts = {}) {
  try {
    if (typeof engineMaterials?.mat === 'function') return engineMaterials.mat(color, opts);
  } catch { /* fall through */ }
  const key = JSON.stringify([color, opts]);
  let material = fallbackMats.get(key);
  if (!material) {
    material = new THREE.MeshStandardMaterial({
      color,
      flatShading: opts.flat ?? true,
      metalness: opts.metal ?? 0,
      roughness: opts.rough ?? 0.85,
      transparent: opts.transparent ?? false,
      opacity: opts.opacity ?? 1,
    });
    if (opts.emissive != null) {
      material.emissive = new THREE.Color(opts.emissive);
      material.emissiveIntensity = opts.emissiveIntensity ?? 1;
    }
    fallbackMats.set(key, material);
  }
  return material;
}

function mesh(geo, color, opts) {
  const m = new THREE.Mesh(geo, cmat(color, opts));
  m.castShadow = true;
  return m;
}

/* ------------------------------------------------------------------ */
/* Catalog                                                             */
/* ------------------------------------------------------------------ */

/**
 * Cosmetic catalog. slot: 'hat' | 'glasses' | 'accessory' | 'skin'.
 * unlock.bananas = golden-banana cost (0 = free starter cosmetic).
 *
 * @type {{id: string, slot: string, name: {en: string, de: string},
 *   unlock: {bananas: number}}[]}
 */
export const COSMETICS = [
  { id: 'cap', slot: 'hat', name: { en: 'Banana Cap', de: 'Bananen-Kappe' }, unlock: { bananas: 0 } },
  { id: 'flower', slot: 'hat', name: { en: 'Jungle Flower', de: 'Dschungelblume' }, unlock: { bananas: 5 } },
  { id: 'pirate_hat', slot: 'hat', name: { en: 'Pirate Hat', de: 'Piratenhut' }, unlock: { bananas: 10 } },
  { id: 'party_hat', slot: 'hat', name: { en: 'Party Hat', de: 'Partyhut' }, unlock: { bananas: 15 } },
  { id: 'crown', slot: 'hat', name: { en: 'Royal Crown', de: 'Königskrone' }, unlock: { bananas: 50 } },

  { id: 'sunglasses', slot: 'glasses', name: { en: 'Sunglasses', de: 'Sonnenbrille' }, unlock: { bananas: 5 } },
  { id: 'heart_glasses', slot: 'glasses', name: { en: 'Heart Glasses', de: 'Herzbrille' }, unlock: { bananas: 15 } },
  { id: 'monocle', slot: 'glasses', name: { en: 'Monocle', de: 'Monokel' }, unlock: { bananas: 25 } },

  { id: 'bowtie', slot: 'accessory', name: { en: 'Bow Tie', de: 'Fliege' }, unlock: { bananas: 5 } },
  { id: 'scarf', slot: 'accessory', name: { en: 'Cozy Scarf', de: 'Kuschelschal' }, unlock: { bananas: 10 } },
  { id: 'backpack', slot: 'accessory', name: { en: 'Explorer Backpack', de: 'Forscher-Rucksack' }, unlock: { bananas: 20 } },
  { id: 'cape', slot: 'accessory', name: { en: 'Hero Cape', de: 'Heldenumhang' }, unlock: { bananas: 30 } },

  { id: 'ghost_skin', slot: 'skin', name: { en: 'Ghost Skin', de: 'Geisterhaut' }, unlock: { bananas: 40 } },
  { id: 'neon_skin', slot: 'skin', name: { en: 'Neon Skin', de: 'Neonhaut' }, unlock: { bananas: 60 } },
  { id: 'gold_skin', slot: 'skin', name: { en: 'Gold Skin', de: 'Goldhaut' }, unlock: { bananas: 75 } },
];

/**
 * @param {string} id
 * @returns {Object|null} Catalog entry, or null.
 */
export function getCosmetic(id) {
  return COSMETICS.find((c) => c.id === id) ?? null;
}

/**
 * @param {string} slot 'hat' | 'glasses' | 'accessory' | 'skin'
 * @returns {Object[]} Catalog entries of that slot, cheapest first.
 */
export function cosmeticsBySlot(slot) {
  return COSMETICS.filter((c) => c.slot === slot).sort((a, b) => a.unlock.bananas - b.unlock.bananas);
}

/* ------------------------------------------------------------------ */
/* Attachment builders (head/face/torso local space, headR ~0.3)       */
/* ------------------------------------------------------------------ */

const HAT_BUILDERS = {
  cap() {
    const grp = new THREE.Group();
    const dome = mesh(new THREE.SphereGeometry(0.24, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), '#e5b431');
    grp.add(dome);
    const brim = mesh(new THREE.BoxGeometry(0.26, 0.035, 0.2), '#c99312');
    brim.position.set(0, 0.02, 0.26);
    grp.add(brim);
    return grp;
  },
  flower() {
    const grp = new THREE.Group();
    const heart = mesh(new THREE.IcosahedronGeometry(0.07, 0), '#f7c948');
    heart.position.y = 0.1;
    grp.add(heart);
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2;
      const petal = mesh(new THREE.IcosahedronGeometry(0.075, 0), '#ff7eb6');
      petal.scale.set(1.25, 0.45, 1.25);
      petal.position.set(Math.cos(a) * 0.11, 0.1, Math.sin(a) * 0.11);
      grp.add(petal);
    }
    grp.position.x = 0.12; // tucked over one ear
    return grp;
  },
  pirate_hat() {
    const grp = new THREE.Group();
    const brim = mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.05, 8), '#23232b');
    grp.add(brim);
    const crown = mesh(new THREE.ConeGeometry(0.22, 0.22, 6), '#23232b');
    crown.position.y = 0.12;
    grp.add(crown);
    const band = mesh(new THREE.BoxGeometry(0.4, 0.045, 0.045), '#f7c948');
    band.position.set(0, 0.03, 0.3);
    grp.add(band);
    const skull = mesh(new THREE.IcosahedronGeometry(0.045, 0), '#f5f2ea');
    skull.position.set(0, 0.12, 0.2);
    grp.add(skull);
    return grp;
  },
  party_hat() {
    const grp = new THREE.Group();
    const cone = mesh(new THREE.ConeGeometry(0.16, 0.34, 7), '#3a7bd5');
    cone.position.y = 0.17;
    grp.add(cone);
    const pompom = mesh(new THREE.IcosahedronGeometry(0.055, 0), '#ffd23f');
    pompom.position.y = 0.36;
    grp.add(pompom);
    return grp;
  },
  crown() {
    const grp = new THREE.Group();
    const gold = { metal: 0.85, rough: 0.3 };
    const ring = mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.12, 8, 1, true), '#f7c948', gold);
    ring.material.side = THREE.DoubleSide;
    grp.add(ring);
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2;
      const spike = mesh(new THREE.ConeGeometry(0.05, 0.13, 4), '#f7c948', gold);
      spike.position.set(Math.cos(a) * 0.19, 0.12, Math.sin(a) * 0.19);
      grp.add(spike);
    }
    const jewel = mesh(new THREE.OctahedronGeometry(0.05, 0), '#e5484d', { emissive: '#7a1216' });
    jewel.position.set(0, 0.03, 0.21);
    grp.add(jewel);
    return grp;
  },
};

const GLASSES_BUILDERS = {
  sunglasses() {
    const grp = new THREE.Group();
    for (const side of [-1, 1]) {
      const lens = mesh(new THREE.BoxGeometry(0.14, 0.1, 0.04), '#17171c', { rough: 0.3 });
      lens.position.x = side * 0.09;
      grp.add(lens);
    }
    const bridge = mesh(new THREE.BoxGeometry(0.06, 0.03, 0.03), '#17171c');
    grp.add(bridge);
    return grp;
  },
  heart_glasses() {
    const grp = new THREE.Group();
    for (const side of [-1, 1]) {
      const lens = mesh(new THREE.IcosahedronGeometry(0.075, 0), '#ff5c8a', { rough: 0.4 });
      lens.scale.set(1.15, 1, 0.35);
      lens.rotation.z = side * 0.35;
      lens.position.x = side * 0.09;
      grp.add(lens);
    }
    const bridge = mesh(new THREE.BoxGeometry(0.05, 0.028, 0.028), '#ff5c8a');
    grp.add(bridge);
    return grp;
  },
  monocle() {
    const grp = new THREE.Group();
    const rim = mesh(new THREE.TorusGeometry(0.07, 0.014, 5, 10), '#f7c948', { metal: 0.8, rough: 0.35 });
    rim.position.x = 0.09;
    grp.add(rim);
    const chain = mesh(new THREE.BoxGeometry(0.012, 0.16, 0.012), '#f7c948', { metal: 0.8, rough: 0.35 });
    chain.position.set(0.15, -0.09, 0);
    chain.rotation.z = 0.35;
    grp.add(chain);
    return grp;
  },
};

const ACCESSORY_BUILDERS = {
  bowtie() {
    const grp = new THREE.Group();
    for (const side of [-1, 1]) {
      const wing = mesh(new THREE.ConeGeometry(0.06, 0.12, 4), '#e5484d');
      wing.rotation.z = side * (Math.PI / 2);
      wing.position.x = side * 0.07;
      grp.add(wing);
    }
    const knot = mesh(new THREE.IcosahedronGeometry(0.04, 0), '#c22e33');
    grp.add(knot);
    grp.position.set(0, 0.24, 0.28);
    return grp;
  },
  scarf() {
    const grp = new THREE.Group();
    const wrap = mesh(new THREE.TorusGeometry(0.21, 0.07, 5, 8), '#e5484d');
    wrap.rotation.x = Math.PI / 2;
    wrap.position.y = 0.3;
    grp.add(wrap);
    const tail = mesh(new THREE.BoxGeometry(0.1, 0.24, 0.045), '#c22e33');
    tail.position.set(0.1, 0.14, 0.24);
    tail.rotation.z = -0.15;
    grp.add(tail);
    return grp;
  },
  backpack() {
    const grp = new THREE.Group();
    const pack = mesh(new THREE.BoxGeometry(0.3, 0.36, 0.16), '#2e8b57');
    pack.position.set(0, 0.05, -0.36);
    grp.add(pack);
    const lid = mesh(new THREE.BoxGeometry(0.26, 0.1, 0.14), '#c99312');
    lid.position.set(0, 0.26, -0.35);
    grp.add(lid);
    for (const side of [-1, 1]) {
      const strap = mesh(new THREE.BoxGeometry(0.05, 0.04, 0.34), '#5b4632');
      strap.position.set(side * 0.12, 0.22, -0.16);
      grp.add(strap);
    }
    return grp;
  },
  cape() {
    const grp = new THREE.Group();
    const cloth = mesh(new THREE.BoxGeometry(0.5, 0.62, 0.03), '#c22e33');
    cloth.position.set(0, -0.12, -0.32);
    cloth.rotation.x = 0.14;
    grp.add(cloth);
    const clasp = mesh(new THREE.BoxGeometry(0.34, 0.05, 0.05), '#f7c948', { metal: 0.8, rough: 0.35 });
    clasp.position.set(0, 0.26, -0.24);
    grp.add(clasp);
    return grp;
  },
};

/** Skin material recipes applied to fur meshes. */
const SKIN_RECIPES = {
  gold_skin: { color: '#f7c948', opts: { metal: 0.85, rough: 0.28 } },
  neon_skin: { color: '#39ff88', opts: { emissive: '#0fae4d', emissiveIntensity: 0.8, rough: 0.5 } },
  ghost_skin: { color: '#bfe3ff', opts: { transparent: true, opacity: 0.55, rough: 0.4 } },
};

/* ------------------------------------------------------------------ */
/* Application                                                         */
/* ------------------------------------------------------------------ */

function removeAttachment(parent, name) {
  const existing = parent.getObjectByName(name);
  if (!existing) return;
  existing.traverse((obj) => obj.geometry?.dispose?.());
  existing.parent?.remove(existing);
}

function attach(parent, name, obj) {
  removeAttachment(parent, name);
  if (!obj) return;
  obj.name = name;
  parent.add(obj);
}

/**
 * Apply a cosmetic loadout to a factory monkey. Slots set to null (or
 * unknown ids) clear/skip that slot; the whole call is idempotent.
 *
 * @param {{group: *, parts: Object<string, *>}} monkey buildMonkey() result.
 * @param {{hat?: string|null, glasses?: string|null, accessory?: string|null,
 *   skin?: string|null}} [loadout]
 * @returns {{group: *, parts: Object<string, *>}} The same monkey (chaining).
 */
export function applyCosmetics(monkey, loadout = {}) {
  const { parts, group } = monkey;
  if (!parts || !group) return monkey;
  const { hat = null, glasses = null, accessory = null, skin = null } = loadout;

  /* hats sit on the head, above the skull */
  const hatObj = hat && HAT_BUILDERS[hat] ? HAT_BUILDERS[hat]() : null;
  if (hatObj) hatObj.position.y += 0.24;
  attach(parts.head, 'cosmetic:hat', hatObj);

  /* glasses sit on the face at eye height */
  const glassesObj = glasses && GLASSES_BUILDERS[glasses] ? GLASSES_BUILDERS[glasses]() : null;
  if (glassesObj) glassesObj.position.set(0, 0.045, 0.27);
  attach(parts.face, 'cosmetic:glasses', glassesObj);

  /* accessories hang off the torso */
  const accObj = accessory && ACCESSORY_BUILDERS[accessory] ? ACCESSORY_BUILDERS[accessory]() : null;
  attach(parts.torso, 'cosmetic:accessory', accObj);

  /* skins re-tint every fur-tagged mesh (replace, never mutate) */
  const recipe = skin ? SKIN_RECIPES[skin] : null;
  group.traverse((obj) => {
    if (!obj.isMesh || obj.userData.tintRole !== 'fur') return;
    if (recipe) {
      if (!obj.userData.baseMaterial) obj.userData.baseMaterial = obj.material;
      obj.material = cmat(recipe.color, recipe.opts);
    } else if (obj.userData.baseMaterial) {
      obj.material = obj.userData.baseMaterial;
      delete obj.userData.baseMaterial;
    }
  });

  return monkey;
}

export default COSMETICS;
