/**
 * @modul    terrain-farben
 * @zweck    Geländefarben je Gitterzelle aus einer erzeugten Welt: weiche Biom-Übergänge mit ausgefransten Grenzen, Wiesenflecken und trockene Grastöne, Mikrovariation, Hangfels mit Gesteinsbändern, nasser Sand, Flusskies und Seeschlamm, Meeresgrund nach Tiefe, Schnee mit Rauschgrenze (an Nordhängen tiefer), Mulden dunkler
 * @api      GELAENDE_FARBEN ; gelaendeFarben(welt, opts) -> Float32Array (B×T×3, linear 0…1) ; srgbZuLinear(v) -> number
 * @beispiel
 *   import { gelaendeFarben } from '../../engine/world/terrain-farben.js';
 *   const f = gelaendeFarben(welt, { hoehenSkala: 60, meterProZelle: 2 });   // f[(y*B+x)*3] = Rot (linear)
 *   const nurBiome = gelaendeFarben(welt, { hoehenSkala: 60, meterProZelle: 2, details: false });
 * @tags     welt, terrain, gelaende, farben, biome, schnee, ufer, vertexfarben
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { createNoise2D, fbm2 } from '../core/noise.js';
import { hash2, hashSeed } from '../core/rng.js';
import { smoothstep } from '../core/math.js';
import { FLAG } from './worldgen/worldgen-grid.js';
import { boxBlur } from './worldgen/worldgen-climate.js';

/**
 * Gedämpfte Geländepalette je Biom-Key (sRGB) – passt zu Low-Poly-Bäumen. gras = Anteil Grasfläche (Wiesenflecken, Trockenheit).
 * Schnee-Biome bekommen Fels als Untergrund; der Schnee selbst kommt aus der Temperatur (weiche Rauschgrenze).
 */
export const GELAENDE_FARBEN = {
  strand: [0xd6c596, 0], wiese: [0x7fa04c, 1], laubwald: [0x5d8238, 0.55], nadelwald: [0x4f6b3b, 0.35], birkenwald: [0x7c9a50, 0.8],
  heide: [0x8f8558, 0.5], sumpf: [0x5a6440, 0.5], wueste: [0xd4b780, 0], savanne: [0xb3a65c, 1], steppe: [0xaea36e, 0.8],
  regenwald: [0x3e6d32, 0.3], tundra: [0x8c9479, 0.4], fels: [0x857c70, 0], schnee: [0x8b877f, 0], hartlaubwald: [0x86894a, 0.6],
  tiefsee: [0x2f4a4e, 0], meer: [0x9a9270, 0], see: [0x6a6448, 0], fluss: [0x958b74, 0],
};

