/**
 * @modul    fels-form
 * @zweck    Reine Fels-Grundform (ohne THREE): Ico- oder Säulen-Netz, verformt mit fBm/Grat, planare Bruchkanten, Schichtung, Erosion oben, flacher Boden
 * @api      felsForm(opts) -> { punkte: Float32Array(xyz), dreiecke: Uint32Array, hoehe, radius } ; icoNetz(frequenz) ; saeulenNetz(segmente, ringe, r)
 * @beispiel
 *   import { felsForm } from '../../engine/models/natur/fels-form.js';
 *   const f = felsForm({ seed: 7, groesse: [1.2, 0.8, 1], schnitte: 5, schichten: 3 });
 *   // f.punkte (x,y,z je Ecke), f.dreiecke (Indizes, außen gegen den Uhrzeigersinn)
 * @tags     natur, fels, stein, prozedural, geometrie, lowpoly
 * @version  1.0.0
 * @status   neu
 * @three    nein
 */
import { rng, hashSeed, range } from '../../core/rng.js';
import { createNoise3D, fbm, ridged } from '../../core/noise.js';

const PHI = (1 + Math.sqrt(5)) / 2;
const ICO_P = [[-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0], [0, -1, PHI], [0, 1, PHI],
  [0, -1, -PHI], [0, 1, -PHI], [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]];
const ICO_F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6],
  [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];

/** Geodätische Kugel (Radius 1) mit Frequenz f → 20·f² Dreiecke. */
export function icoNetz(f = 2) {
  const punkte = [], dreiecke = [], map = new Map();
  const idx = (x, y, z) => {
    const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l;
    const k = `${x.toFixed(5)},${y.toFixed(5)},${z.toFixed(5)}`;
    let i = map.get(k);
    if (i === undefined) { i = punkte.length / 3; map.set(k, i); punkte.push(x, y, z); }
    return i;
  };
  for (const [a, b, c] of ICO_F) {
    const A = ICO_P[a], B = ICO_P[b], C = ICO_P[c];
    const p = (i, j) => idx(A[0] + (B[0] - A[0]) * i / f + (C[0] - A[0]) * j / f,
      A[1] + (B[1] - A[1]) * i / f + (C[1] - A[1]) * j / f, A[2] + (B[2] - A[2]) * i / f + (C[2] - A[2]) * j / f);
    for (let i = 0; i < f; i++) for (let j = 0; j < f - i; j++) {
      dreiecke.push(p(i, j), p(i + 1, j), p(i, j + 1));
      if (i + j < f - 1) dreiecke.push(p(i + 1, j), p(i + 1, j + 1), p(i, j + 1));
    }
  }
  return richteAus({ punkte, dreiecke }, [0, 0, 0]);
}

/** Säule: Ringe auf Höhen ts[] (0..1 → y −1..1) mit Radius r(t, k), Deckel als Fächer. 2·s·ringe Dreiecke. */
export function saeulenNetz(segmente = 7, ts = [0, 0.5, 1], r = () => 1, wink = () => 0) {
  const punkte = [], dreiecke = [], ringe = ts.length;
  for (let k = 0; k < ringe; k++) {
    const t = ts[k], rad = r(t, k);
    for (let s = 0; s < segmente; s++) {
      const a = (s + wink(k, s)) / segmente * Math.PI * 2;
      punkte.push(Math.cos(a) * rad, -1 + 2 * t, Math.sin(a) * rad);
    }
  }
  const unten = punkte.length / 3; punkte.push(0, -1, 0);
  const oben = unten + 1; punkte.push(0, 1.02, 0);
  for (let k = 0; k < ringe - 1; k++) for (let s = 0; s < segmente; s++) {
    const a = k * segmente + s, b = k * segmente + (s + 1) % segmente, c = a + segmente, d = b + segmente;
    dreiecke.push(a, c, b, b, c, d);
  }
  const o = (ringe - 1) * segmente;
  for (let s = 0; s < segmente; s++) {
    dreiecke.push(unten, s, (s + 1) % segmente);
    dreiecke.push(oben, o + (s + 1) % segmente, o + s);
  }
  return { punkte, dreiecke };   // Umlaufsinn ist per Konstruktion außen
}

/** Dreht Dreiecke so, dass die Normale vom Mittelpunkt weg zeigt. */
function richteAus(netz, m) {
  const P = netz.punkte, D = netz.dreiecke;
  for (let i = 0; i < D.length; i += 3) {
    const n = normale(P, D[i], D[i + 1], D[i + 2]);
    const cx = (P[D[i] * 3] + P[D[i + 1] * 3] + P[D[i + 2] * 3]) / 3 - m[0];
    const cy = (P[D[i] * 3 + 1] + P[D[i + 1] * 3 + 1] + P[D[i + 2] * 3 + 1]) / 3 - m[1];
    const cz = (P[D[i] * 3 + 2] + P[D[i + 1] * 3 + 2] + P[D[i + 2] * 3 + 2]) / 3 - m[2];
    if (n[0] * cx + n[1] * cy + n[2] * cz < 0) { const t = D[i + 1]; D[i + 1] = D[i + 2]; D[i + 2] = t; }
  }
  return netz;
}

