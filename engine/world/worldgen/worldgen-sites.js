/**
 * @modul    worldgen-sites
 * @zweck    Orte finden: Startplatz (flach, nah an Wasser und Wald, eingeebnet), Dorfplätze mit Mindestabstand und Sehenswürdigkeiten (Gipfel, Quellen, Mündungen, Seen)
 * @api      bewerteOrt(welt, x, y, gewichte) -> number ; ebneEin(welt, x, y, radius) -> void ; stufeOrte(welt, opts) -> void
 * @beispiel
 *   import { stufeOrte } from '../../engine/world/worldgen/worldgen-sites.js';
 *   stufeOrte(welt, { orte: { start: true, doerfer: 3 } });
 *   const { start, doerfer, poi } = welt.orte;   // Weltkoordinaten
 * @tags     welt, worldgen, orte, start, dorf, poi
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { hash2, hashSeed } from '../../core/rng.js';
import { smoothstep } from '../../core/math.js';
import { FLAG, WASSER } from './worldgen-grid.js';
import { berechneHang } from './worldgen-biomes.js';

const WALD = ['laubwald', 'nadelwald', 'birkenwald', 'regenwald', 'hartlaubwald'];
const KREIS = 12;

/**
 * Bewertet eine Zelle als Siedlungsplatz (höher = besser, −Infinity = ungeeignet).
 * gewichte: { flach, wasser, wald, wiese, mitte, hoeheMax, wasserIdeal:[a,b], radius, waldIds:Set, wieseIds:Set }
 */
export function bewerteOrt(welt, x, y, g) {
  const { breite: b, tiefe: t, hoehe: H, hang: S, flags: FL, wasserDistanz: WD, biom: BI } = welt;
  const i = y * b + x;
  if (FL[i] & (WASSER | FLAG.ORT) || H[i] <= 0.004 || H[i] > (g.hoeheMax ?? 0.4)) return -Infinity;
  const R = g.radius;
  let hangSumme = S[i], wald = 0, wiese = 0, nass = 0, n = 1;
  for (let k = 0; k < KREIS; k++) {
    const a = (k / KREIS) * Math.PI * 2;
    for (let ring = 1; ring <= 2; ring++) {
      const xx = Math.round(x + Math.cos(a) * R * ring * 0.5), yy = Math.round(y + Math.sin(a) * R * ring * 0.5);
      if (xx < 0 || yy < 0 || xx >= b || yy >= t) return -Infinity;
      const j = yy * b + xx;
      n++;
      if (ring === 1) { hangSumme += S[j]; if (FL[j] & WASSER) nass++; }
      if (g.waldIds.has(BI[j])) wald++;
      if (g.wieseIds.has(BI[j])) wiese++;
    }
  }
  const hangM = hangSumme / (KREIS + 1);
  const [w0, w1] = g.wasserIdeal;
  const wd = WD[i];
  const wasser = wd < w0 ? wd / w0 - 0.3 : wd <= w1 ? 1 : Math.max(-0.5, 1 - (wd - w1) / (w1 * 1.5));
  const mx = x / (b - 1) * 2 - 1, my = y / (t - 1) * 2 - 1;
  return -hangM * 60 * (g.flach ?? 1) + wasser * (g.wasser ?? 1) + (wald / (2 * KREIS)) * (g.wald ?? 1)
    + (wiese / (2 * KREIS)) * (g.wiese ?? 0.5) - Math.sqrt(mx * mx + my * my) * (g.mitte ?? 0.6)
    - nass * 0.15 + hash2(x, y, g.seed | 0) * 0.05;
}

/** Ebnet eine Kreisfläche (Zellen) sanft auf ihre mittlere Höhe ein und markiert sie als ORT (+ FREI im Kern). */
export function ebneEin(welt, x, y, radius) {
  const { breite: b, tiefe: t, hoehe: H, flags: FL } = welt;
  const R = Math.ceil(radius * 1.6);
  let sum = 0, n = 0;
  for (let yy = y - R; yy <= y + R; yy++) for (let xx = x - R; xx <= x + R; xx++) {
    if (xx < 0 || yy < 0 || xx >= b || yy >= t) continue;
    const d = Math.hypot(xx - x, yy - y), j = yy * b + xx;
    if (d <= radius && !(FL[j] & WASSER)) { sum += H[j]; n++; }
  }
  if (!n) return;
  const ziel = Math.max(0.01, sum / n);
  for (let yy = y - R; yy <= y + R; yy++) for (let xx = x - R; xx <= x + R; xx++) {
    if (xx < 0 || yy < 0 || xx >= b || yy >= t) continue;
    const j = yy * b + xx;
    if (FL[j] & WASSER) continue;
    const d = Math.hypot(xx - x, yy - y);
    const k = 1 - smoothstep(radius * 0.7, radius * 1.6, d);
    if (k <= 0) continue;
    H[j] += (ziel - H[j]) * k;
    if (d <= radius) FL[j] |= FLAG.ORT;
    if (d <= radius * 0.8) FL[j] |= FLAG.FREI;
  }
}

