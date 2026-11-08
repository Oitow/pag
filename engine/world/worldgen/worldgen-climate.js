/**
 * @modul    worldgen-climate
 * @zweck    Klima für den Weltgenerator: Temperatur nach Höhe/Breitengrad, Feuchte aus Wassernähe, Rauschen und Regenschatten (Windrichtung)
 * @api      regenSchatten(H,ozean,b,t,windGrad,staerke) -> Float32Array ; boxBlur(arr,b,t,r,iter) -> arr ; stufeKlima(welt, opts) -> void
 * @beispiel
 *   import { stufeKlima } from '../../engine/world/worldgen/worldgen-climate.js';
 *   stufeKlima(welt, { seed: 1, klima: { wind: 270, regenschatten: 1 } });
 *   const warm = welt.temperatur[i] > 0.7, nass = welt.feuchte[i] > 0.6;
 * @tags     welt, worldgen, klima, temperatur, feuchte, regen
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { createNoise2D, fbm2 } from '../../core/noise.js';
import { hashSeed } from '../../core/rng.js';
import { chamferDistanz, FLAG, WASSER } from './worldgen-grid.js';

/** Trennbarer Box-Weichzeichner (an Ort und Stelle). */
export function boxBlur(arr, b, t, r = 2, iter = 2) {
  const tmp = new Float32Array(Math.max(b, t));
  for (let it = 0; it < iter; it++) {
    for (let y = 0; y < t; y++) { // Zeilen
      const o = y * b;
      let s = 0, c = 0;
      for (let x = 0; x < r && x < b; x++) { s += arr[o + x]; c++; }
      for (let x = 0; x < b; x++) {
        if (x + r < b) { s += arr[o + x + r]; c++; }
        if (x - r - 1 >= 0) { s -= arr[o + x - r - 1]; c--; }
        tmp[x] = s / c;
      }
      for (let x = 0; x < b; x++) arr[o + x] = tmp[x];
    }
    for (let x = 0; x < b; x++) { // Spalten
      let s = 0, c = 0;
      for (let y = 0; y < r && y < t; y++) { s += arr[y * b + x]; c++; }
      for (let y = 0; y < t; y++) {
        if (y + r < t) { s += arr[(y + r) * b + x]; c++; }
        if (y - r - 1 >= 0) { s -= arr[(y - r - 1) * b + x]; c--; }
        tmp[y] = s / c;
      }
      for (let y = 0; y < t; y++) arr[y * b + x] = tmp[y];
    }
  }
  return arr;
}

/**
 * Regenschatten: Luftfeuchte wird mit dem Wind über die Karte getragen, über Wasser aufgeladen,
 * an Steigungen abgeregnet. Ergebnis: Niederschlag pro Zelle (relativ, ~0..1).
 * windGrad: Richtung, in die der Wind weht (0 = +x/Osten, 90 = +y/Süden).
 */
export function regenSchatten(H, ozean, b, t, windGrad = 0, staerke = 1) {
  const n = b * t, R = new Float32Array(n), C = new Float32Array(n);
  const a = (windGrad * Math.PI) / 180;
  let wx = Math.cos(a), wy = Math.sin(a);
  const xDom = Math.abs(wx) >= Math.abs(wy);
  const m = xDom ? Math.abs(wx) : Math.abs(wy);
  wx /= m; wy /= m; // Hauptachse = genau ±1
  const P = xDom ? b : t, S = xDom ? t : b;            // Haupt-/Nebenachse
  const sp = xDom ? (wx > 0 ? 1 : -1) : (wy > 0 ? 1 : -1);
  const sek = xDom ? wy : wx;                             // Versatz auf der Nebenachse pro Schritt
  // Index = p * ps + s * ss (ohne Closure im heißen Pfad)
  const ps = xDom ? 1 : b, ss = xDom ? b : 1;
  const steig = 9 * staerke, basis = 0.012;
  for (let k = 0; k < P; k++) {
    const p = sp > 0 ? k : P - 1 - k, pu = p - sp;
    for (let s = 0; s < S; s++) {
      const i = p * ps + s * ss;
      let c, hu;
      if (pu < 0 || pu >= P) { c = 1; hu = H[i]; }
      else {
        let su = s - sek;
        if (su < 0) su = 0; else if (su > S - 1) su = S - 1;
        const s0 = su | 0, s1 = s0 + 1 < S ? s0 + 1 : s0, f = su - s0;
        const i0 = pu * ps + s0 * ss, i1 = pu * ps + s1 * ss;
        c = C[i0] * (1 - f) + C[i1] * f;
        hu = H[i0] * (1 - f) + H[i1] * f;
      }
      let regen;
      if (ozean[i]) { c += (1 - c) * 0.12; regen = c * basis; }
      else {
        const h = H[i] > 0 ? H[i] : 0, anstieg = h - (hu > 0 ? hu : 0);
        regen = c * (basis + (anstieg > 0 ? anstieg * steig : 0));
        if (regen > c * 0.5) regen = c * 0.5;
        c -= regen * 0.8;
        c += (0.35 - c) * 0.01; // Verdunstung über Land: Luft trocknet nie ganz aus
      }
      C[i] = c; R[i] = regen;
    }
  }
  return R;
}

