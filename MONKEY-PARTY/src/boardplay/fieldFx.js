/**
 * Generic field-event FX presets for the board-play package (P4), plus the
 * small canvas-texture text-sprite helpers shared by the other board-play
 * modules (name tags, coin floats, banners, dice totals).
 *
 * Everything is headless-safe: when `document` is missing (node tests) the
 * text sprites render as untextured sprites and all timing logic still runs.
 * Nothing here mutates game state - it only draws what the sim decided.
 *
 * createFieldFx({ scene, particles, audio, shake }) returns
 *   { play(type, pos, evt) -> duration, coinBurst(pos, delta),
 *     floatText(text, pos, opts), pulse(pos, color, opts),
 *     update(dt), dispose() }.
 *
 * Presets by node type: blue/red coin pulses, event tornado, item sparkle,
 * shop chime, trap snap (+shake), boss drums (+big shake), star shimmer.
 */

import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/* Canvas-texture text sprites (cached, headless-safe)                 */
/* ------------------------------------------------------------------ */

/** Cached canvas textures keyed by text+style (LRU, cap TEXT_CACHE_MAX). */
const textCache = new Map();
const TEXT_CACHE_MAX = 64;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Build (or fetch from cache) a canvas texture for a text label.
 * Returns null when no DOM is available (headless tests).
 *
 * @param {string} text
 * @param {{color?: string, bg?: string, size?: number, pad?: number,
 *   stroke?: string}} [opts]
 * @returns {{texture: THREE.CanvasTexture, aspect: number}|null}
 */
export function makeTextTexture(text, opts = {}) {
  if (typeof document === 'undefined') return null;
  const color = opts.color ?? '#ffffff';
  const bg = opts.bg ?? null;
  const size = opts.size ?? 48;
  const pad = opts.pad ?? Math.round(size * 0.4);
  const key = `${text}|${color}|${bg}|${size}|${opts.stroke ?? ''}`;
  const hit = textCache.get(key);
  if (hit) {
    // LRU bump.
    textCache.delete(key);
    textCache.set(key, hit);
    return hit;
  }

  const font = `bold ${size}px "Trebuchet MS", "Segoe UI", sans-serif`;
  const canvas = document.createElement('canvas');
  let ctx = canvas.getContext('2d');
  ctx.font = font;
  const w = Math.max(2, Math.ceil(ctx.measureText(text).width) + pad * 2);
  const h = size + pad * 2;
  canvas.width = w;
  canvas.height = h;
  ctx = canvas.getContext('2d');
  if (bg) {
    ctx.fillStyle = bg;
    roundRect(ctx, 1, 1, w - 2, h - 2, Math.min(18, h / 2 - 1));
    ctx.fill();
  }
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (opts.stroke) {
    ctx.lineWidth = Math.max(2, size / 10);
    ctx.strokeStyle = opts.stroke;
    ctx.strokeText(text, w / 2, h / 2);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, w / 2, h / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const entry = { texture, aspect: w / h };
  textCache.set(key, entry);
  if (textCache.size > TEXT_CACHE_MAX) {
    const [oldKey, oldEntry] = textCache.entries().next().value;
    oldEntry.texture.dispose();
    textCache.delete(oldKey);
  }
  return entry;
}

/**
 * Text label as a THREE.Sprite. The texture lives in the shared cache; the
 * material is owned by the sprite (dispose via disposeSprite()).
 *
 * @param {string} text
 * @param {{height?: number, depthTest?: boolean} & Parameters<typeof makeTextTexture>[1]} [opts]
 * @returns {THREE.Sprite}
 */
export function makeTextSprite(text, opts = {}) {
  const entry = makeTextTexture(text, opts);
  const material = new THREE.SpriteMaterial({
    map: entry?.texture ?? null,
    transparent: true,
    depthTest: opts.depthTest ?? false,
    depthWrite: false,
  });
  if (!entry) material.color.set(opts.color ?? '#ffffff');
  const sprite = new THREE.Sprite(material);
  const height = opts.height ?? 0.45;
  sprite.scale.set(height * (entry?.aspect ?? 3), height, 1);
  sprite.renderOrder = 10;
  sprite.userData.ownedMaterial = true; // texture stays in the cache
  return sprite;
}

/** Dispose a makeTextSprite() sprite (material only; texture is cached). */
export function disposeSprite(sprite) {
  if (!sprite) return;
  sprite.material?.dispose?.();
  sprite.parent?.remove(sprite);
}

/**
 * Dispose every geometry/material below `root` that is marked owned
 * (userData.owned on geometries, userData.ownedMaterial on materials) and
 * detach it. Shared module-level geometries/materials are left alone.
 * @param {THREE.Object3D} root
 */
export function disposeObject(root) {
  if (!root) return;
  root.traverse((obj) => {
    if (obj.geometry?.userData?.owned) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (m?.userData?.ownedMaterial) m.dispose();
      }
    }
  });
  root.parent?.remove(root);
}

