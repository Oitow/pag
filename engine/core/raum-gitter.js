/**
 * @modul    raum-gitter
 * @zweck    Räumliches Raster (Spatial Hash in x/z) für bewegliche Dinge: Einträge mit id setzen/verschieben/entfernen und schnell alle im Umkreis finden – Grundlage für Kollision, Interaktion, Sinne und Sichtbereiche (Mehrspieler)
 * @api      createRaumGitter({zelle}) -> {setze(id,x,z,radius?,daten?),entferne(id),hat(id),hole(id),imUmkreis(x,z,radius,fn),sammle(x,z,radius,out?),naechster(x,z,radius,filter?),alle(fn),anzahl,leeren(),dispose()}
 * @beispiel
 *   import { createRaumGitter } from '../../engine/core/raum-gitter.js';
 *   const gitter = createRaumGitter({ zelle: 4 });
 *   gitter.setze('kiste-1', 10, 5, 0.5, { art: 'kiste' });      // nochmal setze(...) = verschieben
 *   gitter.imUmkreis(9, 5, 2, (e, abstand) => console.log(e.id, abstand));
 *   const nah = gitter.naechster(9, 5, 3, (e) => e.daten.art === 'kiste');
 * @tags     raum, gitter, raster, nachbarn, umkreis, kollision, abfrage, mehrspieler
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * Ein Eintrag liegt im Fach seines Mittelpunkts. Abfragen zählen den Eintrags-Radius mit: ein Eintrag gilt als „im Umkreis“,
 * wenn sein Rand den Suchkreis berührt (Abstand der Mittelpunkte ≤ radius + eintrag.radius). Der gemeldete Abstand ist der
 * Abstand zum RAND des Eintrags (≥ 0). Die Reihenfolge der Treffer hängt nur von der Reihenfolge der Aufrufe ab (deterministisch).
 */

const VERSATZ = 32768, SPANNE = 65536;

export function createRaumGitter({ zelle = 4 } = {}) {
  if (!(zelle > 0)) throw new Error('createRaumGitter: zelle muss > 0 sein');
  const faecher = new Map();   // Schlüssel → Eintrag[]
  const eintraege = new Map(); // id → Eintrag
  let maxRadius = 0;

  const fachVon = (v) => Math.floor(v / zelle);
  const schluessel = (a, b) => (a + VERSATZ) * SPANNE + (b + VERSATZ);

  function ausFach(e) {
    const l = faecher.get(e.fach);
    if (!l) return;
    const i = l.indexOf(e);
    if (i >= 0) l.splice(i, 1);
    if (!l.length) faecher.delete(e.fach);
  }

  /** Eintrag anlegen oder verschieben. radius/daten bleiben erhalten, wenn sie beim Verschieben weggelassen werden. */
  function setze(id, x, z, radius, daten) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
    let e = eintraege.get(id);
    const fach = schluessel(fachVon(x), fachVon(z));
    if (!e) {
      e = { id, x, z, radius: 0, daten: undefined, fach: NaN };
      eintraege.set(id, e);
    }
    e.x = x; e.z = z;
    if (radius !== undefined) e.radius = Math.max(0, +radius || 0);
    if (daten !== undefined) e.daten = daten;
    if (e.radius > maxRadius) maxRadius = e.radius;
    if (e.fach !== fach) {
      if (e.fach === e.fach) ausFach(e);
      e.fach = fach;
      let l = faecher.get(fach);
      if (!l) faecher.set(fach, l = []);
      l.push(e);
    }
    return e;
  }

  function entferne(id) {
    const e = eintraege.get(id);
    if (!e) return false;
    ausFach(e);
    eintraege.delete(id);
    if (!eintraege.size) maxRadius = 0;
    return true;
  }

  /** Ruft fn(eintrag, abstandZumRand) für alle im Umkreis; gibt fn `true` zurück, endet die Suche. Liefert die Trefferzahl. */
  function imUmkreis(x, z, radius, fn) {
    const reich = radius + maxRadius;
    const a0 = fachVon(x - reich), a1 = fachVon(x + reich), b0 = fachVon(z - reich), b1 = fachVon(z + reich);
    let treffer = 0;
    for (let a = a0; a <= a1; a++) for (let b = b0; b <= b1; b++) {
      const l = faecher.get(schluessel(a, b));
      if (!l) continue;
      for (let i = 0; i < l.length; i++) {
        const e = l[i], dx = e.x - x, dz = e.z - z, max = radius + e.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 > max * max) continue;
        treffer++;
        if (fn && fn(e, Math.max(0, Math.sqrt(d2) - e.radius)) === true) return treffer;
      }
    }
    return treffer;
  }

  function sammle(x, z, radius, out = []) {
    out.length = 0;
    imUmkreis(x, z, radius, (e) => { out.push(e); });
    return out;
  }

  /** Nächster Eintrag (Abstand zum Rand) im Umkreis, optional gefiltert; bei Gleichstand gewinnt der zuerst gefundene. */
  function naechster(x, z, radius, filter) {
    let best = null, bestD = Infinity;
    imUmkreis(x, z, radius, (e, d) => { if (d < bestD && (!filter || filter(e))) { best = e; bestD = d; } });
    return best;
  }

  return {
    zelle, setze, entferne, imUmkreis, sammle, naechster,
    hat: (id) => eintraege.has(id),
    hole: (id) => eintraege.get(id),
    alle(fn) { for (const e of eintraege.values()) fn(e); },
    get anzahl() { return eintraege.size; },
    leeren() { faecher.clear(); eintraege.clear(); maxRadius = 0; },
    dispose() { faecher.clear(); eintraege.clear(); },
  };
}
