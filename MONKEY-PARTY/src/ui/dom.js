/**
 * Small DOM toolkit for the UI package: element builders, portraits,
 * countdown rings, toasts and modal scaffolding. No framework - everything
 * is plain DOM + the classes defined in src/ui/ui.css.
 */

/**
 * Create an element.
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 * @returns {HTMLElement}
 */
export function el(tag, className = '', text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Shorthand for el('div', ...). */
export function div(className = '', text) {
  return el('div', className, text);
}

/**
 * Button with click sfx + handler.
 * @param {string} label
 * @param {string} [className]
 * @param {Function} [onClick]
 */
export function button(label, className = '', onClick = null) {
  const b = el('button', `ui-btn ${className}`.trim(), label);
  b.type = 'button';
  if (onClick) {
    b.addEventListener('click', (e) => {
      playSfx('click');
      onClick(e);
    });
  }
  return b;
}

/** Remove every child of a node. */
export function clearNode(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/* ------------------------------------------------------------------ */
/* Guarded sfx (engine audio is a sibling package)                     */
/* ------------------------------------------------------------------ */

let sfxFn = null;
import('../engine/audio.js')
  .then((mod) => {
    sfxFn = typeof mod?.sfx === 'function' ? mod.sfx : null;
  })
  .catch(() => {
    sfxFn = null;
  });

/** Play a named engine sfx; no-op when the engine audio is unavailable. */
export function playSfx(name, opts) {
  try {
    sfxFn?.(name, opts);
  } catch { /* audio must never break the UI */ }
}

/* ------------------------------------------------------------------ */
/* Monkey portraits (2D canvas, cached)                                */
/* ------------------------------------------------------------------ */

const portraitCache = new Map();

/**
 * Paint a cheap 2D portrait from a CharacterDef build (fur/face colors,
 * ears). Used in HUD chips, lobby seats and results. Cached per id:size.
 *
 * @param {import('#shared/types.js').CharacterDef|null} def
 * @param {number} [size]
 * @returns {string} data URL
 */
export function portraitFor(def, size = 64) {
  const key = `${def?.id ?? 'none'}:${size}`;
  const hit = portraitCache.get(key);
  if (hit) return hit;

  const fur = def?.build?.furColor ?? '#8a6d4a';
  const face = def?.build?.faceColor ?? '#e8c9a0';
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const s = size / 100;
  ctx.scale(s, s);

  // Background disc.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.arc(50, 50, 48, 0, Math.PI * 2);
  ctx.fill();

  // Ears.
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.arc(18, 42, 14, 0, Math.PI * 2);
  ctx.arc(82, 42, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.arc(18, 42, 7, 0, Math.PI * 2);
  ctx.arc(82, 42, 7, 0, Math.PI * 2);
  ctx.fill();

  // Head.
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.arc(50, 50, 32, 0, Math.PI * 2);
  ctx.fill();

  // Face patch + muzzle.
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.ellipse(50, 58, 20, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(38, 44, 10, 12, 0, 0, Math.PI * 2);
  ctx.ellipse(62, 44, 10, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes.
  ctx.fillStyle = '#1c130a';
  ctx.beginPath();
  ctx.arc(40, 46, 4, 0, Math.PI * 2);
  ctx.arc(60, 46, 4, 0, Math.PI * 2);
  ctx.fill();

  // Nostrils + smile.
  ctx.beginPath();
  ctx.arc(46, 58, 1.8, 0, Math.PI * 2);
  ctx.arc(54, 58, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1c130a';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(50, 60, 10, Math.PI * 0.2, Math.PI * 0.8);
  ctx.stroke();

  const url = canvas.toDataURL('image/png');
  portraitCache.set(key, url);
  return url;
}

/** <img> portrait element for a character def. */
export function portraitImg(def, size = 48, className = '') {
  const img = el('img', `ui-portrait ${className}`.trim());
  img.src = portraitFor(def, size * 2);
  img.width = size;
  img.height = size;
  img.alt = def?.name ?? 'monkey';
  img.draggable = false;
  return img;
}

/* ------------------------------------------------------------------ */
/* Difficulty stars                                                    */
/* ------------------------------------------------------------------ */

/** Row of 5 stars, `n` filled (board difficulty). */
export function starRow(n) {
  const row = div('ui-stars');
  for (let i = 0; i < 5; i += 1) {
    row.append(el('span', i < n ? 'ui-star ui-star--on' : 'ui-star', '★'));
  }
  return row;
}

/* ------------------------------------------------------------------ */
/* Countdown ring (prompt auto-default timer)                          */
/* ------------------------------------------------------------------ */

/**
 * Circular countdown. Returns { root, cancel }. Calls onExpire once when
 * the time runs out (unless cancelled first).
 *
 * @param {number} seconds
 * @param {() => void} onExpire
 */
export function countdownRing(seconds, onExpire) {
  const root = div('ui-countdown');
  const label = div('ui-countdown__num', String(Math.ceil(seconds)));
  root.appendChild(label);

  let remaining = seconds;
  let done = false;
  const interval = setInterval(() => {
    remaining -= 0.25;
    const shown = Math.max(0, Math.ceil(remaining));
    label.textContent = String(shown);
    root.style.setProperty('--cd', String(1 - remaining / seconds));
    if (remaining <= 3.2) root.classList.add('ui-countdown--hot');
    if (remaining <= 0 && !done) {
      done = true;
      clearInterval(interval);
      try {
        onExpire();
      } catch (err) {
        console.error('[ui] countdown onExpire threw:', err);
      }
    }
  }, 250);

  return {
    root,
    cancel() {
      done = true;
      clearInterval(interval);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Toasts                                                              */
/* ------------------------------------------------------------------ */

let toastHost = null;

/** Transient toast message (errors, info). */
export function toast(message, kind = 'info', ms = 3200) {
  if (!toastHost || !toastHost.isConnected) {
    toastHost = div('ui-toasts');
    (document.getElementById('ui-root') ?? document.body).appendChild(toastHost);
  }
  const item = div(`ui-toast ui-toast--${kind}`, message);
  toastHost.appendChild(item);
  requestAnimationFrame(() => item.classList.add('ui-toast--in'));
  setTimeout(() => {
    item.classList.remove('ui-toast--in');
    setTimeout(() => item.remove(), 350);
  }, ms);
}

/* ------------------------------------------------------------------ */
/* Overlay scaffolding (modals, prompts)                               */
/* ------------------------------------------------------------------ */

/**
 * Full-screen overlay layer holding a centered panel. Returns
 * { root, panel, close() }. `opts.dim` dims the backdrop, `opts.bottom`
 * docks the panel to the lower third (decision prompts over the board).
 */
export function overlay(opts = {}) {
  const root = div(`ui-overlay${opts.dim ? ' ui-overlay--dim' : ''}${opts.bottom ? ' ui-overlay--bottom' : ''}`);
  const panel = div(`ui-overlay__panel ${opts.className ?? ''}`.trim());
  root.appendChild(panel);
  (opts.host ?? document.getElementById('ui-root') ?? document.body).appendChild(root);
  requestAnimationFrame(() => root.classList.add('ui-overlay--in'));
  let closed = false;
  return {
    root,
    panel,
    close() {
      if (closed) return;
      closed = true;
      root.classList.remove('ui-overlay--in');
      setTimeout(() => root.remove(), 220);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Animated number count-up                                            */
/* ------------------------------------------------------------------ */

/**
 * Animate a numeric element from `from` to `to` over `ms` (coin count-ups).
 * Returns a cancel function.
 */
export function countUp(node, from, to, ms = 900, format = (v) => String(v)) {
  const start = performance.now();
  let raf = 0;
  const tickSfxEvery = Math.max(1, Math.round(Math.abs(to - from) / 8));
  let lastShown = from;
  function frame(now) {
    const k = Math.min(1, (now - start) / ms);
    const eased = 1 - (1 - k) ** 3;
    const value = Math.round(from + (to - from) * eased);
    if (value !== lastShown) {
      if (Math.abs(value - from) % tickSfxEvery === 0) playSfx('tick', { vol: 0.4 });
      lastShown = value;
      node.textContent = format(value);
    }
    if (k < 1) raf = requestAnimationFrame(frame);
  }
  node.textContent = format(from);
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}

/* ------------------------------------------------------------------ */
/* Labeled form rows                                                   */
/* ------------------------------------------------------------------ */

/** Label + arbitrary control in a settings/rules row. */
export function fieldRow(labelText, control, className = '') {
  const row = div(`ui-field ${className}`.trim());
  const label = el('label', 'ui-field__label', labelText);
  row.append(label, control);
  return row;
}

/** <select> from [{value,label}] with change handler. */
export function select(options, value, onChange, className = '') {
  const s = el('select', `ui-select ${className}`.trim());
  for (const opt of options) {
    const o = el('option', '', opt.label);
    o.value = opt.value;
    if (opt.value === value) o.selected = true;
    s.appendChild(o);
  }
  if (onChange) {
    s.addEventListener('change', () => {
      playSfx('click');
      onChange(s.value);
    });
  }
  return s;
}

/** Toggle switch; onChange(bool). */
export function toggle(checked, onChange, className = '') {
  const wrap = el('button', `ui-toggle ${checked ? 'ui-toggle--on' : ''} ${className}`.trim());
  wrap.type = 'button';
  wrap.setAttribute('role', 'switch');
  wrap.setAttribute('aria-checked', String(!!checked));
  wrap.appendChild(div('ui-toggle__knob'));
  wrap.addEventListener('click', () => {
    if (wrap.disabled) return;
    const on = !wrap.classList.contains('ui-toggle--on');
    wrap.classList.toggle('ui-toggle--on', on);
    wrap.setAttribute('aria-checked', String(on));
    playSfx('click');
    onChange?.(on);
  });
  return wrap;
}

/** Range slider with live value bubble; onChange(number). */
export function slider(min, max, step, value, onChange, format = (v) => String(v)) {
  const wrap = div('ui-slider');
  const input = el('input', 'ui-slider__input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  const bubble = el('span', 'ui-slider__value', format(value));
  input.addEventListener('input', () => {
    const v = Number(input.value);
    bubble.textContent = format(v);
    onChange?.(v);
  });
  wrap.append(input, bubble);
  return wrap;
}
