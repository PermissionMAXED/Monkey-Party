/**
 * Post-minigame results overlay (spectacle edition): a podium-style ranking
 * reveal - 3rd place drops in first, then 2nd, then a drumroll leads into
 * the 1st-place reveal with a crown and 'crowd_cheer' - each podium column
 * running an animated coin count-up. Players beyond the podium slide in as
 * classic rows below. Then the round-end standings (sorted by golden
 * bananas, coins as tiebreak). Auto-continues so bot-only flows never
 * stall.
 *
 * Reduced-motion (body.reduced-motion) reveals everything instantly with
 * final coin values; fastMode (MatchState.fastMode) halves the stagger.
 */

import { characters as characterRegistry } from '#shared/registries.js';
import { t } from './i18n.js';
import { el, div, button, overlay, portraitImg, countUp, playSfx } from './dom.js';
import { ensureSpectacleStyles } from './spectacleStrings.js';

const AUTO_CONTINUE_SEC = 9;

function placeLabel(i) {
  if (i < 3) return t(`mg.place.${i + 1}`);
  return t('mg.place.n', { n: i + 1 });
}

function reducedMotion() {
  return typeof document !== 'undefined' && !!document.body?.classList?.contains('reduced-motion');
}

/**
 * @param {{
 *   results: {ranking: Array<string|string[]>, coins?: Object<string, number>},
 *   state: Object MatchState AFTER the results were applied,
 *   onDone: () => void,
 * }} opts
 * @returns {{close: () => void}}
 */
export function showMinigameResults({ results, state, onDone }) {
  ensureSpectacleStyles();
  const modal = overlay({ dim: true });
  let finished = false;
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  const reduced = reducedMotion();
  const speed = state?.fastMode ? 0.5 : 1;
  const at = (fn, ms) => (reduced ? fn() : later(fn, ms * speed));

  function done() {
    if (finished) return;
    finished = true;
    for (const id of timers) clearTimeout(id);
    modal.close();
    onDone?.();
  }
  later(done, AUTO_CONTINUE_SEC * 1000);

  modal.panel.appendChild(el('h1', 'ui-heading', t('mg.results')));

  const flat = (results?.ranking ?? []).flat();

  /* ---------------- podium (top 3, revealed 3rd -> 2nd -> 1st) ------- */

  /** One podium column (place = 0-based rank). Starts hidden. */
  function podiumCol(pid, place) {
    const p = state?.players?.[pid];
    const def = p?.characterId ? characterRegistry.get(p.characterId) : null;
    const col = div(`sp-podium__col${reduced ? '' : ' sp-hidden'}`);
    if (place === 0) col.appendChild(div('sp-podium__crown', '👑'));
    col.appendChild(portraitImg(def, place === 0 ? 52 : 40));
    col.appendChild(div('sp-podium__name', p?.name ?? pid));
    const coinsEl = div('sp-podium__coins', '+0 🪙');
    col.appendChild(coinsEl);
    col.appendChild(div(`sp-podium__block sp-podium__block--${place + 1}`, placeLabel(place)));
    const gain = results?.coins?.[pid] ?? 0;
    return { col, coinsEl, gain, place };
  }

  const podium = div('sp-podium');
  const cols = flat.slice(0, 3).map((pid, i) => podiumCol(pid, i));
  // Classic podium arrangement: 2nd | 1st | 3rd (whatever exists).
  for (const spot of [1, 0, 2]) {
    if (cols[spot]) podium.appendChild(cols[spot].col);
  }
  if (cols.length > 0) modal.panel.appendChild(podium);

  function revealCol(entry) {
    if (finished || !entry) return;
    entry.col.classList.remove('sp-hidden');
    if (!reduced) entry.col.classList.add('sp-drop');
    if (reduced) {
      entry.coinsEl.textContent = `+${entry.gain} 🪙`;
    } else {
      countUp(entry.coinsEl, 0, entry.gain, 700 * speed, (v) => `+${v} 🪙`);
    }
    if (entry.place === 0) {
      playSfx('crowd_cheer', { vol: 0.8 });
      playSfx('fanfare', { vol: 0.5 });
    } else {
      playSfx('pop', { vol: 0.5, pitch: entry.place === 1 ? 1.1 : 0.9 });
    }
  }

  if (!reduced && cols.length > 1) playSfx('drumroll', { vol: 0.45 });
  at(() => revealCol(cols[2]), 300);
  at(() => revealCol(cols[1]), 1000);
  at(() => revealCol(cols[0]), 1700);

  /* ---------------- 4th+ as classic rows ---------------- */

  if (flat.length > 3) {
    const table = div('results-table');
    flat.slice(3).forEach((pid, j) => {
      const i = j + 3;
      const p = state?.players?.[pid];
      const row = div('results-row');
      row.style.animationDelay = `${(1.9 + j * 0.12) * speed}s`;
      const def = p?.characterId ? characterRegistry.get(p.characterId) : null;
      row.appendChild(div('results-row__place', placeLabel(i)));
      row.appendChild(portraitImg(def, 36));
      row.appendChild(div('results-row__name', p?.name ?? pid));
      const coinsEl = div('results-row__coins', '+0 🪙');
      row.appendChild(coinsEl);
      const gain = results?.coins?.[pid] ?? 0;
      at(() => {
        if (finished) return;
        if (reduced) coinsEl.textContent = `+${gain} 🪙`;
        else countUp(coinsEl, 0, gain, 700 * speed, (v) => `+${v} 🪙`);
      }, 2000 + j * 180);
      table.appendChild(row);
    });
    modal.panel.appendChild(table);
  }

  /* ---------------- standings after the round (post-payout) --------- */

  modal.panel.appendChild(el('div', 'ui-section-label', t('mg.standings', { r: state?.round ?? '?' })));
  const standings = [...(state?.turnOrder ?? [])]
    .map((pid) => state.players[pid])
    .filter(Boolean)
    .sort((a, b) => (b.goldenBananas - a.goldenBananas) || (b.coins - a.coins));
  const line = div('standings');
  standings.forEach((p, i) => {
    const s = el('span');
    s.append(
      el('b', '', `${i + 1}. ${p.name}`),
      el('span', '', ` 🍌${p.goldenBananas} 🪙${p.coins}`),
    );
    line.appendChild(s);
  });
  modal.panel.appendChild(line);

  const cont = button(t('generic.continue'), 'ui-btn--green ui-btn--big', done);
  cont.style.marginTop = '16px';
  modal.panel.appendChild(cont);

  return { close: done };
}

export default showMinigameResults;
