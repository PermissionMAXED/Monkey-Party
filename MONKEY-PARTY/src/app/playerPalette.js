/**
 * Per-seat player color palettes, one per colorblind mode.
 *
 * PRESENTATION-ONLY: these colors tint 3D tokens, minigame HUD chips and
 * team markers - they never feed the deterministic sim. The values mirror
 * the CSS custom properties --mp-p1..--mp-p8 in src/ui/ui.css (body.cb-*
 * classes), so DOM chrome and 3D gameplay always recolor together. The
 * cb sets are Okabe-Ito-based, reordered per deficiency so adjacent seats
 * keep hue + luminance separation (black swapped for near-white).
 *
 * getActivePalette() reads settingsStore.get().colorblindMode (guarded -
 * a missing/broken store falls back to the default palette), and
 * onPaletteChange(cb) fires cb(palette) whenever the mode changes.
 */

import { settingsStore } from './settingsStore.js';

/** Mode -> 8 per-seat colors. Keep in sync with ui.css --mp-p1..p8. */
export const PLAYER_PALETTES = Object.freeze({
  off: Object.freeze([
    '#ef5350', '#42a5f5', '#ffca28', '#66bb6a',
    '#ab47bc', '#ff7043', '#26c6da', '#ec407a',
  ]),
  deuteranopia: Object.freeze([
    '#e69f00', '#56b4e9', '#f0e442', '#0072b2',
    '#cc79a7', '#d55e00', '#009e73', '#f5f5f5',
  ]),
  protanopia: Object.freeze([
    '#56b4e9', '#e69f00', '#0072b2', '#f0e442',
    '#d55e00', '#cc79a7', '#f5f5f5', '#009e73',
  ]),
  tritanopia: Object.freeze([
    '#ee3377', '#33bbee', '#cc3311', '#009988',
    '#f5f5f5', '#ee7733', '#0077bb', '#bbbbbb',
  ]),
});

/**
 * The palette for the active colorblind mode.
 * @param {{get?: Function}} [store] Settings store (defaults to the app
 *   singleton; guarded so a broken/missing store yields the default set).
 * @returns {readonly string[]} 8 per-seat colors.
 */
export function getActivePalette(store = settingsStore) {
  let mode = 'off';
  try {
    mode = store?.get?.()?.colorblindMode ?? 'off';
  } catch {
    mode = 'off';
  }
  return PLAYER_PALETTES[mode] ?? PLAYER_PALETTES.off;
}

/** Seat color from the active palette (wraps past 8 seats). */
export function playerColor(seatIndex, store = settingsStore) {
  const palette = getActivePalette(store);
  const i = Number.isFinite(Number(seatIndex)) ? Math.abs(Number(seatIndex)) : 0;
  return palette[i % palette.length];
}

/**
 * Subscribe to colorblind-mode changes; cb receives the new palette.
 * @returns {() => void} unsubscribe (no-op when the store can't subscribe)
 */
export function onPaletteChange(cb, store = settingsStore) {
  if (typeof cb !== 'function') return () => {};
  let last = null;
  try {
    last = store?.get?.()?.colorblindMode ?? 'off';
  } catch {
    last = 'off';
  }
  let unsub = null;
  try {
    unsub = store?.subscribe?.((s) => {
      const mode = s?.colorblindMode ?? 'off';
      if (mode === last) return;
      last = mode;
      try {
        cb(PLAYER_PALETTES[mode] ?? PLAYER_PALETTES.off);
      } catch (err) {
        console.error('[playerPalette] listener threw:', err);
      }
    });
  } catch {
    unsub = null;
  }
  return typeof unsub === 'function' ? unsub : () => {};
}

export default getActivePalette;
