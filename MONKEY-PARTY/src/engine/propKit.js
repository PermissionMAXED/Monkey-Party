/**
 * Parameterized low-poly prop builders for MONKEY-PARTY boards + minigames.
 *
 * Every builder returns a THREE.Object3D (a Group) and accepts a single
 * options object: { seedRng, palette, scale, ...builderFlags }.
 *   - seedRng: shared/rng.js-style rng ({ next, int, pick }); defaults to a
 *     deterministic local rng so unseeded props still look consistent.
 *   - palette: { primary, secondary, accent } board colors (CSS strings).
 *   - scale: uniform scale multiplier (default 1).
 *
 * Animated props (makeTorch flame/light flicker, makeGoldenBanana spin, and
 * makeGear when { spinning: true }) expose obj.userData.update(dt); call it
 * each frame, e.g. engine.onFrame((dt) => obj.userData.update(dt)).
 */

import * as THREE from 'three';
import { createRng } from '#shared/rng.js';
import { mat } from './materials.js';
import { capsule, roundedBox, cone, sphereLow, tube } from './primitives.js';

const DEFAULT_PALETTE = {
  primary: '#4caf50',
  secondary: '#8d6e63',
  accent: '#ffc107',
};

const COLORS = {
  wood: '#7a5230',
  woodDark: '#5a3d24',
  stone: '#8f9a96',
  stoneDark: '#6d7672',
  gold: '#ffd54f',
  banana: '#ffe135',
  bananaTip: '#7a6019',
  rope: '#c9a86a',
  flame: '#ff9231',
  flameCore: '#ffe08a',
  ice: '#bfe9ff',
  tentacle: '#7e57c2',
  tentacleSucker: '#d1b3ff',
  mushroomStem: '#f0e2c8',
  thatch: '#c8a04b',
};

/** Normalize options and provide rng/palette/scale defaults. */
function setup(opts = {}) {
  const rng = opts.seedRng ?? createRng(0xb4a4a);
  const palette = { ...DEFAULT_PALETTE, ...(opts.palette ?? {}) };
  const scale = opts.scale ?? 1;
  const r = (a, b) => a + rng.next() * (b - a);
  return { rng, palette, scale, r };
}

/** Name + scale a finished group. */
function finish(group, name, scale) {
  group.name = name;
  if (scale !== 1) group.scale.multiplyScalar(scale);
  return group;
}

/* ------------------------------------------------------------------ */
/* Vegetation                                                          */
/* ------------------------------------------------------------------ */

/** Palm tree: bent trunk, frond crown, coconuts. */
export function makePalm(opts = {}) {
  const { palette, scale, r, rng } = setup(opts);
  const g = new THREE.Group();

  const height = r(2.6, 3.6);
  const leanX = r(-0.5, 0.5);
  const leanZ = r(-0.5, 0.5);
  const trunk = tube(
    [[0, 0, 0], [leanX * 0.4, height * 0.5, leanZ * 0.4], [leanX, height, leanZ]],
    0.16,
    COLORS.wood,
    { tubularSegments: 6, radialSegments: 5 },
  );
  g.add(trunk);

  const crown = new THREE.Group();
  crown.position.set(leanX, height, leanZ);
  const fronds = rng.int(5, 7);
  for (let i = 0; i < fronds; i += 1) {
    const frond = cone(0.5, r(1.8, 2.4), palette.primary, { segments: 4 });
    frond.scale.set(1, 0.16, 0.34);
    const angle = (i / fronds) * Math.PI * 2 + r(-0.2, 0.2);
    frond.position.set(Math.cos(angle) * 0.75, r(0.05, 0.25), Math.sin(angle) * 0.75);
    // Point the cone outward from the crown, drooping down slightly.
    frond.rotation.set(0, -angle + Math.PI / 2, r(0.9, 1.25));
    crown.add(frond);
  }
  for (let i = 0, n = rng.int(2, 3); i < n; i += 1) {
    const nut = sphereLow(0.14, COLORS.woodDark, { detail: 0 });
    nut.position.set(r(-0.22, 0.22), -0.1, r(-0.22, 0.22));
    crown.add(nut);
  }
  g.add(crown);
  return finish(g, 'palm', scale);
}

