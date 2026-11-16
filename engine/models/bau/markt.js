/**
 * @modul    bau-markt
 * @zweck    Marktplatz-Kleinkram als Low-Poly-Asset: Marktstand mit Stoffdach (4 Farben), Brunnen mit Holzdach, Sitzbank
 * @api      createMarktstand({seed,variante 0-3}) ; createBrunnen({seed}) ; createBank({seed}) -> asset { name, variante, geometrie, leucht, kollision, anker, masse, dreiecke, dispose }
 * @beispiel
 *   import { createMarktstand } from '../../engine/models/bau/markt.js';
 *   const stand = createMarktstand({ seed: 3, variante: 1 });   // stand.geometrie in Mesh/InstancedMesh
 * @tags     bau, markt, brunnen, bank, asset, lowpoly, mittelalter
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import { createMeshBuilder } from '../../render/mesh-builder.js';
import { hashSeed } from '../../core/rng.js';
import { FARBEN, kasten, kreis, asset } from './bau-basis.js';

const STOFF = [FARBEN.stoffRot, FARBEN.stoffBlau, FARBEN.stoffGruen, FARBEN.stoffGelb];
const WAREN = ['#b8372b', '#d9a441', '#6f9a3c', '#8a5a9a'];

/** Marktstand 3 × 2 × 2.6: Pfosten, Theke mit Waren-Kisten, gestreiftes Stoffdach (Farbe je variante 0–3). Front +z. */
export function createMarktstand({ seed = 1, variante = 0 } = {}) {
  const v = ((variante % 4) + 4) % 4;
  const b = createMeshBuilder({ seed: hashSeed('marktstand', seed, v) });
  for (const s of [-1, 1]) {
    b.box(0.1, 2.5, 0.1, FARBEN.holzDunkel, { x: s * 1.4, y: 1.25, z: -0.85 });
    b.box(0.1, 2.15, 0.1, FARBEN.holzDunkel, { x: s * 1.4, y: 1.075, z: 0.85 });
  }
  b.box(2.8, 1.6, 0.04, FARBEN.holz, { y: 1.3, z: -0.85 });           // Rückwand
  b.box(2.8, 0.9, 0.6, FARBEN.holzHell, { y: 0.45, z: 0.55 });         // Theke
  for (let i = 0; i < 3; i++) {                                        // Waren-Kisten mit Früchten
    const x = (i - 1) * 0.9;
    b.box(0.7, 0.25, 0.45, FARBEN.holz, { x, y: 1.025, z: 0.55 });
    for (let k = 0; k < 2; k++) b.ico(0.11, WAREN[(v + i + k) % 4], { x: x + (k - 0.5) * 0.25, y: 1.22, z: 0.55 });
  }
  for (let i = 0; i < 6; i++)                                          // Stoffdach, vorn tiefer
    b.box(0.5, 0.06, 2.04, i % 2 ? FARBEN.putz : STOFF[v], { x: -1.25 + i * 0.5, y: 2.38, rx: 0.2 });
  return asset({ name: 'marktstand', variante: v, geometrie: b.geometry(),
    kollision: [kasten(0, 0, 1.5, 1.0, 2.6)],
    anker: { station: { art: 'markt', x: 0, z: 1.4 }, licht: [{ x: 0, y: 2.0, z: 0.3, farbe: FARBEN.licht, staerke: 0.4 }] },
    masse: { breite: 3, tiefe: 2, hoehe: 2.6 } });
}

/** Brunnen Ø 2.6 × 3: Steinring mit Wasser, zwei Pfosten, Holzdach, Kurbelwelle mit Eimer. */
export function createBrunnen({ seed = 1 } = {}) {
  const b = createMeshBuilder({ seed: hashSeed('brunnen', seed) });
  b.lathe([[1.3, 0], [1.3, 1.02], [1.02, 1.02], [1.02, 0.8]], FARBEN.stein, {}, 10);
  b.cyl(1.02, 1.02, 0.02, FARBEN.wasser, { y: 0.85 }, 10);
  for (const s of [-1, 1]) b.box(0.14, 1.8, 0.14, FARBEN.holzDunkel, { x: s * 1.15, y: 1.9 });
  b.box(2.6, 0.06, 1.5, FARBEN.dachRot, { y: 2.55, z: 0.62, rx: 0.6 });
  b.box(2.6, 0.06, 1.5, FARBEN.dachRot, { y: 2.55, z: -0.62, rx: -0.6 });
  b.box(2.6, 0.06, 0.1, FARBEN.holzDunkel, { y: 3.0 });                 // First
  b.cyl(0.07, 0.07, 2.3, FARBEN.holz, { y: 2.0, rz: Math.PI / 2 }, 6);  // Kurbelwelle
  b.box(0.05, 0.3, 0.05, FARBEN.eisen, { x: 1.2, y: 1.85 });
  b.box(0.05, 0.05, 0.2, FARBEN.holzHell, { x: 1.22, y: 1.7 });
  b.cyl(0.015, 0.015, 0.75, FARBEN.holzHell, { y: 1.575 }, 4);          // Seil
  b.cyl(0.12, 0.1, 0.16, FARBEN.holz, { y: 1.1 }, 6);                   // Eimer
  return asset({ name: 'brunnen', geometrie: b.geometry(), kollision: [kreis(0, 0, 1.3, 1.0)],
    anker: { station: { art: 'brunnen', x: 0, z: 1.8 } }, masse: { breite: 2.6, tiefe: 2.6, hoehe: 3 } });
}

/** Bank 1.8 × 0.5 × 0.85: Sitzbrett, Lehne, zwei Brettbeine; sitz-Anker für zwei Plätze. */
export function createBank({ seed = 1 } = {}) {
  const b = createMeshBuilder({ seed: hashSeed('bank', seed) });
  b.box(1.8, 0.08, 0.5, FARBEN.holzHell, { y: 0.45 });
  b.box(1.8, 0.36, 0.06, FARBEN.holz, { y: 0.66, z: -0.22 });
  for (const s of [-1, 1]) b.box(0.08, 0.45, 0.5, FARBEN.holzDunkel, { x: s * 0.8, y: 0.225 });
  return asset({ name: 'bank', geometrie: b.geometry(), kollision: [kasten(0, 0, 0.9, 0.25, 0.5)],
    anker: { sitz: [{ x: -0.45, y: 0.5, z: 0, winkel: 0 }, { x: 0.45, y: 0.5, z: 0, winkel: 0 }] },
    masse: { breite: 1.8, tiefe: 0.5, hoehe: 0.85 } });
}
