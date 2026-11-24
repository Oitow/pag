// Streuung der Natur (reine Logik, ohne THREE, läuft im Worker oder im Hauptthread).
// Die Welt ist in Streu-Kacheln (Quadtree-Stufe mit ~80 m Kante) geteilt. Jede Kachel würfelt aus ihrem Schlüssel
// ein festes Raster von Kandidaten (4 m), fragt dort den Planeten (Höhe, Wasser, Klima, Gestein) und entscheidet, was wächst.
// Bäume und Pflanzen je Biom; Gras-Büschel dazwischen (Höhe aus den Nachbarn gemittelt, spart Abfragen).
// Gleicher Seed + gleiche Kachel → gleiche Natur (wichtig für später: Mehrspieler, Speichern, Abholzen).
// Quellen: Naturfundus (labore/erde/naturfundus) für fichte, birke, granitblock, schiefer, rohrkolben, seerose, steinpilz, Fische;
// alles andere aus engine/models/natur (natur-assets). Welche Quelle → natur.js.
import { kachelUV, kachelMitte, wuerfelZuKugel } from './planet-baum.js';
import { rng, hashSeed } from '../../../engine/core/rng.js';
import { waldDichte, biom, BIOM } from './klima.js';
import { GESTEIN, GESTEIN_FARBE } from './geologie.js';

// Reihenfolge = Index im Ergebnis.
export const STREU_ARTEN = [
  // Naturfundus
  'fichte', 'birke', 'granitblock', 'schiefer', 'rohrkolben', 'seerose', 'steinpilz', 'forelle', 'barsch',
  // Engine: Bäume
  'kiefer', 'tanne', 'eiche', 'buche', 'ahorn', 'weide', 'tropenbaum', 'palme', 'akazie', 'olive', 'pinie', 'toterBaum',
  // Engine: Büsche, Boden, Wüste, Totholz, Unterwuchs
  'busch', 'beerenbusch', 'ginster', 'zwergstrauch', 'farn', 'grasbueschel', 'blume', 'pilz', 'kaktus', 'saeulenkaktus', 'agave',
  'baumstumpf', 'liegenderStamm', 'geroell', 'felsnadel', 'wedelfarn', 'busch_unterholz', 'moospolster', 'laubstreu',
];
const A = Object.fromEntries(STREU_ARTEN.map((a, i) => [a, i]));
export const STRIDE = 10; // art, px, py, pz (m, relativ zur Kachelmitte auf Meereshöhe), skala, drehung, r, g, b, frei
const RASTER = 20;        // 20×20 Kandidaten je Kachel
const GRANIT_BASIS = [0.57, 0.545, 0.51];

