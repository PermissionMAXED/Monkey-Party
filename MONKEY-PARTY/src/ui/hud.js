/**
 * In-match HUD: top bar with one chip per player (portrait, coins, golden
 * bananas, held-item icons), a round/turn indicator, and a quit button.
 * createMatchHud(ctx, session) -> { root, update(state), dispose }.
 * update(state) is cheap and diff-based (no full re-render per frame).
 */

import { characters as characterRegistry } from '#shared/registries.js';
import { getItemIcon } from '../items/icons.js';
import { t } from './i18n.js';
import { el, div, button, clearNode, portraitImg } from './dom.js';

export function createMatchHud(ctx, session, { onQuit = null } = {}) {
  const root = div('hud');

  const roundBox = div('hud-round');
  const roundEl = div('hud-round__big', '');
  const phaseEl = div('hud-round__phase', '');
  roundBox.append(roundEl, phaseEl);
  root.appendChild(roundBox);

  const chipsWrap = div('hud-top');
  root.appendChild(chipsWrap);

  const quitBtn = button('✕', 'ui-btn--ghost ui-btn--small hud-quit', () => {
    if (window.confirm(t('hud.quitConfirm'))) onQuit?.();
  });
  quitBtn.title = t('hud.quit');
  root.appendChild(quitBtn);

  const hint = div('hud-hint', t('lobby.emoteHint'));
  root.appendChild(hint);

  /** pid -> {chip, coinsEl, bananasEl, itemsEl, lastCoins, lastBananas, lastItems} */
  const chips = new Map();
  let lastOrderKey = '';
  let lastRound = -1;
  let lastTurnPid = null;
  let lastPhase = null;

  function localPids() {
    try {
      const seats = session.localSeats();
      return new Set(seats.keys());
    } catch {
      return new Set();
    }
  }

  function buildChips(state) {
    clearNode(chipsWrap);
    chips.clear();
    const locals = localPids();
    for (const pid of state.turnOrder) {
      const p = state.players[pid];
      const chip = div(`hud-chip${locals.has(pid) ? ' hud-chip--local' : ''}`);
      const def = p.characterId ? characterRegistry.get(p.characterId) : null;
      chip.appendChild(portraitImg(def, 34));
      const body = div('hud-chip__body');
      const nameRow = div('hud-chip__name', p.name);
      const statRow = div('hud-chip__stats');
      const coinsEl = el('span', 'hud-chip__coins', `🪙 ${p.coins}`);
      const bananasEl = el('span', 'hud-chip__bananas', `🍌 ${p.goldenBananas}`);
      statRow.append(coinsEl, bananasEl);
      const itemsEl = div('hud-chip__items');
      body.append(nameRow, statRow, itemsEl);
      chip.appendChild(body);
      chipsWrap.appendChild(chip);
      chips.set(pid, {
        chip, coinsEl, bananasEl, itemsEl, lastCoins: p.coins, lastBananas: p.goldenBananas, lastItems: '',
      });
    }
  }

  function updateItems(entry, items) {
    const key = items.join(',');
    if (key === entry.lastItems) return;
    entry.lastItems = key;
    clearNode(entry.itemsEl);
    for (const id of items.slice(0, 3)) {
      const img = el('img');
      img.src = getItemIcon(id, 32);
      img.alt = id;
      img.draggable = false;
      entry.itemsEl.appendChild(img);
    }
    if (items.length > 3) entry.itemsEl.appendChild(el('span', 'ui-dim', `+${items.length - 3}`));
  }

  function bump(node) {
    node.classList.remove('hud-bump');
    void node.offsetWidth; // restart the CSS animation
    node.classList.add('hud-bump');
  }

  function update(state) {
    if (!state) return;
    const orderKey = state.turnOrder.join(',');
    if (orderKey !== lastOrderKey) {
      lastOrderKey = orderKey;
      buildChips(state);
    }
    if (state.round !== lastRound) {
      lastRound = state.round;
      roundEl.textContent = t('hud.round', { r: state.round, max: state.rules.rounds });
    }
    const curPid = state.turnOrder[state.currentTurn] ?? null;
    if (curPid !== lastTurnPid || state.phase !== lastPhase) {
      lastTurnPid = curPid;
      lastPhase = state.phase;
      const phaseLabel = t(`hud.phase.${state.phase}`);
      phaseEl.textContent = curPid && state.phase !== 'game_over'
        ? `${state.players[curPid]?.name ?? curPid} · ${phaseLabel}`
        : phaseLabel;
      for (const [pid, entry] of chips) {
        entry.chip.classList.toggle('hud-chip--current', pid === curPid && state.phase !== 'game_over');
      }
    }
    for (const [pid, entry] of chips) {
      const p = state.players[pid];
      if (!p) continue;
      if (p.coins !== entry.lastCoins) {
        entry.lastCoins = p.coins;
        entry.coinsEl.textContent = `🪙 ${p.coins}`;
        bump(entry.coinsEl);
      }
      if (p.goldenBananas !== entry.lastBananas) {
        entry.lastBananas = p.goldenBananas;
        entry.bananasEl.textContent = `🍌 ${p.goldenBananas}`;
        bump(entry.bananasEl);
      }
      updateItems(entry, p.items ?? []);
    }
  }

  return {
    root,
    update,
    dispose() {
      root.remove();
      chips.clear();
    },
  };
}

export default createMatchHud;
