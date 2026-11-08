/**
 * @modul    worldgen-biomes
 * @zweck    Biome nach Whittaker (Temperatur × Feuchte, als schnelle Nachschlagetabelle) plus Prioritätsregeln (Wasser, Schnee, Fels, Strand, Sumpf); Biomliste per Spiel erweiterbar
 * @api      STANDARD_BIOME ; erstelleBiomTabelle(biomOpts) -> {liste,idVon(key)} ; klassifiziere(tab,h,hang,temp,feuchte,wasserDist,meerDist,flags) -> id ; berechneHang(H,b,t,aus?) -> Float32Array ; stufeBiome(welt, opts) -> void ; biomId(welt,key) -> id
 * @beispiel
 *   import { erstelleBiomTabelle } from '../../engine/world/worldgen/worldgen-biomes.js';
 *   const tab = erstelleBiomTabelle({ extra: [{ key: 'pilzhain', name: 'Pilzhain', farbe: 0x8a5cc0, temp: [0.4, 0.6], feuchte: [0.8, 1] }] });
 *   const id = tab.idVon('pilzhain');
 * @tags     welt, worldgen, biome, klima, whittaker
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { createNoise2D } from '../../core/noise.js';
import { hashSeed } from '../../core/rng.js';
import { FLAG } from './worldgen-grid.js';

/**
 * Standard-Biome (Index = id). Felder: key, name, farbe, temp/feuchte (Whittaker-Bereich, 0..1) und/oder regel.
 * regel: { prio, wasser: 'land'|'meer'|'see'|'fluss'|'egal', hoehe, hang, temp, feuchte, wasserDist, meerDist } – Bereiche [min,max].
 */
export const STANDARD_BIOME = [
  { key: 'tiefsee', name: 'Tiefsee', farbe: 0x1b3560, regel: { prio: 100, wasser: 'meer', hoehe: [-99, -0.2] } },
  { key: 'meer', name: 'Meer', farbe: 0x2c5a92, regel: { prio: 99, wasser: 'meer' } },
  { key: 'see', name: 'See', farbe: 0x3a74ad, regel: { prio: 98, wasser: 'see' } },
  { key: 'fluss', name: 'Fluss', farbe: 0x4485bd, regel: { prio: 97, wasser: 'fluss' } },
  { key: 'strand', name: 'Strand', farbe: 0xd8c78e, regel: { prio: 60, meerDist: [0, 3.5], hoehe: [-1, 0.045], hang: [0, 0.035] } },
  { key: 'wiese', name: 'Wiese', farbe: 0x8cb456, temp: [0.36, 0.7], feuchte: [0.3, 0.55] },
  { key: 'laubwald', name: 'Laubwald', farbe: 0x4f8a3a, temp: [0.42, 0.72], feuchte: [0.55, 0.82] },
  { key: 'nadelwald', name: 'Nadelwald', farbe: 0x2f6343, temp: [0.17, 0.42], feuchte: [0.38, 1] },
  { key: 'birkenwald', name: 'Birkenwald', farbe: 0x7ea65a, temp: [0.32, 0.46], feuchte: [0.42, 0.62] },
  { key: 'heide', name: 'Heide', farbe: 0x9a8a5e, temp: [0.3, 0.62], feuchte: [0.14, 0.3] },
  { key: 'sumpf', name: 'Sumpf', farbe: 0x56664a, regel: { prio: 50, feuchte: [0.66, 1], hoehe: [0, 0.1], hang: [0, 0.014], wasserDist: [0, 8], temp: [0.25, 1] } },
  { key: 'wueste', name: 'Wüste', farbe: 0xe0c27e, temp: [0.72, 1], feuchte: [0, 0.18] },
  { key: 'savanne', name: 'Savanne', farbe: 0xbdb35c, temp: [0.72, 1], feuchte: [0.18, 0.46] },
  { key: 'steppe', name: 'Steppe', farbe: 0xb8b07a, temp: [0.42, 0.72], feuchte: [0, 0.14] },
  { key: 'regenwald', name: 'Regenwald', farbe: 0x1f6e33, temp: [0.74, 1], feuchte: [0.64, 1] },
  { key: 'tundra', name: 'Tundra', farbe: 0x9aa58c, temp: [0.06, 0.18], feuchte: [0, 1] },
  { key: 'fels', name: 'Fels', farbe: 0x7d7a74, regel: { prio: 70, hang: [0.07, 99] } },
  { key: 'schnee', name: 'Schnee', farbe: 0xf2f5f8, temp: [0, 0.06], feuchte: [0, 1], regel: { prio: 80, temp: [0, 0.055] } },
  { key: 'hartlaubwald', name: 'Hartlaubwald', farbe: 0x7b8f45, temp: [0.72, 1], feuchte: [0.46, 0.64] },
];

