/**
 * Post-minigame results overlay: ranking with animated coin count-ups,
 * followed by the round-end standings (sorted by golden bananas, coins as
 * tiebreak). Auto-continues so bot-only flows never stall.
 */

import { characters as characterRegistry } from '#shared/registries.js';
import { t } from './i18n.js';
import { el, div, button, overlay, portraitImg, countUp, playSfx } from './dom.js';

const AUTO_CONTINUE_SEC = 9;

function placeLabel(i) {
  if (i < 3) return t(`mg.place.${i + 1}`);
  return t('mg.place.n', { n: i + 1 });
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
  const modal = overlay({ dim: true });
  let finished = false;
  const timer = setTimeout(done, AUTO_CONTINUE_SEC * 1000);

  function done() {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    modal.close();
    onDone?.();
  }

  modal.panel.appendChild(el('h1', 'ui-heading', t('mg.results')));

  const flat = (results?.ranking ?? []).flat();
  const table = div('results-table');
  flat.forEach((pid, i) => {
    const p = state?.players?.[pid];
    const row = div(`results-row${i === 0 ? ' results-row--first' : ''}`);
    row.style.animationDelay = `${i * 0.12}s`;
    const def = p?.characterId ? characterRegistry.get(p.characterId) : null;
    row.appendChild(div('results-row__place', `${i === 0 ? '👑 ' : ''}${placeLabel(i)}`));
    row.appendChild(portraitImg(def, 36));
    row.appendChild(div('results-row__name', p?.name ?? pid));
    const coinsEl = div('results-row__coins', '+0 🪙');
    row.appendChild(coinsEl);
    const gain = results?.coins?.[pid] ?? 0;
    setTimeout(() => countUp(coinsEl, 0, gain, 800, (v) => `+${v} 🪙`), 350 + i * 220);
    table.appendChild(row);
  });
  modal.panel.appendChild(table);
  playSfx('cheer', { vol: 0.5 });

  /* Standings after the round (post-payout). */
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
