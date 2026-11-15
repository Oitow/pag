/**
 * @modul    haus
 * @zweck    Wohnhaus als Low-Poly-Asset: v0 Fachwerkhaus (Satteldach rot, Fensterläden), v1 Steinhaus (Schieferdach, Kamin, Vordach)
 * @api      createHaus({ seed = 1, variante = 0 }) -> asset { geometrie, leucht, kollision, anker { tuer, fackeln, licht, kamin? }, masse, dreiecke, dispose }
 * @beispiel
 *   import { createHaus } from '../../engine/models/bau/haus.js';
 *   const haus = createHaus({ seed: 3, variante: 1 });
 *   szene.add(new THREE.Mesh(haus.geometrie, standardMaterial()));
 * @tags     bau, gebaeude, haus, fachwerk, asset, lowpoly
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import { createMeshBuilder } from '../../render/mesh-builder.js';
import { rng, hashSeed, pick } from '../../core/rng.js';
import { FARBEN as F, kasten, asset } from './bau-basis.js';
import { mitT, satteldach, pultdach, fachwerk, fenster, tuer, laterne, strebe } from './bau-teile.js';

const R90 = Math.PI / 2;

export function createHaus({ seed = 1, variante = 0 } = {}) {
  const v = variante % 2, r = rng(hashSeed('haus', seed, v));
  const b = createMeshBuilder({ seed: hashSeed('haus-b', seed, v) }), l = createMeshBuilder({ seed: 1, jitter: 0 });
  const laeden = pick(r, [F.stoffGruen, F.stoffBlau, F.stoffRot]);
  const dach = pick(r, v ? [F.dachSchiefer, '#566070', '#475060'] : [F.dachRot, '#a85238', '#8c4630']);
  const w = v ? 6.0 : 5.0, d = v ? 4.8 : 4.0, wh = v ? 4.0 : 3.4, hoehe = v ? 7.5 : 6.5;
  const faces = [{ ry: 0, x: 0, z: d / 2, br: w }, { ry: Math.PI, x: 0, z: -d / 2, br: w }, { ry: R90, x: w / 2, z: 0, br: d }, { ry: -R90, x: -w / 2, z: 0, br: d }];
  const anker = { tuer: { x: 0, y: 0, z: d / 2, winkel: 0, breite: 1.1, hoehe: 2.1 }, licht: [] };
  const fen = (P, Pl, x, y, o) => fenster(P, Pl, x, y, { laedenFarbe: laeden, ...o });

  if (!v) {   // ---- v0: Fachwerkhaus ----
    b.box(w + 0.12, 1.0, d + 0.12, F.stein, { jitter: 0.1 }).box(w, wh - 0.5, d, F.putz, { y: 0.5 + (wh - 0.5) / 2 });
    faces.forEach((f, i) => {
      const P = mitT(b, { ...f, y: 0.5 }), Pl = mitT(l, { ...f, y: 0.5 }), hw = wh - 0.5, sd = i > 0;
      fachwerk(P, f.br, hw, { schienen: [0.09, 2.2, hw - 0.09], pfosten: i ? [-f.br / 2 + 0.09, f.br / 2 - 0.09, -1.15, 1.15] : [-f.br / 2 + 0.09, f.br / 2 - 0.09, -0.75, 0.75],
        streben: sd ? [[-f.br / 2 + 0.09, 0.1, -1.25, 2.2], [f.br / 2 - 0.09, 0.1, 1.25, 2.2]] : [] });
      if (!i) { for (const s of [-1, 1]) fen(P, Pl, s * 1.65, 1.4, { h: 0.9 }); } else fen(P, Pl, 0, 1.4, { h: 0.9 });
    });
    tuer(mitT(b, { z: d / 2 }));
    laterne(mitT(b, { z: d / 2 }), mitT(l, { z: d / 2 }), 0.95, 2.4, 0.05, 0);
    anker.fackeln = [{ x: 0.95, y: 2.5, z: d / 2 + 0.55 }];
    satteldach(b, { w, d, y: wh, h: 2.55, farbe: dach, farbe2: dach, giebelFarbe: F.putz });
    for (const k of [-1, 1]) strebe(mitT(b, { z: d / 2 }), 0, wh + 0.1, k * 1.3, wh + 1.2, 0.1);   // Giebel-Fachwerk
    b.box(0.7, 2.4, 0.7, F.stein, { x: 1.55, y: 5.3, z: -0.8 }).box(0.9, 0.12, 0.9, F.steinDunkel, { x: 1.55, y: 6.5, z: -0.8 });
    anker.licht.push({ x: -1.65, y: 1.9, z: d / 2 + 0.3, farbe: F.licht, staerke: 0.7 });
  } else {    // ---- v1: Steinhaus ----
    b.box(w, wh + 0.5, d, F.stein, { y: (wh - 0.5) / 2, jitter: 0.09 });
    for (const y of [1.3, 2.5, 3.7]) b.box(w + 0.05, 0.1, d + 0.05, F.steinDunkel, { y, jitter: 0.04 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let k = 0; k < 3; k++)
      b.box(0.5, 0.45, 0.5, F.steinHell, { x: sx * (w / 2 - 0.2), z: sz * (d / 2 - 0.2), y: 0.2 + k * 1.3 + (k % 2) * 0.01, jitter: 0.06 });
    faces.forEach((f, i) => {
      const P = mitT(b, { ...f, y: 0 }), Pl = mitT(l, { ...f, y: 0 });
      if (!i) for (const s of [-1, 1]) fen(P, Pl, s * 2.0, 2.2, { h: 1.1 });
      else if (i === 1) fen(P, Pl, 0, 2.2, { h: 1.1 });
      else fen(P, Pl, 0, 2.2, { h: 1.1 });
    });
    const Pf = mitT(b, { z: d / 2 });
    tuer(Pf, 1.1, 2.1);
    pultdach(b, { x0: -1.2, x1: 1.2, z0: d / 2, z1: d / 2 + 0.65, yHoch: 3.0, yTief: 2.7, farbe: dach, fall: 'z' });
    for (const s of [-1, 1]) b.box(0.14, 2.65, 0.14, F.holz, { x: s * 1.1, y: 1.3, z: d / 2 + 0.58 });
    laterne(Pf, mitT(l, { z: d / 2 }), -1.7, 2.7, 0.05, 0);
    anker.fackeln = [{ x: -1.7, y: 2.8, z: d / 2 + 0.65 }];
    satteldach(b, { w, d, y: wh, h: 2.6, farbe: dach, farbe2: '#3f4856', giebelFarbe: F.steinHell });
    fen(Pf, mitT(l, { z: d / 2 }), 0, wh + 0.9, { w: 0.6, h: 0.7, laeden: false });
    b.box(0.9, 1.7, 0.9, F.steinDunkel, { x: 0, y: 6.55, z: -0.9 }).box(1.1, 0.12, 1.1, F.eisen, { x: 0, y: 7.45, z: -0.9 });
    anker.kamin = { x: 0, y: 7.5, z: -0.9 };
    anker.licht.push({ x: -2.0, y: 2.3, z: d / 2 + 0.3, farbe: F.licht, staerke: 0.8 });
  }
  const kol = [kasten(0, 0, w / 2, d / 2, hoehe)];
  return asset({ name: 'haus', variante: v, geometrie: b.geometry(), leucht: l.geometry(), kollision: kol, anker,
    masse: { breite: v ? 7 : 6, tiefe: v ? 6 : 5, hoehe } });
}
