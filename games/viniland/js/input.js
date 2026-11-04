// Eingabe für bis zu 2 Spieler: Tastatur (2 Belegungen), Maus (P1), Gamepads (Standard-Mapping).
// Jeder Spieler bekommt pro Frame ein Intent-Objekt: { moveX, moveY, lookX, lookY, sprint, jump, jumpPressed, chopPressed, wavePressed, zoom, menuPressed }

const KEYMAPS = [
  { // Spieler 1
    up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
    jump: ['Space'], sprint: ['ShiftLeft'], chop: ['KeyF'], wave: ['KeyG'],
    camL: ['KeyQ'], camR: ['KeyE'], camU: ['KeyR'], camD: ['KeyV'], zoomIn: ['KeyX'], zoomOut: ['KeyZ', 'KeyY'],
  },
  { // Spieler 2
    up: ['ArrowUp', 'KeyI'], down: ['ArrowDown', 'KeyK'], left: ['ArrowLeft', 'KeyJ'], right: ['ArrowRight', 'KeyL'],
    jump: ['Enter', 'Numpad0', 'KeyH'], sprint: ['ShiftRight', 'KeyN'], chop: ['ControlRight', 'KeyP', 'NumpadDecimal'], wave: ['BracketLeft', 'Numpad5'],
    camL: ['KeyU', 'Delete', 'Numpad4'], camR: ['KeyO', 'PageDown', 'Numpad6'], camU: ['Numpad8', 'Digit9'], camD: ['Numpad2', 'Digit0'],
    zoomIn: ['NumpadAdd', 'Period'], zoomOut: ['NumpadSubtract', 'Comma'],
  },
];
export const KEY_HELP = [
  'P1: WASD laufen · Leertaste springen · L-Shift sprinten · F / Linksklick hacken · G winken · Q/E bzw. Maus ziehen = Kamera · R/V neigen · Z/X Zoom',
  'P2: Pfeile/IJKL laufen · Enter/H springen · R-Shift/N sprinten · R-Strg/P hacken · U/O Kamera · Komma/Punkt Zoom',
];

const DEAD = 0.16;
function stick(x, y) {
  const m = Math.hypot(x, y);
  if (m < DEAD) return [0, 0];
  const k = Math.min(1, (m - DEAD) / (1 - DEAD)) / m;
  return [x * k, y * k];
}