const LN = 64; // Auflösung der Whittaker-Tabelle
const WTYP = { land: 0, meer: 1, see: 2, fluss: 3, egal: 4 };
const ATTR = ['hoehe', 'hang', 'temp', 'feuchte', 'wasserDist', 'meerDist'];

/**
 * Baut die Biomtabelle. biomOpts: { liste (ersetzt Standard), extra (anhängen), aus: [keys] (deaktiviert), regeln: {key: regel} (überschreibt, null = Regel weg), farben: {key: 0xRRGGBB} }
 * Ids bleiben stabil = Index in der Liste; deaktivierte Biome werden nur nicht mehr vergeben.
 */
const CACHE = new Map();
export function erstelleBiomTabelle(biomOpts = {}) {
  let schluessel = null;
  try { schluessel = JSON.stringify(biomOpts); } catch { /* zyklisch → kein Cache */ }
  if (schluessel && CACHE.has(schluessel)) return CACHE.get(schluessel);
  const tab = baueTabelle(biomOpts);
  if (schluessel) { if (CACHE.size > 16) CACHE.clear(); CACHE.set(schluessel, tab); }
  return tab;
}

function baueTabelle(biomOpts) {
  const basis = biomOpts.liste || STANDARD_BIOME;
  const liste = [...basis, ...(biomOpts.extra || [])].map((bm, id) => {
    const r = biomOpts.regeln?.[bm.key];
    return { ...bm, id, farbe: biomOpts.farben?.[bm.key] ?? bm.farbe, regel: r === null ? undefined : r || bm.regel };
  });
  if (liste.length > 255) throw new Error('worldgen-biomes: höchstens 255 Biome');
  const aus = new Set(biomOpts.aus || []);
  const aktiv = liste.filter(bm => !aus.has(bm.key));
  // Regeln kompilieren (absteigende Priorität)
  const mitRegel = aktiv.filter(bm => bm.regel).sort((a, b) => (b.regel.prio ?? 0) - (a.regel.prio ?? 0));
  const R = mitRegel.length;
  const rId = new Uint8Array(R), rW = new Uint8Array(R), lo = new Float32Array(R * 6), hi = new Float32Array(R * 6);
  mitRegel.forEach((bm, k) => {
    rId[k] = bm.id; rW[k] = WTYP[bm.regel.wasser || 'land'] ?? 0;
    ATTR.forEach((a, j) => { const v = bm.regel[a]; lo[k * 6 + j] = v ? v[0] : -1e9; hi[k * 6 + j] = v ? v[1] : 1e9; });
  });
  // Whittaker-Nachschlagetabelle: pro (Temperatur, Feuchte) das Biom mit kleinstem normierten Abstand
  const wh = aktiv.filter(bm => bm.temp && bm.feuchte);
  const lut = new Uint8Array(LN * LN);
  for (let ti = 0; ti < LN; ti++) for (let mi = 0; mi < LN; mi++) {
    const T = (ti + 0.5) / LN, M = (mi + 0.5) / LN;
    let best = wh.length ? wh[0].id : 0, bd = 1e9;
    for (const bm of wh) {
      const [t0, t1] = bm.temp, [m0, m1] = bm.feuchte;
      const dt = T < t0 ? (t0 - T) * 4 + 1 : T > t1 ? (T - t1) * 4 + 1 : Math.abs(T - (t0 + t1) / 2) / (t1 - t0 + 1e-6);
      const dm = M < m0 ? (m0 - M) * 4 + 1 : M > m1 ? (M - m1) * 4 + 1 : Math.abs(M - (m0 + m1) / 2) / (m1 - m0 + 1e-6);
      const d = dt * dt + dm * dm;
      if (d < bd) { bd = d; best = bm.id; }
    }
    lut[ti * LN + mi] = best;
  }
  const idx = new Map(liste.map(bm => [bm.key, bm.id]));
  const ersatzMeer = idx.get('meer') ?? 0;
  return { liste, lut, R, rId, rW, lo, hi, ersatzMeer, idVon: key => idx.get(key) ?? -1 };
}

