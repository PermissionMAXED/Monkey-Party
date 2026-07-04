/**
 * Player token actor for the board-play view (P4).
 *
 * One tokenActor per player: a procedural monkey (via the characters
 * package, guarded - falls back to a colored capsule when the package is
 * missing), a canvas-texture name tag sprite (with a BOT badge for bots), a
 * colored seat ring, and a "your turn" glow disc for local humans.
 *
 * All movement animation is CHOREOGRAPHY-DRIVEN: the board-play queue calls
 * startHop(from, to) once and then setHop(k) with k in [0,1] every frame,
 * so hops are deterministic in headless tests. update(dt) only drives
 * ambient state (idle animator, ring pulse, speech bubble fade).
 *
 * The actor never mutates game state - it renders what the sim decided.
 */

import * as THREE from 'three';
import { makeTextSprite, disposeSprite, disposeObject } from './fieldFx.js';

/** Distinct per-seat token colors (8 seats). */
export const TOKEN_COLORS = [
  '#ef5350', '#42a5f5', '#ffca28', '#66bb6a',
  '#ab47bc', '#ff7043', '#26c6da', '#ec407a',
];

/* Shared geometries/materials (perf: reused across all 8 tokens). */
const RING_GEO = new THREE.TorusGeometry(0.62, 0.06, 8, 28);
const GLOW_GEO = new THREE.CircleGeometry(0.95, 24);
const BODY_GEO = new THREE.CapsuleGeometry(0.3, 0.5, 3, 10);
const EYE_GEO = new THREE.SphereGeometry(0.055, 6, 6);
const EYE_MAT = new THREE.MeshStandardMaterial({ color: '#1c1c22', roughness: 0.4 });

const ringMats = new Map();
const glowMats = new Map();
const bodyMats = new Map();

function ringMat(color) {
  let m = ringMats.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 0.55, roughness: 0.5,
    });
    ringMats.set(color, m);
  }
  return m;
}

function glowMat(color) {
  let m = glowMats.get(color);
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    glowMats.set(color, m);
  }
  return m;
}

function bodyMat(color) {
  let m = bodyMats.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true });
    bodyMats.set(color, m);
  }
  return m;
}

/** Speech-bubble glyphs per emote id (plain text - rendered to canvas). */
const EMOTE_BUBBLES = {
  dance: 'oo-oo! \u266a',
  taunt: 'ooh ooh AH!',
  laugh: 'ha ha ha!',
  cry: 'whimper...',
  flex: 'FLEX!',
  facepalm: '*facepalm*',
};

/**
 * @param {{
 *   player: {id: string, name?: string, isBot?: boolean, cosmetics?: Object},
 *   characterDef?: Object|null CharacterDef (may be null - capsule/default),
 *   color?: string Seat color,
 *   monkeyKit?: {buildMonkey?: Function, createAnimator?: Function}|null
 *     Guarded characters-package modules (null -> capsule fallback),
 * }} opts
 */
