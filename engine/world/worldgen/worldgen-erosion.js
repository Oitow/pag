/**
 * @modul    worldgen-erosion
 * @zweck    Schnelle hydraulische Tropfen-Erosion (mit Pinsel-Abtrag) und thermische Erosion auf einem Float32-Höhenfeld; Qualitätsstufen schnell/normal/hoch
 * @api      erodiereHydraulisch(H,b,t,p) -> void ; erodiereThermisch(H,b,t,iterationen,talus,rate) -> void ; stufeErosion(welt, opts) -> void ; QUALITAET
 * @beispiel
 *   import { erodiereHydraulisch } from '../../engine/world/worldgen/worldgen-erosion.js';
 *   erodiereHydraulisch(hoehe, 256, 256, { tropfen: 40000, seed: 3 });
 * @tags     welt, worldgen, erosion, terrain, hydraulik
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { rng, hashSeed } from '../../core/rng.js';

/** Qualitätsstufen: Tropfen pro Zelle, Lebensdauer, Pinselradius, thermische Durchläufe. */
export const QUALITAET = {
  schnell: { tropfen: 0.3, leben: 24, radius: 2, thermisch: 2 },
  normal: { tropfen: 0.7, leben: 30, radius: 2, thermisch: 3 },
  hoch: { tropfen: 1.5, leben: 40, radius: 3, thermisch: 6 },
};

/** Vorberechneter Pinsel (Versätze + normierte Gewichte) für den Abtrag. */
function pinsel(r) {
  const ox = [], oy = [], w = [];
  let sum = 0;
  const R = Math.ceil(r);
  for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
    const d = Math.sqrt(x * x + y * y);
    if (d < r) { ox.push(x); oy.push(y); const g = r - d; w.push(g); sum += g; }
  }
  return { ox: Int8Array.from(ox), oy: Int8Array.from(oy), w: Float32Array.from(w, g => g / sum), n: ox.length };
}

/**
 * Hydraulische Tropfen-Erosion (nach H. Beyer / S. Lague, korrigierte Geschwindigkeit).
 * p: { tropfen, leben, radius, traegheit, kapazitaet, minKapazitaet, abtrag, ablagerung, verdunstung, schwerkraft, meer, seed }
 */
export function erodiereHydraulisch(H, b, t, p = {}) {
  const anzahl = p.tropfen ?? Math.round(b * t * 0.7);
  const leben = p.leben ?? 30, tr = p.traegheit ?? 0.05, kap = p.kapazitaet ?? 4;
  const minKap = p.minKapazitaet ?? 0.01, abtrag = p.abtrag ?? 0.3, abl = p.ablagerung ?? 0.3;
  const verd = p.verdunstung ?? 0.02, g = p.schwerkraft ?? 4, meer = p.meer ?? -0.05;
  const P = pinsel(p.radius ?? 2), pn = P.n, pox = P.ox, poy = P.oy, pw = P.w;
  const r = rng(hashSeed(p.seed ?? 1, 'erosion'));
  const R = Math.ceil(p.radius ?? 2);
  const xmin = R, ymin = R, xmax = b - 1 - R, ymax = t - 1 - R;
  if (xmax <= xmin + 1 || ymax <= ymin + 1) return;

  for (let d = 0; d < anzahl; d++) {
    let x = xmin + r() * (xmax - xmin), y = ymin + r() * (ymax - ymin);
    let dx = 0, dy = 0, v = 1, w = 1, sed = 0;
    for (let s = 0; s < leben; s++) {
      const ix = x | 0, iy = y | 0, fx = x - ix, fy = y - iy, i = iy * b + ix;
      const a = H[i], c = H[i + 1], e = H[i + b], f = H[i + b + 1];
      const gx = (c - a) * (1 - fy) + (f - e) * fy, gy = (e - a) * (1 - fx) + (f - c) * fx;
      const hAlt = a + (c - a) * fx + (e - a) * fy + (a - c - e + f) * fx * fy;
      if (hAlt < meer) { // im Meer: Sediment fallen lassen
        H[i] += sed * (1 - fx) * (1 - fy); H[i + 1] += sed * fx * (1 - fy);
        H[i + b] += sed * (1 - fx) * fy; H[i + b + 1] += sed * fx * fy;
        break;
      }
      dx = dx * tr - gx * (1 - tr); dy = dy * tr - gy * (1 - tr);
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1e-9) break;
      dx /= len; dy /= len;
      const nx = x + dx, ny = y + dy;
      if (nx < xmin || ny < ymin || nx >= xmax || ny >= ymax) break;
      const jx = nx | 0, jy = ny | 0, kx = nx - jx, ky = ny - jy, j = jy * b + jx;
      const A = H[j], C = H[j + 1], E = H[j + b], F = H[j + b + 1];
      const hNeu = A + (C - A) * kx + (E - A) * ky + (A - C - E + F) * kx * ky;
      const dh = hNeu - hAlt;
      let kapaz = -dh * v * w * kap;
      if (kapaz < minKap) kapaz = minKap;
      if (sed > kapaz || dh > 0) {
        const menge = dh > 0 ? (dh < sed ? dh : sed) : (sed - kapaz) * abl;
        sed -= menge;
        H[i] += menge * (1 - fx) * (1 - fy); H[i + 1] += menge * fx * (1 - fy);
        H[i + b] += menge * (1 - fx) * fy; H[i + b + 1] += menge * fx * fy;
      } else {
        let menge = (kapaz - sed) * abtrag;
        if (menge > -dh) menge = -dh;
        for (let k = 0; k < pn; k++) {
          const q = i + poy[k] * b + pox[k], m = menge * pw[k];
          H[q] -= m; sed += m;
        }
      }
      const vv = v * v - dh * g;
      v = vv > 0 ? Math.sqrt(vv) : 0.01;
      w *= 1 - verd;
      x = nx; y = ny;
    }
  }
}

