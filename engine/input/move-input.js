/**
 * @modul    move-input
 * @zweck    Bewegungs-Eingabe für Figuren: Tastatur (WASD/Pfeile), Maus-Ziehen/Mausrad, Touch-Stick + Knöpfe, Gamepad → Stick, Kamera-Delta, Aktionen (Flanke/gehalten)
 * @api      createMoveInput(opts) -> { lesen(dt?) -> { x, y, sprint, springen, ducken, <aktion>: bool …, kameraX, kameraY, zoom, aktiv }, gedrueckt(name), gehalten(name), aktionen, belegung, setBelegung(teil), lerneTaste(name) -> Promise<code|null>, setAktiv(bool), zeigeTouch(bool), zeigeKnopf(name, bool), dispose() } ; stickZuWelt(x, y, kameraYaw) -> {x, z} ; zuAbsicht(e, kameraYaw, out?) -> Absicht ; tastenText(code) ; STANDARD_AKTIONEN ; ERWEITERTE_AKTIONEN ; STANDARD_BELEGUNG
 * @beispiel
 *   import { createMoveInput, stickZuWelt } from '../../engine/input/move-input.js';
 *   const ein = createMoveInput({ element: renderer.domElement, aktionen: [{ name: 'angriff', tasten: ['KeyF'], knopf: '⚔', padKnopf: 2 }] });
 *   const e = ein.lesen();                       // einmal pro Frame
 *   kamera.drehen(e.kameraX, e.kameraY); kamera.zoomen(e.zoom);
 *   const r = stickZuWelt(e.x, e.y, kamera.blickYaw());
 *   motor.update(dt, { x: r.x, z: r.z, sprint: e.sprint, springen: e.springen, ducken: e.ducken });
 *   if (ein.gedrueckt('angriff')) figur.schlagen();
 *   // Neue Aktionen per Name (rollen, gleiten, tauchen, aktion1, aktion2, interagieren, ziel) + eigene Tastenbelegung (z. B. aus dem Spielstand):
 *   const ein2 = createMoveInput({ aktionen: ['rollen', 'interagieren'], belegung: { tasten: { vor: ['KeyZ'] } }, vibration: true });
 *   figur.update(dt, zuAbsicht(ein2.lesen(), kamera.blickYaw()));   // alle Aktions-Flags (rollen …) gehen mit zum Motor
 * @tags     eingabe, tastatur, maus, touch, gamepad, joystick, figur, steuerung
 * @version  1.1.0
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

/** Weitere fertige Aktionen; in opts.aktionen per Name ('rollen') oder als Objekt mit Änderungen ({ name: 'rollen', knopf: '↻' }). */
export const ERWEITERTE_AKTIONEN = {
  rollen: { name: 'rollen', tasten: ['KeyQ'], padKnopf: 5, knopf: '🌀', titel: 'Rolle / Dash' },   // Motor: Flanke = Rolle (Boden) / Dash (Luft)
  gleiten: { name: 'gleiten', tasten: ['KeyV'], padKnopf: 4, knopf: '🪂', titel: 'Gleiten' },
  tauchen: { name: 'tauchen', tasten: ['KeyC', 'ControlLeft'], padKnopf: 1, titel: 'Tauchen' },     // wie ducken, im Wasser abtauchen
  aktion1: { name: 'aktion1', tasten: ['KeyF'], padKnopf: 2, knopf: '⚔', titel: 'Aktion 1' },
  aktion2: { name: 'aktion2', tasten: ['KeyR'], padKnopf: 7, knopf: '✋', titel: 'Aktion 2' },
  interagieren: { name: 'interagieren', tasten: ['KeyE'], padKnopf: 3, knopf: '💬', titel: 'Interagieren' },
  ziel: { name: 'ziel', tasten: ['KeyT', 'Tab'], padKnopf: 11, knopf: '🎯', titel: 'Ziel erfassen' },
};

/** Bewegungstasten (Richtungen); Aktionstasten stehen in den Aktionen und lassen sich über belegung.tasten.<name> ändern. */
export const STANDARD_BELEGUNG = Object.freeze({
  tasten: { vor: ['KeyW', 'ArrowUp'], zurueck: ['KeyS', 'ArrowDown'], links: ['KeyA', 'ArrowLeft'], rechts: ['KeyD', 'ArrowRight'] },
  pad: {},
});
const RICHTUNGS_NAMEN = { vor: [0, 1], zurueck: [0, -1], links: [-1, 0], rechts: [1, 0] };
const RESERVIERT = new Set(['x', 'y', 'z', 'kameraX', 'kameraY', 'zoom', 'aktiv', 'blickYaw', ...Object.keys(RICHTUNGS_NAMEN)]);

/** Lesbarer Tastenname für Hilfetexte/Menüs: 'KeyW' → 'W', 'Space' → 'Leertaste'. */
export function tastenText(code) {
  const T = { Space: 'Leertaste', ShiftLeft: 'Shift', ShiftRight: 'Shift rechts', ControlLeft: 'Strg', Tab: 'Tab', Enter: 'Enter',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Escape: 'Esc', Backspace: '⌫' };
  if (T[code]) return T[code];
  return String(code || '').replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ');
}

/**
 * Eingabe (lesen()) → Motor-Absicht in Weltkoordinaten. Übernimmt sprint/springen/ducken und alle Aktions-Flags
 * (rollen, gleiten, tauchen …: gehalten, der Motor erkennt Flanken selbst wie bei springen). Unbekannte Felder ignoriert der Motor.
 */
export function zuAbsicht(e, kameraYaw = 0, out = {}) {
  const r = stickZuWelt(e?.x || 0, e?.y || 0, Number.isFinite(kameraYaw) ? kameraYaw : 0);
  out.x = r.x; out.z = r.z;
  for (const k in e) if (typeof e[k] === 'boolean') out[k] = e[k];
  return out;
}