/** Jagged rock (jittered icosphere) with an optional small companion. */
export function makeRock(opts = {}) {
  const { scale, r, rng } = setup(opts);
  const g = new THREE.Group();

  function lump(radius) {
    const geo = new THREE.IcosahedronGeometry(radius, 1);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i += 1) {
      const k = 1 + (rng.next() - 0.5) * 0.45;
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * Math.max(0.4, k) * 0.8, p.getZ(i) * k);
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat(COLORS.stone));
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  }

  const main = lump(r(0.55, 0.85));
  g.add(main);
  if (rng.next() < 0.7) {
    const side = lump(r(0.25, 0.4));
    side.position.set(r(0.5, 0.8), -0.1, r(-0.4, 0.4));
    g.add(side);
  }
  return finish(g, 'rock', scale);
}

/** Leafy bush: clustered icospheres + accent berries. */
export function makeBush(opts = {}) {
  const { palette, scale, r, rng } = setup(opts);
  const g = new THREE.Group();
  const base = new THREE.Color(palette.primary);
  const blobs = rng.int(3, 5);
  for (let i = 0; i < blobs; i += 1) {
    const c = base.clone().offsetHSL(0, 0, r(-0.06, 0.08));
    const blob = sphereLow(r(0.3, 0.55), `#${c.getHexString()}`, { detail: 0 });
    blob.position.set(r(-0.4, 0.4), r(0.15, 0.45), r(-0.4, 0.4));
    g.add(blob);
  }
  for (let i = 0, n = rng.int(2, 4); i < n; i += 1) {
    const berry = sphereLow(0.07, palette.accent, { detail: 0, rough: 0.4 });
    berry.position.set(r(-0.5, 0.5), r(0.3, 0.6), r(-0.5, 0.5));
    g.add(berry);
  }
  return finish(g, 'bush', scale);
}

/** Hanging vine: wavy tube with small leaves. */
export function makeVine(opts = {}) {
  const { palette, scale, r, rng } = setup(opts);
  const g = new THREE.Group();

  const len = r(2.2, 3.2);
  const pts = [];
  const segs = 5;
  for (let i = 0; i <= segs; i += 1) {
    const t = i / segs;
    pts.push([Math.sin(t * Math.PI * 2 + r(0, 0.4)) * 0.22, -t * len, Math.cos(t * Math.PI * 1.5) * 0.18]);
  }
  const stem = tube(pts, 0.045, palette.primary, { tubularSegments: 10, radialSegments: 4 });
  g.add(stem);

  const leafColor = new THREE.Color(palette.primary).offsetHSL(0.02, 0.05, 0.06);
  for (let i = 0, n = rng.int(4, 6); i < n; i += 1) {
    const t = (i + 0.5) / n;
    const leaf = cone(0.16, 0.4, `#${leafColor.getHexString()}`, { segments: 4 });
    leaf.scale.set(1, 0.3, 0.5);
    leaf.position.set(Math.sin(t * Math.PI * 2) * 0.22 + r(-0.1, 0.1), -t * len, r(-0.15, 0.15));
    leaf.rotation.set(r(-0.4, 0.4), r(0, Math.PI * 2), Math.PI / 2);
    g.add(leaf);
  }
  return finish(g, 'vine', scale);
}

/** Toadstool: stem + squashed cap with dots. */
export function makeMushroom(opts = {}) {
  const { palette, scale, r, rng } = setup(opts);
  const g = new THREE.Group();

  const stemH = r(0.35, 0.55);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, stemH, 6), mat(COLORS.mushroomStem));
  stem.castShadow = stem.receiveShadow = true;
  stem.position.y = stemH / 2;
  g.add(stem);

  const cap = sphereLow(r(0.3, 0.42), palette.accent, { detail: 1, rough: 0.6 });
  cap.scale.y = 0.62;
  cap.position.y = stemH + 0.05;
  g.add(cap);

  for (let i = 0, n = rng.int(3, 5); i < n; i += 1) {
    const dot = sphereLow(0.05, '#fff7e6', { detail: 0 });
    const a = r(0, Math.PI * 2);
    const rad = r(0.12, 0.3);
    dot.position.set(Math.cos(a) * rad, stemH + 0.05 + r(0.1, 0.2), Math.sin(a) * rad);
    g.add(dot);
  }
  return finish(g, 'mushroom', scale);
}

