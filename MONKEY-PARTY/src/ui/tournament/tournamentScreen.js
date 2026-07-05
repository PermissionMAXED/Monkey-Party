/**
 * Tournament screen (Solo Modes package): cup select with locked
 * progression, standings between legs, and the "Next race" launch flow.
 *
 * Persistence lives under the 'monkey-party:tournament:v1' localStorage
 * key through the same createLocalStore used by settings/profile; the
 * in-progress tournament is sanitized on every load/set via
 * sanitizeTournament (shared/tournament.js), so tampered or stale saves
 * fall back cleanly instead of crashing.
 *
 * Launch flow: build cfg {seed, boardId, rules, localPlayers} from the
 * current leg -> createOfflineSession(cfg) -> seat the 3 rival bots with
 * their tournament characters -> subscribe to the session's 'game_over'
 * (the same event matchController uses) BEFORE navigating -> setSession +
 * start() -> router.go('match'). When the match ends, the game_over
 * handler folds the result into the store, so returning to this screen
 * shows updated standings and unlocks. Quitting mid-match (HUD quit) never
 * fires game_over - the leg stays unrecorded and the cup resumes there.
 */

import {
  CUPS,
  PLAYER_PID,
  TOURNAMENT_SEATS,
  createTournament,
  currentLeg,
  applyMatchResult,
  standings,
  isComplete,
  champion,
  sanitizeTournament,
} from '#shared/tournament.js';
import { createOfflineSession } from '../../app/session.js';
import { createLocalStore } from '../../app/settingsStore.js';
import { t, localized, onLangChange } from '../i18n.js';
import { el, div, button, clearNode, toast, portraitImg, playSfx } from '../dom.js';
import './strings.js'; // registers the 'tour.*' dictionary entries

const STORAGE_KEY = 'monkey-party:tournament:v1';
const CUP_ICONS = ['🍌', '🥥', '🌿', '🏆'];

/* ------------------------------------------------------------------ */
/* Persistent store                                                    */
/* ------------------------------------------------------------------ */

const TOUR_DEFAULTS = Object.freeze({
  /** Number of unlocked cups (1..CUPS.length); cup 1 is always open. */
  unlocked: 1,
  /** The in-progress (or just-finished, not yet collected) tournament. */
  active: null,
  /** cupId -> {placement} best final placement (1 = cup won). */
  completed: {},
});

function sanitizeTourState(raw) {
  const src = raw !== null && typeof raw === 'object' ? raw : {};
  let unlocked = Number.isFinite(Number(src.unlocked))
    ? Math.min(CUPS.length, Math.max(1, Math.round(Number(src.unlocked))))
    : 1;
  const completed = {};
  const rawCompleted = src.completed !== null && typeof src.completed === 'object' && !Array.isArray(src.completed)
    ? src.completed
    : {};
  CUPS.forEach((cup, i) => {
    const entry = rawCompleted[cup.id];
    const placement = Number(entry?.placement);
    if (!Number.isInteger(placement) || placement < 1 || placement > TOURNAMENT_SEATS) return;
    completed[cup.id] = { placement };
    // Unlock state stays consistent with recorded cup wins.
    if (placement === 1) unlocked = Math.max(unlocked, Math.min(CUPS.length, i + 2));
  });
  return { unlocked, active: sanitizeTournament(src.active), completed };
}

/** Module-level singleton (house style, see settingsStore/profileStore). */
const tourStore = createLocalStore(STORAGE_KEY, TOUR_DEFAULTS, sanitizeTourState);

/* ------------------------------------------------------------------ */
/* Result folding (runs while the match screen is mounted)             */
/* ------------------------------------------------------------------ */

/**
 * Fold a finished leg's game_over event into the persisted tournament.
 * Guarded against double-fires and stale saves: it only records when the
 * stored active tournament still points at exactly this leg.
 */
