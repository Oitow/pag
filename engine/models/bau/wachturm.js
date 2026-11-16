/**
 * @modul    wachturm
 * @zweck    Wachturm als Low-Poly-Asset: Steinschaft, auskragendes Holz-Obergeschoss mit Zinnen und Flagge
 * @api      createWachturm({ seed = 1, variante = 0 }) -> asset { geometrie, leucht, kollision, anker { tuer, fackeln, wachen, licht }, masse, dreiecke, dispose }
 * @beispiel
 *   import { createWachturm } from '../../engine/models/bau/wachturm.js';
 *   const t = createWachturm({ seed: 5 });
 * @tags     bau, gebaeude, wachturm, zinnen, asset, lowpoly
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import { createMeshBuilder } from '../../render/mesh-builder.js';
import { rng, hashSeed, pick } from '../../core/rng.js';
import { FARBEN as F, kasten, asset } from './bau-basis.js';
import { mitT, fachwerk, fenster, tuer, zinnenLinie, laterne, flagge } from './bau-teile.js';

const R90 = Math.PI / 2;

export function createWachturm({ seed = 1, variante = 0 } = {}) {
  const r = rng(hashSeed('wachturm', seed, variante));
  const b = createMeshBuilder({ seed: hashSeed('wachturm-b', seed, variante) }), l = createMeshBuilder({ seed: 1, jitter: 0 });
  const fahne = pick(r, [F.stoffRot, F.stoffBlau, F.stoffGelb]);
  // Steinschaft mit Sockel (vorn bündig, damit die Tür sitzt) und Bändern
  b.box(3.8, 7.0, 3.8, F.stein, { y: 3.0, jitter: 0.09 }).box(4.1, 1.3, 3.95, F.steinDunkel, { y: 0.15, z: -0.075, jitter: 0.07 });
  for (const y of [4.6]) b.box(3.88, 0.12, 3.88, F.steinDunkel, { y, jitter: 0.04 });
  const Pf = mitT(b, { z: 1.9 }), Lf = mitT(l, { z: 1.9 });
  tuer(Pf, 1.1, 2.0);
  for (const s of [-1, 1]) laterne(Pf, Lf, s * 1.45, 2.4, 0.0, 0.3);
  for (const y of [4.0]) {
    b.box(0.14, 0.75, 0.08, F.fenster, { x: 0, y, z: 1.93 });
    for (const ry of [R90, -R90]) b.box(0.14, 0.75, 0.08, F.fenster, mitPos(ry, y));
  }
  // Holz-Obergeschoss, kragt aus
  b.box(4.5, 0.35, 4.5, F.holzDunkel, { y: 6.65, jitter: 0.05 }).box(4.2, 2.1, 4.2, F.holz, { y: 7.85, jitter: 0.08 });
  for (const f of [{ ry: 0, x: 0, z: 2.1 }, { ry: Math.PI, x: 0, z: -2.1 }, { ry: R90, x: 2.1, z: 0 }, { ry: -R90, x: -2.1, z: 0 }]) {
    const P = mitT(b, { ...f, y: 6.8 }), Pl = mitT(l, { ...f, y: 6.8 });
    fachwerk(P, 4.2, 2.1, { schienen: [2.0], pfosten: [-2.0, 2.0, 0.0], farbe: F.holzDunkel });
    fenster(P, Pl, 0, 1.05, { w: 0.5, h: 0.6, laeden: false, kreuz: false });
  }
  // Plattform, Zinnen, Flagge
  b.box(4.5, 0.22, 4.5, F.holzDunkel, { y: 8.95, jitter: 0.05 });
  const e = 2.05;
  for (const [x1, z1, x2, z2] of [[-e, e, e, e], [e, e, e, -e], [e, -e, -e, -e], [-e, -e, -e, e]])
    zinnenLinie(b, x1, z1, x2, z2, 9.06, { n: 3, bw: 0.8, bh: 0.6, bt: 0.28, farbe: F.holzHell });
  flagge(b, -1.5, 8.5, -1.5, fahne);
  const anker = { tuer: { x: 0, y: 0, z: 1.9, winkel: 0, breite: 1.1, hoehe: 2.0 }, fackeln: [-1, 1].map((s) => ({ x: s * 1.45, y: 2.5, z: 2.4 })),
    wachen: [{ x: 0, z: 0, winkel: 0, y: 9.06 }], licht: [{ x: 0, y: 7.9, z: 2.4, farbe: F.licht, staerke: 0.7 }, { x: -1.45, y: 2.5, z: 2.4, farbe: F.licht, staerke: 0.8 }] };
  return asset({ name: 'wachturm', variante, geometrie: b.geometry(), leucht: l.geometry(), kollision: [kasten(0, 0, 2.2, 2.2, 9.7)], anker,
    masse: { breite: 4.5, tiefe: 4.5, hoehe: 11 } });
}
// Schießscharte auf Seite ry: Position/Drehung auf der Schaftwand (Schafthalbmaß 1.9)
function mitPos(ry, y) { return { x: Math.sin(ry) * 1.93, z: Math.cos(ry) * 1.93, y, ry }; }
