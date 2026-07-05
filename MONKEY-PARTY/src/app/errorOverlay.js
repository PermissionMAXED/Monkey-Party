/**
 * Crash overlay + crash-loop detector (stability package).
 *
 * installErrorOverlay() registers window 'error' and 'unhandledrejection'
 * handlers. Non-fatal runtime errors are left alone (the ui package already
 * toasts them); the full-screen overlay only appears for FATAL conditions:
 *   - an error thrown during boot, before the UI mounts
 *     (main.js flips the phase via handle.markBootComplete()), or
 *   - a runtime crash loop: more than CRASH_LOOP.threshold errors within
 *     CRASH_LOOP.windowMs (default: >8 errors in 10s).
 *
 * The overlay is deliberately dependency-free and styled inline so it renders
 * even when the stylesheet or the ui package is broken: jungle-branded
 * "The jungle hit a snag" card with the error message, a Reload button and a
 * "copy details" button (message + stack + user agent + app version; the
 * version comes from a guarded dynamic import of './version.js' and falls
 * back to 'dev').
 *
 * createCrashLoopCounter is the pure counting logic, exported separately so
 * node tests can drive it without a DOM.
 */

/** Crash-loop tuning (exported for tests). */
export const CRASH_LOOP = Object.freeze({
  /** Fatal once MORE THAN this many errors land inside the window. */
  threshold: 8,
  /** Sliding window length in milliseconds. */
  windowMs: 10_000,
});

const OVERLAY_ID = 'mp-crash-overlay';

/**
 * Pure sliding-window crash-loop counter (no DOM, no globals).
 *
 * @param {{ threshold?: number, windowMs?: number, now?: () => number }} [opts]
 * @returns {{
 *   record: (timestamp?: number) => boolean,  // true = crash loop reached
 *   count: (timestamp?: number) => number,    // errors inside current window
 *   reset: () => void,
 * }}
 */
export function createCrashLoopCounter(opts = {}) {
  const threshold = opts.threshold ?? CRASH_LOOP.threshold;
  const windowMs = opts.windowMs ?? CRASH_LOOP.windowMs;
  const now = typeof opts.now === 'function' ? opts.now : Date.now;
  /** @type {number[]} */
  let stamps = [];

  function prune(t) {
    stamps = stamps.filter((s) => t - s < windowMs);
  }

  /** Record one error; returns true when the crash-loop threshold is passed. */
  function record(timestamp) {
    const t = Number.isFinite(timestamp) ? timestamp : now();
    prune(t);
    stamps.push(t);
    return stamps.length > threshold;
  }

  /** Errors currently inside the sliding window (prunes first). */
  function count(timestamp) {
    const t = Number.isFinite(timestamp) ? timestamp : now();
    prune(t);
    return stamps.length;
  }

  function reset() {
    stamps = [];
  }

  return { record, count, reset };
}

/** Best-effort message/stack extraction from anything throwable. */
function describeError(err) {
  if (err instanceof Error) {
    return { message: err.message || String(err), stack: err.stack || '(no stack)' };
  }
  if (err && typeof err === 'object') {
    const message = typeof err.message === 'string' && err.message ? err.message : JSON.stringify(err);
    return { message, stack: typeof err.stack === 'string' ? err.stack : '(no stack)' };
  }
  return { message: String(err ?? 'Unknown error'), stack: '(no stack)' };
}

/** App version via guarded dynamic import; 'dev' when unavailable. */
async function resolveVersion() {
  try {
    const mod = await import('./version.js');
    return mod?.BUILD_STAMP ?? mod?.VERSION ?? mod?.default ?? 'dev';
  } catch {
    return 'dev';
  }
}

