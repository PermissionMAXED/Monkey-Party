/**
 * End-of-match victory sequence, overlaid on the 3D scene (board-play's
 * game_over choreography celebrates the tokens underneath): bonus-banana
 * reveal cards flip in one by one, then the winner banner drops with CSS
 * confetti sparks (+ a 'fireworks' bus event for 3D particles), then a
 * button to the match stats.
 */

import { characters as characterRegistry } from '#shared/registries.js';
import { t, localized } from './i18n.js';
import { el, div, button, overlay, portraitImg, playSfx } from './dom.js';

/**
 * @param {{
 *   gameOver: {ranking: string[], winner: string, standings: Object[]},
 *   bonuses: {playerId: string, category?: string, name?: Object, bananas?: number}[],
 *   state: Object Final MatchState,
 *   bus: *,
 *   onDone: () => void,
 * }} opts
 * @returns {{close: () => void}}
 */
export function showVictoryScene({ gameOver, bonuses = [], state, bus = null, onDone }) {
  const modal = overlay({});
  let finished = false;
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  function done() {
    if (finished) return;
    finished = true;
    for (const id of timers) clearTimeout(id);
    modal.close();
    onDone?.();
  }

  const winnerId = gameOver?.winner ?? gameOver?.ranking?.[0];
  const winner = state?.players?.[winnerId];

  /* -------- phase 1: bonus reveal cards -------- */
  let delay = 300;
  if (bonuses.length > 0) {
    modal.panel.appendChild(el('h1', 'ui-heading', t('victory.bonusTitle')));
    const col = div('ui-row');
    col.style.flexDirection = 'column';
    modal.panel.appendChild(col);
    bonuses.forEach((b, i) => {
      later(() => {
        if (finished) return;
        const p = state?.players?.[b.playerId];
        const card = div('bonus-card');
        const left = div();
        left.append(
          div('bonus-card__title', localized(b.name) || b.category || '★'),
          div('bonus-card__who', p?.name ?? b.playerId),
        );
        card.append(left, div('bonus-card__amount', `+${b.bananas ?? 1} 🍌`));
        col.appendChild(card);
        playSfx('star', { vol: 0.6 });
      }, delay + i * 700);
    });
    delay += bonuses.length * 700 + 700;
  }

  /* -------- phase 2: winner banner + fireworks -------- */
  later(() => {
    if (finished) return;
    const def = winner?.characterId ? characterRegistry.get(winner.characterId) : null;
    const face = portraitImg(def, 84);
    face.style.display = 'block';
    face.style.margin = '10px auto 0';
    modal.panel.appendChild(face);
    modal.panel.appendChild(div('victory-banner', t('victory.winner', { name: winner?.name ?? winnerId ?? '?' })));
    playSfx('fanfare');
    bus?.emit?.('fireworks', { playerId: winnerId });

    // CSS confetti sparks raining over the overlay.
    for (let i = 0; i < 16; i += 1) {
      const spark = div('emote-bubble', ['✦', '🍌', '✨', '🎉'][i % 4]);
      spark.style.left = `${6 + Math.random() * 88}%`;
      spark.style.top = `${8 + Math.random() * 70}%`;
      spark.style.animationDelay = `${(Math.random() * 1.4).toFixed(2)}s`;
      spark.style.animationIterationCount = 'infinite';
      modal.root.appendChild(spark);
    }

    later(() => {
      if (finished) return;
      const actions = div('ui-row');
      actions.style.marginTop = '18px';
      actions.appendChild(button(t('victory.toStats'), 'ui-btn--green ui-btn--big', done));
      modal.panel.appendChild(actions);
    }, 1200);
  }, delay);

  // Never strand the player: continue automatically after a while.
  later(done, delay + 30000);

  return { close: done };
}

/**
 * Fold the finished match into the local profile (lifetime stats, banana
 * bank). Applied once per local human player.
 *
 * @param {*} profileStore
 * @param {Object} state Final MatchState.
 * @param {{winner: string}} gameOver
 * @param {Set<string>|Map<string, number>} localPids
 * @param {number} minigamesPlayed How many minigames this match ran.
 */
export function applyMatchToProfile(profileStore, state, gameOver, localPids, minigamesPlayed = 0) {
  const pids = localPids instanceof Map ? [...localPids.keys()] : [...(localPids ?? [])];
  if (pids.length === 0 || !state?.players) return;
  const profile = profileStore.get();
  const stats = { ...profile.stats };
  let bananaBank = profile.goldenBananas;
  for (const pid of pids) {
    const p = state.players[pid];
    if (!p) continue;
    stats.gamesPlayed += 1;
    if (gameOver?.winner === pid) stats.gamesWon += 1;
    stats.minigamesPlayed += minigamesPlayed;
    stats.minigamesWon += p.stats?.minigameWins ?? 0;
    stats.coinsEarned += Math.max(0, p.stats?.minigameCoins ?? 0) + Math.max(0, p.coins);
    stats.starsCollected += p.goldenBananas;
    bananaBank += p.goldenBananas;
  }
  profileStore.set({ stats, goldenBananas: bananaBank });
}

export default showVictoryScene;
