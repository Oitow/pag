/**
 * @modul    worldgen-chunkfluss
 * @zweck    Chunk-lokale Flussnetze und kleine Seen für den unendlichen Modus: grobes Knotengitter aus Seed + Position, Abfluss zum tiefsten Nachbarn, begrenzter Zufluss, Senken werden Seen – nahtlos ohne globale Stufen
 * @api      createFlussNetz(opts) -> {praege(x,y,h)->h, fluss, see, knoten(i,j)->knoten, seenIn(x0,y0,x1,y1)->[{x,y,radius,spiegel,zufluss}], weite, dispose()}
 * @beispiel
 *   import { createFlussNetz } from '../../engine/world/worldgen/worldgen-chunkfluss.js';
 *   const netz = createFlussNetz({ seed: 5, roh: (x, y) => hs.sample(x, y), massstab: 256 });
 *   const h = netz.praege(x, y, hs.sample(x, y));   // netz.fluss < 1 → im Flussbett, netz.see = Seespiegel oder NaN
 * @tags     welt, worldgen, chunks, unendlich, fluss, see, hydrologie
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { createNoise2D, fbm2 } from '../../core/noise.js';
import { hashSeed, hash2 } from '../../core/rng.js';
import { smoothstep } from '../../core/math.js';

// Nachbarn im Knotengitter (8er-Nachbarschaft)
const NX = [1, 1, 0, -1, -1, -1, 0, 1], NY = [0, 1, 1, 1, 0, -1, -1, -1];

/**
 * opts: { seed, roh(x,y)->h (normierte Rohhöhe, Meer < 0), massstab (Zellen),
 *   weite 0.06 (Knotenabstand × massstab), breite 0.005 (Flussbreite × massstab bei Zufluss 1), tiefe 0.02,
 *   minZufluss 1.6, tiefeZufluss 8 (Ringe Zuflussrechnung), pass 0.03 (erlaubter Anstieg zwischen Knoten),
 *   ueberlauf 0.03 (Senken flacher als das laufen über), minSeeZufluss 3,
 *   maeander 0.2 (× weite), seen true, seeGroesse 0.32 (× weite), seeTiefe 0.03 }
 * Alles hängt nur von Seed und Position ab; der Zwischenspeicher ändert keine Werte.
 */
