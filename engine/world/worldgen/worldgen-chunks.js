/**
 * @modul    worldgen-chunks
 * @zweck    Unendlicher/gestreamter Modus: Höhe, Klima, Biome, chunk-lokale Flussnetze + kleine Seen (oder Rauschflüsse) und Objekte punktweise und pro Chunk – nahtlos über Chunkgrenzen (ohne globale Erosion/Hydrologie)
 * @api      createChunkGenerator(optionen) -> {opts, sampleHeight(x,y)->number, samplePunkt(x,y,aus)->bool, generateChunk(cx,cy,groesse)->chunk (+wasser, seen), seenIn(x0,y0,x1,y1), biome, dispose()}
 * @beispiel
 *   import { createChunkGenerator } from '../../engine/world/worldgen/worldgen-chunks.js';
 *   const gen = createChunkGenerator({ preset: 'unendlich', seed: 5 });
 *   const c = gen.generateChunk(3, -2, 64);   // c.hoehe hat (64+1)² Werte, Randzeilen identisch mit den Nachbarn
 * @tags     welt, worldgen, chunks, unendlich, streaming, terrain
 * @version  1.1.0
 * @status   entwurf
 * @three    nein
 */
import { createNoise2D, fbm2 } from '../../core/noise.js';
import { hashSeed } from '../../core/rng.js';
import { smoothstep } from '../../core/math.js';
import { aufloesen } from './worldgen-presets.js';
import { createHeightSampler } from './worldgen-height.js';
import { erstelleBiomTabelle, klassifiziere } from './worldgen-biomes.js';
import { verteile, STANDARD_OBJEKTE } from './worldgen-scatter.js';
import { FLAG } from './worldgen-grid.js';
import { createFlussNetz } from './worldgen-chunkfluss.js';

/**
 * optionen wie createWorld (Standard-Preset hier: 'unendlich'). Koordinaten in Zellen (×zelle = Welt).
 * opts.chunk.flussModus: 'netz' (Standard; Flussnetz aus Grobknoten, folgt dem Gefälle, Senken werden Seen)
 * oder 'rauschen' (alte Rauschflüsse, optisch, ohne Seen). Netz-Optionen: chunk.netz = { weite, breite, tiefe,
 * minZufluss, maeander, seen, seeGroesse, … } (siehe worldgen-chunkfluss). chunk.fluesse: false schaltet beides ab.
 */
