/**
 * MONKEY-PARTY UI package (P9) - DOM UI + full client-flow integration.
 *
 * buildUI(app) is the single entry point (called from src/main.js). It
 * creates the UI event bus, the local input system, a lazy net client,
 * the shared 3D "stage" for menu/preview scenes, registers every screen
 * on the router, loads optional UI extensions (help, net status,
 * progression, tournament) and navigates to the main menu.
 *
 * Everything downstream talks through ISession (src/app/session.js), the
 * screen router, the settings/profile stores and the content registries.
 */

import './ui.css';

import * as THREE from 'three';
import { createInput } from '../engine/input.js';
import { initAudio } from '../engine/audio.js';
import { initI18n } from './i18n.js';
import { toast } from './dom.js';

import { createMainMenuScreen } from './mainMenu.js';
import { createLobbyScreen } from './lobbyScreen.js';
import { createLobbyBrowserScreen } from './lobbyBrowser.js';
import { createCharSelectScreen } from './charSelect.js';
import { createRulesEditorScreen } from './rulesEditor.js';
import { createStatsScreen } from './statsScreen.js';
import { createSettingsScreen } from './settingsScreen.js';
import { createMatchScreen } from './matchController.js';

/* ------------------------------------------------------------------ */
/* Guarded dynamic imports (house style, see tryImport in src/main.js) */
/* ------------------------------------------------------------------ */

/**
 * Optional UI extension modules. Each default-exports register(ctx) which
 * may register screens on ctx.app.router and may return
 * { menuItems: [{id, labelKey, screen, order}] } for extra main-menu
 * buttons. Absent modules are tolerated silently.
 *
 * Same guarded-import idea as tryImport in src/main.js, but through
 * import.meta.glob: Vite resolves the patterns at transform time, so a
 * missing module is simply not in the map - no request, no devtools 404
 * noise - while present ones stay lazy dynamic imports.
 */
const UI_EXTENSION_PATHS = [
  './help/index.js',
  './netStatus.js',
  './progression/index.js',
  './tournament/index.js',
];
const UI_EXTENSION_LOADERS = import.meta.glob([
  './help/index.js',
  './netStatus.js',
  './progression/index.js',
  './tournament/index.js',
]);

/** Optional accessibility package (owns reduced-motion/colorblind wiring). */
const A11Y_PATH = '../app/a11y.js';
const A11Y_LOADERS = import.meta.glob('../app/a11y.js');