function buildOverlay(errInfo) {
  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.setAttribute('role', 'alertdialog');
  overlay.setAttribute('aria-label', 'The jungle hit a snag');
  // Inline styles only - must render even if every stylesheet is broken.
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:2147483000',
    'display:flex', 'align-items:center', 'justify-content:center',
    'padding:24px', 'box-sizing:border-box',
    'background:linear-gradient(180deg,#08140c 0%,#0c1f12 55%,#10281a 100%)',
    'color:#e8f5d8', "font-family:'Trebuchet MS','Segoe UI',Verdana,sans-serif",
  ].join(';');

  const card = document.createElement('div');
  card.style.cssText = [
    'max-width:560px', 'width:100%', 'padding:28px 32px', 'box-sizing:border-box',
    'background:rgba(8,20,12,0.92)', 'border:2px solid #3a7d44', 'border-radius:16px',
    'box-shadow:0 12px 48px rgba(0,0,0,0.55)', 'text-align:center',
  ].join(';');

  const emoji = document.createElement('div');
  emoji.textContent = '\u{1F412}\u{1F34C}';
  emoji.style.cssText = 'font-size:44px;line-height:1;margin-bottom:10px';

  const title = document.createElement('h1');
  title.textContent = 'The jungle hit a snag';
  title.style.cssText = [
    'margin:0 0 10px', 'font-size:26px', 'font-weight:900', 'letter-spacing:0.06em',
    'color:#ffd94d', 'text-shadow:0 2px 0 #7a5c00,0 6px 24px rgba(0,0,0,0.6)',
  ].join(';');

  const message = document.createElement('p');
  message.textContent = errInfo.message;
  message.style.cssText = [
    'margin:0 0 20px', 'font-size:14px', 'line-height:1.5', 'color:#c9e6b0',
    'word-break:break-word', 'max-height:120px', 'overflow:auto',
  ].join(';');

  const buttonCss = [
    'padding:10px 22px', 'margin:0 6px', 'border-radius:10px', 'cursor:pointer',
    'font:700 15px/1 inherit', "font-family:'Trebuchet MS','Segoe UI',Verdana,sans-serif",
  ].join(';');

  const reloadBtn = document.createElement('button');
  reloadBtn.type = 'button';
  reloadBtn.textContent = 'Reload';
  reloadBtn.style.cssText = `${buttonCss};border:0;background:#ffd94d;color:#3d2e00`;
  reloadBtn.addEventListener('click', () => {
    try {
      window.location.reload();
    } catch { /* nothing left to do */ }
  });

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.textContent = 'Copy details';
  copyBtn.style.cssText = `${buttonCss};border:2px solid #58a35c;background:transparent;color:#9ed76a`;
  copyBtn.addEventListener('click', async () => {
    const version = await resolveVersion();
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
    const details = [
      'MONKEY-PARTY crash report',
      `Version: ${version}`,
      `User agent: ${ua}`,
      `Error: ${errInfo.message}`,
      `Stack:\n${errInfo.stack}`,
    ].join('\n');
    let copied = false;
    try {
      await navigator.clipboard.writeText(details);
      copied = true;
    } catch {
      // Clipboard API unavailable (permissions, http) - textarea fallback.
      try {
        const ta = document.createElement('textarea');
        ta.value = details;
        ta.style.cssText = 'position:fixed;left:-9999px;top:0';
        document.body.appendChild(ta);
        ta.select();
        copied = document.execCommand('copy');
        ta.remove();
      } catch {
        copied = false;
      }
    }
    copyBtn.textContent = copied ? 'Copied!' : 'Copy failed';
    setTimeout(() => {
      copyBtn.textContent = 'Copy details';
    }, 2000);
  });

  const row = document.createElement('div');
  row.append(reloadBtn, copyBtn);
  card.append(emoji, title, message, row);
  overlay.appendChild(card);
  return overlay;
}

/**
 * Install the global error handlers + fatal overlay.
 *
 * Headless-safe: without a window this returns an inert handle.
 *
 * @returns {{
 *   showFatal: (err: *) => void,
 *   markBootComplete: () => void,
 *   isShown: () => boolean,
 *   dispose: () => void,
 * }}
 */
export function installErrorOverlay() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { showFatal() {}, markBootComplete() {}, isShown: () => false, dispose() {} };
  }

  const counter = createCrashLoopCounter();
  let bootComplete = false;
  let shown = false;

  function showFatal(err) {
    if (shown) return; // First fatal wins; keep its message on screen.
    shown = true;
    try {
      const overlay = buildOverlay(describeError(err));
      (document.body ?? document.documentElement).appendChild(overlay);
    } catch (renderErr) {
      // Never let the crash screen itself crash the page.
      console.error('[crash-overlay] failed to render overlay:', renderErr);
    }
  }

  function handleErrorLike(err) {
    const crashLoop = counter.record();
    if (!bootComplete) {
      showFatal(err); // Boot-phase errors are always fatal.
    } else if (crashLoop) {
      showFatal(err);
      console.error(`[crash-overlay] crash loop detected (>${CRASH_LOOP.threshold} errors in ${CRASH_LOOP.windowMs / 1000}s)`);
    }
    // Non-fatal runtime errors stay untouched - the ui package toasts them.
  }

  const onError = (event) => {
    handleErrorLike(event?.error ?? event?.message ?? 'Unknown error');
  };
  const onRejection = (event) => {
    handleErrorLike(event?.reason ?? 'Unhandled promise rejection');
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);

  return {
    /** Force the fatal overlay (used by main.js when boot itself fails). */
    showFatal,
    /** Boot finished: from now on only crash loops are fatal. */
    markBootComplete() {
      bootComplete = true;
    },
    isShown: () => shown,
    dispose() {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      document.getElementById(OVERLAY_ID)?.remove();
      shown = false;
    },
  };
}

export default installErrorOverlay;