/** Stick (x = rechts, y = vorwärts) → Weltrichtung {x, z}; kameraYaw = Blickrichtung (yaw 0 = +Z, atan2(x, z)). */
export function stickZuWelt(x, y, kameraYaw) {
  const s = Math.sin(kameraYaw), c = Math.cos(kameraYaw);
  return { x: y * s - x * c, z: y * c + x * s };
}

const BLOCKIEREN = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);
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
  stickRadius = 'auto', stickTotzone = 0.12, knopfSkala = 'auto', vibration = false, belegung = null,
  invertY = false, empfindlichkeit = 1,
} = {}) {
  // Aktionen zusammenführen: eigene Einträge ersetzen gleichnamige Standard-Aktionen; Strings = ERWEITERTE_AKTIONEN
  const liste = [...(standardAktionen ? STANDARD_AKTIONEN : [])].map(a => ({ ...a }));
  for (let a of aktionen) {
    if (typeof a === 'string') a = ERWEITERTE_AKTIONEN[a] || { name: a };
    else if (ERWEITERTE_AKTIONEN[a?.name]) a = { ...ERWEITERTE_AKTIONEN[a.name], ...a };
    if (!a?.name) continue;
    const i = liste.findIndex(b => b.name === a.name);
    if (i >= 0) liste[i] = { ...liste[i], ...a }; else liste.push({ ...a });
  }
  const richtung = {};              // name → [codes]
  const tasteZu = new Map();        // code → [namen]
  const richtungZu = new Map();     // code → [x, y]
  function belegen(teil) {
    for (const [n, codes] of Object.entries(teil?.tasten || {})) {
      if (!Array.isArray(codes)) continue;
      if (RICHTUNGS_NAMEN[n]) richtung[n] = [...codes];
      else { const a = liste.find(b => b.name === n); if (a) a.tasten = [...codes]; }
    }
    for (const [n, k] of Object.entries(teil?.pad || {})) { const a = liste.find(b => b.name === n); if (a) a.padKnopf = k == null ? null : +k; }
    tasteZu.clear(); richtungZu.clear();
    for (const a of liste) for (const t of a.tasten || []) { if (!tasteZu.has(t)) tasteZu.set(t, []); tasteZu.get(t).push(a.name); }
    for (const [n, codes] of Object.entries(richtung)) for (const c of codes) richtungZu.set(c, RICHTUNGS_NAMEN[n]);
  }
  belegen(STANDARD_BELEGUNG);
  belegen(belegung);
  let lernen = null;                // { name, fertig }

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
    if (lernen) {
      e.preventDefault?.();
      const { name, fertig } = lernen; lernen = null;
      if (e.code === 'Escape') { fertig(null); return; }
      const alt = RICHTUNGS_NAMEN[name] ? richtung[name] : liste.find(b => b.name === name)?.tasten;
      belegen({ tasten: { [name]: [e.code, ...(alt || []).slice(1).filter(c => c !== e.code)] } });
      fertig(e.code); return;
    }
    if (!aktiv || imEingabefeld(e) || e.ctrlKey && e.code !== 'ControlLeft' || e.metaKey || e.altKey) return;
    if (BLOCKIEREN.has(e.code) && (tasteZu.has(e.code) || richtungZu.has(e.code))) e.preventDefault?.();
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
    element, stickRadius, totzone: stickTotzone, knopfSkala, vibration,
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
    for (const k of tasten) { const r = richtungZu.get(k); if (r) { x += r[0]; y += r[1]; } }
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
    const e = {
      x, y,
      sprint: gehalten('sprint') || padSprint || sprintTouch,
      springen: gehalten('springen'),
      ducken: gehalten('ducken'),
      kameraX: kx * s, kameraY: ky * s * (invertY ? -1 : 1), zoom,
      aktiv: geraet,
    };
    for (const a of liste) if (!(a.name in e) && !RESERVIERT.has(a.name)) e[a.name] = gehalten(a.name);
    return e;
  }

  /** Aktuelle Belegung als Daten (zum Speichern; mit setBelegung bzw. opts.belegung wieder laden). */
  function belegungLesen() {
    const t = {}, pad = {};
    for (const [n, codes] of Object.entries(richtung)) t[n] = [...codes];
    for (const a of liste) { t[a.name] = [...(a.tasten || [])]; if (a.padKnopf != null) pad[a.name] = a.padKnopf; }
    return { tasten: t, pad };
  }

  let weg = false;
  return {
    lesen,
    /** Alle Aktionen (Kopie): name, tasten, padKnopf, knopf, titel. */
    get aktionen() { return liste.map(a => ({ ...a, tasten: [...(a.tasten || [])] })); },
    get belegung() { return belegungLesen(); },
    setBelegung(teil) { belegen(teil); tasten.clear(); },
    /** Nächste gedrückte Taste wird erste Taste für name (Aktion oder vor/zurueck/links/rechts); Esc bricht ab → null. */
    lerneTaste(name) {
      if (!RICHTUNGS_NAMEN[name] && !liste.some(a => a.name === name)) return Promise.resolve(null);
      lernen?.fertig(null);
      return new Promise(fertig => { lernen = { name, fertig }; });
    },
    zeigeKnopf(name, an) { ts?.knopfZeigen(name, an); },
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
      lernen?.fertig(null); lernen = null;
      for (const [t, f] of fenster) removeEventListener(t, f);
      globalThis.document?.removeEventListener?.('visibilitychange', sichtbarkeit);
      for (const [t, f] of flaeche) element.removeEventListener(t, f);
      element.removeEventListener('wheel', rad, { passive: false });
      ts?.dispose();
      aktiv = false; loslassen();
    },
  };
}