/* ------------------------------------------------------------------ */
/* Structures                                                          */
/* ------------------------------------------------------------------ */

/** Wooden crate with corner slats. */
export function makeCrate(opts = {}) {
  const { scale, r } = setup(opts);
  const g = new THREE.Group();
  const s = r(0.85, 1.05);

  const body = roundedBox(s, s, s, 0.05, COLORS.wood);
  body.position.y = s / 2;
  g.add(body);

  const slat = () => roundedBox(s * 1.04, s * 0.12, s * 1.04, 0.02, COLORS.woodDark);
  const top = slat();
  top.position.y = s * 0.9;
  const bottom = slat();
  bottom.position.y = s * 0.1;
  const cross = roundedBox(s * 0.14, s * 0.8, s * 1.05, 0.02, COLORS.woodDark);
  cross.position.y = s / 2;
  g.add(top, bottom, cross);
  return finish(g, 'crate', scale);
}

/** Stepping-stone platform: stone base + grass top. */
export function makePlatform(opts = {}) {
  const { palette, scale, r } = setup(opts);
  const g = new THREE.Group();
  const radius = opts.radius ?? r(1.1, 1.4);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.15, 0.5, 8), mat(COLORS.stone));
  base.castShadow = base.receiveShadow = true;
  base.position.y = 0.25;
  g.add(base);

  const top = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.02, radius * 1.02, 0.1, 8), mat(palette.primary));
  top.castShadow = top.receiveShadow = true;
  top.position.y = 0.55;
  g.add(top);
  return finish(g, 'platform', scale);
}

/** Rope bridge: planks + sagging side ropes + posts. */
export function makeBridge(opts = {}) {
  const { scale, r, rng } = setup(opts);
  const g = new THREE.Group();
  const length = opts.length ?? 4;
  const planks = Math.max(4, Math.round(length / 0.55));

  for (let i = 0; i < planks; i += 1) {
    const z = (i / (planks - 1) - 0.5) * length;
    const plank = roundedBox(1.1, 0.07, 0.34, 0.02, COLORS.wood);
    plank.position.set(r(-0.03, 0.03), Math.sin((i / (planks - 1)) * Math.PI) * -0.12, z);
    plank.rotation.y = r(-0.06, 0.06);
    g.add(plank);
  }

  for (const side of [-1, 1]) {
    const rope = tube(
      [[side * 0.62, 0.45, -length / 2], [side * 0.62, 0.18, 0], [side * 0.62, 0.45, length / 2]],
      0.035,
      COLORS.rope,
      { tubularSegments: 10, radialSegments: 4 },
    );
    g.add(rope);
    for (const end of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.6, 5), mat(COLORS.woodDark));
      post.castShadow = post.receiveShadow = true;
      post.position.set(side * 0.62, 0.22, end * (length / 2));
      post.rotation.z = rng.next() * 0.08 - 0.04;
      g.add(post);
    }
  }
  return finish(g, 'bridge', scale);
}

/** Jungle hut: round wall, thatch cone roof, door. */
export function makeHut(opts = {}) {
  const { palette, scale, r } = setup(opts);
  const g = new THREE.Group();

  const wallH = r(1.1, 1.4);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.15, wallH, 8), mat(palette.secondary));
  wall.castShadow = wall.receiveShadow = true;
  wall.position.y = wallH / 2;
  g.add(wall);

  const roof = cone(1.65, r(1.0, 1.3), COLORS.thatch, { segments: 8 });
  roof.position.y = wallH + 0.5;
  g.add(roof);

  const brim = new THREE.Mesh(new THREE.CylinderGeometry(1.66, 1.72, 0.1, 8), mat(COLORS.thatch));
  brim.castShadow = brim.receiveShadow = true;
  brim.position.y = wallH + 0.02;
  g.add(brim);

  const door = roundedBox(0.5, 0.75, 0.12, 0.05, COLORS.woodDark);
  door.position.set(0, 0.38, 1.1);
  g.add(door);
  return finish(g, 'hut', scale);
}

