/**
 * Rules editor screen: every Rules field with a matching control, five
 * preset chips, live validateRules() normalization, and competitive-mode
 * lockdowns greyed out (randomEvents / items / chaosMode are forced).
 */

import { DEFAULT_RULES, PRESETS, validateRules } from '#shared/rules.js';
import { MINIGAME_CATEGORIES, BOT_DIFFICULTIES, ITEM_MODES } from '#shared/constants.js';
import { t, localized, onLangChange } from './i18n.js';
import { el, div, button, clearNode, fieldRow, select, toggle, slider, playSfx } from './dom.js';

const PRESET_NAMES = ['party', 'fast', 'chaos', 'hardcore', 'competitive'];

export function createRulesEditorScreen(ctx) {
  let root = null;
  let unsubLang = null;
  let rules = { ...DEFAULT_RULES };
  let activePreset = null;

  function apply(patch, presetName = null) {
    rules = validateRules({ ...rules, ...patch });
    activePreset = presetName;
    render();
  }

  /** +/- integer stepper. */
  function numStepper(value, min, max, step, onChange) {
    const wrap = div('ui-num');
    const minus = button('−', 'ui-btn--wood ui-num__btn', () => onChange(Math.max(min, value - step)));
    const val = div('ui-num__val', String(value));
    const plus = button('+', 'ui-btn--wood ui-num__btn', () => onChange(Math.min(max, value + step)));
    wrap.append(minus, val, plus);
    return wrap;
  }

  function categoryChips() {
    const wrap = div('cat-chips');
    const all = rules.minigameCategories.includes('*');
    const mkChip = (label, on, fn) => {
      const chip = el('button', `cat-chip${on ? ' cat-chip--on' : ''}`, label);
      chip.type = 'button';
      chip.addEventListener('click', () => {
        playSfx('click');
        fn();
      });
      return chip;
    };
    wrap.appendChild(mkChip(t('rules.allCategories'), all, () => apply({ minigameCategories: ['*'] })));
    for (const cat of MINIGAME_CATEGORIES) {
      const on = !all && rules.minigameCategories.includes(cat);
      wrap.appendChild(mkChip(cat, on, () => {
        let next = all ? [] : rules.minigameCategories.filter((c) => c !== '*');
        if (on) next = next.filter((c) => c !== cat);
        else next = [...next, cat];
        apply({ minigameCategories: next.length > 0 ? next : ['*'] });
      }));
    }
    return wrap;
  }

  function startItemChips() {
    const wrap = div('cat-chips');
    for (const def of ctx.registries.items.all()) {
      const on = rules.startItems.includes(def.id);
      const chip = el('button', `cat-chip${on ? ' cat-chip--on' : ''}`, localized(def.name));
      chip.type = 'button';
      chip.title = localized(def.description);
      chip.addEventListener('click', () => {
        playSfx('click');
        apply({
          startItems: on ? rules.startItems.filter((i) => i !== def.id) : [...rules.startItems, def.id],
        });
      });
      wrap.appendChild(chip);
    }
    return wrap;
  }

  function render() {
    if (!root) return;
    clearNode(root);
    const wrap = div('ui-screen');
    const panel = div('ui-panel');
    panel.style.width = 'min(1020px, 96vw)';
    panel.appendChild(el('h1', 'ui-heading', t('rules.title')));

    /* Preset chips */
    panel.appendChild(el('div', 'ui-section-label', t('rules.presets')));
    const chips = div('preset-chips');
    for (const name of PRESET_NAMES) {
      const chip = el('button', `preset-chip${activePreset === name ? ' preset-chip--on' : ''}`, t(`rules.preset.${name}`));
      chip.type = 'button';
      chip.addEventListener('click', () => {
        playSfx('pop');
        rules = { ...PRESETS[name] };
        activePreset = name;
        render();
      });
      chips.appendChild(chip);
    }
    panel.appendChild(chips);

    const grid = div('rules-grid');
    const locked = rules.competitive;
    const lockedRow = (row) => {
      row.classList.add('ui-field--locked');
      row.title = t('rules.lockedByCompetitive');
      return row;
    };

    grid.appendChild(fieldRow(t('rules.rounds'), numStepper(rules.rounds, 1, 50, 1, (v) => apply({ rounds: v }))));
    grid.appendChild(fieldRow(t('rules.maxSeats'), numStepper(rules.maxSeats, 2, 8, 1, (v) => apply({ maxSeats: v }))));
    grid.appendChild(fieldRow(t('rules.botsFill'), toggle(rules.botsFill, (on) => apply({ botsFill: on }))));
    grid.appendChild(fieldRow(t('rules.botDifficulty'), select(
      BOT_DIFFICULTIES.map((d) => ({ value: d, label: t(`lobby.difficulty.${d}`) })),
      rules.botDifficulty,
      (v) => apply({ botDifficulty: v }),
    )));
    grid.appendChild(fieldRow(t('rules.minigameEvery'), numStepper(rules.minigameEvery, 0, 10, 1, (v) => apply({ minigameEvery: v }))));
    grid.appendChild(fieldRow(t('rules.starPrice'), slider(1, 99, 1, rules.starPrice, (v) => apply({ starPrice: v }))));
    grid.appendChild(fieldRow(t('rules.startCoins'), slider(0, 999, 5, rules.startCoins, (v) => apply({ startCoins: v }))));
    grid.appendChild(fieldRow(t('rules.bananaMultiplier'), select(
      [{ value: '1', label: '×1' }, { value: '2', label: '×2' }],
      String(rules.bananaMultiplier),
      (v) => apply({ bananaMultiplier: Number(v) }),
    )));

    const itemsRow = fieldRow(t('rules.items'), select(
      ITEM_MODES.map((m) => ({ value: m, label: t(`rules.items.${m}`) })),
      rules.items,
      (v) => apply({ items: v }),
    ));
    if (locked) lockedRow(itemsRow);
    grid.appendChild(itemsRow);

    grid.appendChild(fieldRow(t('rules.traps'), toggle(rules.traps, (on) => apply({ traps: on }))));

    const randomRow = fieldRow(t('rules.randomEvents'), toggle(rules.randomEvents, (on) => apply({ randomEvents: on })));
    if (locked) lockedRow(randomRow);
    grid.appendChild(randomRow);

    const chaosRow = fieldRow(t('rules.chaosMode'), toggle(rules.chaosMode, (on) => apply({ chaosMode: on })));
    if (locked) lockedRow(chaosRow);
    grid.appendChild(chaosRow);

    grid.appendChild(fieldRow(t('rules.fastMode'), toggle(rules.fastMode, (on) => apply({ fastMode: on }))));
    grid.appendChild(fieldRow(t('rules.hardcore'), toggle(rules.hardcore, (on) => apply({ hardcore: on }))));
    grid.appendChild(fieldRow(t('rules.competitive'), toggle(rules.competitive, (on) => apply({ competitive: on }))));

    const catRow = fieldRow(t('rules.minigameCategories'), categoryChips(), '');
    catRow.style.flexWrap = 'wrap';
    grid.appendChild(catRow);

    const itemsStartRow = fieldRow(t('rules.startItems'), startItemChips(), '');
    itemsStartRow.style.flexWrap = 'wrap';
    if (rules.items === 'off') lockedRow(itemsStartRow);
    grid.appendChild(itemsStartRow);

    panel.appendChild(grid);

    const actions = div('ui-row');
    actions.style.marginTop = '16px';
    actions.append(
      button(t('generic.cancel'), 'ui-btn--ghost', () => ctx.router.back()),
      button(t('generic.save'), 'ui-btn--green', () => {
        ctx.session?.setRules(validateRules(rules));
        playSfx('buy');
        ctx.router.back();
      }),
    );
    panel.appendChild(actions);

    wrap.appendChild(panel);
    root.appendChild(wrap);
  }

  return {
    mount(elHost) {
      root = elHost;
      rules = validateRules(ctx.session?.getLobby()?.rules ?? {});
      activePreset = null;
      render();
      unsubLang = onLangChange(render);
    },
    unmount() {
      unsubLang?.();
      unsubLang = null;
      root = null;
    },
  };
}