export function createTokenActor({ player, characterDef = null, color = '#ffca28', monkeyKit = null } = {}) {
  const group = new THREE.Group();
  group.name = `token:${player?.id ?? 'unknown'}`;

  /* ---- body: monkey (guarded) or capsule fallback ------------------ */
  let monkey = null;
  let animator = null;
  if (typeof monkeyKit?.buildMonkey === 'function') {
    try {
      monkey = monkeyKit.buildMonkey(characterDef, player?.cosmetics ?? null);
    } catch {
      monkey = null;
    }
  }

  let bodyRoot;
  if (monkey?.group?.isObject3D) {
    bodyRoot = monkey.group;
    if (typeof monkeyKit.createAnimator === 'function') {
      try {
        animator = monkeyKit.createAnimator(monkey);
        animator.play('idle', { fade: 0 });
      } catch {
        animator = null;
      }
    }
  } else {
    monkey = null;
    bodyRoot = new THREE.Group();
    bodyRoot.name = 'capsuleMonkey';
    const body = new THREE.Mesh(BODY_GEO, bodyMat(color));
    body.castShadow = body.receiveShadow = true;
    body.position.y = 0.58;
    bodyRoot.add(body);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(EYE_GEO, EYE_MAT);
      eye.position.set(side * 0.11, 0.78, 0.26);
      bodyRoot.add(eye);
    }
  }
  group.add(bodyRoot);
  const baseBodyScale = bodyRoot.scale.clone();

  /* ---- seat ring + local-turn glow --------------------------------- */
  const ring = new THREE.Mesh(RING_GEO, ringMat(color));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  group.add(ring);

  const glow = new THREE.Mesh(GLOW_GEO, glowMat(color));
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.03;
  glow.visible = false;
  group.add(glow);

  /* ---- name tag ----------------------------------------------------- */
  const isBot = !!player?.isBot;
  const label = isBot ? `${player?.name ?? 'Bot'} [BOT]` : (player?.name ?? player?.id ?? '?');
  const nameTag = makeTextSprite(label, {
    color: isBot ? '#cfd8dc' : '#ffffff',
    bg: 'rgba(16,20,14,0.72)',
    stroke: color,
    size: 42,
    height: 0.34,
  });
  const bounds = new THREE.Box3().setFromObject(bodyRoot);
  const headY = Number.isFinite(bounds.max.y) ? Math.max(1.2, bounds.max.y) : 1.6;
  nameTag.position.y = headY + 0.45;
  group.add(nameTag);

  /* ---- speech bubble (emotes) --------------------------------------- */
  let bubble = null;
  let bubbleTime = 0;

  /* ---- ambient/hop state --------------------------------------------- */
  const hop = {
    active: false,
    from: new THREE.Vector3(),
    to: new THREE.Vector3(),
    height: 0.55,
  };
  let isCurrent = false;
  let time = Math.random() * 10;
  let emoteUntil = 0;
  let emoteTime = 0;
  let capsuleEmote = false;
  let disposed = false;

  function placeAt(pos) {
    if (!pos) return;
    group.position.set(pos.x ?? pos[0] ?? 0, pos.y ?? pos[1] ?? 0, pos.z ?? pos[2] ?? 0);
  }

  function worldPos() {
    return group.position.clone();
  }

  /** Prepare a hop; the queue then drives setHop(k) each frame. */
  function startHop(from, to, { height = 0.55 } = {}) {
    hop.from.copy(from ?? group.position);
    hop.to.copy(to ?? group.position);
    hop.height = height;
    hop.active = true;
    // Face the travel direction.
    const dx = hop.to.x - hop.from.x;
    const dz = hop.to.z - hop.from.z;
    if (dx * dx + dz * dz > 1e-6) bodyRoot.rotation.y = Math.atan2(dx, dz);
    animator?.play('walk', { loop: true, fade: 0.08 });
  }

  /** Apply hop pose for progress k in [0,1] (parabola + squash-stretch). */
  function setHop(k) {
    if (!hop.active) return;
    const kk = Math.min(1, Math.max(0, k));
    group.position.lerpVectors(hop.from, hop.to, kk);
    const arc = Math.sin(Math.PI * kk);
    group.position.y += arc * hop.height;
    // Stretch mid-air, squash on touchdown.
    const stretch = 1 + arc * 0.22 - (kk > 0.9 ? (kk - 0.9) * 2.4 : 0);
    bodyRoot.scale.set(
      baseBodyScale.x * (2 - stretch < 0.6 ? 0.6 : 2 - stretch) ** 0.5,
      baseBodyScale.y * stretch,
      baseBodyScale.z * (2 - stretch < 0.6 ? 0.6 : 2 - stretch) ** 0.5,
    );
  }

  /** Land: snap to the destination and reset the squash. */
  function endHop() {
    if (!hop.active) return;
    group.position.copy(hop.to);
    bodyRoot.scale.copy(baseBodyScale);
    hop.active = false;
    animator?.play('idle', { loop: true, fade: 0.12 });
  }

  /** Blocked/denied wiggle pose for progress k (queue-driven). */
  function setWiggle(k) {
    bodyRoot.rotation.z = Math.sin(k * Math.PI * 6) * 0.18 * (1 - k);
  }

  /** Current-turn ring pulse on/off. */
  function setCurrent(on) {
    isCurrent = !!on;
    if (!isCurrent) ring.scale.setScalar(1);
  }

  /** "Your turn" glow for local humans. */
  function setLocalTurn(on) {
    glow.visible = !!on;
  }

  /** Show a speech bubble above the head for `dur` seconds. */
  function say(text, dur = 1.6) {
    if (bubble) disposeSprite(bubble);
    bubble = makeTextSprite(text, {
      color: '#20240f',
      bg: 'rgba(255,252,240,0.92)',
      size: 40,
      height: 0.32,
    });
    bubble.position.y = nameTag.position.y + 0.42;
    group.add(bubble);
    bubbleTime = dur;
  }

  /**
   * Play an emote: character emote clip (animator) + speech bubble.
   * Falls back to a capsule spin when there is no animator.
   */
  function playEmote(emoteId, dur = 1.4) {
    const id = EMOTE_BUBBLES[emoteId] ? emoteId : 'taunt';
    say(EMOTE_BUBBLES[id], dur + 0.4);
    emoteUntil = dur;
    emoteTime = 0;
    if (animator) {
      try {
        animator.play(id, { fade: 0.1 });
        capsuleEmote = false;
        return;
      } catch { /* fall through */ }
    }
    capsuleEmote = true;
  }

  /** Victory/lose reaction for game_over. */
  function celebrate(win) {
    if (animator) {
      try {
        animator.play(win ? 'victory' : 'lose', { fade: 0.15 });
        return;
      } catch { /* fall through */ }
    }
    if (monkey?.setPose) {
      try {
        monkey.setPose(win ? 'victory' : 'lose');
      } catch { /* keep idle */ }
    }
  }

  /** Ambient per-frame update (idle anim, ring pulse, bubble fade). */
  function update(dt) {
    if (disposed) return;
    const step = Math.max(0, Number(dt) || 0);
    time += step;
    animator?.update(step);

    if (isCurrent) {
      const pulse = 1 + Math.sin(time * 5) * 0.12;
      ring.scale.setScalar(pulse);
    }
    if (glow.visible) {
      glow.material.opacity = 0.22 + Math.sin(time * 4) * 0.14;
    }
    if (bubble) {
      bubbleTime -= step;
      if (bubbleTime <= 0) {
        disposeSprite(bubble);
        bubble = null;
      } else if (bubbleTime < 0.3) {
        bubble.material.opacity = bubbleTime / 0.3;
      }
    }
    if (emoteUntil > 0) {
      emoteTime += step;
      if (capsuleEmote) {
        bodyRoot.rotation.y += step * 9;
        group.position.y += Math.sin(emoteTime * 12) * 0.01;
      }
      if (emoteTime >= emoteUntil) {
        emoteUntil = 0;
        if (capsuleEmote) bodyRoot.rotation.set(0, 0, 0);
        else animator?.play('idle', { loop: true, fade: 0.2 });
      }
    } else if (!monkey && !hop.active) {
      // Capsule fallback: gentle idle bob so it doesn't look dead.
      bodyRoot.position.y = Math.sin(time * 2.2) * 0.03;
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    disposeSprite(nameTag);
    if (bubble) disposeSprite(bubble);
    disposeObject(group);
    group.clear();
  }

  return {
    group,
    player,
    color,
    placeAt,
    worldPos,
    startHop,
    setHop,
    endHop,
    setWiggle,
    setCurrent,
    setLocalTurn,
    say,
    playEmote,
    celebrate,
    update,
    dispose,
    get hasMonkey() {
      return !!monkey;
    },
  };
}

export default createTokenActor;
