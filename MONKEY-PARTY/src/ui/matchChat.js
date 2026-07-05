/**
 * In-match chat for ONLINE sessions: a collapsed feed of the last ~8
 * SRV.CHAT relays (player names tinted with the seat --mp-p* palette,
 * pid ''/null rendered as system lines) that auto-fades, plus an input
 * row toggled by Enter or the chat icon. Sends MSG.CHAT through the net
 * client (the server relays chat mid-match).
 *
 * Input hygiene: while CLOSED nothing but the bare Enter key is observed
 * (never when another input is focused), so game input is untouched.
 * While OPEN the text input stops key propagation so typing cannot leak
 * into the engine's global key listeners. Escape closes the chat (the
 * pause menu also checks isOpen() before reacting to Escape).
 *
 * attachMatchChat(ctx, session, host) -> {root, isOpen, open, close,
 * dispose} or null for offline sessions.
 */

import { MSG } from '#shared/protocol.js';
import { el, div, button, playSfx } from './dom.js';
import { tm } from './matchStrings.js';

const MAX_ROWS = 8;
const FADE_AFTER_MS = 8000;

export function attachMatchChat(ctx, session, host) {
  if (!session || session.mode !== 'online' || !host) return null;

  let isOpen = false;
  let disposed = false;
  const unsubs = [];
  /** @type {HTMLElement[]} rendered rows, oldest first. */
  const rows = [];

  const root = div('match-chat');
  const feed = div('match-chat__feed');
  const bar = div('match-chat__bar');
  const toggleBtn = button('💬', 'ui-btn--ghost ui-btn--small match-chat__toggle', () => setOpen(!isOpen));
  toggleBtn.title = tm('match.chat.open');
  const input = el('input', 'ui-input match-chat__input');
  input.type = 'text';
  input.maxLength = 160;
  input.placeholder = tm('match.chat.placeholder');
  const sendBtn = button(tm('match.chat.send'), 'ui-btn--small ui-btn--green match-chat__send', send);
  bar.append(toggleBtn, input, sendBtn);
  root.append(feed, bar);
  host.appendChild(root);

  /* ---------------- identity / colors ---------------- */

  /** Player display name + turn-order index (drives the --mp-p* tint). */
  function authorFor(pid) {
    try {
      const state = session.getSim?.()?.getState?.();
      const p = state?.players?.[pid];
      if (p?.name) return { name: p.name, idx: state.turnOrder?.indexOf?.(pid) ?? -1 };
    } catch { /* replica not ready yet */ }
    try {
      const seats = session.getLobby?.()?.seats ?? [];
      const i = seats.findIndex((s) => s.pid === pid);
      if (i !== -1) return { name: seats[i].name ?? pid, idx: i };
    } catch { /* no lobby either */ }
    return { name: pid, idx: -1 };
  }

  /* ---------------- feed ---------------- */

  function armFade(row) {
    setTimeout(() => {
      if (!isOpen) row.classList.add('match-chat__row--faded');
    }, FADE_AFTER_MS);
  }

  function pushMessage(msg) {
    if (disposed) return;
    const text = String(msg?.text ?? '').trim();
    if (!text) return;
    const row = div('match-chat__row');
    if (!msg?.pid) {
      // pid ''/null marks a server system notice.
      row.classList.add('match-chat__row--system');
      row.appendChild(el('span', 'match-chat__text', text));
      row.title = tm('match.chat.system');
    } else {
      const { name, idx } = authorFor(msg.pid);
      const author = el('b', 'match-chat__name', `${name}:`);
      if (idx >= 0 && idx < 8) author.style.color = `var(--mp-p${idx + 1})`;
      row.append(author, el('span', 'match-chat__text', text));
    }
    feed.appendChild(row);
    rows.push(row);
    while (rows.length > MAX_ROWS) rows.shift()?.remove();
    feed.scrollTop = feed.scrollHeight;
    if (!isOpen) armFade(row);
  }

  /* ---------------- open / close / send ---------------- */

  function setOpen(next) {
    if (disposed || isOpen === next) return;
    isOpen = next;
    root.classList.toggle('match-chat--open', isOpen);
    if (isOpen) {
      for (const row of rows) row.classList.remove('match-chat__row--faded');
      playSfx('hover', { vol: 0.3 });
      setTimeout(() => input.focus(), 30);
    } else {
      input.blur();
      for (const row of rows) armFade(row);
    }
  }

  function send() {
    const text = input.value.trim();
    input.value = '';
    if (!text) return;
    try {
      ctx.getNetClient?.()?.send?.(MSG.CHAT, { text });
    } catch (err) {
      console.warn('[chat] send failed:', err);
    }
  }

  /* Typing must never leak into the engine's global key listeners. */
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      send();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  });
  input.addEventListener('keyup', (e) => e.stopPropagation());

  /* Bare Enter opens the chat - only when no other input is focused. */
  function onKeyDown(e) {
    if (e.key !== 'Enter' || e.repeat || disposed) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    e.preventDefault();
    setOpen(true);
  }
  window.addEventListener('keydown', onKeyDown);

  try {
    const off = session.on('chat', pushMessage);
    if (typeof off === 'function') unsubs.push(off);
  } catch { /* sessions without events */ }

  return {
    root,
    isOpen: () => isOpen,
    open: () => setOpen(true),
    close: () => setOpen(false),
    dispose() {
      if (disposed) return;
      disposed = true;
      window.removeEventListener('keydown', onKeyDown);
      for (const off of unsubs.splice(0)) {
        try {
          off();
        } catch { /* gone */ }
      }
      root.remove();
      rows.length = 0;
    },
  };
}

export default attachMatchChat;