function foldGameOver(tour, leg, evt) {
  const state = tourStore.get();
  const active = state.active;
  if (!active || active.cupId !== tour.cupId || active.seed !== tour.seed
    || active.results.length !== leg.index) {
    return;
  }

  const ranking = Array.isArray(evt?.ranking) ? evt.ranking : [];
  const placement = ranking.indexOf(PLAYER_PID) + 1;
  if (placement < 1) return; // not a result for this roster
  const rows = new Map((Array.isArray(evt?.standings) ? evt.standings : [])
    .map((r) => [r?.playerId, r]));
  const others = tour.roster.filter((r) => r.isBot).map((r) => ({
    pid: r.pid,
    placement: ranking.indexOf(r.pid) + 1,
    bananas: rows.get(r.pid)?.goldenBananas ?? 0,
    coins: rows.get(r.pid)?.coins ?? 0,
  }));

  const payload = {
    placement,
    bananas: rows.get(PLAYER_PID)?.goldenBananas ?? 0,
    coins: rows.get(PLAYER_PID)?.coins ?? 0,
  };
  // Only trust the rivals' results when the ranking covers all of them;
  // applyMatchResult fills placements deterministically otherwise.
  if (others.every((o) => o.placement >= 1)) payload.others = others;

  let next;
  try {
    next = applyMatchResult(active, payload);
  } catch (err) {
    console.warn('[tournament] could not record the leg result:', err);
    return;
  }

  const patch = { active: next };
  if (isComplete(next)) {
    const finalRows = standings(next);
    const place = finalRows.findIndex((r) => r.pid === PLAYER_PID) + 1;
    const cupIdx = CUPS.findIndex((c) => c.id === next.cupId);
    const completed = { ...state.completed };
    const prevBest = completed[next.cupId]?.placement;
    completed[next.cupId] = { placement: prevBest ? Math.min(prevBest, place) : place };
    patch.completed = completed;
    if (place === 1 && cupIdx >= 0) {
      patch.unlocked = Math.max(state.unlocked, Math.min(CUPS.length, cupIdx + 2));
    }
  }
  tourStore.set(patch);
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export function createTournamentScreen(ctx) {
  let root = null;
  let unsubLang = null;
  let disposed = false;
  let launching = false;
  /** Character picked on the cup-select view (defaults to the first). */
  let pickedCharacterId = null;

  const boards = () => ctx.registries.boards;
  const characters = () => ctx.registries.characters;

  function boardName(boardId) {
    const def = boards().get(boardId);
    return def ? localized(def.name) : boardId;
  }

  function charDef(id) {
    return id ? characters().get(id) : null;
  }

  function difficultyLabel(d) {
    return t(`lobby.difficulty.${d}`);
  }

  /* ---------------- launch flow ---------------- */

  async function startNextRace() {
    if (launching) return;
    const tour = tourStore.get().active;
    const leg = currentLeg(tour);
    if (!leg) return;
    launching = true;

    const cfg = {
      seed: leg.seed,
      boardId: leg.boardId,
      rules: { ...leg.rules },
      localPlayers: [{ pid: PLAYER_PID, name: tour.playerName }],
    };
    const session = createOfflineSession(cfg);

    // Seat the fixed tournament roster: the human + the 3 rivals with
    // their seeded characters (addBot pids are bot1..bot3, matching the
    // roster pids by construction).
    if (tour.characterId) session.selectCharacter(PLAYER_PID, tour.characterId);
    for (const rival of leg.roster.filter((r) => r.isBot)) {
      const seat = session.addBot(leg.botDifficulty);
      if (!seat) continue;
      // The session names bots from its own pool; keep the in-match names
      // aligned with the tournament roster (the seat object is live).
      seat.name = rival.name;
      if (rival.characterId) session.selectCharacter(seat.pid, rival.characterId);
    }
    session.setReady(PLAYER_PID, true);

    // Subscribe BEFORE leaving this screen (the same session event
    // matchController listens for). Quit = no game_over = leg unrecorded.
    const off = session.on('game_over', (evt) => {
      try {
        off?.();
      } catch { /* emitter already cleared */ }
      foldGameOver(tour, leg, evt);
    });

    ctx.setSession(session);
    try {
      await session.start();
    } catch (err) {
      launching = false;
      ctx.setSession(null);
      toast(err?.message ?? String(err), 'error');
      return;
    }
    launching = false;
    if (!disposed) {
      ctx.router.go('match');
    }
  }

  /* ---------------- cup select ---------------- */

  function startCup(cup) {
    const state = tourStore.get();
    if (state.active && !window.confirm(t('tour.restartConfirm'))) return;
    const charIds = characters().ids();
    const characterId = pickedCharacterId ?? charIds[0] ?? null;
    const tour = createTournament({
      // Client-side wall-clock seeding is fine here (determinism lives in
      // shared/ - the tournament itself is deterministic FROM this seed).
      seed: Math.floor(Math.random() * 0xffffffff),
      cupId: cup.id,
      playerName: ctx.profile.get().name || 'Monkey',
      characterId,
      characterPool: charIds.length > 0 ? charIds : undefined,
    });
    tourStore.set({ active: tour });
    render();
  }

  function characterPicker() {
    const defs = characters().all();
    if (defs.length === 0) return null;
    if (!pickedCharacterId || !characters().get(pickedCharacterId)) {
      pickedCharacterId = defs[0].id;
    }
    const wrap = div('');
    wrap.appendChild(div('ui-section-label', t('tour.chooseChar')));
    const row = div('tour-chars');
    for (const def of defs) {
      const b = el('button', 'tour-char');
      b.type = 'button';
      b.title = localized(def.name);
      b.setAttribute('aria-pressed', String(def.id === pickedCharacterId));
      b.appendChild(portraitImg(def, 40));
      b.addEventListener('click', () => {
        playSfx('click');
        pickedCharacterId = def.id;
        render();
      });
      row.appendChild(b);
    }
    wrap.appendChild(row);
    return wrap;
  }

  function renderCupSelect(body) {
    const state = tourStore.get();
    const picker = characterPicker();
    if (picker) body.appendChild(picker);

    const grid = div('tour-cups');
    CUPS.forEach((cup, i) => {
      const unlocked = i < state.unlocked;
      const isActive = state.active?.cupId === cup.id;
      const won = state.completed[cup.id]?.placement === 1;

      const card = el('button', 'tour-cup');
      card.type = 'button';
      card.disabled = !unlocked;
      card.append(
        div('tour-cup__icon', CUP_ICONS[i % CUP_ICONS.length]),
        div('tour-cup__name', localized(cup.name)),
        div('tour-cup__desc', unlocked ? localized(cup.description) : t('tour.lockedHint')),
      );
      const rules = cup.rules;
      const meta = div('tour-cup__meta');
      meta.textContent = [
        t('tour.legCount', { n: cup.boards.length }),
        t('tour.roundsPerLeg', { n: rules.rounds }),
        t('tour.bots', { difficulty: difficultyLabel(rules.botDifficulty) }),
      ].join(' · ');
      card.appendChild(meta);

      if (!unlocked) {
        card.appendChild(div('tour-cup__badge', `🔒 ${t('tour.locked')}`));
      } else if (isActive) {
        card.appendChild(div('tour-cup__badge tour-cup__badge--active',
          t('tour.inProgress', { n: state.active.results.length + 1, total: cup.boards.length })));
      } else if (won) {
        card.appendChild(div('tour-cup__badge tour-cup__badge--won', `🏆 ${t('tour.wonBadge')}`));
      } else if (state.completed[cup.id]) {
        card.appendChild(div('tour-cup__badge',
          t('tour.bestPlace', { place: state.completed[cup.id].placement })));
      }

      card.addEventListener('click', () => {
        playSfx('click');
        if (isActive) render(); // active cup card is the default continue path
        else startCup(cup);
      });
      grid.appendChild(card);
    });
    body.appendChild(grid);

    body.appendChild(div('tour-hint', t('tour.playerName', { name: ctx.profile.get().name || 'Monkey' })));

    const actions = div('tour-actions');
    actions.appendChild(button(t('stats.toMenu'), 'ui-btn--ghost', () => ctx.router.go('mainMenu')));
    body.appendChild(actions);
  }

  /* ---------------- standings table ---------------- */

  function standingsTable(tour) {
    const rows = standings(tour);
    const table = el('table', 'tour-table');
    const thead = el('thead');
    const headRow = el('tr');
    for (const [key, cls] of [
      ['tour.col.place', 'tour-td--num'],
      ['tour.col.player', ''],
      ['tour.col.points', 'tour-td--num'],
      ['tour.col.bananas', 'tour-td--num'],
      ['tour.col.coins', 'tour-td--num'],
      ['tour.col.wins', 'tour-td--num'],
    ]) {
      headRow.appendChild(el('th', cls, t(key)));
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = el('tbody');
    rows.forEach((row, i) => {
      const tr = el('tr', row.pid === PLAYER_PID ? 'tour-row--you' : '');
      tr.appendChild(el('td', 'tour-td--num', String(i + 1)));
      const playerCell = el('td');
      const wrap = el('span', 'tour-row__player');
      const def = charDef(row.characterId);
      if (def) wrap.appendChild(portraitImg(def, 26));
      wrap.appendChild(el('span', '', row.isBot ? `${row.name} 🤖` : row.name));
      playerCell.appendChild(wrap);
      tr.appendChild(playerCell);
      tr.appendChild(el('td', 'tour-td--num', String(row.points)));
      tr.appendChild(el('td', 'tour-td--num', `🍌 ${row.bananas}`));
      tr.appendChild(el('td', 'tour-td--num', `🪙 ${row.coins}`));
      tr.appendChild(el('td', 'tour-td--num', String(row.wins)));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
  }

  /* ---------------- in-progress view ---------------- */

  function renderProgress(body, tour) {
    const cup = CUPS.find((c) => c.id === tour.cupId);
    const total = tour.legs.length;
    const played = tour.results.length;
    const leg = currentLeg(tour);

    body.appendChild(div('tour-banner', `${CUP_ICONS[CUPS.indexOf(cup) % CUP_ICONS.length]} ${localized(cup.name)}`));
    if (played > 0) {
      body.appendChild(div('tour-sub', t('tour.afterLeg', { n: played, total })));
      body.appendChild(div('ui-section-label', t('tour.standings')));
      body.appendChild(standingsTable(tour));
    }

    const card = div('tour-leg-card');
    const info = div('');
    info.append(
      div('tour-leg-card__meta', t('tour.nextLeg', { n: leg.index + 1, total })),
      div('tour-leg-card__board', `🗺️ ${boardName(leg.boardId)}`),
      div('tour-leg-card__meta',
        `${t('tour.roundsPerLeg', { n: leg.rules.rounds })} · ${t('tour.bots', { difficulty: difficultyLabel(leg.botDifficulty) })}`),
    );
    card.appendChild(info);
    body.appendChild(card);

    body.appendChild(div('tour-hint', t('tour.pointsHint')));
    body.appendChild(div('tour-hint', t('tour.resumeHint')));

    const actions = div('tour-actions');
    actions.append(
      button(t('generic.back'), 'ui-btn--ghost', () => {
        ctx.router.go('mainMenu');
      }),
      button(t('tour.abandon'), 'ui-btn--wood', () => {
        if (!window.confirm(t('tour.abandonConfirm'))) return;
        tourStore.set({ active: null });
        render();
      }),
      button(played === 0 ? t('tour.firstRace') : t('tour.nextRace'),
        'ui-btn--green ui-btn--big', startNextRace),
    );
    body.appendChild(actions);
  }

  /* ---------------- finished view ---------------- */

  function renderFinished(body, tour) {
    const cup = CUPS.find((c) => c.id === tour.cupId);
    const winner = champion(tour);
    const state = tourStore.get();
    const cupIdx = CUPS.indexOf(cup);
    const playerWon = winner?.pid === PLAYER_PID;

    body.appendChild(div('tour-banner', `🏆 ${t('tour.cupDone')}`));
    body.appendChild(div('tour-sub',
      t('tour.champion', { name: winner?.name ?? '?', cup: localized(cup.name) })));
    if (playerWon && cupIdx >= 0 && cupIdx + 1 < CUPS.length && state.unlocked > cupIdx + 1) {
      body.appendChild(div('tour-sub', `✨ ${t('tour.unlockNext')}`));
    } else if (!playerWon) {
      body.appendChild(div('tour-sub', t('tour.noUnlock')));
    }
    body.appendChild(standingsTable(tour));

    const actions = div('tour-actions');
    actions.appendChild(button(t('tour.collect'), 'ui-btn--green ui-btn--big', () => {
      tourStore.set({ active: null });
      render();
    }));
    body.appendChild(actions);
  }

  /* ---------------- render ---------------- */

  function render() {
    if (!root) return;
    clearNode(root);
    const wrap = div('ui-screen tour-screen');
    wrap.appendChild(el('h2', 'ui-heading', t('tour.title')));

    const state = tourStore.get();
    const body = div('tour-body');
    if (state.active && isComplete(state.active)) {
      renderFinished(body, state.active);
    } else if (state.active) {
      renderProgress(body, state.active);
    } else {
      wrap.appendChild(el('p', 'tour-sub', t('tour.subtitle')));
      renderCupSelect(body);
    }
    wrap.appendChild(body);
    root.appendChild(wrap);
  }

  return {
    mount(elHost) {
      root = elHost;
      disposed = false;
      launching = false;
      render();
      unsubLang = onLangChange(render);
      ctx.stage.menu(ctx.registries.characters.all().slice(0, 3));
      ctx.music.play('menu');
    },
    unmount() {
      disposed = true;
      unsubLang?.();
      unsubLang = null;
      root = null;
    },
  };
}

export default createTournamentScreen;