/* ------------------------------------------------------------------ */
/* Field FX presets                                                    */
/* ------------------------------------------------------------------ */

/** Shared flat ring geometry for expanding pulses. */
const PULSE_GEO = new THREE.TorusGeometry(1, 0.06, 6, 32);

/**
 * Per-node-type presets: pulse color/size, particle burst, sfx and how long
 * the choreography step should hold on the effect.
 */
export const FIELD_FX_PRESETS = {
  blue: { ring: '#4d9bff', ringScale: 1.4, sfx: 'coin', burst: 'coinSparkle', dur: 0.7 },
  red: { ring: '#ff5a5f', ringScale: 1.4, sfx: 'coinLoss', dur: 0.7 },
  event: { ring: '#f5a623', ringScale: 1.7, sfx: 'whoosh', tornado: true, dur: 1.0 },
  item: { ring: '#c084fc', ringScale: 1.4, sfx: 'pop', burst: 'confetti', burstCount: 18, dur: 0.7 },
  shop: { ring: '#3ecf8e', ringScale: 1.3, sfx: 'buy', dur: 0.6 },
  trap: { ring: '#9aa2ad', ringScale: 1.2, sfx: 'zap', burst: 'dust', shake: [0.3, 0.35], dur: 0.8 },
  boss: { ring: '#c62828', ringScale: 2.6, sfx: 'drum', drums: true, shake: [0.55, 0.9], dur: 1.4 },
  star: { ring: '#ffd23f', ringScale: 1.5, sfx: 'star', burst: 'coinSparkle', dur: 0.8 },
  start: { ring: '#ffffff', ringScale: 1.1, dur: 0.4 },
  junction: { ring: '#f39c12', ringScale: 1.1, dur: 0.4 },
  special: { ring: '#e056fd', ringScale: 1.5, sfx: 'boing', burst: 'confetti', burstCount: 14, dur: 0.8 },
};

/**
 * @param {{
 *   scene: THREE.Object3D|null,
 *   particles?: {burst: Function, emitter: Function}|null,
 *   audio?: (name: string, opts?: Object) => void,
 *   shake?: (intensity: number, dur: number) => void,
 * }} deps
 */
