/**
 * @modul    noise
 * @zweck    Seedbares Simplex-Rauschen 2D/3D plus fBm, Grat-Rauschen und Domain-Warp für Terrain, Biome und Texturen
 * @api      createNoise2D(seed) -> (x,y)=>[-1,1] ; createNoise3D(seed) -> (x,y,z)=>[-1,1] ; fbm2(n2,x,y,okt,lac,gain) ; fbm(n3,x,y,z,okt,lac,gain) ; ridged2(n2,x,y,okt) -> [0,1] ; ridged(n3,x,y,z,okt) -> [0,1] ; warp2(n2,x,y,staerke,frequenz) -> [x,y]
 * @beispiel
 *   import { createNoise2D, fbm2 } from '../../engine/core/noise.js';
 *   const n = createNoise2D(42);
 *   const hoehe = fbm2(n, x * 0.01, y * 0.01, 5);
 * @tags     rauschen, noise, terrain, welt, prozedural
 * @version  1.0.0
 * @status   stabil
 * @three    nein
 */
import { rng } from './rng.js';

function permutation(seed) {
  const r = rng(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  return perm;
}

// 2D-Gradienten: 12 Richtungen, gleichmäßig verteilt
const G2X = new Float32Array(12), G2Y = new Float32Array(12);
for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; G2X[i] = Math.cos(a); G2Y[i] = Math.sin(a); }

/** 2D-Simplex (Gustavson), Ausgabe ca. [-1, 1]. */
export function createNoise2D(seed) {
  const perm = permutation(seed);
  const pm12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) pm12[i] = perm[i] % 12;
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  return function noise2(x, y) {
    const s = (x + y) * F2;
    const i = Math.floor(x + s), j = Math.floor(y + s);
    const t = (i + j) * G2;
    const x0 = x - (i - t), y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0, tt, g;
    tt = 0.5 - x0 * x0 - y0 * y0;
    if (tt > 0) { g = pm12[ii + perm[jj]]; tt *= tt; n += tt * tt * (G2X[g] * x0 + G2Y[g] * y0); }
    tt = 0.5 - x1 * x1 - y1 * y1;
    if (tt > 0) { g = pm12[ii + i1 + perm[jj + j1]]; tt *= tt; n += tt * tt * (G2X[g] * x1 + G2Y[g] * y1); }
    tt = 0.5 - x2 * x2 - y2 * y2;
    if (tt > 0) { g = pm12[ii + 1 + perm[jj + 1]]; tt *= tt; n += tt * tt * (G2X[g] * x2 + G2Y[g] * y2); }
    return 99 * n;
  };
}

const G3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];

/** 3D-Simplex (Gustavson), Ausgabe ca. [-1, 1]. Gleiche Werte wie planet/js/noise.js. */
export function createNoise3D(seed) {
  const perm = permutation(seed);
  const pm12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) pm12[i] = perm[i] % 12;
  const F3 = 1 / 3, Gk = 1 / 6;
  return function noise3(xin, yin, zin) {
    let n0, n1, n2, n3;
    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
    const t = (i + j + k) * Gk;
    const x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }
    const x1 = x0 - i1 + Gk, y1 = y0 - j1 + Gk, z1 = z0 - k1 + Gk;
    const x2 = x0 - i2 + 2 * Gk, y2 = y0 - j2 + 2 * Gk, z2 = z0 - k2 + 2 * Gk;
    const x3 = x0 - 1 + 3 * Gk, y3 = y0 - 1 + 3 * Gk, z3 = z0 - 1 + 3 * Gk;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 < 0) n0 = 0; else { const g = G3[pm12[ii + perm[jj + perm[kk]]]]; t0 *= t0; n0 = t0 * t0 * (g[0] * x0 + g[1] * y0 + g[2] * z0); }
    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 < 0) n1 = 0; else { const g = G3[pm12[ii + i1 + perm[jj + j1 + perm[kk + k1]]]]; t1 *= t1; n1 = t1 * t1 * (g[0] * x1 + g[1] * y1 + g[2] * z1); }
    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t2 < 0) n2 = 0; else { const g = G3[pm12[ii + i2 + perm[jj + j2 + perm[kk + k2]]]]; t2 *= t2; n2 = t2 * t2 * (g[0] * x2 + g[1] * y2 + g[2] * z2); }
    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t3 < 0) n3 = 0; else { const g = G3[pm12[ii + 1 + perm[jj + 1 + perm[kk + 1]]]]; t3 *= t3; n3 = t3 * t3 * (g[0] * x3 + g[1] * y3 + g[2] * z3); }
    return 32 * (n0 + n1 + n2 + n3);
  };
}

/** Fraktales 2D-Rauschen, Ausgabe ca. [-1, 1]. */
export function fbm2(n2, x, y, okt = 5, lac = 2, gain = 0.5) {
  let sum = 0, amp = 1, f = 1, norm = 0;
  for (let o = 0; o < okt; o++) { sum += amp * n2(x * f, y * f); norm += amp; amp *= gain; f *= lac; }
  return sum / norm;
}

/** Fraktales 3D-Rauschen, Ausgabe ca. [-1, 1]. */
export function fbm(n3, x, y, z, okt = 5, lac = 2, gain = 0.5) {
  let sum = 0, amp = 1, f = 1, norm = 0;
  for (let o = 0; o < okt; o++) { sum += amp * n3(x * f, y * f, z * f); norm += amp; amp *= gain; f *= lac; }
  return sum / norm;
}

/** Grat-Rauschen 2D für Bergketten, Ausgabe [0, 1]. */
export function ridged2(n2, x, y, okt = 4) {
  let sum = 0, amp = 0.5, f = 1, prev = 1;
  for (let o = 0; o < okt; o++) {
    let n = 1 - Math.abs(n2(x * f, y * f));
    n *= n; sum += n * amp * prev; prev = n; amp *= 0.5; f *= 2.1;
  }
  return Math.min(1, sum * 1.1);
}

/** Grat-Rauschen 3D, Ausgabe [0, 1]. Gleiche Werte wie planet/js/noise.js. */
export function ridged(n3, x, y, z, okt = 4) {
  let sum = 0, amp = 0.5, f = 1, prev = 1;
  for (let o = 0; o < okt; o++) {
    let n = 1 - Math.abs(n3(x * f, y * f, z * f));
    n *= n; sum += n * amp * prev; prev = n; amp *= 0.5; f *= 2.1;
  }
  return Math.min(1, sum * 1.1);
}

/** Domain-Warp: verschiebt (x,y) per Rauschen → natürlichere, verwirbelte Formen. */
export function warp2(n2, x, y, staerke = 1, frequenz = 1) {
  const qx = fbm2(n2, x * frequenz + 5.2, y * frequenz + 1.3, 3);
  const qy = fbm2(n2, x * frequenz + 1.7, y * frequenz + 9.2, 3);
  return [x + qx * staerke, y + qy * staerke];
}
