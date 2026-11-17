/**
 * @modul    riesenbaum-krone
 * @zweck    Krone des Riesenbaums (rein, ohne THREE): wenige sehr dicke Hauptäste als Skelett, Laub als große weiche Gauß-Blobs, hängende Bartflechten
 * @api      baueKrone({ H, R, kronenAb, achse, radius, detail, r }) -> { aeste [{ punkte [[x,y,z,radius]…], ordnung }], buschel [{ m, r }], kronenRadius } ; laubSplats(ziel, krone, { seed, anzahl, H, kronenAb }) -> gesetzt ; bartSplats(ziel, krone, { seed, anzahl }) -> gesetzt ; glaette(punkte, teile) ; farbeLin('#rrggbb') -> [r,g,b] linear ; mische(a, b, t)
 * @beispiel
 *   import { createSplatDaten } from '../../engine/render/gauss-saat.js';
 *   import { laubSplats } from '../../engine/models/natur/riesenbaum-krone.js';
 *   const ziel = createSplatDaten();
 *   laubSplats(ziel, form.krone, { seed: 7, anzahl: 5000, H: 110, kronenAb: 60 });   // form aus riesenbaum-form.js
 * @tags     natur, baum, riesenbaum, krone, laub, splats, gauss, flechte, daemmerwald
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { rng, hashSeed } from '../../core/rng.js';
import { quatAusNormale } from '../../render/gauss-saat.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const stufe = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** '#rrggbb' (sRGB) → [r,g,b] linear 0..1. */
export function farbeLin(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
}
export const mische = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Catmull-Rom durch Punkte (beliebig viele Komponenten) → feinere Punktfolge, damit Bögen keine Knicke haben. */
export function glaette(p, teile = 3) {
  const aus = [];
  for (let i = 0; i + 1 < p.length; i++) {
    const a = p[Math.max(0, i - 1)], b = p[i], c = p[i + 1], d = p[Math.min(p.length - 1, i + 2)];
    for (let s = 0; s < teile; s++) {
      const t = s / teile, t2 = t * t, t3 = t2 * t;
      aus.push(b.map((_, k) => 0.5 * (2 * b[k] + (c[k] - a[k]) * t + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t2 + (3 * b[k] - a[k] - 3 * c[k] + d[k]) * t3)));
    }
  }
  aus.push(p[p.length - 1].slice());
  return aus;
}

/** Kronen-Skelett: Hauptäste ab kronenAb (unten bleibt der Stamm kahl), je zwei Nebenäste, Laub-Büschel an den äußeren Astteilen. */
export function baueKrone({ H, R, kronenAb, achse, radius, detail = 1, r }) {
  const rr = (a, b) => a + (b - a) * r(), m = H / 110, TAU = Math.PI * 2;
  const aeste = [], buschel = [], a2 = [0, 0];

  function zweig({ x0, y0, z0, az, len, rb, steig, punkte, ordnung, kragen = 0.55 }) {
    const ph = rr(0, TAU), bieg = rr(0.2, 0.5) * (r() < 0.5 ? -1 : 1), P = [];
    for (let i = 0; i < punkte; i++) {
      const s = i / (punkte - 1), a = az + bieg * Math.sin(s * 2.6 + ph) * s, d = len * s * 0.92;
      const rad = rb * (0.2 + 0.8 * Math.pow(1 - s, 0.9)) * (1 + kragen * Math.exp(-s * 9));
      P.push([x0 + Math.cos(a) * d, y0 + len * (Math.sin(steig) * s - 0.3 * s * s + 0.22 * s * s * s), z0 + Math.sin(a) * d, rad]);
    }
    const ast = { punkte: glaette(P, 2), ordnung };
    aeste.push(ast);
    return ast;
  }
  const bei = (ast, s) => { const p = ast.punkte, f = s * (p.length - 1), i = Math.min(p.length - 2, Math.floor(f)), t = f - i; return p[i].map((v, k) => v + (p[i + 1][k] - v) * t); };
  const busch = (ast, s, rad) => { const p = bei(ast, s); buschel.push({ m: [p[0], p[1] + rad * 0.25, p[2]], r: rad }); };

  const nA = detail >= 1 ? 7 : 5, phase = rr(0, TAU);
  for (let j = 0; j < nA; j++) {
    const u = j / (nA - 1), y0 = kronenAb + (H * 0.87 - kronenAb) * Math.pow(u, 0.9) + rr(-1.5, 1.5) * m;
    const az = phase + j * 2.4 + rr(-0.35, 0.35), len = (38 - 20 * u) * rr(0.85, 1.12) * m;
    achse(y0, a2);
    const ast = zweig({ x0: a2[0], y0, z0: a2[1], az, len, rb: radius(y0) * rr(0.4, 0.5), steig: rr(0.3, 0.6) + 0.25 * u, punkte: 8, ordnung: 1 });
    busch(ast, 0.5, rr(6, 7.5) * m); busch(ast, 0.76, rr(7.5, 9.5) * m); busch(ast, 1, rr(8.5, 11) * m);
    for (const seite of [-1, 1]) {                                   // zwei Nebenäste
      const p = bei(ast, rr(0.38, 0.68));
      const neben = zweig({ x0: p[0], y0: p[1], z0: p[2], az: az + seite * rr(0.6, 1.05), len: len * rr(0.42, 0.6), rb: p[3] * 0.72, steig: rr(0.35, 0.75), punkte: 5, ordnung: 2, kragen: 0.25 });
      busch(neben, 0.6, rr(5.5, 7) * m); busch(neben, 1, rr(6.5, 8.5) * m);
    }
  }
  for (let j = 0; j < 2; j++) {                                     // abgebrochene Aststümpfe im kahlen Teil
    const y0 = H * rr(0.36, 0.5); achse(y0, a2);
    zweig({ x0: a2[0], y0, z0: a2[1], az: rr(0, TAU), len: (radius(y0) + rr(4, 8)) * 1.1, rb: rr(0.8, 1.2) * (R / 5.5), steig: rr(0.1, 0.5), punkte: 4, ordnung: 3, kragen: 0.9 });
  }
  achse(H * 0.95, a2);
  buschel.push({ m: [a2[0], H * 0.95, a2[1]], r: 9 * m }, { m: [a2[0] + rr(-4, 4), H * 0.86, a2[1] + rr(-4, 4)], r: 8 * m });
  let kronenRadius = 0;
  for (const b of buschel) kronenRadius = Math.max(kronenRadius, Math.hypot(b.m[0], b.m[2]) + b.r);
  return { aeste, buschel, kronenRadius };
}

