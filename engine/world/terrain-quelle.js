/**
 * @modul    terrain-quelle
 * @zweck    Datenquelle für gekacheltes Gelände ohne THREE: liest Höhen/Biome/Objekte je Kachel aus einer endlichen Welt (worldgen-adapter) oder dem unendlichen Modus (chunk-adapter) und füllt Vertex-Puffer (Position, Normale, Farbe inkl. Skirts) für eine LOD
 * @api      quelleAusAdapter(adapter, opts) -> {endlich,kachel,bereich,seed,biome,feld(kx,ky,schritt,aus),objekte(kx,ky),teuer(kx,ky,lod),kachelRechteck(kx,ky)} ; fuelleKachel(quelle,kx,ky,lod,ziel,stil) -> {minY,maxY}
 * @beispiel
 *   import { quelleAusAdapter, fuelleKachel } from '../../engine/world/terrain-quelle.js';
 *   const q = quelleAusAdapter(adapter, { kachel: 32 });
 *   const box = fuelleKachel(q, 0, 0, 1, { pos, nor, col }, { farben, fels: [0.5, 0.45, 0.4] });
 * @tags     welt, terrain, gelaende, lod, chunks, vertex
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { hash2 } from '../core/rng.js';

/**
 * adapter: createWeltAdapter (adapter.welt) oder createChunkAdapter (adapter.gen). opts.kachel: Zellen je Kachel
 * (Zweierpotenz ≥ 8; im unendlichen Modus immer adapter.kachel). Kachel (kx,ky) deckt Gitter [kx*K, kx*K+K] ab.
 */
export function quelleAusAdapter(adapter, opts = {}) {
  const hs = adapter.hoehenSkala;
  const p0 = adapter.zuWelt(0, 0), p1 = adapter.zuWelt(1, 1);
  const abb = { ox: p0.x, oz: p0.z, m: p1.x - p0.x };   // Welt = o + gitter × m
  return adapter.welt ? endlich(adapter, opts.kachel ?? 32, hs, abb) : unendlich(adapter, hs, abb);
}

function endlich(adapter, K, hs, abb) {
  const w = adapter.welt, B = w.breite, T = w.tiefe, z = w.zelle || 1;
  const nx = Math.ceil((B - 1) / K), ny = Math.ceil((T - 1) / K);
  abb.m *= z;
  let eimer = null;
  const cl = (v, n) => (v < 0 ? 0 : v > n - 1 ? n - 1 : v);
  return {
    endlich: true, kachel: K, abb, hs, seed: w.seed | 0, biome: w.biome, maxGx: B - 1, maxGy: T - 1,
    bereich: { kx0: 0, ky0: 0, kx1: nx - 1, ky1: ny - 1 },
    /** Höhen in Metern mit 1 Ring Rand ((n+2)² mit n = K/schritt+1) und Biome (n²). */
    feld(kx, ky, schritt, aus) {
      const n = K / schritt + 1, m2 = n + 2, gx0 = kx * K, gy0 = ky * K;
      for (let j = -1; j <= n; j++) for (let i = -1; i <= n; i++) {
        const gx = cl(gx0 + i * schritt, B), gy = cl(gy0 + j * schritt, T), s = gy * B + gx;
        aus.h[(j + 1) * m2 + i + 1] = w.hoehe[s] * hs;
        if (i >= 0 && j >= 0 && i < n && j < n) aus.b[j * n + i] = w.biom[s];
      }
    },
    /** Objekte der Kachel: { o: welt.objekte, idx: Indizes }. */
    objekte(kx, ky) {
      const o = w.objekte;
      if (!o) return null;
      if (!eimer) {
        eimer = new Map();
        for (let i = 0; i < o.anzahl; i++) {
          const k = Math.min(nx - 1, Math.floor(o.x[i] / z / K)) * 65536 + Math.min(ny - 1, Math.floor(o.y[i] / z / K));
          let l = eimer.get(k); if (!l) eimer.set(k, l = []); l.push(i);
        }
      }
      return { o, idx: eimer.get(kx * 65536 + ky) ?? [] };
    },
    teuer: () => false,
    kachelRechteck: (kx, ky) => rechteck(abb, K, kx, ky),
  };
}

function unendlich(adapter, hs, abb) {
  const gen = adapter.gen, K = adapter.kachel, a8 = new Float64Array(8), skala = gen.opts.hoehenSkala ?? 1;
  return {
    endlich: false, kachel: K, abb, hs, seed: gen.opts.seed | 0, biome: gen.biome, bereich: null,
    feld(kx, ky, schritt, aus) {
      const n = K / schritt + 1, m2 = n + 2, gx0 = kx * K, gy0 = ky * K;
      // volle Auflösung oder bereits erzeugter Chunk → Chunk-Daten; sonst punktweise (billig für grobe LOD)
      const c = schritt === 1 || adapter.hatChunk(kx, ky) ? adapter.chunk(kx, ky) : null;
      for (let j = -1; j <= n; j++) for (let i = -1; i <= n; i++) {
        const gx = gx0 + i * schritt, gy = gy0 + j * schritt, innen = i >= 0 && j >= 0 && i < n && j < n;
        let h;
        if (innen && c) { const s = (j * schritt) * c.n + i * schritt; h = c.hoehe[s]; aus.b[j * n + i] = c.biom[s]; }
        else if (innen) { gen.samplePunkt(gx, gy, a8); h = a8[2] * skala; aus.b[j * n + i] = a8[0]; }
        else h = gen.sampleHeight(gx, gy);
        aus.h[(j + 1) * m2 + i + 1] = h * hs;
      }
    },
    objekte(kx, ky) { return { o: adapter.chunk(kx, ky).objekte, idx: null }; },
    teuer: (kx, ky, lod) => lod === 0 && !adapter.hatChunk(kx, ky),
    kachelRechteck: (kx, ky) => rechteck(abb, K, kx, ky),
  };
}

