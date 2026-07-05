/**
 * Match-history screen: the profile's last 20 match summaries as a list
 * of expandable rows (tap the header to reveal the per-player table).
 * Localized (en/de), mobile-friendly.
 *
 * Mount/unmount follow the router contract (src/app/screenRouter.js).
 */

import { t, localized, onLangChange, getLang } from '../i18n.js';
import { el, div, button, clearNode, playSfx } from '../dom.js';
import './strings.js'; // registers the 'prog.*' dictionary entries

export function createHistoryScreen(ctx) {
  let root = null;
  let unsubLang = null;
  /** Indices of currently expanded rows (kept across re-renders). */
  let open = new Set();

  function boardName(boardId) {
    const def = ctx.registries?.boards?.get?.(boardId);
    const name = localized(def?.name);
    return name || boardId || t('prog.hist.unknownBoard');
  }

  function whenLabel(when) {
    if (!when) return '';
    try {
      return new Date(when).toLocaleString(getLang() === 'de' ? 'de-DE' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return '';
    }
  }

  function playersTable(entry) {
    const table = el('table', 'stats-table');
    const head = el('tr');
    for (const key of ['stats.col.name', 'stats.col.bananas', 'stats.col.coins']) {
      head.appendChild(el('th', '', t(key)));
    }
    table.appendChild(head);
    for (const p of entry.players) {
      const isWinner = p.name === entry.winnerName;
      const tr = el('tr', isWinner ? 'stats-row--winner' : '');
      const charDef = p.characterId ? ctx.registries?.characters?.get?.(p.characterId) : null;
      const label = `${isWinner ? '👑 ' : ''}${p.name}${p.isLocal ? ` (${t('hud.you')})` : ''}${charDef ? ` · ${charDef.name}` : ''}`;
      tr.appendChild(el('td', '', label));
      tr.appendChild(el('td', '', String(p.bananas)));
      tr.appendChild(el('td', '', String(p.coins)));
      table.appendChild(tr);
    }
    return table;
  }

  function row(entry, index) {
    const isOpen = open.has(index);
    const node = div(`prog-hist-row${isOpen ? ' prog-hist-row--open' : ''}`);

    const head = el('button', 'prog-hist-row__head');
    head.type = 'button';
    head.setAttribute('aria-expanded', String(isOpen));
    head.appendChild(div('prog-hist-row__place', `#${entry.placement}`));
    const info = div();
    info.appendChild(div('prog-hist-row__board', boardName(entry.boardId)));
    const meta = [
      whenLabel(entry.when),
      t('prog.hist.rounds', { n: entry.rounds }),
      t('prog.hist.winner', { name: entry.winnerName }),
    ].filter(Boolean).join(' · ');
    info.appendChild(div('prog-hist-row__meta', meta));
    head.appendChild(info);
    head.appendChild(div('prog-hist-row__chevron', '›'));
    head.addEventListener('click', () => {
      playSfx('click');
      if (open.has(index)) open.delete(index);
      else open.add(index);
      render();
    });
    node.appendChild(head);

    if (isOpen) {
      const body = div('prog-hist-row__body');
      body.appendChild(div('ui-dim prog-hist-row__meta', t('prog.hist.placement', { n: entry.placement })));
      body.appendChild(playersTable(entry));
      node.appendChild(body);
    }
    return node;
  }

  function render() {
    clearNode(root);
    const history = ctx.profile.get().history;

    const wrap = div('ui-screen');
    const panel = div('ui-panel prog-screen');
    panel.appendChild(el('h1', 'ui-heading', t('prog.hist.title')));

    const body = div('prog-body');
    if (history.length === 0) {
      body.appendChild(div('ui-dim', t('prog.hist.empty')));
    } else {
      const list = div('prog-hist-list');
      history.forEach((entry, i) => list.appendChild(row(entry, i)));
      body.appendChild(list);
    }
    panel.appendChild(body);

    const actions = div('ui-row');
    actions.appendChild(button(t('generic.back'), 'ui-btn--ghost', () => ctx.router.back()));
    panel.appendChild(actions);

    wrap.appendChild(panel);
    root.appendChild(wrap);
  }

  return {
    mount(elHost) {
      root = elHost;
      open = new Set();
      render();
      unsubLang = onLangChange(render);
      ctx.stage?.menu?.(ctx.registries?.characters?.all?.()?.slice(0, 3) ?? []);
    },
    unmount() {
      unsubLang?.();
      unsubLang = null;
      root = null;
      open = new Set();
    },
  };
}

export default createHistoryScreen;
