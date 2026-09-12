/* Stickman Tower — unified input: touch, keyboard, gamepad.
 *
 * Every source funnels into the same action set, so an iPhone with a paired
 * Bluetooth keyboard behaves exactly like a laptop.
 */
(function (root) {
  'use strict';

  const U = root.ST.U;

  const ACTIONS = ['left', 'right', 'up', 'down', 'p1', 'p2', 'kick', 'block', 'potion', 'pause'];

  const DEFAULT_KEYS = {
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    up: ['ArrowUp', 'KeyW', 'Space'],
    down: ['ArrowDown', 'KeyS'],
    p1: ['KeyJ', 'KeyZ'],
    p2: ['KeyK', 'KeyX'],
    kick: ['KeyL', 'KeyC'],
    block: ['ShiftLeft', 'ShiftRight', 'KeyB'],
    potion: ['KeyQ', 'KeyE'],
    pause: ['Escape', 'KeyP', 'Enter'],
  };

  // Standard gamepad mapping (Xbox/PS/MFi all report "standard").
  const PAD_BUTTONS = {
    0: 'p1',    // A / Cross
    2: 'p2',    // X / Square
    1: 'kick',  // B / Circle
    3: 'kick',  // Y / Triangle
    4: 'block', // L1
    5: 'block', // R1
    6: 'potion',// L2
    7: 'p2',    // R2
    9: 'pause', // Start
    12: 'up', 13: 'down', 14: 'left', 15: 'right',
  };

  const BUFFER_MS = 520;    // max gap between two inputs of one combo
  const BUFFER_MAX = 12;

  const Input = {
    keys: JSON.parse(JSON.stringify(DEFAULT_KEYS)),
    held: {},
    prev: {},
    edge: {},
    buffer: [],           // [{token:'P1'|'L'|..., t: ms}]
    lastSource: 'keyboard',
    touchActive: false,
    padIndex: null,
    onPause: null,
    listening: null,      // action name while remapping
    onRebind: null,
  };

  ACTIONS.forEach((a) => { Input.held[a] = false; Input.prev[a] = false; Input.edge[a] = false; });

  const keySources = {};   // action -> Set of active sources
  function setFrom(source, action, down) {
    if (!action) return;
    if (!keySources[action]) keySources[action] = new Set();
    if (down) keySources[action].add(source);
    else keySources[action].delete(source);
    Input.held[action] = keySources[action].size > 0;
  }

  function actionForCode(code) {
    for (const a of ACTIONS) {
      if (Input.keys[a] && Input.keys[a].indexOf(code) !== -1) return a;
    }
    return null;
  }

  function pushToken(token) {
    const now = performance.now();
    Input.buffer.push({ token, t: now });
    if (Input.buffer.length > BUFFER_MAX) Input.buffer.shift();
  }

  const TOKEN_FOR = { p1: 'P1', p2: 'P2', kick: 'K', left: 'L', right: 'R', down: 'D', up: 'U' };

  // ------------------------------------------------------------- keyboard
  function onKeyDown(e) {
    if (Input.listening) {
      e.preventDefault();
      const action = Input.listening;
      Input.listening = null;
      if (e.code !== 'Escape') {
        Input.keys[action] = [e.code];
        saveBindings();
      }
      if (Input.onRebind) Input.onRebind(action, e.code);
      return;
    }
    const action = actionForCode(e.code);
    if (!action) return;
    e.preventDefault();
    Input.lastSource = 'keyboard';
    if (!e.repeat) {
      setFrom('key', action, true);
      if (TOKEN_FOR[action]) pushToken(TOKEN_FOR[action]);
      if (action === 'pause' && Input.onPause) Input.onPause();
    }
  }

  function onKeyUp(e) {
    const action = actionForCode(e.code);
    if (!action) return;
    e.preventDefault();
    setFrom('key', action, false);
  }

  // ---------------------------------------------------------------- touch
  const pointerAction = new Map();   // pointerId -> action

  function bindTouch(container) {
    const buttons = Array.prototype.slice.call(container.querySelectorAll('[data-action]'));
    if (!buttons.length) return;

    function hitTest(x, y) {
      for (const b of buttons) {
        if (b.offsetParent === null) continue;
        const r = b.getBoundingClientRect();
        // Generous padding: thumbs are imprecise, especially on a phone.
        const pad = parseFloat(b.dataset.pad || '10');
        if (x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad) return b;
      }
      return null;
    }

    function press(id, btn) {
      const action = btn.dataset.action;
      pointerAction.set(id, action);
      btn.classList.add('is-down');
      Input.lastSource = 'touch';
      Input.touchActive = true;
      setFrom('touch:' + id, action, true);
      if (TOKEN_FOR[action]) pushToken(TOKEN_FOR[action]);
      if (action === 'pause' && Input.onPause) Input.onPause();
      if (root.navigator.vibrate && root.ST.Game && root.ST.Game.settings.haptics) {
        try { root.navigator.vibrate(8); } catch (e) { /* unsupported */ }
      }
    }

    function release(id) {
      const action = pointerAction.get(id);
      if (!action) return;
      pointerAction.delete(id);
      setFrom('touch:' + id, action, false);
      buttons.forEach((b) => {
        if (b.dataset.action === action && !isActionHeldByTouch(action)) b.classList.remove('is-down');
      });
    }

    function isActionHeldByTouch(action) {
      for (const a of pointerAction.values()) if (a === action) return true;
      return false;
    }

    container.addEventListener('pointerdown', (e) => {
      const btn = hitTest(e.clientX, e.clientY);
      if (!btn) return;
      e.preventDefault();
      press(e.pointerId, btn);
    }, { passive: false });

    // Let a thumb slide from one pad button into another (left -> right).
    container.addEventListener('pointermove', (e) => {
      if (!pointerAction.has(e.pointerId)) return;
      const btn = hitTest(e.clientX, e.clientY);
      const current = pointerAction.get(e.pointerId);
      if (btn && btn.dataset.action === current) return;
      if (btn && btn.dataset.slide === 'true') {
        release(e.pointerId);
        press(e.pointerId, btn);
      } else if (!btn) {
        release(e.pointerId);
      }
    }, { passive: false });

    ['pointerup', 'pointercancel', 'pointerleave'].forEach((type) => {
      container.addEventListener(type, (e) => { release(e.pointerId); }, { passive: false });
    });
  }

  // -------------------------------------------------------------- gamepad
  const padPrev = {};
  function pollGamepad() {
    if (!root.navigator.getGamepads) return;
    const pads = root.navigator.getGamepads();
    for (let i = 0; i < pads.length; i++) {
      const pad = pads[i];
      if (!pad || !pad.connected) continue;
      Input.padIndex = i;
      const state = {};
      for (const idx in PAD_BUTTONS) {
        const b = pad.buttons[idx];
        if (b && b.pressed) state[PAD_BUTTONS[idx]] = true;
      }
      const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
      if (ax < -0.4) state.left = true;
      if (ax > 0.4) state.right = true;
      if (ay < -0.5) state.up = true;
      if (ay > 0.4) state.down = true;

      ACTIONS.forEach((a) => {
        const down = !!state[a];
        if (down !== !!padPrev[a]) {
          setFrom('pad', a, down);
          if (down) {
            Input.lastSource = 'gamepad';
            if (TOKEN_FOR[a]) pushToken(TOKEN_FOR[a]);
            if (a === 'pause' && Input.onPause) Input.onPause();
          }
        }
        padPrev[a] = down;
      });
      return; // first connected pad wins
    }
  }

  // ----------------------------------------------------------------- API
  Input.init = function (touchContainer) {
    loadBindings();
    root.addEventListener('keydown', onKeyDown, { passive: false });
    root.addEventListener('keyup', onKeyUp, { passive: false });
    root.addEventListener('blur', Input.releaseAll);
    if (touchContainer) bindTouch(touchContainer);
    root.addEventListener('gamepadconnected', () => { Input.lastSource = 'gamepad'; });
  };

  Input.releaseAll = function () {
    ACTIONS.forEach((a) => { Input.held[a] = false; });
    for (const k in keySources) keySources[k].clear();
    pointerAction.clear();
  };

  /* Call once per rendered frame: refreshes edges + gamepad. */
  Input.update = function () {
    pollGamepad();
    ACTIONS.forEach((a) => {
      Input.edge[a] = Input.held[a] && !Input.prev[a];
      Input.prev[a] = Input.held[a];
    });
    const cutoff = performance.now() - 4000;
    while (Input.buffer.length && Input.buffer[0].t < cutoff) Input.buffer.shift();
  };

  Input.pressed = (a) => !!Input.edge[a];
  Input.down = (a) => !!Input.held[a];

  /* Tokens newest-last, converted to facing-relative F/B and gap-filtered. */
  Input.recentTokens = function (facing) {
    const out = [];
    const now = performance.now();
    let lastT = now;
    for (let i = Input.buffer.length - 1; i >= 0; i--) {
      const entry = Input.buffer[i];
      if (lastT - entry.t > BUFFER_MS) break;
      lastT = entry.t;
      let tok = entry.token;
      if (tok === 'L') tok = facing > 0 ? 'B' : 'F';
      else if (tok === 'R') tok = facing > 0 ? 'F' : 'B';
      out.unshift(tok);
    }
    return out;
  };

  Input.clearBuffer = function () { Input.buffer.length = 0; };

  Input.bindingLabel = function (action) {
    const codes = Input.keys[action] || [];
    const seen = [];
    codes.map(prettyCode).forEach((label) => {
      if (label && seen.indexOf(label) === -1) seen.push(label);   // ShiftLeft/ShiftRight both read "SHIFT"
    });
    return seen.join(' / ') || '—';
  };

  function prettyCode(code) {
    if (!code) return '—';
    if (code.indexOf('Key') === 0) return code.slice(3);
    if (code.indexOf('Digit') === 0) return code.slice(5);
    if (code.indexOf('Arrow') === 0) return { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' }[code];
    if (code === 'Space') return 'SPACE';
    if (code === 'ShiftLeft' || code === 'ShiftRight') return 'SHIFT';
    if (code === 'Escape') return 'ESC';
    return code.toUpperCase();
  }
  Input.prettyCode = prettyCode;

  Input.listenFor = function (action, cb) {
    Input.listening = action;
    Input.onRebind = cb;
  };

  Input.resetBindings = function () {
    Input.keys = JSON.parse(JSON.stringify(DEFAULT_KEYS));
    saveBindings();
  };

  function saveBindings() { U.storage.write('st.keys.v1', Input.keys); }
  function loadBindings() {
    const saved = U.storage.read('st.keys.v1', null);
    if (saved) {
      ACTIONS.forEach((a) => { if (saved[a] && saved[a].length) Input.keys[a] = saved[a]; });
    }
  }

  Input.ACTIONS = ACTIONS;
  root.ST.Input = Input;
})(window);
