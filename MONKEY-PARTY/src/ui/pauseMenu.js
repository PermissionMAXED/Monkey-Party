/**
 * In-match pause menu: Esc (or the HUD pause button) opens a dim overlay
 * with Resume / Quick Settings / How to Play (router-guarded, hidden
 * during the minigame phase - leaving the match mid-minigame would void
 * it offline) / Quit to Menu.
 *
 * Pausing NEVER pauses the shared sim online: the server keeps running
 * (an explicit note says so). Offline the caller (matchController)
 * render-pauses the board AND holds the decision prompts (freezing their
 * auto-default countdowns) and defers minigame starts while this menu is
 * open; an already-running minigame keeps playing (a note says so). The
 * overlay itself is always dismissible (Resume, Esc, backdrop click).
 *
 * attachPauseMenu(ctx, opts) -> { open, close, toggle, isOpen, dispose }
 */

import * as i18n from './i18n.js';
import { t } from './i18n.js';
import { tm } from './matchStrings.js';
import { el, div, button, clearNode, overlay, fieldRow, select, slider, toggle as uiToggle, playSfx } from './dom.js';

const QUALITY_LEVELS = ['low', 'med', 'high'];

/** Local strings (this module owns them; matchStrings.js owns match.*). */
const PAUSE_DICT = {
  'match.pause.minigameNote': {
    en: 'A minigame is running — it keeps playing while this menu is open.',
    de: 'Ein Minispiel läuft — es spielt weiter, solange dieses Menü offen ist.',
  },
};
i18n.extendDict?.(PAUSE_DICT);

/** tm() with a PAUSE_DICT fallback (same convention as matchStrings.tm). */
function tp(key) {
  const viaMain = tm(key);
  if (viaMain !== key) return viaMain;
  const entry = PAUSE_DICT[key];
  if (!entry) return key;
  const lang = i18n.getLang?.() ?? 'en';
  return entry[lang] ?? entry.en;
}