/** Biom-Id für einen Punkt (auch für Chunks). flags: FLAG-Bits der Zelle. */
export function klassifiziere(tab, h, hang, temp, feuchte, wasserDist, meerDist, flags) {
  const wt = flags & FLAG.OZEAN ? 1 : flags & FLAG.SEE ? 2 : flags & FLAG.FLUSS ? 3 : 0;
  const { R, rId, rW, lo, hi } = tab;
  for (let k = 0; k < R; k++) {
    const w = rW[k];
    if (w !== 4 && w !== wt) continue;
    const o = k * 6;
    if (h < lo[o] || h > hi[o] || hang < lo[o + 1] || hang > hi[o + 1] || temp < lo[o + 2] || temp > hi[o + 2] ||
        feuchte < lo[o + 3] || feuchte > hi[o + 3] || wasserDist < lo[o + 4] || wasserDist > hi[o + 4] ||
        meerDist < lo[o + 5] || meerDist > hi[o + 5]) continue;
    return rId[k];
  }
  if (wt) return tab.ersatzMeer;
  let ti = (temp * LN) | 0, mi = (feuchte * LN) | 0;
  if (ti < 0) ti = 0; else if (ti >= LN) ti = LN - 1;
  if (mi < 0) mi = 0; else if (mi >= LN) mi = LN - 1;
  return tab.lut[ti * LN + mi];
}

/** Hangneigung (Gradientenbetrag, normiert auf eine 256er-Karte: Höhenunterschied pro 1/256 Kartenbreite). */
export function berechneHang(H, b, t, aus) {
  const S = aus || new Float32Array(b * t), k = Math.max(b, t) / 256 * 0.5;
  for (let y = 0; y < t; y++) {
    const ym = y > 0 ? -b : 0, yp = y < t - 1 ? b : 0;
    for (let x = 0; x < b; x++) {
      const i = y * b + x;
      const gx = H[i + (x < b - 1 ? 1 : 0)] - H[i - (x > 0 ? 1 : 0)];
      const gy = H[i + yp] - H[i + ym];
      S[i] = Math.sqrt(gx * gx + gy * gy) * k;
    }
  }
  return S;
}

/** Pipeline-Stufe Biome: welt.hang, welt.biom (Uint8), welt.biome (Liste), Flag KLIPPE an steilen Küsten. */
export function stufeBiome(welt, opts) {
  const B = opts.biome || {};
  const tab = erstelleBiomTabelle(B);
  const { breite: b, tiefe: t, hoehe: H, flags: FL, temperatur: T, feuchte: M, wasserDistanz: WD, meerDistanz: MD } = welt;
  welt.hang = berechneHang(H, b, t, welt.hang);
  const S = welt.hang, BI = welt.biom;
  const n = createNoise2D(hashSeed(opts.seed ?? 1, 'biomrand'));
  const rauschen = B.randRauschen ?? 0.04, f = 24 / (opts.hoehe?.massstab || Math.max(b, t));
  const klippe = B.klippenHang ?? 0.12;
  for (let y = 0; y < t; y++) for (let x = 0; x < b; x++) {
    const i = y * b + x;
    const r = rauschen > 0 ? n(x * f, y * f) * rauschen : 0;
    BI[i] = klassifiziere(tab, H[i], S[i], T[i] + r, M[i] - r, WD[i], MD[i], FL[i]);
    if (S[i] > klippe && MD[i] < 4 && !(FL[i] & 7)) FL[i] |= FLAG.KLIPPE;
  }
  welt.biome = tab.liste;
  welt.biomTabelle = tab;
}

/** Id eines Biom-Schlüssels in einer Welt (−1 wenn unbekannt). */
export function biomId(welt, key) {
  return welt.biomTabelle ? welt.biomTabelle.idVon(key) : (welt.biome || []).findIndex(bm => bm.key === key);
}
