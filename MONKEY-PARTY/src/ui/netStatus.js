/**
 * Persistent connection-status banner (Online Robustness package).
 *
 * register(ctx) (default export) mounts an unobtrusive top-center banner
 * into #ui-root and binds it to the LIVE net client:
 *  - the client is created lazily (ctx.ensureNet), and may be REPLACED
 *    after a fatal/closed state, so we poll ctx.getNetClient() on a 1s
 *    interval and (re)attach listeners whenever the instance changes;
 *  - 'reconnecting'      -> "Reconnecting… (attempt n)"
 *  - 'reconnect_failed'  -> "Connection lost — retrying failed" + Retry
 *  - 'fatal'             -> error line (protocol version mismatch text)
 *  - 'open'              -> auto-hide.
 *
 * register() is an idempotent singleton and returns {} (no menuItems), so
 * it is safe to call from ui/index.js's guard-load AND from the online
 * screens (lobby / lobby browser) that also load it defensively.
 */

import { button } from './dom.js';
import { tNet } from './netStrings.js';

const BANNER_CSS = `
.net-status {
  position: fixed;
  top: 8px;
  left: 50%;
  transform: translate(-50%, -6px);
  z-index: 240;
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: min(92vw, 560px);
  padding: 8px 16px;
  border-radius: 12px;
  border: 1px solid rgba(255, 225, 53, 0.45);
  background: rgba(24, 18, 8, 0.92);
  color: #ffe135;
  font-weight: 700;
  font-size: 0.9rem;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.net-status--show {
  opacity: 1;
  pointer-events: auto;
  transform: translate(-50%, 0);
}
.net-status--error {
  border-color: rgba(255, 94, 77, 0.6);
  color: #ff8d80;
}
.net-status__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex: none;
  background: #ffcf3d;
  animation: net-status-pulse 1s ease-in-out infinite alternate;
}
.net-status--error .net-status__dot { background: #ff5e4d; }
@keyframes net-status-pulse { from { opacity: 0.35; } to { opacity: 1; } }
.net-status__text { min-width: 0; }
`;

/** Singleton guard: the banner mounts once per page. */
let singleton = null;

/**
 * @param {{getNetClient: () => Object|null, ensureNet?: () => Promise<Object>}} ctx
 * @returns {{}} No menu items (the UI hub ignores the return value).
 */
export default function register(ctx) {
  if (singleton) return {};
  if (typeof document === 'undefined' || typeof ctx?.getNetClient !== 'function') return {};

  const host = document.getElementById('ui-root') ?? document.body;

  const style = document.createElement('style');
  style.textContent = BANNER_CSS;
  document.head.appendChild(style);

  const banner = document.createElement('div');
  banner.className = 'net-status';
  banner.setAttribute('role', 'status');
  const dot = document.createElement('span');
  dot.className = 'net-status__dot';
  const text = document.createElement('span');
  text.className = 'net-status__text';
  const retryBtn = button(tNet('net.retry'), 'ui-btn--small ui-btn--green', () => retry());
  retryBtn.style.display = 'none';
  banner.append(dot, text, retryBtn);
  host.appendChild(banner);

  function show(message, { error = false, retryable = false } = {}) {
    text.textContent = message;
    banner.classList.toggle('net-status--error', error);
    retryBtn.style.display = retryable ? '' : 'none';
    retryBtn.textContent = tNet('net.retry');
    banner.classList.add('net-status--show');
  }

  function hide() {
    banner.classList.remove('net-status--show');
    retryBtn.style.display = 'none';
  }

  function showFatal(err) {
    const message = err?.code === 'version'
      ? tNet('net.versionMismatch')
      : tNet('net.fatal', { msg: err?.message ?? 'unknown' });
    // A version mismatch cannot be retried into success - reloading the
    // page (fresh client build) is the fix, so no Retry button for it.
    show(message, { error: true, retryable: err?.code !== 'version' });
  }

  async function retry() {
    show(tNet('net.reconnectingShort'));
    try {
      // ensureNet creates a FRESH client when the old one is closed/fatal;
      // the poll below re-attaches to the new instance within a second.
      if (typeof ctx.ensureNet === 'function') await ctx.ensureNet();
      else await attached?.connect?.();
      hide();
    } catch (err) {
      if (err?.fatal) showFatal(err);
      else show(tNet('net.reconnectFailed'), { error: true, retryable: true });
    }
  }

  /* ------------- live client attachment (poll: created lazily) ------- */

  let attached = null;
  const offs = [];

  function detach() {
    for (const off of offs.splice(0)) {
      try {
        off?.();
      } catch { /* listener already gone */ }
    }
    attached = null;
  }

  function attach(client) {
    attached = client;
    const sub = (evt, cb) => {
      const off = client.on(evt, cb);
      if (typeof off === 'function') offs.push(off);
    };
    sub('reconnecting', (info) => show(tNet('net.reconnecting', { n: info?.attempt ?? 1 })));
    sub('reconnect_failed', () => show(tNet('net.reconnectFailed'), { error: true, retryable: true }));
    sub('fatal', (err) => showFatal(err));
    sub('open', () => hide());

    // Reflect the state the client is ALREADY in (we may attach mid-outage).
    if (client.state === 'reconnecting') show(tNet('net.reconnectingShort'));
    else if (client.state === 'closed') show(tNet('net.reconnectFailed'), { error: true, retryable: true });
    else if (client.state === 'fatal') showFatal({ code: 'fatal', message: 'connection is in a fatal state' });
    else if (client.state === 'open') hide();
  }

  const poll = setInterval(() => {
    const client = ctx.getNetClient();
    if (client && client !== attached) {
      detach();
      attach(client);
    }
  }, 1000);

  singleton = {
    banner,
    dispose() {
      clearInterval(poll);
      detach();
      banner.remove();
      style.remove();
      singleton = null;
    },
  };
  return {};
}
