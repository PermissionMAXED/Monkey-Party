/**
 * Low-poly mesh primitives for MONKEY-PARTY props.
 *
 * Every helper returns a shadow-casting THREE.Mesh using the shared material
 * cache (flat-shaded low-poly look). Segment counts are intentionally tiny.
 * merge(children) bakes a list of meshes into as few draw calls as possible.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat } from './materials.js';

function makeMesh(geometry, color, opts) {
  const mesh = new THREE.Mesh(geometry, opts?.material ?? mat(color, opts));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Capsule (pill). ~radius r, cylindrical mid-section `length`.
 * @returns {THREE.Mesh}
 */
export function capsule(radius = 0.4, length = 0.8, color = '#ffffff', opts = {}) {
  const geo = new THREE.CapsuleGeometry(radius, length, opts.capSegments ?? 2, opts.segments ?? 6);
  return makeMesh(geo, color, opts);
}

/**
 * Box with softly rounded edges.
 * @returns {THREE.Mesh}
 */
export function roundedBox(w = 1, h = 1, d = 1, radius = 0.08, color = '#ffffff', opts = {}) {
  const r = Math.min(radius, w / 2, h / 2, d / 2);
  // segments=1 keeps the chamfered low-poly silhouette at ~1/8 the triangles.
  const geo = new RoundedBoxGeometry(w, h, d, opts.segments ?? 1, r);
  return makeMesh(geo, color, opts);
}

/**
 * Low-poly cone.
 * @returns {THREE.Mesh}
 */
export function cone(radius = 0.5, height = 1, color = '#ffffff', opts = {}) {
  const geo = new THREE.ConeGeometry(radius, height, opts.segments ?? 6, 1, opts.openEnded ?? false);
  return makeMesh(geo, color, opts);
}

/**
 * Low-poly icosphere (detail 0 = 20 tris, 1 = 80 tris).
 * @returns {THREE.Mesh}
 */
export function sphereLow(radius = 0.5, color = '#ffffff', opts = {}) {
  const geo = new THREE.IcosahedronGeometry(radius, opts.detail ?? 1);
  return makeMesh(geo, color, opts);
}

/**
 * Low-poly tube along a path.
 *
 * @param {THREE.Curve|Array<THREE.Vector3|[number,number,number]>} path
 *   A curve, or an array of points turned into a CatmullRomCurve3.
 * @returns {THREE.Mesh}
 */
export function tube(path, radius = 0.1, color = '#ffffff', opts = {}) {
  let curve = path;
  if (Array.isArray(path)) {
    const pts = path.map((p) => (p.isVector3 ? p : new THREE.Vector3(p[0], p[1], p[2])));
    curve = new THREE.CatmullRomCurve3(pts);
  }
  const geo = new THREE.TubeGeometry(
    curve,
    opts.tubularSegments ?? 10,
    radius,
    opts.radialSegments ?? 5,
    opts.closed ?? false,
  );
  return makeMesh(geo, color, opts);
}

/**
 * Merge child meshes into as few meshes as possible (one per material),
 * baking each child's world transform into its geometry. Accepts an
 * Object3D (traversed) or an array of meshes/groups.
 *
 * Returns a single Mesh when everything shares one material, otherwise a
 * Group of merged meshes. Source geometries are left untouched.
 *
 * @param {THREE.Object3D|THREE.Object3D[]} children
 * @returns {THREE.Object3D}
 */
export function merge(children) {
  const roots = Array.isArray(children) ? children : [children];
  /** @type {Map<string, { material: THREE.Material, geos: THREE.BufferGeometry[] }>} */
  const byMaterial = new Map();

  for (const root of roots) {
    root.updateWorldMatrix(true, true);
    root.traverse((obj) => {
      if (!obj.isMesh || !obj.geometry) return;
      const material = Array.isArray(obj.material) ? obj.material[0] : obj.material;
      const key = material.uuid;
      let bucket = byMaterial.get(key);
      if (!bucket) {
        bucket = { material, geos: [] };
        byMaterial.set(key, bucket);
      }
      const geo = obj.geometry.clone();
      geo.applyMatrix4(obj.matrixWorld);
      bucket.geos.push(geo);
    });
  }

  const meshes = [];
  for (const { material, geos } of byMaterial.values()) {
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    for (const g of geos) {
      if (g !== merged) g.dispose();
    }
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    meshes.push(mesh);
  }

  if (meshes.length === 1) return meshes[0];
  const group = new THREE.Group();
  group.add(...meshes);
  return group;
}
