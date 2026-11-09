/**
 * @modul    worldgen-adapter
 * @zweck    Welt-Adapter für Figuren, Kamera und Spiele: macht aus einer erzeugten Welt (normierte Höhe, Gitter) eine Welt in Metern mit bodenHoehe, wasserHoehe und hindernisse (Baumstämme, Felsen) – passt zum Vertrag in docs/FIGUREN-SYSTEM.md
 * @api      createWeltAdapter(welt, opts) -> {bodenHoehe,wasserHoehe,hindernisse,normale,biomBei,zuGitter,zuWelt,startPunkt,groesse,hoehenSkala,meterProZelle,dispose} ; HINDERNIS_RADIEN
 * @beispiel
 *   import { createWeltAdapter } from '../../engine/world/worldgen/worldgen-adapter.js';
 *   const adapter = createWeltAdapter(createWorld({ preset: 'insel', seed: 42 }), { hoehenSkala: 60, meterProZelle: 2 });
 *   const s = adapter.startPunkt(); const y = adapter.bodenHoehe(s.x, s.z);
 * @tags     welt, worldgen, adapter, boden, wasser, kollision, figur
 * @version  1.1.0
 * @status   entwurf
 * @three    nein
 */

import { heightAt, normalAt } from './worldgen-query.js';
import { FLAG } from './worldgen-grid.js';

/** Stamm-/Kollisionsradius in Gitterzellen bei skala 1, je Objekttyp (sonst je Art). 0 = begehbar. */
export const HINDERNIS_RADIEN = {
  typ: { eiche: 0.28, buche: 0.26, birke: 0.16, kiefer: 0.22, tanne: 0.24, weide: 0.3, toterBaum: 0.2, fels: 0.55, felsbrocken: 0.9,
    fichte: 0.24, ahorn: 0.26, palme: 0.16, findling: 0.85, felsnadel: 0.5, felsplatte: 0, geroell: 0, baumstumpf: 0.22, agave: 0 },
  art: { baum: 0.22, fels: 0.6, kaktus: 0.2, busch: 0, schilf: 0, blume: 0, totholz: 0, unterholz: 0, geroell: 0, seerose: 0, bodendecker: 0 },
};

const WASSER = FLAG.OZEAN | FLAG.SEE | FLAG.FLUSS;

/**
 * Welt-Koordinaten: x → Gitter-x, z → Gitter-y. Ursprung der Welt liegt in der Kartenmitte (zentriert=true),
 * damit die Figur bei (0,0) nahe der Mitte startet und Gleitkomma-Fehler klein bleiben.
 */
