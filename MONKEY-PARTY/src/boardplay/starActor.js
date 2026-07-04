/**
 * Golden-banana star actor for the board-play view (P4).
 *
 * A spinning golden banana (engine propKit when available, guarded with a
 * dynamic import + a plain-THREE fallback) on a soft additive light beam,
 * parked on MatchState.board.starNode.
 *
 * Star purchases/relocations are choreography-driven: the queue calls
 * beginFlight(from, to) then setFlight(k) each frame and endFlight() /
 * placeAt() when done, so the presentation stays deterministic headless.
 */

import * as THREE from 'three';

/* Guarded engine-kit import: the propKit is optional at runtime. */
let propKit = null;
try {
  propKit = await import('../engine/propKit.js');
} catch {
  propKit = null;
}

const BEAM_GEO = new THREE.CylinderGeometry(0.34, 0.55, 7, 12, 1, true);

function buildFallbackBanana() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: '#ffd54f',
    metalness: 0.6,
    roughness: 0.3,
    emissive: '#8a6a00',
    emissiveIntensity: 0.5,
  });
  mat.userData.ownedMaterial = true;
  // Crescent from three tilted capsule-ish spheres.
  for (const [i, a] of [-0.5, 0, 0.5].entries()) {
    const seg = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), mat);
    seg.geometry.userData.owned = i === 0; // dispose once (shared below)
    seg.scale.set(1, 1.6, 1);
    seg.position.set(Math.sin(a) * 0.45, Math.cos(a) * 0.45, 0);
    seg.rotation.z = -a;
    g.add(seg);
  }
  let t = 0;
  g.userData.update = (dt = 0) => {
    t += dt;
    g.rotation.y += dt * 1.8;
    g.position.y = 0.95 + Math.sin(t * 2.2) * 0.08;
  };
  return g;
}

export function createStarActor() {
  const group = new THREE.Group();
  group.name = 'starActor';

  let banana = null;
  try {
    banana = propKit?.makeGoldenBanana?.({ spinning: true, scale: 1.1 }) ?? null;
  } catch {
    banana = null;
  }
  if (!banana?.isObject3D) banana = buildFallbackBanana();
  banana.position.y = Math.max(banana.position.y, 0.95);
  group.add(banana);

  const beamMat = new THREE.MeshBasicMaterial({
    color: '#ffe27a',
    transparent: true,
    opacity: 0.26,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  beamMat.userData.ownedMaterial = true;
  const beam = new THREE.Mesh(BEAM_GEO, beamMat);
  beam.position.y = 3.6;
  group.add(beam);

  const light = new THREE.PointLight(0xffd54f, 3.5, 8, 1.8);
  light.position.y = 1.5;
  group.add(light);

  const flight = { active: false, from: new THREE.Vector3(), to: new THREE.Vector3() };
  let time = 0;
  let disposed = false;

  /** Park the star on a node position (beam + light visible). */
  function placeAt(pos) {
    if (!pos) return;
    group.position.set(pos.x ?? pos[0] ?? 0, pos.y ?? pos[1] ?? 0, pos.z ?? pos[2] ?? 0);
    group.visible = true;
    beam.visible = true;
    light.visible = true;
    flight.active = false;
  }

  function worldPos() {
    return group.position.clone();
  }

  /** Prepare a flight (purchase -> to player, relocation -> to new node). */
  function beginFlight(from, to) {
    flight.from.copy(from ?? group.position);
    flight.to.copy(to ?? group.position);
    flight.active = true;
    beam.visible = false;
    light.visible = false;
    group.visible = true;
  }

  /** Apply flight pose for progress k in [0,1] (high arc + spin-up). */
  function setFlight(k) {
    if (!flight.active) return;
    const kk = Math.min(1, Math.max(0, k));
    group.position.lerpVectors(flight.from, flight.to, kk);
    group.position.y += Math.sin(Math.PI * kk) * 2.4;
    banana.rotation.y += 0.4; // extra excited spin during flight
    const s = 1 + Math.sin(Math.PI * kk) * 0.35;
    group.scale.setScalar(s);
  }

  /** Finish a flight. { hide: true } for purchases (banana goes to player). */
  function endFlight({ hide = false } = {}) {
    flight.active = false;
    group.scale.setScalar(1);
    if (hide) {
      group.visible = false;
    } else {
      group.position.copy(flight.to);
      beam.visible = true;
      light.visible = true;
    }
  }

  /** Ambient spin/bob + beam shimmer. */
  function update(dt) {
    if (disposed) return;
    const step = Math.max(0, Number(dt) || 0);
    time += step;
    try {
      banana.userData.update?.(step);
    } catch { /* fallback keeps spinning below */ }
    beam.rotation.y += step * 0.4;
    beamMat.opacity = 0.2 + Math.sin(time * 2.6) * 0.07;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    group.traverse((obj) => {
      if (obj.geometry?.userData?.owned) obj.geometry.dispose();
      if (obj.material?.userData?.ownedMaterial) obj.material.dispose();
    });
    group.parent?.remove(group);
    group.clear();
  }

  return {
    group,
    placeAt,
    worldPos,
    beginFlight,
    setFlight,
    endFlight,
    update,
    dispose,
    get inFlight() {
      return flight.active;
    },
  };
}

export default createStarActor;
