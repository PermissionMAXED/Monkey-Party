/**
 * Item bar for the local player: slots for held items (icons via
 * src/items/icons.js). Usable items glow and are clickable during the item
 * phase; clicking answers the pending 'roll' prompt with {itemId} (which
 * the board-play decision mapper turns into a useItem action).
 */

import { items as itemRegistry } from '#shared/registries.js';
import { getItemIcon } from '../items/icons.js';
import { t, localized } from './i18n.js';
import { el, div, playSfx } from './dom.js';

/**
 * @param {{
 *   player: Object MatchPlayerState of the local player,
 *   usable: string[] Item ids usable right now ([] outside the item phase),
 *   onUse: (itemId: string) => void,
 * }} opts
 * @returns {HTMLElement}
 */
export function buildItemBar({ player, usable = [], onUse }) {
  const bar = div('item-bar');
  bar.style.position = 'static'; // inline inside prompts; absolute in HUD
  bar.appendChild(div('item-bar__label', t('hud.items')));

  const held = player?.items ?? [];
  if (held.length === 0) {
    const empty = div('item-slot item-slot--empty');
    bar.appendChild(empty);
    return bar;
  }

  const counts = new Map(); // itemId -> count
  for (const id of held) counts.set(id, (counts.get(id) ?? 0) + 1);

  for (const [itemId, count] of counts) {
    const def = itemRegistry.get(itemId);
    const canUse = usable.includes(itemId);
    const slot = el('button', `item-slot${canUse ? ' item-slot--usable' : ''}`);
    slot.type = 'button';
    const img = el('img');
    img.src = getItemIcon(itemId, 64);
    img.alt = def ? localized(def.name) : itemId;
    img.draggable = false;
    slot.appendChild(img);
    if (count > 1) {
      const badge = el('span', 'item-slot__count', `×${count}`);
      badge.style.cssText = 'position:absolute;right:2px;bottom:2px;font-size:0.7rem;font-weight:900;'
        + 'background:rgba(0,0,0,0.7);border-radius:6px;padding:0 4px;color:var(--ui-yellow);';
      slot.appendChild(badge);
    }
    slot.title = def
      ? `${localized(def.name)} — ${localized(def.description)}`
      : itemId;
    if (canUse && onUse) {
      slot.addEventListener('click', () => {
        playSfx('click');
        onUse(itemId);
      });
    } else {
      slot.disabled = true;
    }
    bar.appendChild(slot);
  }
  return bar;
}

export default buildItemBar;