export function createWeltAdapter(welt, opts = {}) {
  const hoehenSkala = opts.hoehenSkala ?? 40;           // Meter je Höheneinheit (Höhe ~ -1…1)
  const m = opts.meterProZelle ?? 1;                     // Meter je Gitterzelle
  const zentriert = opts.zentriert ?? true;
  const radien = { typ: { ...HINDERNIS_RADIEN.typ, ...opts.radien?.typ }, art: { ...HINDERNIS_RADIEN.art, ...opts.radien?.art } };
  const W = welt.breite * welt.zelle, T = welt.tiefe * welt.zelle;  // Kartengröße in Welteinheiten des Generators
  const ox = zentriert ? W / 2 : 0, oz = zentriert ? T / 2 : 0;
  const n3 = [0, 0, 0];

  const zuGitter = (x, z) => ({ gx: x / m + ox, gy: z / m + oz });
  const zuWelt = (gx, gy) => ({ x: (gx - ox) * m, z: (gy - oz) * m });
  const imFeld = (gx, gy) => gx >= 0 && gy >= 0 && gx < W && gy < T;

  function bodenHoehe(x, z) {
    return heightAt(welt, x / m + ox, z / m + oz) * hoehenSkala;
  }

  /** Wasseroberfläche in Metern oder null. Außerhalb der Karte: Meer auf 0. */
  function wasserHoehe(x, z) {
    const gx = x / m + ox, gy = z / m + oz;
    if (!imFeld(gx, gy)) return 0;
    const i = Math.floor(gy / welt.zelle) * welt.breite + Math.floor(gx / welt.zelle);
    if (!(welt.flags[i] & WASSER)) return null;
    return (welt.flags[i] & FLAG.OZEAN ? 0 : welt.wasserstand[i]) * hoehenSkala;
  }

  function normale(x, z) {
    // Normale im Gitter → in Meter umrechnen (Höhe und Fläche unterschiedlich skaliert)
    const [nx, ny, nz] = normalAt(welt, x / m + ox, z / m + oz, n3);
    const ax = nx * hoehenSkala / m, az = nz * hoehenSkala / m, l = Math.hypot(ax, ny, az) || 1;
    return { x: ax / l, y: ny / l, z: az / l };
  }

  function biomBei(x, z) {
    const { gx, gy } = zuGitter(x, z);
    if (!imFeld(gx, gy)) return welt.biome[0];
    return welt.biome[welt.biom[Math.floor(gy / welt.zelle) * welt.breite + Math.floor(gx / welt.zelle)]];
  }

  // Hindernisse in ein Raster-Hash (Zellgröße in Metern) – schnell für viele Abfragen pro Frame
  const fach = opts.fachGroesse ?? 4;
  const faecher = new Map();
  const hx = [], hz = [], hr = [];
  const o = welt.objekte;
  if (o && opts.hindernisse !== false) {
    for (let i = 0; i < o.anzahl; i++) {
      const typ = o.typen[o.typ[i]], art = o.arten[o.art[i]];
      const r0 = radien.typ[typ] ?? radien.art[art] ?? 0;
      if (r0 <= 0) continue;
      const p = zuWelt(o.x[i], o.y[i]);
      const k = hx.length;
      hx.push(p.x); hz.push(p.z); hr.push(r0 * (o.skala[i] || 1) * m);
      const key = schluessel(Math.floor(p.x / fach), Math.floor(p.z / fach));
      let l = faecher.get(key); if (!l) faecher.set(key, l = []); l.push(k);
    }
  }
  function schluessel(a, b) { return (a + 32768) * 65536 + (b + 32768); }

  const schub = { x: 0, z: 0 };
  /** Ausschiebe-Vektor für einen Kreis (x,z,radius) oder null, wenn nichts berührt wird. */
  function hindernisse(x, z, radius = 0.3) {
    let sx = 0, sz = 0, treffer = false;
    const reich = radius + 2;
    const a0 = Math.floor((x - reich) / fach), a1 = Math.floor((x + reich) / fach);
    const b0 = Math.floor((z - reich) / fach), b1 = Math.floor((z + reich) / fach);
    for (let a = a0; a <= a1; a++) for (let b = b0; b <= b1; b++) {
      const l = faecher.get(schluessel(a, b));
      if (!l) continue;
      for (const k of l) {
        const dx = x - hx[k], dz = z - hz[k], min = radius + hr[k];
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || 1e-4, tief = min - d;
        sx += (d2 ? dx / d : 1) * tief; sz += (d2 ? dz / d : 0) * tief; treffer = true;
      }
    }
    if (!treffer) return null;
    schub.x = sx; schub.z = sz;
    return schub;
  }

  /** Startplatz aus welt.orte.start (sonst Kartenmitte) in Metern, mit Bodenhöhe. */
  function startPunkt() {
    const s = welt.orte?.start;
    const p = s ? zuWelt(s.x, s.y) : { x: 0, z: 0 };
    return { x: p.x, y: bodenHoehe(p.x, p.z), z: p.z };
  }

  return {
    welt, bodenHoehe, wasserHoehe, hindernisse, normale, biomBei, zuGitter, zuWelt, startPunkt,
    groesse: { x: W * m, z: T * m }, hoehenSkala, meterProZelle: m, anzahlHindernisse: hx.length,
    dispose() { faecher.clear(); hx.length = hz.length = hr.length = 0; },
  };
}