export function createChunkGenerator(optionen = {}) {
  const opts = aufloesen({ preset: 'unendlich', ...optionen });
  const seed = opts.seed ?? 1;
  const roh = createHeightSampler(opts).sample;
  const mass = opts.hoehe?.massstab || Math.max(opts.breite, opts.tiefe);
  const s = 1 / mass;
  const C = opts.chunk || {}, K = opts.klima || {};
  const nRiv = createNoise2D(hashSeed(seed, 'chunkfluss'));
  const nT = createNoise2D(hashSeed(seed, 'temperatur')), nF = createNoise2D(hashSeed(seed, 'feuchte'));
  const nB = createNoise2D(hashSeed(seed, 'biomrand'));
  const modus = C.flussModus === 'rauschen' ? 'rauschen' : 'netz';
  const netz = C.fluesse !== false && modus === 'netz' ? createFlussNetz({ seed, roh, massstab: mass, ...(C.netz || {}) }) : null;
  const fluesse = C.fluesse !== false && modus === 'rauschen', fw = C.flussBreite ?? 0.014, ft = C.flussTiefe ?? 0.05, ff = C.flussFrequenz ?? 1.6;
  const tBasis = K.temperatur ?? 0.55, kaelte = K.hoehenKaelte ?? 0.55, tR = K.rauschen ?? 0.08, fBasis = K.feuchte ?? 0.5;
  const nahG = K.wasserNaehe ?? 0.2;
  const tab = erstelleBiomTabelle(opts.biome || {});
  const rauschen = opts.biome?.randRauschen ?? 0.04, fRand = 24 * s;
  const skala = opts.hoehenSkala ?? 1;
  const hangK = (mass / 256) * 0.5;
  const O = opts.objekte || {};
  const aus = new Set(O.aus || []);
  const arten = O.aktiv === false ? [] : [...(O.arten || STANDARD_OBJEKTE), ...(O.extra || [])].filter(a => !aus.has(a.key));
  let flussWert = 0; // letzter Flusskanal-Wert (0 = Mitte, 1 = außerhalb), vermeidet Objekt-Rückgaben
  let seeWert = NaN; // letzter Seespiegel (normiert) oder NaN
  const flussSchwelle = netz ? 0.85 : 0.6;

  /** Normierte Höhe inkl. Fluss-/Seeeinschnitt (Meeresspiegel 0). */
  function hoeheN(x, y) {
    let h = roh(x, y);
    flussWert = 1; seeWert = NaN;
    if (netz) {
      h = netz.praege(x, y, h);
      flussWert = netz.fluss < 1e9 ? netz.fluss : 9; seeWert = netz.see;
      return h;
    }
    if (fluesse && h > -0.02) {
      const px = x * s * ff, py = y * s * ff;
      const r = Math.abs(fbm2(nRiv, px + 0.35 * fbm2(nRiv, px * 3 + 7, py * 3, 2), py, 3));
      const w = fw * (1 - smoothstep(0.25, 0.7, h));
      if (w > 0 && r < w * 2.5) {
        const q = r / w;
        flussWert = q;
        if (q < 1) h = Math.min(h, h * 0.25 + 0.015 - ft * (1 - q * q) * 0.4);
        else h -= ft * 0.25 * (1 - (q - 1) / 1.5) * smoothstep(0, 0.05, h);
      }
    }
    return h;
  }

  /** Klima + Biom für eine Ecke aus Höhe, Hang und Flusswert → aus = [biom, hang, hoehe, wasserDist, flags, 0, temperatur, feuchte]. */
  function auswerten(x, y, h, hang, fw0, see, a) {
    let fl = 0;
    if (h < 0) fl |= FLAG.OZEAN; else if (h < see) fl |= FLAG.SEE; else if (fw0 < flussSchwelle) fl |= FLAG.FLUSS;
    const meerD = h <= 0 ? 0 : h / 0.008; // Näherung: Meerabstand aus der Höhe
    const wd = fl & FLAG.SEE ? 0 : Math.min(meerD, fw0 < 1 ? 0 : (fw0 - 1) * 2 + 1);
    let tt = tBasis - kaelte * (h > 0 ? h : 0) + tR * fbm2(nT, x * s * 3 + 11, y * s * 3 - 7, 2);
    let m = fBasis + 0.22 * fbm2(nF, x * s * 4 - 23, y * s * 4 + 5, 3) + nahG * (1 - Math.min(1, wd / 10)) - nahG * 0.3;
    tt = tt < 0 ? 0 : tt > 1 ? 1 : tt; m = m < 0 ? 0 : m > 1 ? 1 : m;
    const r = rauschen > 0 ? nB(x * fRand, y * fRand) * rauschen : 0;
    a[0] = klassifiziere(tab, h, hang, tt + r, m - r, wd, meerD, fl);
    a[1] = hang; a[2] = h; a[3] = wd; a[4] = fl; a[5] = 0; a[6] = tt; a[7] = m;
  }

  /**
   * Punktinfo an der nächsten Gitterecke (gerundet) → reine Funktion der Ecke, daher nahtlos.
   * aus = [biom, hang, hoehe, wasserDist, flags, 0, temperatur, feuchte] (Länge ≥ 8).
   * Ab 1.1: aus[8] = Wasserspiegel (normiert; Meer 0, See = Spiegel, sonst Höhe), falls aus lang genug ist.
   */
  function samplePunkt(x, y, a) {
    x = Math.round(x); y = Math.round(y);
    const h = hoeheN(x, y), fw0 = flussWert, see = seeWert;
    const gx = hoeheN(x + 1, y) - hoeheN(x - 1, y), gy = hoeheN(x, y + 1) - hoeheN(x, y - 1);
    auswerten(x, y, h, Math.sqrt(gx * gx + gy * gy) * hangK, fw0, see, a);
    if (a.length > 8) a[8] = wasserSpiegel(h, a[4], see);
    return true;
  }

  /**
   * Chunk (cx,cy) mit groesse Zellen Kantenlänge: Gitter aus (groesse+1)² Eckpunkten, Ursprung (cx*groesse, cy*groesse).
   * Ergebnis: { cx, cy, groesse, n, x0, y0, hoehe, biom, flags, temperatur, feuchte, objekte,
   *   wasser (Float32Array, Wasserspiegel × hoehenSkala; trocken = hoehe), seen [{x,y,radius,spiegel,zufluss}] }
   */
  function generateChunk(cx, cy, groesse = 64) {
    const n = groesse + 1, x0 = cx * groesse, y0 = cy * groesse, nn = n * n;
    const hoehe = new Float32Array(nn), biom = new Uint8Array(nn), flags = new Uint8Array(nn);
    const temperatur = new Float32Array(nn), feuchte = new Float32Array(nn), wasser = new Float32Array(nn);
    // exakte Werte (Float64) für die Objektverteilung – gleich wie samplePunkt
    const eH = new Float64Array(nn), eS = new Float64Array(nn), eW = new Float64Array(nn);
    // Höhen mit 1 Zelle Rand → Hang ohne Zusatzabtastung, identisch an gemeinsamen Kanten
    const m = n + 2, R = new Float64Array(m * m), RF = new Float64Array(m * m), RS = new Float64Array(m * m);
    for (let y = 0; y < m; y++) for (let x = 0; x < m; x++) {
      const k = y * m + x;
      R[k] = hoeheN(x0 + x - 1, y0 + y - 1); RF[k] = flussWert; RS[k] = seeWert;
    }
    const a = new Float64Array(8);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const k = (y + 1) * m + x + 1, i = y * n + x;
      const gx = R[k + 1] - R[k - 1], gy = R[k + m] - R[k - m];
      auswerten(x0 + x, y0 + y, R[k], Math.sqrt(gx * gx + gy * gy) * hangK, RF[k], RS[k], a);
      wasser[i] = wasserSpiegel(a[2], a[4], RS[k]) * skala;
      biom[i] = a[0]; eS[i] = a[1]; eH[i] = a[2]; eW[i] = a[3]; flags[i] = a[4];
      hoehe[i] = a[2] * skala; temperatur[i] = a[6]; feuchte[i] = a[7];
    }
    // Quelle für die Verteilung: innerhalb des Chunks aus den Arrays, außerhalb punktweise (gleiche Werte)
    const quelle = {
      punkt(x, y, aus) {
        const ix = Math.round(x) - x0, iy = Math.round(y) - y0;
        if (ix < 0 || iy < 0 || ix >= n || iy >= n) return samplePunkt(x, y, aus);
        const i = iy * n + ix;
        aus[0] = biom[i]; aus[1] = eS[i]; aus[2] = eH[i]; aus[3] = eW[i]; aus[4] = flags[i]; aus[5] = 0;
        return true;
      },
    };
    const objekte = verteile(quelle, arten,
      { seed, dichte: O.dichte ?? 1, massstab: mass, biome: tab.liste, zelle: opts.zelle ?? 1 },
      { x0, y0, x1: x0 + groesse, y1: y0 + groesse });
    const seen = netz ? netz.seenIn(x0, y0, x0 + groesse, y0 + groesse) : [];
    return { cx, cy, groesse, n, x0, y0, hoehe, biom, flags, temperatur, feuchte, objekte, wasser, seen };
  }

  /** Wasserspiegel (normiert) aus Höhe, Flags und Seespiegel. */
  function wasserSpiegel(h, fl, see) {
    if (fl & FLAG.OZEAN) return 0;
    if (fl & FLAG.SEE) return see;
    if (fl & FLAG.FLUSS) return h + 0.002;
    return h;
  }

  return {
    opts, biome: tab.liste,
    sampleHeight: (x, y) => hoeheN(x, y) * skala,
    samplePunkt,
    generateChunk,
    /** Seen mit Mittelpunkt im Rechteck (Zellen); leer im Rauschmodus. */
    seenIn: (x0, y0, x1, y1) => (netz ? netz.seenIn(x0, y0, x1, y1) : []),
    dispose() { if (netz) netz.dispose(); },
  };
}
