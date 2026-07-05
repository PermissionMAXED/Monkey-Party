/**
 * Radial 6-emote wheel: hold Tab (keyboard), two-finger long-press
 * (touch, anywhere), or single-finger long-press on the RIGHT half of
 * the screen (touch-friendly path; the left half belongs to the virtual
 * joystick) to open, release over a wedge (or click/tap it) to send
 * session.sendEmote(id). Tapping the backdrop dismisses the wheel.
 * Usable in the lobby AND in-match.
 */

import { el, div, playSfx } from './dom.js';

const EMOTES = [
  { id: 'dance', glyph: '💃' },
  { id: 'taunt', glyph: '😝' },
  { id: 'laugh', glyph: '😂' },
  { id: 'cry', glyph: '😭' },
  { id: 'flex', glyph: '💪' },
  { id: 'facepalm', glyph: '🤦' },
];

const LONG_PRESS_MS = 450;

/**
 * @param {*} ctx UI context (unused today; kept for parity with screens).
 * @param {import('#shared/types.js').ISession} session
 * @param {HTMLElement} host Where the wheel overlay is appended.
 * @returns {{dispose: () => void, open: () => void, close: () => void}}
 */
export function attachEmoteWheel(ctx, session, host) {
  let wheel = null;
  let hovered = null;
  let pressTimer = null;

  function send(id) {
    if (!id) return;
    try {
      session.sendEmote(id);
      playSfx('pop', { vol: 0.5 });
    } catch { /* emotes are best-effort */ }
  }

  function close(sendHovered = false) {
    if (sendHovered && hovered) send(hovered);
    hovered = null;
    wheel?.remove();
    wheel = null;
  }

  function open() {
    if (wheel || !host?.isConnected) return;
    hovered = null;
    wheel = div('emote-wheel');
    const hub = div('emote-wheel__hub');
    hub.appendChild(div('emote-wheel__center', 'Tab'));
    EMOTES.forEach((e, i) => {
      const angle = (i / EMOTES.length) * Math.PI * 2 - Math.PI / 2;
      const btn = el('button', 'emote-btn');
      btn.type = 'button';
      btn.textContent = e.glyph;
      btn.appendChild(el('span', '', e.id));
      btn.style.left = `${50 + Math.cos(angle) * 38}%`;
      btn.style.top = `${50 + Math.sin(angle) * 38}%`;
      btn.addEventListener('mouseenter', () => {
        hovered = e.id;
      });
      btn.addEventListener('mouseleave', () => {
        if (hovered === e.id) hovered = null;
      });
      btn.addEventListener('click', () => {
        send(e.id);
        close();
      });
      hub.appendChild(btn);
    });
    wheel.appendChild(hub);
    // Touch users have no Tab to release: tapping the backdrop dismisses.
    wheel.addEventListener('pointerdown', (e) => {
      if (e.target === wheel) close();
    });
    host.appendChild(wheel);
  }

  function onKeyDown(e) {
    if (e.key !== 'Tab' || e.repeat) return;
    // Don't steal Tab while typing in an input.
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    e.preventDefault();
    open();
  }

  function onKeyUp(e) {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    close(true);
  }

  let pressStart = null;

  function armPress(touch) {
    pressStart = touch ? { x: touch.clientX, y: touch.clientY } : null;
    clearTimeout(pressTimer);
    pressTimer = setTimeout(open, LONG_PRESS_MS);
  }

  function onTouchStart(e) {
    if (e.touches?.length === 2) {
      // Two-finger long-press anywhere (legacy gesture).
      armPress(e.touches[0]);
      return;
    }
    if (e.touches?.length !== 1) return;
    // Single-finger long-press on the RIGHT half of the screen; skip
    // interactive elements and the virtual touch controls.
    const touch = e.touches[0];
    if (touch.clientX < window.innerWidth / 2) return;
    if (e.target?.closest?.('button, input, textarea, select, a, #mp-touch-controls')) return;
    armPress(touch);
  }

  function onTouchMove(e) {
    // A moving finger is a drag (camera/scroll), not a long-press.
    if (pressTimer === null || !pressStart) return;
    const touch = e.touches?.[0];
    if (!touch) return;
    if (Math.hypot(touch.clientX - pressStart.x, touch.clientY - pressStart.y) > 14) onTouchEnd();
  }

  function onTouchEnd() {
    clearTimeout(pressTimer);
    pressTimer = null;
    pressStart = null;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: true });
  window.addEventListener('touchend', onTouchEnd);
  window.addEventListener('touchcancel', onTouchEnd);

  return {
    open,
    close,
    dispose() {
      close();
      clearTimeout(pressTimer);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    },
  };
}

export default attachEmoteWheel;
