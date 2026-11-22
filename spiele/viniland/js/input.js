// Eingabe für bis zu 2 Spieler: Tastatur (2 Belegungen), Maus (P1), Gamepads (Standard-Mapping).
// Jeder Spieler bekommt pro Frame ein Intent-Objekt:
//   Bewegung: moveX, moveY, lookX, lookY (rad/s), sprint, jump, jumpPressed, zoom (Delta), zoomStep (-1|0|1)
//   Kampf:    chopPressed (= lightPressed, leichter Angriff), heavy (gehalten), heavyPressed, artPressed (Waffenkunst),
//             rollPressed, spell1Pressed, spell2Pressed, flaskPressed, lockPressed, lock (gehalten), switchTarget (-1|0|1)
//   Sonst:    interactPressed, inventoryPressed, menuPressed, wavePressed, autoRunPressed
//   UI:       uiUp, uiDown, uiLeft, uiRight, uiConfirm, uiBack, uiTabL, uiTabR (alles Flanken)
// Optionen (OPTIONS): sprintToggle, autoRun, invertX, invertY, camSens (Maus/Tastatur), padSens (Gamepad), rumble.
import { OPTIONS } from './options.js';

export const KEYMAPS = [
  { // Spieler 1 (linke Tastaturhälfte + Maus)
    up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
    jump: ['Space'], sprint: ['ShiftLeft'], roll: ['KeyC', 'AltLeft'],
    light: ['KeyF'], heavy: ['KeyR'], art: ['KeyV'],
    spell1: ['Digit1'], spell2: ['Digit2'], flask: ['Digit3', 'KeyX'], lock: ['KeyT'],
    interact: ['KeyG'], inventory: ['Tab', 'KeyB'], menu: ['Escape'], wave: ['Backquote', 'Digit5'], autorun: ['Digit4'],
    camL: ['KeyQ'], camR: ['KeyE'], camU: [], camD: [], zoomIn: ['Equal'], zoomOut: ['KeyZ', 'Minus'],
    uiConfirm: ['Space', 'KeyF'], uiBack: ['KeyC', 'Escape'], uiTabL: ['KeyQ'], uiTabR: ['KeyE'],
  },
  { // Spieler 2 (rechte Tastaturhälfte / Ziffernblock)
    up: ['ArrowUp', 'KeyI'], down: ['ArrowDown', 'KeyK'], left: ['ArrowLeft', 'KeyJ'], right: ['ArrowRight', 'KeyL'],
    jump: ['Enter', 'Numpad0', 'KeyH'], sprint: ['ShiftRight', 'KeyN'], roll: ['KeyM', 'Numpad1', 'Slash'],
    light: ['KeyP', 'ControlRight', 'NumpadDecimal'], heavy: ['BracketLeft', 'Numpad5'], art: ['Quote', 'NumpadEnter'],
    spell1: ['Digit7', 'Numpad7'], spell2: ['Digit8', 'Numpad9'], flask: ['Digit9', 'NumpadMultiply'], lock: ['Semicolon', 'Numpad3'],
    interact: ['Digit0', 'NumpadDivide'], inventory: ['Backspace', 'Home'], menu: ['End'], wave: ['Backslash'], autorun: ['BracketRight'],
    camL: ['KeyU', 'Delete', 'Numpad4'], camR: ['KeyO', 'PageDown', 'Numpad6'], camU: ['Numpad8'], camD: ['Numpad2'],
    zoomIn: ['NumpadAdd', 'Period'], zoomOut: ['NumpadSubtract', 'Comma'],
    uiConfirm: ['Enter', 'KeyH', 'KeyP', 'Numpad0'], uiBack: ['KeyM', 'Backspace', 'Numpad1'], uiTabL: ['KeyU', 'Numpad4'], uiTabR: ['KeyO', 'Numpad6'],
  },
];
export const KEY_HELP = [
  'P1: WASD laufen · Leertaste springen · L-Shift sprinten · C rollen · F / Linksklick leicht · R schwer (halten = aufladen) · V Waffenkunst · 1 / 2 Zauber · 3 / X Glutflakon · G interagieren · Tab/B Inventar · T / Mittelklick Ziel fixieren (Q/E wechseln) · Q/E bzw. rechte Maus = Kamera · Mausrad / Z = Zoom · 4 Auto-Laufen · Esc Menü',
  'P2: Pfeile/IJKL laufen · Enter/H springen · R-Shift/N sprinten · M rollen · P / R-Strg leicht · Ü schwer · Ä Waffenkunst · 7 / 8 Zauber · 9 Glutflakon · 0 interagieren · Rücktaste Inventar · Ö Ziel fixieren (U/O wechseln) · U/O Kamera · Komma/Punkt Zoom · + Auto-Laufen · Ende Menü',
];
export const PAD_HELP = 'Gamepad: Stick L laufen · A springen · B rollen (halten = sprinten) · L3 sprinten · RB leicht · RT schwer (halten = aufladen) · LT Waffenkunst · LB Zauber 1 · Y Zauber 2 · X Glutflakon · R3 Ziel fixieren (Stick R antippen = wechseln) · ↑ interagieren · ↓ Zoom · ← winken · → Auto-Laufen · View Inventar · Start Menü · Menüs: Stick/D-Pad, A ok, B zurück, LB/RB Reiter';

