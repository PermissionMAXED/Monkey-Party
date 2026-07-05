/**
 * DOM-overlay screen manager with fade transitions.
 *
 * Screens are plain objects: { mount(el, params), unmount() }. Each screen
 * gets its own container div inside the router root; transitions are driven
 * by the .screen / .screen--visible / .screen--exit CSS classes
 * (see src/styles/main.css).
 *
 * Hardening (stability package): a screen whose mount() throws must never
 * brick navigation. The router catches the error, logs it, surfaces it via a
 * window 'error' dispatch (so the crash overlay counts it and the ui package
 * can toast it), and auto-navigates to 'mainMenu' - or 'placeholder' when
 * mainMenu is unregistered. The DOM/scheduling globals are resolved through
 * guards (rootEl.ownerDocument, typeof requestAnimationFrame) so the router
 * also runs under node tests with a tiny fake element.
 */

const FADE_MS = 260;

/** Fallback chain for screens whose mount() throws. */
const FALLBACK_SCREENS = ['mainMenu', 'placeholder'];
/** Max chained fallback attempts before the router gives up. */
const MAX_FALLBACK_DEPTH = 2;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** requestAnimationFrame with a headless-safe timeout fallback. */
function raf(cb) {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(cb);
  } else {
    setTimeout(cb, 16);
  }
}

/**
 * Surface a screen-mount failure as a window 'error' event so the global
 * error handlers (crash overlay counter, ui toast) see it. Guarded: silently
 * skipped without a window, and dispatch problems never re-crash navigation.
 */
function dispatchMountError(name, err) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  try {
    const message = `[router] screen "${name}" failed to mount: ${err?.message ?? err}`;
    let event;
    if (typeof window.ErrorEvent === 'function') {
      event = new window.ErrorEvent('error', { message, error: err });
    } else {
      event = new CustomEvent('error');
      event.message = message;
      event.error = err;
    }
    window.dispatchEvent(event);
  } catch { /* surfacing must never break the router */ }
}

/**
 * @param {HTMLElement} rootEl Container the screens are mounted into (e.g. #ui-root).
 */
export function createScreenRouter(rootEl) {
  if (!rootEl) throw new Error('createScreenRouter: rootEl is required');

  // Resolve the document through the root element so node tests can pass a
  // fake element carrying its own ownerDocument.createElement.
  const doc = rootEl.ownerDocument ?? (typeof document !== 'undefined' ? document : null);

  /** @type {Map<string, {mount: Function, unmount?: Function}>} */
  const screens = new Map();
  /** @type {{name: string, params: Object}[]} */
  const history = [];
  /** @type {{name: string, params: Object, el: HTMLElement, screen: Object}|null} */
  let current = null;
  let navToken = 0;

  /**
   * Register a screen under a name.
   * @param {string} name
   * @param {{mount: (el: HTMLElement, params: Object) => void, unmount?: () => void}} screen
   */
  function register(name, screen) {
    if (typeof name !== 'string' || !name) throw new Error('router.register: name must be a non-empty string');
    if (!screen || typeof screen.mount !== 'function') {
      throw new Error(`router.register("${name}"): screen must have a mount(el, params) function`);
    }
    screens.set(name, screen);
  }

  /** First registered fallback screen that isn't the one that just failed. */
  function pickFallback(failedName) {
    for (const candidate of FALLBACK_SCREENS) {
      if (candidate !== failedName && screens.has(candidate)) return candidate;
    }
    return null;
  }

  /**
   * Navigate to a screen (fades out the current one first).
   * @param {string} name
   * @param {Object} [params]
   * @param {{push?: boolean}} [opts] push=false skips adding the old screen to history (used by back()).
   */
  async function go(name, params = {}, opts = {}) {
    const screen = screens.get(name);
    if (!screen) throw new Error(`router.go: unknown screen "${name}"`);

    const token = ++navToken;
    const old = current;
    current = null;

    if (old) {
      if (opts.push !== false) history.push({ name: old.name, params: old.params });
      old.el.classList.remove('screen--visible');
      old.el.classList.add('screen--exit');
      await wait(FADE_MS);
      try {
        old.screen.unmount?.();
      } catch (err) {
        console.error(`[router] unmount of "${old.name}" threw:`, err);
      }
      old.el.remove();
    }

    // A newer navigation started while we were fading out - let it win.
    if (token !== navToken) return;

    const el = doc.createElement('div');
    el.className = 'screen';
    el.dataset.screen = name;
    rootEl.appendChild(el);

    current = { name, params, el, screen };
    try {
      screen.mount(el, params);
    } catch (err) {
      // A throwing mount must not brick navigation: drop the broken screen,
      // surface the error, and fall back to a known-good screen.
      console.error(`[router] mount of "${name}" threw:`, err);
      current = null;
      el.remove();
      dispatchMountError(name, err);
      const depth = (opts._fallbackDepth ?? 0) + 1;
      const fallback = depth <= MAX_FALLBACK_DEPTH ? pickFallback(name) : null;
      if (fallback) {
        await go(fallback, {}, { push: false, _fallbackDepth: depth });
      }
      return;
    }

    // Double rAF so the initial (opacity 0) style is committed before the fade-in.
    raf(() => {
      raf(() => {
        if (current?.el === el) el.classList.add('screen--visible');
      });
    });
  }

  /** Navigate back to the previous screen (no-op when history is empty). */
  async function back() {
    const prev = history.pop();
    if (!prev) return;
    await go(prev.name, prev.params, { push: false });
  }

  /** @returns {string|null} Name of the currently mounted screen. */
  function currentName() {
    return current?.name ?? null;
  }

  /** @returns {string|null} Alias of currentName() for newer callers. */
  function currentScreen() {
    return currentName();
  }

  /** @returns {boolean} */
  function has(name) {
    return screens.has(name);
  }

  return { register, go, back, currentName, current: currentScreen, has };
}
