/**
 * Radial 6-emote wheel: hold Tab (keyboard) or two-finger long-press
 * (touch) to open, release over a wedge (or click it) to send
 * session.sendEmote(id). Usable in the lobby AND in-match.
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

  function onTouchStart(e) {
    if (e.touches?.length !== 2) return; // two-finger long-press
    pressTimer = setTimeout(open, LONG_PRESS_MS);
  }

  function onTouchEnd() {
    clearTimeout(pressTimer);
    pressTimer = null;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchend', onTouchEnd);

  return {
    open,
    close,
    dispose() {
      close();
      clearTimeout(pressTimer);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    },
  };
}

export default attachEmoteWheel;
