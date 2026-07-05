/**
 * Minigame Practice screen (Solo Modes package): browse every registered
 * minigame (search + category filter), pick bot count/difficulty, and run
 * it standalone through src/minigames/viewHarness.js runMinigame with a
 * {type:'local', sim} driver - the human on device seat 0, bots driven by
 * each MinigameDef.bot. Finishing shows a replay/back overlay (replay =
 * new seed). Practice never writes to the profile/progression stores.
 */

import { MINIGAME_CATEGORIES, BOT_DIFFICULTIES } from '#shared/constants.js';
import { t, localized, onLangChange } from '../i18n.js';
import { el, div, button, clearNode, toast, overlay, select, fieldRow, playSfx } from '../dom.js';
import './strings.js'; // registers the 'prac.*' dictionary entries

/* Guarded dynamic imports (house style, see src/ui/matchController.js):
 * the harness and the 3D view packs are sibling packages. */
const HARNESS_PATH = '../../minigames/viewHarness.js';
const VIEW_PACK_PATHS = [
  '../../minigames/views/batch1/index.js',
  '../../minigames/views/batch2/index.js',
  '../../minigames/views/batch3/index.js',
  '../../minigames/views/templates/index.js',
];

async function tryImport(path) {
  try {
    return await import(/* @vite-ignore */ path);
  } catch (err) {
    console.warn(`[practice] optional module missing: ${path}`, err?.message ?? err);
    return null;
  }
}

let viewPacksPromise = null;
function ensureViewPacks() {
  if (!viewPacksPromise) {
    viewPacksPromise = Promise.all(VIEW_PACK_PATHS.map(async (path) => {
      try {
        await import(/* @vite-ignore */ path);
      } catch { /* sibling batch not installed - sims render nothing */ }
    }));
  }
  return viewPacksPromise;
}

const LOCAL_PID = 'you';
const BOT_NAMES = ['Bongo', 'Kiki', 'Mango', 'Chimpy', 'Nana', 'Tarzana', 'Coco'];

