/**
 * How-to-Play screen: a localized, tabbed guide.
 *
 *   Party flow - rounds, dice, coins, golden bananas, star purchase
 *   Boards     - node color legend (matches the boards package discs)
 *   Items      - live view of the items registry
 *   Minigames  - category explanations + controls table
 *   Online     - quick match, lobby codes, reconnection
 *
 * Strings live in help/strings.js (registered through i18n.extendDict).
 * Mount/unmount follow the router contract (src/app/screenRouter.js).
 */

import { NODE_TYPES, MINIGAME_CATEGORIES } from '#shared/constants.js';
import { registries as sharedRegistries } from '#shared/registries.js';
import { t, localized, onLangChange } from '../i18n.js';
import { el, div, button, clearNode, playSfx } from '../dom.js';
import './strings.js'; // registers the 'help.*' dictionary entries

/* Item icons come from the optional items package
 * (import.meta.glob: an absent module stays silent, no devtools 404). */
const ICON_LOADERS = import.meta.glob('../../items/icons.js');
let getItemIcon = null;
const iconsReady = Promise.resolve(ICON_LOADERS['../../items/icons.js']?.())
  .then((mod) => {
    const fn = mod?.getItemIcon ?? mod?.default;
    if (typeof fn === 'function') getItemIcon = fn;
  })
  .catch(() => { /* optional - fallback discs are used instead */ });

/**
 * Node disc colors, mirroring NODE_COLORS in src/boards/index.js (the ui
 * package must not hard-depend on the boards package). Only the types
 * shown in the legend are listed; keep in sync with the boards package.
 */
const LEGEND_COLORS = {
  blue: '#3a7bd5',
  red: '#e5484d',
  event: '#f5a623',
  item: '#9b59b6',
  shop: '#3ecf8e',
  star: '#ffd23f',
  boss: '#8b0000',
  trap: '#7f8c8d',
  junction: '#f39c12',
};

const TABS = ['party', 'boards', 'items', 'minigames', 'online'];