/** Ancient monkey statue: stone base + simian figure. */
export function makeStatue(opts = {}) {
  const { scale, r } = setup(opts);
  const g = new THREE.Group();

  const base = roundedBox(1.3, 0.4, 1.3, 0.06, COLORS.stoneDark);
  base.position.y = 0.2;
  g.add(base);

  const torso = capsule(0.42, 0.5, COLORS.stone);
  torso.position.y = 1.0;
  g.add(torso);

  const head = sphereLow(0.34, COLORS.stone, { detail: 1 });
  head.position.y = 1.72;
  g.add(head);

  const muzzle = sphereLow(0.18, COLORS.stoneDark, { detail: 0 });
  muzzle.position.set(0, 1.64, 0.26);
  g.add(muzzle);

  for (const side of [-1, 1]) {
    const ear = sphereLow(0.12, COLORS.stone, { detail: 0 });
    ear.position.set(side * 0.34, 1.8, 0);
    g.add(ear);

    const arm = capsule(0.13, r(0.5, 0.65), COLORS.stone);
    arm.position.set(side * 0.5, 0.95, 0.08);
    arm.rotation.z = side * 0.5;
    g.add(arm);
  }
  return finish(g, 'statue', scale);
}

/** Treasure chest: wooden box, domed lid, gold latch. */
export function makeChest(opts = {}) {
  const { scale, r } = setup(opts);
  const g = new THREE.Group();
  const w = r(0.9, 1.1);

  const base = roundedBox(w, 0.5, 0.65, 0.05, COLORS.wood);
  base.position.y = 0.25;
  g.add(base);

  const lidGeo = new THREE.CylinderGeometry(0.33, 0.33, w, 8, 1, false, 0, Math.PI);
  const lid = new THREE.Mesh(lidGeo, mat(COLORS.woodDark));
  lid.castShadow = lid.receiveShadow = true;
  lid.rotation.z = Math.PI / 2;
  lid.position.y = 0.5;
  g.add(lid);

  for (const z of [-0.2, 0.2]) {
    const band = roundedBox(w * 1.03, 0.55, 0.1, 0.02, COLORS.stoneDark, { metal: 0.6, rough: 0.4 });
    band.position.set(0, 0.26, z);
    g.add(band);
  }

  const latch = roundedBox(0.14, 0.18, 0.08, 0.02, COLORS.gold, { metal: 0.8, rough: 0.3 });
  latch.position.set(0, 0.5, 0.34);
  g.add(latch);
  return finish(g, 'chest', scale);
}

/* ------------------------------------------------------------------ */
/* Pickups + interactive props                                         */
/* ------------------------------------------------------------------ */

/** Curved banana (tube arc with dark tips). */
export function makeBanana(opts = {}) {
  const { scale } = setup(opts);
  const g = new THREE.Group();

  const pts = [];
  const segs = 6;
  for (let i = 0; i <= segs; i += 1) {
    const a = (i / segs) * Math.PI * 0.85 + Math.PI * 0.075;
    pts.push([Math.cos(a) * 0.45, Math.sin(a) * 0.45, 0]);
  }
  const body = tube(pts, 0.1, COLORS.banana, { tubularSegments: 8, radialSegments: 5, rough: 0.55 });
  g.add(body);

  for (const i of [0, segs]) {
    const tip = sphereLow(0.055, COLORS.bananaTip, { detail: 0 });
    tip.position.set(pts[i][0], pts[i][1], 0);
    g.add(tip);
  }
  return finish(g, 'banana', scale);
}

