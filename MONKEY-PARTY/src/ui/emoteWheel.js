/**
 * Radial 6-emote wheel: hold Tab (keyboard), two-finger long-press
 * (touch, anywhere), or single-finger long-press on the RIGHT half of
 * the screen (touch-friendly path; the left half belongs to the virtual
 * joystick) to open, release over a wedge (or click/tap it) to send
 * session.sendEmote(id). Tapping the backdrop dismisses the wheel.
 * Usable in the lobby AND in-match.
 *
 * Gamepad/keyboard parity: while the wheel is open, every local seat's
 * InputFrame (ctx.input) is polled - pointing the stick/d-pad highlights
 * the wedge in that direction and the A button sends it.
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

/* Gamepad/stick navigation while the wheel is open. */
const PAD_POLL_MS = 50;
const PAD_AXIS_ON = 0.5;
const MAX_LOCAL_SEATS = 4;

/**
 * @param {*} ctx UI context (ctx.input drives the gamepad/stick wedge
 *   selection; everything else is unused today).
 * @param {import('#shared/types.js').ISession} session
 * @param {HTMLElement} host Where the wheel overlay is appended.
 * @returns {{dispose: () => void, open: () => void, close: () => void}}
 */
export function attachEmoteWheel(ctx, session, host) {
  let wheel = null;
  let hovered = null;
  let pressTimer = null;
  let padTimer = null;
  let padPrevA = true; // require a fresh A press after opening
  let padBtn = null;

  function send(id) {
    if (!id) return;
    try {
      session.sendEmote(id);
      playSfx('pop', { vol: 0.5 });
    } catch { /* emotes are best-effort */ }
  }

  function markPadBtn(btn, id) {
    if (padBtn === btn) return;
    if (padBtn) {
      padBtn.style.outline = '';
      padBtn.style.outlineOffset = '';
      if (hovered && !id) hovered = null;
    }
    padBtn = btn ?? null;
    if (!btn) return;
    btn.style.outline = '3px solid #fff';
    btn.style.outlineOffset = '2px';
    hovered = id;
    playSfx('hover', { vol: 0.25 });
  }

  function stopPadNav() {
    clearInterval(padTimer);
    padTimer = null;
    markPadBtn(null, null);
  }

  /** Poll every local seat: stick direction highlights a wedge, A sends. */
  function startPadNav(buttons) {
    if (typeof ctx?.input?.getFrame !== 'function') return;
    padPrevA = true;
    padTimer = setInterval(() => {
      if (!wheel) {
        stopPadNav();
        return;
      }
      let anyA = false;
      let aim = null;
      for (let seat = 0; seat < MAX_LOCAL_SEATS; seat += 1) {
        let frame;
        try {
          frame = ctx.input.getFrame(seat);
        } catch {
          continue;
        }
        if (frame?.a) anyA = true;
        const mx = frame?.move?.x ?? 0;
        const my = frame?.move?.y ?? 0;
        if (!aim && Math.hypot(mx, my) >= PAD_AXIS_ON) aim = { mx, my };
      }
      if (aim) {
        // Wedge i sits at (i/N)*2pi - pi/2 in screen coords (y down);
        // InputFrame y is up, so flip it for the screen-space angle.
        const angle = Math.atan2(-aim.my, aim.mx);
        let best = 0;
        let bestDist = Infinity;
        buttons.forEach((entry, i) => {
          const wedge = (i / buttons.length) * Math.PI * 2 - Math.PI / 2;
          let d = Math.abs(angle - wedge) % (Math.PI * 2);
          if (d > Math.PI) d = Math.PI * 2 - d;
          if (d < bestDist) {
            bestDist = d;
            best = i;
          }
        });
        markPadBtn(buttons[best].btn, buttons[best].id);
      }
      if (anyA && !padPrevA && hovered) {
        send(hovered);
        close();
      }
      padPrevA = anyA;
    }, PAD_POLL_MS);
  }

  function close(sendHovered = false) {
    if (sendHovered && hovered) send(hovered);
    stopPadNav();
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
    const buttons = [];
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
      buttons.push({ btn, id: e.id });
    });
    wheel.appendChild(hub);
    // Touch users have no Tab to release: tapping the backdrop dismisses.
    wheel.addEventListener('pointerdown', (e) => {
      if (e.target === wheel) close();
    });
    host.appendChild(wheel);
    startPadNav(buttons);
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