export function createFieldFx({ scene = null, particles = null, audio = null, shake = null } = {}) {
  const group = new THREE.Group();
  group.name = 'fieldFx';
  scene?.add?.(group);

  /** @type {{mesh: THREE.Mesh, t: number, dur: number, scale: number}[]} */
  const pulses = [];
  /** @type {{sprite: THREE.Sprite, t: number, dur: number, rise: number, baseY: number}[]} */
  const floats = [];
  /** @type {{t: number, fn: Function}[]} */
  const delayed = [];
  /** @type {{emitter: {stop: Function}, t: number}[]} */
  const emitters = [];
  let disposed = false;

  const sfx = (name, opts) => {
    try {
      audio?.(name, opts);
    } catch { /* audio is best-effort */ }
  };

  function toVec3(pos) {
    if (!pos) return new THREE.Vector3();
    if (pos.isVector3) return pos.clone();
    if (Array.isArray(pos)) return new THREE.Vector3(pos[0] ?? 0, pos[1] ?? 0, pos[2] ?? 0);
    return new THREE.Vector3(pos.x ?? 0, pos.y ?? 0, pos.z ?? 0);
  }

  /**
   * Expanding, fading ring pulse at a position.
   * @param {*} pos
   * @param {string} color
   * @param {{scale?: number, dur?: number}} [opts]
   */
  function pulse(pos, color, opts = {}) {
    if (disposed) return;
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    material.userData.ownedMaterial = true;
    const mesh = new THREE.Mesh(PULSE_GEO, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(toVec3(pos));
    mesh.position.y += 0.18;
    mesh.scale.setScalar(0.2);
    group.add(mesh);
    pulses.push({ mesh, t: 0, dur: opts.dur ?? 0.6, scale: opts.scale ?? 1.4 });
  }

  /**
   * Floating, fading text at a world position (e.g. "+3", item names).
   * @returns {number} Effect duration in seconds.
   */
  function floatText(text, pos, opts = {}) {
    if (disposed) return 0;
    const sprite = makeTextSprite(text, {
      color: opts.color ?? '#ffffff',
      stroke: 'rgba(0,0,0,0.8)',
      size: opts.size ?? 52,
      height: opts.height ?? 0.5,
    });
    const p = toVec3(pos);
    sprite.position.set(p.x, p.y + (opts.y ?? 1.7), p.z);
    group.add(sprite);
    const dur = opts.dur ?? 0.9;
    floats.push({ sprite, t: 0, dur, rise: opts.rise ?? 1.1, baseY: sprite.position.y });
    return dur;
  }

  /** Coin gain/loss burst: float text + sparkle arc + sfx. */
  function coinBurst(pos, delta) {
    const gain = delta >= 0;
    floatText(`${gain ? '+' : ''}${delta}`, pos, { color: gain ? '#ffe135' : '#ff6b6b', size: 60 });
    if (gain) {
      particles?.burst?.('coinSparkle', { pos: toVec3(pos).setY(toVec3(pos).y + 0.6), count: 20 });
    } else {
      particles?.burst?.('dust', { pos: toVec3(pos), colors: ['#b06a6a', '#8a4a4a'] });
    }
    sfx(gain ? 'coin' : 'coinLoss');
    return 0.8;
  }

  /**
   * Generic per-node-type effect (blue/red pulse, event tornado, trap snap,
   * boss drums + shake, ...). Returns the suggested choreography duration.
   *
   * @param {string} type BoardNode type (or 'boss'/'trap'/... from events).
   * @param {*} pos World position.
   * @returns {number} Duration in seconds.
   */
  function play(type, pos) {
    if (disposed) return 0;
    const preset = FIELD_FX_PRESETS[type] ?? FIELD_FX_PRESETS.junction;
    const p = toVec3(pos);
    if (preset.ring) pulse(p, preset.ring, { scale: preset.ringScale ?? 1.4 });
    if (preset.sfx) sfx(preset.sfx);
    if (preset.burst) {
      particles?.burst?.(preset.burst, { pos: p.clone().setY(p.y + 0.4), count: preset.burstCount });
    }
    if (preset.tornado && particles?.emitter) {
      const em = particles.emitter({
        pos: p.clone().setY(p.y + 0.3),
        rate: 90,
        colors: ['#ffd54f', '#f5a623', '#c8b89a'],
        spread: 2.6,
        up: 4.2,
        gravity: 0.5,
        life: 0.8,
        size: 0.14,
      });
      emitters.push({ emitter: em, t: 0.9 });
    }
    if (preset.drums) {
      delayed.push({ t: 0.35, fn: () => sfx('drum', { pitch: 0.85 }) });
      delayed.push({ t: 0.7, fn: () => sfx('drum', { pitch: 0.7 }) });
    }
    if (preset.shake) shake?.(preset.shake[0], preset.shake[1]);
    return preset.dur ?? 0.6;
  }

  /** Advance all live effects; call once per frame. */
  function update(dt) {
    if (disposed || !(dt > 0)) return;
    for (let i = pulses.length - 1; i >= 0; i -= 1) {
      const fx = pulses[i];
      fx.t += dt;
      const k = Math.min(1, fx.t / fx.dur);
      fx.mesh.scale.setScalar(0.2 + (fx.scale - 0.2) * (1 - (1 - k) ** 2));
      fx.mesh.material.opacity = 0.85 * (1 - k);
      if (k >= 1) {
        fx.mesh.material.dispose();
        group.remove(fx.mesh);
        pulses.splice(i, 1);
      }
    }
    for (let i = floats.length - 1; i >= 0; i -= 1) {
      const fx = floats[i];
      fx.t += dt;
      const k = Math.min(1, fx.t / fx.dur);
      fx.sprite.position.y = fx.baseY + fx.rise * k;
      fx.sprite.material.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      if (k >= 1) {
        disposeSprite(fx.sprite);
        floats.splice(i, 1);
      }
    }
    for (let i = delayed.length - 1; i >= 0; i -= 1) {
      delayed[i].t -= dt;
      if (delayed[i].t <= 0) {
        const { fn } = delayed[i];
        delayed.splice(i, 1);
        try {
          fn();
        } catch { /* best-effort */ }
      }
    }
    for (let i = emitters.length - 1; i >= 0; i -= 1) {
      emitters[i].t -= dt;
      if (emitters[i].t <= 0) {
        emitters[i].emitter?.stop?.();
        emitters.splice(i, 1);
      }
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const fx of pulses) fx.mesh.material.dispose();
    for (const fx of floats) disposeSprite(fx.sprite);
    for (const em of emitters) em.emitter?.stop?.();
    pulses.length = 0;
    floats.length = 0;
    delayed.length = 0;
    emitters.length = 0;
    group.parent?.remove(group);
    group.clear();
  }

  return { group, play, pulse, floatText, coinBurst, update, dispose };
}

export default createFieldFx;
