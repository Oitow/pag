/**
 * @modul    chunk-strom
 * @zweck    Gelände-Kacheln um einen Fokus streamen (reine Logik): Quadtree-Detailstufen (nah fein, fern grob) bis zur Sichtweite, Bau-Budget je Bild, alte Kacheln bleiben, bis die neuen fertig sind (keine Löcher); dazu ein einfacher Kachel-Ring für Nahbereichs-Daten (Streu, Kollision)
 * @api      createChunkStrom({wurzel,blatt,teilung,sicht,budget,grenze,baue(k)->obj,entferne(k,obj)}) -> {update(fx,fz)->{gebaut,entfernt,offen},waehle(fx,fz)->[k],geladen:Map,anzahl,fertig,dispose()} ; createKachelRing({groesse,radius,budget,lade(k)->obj,entlade(k,obj)}) -> {update(fx,fz)->{geladen,entladen,offen},geladen:Map,neuLaden(fn?),dispose()}
 * @beispiel
 *   import { createChunkStrom } from '../../engine/world/chunk-strom.js';
 *   const strom = createChunkStrom({ wurzel: 512, blatt: 64, sicht: 800, baue: (k) => baueMesh(k), entferne: (k, m) => m.dispose() });
 *   strom.update(spieler.x, spieler.z);   // je Bild: baut höchstens `budget` Kacheln, nächste zuerst
 *   // k = { key, x0, z0, groesse, stufe (0 = feinste), cx, cz }
 * @tags     welt, streaming, chunks, kacheln, lod, quadtree, detailstufen, gelaende, unendlich
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */

const schluessel = (stufe, cx, cz) => `${stufe}:${cx}:${cz}`;
const boxAbstand = (fx, fz, x0, z0, g) => {
  const dx = Math.max(x0 - fx, 0, fx - (x0 + g)), dz = Math.max(z0 - fz, 0, fz - (z0 + g));
  return Math.hypot(dx, dz);
};

/**
 * Quadtree-Strom. Eine Kachel wird geteilt, solange ihr Abstand zum Fokus < groesse × teilung ist und sie größer als `blatt` ist.
 * grenze (optional): {x0,z0,x1,z1} – nur Wurzeln darin. budget: Kacheln je update (Standard 2), beim ersten Aufruf mit
 * update(fx, fz, Infinity) alles auf einmal.
 */
