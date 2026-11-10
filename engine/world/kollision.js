/**
 * @modul    kollision
 * @zweck    Kollisions-Welt über einem Welt-Adapter: bewegliche und entfernbare Körper (Zylinder, gedrehte Kästen) mit Höhe – man kann draufsteigen, drüberspringen, sich aneinander vorbeischieben; dazu ein Strahl-Test gegen Gelände und Körper (Zielen, Sichtlinie, Ablegen)
 * @api      createKollisionsWelt({welt,zelle,stufe}) -> {bodenHoehe(x,z,y?),wasserHoehe(x,z),hindernisse(x,z,radius,filter?),fuege(koerper)->id,bewege(id,x,z,y0?),entferne(id),hole(id),imUmkreis(x,z,radius,fn),strahl(von,richtung,maxDistanz,opts?),anzahl,basis,dispose()}
 * @beispiel
 *   import { createKollisionsWelt } from '../../engine/world/kollision.js';
 *   const welt = createKollisionsWelt({ welt: adapter });           // erfüllt denselben Welt-Vertrag wie der Adapter
 *   const kiste = welt.fuege({ form: 'kasten', x: 4, z: 2, bx: 0.5, bz: 0.5, hoehe: 0.9, begehbar: true });
 *   const motor = createMotor({ welt });                             // läuft gegen Kisten, springt drauf
 *   const t = welt.strahl({ x: 0, y: 1.5, z: 0 }, { x: 0, y: 0, z: 1 }, 30);   // → { distanz, x, y, z, id, art }
 * @tags     kollision, physik, welt, hindernis, koerper, strahl, raycast, begehbar, adapter
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * Körper: { form: 'kreis' (Standard) | 'kasten', x, z, radius | bx, bz (halbe Breite/Tiefe) + winkel (Drehung um Y),
 *   y0 (Unterkante; Standard = Boden an der Stelle), hoehe (Standard unendlich), begehbar (Oberseite trägt Figuren),
 *   weich (0…1 Anteil des Ausschiebens; 0.5 = Figuren drängeln sich aneinander vorbei), fest (false = kein Ausschieben, nur Strahl),
 *   id (sonst fortlaufende Nummer), daten }
 * filter für hindernisse (alles optional): { y (Fußhöhe), hoehe (Körpergröße), ausser (eigene id) }.
 *   Mit y werden Körper übersprungen, über oder unter denen man ist; begehbare schon ab „Oberkante ≤ y + stufe“ (hochsteigen).
 * bodenHoehe(x, z, y): ohne y nur das Gelände des Adapters; mit y zusätzlich begehbare Oberseiten bis y + stufe.
 */
import { createRaumGitter } from '../core/raum-gitter.js';
import { numOr } from '../core/math.js';