/**
 * Golden banana star token. Spins by default; pass { spinning: false } to
 * make it static. Drive via obj.userData.update(dt).
 */
export function makeGoldenBanana(opts = {}) {
  const { scale } = setup(opts);
  const spinning = opts.spinning ?? true;
  const g = new THREE.Group();

  const pts = [];
  const segs = 6;
  for (let i = 0; i <= segs; i += 1) {
    const a = (i / segs) * Math.PI * 0.85 + Math.PI * 0.075;
    pts.push([Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0]);
  }
  const body = tube(pts, 0.13, COLORS.gold, {
    tubularSegments: 8,
    radialSegments: 6,
    metal: 0.7,
    rough: 0.25,
    emissive: '#8a6a00',
    emissiveIntensity: 0.55,
  });
  g.add(body);

  for (const i of [0, segs]) {
    const tip = sphereLow(0.07, '#b8860b', { detail: 0, metal: 0.7, rough: 0.3 });
    tip.position.set(pts[i][0], pts[i][1], 0);
    g.add(tip);
  }

  const inner = new THREE.Group();
  inner.add(...g.children);
  inner.position.y = 0.1;
  g.add(inner);

  let t = 0;
  g.userData.update = (dt = 0) => {
    if (!spinning) return;
    t += dt;
    inner.rotation.y += dt * 1.8;
    inner.position.y = 0.1 + Math.sin(t * 2.2) * 0.08;
  };
  return finish(g, 'goldenBanana', scale);
}

/** Gold coin with an embossed ring. */
export function makeCoin(opts = {}) {
  const { scale } = setup(opts);
  const g = new THREE.Group();

  const face = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 0.06, 12),
    mat(COLORS.gold, { metal: 0.8, rough: 0.3, emissive: '#7a5c00', emissiveIntensity: 0.35 }),
  );
  face.castShadow = face.receiveShadow = true;
  g.add(face);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.19, 0.025, 5, 12),
    mat('#e0a92e', { metal: 0.8, rough: 0.35 }),
  );
  ring.castShadow = true;
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.035;
  g.add(ring);
  return finish(g, 'coin', scale);
}

/**
 * Standing torch. { withFlickerLight: false } skips the PointLight (cheaper).
 * Drive the flame/light flicker via obj.userData.update(dt).
 */
export function makeTorch(opts = {}) {
  const { scale, r } = setup(opts);
  const withFlickerLight = opts.withFlickerLight ?? true;
  const g = new THREE.Group();

  const poleH = r(1.3, 1.5);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, poleH, 5), mat(COLORS.wood));
  pole.castShadow = pole.receiveShadow = true;
  pole.position.y = poleH / 2;
  g.add(pole);

  const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.14, 5), mat(COLORS.rope));
  wrap.castShadow = true;
  wrap.position.y = poleH * 0.78;
  g.add(wrap);

  const bowl = cone(0.16, 0.18, COLORS.stoneDark, { segments: 6 });
  bowl.rotation.x = Math.PI;
  bowl.position.y = poleH + 0.05;
  g.add(bowl);

  const flame = cone(0.14, 0.42, COLORS.flame, {
    segments: 6,
    emissive: COLORS.flame,
    emissiveIntensity: 1.6,
  });
  flame.position.y = poleH + 0.35;
  g.add(flame);

  const core = cone(0.07, 0.22, COLORS.flameCore, {
    segments: 5,
    emissive: COLORS.flameCore,
    emissiveIntensity: 2,
  });
  core.position.y = poleH + 0.3;
  g.add(core);

  let light = null;
  if (withFlickerLight) {
    light = new THREE.PointLight(0xffa040, 6, 7, 1.8);
    light.position.y = poleH + 0.45;
    g.add(light);
  }

  let t = Math.random() * 10;
  g.userData.update = (dt = 0) => {
    t += dt;
    const flicker = 1 + Math.sin(t * 13) * 0.12 + Math.sin(t * 29 + 1.7) * 0.08;
    flame.scale.set(flicker, 1 + (flicker - 1) * 1.6, flicker);
    core.scale.copy(flame.scale);
    if (light) light.intensity = 6 * flicker;
  };
  return finish(g, 'torch', scale);
}

