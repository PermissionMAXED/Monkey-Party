/**
 * Statistics screen. With `params.match` it first shows the finished
 * match's stats table (per-player bananas/coins/minigame wins/items/fields),
 * then the lifetime profile stats below, the level/XP progress bar, the
 * per-character and per-minigame tallies, and links to the Achievements /
 * Match History screens (when the progression package registered them).
 *
 * With `params.progression` ({xpGained, leveledUpTo, newAchievements,
 * bananasEarned} from src/app/progression.js applyMatchResults) the XP bar
 * animates its fill and unlock banners drop in. The screen must tolerate
 * the absence of params.progression forever (plain non-animated render).
 */

import { t, localized, onLangChange } from './i18n.js';
import { el, div, button, clearNode, playSfx } from './dom.js';
import { levelForXp, xpForLevel } from '../app/profileStore.js';

export function createStatsScreen(ctx) {
  let root = null;
  let params = {};
  let unsubLang = null;
  let timers = [];
  /** The XP/banner animation plays once per mount, not on lang re-renders. */
  let animated = false;

  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

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

  /* ---------------- level / XP progress bar ---------------- */

  function xpBlock(profile, progression, animate) {
    const xp = profile.xp;
    const level = levelForXp(xp);
    const base = xpForLevel(level);
    const next = xpForLevel(level + 1);
    const span = Math.max(1, next - base);
    const pct = Math.min(100, Math.max(0, ((xp - base) / span) * 100));

    const block = div();
    block.style.cssText = 'margin:14px 0 4px;';

    const head = div();
    head.style.cssText = 'display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;';
    const levelLabel = el('b', '', t('stats.level', { n: level }));
    levelLabel.style.cssText = 'color:var(--ui-yellow);font-size:1.05rem;letter-spacing:0.04em;';
    const xpLabel = div('ui-dim', t('stats.xpProgress', { cur: xp - base, next: span }));
    xpLabel.style.cssText = 'font-variant-numeric:tabular-nums;font-size:0.8rem;';
    head.append(levelLabel, xpLabel);
    block.appendChild(head);

    const bar = div();
    bar.style.cssText = 'height:16px;margin-top:6px;border-radius:8px;background:rgba(0,0,0,0.45);'
      + 'border:1px solid rgba(255,255,255,0.12);overflow:hidden;';
    const fill = div();
    fill.style.cssText = 'height:100%;border-radius:8px;background:linear-gradient(90deg,#f5a623,#ffd23f);'
      + 'transition:width 1.2s cubic-bezier(0.22, 0.9, 0.35, 1);';
    bar.appendChild(fill);
    block.appendChild(bar);

    const gained = Math.max(0, Number(progression?.xpGained) || 0);
    if (animate && gained > 0) {
      // Start from the pre-match XP (clamped into the current level's
      // window: a level-up starts the new level's bar from empty).
      const oldXp = Math.max(0, xp - gained);
      const oldPct = Math.min(100, Math.max(0, ((oldXp - base) / span) * 100));
      fill.style.width = `${oldPct}%`;
      later(() => {
        fill.style.width = `${pct}%`;
        playSfx('tick', { vol: 0.4 });
      }, 350);

      const chip = el('span', '', t('stats.xpGained', { n: gained }));
      chip.style.cssText = 'font-weight:900;color:var(--ui-yellow);font-size:0.9rem;';
      head.appendChild(chip);
      chip.animate?.([
        { transform: 'translateY(10px) scale(0.7)', opacity: 0 },
        { transform: 'translateY(0) scale(1)', opacity: 1 },
      ], { duration: 420, delay: 250, easing: 'cubic-bezier(0.3, 1.4, 0.4, 1)', fill: 'backwards' });

      if (progression?.leveledUpTo) {
        const up = div('', `🎊 ${t('stats.levelUp', { n: progression.leveledUpTo })}`);
        up.style.cssText = 'margin-top:8px;font-weight:900;color:var(--ui-yellow);letter-spacing:0.06em;'
          + 'text-shadow:0 2px 6px rgba(0,0,0,0.6);';
        block.appendChild(up);
        up.animate?.([
          { transform: 'scale(0.4)', opacity: 0 },
          { transform: 'scale(1.15)', opacity: 1, offset: 0.7 },
          { transform: 'scale(1)', opacity: 1 },
        ], { duration: 620, delay: 1300, easing: 'cubic-bezier(0.3, 1.5, 0.4, 1)', fill: 'backwards' });
        later(() => playSfx('fanfare', { vol: 0.6 }), 1300);
      }
    } else {
      fill.style.width = `${pct}%`;
    }
    return block;
  }

  /* ---------------- achievement unlock banners ---------------- */

  function achievementBanners(progression, animate) {
    const defs = Array.isArray(progression?.newAchievements) ? progression.newAchievements : [];
    if (defs.length === 0) return null;
    const wrap = div();
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-top:10px;';
    defs.forEach((def, i) => {
      const banner = div();
      banner.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:12px;'
        + 'border:2px solid var(--ui-yellow);background:rgba(255,217,77,0.12);';
      const icon = el('span', '', def?.icon ?? '🏆');
      icon.style.cssText = 'font-size:1.5rem;line-height:1;';
      const text = div();
      const label = div('ui-dim', t('stats.achievementUnlocked'));
      label.style.cssText = 'font-size:0.7rem;letter-spacing:0.12em;text-transform:uppercase;';
      const name = el('b', '', localized(def?.name) || def?.id || '?');
      name.style.cssText = 'color:var(--ui-yellow);';
      text.append(label, name);
      banner.append(icon, text);
      wrap.appendChild(banner);
      if (animate) {
        banner.animate?.([
          { transform: 'translateX(-26px) scale(0.92)', opacity: 0 },
          { transform: 'translateX(0) scale(1)', opacity: 1 },
        ], { duration: 420, delay: 600 + i * 260, easing: 'cubic-bezier(0.3, 1.4, 0.4, 1)', fill: 'backwards' });
        later(() => playSfx('star', { vol: 0.5 }), 600 + i * 260);
      }
    });
    return wrap;
  }

  /* ---------------- per-character / per-minigame tallies ---------------- */

  function tallyTable(nameHeaderKey, rows) {
    const table = el('table', 'stats-table');
    const head = el('tr');
    for (const key of [nameHeaderKey, 'stats.col.plays', 'stats.col.wins']) {
      head.appendChild(el('th', '', t(key)));
    }
    table.appendChild(head);
    for (const row of rows) {
      const tr = el('tr');
      tr.appendChild(el('td', '', row.label));
      tr.appendChild(el('td', '', String(row.plays)));
      tr.appendChild(el('td', '', String(row.wins)));
      table.appendChild(tr);
    }
    return table;
  }

  function sortedTallies(map, labelFor, limit = Infinity) {
    return Object.entries(map ?? {})
      .map(([id, tally]) => ({ label: labelFor(id), plays: tally.plays, wins: tally.wins }))
      .sort((a, b) => b.plays - a.plays || b.wins - a.wins)
      .slice(0, limit);
  }

  /* ---------------- render ---------------- */

  function render() {
    clearNode(root);
    const animate = !animated && !!params.progression;
    animated = true;

    const wrap = div('ui-screen');
    const panel = div('ui-panel ui-scroll-y');
    panel.style.cssText = 'width:min(760px,94vw);max-height:86vh;';
    panel.appendChild(el('h1', 'ui-heading', t('stats.title')));

    if (params.match) {
      panel.appendChild(el('div', 'ui-section-label', t('stats.match')));
      panel.appendChild(matchTable(params.match));
      panel.appendChild(el('div', '', '\u00a0'));
    }

    const profile = ctx.profile.get();

    /* Level + XP (+ unlock banners when a progression payload came along). */
    panel.appendChild(xpBlock(profile, params.progression, animate));
    const banners = achievementBanners(params.progression, animate);
    if (banners) panel.appendChild(banners);

    panel.appendChild(el('div', 'ui-section-label', t('stats.lifetime')));
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

    /* Per-character tallies (only characters actually played). */
    const charRows = sortedTallies(profile.perCharacter, (id) => {
      const def = ctx.registries?.characters?.get?.(id);
      return def?.name ?? id;
    });
    if (charRows.length > 0) {
      panel.appendChild(el('div', 'ui-section-label', t('stats.perCharacter')));
      panel.appendChild(tallyTable('stats.col.name', charRows));
    }

    /* Per-minigame top 5 by plays. */
    const mgRows = sortedTallies(profile.perMinigame, (id) => {
      const def = ctx.registries?.minigames?.get?.(id);
      return localized(def?.name) || id;
    }, 5);
    if (mgRows.length > 0) {
      panel.appendChild(el('div', 'ui-section-label', t('stats.perMinigame')));
      panel.appendChild(tallyTable('stats.col.name', mgRows));
    }

    /* Links to the progression screens (only when they registered). */
    const row = div('ui-row');
    row.style.marginTop = '18px';
    if (ctx.router.has?.('achievements')) {
      row.append(button(`🏆 ${t('prog.menu.achievements')}`, 'ui-btn--wood', () => ctx.router.go('achievements')));
    }
    if (ctx.router.has?.('history')) {
      row.append(button(`📜 ${t('prog.menu.history')}`, 'ui-btn--wood', () => ctx.router.go('history')));
    }
    row.append(button(t('stats.toMenu'), 'ui-btn--green', () => ctx.router.go('mainMenu')));
    panel.appendChild(row);

    wrap.appendChild(panel);
    root.appendChild(wrap);
  }

  return {
    mount(elHost, p = {}) {
      root = elHost;
      params = p ?? {};
      animated = false;
      render();
      unsubLang = onLangChange(render);
      ctx.stage.menu(ctx.registries.characters.all().slice(0, 3));
    },
    unmount() {
      unsubLang?.();
      unsubLang = null;
      for (const id of timers) clearTimeout(id);
      timers = [];
      root = null;
      params = {};
    },
  };
}
