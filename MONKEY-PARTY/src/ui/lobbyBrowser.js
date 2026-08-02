/**
 * Public lobby browser (online): table of open lobbies with join/refresh
 * plus a "host a public lobby" action (the main menu only creates private
 * lobbies, so this screen is where public ones are born).
 * Creates the online session lazily on join/host so lobby_state is captured.
 * The list auto-refreshes every 10s while the screen is open (silently -
 * no loading flash, no error toasts for transient outages).
 *
 * Join/host failures (lobby filled up or started since the last refresh,
 * bad code, server at capacity) surface the server's error as a toast,
 * drop the half-made session and silently re-fetch the stale list.
 */

import { MSG } from '#shared/protocol.js';
import { createOnlineSession } from '../app/session.js';
import { t, onLangChange } from './i18n.js';
import { tNet } from './netStrings.js';
import { el, div, button, clearNode, toast } from './dom.js';

/** Auto-refresh cadence while the browser screen is open. */
const AUTO_REFRESH_MS = 10000;

export function createLobbyBrowserScreen(ctx) {
  let root = null;
  let unsubs = [];
  let lobbies = [];
  let loading = false;
  let autoTimer = null;
  /** True while a join/host round trip is in flight (guards double-clicks). */
  let entering = false;
  /** The net client our lobby_list listener is bound to (it may be
   *  REPLACED after a fatal state + Retry, so refresh() re-binds). */
  let listClient = null;

  async function connect() {
    const client = await ctx.ensureNet();
    client.send(MSG.HELLO, { name: ctx.profile.get().name || 'Monkey' });
    attachListListener(client);
    return client;
  }

  /** Idempotent per client instance: renders every lobby_list broadcast. */
  function attachListListener(client) {
    if (!client || client === listClient) return;
    listClient = client;
    const off = client.on('lobby_list', (msg) => {
      lobbies = Array.isArray(msg?.lobbies) ? msg.lobbies : [];
      loading = false;
      render();
    });
    if (typeof off === 'function') unsubs.push(off);
  }

  /**
   * @param {{silent?: boolean}} [opts] silent = background auto-refresh:
   *   keep the current list on screen and swallow connect errors (the
   *   netStatus banner already reports outages).
   */
  async function refresh({ silent = false } = {}) {
    if (!silent) {
      loading = true;
      render();
    }
    try {
      const client = await connect();
      client.send(MSG.LIST_LOBBIES, {});
    } catch (err) {
      loading = false;
      if (!silent) {
        toast(err?.message ?? t('menu.connectFail'), 'error');
        render();
      }
    }
  }

  /**
   * Shared join/host flow: connect, set up a fresh online session, then
   * let `send(client)` fire the join_lobby / create_lobby message. Exactly
   * one of lobby_state (navigate) or error (toast + roll back) settles it.
   */
  async function enterLobby(send) {
    if (entering) return;
    entering = true;
    render();
    try {
      const client = await connect();
      const session = createOnlineSession(client);
      ctx.setSession(session);
      let offState = null;
      let offErr = null;
      const settle = () => {
        offState?.();
        offErr?.();
        entering = false;
      };
      offState = session.on('lobby_state', (lobby) => {
        if (!lobby) return;
        settle();
        ctx.router.go('lobby');
      });
      offErr = session.on('error', (msg) => {
        if (msg?.code === 'resume') return; // stale token: harmless, hello follows
        settle();
        // The list was stale (lobby filled up / started / expired) or the
        // server refused: never fail silently. Drop the half-made session
        // and re-fetch so the dead row disappears.
        ctx.setSession(null);
        toast(msg?.msg ?? msg?.message ?? tNet('net.serverError'), 'error');
        refresh({ silent: true });
        render();
      });
      // Screen unmount must also release the one-shot subscriptions.
      unsubs.push(settle);
      send(client);
    } catch (err) {
      entering = false;
      toast(err?.message ?? t('menu.connectFail'), 'error');
      render();
    }
  }

  function join(code) {
    return enterLobby((client) => client.send(MSG.JOIN_LOBBY, { code }));
  }

  function hostPublic() {
    return enterLobby((client) => {
      const boardId = ctx.registries.boards.ids()[0] ?? undefined;
      client.send(MSG.CREATE_LOBBY, { isPublic: true, rules: {}, boardId });
    });
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
      if (loading) {
        table.appendChild(div('ui-dim', t('menu.connecting')));
      } else {
        // Empty state with a direct call to action: host the first one.
        const empty = div('browser-empty');
        const cta = button(`🍌 ${t('browser.hostPublic')}`, 'ui-btn--green', hostPublic);
        cta.disabled = entering;
        empty.append(
          div('browser-empty__icon', '🙈'),
          div('browser-empty__text', t('browser.empty')),
          cta,
        );
        table.appendChild(empty);
      }
    }
    for (const lobby of lobbies) {
      const row = div('browser-row');
      const joinBtn = button(t('browser.join'), 'ui-btn--small ui-btn--green', () => join(lobby.code));
      joinBtn.disabled = entering;
      row.append(
        el('b', '', lobby.code ?? '—'),
        el('span', '', lobby.host ?? lobby.hostName ?? '—'),
        el('span', '', `${lobby.players ?? lobby.seatCount ?? '?'} / ${lobby.maxSeats ?? 8}`),
        joinBtn,
      );
      table.appendChild(row);
    }
    wrap.appendChild(table);

    const actions = div('ui-row');
    actions.append(
      button(t('generic.back'), 'ui-btn--ghost', () => ctx.router.go('mainMenu')),
      button(t('browser.refresh'), 'ui-btn--wood', () => refresh()),
    );
    if (lobbies.length > 0) {
      // The empty state already carries the CTA; only one host button at a time.
      const hostBtn = button(`🍌 ${t('browser.hostPublic')}`, 'ui-btn--green', hostPublic);
      hostBtn.disabled = entering;
      actions.appendChild(hostBtn);
    }
    wrap.appendChild(actions);
    root.appendChild(wrap);
  }

  return {
    mount(elHost) {
      root = elHost;
      entering = false;
      listClient = null;
      render();
      unsubs.push(onLangChange(render));
      // The UI hub guard-loads netStatus at boot; loading it here too
      // keeps the banner alive even without that hook (idempotent).
      import('./netStatus.js').then((m) => m.default?.(ctx)).catch(() => {});
      // connect() inside refresh() binds the lobby_list listener to the
      // live client (and re-binds if the client instance was replaced).
      refresh();
      // Keep the list fresh while the screen is open.
      autoTimer = setInterval(() => refresh({ silent: true }), AUTO_REFRESH_MS);
      ctx.stage.menu(ctx.registries.characters.all().slice(0, 3));
    },
    unmount() {
      if (autoTimer) {
        clearInterval(autoTimer);
        autoTimer = null;
      }
      for (const off of unsubs) {
        try {
          off();
        } catch { /* gone */ }
      }
      unsubs = [];
      root = null;
      listClient = null;
    },
  };
}
