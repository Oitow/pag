/**
 * @modul    move-input
 * @zweck    Bewegungs-Eingabe für Figuren: Tastatur (WASD/Pfeile), Maus-Ziehen/Mausrad, Touch-Stick + Knöpfe, Gamepad → Stick, Kamera-Delta, Aktionen (Flanke/gehalten)
 * @api      createMoveInput(opts) -> { lesen(dt?) -> { x, y, sprint, springen, ducken, kameraX, kameraY, zoom, aktiv }, gedrueckt(name), gehalten(name), setAktiv(bool), zeigeTouch(bool), dispose() } ; stickZuWelt(x, y, kameraYaw) -> {x, z} ; STANDARD_AKTIONEN
 * @beispiel
 *   import { createMoveInput, stickZuWelt } from '../../engine/input/move-input.js';
 *   const ein = createMoveInput({ element: renderer.domElement, aktionen: [{ name: 'angriff', tasten: ['KeyF'], knopf: '⚔', padKnopf: 2 }] });
 *   const e = ein.lesen();                       // einmal pro Frame
 *   kamera.drehen(e.kameraX, e.kameraY); kamera.zoomen(e.zoom);
 *   const r = stickZuWelt(e.x, e.y, kamera.blickYaw());
 *   motor.update(dt, { x: r.x, z: r.z, sprint: e.sprint, springen: e.springen, ducken: e.ducken });
 *   if (ein.gedrueckt('angriff')) figur.schlagen();
 * @tags     eingabe, tastatur, maus, touch, gamepad, joystick, figur, steuerung
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { createTouchStick, istTouchGeraet } from './touch-stick.js';

/** Standard-Aktionen (überschreibbar über gleichnamige Einträge in opts.aktionen). */
export const STANDARD_AKTIONEN = [
  { name: 'springen', tasten: ['Space'], padKnopf: 0, knopf: '⤒', titel: 'Springen' },
  { name: 'sprint', tasten: ['ShiftLeft', 'ShiftRight'], padKnopf: 10 },
  { name: 'ducken', tasten: ['KeyC', 'ControlLeft'], padKnopf: 1 },
];

/** Stick (x = rechts, y = vorwärts) → Weltrichtung {x, z}; kameraYaw = Blickrichtung (yaw 0 = +Z, atan2(x, z)). */
export function stickZuWelt(x, y, kameraYaw) {
  const s = Math.sin(kameraYaw), c = Math.cos(kameraYaw);
  return { x: y * s - x * c, z: y * c + x * s };
}