export function createPracticeScreen(ctx) {
  let root = null;
  let unsubLang = null;
  let disposed = false;

  /* picker state (kept across renders within one mount) */
  let search = '';
  let category = 'all';

  /* live run state */
  let run = null; // { def, bots, difficulty, harness, bar }
  let resultsOverlay = null;
  let setupModal = null;

  function defs() {
    return ctx.registries.minigames.all();
  }

  /* ------------------------------------------------------------------ */
  /* Running a minigame                                                  */
  /* ------------------------------------------------------------------ */

  function closeResults() {
    resultsOverlay?.close?.();
    resultsOverlay = null;
  }

  function stopRun() {
    if (!run) return;
    try {
      run.harness?.dispose?.();
    } catch { /* harness owns its teardown */ }
    run.bar?.remove();
    run = null;
  }

  /** Back to the picker (also restores the menu stage + music). */
  function backToPicker() {
    stopRun();
    closeResults();
    if (disposed) return;
    ctx.stage.menu(ctx.registries.characters.all().slice(0, 3));
    ctx.music.play('menu');
    render();
  }

  function showResults(def, cfg, results) {
    closeResults();
    if (disposed) return;
    resultsOverlay = overlay({ dim: true });
    const panel = resultsOverlay.panel;
    panel.appendChild(el('h2', 'ui-heading', t('prac.results')));
    panel.appendChild(div('tour-sub', localized(def.name)));

    const list = div('prac-results__list');
    const flat = (results?.ranking ?? []).flat();
    const names = new Map(cfg.roster.map((p) => [p.id, p.name]));
    flat.forEach((pid, i) => {
      const row = div('prac-results__row',
        `${i + 1}. ${names.get(pid) ?? pid}${pid === LOCAL_PID ? ` (${t('hud.you')})` : ''}`);
      if (pid === LOCAL_PID) row.style.color = 'var(--ui-yellow)';
      list.appendChild(row);
    });
    panel.appendChild(list);

    const actions = div('ui-row');
    actions.style.marginTop = '12px';
    actions.append(
      button(t('prac.another'), 'ui-btn--ghost', backToPicker),
      button(t('prac.toMenu'), 'ui-btn--wood', () => {
        closeResults();
        ctx.router.go('mainMenu');
      }),
      button(t('prac.replay'), 'ui-btn--green', () => {
        closeResults();
        // Replay = a brand new seed, same setup.
        startRun(def, { bots: cfg.bots, difficulty: cfg.difficulty });
      }),
    );
    panel.appendChild(actions);
  }

  async function startRun(def, { bots, difficulty }) {
    stopRun();
    closeResults();
    if (disposed) return;

    await ensureViewPacks(); // def.createView must be attached first
    const harnessMod = await tryImport(HARNESS_PATH);
    const runMinigame = harnessMod?.runMinigame ?? harnessMod?.default;
    if (typeof runMinigame !== 'function' || disposed) {
      if (!disposed) toast('Minigame harness unavailable', 'error');
      return;
    }

    // Client-side wall-clock seeding is fine here (determinism lives in
    // shared/); a replay simply draws a fresh seed.
    const seed = Math.floor(Math.random() * 0xffffffff);
    const roster = [
      { id: LOCAL_PID, name: ctx.profile.get().name || 'Monkey', isBot: false, difficulty: 'normal' },
    ];
    for (let i = 0; i < bots; i += 1) {
      roster.push({
        id: `bot${i + 1}`,
        name: `${BOT_NAMES[i % BOT_NAMES.length]} (bot)`,
        isBot: true,
        difficulty,
      });
    }
    const pids = roster.map((p) => p.id);

    let sim;
    try {
      sim = def.createSim({ seed, players: pids, params: { ...def.params }, rules: {} });
      sim.init();
    } catch (err) {
      console.error(`[practice] minigame "${def.id}" failed to create:`, err);
      toast(err?.message ?? String(err), 'error');
      return;
    }

    ctx.stage.hide();
    ctx.music.play('minigame');
    clearNode(root);

    const cfg = { bots, difficulty, roster };
    const flow = { def, bots, difficulty, harness: null, bar: null };
    run = flow;

    /* Minimal run bar: what is running + a quit escape hatch. */
    const bar = div('prac-run-bar');
    bar.append(
      div('prac-run-bar__label', t('prac.running', { name: localized(def.name) })),
      button(`✕ ${t('prac.quitRun')}`, 'ui-btn--ghost ui-btn--small', backToPicker),
    );
    root.appendChild(bar);
    flow.bar = bar;

    try {
      flow.harness = runMinigame({
        engine: ctx.engine,
        input: ctx.input,
        def,
        driver: { type: 'local', sim },
        localSeats: new Map([[LOCAL_PID, 0]]),
        players: roster,
        onFinish: (results) => {
          if (run !== flow || disposed) return;
          stopRun();
          showResults(def, cfg, results);
        },
      });
    } catch (err) {
      console.error('[practice] runMinigame failed:', err);
      toast(err?.message ?? String(err), 'error');
      backToPicker();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Setup modal (bots + difficulty)                                     */
  /* ------------------------------------------------------------------ */

  function openSetup(def) {
    setupModal?.close?.();
    const modal = overlay({ dim: true });
    setupModal = modal;

    const minBots = Math.max(0, (def.players?.min ?? 2) - 1);
    const maxBots = Math.max(minBots, (def.players?.max ?? 4) - 1);
    let bots = Math.min(Math.max(3, minBots), maxBots);
    let difficulty = 'normal';

    function renderModal() {
      clearNode(modal.panel);
      modal.panel.appendChild(el('h2', 'ui-heading', t('prac.setupTitle')));
      modal.panel.appendChild(div('tour-sub', localized(def.name)));
      modal.panel.appendChild(div('tour-hint', localized(def.howTo)));

      const counter = div('seat-count');
      const minus = button('−', 'ui-btn--wood seat-count__btn', () => {
        if (bots > minBots) {
          bots -= 1;
          renderModal();
        }
      });
      const num = div('seat-count__num', String(bots));
      const plus = button('+', 'ui-btn--wood seat-count__btn', () => {
        if (bots < maxBots) {
          bots += 1;
          renderModal();
        }
      });
      minus.disabled = bots <= minBots;
      plus.disabled = bots >= maxBots;
      counter.append(el('span', 'ui-section-label', t('prac.botCount')), minus, num, plus);
      modal.panel.appendChild(counter);

      modal.panel.appendChild(fieldRow(
        t('prac.botDifficulty'),
        select(
          BOT_DIFFICULTIES.map((d) => ({ value: d, label: t(`lobby.difficulty.${d}`) })),
          difficulty,
          (v) => {
            difficulty = v;
          },
        ),
      ));

      const actions = div('ui-row');
      actions.style.marginTop = '14px';
      actions.append(
        button(t('generic.cancel'), 'ui-btn--ghost', () => {
          modal.close();
          setupModal = null;
        }),
        button(t('prac.play'), 'ui-btn--green ui-btn--big', () => {
          modal.close();
          setupModal = null;
          startRun(def, { bots, difficulty });
        }),
      );
      modal.panel.appendChild(actions);
    }

    renderModal();
  }

  /* ------------------------------------------------------------------ */
  /* Picker                                                              */
  /* ------------------------------------------------------------------ */

  function matches(def) {
    if (category !== 'all' && def.category !== category) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const hay = [
      localized(def.name),
      def.id,
      def.category,
      ...(def.tags ?? []),
    ].join(' ').toLowerCase();
    return hay.includes(q);
  }

  function render() {
    if (!root || run) return;
    clearNode(root);
    const wrap = div('ui-screen tour-screen');
    wrap.appendChild(el('h2', 'ui-heading', t('prac.title')));
    wrap.appendChild(el('p', 'tour-sub', t('prac.subtitle')));

    /* search + category filter */
    const filters = div('prac-filters');
    const searchInput = el('input', 'ui-input');
    searchInput.type = 'search';
    searchInput.placeholder = t('prac.search');
    searchInput.value = search;
    searchInput.addEventListener('input', () => {
      search = searchInput.value;
      renderGrid();
    });
    filters.appendChild(searchInput);

    const present = new Set(defs().map((d) => d.category));
    const cats = ['all', ...MINIGAME_CATEGORIES.filter((c) => present.has(c))];
    for (const cat of cats) {
      const label = cat === 'all' ? t('prac.all') : t(`prac.category.${cat}`);
      const b = button(label, 'ui-btn--small ui-btn--wood', () => {
        category = cat;
        render();
      });
      b.setAttribute('aria-pressed', String(category === cat));
      if (category === cat) b.style.outline = '3px solid #fff';
      filters.appendChild(b);
    }
    wrap.appendChild(filters);

    const body = div('tour-body');
    const grid = div('prac-grid');

    function renderGrid() {
      clearNode(grid);
      const all = defs();
      if (all.length === 0) {
        grid.appendChild(div('ui-dim', t('prac.none')));
        return;
      }
      const filtered = all.filter(matches);
      if (filtered.length === 0) {
        grid.appendChild(div('ui-dim', t('prac.empty')));
        return;
      }
      for (const def of filtered) {
        const card = el('button', 'prac-card');
        card.type = 'button';
        card.append(
          div('prac-card__name', localized(def.name)),
          div('prac-card__desc', localized(def.description)),
        );
        const meta = div('prac-card__meta');
        const playersLabel = def.players.min === def.players.max
          ? t('prac.playersExact', { n: def.players.min })
          : t('prac.players', { min: def.players.min, max: def.players.max });
        meta.append(
          el('span', 'prac-chip prac-chip--cat', t(`prac.category.${def.category}`)),
          el('span', 'prac-chip', playersLabel),
          el('span', 'prac-chip', t('prac.duration', { n: Math.round(def.durationSec) })),
        );
        card.appendChild(meta);
        card.addEventListener('click', () => {
          playSfx('click');
          openSetup(def);
        });
        grid.appendChild(card);
      }
    }

    renderGrid();
    body.appendChild(grid);
    wrap.appendChild(body);

    const actions = div('tour-actions');
    actions.appendChild(button(t('stats.toMenu'), 'ui-btn--ghost', () => ctx.router.go('mainMenu')));
    wrap.appendChild(actions);

    root.appendChild(wrap);
  }

  return {
    mount(elHost) {
      root = elHost;
      disposed = false;
      run = null;
      render();
      unsubLang = onLangChange(render);
      ctx.stage.menu(ctx.registries.characters.all().slice(0, 3));
      ctx.music.play('menu');
    },
    unmount() {
      disposed = true;
      stopRun();
      closeResults();
      setupModal?.close?.();
      setupModal = null;
      unsubLang?.();
      unsubLang = null;
      root = null;
    },
  };
}

export default createPracticeScreen;
