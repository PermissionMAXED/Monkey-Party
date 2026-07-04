/**
 * MONKEY-PARTY client boot.
 *
 * Order: register content -> report registry counts -> create renderer
 * (optional package) -> build UI (optional package, placeholder fallback).
 * Every later-package import is guarded so the foundation package (P1)
 * boots standalone.
 */

import './styles/main.css';
import { registerAllContent } from '#shared/content/index.js';
import { registries } from '#shared/registries.js';
import { createScreenRouter } from './app/screenRouter.js';
import { settingsStore } from './app/settingsStore.js';
import { profileStore } from './app/profileStore.js';

// Optional sibling packages, resolved relative to /src/main.js at runtime.
const ENGINE_PATH = './engine/renderer.js';
const UI_PATH = './ui/index.js';

async function tryImport(path) {
  try {
    return await import(/* @vite-ignore */ path);
  } catch (err) {
    console.info(`[boot] optional module not available: ${path} (${err?.message ?? err})`);
    return null;
  }
}

function hideLoadingScreen() {
  const loading = document.getElementById('loading');
  if (!loading) return;
  loading.classList.add('loading--done');
  setTimeout(() => loading.remove(), 500);
}

/**
 * Minimal built-in screen shown while the ui/ package doesn't exist yet:
 * lists every registry with its count plus the content-registrar report.
 */
function mountPlaceholderScreen(router, contentReport) {
  router.register('placeholder', {
    mount(el) {
      const panel = document.createElement('div');
      panel.className = 'panel';

      const title = document.createElement('h1');
      title.className = 'title';
      title.textContent = 'MONKEY PARTY';

      const subtitle = document.createElement('p');
      subtitle.className = 'subtitle';
      subtitle.textContent = 'Foundation online - jungle under construction';

      const list = document.createElement('ul');
      list.className = 'registry-list';
      for (const [name, registry] of Object.entries(registries)) {
        const count = registry.count();
        const nameEl = document.createElement('li');
        nameEl.className = 'registry-list__name';
        nameEl.textContent = name;
        const countEl = document.createElement('li');
        countEl.className = `registry-list__count${count === 0 ? ' registry-list__count--empty' : ''}`;
        countEl.textContent = String(count);
        list.append(nameEl, countEl);
      }

      const note = document.createElement('p');
      note.className = 'placeholder-note';
      const loaded = contentReport.loaded.length ? contentReport.loaded.join(', ') : 'none';
      const missing = contentReport.missing.length ? contentReport.missing.join(', ') : 'none';
      note.textContent = `Content registrars loaded: ${loaded}. Pending packages: ${missing}. `
        + 'The full menu appears once the ui package is installed.';

      panel.append(title, subtitle, list, note);
      el.appendChild(panel);
    },
    unmount() {},
  });
  router.go('placeholder');
}

async function boot() {
  console.info('[boot] MONKEY-PARTY foundation starting');

  // 1. Content registries.
  const contentReport = await registerAllContent();
  const counts = {};
  for (const [name, registry] of Object.entries(registries)) {
    counts[name] = registry.count();
  }
  console.table(counts);

  // 2. Renderer (optional engine package).
  const canvas = document.getElementById('game');
  let engine = null;
  const engineMod = await tryImport(ENGINE_PATH);
  const createRenderer = engineMod?.createRenderer ?? engineMod?.default;
  if (typeof createRenderer === 'function') {
    engine = createRenderer({ canvas, settings: settingsStore.get() });
    console.info('[boot] engine renderer created');
  } else {
    console.info('[boot] no engine package yet - canvas stays idle');
  }

  // 3. UI (optional ui package; placeholder fallback).
  const uiRoot = document.getElementById('ui-root');
  const router = createScreenRouter(uiRoot);
  const app = {
    canvas,
    engine,
    router,
    settings: settingsStore,
    profile: profileStore,
    registries,
    contentReport,
    session: null,
  };

  const uiMod = await tryImport(UI_PATH);
  const buildUI = uiMod?.buildUI ?? uiMod?.default;
  hideLoadingScreen();
  if (typeof buildUI === 'function') {
    await buildUI(app);
    console.info('[boot] ui package mounted');
  } else {
    console.info('[boot] no ui package yet - showing placeholder screen');
    mountPlaceholderScreen(router, contentReport);
  }

  console.info('[boot] ready');
  return app;
}

boot().catch((err) => {
  console.error('[boot] fatal error:', err);
  const loading = document.getElementById('loading');
  if (loading) {
    const hint = loading.querySelector('.loading__hint');
    if (hint) hint.textContent = 'Boot failed - see console';
  }
});
