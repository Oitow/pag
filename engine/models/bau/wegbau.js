/**
 * @modul    bau-wegbau
 * @zweck    Wegrand-Kleinkram als Low-Poly-Asset: Wegweiser mit Pfeilbrettern, Zaunsegment (2 m, reihbar), Steinkreis
 * @api      createWegweiser({seed,schilder:[{winkel,text}]}) ; createZaun({seed,variante 0-1}) ; createSteinkreis({seed}) -> asset { name, variante, geometrie, leucht, kollision, anker, masse, dreiecke, dispose }
 * @beispiel
 *   import { createWegweiser } from '../../engine/models/bau/wegbau.js';
 *   const w = createWegweiser({ schilder: [{ winkel: 1.2, text: 'Enklave' }] });   // w.anker.schild = [{ winkel, text, x, y, z }]
 * @tags     bau, wegweiser, zaun, steinkreis, asset, lowpoly, mittelalter
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import { createMeshBuilder } from '../../render/mesh-builder.js';
import { rng, hashSeed } from '../../core/rng.js';
import { FARBEN, kasten, kreis, asset } from './bau-basis.js';

const L = 0.8;   // Brettlänge

/** Wegweiser: Pfahl 2.4 m, 1–3 Pfeilbretter; Brett zeigt in Richtung winkel (Blick = (sin w, cos w) in x/z). anker.schild[i] = { winkel, text, x, y, z }. */
export function createWegweiser({ seed = 1, schilder = [{ winkel: 0, text: '' }] } = {}) {
  const b = createMeshBuilder({ seed: hashSeed('wegweiser', seed) });
  b.cyl(0.06, 0.07, 2.7, FARBEN.holzDunkel, { y: 1.05 }, 6);
  b.box(0.16, 0.08, 0.16, FARBEN.holz, { y: 2.42 });
  const liste = schilder.slice(0, 3), schild = [];
  let x0 = -0.08, x1 = 0.08, z0 = -0.08, z1 = 0.08;
  liste.forEach((s, i) => {
    const w = s.winkel || 0, y = 2.15 - i * 0.32, sx = Math.sin(w), cz = Math.cos(w), th = w - Math.PI / 2;
    b.box(L, 0.2, 0.04, i % 2 ? FARBEN.holzHell : FARBEN.holz, { x: sx * 0.46, z: cz * 0.46, y, ry: th });
    b.box(0.19, 0.19, 0.04, i % 2 ? FARBEN.holzHell : FARBEN.holz, { x: sx * 0.9, z: cz * 0.9, y, ry: th, rz: Math.PI / 4 });
    schild.push({ winkel: w, text: s.text || '', x: sx * 0.46, y, z: cz * 0.46 });
    const ex = sx * 1.0, ez = cz * 1.0;
    x0 = Math.min(x0, ex - 0.1); x1 = Math.max(x1, ex + 0.1); z0 = Math.min(z0, ez - 0.1); z1 = Math.max(z1, ez + 0.1);
  });
  return asset({ name: 'wegweiser', geometrie: b.geometry(), kollision: [kreis(0, 0, 0.1, 2.4)], anker: { schild },
    masse: { breite: Math.max(x1, 0.1) - Math.min(x0, -0.1), tiefe: Math.max(z1, 0.1) - Math.min(z0, -0.1), hoehe: 2.46 } });
}

/** Zaunsegment, Länge genau 2 m (Pfosten bündig an ±1): variante 0 = Latten, 1 = Flechtwerk. */
export function createZaun({ seed = 1, variante = 0 } = {}) {
  const v = variante ? 1 : 0;
  const b = createMeshBuilder({ seed: hashSeed('zaun', seed, v) });
  for (const s of [-1, 1]) b.box(0.12, 1.4, 0.12, FARBEN.holzDunkel, { x: s * 0.94, y: 0.4 });
  if (!v) {
    for (const y of [0.35, 0.8]) b.box(1.88, 0.1, 0.05, FARBEN.holz, { y, z: 0.04 });
    for (let i = 0; i < 5; i++) b.box(0.12, 0.9, 0.03, FARBEN.holzHell, { x: (i - 2) * 0.3, y: 0.55, z: -0.03 });
  } else {
    for (let i = 0; i < 4; i++) b.box(1.88, 0.1, 0.05, i % 2 ? FARBEN.holz : FARBEN.stroh, { y: 0.3 + i * 0.22, z: i % 2 ? 0.025 : -0.025 });
    for (let i = 0; i < 3; i++) b.box(0.06, 0.95, 0.05, FARBEN.holzDunkel, { x: (i - 1) * 0.6, y: 0.52 });
  }
  return asset({ name: 'zaun', variante: v, geometrie: b.geometry(), kollision: [kasten(0, 0, 1, 0.07, 1.1)],
    masse: { breite: 2, tiefe: 0.12, hoehe: 1.1 } });
}

/** Steinkreis Ø 4: sieben Menhire (Höhe je seed), flacher Mittelstein. */
export function createSteinkreis({ seed = 1 } = {}) {
  const r = rng(hashSeed('steinkreis', seed));
  const b = createMeshBuilder({ seed: hashSeed('steinkreis', seed, 1) });
  const kollision = [];
  for (let i = 0; i < 7; i++) {
    const a = i * 2 * Math.PI / 7, h = 1.0 + r() * 0.5, x = Math.sin(a) * 1.6, z = Math.cos(a) * 1.6;
    b.cyl(0.26, 0.4, h, i % 2 ? FARBEN.stein : FARBEN.steinDunkel, { x, z, y: h / 2 - 0.1, ry: r() * 3, rx: (r() - 0.5) * 0.12, rz: (r() - 0.5) * 0.12 }, 5);
    kollision.push(kreis(x, z, 0.38, h - 0.1));
  }
  b.cyl(0.5, 0.55, 0.2, FARBEN.steinHell, { y: 0.1 }, 6);
  return asset({ name: 'steinkreis', geometrie: b.geometry(), kollision,
    anker: { station: { art: 'steinkreis', x: 0, z: 0 } }, masse: { breite: 3.85, tiefe: 3.85, hoehe: 1.4 } });
}