/**
 * Pipeline-Stufe Klima. Ergebnis: welt.temperatur, welt.feuchte (Float32 0..1), welt.wasserDistanz, welt.meerDistanz (Zellen).
 * opts.klima: { temperatur, feuchte, hoehenKaelte, breitengrad ('keine'|'nord'|'sued'|'aequator'), breitenSpanne, wind, regenschatten, wasserNaehe, rauschen }
 */
export function stufeKlima(welt, opts) {
  const K = opts.klima || {};
  const { breite: b, tiefe: t, hoehe: H, flags: FL } = welt;
  const n = b * t, seed = opts.seed ?? 1;
  const T = welt.temperatur, M = welt.feuchte;
  const nT = createNoise2D(hashSeed(seed, 'temperatur')), nF = createNoise2D(hashSeed(seed, 'feuchte'));
  const s = 1 / (opts.hoehe?.massstab || Math.max(b, t));

  const wMaske = new Uint8Array(n), oMaske = new Uint8Array(n);
  for (let i = 0; i < n; i++) { wMaske[i] = FL[i] & WASSER ? 1 : 0; oMaske[i] = FL[i] & FLAG.OZEAN ? 1 : 0; }
  welt.wasserDistanz = chamferDistanz(wMaske, b, t);
  welt.meerDistanz = chamferDistanz(oMaske, b, t);

  const tBasis = K.temperatur ?? 0.55, kaelte = K.hoehenKaelte ?? 0.55;
  const bg = K.breitengrad || 'keine', bSp = K.breitenSpanne ?? 0.35;
  const tR = K.rauschen ?? 0.08, fBasis = K.feuchte ?? 0.5;
  const nahR = K.wasserNaeheRadius ?? 10 * Math.max(1, Math.max(b, t) / 256), nahG = K.wasserNaehe ?? 0.2;
  const rs = K.regenschatten ?? 1;

  let regen = null, regenMittel = 1;
  if (rs > 0) {
    regen = regenSchatten(H, oMaske, b, t, K.wind ?? 0, rs);
    boxBlur(regen, b, t, Math.max(1, Math.round(3 * Math.max(b, t) / 256)), 2);
    let sum = 0, cnt = 0;
    for (let i = 0; i < n; i++) if (!oMaske[i]) { sum += regen[i]; cnt++; }
    regenMittel = cnt ? sum / cnt : 1;
    if (!(regenMittel > 0)) regenMittel = 1;
  }

  for (let y = 0; y < t; y++) {
    const v = t > 1 ? y / (t - 1) : 0.5;
    let breit = 0;
    if (bg === 'nord') breit = (0.5 - v) * 2 * bSp;
    else if (bg === 'sued') breit = (v - 0.5) * 2 * bSp;
    else if (bg === 'aequator') breit = (Math.abs(v - 0.5) * 2 - 0.5) * bSp * 2;
    for (let x = 0; x < b; x++) {
      const i = y * b + x, h = H[i] > 0 ? H[i] : 0;
      let tt = tBasis - kaelte * h - breit + tR * fbm2(nT, x * s * 3 + 11, y * s * 3 - 7, 2);
      T[i] = tt < 0 ? 0 : tt > 1 ? 1 : tt;
      let m = fBasis + 0.22 * fbm2(nF, x * s * 4 - 23, y * s * 4 + 5, 3);
      const wd = welt.wasserDistanz[i];
      m += nahG * (1 - (wd < nahR ? wd / nahR : 1)) - nahG * 0.3;
      if (regen) { const q = Math.sqrt(regen[i] / regenMittel); m += 0.25 * rs * ((q < 1.8 ? q : 1.8) - 1); }
      M[i] = m < 0 ? 0 : m > 1 ? 1 : m;
    }
  }
  welt.regen = regen;
}