export function attachPauseMenu(ctx, {
  getSession = () => null,
  isChatOpen = () => false,
  closeChat = () => {},
  isMinigameLive = () => false,
  onQuit = () => {},
  onPauseChange = () => {},
} = {}) {
  let modal = null;
  let disposed = false;
  let quitArmed = false;

  /** True while the match sim is in its minigame phase. */
  function inMinigame() {
    try {
      return getSession()?.getSim?.()?.getState?.()?.phase === 'minigame';
    } catch {
      return false;
    }
  }

  function notify(paused) {
    try {
      onPauseChange(paused);
    } catch (err) {
      console.warn('[pause] onPauseChange threw:', err);
    }
  }

  /* ---------------- quick settings ---------------- */

  function setSetting(patch) {
    try {
      ctx.settings?.set?.(patch);
    } catch (err) {
      console.warn('[pause] settings write failed:', err);
    }
  }

  /** Read a settings field defensively (siblings own the store shape). */
  function readSettings() {
    try {
      const s = ctx.settings?.get?.();
      return s && typeof s === 'object' ? s : {};
    } catch {
      return {};
    }
  }

  function volumeRow(labelText, field, current) {
    const value = typeof current === 'number' && Number.isFinite(current) ? current : 0.8;
    return fieldRow(
      labelText,
      slider(0, 1, 0.05, Math.min(1, Math.max(0, value)), (v) => setSetting({ [field]: v }), (v) => `${Math.round(v * 100)}%`),
    );
  }

  function renderSettings() {
    if (!modal) return;
    clearNode(modal.panel);
    modal.panel.appendChild(el('h2', 'ui-heading', tm('match.pause.settings')));
    const col = div('pause-menu__settings');
    const s = readSettings();
    col.appendChild(volumeRow(t('settings.masterVolume'), 'masterVolume', s.masterVolume));
    col.appendChild(volumeRow(t('settings.musicVolume'), 'musicVolume', s.musicVolume));
    col.appendChild(volumeRow(t('settings.sfxVolume'), 'sfxVolume', s.sfxVolume));
    col.appendChild(fieldRow(
      t('settings.quality'),
      select(
        QUALITY_LEVELS.map((q) => ({ value: q, label: t(`settings.quality.${q}`) })),
        QUALITY_LEVELS.includes(s.quality) ? s.quality : 'med',
        (v) => setSetting({ quality: v }),
      ),
    ));
    col.appendChild(fieldRow(
      tm('match.pause.shake'),
      uiToggle(s.screenShake !== false, (on) => setSetting({ screenShake: on })),
    ));
    modal.panel.appendChild(col);
    const row = div('pause-menu__buttons');
    row.appendChild(button(t('generic.back'), 'ui-btn--wood', renderMain));
    modal.panel.appendChild(row);
  }

  /* ---------------- main view ---------------- */

  function renderMain() {
    if (!modal) return;
    quitArmed = false;
    clearNode(modal.panel);
    modal.panel.appendChild(el('h2', 'ui-heading', tm('match.pause.title')));
    const col = div('pause-menu__buttons');
    col.appendChild(button(tm('match.pause.resume'), 'ui-btn--green ui-btn--big', () => close()));
    col.appendChild(button(tm('match.pause.settings'), 'ui-btn--wood', renderSettings));

    // How to Play shortcut only when the help package registered its
    // screen, and NEVER during the minigame phase: navigating away
    // unmounts the match, and offline the view harness is the only
    // stepper of the real minigame sim - leaving would freeze it and
    // hand out bogus fallback results on return.
    const router = ctx.app?.router ?? ctx.router;
    if (typeof router?.has === 'function' && router.has('howToPlay') && !inMinigame()) {
      col.appendChild(button(tm('match.pause.howToPlay'), 'ui-btn--wood', () => {
        if (inMinigame()) {
          // A minigame started while the menu sat open: refresh instead
          // of navigating (the button disappears).
          renderMain();
          return;
        }
        close();
        router.go('howToPlay');
      }));
    }

    const quitBtn = button(tm('match.pause.quit'), 'ui-btn--danger', () => {
      // Two-step confirm (replaces the old window.confirm in hud.js).
      if (!quitArmed) {
        quitArmed = true;
        quitBtn.textContent = `⚠ ${tm('match.pause.quitConfirm')}`;
        return;
      }
      close();
      try {
        onQuit();
      } catch (err) {
        console.error('[pause] onQuit threw:', err);
      }
    });
    col.appendChild(quitBtn);
    modal.panel.appendChild(col);

    if (getSession()?.mode === 'online') {
      modal.panel.appendChild(div('pause-menu__note', `🌐 ${tm('match.pause.onlineNote')}`));
    } else if (isMinigameLive()) {
      // Offline board decisions are frozen while paused, but a minigame
      // that is already running keeps stepping - say so honestly.
      modal.panel.appendChild(div('pause-menu__note', `🎮 ${tp('match.pause.minigameNote')}`));
    }
  }

  /* ---------------- open / close ---------------- */

  function open() {
    if (disposed || modal) return;
    playSfx('click', { vol: 0.5 });
    modal = overlay({ dim: true, className: 'pause-menu' });
    modal.root.classList.add('pause-layer');
    // Backdrop click resumes (the menu must always be dismissible).
    modal.root.addEventListener('pointerdown', (e) => {
      if (e.target === modal?.root) close();
    });
    renderMain();
    notify(true);
  }

  function close() {
    if (!modal) return;
    const m = modal;
    modal = null;
    m.close();
    notify(false);
  }

  function toggle() {
    if (modal) close();
    else open();
  }

  function onKeyDown(e) {
    if (e.key !== 'Escape' || disposed) return;
    // Escape closes the chat before it ever opens the pause menu (the chat
    // input stops its own propagation; this is the unfocused fallback).
    if (isChatOpen()) {
      e.preventDefault();
      try {
        closeChat();
      } catch { /* chat is best-effort */ }
      return;
    }
    // Don't steal Escape from other text inputs while the menu is closed.
    if (!modal) {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    }
    e.preventDefault();
    toggle();
  }

  window.addEventListener('keydown', onKeyDown);

  return {
    open,
    close,
    toggle,
    isOpen: () => Boolean(modal),
    dispose() {
      if (disposed) return;
      disposed = true;
      close();
      window.removeEventListener('keydown', onKeyDown);
    },
  };
}

export default attachPauseMenu;