const DEAD = 0.16;
function stick(x, y) {
  const m = Math.hypot(x, y);
  if (m < DEAD) return [0, 0];
  const k = Math.min(1, (m - DEAD) / (1 - DEAD)) / m;
  return [x * k, y * k];
}
const opt = (k, d) => (OPTIONS && OPTIONS[k] !== undefined ? OPTIONS[k] : d);

export class Input {
  constructor(dom) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { dx: 0, dy: 0, down: false, chop: false, lock: false, mdown: false, heavy: false, art: false, wheel: 0 };
    this.flickArmed = [true, true];
    this.navArmed = [true, true];
    this.padMode = 'auto';      // auto | p1 | p2  (wem gehört Gamepad 1)
    this.players = 2;
    this.keyboardFor = [true, true]; // Tastatur pro Spieler an/aus (z. B. wenn Steam Tasten emuliert)
    this.prevPad = [{}, {}];
    this.lastDevice = ['Tastatur', 'Tastatur'];
    this.sprintOn = [false, false];   // sprintToggle-Zustand
    this.autoFwd = [false, false];    // Auto-Laufen aktiv
    this.idleT = [0, 0];
    this.bHold = [0, 0];              // Gamepad-B gehalten (s) → Sprint
    addEventListener('keydown', e => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Quote', 'Slash', 'Backspace', 'AltLeft'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    dom.addEventListener('contextmenu', e => e.preventDefault());
    dom.addEventListener('pointerdown', e => {
      if (e.button === 0) this.mouse.chop = true;
      if (e.button === 2) this.mouse.down = true;
      if (e.button === 1) { this.mouse.lock = true; this.mouse.mdown = true; e.preventDefault(); }
      if (e.button === 3) this.mouse.heavy = true;     // Maus-Seitentasten: hinten = schwer, vorne = Waffenkunst
      if (e.button === 4) this.mouse.art = true;
    });
    addEventListener('pointerup', e => { if (e.button === 2) this.mouse.down = false; if (e.button === 1) this.mouse.mdown = false; if (e.button === 3) this.mouse.heavyUp = true; });
    dom.addEventListener('pointermove', e => {
      // Rechte Maustaste halten (oder Pointer-Lock) = Kamera P1
      if (this.mouse.down || document.pointerLockElement === dom) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; }
    });
    dom.addEventListener('wheel', e => { this.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    dom.addEventListener('dblclick', () => dom.requestPointerLock?.());
  }

  any(list) { return list.some(k => this.keys.has(k)); }
  anyPressed(list) { return list.some(k => this.pressed.has(k)); }

  rawPads() { return navigator.getGamepads ? [...navigator.getGamepads()].filter(p => p && p.connected) : []; }
  /** Gamepad für Spieler i. auto: bei 2 Spielern und nur 1 Gamepad bekommt Spieler 2 das Pad (Tastatur = P1). */
  padFor(i) {
    const raw = this.rawPads();
    let mode = this.padMode;
    if (mode === 'auto') mode = (this.players === 2 && raw.length === 1) ? 'p2' : 'p1';
    if (this.players === 1) return i === 0 ? raw[0] : null;
    if (mode === 'p2') return i === 1 ? raw[0] : raw[1];
    return raw[i];
  }
  padOwner(n) { for (let i = 0; i < 2; i++) { const p = this.padFor(i); if (p && p === this.rawPads()[n]) return i; } return -1; }

  /** Liest den Zustand für Spieler i (0/1). Einmal pro Frame pro Spieler aufrufen, danach endFrame(). */
  read(i, dt) {
    const km = KEYMAPS[i];
    const o = { moveX: 0, moveY: 0, lookX: 0, lookY: 0, sprint: false, jump: false, jumpPressed: false, chopPressed: false, wavePressed: false,
      zoom: 0, zoomStep: 0, menuPressed: false, rollPressed: false, spell1Pressed: false, spell2Pressed: false, lockPressed: false, lock: false, switchTarget: 0,
      heavy: false, heavyPressed: false, artPressed: false, flaskPressed: false, interactPressed: false, inventoryPressed: false, autoRunPressed: false,
      uiUp: false, uiDown: false, uiLeft: false, uiRight: false, uiConfirm: false, uiBack: false, uiTabL: false, uiTabR: false };
    let sprintPressed = false;
    const camS = opt('camSens', 1) * (OPTIONS?.camSensX ?? 1), padS = opt('padSens', 1);
    // Tastatur
    if (this.keyboardFor[i]) {
      const P = l => this.anyPressed(l), H = l => this.any(l);
      o.moveX = (H(km.right) ? 1 : 0) - (H(km.left) ? 1 : 0);
      o.moveY = (H(km.up) ? 1 : 0) - (H(km.down) ? 1 : 0);
      const kl = Math.hypot(o.moveX, o.moveY); if (kl > 1) { o.moveX /= kl; o.moveY /= kl; }
      o.lookX = ((H(km.camR) ? 1 : 0) - (H(km.camL) ? 1 : 0)) * 2.4 * camS;
      o.lookY = ((H(km.camD) ? 1 : 0) - (H(km.camU) ? 1 : 0)) * 1.4 * camS;
      o.zoom = ((H(km.zoomOut) ? 1 : 0) - (H(km.zoomIn) ? 1 : 0)) * 6 * dt;
      o.sprint = H(km.sprint); sprintPressed = P(km.sprint);
      o.jump = H(km.jump); o.jumpPressed = P(km.jump);
      o.chopPressed = P(km.light);
      o.heavy = H(km.heavy); o.heavyPressed = P(km.heavy);
      o.artPressed = P(km.art);
      o.wavePressed = P(km.wave);
      o.rollPressed = P(km.roll);
      o.spell1Pressed = P(km.spell1); o.spell2Pressed = P(km.spell2);
      o.flaskPressed = P(km.flask);
      o.lockPressed = P(km.lock); o.lock = H(km.lock);
      o.interactPressed = P(km.interact); o.inventoryPressed = P(km.inventory); o.menuPressed = P(km.menu);
      o.autoRunPressed = P(km.autorun);
      o.switchTarget = (P(km.camR) ? 1 : 0) - (P(km.camL) ? 1 : 0);
      o.uiUp = P(km.up); o.uiDown = P(km.down); o.uiLeft = P(km.left); o.uiRight = P(km.right);
      o.uiConfirm = P(km.uiConfirm); o.uiBack = P(km.uiBack); o.uiTabL = P(km.uiTabL); o.uiTabR = P(km.uiTabR);
      if (kl > 0 || o.jumpPressed || o.chopPressed) this.lastDevice[i] = 'Tastatur';
    }
    if (i === 0 && this.keyboardFor[0]) {
      // Maus liefert Pixel/Frame -> in Rate (rad/s) umrechnen, damit Kamera einheitlich lookX*dt rechnet
      if (dt > 0) { o.lookX += this.mouse.dx * 0.0025 * camS / dt; o.lookY += this.mouse.dy * 0.0018 * camS * (OPTIONS?.camSensY ?? 1) / dt; }
      o.zoom += this.mouse.wheel * 0.8;
      if (this.mouse.chop) { o.chopPressed = true; this.lastDevice[0] = 'Maus'; }
      if (this.mouse.lock) o.lockPressed = true;
      if (this.mouse.mdown) o.lock = true;
      if (this.mouse.heavy) o.heavyPressed = true;
      if (this.mouse.art) o.artPressed = true;
      if (Math.abs(this.mouse.dx) > 45) o.switchTarget = Math.sign(this.mouse.dx);   // Maus-Wisch = Ziel wechseln
    }
    // Gamepad
    const pad = this.padFor(i);
    if (pad) {
      const b = n => pad.buttons[n] && (pad.buttons[n].pressed || pad.buttons[n].value > 0.5);
      const prev = this.prevPad[i];
      const edge = n => b(n) && !prev[n];
      const [lx, ly] = stick(pad.axes[0] || 0, pad.axes[1] || 0);
      const [rx, ry] = stick(pad.axes[2] || 0, pad.axes[3] || 0);
      if (Math.abs(lx) + Math.abs(ly) > 0) { o.moveX = lx; o.moveY = -ly; this.lastDevice[i] = 'Gamepad'; }
      // Kurve für feine Kamerasteuerung
      o.lookX += Math.sign(rx) * rx * rx * 3.2 * padS;
      o.lookY += Math.sign(ry) * ry * ry * 1.9 * padS;
      if (b(0)) o.jump = true;
      if (edge(0)) { o.jumpPressed = true; o.uiConfirm = true; }
      if (edge(1)) { o.rollPressed = true; o.uiBack = true; }                // B rollen
      this.bHold[i] = b(1) ? this.bHold[i] + dt : 0;
      if (this.bHold[i] > 0.3) o.sprint = true;                               // B halten = sprinten
      if (b(10)) o.sprint = true; if (edge(10)) sprintPressed = true;          // L3
      if (edge(5)) { o.chopPressed = true; o.uiTabR = true; }                 // RB leicht
      if (b(7)) o.heavy = true; if (edge(7)) o.heavyPressed = true;           // RT schwer (halten = aufladen)
      if (edge(6)) o.artPressed = true;                                       // LT Waffenkunst
      if (edge(4)) { o.spell1Pressed = true; o.uiTabL = true; }               // LB Zauber 1
      if (edge(3)) o.spell2Pressed = true;                                    // Y Zauber 2
      if (edge(2)) o.flaskPressed = true;                                     // X Glutflakon
      if (b(11)) o.lock = true; if (edge(11)) o.lockPressed = true;           // R3
      if (edge(12)) { o.interactPressed = true; o.uiUp = true; }              // D-Pad ↑
      if (edge(13)) { o.zoomStep = 1; o.uiDown = true; }                      // D-Pad ↓
      if (edge(14)) { o.wavePressed = true; o.uiLeft = true; }                // D-Pad ←
      if (edge(15)) { o.autoRunPressed = true; o.uiRight = true; }            // D-Pad →
      if (edge(8)) o.inventoryPressed = true;                                 // View/Back
      if (edge(9)) o.menuPressed = true;                                      // Start
      // Linker Stick als UI-Navigation (Flanke)
      const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
      if (this.navArmed[i] && Math.max(Math.abs(ax), Math.abs(ay)) > 0.65) {
        this.navArmed[i] = false;
        if (Math.abs(ax) > Math.abs(ay)) { if (ax > 0) o.uiRight = true; else o.uiLeft = true; } else { if (ay > 0) o.uiDown = true; else o.uiUp = true; }
      } else if (Math.max(Math.abs(ax), Math.abs(ay)) < 0.3) this.navArmed[i] = true;
      // Rechter Stick antippen = Ziel wechseln (im Lock-On)
      const rawRx = pad.axes[2] || 0;
      if (this.flickArmed[i] && Math.abs(rawRx) > 0.75) { o.switchTarget = Math.sign(rawRx); this.flickArmed[i] = false; }
      else if (Math.abs(rawRx) < 0.35) this.flickArmed[i] = true;
      for (const n of [1, 2, 3, 4, 5, 6, 7]) if (edge(n)) this.lastDevice[i] = 'Gamepad';
      for (let n = 0; n < pad.buttons.length; n++) prev[n] = b(n);
      o.padRumble = pad.vibrationActuator || null;
    }
    // --- QoL ---
    if (opt('invertX', false)) o.lookX = -o.lookX;
    if (opt('invertY', false)) o.lookY = -o.lookY;
    const mag = Math.hypot(o.moveX, o.moveY);
    if (opt('sprintToggle', false)) {
      if (sprintPressed) this.sprintOn[i] = !this.sprintOn[i];
      this.idleT[i] = mag < 0.2 ? this.idleT[i] + dt : 0;
      if (this.idleT[i] > 0.35) this.sprintOn[i] = false;
      o.sprint = this.sprintOn[i] || (this.bHold[i] > 0.3);
    }
    // Auto-Laufen: Taste schaltet um, läuft geradeaus (Kamera-vorwärts) bis Stick/Taste zurück
    if (opt('autoRun', false)) {
      if (o.autoRunPressed) this.autoFwd[i] = !this.autoFwd[i];
      if (this.autoFwd[i]) {
        if (o.moveY < -0.3) this.autoFwd[i] = false;
        else { o.moveY = 1; const l = Math.hypot(o.moveX, o.moveY); o.moveX /= l; o.moveY /= l; }
      }
    } else this.autoFwd[i] = false;
    o.lightPressed = o.chopPressed;
    return o;
  }

  endFrame() {
    this.pressed.clear();
    this.mouse.dx = this.mouse.dy = 0;
    this.mouse.chop = false; this.mouse.lock = false; this.mouse.heavy = false; this.mouse.art = false;
    this.mouse.wheel = 0;
  }

  rumble(i, strength = 0.5, ms = 80) {
    if (opt('rumble', true) === false) return;
    const pad = this.padFor(i);
    try { pad?.vibrationActuator?.playEffect('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.6 }); } catch (e) { /* egal */ }
  }
}