export function createHowToPlayScreen(ctx) {
  const regs = ctx?.registries ?? sharedRegistries;
  let root = null;
  let unsubLang = null;
  let activeTab = TABS[0];

  /* ---------------- tab bodies ---------------- */

  function sectionPair(titleKey, textKey, vars = null) {
    return [div('help-section-title', t(titleKey)), el('p', '', t(textKey, vars))];
  }

  function partyTab(body) {
    body.append(
      ...sectionPair('help.party.roundsTitle', 'help.party.rounds'),
      ...sectionPair('help.party.diceTitle', 'help.party.dice'),
      ...sectionPair('help.party.coinsTitle', 'help.party.coins'),
      ...sectionPair('help.party.bananasTitle', 'help.party.bananas'),
      ...sectionPair('help.party.bonusTitle', 'help.party.bonus'),
    );
  }

  function boardsTab(body) {
    body.appendChild(el('p', '', t('help.boards.intro', { n: regs.boards?.count?.() ?? 0 })));
    const grid = div('help-node-grid');
    // Registry order comes from shared/constants.js NODE_TYPES; only the
    // player-facing types get a legend chip (start/special are neutral).
    for (const type of NODE_TYPES) {
      if (!LEGEND_COLORS[type]) continue;
      const chip = div('help-chip');
      const dot = div('help-chip__dot');
      dot.style.background = LEGEND_COLORS[type];
      chip.append(dot, el('span', '', t(`help.node.${type}`)));
      grid.append(chip, div('help-node-desc', t(`help.node.${type}.desc`)));
    }
    body.appendChild(grid);
  }

  function itemIconNode(def) {
    if (getItemIcon) {
      const img = el('img', 'help-item__icon');
      img.src = getItemIcon(def.id, 96);
      img.alt = localized(def.name);
      img.draggable = false;
      return img;
    }
    // Fallback disc from the def's own icon spec (icons package absent).
    const disc = div('help-item__icon help-item__icon--fallback', (localized(def.name)[0] ?? '?').toUpperCase());
    disc.style.background = def.icon?.bg ?? 'rgba(0,0,0,0.4)';
    disc.dataset.itemId = def.id;
    return disc;
  }

  function itemsTab(body) {
    const defs = regs.items?.all?.() ?? [];
    body.appendChild(el('p', '', t('help.items.intro', { n: defs.length })));
    if (defs.length === 0) {
      body.appendChild(div('ui-dim', t('help.items.empty')));
      return;
    }
    const list = div('help-items');
    for (const def of defs) {
      const row = div('help-item');
      const text = div('');
      text.append(
        div('help-item__name', localized(def.name)),
        div('help-item__desc', localized(def.description)),
      );
      const meta = div('help-item__meta');
      meta.append(
        div('help-item__price', `${def.price} 🪙`),
        div(`help-item__tag help-item__tag--${def.rarity}`, t(`help.rarity.${def.rarity}`)),
        div('help-item__tag', t(`help.itemPhase.${def.phase}`)),
      );
      row.append(itemIconNode(def), text, meta);
      list.appendChild(row);
    }
    body.appendChild(list);
    // Icons may finish loading after the first paint: upgrade in place.
    iconsReady.then(() => {
      if (!getItemIcon || !list.isConnected) return;
      for (const disc of list.querySelectorAll('.help-item__icon--fallback')) {
        const def = regs.items?.get?.(disc.dataset.itemId);
        if (def) disc.replaceWith(itemIconNode(def));
      }
    });
  }

  function controlsRow(deviceNode, moveNode, aNode, bNode) {
    const tr = el('tr');
    for (const cell of [deviceNode, moveNode, aNode, bNode]) {
      const td = el('td');
      if (typeof cell === 'string') td.textContent = cell;
      else td.appendChild(cell);
      tr.appendChild(td);
    }
    return tr;
  }

  function keys(...names) {
    const span = el('span');
    names.forEach((name, i) => {
      if (i > 0) span.appendChild(document.createTextNode(' '));
      span.appendChild(el('span', 'help-key', name));
    });
    return span;
  }

  function minigamesTab(body) {
    body.appendChild(el('p', '', t('help.mg.intro', { n: regs.minigames?.count?.() ?? 0 })));
    // Category order follows shared/constants.js MINIGAME_CATEGORIES.
    for (const cat of MINIGAME_CATEGORIES) {
      const row = div('help-cat');
      row.append(div('help-cat__tag', cat), el('p', '', t(`help.mgcat.${cat}`)));
      body.appendChild(row);
    }

    body.appendChild(div('help-section-title', t('help.controls.title')));
    const table = el('table', 'help-table');
    const head = el('tr');
    for (const label of [t('help.controls.device'), t('help.controls.move'), 'A', 'B']) {
      head.appendChild(el('th', '', label));
    }
    table.appendChild(head);
    // Mappings mirror src/engine/input.js (kb1/kb2/kb3, gamepad, touch).
    table.append(
      controlsRow(`⌨️ ${t('help.controls.kb1')}`, keys('W', 'A', 'S', 'D'), keys('F'), keys('G')),
      controlsRow(`⌨️ ${t('help.controls.kb2')}`, keys(t('help.controls.arrows')), keys('K'), keys('L')),
      controlsRow(`⌨️ ${t('help.controls.kb3')}`, keys('I', 'J', 'K', 'L'), keys('H'), keys('N')),
      controlsRow(`🎮 ${t('help.controls.gamepad')}`, t('help.controls.stick'), keys('A / ✕'), keys('B / ◯')),
      controlsRow(`📱 ${t('help.controls.touch')}`, t('help.controls.vstick'), t('help.controls.abtn'), t('help.controls.bbtn')),
    );
    body.appendChild(table);
    body.appendChild(el('p', 'ui-dim', t('help.controls.note')));
  }

  function onlineTab(body) {
    body.append(
      ...sectionPair('help.online.quickTitle', 'help.online.quick'),
      ...sectionPair('help.online.codesTitle', 'help.online.codes'),
      ...sectionPair('help.online.reconnectTitle', 'help.online.reconnect'),
      div('ui-dim', t('help.online.serverNote')),
    );
  }

  const TAB_BUILDERS = {
    party: partyTab,
    boards: boardsTab,
    items: itemsTab,
    minigames: minigamesTab,
    online: onlineTab,
  };

  /* ---------------- render ---------------- */

  function render() {
    clearNode(root);
    const wrap = div('ui-screen');
    const panel = div('ui-panel help-screen');

    panel.appendChild(el('h1', 'ui-heading', t('help.title')));

    const tabs = div('help-tabs');
    for (const tab of TABS) {
      const b = el('button', `preset-chip${tab === activeTab ? ' preset-chip--on' : ''}`, t(`help.tab.${tab}`));
      b.type = 'button';
      b.setAttribute('aria-pressed', String(tab === activeTab));
      b.addEventListener('click', () => {
        if (tab === activeTab) return;
        playSfx('click');
        activeTab = tab;
        render();
      });
      tabs.appendChild(b);
    }
    panel.appendChild(tabs);

    const body = div('help-body');
    TAB_BUILDERS[activeTab]?.(body);
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
      activeTab = TABS[0];
      render();
      unsubLang = onLangChange(render);
      ctx.stage?.menu?.(regs.characters?.all?.()?.slice(0, 3) ?? []);
    },
    unmount() {
      unsubLang?.();
      unsubLang = null;
      root = null;
    },
  };
}

export default createHowToPlayScreen;
