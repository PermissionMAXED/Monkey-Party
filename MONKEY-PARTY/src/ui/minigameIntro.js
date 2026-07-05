/**
 * Minigame intro (spectacle edition): an accelerating roulette shuffle over
 * the eligible minigame cards - ticks speed up and rise in pitch over a
 * drum roll - then a card-flip reveal of the actual picked minigame with
 * its category badge and a versus line-up showing the monkey portraits per
 * team (FFA renders one shared line-up). Then the how-to card (name,
 * howTo, controls, one line per local seat). Resolves when the player hits
 * GO (or after an auto-continue timeout, so bots-only sessions never
 * stall).
 *
 * Reduced-motion (body.reduced-motion) skips the shuffle entirely and
 * reveals the pick instantly; fastMode (MatchState.fastMode) halves the
 * spin. Team/portrait data comes from the board-play package's read-only
 * match snapshot via a guarded dynamic import - when the sibling package
 * (or the snapshot) is missing the line-up is simply omitted.
 */

import { minigames as minigameRegistry, characters as characterRegistry } from '#shared/registries.js';
import { t, localized } from './i18n.js';
import { el, div, button, overlay, clearNode, playSfx, portraitImg } from './dom.js';
import { ts, ensureSpectacleStyles } from './spectacleStrings.js';

const SPIN_MS = 2200;
const AUTO_GO_SEC = 12;

/* Guarded sibling import: read-only MatchState snapshot published by the
 * board-play view (portraits + teams for the versus line-up). */
let matchSnapshotFn = null;
import('../boardplay/boardPlayView.js')
  .then((mod) => {
    matchSnapshotFn = typeof mod?.getLatestMatchState === 'function' ? mod.getLatestMatchState : null;
  })
  .catch(() => {
    matchSnapshotFn = null;
  });

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

function reducedMotion() {
  return typeof document !== 'undefined' && !!document.body?.classList?.contains('reduced-motion');
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
  ensureSpectacleStyles();
  const def = minigameRegistry.get(minigameId);
  const modal = overlay({ dim: true });
  let finished = false;
  let autoTimer = null;
  let spinTimer = null;

  const reduced = reducedMotion();
  const snapshot = matchSnapshotFn?.() ?? null;
  const spinMs = snapshot?.fastMode ? SPIN_MS * 0.5 : SPIN_MS;

  function done() {
    if (finished) return;
    finished = true;
    clearTimeout(autoTimer);
    clearTimeout(spinTimer);
    modal.close();
    onDone?.();
  }

  /* ---------------- versus line-up (portraits per team) ------------- */

  function portraitOf(player) {
    let charDef = null;
    if (player?.characterId) {
      try {
        charDef = characterRegistry.get(player.characterId);
      } catch {
        charDef = null;
      }
    }
    return portraitImg(charDef, 34);
  }

  /** Portrait groups per team, separated by a VS badge (FFA: one group). */
  function versusStrip() {
    const players = snapshot?.players;
    if (!players) return null;
    const teams = Array.isArray(snapshot.minigame?.teams) && snapshot.minigame.teams.length > 0
      ? snapshot.minigame.teams
      : [snapshot.turnOrder ?? Object.keys(players)];
    if (teams.every((team) => !team || team.length === 0)) return null;

    const strip = div('sp-versus');
    teams.forEach((team, i) => {
      if (i > 0) strip.appendChild(div('sp-versus__vs', ts('spectacle.vs')));
      const box = div('sp-versus__team sp-rise');
      box.style.animationDelay = `${0.1 + i * 0.12}s`;
      const row = div('sp-versus__row');
      const names = [];
      for (const pid of team ?? []) {
        const p = players[pid];
        if (!p) continue;
        row.appendChild(portraitOf(p));
        names.push(p.name ?? pid);
      }
      box.appendChild(row);
      box.appendChild(div('sp-versus__names', names.join(' · ')));
      strip.appendChild(box);
    });
    return strip;
  }

  /* ---------------- roulette ---------------- */

  const wrap = div('mg-roulette');
  wrap.appendChild(el('h1', 'ui-title', t('mg.incoming')));
  const card = div(`mg-card${reduced ? '' : ' mg-card--spin'}`);
  wrap.appendChild(card);
  const spinLabel = div('ui-dim', t('mg.spinning'));
  wrap.appendChild(spinLabel);
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

  /** Card-flip reveal of the real pick + the versus line-up. */
  function reveal() {
    if (finished) return;
    card.classList.remove('mg-card--spin');
    if (!reduced) card.classList.add('sp-flip');
    fillCard(def ?? pool[idx], true);
    spinLabel.remove();
    playSfx('fanfare', { vol: 0.7 });
    playSfx('sparkle', { vol: 0.5 });
    const strip = versusStrip();
    if (strip) wrap.appendChild(strip);
    spinTimer = setTimeout(showHowTo, reduced ? 350 : 1800);
  }

  function spinStep() {
    if (finished) return;
    const elapsed = performance.now() - started;
    if (elapsed >= spinMs || pool.length === 0) {
      reveal();
      return;
    }
    idx = (idx + 1) % pool.length;
    fillCard(pool[idx]);
    const k = Math.min(1, elapsed / spinMs);
    playSfx('tick', { vol: 0.18 + k * 0.25, pitch: 1 + k * 0.9 });
    // ACCELERATING shuffle: the flicks get faster toward the reveal.
    const interval = 150 - k * 108;
    spinTimer = setTimeout(spinStep, interval);
  }

  if (reduced || pool.length === 0) {
    // Reduced motion: instant reveal, no shuffle, no build-up audio.
    fillCard(def ?? pool[0]);
    reveal();
  } else {
    playSfx('drumroll', { vol: 0.5 });
    fillCard(pool[0] ?? def);
    spinTimer = setTimeout(spinStep, 140);
  }

  /* ---------------- how-to card ---------------- */

  function showHowTo() {
    if (finished) return;
    clearNode(modal.panel);
    modal.panel.appendChild(el('h1', 'ui-heading', def ? localized(def.name) : minigameId));
    if (def?.category) {
      const badge = div('mg-card__cat', def.category);
      modal.panel.appendChild(badge);
    }
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
