/**
 * @modul    taverne
 * @zweck    Taverne als Low-Poly-Asset: 2 Geschosse mit Fachwerk, Erker, Vordach mit Bänken, Ausleger-Schild (Krug)
 * @api      createTaverne({ seed = 1, variante = 0 }) -> asset { geometrie, leucht, kollision, anker { tuer, sitz, licht, fackeln }, masse, dreiecke, dispose }
 * @beispiel
 *   import { createTaverne } from '../../engine/models/bau/taverne.js';
 *   const t = createTaverne({ seed: 2 });   // t.anker.sitz = Sitzplätze unter dem Vordach
 * @tags     bau, gebaeude, taverne, fachwerk, asset, lowpoly
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import { createMeshBuilder } from '../../render/mesh-builder.js';
import { rng, hashSeed, pick } from '../../core/rng.js';
import { FARBEN as F, kasten, asset } from './bau-basis.js';
import { mitT, satteldach, pultdach, fachwerk, fenster, tuer, laterne } from './bau-teile.js';

const R90 = Math.PI / 2;

export function createTaverne({ seed = 1, variante = 0 } = {}) {
  const r = rng(hashSeed('taverne', seed, variante));
  const b = createMeshBuilder({ seed: hashSeed('taverne-b', seed, variante) }), l = createMeshBuilder({ seed: 1, jitter: 0 });
  const laeden = pick(r, [F.stoffRot, F.stoffGruen, F.stoffBlau]), dach = pick(r, [F.dachRot, '#8c4630', '#a0553a']);
  const w = 9.0, d = 6.0, zc = -0.6, zf = zc + d / 2, ho = 5.9, hw = ho - 3.2;
  const fen = (P, Pl, x, y, o) => fenster(P, Pl, x, y, { laedenFarbe: laeden, kreuz: false, ...o });
  b.box(w + 0.12, 1.0, d + 0.12, F.stein, { z: zc, jitter: 0.1 }).box(w, ho - 0.5, d, F.putz, { y: 0.5 + (ho - 0.5) / 2, z: zc });
  b.box(w + 0.14, 0.3, d + 0.14, F.holzDunkel, { y: 3.2, z: zc, jitter: 0.04 });   // Geschossbalken
  const faces = [{ ry: 0, x: 0, z: zf, br: w }, { ry: Math.PI, x: 0, z: zc - d / 2, br: w }, { ry: R90, x: w / 2, z: zc, br: d }, { ry: -R90, x: -w / 2, z: zc, br: d }];
  faces.forEach((f, i) => {
    const Po = mitT(b, { ...f, y: 3.2 }), Pu = mitT(b, { ...f, y: 0 }), Lo = mitT(l, { ...f, y: 3.2 }), Lu = mitT(l, { ...f, y: 0 }), e = f.br / 2 - 0.09;
    fachwerk(Po, f.br, hw, { schienen: [0.17, hw - 0.09], pfosten: i ? [-e, e, -1.9, 1.9] : [-e, e, 2.2],
      streben: i ? [[-e, 0.17, -1.9, hw - 0.09], [e, 0.17, 1.9, hw - 0.09]] : [] });
    if (!i) { for (const s of [-1, 1]) fen(Pu, Lu, s * 2.5, 1.7, { w: 1.0, h: 1.1 }); for (const x of [1.0, 3.4]) fen(Po, Lo, x, 1.35, { h: 1.0 }); }
    else if (i === 1) { for (const s of [-1, 1]) fen(Po, Lo, s * 1.2 * 1.5, 1.35, { h: 1.0, laeden: false }); }
    else { fen(Pu, Lu, 0, 1.7, { w: 1.0, h: 1.1, laeden: false }); fen(Po, Lo, 0, 1.35, { h: 1.0, laeden: false }); }
  });
  const Pf = mitT(b, { z: zf }), Lf = mitT(l, { z: zf });
  tuer(Pf, 1.4, 2.2);
  laterne(Pf, Lf, 1.2, 2.5, 0.0);
  // Vordach + Pfosten + Bänke
  pultdach(b, { x0: -w / 2 - 0.1, x1: w / 2 + 0.1, z0: zf, z1: 4.0, yHoch: 3.15, yTief: 2.85, farbe: dach, fall: 'z' });
  const sitz = [];
  for (const x of [-4.4, -2.2, 2.2, 4.4]) b.box(0.2, 2.8, 0.2, F.holz, { x, y: 1.4, z: 3.85, jitter: 0.08 });
  for (const s of [-1, 1]) {
    b.box(1.8, 0.1, 0.42, F.holzHell, { x: s * 3.3, y: 0.5, z: 2.85 });
    for (const dx of [-0.75, 0.75]) b.box(0.1, 0.5, 0.36, F.holzDunkel, { x: s * 3.3 + dx, y: 0.25, z: 2.85 });
    for (const dx of [-0.5, 0.5]) sitz.push({ x: s * 3.3 + dx, y: 0.55, z: 2.85, winkel: 0 });
  }
  // Erker mit Zeltdach
  b.box(2.0, 2.0, 0.7, F.putz, { x: -1.8, y: 4.5, z: zf + 0.35 }).box(2.1, 0.22, 0.85, F.holzDunkel, { x: -1.8, y: 3.5, z: zf + 0.4 });
  b.box(1.7, 1.2, 0.05, F.holzDunkel, { x: -1.8, y: 4.5, z: zf + 0.72 });
  l.box(1.5, 1.0, 0.02, F.licht, { x: -1.8, y: 4.5, z: zf + 0.75 });
  b.cone(1.5, 0.9, dach, { x: -1.8, y: 5.45, z: zf + 0.35, ry: Math.PI / 4 }, 4);
  // Dach (First entlang x), Kamin
  satteldach(mitT(b, { ry: R90, z: zc }), { w: d, d: w, y: ho, h: 2.4, farbe: dach, farbe2: dach, giebelFarbe: F.putz });
  b.box(0.9, 1.5, 0.9, F.stein, { x: 3.2, y: 7.75, z: -1.5 }).box(1.1, 0.12, 1.1, F.steinDunkel, { x: 3.2, y: 8.55, z: -1.5 });
  // Ausleger-Schild (Krug) an der rechten Wand
  const Ps = mitT(b, { x: w / 2, z: 1.6, ry: R90 });
  Ps.box(0.07, 0.07, 0.7, F.eisen, { y: 3.35, z: 0.35 }).box(0.04, 0.4, 0.04, F.eisen, { y: 3.15, z: 0.2 }).box(0.04, 0.4, 0.04, F.eisen, { y: 3.15, z: 0.6 });
  Ps.box(0.06, 0.65, 0.6, F.holz, { y: 2.65, z: 0.4 });
  Ps.cyl(0.13, 0.11, 0.3, F.gold, { x: -0.1, y: 2.65, z: 0.4 }, 6).box(0.05, 0.2, 0.08, F.gold, { x: -0.1, y: 2.65, z: 0.58 });
  const anker = { tuer: { x: 0, y: 0, z: zf, winkel: 0, breite: 1.4, hoehe: 2.2 }, sitz, fackeln: [{ x: 1.2, y: 2.6, z: zf + 0.65 }],
    licht: [{ x: -2.5, y: 1.7, z: zf + 0.4, farbe: F.licht, staerke: 0.8 }, { x: -1.8, y: 4.5, z: zf + 1.0, farbe: F.licht, staerke: 0.7 }, { x: 1.2, y: 2.5, z: zf + 0.65, farbe: F.licht, staerke: 0.9 }] };
  return asset({ name: 'taverne', variante, geometrie: b.geometry(), leucht: l.geometry(), kollision: [kasten(0, zc, w / 2, d / 2, 8.5)], anker,
    masse: { breite: 10, tiefe: 8, hoehe: 8.5 } });
}
