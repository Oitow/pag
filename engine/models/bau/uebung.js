/**
 * @modul    bau-uebung
 * @zweck    Übungs- und Lager-Kleinkram als Low-Poly-Asset: Trainingspuppe, Zielscheibe, Zelt, Amboss
 * @api      createTrainingspuppe({seed}) ; createZielscheibe({seed}) ; createZelt({seed,variante 0-2}) ; createAmboss({seed}) -> asset { name, variante, geometrie, leucht, kollision, anker, masse, dreiecke, dispose }
 * @beispiel
 *   import { createTrainingspuppe } from '../../engine/models/bau/uebung.js';
 *   const puppe = createTrainingspuppe();   // puppe.anker.ziel = Trefferpunkt, Kollision = Zylinder
 * @tags     bau, training, puppe, zielscheibe, zelt, amboss, asset, lowpoly
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import { createMeshBuilder } from '../../render/mesh-builder.js';
import { hashSeed } from '../../core/rng.js';
import { FARBEN, kasten, kreis, asset } from './bau-basis.js';

/** Trainingspuppe 1.8 m: Pfahl mit Kreuzfuß, Strohsack-Rumpf, Kopf, Querbalken mit Handsäcken, Holzschild. */
export function createTrainingspuppe({ seed = 1 } = {}) {
  const b = createMeshBuilder({ seed: hashSeed('puppe', seed) });
  b.cyl(0.07, 0.08, 1.8, FARBEN.holzDunkel, { y: 0.6 }, 6);
  b.box(0.8, 0.1, 0.12, FARBEN.holz, { y: 0.05 });
  b.box(0.12, 0.1, 0.8, FARBEN.holz, { y: 0.05 });
  b.cyl(0.25, 0.22, 0.6, FARBEN.stroh, { y: 1.1 }, 8);
  b.ico(0.17, FARBEN.putzDunkel, { y: 1.62 });
  b.box(1.0, 0.08, 0.08, FARBEN.holz, { y: 1.35 });
  for (const s of [-1, 1]) b.ico(0.09, FARBEN.stroh, { x: s * 0.5, y: 1.35 });
  b.cyl(0.2, 0.2, 0.04, FARBEN.holzHell, { y: 1.1, z: 0.26, rx: Math.PI / 2 }, 8);
  return asset({ name: 'trainingspuppe', geometrie: b.geometry(), kollision: [kreis(0, 0, 0.3, 1.8)],
    anker: { ziel: { x: 0, y: 1.2, z: 0 }, station: { art: 'puppe', x: 0, z: 0.9 } },
    masse: { breite: 1.15, tiefe: 0.8, hoehe: 1.8 } });
}

/** Zielscheibe Ø 1.2 auf Gestell (Scheibe zeigt nach +z): drei Ringe rot/weiß, zwei Beine, Querstrebe. */
export function createZielscheibe({ seed = 1 } = {}) {
  const b = createMeshBuilder({ seed: hashSeed('zielscheibe', seed) });
  const ringe = [[0.6, FARBEN.putz, 0], [0.4, FARBEN.stoffRot, 0.01], [0.2, FARBEN.putz, 0.02]];
  for (const [r, f, dz] of ringe) b.cyl(r, r, 0.08, f, { y: 1.3, z: dz, rx: Math.PI / 2 }, 8);
  for (const s of [-1, 1]) b.box(0.08, 1.3, 0.08, FARBEN.holzDunkel, { x: s * 0.4, y: 0.65, z: -0.1 });
  b.box(0.9, 0.08, 0.08, FARBEN.holz, { y: 0.5, z: -0.1 });
  return asset({ name: 'zielscheibe', geometrie: b.geometry(), kollision: [kreis(0, 0, 0.15, 1.9)],
    anker: { ziel: { x: 0, y: 1.3, z: 0.06 } }, masse: { breite: 1.2, tiefe: 0.2, hoehe: 1.9 } });
}

const ZELT = [FARBEN.putz, FARBEN.stoffGruen, FARBEN.stoffBlau];

/** Zelt 3 × 3 × 2.4 (A-Form, Eingang +z): zwei Stoffbahnen, Firststange, dunkler Eingang mit Raffbahnen, Heringe. */
export function createZelt({ seed = 1, variante = 0 } = {}) {
  const v = ((variante % 3) + 3) % 3;
  const b = createMeshBuilder({ seed: hashSeed('zelt', seed, v) });
  const w = 0.559;
  b.box(0.05, 2.83, 3.0, ZELT[v], { x: -0.75, y: 1.2, rz: -w });
  b.box(0.05, 2.83, 3.0, ZELT[v], { x: 0.75, y: 1.2, rz: w });
  b.cyl(0.04, 0.04, 3.0, FARBEN.holzDunkel, { y: 2.4, rx: Math.PI / 2 }, 5);
  b.box(0.8, 1.6, 0.05, FARBEN.fenster, { y: 0.8, z: 1.51 });
  for (const s of [-1, 1]) b.cyl(0.06, 0.06, 1.5, ZELT[v], { x: s * 0.42, y: 0.75, z: 1.53 }, 5);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.06, 0.2, 0.06, FARBEN.holzDunkel, { x: sx * 1.5, y: 0.1, z: sz * 1.45 });
  return asset({ name: 'zelt', variante: v, geometrie: b.geometry(), kollision: [kasten(0, 0, 1.3, 1.5, 1.8)],
    anker: { tuer: { x: 0, z: 1.5, breite: 0.9 }, licht: [{ x: 0, y: 1.0, z: 0, farbe: FARBEN.licht, staerke: 0.3 }] },
    masse: { breite: 3, tiefe: 3, hoehe: 2.4 } });
}

/** Amboss 0.9 × 0.4 × 0.8: Holzstumpf, Platte, Taille, Bahn mit Horn nach +x. */
export function createAmboss({ seed = 1 } = {}) {
  const b = createMeshBuilder({ seed: hashSeed('amboss', seed) });
  b.cyl(0.2, 0.22, 0.5, FARBEN.holz, { y: 0.25 }, 8);
  b.box(0.5, 0.08, 0.4, FARBEN.eisen, { x: -0.05, y: 0.54 });
  b.box(0.22, 0.16, 0.22, FARBEN.eisen, { x: -0.05, y: 0.64 });
  b.box(0.5, 0.1, 0.26, FARBEN.metall, { x: -0.05, y: 0.71 });
  b.cone(0.12, 0.4, FARBEN.metall, { x: 0.4, y: 0.71, rz: -Math.PI / 2 }, 5);
  return asset({ name: 'amboss', geometrie: b.geometry(), kollision: [kasten(0, 0, 0.45, 0.2, 0.8)],
    anker: { station: { art: 'amboss', x: 0, z: 0.6 } }, masse: { breite: 0.9, tiefe: 0.4, hoehe: 0.8 } });
}
