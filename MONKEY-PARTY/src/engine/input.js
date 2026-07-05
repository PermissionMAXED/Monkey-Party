/**
 * Local input system for MONKEY-PARTY: up to 4 local seats, each bound to a
 * device. getFrame(seat) always returns a well-formed InputFrame
 * ({ move:{x,y}, a, b, aim? } - see shared/types.js).
 *
 * Seat/device map
 * ---------------
 * Seats: 0..3 (MAX_LOCAL_SEATS). Default bindings (unless overridden by the
 * settings store `seatBindings` or bindSeat()):
 *   seat 0 -> kb1, seat 1 -> kb2, seat 2 -> kb3, seat 3 -> gamepad0
 *
 * Devices:
 *   kb1        WASD move, F = a, G = b
 *   kb2        Arrow keys move, K = a, L = b
 *   kb3        I/J/K/L move (I up, J left, K down, L right), H = a, N = b
 *              (kb* defaults can be overridden per action through the
 *              settings store `keyBindings`, e.g. { kb1: { a: 'Space' } };
 *              overrides merge over KB_MAPS at frame-read time and update
 *              live on store changes)
 *   gamepad0-3 Gamepad API (polled every getFrame): left stick + d-pad move,
 *              button 0 (A/cross) = a, button 1 (B/circle) = b,
 *              right stick = aim.
 *   touch      Virtual joystick (left half) + A/B buttons (right half),
 *              lazily rendered into #ui-root (or <body>) on first bind.
 *
 * Move convention: y = +1 is up/forward (W, ArrowUp, stick pushed up).
 * Deadzone: radial 0.15, rescaled so output still reaches magnitude 1.
 */

const MAX_LOCAL_SEATS = 4;
const DEADZONE = 0.15;

const KB_MAPS = {
  kb1: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', a: 'KeyF', b: 'KeyG' },
  kb2: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', a: 'KeyK', b: 'KeyL' },
  kb3: { up: 'KeyI', down: 'KeyK', left: 'KeyJ', right: 'KeyL', a: 'KeyH', b: 'KeyN' },
};

/** Read-only default keyboard maps (settings UI shows/rebinds against these). */
export const KB_DEFAULT_MAPS = Object.freeze({
  kb1: Object.freeze({ ...KB_MAPS.kb1 }),
  kb2: Object.freeze({ ...KB_MAPS.kb2 }),
  kb3: Object.freeze({ ...KB_MAPS.kb3 }),
});

const DEFAULT_BINDINGS = { 0: 'kb1', 1: 'kb2', 2: 'kb3', 3: 'gamepad0' };

function neutralFrame() {
  return { move: { x: 0, y: 0 }, a: false, b: false };
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/** Radial deadzone: below DEADZONE -> 0, above rescaled to [0,1]. */
function applyDeadzone(x, y) {
  const magnitude = Math.hypot(x, y);
  if (magnitude < DEADZONE) return { x: 0, y: 0 };
  const scaled = Math.min(1, (magnitude - DEADZONE) / (1 - DEADZONE));
  return { x: (x / magnitude) * scaled, y: (y / magnitude) * scaled };
}

/** Pick only well-formed per-device key overrides ({kb1:{up:'KeyW',...}}). */
function readKeyOverrides(settings) {
  const raw = settings?.keyBindings;
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const device of Object.keys(KB_MAPS)) {
    const map = raw[device];
    if (!map || typeof map !== 'object') continue;
    const clean = {};
    for (const action of Object.keys(KB_MAPS[device])) {
      if (typeof map[action] === 'string' && map[action]) clean[action] = map[action];
    }
    if (Object.keys(clean).length > 0) out[device] = clean;
  }
  return out;
}

/**
 * @param {{ get: () => Object, set: (patch: Object) => Object, subscribe?: (cb: Function) => Function }} [settingsStore]
 *   Optional settings store; seat bindings are read from and persisted to its
 *   `seatBindings` value, and per-device key overrides come from its
 *   `keyBindings` value (kept live via subscribe).
 * @returns {{
 *   getFrame: (seat: number) => import('#shared/types.js').InputFrame,
 *   bindSeat: (seat: number, deviceId: string) => void,
 *   devices: () => Array<{id: string, type: string, connected: boolean, label: string}>,
 *   onDeviceChange: (cb: Function) => () => void,
 *   bindings: () => Object<number, string>,
 *   dispose: () => void,
 * }}
 */
