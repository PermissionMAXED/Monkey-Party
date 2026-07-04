/**
 * Settings screen: live volumes, render quality, language, colorblind
 * assist, player name, per-seat control rebinding and a data reset.
 */

import { t, setLang, getLang, onLangChange } from './i18n.js';
import { el, div, button, clearNode, fieldRow, select, toggle, slider, toast, playSfx } from './dom.js';

export function createSettingsScreen(ctx) {
  let root = null;
  let unsubLang = null;
  let unsubDevices = null;

  function render() {
    clearNode(root);
    const s = ctx.settings.get();

    const wrap = div('ui-screen');
    const panel = div('ui-panel ui-scroll-y');
    panel.style.cssText = 'width:min(640px,94vw);max-height:86vh;';
    panel.appendChild(el('h1', 'ui-heading', t('settings.title')));

    /* Player name */
    const nameInput = el('input', 'ui-input');
    nameInput.type = 'text';
    nameInput.maxLength = 24;
    nameInput.value = ctx.profile.get().name;
    nameInput.addEventListener('change', () => {
      ctx.profile.set({ name: nameInput.value });
      toast(t('generic.save'), 'success', 1200);
    });
    panel.appendChild(fieldRow(t('settings.playerName'), nameInput));

    /* Volumes (live: audio buses subscribe to the settings store). */
    const pct = (v) => `${Math.round(v * 100)}%`;
    panel.appendChild(fieldRow(
      t('settings.masterVolume'),
      slider(0, 1, 0.05, s.masterVolume, (v) => ctx.settings.set({ masterVolume: v }), pct),
    ));
    panel.appendChild(fieldRow(
      t('settings.musicVolume'),
      slider(0, 1, 0.05, s.musicVolume, (v) => ctx.settings.set({ musicVolume: v }), pct),
    ));
    panel.appendChild(fieldRow(
      t('settings.sfxVolume'),
      slider(0, 1, 0.05, s.sfxVolume, (v) => {
        ctx.settings.set({ sfxVolume: v });
        playSfx('coin');
      }, pct),
    ));

    /* Quality */
    panel.appendChild(fieldRow(t('settings.quality'), select(
      ['low', 'med', 'high'].map((q) => ({ value: q, label: t(`settings.quality.${q}`) })),
      s.quality,
      (v) => ctx.settings.set({ quality: v }),
    )));

    /* Language */
    panel.appendChild(fieldRow(t('settings.language'), select(
      [{ value: 'en', label: 'English' }, { value: 'de', label: 'Deutsch' }],
      getLang(),
      (v) => setLang(v),
    )));

    /* Colorblind */
    panel.appendChild(fieldRow(
      t('settings.colorblind'),
      toggle(s.colorblind, (on) => ctx.settings.set({ colorblind: on })),
    ));

    /* Control rebinding per seat */
    panel.appendChild(el('div', 'ui-section-label', t('settings.controls')));
    const devices = ctx.input.devices();
    const bindings = ctx.input.bindings();
    for (let seat = 0; seat < 4; seat += 1) {
      panel.appendChild(fieldRow(
        t('local.seat', { n: seat + 1 }),
        select(
          devices.map((d) => ({ value: d.id, label: d.connected ? d.label : `${d.label} (—)` })),
          bindings[seat],
          (v) => ctx.input.bindSeat(seat, v),
        ),
      ));
    }

    /* Reset */
    const resetRow = div('ui-row');
    resetRow.style.marginTop = '18px';
    resetRow.append(
      button(t('generic.back'), 'ui-btn--ghost', () => ctx.router.back()),
      button(t('settings.resetData'), 'ui-btn--danger', () => {
        if (window.confirm(t('settings.resetConfirm'))) {
          ctx.settings.reset();
          ctx.profile.reset();
          render();
          toast(t('settings.resetData'), 'success');
        }
      }),
    );
    panel.appendChild(resetRow);

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
      unsubLang?.();
      unsubDevices?.();
      unsubLang = null;
      unsubDevices = null;
      root = null;
    },
  };
}
