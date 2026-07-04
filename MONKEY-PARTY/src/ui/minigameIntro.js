/**
 * Minigame intro: roulette spin over the eligible minigame cards that
 * decelerates onto the actual picked id, then the how-to card (name, howTo,
 * controls, one line per local seat). Resolves when the player hits GO
 * (or after an auto-continue timeout, so bots-only sessions never stall).
 */

import { minigames as minigameRegistry } from '#shared/registries.js';
import { t, localized } from './i18n.js';
import { el, div, button, overlay, clearNode, playSfx } from './dom.js';

const SPIN_MS = 2400;
const AUTO_GO_SEC = 12;

const DEVICE_LABELS = {
  kb1: '⌨️ WASD + F/G',
  kb2: '⌨️ Arrows + K/L',
  kb3: '⌨️ IJKL + H/N',
  touch: '📱 Touch',
};

function deviceLabel(id) {
  if (!id) return '⌨️ / 🎮';
  if (DEVICE_LABELS[id]) return DEVICE_LABELS[id];
  if (String(id).startsWith('gamepad')) return `🎮 Gamepad ${Number(String(id).slice(7)) + 1}`;
  return String(id);
}

/**
 * @param {{
 *   minigameId: string,
 *   localSeatNames?: {seat: number, name: string, device?: string|null}[],
 *   onDone: () => void,
 * }} opts
 * @returns {{close: () => void}}
 */
export function showMinigameIntro({ minigameId, localSeatNames = [], onDone }) {
  const def = minigameRegistry.get(minigameId);
  const modal = overlay({ dim: true });
  let finished = false;
  let autoTimer = null;
  let spinTimer = null;

  function done() {
    if (finished) return;
    finished = true;
    clearTimeout(autoTimer);
    clearTimeout(spinTimer);
    modal.close();
    onDone?.();
  }

  /* ---------------- roulette ---------------- */

  const wrap = div('mg-roulette');
  wrap.appendChild(el('h1', 'ui-title', t('mg.incoming')));
  const card = div('mg-card mg-card--spin');
  wrap.appendChild(card);
  wrap.appendChild(div('ui-dim', t('mg.spinning')));
  modal.panel.appendChild(wrap);

  const pool = minigameRegistry.all();
  let idx = 0;
  const started = performance.now();

  function fillCard(d, withDesc = false) {
    clearNode(card);
    card.append(
      div('mg-card__cat', d?.category ?? ''),
      div('mg-card__name', d ? localized(d.name) : minigameId),
    );
    if (withDesc && d) card.appendChild(div('mg-card__desc', localized(d.description)));
  }

  function spinStep() {
    if (finished) return;
    const elapsed = performance.now() - started;
    if (elapsed >= SPIN_MS || pool.length === 0) {
      // Land on the real pick.
      card.classList.remove('mg-card--spin');
      fillCard(def ?? pool[idx], true);
      playSfx('fanfare', { vol: 0.7 });
      spinTimer = setTimeout(showHowTo, 1000);
      return;
    }
    idx = (idx + 1) % pool.length;
    fillCard(pool[idx]);
    playSfx('tick', { vol: 0.2 });
    // Decelerating flick.
    const interval = 70 + (elapsed / SPIN_MS) ** 2 * 320;
    spinTimer = setTimeout(spinStep, interval);
  }
  fillCard(pool[0] ?? def);
  spinTimer = setTimeout(spinStep, 70);

  /* ---------------- how-to card ---------------- */

  function showHowTo() {
    if (finished) return;
    clearNode(modal.panel);
    modal.panel.appendChild(el('h1', 'ui-heading', def ? localized(def.name) : minigameId));
    if (def) {
      modal.panel.appendChild(div('ui-dim', localized(def.description)));
      modal.panel.appendChild(el('div', 'ui-section-label', t('mg.howto')));
      modal.panel.appendChild(div('mg-howto', localized(def.howTo)));
    }
    modal.panel.appendChild(el('div', 'ui-section-label', t('mg.controls')));
    const controls = div('mg-controls');
    const seats = localSeatNames.length > 0
      ? localSeatNames
      : [{ name: t('generic.player'), device: 'kb1' }];
    for (const seat of seats) {
      const row = div('mg-controls__row');
      row.append(
        el('span', 'mg-controls__seat', seat.name),
        el('span', '', deviceLabel(seat.device)),
      );
      controls.appendChild(row);
    }
    modal.panel.appendChild(controls);
    const go = button(t('mg.go'), 'ui-btn--green ui-btn--big', done);
    go.style.marginTop = '14px';
    modal.panel.appendChild(go);
    go.focus();
    autoTimer = setTimeout(done, AUTO_GO_SEC * 1000);
  }

  return { close: done };
}

export default showMinigameIntro;