/** Pipeline-Stufe Orte → welt.orte = { start, doerfer:[…], poi:[…] } in Weltkoordinaten. */
export function stufeOrte(welt, opts) {
  const O = opts.orte || {};
  const { breite: b, tiefe: t, hoehe: H, zelle: z } = welt;
  const k = Math.max(b, t) / 256;
  const ids = keys => new Set(keys.map(key => welt.biome.findIndex(bm => bm.key === key)).filter(i => i >= 0));
  const g = {
    radius: (O.startRadius ?? 7) * k, wasserIdeal: [3 * k, 14 * k], waldIds: ids(O.waldBiome || WALD), wieseIds: ids(O.wiesenBiome || ['wiese', 'heide', 'savanne', 'steppe']),
    seed: hashSeed(opts.seed ?? 1, 'orte'), mitte: (opts.form?.typ === 'unendlich' ? 0 : 0.6), hoeheMax: O.hoeheMax ?? 0.4, ...(O.gewichte || {}),
  };
  const schritt = Math.max(3, Math.round(3 * k));
  const kand = [];
  for (let y = schritt; y < t - schritt; y += schritt) for (let x = schritt; x < b - schritt; x += schritt) {
    const s = bewerteOrt(welt, x, y, g);
    if (s > -Infinity) kand.push(s, x, y);
  }
  const orte = { start: null, doerfer: [], poi: [] };
  const genommen = [];
  const frei = (x, y, d) => genommen.every(p => (p[0] - x) ** 2 + (p[1] - y) ** 2 >= d * d);
  // bester Startplatz
  if (O.start !== false && kand.length) {
    let best = 0;
    for (let i = 3; i < kand.length; i += 3) if (kand[i] > kand[best]) best = i;
    const x = kand[best + 1], y = kand[best + 2];
    ebneEin(welt, x, y, g.radius);
    genommen.push([x, y]);
    orte.start = { x: x * z, y: y * z, radius: g.radius * z, wert: kand[best] };
  }
  // Dörfer: wiesenlastig statt waldlastig
  const anzD = O.doerfer ?? 3;
  if (anzD > 0) {
    const gd = { ...g, wald: 0.2, wiese: 1.2, mitte: 0.1, radius: (O.dorfRadius ?? 5) * k };
    const liste = [];
    for (let i = 0; i < kand.length; i += 3) {
      const s = bewerteOrt(welt, kand[i + 1], kand[i + 2], gd);
      if (s > -Infinity) liste.push([s, kand[i + 1], kand[i + 2]]);
    }
    liste.sort((p, q) => q[0] - p[0] || p[1] - q[1] || p[2] - q[2]);
    const abst = (O.dorfAbstand ?? 40) * k;
    for (const [s, x, y] of liste) {
      if (orte.doerfer.length >= anzD) break;
      if (!frei(x, y, abst)) continue;
      genommen.push([x, y]);
      if (O.dorfEbnen !== false) ebneEin(welt, x, y, gd.radius);
      orte.doerfer.push({ x: x * z, y: y * z, radius: gd.radius * z, wert: s });
    }
  }
  // Sehenswürdigkeiten
  if (O.poi !== false) {
    const gip = [], abst = 24 * k, R = Math.max(3, Math.round(6 * k));
    for (let y = R; y < t - R; y += 2) for (let x = R; x < b - R; x += 2) {
      const h = H[y * b + x];
      if (h < (O.gipfelMin ?? 0.45)) continue;
      let max = true;
      for (let dy = -R; dy <= R && max; dy += 2) for (let dx = -R; dx <= R; dx += 2) if (H[(y + dy) * b + x + dx] > h) { max = false; break; }
      if (max) gip.push([h, x, y]);
    }
    gip.sort((p, q) => q[0] - p[0]);
    const gw = [];
    for (const [h, x, y] of gip) {
      if (gw.length >= (O.maxGipfel ?? 6)) break;
      if (gw.some(p => (p[0] - x) ** 2 + (p[1] - y) ** 2 < abst * abst)) continue;
      gw.push([x, y]); orte.poi.push({ art: 'gipfel', x: x * z, y: y * z, wert: h });
    }
    for (const f of welt.fluesse || []) {
      orte.poi.push({ art: 'quelle', x: f.punkte[0], y: f.punkte[1], wert: f.laenge });
      if (f.muendung === 'meer') orte.poi.push({ art: 'muendung', x: f.punkte[f.punkte.length - 2], y: f.punkte[f.punkte.length - 1], wert: f.laenge });
    }
    for (const s of welt.seen || []) orte.poi.push({ art: 'see', x: s.x, y: s.y, wert: s.flaeche });
  }
  welt.orte = orte;
  welt.hang = berechneHang(H, b, t, welt.hang);
}
