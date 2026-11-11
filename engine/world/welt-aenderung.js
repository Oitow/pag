/**
 * @modul    welt-aenderung
 * @zweck    Änderungs-Schicht über einer erzeugten Welt (ohne THREE): Gelände mit Pinseln heben, senken, glätten, einebnen und Objekte entfernen; gemerkt werden nur die Unterschiede zum Seed (kleiner Spielstand), mit Rückgängig/Wiederholen, Sperrzonen (Wasser, Wege) und Meldung des geänderten Bereichs fürs Neuzeichnen
 * @api      createWeltAenderung(adapter|welt, {maxSchritte,maxAbweichung,minHoehe,maxHoehe,sperrFlags,ereignisse}) -> {pinsel(art,x,z,{radius,staerke,ziel,form})->bereich|null,kannAendern(x,z),sperreUmkreis(x,z,radius,an?)->zellen,delta(zellIndex)->m,entferneObjekt(index),stelleObjektHer(index),istEntfernt(index),entfernte()->[index],objekteImUmkreis(x,z,radius,filter?)->[index],beginne(),beende()->bool,rueckgaengig()->aenderung|null,wiederholen()->aenderung|null,kannRueckgaengig,kannWiederholen,festschreiben(),zuruecksetzen()->bereich|null,zustand(),lade(stand)->bereich|null,zuWelt(bereich)->{x0,z0,x1,z1},onAenderung(fn)->abmelden,anzahl,dispose()} ; PINSEL_ARTEN
 * @beispiel
 *   import { createWeltAenderung } from '../../engine/world/welt-aenderung.js';
 *   const aend = createWeltAenderung(adapter, { maxAbweichung: 4 });
 *   aend.onAenderung(({ bereich }) => gelaende.aktualisiere(bereich));     // nur das Stück neu zeichnen
 *   aend.pinsel('senken', figur.x, figur.z, { radius: 1.5, staerke: 0.4 }); // Loch graben (Meter)
 *   aend.rueckgaengig();
 *   speicher.speichere('welt', { seed, aenderung: aend.zustand() });        // Spielstand = Seed + Änderungen
 * @tags     welt, gelaende, terrain, aendern, graben, pinsel, editor, bauen, rueckgaengig, undo, speichern, objekte
 * @version  1.1.0
 * @status   entwurf
 * @three    nein
 */
// Die Schicht schreibt direkt in welt.hoehe – Adapter, Kollision, Figuren und Abfragen sehen die Änderung sofort.
// Mit Adapter (createWeltAdapter) sind alle Angaben in Metern (x, z, radius, staerke, ziel, delta);
// mit einer rohen Welt in deren Einheiten (x → Gitter-x, z → Gitter-y, Höhe normiert).
// Pinsel: 'heben' / 'senken' (staerke = Meter in der Mitte), 'glaetten' (staerke 0…1 zum Mittel der Nachbarn),
//         'ebnen' (staerke 0…1 zur Zielhöhe `ziel`; Standard = Höhe in der Pinselmitte). form: 'weich' (Glocke) | 'hart' (Scheibe).
// bereich = { x0, y0, x1, y1 } in Gitterzellen (einschließlich), bei pinsel() zusätzlich `volumen` (m³, + = aufgeschüttet).
// Schritte: Alles zwischen beginne() und beende() ist EIN Rückgängig-Schritt (ein Pinselstrich); ohne Klammer jede Änderung für sich.
// onAenderung(fn) / Ereignis 'welt:geaendert': { bereich | null, objekte: [[index, entfernt]], grund }.
// Gesperrt sind Zellen mit sperrFlags (Standard: Wasser + Wege) und die direkten Nachbarn von Wasser (Uferlinie bleibt heil);
// dazu eigene Zonen des Spiels über sperreUmkreis() (z. B. unter Gebäuden).
// festschreiben(): der jetzige Stand gilt als Ausgangswelt (z. B. vom Spiel eingeebneter Bauplatz) – kommt nicht in den Spielstand.
import { FLAG, WASSER } from './worldgen/worldgen-grid.js';

