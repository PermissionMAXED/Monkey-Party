/**
 * Statistics screen. With `params.match` it first shows the finished
 * match's stats table (per-player bananas/coins/minigame wins/items/fields),
 * then the lifetime profile stats below.
 */

import { t, onLangChange } from './i18n.js';
import { el, div, button, clearNode } from './dom.js';

export function createStatsScreen(ctx) {
  let root = null;
  let params = {};
  let unsubLang = null;

  function matchTable(match) {
    const table = el('table', 'stats-table');
    const head = el('tr');
    for (const key of ['stats.col.player', 'stats.col.bananas', 'stats.col.coins', 'stats.col.mgWins', 'stats.col.itemsUsed', 'stats.col.fields']) {
      head.appendChild(el('th', '', t(key)));
    }
    table.appendChild(head);
    for (const row of match.rows) {
      const tr = el('tr', row.playerId === match.winner ? 'stats-row--winner' : '');
      tr.appendChild(el('td', '', `${row.playerId === match.winner ? '👑 ' : ''}${row.name}`));
      tr.appendChild(el('td', '', String(row.goldenBananas)));
      tr.appendChild(el('td', '', String(row.coins)));
      tr.appendChild(el('td', '', String(row.minigameWins)));
      tr.appendChild(el('td', '', String(row.itemsUsed)));
      tr.appendChild(el('td', '', String(row.fieldsMoved)));
      table.appendChild(tr);
    }
    return table;
  }

  function render() {
    clearNode(root);
    const wrap = div('ui-screen');
    const panel = div('ui-panel ui-scroll-y');
    panel.style.cssText = 'width:min(760px,94vw);max-height:86vh;';
    panel.appendChild(el('h1', 'ui-heading', t('stats.title')));

    if (params.match) {
      panel.appendChild(el('div', 'ui-section-label', t('stats.match')));
      panel.appendChild(matchTable(params.match));
      panel.appendChild(el('div', '', '\u00a0'));
    }

    panel.appendChild(el('div', 'ui-section-label', t('stats.lifetime')));
    const profile = ctx.profile.get();
    const cards = div('stats-cards');
    const entries = [
      ['stats.gamesPlayed', profile.stats.gamesPlayed],
      ['stats.gamesWon', profile.stats.gamesWon],
      ['stats.minigamesPlayed', profile.stats.minigamesPlayed],
      ['stats.minigamesWon', profile.stats.minigamesWon],
      ['stats.coinsEarned', profile.stats.coinsEarned],
      ['stats.starsCollected', profile.stats.starsCollected],
      ['stats.bananaBank', profile.goldenBananas],
    ];
    for (const [key, value] of entries) {
      const card = div('stats-card');
      card.append(div('stats-card__value', String(value)), div('stats-card__label', t(key)));
      cards.appendChild(card);
    }
    panel.appendChild(cards);

    const row = div('ui-row');
    row.style.marginTop = '18px';
    row.append(button(t('stats.toMenu'), 'ui-btn--green', () => ctx.router.go('mainMenu')));
    panel.appendChild(row);

    wrap.appendChild(panel);
    root.appendChild(wrap);
  }

  return {
    mount(elHost, p = {}) {
      root = elHost;
      params = p ?? {};
      render();
      unsubLang = onLangChange(render);
      ctx.stage.menu(ctx.registries.characters.all().slice(0, 3));
    },
    unmount() {
      unsubLang?.();
      unsubLang = null;
      root = null;
      params = {};
    },
  };
}
