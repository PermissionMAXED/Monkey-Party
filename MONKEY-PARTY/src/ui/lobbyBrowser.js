/**
 * Public lobby browser (online): table of open lobbies with join/refresh.
 * Creates the online session lazily on join so lobby_state is captured.
 */

import { MSG } from '#shared/protocol.js';
import { createOnlineSession } from '../app/session.js';
import { t, onLangChange } from './i18n.js';
import { el, div, button, clearNode, toast } from './dom.js';

export function createLobbyBrowserScreen(ctx) {
  let root = null;
  let unsubs = [];
  let lobbies = [];
  let loading = false;

  async function connect() {
    const client = await ctx.ensureNet();
    client.send(MSG.HELLO, { name: ctx.profile.get().name || 'Monkey' });
    return client;
  }

  async function refresh() {
    loading = true;
    render();
    try {
      const client = await connect();
      client.send(MSG.LIST_LOBBIES, {});
    } catch (err) {
      loading = false;
      toast(err?.message ?? t('menu.connectFail'), 'error');
      render();
    }
  }

  async function join(code) {
    try {
      const client = await connect();
      const session = createOnlineSession(client);
      ctx.setSession(session);
      const off = session.on('lobby_state', (lobby) => {
        off();
        if (lobby) ctx.router.go('lobby');
      });
      client.send(MSG.JOIN_LOBBY, { code });
    } catch (err) {
      toast(err?.message ?? t('menu.connectFail'), 'error');
    }
  }

  function render() {
    if (!root) return;
    clearNode(root);
    const wrap = div('ui-screen');
    wrap.appendChild(el('h1', 'ui-heading', t('browser.title')));

    const table = div('browser-table');
    const head = div('browser-row browser-row--head');
    head.append(
      el('span', '', t('lobby.code')),
      el('span', '', t('browser.host')),
      el('span', '', t('browser.players')),
      el('span', '', ''),
    );
    table.appendChild(head);

    if (lobbies.length === 0) {
      table.appendChild(div('ui-dim', loading ? t('menu.connecting') : t('browser.empty')));
    }
    for (const lobby of lobbies) {
      const row = div('browser-row');
      row.append(
        el('b', '', lobby.code ?? '—'),
        el('span', '', lobby.host ?? lobby.hostName ?? '—'),
        el('span', '', `${lobby.players ?? lobby.seatCount ?? '?'} / ${lobby.maxSeats ?? 8}`),
        button(t('browser.join'), 'ui-btn--small ui-btn--green', () => join(lobby.code)),
      );
      table.appendChild(row);
    }
    wrap.appendChild(table);

    const actions = div('ui-row');
    actions.append(
      button(t('generic.back'), 'ui-btn--ghost', () => ctx.router.go('mainMenu')),
      button(t('browser.refresh'), 'ui-btn--wood', () => refresh()),
    );
    wrap.appendChild(actions);
    root.appendChild(wrap);
  }

  return {
    mount(elHost) {
      root = elHost;
      render();
      unsubs.push(onLangChange(render));
      // Listen for lobby lists on the raw client (available after connect).
      refresh().then(() => {
        const client = ctx.getNetClient();
        if (client) {
          const off = client.on('lobby_list', (msg) => {
            lobbies = Array.isArray(msg?.lobbies) ? msg.lobbies : [];
            loading = false;
            render();
          });
          if (typeof off === 'function') unsubs.push(off);
        }
      });
      ctx.stage.menu(ctx.registries.characters.all().slice(0, 3));
    },
    unmount() {
      for (const off of unsubs) {
        try {
          off();
        } catch { /* gone */ }
      }
      unsubs = [];
      root = null;
    },
  };
}
