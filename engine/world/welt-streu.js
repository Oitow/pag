/**
 * @modul    welt-streu
 * @zweck    Streu-Objekte (Bäume, Felsen, Büsche, Bodendecker) für eine Kachel deterministisch aus Seed + Biom-Regeln setzen – mit Lücken an Wegen, Orten, Wasser, steilen Hängen und gesperrten Flächen (reine Logik)
 * @api      streuKachel(karte, kachel, {art,seed,dichte,regeln,frei(x,z,r)->bool,info(typ)->{radius,stammRadius}}) -> [{typ,v,x,y,z,rot,s,r}] ; STREU_ARTEN
 * @beispiel
 *   import { streuKachel } from '../../engine/world/welt-streu.js';
 *   const objs = streuKachel(karte, { x0: 0, z0: 0, groesse: 64, cx: 0, cz: 0 }, { art: 'gross', seed: 7 });
 * @tags     welt, streu, vegetation, baeume, felsen, kachel, deterministisch, erlenwacht
 * @version  1.1.0
 * @status   entwurf
 * @three    nein
 */
import { hash2, hashSeed } from '../core/rng.js';
import { createNoise2D } from '../core/noise.js';
import { STREU } from './welt-regionen.js';

/** Raster je Kachel (64 m): gross 9×9 (≈7 m), klein 18×18 (≈3.6 m). */
export const STREU_ARTEN = { gross: 9, klein: 18 };
const BAEUME = new Set(['eiche', 'buche', 'birke', 'ahorn', 'weide', 'tanne', 'fichte', 'kiefer', 'toterBaum']);
const FELSEN = new Set(['fels', 'felsbrocken', 'findling', 'felsplatte']);
const NASS_OK = new Set(['schilf']);
const rauschCache = new Map();

/** Wahl nach Gewicht mit u ∈ [0,1). */
function waehle(liste, u) {
  let s = 0; for (const [, w] of liste) s += w;
  let t = u * s;
  for (const [typ, w] of liste) { t -= w; if (t <= 0) return typ; }
  return liste[liste.length - 1][0];
}

export function streuKachel(karte, k, { art = 'gross', seed = 1, dichte = 1, regeln = STREU, frei = null, info = null } = {}) {
  const n = STREU_ARTEN[art] || 9, schritt = k.groesse / n, aus = [];
  const s0 = hashSeed('streu', art, seed);
  let rausch = rauschCache.get(seed);
  if (!rausch) { rausch = createNoise2D(hashSeed('streu-dichte', seed)); rauschCache.set(seed, rausch); }
  const gx0 = Math.round(k.x0 / schritt), gz0 = Math.round(k.z0 / schritt);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const gx = gx0 + i, gz = gz0 + j;
    const x = (gx + 0.05 + hash2(gx, gz, s0 + 1) * 0.9) * schritt, z = (gz + 0.05 + hash2(gx, gz, s0 + 2) * 0.9) * schritt;   // volle Zelle: keine gleichen Abstände
    const h = karte.hoehe(x, z), b = karte.biom(x, z, h), r = regeln[b]?.[art];
    if (!r) continue;
    const maske = Math.min(1, Math.max(0, 0.65 + 0.8 * rausch(x / 45, z / 45) + 0.2 * rausch(x / 13 + 9, z / 13)));
    if (hash2(gx, gz, s0 + 3) >= r[0] * maske * dichte) continue;
    const typ = waehle(r[1], hash2(gx, gz, s0 + 4));
    const wh = karte.wasserHoehe(x, z, h);
    if (wh !== null && !(NASS_OK.has(typ) && wh - h < 0.8)) continue;
    if (wh === null && NASS_OK.has(typ) && b === 'sumpf' && hash2(gx, gz, s0 + 9) < 0.5) continue;
    const baum = BAEUME.has(typ), fels = FELSEN.has(typ);
    // Hang: steile Stellen nur für Felsen
    const dh = Math.abs(karte.hoehe(x + 1.5, z) - h) + Math.abs(karte.hoehe(x, z + 1.5) - h);
    if (dh > (fels ? 2.4 : baum ? 1.1 : 1.5)) continue;
    const w = karte.wegInfo(x, z);
    if (w.d < w.breite + (baum ? 3 : 1.2)) continue;
    let s;
    if (baum) { const u = hash2(gx, gz, s0 + 5); s = (b === 'urwald' ? 1.0 : 0.7) + u * u * 0.9 + hash2(gx, gz, s0 + 8) * 0.25; }   // Größenvarianz: viele mittlere, wenige große
    else if (fels) s = 0.6 + hash2(gx, gz, s0 + 5) ** 2 * (typ === 'findling' ? 2.2 : 1.4);
    else s = 0.75 + hash2(gx, gz, s0 + 5) * 0.5;
    const a = info?.(typ);
    const radius = a ? (baum ? (a.stammRadius || 0.3) * s * 1.15 : fels ? a.radius * s * 0.8 : 0) : 0;
    const platz = baum ? Math.max(1.5, radius) : radius;
    let imOrt = false;
    for (const o of karte.orte) if (o.radius && (x - o.x) ** 2 + (z - o.z) ** 2 < (o.radius + platz) ** 2) { imOrt = true; break; }
    if (imOrt) continue;
    if (frei && !frei(x, z, platz)) continue;
    aus.push({ typ, v: hash2(gx, gz, s0 + 6) < 0.5 ? 0 : 1, x, y: h, z, rot: hash2(gx, gz, s0 + 7) * Math.PI * 2, s, r: radius, hoehe: a?.hoehe ? a.hoehe * s : 1, baum, fels });
  }
  return aus;
}