// Bäume je Biom: [art, gewicht, skala] – Naturfundus-Bäume sind klein gebaut (≈ 6 m) und werden hochskaliert
const BAEUME = {
  [BIOM.TUNDRA]: [['birke', 1, 0.9]],
  [BIOM.NADELWALD]: [['fichte', 6, 2.4], ['tanne', 2, 1], ['kiefer', 2, 1], ['birke', 1, 2.2]],
  [BIOM.MISCHWALD]: [['fichte', 3, 2.4], ['birke', 3, 2.3], ['buche', 2, 1], ['eiche', 2, 1], ['ahorn', 1, 1], ['kiefer', 1, 1]],
  [BIOM.LAUBWALD]: [['buche', 4, 1.1], ['eiche', 3, 1.1], ['ahorn', 2, 1], ['birke', 2, 2.4]],
  [BIOM.GRASLAND]: [['eiche', 3, 1.1], ['birke', 1, 2.2], ['ahorn', 1, 1]],
  [BIOM.STEPPE]: [['olive', 2, 1], ['pinie', 1, 1], ['kiefer', 1, 0.9]],
  [BIOM.SAVANNE]: [['akazie', 1, 1]],
  [BIOM.REGENWALD]: [['tropenbaum', 5, 1.2], ['palme', 2, 1.1]],
};
// Boden je Biom: [art, wahrscheinlichkeit je Kandidat, skala]
const BODEN = {
  [BIOM.EIS]: [['geroell', 0.03, 1]],
  [BIOM.TUNDRA]: [['zwergstrauch', 0.16, 1], ['moospolster', 0.14, 1], ['geroell', 0.04, 1], ['blume', 0.04, 1]],
  [BIOM.NADELWALD]: [['moospolster', 0.18, 1], ['zwergstrauch', 0.14, 1], ['farn', 0.08, 1], ['steinpilz', 0.025, 1.1], ['baumstumpf', 0.012, 1], ['liegenderStamm', 0.012, 1]],
  [BIOM.MISCHWALD]: [['farn', 0.2, 1], ['busch', 0.05, 1], ['beerenbusch', 0.03, 1], ['steinpilz', 0.02, 1.1], ['pilz', 0.02, 1], ['liegenderStamm', 0.012, 1], ['baumstumpf', 0.01, 1]],
  [BIOM.LAUBWALD]: [['laubstreu', 0.2, 1], ['farn', 0.16, 1], ['busch_unterholz', 0.07, 1], ['blume', 0.06, 1], ['pilz', 0.02, 1], ['liegenderStamm', 0.012, 1]],
  [BIOM.GRASLAND]: [['blume', 0.16, 1], ['busch', 0.025, 1], ['beerenbusch', 0.015, 1]],
  [BIOM.STEPPE]: [['ginster', 0.05, 1], ['busch', 0.015, 0.8], ['geroell', 0.03, 1], ['agave', 0.01, 1]],
  [BIOM.WUESTE]: [['kaktus', 0.012, 1], ['saeulenkaktus', 0.012, 1.3], ['agave', 0.02, 1], ['geroell', 0.04, 1]],
  [BIOM.SAVANNE]: [['busch', 0.03, 1], ['ginster', 0.02, 1], ['blume', 0.03, 1]],
  [BIOM.REGENWALD]: [['wedelfarn', 0.35, 1.2], ['busch_unterholz', 0.12, 1.2], ['farn', 0.1, 1.3], ['liegenderStamm', 0.015, 1.2], ['pilz', 0.02, 1]],
};
// Gras-Büschel je Kandidat (0…GRAS_MAX) nach Biom
const GRAS = { [BIOM.TUNDRA]: 1, [BIOM.NADELWALD]: 0.5, [BIOM.MISCHWALD]: 1.5, [BIOM.LAUBWALD]: 1, [BIOM.GRASLAND]: 4, [BIOM.STEPPE]: 2.5, [BIOM.SAVANNE]: 3.5, [BIOM.REGENWALD]: 0.5 };
const GRAS_MAX = 4;

const glatt = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const wahl = (liste, w) => { // gewichtete Wahl, w ∈ [0,1)
  let s = 0; for (const e of liste) s += e[1];
  let x = w * s; for (const e of liste) { x -= e[1]; if (x < 0) return e; }
  return liste[liste.length - 1];
};

/** Quadtree-Stufe der Streu-Kacheln (Kante ~80 m). */
export const streuStufe = (R) => Math.max(0, Math.round(Math.log2((R * Math.PI / 2) / 80)));

/** Alle Streu-Kacheln der Stufe L, deren Mitte näher als `radius` (m) am Bodenpunkt unter p liegt. */
export function streuKacheln(p, R, L, radius) {
  const lp = Math.hypot(p[0], p[1], p[2]);
  const pd = [p[0] / lp, p[1] / lp, p[2] / lp];
  const raus = [], stapel = [];
  for (let f = 0; f < 6; f++) stapel.push({ f, L: 0, ix: 0, iy: 0 });
  while (stapel.length) {
    const k = stapel.pop();
    const { d, kante } = kachelMitte(k, R);
    const w = Math.acos(Math.max(-1, Math.min(1, d[0] * pd[0] + d[1] * pd[1] + d[2] * pd[2]))) * R;
    if (w > radius + kante * 1.1) continue;
    if (k.L === L) { raus.push({ ...k, key: `${k.f}/${k.L}/${k.ix}/${k.iy}`, dist: w }); continue; }
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) stapel.push({ f: k.f, L: k.L + 1, ix: k.ix * 2 + i, iy: k.iy * 2 + j });
  }
  return raus.sort((a, b) => a.dist - b.dist);
}