export function createInput(settingsStore = null) {
  const hasDom = typeof window !== 'undefined' && typeof document !== 'undefined';

  /** @type {Object<number, string>} seat -> deviceId */
  const bindings = { ...DEFAULT_BINDINGS };
  const stored = settingsStore?.get?.()?.seatBindings;
  if (stored && typeof stored === 'object') {
    for (const [seat, deviceId] of Object.entries(stored)) {
      const idx = Number(seat);
      if (idx >= 0 && idx < MAX_LOCAL_SEATS && typeof deviceId === 'string') bindings[idx] = deviceId;
    }
  }

  /* Per-device key overrides, merged over KB_MAPS at frame-read time and
     kept live by subscribing to the settings store. */
  let keyOverrides = readKeyOverrides(settingsStore?.get?.());
  const unsubscribeSettings = settingsStore?.subscribe?.((s) => {
    keyOverrides = readKeyOverrides(s);
  }) ?? null;

  /** Effective key map for a keyboard device (defaults + user overrides). */
  function keyMapFor(deviceId) {
    const overrides = keyOverrides[deviceId];
    return overrides ? { ...KB_MAPS[deviceId], ...overrides } : KB_MAPS[deviceId];
  }

  /* ---------------- keyboard ---------------- */

  const pressed = new Set();
  const onKeyDown = (e) => {
    pressed.add(e.code);
  };
  const onKeyUp = (e) => {
    pressed.delete(e.code);
  };
  const onBlur = () => pressed.clear();
  if (hasDom) {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
  }

  function keyboardFrame(map) {
    const x = (pressed.has(map.right) ? 1 : 0) - (pressed.has(map.left) ? 1 : 0);
    const y = (pressed.has(map.up) ? 1 : 0) - (pressed.has(map.down) ? 1 : 0);
    // Normalize diagonals so keyboard players don't move faster.
    const magnitude = Math.hypot(x, y) || 1;
    return {
      move: { x: x / magnitude, y: y / magnitude },
      a: pressed.has(map.a),
      b: pressed.has(map.b),
    };
  }

  /* ---------------- gamepads ---------------- */

  function gamepadFrame(index) {
    const pads = hasDom && navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads?.[index];
    if (!pad || !pad.connected) return neutralFrame();

    let x = pad.axes[0] ?? 0;
    let y = -(pad.axes[1] ?? 0); // Stick up = forward (+y).

    // D-pad overrides/augments the stick.
    const btn = (i) => Boolean(pad.buttons[i]?.pressed);
    if (btn(12)) y = 1;
    if (btn(13)) y = -1;
    if (btn(14)) x = -1;
    if (btn(15)) x = 1;

    const move = applyDeadzone(clamp(x, -1, 1), clamp(y, -1, 1));
    const frame = { move, a: btn(0), b: btn(1) };

    const aimRaw = applyDeadzone(clamp(pad.axes[2] ?? 0, -1, 1), clamp(-(pad.axes[3] ?? 0), -1, 1));
    if (aimRaw.x !== 0 || aimRaw.y !== 0) frame.aim = aimRaw;
    return frame;
  }

  /* ---------------- touch (lazy virtual controls) ---------------- */

  const touch = {
    built: false,
    root: null,
    stick: { active: false, pointerId: null, cx: 0, cy: 0, x: 0, y: 0 },
    a: false,
    b: false,
  };

  function buildTouchControls() {
    if (touch.built || !hasDom) return;
    touch.built = true;

    const root = document.createElement('div');
    root.id = 'mp-touch-controls';
    root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:40;'
      + '-webkit-user-select:none;user-select:none;touch-action:none;';

    const stickBase = document.createElement('div');
    stickBase.style.cssText = 'position:absolute;left:24px;bottom:24px;width:120px;height:120px;'
      + 'border-radius:50%;background:rgba(255,255,255,0.08);border:2px solid rgba(255,255,255,0.25);'
      + 'pointer-events:auto;touch-action:none;';
    const knob = document.createElement('div');
    knob.style.cssText = 'position:absolute;left:50%;top:50%;width:52px;height:52px;margin:-26px 0 0 -26px;'
      + 'border-radius:50%;background:rgba(255,255,255,0.35);transition:transform 0.05s;';
    stickBase.appendChild(knob);

    function stickMove(e) {
      const rect = stickBase.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const max = rect.width / 2;
      const dx = clamp((e.clientX - cx) / max, -1, 1);
      const dy = clamp((e.clientY - cy) / max, -1, 1);
      touch.stick.x = dx;
      touch.stick.y = -dy; // Screen-down -> forward-negative.
      knob.style.transform = `translate(${dx * max * 0.55}px, ${dy * max * 0.55}px)`;
    }
    stickBase.addEventListener('pointerdown', (e) => {
      touch.stick.active = true;
      touch.stick.pointerId = e.pointerId;
      stickBase.setPointerCapture(e.pointerId);
      stickMove(e);
    });
    stickBase.addEventListener('pointermove', (e) => {
      if (touch.stick.active && e.pointerId === touch.stick.pointerId) stickMove(e);
    });
    const stickEnd = (e) => {
      if (e.pointerId !== touch.stick.pointerId) return;
      touch.stick.active = false;
      touch.stick.x = 0;
      touch.stick.y = 0;
      knob.style.transform = 'translate(0,0)';
    };
    stickBase.addEventListener('pointerup', stickEnd);
    stickBase.addEventListener('pointercancel', stickEnd);

    function makeButton(label, right, bottom, key) {
      const el = document.createElement('div');
      el.textContent = label;
      el.style.cssText = `position:absolute;right:${right}px;bottom:${bottom}px;width:72px;height:72px;`
        + 'border-radius:50%;background:rgba(255,255,255,0.12);border:2px solid rgba(255,255,255,0.3);'
        + 'display:flex;align-items:center;justify-content:center;font:700 24px sans-serif;'
        + 'color:rgba(255,255,255,0.75);pointer-events:auto;touch-action:none;';
      el.addEventListener('pointerdown', (e) => {
        touch[key] = true;
        el.setPointerCapture(e.pointerId);
        el.style.background = 'rgba(255,255,255,0.35)';
      });
      const release = () => {
        touch[key] = false;
        el.style.background = 'rgba(255,255,255,0.12)';
      };
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
      return el;
    }

    root.append(stickBase, makeButton('A', 36, 84, 'a'), makeButton('B', 116, 28, 'b'));
    const container = document.getElementById('ui-root') ?? document.body;
    container.appendChild(root);
    touch.root = root;
  }

  function touchFrame() {
    if (!touch.built) buildTouchControls();
    const move = applyDeadzone(touch.stick.x, touch.stick.y);
    return { move, a: touch.a, b: touch.b };
  }

  /* ---------------- public API ---------------- */

  /**
   * Sample the current input frame for a seat. Always well-formed; unbound
   * seats or disconnected devices yield a neutral frame.
   */
  function getFrame(seat) {
    const deviceId = bindings[seat];
    let frame;
    if (deviceId && KB_MAPS[deviceId]) frame = keyboardFrame(keyMapFor(deviceId));
    else if (deviceId?.startsWith('gamepad')) frame = gamepadFrame(Number(deviceId.slice(7)) || 0);
    else if (deviceId === 'touch') frame = touchFrame();
    else frame = neutralFrame();

    frame.move.x = clamp(Number(frame.move.x) || 0, -1, 1);
    frame.move.y = clamp(Number(frame.move.y) || 0, -1, 1);
    frame.a = Boolean(frame.a);
    frame.b = Boolean(frame.b);
    return frame;
  }

  /** Bind a seat (0..3) to a device id; persists to the settings store. */
  function bindSeat(seat, deviceId) {
    const idx = Number(seat);
    if (!(idx >= 0 && idx < MAX_LOCAL_SEATS)) {
      throw new Error(`[input] seat must be 0..${MAX_LOCAL_SEATS - 1}, got ${seat}`);
    }
    bindings[idx] = String(deviceId);
    if (deviceId === 'touch') buildTouchControls();
    if (settingsStore?.set) {
      const current = settingsStore.get()?.seatBindings ?? {};
      settingsStore.set({ seatBindings: { ...current, [idx]: String(deviceId) } });
    }
    notifyDeviceChange();
  }

  /** Snapshot of every known device and its connection state. */
  function devices() {
    const list = [
      { id: 'kb1', type: 'keyboard', connected: hasDom, label: 'Keyboard WASD + F/G' },
      { id: 'kb2', type: 'keyboard', connected: hasDom, label: 'Keyboard Arrows + K/L' },
      { id: 'kb3', type: 'keyboard', connected: hasDom, label: 'Keyboard IJKL + H/N' },
    ];
    const pads = hasDom && navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < 4; i += 1) {
      const pad = pads?.[i];
      list.push({
        id: `gamepad${i}`,
        type: 'gamepad',
        connected: Boolean(pad?.connected),
        label: pad?.id || `Gamepad ${i + 1}`,
      });
    }
    const touchCapable = hasDom && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window);
    list.push({ id: 'touch', type: 'touch', connected: touchCapable, label: 'Touch controls' });
    return list;
  }

  const deviceListeners = new Set();
  function notifyDeviceChange() {
    const snapshot = devices();
    for (const cb of [...deviceListeners]) {
      try {
        cb(snapshot);
      } catch (err) {
        console.error('[input] device-change listener threw:', err);
      }
    }
  }
  const onPadChange = () => notifyDeviceChange();
  if (hasDom) {
    window.addEventListener('gamepadconnected', onPadChange);
    window.addEventListener('gamepaddisconnected', onPadChange);
  }

  /**
   * Subscribe to device connect/disconnect + binding changes.
   * @returns {() => void} Unsubscribe.
   */
  function onDeviceChange(cb) {
    deviceListeners.add(cb);
    return () => deviceListeners.delete(cb);
  }

  function dispose() {
    if (hasDom) {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('gamepadconnected', onPadChange);
      window.removeEventListener('gamepaddisconnected', onPadChange);
    }
    unsubscribeSettings?.();
    touch.root?.remove();
    deviceListeners.clear();
    pressed.clear();
  }

  return { getFrame, bindSeat, devices, onDeviceChange, bindings: () => ({ ...bindings }), dispose };
}