export function createChunkStrom({
  wurzel = 512, blatt = 64, teilung = 1.25, sicht = 800, budget = 2, grenze = null,
  baue = () => ({}), entferne = () => {},
} = {}) {
  const stufen = Math.max(0, Math.round(Math.log2(wurzel / blatt)));
  const geladen = new Map();   // key → { k, obj }
  let gewuenscht = new Map();
  let letzt = null;

  function teile(liste, x0, z0, g, stufe, fx, fz) {
    const d = boxAbstand(fx, fz, x0, z0, g);
    if (d > sicht) return;
    if (stufe > 0 && d < g * teilung) {
      const h = g / 2;
      teile(liste, x0, z0, h, stufe - 1, fx, fz); teile(liste, x0 + h, z0, h, stufe - 1, fx, fz);
      teile(liste, x0, z0 + h, h, stufe - 1, fx, fz); teile(liste, x0 + h, z0 + h, h, stufe - 1, fx, fz);
      return;
    }
    const cx = Math.round(x0 / g), cz = Math.round(z0 / g);
    liste.push({ key: schluessel(stufe, cx, cz), x0, z0, groesse: g, stufe, cx, cz, abstand: d });
  }

  /** Gewünschte Blätter um den Fokus (nach Abstand sortiert). */
  function waehle(fx, fz) {
    const liste = [];
    const r = sicht + wurzel;
    let i0 = Math.floor((fx - r) / wurzel), i1 = Math.floor((fx + r) / wurzel);
    let j0 = Math.floor((fz - r) / wurzel), j1 = Math.floor((fz + r) / wurzel);
    if (grenze) {
      i0 = Math.max(i0, Math.floor(grenze.x0 / wurzel)); i1 = Math.min(i1, Math.ceil(grenze.x1 / wurzel) - 1);
      j0 = Math.max(j0, Math.floor(grenze.z0 / wurzel)); j1 = Math.min(j1, Math.ceil(grenze.z1 / wurzel) - 1);
    }
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) teile(liste, i * wurzel, j * wurzel, wurzel, stufen, fx, fz);
    return liste.sort((a, b) => a.abstand - b.abstand || a.stufe - b.stufe);
  }

  const ueberlappt = (a, b) => a.x0 < b.x0 + b.groesse && b.x0 < a.x0 + a.groesse && a.z0 < b.z0 + b.groesse && b.z0 < a.z0 + a.groesse;

  function update(fx, fz, max = budget) {
    if (!letzt || Math.abs(fx - letzt.x) > blatt / 8 || Math.abs(fz - letzt.z) > blatt / 8) {
      gewuenscht = new Map(waehle(fx, fz).map((k) => [k.key, k]));
      letzt = { x: fx, z: fz };
    }
    let gebaut = 0, entfernt = 0, offen = 0;
    for (const k of gewuenscht.values()) {
      if (geladen.has(k.key)) continue;
      if (gebaut >= max) { offen++; continue; }
      geladen.set(k.key, { k, obj: baue(k) }); gebaut++;
    }
    // Alte Kacheln erst weg, wenn alles Gewünschte darüber fertig ist (sonst Löcher beim Stufenwechsel)
    for (const [key, e] of geladen) {
      if (gewuenscht.has(key)) continue;
      let deckt = true;
      for (const k of gewuenscht.values()) if (!geladen.has(k.key) && ueberlappt(k, e.k)) { deckt = false; break; }
      if (!deckt) continue;
      entferne(e.k, e.obj); geladen.delete(key); entfernt++;
    }
    return { gebaut, entfernt, offen };
  }

  return {
    update, waehle, geladen, stufen,
    get anzahl() { return geladen.size; },
    get fertig() { for (const k of gewuenscht.keys()) if (!geladen.has(k)) return false; return true; },
    dispose() { for (const e of geladen.values()) entferne(e.k, e.obj); geladen.clear(); gewuenscht.clear(); },
  };
}

/** Gleich große Kacheln im Umkreis `radius` um den Fokus laden/entladen (nächste zuerst, höchstens `budget` je update). */
export function createKachelRing({ groesse = 64, radius = 150, budget = 2, lade = () => ({}), entlade = () => {} } = {}) {
  const geladen = new Map();
  function update(fx, fz, max = budget) {
    const r = Math.ceil(radius / groesse), ci = Math.floor(fx / groesse), cj = Math.floor(fz / groesse);
    const soll = [];
    for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
      const d = boxAbstand(fx, fz, i * groesse, j * groesse, groesse);
      if (d <= radius) soll.push({ key: `${i}:${j}`, cx: i, cz: j, x0: i * groesse, z0: j * groesse, groesse, abstand: d });
    }
    soll.sort((a, b) => a.abstand - b.abstand);
    const sollKeys = new Set(soll.map((k) => k.key));
    let entladen = 0, neu = 0, offen = 0;
    for (const [key, e] of geladen) {
      // etwas Nachlauf (eine halbe Kachel), damit am Rand nicht ständig geladen/entladen wird
      if (sollKeys.has(key) || boxAbstand(fx, fz, e.k.x0, e.k.z0, groesse) <= radius + groesse * 0.5) continue;
      entlade(e.k, e.obj); geladen.delete(key); entladen++;
    }
    for (const k of soll) {
      if (geladen.has(k.key)) continue;
      if (neu >= max) { offen++; continue; }
      geladen.set(k.key, { k, obj: lade(k) }); neu++;
    }
    return { geladen: neu, entladen, offen };
  }
  return {
    update, geladen,
    /** Kacheln neu laden (alle oder die, für die fn(k) wahr ist) – z. B. nach sperreObjekte. */
    neuLaden(fn = () => true) {
      for (const [key, e] of geladen) if (fn(e.k)) { entlade(e.k, e.obj); geladen.set(key, { k: e.k, obj: lade(e.k) }); }
    },
    dispose() { for (const e of geladen.values()) entlade(e.k, e.obj); geladen.clear(); },
  };
}
