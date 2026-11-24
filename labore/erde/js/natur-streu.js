// Streuung der Natur-Assets (reine Logik, ohne THREE, läuft im Worker oder im Hauptthread).
// Die Welt ist in Streu-Kacheln (Quadtree-Stufe mit ~80 m Kante) geteilt. Jede Kachel würfelt aus ihrem Schlüssel
// ein festes Raster von Kandidaten (4 m), fragt dort den Planeten (Höhe, Wasser, Klima, Gestein) und entscheidet, was wächst.
// Gleicher Seed + gleiche Kachel → gleiche Natur (wichtig für später: Mehrspieler, Speichern, Abholzen).
import { kachelUV, kachelMitte, wuerfelZuKugel } from './planet-baum.js';
import { rng, hashSeed } from '../../../engine/core/rng.js';
import { waldDichte, nadelAnteil } from './klima.js';
import { GESTEIN, GESTEIN_FARBE } from './geologie.js';

// Reihenfolge = Index im Ergebnis. Muss zu naturfundus.arten passen (ohne die Fische doppelt).
export const STREU_ARTEN = ['fichte', 'birke', 'granitblock', 'schiefer', 'rohrkolben', 'seerose', 'steinpilz', 'forelle', 'barsch'];
const A = Object.fromEntries(STREU_ARTEN.map((a, i) => [a, i]));
export const STRIDE = 10; // art, px, py, pz (m, relativ zur Kachelmitte auf Meereshöhe), skala, drehung, r, g, b, frei
const RASTER = 20;        // 20×20 Kandidaten je Kachel
const GRANIT_BASIS = [0.57, 0.545, 0.51];

const glatt = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

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
  // 1) Kandidaten abfragen
  const D = new Float64Array(n * 3), P = [];
  const dir = [0, 0, 0];
  for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
    wuerfelZuKugel(k.f, u0 + (s * (i + 0.15 + 0.7 * z())) / M, v0 + (s * (j + 0.15 + 0.7 * z())) / M, dir);
    const l = Math.hypot(dir[0], dir[1], dir[2]);
    const c = j * M + i;
    D[c * 3] = dir[0] / l; D[c * 3 + 1] = dir[1] / l; D[c * 3 + 2] = dir[2] / l;
    const p = planet.probe(D[c * 3], D[c * 3 + 1], D[c * 3 + 2], 2);
    P.push({ h: p.h, wasser: p.wasser, ufer: p.ufer, fluss: p.fluss, meer: p.meer, temp: p.temp, feuchte: p.feuchte,
      gebirge: p.gebirge, gestein: p.gestein, v: planet.flecken(D[c * 3], D[c * 3 + 1], D[c * 3 + 2]) });
  }
  const zelle = (s * R * Math.PI / 4) / M; // ~Abstand zweier Kandidaten (m)
  // 2) entscheiden
  const raus = [];
  const setze = (c, art, skala, r = 1, g = 1, b = 1, tiefer = 0) => {
    const p = P[c], hh = (art === A.forelle || art === A.barsch || art === A.seerose) ? p.wasser : p.h;
    const rr = R + hh - tiefer;
    raus.push(art, D[c * 3] * rr - cx, D[c * 3 + 1] * rr - cy, D[c * 3 + 2] * rr - cz, skala, z() * Math.PI * 2, r, g, b, 0);
  };
  for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
    const c = j * M + i, p = P[c];
    const nassTief = p.wasser - p.h;                      // > 0: unter Wasser
    // Hangneigung aus den Nachbarn
    const hl = P[j * M + Math.max(0, i - 1)].h, hr = P[j * M + Math.min(M - 1, i + 1)].h;
    const hu = P[Math.max(0, j - 1) * M + i].h, ho = P[Math.min(M - 1, j + 1) * M + i].h;
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
    // Ufer: Schilf
    if ((p.ufer > 0.35 || amSee) && p.temp > 2 && w < 0.45) { setze(c, A.rohrkolben, 0.8 + z() * 0.6); continue; }
    // Fels: Steilhang, Gebirge, über der Baumgrenze – sonst vereinzelte Findlinge
    const fels = Math.max(glatt(0.5, 1.1, steil), glatt(1, -4, p.temp) * 0.6, p.gebirge * 0.4);
    if (w < 0.006 + 0.1 * fels) {
      const gf = GESTEIN_FARBE[p.gestein], t = 0.9 + 0.2 * z();
      const art = p.gestein === GESTEIN.SCHIEFER ? A.schiefer : A.granitblock;
      const tint = art === A.schiefer ? [t, t, t] : [gf[0] / GRANIT_BASIS[0] * t, gf[1] / GRANIT_BASIS[1] * t, gf[2] / GRANIT_BASIS[2] * t];
      setze(c, art, (0.25 + 1.3 * z() ** 2) * (1 + fels), tint[0], tint[1], tint[2], 0.15);
      continue;
    }
    // Wald
    const wald = waldDichte(p.temp, p.feuchte, p.v) * (1 - glatt(0.45, 0.8, steil));
    const w2 = z();
    if (w2 < wald * 0.24 + 0.003) {
      const nadel = z() < nadelAnteil(p.temp) * 0.9 + 0.05;
      const g = 0.85 + 0.3 * z();
      const warm = glatt(18, 26, p.temp);                 // Tropen: sattgrün, größer
      if (nadel) setze(c, A.fichte, 1.6 + 1.4 * z(), g, g, g, 0.3);
      else setze(c, A.birke, (1.8 + 1.2 * z()) * (1 + 0.4 * warm), g * (1 - 0.3 * warm), g, g * (1 - 0.3 * warm), 0.3);
      continue;
    }
    if (wald > 0.5 && p.temp > 3 && w2 > 0.985) setze(c, A.steinpilz, 0.9 + 0.5 * z());
  }
  return { key: k.key, mitte: [cx, cy, cz], daten: new Float32Array(raus), anzahl: raus.length / STRIDE };
}
