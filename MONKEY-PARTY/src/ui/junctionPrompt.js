/**
 * Board decision prompts rendered over the 3D view (bottom-docked):
 *   - promptFrame: shared scaffolding (title + countdown + auto-default)
 *   - showJunctionPrompt: arrow buttons for each open path
 *   - showDicePickPrompt: competitive dice-draft cards
 * Every prompt runs a ~20s countdown with a sensible auto-default so the
 * game never hangs. Each returns {close()}.
 */

import { t } from './i18n.js';
import { el, div, button, overlay, countdownRing, playSfx } from './dom.js';

export const PROMPT_SECONDS = 20;

/**
 * Shared bottom-docked prompt scaffolding with countdown + auto default.
 * onDefault fires once when the timer expires (the caller answers).
 */
export function promptFrame(title, { seconds = PROMPT_SECONDS, onDefault = null, dim = false } = {}) {
  const modal = overlay({ bottom: !dim, dim });
  const head = el('h2', 'prompt-title', title);
  let ring = null;
  if (onDefault) {
    ring = countdownRing(seconds, () => {
      playSfx('tick');
      onDefault();
    });
    head.appendChild(ring.root);
  }
  modal.panel.appendChild(head);
  const body = div();
  modal.panel.appendChild(body);
  return {
    body,
    panel: modal.panel,
    close() {
      ring?.cancel();
      modal.close();
    },
  };
}

/**
 * @param {{
 *   options: string[] Open path node ids,
 *   angleFor?: (nodeId: string) => number|null Screen-space angle (rad),
 *   labelFor?: (nodeId: string) => string,
 *   onPick: (nodeId: string) => void,
 * }} opts
 */
export function showJunctionPrompt({ options = [], angleFor = null, labelFor = null, onPick }) {
  let done = false;
  const frame = promptFrame(t('prompt.junction'), {
    onDefault: () => answer(options[0]),
  });
  function answer(choice) {
    if (done) return;
    done = true;
    frame.close();
    onPick(choice);
  }
  const row = div('prompt-row');
  options.forEach((nodeId, i) => {
    const btn = button('', 'ui-btn--wood junction-btn', () => answer(nodeId));
    const angle = angleFor?.(nodeId);
    const arrow = el('span', '', '➜');
    arrow.style.display = 'inline-block';
    arrow.style.fontSize = '1.4em';
    if (typeof angle === 'number' && Number.isFinite(angle)) {
      arrow.style.transform = `rotate(${angle}rad)`;
    } else {
      arrow.style.transform = `rotate(${(i - (options.length - 1) / 2) * 0.5}rad)`;
    }
    btn.append(arrow, el('span', '', labelFor?.(nodeId) ?? nodeId));
    row.appendChild(btn);
  });
  frame.body.appendChild(row);
  return { close: frame.close };
}

/**
 * Competitive dice draft: pick one of the drawn values.
 * @param {{options: number[], onPick: (index: number) => void}} opts
 */
export function showDicePickPrompt({ options = [], onPick }) {
  let done = false;
  const frame = promptFrame(t('prompt.dicePick'), {
    onDefault: () => {
      // Default: the highest value (never a bad pick).
      let best = 0;
      options.forEach((v, i) => {
        if (v > options[best]) best = i;
      });
      answer(best);
    },
  });
  function answer(index) {
    if (done) return;
    done = true;
    frame.close();
    onPick(index);
  }
  const row = div('prompt-row');
  options.forEach((value, i) => {
    const card = el('button', 'dice-card');
    card.type = 'button';
    card.textContent = String(value);
    card.addEventListener('click', () => {
      playSfx('dice', { vol: 0.6 });
      answer(i);
    });
    row.appendChild(card);
  });
  frame.body.appendChild(row);
  return { close: frame.close };
}

export default showJunctionPrompt;
