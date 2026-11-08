/**
 * @modul    worldgen-rivers
 * @zweck    Flüsse aus der Abflussmenge: Flusszellen mit Breite, Flussbett eingraben, Ufer abflachen, geglättete Flusslinien (Quelle → Meer/See) erzeugen
 * @api      stufeFluesse(welt, opts) -> void ; flussLinien(welt, schwelle, glaetten?) -> [{punkte,breite,muendung}] ; chaikin(punkte, breite, iterationen) -> {punkte,breite}
 * @beispiel
 *   import { stufeFluesse } from '../../engine/world/worldgen/worldgen-rivers.js';
 *   stufeFluesse(welt, { wasser: { flussMenge: 0.6, flussTiefe: 0.02 } });
 *   for (const f of welt.fluesse) console.log(f.muendung, f.punkte.length / 2);
 * @tags     welt, worldgen, fluss, wasser, abfluss
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { FLAG } from './worldgen-grid.js';
import { smoothstep } from '../../core/math.js';

/** Chaikin-Glättung einer Linie (x,y-Paare) mit mitlaufender Breite; Endpunkte bleiben fest. */
export function chaikin(punkte, breite, iterationen = 2) {
  let P = punkte, B = breite;
  for (let it = 0; it < iterationen; it++) {
    const m = P.length / 2;
    if (m < 3) break;
    const Q = new Float32Array((2 * (m - 1)) * 2 + 4), C = new Float32Array(2 * (m - 1) + 2);
    let q = 0, c = 0;
    Q[q++] = P[0]; Q[q++] = P[1]; C[c++] = B[0];
    for (let k = 0; k < m - 1; k++) {
      const ax = P[2 * k], ay = P[2 * k + 1], bx = P[2 * k + 2], by = P[2 * k + 3];
      Q[q++] = ax * 0.75 + bx * 0.25; Q[q++] = ay * 0.75 + by * 0.25; C[c++] = B[k] * 0.75 + B[k + 1] * 0.25;
      Q[q++] = ax * 0.25 + bx * 0.75; Q[q++] = ay * 0.25 + by * 0.75; C[c++] = B[k] * 0.25 + B[k + 1] * 0.75;
    }
    Q[q++] = P[2 * m - 2]; Q[q++] = P[2 * m - 1]; C[c++] = B[m - 1];
    P = Q; B = C;
  }
  return { punkte: P, breite: B };
}

/**
 * Verfolgt jedes Flusssystem von seinen Quellen abwärts bis Meer, See, Kartenrand oder Einmündung.
 * Gibt Linien in Weltkoordinaten zurück: { punkte: Float32Array [x,y,…], breite: Float32Array, muendung: 'meer'|'see'|'rand'|'fluss', laenge }
 */
export function flussLinien(welt, schwelle, glaetten = 2) {
  const { breite: b, tiefe: t, flags: FL, ziel, abfluss: A, flussBreite: FB, zelle } = welt;
  const n = b * t;
  const istFluss = i => (FL[i] & FLAG.FLUSS) && A[i] >= schwelle;
  const hatZufluss = new Uint8Array(n), besucht = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (istFluss(i) && ziel[i] >= 0 && istFluss(ziel[i])) hatZufluss[ziel[i]] = 1;
  const pfad = new Int32Array(n);
  const linien = [];
  for (let s = 0; s < n; s++) {
    if (!istFluss(s) || hatZufluss[s]) continue;
    let k = 0, i = s, muendung = 'rand';
    while (i >= 0) {
      pfad[k++] = i;
      if (besucht[i]) { muendung = 'fluss'; break; }
      besucht[i] = 1;
      const z = ziel[i];
      if (z < 0) { muendung = FL[i] & FLAG.OZEAN ? 'meer' : 'rand'; break; }
      if (FL[z] & FLAG.OZEAN) { pfad[k++] = z; muendung = 'meer'; break; }
      if (FL[z] & FLAG.SEE) { pfad[k++] = z; muendung = 'see'; break; }
      i = z;
    }
    if (k < 4) continue;
    const P = new Float32Array(k * 2), B = new Float32Array(k);
    for (let m = 0; m < k; m++) {
      const c = pfad[m];
      P[2 * m] = (c % b) * zelle; P[2 * m + 1] = ((c / b) | 0) * zelle;
      B[m] = Math.max(0.5, FB[c] || FB[pfad[m > 0 ? m - 1 : 0]]) * zelle;
    }
    const g = chaikin(P, B, glaetten);
    linien.push({ punkte: g.punkte, breite: g.breite, muendung, laenge: k });
  }
  return linien;
}