const rgb = (hex) => [(hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255];
const TROCKEN = rgb(0xb5a862), SATT = rgb(0x5a8436), HELLGRAS = rgb(0x9fb45a), FELS = rgb(0x847b6f), FELS_WARM = rgb(0xa47f5e);
const FELS_DUNKEL = rgb(0x5f5850), NASSSAND = rgb(0xa39468), KIES = rgb(0x9b9282), SCHLAMM = rgb(0x5e5a40), SCHNEE = rgb(0xf1f4f7);
const MEERSAND = rgb(0xc4b488), MEERTIEF = rgb(0x2c4a52);

/** sRGB-Komponente (0…1) → linear. */
export function srgbZuLinear(v) { return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
const LUT_N = 1024, LUT = new Float32Array(LUT_N + 2);
for (let k = 0; k <= LUT_N + 1; k++) LUT[k] = srgbZuLinear(Math.min(1, k / LUT_N));
/** Rauschfeld B×T, grob alle `st` Zellen abgetastet und bilinear verfeinert (spart Rauschaufrufe bei weichen Feldern). */
function grobFeld(B, T, st, fn) {
  const gb = Math.ceil((B - 1) / st) + 1, gt = Math.ceil((T - 1) / st) + 1, g = new Float32Array(gb * gt), aus = new Float32Array(B * T);
  for (let j = 0; j < gt; j++) for (let i = 0; i < gb; i++) g[j * gb + i] = fn(i * st, j * st);
  for (let y = 0; y < T; y++) {
    const j = Math.min(gt - 2, Math.floor(y / st)), v = y / st - j;
    for (let x = 0; x < B; x++) {
      const i = Math.min(gb - 2, Math.floor(x / st)), u = x / st - i, k = j * gb + i;
      const o = g[k] + (g[k + 1] - g[k]) * u, w = g[k + gb] + (g[k + gb + 1] - g[k + gb]) * u;
      aus[y * B + x] = o + (w - o) * v;
    }
  }
  return aus;
}
/** Schneller 3×3-Kastenfilter (zeilenweise, cachefreundlich), iter Durchgänge; Ränder werden gekappt. */
function weich3(a, B, T, iter, tmp) {
  for (let it = 0; it < iter; it++) {
    for (let y = 0; y < T; y++) {
      const o = y * B;
      tmp[o] = (a[o] + a[o + 1]) * 0.5; tmp[o + B - 1] = (a[o + B - 2] + a[o + B - 1]) * 0.5;
      for (let x = 1; x < B - 1; x++) tmp[o + x] = (a[o + x - 1] + a[o + x] + a[o + x + 1]) * (1 / 3);
    }
    for (let x = 0; x < B; x++) { a[x] = (tmp[x] + tmp[x + B]) * 0.5; a[(T - 1) * B + x] = (tmp[(T - 2) * B + x] + tmp[(T - 1) * B + x]) * 0.5; }
    for (let y = 1; y < T - 1; y++) {
      const o = y * B;
      for (let x = 0; x < B; x++) a[o + x] = (tmp[o + x - B] + tmp[o + x] + tmp[o + x + B]) * (1 / 3);
    }
  }
}
function mische(c, f, t) {
  if (t <= 0) return; if (t > 1) t = 1;
  c[0] += (f[0] - c[0]) * t; c[1] += (f[1] - c[1]) * t; c[2] += (f[2] - c[2]) * t;
}

/**
 * opts: hoehenSkala (m je Einheit, 40), meterProZelle (1), farben {biomKey: 0xRRGGBB} (überschreibt Palette),
 * details (true; false = nur weich gemischte Biomfarben), rauschen (Stärke Mikrovariation, 1), schnee (true),
 * schneeTemp (0.08), felsAb (Steigung, ab der Fels durchkommt, 0.6), mulden (Abdunkeln konkaver Stellen, 1), weich (Mischradius in Zellen, 1).
 */
export function gelaendeFarben(welt, opts = {}) {
  const B = welt.breite, T = welt.tiefe, N = B * T, H = welt.hoehe, FL = welt.flags;
  const hs = opts.hoehenSkala ?? 40, mpz = opts.meterProZelle ?? 1, details = opts.details !== false;
  const rs = opts.rauschen ?? 1, seed = welt.seed | 0, s = 256 / Math.max(B, T);  // Rauschmaßstab bleibt je Zelle gleich
  const nA = createNoise2D(hashSeed(seed, 'gelaende-a')), nB = createNoise2D(hashSeed(seed, 'gelaende-b'));
  const nC = createNoise2D(hashSeed(seed, 'gelaende-c'));

  // ---- 1) Biomfarben mit ausgefransten Grenzen (Nachschlag leicht versetzt), danach weich gemischt ----
  const tab = welt.biome.map(bm => {
    const p = GELAENDE_FARBEN[bm.key], hex = opts.farben?.[bm.key] ?? (p ? p[0] : bm.farbe ?? 0x88aa66);
    return [...rgb(hex), p ? p[1] : 0.5];
  });
  const kan = [new Float32Array(N), new Float32Array(N), new Float32Array(N), new Float32Array(N)];
  const jx = details ? grobFeld(B, T, 2, (x, y) => 1.6 * nA(x * 0.21 * s, y * 0.21 * s)) : null;
  const jy = details ? grobFeld(B, T, 2, (x, y) => 1.6 * nA(x * 0.21 * s + 40, y * 0.21 * s - 40)) : null;
  const FLK = details ? grobFeld(B, T, 4, (x, y) => fbm2(nB, x * s * 0.07, y * s * 0.07, 3)) : null;
  for (let y = 0; y < T; y++) for (let x = 0; x < B; x++) {
    let qx = x, qy = y;
    if (details) {
      qx = Math.round(x + jx[y * B + x]); qy = Math.round(y + jy[y * B + x]);
      if (qx < 0) qx = 0; else if (qx >= B) qx = B - 1;
      if (qy < 0) qy = 0; else if (qy >= T) qy = T - 1;
    }
    const f = tab[welt.biom[qy * B + qx]], i = y * B + x;
    kan[0][i] = f[0]; kan[1][i] = f[1]; kan[2][i] = f[2]; kan[3][i] = f[3];
  }
  const weich = Math.max(0, opts.weich ?? 1);
  const tmp = new Float32Array(N);
  if (weich === 1) for (const k of kan) weich3(k, B, T, 2, tmp);
  else if (weich > 0) for (const k of kan) boxBlur(k, B, T, Math.round(weich), 2);

  // Ufer-Masken: Nähe zu Fluss / See / Meer (weich)
  let flussNah = null, seeNah = null;
  if (details) {
    flussNah = new Float32Array(N); seeNah = new Float32Array(N);
    for (let i = 0; i < N; i++) { flussNah[i] = FL[i] & FLAG.FLUSS ? 1 : 0; seeNah[i] = FL[i] & FLAG.SEE ? 1 : 0; }
    weich3(flussNah, B, T, 2, tmp); weich3(seeNah, B, T, 2, tmp);
  }

  const aus = new Float32Array(N * 3), c = [0, 0, 0];
  const schneeAn = opts.schnee !== false && details, schneeT = opts.schneeTemp ?? 0.08;
  const felsAb = opts.felsAb ?? 0.6, mulden = opts.mulden ?? 1;
  const schneeId = welt.biome.findIndex(b => b.key === 'schnee');
  const Temp = welt.temperatur, Feu = welt.feuchte, MD = welt.meerDistanz;
  for (let y = 0; y < T; y++) for (let x = 0; x < B; x++) {
    const i = y * B + x;
    c[0] = kan[0][i]; c[1] = kan[1][i]; c[2] = kan[2][i];
    const h = H[i], hM = h * hs, fl = FL[i];
    if (!details) { schreibe(aus, i, c); continue; }
    const xl = x > 0 ? i - 1 : i, xr = x < B - 1 ? i + 1 : i, yo = y > 0 ? i - B : i, yu = y < T - 1 ? i + B : i;
    const gx = (H[xr] - H[xl]) * hs / ((xr - xl || 1) * mpz), gy = (H[yu] - H[yo]) * hs / (((yu - yo) / B || 1) * mpz);
    const steig = Math.sqrt(gx * gx + gy * gy);           // Steigung (Höhe je Meter)
    const fx = x * s, fy = y * s;
    const flecken = FLK[i];                                 // große Flecken (Wiese, Trockenheit)
    const fein = nC(fx * 0.45, fy * 0.45);                  // feine Variation
    const gras = kan[3][i];

    if (fl & FLAG.OZEAN) {
      // Meeresgrund: heller Sand im Flachen, dunkel in der Tiefe
      const tiefe = -hM;
      c[0] = MEERSAND[0]; c[1] = MEERSAND[1]; c[2] = MEERSAND[2];
      mische(c, NASSSAND, smoothstep(0, 1.2, tiefe));
      mische(c, MEERTIEF, smoothstep(1, 14, tiefe));
    } else {
      // Wiesenflecken: satt ↔ trocken je nach Rauschen und Feuchte
      if (gras > 0) {
        const feu = Feu ? Feu[i] : 0.5;
        const trocken = smoothstep(0.2, 0.6, flecken + (0.4 - feu) * 0.8) * gras;
        const satt = smoothstep(0.0, 0.4, -flecken + (feu - 0.45) * 0.6) * gras;
        mische(c, TROCKEN, trocken * 0.45); mische(c, SATT, satt * 0.5);
        // kleine helle Flecken (Klee, Blüten, kurzes Gras)
        mische(c, HELLGRAS, smoothstep(0.35, 0.7, nA(fx * 0.32 + 91, fy * 0.32 - 17)) * gras * 0.35);
      }
      // nasser Sand an der Wasserlinie des Meeres
      if (MD && MD[i] < 4) mische(c, NASSSAND, (1 - smoothstep(0.15, 0.9, hM)) * (1 - smoothstep(1.5, 4, MD[i])) * 0.85);
      // Flusskies und Seeschlamm am Ufer (und im Bett, scheint durchs Wasser)
      if (flussNah[i] > 0) mische(c, KIES, smoothstep(0.02, 0.4, flussNah[i] + fein * 0.12) * 0.9);
      if (seeNah[i] > 0) mische(c, SCHLAMM, smoothstep(0.03, 0.5, seeNah[i] + fein * 0.1) * 0.7);
      // Hangfels mit Gesteinsbändern
      const fs = smoothstep(felsAb + flecken * 0.15, felsAb + 0.35 + flecken * 0.15, steig);
      if (fs > 0) {
        const warm = Temp ? smoothstep(0.62, 0.85, Temp[i]) * (Feu ? 1 - smoothstep(0.2, 0.45, Feu[i]) : 1) : 0;
        const band = 0.5 + 0.5 * Math.sin(hM * 0.7 + fein * 1.2 + flecken * 4), band2 = 0.5 + 0.5 * Math.sin(hM * 2.3 + fein * 2);
        const fc = FELS, fw = FELS_WARM;
        const fr = fc[0] + (fw[0] - fc[0]) * warm, fg = fc[1] + (fw[1] - fc[1]) * warm, fb = fc[2] + (fw[2] - fc[2]) * warm;
        const d = 0.8 + 0.22 * band + 0.08 * band2;
        c[0] += (fr * d - c[0]) * fs; c[1] += (fg * d - c[1]) * fs; c[2] += (fb * d - c[2]) * fs;
        if (steig > 1.4) mische(c, FELS_DUNKEL, smoothstep(1.4, 2.4, steig) * 0.35);
      }
      // Schnee: Temperaturgrenze mit Rauschen, an Nordhängen (Hang fällt nach −y ab) tiefer, steile Wände bleiben Fels
      if (schneeAn) {
        let sn;
        if (Temp) {
          const nord = Math.max(-1, Math.min(1, gy * 1.5));
          sn = smoothstep(schneeT + 0.022, schneeT - 0.012, Temp[i] + flecken * 0.018 + fein * 0.006 - nord * 0.014);
        } else sn = welt.biom[i] === schneeId ? 1 : 0;
        sn *= 1 - 0.75 * smoothstep(1.3, 2.6, steig + fein * 0.3);
        mische(c, SCHNEE, sn);
      }
    }
    // Mikrovariation in Helligkeit und Farbton, Mulden dunkler, Kuppen heller
    const lap = (H[xl] + H[xr] + H[yo] + H[yu]) * 0.25 - h;
    let hell = 1 + rs * (0.07 * flecken + 0.045 * fein + 0.07 * (hash2(x, y, seed) - 0.5));
    hell *= 1 - Math.max(-0.08, Math.min(0.16, lap * hs / mpz * 0.35 * mulden));
    const ton = rs * 0.025 * fein;                          // leicht gelblich ↔ bläulich
    c[0] = c[0] * hell * (1 + ton); c[1] *= hell; c[2] = c[2] * hell * (1 - ton);
    schreibe(aus, i, c);
  }
  return aus;
}

function schreibe(aus, i, c) {
  for (let k = 0; k < 3; k++) {
    const v = (c[k] < 0 ? 0 : c[k] > 1 ? 1 : c[k]) * LUT_N, j = v | 0;
    aus[i * 3 + k] = LUT[j] + (LUT[j + 1] - LUT[j]) * (v - j);
  }
}
