/**
 * @modul    chunk-adapter
 * @zweck    Welt-Adapter für den unendlichen Modus: macht einen Chunk-Generator (worldgen-chunks) in Metern abfragbar – gleiche Schnittstelle wie worldgen-adapter (bodenHoehe, wasserHoehe, hindernisse, normale, biomBei, startPunkt) plus Chunk-Cache für Gelände und Objekte
 * @api      createChunkAdapter(gen, opts) -> {gen,unendlich,kachel,chunk(cx,cy),hatChunk(cx,cy),bodenHoehe,wasserHoehe,hindernisse,normale,biomBei,zuGitter,zuWelt,startPunkt,groesse,hoehenSkala,meterProZelle,dispose}
 * @beispiel
 *   import { createChunkGenerator } from '../../engine/world/worldgen/worldgen-chunks.js';
 *   import { createChunkAdapter } from '../../engine/world/chunk-adapter.js';
 *   const adapter = createChunkAdapter(createChunkGenerator({ preset: 'unendlich', seed: 5 }), { hoehenSkala: 60, meterProZelle: 2 });
 *   adapter.bodenHoehe(10, -40);   // Meter
 * @tags     welt, chunks, unendlich, adapter, figur, streaming
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { HINDERNIS_RADIEN } from './worldgen/worldgen-adapter.js';

/**
 * gen: createChunkGenerator(…). Welt-x → Gitter-x, Welt-z → Gitter-y, Ursprung bei Gitter (0,0). Höhen des Generators
 * (normiert × gen.opts.hoehenSkala) werden mit opts.hoehenSkala in Meter umgerechnet.
 * opts: hoehenSkala (40), meterProZelle (1), kachel (Zellen je Chunk, 32), cache (Chunks im Speicher, 96), radien.
 */
export function createChunkAdapter(gen, opts = {}) {
  const hs = opts.hoehenSkala ?? 40, m = opts.meterProZelle ?? 1, K = opts.kachel ?? 32, max = opts.cache ?? 96;
  const radien = { typ: { ...HINDERNIS_RADIEN.typ, ...opts.radien?.typ }, art: { ...HINDERNIS_RADIEN.art, ...opts.radien?.art } };
  const cache = new Map(), hind = new Map();
  const schl = (cx, cy) => (cx + 32768) * 65536 + (cy + 32768);
  const a8 = new Float64Array(8);

  /** Chunk (cx,cy) mit K Zellen, zuletzt benutzte bleiben im Cache. */
  function chunk(cx, cy) {
    const k = schl(cx, cy);
    let c = cache.get(k);
    if (c) { cache.delete(k); cache.set(k, c); return c; }
    c = gen.generateChunk(cx, cy, K);
    cache.set(k, c);
    if (cache.size > max) { const alt = cache.keys().next().value; cache.delete(alt); hind.delete(alt); }
    return c;
  }
  const hatChunk = (cx, cy) => cache.has(schl(cx, cy));

  /** Höhe an Gitterecke (ganzzahlig) in Generator-Einheiten – aus dem Cache, sonst punktweise. */
  function ecke(gx, gy) {
    const cx = Math.floor(gx / K), cy = Math.floor(gy / K), c = cache.get(schl(cx, cy));
    if (c) return c.hoehe[(gy - cy * K) * c.n + (gx - cx * K)];
    return gen.sampleHeight(gx, gy);
  }

  const zuGitter = (x, z) => ({ gx: x / m, gy: z / m });
  const zuWelt = (gx, gy) => ({ x: gx * m, z: gy * m });

  /** Bodenhöhe in Metern, bilinear zwischen den Gitterecken (wie heightAt der endlichen Welt). */
  function bodenHoehe(x, z) {
    const gx = x / m, gy = z / m, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
    const a = ecke(x0, y0), b = ecke(x0 + 1, y0), c = ecke(x0, y0 + 1), d = ecke(x0 + 1, y0 + 1);
    return ((a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy) * hs;
  }

  /** Wasseroberfläche: nur das Meer (Höhe 0) unter Meeresspiegel, sonst null. */
  const wasserHoehe = (x, z) => (bodenHoehe(x, z) < 0 ? 0 : null);

  function normale(x, z) {
    const e = m;
    const ax = (bodenHoehe(x + e, z) - bodenHoehe(x - e, z)) / (2 * e), az = (bodenHoehe(x, z + e) - bodenHoehe(x, z - e)) / (2 * e);
    const l = Math.hypot(ax, 1, az);
    return { x: -ax / l, y: 1 / l, z: -az / l };
  }

  function biomBei(x, z) {
    gen.samplePunkt(x / m, z / m, a8);
    return gen.biome[a8[0]];
  }

  /** Hindernisse eines Chunks (Meter): flache Liste [x, z, r, …], nur aus bereits erzeugten Chunks. */
  function hindernisListe(k) {
    let l = hind.get(k);
    if (l) return l;
    const c = cache.get(k);
    if (!c) return null;
    const o = c.objekte;
    l = [];
    for (let i = 0; i < o.anzahl; i++) {
      const r0 = radien.typ[o.typen[o.typ[i]]] ?? radien.art[o.arten[o.art[i]]] ?? 0;
      if (r0 > 0) l.push(o.x[i] * m, o.y[i] * m, r0 * (o.skala[i] || 1) * m);
    }
    hind.set(k, l);
    return l;
  }

  const schub = { x: 0, z: 0 };
  /** Ausschiebe-Vektor für einen Kreis (x,z,radius) oder null. */
  function hindernisse(x, z, radius = 0.3) {
    if (opts.hindernisse === false) return null;
    const reich = radius + 3, km = K * m;
    let sx = 0, sz = 0, treffer = false;
    for (let cy = Math.floor((z - reich) / km); cy <= Math.floor((z + reich) / km); cy++)
      for (let cx = Math.floor((x - reich) / km); cx <= Math.floor((x + reich) / km); cx++) {
        const l = hindernisListe(schl(cx, cy));
        if (!l) continue;
        for (let i = 0; i < l.length; i += 3) {
          const dx = x - l[i], dz = z - l[i + 1], min = radius + l[i + 2], d2 = dx * dx + dz * dz;
          if (d2 >= min * min) continue;
          const d = Math.sqrt(d2) || 1e-4, tief = min - d;
          sx += (d2 ? dx / d : 1) * tief; sz += (d2 ? dz / d : 0) * tief; treffer = true;
        }
      }
    if (!treffer) return null;
    schub.x = sx; schub.z = sz;
    return schub;
  }

  /** Erster Landpunkt (Höhe > 2 % der Skala) auf einer Spirale um den Ursprung, in Metern. */
  function startPunkt() {
    const schritt = 8, grenze = (gen.opts.hoehenSkala ?? 1) * 0.02;
    for (let r = 0; r < 400; r++) {
      const w = r * 0.7, d = r * schritt;
      const gx = Math.round(Math.cos(w) * d), gy = Math.round(Math.sin(w) * d);
      if (gen.sampleHeight(gx, gy) > grenze) { const p = zuWelt(gx, gy); return { x: p.x, y: bodenHoehe(p.x, p.z), z: p.z }; }
    }
    return { x: 0, y: bodenHoehe(0, 0), z: 0 };
  }

  return {
    gen, welt: null, unendlich: true, kachel: K, chunk, hatChunk,
    bodenHoehe, wasserHoehe, hindernisse, normale, biomBei, zuGitter, zuWelt, startPunkt,
    groesse: { x: Infinity, z: Infinity }, hoehenSkala: hs, meterProZelle: m,
    dispose() { cache.clear(); hind.clear(); },
  };
}