/* ------------------------------------------------------------------ */
/* Hazards + mechanisms                                                */
/* ------------------------------------------------------------------ */

/** Cog wheel. { spinning: true, spinSpeed } animates via userData.update. */
export function makeGear(opts = {}) {
  const { scale } = setup(opts);
  const spinning = opts.spinning ?? false;
  const spinSpeed = opts.spinSpeed ?? 1;
  const g = new THREE.Group();

  const metal = { metal: 0.75, rough: 0.4 };
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 12), mat('#9aa2ad', metal));
  disc.castShadow = disc.receiveShadow = true;
  disc.rotation.x = Math.PI / 2;
  g.add(disc);

  const teeth = 8;
  for (let i = 0; i < teeth; i += 1) {
    const a = (i / teeth) * Math.PI * 2;
    const tooth = roundedBox(0.17, 0.12, 0.14, 0.02, '#9aa2ad', metal);
    tooth.position.set(Math.cos(a) * 0.56, Math.sin(a) * 0.56, 0);
    tooth.rotation.z = a;
    g.add(tooth);
  }

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.16, 8), mat('#5c636d', metal));
  hub.castShadow = true;
  hub.rotation.x = Math.PI / 2;
  g.add(hub);

  g.userData.update = (dt = 0) => {
    if (spinning) g.rotation.z += dt * spinSpeed;
  };
  return finish(g, 'gear', scale);
}

/** Cluster of icy spikes. */
export function makeIceSpike(opts = {}) {
  const { scale, r, rng } = setup(opts);
  const g = new THREE.Group();
  const iceOpts = { metal: 0.1, rough: 0.25, emissive: '#3a7ea8', emissiveIntensity: 0.15 };

  const spikes = rng.int(2, 4);
  for (let i = 0; i < spikes; i += 1) {
    const h = i === 0 ? r(1.6, 2.3) : r(0.6, 1.2);
    const spike = cone(r(0.2, 0.34), h, COLORS.ice, { segments: 5, ...iceOpts });
    spike.position.set(i === 0 ? 0 : r(-0.5, 0.5), h / 2, i === 0 ? 0 : r(-0.5, 0.5));
    spike.rotation.set(r(-0.12, 0.12), r(0, Math.PI * 2), r(-0.12, 0.12));
    g.add(spike);
  }
  return finish(g, 'iceSpike', scale);
}

/** Curling tentacle: tapered sphere chain + suckers + tip. */
export function makeTentacle(opts = {}) {
  const { scale, r, rng } = setup(opts);
  const g = new THREE.Group();

  const segs = rng.int(6, 8);
  const height = r(1.6, 2.2);
  const curl = r(0.6, 1.1);
  const points = [];
  for (let i = 0; i <= segs; i += 1) {
    const t = i / segs;
    points.push(new THREE.Vector3(
      Math.sin(t * Math.PI * curl) * 0.55 * t,
      t * height,
      Math.cos(t * Math.PI * curl * 0.7) * 0.3 * t,
    ));
  }

  for (let i = 0; i <= segs; i += 1) {
    const t = i / segs;
    const radius = 0.32 * (1 - t * 0.82);
    const seg = sphereLow(Math.max(0.06, radius), COLORS.tentacle, { detail: 0, rough: 0.6 });
    seg.position.copy(points[i]);
    g.add(seg);
    if (i > 0 && i % 2 === 0 && i < segs) {
      const sucker = sphereLow(radius * 0.35, COLORS.tentacleSucker, { detail: 0 });
      sucker.position.copy(points[i]).add(new THREE.Vector3(-0.18 * (1 - t), 0, 0.12));
      g.add(sucker);
    }
  }

  const tip = cone(0.09, 0.3, COLORS.tentacle, { segments: 5, rough: 0.6 });
  tip.position.copy(points[segs]).add(new THREE.Vector3(0, 0.15, 0));
  g.add(tip);
  return finish(g, 'tentacle', scale);
}
