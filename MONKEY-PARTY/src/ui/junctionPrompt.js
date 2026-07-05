/**
 * Board decision prompts rendered over the 3D view (bottom-docked):
 *   - promptFrame: shared scaffolding (title + countdown + auto-default)
 *   - showJunctionPrompt: arrow buttons for each open path
 *   - showDicePickPrompt: competitive dice-draft cards
 * Every prompt runs a ~20s countdown with a sensible auto-default so the
 * game never hangs. Each returns {close()}.
 *
 * INPUT PARITY: promptFrame also polls the deciding local seat's
 * InputFrame (setPromptInputSource, wired by the board-play view) and maps
 * d-pad/stick to option focus + the A button to confirm, so gamepad- and
 * keyboard-bound seats can answer prompts without a mouse. Mouse/touch and
 * the auto-default countdown are untouched.
 */

import { t } from './i18n.js';
import { el, div, button, overlay, countdownRing, playSfx } from './dom.js';

export const PROMPT_SECONDS = 20;

/* ------------------------------------------------------------------ */
/* Gamepad / keyboard prompt navigation (input parity)                 */
/* ------------------------------------------------------------------ */

/** The deciding seat's input source ({input, seat}). Stored on globalThis
 * (Symbol.for key) on purpose: prompts are opened by the match controller,
 * which has no seat context - the board-play view sets this right before
 * each request through a @vite-ignore dynamic import, which the dev server
 * may resolve to a SECOND module instance (HMR `?t=` URLs). A shared global
 * slot works regardless of module identity; it is presentation-only. */
const NAV_SOURCE_KEY = Symbol.for('monkeyparty.promptInputSource');

/**
 * Wire (or clear, with null) the input source the prompts poll.
 * @param {{input: {getFrame: Function}, seat: number}|null} source
 */
export function setPromptInputSource(source) {
  globalThis[NAV_SOURCE_KEY] = typeof source?.input?.getFrame === 'function' ? source : null;
}

function getPromptInputSource() {
  return globalThis[NAV_SOURCE_KEY] ?? null;
}

const NAV_POLL_MS = 50;
const NAV_AXIS_ON = 0.55; // stick/d-pad press threshold
const NAV_AXIS_OFF = 0.35; // release threshold (hysteresis, one step per push)

/**
 * Map the deciding seat's InputFrame onto a container's buttons: d-pad or
 * stick up/down/left/right moves focus, A activates the focused button
 * (the FIRST A press only grabs focus, never blind-confirms). Buttons are
 * re-queried every poll so dynamic content stays navigable; disabled
 * buttons are skipped. Returns {stop}.
 *
 * @param {HTMLElement} container
 * @param {{selector?: string}} [opts]
 */
export function attachPadNav(container, { selector = 'button' } = {}) {
  if (typeof document === 'undefined' || !container) return { stop() {} };
  let focusedBtn = null;
  let prevA = true; // require a fresh A press (ignore a held-over button)
  let axisHeld = true; // likewise: the stick must return to neutral first

  function markFocus(btn) {
    if (focusedBtn === btn) return;
    if (focusedBtn) {
      focusedBtn.style.outline = '';
      focusedBtn.style.outlineOffset = '';
    }
    focusedBtn = btn ?? null;
    if (!btn) return;
    btn.style.outline = '3px solid #fff';
    btn.style.outlineOffset = '2px';
    try {
      btn.focus({ preventScroll: true }); // Enter/Space keep working too
    } catch { /* focus is best-effort */ }
  }

  const timer = setInterval(() => {
    if (!container.isConnected) {
      stop();
      return;
    }
    const source = getPromptInputSource();
    if (!source) return;
    let frame;
    try {
      frame = source.input.getFrame(source.seat);
    } catch {
      return;
    }
    const list = [...container.querySelectorAll(selector)].filter((b) => !b.disabled);
    if (list.length === 0) return;
    if (focusedBtn && (!focusedBtn.isConnected || focusedBtn.disabled)) markFocus(null);

    const mx = frame?.move?.x ?? 0;
    const my = frame?.move?.y ?? 0;
    const magnitude = Math.hypot(mx, my);
    let step = 0;
    if (!axisHeld && magnitude >= NAV_AXIS_ON) {
      // Right/down -> next, left/up -> previous (prompts lay out in rows).
      step = Math.abs(mx) >= Math.abs(my) ? (mx > 0 ? 1 : -1) : (my > 0 ? -1 : 1);
      axisHeld = true;
    } else if (axisHeld && magnitude <= NAV_AXIS_OFF) {
      axisHeld = false;
    }
    if (step !== 0) {
      playSfx('hover', { vol: 0.25 });
      const current = focusedBtn ? list.indexOf(focusedBtn) : -1;
      const next = current === -1
        ? (step > 0 ? 0 : list.length - 1)
        : (current + step + list.length) % list.length;
      markFocus(list[next]);
    }

    const a = Boolean(frame?.a);
    if (a && !prevA) {
      if (focusedBtn) focusedBtn.click();
      else markFocus(list[0]);
    }
    prevA = a;
  }, NAV_POLL_MS);

  function stop() {
    clearInterval(timer);
    markFocus(null);
  }

  return { stop };
}

