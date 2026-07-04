/**
 * Main menu screen: title, Local Game (couch setup: seats + devices),
 * Online (quick match / lobby browser / private lobby / join code),
 * statistics, settings, and the en/de language toggle.
 */

import { MSG } from '#shared/protocol.js';
import { createOfflineSession, createOnlineSession } from '../app/session.js';
import { t, setLang, getLang, onLangChange } from './i18n.js';
import { el, div, button, clearNode, overlay, toast, select, playSfx } from './dom.js';

const MAX_LOCAL = 8; // total local seats offered in the couch setup
const MAX_DEVICE_SEATS = 4; // src/engine/input.js binds devices to seats 0..3

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

export function createMainMenuScreen(ctx) {
  let root = null;
  let unsubLang = null;

  /* ---------------- local couch setup ---------------- */

  function openLocalSetup() {
    const modal = overlay({ dim: true, className: 'ui-scroll-y' });
    const seats = [{ name: ctx.profile.get().name || 'Player 1', device: 'kb1' }];
    const defaults = ['kb1', 'kb2', 'kb3', 'gamepad0'];

    function deviceOptions(seatIdx) {
      if (seatIdx >= MAX_DEVICE_SEATS) {
        return [{ value: '', label: t('local.noDevice') }];
      }
      return ctx.input.devices().map((d) => ({
        value: d.id,
        label: d.connected ? d.label : `${d.label} (—)`,
      }));
    }

    function render() {
      clearNode(modal.panel);
      modal.panel.appendChild(el('h2', 'ui-heading', t('local.title')));

      const counter = div('seat-count');
      const minus = button('−', 'ui-btn--wood seat-count__btn', () => {
        if (seats.length > 1) {
          seats.pop();
          render();
        }
      });
      const num = div('seat-count__num', String(seats.length));
      const plus = button('+', 'ui-btn--wood seat-count__btn', () => {
        if (seats.length < MAX_LOCAL) {
          const i = seats.length;
          seats.push({ name: `${t('generic.player')} ${i + 1}`, device: defaults[i] ?? '' });
          render();
        }
      });
      counter.append(el('span', 'ui-section-label', t('local.players')), minus, num, plus);
      modal.panel.appendChild(counter);

      const list = div('local-seats');
      seats.forEach((seat, i) => {
        const row = div('local-seat');
        row.appendChild(div('local-seat__num', String(i + 1)));
        const nameInput = el('input', 'ui-input');
        nameInput.type = 'text';
        nameInput.maxLength = 16;
        nameInput.value = seat.name;
        nameInput.placeholder = t('local.name');
        nameInput.addEventListener('input', () => {
          seat.name = nameInput.value;
        });
        const deviceSel = select(deviceOptions(i), seat.device, (v) => {
          seat.device = v;
        });
        if (i >= MAX_DEVICE_SEATS) deviceSel.disabled = true;
        row.append(nameInput, deviceSel);
        list.appendChild(row);
      });
      modal.panel.appendChild(list);
      modal.panel.appendChild(div('ui-dim', t('local.hint')));

      const actions = div('ui-row');
      actions.style.marginTop = '16px';
      actions.append(
        button(t('generic.cancel'), 'ui-btn--ghost', () => modal.close()),
        button(t('local.start'), 'ui-btn--green ui-btn--big', () => {
          startLocal();
          modal.close();
        }),
      );
      modal.panel.appendChild(actions);
    }

    function startLocal() {
      // Bind each seat's chosen device (input package supports seats 0..3).
      seats.forEach((seat, i) => {
        if (i < MAX_DEVICE_SEATS && seat.device) {
          try {
            ctx.input.bindSeat(i, seat.device);
          } catch (err) {
            console.warn('[ui] bindSeat failed:', err);
          }
        }
      });
      const session = createOfflineSession({
        localPlayers: seats.map((s, i) => ({
          pid: `p${i + 1}`,
          name: s.name.trim() || `${t('generic.player')} ${i + 1}`,
        })),
      });
      // Local humans are ready by definition (couch play).
      for (const seat of session.getLobby().seats) session.setReady(seat.pid, true);
      const boards = ctx.registries.boards.ids();
      if (boards.length > 0) session.setBoard(boards[0]);
      ctx.setSession(session);
      ctx.router.go('lobby');
    }

    render();
  }

  /* ---------------- online flows ---------------- */

  async function connectOnline() {
    const client = await withTimeout(ctx.ensureNet(), 6000, t('menu.connectFail'));
    client.send(MSG.HELLO, { name: ctx.profile.get().name || 'Monkey' });
    return client;
  }

  async function startOnline(afterConnect) {
    const info = toastOnce(t('menu.connecting'));
    try {
      const client = await connectOnline();
      const session = createOnlineSession(client);
      ctx.setSession(session);

      // Navigate to the lobby as soon as the server confirms one.
      const offLobby = session.on('lobby_state', (lobby) => {
        offLobby();
        if (lobby) ctx.router.go('lobby');
      });
      const offErr = client.on('error', (msg) => {
        offErr();
        toast(msg?.msg ?? 'Server error', 'error');
      });
      afterConnect(client, session);
    } catch (err) {
      try {
        ctx.getNetClient()?.close();
      } catch { /* already closed */ }
      toast(err?.message ?? String(err), 'error');
    } finally {
      info?.();
    }
  }

  function toastOnce(message) {
    toast(message, 'info', 1800);
    return null;
  }

  function openOnlineMenu() {
    const modal = overlay({ dim: true });
    modal.panel.appendChild(el('h2', 'ui-heading', t('menu.online')));
    const col = div('mm-buttons');
    col.append(
      button(t('menu.quick'), 'ui-btn--green', () => {
        modal.close();
        startOnline((client) => client.send(MSG.QUICK_MATCH, {}));
      }),
      button(t('menu.browser'), '', () => {
        modal.close();
        ctx.router.go('lobbyBrowser');
      }),
      button(t('menu.private'), '', () => {
        modal.close();
        startOnline((client) => {
          const boardId = ctx.registries.boards.ids()[0] ?? 'jungle_ruins';
          client.send(MSG.CREATE_LOBBY, { isPublic: false, rules: {}, boardId });
        });
      }),
      button(t('menu.joinCode'), '', () => {
        modal.close();
        openJoinCode();
      }),
      button(t('generic.back'), 'ui-btn--ghost', () => modal.close()),
    );
    modal.panel.appendChild(col);
  }

  function openJoinCode() {
    const modal = overlay({ dim: true });
    modal.panel.appendChild(el('h2', 'ui-heading', t('menu.joinCode')));
    const input = el('input', 'ui-input');
    input.type = 'text';
    input.maxLength = 8;
    input.placeholder = t('menu.codePrompt');
    input.style.cssText = 'font-size:1.5rem;letter-spacing:0.3em;text-align:center;text-transform:uppercase;';
    const row = div('ui-row');
    row.style.marginTop = '14px';
    const join = () => {
      const code = input.value.trim().toUpperCase();
      if (!code) return;
      modal.close();
      startOnline((client) => client.send(MSG.JOIN_LOBBY, { code }));
    };
    row.append(
      button(t('generic.cancel'), 'ui-btn--ghost', () => modal.close()),
      button(t('menu.join'), 'ui-btn--green', join),
    );
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') join();
    });
    modal.panel.append(input, row);
    setTimeout(() => input.focus(), 80);
  }

  /* ---------------- render ---------------- */

  function render() {
    clearNode(root);

    // Floating decorative bananas.
    for (const [x, y, delay] of [[8, 16, 0], [86, 24, 1.4], [14, 74, 2.6], [90, 70, 0.7]]) {
      const b = div('mm-banana', '🍌');
      b.style.left = `${x}%`;
      b.style.top = `${y}%`;
      b.style.animationDelay = `${delay}s`;
      root.appendChild(b);
    }

    const lang = div('mm-lang');
    for (const code of ['en', 'de']) {
      const b = button(code.toUpperCase(), 'ui-btn--small ui-btn--wood', () => setLang(code));
      b.setAttribute('aria-pressed', String(getLang() === code));
      lang.appendChild(b);
    }
    root.appendChild(lang);

    const wrap = div('ui-screen');
    wrap.append(
      el('h1', 'ui-title', t('app.title')),
      el('p', 'ui-subtitle', t('app.tagline')),
    );

    const buttons = div('mm-buttons');
    const mainBtn = (label, sub, cls, fn) => {
      const b = button('', `mm-btn ${cls}`.trim(), fn);
      b.append(el('span', '', label), el('span', 'mm-btn__sub', sub));
      return b;
    };
    buttons.append(
      mainBtn(t('menu.local'), t('menu.local.sub'), 'ui-btn--green', openLocalSetup),
      mainBtn(t('menu.online'), t('menu.online.sub'), '', openOnlineMenu),
      button(t('menu.stats'), 'ui-btn--wood', () => ctx.router.go('stats')),
      button(t('menu.settings'), 'ui-btn--wood', () => ctx.router.go('settings')),
    );
    wrap.appendChild(buttons);
    root.appendChild(wrap);
  }

  return {
    mount(elHost) {
      root = elHost;
      render();
      unsubLang = onLangChange(render);
      const charDefs = ctx.registries.characters.all();
      ctx.stage.menu(charDefs.slice(0, 3));
      ctx.music.play('menu');
      playSfx('hover');
    },
    unmount() {
      unsubLang?.();
      unsubLang = null;
      root = null;
    },
  };
}
