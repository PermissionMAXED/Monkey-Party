/**
 * DOM-overlay screen manager with fade transitions.
 *
 * Screens are plain objects: { mount(el, params), unmount() }. Each screen
 * gets its own container div inside the router root; transitions are driven
 * by the .screen / .screen--visible / .screen--exit CSS classes
 * (see src/styles/main.css).
 */

const FADE_MS = 260;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {HTMLElement} rootEl Container the screens are mounted into (e.g. #ui-root).
 */
export function createScreenRouter(rootEl) {
  if (!rootEl) throw new Error('createScreenRouter: rootEl is required');

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

    const el = document.createElement('div');
    el.className = 'screen';
    el.dataset.screen = name;
    rootEl.appendChild(el);

    current = { name, params, el, screen };
    screen.mount(el, params);

    // Double rAF so the initial (opacity 0) style is committed before the fade-in.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
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

  /** @returns {boolean} */
  function has(name) {
    return screens.has(name);
  }

  return { register, go, back, currentName, has };
}