/**
 * Shared bottom-docked prompt scaffolding with countdown + auto default.
 * onDefault fires once when the timer expires (the caller answers).
 * Pad/keyboard navigation is attached to the panel (see attachPadNav).
 */
export function promptFrame(title, { seconds = PROMPT_SECONDS, onDefault = null, dim = false } = {}) {
  const modal = overlay({ bottom: !dim, dim });
  const head = el('h2', 'prompt-title', title);
  let ring = null;
  if (onDefault) {
    ring = countdownRing(seconds, () => {
      playSfx('tick');
      onDefault();
    });
    head.appendChild(ring.root);
  }
  modal.panel.appendChild(head);
  const body = div();
  modal.panel.appendChild(body);
  const nav = attachPadNav(modal.panel);
  return {
    body,
    panel: modal.panel,
    close() {
      nav.stop();
      ring?.cancel();
      modal.close();
    },
  };
}

/**
 * @param {{
 *   options: string[] Open path node ids,
 *   angleFor?: (nodeId: string) => number|null Screen-space angle (rad),
 *   labelFor?: (nodeId: string) => string,
 *   onPick: (nodeId: string) => void,
 * }} opts
 */
export function showJunctionPrompt({ options = [], angleFor = null, labelFor = null, onPick }) {
  let done = false;
  const frame = promptFrame(t('prompt.junction'), {
    onDefault: () => answer(options[0]),
  });
  function answer(choice) {
    if (done) return;
    done = true;
    frame.close();
    onPick(choice);
  }
  const row = div('prompt-row');
  options.forEach((nodeId, i) => {
    const btn = button('', 'ui-btn--wood junction-btn', () => answer(nodeId));
    const angle = angleFor?.(nodeId);
    const arrow = el('span', '', '➜');
    arrow.style.display = 'inline-block';
    arrow.style.fontSize = '1.4em';
    if (typeof angle === 'number' && Number.isFinite(angle)) {
      arrow.style.transform = `rotate(${angle}rad)`;
    } else {
      arrow.style.transform = `rotate(${(i - (options.length - 1) / 2) * 0.5}rad)`;
    }
    btn.append(arrow, el('span', '', labelFor?.(nodeId) ?? nodeId));
    row.appendChild(btn);
  });
  frame.body.appendChild(row);
  return { close: frame.close };
}

/**
 * Competitive dice draft: pick one of the drawn values.
 * @param {{options: number[], onPick: (index: number) => void}} opts
 */
export function showDicePickPrompt({ options = [], onPick }) {
  let done = false;
  const frame = promptFrame(t('prompt.dicePick'), {
    onDefault: () => {
      // Default: the highest value (never a bad pick).
      let best = 0;
      options.forEach((v, i) => {
        if (v > options[best]) best = i;
      });
      answer(best);
    },
  });
  function answer(index) {
    if (done) return;
    done = true;
    frame.close();
    onPick(index);
  }
  const row = div('prompt-row');
  options.forEach((value, i) => {
    const card = el('button', 'dice-card');
    card.type = 'button';
    card.textContent = String(value);
    card.addEventListener('click', () => {
      playSfx('dice', { vol: 0.6 });
      answer(i);
    });
    row.appendChild(card);
  });
  frame.body.appendChild(row);
  return { close: frame.close };
}

export default showJunctionPrompt;