const RICHTUNG = { KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
const BLOCKIEREN = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const PAD_TOT = 0.16;

function totzone(x, y, tot) {
  const m = Math.hypot(x, y);
  if (m < tot) return [0, 0, 0];
  const k = Math.min(1, (m - tot) / (1 - tot));
  return [x / m * k, y / m * k, k];
}
const imEingabefeld = e => {
  const t = e?.target, a = globalThis.document?.activeElement;
  return [t, a].some(n => n && (/^(INPUT|TEXTAREA|SELECT)$/.test(n.tagName || '') || n.isContentEditable === true));
};

export function createMoveInput({
  element = document.body, tastatur = true, touch = 'auto', gamepad = true, aktionen = [], standardAktionen = true,
  stickRadius = 56, invertY = false, empfindlichkeit = 1,
} = {}) {
  // Aktionen zusammenführen: eigene Einträge ersetzen gleichnamige Standard-Aktionen
  const liste = [...(standardAktionen ? STANDARD_AKTIONEN : [])];
  for (const a of aktionen) { const i = liste.findIndex(b => b.name === a.name); if (i >= 0) liste[i] = { ...liste[i], ...a }; else liste.push(a); }
  const tasteZu = new Map();        // code → [namen]
  for (const a of liste) for (const t of a.tasten || []) { if (!tasteZu.has(t)) tasteZu.set(t, []); tasteZu.get(t).push(a.name); }

  const tasten = new Set();
  const touchGehalten = new Set();
  const padGehalten = new Set();
  let flankenNeu = new Set(), flanken = new Set();
  let aktiv = true, geraet = 'tastatur';
  const maus = { id: null, x: 0, y: 0, dx: 0, dy: 0, rad: 0 };
  let padVorher = [], padSprint = false, letzteZeit = -1;

  const loslassen = () => { tasten.clear(); touchGehalten.clear(); padGehalten.clear(); padSprint = false; maus.id = null; ts?.reset(); };

  // ---------- Tastatur ----------
  const keydown = e => {
    if (!aktiv || imEingabefeld(e) || e.ctrlKey && e.code !== 'ControlLeft' || e.metaKey || e.altKey) return;
    if (BLOCKIEREN.has(e.code)) e.preventDefault?.();
    geraet = 'tastatur';
    if (e.repeat || tasten.has(e.code)) return;
    tasten.add(e.code);
    for (const n of tasteZu.get(e.code) || []) flankenNeu.add(n);
  };
  const keyup = e => { tasten.delete(e.code); };
  const blur = () => loslassen();
  const sichtbarkeit = () => { if (globalThis.document?.visibilityState === 'hidden') loslassen(); };
  const fenster = tastatur ? [['keydown', keydown], ['keyup', keyup], ['blur', blur]] : [['blur', blur]];
  for (const [t, f] of fenster) addEventListener(t, f);
  globalThis.document?.addEventListener?.('visibilitychange', sichtbarkeit);

  // ---------- Maus: Links-/Rechtsziehen = Kamera, Rad = Zoom ----------
  const mRunter = e => {
    if (e.pointerType === 'touch' || e.pointerType === 'pen' || !aktiv) return;
    if (e.button !== 0 && e.button !== 2) return;
    maus.id = e.pointerId; maus.x = e.clientX; maus.y = e.clientY; geraet = 'tastatur';
    try { element.setPointerCapture?.(e.pointerId); } catch (_) { /* egal */ }
  };
  const mBewegt = e => {
    if (maus.id === null || e.pointerId !== maus.id) return;
    maus.dx += e.clientX - maus.x; maus.dy += e.clientY - maus.y; maus.x = e.clientX; maus.y = e.clientY;
  };
  const mHoch = e => { if (e.pointerId === maus.id) maus.id = null; };
  const rad = e => { if (!aktiv) return; e.preventDefault?.(); maus.rad += Math.max(-3, Math.min(3, (e.deltaY || 0) / 100)); };
  const kontext = e => e.preventDefault?.();
  const flaeche = [['pointerdown', mRunter], ['pointermove', mBewegt], ['pointerup', mHoch], ['pointercancel', mHoch], ['contextmenu', kontext]];
  for (const [t, f] of flaeche) element.addEventListener(t, f);
  element.addEventListener('wheel', rad, { passive: false });

  // ---------- Touch ----------
  const ts = touch === false ? null : createTouchStick({
    element, stickRadius,
    knoepfe: liste.filter(a => a.knopf),
    sichtbar: touch === true || (touch === 'auto' && istTouchGeraet()),
    beiErstemTouch: () => { if (touch === 'auto') ts.zeigen(true); },
    beiKnopf: (name, unten) => {
      if (!aktiv) return;
      geraet = 'touch';
      if (unten) { touchGehalten.add(name); flankenNeu.add(name); } else touchGehalten.delete(name);
    },
  });

  // ---------- Gamepad ----------
  function padLesen() {
    if (!gamepad) return null;
    let pads = [];
    try { pads = globalThis.navigator?.getGamepads?.() || []; } catch (_) { /* egal */ }
    for (const p of pads) if (p && p.connected !== false && p.axes) return p;
    return null;
  }

  const gehalten = name => tasten.size > 0 && (liste.find(a => a.name === name)?.tasten || []).some(t => tasten.has(t))
    || touchGehalten.has(name) || padGehalten.has(name);

  function lesen(dt) {
    const t = performance.now() / 1000;
    if (!(dt >= 0)) dt = letzteZeit < 0 ? 1 / 60 : t - letzteZeit;
    dt = Math.min(0.1, Math.max(0, dt));
    letzteZeit = t;
    flanken = flankenNeu; flankenNeu = new Set();
    const kam = ts ? ts.nimmKamera() : { dx: 0, dy: 0, zoom: 0 };
    const leer = { x: 0, y: 0, sprint: false, springen: false, ducken: false, kameraX: 0, kameraY: 0, zoom: 0, aktiv: geraet };
    const mdx = maus.dx, mdy = maus.dy, mrad = maus.rad;
    maus.dx = maus.dy = maus.rad = 0;
    if (!aktiv) { flanken.clear(); padVorher = []; return leer; }

    let x = 0, y = 0;
    for (const k of tasten) { const r = RICHTUNG[k]; if (r) { x += r[0]; y += r[1]; } }
    x = Math.sign(x); y = Math.sign(y);
    const kl = Math.hypot(x, y); if (kl > 1) { x /= kl; y /= kl; }

    let kx = mdx * 0.005 + kam.dx * 0.007, ky = mdy * 0.005 + kam.dy * 0.006;
    let zoom = -mrad * 0.12 + kam.zoom;
    let sprintTouch = false;
    if (ts && ts.stick.an) {
      x += ts.stick.x; y += ts.stick.y; sprintTouch = ts.sprint;
      if (Math.hypot(ts.stick.x, ts.stick.y) > 0.01) geraet = 'touch';
    }
    if (kam.dx || kam.dy || kam.zoom) geraet = ts?.benutzt ? 'touch' : geraet;

    const pad = padLesen();
    padGehalten.clear();
    if (pad) {
      const b = n => { const k = pad.buttons?.[n]; return !!k && (k.pressed || k.value > 0.5); };
      const [lx, ly, lm] = totzone(pad.axes[0] || 0, pad.axes[1] || 0, PAD_TOT);
      const [rx, ry] = totzone(pad.axes[2] || 0, pad.axes[3] || 0, PAD_TOT);
      if (lm > 0) { x += lx; y -= ly; geraet = 'gamepad'; }
      // Kurve für feine Kamera-Steuerung, Rate in rad/s
      kx += Math.sign(rx) * rx * rx * 3.0 * dt; ky += Math.sign(ry) * ry * ry * 1.8 * dt;
      if (rx || ry) geraet = 'gamepad';
      for (const a of liste) {
        if (a.padKnopf == null) continue;
        if (b(a.padKnopf)) { padGehalten.add(a.name); if (!padVorher[a.padKnopf]) { flanken.add(a.name); geraet = 'gamepad'; } }
      }
      // L3 = Sprint, bleibt an solange der Stick weit ausgelenkt ist
      if (padGehalten.has('sprint')) padSprint = true;
      if (lm < 0.5) padSprint = false;
      // D-Pad hoch/runter = Zoom, falls nicht belegt
      const belegt = n => liste.some(a => a.padKnopf === n);
      if (!belegt(12) && b(12)) zoom += 1.5 * dt;
      if (!belegt(13) && b(13)) zoom -= 1.5 * dt;
      padVorher = (pad.buttons || []).map((_, n) => b(n));
    } else { padVorher = []; padSprint = false; }

    const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    const s = empfindlichkeit;
    return {
      x, y,
      sprint: gehalten('sprint') || padSprint || sprintTouch,
      springen: gehalten('springen'),
      ducken: gehalten('ducken'),
      kameraX: kx * s, kameraY: ky * s * (invertY ? -1 : 1), zoom,
      aktiv: geraet,
    };
  }

  let weg = false;
  return {
    lesen,
    gedrueckt: name => aktiv && (flanken.has(name) || flankenNeu.has(name)),
    gehalten: name => aktiv && gehalten(name),
    setAktiv(an) {
      an = !!an;
      if (an === aktiv) return;
      aktiv = an;
      loslassen(); flanken.clear(); flankenNeu.clear(); maus.dx = maus.dy = maus.rad = 0; ts?.nimmKamera();
    },
    zeigeTouch(an) { ts?.zeigen(an); },
    dispose() {
      if (weg) return; weg = true;
      for (const [t, f] of fenster) removeEventListener(t, f);
      globalThis.document?.removeEventListener?.('visibilitychange', sichtbarkeit);
      for (const [t, f] of flaeche) element.removeEventListener(t, f);
      element.removeEventListener('wheel', rad, { passive: false });
      ts?.dispose();
      aktiv = false; loslassen();
    },
  };
}
