/**
 * Credits screen: game name + version, "built with", a monkey-themed
 * thank-you, and a scrolling credit roll of the live content (characters,
 * boards, minigame count from the registries). The roll is driven with a
 * WAAPI animation and falls back to a static, scrollable list under
 * body.reduced-motion (or when WAAPI is unavailable).
 */

import { registries as sharedRegistries } from '#shared/registries.js';
import { t, localized, onLangChange } from '../i18n.js';
import { el, div, button, clearNode } from '../dom.js';
import './strings.js'; // registers the 'help.*' dictionary entries

/* Version string comes from the optional app version module
 * (import.meta.glob: an absent module stays silent, no devtools 404). */
const VERSION_LOADERS = import.meta.glob('../../app/version.js');
let versionString = 'dev';
const versionReady = Promise.resolve(VERSION_LOADERS['../../app/version.js']?.())
  .then((mod) => {
    const v = [mod?.VERSION, mod?.version, mod?.default]
      .find((x) => typeof x === 'string' && x.length > 0);
    if (v) versionString = v;
  })
  .catch(() => { /* optional - stays 'dev' */ });

/** Pixels per second the credit roll travels. */
const ROLL_SPEED = 36;

function reducedMotion() {
  return document.body.classList.contains('reduced-motion');
}

export function createCreditsScreen(ctx) {
  const regs = ctx?.registries ?? sharedRegistries;
  let root = null;
  let unsubLang = null;
  let rollAnim = null;

  function buildRollTrack() {
    const track = div('help-roll__track');

    track.appendChild(div('help-roll__heading', t('help.credits.starring')));
    for (const def of regs.characters?.all?.() ?? []) {
      // CharacterDef.name is a plain string; localized() passes it through.
      track.appendChild(div('help-roll__name', localized(def.name)));
    }

    track.appendChild(div('help-roll__heading', t('help.credits.locations')));
    for (const def of regs.boards?.all?.() ?? []) {
      track.appendChild(div('help-roll__name', localized(def.name)));
    }

    track.appendChild(div('help-roll__big', t('help.credits.minigames', { n: regs.minigames?.count?.() ?? 0 })));
    track.appendChild(div('help-roll__dim', t('help.credits.minigamesSub')));

    track.appendChild(div('help-roll__big', t('help.credits.theEnd')));
    return track;
  }

  function startRoll(container, track) {
    rollAnim?.cancel();
    rollAnim = null;
    if (reducedMotion() || typeof track.animate !== 'function') {
      container.classList.add('help-roll--static');
      return;
    }
    container.classList.remove('help-roll--static');
    // Measure after layout: roll from below the container to above it.
    requestAnimationFrame(() => {
      if (!track.isConnected) return;
      const from = container.clientHeight;
      const to = -track.scrollHeight;
      const distance = from - to;
      if (distance <= 0) return;
      rollAnim = track.animate(
        [{ transform: `translateY(${from}px)` }, { transform: `translateY(${to}px)` }],
        { duration: (distance / ROLL_SPEED) * 1000, iterations: Infinity, easing: 'linear' },
      );
    });
  }

  function render() {
    clearNode(root);
    const wrap = div('ui-screen');
    const panel = div('ui-panel help-screen');

    const head = div('credits-head');
    head.append(
      el('h1', 'ui-heading', `${t('app.title')} — ${t('help.credits.title')}`),
      div('credits-version', versionString),
      div('', t('help.credits.builtWith')),
      div('credits-thanks', t('help.credits.thanks')),
    );
    panel.appendChild(head);

    const roll = div('help-roll');
    const track = buildRollTrack();
    roll.appendChild(track);
    panel.appendChild(roll);
    startRoll(roll, track);

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
      versionReady.then(() => {
        const node = root?.querySelector?.('.credits-version');
        if (node) node.textContent = versionString;
      });
      unsubLang = onLangChange(render);
      ctx.stage?.menu?.(regs.characters?.all?.()?.slice(0, 3) ?? []);
    },
    unmount() {
      rollAnim?.cancel();
      rollAnim = null;
      unsubLang?.();
      unsubLang = null;
      root = null;
    },
  };
}

export default createCreditsScreen;