export const PINSEL_ARTEN = Object.freeze(['heben', 'senken', 'glaetten', 'ebnen']);
const klemme = (v, a, b) => (v < a ? a : v > b ? b : v);

export function createWeltAenderung(quelle, opts = {}) {
  const adapter = quelle && quelle.welt && typeof quelle.zuGitter === 'function' ? quelle : null;
  const welt = adapter ? adapter.welt : quelle;
  if (!welt || !welt.hoehe) throw new Error('welt-aenderung: Welt mit hoehe[] nötig');
  const B = welt.breite, T = welt.tiefe, Z = welt.zelle || 1, H = welt.hoehe;
  const hs = adapter ? adapter.hoehenSkala : 1, m = adapter ? adapter.meterProZelle : 1;
  const zell = Z * m;                                    // Kantenlänge einer Zelle in Metern
  const { maxSchritte = 50, maxAbweichung = Infinity, minHoehe = -Infinity, maxHoehe = Infinity, ereignisse = null } = opts;
  const sperrFlags = opts.sperrFlags ?? (WASSER | FLAG.WEG);
  // Welt (Meter) → Zelle als Kommazahl
  const zx = (x, z) => (adapter ? adapter.zuGitter(x, z).gx : x) / Z;
  const zy = (x, z) => (adapter ? adapter.zuGitter(x, z).gy : z) / Z;

  const basis = new Map();        // Zell-Index → Höhe aus dem Seed (nur berührte Zellen)
  const weg = new Set();          // entfernte Objekte (kommen in den Spielstand)
  const wegFest = new Set();      // festgeschrieben entfernt (gehören zur Ausgangswelt)
  let zurueck = [], vor = [];     // Schritte: { zellen: Map(i → Wert davor), objekte: [[index, warWeg]] }
  let offen = null, tiefe = 0;
  const hoerer = new Set();

  let gesperrt = null;
  function sperre() {
    if (gesperrt) return gesperrt;
    gesperrt = new Uint8Array(B * T);
    const F = welt.flags;
    if (!F || !sperrFlags) return gesperrt;
    const nass = WASSER & sperrFlags;
    for (let y = 0; y < T; y++) for (let x = 0; x < B; x++) {
      const i = y * B + x;
      if (F[i] & sperrFlags) { gesperrt[i] = 1; continue; }
      if (!nass) continue;
      for (let dy = -1; dy <= 1 && !gesperrt[i]; dy++) for (let dx = -1; dx <= 1; dx++) {
        const a = x + dx, b = y + dy;
        if (a >= 0 && b >= 0 && a < B && b < T && (F[b * B + a] & nass)) { gesperrt[i] = 1; break; }
      }
    }
    return gesperrt;
  }

  function melde(bereich, objekte, grund) {
    const e = { bereich, objekte, grund };
    for (const fn of [...hoerer]) fn(e);
    ereignisse?.sende('welt:geaendert', e);
    return e;
  }
  const schrittAuf = () => (offen ??= { zellen: new Map(), objekte: [] });
  function schrittZu() {
    if (tiefe > 0 || !offen) return false;
    const s = offen; offen = null;
    if (!s.zellen.size && !s.objekte.length) return false;
    zurueck.push(s); vor = [];
    if (zurueck.length > maxSchritte) zurueck.shift();
    return true;
  }
  function schreibe(i, wert) {
    const alt = H[i], b = basis.has(i) ? basis.get(i) : alt;
    wert = Math.fround(klemme(wert, Math.max(minHoehe / hs, b - maxAbweichung / hs), Math.min(maxHoehe / hs, b + maxAbweichung / hs)));
    if (wert === alt) return 0;                          // nichts zu tun (Grenze erreicht) → kein leerer Rückgängig-Schritt
    if (!basis.has(i)) basis.set(i, alt);
    const s = schrittAuf();
    if (!s.zellen.has(i)) s.zellen.set(i, alt);
    H[i] = wert;
    return H[i] - alt;
  }

  /** Pinsel an (x, z). Liefert den geänderten Bereich (+ volumen) oder null, wenn nichts ging (gesperrt, außerhalb, Grenze erreicht). */
  function pinsel(art, x, z, { radius = 2, staerke = art === 'heben' || art === 'senken' ? 0.5 : 1, ziel = null, form = 'weich' } = {}) {
    if (!PINSEL_ARTEN.includes(art)) throw new Error('welt-aenderung: unbekannter Pinsel ' + art);
    const cx = zx(x, z), cy = zy(x, z), r = Math.max(radius / zell, 0.5);
    const x0 = Math.max(0, Math.ceil(cx - r)), x1 = Math.min(B - 1, Math.floor(cx + r));
    const y0 = Math.max(0, Math.ceil(cy - r)), y1 = Math.min(T - 1, Math.floor(cy + r));
    if (x0 > x1 || y0 > y1) return null;
    const S = sperre(), anteil = klemme(staerke, 0, 1);
    const zielH = art === 'ebnen' ? (ziel ?? H[klemme(Math.round(cy), 0, T - 1) * B + klemme(Math.round(cx), 0, B - 1)] * hs) / hs : 0;
    // Glätten liest die Höhen von vor dem Strich (sonst hängt das Ergebnis von der Reihenfolge ab)
    const w = x1 - x0 + 3, alt = art === 'glaetten' ? new Float32Array(w * (y1 - y0 + 3)) : null;
    if (alt) for (let b = y0 - 1; b <= y1 + 1; b++) for (let a = x0 - 1; a <= x1 + 1; a++)
      alt[(b - y0 + 1) * w + a - x0 + 1] = H[klemme(b, 0, T - 1) * B + klemme(a, 0, B - 1)];
    const ber = { x0: B, y0: T, x1: -1, y1: -1, volumen: 0 };
    for (let b = y0; b <= y1; b++) for (let a = x0; a <= x1; a++) {
      const i = b * B + a, d = Math.hypot(a - cx, b - cy) / r;
      if (d > 1 || S[i]) continue;
      const g = form === 'hart' ? 1 : (1 - d * d) * (1 - d * d);
      let neu;
      if (art === 'heben') neu = H[i] + g * staerke / hs;
      else if (art === 'senken') neu = H[i] - g * staerke / hs;
      else if (art === 'ebnen') neu = H[i] + (zielH - H[i]) * g * anteil;
      else {
        let sum = 0;
        for (let v = 0; v < 3; v++) for (let u = 0; u < 3; u++) sum += alt[(b - y0 + v) * w + a - x0 + u];
        neu = H[i] + (sum / 9 - H[i]) * g * anteil;
      }
      const diff = schreibe(i, neu);
      if (!diff) continue;
      ber.volumen += diff * hs * zell * zell;
      if (a < ber.x0) ber.x0 = a; if (a > ber.x1) ber.x1 = a; if (b < ber.y0) ber.y0 = b; if (b > ber.y1) ber.y1 = b;
    }
    schrittZu();
    if (ber.x1 < 0) return null;
    melde(ber, [], 'pinsel');
    return ber;
  }

  function setzeObjekt(index, entfernt, grund = 'objekt') {
    if (!Number.isInteger(index) || index < 0 || (welt.objekte && index >= welt.objekte.anzahl)) return false;
    if (wegFest.has(index) || weg.has(index) === entfernt) return false;
    schrittAuf().objekte.push([index, !entfernt]);
    if (entfernt) weg.add(index); else weg.delete(index);
    schrittZu();
    melde(null, [[index, entfernt]], grund);
    return true;
  }

  let faecher = null;             // Objekte nach Zelle (erst beim ersten Suchen gebaut)
  function objekteImUmkreis(x, z, radius, filter = null) {
    const o = welt.objekte, aus = [];
    if (!o) return aus;
    if (!faecher) {
      faecher = new Map();
      for (let i = 0; i < o.anzahl; i++) {
        const k = Math.floor(o.y[i] / Z) * B + Math.floor(o.x[i] / Z);
        const l = faecher.get(k); if (l) l.push(i); else faecher.set(k, [i]);
      }
    }
    const cx = zx(x, z), cy = zy(x, z), r = radius / zell;
    for (let b = Math.floor(cy - r); b <= Math.floor(cy + r); b++) for (let a = Math.floor(cx - r); a <= Math.floor(cx + r); a++) {
      if (a < 0 || b < 0 || a >= B || b >= T) continue;
      const l = faecher.get(b * B + a);
      if (!l) continue;
      for (const i of l) {
        if (weg.has(i) || wegFest.has(i) || Math.hypot(o.x[i] / Z - cx, o.y[i] / Z - cy) > r) continue;
        if (!filter || filter(i, o.typen[o.typ[i]], o.arten[o.art[i]])) aus.push(i);
      }
    }
    return aus;
  }

  /** Einen Schritt anwenden und dabei sein Gegenstück bauen (Rückgängig ↔ Wiederholen). */
  function wende(s, grund) {
    const gegen = { zellen: new Map(), objekte: [] }, ber = { x0: B, y0: T, x1: -1, y1: -1 }, obj = [];
    for (const [i, v] of s.zellen) {
      gegen.zellen.set(i, H[i]); H[i] = v;
      const a = i % B, b = (i - a) / B;
      if (a < ber.x0) ber.x0 = a; if (a > ber.x1) ber.x1 = a; if (b < ber.y0) ber.y0 = b; if (b > ber.y1) ber.y1 = b;
    }
    for (let k = s.objekte.length - 1; k >= 0; k--) {
      const [index, warWeg] = s.objekte[k];
      gegen.objekte.push([index, weg.has(index)]);
      if (warWeg) weg.add(index); else weg.delete(index);
      obj.push([index, warWeg]);
    }
    return [gegen, melde(ber.x1 < 0 ? null : ber, obj, grund)];
  }
  function alleZurueck() {
    const ber = { x0: B, y0: T, x1: -1, y1: -1 };
    for (const [i, v] of basis) {
      if (H[i] === v) continue;
      H[i] = v;
      const a = i % B, b = (i - a) / B;
      if (a < ber.x0) ber.x0 = a; if (a > ber.x1) ber.x1 = a; if (b < ber.y0) ber.y0 = b; if (b > ber.y1) ber.y1 = b;
    }
    basis.clear(); zurueck = []; vor = []; offen = null; tiefe = 0;
    return ber.x1 < 0 ? null : ber;
  }
  const vereine = (a, b) => (!a ? b : !b ? a : { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) });

  return {
    welt, pinsel, objekteImUmkreis,
    /** Zellen im Umkreis sperren (an = false: wieder freigeben) – z. B. unter einem Gebäude. Gilt für Pinsel und kannAendern, nicht für lade(). */
    sperreUmkreis(x, z, radius, an = true) {
      const S = sperre(), cx = zx(x, z), cy = zy(x, z), r = radius / zell;
      let n = 0;
      for (let b = Math.max(0, Math.ceil(cy - r)); b <= Math.min(T - 1, Math.floor(cy + r)); b++) for (let a = Math.max(0, Math.ceil(cx - r)); a <= Math.min(B - 1, Math.floor(cx + r)); a++) {
        if (Math.hypot(a - cx, b - cy) > r) continue;
        const i = b * B + a;
        if (an) S[i] |= 2; else S[i] &= ~2;
        n++;
      }
      return n;
    },
    /** Darf an (x, z) gegraben/aufgeschüttet werden (nicht gesperrt, in der Karte)? */
    kannAendern(x, z) {
      const a = Math.round(zx(x, z)), b = Math.round(zy(x, z));
      return a >= 0 && b >= 0 && a < B && b < T && !sperre()[b * B + a];
    },
    /** Unterschied zur Ausgangswelt an einer Zelle (Meter bzw. Welteinheiten; + = höher). */
    delta: (i) => (basis.has(i) ? (H[i] - basis.get(i)) * hs : 0),
    entferneObjekt: (index) => setzeObjekt(index, true),
    stelleObjektHer: (index) => setzeObjekt(index, false),
    istEntfernt: (index) => weg.has(index) || wegFest.has(index),
    entfernte: () => [...wegFest, ...weg],
    beginne() { tiefe++; schrittAuf(); },
    beende() { if (tiefe > 0) tiefe--; return schrittZu(); },
    get kannRueckgaengig() { return zurueck.length > 0; },
    get kannWiederholen() { return vor.length > 0; },
    rueckgaengig() {
      tiefe = 0; schrittZu();
      const s = zurueck.pop();
      if (!s) return null;
      const [gegen, e] = wende(s, 'rueckgaengig');
      vor.push(gegen);
      return e;
    },
    wiederholen() {
      const s = vor.pop();
      if (!s) return null;
      const [gegen, e] = wende(s, 'wiederholen');
      zurueck.push(gegen);
      return e;
    },
    festschreiben() {
      tiefe = 0; offen = null; basis.clear(); zurueck = []; vor = [];
      for (const i of weg) wegFest.add(i);
      weg.clear();
    },
    /** Alles auf die Ausgangswelt zurück (kein Rückgängig danach). Liefert den Bereich oder null. */
    zuruecksetzen() {
      const obj = [...weg].map((i) => [i, false]);
      weg.clear();
      const ber = alleZurueck();
      if (ber || obj.length) melde(ber, obj, 'zuruecksetzen');
      return ber;
    },
    /** Nur die Unterschiede: { v, b, t, i: Uint32Array (Zellen), d: Float32Array (Höhen-Unterschied, normiert), weg: [Objekt-Index] }. */
    zustand() {
      const idx = [...basis.keys()].filter((i) => Math.abs(H[i] - basis.get(i)) > 1e-7).sort((a, b) => a - b);
      return { v: 1, b: B, t: T, i: Uint32Array.from(idx), d: Float32Array.from(idx, (i) => H[i] - basis.get(i)), weg: [...weg].sort((a, b) => a - b) };
    },
    /** Stand aus zustand() einspielen (ersetzt alle bisherigen Änderungen). Passt die Kartengröße nicht → null, nichts passiert. */
    lade(stand) {
      if (!stand || stand.b !== B || stand.t !== T || !stand.i || !stand.d) return null;
      const obj = [...weg].map((i) => [i, false]);
      weg.clear();
      let ber = alleZurueck();
      for (let k = 0; k < stand.i.length; k++) {
        const i = stand.i[k], d = +stand.d[k];
        if (!(i >= 0 && i < B * T) || !Number.isFinite(d)) continue;
        basis.set(i, H[i]); H[i] += d;
        const a = i % B, b = (i - a) / B;
        ber = vereine(ber, { x0: a, y0: b, x1: a, y1: b });
      }
      for (const i of stand.weg || []) if (!wegFest.has(i) && !weg.has(i)) { weg.add(i); obj.push([i, true]); }
      melde(ber, obj, 'lade');
      return ber;
    },
    /** Bereich (Zellen) → Rechteck in Metern { x0, z0, x1, z1 } (mit Adapter), z. B. um ruhende Dinge dort zu wecken. */
    zuWelt(ber) {
      const p = adapter ? adapter.zuWelt(ber.x0 * Z, ber.y0 * Z) : { x: ber.x0 * Z, z: ber.y0 * Z };
      const q = adapter ? adapter.zuWelt(ber.x1 * Z, ber.y1 * Z) : { x: ber.x1 * Z, z: ber.y1 * Z };
      return { x0: p.x, z0: p.z, x1: q.x, z1: q.z };
    },
    onAenderung(fn) { hoerer.add(fn); return () => hoerer.delete(fn); },
    get anzahl() { return { zellen: basis.size, objekte: weg.size, schritte: zurueck.length }; },
    /** Räumt nur die Schicht ab – die Welt bleibt, wie sie gerade ist. */
    dispose() { hoerer.clear(); basis.clear(); weg.clear(); wegFest.clear(); zurueck = []; vor = []; offen = null; faecher = null; gesperrt = null; },
  };
}
