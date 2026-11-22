/**
 * @modul    wolf
 * @zweck    Low-Poly-Wolf als Horden-Gegner (und Boss-Wolf per Skala): zwei Lauf-Bild-Geometrien (Vertexfarben) für InstancedMesh
 * @api      createWolf({ seed, fell, bauch, dunkel, augen, laenge }) -> { frames:[geoBild0, geoBild1], laenge, hoehe, breite, dispose() }
 * @beispiel
 *   import { createWolf } from '../../engine/models/kreaturen/wolf.js';
 *   const wolf = createWolf({ seed: 1 });
 *   const hm = createHordeMesh({ modelle: { wolf: wolf.frames }, max: 60 });
 *   // Nase nach +Z, Pfoten auf y = 0, Ursprung unter der Rumpfmitte, Rute nach −Z; ≈ 1.3 m lang, 0.8 m Schulterhöhe
 * @tags     wolf, kreatur, gegner, horde, boss, lowpoly, instancing, modell
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
import { createMeshBuilder } from '../../render/mesh-builder.js';
import { rng } from '../../core/rng.js';

const BASIS_LAENGE = 1.3;
const _d = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);

/** Stab von a (Radius r1) nach c (Radius r2). */
function stab(b, a, c, r1, r2, seg, farbe) {
  _d.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
  const len = _d.length();
  const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(_y, _d.normalize()), 'XYZ');
  b.cyl(r2, r1, len, farbe, { x: (a[0] + c[0]) / 2, y: (a[1] + c[1]) / 2, z: (a[2] + c[2]) / 2, rx: e.x, ry: e.y, rz: e.z }, seg);
}

function bauBild(ph, seed, f) {
  const b = createMeshBuilder({ seed, jitter: 0.04 });
  const g = ph ? -1 : 1, hub = ph ? 0.025 : 0, lz = ph ? 0.96 : 1.03;
  // Rumpf: kräftige Brust, schmale Flanke, Mähne, dunkler Rückenstreif
  b.sphere(0.2, f.fell, { y: 0.58 + hub, z: -0.2 * lz, sz: 1.7 * lz }, 6, 4);
  b.sphere(0.23, f.fell, { y: 0.62 + hub, z: 0.12 * lz, sz: 1.3 * lz, sy: 1.08 }, 6, 4);
  b.sphere(0.19, f.bauch, { y: 0.47 + hub, z: -0.04, sz: 2.4 * lz, sy: 0.55 }, 6, 3);
  b.sphere(0.18, f.dunkel, { y: 0.72 + hub, z: 0.2, sz: 1.35, sy: 0.85 }, 5, 3);
  b.sphere(0.12, f.dunkel, { y: 0.72 + hub, z: -0.15 * lz, sz: 2.8, sy: 0.45 }, 5, 2);
  // Hals + Kopf: lange Schnauze, Ohren, gelbe Augen, Fang
  const hy = 0.68 + hub * 0.5, hz = 0.42 * lz;
  stab(b, [0, 0.64 + hub, 0.26], [0, hy + 0.04, hz - 0.04], 0.16, 0.12, 5, f.fell);
  b.sphere(0.125, f.fell, { y: hy, z: hz, sz: 1.1 }, 6, 4);
  b.cone(0.08, 0.27, f.hell, { y: hy - 0.04, z: hz + 0.25, rx: Math.PI / 2 }, 5);
  b.sphere(0.03, '#141210', { y: hy - 0.015, z: hz + 0.39 }, 4, 2, { jitter: 0 });
  for (const s of [-1, 1]) {
    b.cone(0.045, 0.14, f.dunkel, { x: s * 0.075, y: hy + 0.13, z: hz - 0.04, rz: -s * 0.15 }, 4);
    b.sphere(0.017, f.augen, { x: s * 0.075, y: hy + 0.03, z: hz + 0.1 }, 4, 2, { jitter: 0 });
    b.cone(0.012, 0.045, '#efe8d8', { x: s * 0.035, y: hy - 0.1, z: hz + 0.26, rx: Math.PI }, 3);
  }
  // Beine: diagonale Paare schwingen gegengleich
  for (const [sx, vh, p] of [[-1, 1, 1], [1, 1, -1], [-1, -1, -1], [1, -1, 1]]) {
    const z0 = (vh > 0 ? 0.15 : -0.34) * lz, dz = 0.1 * g * p, x = sx * 0.12;
    stab(b, [x, 0.04, z0 + dz], [x, 0.56 + hub, z0], 0.04, 0.065, 4, vh > 0 ? f.fell : f.dunkel);
    b.sphere(0.05, f.dunkel, { x, y: 0.03, z: z0 + dz + 0.03, sy: 0.55, sz: 1.3 }, 4, 2);
  }
  // Rute: buschig, schwingt seitlich
  const t = [[0, 0.62 + hub, -0.5 * lz], [g * 0.03, 0.5, -0.62], [g * 0.08, 0.34, -0.7]];
  stab(b, t[0], t[1], 0.07, 0.085, 4, f.fell);
  stab(b, t[1], t[2], 0.085, 0.05, 4, f.dunkel);
  return b.geometry();
}

/** Fabrik: zwei Lauf-Bilder eines Wolfs. */
export function createWolf({ seed = 1, fell = '#6b6a68', bauch = '#a6a29a', dunkel = '#3d3c3b', augen = '#f0c030', laenge = 1.3 } = {}) {
  const r = rng(seed), hell = 0.9 + r() * 0.2;
  const tint = (c, k) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();
  const f = { fell: tint(fell, hell), bauch: tint(bauch, hell), dunkel: tint(dunkel, hell), hell: tint('#9a958c', hell), augen };
  const k = laenge / BASIS_LAENGE;
  const frames = [0, 1].map((ph) => {
    const geo = bauBild(ph, seed, f);
    geo.scale(k, k, k); geo.computeBoundingBox(); geo.computeBoundingSphere();
    return geo;
  });
  return { frames, laenge, hoehe: 0.85 * k, breite: 0.5 * k, dispose() { for (const g of frames) g.dispose(); } };
}
