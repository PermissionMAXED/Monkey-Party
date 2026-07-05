/**
 * Settings screen, organized into sections:
 *   Profile (name) / Audio (3 volumes) / Video (quality, FPS meter) /
 *   Accessibility (reduced motion, screen shake, text scale, colorblind
 *   mode with a live player-color preview) / Language / Controls (per-seat
 *   device selects + per-keyboard key rebinding) / Data (reset).
 *
 * Key rebinding: click a key cell, press the new key (Escape cancels).
 * Bindings persist to settings.keyBindings ({ kb1: { up: 'KeyW', ... } });
 * conflicts within one device are rejected with a toast.
 */

import { setLang, getLang, onLangChange } from './i18n.js';
import { ts } from './settingsStrings.js';
import { el, div, button, clearNode, fieldRow, select, toggle, slider, toast, playSfx } from './dom.js';
import { KB_DEFAULT_MAPS } from '../engine/input.js';

const REBIND_ACTIONS = ['up', 'down', 'left', 'right', 'a', 'b'];

/** Human-friendly label for a KeyboardEvent.code. */
function formatKeyCode(code) {
  if (typeof code !== 'string' || !code) return '?';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  const arrows = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
  return arrows[code] ?? code;
}

export function createSettingsScreen(ctx) {
  let root = null;
  let unsubLang = null;
  let unsubDevices = null;

  /* ---------------- key rebinding ---------------- */

  /** Active listen state: { device, action, cell, keyEl, off } | null. */
  let rebind = null;

  function effectiveKeyMap(deviceId) {
    const overrides = ctx.settings.get().keyBindings?.[deviceId] ?? {};
    return { ...(KB_DEFAULT_MAPS[deviceId] ?? {}), ...overrides };
  }

  function stopRebind() {
    if (!rebind) return;
    window.removeEventListener('keydown', rebind.onKey, true);
    rebind.cell.classList.remove('rebind-cell--listening');
    rebind.keyEl.textContent = formatKeyCode(effectiveKeyMap(rebind.device)[rebind.action]);
    rebind = null;
  }

  function startRebind(device, action, cell, keyEl) {
    stopRebind();
    const onKey = (e) => {
      // Swallow the press so the live input system / other UI never sees it.
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        stopRebind();
        toast(ts('settings.rebind.cancelled'), 'info', 1100);
        return;
      }
      if (!e.code) return;
      const map = effectiveKeyMap(device);
      const clash = Object.entries(map).find(([act, code]) => code === e.code && act !== action);
      if (clash) {
        // Rejected: stay in listening mode so another key can be tried.
        toast(ts('settings.rebind.conflict', { action: ts(`settings.action.${clash[0]}`) }), 'error', 2200);
        return;
      }
      const all = ctx.settings.get().keyBindings ?? {};
      ctx.settings.set({
        keyBindings: { ...all, [device]: { ...(all[device] ?? {}), [action]: e.code } },
      });
      stopRebind();
      toast(ts('settings.rebind.saved'), 'success', 1200);
      render();
    };
    rebind = { device, action, cell, keyEl, onKey };
    cell.classList.add('rebind-cell--listening');
    keyEl.textContent = ts('settings.rebind.pressKey');
    window.addEventListener('keydown', onKey, true);
  }

  function rebindDeviceBlock(device, label) {
    const block = div('rebind-device');
    const title = div('rebind-device__title', label);
    if (ctx.settings.get().keyBindings?.[device]) {
      title.appendChild(button(ts('settings.rebind.reset'), 'ui-btn--ghost ui-btn--small', () => {
        const { [device]: _gone, ...rest } = ctx.settings.get().keyBindings ?? {};
        ctx.settings.set({ keyBindings: rest });
        render();
      }));
    }
    block.appendChild(title);

    const grid = div('rebind-grid');
    const map = effectiveKeyMap(device);
    for (const action of REBIND_ACTIONS) {
      const cell = el('button', 'rebind-cell');
      cell.type = 'button';
      const keyEl = el('span', 'rebind-cell__key', formatKeyCode(map[action]));
      cell.append(el('span', '', ts(`settings.action.${action}`)), keyEl);
      cell.addEventListener('click', () => {
        playSfx('click');
        if (rebind?.cell === cell) stopRebind();
        else startRebind(device, action, cell, keyEl);
      });
      grid.appendChild(cell);
    }
    block.appendChild(grid);
    return block;
  }

  /* ---------------- render ---------------- */

  function render() {
    stopRebind();
    clearNode(root);
    const s = ctx.settings.get();

    const wrap = div('ui-screen');
    const panel = div('ui-panel ui-scroll-y settings-panel');
    panel.appendChild(el('h1', 'ui-heading', ts('settings.title')));

    const section = (labelKey) => {
      const sec = div('settings-section');
      sec.appendChild(div('ui-section-label', ts(labelKey)));
      panel.appendChild(sec);
      return sec;
    };

    /* ---------- Profile ---------- */
    const profile = section('settings.section.profile');
    const nameInput = el('input', 'ui-input');
    nameInput.type = 'text';
    nameInput.maxLength = 24;
    nameInput.value = ctx.profile.get().name;
    nameInput.addEventListener('change', () => {
      ctx.profile.set({ name: nameInput.value });
      toast(ts('generic.save'), 'success', 1200);
    });
    profile.appendChild(fieldRow(ts('settings.playerName'), nameInput));

    /* ---------- Audio (live: audio buses subscribe to the store) ---------- */
    const audio = section('settings.section.audio');
    const pct = (v) => `${Math.round(v * 100)}%`;
    audio.appendChild(fieldRow(
      ts('settings.masterVolume'),
      slider(0, 1, 0.05, s.masterVolume, (v) => ctx.settings.set({ masterVolume: v }), pct),
    ));
    audio.appendChild(fieldRow(
      ts('settings.musicVolume'),
      slider(0, 1, 0.05, s.musicVolume, (v) => ctx.settings.set({ musicVolume: v }), pct),
    ));
    audio.appendChild(fieldRow(
      ts('settings.sfxVolume'),
      slider(0, 1, 0.05, s.sfxVolume, (v) => {
        ctx.settings.set({ sfxVolume: v });
        playSfx('coin');
      }, pct),
    ));

    /* ---------- Video ---------- */
    const video = section('settings.section.video');
    video.appendChild(fieldRow(ts('settings.quality'), select(
      ['low', 'med', 'high'].map((q) => ({ value: q, label: ts(`settings.quality.${q}`) })),
      s.quality,
      (v) => ctx.settings.set({ quality: v }),
    )));
    video.appendChild(fieldRow(
      ts('settings.fpsMeter'),
      toggle(s.fpsMeter, (on) => ctx.settings.set({ fpsMeter: on })),
    ));

    /* ---------- Accessibility ---------- */
    const a11y = section('settings.section.accessibility');
    a11y.appendChild(fieldRow(
      ts('settings.reducedMotion'),
      toggle(s.reducedMotion, (on) => ctx.settings.set({ reducedMotion: on })),
    ));
    a11y.appendChild(fieldRow(
      ts('settings.screenShake'),
      toggle(s.screenShake, (on) => ctx.settings.set({ screenShake: on })),
    ));
    a11y.appendChild(fieldRow(ts('settings.textScale'), select(
      [
        { value: '1', label: ts('settings.textScale.100') },
        { value: '1.15', label: ts('settings.textScale.115') },
        { value: '1.3', label: ts('settings.textScale.130') },
      ],
      String(s.textScale),
      (v) => ctx.settings.set({ textScale: Number(v) }),
    )));
    a11y.appendChild(fieldRow(ts('settings.colorblindMode'), select(
      ['off', 'deuteranopia', 'protanopia', 'tritanopia']
        .map((m) => ({ value: m, label: ts(`settings.colorblind.${m}`) })),
      s.colorblindMode,
      // The legacy boolean must be cleared in the same set(): sanitize maps
      // colorblind:true back onto 'deuteranopia' whenever the mode is 'off'.
      (v) => ctx.settings.set({ colorblindMode: v, colorblind: v !== 'off' }),
    )));
    // Live preview: swatch colors come from the --mp-p* CSS variables, so
    // they restyle instantly when the cb-* body class flips.
    const preview = div('cb-preview');
    for (let i = 0; i < 8; i += 1) preview.appendChild(div('cb-preview__swatch'));
    a11y.appendChild(fieldRow(ts('settings.colorblindPreview'), preview));

    /* ---------- Language ---------- */
    const language = section('settings.section.language');
    language.appendChild(fieldRow(ts('settings.language'), select(
      [{ value: 'en', label: 'English' }, { value: 'de', label: 'Deutsch' }],
      getLang(),
      (v) => setLang(v),
    )));

    /* ---------- Controls ---------- */
    const controls = section('settings.section.controls');
    const devices = ctx.input.devices();
    const bindings = ctx.input.bindings();
    controls.appendChild(div('ui-dim', ts('settings.seatDevices')));
    for (let seat = 0; seat < 4; seat += 1) {
      controls.appendChild(fieldRow(
        ts('local.seat', { n: seat + 1 }),
        select(
          devices.map((d) => ({ value: d.id, label: d.connected ? d.label : `${d.label} (—)` })),
          bindings[seat],
          (v) => ctx.input.bindSeat(seat, v),
        ),
      ));
    }
    const rebindLabel = div('ui-dim', `${ts('settings.rebind.title')} — ${ts('settings.rebind.hint')}`);
    rebindLabel.style.marginTop = '10px';
    controls.appendChild(rebindLabel);
    for (const d of devices) {
      if (d.type === 'keyboard' && KB_DEFAULT_MAPS[d.id]) {
        controls.appendChild(rebindDeviceBlock(d.id, d.label));
      }
    }

    /* ---------- Data ---------- */
    const data = section('settings.section.data');
    const resetRow = div('ui-row');
    resetRow.style.marginTop = '6px';
    resetRow.append(
      button(ts('generic.back'), 'ui-btn--ghost', () => ctx.router.back()),
      button(ts('settings.resetData'), 'ui-btn--danger', () => {
        if (window.confirm(ts('settings.resetConfirm'))) {
          ctx.settings.reset();
          ctx.profile.reset();
          render();
          toast(ts('settings.resetData'), 'success');
        }
      }),
    );
    data.appendChild(resetRow);

    wrap.appendChild(panel);
    root.appendChild(wrap);
  }

  return {
    mount(elHost) {
      root = elHost;
      render();
      unsubLang = onLangChange(render);
      unsubDevices = ctx.input.onDeviceChange(() => {
        if (root) render();
      });
      ctx.stage.menu(ctx.registries.characters.all().slice(0, 3));
    },
    unmount() {
      stopRebind();
      unsubLang?.();
      unsubDevices?.();
      unsubLang = null;
      unsubDevices = null;
      root = null;
    },
  };
}