/** Flächennormale (normiert) eines Dreiecks aus Indizes. */
export function normale(P, a, b, c) {
  const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
  const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
}

const glatt = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * Fels-Grundform. opts (alle optional):
 *  seed, form 'ico'|'saeule', frequenz (ico, 1..5), segmente/ringe (säule, ohne Schichten), groesse [x,y,z] in m,
 *  versenkt 0..1 (Anteil der Halbhöhe unter y=0), boden (y-Klemmung, −0.12), rauheit (fBm), grat (Grat-Rauschen),
 *  frequenzRauschen, schnitte (Anzahl Bruchflächen), deckel 0..1 (waagrechter Deckelschnitt), schnittTiefe 0..1, schnittOben 0..1 (Neigung nach oben),
 *  kantig 0..1 (Richtung Würfel), schichten (Anzahl Sediment-Bänder), schichtTiefe 0..1, erosion 0..1, verjuengung (säule: Spitze/Fuß), neigung (rad)
 */
export function felsForm(opts = {}) {
  const o = {
    seed: 1, form: 'ico', frequenz: 3, segmente: 7, ringe: 7, groesse: [1, 0.8, 1], versenkt: 0.25, boden: -0.12,
    rauheit: 0.18, grat: 0.12, frequenzRauschen: 1.3, schnitte: 5, schnittTiefe: 0.35, schnittOben: 0.5,
    schichten: 0, schichtTiefe: 0.3, erosion: 0.3, kantig: 0, deckel: 0, verjuengung: 0.35, neigung: 0.1, ...opts,
  };
  const r = rng(hashSeed('fels-form', o.seed));
  const n3 = createNoise3D(hashSeed('fels-rauschen', o.seed));
  const versatz = [range(r, -50, 50), range(r, -50, 50), range(r, -50, 50)];

  // 1) Grundnetz in Einheitsgröße
  let netz;
  if (o.form === 'saeule') {
    const wellen = [range(r, 0, 6), range(r, 0, 6)], B = o.schichten, ts = [], ein = [];
    if (B > 0) {   // Schichten: je Band ein eingezogener Fußring und ein voller Kopfring → Absätze/Simse
      for (let b = 0; b < B; b++) {
        const t0 = b / B, hb = 1 / B;
        if (b > 0) { ts.push(t0 + hb * 0.06); ein.push(1 - o.schichtTiefe * range(r, 0.5, 1)); }
        else { ts.push(0); ein.push(1.08); }
        ts.push(t0 + hb * range(r, 0.6, 0.85)); ein.push(1);
      }
      ts.push(1); ein.push(0.85);
    } else for (let k = 0; k < o.ringe; k++) { ts.push(k / (o.ringe - 1)); ein.push(k === 0 ? 1.1 : 1); }
    netz = saeulenNetz(o.segmente, ts,
      (t, k) => (1 - (1 - o.verjuengung) * Math.pow(t, 1.3)) * (1 + 0.1 * Math.sin(t * 9 + wellen[0])) * ein[k],
      (k, s) => 0.1 * Math.sin(k * 3.1 + s * 1.7 + wellen[1]));
  } else netz = icoNetz(Math.max(1, Math.round(o.frequenz)));
  const P = Float32Array.from(netz.punkte), D = Uint32Array.from(netz.dreiecke);
  const N = P.length / 3;

  // 2) Rauschverformung (radial) + Skalierung + Drehung
  const [sx, sy, sz] = o.groesse;
  const dreh = range(r, 0, Math.PI * 2), cd = Math.cos(dreh), sd = Math.sin(dreh);
  const kipp = range(r, -o.neigung, o.neigung), schief = [range(r, -0.25, 0.25), range(r, -0.25, 0.25)];
  for (let i = 0; i < N; i++) {
    let x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    const f = o.frequenzRauschen;
    if (o.kantig > 0 && o.form !== 'saeule') {   // Richtung Würfel ziehen → flache Seiten, Kanten
      const m = Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) * 1.25;
      x += (x / m - x) * o.kantig; y += (y / m - y) * o.kantig; z += (z / m - z) * o.kantig;
    }
    const nx = x * f + versatz[0], ny = y * f + versatz[1], nz = z * f + versatz[2];
    const d = 1 + o.rauheit * fbm(n3, nx, ny, nz, 3) + o.grat * (ridged(n3, nx * 0.7 + 9, ny * 0.7, nz * 0.7, 3) - 0.35);
    if (o.form === 'saeule') { x *= d; z *= d; y += 0.15 * o.rauheit * fbm(n3, nx + 3, ny, nz, 2); }
    else { x *= d; y *= d; z *= d; }
    if (o.form !== 'saeule') { x *= 1 + schief[0] * y; z *= 1 + schief[1] * y; }
    x *= sx / 2; y *= sy / 2; z *= sz / 2;
    // Kippen um z, Drehen um y
    const xk = x * Math.cos(kipp) - y * Math.sin(kipp), yk = x * Math.sin(kipp) + y * Math.cos(kipp);
    P[i * 3] = xk * cd - z * sd; P[i * 3 + 1] = yk + sy / 2 * (1 - 2 * o.versenkt);
    P[i * 3 + 2] = xk * sd + z * cd;
  }

  // 3) Bruchkanten: Punkte jenseits einer Ebene auf die Ebene ziehen → ebene Facetten
  const mitte = [0, sy * (0.5 - o.versenkt), 0];
  for (let s = 0; s < o.schnitte + (o.deckel > 0 ? 1 : 0); s++) {
    const deckel = s === o.schnitte;   // optionaler, fast waagrechter Deckel-Schnitt (Platten, Tafeln)
    const az = range(r, 0, Math.PI * 2);
    const el = deckel ? Math.PI / 2 - range(r, 0, 0.15) : range(r, -0.15, 0.25) + o.schnittOben * range(r, 0, 1.2);
    const n = [Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)];
    let maxd = -Infinity;
    for (let i = 0; i < N; i++) maxd = Math.max(maxd, dot3(P, i, n, mitte));
    const d0 = maxd * (1 - (deckel ? o.deckel : o.schnittTiefe * range(r, 0.35, 1)));
    for (let i = 0; i < N; i++) {
      // Zentralprojektion zur Mitte: bleibt sternförmig → keine umgeklappten Dreiecke
      const d = dot3(P, i, n, mitte);
      if (d > d0) {
        const k = d0 / d;
        for (let a = 0; a < 3; a++) P[i * 3 + a] = mitte[a] + (P[i * 3 + a] - mitte[a]) * k;
      }
    }
  }

  // 4) Schichtung: Bänder mit Absätzen (Ober-/Unterkante einziehen, y leicht auf Bandgrenzen ziehen)
  let ymax = -Infinity, ymin = Infinity;
  for (let i = 0; i < N; i++) { ymax = Math.max(ymax, P[i * 3 + 1]); ymin = Math.min(ymin, P[i * 3 + 1]); }
  if (o.schichten > 0 && o.form !== 'saeule') {
    const h = (ymax - Math.max(ymin, o.boden)) / o.schichten, phase = range(r, 0, h);
    for (let i = 0; i < N; i++) {
      const y = P[i * 3 + 1], band = Math.floor((y - phase) / h), fr = (y - phase) / h - band;
      const ein = 1 - o.schichtTiefe * (fr < 0.3 ? (0.3 - fr) / 0.3 : 0) * (0.6 + 0.4 * Math.abs(Math.sin(band * 2.3 + o.seed)));
      P[i * 3] *= ein; P[i * 3 + 2] *= ein;
      const ziel = phase + Math.round((y - phase) / h) * h;
      P[i * 3 + 1] = y + (ziel - y) * 0.4 * o.schichtTiefe;
    }
  }

  // 5) Erosion oben: Laplace-Glättung + leichtes Absenken der oberen Ecken
  if (o.erosion > 0) {
    const nach = Array.from({ length: N }, () => new Set());
    for (let i = 0; i < D.length; i += 3) for (let k = 0; k < 3; k++) {
      nach[D[i + k]].add(D[i + (k + 1) % 3]); nach[D[i + k]].add(D[i + (k + 2) % 3]);
    }
    const yMitte = ymin + (ymax - ymin) * 0.45;
    for (let it = 0; it < 2; it++) {
      const Q = P.slice();
      for (let i = 0; i < N; i++) {
        const w = o.erosion * glatt(yMitte, ymax, Q[i * 3 + 1]) * 0.55;
        if (w <= 0) continue;
        let ax = 0, ay = 0, az = 0;
        for (const j of nach[i]) { ax += Q[j * 3]; ay += Q[j * 3 + 1]; az += Q[j * 3 + 2]; }
        const m = nach[i].size;
        P[i * 3] += (ax / m - Q[i * 3]) * w; P[i * 3 + 1] += (ay / m - Q[i * 3 + 1]) * w - 0.02 * w * sy;
        P[i * 3 + 2] += (az / m - Q[i * 3 + 2]) * w;
      }
    }
  }

  // 6) Boden flach klemmen, Maße
  let hoehe = 0, radius = 0;
  for (let i = 0; i < N; i++) {
    if (P[i * 3 + 1] < o.boden) P[i * 3 + 1] = o.boden;
    hoehe = Math.max(hoehe, P[i * 3 + 1]);
    radius = Math.max(radius, Math.hypot(P[i * 3], P[i * 3 + 2]));
  }
  return { punkte: P, dreiecke: D, hoehe, radius };
}

function dot3(P, i, n, m) {
  return (P[i * 3] - m[0]) * n[0] + (P[i * 3 + 1] - m[1]) * n[1] + (P[i * 3 + 2] - m[2]) * n[2];
}