/** Natur einer Streu-Kachel: { key, mitte:[x,y,z], daten: Float32Array (STRIDE je Stück), anzahl }. */
export function streueKachel(k, planet) {
  const R = planet.radius;
  const { u0, v0, s } = kachelUV(k);
  const { d: cd } = kachelMitte(k, R);
  const cx = cd[0] * R, cy = cd[1] * R, cz = cd[2] * R;
  const z = rng(hashSeed(planet.seed, k.f, k.L, k.ix, k.iy));
  const M = RASTER, n = M * M;
  // 1) Kandidaten abfragen (Rasterlage UV merken für die Gras-Büschel)
  const D = new Float64Array(n * 3), U = new Float64Array(n * 2), P = [];
  const dir = [0, 0, 0];
  for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
    const c = j * M + i;
    U[c * 2] = i + 0.15 + 0.7 * z(); U[c * 2 + 1] = j + 0.15 + 0.7 * z();
    wuerfelZuKugel(k.f, u0 + (s * U[c * 2]) / M, v0 + (s * U[c * 2 + 1]) / M, dir);
    const l = Math.hypot(dir[0], dir[1], dir[2]);
    D[c * 3] = dir[0] / l; D[c * 3 + 1] = dir[1] / l; D[c * 3 + 2] = dir[2] / l;
    const p = planet.probe(D[c * 3], D[c * 3 + 1], D[c * 3 + 2], 2);
    P.push({ h: p.h, wasser: p.wasser, ufer: p.ufer, fluss: p.fluss, meer: p.meer, temp: p.temp, feuchte: p.feuchte,
      gebirge: p.gebirge, gestein: p.gestein, v: planet.flecken(D[c * 3], D[c * 3 + 1], D[c * 3 + 2]) });
  }
  const zelle = (s * R * Math.PI / 4) / M; // ~Abstand zweier Kandidaten (m)
  // 2) entscheiden
  const raus = [];
  const ablegen = (dx, dy, dz, hh, art, skala, r, g, b) => {
    const rr = R + hh;
    raus.push(art, dx * rr - cx, dy * rr - cy, dz * rr - cz, skala, z() * Math.PI * 2, r, g, b, 0);
  };
  const setze = (c, art, skala, r = 1, g = 1, b = 1, tiefer = 0) => {
    const p = P[c], wasserArt = art === A.forelle || art === A.barsch || art === A.seerose;
    ablegen(D[c * 3], D[c * 3 + 1], D[c * 3 + 2], (wasserArt ? p.wasser : p.h) - tiefer, art, skala, r, g, b);
  };
  const hAt = (i, j) => P[Math.min(M - 1, Math.max(0, j)) * M + Math.min(M - 1, Math.max(0, i))].h;
  for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
    const c = j * M + i, p = P[c];
    const nassTief = p.wasser - p.h;                      // > 0: unter Wasser
    const hl = hAt(i - 1, j), hr = hAt(i + 1, j), hu = hAt(i, j - 1), ho = hAt(i, j + 1);
    const steil = Math.hypot(hr - hl, ho - hu) / (zelle * 2); // tan(Neigung)
    let amSee = false;
    for (const q of [j * M + Math.max(0, i - 1), j * M + Math.min(M - 1, i + 1), Math.max(0, j - 1) * M + i, Math.min(M - 1, j + 1) * M + i])
      if (!P[q].meer && P[q].wasser > P[q].h + 0.2) amSee = true;
    const w = z();
    if (nassTief > 0.05) {                                // im Wasser
      if (p.meer) continue;
      if (!p.fluss && nassTief < 2.5 && p.temp > 4 && w < 0.18) setze(c, A.seerose, 0.8 + z() * 0.6);
      else if (nassTief > 0.6 && p.temp > 0 && w > 0.975) setze(c, z() < 0.5 ? A.forelle : A.barsch, 0.8 + z() * 0.5, 1, 1, 1, Math.min(nassTief * 0.5, 1.2));
      else if (nassTief < 0.4 && p.temp > 2 && w < 0.4) setze(c, A.rohrkolben, 0.8 + z() * 0.5);
      continue;
    }
    if (p.h < 0.8 && p.meer) continue;                    // Strand
    const bi = biom(p.temp, p.feuchte);
    // Ufer: Schilf, ab und zu eine Weide
    if ((p.ufer > 0.35 || amSee) && p.temp > 2) {
      if (w < 0.4) { setze(c, A.rohrkolben, 0.8 + z() * 0.6); continue; }
      if (w > 0.96 && p.temp > 5) { setze(c, A.weide, 0.9 + 0.3 * z(), 1, 1, 1, 0.2); continue; }
    }
    // Fels: Steilhang, Gebirge, über der Baumgrenze – sonst vereinzelte Findlinge
    const fels = Math.max(glatt(0.5, 1.1, steil), glatt(1, -4, p.temp) * 0.6, p.gebirge * 0.4);
    if (w < 0.006 + 0.1 * fels) {
      const gf = GESTEIN_FARBE[p.gestein], t = 0.9 + 0.2 * z();
      const tint = [gf[0] / GRANIT_BASIS[0] * t, gf[1] / GRANIT_BASIS[1] * t, gf[2] / GRANIT_BASIS[2] * t];
      if (p.gestein === GESTEIN.SCHIEFER) setze(c, A.schiefer, (0.25 + 1.3 * z() ** 2) * (1 + fels), t, t, t, 0.15);
      else if (fels > 0.5 && z() < 0.25) setze(c, A.felsnadel, 0.6 + 0.8 * z(), tint[0], tint[1], tint[2], 0.3);
      else setze(c, A.granitblock, (0.25 + 1.3 * z() ** 2) * (1 + fels), tint[0], tint[1], tint[2], 0.15);
      continue;
    }
    if (fels > 0.6 && w < 0.2) { setze(c, A.geroell, 1 + z()); continue; } // Schutthalde
    // Bäume
    const wald = waldDichte(p.temp, p.feuchte, p.v) * (1 - glatt(0.45, 0.8, steil));
    const einzeln = bi === BIOM.SAVANNE ? 0.025 : bi === BIOM.GRASLAND ? 0.006 : bi === BIOM.STEPPE ? 0.004 : 0.002;
    const w2 = z();
    const liste = BAEUME[bi];
    if (liste && w2 < wald * 0.24 + einzeln * (1 - glatt(0.6, 1, steil))) {
      const [art, , sk] = wahl(liste, z());
      const g = 0.85 + 0.3 * z();
      const tot = art !== 'fichte' && art !== 'birke' && z() < 0.02;   // ab und zu ein toter Baum
      setze(c, tot ? A.toterBaum : A[art], sk * (0.75 + 0.5 * z()), g, g, g, 0.3);
      continue;
    }
    // Boden: Büsche, Farne, Blumen, Pilze, Totholz …
    const im = wald > 0.4 ? bi : (bi === BIOM.MISCHWALD || bi === BIOM.LAUBWALD || bi === BIOM.NADELWALD ? BIOM.GRASLAND : bi);
    const boden = BODEN[im];
    if (boden) {
      let x = z();
      for (const [art, pw, sk] of boden) {
        if (x < pw) { setze(c, A[art], sk * (0.7 + 0.6 * z()), 1, 1, 1, 0.05); break; }
        x -= pw;
      }
    }
    // Gras-Büschel um den Kandidaten (Höhe aus den Nachbarn), trockener = gelber
    const gras = Math.min(GRAS_MAX, (GRAS[bi] || 0) * (0.4 + 0.8 * p.feuchte) * (1 - glatt(0.5, 1, steil)));
    const gr = 1 + 0.5 * glatt(0.5, 0.15, p.feuchte), gb = 1 - 0.4 * glatt(0.5, 0.15, p.feuchte);
    for (let q = 0; q < GRAS_MAX; q++) {
      if (z() >= gras - q) continue;
      const fi = i + 0.5 + (z() - 0.5), fj = j + 0.5 + (z() - 0.5);
      const i0 = Math.floor(fi - 0.5), j0 = Math.floor(fj - 0.5), tx = fi - 0.5 - i0, ty = fj - 0.5 - j0;
      const hh = (hAt(i0, j0) * (1 - tx) + hAt(i0 + 1, j0) * tx) * (1 - ty) + (hAt(i0, j0 + 1) * (1 - tx) + hAt(i0 + 1, j0 + 1) * tx) * ty;
      wuerfelZuKugel(k.f, u0 + (s * fi) / M, v0 + (s * fj) / M, dir);
      const l = Math.hypot(dir[0], dir[1], dir[2]);
      const t = 0.85 + 0.3 * z();
      ablegen(dir[0] / l, dir[1] / l, dir[2] / l, hh - 0.08, A.grasbueschel, 0.8 + 0.7 * z(), gr * t, t, gb * t);
    }
  }
  return { key: k.key, mitte: [cx, cy, cz], daten: new Float32Array(raus), anzahl: raus.length / STRIDE };
}
