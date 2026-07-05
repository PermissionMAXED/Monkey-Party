/**
 * Main menu screen: animated title sequence (once per app boot, skipped
 * under body.reduced-motion), Local Game (couch setup: seats + devices),
 * Online (quick match / lobby browser / private lobby / join code),
 * statistics, settings, the en/de language toggle, and a footer with the
 * version string plus buttons contributed by optional UI extensions
 * (How to Play / Credits / ...).
 */

import { MSG } from '#shared/protocol.js';
import { createOfflineSession, createOnlineSession } from '../app/session.js';
import { t, setLang, getLang, onLangChange } from './i18n.js';
import { el, div, button, clearNode, overlay, toast, select, playSfx } from './dom.js';

const MAX_LOCAL = 8; // total local seats offered in the couch setup
const MAX_DEVICE_SEATS = 4; // src/engine/input.js binds devices to seats 0..3

/* ---------------- version string (optional sibling module) ---------- */

// import.meta.glob so an absent module stays silent (no devtools 404).
const VERSION_LOADERS = import.meta.glob('../app/version.js');
let versionString = 'dev';
const versionReady = Promise.resolve(VERSION_LOADERS['../app/version.js']?.())
  .then((mod) => {
    const v = [mod?.VERSION, mod?.version, mod?.default]
      .find((x) => typeof x === 'string' && x.length > 0);
    if (v) versionString = v;
  })
  .catch(() => { /* optional - stays 'dev' */ });

/* ---------------- title sequence (once per app boot) ---------------- */

/** Consumed on the first main-menu mount; never replays within a boot. */
let introPlayed = false;

function reducedMotion() {
  return document.body.classList.contains('reduced-motion');
}

/** Vine/banana flourishes dropped over the title while the intro plays. */
function spawnIntroFlourishes(host) {
  if (typeof host.animate !== 'function') return;
  const fx = div('mm-intro-fx');
  fx.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:2;';
  const sprites = [
    { glyph: '🌿', x: 18, y: 4, delay: 0, vine: true },
    { glyph: '🌿', x: 78, y: 6, delay: 140, vine: true },
    { glyph: '🌿', x: 48, y: 2, delay: 260, vine: true },
    { glyph: '🍌', x: 30, y: 22, delay: 620 },
    { glyph: '🍌', x: 68, y: 20, delay: 760 },
    { glyph: '🐒', x: 50, y: 28, delay: 920 },
  ];
  for (const s of sprites) {
    const node = el('span', '', s.glyph);
    node.style.cssText = `position:absolute;left:${s.x}%;top:${s.y}%;`
      + 'font-size:clamp(1.8rem,3.4vw,3.2rem);filter:drop-shadow(0 6px 10px rgba(0,0,0,0.5));';
    fx.appendChild(node);
    if (s.vine) {
      node.animate([
        { transform: 'translateY(-140px) rotate(-24deg)', opacity: 0 },
        { transform: 'translateY(10px) rotate(10deg)', opacity: 1, offset: 0.6 },
        { transform: 'translateY(0) rotate(-4deg)', opacity: 1 },
      ], { duration: 900, delay: s.delay, easing: 'cubic-bezier(0.3, 1.3, 0.4, 1)', fill: 'backwards' });
    } else {
      node.animate([
        { transform: 'scale(0) rotate(-40deg)', opacity: 0 },
        { transform: 'scale(1.3) rotate(12deg)', opacity: 1, offset: 0.65 },
        { transform: 'scale(1) rotate(0deg)', opacity: 1 },
      ], { duration: 520, delay: s.delay, easing: 'cubic-bezier(0.3, 1.5, 0.4, 1)', fill: 'backwards' });
    }
    node.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, delay: 2400, fill: 'forwards' });
  }
  host.appendChild(fx);
  setTimeout(() => fx.remove(), 3000);
}

/**
 * Entrance animations via WAAPI (fill 'backwards' keeps elements hidden
 * until their delay). `full` adds the one-per-boot logo drop-in with
 * letter stagger + flourishes; otherwise only the buttons/footer stagger.
 */
