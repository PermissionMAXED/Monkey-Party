/**
 * Shop-flavored decision prompts:
 *   - showShopModal: item stock with prices, buy repeatedly, leave
 *   - showBuyStarPrompt: golden banana purchase yes/no
 *   - showItemTargetPrompt: pick a target player/node for a used item
 * All run a ~20s countdown with a safe auto-default.
 *
 * Gamepad/keyboard parity: every prompt here is built on promptFrame
 * (junctionPrompt.js), which polls the deciding seat's InputFrame and maps
 * d-pad/stick to option focus + A to confirm - the shop cards, buy/decline
 * buttons and target cards are all plain <button>s inside the frame panel,
 * so they are navigable without a mouse.
 */

import { items as itemRegistry } from '#shared/registries.js';
import { getItemIcon } from '../items/icons.js';
import { t, localized } from './i18n.js';
import { el, div, button, playSfx } from './dom.js';
import { promptFrame } from './junctionPrompt.js';

/**
 * Shop stock modal. onBuy(itemId) answers the pending decision - the sim
 * then re-prompts with refreshed stock and the controller opens a fresh
 * modal; onLeave() ends the shop visit.
 *
 * @param {{
 *   stock: {id: string, price: number, rarity: string}[],
 *   coins: number,
 *   onBuy: (itemId: string) => void,
 *   onLeave: () => void,
 * }} opts
 */
export function showShopModal({ stock = [], coins = 0, onBuy, onLeave }) {
  let done = false;
  const frame = promptFrame(t('prompt.shop'), {
    dim: true,
    onDefault: () => answer(null),
  });
  function answer(itemId) {
    if (done) return;
    done = true;
    frame.close();
    if (itemId == null) onLeave();
    else onBuy(itemId);
  }

  frame.body.appendChild(div('shop-wallet', `🪙 ${coins}`));

  const list = div('shop-stock');
  for (const entry of stock) {
    const def = itemRegistry.get(entry.id);
    const card = el('button', 'shop-item');
    card.type = 'button';
    const img = el('img');
    img.src = getItemIcon(entry.id, 96);
    img.alt = def ? localized(def.name) : entry.id;
    img.draggable = false;
    const mid = div();
    mid.append(
      div('shop-item__name', def ? localized(def.name) : entry.id),
      div('shop-item__desc', def ? localized(def.description) : ''),
      div(`shop-item__rarity shop-item__rarity--${entry.rarity ?? 'common'}`, entry.rarity ?? ''),
    );
    const price = div('shop-item__price', `🪙 ${entry.price}`);
    card.append(img, mid, price);
    card.disabled = entry.price > coins;
    card.addEventListener('click', () => {
      playSfx('buy', { vol: 0.6 });
      answer(entry.id);
    });
    list.appendChild(card);
  }
  frame.body.appendChild(list);
  frame.body.appendChild(button(t('prompt.shopLeave'), 'ui-btn--wood', () => answer(null)));

  return { close: frame.close };
}

/**
 * Buy a golden banana? Auto-default: buy when affordable (a banana is
 * never a bad trade), otherwise decline.
 * @param {{price: number, coins: number, onAnswer: (buy: boolean) => void}} opts
 */
export function showBuyStarPrompt({ price = 20, coins = 0, onAnswer }) {
  let done = false;
  const affordable = coins >= price;
  const frame = promptFrame(t('prompt.buyStar', { price }), {
    onDefault: () => answer(affordable),
  });
  function answer(buy) {
    if (done) return;
    done = true;
    frame.close();
    onAnswer(buy);
  }
  const banana = div('', '🍌');
  banana.style.cssText = 'font-size:3.2rem;filter:drop-shadow(0 6px 14px rgba(255,217,77,0.5));'
    + 'animation: ui-title-bounce 1.6s ease-in-out infinite;';
  frame.body.appendChild(banana);
  frame.body.appendChild(div('shop-wallet', `🪙 ${coins}`));
  const row = div('prompt-row');
  const yes = button(t('prompt.buy'), 'ui-btn--green ui-btn--big', () => answer(true));
  yes.disabled = !affordable;
  row.append(yes, button(t('prompt.decline'), 'ui-btn--ghost', () => answer(false)));
  frame.body.appendChild(row);
  return { close: frame.close };
}

/**
 * Pick a target for an item. `options` are player ids OR node ids.
 * Auto-default: cancel the item (null) - never randomly attack someone.
 *
 * @param {{
 *   options: string[],
 *   labelFor?: (target: string) => string,
 *   portraitFor?: (target: string) => HTMLElement|null,
 *   onPick: (target: string|null) => void,
 * }} opts
 */
export function showItemTargetPrompt({ options = [], labelFor = null, portraitFor = null, onPick }) {
  let done = false;
  const frame = promptFrame(t('prompt.itemTarget'), {
    onDefault: () => answer(null),
  });
  function answer(target) {
    if (done) return;
    done = true;
    frame.close();
    onPick(target);
  }
  const row = div('target-row');
  for (const target of options) {
    const card = el('button', 'target-card');
    card.type = 'button';
    const face = portraitFor?.(target);
    if (face) card.appendChild(face);
    card.appendChild(el('span', '', labelFor?.(target) ?? target));
    card.addEventListener('click', () => {
      playSfx('click');
      answer(target);
    });
    row.appendChild(card);
  }
  frame.body.appendChild(row);
  frame.body.appendChild(button(t('prompt.itemTargetCancel'), 'ui-btn--ghost', () => answer(null)));
  return { close: frame.close };
}

export default showShopModal;
