/**
 * @modul    bau-licht
 * @zweck    Lichtquellen als Low-Poly-Asset mit Leucht-Geometrie (unbeleuchtet zeichnen): Laterne auf Pfahl, Wandfackel, Lagerfeuer mit Steinring
 * @api      createLaterne({seed}) ; createFackel({seed}) ; createLagerfeuer({seed}) -> asset { name, geometrie, leucht, kollision, anker (licht/fackeln), masse, dreiecke, dispose }
 * @beispiel
 *   import { createLagerfeuer } from '../../engine/models/bau/licht.js';
 *   const feuer = createLagerfeuer({ seed: 5 });   // feuer.leucht = Flammen, feuer.anker.licht = PointLight-Vorlage
 * @tags     bau, licht, laterne, fackel, lagerfeuer, leucht, asset, lowpoly
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import { createMeshBuilder } from '../../render/mesh-builder.js';
import { hashSeed } from '../../core/rng.js';
import { FARBEN, kreis, asset } from './bau-basis.js';

/** Laterne: Steinfuß, Pfahl 2.3 m, Lampenkopf (leucht) mit Kappe; Gesamthöhe 2.8. */
export function createLaterne({ seed = 1 } = {}) {
  const b = createMeshBuilder({ seed: hashSeed('laterne', seed) });
  b.cyl(0.15, 0.17, 0.3, FARBEN.stein, { y: 0.15 }, 6);
  b.cyl(0.05, 0.06, 2.0, FARBEN.holzDunkel, { y: 1.3 }, 6);
  b.box(0.4, 0.04, 0.4, FARBEN.eisen, { y: 2.3 });
  b.cone(0.2, 0.18, FARBEN.eisen, { y: 2.71, ry: Math.PI / 4 }, 4);
  const l = createMeshBuilder({ seed: 1, jitter: 0 }).box(0.26, 0.3, 0.26, FARBEN.licht, { y: 2.47 });
  return asset({ name: 'laterne', geometrie: b.geometry(), leucht: l.geometry(), kollision: [kreis(0, 0, 0.15, 2.8)],
    anker: { licht: [{ x: 0, y: 2.47, z: 0, farbe: FARBEN.licht, staerke: 1.2 }] },
    masse: { breite: 0.4, tiefe: 0.4, hoehe: 2.8 } });
}

/** Wandfackel 0.6 m: Platte an der Wand (z = 0), Halter schräg nach +z, Flamme (leucht). */
export function createFackel({ seed = 1 } = {}) {
  const b = createMeshBuilder({ seed: hashSeed('fackel', seed) });
  b.box(0.12, 0.4, 0.03, FARBEN.eisen, { y: 0.2, z: 0.015 });
  b.cyl(0.03, 0.035, 0.45, FARBEN.holzDunkel, { y: 0.25, z: 0.08, rx: 0.35 }, 5);
  const l = createMeshBuilder({ seed: 1, jitter: 0 });
  l.cone(0.06, 0.18, FARBEN.flamme, { y: 0.51, z: 0.16 }, 5);
  return asset({ name: 'fackel', geometrie: b.geometry(), leucht: l.geometry(),
    anker: { licht: [{ x: 0, y: 0.52, z: 0.18, farbe: FARBEN.flamme, staerke: 0.8 }] },
    masse: { breite: 0.12, tiefe: 0.22, hoehe: 0.6 } });
}

/** Lagerfeuer Ø ~1.4: sechs Steine im Ring, gekreuzte Scheite, Glut + zwei Flammen (leucht). */
export function createLagerfeuer({ seed = 1 } = {}) {
  const b = createMeshBuilder({ seed: hashSeed('lagerfeuer', seed) });
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    b.ico(0.18, i % 2 ? FARBEN.steinDunkel : FARBEN.stein, { x: Math.sin(a) * 0.52, z: Math.cos(a) * 0.52, y: 0.1, sy: 0.7, ry: i });
  }
  b.cyl(0.05, 0.06, 0.8, FARBEN.holzDunkel, { y: 0.14, ry: 0.5, rz: Math.PI / 2 - 0.15 }, 5);
  b.cyl(0.05, 0.06, 0.8, FARBEN.holz, { y: 0.17, ry: 2.1, rz: Math.PI / 2 - 0.15 }, 5);
  const l = createMeshBuilder({ seed: hashSeed('flamme', seed), jitter: 0.04 });
  l.cyl(0.3, 0.3, 0.04, FARBEN.glut, { y: 0.12 }, 5);
  l.cone(0.2, 0.6, FARBEN.flamme, { y: 0.45 }, 4);
  l.cone(0.12, 0.4, FARBEN.glut, { y: 0.4, x: 0.12, z: 0.08, ry: 0.7 }, 4);
  return asset({ name: 'lagerfeuer', geometrie: b.geometry(), leucht: l.geometry(), kollision: [kreis(0, 0, 0.7, 0.4)],
    anker: { licht: [{ x: 0, y: 0.6, z: 0, farbe: FARBEN.flamme, staerke: 2.2 }], station: { art: 'feuer', x: 0, z: 1.1 } },
    masse: { breite: 1.25, tiefe: 1.35, hoehe: 0.75 } });
}