const rechteck = (abb, K, kx, ky) => ({
  x0: abb.ox + kx * K * abb.m, z0: abb.oz + ky * K * abb.m, x1: abb.ox + (kx + 1) * K * abb.m, z1: abb.oz + (ky + 1) * K * abb.m,
});

const felder = new Map();   // Arbeitspuffer je n (nur Zwischenwerte, kein Zustand zwischen Aufrufen)
function puffer(n) {
  let f = felder.get(n);
  if (!f) felder.set(n, f = { h: new Float32Array((n + 2) * (n + 2)), b: new Uint8Array(n * n) });
  return f;
}

/**
 * Füllt ziel.pos/nor/col (Float32Array, Länge vertexAnzahl(seg)×3, seg = K >> lod) für Kachel (kx,ky).
 * stil: farben (RGB-Tabelle je Biom, linear 0…1), fels [r,g,b], rauschen (0.08), felsAb (Hang ab dem Fels beginnt, 0.7),
 *       skirt (Tiefe je Meter Vertex-Abstand, 1.5). Endliche Welten: Kacheln am Kartenrand werden auf den Rand begrenzt.
 * Ergebnis: Höhenbereich {minY, maxY} in Metern (ohne Skirts).
 */
export function fuelleKachel(q, kx, ky, lod, ziel, stil = {}) {
  const K = q.kachel, schritt = 1 << lod, seg = K / schritt, n = seg + 1, m2 = n + 2;
  const f = puffer(n);
  q.feld(kx, ky, schritt, f);
  const { pos, nor, col } = ziel, farben = stil.farben, fels = stil.fels ?? [0.49, 0.45, 0.4];
  const rauschen = stil.rauschen ?? 0.08, felsAb = stil.felsAb ?? 0.7, seed = q.seed;
  const { ox, oz, m } = q.abb, d = schritt * m, gx0 = kx * K, gy0 = ky * K;
  const mx = q.maxGx ?? Infinity, my = q.maxGy ?? Infinity;
  let minY = Infinity, maxY = -Infinity;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = (j + 1) * m2 + i + 1, v = (j * n + i) * 3, h = f.h[k];
    const gx = gx0 + i * schritt, gy = gy0 + j * schritt;
    // endliche Karte: Punkte jenseits des Rands liegen auf dem Rand (entartete Dreiecke statt Überhang)
    pos[v] = ox + Math.min(gx, mx) * m; pos[v + 1] = h; pos[v + 2] = oz + Math.min(gy, my) * m;
    if (h < minY) minY = h; if (h > maxY) maxY = h;
    const ax = (f.h[k + 1] - f.h[k - 1]) / (2 * d), az = (f.h[k + m2] - f.h[k - m2]) / (2 * d);
    const l = Math.sqrt(ax * ax + 1 + az * az);
    nor[v] = -ax / l; nor[v + 1] = 1 / l; nor[v + 2] = -az / l;
    const b = f.b[j * n + i] * 3;
    let r = farben ? farben[b] : 0.4, g = farben ? farben[b + 1] : 0.6, bl = farben ? farben[b + 2] : 0.3;
    // steile Hänge werden Fels, Rauschen je Gitterpunkt (gleich in jeder LOD)
    const hang = Math.min(1, Math.max(0, (Math.sqrt(ax * ax + az * az) - felsAb) * 1.4));
    r += (fels[0] - r) * hang; g += (fels[1] - g) * hang; bl += (fels[2] - bl) * hang;
    const fr = 1 + (hash2(gx, gy, seed) - 0.5) * 2 * rauschen;
    col[v] = r * fr; col[v + 1] = g * fr; col[v + 2] = bl * fr;
  }
  // Skirts: Kantenvertices nach unten versetzt, gleiche Normale/Farbe → verdecken Risse zu Nachbarn anderer LOD
  const tief = Math.max(1, d * (stil.skirt ?? 1.5)), S = n * n;
  const kante = [(q2) => q2, (q2) => seg * n + q2, (q2) => q2 * n, (q2) => q2 * n + seg];
  for (let e = 0; e < 4; e++) for (let q2 = 0; q2 < n; q2++) {
    const src = kante[e](q2) * 3, dst = (S + e * n + q2) * 3;
    for (let c = 0; c < 3; c++) { pos[dst + c] = pos[src + c]; nor[dst + c] = nor[src + c]; col[dst + c] = col[src + c] * 0.85; }
    pos[dst + 1] -= tief;
  }
  return { minY, maxY };
}