export class Input {
  constructor(dom) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { dx: 0, dy: 0, down: false, chop: false, wheel: 0 };
    this.swapPads = false;
    this.prevPad = [{}, {}];
    this.lastDevice = ['Tastatur', 'Tastatur'];
    addEventListener('keydown', e => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    dom.addEventListener('contextmenu', e => e.preventDefault());
    dom.addEventListener('pointerdown', e => {
      if (e.button === 0) this.mouse.chop = true;
      if (e.button === 2 || e.button === 1) this.mouse.down = true;
    });
    addEventListener('pointerup', () => { this.mouse.down = false; });
    dom.addEventListener('pointermove', e => {
      // Rechte Maustaste halten (oder Pointer-Lock) = Kamera P1
      if (this.mouse.down || document.pointerLockElement === dom) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; }
    });
    dom.addEventListener('wheel', e => { this.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    dom.addEventListener('dblclick', () => dom.requestPointerLock?.());
  }

  any(list) { return list.some(k => this.keys.has(k)); }
  anyPressed(list) { return list.some(k => this.pressed.has(k)); }

  pads() {
    const raw = navigator.getGamepads ? [...navigator.getGamepads()].filter(p => p && p.connected) : [];
    return this.swapPads ? raw.slice().reverse() : raw;
  }

  /** Liest den Zustand für Spieler i (0/1). Einmal pro Frame pro Spieler aufrufen, danach endFrame(). */
  read(i, dt) {
    const km = KEYMAPS[i];
    const o = { moveX: 0, moveY: 0, lookX: 0, lookY: 0, sprint: false, jump: false, jumpPressed: false, chopPressed: false, wavePressed: false, zoom: 0, menuPressed: false };
    // Tastatur
    o.moveX = (this.any(km.right) ? 1 : 0) - (this.any(km.left) ? 1 : 0);
    o.moveY = (this.any(km.up) ? 1 : 0) - (this.any(km.down) ? 1 : 0);
    const kl = Math.hypot(o.moveX, o.moveY); if (kl > 1) { o.moveX /= kl; o.moveY /= kl; }
    o.lookX = ((this.any(km.camR) ? 1 : 0) - (this.any(km.camL) ? 1 : 0)) * 2.4;
    o.lookY = ((this.any(km.camD) ? 1 : 0) - (this.any(km.camU) ? 1 : 0)) * 1.4;
    o.zoom = ((this.any(km.zoomOut) ? 1 : 0) - (this.any(km.zoomIn) ? 1 : 0)) * 6 * dt;
    o.sprint = this.any(km.sprint);
    o.jump = this.any(km.jump);
    o.jumpPressed = this.anyPressed(km.jump);
    o.chopPressed = this.anyPressed(km.chop);
    o.wavePressed = this.anyPressed(km.wave);
    if (kl > 0 || o.jumpPressed) this.lastDevice[i] = 'Tastatur';
    if (i === 0) {
      o.menuPressed = this.pressed.has('Escape') || this.pressed.has('Tab');
      // Maus liefert Pixel/Frame -> in Rate (rad/s) umrechnen, damit Kamera einheitlich lookX*dt rechnet
      if (dt > 0) { o.lookX += this.mouse.dx * 0.0025 / dt; o.lookY += this.mouse.dy * 0.0018 / dt; }
      o.zoom += this.mouse.wheel * 0.8;
      if (this.mouse.chop) { o.chopPressed = true; this.lastDevice[0] = 'Maus'; }
    }
    // Gamepad
    const pad = this.pads()[i];
    if (pad) {
      const b = n => pad.buttons[n] && (pad.buttons[n].pressed || pad.buttons[n].value > 0.5);
      const prev = this.prevPad[i];
      const edge = n => b(n) && !prev[n];
      const [lx, ly] = stick(pad.axes[0] || 0, pad.axes[1] || 0);
      const [rx, ry] = stick(pad.axes[2] || 0, pad.axes[3] || 0);
      if (Math.abs(lx) + Math.abs(ly) > 0) { o.moveX = lx; o.moveY = -ly; this.lastDevice[i] = 'Gamepad'; }
      // Kurve für feine Kamerasteuerung
      o.lookX += Math.sign(rx) * rx * rx * 3.2;
      o.lookY += Math.sign(ry) * ry * ry * 1.9;
      if (b(0)) o.jump = true;
      if (edge(0)) { o.jumpPressed = true; this.lastDevice[i] = 'Gamepad'; }
      if (b(10) || b(4) || b(6)) o.sprint = true;           // L3, LB, LT
      if (edge(2) || edge(7) || edge(5)) o.chopPressed = true; // X, RT, RB
      if (edge(3)) o.wavePressed = true;                       // Y
      if (b(12)) o.zoom -= 6 * dt; if (b(13)) o.zoom += 6 * dt; // D-Pad hoch/runter
      if (edge(9)) o.menuPressed = true;                       // Start
      for (let n = 0; n < pad.buttons.length; n++) prev[n] = b(n);
      o.padRumble = pad.vibrationActuator || null;
    }
    return o;
  }

  endFrame() {
    this.pressed.clear();
    this.mouse.dx = this.mouse.dy = 0;
    this.mouse.chop = false;
    this.mouse.wheel = 0;
  }

  rumble(i, strength = 0.5, ms = 80) {
    const pad = this.pads()[i];
    try { pad?.vibrationActuator?.playEffect('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.6 }); } catch (e) { /* egal */ }
  }
}