export function createKollisionsWelt({ welt, zelle = 4, stufe = 0.45 } = {}) {
  if (!welt || typeof welt.bodenHoehe !== 'function') throw new Error('createKollisionsWelt: welt.bodenHoehe fehlt');
  const gitter = createRaumGitter({ zelle });
  let naechsteId = 1;
  const schub = { x: 0, z: 0 }, treffer = { distanz: 0, x: 0, y: 0, z: 0, id: null, art: '' };
  const gelaende = (x, z) => numOr(welt.bodenHoehe(x, z), 0);

  function fuege(k = {}) {
    const kasten = k.form === 'kasten';
    const x = numOr(k.x, 0), z = numOr(k.z, 0);
    const c = {
      id: k.id ?? naechsteId++, kasten, x, z,
      radius: kasten ? 0 : Math.max(0.01, numOr(k.radius, 0.5)),
      bx: Math.max(0.01, numOr(k.bx, 0.5)), bz: Math.max(0.01, numOr(k.bz, 0.5)),
      cos: Math.cos(numOr(k.winkel, 0)), sin: Math.sin(numOr(k.winkel, 0)),
      y0: numOr(k.y0, gelaende(x, z)), hoehe: k.hoehe === undefined ? Infinity : Math.max(0, +k.hoehe || 0),
      begehbar: !!k.begehbar, weich: k.weich === undefined ? 1 : Math.min(1, Math.max(0, +k.weich || 0)),
      fest: k.fest !== false, daten: k.daten,
    };
    if (gitter.hat(c.id)) gitter.entferne(c.id);
    gitter.setze(c.id, x, z, kasten ? Math.hypot(c.bx, c.bz) : c.radius, c);
    return c.id;
  }

  function bewege(id, x, z, y0) {
    const e = gitter.hole(id);
    if (!e || !Number.isFinite(x) || !Number.isFinite(z)) return false;
    e.daten.x = x; e.daten.z = z;
    if (Number.isFinite(y0)) e.daten.y0 = y0;
    gitter.setze(id, x, z);
    return true;
  }

  // Punkt in den Kasten-Raum drehen (lokal: x entlang bx, z entlang bz)
  const lokalX = (c, dx, dz) => dx * c.cos - dz * c.sin;
  const lokalZ = (c, dx, dz) => dx * c.sin + dz * c.cos;
  const innen = (c, x, z) => {
    const dx = x - c.x, dz = z - c.z;
    if (!c.kasten) return dx * dx + dz * dz <= c.radius * c.radius;
    return Math.abs(lokalX(c, dx, dz)) <= c.bx && Math.abs(lokalZ(c, dx, dz)) <= c.bz;
  };

  let bodenY = 0, bodenWert = 0;
  const bodenFn = (e) => {
    const c = e.daten;
    if (!c.begehbar) return;
    const oben = c.y0 + c.hoehe;
    if (oben > bodenWert && oben <= bodenY + stufe && innen(c, bodenX, bodenZ)) bodenWert = oben;
  };
  let bodenX = 0, bodenZ = 0;
  function bodenHoehe(x, z, y) {
    const b = welt.bodenHoehe(x, z);
    if (y === undefined || !gitter.anzahl || !Number.isFinite(y)) return b;
    bodenX = x; bodenZ = z; bodenY = y; bodenWert = numOr(b, 0);
    gitter.imUmkreis(x, z, 0, bodenFn);
    return bodenWert;
  }

  let hx = 0, hz = 0, hr = 0, hy = NaN, hh = 0, hAusser, hTreffer = false;
  const schubFn = (e) => {
    const c = e.daten;
    if (!c.fest || c.id === hAusser) return;
    if (hy === hy) {
      const oben = c.y0 + c.hoehe;
      if (oben <= hy + (c.begehbar ? stufe : 1e-3) || c.y0 >= hy + hh) return;
    }
    const dx = hx - c.x, dz = hz - c.z;
    let px, pz, tief;
    if (!c.kasten) {
      const min = hr + c.radius, d2 = dx * dx + dz * dz;
      if (d2 >= min * min) return;
      const d = Math.sqrt(d2);
      tief = min - d; px = d > 1e-9 ? dx / d : 1; pz = d > 1e-9 ? dz / d : 0;
    } else {
      const lx = lokalX(c, dx, dz), lz = lokalZ(c, dx, dz);
      const qx = Math.min(c.bx, Math.max(-c.bx, lx)), qz = Math.min(c.bz, Math.max(-c.bz, lz));
      let nx = lx - qx, nz = lz - qz;
      const d2 = nx * nx + nz * nz;
      if (d2 >= hr * hr) return;
      if (d2 > 1e-12) { const d = Math.sqrt(d2); tief = hr - d; nx /= d; nz /= d; }
      else {                                   // Mittelpunkt im Kasten: über die nächste Seite hinaus
        const ax = c.bx - Math.abs(lx), az = c.bz - Math.abs(lz);
        if (ax < az) { nx = lx < 0 ? -1 : 1; nz = 0; tief = ax + hr; } else { nx = 0; nz = lz < 0 ? -1 : 1; tief = az + hr; }
      }
      px = nx * c.cos + nz * c.sin; pz = -nx * c.sin + nz * c.cos;   // zurück in die Welt
    }
    schub.x += px * tief * c.weich; schub.z += pz * tief * c.weich; hTreffer = true;
  };
  /** Ausschiebe-Vektor für einen Kreis (Summe aus Adapter-Hindernissen und Körpern) oder null. */
  function hindernisse(x, z, radius = 0.3, filter) {
    const s = welt.hindernisse ? welt.hindernisse(x, z, radius) : null;
    schub.x = s ? numOr(s.x, 0) : 0; schub.z = s ? numOr(s.z, 0) : 0; hTreffer = !!s;
    if (gitter.anzahl) {
      hx = x; hz = z; hr = radius; hy = numOr(filter?.y, NaN); hh = numOr(filter?.hoehe, 1.75); hAusser = filter?.ausser;
      gitter.imUmkreis(x, z, radius, schubFn);
    }
    return hTreffer ? schub : null;
  }

  // --- Strahl ---
  function strahlKoerper(c, o, d, max) {
    let t0 = 0, t1 = max;
    if (d.y !== 0) {                           // Höhen-Bereich
      let a = (c.y0 - o.y) / d.y, b = (c.y0 + c.hoehe - o.y) / d.y;
      if (a > b) { const h = a; a = b; b = h; }
      if (a > t0) t0 = a; if (b < t1) t1 = b;
    } else if (o.y < c.y0 || o.y > c.y0 + c.hoehe) return Infinity;
    if (t0 > t1) return Infinity;
    const ox = o.x - c.x, oz = o.z - c.z;
    if (!c.kasten) {
      const A = d.x * d.x + d.z * d.z, B = ox * d.x + oz * d.z, C = ox * ox + oz * oz - c.radius * c.radius;
      if (A < 1e-12) return C <= 0 ? t0 : Infinity;
      const D = B * B - A * C;
      if (D < 0) return Infinity;
      const w = Math.sqrt(D), a = (-B - w) / A, b = (-B + w) / A;
      if (a > t0) t0 = a; if (b < t1) t1 = b;
    } else {
      const lox = lokalX(c, ox, oz), loz = lokalZ(c, ox, oz), ldx = lokalX(c, d.x, d.z), ldz = lokalZ(c, d.x, d.z);
      for (let i = 0; i < 2; i++) {
        const p = i ? loz : lox, r = i ? ldz : ldx, halb = i ? c.bz : c.bx;
        if (Math.abs(r) < 1e-12) { if (Math.abs(p) > halb) return Infinity; continue; }
        let a = (-halb - p) / r, b = (halb - p) / r;
        if (a > b) { const h = a; a = b; b = h; }
        if (a > t0) t0 = a; if (b < t1) t1 = b;
      }
    }
    return t0 <= t1 ? t0 : Infinity;
  }

  /**
   * Strahl von `von` in `richtung` (wird normiert). opts: { ausser (id), boden = true, koerper = true, schritt = 0.5, filter(koerper) }.
   * Liefert das nächste Hindernis { distanz, x, y, z, id (Körper) | null, art: 'boden' | 'koerper', daten } oder null.
   * Das Ergebnis-Objekt wird wiederverwendet.
   */
  function strahl(von, richtung, maxDistanz = 50, opts = {}) {
    const l = Math.hypot(richtung.x, richtung.y, richtung.z);
    if (!(l > 0) || !(maxDistanz > 0)) return null;
    const d = { x: richtung.x / l, y: richtung.y / l, z: richtung.z / l };
    let best = maxDistanz, id = null, daten, art = '';
    if (opts.boden !== false) {
      const h = Math.max(0.05, opts.schritt ?? 0.5);
      let tVor = 0;
      for (let t = h; tVor < maxDistanz; t += h) {
        const tt = Math.min(t, maxDistanz);
        if (von.y + d.y * tt <= gelaende(von.x + d.x * tt, von.z + d.z * tt)) {
          let a = tVor, b = tt;                 // Intervall halbieren
          for (let i = 0; i < 8; i++) { const m = (a + b) / 2; if (von.y + d.y * m <= gelaende(von.x + d.x * m, von.z + d.z * m)) b = m; else a = m; }
          best = b; art = 'boden';
          break;
        }
        tVor = tt;
      }
    }
    if (opts.koerper !== false && gitter.anzahl) {
      const halb = best / 2;
      gitter.imUmkreis(von.x + d.x * halb, von.z + d.z * halb, halb, (e) => {
        const c = e.daten;
        if (c.id === opts.ausser || (opts.filter && !opts.filter(c))) return;
        const t = strahlKoerper(c, von, d, best);
        if (t < best) { best = t; id = c.id; daten = c.daten; art = 'koerper'; }
      });
    }
    if (!art) return null;
    treffer.distanz = best; treffer.x = von.x + d.x * best; treffer.y = von.y + d.y * best; treffer.z = von.z + d.z * best;
    treffer.id = id; treffer.art = art; treffer.daten = id === null ? undefined : daten;
    return treffer;
  }

  return {
    ...welt,                                   // übrige Adapter-Felder (normale, biomBei, zuGitter …) durchreichen
    basis: welt, bodenHoehe, hindernisse, fuege, bewege, strahl,
    wasserHoehe: (x, z) => (welt.wasserHoehe ? welt.wasserHoehe(x, z) : null),
    entferne: (id) => gitter.entferne(id),
    hole: (id) => gitter.hole(id)?.daten,
    /** fn(koerper, abstandZumRand) für alle Körper im Umkreis. */
    imUmkreis: (x, z, radius, fn) => gitter.imUmkreis(x, z, radius, (e, a) => fn(e.daten, a)),
    get anzahl() { return gitter.anzahl; },
    dispose() { gitter.dispose(); },
  };
}
