/**
 * @modul    tempel
 * @zweck    Tempel/Zauberturm als Low-Poly-Asset: Säulenhalle mit Schieferdach + runder Turm mit blauem Kegeldach und schwebendem Kristall (leuchtet)
 * @api      createTempel({ seed = 1, variante = 0 }) -> asset { geometrie, leucht, kollision, anker { tuer, fackeln, licht }, masse, dreiecke, dispose }
 * @beispiel
 *   import { createTempel } from '../../engine/models/bau/tempel.js';
 *   const t = createTempel();   // t.leucht = Kristall, Fenster, Flammen (unbeleuchtet zeichnen)
 * @tags     bau, gebaeude, tempel, turm, kristall, asset, lowpoly
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import { createMeshBuilder } from '../../render/mesh-builder.js';
import { rng, hashSeed, pick } from '../../core/rng.js';
import { FARBEN as F, kasten, kreis, asset } from './bau-basis.js';
import { mitT, satteldach, fenster, tuer } from './bau-teile.js';

const R90 = Math.PI / 2;
const TZ = -2.9, TR = 3.0;   // Turm-Mitte (z) und Radius

export function createTempel({ seed = 1, variante = 0 } = {}) {
  const r = rng(hashSeed('tempel', seed, variante));
  const b = createMeshBuilder({ seed: hashSeed('tempel-b', seed, variante) }), l = createMeshBuilder({ seed: 1, jitter: 0 });
  const kegel = pick(r, [F.stoffBlau, '#3a4f96', '#2a6a8a']);
  // Halle
  b.box(8, 4.5, 5.2, F.steinHell, { y: 1.75, z: 2.6, jitter: 0.07 }).box(8.3, 1.0, 5.5, F.steinDunkel, { z: 2.6, jitter: 0.07 });
  for (const z of [0.9, 2.6, 4.3]) b.box(8.3, 4.2, 0.35, F.steinDunkel, { y: 1.6, z, jitter: 0.05 });
  satteldach(mitT(b, { z: 2.6 }), { w: 8, d: 5.2, y: 4.0, h: 2.0, ueber: 0.3, farbe: F.dachSchiefer, farbe2: '#5b6578', giebelFarbe: F.steinHell, dick: 0.18 });
  const Pf = mitT(b, { z: 5.2 });
  b.cyl(0.55, 0.55, 0.12, F.gold, { y: 4.85, z: 5.25, rx: R90, jitter: 0.03 }, 8);
  for (const s of [-1, 1]) {   // Säulen vor der Halle
    b.cyl(0.2, 0.24, 3.4, F.steinHell, { x: s * 1.9, y: 2.2, z: 5.5, jitter: 0.05 }, 8);
    b.box(0.6, 0.2, 0.6, F.steinDunkel, { x: s * 1.9, y: 0.5, z: 5.5 }).box(0.6, 0.2, 0.6, F.steinDunkel, { x: s * 1.9, y: 3.9, z: 5.5 });
  }
  b.box(5, 0.7, 0.8, F.steinHell, { y: -0.15, z: 5.6, jitter: 0.05 }).box(4.4, 0.9, 0.5, F.steinHell, { y: -0.05, z: 5.45, jitter: 0.05 });
  tuer(mitT(b, { z: 5.2, y: 0.4 }), 2.0, 2.9);
  for (const z of [1.75, 3.45]) for (const s of [-1, 1]) {
    const f = { x: s * 4.0, z, ry: s * R90 };
    fenster(mitT(b, f), mitT(l, f), 0, 2.3, { w: 0.55, h: 1.6, laeden: false, kreuz: false });
  }
  // Pfeiler mit Feuerschalen (Fackel-Anker)
  for (const s of [-1, 1]) {
    b.box(0.6, 1.5, 0.6, F.stein, { x: s * 4.7, y: 0.25, z: 5.5, jitter: 0.07 }).cyl(0.4, 0.25, 0.3, F.eisen, { x: s * 4.7, y: 1.15, z: 5.5 }, 6);
    l.cone(0.25, 0.6, F.flamme, { x: s * 4.7, y: 1.6, z: 5.5, jitter: 0 }, 5);
  }
  // Zauberturm
  b.cyl(TR, TR + 0.15, 9.5, F.steinHell, { y: 4.25, z: TZ, jitter: 0.07 }, 10);
  for (const y of [4.4, 8.6]) b.cyl(TR + 0.12, TR + 0.12, 0.3, F.steinDunkel, { y, z: TZ, jitter: 0.05 }, 10);
  for (const [deg, y] of [[18, 7.6], [-18, 7.6], [90, 6.2], [-90, 6.2], [162, 7.6], [198, 7.6]]) {
    const a = deg * Math.PI / 180, f = { x: Math.sin(a) * 2.85, z: TZ + Math.cos(a) * 2.85, ry: a };
    fenster(mitT(b, f), mitT(l, f), 0, y, { w: 0.5, h: 1.1, laeden: false, kreuz: false });
  }
  b.cone(3.35, 3.4, kegel, { y: 10.7, z: TZ, jitter: 0.1 }, 10);
  // Schwebender Kristall mit Ring und Splittern
  l.ico(0.45, F.kristall, { y: 13.23, z: TZ, sy: 1.7, jitter: 0 });
  b.torus(0.78, 0.035, F.gold, { y: 13.0, z: TZ, rx: R90 + 0.35 }, 3, 12);
  for (let i = 0; i < 3; i++) { const a = i * 2.09 + 0.4; l.ico(0.1, F.licht, { x: Math.sin(a) * 0.85, y: 13.0 + Math.sin(a * 2) * 0.25, z: TZ + Math.cos(a) * 0.85, jitter: 0 }); }
  const anker = { tuer: { x: 0, y: 0.4, z: 5.2, winkel: 0, breite: 2.0, hoehe: 2.9 }, fackeln: [-1, 1].map((s) => ({ x: s * 4.7, y: 1.5, z: 5.5 })),
    licht: [{ x: 0, y: 13.2, z: TZ, farbe: F.kristall, staerke: 1.4 }, { x: 4.0, y: 2.3, z: 2.6, farbe: F.licht, staerke: 0.6 }, { x: -4.0, y: 2.3, z: 2.6, farbe: F.licht, staerke: 0.6 }] };
  return asset({ name: 'tempel', variante, geometrie: b.geometry(), leucht: l.geometry(), anker,
    kollision: [kasten(0, 2.6, 4, 2.6, 6.2), kreis(0, TZ, TR, 12.4), kasten(-4.7, 5.5, 0.3, 0.3, 1.7), kasten(4.7, 5.5, 0.3, 0.3, 1.7)],
    masse: { breite: 10, tiefe: 12, hoehe: 14 } });
}
