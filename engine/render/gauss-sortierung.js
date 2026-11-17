/**
 * @modul    gauss-sortierung
 * @zweck    Tiefen-Sortierung für Gauß-Splats: 16-Bit-Zähl-Sortierung entlang der Blickrichtung (hinten→vorn), ohne Allokation je Aufruf – 120 k Splats in ~1–3 ms
 * @api      createTiefenSortierer(max) -> { max, sortiere(position ‹Float32Array 3n›, anzahl, blick ‹[x,y,z]›, auge ‹[x,y,z]›) -> Uint32Array Reihenfolge hinten→vorn – gleicher Puffer bei jedem Aufruf }
 * @beispiel
 *   import { createTiefenSortierer } from '../../engine/render/gauss-sortierung.js';
 *   const sortierer = createTiefenSortierer(120000);
 *   const reihenfolge = sortierer.sortiere(positionen, anzahl, [0, 0, -1], [0, 2, 10]);   // reihenfolge[0] = fernster Splat
 * @tags     splat, gauss, gaussian, sortierung, tiefe, transparenz, zaehlsortierung, radix
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */

const STUFEN = 65536;

/** Sortierer mit festen Puffern für höchstens `max` Punkte. Das Ergebnis wird beim nächsten Aufruf überschrieben. */
export function createTiefenSortierer(max) {
  const grenze = Math.max(1, max | 0);
  const tiefe = new Float32Array(grenze);          // Abstand entlang des Blicks
  const schluessel = new Uint16Array(grenze);      // 0 = am fernsten
  const reihen = new Uint32Array(grenze);
  const zaehler = new Uint32Array(STUFEN);
  let sicht = reihen, sichtLaenge = grenze;        // Teil-Ansicht nur neu anlegen, wenn sich die Anzahl ändert

  function sortiere(position, anzahl, blick, auge = null) {
    const n = Math.max(0, Math.min(anzahl | 0, grenze, (position.length / 3) | 0));
    if (n !== sichtLaenge) { sicht = reihen.subarray(0, n); sichtLaenge = n; }
    if (n === 0) return sicht;
    const bx = blick[0], by = blick[1], bz = blick[2];
    const ax = auge ? auge[0] : 0, ay = auge ? auge[1] : 0, az = auge ? auge[2] : 0;
    let min = Infinity, maxT = -Infinity;
    for (let i = 0, j = 0; i < n; i++, j += 3) {
      const t = (position[j] - ax) * bx + (position[j + 1] - ay) * by + (position[j + 2] - az) * bz;
      tiefe[i] = t;
      if (t < min) min = t;
      if (t > maxT) maxT = t;
    }
    const spanne = maxT - min;
    const f = spanne > 0 && Number.isFinite(spanne) ? (STUFEN - 1) / spanne : 0;
    zaehler.fill(0);
    for (let i = 0; i < n; i++) {
      const k = ((maxT - tiefe[i]) * f) | 0;       // fern → kleiner Schlüssel → zuerst gezeichnet
      schluessel[i] = k;
      zaehler[k]++;
    }
    let summe = 0;
    for (let k = 0; k < STUFEN; k++) { const c = zaehler[k]; zaehler[k] = summe; summe += c; }
    for (let i = 0; i < n; i++) reihen[zaehler[schluessel[i]]++] = i;   // stabil: gleiche Tiefe behält die Eingabe-Reihenfolge
    return sicht;
  }

  return { max: grenze, sortiere };
}
