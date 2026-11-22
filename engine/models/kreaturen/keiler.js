/**
 * @modul    keiler
 * @zweck    Low-Poly-Keiler (Wildschwein) als Horden-Gegner: massig, Borstenkamm, Hauer; zwei Lauf-Bild-Geometrien (Vertexfarben)
 * @api      createKeiler({ seed, fell, borsten, haut, hauer, augen, laenge }) -> { frames:[geoBild0, geoBild1], laenge, hoehe, breite, dispose() }
 * @beispiel
 *   import { createKeiler } from '../../engine/models/kreaturen/keiler.js';
 *   const keiler = createKeiler({ seed: 2 });
 *   const hm = createHordeMesh({ modelle: { keiler: keiler.frames }, max: 40 });
 *   // Rüssel nach +Z, Hufe auf y = 0; ≈ 1.4 m lang, 0.95 m hoch
 * @tags     keiler, wildschwein, kreatur, gegner, horde, lowpoly, instancing, modell
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
import { createMeshBuilder } from '../../render/mesh-builder.js';
import { rng } from '../../core/rng.js';

const BASIS_LAENGE = 1.4;
const _d = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);

function stab(b, a, c, r1, r2, seg, farbe) {
  _d.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
  const len = _d.length();
  const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(_y, _d.normalize()), 'XYZ');
  b.cyl(r2, r1, len, farbe, { x: (a[0] + c[0]) / 2, y: (a[1] + c[1]) / 2, z: (a[2] + c[2]) / 2, rx: e.x, ry: e.y, rz: e.z }, seg);
}

function bauBild(ph, seed, f) {
  const b = createMeshBuilder({ seed, jitter: 0.045 });
  const g = ph ? -1 : 1, hub = ph ? 0.03 : 0, lz = ph ? 0.96 : 1.03;
  // Rumpf: schwere Vorderhand, Schulterbuckel, Borstenkamm
  b.sphere(0.34, f.fell, { y: 0.62 + hub, z: 0.18 * lz, sz: 1.2 * lz, sy: 1.05 }, 7, 4);
  b.sphere(0.29, f.fell, { y: 0.58 + hub, z: -0.3 * lz, sz: 1.3 * lz }, 7, 4);
  b.sphere(0.27, f.bauch, { y: 0.44 + hub, z: -0.05, sz: 2.3 * lz, sy: 0.55 }, 6, 3);
  b.sphere(0.24, f.borsten, { y: 0.88 + hub, z: 0.15, sz: 1.9, sy: 0.55 }, 5, 3);
  for (let i = 0; i < 6; i++) b.cone(0.045, 0.16, f.borsten, { y: 0.96 + hub - i * 0.015, z: 0.38 - i * 0.14, rx: -0.2 }, 4);
  // Kopf: Keilform, Rüssel, Hauer, Ohren, kleine rote Augen
  const hy = 0.52 + hub * 0.5, hz = 0.62 * lz;
  b.sphere(0.22, f.fell, { y: hy + 0.03, z: hz, sz: 1.15, sy: 0.95 }, 6, 4);
  b.cyl(0.075, 0.13, 0.28, f.haut, { y: hy - 0.07, z: hz + 0.27, rx: Math.PI / 2 }, 5);
  b.sphere(0.07, '#6e4a46', { y: hy - 0.07, z: hz + 0.42, sz: 0.6 }, 4, 3, { jitter: 0 });
  for (const s of [-1, 1]) {
    b.cone(0.03, 0.2, f.hauer, { x: s * 0.1, y: hy - 0.06, z: hz + 0.36, rx: 1.05, rz: s * -0.3 }, 4);   // Hauer: vor + hoch + auswärts
    b.cone(0.07, 0.16, f.borsten, { x: s * 0.14, y: hy + 0.22, z: hz - 0.08, rz: -s * 0.5, rx: -0.3 }, 4);
    b.sphere(0.018, f.augen, { x: s * 0.11, y: hy + 0.1, z: hz + 0.13 }, 4, 2, { jitter: 0 });
  }
  // Beine: kurz + dick, Hufe dunkel
  for (const [sx, vh, p] of [[-1, 1, 1], [1, 1, -1], [-1, -1, -1], [1, -1, 1]]) {
    const z0 = (vh > 0 ? 0.28 : -0.42) * lz, dz = 0.07 * g * p, x = sx * 0.17;
    stab(b, [x, 0.04, z0 + dz], [x, 0.46 + hub, z0], 0.05, 0.085, 4, f.fell);
    b.cyl(0.055, 0.06, 0.07, f.borsten, { x, y: 0.035, z: z0 + dz }, 4);
  }
  // Ringelschwänzchen
  stab(b, [0, 0.7 + hub, -0.58 * lz], [g * 0.04, 0.78, -0.7], 0.028, 0.018, 3, f.borsten);
  return b.geometry();
}

/** Fabrik: zwei Lauf-Bilder eines Keilers. */
export function createKeiler({ seed = 1, fell = '#4f4036', borsten = '#2a221c', haut = '#7a5a50', hauer = '#eee6cf', augen = '#ff3b2a', laenge = 1.4 } = {}) {
  const r = rng(seed), hell = 0.9 + r() * 0.2;
  const tint = (c, k) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();
  const f = { fell: tint(fell, hell), bauch: tint('#8a7560', hell), borsten: tint(borsten, hell), haut, hauer, augen };
  const k = laenge / BASIS_LAENGE;
  const frames = [0, 1].map((ph) => {
    const geo = bauBild(ph, seed, f);
    geo.scale(k, k, k); geo.computeBoundingBox(); geo.computeBoundingSphere();
    return geo;
  });
  return { frames, laenge, hoehe: 0.95 * k, breite: 0.7 * k, dispose() { for (const g of frames) g.dispose(); } };
}
