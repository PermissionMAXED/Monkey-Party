/**
 * Lobby screen (offline couch + online, via ISession): seat list with
 * ready states / bot management, board carousel, rules summary + editor
 * link, private lobby code, chat (online) and the start button.
 */

import { MSG } from '#shared/protocol.js';
import { t, localized, onLangChange } from './i18n.js';
import {
  el, div, button, clearNode, portraitImg, starRow, select, toast, playSfx,
} from './dom.js';
import { attachEmoteWheel } from './emoteWheel.js';

const DIFFICULTIES = ['easy', 'normal', 'hard', 'wild'];

export function createLobbyScreen(ctx) {
  let root = null;
  let unsubs = [];
  let boardIndex = 0;
  let starting = false;
  let emoteWheel = null;
  let countdownTimer = null;
  const chatLog = [];

  const session = () => ctx.session;

  function isHost() {
    // Offline: always host. Online: seat 0 is the host by convention.
    const s = session();
    if (!s) return false;
    if (s.mode === 'offline') return true;
    const lobby = s.getLobby();
    const locals = s.localSeats();
    const first = lobby?.seats?.find((seat) => !seat.isBot);
    return first ? locals.has(first.pid) : false;
  }

  /* ---------------- seats ---------------- */

  function seatRow(seat) {
    const s = session();
    const locals = s.localSeats();
    const row = div('lobby-seat');
    const def = seat.characterId ? ctx.registries.characters.get(seat.characterId) : null;
    row.appendChild(portraitImg(def, 40));
    row.appendChild(div('lobby-seat__name', seat.name));

    if (seat.isBot) {
      row.appendChild(div('lobby-seat__tag', t('generic.bot')));
      if (s.mode === 'offline') {
        row.appendChild(select(
          DIFFICULTIES.map((d) => ({ value: d, label: t(`lobby.difficulty.${d}`) })),
          seat.difficulty ?? 'normal',
          (v) => {
            // The offline session has no in-place difficulty setter: swap the bot.
            s.removeBot(seat.seat);
            s.addBot(v);
          },
        ));
      } else if (seat.difficulty) {
        row.appendChild(div('ui-dim', t(`lobby.difficulty.${seat.difficulty}`)));
      }
      if (isHost()) {
        row.appendChild(button(t('lobby.kick'), 'ui-btn--small ui-btn--danger', () => s.removeBot(seat.seat)));
      }
    } else {
      if (locals.has(seat.pid)) row.appendChild(div('lobby-seat__tag lobby-seat__tag--you', t('hud.you')));
      const ready = div(
        `lobby-seat__ready ${seat.ready ? 'lobby-seat__ready--on' : 'lobby-seat__ready--off'}`,
        seat.ready ? '✔' : '…',
      );
      ready.title = seat.ready ? t('lobby.ready') : t('lobby.notReady');
      row.appendChild(ready);
      if (locals.has(seat.pid)) {
        row.appendChild(button(
          seat.ready ? t('lobby.ready') : t('lobby.notReady'),
          `ui-btn--small ${seat.ready ? 'ui-btn--green' : 'ui-btn--wood'}`,
          () => s.setReady(seat.pid, !seat.ready),
        ));
      }
    }
    return row;
  }

  /* ---------------- board carousel ---------------- */

  function boardCarousel(lobby) {
    const boards = ctx.registries.boards.all();
    if (boards.length === 0) return div('ui-dim', '—');
    const selectedIdx = Math.max(0, boards.findIndex((b) => b.id === lobby.boardId));
    boardIndex = selectedIdx === -1 ? 0 : selectedIdx;
    const board = boards[boardIndex];

    const wrap = div('board-carousel');
    const pick = (idx) => {
      const next = (idx + boards.length) % boards.length;
      session().setBoard(boards[next].id);
      playSfx('whoosh', { vol: 0.4 });
    };
    const canPick = isHost();
    const prev = button('‹', 'ui-btn--wood board-carousel__nav', () => pick(boardIndex - 1));
    const next = button('›', 'ui-btn--wood board-carousel__nav', () => pick(boardIndex + 1));
    prev.disabled = !canPick;
    next.disabled = !canPick;

    const card = div('board-card');
    const nameRow = div('ui-row');
    nameRow.style.justifyContent = 'space-between';
    nameRow.append(div('board-card__name', localized(board.name)), starRow(board.difficulty ?? 1));
    card.append(nameRow, div('board-card__desc', localized(board.description)));
    const dots = div('board-card__dots');
    boards.forEach((b, i) => {
      const dot = div(`board-card__dot${i === boardIndex ? ' board-card__dot--on' : ''}`);
      if (canPick) dot.addEventListener('click', () => pick(i));
      dots.appendChild(dot);
    });
    card.appendChild(dots);

    wrap.append(prev, card, next);
    return wrap;
  }

  /* ---------------- rules summary ---------------- */

  function rulesSummary(rules) {
    const wrap = div('rules-summary');
    const chips = [
      `${rules.rounds} ${t('rules.rounds')}`,
      `${t('rules.starPrice')}: ${rules.starPrice}`,
      `${t('rules.startCoins')}: ${rules.startCoins}`,
      `${t('rules.items')}: ${t(`rules.items.${rules.items}`)}`,
      `🎮 ×${rules.minigameEvery}`,
    ];
    if (rules.traps) chips.push(t('rules.traps'));
    if (rules.randomEvents) chips.push(t('rules.randomEvents'));
    if (rules.chaosMode) chips.push(t('rules.chaosMode'));
    if (rules.fastMode) chips.push(t('rules.fastMode'));
    if (rules.hardcore) chips.push(t('rules.hardcore'));
    if (rules.competitive) chips.push(t('rules.competitive'));
    if (rules.bananaMultiplier === 2) chips.push('🍌×2');
    for (const c of chips) wrap.appendChild(div('rules-chip', c));
    return wrap;
  }

  /* ---------------- chat (online) ---------------- */

  function chatPanel() {
    const wrap = div('lobby-chat');
    wrap.appendChild(el('div', 'ui-section-label', t('lobby.chat')));
    const log = div('lobby-chat__log');
    for (const entry of chatLog) {
      const row = div('lobby-chat__row');
      row.append(el('b', '', `${entry.from}:`), el('span', '', entry.text));
      log.appendChild(row);
    }
    log.scrollTop = log.scrollHeight;
    const inputRow = div('ui-row');
    const input = el('input', 'ui-input');
    input.type = 'text';
    input.maxLength = 160;
    input.placeholder = t('lobby.chatPlaceholder');
    input.style.flex = '1';
    const send = () => {
      const text = input.value.trim();
      if (!text) return;
      ctx.getNetClient()?.send(MSG.CHAT, { text });
      input.value = '';
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') send();
    });
    inputRow.append(input, button(t('lobby.chatSend'), 'ui-btn--small', send));
    wrap.append(log, inputRow);
    return wrap;
  }

  /* ---------------- start ---------------- */

  async function startMatch() {
    const s = session();
    if (!s || starting) return;
    starting = true;
    // Give undecided seats a random monkey so the board always has bodies.
    if (s.mode === 'offline') {
      const charIds = ctx.registries.characters.ids();
      s.getLobby().seats.forEach((seat, i) => {
        if (!seat.characterId && charIds.length > 0) {
          s.selectCharacter(seat.pid, charIds[(i * 3) % charIds.length]);
        }
      });
    }
    try {
      await s.start();
      if (s.mode === 'offline') ctx.router.go('match');
      // Online: the 'match_start' subscription below navigates.
    } catch (err) {
      starting = false;
      toast(err?.message ?? String(err), 'error');
      render();
    }
  }

  /* ---------------- quick-match countdown ---------------- */

  function countdownBanner(lobby) {
    const banner = div('lobby-countdown');
    banner.style.cssText = 'text-align:center;font-size:1.1rem;font-weight:800;'
      + 'color:#ffe135;background:rgba(0,0,0,0.35);border-radius:10px;padding:8px 14px;margin:8px 0;';
    const update = () => {
      const remain = Math.max(0, Math.ceil((lobby.countdownEndsAt - Date.now()) / 1000));
      banner.textContent = `🚀 ${t('lobby.start')} · ${remain}s`;
    };
    update();
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
      if (!banner.isConnected || !session()?.getLobby?.()?.countdownEndsAt) {
        clearInterval(countdownTimer);
        countdownTimer = null;
        return;
      }
      update();
    }, 250);
    return banner;
  }

  /* ---------------- render ---------------- */

  function render() {
    if (!root) return;
    clearNode(root);
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    const s = session();
    if (!s) {
      ctx.router.go('mainMenu');
      return;
    }
    const lobby = s.getLobby();
    if (!lobby) {
      root.appendChild(div('ui-screen', t('menu.connecting')));
      return;
    }

    const wrap = div('ui-screen');
    wrap.appendChild(el('h1', 'ui-heading', s.mode === 'offline' ? t('lobby.offline') : t('lobby.online')));

    const layout = div('lobby-layout');

    /* Left: seats */
    const left = div('lobby-col ui-panel ui-scroll-y');
    left.style.maxHeight = '76vh';
    left.appendChild(el('div', 'ui-section-label', `${t('lobby.seats')} (${lobby.seats.length}/${lobby.rules.maxSeats})`));
    for (const seat of lobby.seats) left.appendChild(seatRow(seat));
    for (let i = lobby.seats.length; i < lobby.rules.maxSeats; i += 1) {
      left.appendChild(div('lobby-seat lobby-seat--empty', lobby.rules.botsFill ? '🤖 …' : '—'));
    }
    const seatBtns = div('ui-row');
    if (isHost() && lobby.seats.length < lobby.rules.maxSeats) {
      seatBtns.appendChild(button(t('lobby.addBot'), 'ui-btn--small ui-btn--wood', () => s.addBot('normal')));
    }
    left.appendChild(seatBtns);
    left.appendChild(div('ui-dim', t('lobby.emoteHint')));

    /* Right: board + rules + code + chat */
    const right = div('lobby-col ui-panel ui-scroll-y');
    right.style.maxHeight = '76vh';
    right.appendChild(el('div', 'ui-section-label', t('lobby.board')));
    right.appendChild(boardCarousel(lobby));
    right.appendChild(el('div', 'ui-section-label', t('lobby.rules')));
    right.appendChild(rulesSummary(lobby.rules));
    if (isHost()) {
      right.appendChild(button(t('lobby.editRules'), 'ui-btn--small ui-btn--wood', () => ctx.router.go('rules')));
    }
    if (s.mode === 'online' && lobby.code) {
      right.appendChild(el('div', 'ui-section-label', t('lobby.code')));
      right.appendChild(div('lobby-code', lobby.code));
    }
    if (s.mode === 'online') right.appendChild(chatPanel());

    layout.append(left, right);
    wrap.appendChild(layout);

    /* Quick-match auto-start countdown (server sets countdownEndsAt). */
    if (typeof lobby.countdownEndsAt === 'number' && lobby.countdownEndsAt > Date.now()) {
      wrap.appendChild(countdownBanner(lobby));
    }

    /* Bottom actions */
    const actions = div('ui-row');
    actions.append(
      button(t('lobby.leave'), 'ui-btn--ghost', () => {
        ctx.setSession(null);
        ctx.router.go('mainMenu');
      }),
      button(t('lobby.chooseChar'), 'ui-btn--wood', () => ctx.router.go('charSelect')),
    );
    const startBtn = button(starting ? t('lobby.starting') : t('lobby.start'), 'ui-btn--green ui-btn--big', startMatch);
    // Online: the server refuses start_game until every connected human is
    // ready - grey the button out instead of provoking that error.
    const humansReady = lobby.seats
      .filter((seat) => !seat.isBot && seat.connected !== false)
      .every((seat) => seat.ready);
    startBtn.disabled = starting || !isHost() || lobby.started
      || (s.mode === 'online' && !humansReady);
    if (s.mode === 'online' && !humansReady && !lobby.started) startBtn.title = t('lobby.notReady');
    actions.appendChild(startBtn);
    wrap.appendChild(actions);

    root.appendChild(wrap);
  }

  return {
    mount(elHost) {
      root = elHost;
      starting = false;
      const s = session();
      render();
      if (s) {
        unsubs.push(s.on('lobby_state', () => render()));
        unsubs.push(s.on('match_start', () => {
          if (ctx.router.currentName() === 'lobby') ctx.router.go('match');
        }));
        unsubs.push(s.on('error', (msg) => {
          // Server refusals (failed start_game, bad rules, ...) must be
          // visible AND unstick the Start button.
          const text = msg?.msg ?? msg?.message ?? 'Server error';
          toast(msg?.code ? `${text} (${msg.code})` : text, 'error');
          if (starting) {
            starting = false;
            render();
          }
        }));
        unsubs.push(s.on('chat', (msg) => {
          const lobby = s.getLobby();
          const from = lobby?.seats?.find((seat) => seat.pid === msg?.pid)?.name ?? msg?.pid ?? '?';
          chatLog.push({ from, text: msg?.text ?? '' });
          if (chatLog.length > 60) chatLog.shift();
          render();
        }));
        if (s.mode === 'online') {
          const net = ctx.getNetClient?.();
          if (net?.on) {
            let reconnectFailed = false;
            const nsub = (evt, cb) => {
              const off = net.on(evt, cb);
              if (typeof off === 'function') unsubs.push(off);
            };
            nsub('reconnecting', (info) => {
              if ((info?.attempt ?? 1) === 1) toast('Connection lost – reconnecting…', 'info');
            });
            nsub('reconnect_failed', () => {
              reconnectFailed = true;
              toast('Could not reconnect to the server. Check your connection and reload the page.', 'error');
            });
            nsub('close', () => {
              if (!reconnectFailed) toast('Connection to the server was closed.', 'error');
            });
          }
        }
        emoteWheel = attachEmoteWheel(ctx, s, root);
      }
      unsubs.push(onLangChange(render));
      ctx.stage.menu(ctx.registries.characters.all().slice(0, 3));
      ctx.music.play('menu');
    },
    unmount() {
      for (const off of unsubs) {
        try {
          off();
        } catch { /* gone */ }
      }
      unsubs = [];
      if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
      }
      emoteWheel?.dispose();
      emoteWheel = null;
      root = null;
    },
  };
}
