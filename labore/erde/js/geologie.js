// Geologie des Planeten (reine Logik, ohne THREE): einmal beim Start auf einem groben Kugelgitter berechnet.
//  1. Erdplatten (Kontinental/Ozeanisch) mit Bewegung → Gebirge, Gräben, Inselbögen, Rifts, Ozeanrücken
//  2. Grundhöhe + großes Rauschen + Hotspot-Vulkane
//  3. Abfluss (Priority-Flood: jede Senke läuft über → Seen), Einzugsgebiete, Flächen
//  4. Fluss-Erosion (Stream-Power, implizit nach Braun & Willett) + Hangabtrag → Täler
// Ergebnis: Typed Arrays je Zelle (Höhe, Wasserspiegel, Abfluss-Ziel, Einzugsfläche, Gebirge, Platte).
import { createNoise3D } from '../../../engine/core/noise.js';
import { rng as erzeugeRng } from '../../../engine/core/rng.js';
import { createGeoGitter } from './geo-gitter.js';

const glatt = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function berechneGeologie({ seed = 1, radius = 100_000, N = 192, platten = 14, erosion = 7, G: gitter } = {}) {
  const G = gitter || createGeoGitter(N);
  const { n, dir, nb } = G;
  const zufall = erzeugeRng(seed * 7919 + 13);
  const rausch = createNoise3D(seed + 101);
  const R = radius;
  const zellKante = (R * Math.PI / 2) / N;                      // m
  const zellKm2 = (zellKante / 1000) ** 2;
  const fbmD = (x, y, z, f, okt, v = 0) => {                    // fBm auf Richtungen, f = Frequenz in Kugel-Einheiten
    let s = 0, a = 1, no = 0;
    for (let o = 0; o < okt; o++) { s += a * rausch(x * f + v, y * f - v, z * f + o * 3.7); no += a; a *= 0.5; f *= 2; }
    return s / no;
  };
  const einheit = () => { const z = 2 * zufall() - 1, t = 2 * Math.PI * zufall(), r = Math.sqrt(1 - z * z); return [r * Math.cos(t), r * Math.sin(t), z]; };
  const f0 = R / 100_000; // Rauschen skaliert mit der Planetengröße (Strukturen in km bleiben ähnlich)

  // ---------- 1. Platten ----------
  const P = [];
  for (let k = 0; k < platten; k++) {
    const kont = zufall() < 0.42;
    P.push({ d: einheit(), kont, basis: kont ? 250 + zufall() * 350 : -3000 - zufall() * 1200, achse: einheit(), w: 0.4 + zufall() * 0.8 });
  }
  const platte = new Uint8Array(n);
  for (let c = 0; c < n; c++) {
    let x = dir[c * 3], y = dir[c * 3 + 1], z = dir[c * 3 + 2];
    x += 0.24 * fbmD(x, y, z, 2.2, 3, 1.3); y += 0.24 * fbmD(x, y, z, 2.2, 3, 7.1); z += 0.24 * fbmD(x, y, z, 2.2, 3, 4.4);
    let best = -9, bi = 0;
    for (let k = 0; k < platten; k++) { const s = x * P[k].d[0] + y * P[k].d[1] + z * P[k].d[2]; if (s > best) { best = s; bi = k; } }
    platte[c] = bi;
  }
  const tempo = (k, c, out) => { // Plattengeschwindigkeit an Zelle c: w · (Achse × d)
    const a = P[k].achse, x = dir[c * 3], y = dir[c * 3 + 1], z = dir[c * 3 + 2];
    out[0] = P[k].w * (a[1] * z - a[2] * y); out[1] = P[k].w * (a[2] * x - a[0] * z); out[2] = P[k].w * (a[0] * y - a[1] * x);
    return out;
  };

  // ---------- 2. Plattengrenzen und Abstand dazu ----------
  const konv = new Float32Array(n), partner = new Int16Array(n).fill(-1);
  const quelle = new Int32Array(n).fill(-1), abst = new Float32Array(n).fill(1e9);
  const schlange = [];
  const vp = [0, 0, 0], vq = [0, 0, 0];
  for (let c = 0; c < n; c++) {
    let summe = 0, anz = 0;
    for (let k = 0; k < 4; k++) {
      const q = nb[c * 8 + k];
      if (q < 0 || platte[q] === platte[c]) continue;
      let ex = dir[q * 3] - dir[c * 3], ey = dir[q * 3 + 1] - dir[c * 3 + 1], ez = dir[q * 3 + 2] - dir[c * 3 + 2];
      const el = Math.hypot(ex, ey, ez); ex /= el; ey /= el; ez /= el;
      tempo(platte[c], c, vp); tempo(platte[q], c, vq);
      summe += (vp[0] - vq[0]) * ex + (vp[1] - vq[1]) * ey + (vp[2] - vq[2]) * ez;
      anz++; partner[c] = platte[q];
    }
    if (anz) { konv[c] = summe / anz; quelle[c] = c; abst[c] = 0; schlange.push(c); }
  }
  const MAXD = 26;
  for (let s = 0; s < schlange.length; s++) { // Breitensuche, Abstand = echter Abstand zur Grenzzelle (in Zellen)
    const c = schlange[s], src = quelle[c];
    for (let k = 0; k < 8; k++) {
      const q = nb[c * 8 + k];
      if (q < 0 || quelle[q] >= 0) continue;
      const dx = dir[q * 3] - dir[src * 3], dy = dir[q * 3 + 1] - dir[src * 3 + 1], dz = dir[q * 3 + 2] - dir[src * 3 + 2];
      const d = (Math.hypot(dx, dy, dz) * R) / zellKante;
      if (d > MAXD) continue;
      quelle[q] = src; abst[q] = d; schlange.push(q);
    }
  }

  // ---------- 3. Höhe ----------
  let H = new Float32Array(n), tmp = new Float32Array(n);
  for (let c = 0; c < n; c++) H[c] = P[platte[c]].basis;
  const glaette = (runden, staerke, nurLand = false) => {
    for (let r = 0; r < runden; r++) {
      for (let c = 0; c < n; c++) {
        if (nurLand && H[c] < 0) { tmp[c] = H[c]; continue; }
        let s = 0, a = 0;
        for (let k = 0; k < 8; k++) { const q = nb[c * 8 + k]; if (q >= 0) { s += H[q]; a++; } }
        tmp[c] = H[c] + staerke * (s / a - H[c]);
      }
      [H, tmp] = [tmp, H];
    }
  };
  glaette(10, 0.6); // Schelf und Kontinentalhang
  const hub = new Float32Array(n);
  for (let c = 0; c < n; c++) {
    const x = dir[c * 3], y = dir[c * 3 + 1], z = dir[c * 3 + 2];
    const eigen = P[platte[c]];
    let u = 0;
    if (quelle[c] >= 0) {
      const s = quelle[c], d = abst[c];
      const anderK = platte[s] === platte[c] ? partner[s] : platte[s];
      const ander = P[anderK >= 0 ? anderK : platte[c]];
      const kv = konv[s];
      const vari = 0.55 + 0.65 * (0.5 + 0.5 * fbmD(x, y, z, 9 * f0, 3, 2.2));   // Grenze bricht in einzelne Massive
      const gauss = (w) => Math.exp(-(d / w) * (d / w));
      if (kv > 0.05) {
        const st = Math.min(1, kv / 0.6) * vari;
        if (eigen.kont && ander.kont) u = 3900 * st * gauss(8);                                  // Kollision: Hochgebirge
        else if (eigen.kont) u = 2700 * st * gauss(5) * glatt(0, 1.5, d);                       // Küstengebirge
        else if (ander.kont) u = -2400 * st * gauss(2.2);                                       // Tiefseegraben
        else u = 2600 * st * gauss(3) * glatt(0.35, 0.7, 0.5 + 0.5 * fbmD(x, y, z, 18 * f0, 2, 5)); // Inselbogen
      } else if (kv < -0.05) {
        const st = Math.min(1, -kv / 0.6) * vari;
        if (eigen.kont) u = (-950 * gauss(3) + 450 * Math.exp(-(((d - 4.5) / 2) ** 2))) * st;     // Grabenbruch mit Schultern
        else u = 1900 * st * gauss(4);                                                         // Ozeanrücken
      } else u = 250 * fbmD(x, y, z, 14 * f0, 2, 9) * gauss(3);                                // Transformstörung
    }
    hub[c] = u;
    const gross = fbmD(x, y, z, 3.2 * f0, 5, 0.7);
    H[c] += u + gross * (eigen.kont ? 650 : 900) + fbmD(x, y, z, 12 * f0, 4, 3.3) * 160;
  }
  // Hotspot-Vulkane (Kegel mit Krater)
  const vulkane = [];
  for (let k = 0; k < 4; k++) {
    const v = einheit(), hoch = 1800 + zufall() * 1600, rad = (2500 + zufall() * 2000) / R;
    vulkane.push({ d: v, hoch });
    for (let c = 0; c < n; c++) {
      const cs = dir[c * 3] * v[0] + dir[c * 3 + 1] * v[1] + dir[c * 3 + 2] * v[2];
      if (cs < Math.cos(rad * 3)) continue;
      const w = Math.acos(Math.min(1, cs)) / rad;
      const form = Math.exp(-w * w * 1.2), krater = 0.3 * Math.exp(-((w / 0.18) ** 2));
      const neu = H[c] + (hoch - H[c]) * form - hoch * krater;   // wächst vom Meeresgrund bis auf `hoch`
      hub[c] = Math.max(hub[c], (neu - H[c]) * 0.8);
      H[c] = neu;
    }
  }
  glaette(2, 0.35);

  // ---------- 4. Abfluss + Erosion ----------
  const F = new Float32Array(n), ab = new Int32Array(n), reihe = new Int32Array(n), A = new Float32Array(n);
  let landAnz = 0;
  // Binärer Heap (Schlüssel = Wasserspiegel)
  const hk = new Float64Array(n), hi = new Int32Array(n);
  let hn = 0;
  const rein = (k, i) => { let p = hn++; while (p > 0) { const e = (p - 1) >> 1; if (hk[e] <= k) break; hk[p] = hk[e]; hi[p] = hi[e]; p = e; } hk[p] = k; hi[p] = i; };
  const raus = () => {
    const top = hi[0], k = hk[--hn], i = hi[hn];
    let p = 0;
    for (;;) { let c = 2 * p + 1; if (c >= hn) break; if (c + 1 < hn && hk[c + 1] < hk[c]) c++; if (hk[c] >= k) break; hk[p] = hk[c]; hi[p] = hi[c]; p = c; }
    hk[p] = k; hi[p] = i; return top;
  };
  const besucht = new Uint8Array(n);
  function fluten() {
    besucht.fill(0); hn = 0; landAnz = 0;
    let tiefste = 0;
    for (let c = 0; c < n; c++) {
      if (H[c] < H[tiefste]) tiefste = c;
      if (H[c] >= 0) continue;
      besucht[c] = 1; F[c] = H[c]; ab[c] = -1;
      for (let k = 0; k < 8; k++) { const q = nb[c * 8 + k]; if (q >= 0 && H[q] >= 0) { rein(H[c], c); break; } }
    }
    if (!hn) { besucht[tiefste] = 1; F[tiefste] = H[tiefste]; ab[tiefste] = -1; rein(H[tiefste], tiefste); }
    while (hn) {
      const c = raus();
      for (let k = 0; k < 8; k++) {
        const q = nb[c * 8 + k];
        if (q < 0 || besucht[q]) continue;
        besucht[q] = 1;
        F[q] = Math.max(H[q], F[c] + 0.002);
        ab[q] = c;
        reihe[landAnz++] = q;
        rein(F[q], q);
      }
    }
  }
  const regen = new Float32Array(n);
  for (let c = 0; c < n; c++) { const x = dir[c * 3], y = dir[c * 3 + 1], z = dir[c * 3 + 2]; regen[c] = zellKm2 * (0.55 + 0.9 * (0.5 + 0.5 * fbmD(x, y, z, 4 * f0, 3, 11))); }
  function fliessen() {
    for (let s = 0; s < landAnz; s++) A[reihe[s]] = regen[reihe[s]];
    for (let s = landAnz - 1; s >= 0; s--) { const c = reihe[s], d = ab[c]; if (d >= 0 && H[d] >= 0) A[d] += A[c]; }
  }
  const strecke = (c, d) => Math.hypot(dir[c * 3] - dir[d * 3], dir[c * 3 + 1] - dir[d * 3 + 1], dir[c * 3 + 2] - dir[d * 3 + 2]) * R;
  const KDT = 0.07;
  for (let it = 0; it < erosion; it++) {
    fluten(); fliessen();
    // Sediment füllt Senken langsam auf: nur tiefe Becken (Grabenbrüche, Krater) bleiben am Ende Seen
    for (let c = 0; c < n; c++) if (F[c] > H[c] + 1 && F[c] > 0) H[c] += (F[c] - H[c]) * 0.26;
    for (let s = 0; s < landAnz; s++) { // flussabwärts zuerst: Ziel ist schon erodiert
      const c = reihe[s], d = ab[c];
      if (F[c] > H[c] + 1) continue;     // Seegrund: kein Einschnitt
      const hd = Math.max(0, H[d]);
      if (H[c] <= hd) continue;
      const f = KDT * Math.sqrt(A[c]) / (strecke(c, d) / 1000);
      H[c] = (H[c] + f * hd) / (1 + f);
    }
    glaette(1, 0.18, true); // Hangabtrag
  }
  fluten();
  // Flache Senken sind mit Sediment gefüllt (Ebene statt Tümpel); nur tiefe, große Becken bleiben Seen
  const komp = new Int32Array(n).fill(-1), stapel = [];
  for (let c0 = 0; c0 < n; c0++) {
    if (komp[c0] >= 0 || !(F[c0] > H[c0] + 0.5 && F[c0] > 0)) continue;
    const zellen = [];
    let tief = 0;
    komp[c0] = c0; stapel.push(c0);
    while (stapel.length) {
      const c = stapel.pop(); zellen.push(c);
      tief = Math.max(tief, F[c] - H[c]);
      for (let k = 0; k < 8; k++) {
        const q = nb[c * 8 + k];
        if (q < 0 || komp[q] >= 0 || !(F[q] > H[q] + 0.5) || Math.abs(F[q] - F[c]) > 2) continue;
        komp[q] = c0; stapel.push(q);
      }
    }
    if (tief < 28 || zellen.length < 8) for (const c of zellen) H[c] = F[c];
  }
  fluten(); fliessen();

  const gebirge = new Float32Array(n);
  for (let c = 0; c < n; c++) gebirge[c] = glatt(250, 2200, hub[c]) * glatt(0, 300, H[c]);
  let seen = 0, fluss = 0, land = 0;
  const AMIN = 5;
  for (let c = 0; c < n; c++) {
    if (H[c] >= 0) land++;
    if (F[c] > H[c] + 1 && F[c] > 0) seen++;
    if (H[c] >= 0 && A[c] >= AMIN) fluss++;
  }
  return {
    N, seed, radius: R, zellKante, amin: AMIN,
    hoehe: H, spiegel: F, ab, flaeche: A, gebirge, platte,
    vulkane, platten: P.map((p) => ({ kont: p.kont })),
    stat: { land: land / n, seeZellen: seen, flussZellen: fluss },
  };
}