function animateEntrance(root, wrap, full) {
  if (typeof wrap.animate !== 'function') return;
  let offset = 0;
  if (full) {
    const letters = wrap.querySelectorAll('.mm-title__letter');
    letters.forEach((span, i) => {
      span.animate([
        { transform: 'translateY(-120px) rotate(-12deg) scale(0.4)', opacity: 0 },
        { transform: 'translateY(9px) rotate(4deg) scale(1.1)', opacity: 1, offset: 0.7 },
        { transform: 'translateY(0) rotate(0deg) scale(1)', opacity: 1 },
      ], { duration: 640, delay: 160 + i * 55, easing: 'cubic-bezier(0.34, 1.45, 0.4, 1)', fill: 'backwards' });
    });
    spawnIntroFlourishes(root);
    offset = 160 + letters.length * 55 + 260;
  }
  const subtitle = wrap.querySelector('.ui-subtitle');
  subtitle?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 420, delay: offset, fill: 'backwards' });
  const buttons = wrap.querySelectorAll('.mm-buttons > .ui-btn');
  buttons.forEach((b, i) => {
    b.animate([
      { transform: 'translateY(28px) scale(0.92)', opacity: 0 },
      { transform: 'translateY(0) scale(1)', opacity: 1 },
    ], { duration: 380, delay: offset + 90 + i * 90, easing: 'cubic-bezier(0.3, 1.4, 0.4, 1)', fill: 'backwards' });
  });
  const footer = wrap.querySelector('.mm-footer');
  footer?.animate?.([{ opacity: 0 }, { opacity: 1 }], {
    duration: 420, delay: offset + 90 + buttons.length * 90, fill: 'backwards',
  });
}

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
      const cfg = {
        localPlayers: seats.map((s, i) => ({
          pid: `p${i + 1}`,
          name: s.name.trim() || `${t('generic.player')} ${i + 1}`,
        })),
      };
      const session = createOfflineSession(cfg);
      // Remembered for the in-match package's rematch flow.
      ctx.lastOfflineConfig = cfg;
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

  /**
   * A reload/reopen with a live resume token can drop us straight back into
   * a lobby or a RUNNING match (the transport resumes on open; the server
   * replies with lobby_state or a mid-match state_sync). Wait briefly for
   * that outcome so e.g. quick_match doesn't silently abandon the seat.
   *
   * @returns {Promise<'match'|'lobby'|null>} where the resume landed us.
   */
  function waitForResumeOutcome(client, session, timeoutMs = 1500) {
    if (!client.resumeToken) return Promise.resolve(null);
    return new Promise((resolve) => {
      const offs = [];
      let timer = null;
      const done = (outcome) => {
        clearTimeout(timer);
        for (const off of offs.splice(0)) {
          try {
            off?.();
          } catch { /* gone */ }
        }
        resolve(outcome);
      };
      timer = setTimeout(() => done(null), timeoutMs);
      // Mid-match resume: the session rebuilds its sim from the snapshot
      // and only then emits state_sync.
      offs.push(session.on('state_sync', (msg) => done(msg?.snapshot ? 'match' : null)));
      offs.push(session.on('lobby_state', (lobby) => {
        if (lobby) done(lobby.started ? 'match' : 'lobby');
      }));
      // Dead/unknown token: the server answers the resume with an error.
      offs.push(client.on('error', (msg) => {
        if (msg?.code === 'resume') done(null);
      }));
    });
  }

  async function startOnline(afterConnect) {
    const info = toastOnce(t('menu.connecting'));
    try {
      // A resume (and thus a mid-match rejoin) only happens when the socket
      // (re)opens; if it is already open and identified, don't wait for one.
      const wasOpen = ctx.getNetClient()?.state === 'open';
      const client = await connectOnline();
      const session = createOnlineSession(client);
      ctx.setSession(session);

      // Navigate to the lobby as soon as the server confirms one.
      const offLobby = session.on('lobby_state', (lobby) => {
        if (!lobby) return;
        offLobby();
        if (ctx.router.currentName() !== 'lobby' && ctx.router.currentName() !== 'match') {
          ctx.router.go(lobby.started ? 'match' : 'lobby');
        }
      });
      const offErr = client.on('error', (msg) => {
        if (msg?.code === 'resume') return; // stale token: harmless, hello follows
        offErr();
        toast(msg?.msg ?? 'Server error', 'error');
      });

      const resumed = wasOpen ? null : await waitForResumeOutcome(client, session);
      if (resumed === 'match') {
        // Rejoin the running match instead of abandoning the seat.
        toast('Rejoining your running match…', 'info');
        ctx.router.go('match');
        return;
      }
      if (resumed === 'lobby') return; // offLobby already navigated
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

  /** Extension menu items ({id, labelKey, screen, order}), deduped by id
   *  and limited to screens that actually registered. Already sorted by
   *  order in buildUI. */
  function extensionMenuItems() {
    const seen = new Set();
    const out = [];
    for (const item of ctx.menuItems ?? []) {
      if (!item || typeof item.screen !== 'string') continue;
      const key = item.id ?? item.screen;
      if (seen.has(key)) continue;
      if (typeof ctx.router.has === 'function' && !ctx.router.has(item.screen)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  }

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

    // Title as per-letter spans so the boot intro can stagger them.
    const title = el('h1', 'ui-title');
    title.setAttribute('aria-label', t('app.title'));
    for (const ch of t('app.title')) {
      const span = el('span', 'mm-title__letter', ch === ' ' ? '\u00a0' : ch);
      span.style.display = 'inline-block';
      span.setAttribute('aria-hidden', 'true');
      title.appendChild(span);
    }
    wrap.append(title, el('p', 'ui-subtitle', t('app.tagline')));

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

    // Footer: How to Play / Credits / other extension buttons + version.
    const footer = div('mm-footer');
    footer.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:6px;';
    const extRow = div('ui-row');
    for (const item of extensionMenuItems()) {
      extRow.appendChild(button(t(item.labelKey), 'ui-btn--small ui-btn--wood', () => ctx.router.go(item.screen)));
    }
    if (extRow.childNodes.length > 0) footer.appendChild(extRow);
    const version = div('ui-dim mm-version', versionString);
    version.style.cssText = 'font-size:0.72rem;letter-spacing:0.14em;';
    footer.appendChild(version);
    wrap.appendChild(footer);

    root.appendChild(wrap);
    return wrap;
  }

  return {
    mount(elHost) {
      root = elHost;
      const wrap = render();
      // Boot intro (logo drop-in + flourishes) once per boot; button/footer
      // stagger on every menu mount. body.reduced-motion skips everything.
      if (!reducedMotion()) {
        animateEntrance(root, wrap, !introPlayed);
      }
      introPlayed = true; // consumed (or intentionally skipped) for this boot
      versionReady.then(() => {
        const node = root?.querySelector?.('.mm-version');
        if (node) node.textContent = versionString;
      });
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
