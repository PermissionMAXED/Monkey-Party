/**
 * Accessibility side effects for the settings store.
 *
 * initA11y(settingsStore, engine?) mirrors accessibility settings onto
 * <body> classes (consumed by src/ui/ui.css) and keeps them in sync via
 * subscribe():
 *   - reduced-motion                        (setting OR OS prefers-reduced-motion)
 *   - text-scale-115 / text-scale-130
 *   - cb-deuteranopia / cb-protanopia / cb-tritanopia
 *
 * It also forwards the screenShake setting to the engine when one is
 * reachable (explicit second arg, else window.__mpEngine if some host set
 * it) via engine.fx?.setEnabled?.(bool) - absence is tolerated everywhere.
 *
 * Dependency-free and callable headless (node): every document/window use
 * is guarded, so it degrades to a no-op without a DOM.
 */

const TEXT_SCALE_CLASSES = { 1.15: 'text-scale-115', 1.3: 'text-scale-130' };
const COLORBLIND_CLASSES = {
  deuteranopia: 'cb-deuteranopia',
  protanopia: 'cb-protanopia',
  tritanopia: 'cb-tritanopia',
};

/** One live instance per store: initA11y may be called both by the boot
 *  wiring and by the settings screen without stacking subscriptions. */
const instances = new WeakMap();

/**
 * @param {{ get: () => Object, subscribe?: (cb: Function) => Function }} settingsStore
 * @param {*} [engine] Optional engine handle (falls back to window.__mpEngine).
 * @returns {{ apply: () => void, dispose: () => void }}
 */
export function initA11y(settingsStore, engine = null) {
  if (settingsStore && typeof settingsStore === 'object') {
    const existing = instances.get(settingsStore);
    if (existing) {
      if (engine) existing.setEngine(engine);
      existing.apply();
      return existing;
    }
  }

  const hasDom = typeof document !== 'undefined' && !!document.body;
  const hasWindow = typeof window !== 'undefined';
  let engineRef = engine;

  /* OS-level reduced motion: ORs with the stored setting. */
  let osReducedMotion = false;
  let mql = null;
  let onMqlChange = null;
  if (hasWindow && typeof window.matchMedia === 'function') {
    try {
      mql = window.matchMedia('(prefers-reduced-motion: reduce)');
      osReducedMotion = !!mql.matches;
      onMqlChange = (e) => {
        osReducedMotion = !!e.matches;
        apply();
      };
      // Older engines only expose addListener; both are guarded.
      if (typeof mql.addEventListener === 'function') mql.addEventListener('change', onMqlChange);
      else mql.addListener?.(onMqlChange);
    } catch {
      mql = null;
    }
  }

  function resolveEngine() {
    if (engineRef) return engineRef;
    if (hasWindow) return window.__mpEngine ?? null;
    return null;
  }

  function apply() {
    const s = settingsStore?.get?.() ?? {};

    if (hasDom) {
      const cls = document.body.classList;
      cls.toggle('reduced-motion', !!s.reducedMotion || osReducedMotion);

      for (const [scale, name] of Object.entries(TEXT_SCALE_CLASSES)) {
        cls.toggle(name, Number(s.textScale) === Number(scale));
      }

      for (const [mode, name] of Object.entries(COLORBLIND_CLASSES)) {
        cls.toggle(name, s.colorblindMode === mode);
      }
      // Legacy class (green/danger hue shift in ui.css): the ui package
      // skips its own fallback toggle when this module is present.
      cls.toggle('colorblind', !!s.colorblind);
    }

    try {
      resolveEngine()?.fx?.setEnabled?.(s.screenShake !== false);
    } catch { /* the engine must never break accessibility syncing */ }
  }

  apply();
  const unsubscribe = settingsStore?.subscribe?.(() => apply()) ?? null;

  const handle = {
    apply,
    setEngine(next) {
      engineRef = next;
    },
    dispose() {
      unsubscribe?.();
      if (mql && onMqlChange) {
        if (typeof mql.removeEventListener === 'function') mql.removeEventListener('change', onMqlChange);
        else mql.removeListener?.(onMqlChange);
      }
      if (settingsStore && typeof settingsStore === 'object') instances.delete(settingsStore);
    },
  };
  if (settingsStore && typeof settingsStore === 'object') instances.set(settingsStore, handle);
  return handle;
}

export default initA11y;
