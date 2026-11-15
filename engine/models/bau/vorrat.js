/**
 * @modul    bau-vorrat
 * @zweck    Vorrats-Kleinkram als Low-Poly-Asset: Fass, Kiste (normal/flach), Banner mit Stange (4 Farben)
 * @api      createFass({seed}) ; createKiste({seed,variante 0-1}) ; createBanner({seed,variante 0-3}) -> asset { name, variante, geometrie, leucht, kollision, anker, masse, dreiecke, dispose }
 * @beispiel
 *   import { createFass, createBanner } from '../../engine/models/bau/vorrat.js';
 *   const fass = createFass({ seed: 2 });
 * @tags     bau, fass, kiste, banner, asset, lowpoly, mittelalter
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import { createMeshBuilder } from '../../render/mesh-builder.js';
import { hashSeed } from '../../core/rng.js';
import { FARBEN, kasten, kreis, asset } from './bau-basis.js';

const STOFF = [FARBEN.stoffRot, FARBEN.stoffBlau, FARBEN.stoffGruen, FARBEN.stoffGelb];

/** Fass Ø 0.7 × 0.9: bauchige Daube, zwei Eisenreifen. */
export function createFass({ seed = 1 } = {}) {
  const b = createMeshBuilder({ seed: hashSeed('fass', seed) });
  b.lathe([[0, 0], [0.3, 0], [0.35, 0.45], [0.3, 0.9], [0, 0.9]], FARBEN.holz, {}, 8);
  b.lathe([[0.335, 0.2], [0.335, 0.26]], FARBEN.eisen, {}, 8);
  b.lathe([[0.337, 0.64], [0.337, 0.7]], FARBEN.eisen, {}, 8);
  return asset({ name: 'fass', geometrie: b.geometry(), kollision: [kreis(0, 0, 0.35, 0.9)],
    masse: { breite: 0.7, tiefe: 0.7, hoehe: 0.9 } });
}

/** Kiste: variante 0 = Würfel 0.8, variante 1 = flach 1.2 × 0.8 × 0.5. Holz mit Deckel und zwei Bändern. */
export function createKiste({ seed = 1, variante = 0 } = {}) {
  const v = variante ? 1 : 0;
  const [bw, bt, bh] = v ? [1.2, 0.8, 0.5] : [0.8, 0.8, 0.8];
  const b = createMeshBuilder({ seed: hashSeed('kiste', seed, v) });
  b.box(bw, bh - 0.06, bt, FARBEN.holz, { y: (bh - 0.06) / 2 });
  b.box(bw, 0.06, bt, FARBEN.holzHell, { y: bh - 0.03 });
  for (const s of [-1, 1]) b.box(0.1, bh - 0.02, bt + 0.02, FARBEN.holzDunkel, { x: s * bw * 0.32, y: (bh - 0.02) / 2 });
  return asset({ name: 'kiste', variante: v, geometrie: b.geometry(), kollision: [kasten(0, 0, bw / 2, bt / 2, bh)],
    masse: { breite: bw, tiefe: bt, hoehe: bh } });
}

/** Banner: Stange 4 m mit Querholz, Tuch 0.9 × 2 (Farbe je variante 0–3) mit Goldzeichen, Fußplatte. */
export function createBanner({ seed = 1, variante = 0 } = {}) {
  const v = ((variante % 4) + 4) % 4;
  const b = createMeshBuilder({ seed: hashSeed('banner', seed, v) });
  b.cyl(0.04, 0.05, 3.9, FARBEN.holzDunkel, { y: 1.95 }, 6);
  b.cone(0.06, 0.2, FARBEN.gold, { y: 3.9 }, 6);
  b.box(0.4, 0.1, 0.4, FARBEN.stein, { y: 0.05 });
  b.box(0.9, 0.05, 0.05, FARBEN.holz, { y: 3.75, z: 0.06 });
  b.box(0.9, 1.0, 0.02, STOFF[v], { y: 3.2, z: 0.06 });
  b.box(0.9, 1.0, 0.02, STOFF[v], { y: 2.2, z: 0.09 });
  b.box(0.3, 0.3, 0.025, FARBEN.gold, { y: 3.2, z: 0.075 });
  return asset({ name: 'banner', variante: v, geometrie: b.geometry(), kollision: [kreis(0, 0, 0.12, 4)],
    masse: { breite: 0.9, tiefe: 0.4, hoehe: 4 } });
}