/**
 * Pipeline-Stufe Flüsse. Setzt FLAG.FLUSS, welt.flussBreite (Zellen), gräbt Flussbetten ein und füllt welt.fluesse.
 * opts.wasser: { fluesse, flussMenge (0..1+), flussSchwelle (Zellen, überschreibt Menge), flussBreite, maxBreite, flussTiefe, ufer, glaetten,
 *                tal: { tiefe, breite, form: 'v'|'schlucht', maxBreite } }
 */
export function stufeFluesse(welt, opts) {
  const W = opts.wasser || {};
  const { breite: b, tiefe: t, hoehe: H, flags: FL, wasserstand: WS, abfluss: A } = welt;
  const n = b * t;
  welt.flussBreite = new Float32Array(n);
  welt.fluesse = [];
  if (W.fluesse === false || !A) return;
  const menge = Math.max(0.02, W.flussMenge ?? 0.6);
  const schwelle = W.flussSchwelle ?? Math.max(12, (n * 0.0035) / menge);
  welt.flussSchwelle = schwelle;
  const bF = W.flussBreite ?? 0.8, maxB = W.maxBreite ?? 7 * Math.max(1, Math.max(b, t) / 256);
  const tiefe = W.flussTiefe ?? 0.02, ufer = W.ufer ?? 1.6;
  const FB = welt.flussBreite;
  const WATER = FLAG.OZEAN | FLAG.SEE;

  // Flusszellen + Breite
  const liste = [];
  for (let i = 0; i < n; i++) {
    if (A[i] < schwelle || FL[i] & WATER) continue;
    let w = bF * Math.sqrt(A[i] / schwelle);
    if (w > maxB) w = maxB;
    FB[i] = w; FL[i] |= FLAG.FLUSS; liste.push(i);
  }
  // Flussbett: Höhen der Mittelzellen vor dem Eingraben merken (sonst gräbt sich der Fluss selbst tiefer)
  const pegel = new Float32Array(liste.length);
  for (let k = 0; k < liste.length; k++) pegel[k] = H[liste[k]];
  // Optional: Täler/Schluchten entlang des Flussnetzes (tal: { tiefe, breite, form: 'v'|'schlucht', maxBreite })
  const tal = W.tal;
  if (tal && (tal.tiefe ?? 0) > 0) {
    const tT = tal.tiefe, tB = tal.breite ?? 3, steil = tal.form === 'schlucht';
    const tMax = (tal.maxBreite ?? 14) * Math.max(1, Math.max(b, t) / 256);
    for (let k = 0; k < liste.length; k++) {
      const i = liste[k], cx = i % b, cy = (i - cx) / b, q = Math.sqrt(A[i] / schwelle);
      const R = Math.min(tMax, tB * (0.6 + 0.4 * q)), D = tT * Math.min(1, 0.35 + q * 0.2);
      const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(b - 1, Math.ceil(cx + R));
      const y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(t - 1, Math.ceil(cy + R));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const j = y * b + x;
        if (FL[j] & WATER) continue;
        const d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) / R;
        if (d >= 1) continue;
        const prof = steil ? 1 - smoothstep(0.55, 1, d) : 1 - d;
        const z = pegel[k] - D * prof;
        if (z < H[j]) H[j] = z;
      }
      pegel[k] -= D;
    }
  }
  const WSneu = new Float32Array(n).fill(1e9);
  for (let k = 0; k < liste.length; k++) {
    const i = liste[k], cx = i % b, cy = (i - cx) / b;
    const r = Math.max(0.5, FB[i] * 0.5), R = r + ufer;
    const lvl = pegel[k], d0 = tiefe * (0.5 + 0.5 * Math.min(1, FB[i] / 3));
    const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(b - 1, Math.ceil(cx + R));
    const y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(t - 1, Math.ceil(cy + R));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const j = y * b + x;
      if (FL[j] & WATER) continue;
      const dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy);
      if (d > R) continue;
      let ziel;
      if (d <= r) {
        const q = d / r;
        ziel = lvl - d0 * (1 - q * q * 0.5);
        FL[j] |= FLAG.FLUSS;
        if (FB[j] < FB[i]) FB[j] = FB[i];
        const ws = lvl - d0 * 0.2;
        if (ws < WSneu[j]) WSneu[j] = ws;
      } else {
        const q = (d - r) / ufer;
        ziel = (lvl - d0 * 0.3) * (1 - q) + H[j] * q;
      }
      if (ziel < H[j]) H[j] = ziel;
    }
  }
  for (let i = 0; i < n; i++) {
    if (!(FL[i] & FLAG.FLUSS)) continue;
    let ws = WSneu[i] < 1e8 ? WSneu[i] : H[i] + tiefe * 0.3;
    if (ws <= H[i]) ws = H[i] + 0.002;
    WS[i] = ws;
  }
  welt.fluesse = flussLinien(welt, schwelle, W.glaetten ?? 2);
}
