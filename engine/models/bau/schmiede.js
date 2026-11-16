/**
 * @modul    schmiede
 * @zweck    Schmiede als Low-Poly-Asset: Steinhaus mit Satteldach, offener Pultdach-Anbau mit Esse (leuchtende Glut), Wasserbottich und Amboss-Station
 * @api      createSchmiede({ seed = 1, variante = 0 }) -> asset { geometrie, leucht, kollision, anker { tuer, station { art:'amboss', x, z }, licht, fackeln }, masse, dreiecke, dispose }
 * @beispiel
 *   import { createSchmiede } from '../../engine/models/bau/schmiede.js';
 *   const s = createSchmiede();   // s.anker.station = { art: 'amboss', x, z }
 * @tags     bau, gebaeude, schmiede, esse, asset, lowpoly
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import { createMeshBuilder } from '../../render/mesh-builder.js';
import { rng, hashSeed, pick } from '../../core/rng.js';
import { FARBEN as F, kasten, kreis, asset } from './bau-basis.js';
import { mitT, satteldach, pultdach, fenster, tuer, laterne } from './bau-teile.js';

export function createSchmiede({ seed = 1, variante = 0 } = {}) {
  const r = rng(hashSeed('schmiede', seed, variante));
  const b = createMeshBuilder({ seed: hashSeed('schmiede-b', seed, variante) }), l = createMeshBuilder({ seed: 1, jitter: 0 });
  const dach = pick(r, [F.dachSchiefer, '#5a4a40', '#454f5c']);
  const cx = -1.3, cz = -0.2, w = 3.6, d = 4.8, wh = 3.0, zf = cz + d / 2;
  // Haupthaus aus Stein
  b.box(w, wh + 0.5, d, F.stein, { x: cx, y: (wh - 0.5) / 2, z: cz, jitter: 0.09 }).box(w + 0.16, 1.0, d + 0.16, F.steinDunkel, { x: cx, z: cz, jitter: 0.07 });
  for (const y of [1.6, 2.4]) b.box(w + 0.05, 0.1, d + 0.05, F.steinDunkel, { x: cx, y, z: cz, jitter: 0.04 });
  satteldach(mitT(b, { x: cx, z: cz }), { w, d, y: wh, h: 1.7, farbe: dach, farbe2: dach, giebelFarbe: F.steinHell });
  const Pf = mitT(b, { x: cx, z: zf }), Lf = mitT(l, { x: cx, z: zf });
  tuer(Pf, 1.1, 2.1);
  laterne(Pf, Lf, 1.2, 2.45, 0.0);
  fenster(mitT(b, { x: cx - w / 2, z: cz, ry: -Math.PI / 2 }), mitT(l, { x: cx - w / 2, z: cz, ry: -Math.PI / 2 }), 0, 1.9, { laeden: true, laedenFarbe: F.holzDunkel, kreuz: false });
  fenster(mitT(b, { x: cx, z: cz - d / 2, ry: Math.PI }), mitT(l, { x: cx, z: cz - d / 2, ry: Math.PI }), 0, 1.9, { laeden: false, kreuz: false });
  // Anbau: offen, Pultdach, Boden, Rückwand
  b.box(3.0, 0.55, 5.0, F.steinDunkel, { x: 2.0, y: -0.225, z: 0.5, jitter: 0.08 });
  b.box(3.0, 2.4, 0.2, F.holz, { x: 2.0, y: 1.2, z: -1.9, jitter: 0.09 });
  pultdach(b, { x0: 0.5, x1: 3.5, z0: -2.0, z1: 3.0, yHoch: 2.75, yTief: 2.35, farbe: F.holzDunkel, fall: 'x' });
  for (const z of [2.9, -1.9]) b.box(0.22, 2.45, 0.22, F.holz, { x: 3.3, y: 1.2, z, jitter: 0.08 });
  b.box(0.22, 2.7, 0.22, F.holz, { x: 0.75, y: 1.3, z: 2.9, jitter: 0.08 });
  // Esse mit Schornstein, Glut leuchtet
  b.box(1.1, 0.9, 1.2, F.steinDunkel, { x: 1.05, y: 0.45, z: -1.2, jitter: 0.08 });
  l.box(0.8, 0.12, 0.9, F.glut, { x: 1.05, y: 0.93, z: -1.2, jitter: 0.1 });
  b.box(0.8, 4.0, 0.8, F.stein, { x: 1.05, y: 2.9, z: -1.3, jitter: 0.08 }).box(1.0, 0.14, 1.0, F.eisen, { x: 1.05, y: 5.0, z: -1.3 });
  // Wasserbottich, Amboss-Stock, Werkzeugbrett
  b.cyl(0.52, 0.44, 0.65, F.holz, { x: 3.0, y: 0.33, z: 2.0 }, 8).cyl(0.54, 0.54, 0.05, F.eisen, { x: 3.0, y: 0.45, z: 2.0 }, 8);
  b.cyl(0.46, 0.46, 0.03, F.wasser, { x: 3.0, y: 0.64, z: 2.0 }, 8);
  b.cyl(0.33, 0.4, 0.7, F.holzDunkel, { x: 2.3, y: 0.35, z: 0.6 }, 7);
  b.box(1.6, 0.5, 0.06, F.holzHell, { x: 2.1, y: 1.7, z: -1.75 });
  for (const x of [1.5, 1.9, 2.3, 2.7]) b.box(0.05, 0.45, 0.05, F.eisen, { x, y: 1.35, z: -1.68 });
  const anker = { tuer: { x: cx, y: 0, z: zf, winkel: 0, breite: 1.1, hoehe: 2.1 }, station: { art: 'amboss', x: 2.3, z: 0.6 },
    fackeln: [{ x: cx + 1.2, y: 2.55, z: zf + 0.65 }],
    licht: [{ x: 1.05, y: 1.3, z: -0.4, farbe: F.glut, staerke: 1.6 }, { x: cx + 1.2, y: 2.55, z: zf + 0.65, farbe: F.licht, staerke: 0.8 }] };
  return asset({ name: 'schmiede', variante, geometrie: b.geometry(), leucht: l.geometry(), anker,
    kollision: [kasten(cx, cz, w / 2, d / 2, 4.9), kasten(2.0, -1.9, 1.5, 0.15, 2.6), kasten(1.05, -1.25, 0.5, 0.65, 5.0), kreis(3.0, 2.0, 0.52, 0.65)],
    masse: { breite: 7, tiefe: 6, hoehe: 5 } });
}
