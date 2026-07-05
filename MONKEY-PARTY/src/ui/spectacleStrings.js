/**
 * "Board & Match Spectacle" package: localized strings + the injected
 * stylesheet shared by the upgraded minigame roulette (minigameIntro.js),
 * podium results (resultsScreen.js) and victory scene (victoryScene.js).
 *
 * The dict is registered with the shared i18n module via extendDict when
 * that hook exists; `ts()` additionally resolves from the local dict so
 * the overlays stay localized even before/without the hook (same pattern
 * as settingsStrings.js).
 *
 * ensureSpectacleStyles() injects the package's CSS once. All animations
 * live under #ui-root, so the existing body.reduced-motion kill-switch in
 * ui.css disables them automatically.
 */

import * as i18n from './i18n.js';

export const SPECTACLE_DICT = {
  /* ---------- minigame roulette ---------- */
  'spectacle.vs': { en: 'VS', de: 'VS' },
  'spectacle.lineup': { en: 'Line-up', de: 'Aufstellung' },
  'spectacle.team': { en: 'Team {n}', de: 'Team {n}' },

  /* ---------- podium results ---------- */
  'spectacle.podium': { en: 'Podium', de: 'Podium' },
  'spectacle.winnerTag': { en: 'WINNER', de: 'SIEGER' },

  /* ---------- victory scene ---------- */
  'spectacle.niceTry': { en: 'Nice try!', de: 'Gut gekämpft!' },
  'spectacle.champion': { en: 'Champion of the party', de: 'Champion der Party' },
};

// Register with the shared dictionary when the hook exists (wired by the
// i18n owner); harmless no-op otherwise thanks to the local fallback below.
i18n.extendDict?.(SPECTACLE_DICT);

/**
 * Translate like i18n.t(), falling back to the local spectacle dict for
 * keys the shared dictionary doesn't know (yet).
 */
export function ts(key, vars = null) {
  const shared = i18n.t(key, vars);
  if (shared !== key) return shared;
  const entry = SPECTACLE_DICT[key];
  if (!entry) return key;
  const lang = i18n.getLang?.() ?? 'en';
  let text = entry[lang] ?? entry.en ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

/* ------------------------------------------------------------------ */
/* Injected stylesheet (spectacle-only classes, sp-* prefix)           */
/* ------------------------------------------------------------------ */

const STYLE_ID = 'spectacle-styles';

const SPECTACLE_CSS = `
/* Kinetic entries ---------------------------------------------------- */
@keyframes sp-flip-in {
  from { transform: perspective(720px) rotateY(92deg); opacity: 0; }
  60%  { transform: perspective(720px) rotateY(-10deg); opacity: 1; }
  to   { transform: perspective(720px) rotateY(0deg); opacity: 1; }
}
.sp-flip { animation: sp-flip-in 0.5s cubic-bezier(0.3, 1.3, 0.4, 1) backwards; }

@keyframes sp-flip-x-in {
  from { transform: perspective(720px) rotateX(-95deg); opacity: 0; }
  55%  { transform: perspective(720px) rotateX(12deg); opacity: 1; }
  to   { transform: perspective(720px) rotateX(0deg); opacity: 1; }
}
.sp-flip-x { animation: sp-flip-x-in 0.55s cubic-bezier(0.3, 1.3, 0.4, 1) backwards; }

@keyframes sp-drop-in {
  from { transform: translateY(-90px) scale(0.6) rotate(-4deg); opacity: 0; }
  62%  { transform: translateY(10px) scale(1.06) rotate(1deg); opacity: 1; }
  to   { transform: translateY(0) scale(1) rotate(0deg); opacity: 1; }
}
.sp-drop { animation: sp-drop-in 0.65s cubic-bezier(0.3, 1.5, 0.4, 1) backwards; }

@keyframes sp-rise-in {
  from { transform: translateY(26px); opacity: 0; }
  to   { transform: translateY(0); opacity: 1; }
}
.sp-rise { animation: sp-rise-in 0.45s cubic-bezier(0.3, 1.4, 0.4, 1) backwards; }

/* Pre-reveal state (podium columns, staggered rows) ------------------ */
.sp-hidden { visibility: hidden; }

/* Roulette versus line-up -------------------------------------------- */
.sp-versus {
  display: flex; align-items: center; justify-content: center;
  gap: 12px; flex-wrap: wrap; margin-top: 14px;
}
.sp-versus__team {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  background: rgba(0, 0, 0, 0.32); border: 2px solid var(--ui-line);
  border-radius: 14px; padding: 8px 14px; min-width: 84px;
}
.sp-versus__row { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }
.sp-versus__names {
  font-size: 0.72rem; font-weight: 800; color: var(--ui-text-dim);
  max-width: 170px; text-align: center; line-height: 1.3;
}
.sp-versus__vs {
  font-size: 1.5rem; font-weight: 900; color: var(--ui-danger);
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.6); letter-spacing: 0.06em;
}

/* Podium (minigame results) ------------------------------------------ */
.sp-podium {
  display: flex; align-items: flex-end; justify-content: center;
  gap: 10px; margin: 12px 0 4px;
}
.sp-podium__col { display: flex; flex-direction: column; align-items: center; gap: 5px; width: 108px; }
.sp-podium__name {
  font-size: 0.78rem; font-weight: 800; max-width: 104px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.sp-podium__coins { font-weight: 900; color: var(--ui-yellow); font-variant-numeric: tabular-nums; }
.sp-podium__block {
  width: 100%; border-radius: 10px 10px 4px 4px;
  border: 2px solid var(--ui-line);
  background: linear-gradient(180deg, rgba(43, 84, 46, 0.85), rgba(20, 42, 24, 0.9));
  display: flex; align-items: flex-start; justify-content: center;
  font-weight: 900; font-size: 1.15rem; color: var(--ui-text-dim); padding-top: 4px;
}
.sp-podium__block--1 {
  height: 84px; border-color: var(--ui-yellow); color: #3a2b00;
  background: linear-gradient(180deg, var(--ui-yellow), var(--ui-yellow-deep));
  box-shadow: 0 0 24px rgba(255, 217, 77, 0.4);
}
.sp-podium__block--2 { height: 58px; border-color: #cfd8dc; color: #e8eef2; }
.sp-podium__block--3 { height: 40px; border-color: #d8955c; color: #ffd9b8; }
.sp-podium__crown { font-size: 1.3rem; line-height: 1; }

/* Victory scene: losers' "nice try" ranking strip --------------------- */
.sp-rankstrip {
  display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;
  margin-top: 12px;
}
.sp-rankstrip__chip {
  display: flex; align-items: center; gap: 7px;
  background: var(--ui-panel-soft); border: 2px solid var(--ui-line);
  border-radius: 999px; padding: 3px 12px 3px 4px;
  font-size: 0.82rem; font-weight: 800; color: var(--ui-text);
}
.sp-rankstrip__place { color: var(--ui-yellow); font-weight: 900; }
.sp-rankstrip__label {
  font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--ui-text-dim); width: 100%; text-align: center; margin-top: 10px;
}
`;

/** Inject the spectacle stylesheet once (no-op headless / repeat calls). */
export function ensureSpectacleStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = SPECTACLE_CSS;
  document.head.appendChild(style);
}

export default ts;