/**
 * Thermische Erosion: Material rutscht ab, wo das Gefälle zum steilsten Nachbarn den Schüttwinkel (talus) übersteigt.
 */
export function erodiereThermisch(H, b, t, iterationen = 3, talus = 0.02, rate = 0.5) {
  for (let it = 0; it < iterationen; it++) {
    for (let y = 1; y < t - 1; y++) {
      for (let x = 1; x < b - 1; x++) {
        const i = y * b + x, h = H[i];
        let maxD = 0, ziel = -1, d;
        d = h - H[i - 1]; if (d > maxD) { maxD = d; ziel = i - 1; }
        d = h - H[i + 1]; if (d > maxD) { maxD = d; ziel = i + 1; }
        d = h - H[i - b]; if (d > maxD) { maxD = d; ziel = i - b; }
        d = h - H[i + b]; if (d > maxD) { maxD = d; ziel = i + b; }
        if (maxD > talus) {
          const m = (maxD - talus) * 0.5 * rate;
          H[i] -= m; H[ziel] += m;
        }
      }
    }
  }
}

/** Pipeline-Stufe: Erosion je nach opts.erosion und opts.qualitaet. Arbeitet auf auflösungsunabhängig skalierten Höhen. */
export function stufeErosion(welt, opts) {
  const E = opts.erosion || {};
  if (E.aktiv === false) return;
  const q = QUALITAET[opts.qualitaet] || QUALITAET.normal;
  const { breite: b, tiefe: t, hoehe: H } = welt;
  const n = b * t;
  // Höhen so skalieren, dass Gefälle pro Zelle bei jeder Auflösung gleich wirken (Bezug: 256er-Karte).
  const k = Math.max(b, t) / 256;
  if (k !== 1) for (let i = 0; i < n; i++) H[i] *= k;
  const staerke = E.staerke ?? 1;
  erodiereHydraulisch(H, b, t, {
    tropfen: Math.round(n * q.tropfen * staerke), leben: E.leben ?? q.leben, radius: E.radius ?? q.radius,
    traegheit: E.traegheit, kapazitaet: E.kapazitaet, abtrag: E.abtrag, ablagerung: E.ablagerung,
    verdunstung: E.verdunstung, schwerkraft: E.schwerkraft, meer: -0.05 * k, seed: opts.seed,
  });
  const th = E.thermisch ?? 1;
  if (th > 0) erodiereThermisch(H, b, t, Math.round(q.thermisch * th), (E.talus ?? 0.025), 0.5);
  if (k !== 1) for (let i = 0; i < n; i++) H[i] /= k;
}