const LAUB = ['#16261b', '#1f3423', '#2a3d24', '#36472a', '#465430'].map(farbeLin);

/** Laub: je Büschel viele große, weiche, leicht abgeflachte Blobs; Unterseite dunkler, oben und außen heller und beweglicher. */
export function laubSplats(ziel, krone, { seed = 1, anzahl = 5400, H = 110, kronenAb = 60 } = {}) {
  const r = rng(hashSeed('riesenbaum-laub', seed)), rr = (a, b) => a + (b - a) * r(), q = [0, 0, 0, 1], m = H / 110;
  let summe = 0, gesetzt = 0;
  for (const b of krone.buschel) summe += b.r * b.r;
  for (const b of krone.buschel) {
    const n = Math.round((anzahl * b.r * b.r) / summe);
    for (let i = 0; i < n && gesetzt < anzahl; i++) {
      let dx = rr(-1, 1), dy = rr(-0.8, 1), dz = rr(-1, 1);
      const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
      const tief = 0.42 + 0.58 * Math.cbrt(r()), rad = b.r * tief;
      const x = b.m[0] + dx * rad, y = b.m[1] + dy * rad * 0.62, z = b.m[2] + dz * rad;
      let nx = dx * 0.6, ny = dy * 0.6 + 0.55, nz = dz * 0.6;
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      quatAusNormale(nx, ny, nz, rr(0, 6.283), q);
      const g = rr(0.8, 2.3) * m * (0.75 + 0.25 * b.r / (9 * m));
      const licht = (0.42 + 0.58 * stufe(-0.7, 0.75, dy)) * (0.72 + 0.4 * clamp((y - kronenAb) / (H - kronenAb), 0, 1)) * (0.55 + 0.45 * tief) * rr(0.85, 1.12);
      const ton = clamp(0.5 * stufe(-0.5, 0.9, dy) + 0.5 * r() + 0.15 * tief - 0.1, 0, 0.999) * (LAUB.length - 1), ti = Math.floor(ton);
      const f = mische(LAUB[ti], LAUB[ti + 1], ton - ti);
      ziel.plus(x, y, z, g, g * rr(0.75, 1), g * rr(0.42, 0.6), q[0], q[1], q[2], q[3], f[0] * licht, f[1] * licht, f[2] * licht, rr(0.72, 0.93), clamp(0.3 + 0.7 * tief * rr(0.6, 1.1), 0.3, 1));
      gesetzt++;
    }
  }
  return gesetzt;
}

const BART = [farbeLin('#6f7c62'), farbeLin('#8d9a7c')];

/** Bartflechten: schmale, lange Schleier, die unter den Ästen hängen und im Wind wehen (wind = 1). */
export function bartSplats(ziel, krone, { seed = 1, anzahl = 520 } = {}) {
  const r = rng(hashSeed('riesenbaum-bart', seed)), rr = (a, b) => a + (b - a) * r();
  let gewicht = 0, gesetzt = 0;
  const g = (a) => (a.ordnung === 1 ? 3 : a.ordnung === 2 ? 1 : 0.4);
  for (const a of krone.aeste) gewicht += g(a);
  for (const a of krone.aeste) {
    const n = Math.round((anzahl * g(a)) / gewicht), p = a.punkte;
    for (let i = 0; i < n && gesetzt < anzahl; i++) {
      const f = rr(0.18, 0.97) * (p.length - 1), k = Math.min(p.length - 2, Math.floor(f)), t = f - k;
      const x = p[k][0] + (p[k + 1][0] - p[k][0]) * t, y = p[k][1] + (p[k + 1][1] - p[k][1]) * t, z = p[k][2] + (p[k + 1][2] - p[k][2]) * t, rad = p[k][3] + (p[k + 1][3] - p[k][3]) * t;
      const lang = rr(0.6, 1.9), dick = rr(0.12, 0.3), c = mische(BART[0], BART[1], r()), hell = rr(0.6, 1);
      ziel.plus(x + rr(-0.6, 0.6) * rad, y - rad * 0.8 - lang * 1.4, z + rr(-0.6, 0.6) * rad, dick, lang, dick * rr(0.5, 1), 0, 0, 0, 1, c[0] * hell, c[1] * hell, c[2] * hell, rr(0.4, 0.65), 1);
      gesetzt++;
    }
  }
  return gesetzt;
}
