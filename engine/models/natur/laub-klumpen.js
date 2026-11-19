/**
 * @modul    laub-klumpen
 * @zweck    Dichtes Laub als Blatt-Karten-Klumpen (rein, ohne THREE): je Kronen-Büschel viele Karten in einem abgeflachten Ellipsoid, Kern dunkel, Rand hell; ausdünnen (LOD) und in Weltkoordinaten sammeln
 * @api      laubKarten(krone, { seed, dichte = 1, groesse = 1, H = 110, kronenAb = 60, farben }) -> karten { anzahl, mitte Float32Array(3n), normale Float32Array(3n), farbe Float32Array(3n), daten Float32Array(3n) [halbeGroesse, tiefe 0..1, phase 0..1] } ; duenneKarten(karten, anteil, seed) -> karten ; sammleKarten([{ karten, matrix (16 Zahlen, spaltenweise wie THREE.Matrix4.elements), anteil = 1, seed }]) -> karten (Welt) ; LAUB_FARBEN
 * @beispiel
 *   import { baueForm } from './riesenbaum-form.js';
 *   import { laubKarten, sammleKarten } from './laub-klumpen.js';
 *   const form = baueForm({ seed: 11, hoehe: 112 });
 *   const k = laubKarten(form.krone, { seed: 11, H: 112, kronenAb: form.masse.kronenAb });
 *   const welt = sammleKarten([{ karten: k, matrix: instanz.matrix.elements, anteil: 0.5 }]);   // → engine/render/laub-karten.js
 * @tags     natur, baum, riesenbaum, krone, laub, blatt, karten, lod, instanzen, daemmerwald
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { rng, hashSeed, hash2 } from '../../core/rng.js';
import { farbeLin, mische } from './riesenbaum-krone.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const stufe = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** Gedämpfte Laubtöne (dunkel-olive/blaugrün, ART-DIRECTION §3), linear. */
export const LAUB_FARBEN = ['#1a2b1d', '#223823', '#2c4026', '#38492b', '#4a5832'].map(farbeLin);

function leer(n) {
  return { anzahl: 0, mitte: new Float32Array(n * 3), normale: new Float32Array(n * 3), farbe: new Float32Array(n * 3), daten: new Float32Array(n * 3) };
}

/**
 * Blatt-Karten für eine Krone (Büschel aus riesenbaum-krone.baueKrone). Karten sitzen gestaffelt von innen (dunkel, deckend) bis außen (hell, lückig),
 * jede ist etwa 0.4–0.55 × Büschelradius groß, damit die Klumpen sicher geschlossen wirken.
 */
export function laubKarten(krone, { seed = 1, dichte = 1, groesse = 1, H = 110, kronenAb = 60, farben = LAUB_FARBEN } = {}) {
  const r = rng(hashSeed('laub-klumpen', seed)), rr = (a, b) => a + (b - a) * r(), m = H / 110;
  const soll = krone.buschel.map((b) => Math.max(4, Math.round(30 * dichte * (b.r / (8 * m)) ** 2)));
  const k = leer(soll.reduce((s, n) => s + n, 0));
  let i = 0;
  krone.buschel.forEach((b, nr) => {
    for (let j = 0; j < soll[nr]; j++, i++) {
      let dx = rr(-1, 1), dy = rr(-0.75, 1), dz = rr(-1, 1);
      const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
      const tief = j < soll[nr] * 0.22 ? rr(0.1, 0.45) : 0.5 + 0.5 * Math.cbrt(r());      // erst ein deckender Kern, dann die Schale
      const rad = b.r * tief * 0.86;
      k.mitte.set([b.m[0] + dx * rad, b.m[1] + dy * rad * 0.66, b.m[2] + dz * rad], i * 3);
      let nx = dx * 0.75, ny = dy * 0.75 + 0.35, nz = dz * 0.75;
      const nl = Math.hypot(nx, ny, nz) || 1;
      k.normale.set([nx / nl, ny / nl, nz / nl], i * 3);
      const ton = clamp(0.45 * stufe(-0.6, 0.9, dy) + 0.4 * r() + 0.25 * tief - 0.1, 0, 0.999) * (farben.length - 1), ti = Math.floor(ton);
      const hoch = clamp((b.m[1] - kronenAb) / Math.max(1, H - kronenAb), 0, 1);
      const hell = (0.8 + 0.25 * hoch) * rr(0.88, 1.1);
      const f = mische(farben[ti], farben[ti + 1], ton - ti);
      k.farbe.set([f[0] * hell, f[1] * hell, f[2] * hell], i * 3);
      k.daten.set([b.r * groesse * rr(0.4, 0.55) * (0.85 + 0.3 * tief), tief, r()], i * 3);
    }
  });
  k.anzahl = i;
  return k;
}

/** Jede n-te Karte behalten (per Hash, stabil); die übrigen wachsen, damit die Klumpen geschlossen bleiben (Fern-LOD). */
export function duenneKarten(karten, anteil, seed = 1) {
  if (anteil >= 1) return karten;
  const k = leer(karten.anzahl), gross = Math.min(1.8, Math.pow(Math.max(anteil, 0.05), -0.4));
  for (let i = 0; i < karten.anzahl; i++) {
    if (hash2(i, 29, seed) >= anteil) continue;
    const n = k.anzahl++;
    k.mitte.set(karten.mitte.subarray(i * 3, i * 3 + 3), n * 3); k.normale.set(karten.normale.subarray(i * 3, i * 3 + 3), n * 3);
    k.farbe.set(karten.farbe.subarray(i * 3, i * 3 + 3), n * 3);
    k.daten.set([karten.daten[i * 3] * gross, karten.daten[i * 3 + 1], karten.daten[i * 3 + 2]], n * 3);
  }
  return k;
}

/** Mehrere Kronen (je mit 4×4-Matrix, spaltenweise) zu EINEM Kartensatz in Weltkoordinaten vereinen – ein Draw-Call für alle. */
export function sammleKarten(eintraege) {
  const teile = eintraege.map((e) => ({ ...e, k: duenneKarten(e.karten, e.anteil ?? 1, e.seed ?? 1) }));
  const k = leer(teile.reduce((s, t) => s + t.k.anzahl, 0));
  for (const { k: q, matrix: e } of teile) {
    const sk = Math.cbrt(Math.abs(e[0] * (e[5] * e[10] - e[6] * e[9]) - e[4] * (e[1] * e[10] - e[2] * e[9]) + e[8] * (e[1] * e[6] - e[2] * e[5]))) || 1;
    for (let i = 0; i < q.anzahl; i++, k.anzahl++) {
      const x = q.mitte[i * 3], y = q.mitte[i * 3 + 1], z = q.mitte[i * 3 + 2], n = k.anzahl * 3;
      k.mitte[n] = e[0] * x + e[4] * y + e[8] * z + e[12]; k.mitte[n + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; k.mitte[n + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      const a = q.normale[i * 3], b = q.normale[i * 3 + 1], c = q.normale[i * 3 + 2];
      const nx = e[0] * a + e[4] * b + e[8] * c, ny = e[1] * a + e[5] * b + e[9] * c, nz = e[2] * a + e[6] * b + e[10] * c, l = Math.hypot(nx, ny, nz) || 1;
      k.normale[n] = nx / l; k.normale[n + 1] = ny / l; k.normale[n + 2] = nz / l;
      k.farbe.set(q.farbe.subarray(i * 3, i * 3 + 3), n);
      k.daten[n] = q.daten[i * 3] * sk; k.daten[n + 1] = q.daten[i * 3 + 1]; k.daten[n + 2] = q.daten[i * 3 + 2];
    }
  }
  return k;
}
