/**
 * MONKEY-PARTY UI package (P9) - DOM UI + full client-flow integration.
 *
 * buildUI(app) is the single entry point (called from src/main.js). It
 * creates the UI event bus, the local input system, a lazy net client,
 * the shared 3D "stage" for menu/preview scenes, registers every screen
 * on the router and navigates to the main menu.
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
    if (!netClient || netClient.state === 'closed' || netClient.state === 'fatal') {
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

  /* React to settings: engine quality + colorblind body class. */
  let lastQuality = app.settings.get().quality;
  document.body.classList.toggle('colorblind', !!app.settings.get().colorblind);
  app.settings.subscribe((s) => {
    if (s.quality !== lastQuality) {
      lastQuality = s.quality;
      try {
        app.engine?.setQuality?.(s.quality);
      } catch { /* engine optional */ }
    }
    document.body.classList.toggle('colorblind', !!s.colorblind);
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

  window.addEventListener('error', (e) => {
    // Surface unexpected errors to the player instead of failing silently.
    if (e?.message) toast(e.message, 'error');
  });

  await app.router.go('mainMenu');
  return ctx;
}

export default buildUI;