async function tryLoad(loaders, path) {
  const loader = loaders[path];
  if (typeof loader !== 'function') return null; // absent: stays silent
  try {
    return await loader();
  } catch (err) {
    // The module exists but failed to load - that is worth a warning.
    console.warn(`[ui] optional module "${path}" failed to load:`, err);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* UI event bus                                                        */
/* ------------------------------------------------------------------ */

/**
 * Event bus with request/response support:
 *   on/off/emit          - fire-and-forget events
 *   request(name, options, cb) - routed to the single handler registered
 *                          via onRequest(name, fn); used by boardPlayView
 *                          for decision prompts.
 */
export function createUiBus() {
  const listeners = new Map();
  const requestHandlers = new Map();

  function on(evt, cb) {
    let set = listeners.get(evt);
    if (!set) {
      set = new Set();
      listeners.set(evt, set);
    }
    set.add(cb);
    return () => off(evt, cb);
  }

  function off(evt, cb) {
    listeners.get(evt)?.delete(cb);
  }

  function emit(evt, ...args) {
    const set = listeners.get(evt);
    if (!set) return;
    for (const cb of [...set]) {
      try {
        cb(...args);
      } catch (err) {
        console.error(`[ui:bus] listener for "${evt}" threw:`, err);
      }
    }
  }

  function onRequest(name, handler) {
    requestHandlers.set(name, handler);
    return () => {
      if (requestHandlers.get(name) === handler) requestHandlers.delete(name);
    };
  }

  function request(name, options, cb) {
    const handler = requestHandlers.get(name) ?? requestHandlers.get('*');
    if (!handler) {
      console.warn(`[ui:bus] unhandled request "${name}" - answering with null`);
      cb?.(null);
      return;
    }
    handler(name, options, cb);
  }

  return { on, off, emit, request, onRequest };
}

/* ------------------------------------------------------------------ */
/* Menu/preview 3D stage (reuses the ONE app engine renderer)          */
/* ------------------------------------------------------------------ */

const CHARACTERS_PKG_PATH = '../characters/index.js';

function createStage(engine) {
  if (!engine?.scene) {
    // Headless / engine-less boot: every stage call becomes a no-op.
    return {
      menu() {}, preview() {}, clearPreview() {}, hide() {}, dispose() {},
    };
  }

  const scene = engine.scene;
  scene.background = new THREE.Color('#0d2114');

  // Shared lights, added once for menus AND match (boardplay adds none).
  const hemi = new THREE.HemisphereLight(0xdfeee2, 0x2a3a24, 1.1);
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
  sun.position.set(18, 30, 12);
  sun.castShadow = true;
  sun.shadow.camera.left = -30;
  sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
  scene.add(hemi, sun);

  const backdrop = new THREE.Group();
  backdrop.name = 'ui-menu-backdrop';
  const previewSlot = new THREE.Group();
  previewSlot.name = 'ui-char-preview';

  let charsMod = null;
  let charsModPromise = null;
  function loadChars() {
    if (!charsModPromise) {
      charsModPromise = import(/* @vite-ignore */ CHARACTERS_PKG_PATH)
        .then((mod) => {
          charsMod = mod;
          return mod;
        })
        .catch(() => null);
    }
    return charsModPromise;
  }

  let backdropBuilt = false;
  function buildBackdrop(defs) {
    if (backdropBuilt || !charsMod?.buildCharacterPreview) return;
    backdropBuilt = true;
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(6.5, 7, 0.5, 28),
      new THREE.MeshStandardMaterial({ color: 0x5a4026, roughness: 0.9 }),
    );
    disc.position.y = -0.3;
    disc.receiveShadow = true;
    backdrop.add(disc);
    const spots = [[-2.7, 0, -0.6], [2.7, 0, -0.6], [0, 0, -2.2]];
    defs.slice(0, 3).forEach((def, i) => {
      try {
        const g = charsMod.buildCharacterPreview(def);
        g.position.set(...spots[i % spots.length]);
        backdrop.add(g);
      } catch { /* backdrop monkeys are decoration only */ }
    });
  }

  function menuCamera() {
    const cam = engine.camera;
    cam.position.set(0, 1.9, 6.2);
    cam.lookAt(0, 1.1, 0);
  }

  return {
    /** Menu backdrop: wooden disc + idle monkeys. */
    menu(charDefs = []) {
      this.clearPreview();
      if (!backdrop.parent) scene.add(backdrop);
      backdrop.visible = true;
      menuCamera();
      loadChars().then(() => {
        try {
          buildBackdrop(charDefs);
        } catch { /* optional */ }
      });
    },

    /** Show one character preview (character select screen). */
    preview(def, cosmetics = null, xOffset = 1.5) {
      backdrop.visible = false;
      this.clearPreview();
      if (!previewSlot.parent) scene.add(previewSlot);
      const cam = engine.camera;
      cam.position.set(0, 1.5, 4.4);
      cam.lookAt(0, 1.0, 0);
      loadChars().then((mod) => {
        if (!mod?.buildCharacterPreview) return;
        // The slot may have been cleared/re-targeted while loading.
        if (previewSlot.userData.wanted !== def?.id) return;
        try {
          const g = mod.buildCharacterPreview(def, cosmetics);
          g.position.set(xOffset, 0, 0);
          previewSlot.add(g);
        } catch (err) {
          console.warn('[ui:stage] character preview failed:', err);
        }
      });
      previewSlot.userData.wanted = def?.id ?? null;
    },

    clearPreview() {
      previewSlot.userData.wanted = null;
      for (const child of [...previewSlot.children]) {
        try {
          child.userData?.dispose?.();
        } catch { /* best effort */ }
        previewSlot.remove(child);
      }
    },

    /** Hide every menu visual (match takes over the scene). */
    hide() {
      backdrop.visible = false;
      this.clearPreview();
      if (backdrop.parent) scene.remove(backdrop);
      if (previewSlot.parent) scene.remove(previewSlot);
    },

    dispose() {
      this.hide();
      scene.remove(hemi, sun);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Guarded music helper                                                */
/* ------------------------------------------------------------------ */

function createMusic() {
  let mod = null;
  const modPromise = import('../engine/music.js')
    .then((m) => {
      mod = m;
      return m;
    })
    .catch(() => null);

  return {
    play(themeOrName) {
      modPromise.then(() => {
        try {
          mod?.playTheme?.(themeOrName);
        } catch { /* music is optional */ }
      });
    },
    stop(fadeSec = 0.4) {
      try {
        mod?.stop?.(fadeSec);
      } catch { /* optional */ }
    },
    duck(on) {
      try {
        mod?.duck?.(on);
      } catch { /* optional */ }
    },
    /** Dynamic music intensity 0..1 (engine package implements it). */
    setIntensity(v) {
      try {
        mod?.setIntensity?.(v);
      } catch { /* optional */ }
    },
    /** One-shot musical stinger by name (engine package implements it). */
    stinger(name) {
      try {
        mod?.stinger?.(name);
      } catch { /* optional */ }
    },
  };
}

/* ------------------------------------------------------------------ */
/* buildUI                                                             */
/* ------------------------------------------------------------------ */

/**
 * @param {{
 *   canvas: HTMLCanvasElement, engine: *, router: *, settings: *,
 *   profile: *, registries: *, contentReport: *, session: *,
 * }} app The app context assembled in src/main.js.
 */
export async function buildUI(app) {
  initI18n(app.settings);
  initAudio(app.settings);

  const bus = createUiBus();
  const input = createInput(app.settings);
  const music = createMusic();
  const stage = createStage(app.engine);

  /* Lazy net client: created (and connected) on the first online action. */
  let netClient = null;
  async function ensureNet() {
    if (netClient && (netClient.state === 'open' || netClient.state === 'connecting' || netClient.state === 'reconnecting')) {
      if (netClient.state !== 'open') await netClient.connect();
      return netClient;
    }
    const { createNetClient, NetClientError } = await import('../net/client.js');
    // A 'closed' client (the transport gave up retrying) is still fully
    // usable: connect() resets the attempt counter and resumes with the
    // same token, so every live createOnlineSession subscription keeps
    // working after a successful Retry. Replacing it would orphan the
    // running session on a dead client (zombie screen until reload).
    // Only a 'fatal' client (protocol mismatch) is unrecoverable.
    if (!netClient || netClient.state === 'fatal') {
      netClient = createNetClient();
    }
    try {
      await netClient.connect();
    } catch (err) {
      if (err instanceof NetClientError) throw err;
      throw new Error(err?.message ?? 'connect failed');
    }
    return netClient;
  }

  const ctx = {
    app,
    engine: app.engine,
    router: app.router,
    settings: app.settings,
    profile: app.profile,
    registries: app.registries,
    bus,
    input,
    music,
    stage,
    ensureNet,
    getNetClient: () => netClient,

    /** Extra main-menu buttons collected from optional UI extensions
     *  ({id, labelKey, screen, order}[], sorted by order). */
    menuItems: [],

    /** The cfg of the most recent offline session created by the main
     *  menu (the in-match package reads it for rematch). */
    lastOfflineConfig: null,

    /** The live ISession (offline or online); also mirrored to app.session. */
    get session() {
      return app.session;
    },
    setSession(session) {
      // Leaving a previous session keeps timers/sims from piling up.
      if (app.session && app.session !== session) {
        try {
          app.session.leave();
        } catch { /* already gone */ }
      }
      app.session = session;
    },
  };

  /* Accessibility: the optional a11y package owns the body classes
   * (reduced-motion, colorblind, ...). Without it, keep the built-in
   * colorblind body-class logic as the fallback. */
  const a11yMod = await tryLoad(A11Y_LOADERS, A11Y_PATH);
  const hasA11y = typeof a11yMod?.initA11y === 'function';
  if (hasA11y) {
    try {
      a11yMod.initA11y(app.settings);
    } catch (err) {
      console.warn('[ui] initA11y threw:', err);
    }
  }

  /* React to settings: engine quality (+ colorblind fallback sans a11y). */
  let lastQuality = app.settings.get().quality;
  if (!hasA11y) document.body.classList.toggle('colorblind', !!app.settings.get().colorblind);
  app.settings.subscribe((s) => {
    if (s.quality !== lastQuality) {
      lastQuality = s.quality;
      try {
        app.engine?.setQuality?.(s.quality);
      } catch { /* engine optional */ }
    }
    if (!hasA11y) document.body.classList.toggle('colorblind', !!s.colorblind);
  });

  /* Register every screen. */
  app.router.register('mainMenu', createMainMenuScreen(ctx));
  app.router.register('lobby', createLobbyScreen(ctx));
  app.router.register('lobbyBrowser', createLobbyBrowserScreen(ctx));
  app.router.register('charSelect', createCharSelectScreen(ctx));
  app.router.register('rules', createRulesEditorScreen(ctx));
  app.router.register('stats', createStatsScreen(ctx));
  app.router.register('settings', createSettingsScreen(ctx));
  app.router.register('match', createMatchScreen(ctx));

  /* Optional UI extensions (help, net status, progression, tournament):
   * each may register screens on ctx.app.router and contribute main-menu
   * buttons. Missing modules stay silent; broken registrations must never
   * take the whole UI down. */
  for (const path of UI_EXTENSION_PATHS) {
    const mod = await tryLoad(UI_EXTENSION_LOADERS, path);
    const register = mod?.default ?? mod?.register;
    if (typeof register !== 'function') continue;
    try {
      const result = await register(ctx);
      if (Array.isArray(result?.menuItems)) ctx.menuItems.push(...result.menuItems);
    } catch (err) {
      console.warn(`[ui] extension "${path}" failed to register:`, err);
    }
  }
  ctx.menuItems.sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0));

  window.addEventListener('error', (e) => {
    // Surface unexpected errors to the player instead of failing silently.
    if (e?.message) toast(e.message, 'error');
  });

  await app.router.go('mainMenu');
  return ctx;
}

export default buildUI;
