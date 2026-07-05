/**
 * Achievements screen: a grid of locked/unlocked achievement cards with
 * progress hints for counter-style achievements. Localized (en/de),
 * mobile-friendly (single column under 600px, scrollable body).
 *
 * Mount/unmount follow the router contract (src/app/screenRouter.js).
 */

import { t, localized, onLangChange } from '../i18n.js';
import { el, div, button, clearNode } from '../dom.js';
import { ACHIEVEMENTS } from './achievements.js';
import './strings.js'; // registers the 'prog.*' dictionary entries

export function createAchievementsScreen(ctx) {
  let root = null;
  let unsubLang = null;

  function card(def, unlocked, profile) {
    const node = div(`prog-ach-card ${unlocked ? 'prog-ach-card--unlocked' : 'prog-ach-card--locked'}`);
    node.appendChild(div('prog-ach-card__icon', unlocked ? def.icon : '🔒'));
    const body = div();
    body.appendChild(div('prog-ach-card__name', localized(def.name)));
    body.appendChild(div('prog-ach-card__desc', localized(def.desc)));
    if (!unlocked && typeof def.progress === 'function') {
      let cur = 0;
      let goal = 1;
      try {
        const p = def.progress(profile);
        cur = Math.max(0, Number(p?.cur) || 0);
        goal = Math.max(1, Number(p?.goal) || 1);
      } catch { /* hints are optional */ }
      const hint = div('prog-ach-card__hint', `${Math.min(cur, goal)} / ${goal}`);
      const bar = div('prog-mini-bar');
      const fill = div('prog-mini-bar__fill');
      fill.style.width = `${Math.min(100, Math.round((cur / goal) * 100))}%`;
      bar.appendChild(fill);
      body.append(hint, bar);
    } else if (unlocked) {
      body.appendChild(div('prog-ach-card__hint', `✓ ${def.icon}`));
    }
    node.appendChild(body);
    return node;
  }

  function render() {
    clearNode(root);
    const profile = ctx.profile.get();
    const unlockedIds = new Set(profile.achievements);

    const wrap = div('ui-screen');
    const panel = div('ui-panel prog-screen');
    panel.appendChild(el('h1', 'ui-heading', t('prog.ach.title')));
    panel.appendChild(div('ui-section-label', t('prog.ach.count', {
      n: ACHIEVEMENTS.filter((a) => unlockedIds.has(a.id)).length,
      total: ACHIEVEMENTS.length,
    })));

    const body = div('prog-body');
    const grid = div('prog-ach-grid');
    // Unlocked first, catalog order within each group.
    const sorted = [...ACHIEVEMENTS].sort(
      (a, b) => Number(unlockedIds.has(b.id)) - Number(unlockedIds.has(a.id)),
    );
    for (const def of sorted) grid.appendChild(card(def, unlockedIds.has(def.id), profile));
    body.appendChild(grid);
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
      render();
      unsubLang = onLangChange(render);
      ctx.stage?.menu?.(ctx.registries?.characters?.all?.()?.slice(0, 3) ?? []);
    },
    unmount() {
      unsubLang?.();
      unsubLang = null;
      root = null;
    },
  };
}

export default createAchievementsScreen;