export function createFlussNetz(opts = {}) {
  const seed = opts.seed ?? 1, roh = opts.roh, mass = opts.massstab ?? 256;
  const Z = Math.max(4, (opts.weite ?? 0.06) * mass);
  const B = (opts.breite ?? 0.005) * mass, T = opts.tiefe ?? 0.02;
  const minZ = opts.minZufluss ?? 1.6, D = opts.tiefeZufluss ?? 8, pass = opts.pass ?? 0.03;
  const spill = opts.ueberlauf ?? 0.03, minSee = opts.minSeeZufluss ?? 3;
  const mae = (opts.maeander ?? 0.2) * Z;
  const seenAn = opts.seen !== false, seeR = (opts.seeGroesse ?? 0.32) * Z, seeT = opts.seeTiefe ?? 0.03;
  const sK = hashSeed(seed, 'flussnetz') | 0;
  const nW = createNoise2D(hashSeed(seed, 'flussmaeander')), nU = createNoise2D(hashSeed(seed, 'seeufer'));
  const wf = 0.9 / Z;
  let cache = new Map();

  /** Knoten der Grobzelle (i,j): Lage (gejittert), Rohhöhe, Abfluss, Zufluss, Breite. */
  function knoten(i, j) {
    const key = i * 4194304 + j;
    let k = cache.get(key);
    if (k) return k;
    if (cache.size > 60000) cache = new Map();
    const x = (i + 0.15 + 0.7 * hash2(i, j, sK)) * Z, y = (j + 0.15 + 0.7 * hash2(i, j, sK ^ 0x5bd1e995)) * Z;
    k = { i, j, x, y, h: roh(x, y), regen: 0.6 + 0.8 * hash2(i, j, sK ^ 0x27d4eb2f), ba: undefined, ab: undefined, zu: -1, b: 0, see: 0 };
    cache.set(key, k);
    return k;
  }

  /** Abfluss bergab: steilster tieferer Nachbar ohne hohen Pass dazwischen; null = Meer oder Senke. */
  function bergab(k) {
    if (k.ba !== undefined) return k.ba;
    let best = null, bg = 0;
    if (k.h >= 0) for (let r = 0; r < 8; r++) {
      const m = knoten(k.i + NX[r], k.j + NY[r]);
      if (m.h >= k.h) continue;
      const g = (k.h - m.h) / (r & 1 ? 1.41421356 : 1);
      if (g <= bg) continue;
      if (roh((k.x + m.x) * 0.5, (k.y + m.y) * 0.5) > k.h + pass) continue; // Bergrücken dazwischen
      best = m; bg = g;
    }
    k.ba = best;
    return best;
  }

  /** Abfluss mit Überlauf: flache Senken laufen zum niedrigsten Nachbarn über, der selbst bergab abfließt. */
  function abfluss(k) {
    if (k.ab !== undefined) return k.ab;
    let best = bergab(k);
    if (!best && k.h >= 0) {
      let bh = k.h + spill;
      for (let r = 0; r < 8; r++) {
        const m = knoten(k.i + NX[r], k.j + NY[r]);
        if (m.h >= bh || !bergab(m) || bergab(m) === k) continue;
        best = m; bh = m.h;
      }
    }
    k.ab = best;
    return best;
  }

  /** Begrenzter Zufluss: eigener Regen + Zuflüsse der Nachbarn bis D Ringe stromauf. */
  function zuflussTief(k, d) {
    let s = k.regen;
    if (d > 0) for (let r = 0; r < 8; r++) {
      const m = knoten(k.i + NX[r], k.j + NY[r]);
      if (abfluss(m) === k) s += zuflussTief(m, d - 1);
    }
    return s;
  }
  function zufluss(k) {
    if (k.zu < 0) {
      k.zu = zuflussTief(k, D);
      const ab = abfluss(k);
      k.b = k.zu >= minZ && k.h >= 0 ? B * Math.min(3, Math.sqrt(k.zu)) * (1 - 0.5 * smoothstep(0.3, 0.8, k.h)) : 0;
      k.see = seenAn && !ab && k.h >= 0 && k.zu >= minSee ? seeR * Math.min(1, 0.45 + 0.12 * k.zu) : 0;
    }
    return k.zu;
  }

  const netz = { fluss: Infinity, see: NaN, weite: Z, knoten };

  /** Prägt Flussbetten, Täler und Seen in die Höhe h am Punkt (x,y); setzt netz.fluss (0 = Mitte, ≥1 außerhalb) und netz.see. */
  netz.praege = function (x, y, h) {
    netz.fluss = Infinity; netz.see = NaN;
    if (!(h > -0.02)) return h;
    const px = x + mae * fbm2(nW, x * wf, y * wf, 2), py = y + mae * fbm2(nW, x * wf + 31.7, y * wf - 12.3, 2);
    const ci = Math.floor(px / Z), cj = Math.floor(py / Z);
    let out = h, q0 = Infinity, spiegel = NaN;
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
      const k = knoten(ci + di, cj + dj);
      zufluss(k);
      if (k.see > 0) {
        const r = k.see, dx = px - k.x, dy = py - k.y;
        const d = Math.sqrt(dx * dx + dy * dy) * (1 + 0.28 * nU(px * wf * 2, py * wf * 2));
        if (d < 1.8 * r) {
          const L = k.h + 0.006;
          let c = d < r ? L - 0.004 - seeT * (1 - (d / r) * (d / r)) : L + 0.004 + (h - L - 0.004) * smoothstep(r, 1.8 * r, d);
          if (c < 0.001 && h > 0) c = h < 0.001 ? h : 0.001; // Seeboden bleibt über dem Meer
          if (c < out) out = c;
          if (d < r || (d < 1.2 * r && out < L)) spiegel = Number.isNaN(spiegel) ? L : Math.max(spiegel, L);
        }
      }
      if (k.b <= 0) continue;
      const m = abfluss(k);
      if (!m) continue;
      zufluss(m);
      // Abstand zum Segment k → m
      const ex = m.x - k.x, ey = m.y - k.y, l2 = ex * ex + ey * ey;
      let t = ((px - k.x) * ex + (py - k.y) * ey) / l2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = px - k.x - ex * t, qy = py - k.y - ey * t;
      const w = k.b + (Math.max(k.b, m.b) - k.b) * t, dd = Math.sqrt(qx * qx + qy * qy);
      if (dd >= 3 * w) continue;
      const q = dd / w, L = k.h + (m.h - k.h) * t, base = h < L ? h : L;
      let c = q < 1 ? base - T * Math.min(1.5, w / B * 0.5) * (1 - q * q) : base + (h - base) * smoothstep(1, 3, q);
      if (m.h >= 0 && c < 0.002 && h > 0) c = h < 0.002 ? h : 0.002; // Binnenflüsse nie unter Meeresspiegel
      if (c < out) out = c;
      if (q < q0) q0 = q;
    }
    netz.fluss = q0; netz.see = spiegel;
    return out;
  };

  /** Seen, deren Mittelpunkt im Rechteck [x0,x1)×[y0,y1) liegt (Weltzellen, Spiegel normiert). */
  netz.seenIn = function (x0, y0, x1, y1) {
    const liste = [];
    if (!seenAn) return liste;
    for (let j = Math.floor(y0 / Z); j <= Math.floor(y1 / Z); j++) for (let i = Math.floor(x0 / Z); i <= Math.floor(x1 / Z); i++) {
      const k = knoten(i, j);
      zufluss(k);
      if (k.see > 0 && k.x >= x0 && k.x < x1 && k.y >= y0 && k.y < y1) liste.push({ x: k.x, y: k.y, radius: k.see, spiegel: k.h + 0.006, zufluss: k.zu });
    }
    return liste;
  };

  netz.dispose = () => { cache = new Map(); };
  return netz;
}
