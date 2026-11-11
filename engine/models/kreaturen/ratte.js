/**
 * @modul    ratte
 * @zweck    Low-Poly-Riesenratte als Horden-Gegner: liefert zwei Lauf-Bild-Geometrien (Vertexfarben) für InstancedMesh
 * @api      createRatte({ seed, fell, bauch, haut, augen, laenge }) -> { frames:[geoBild0, geoBild1], laenge, hoehe, breite, dispose() }
 * @beispiel
 *   import { createRatte } from '../../engine/models/kreaturen/ratte.js';
 *   import { standardMaterial } from '../../engine/render/mesh-builder.js';
 *   const ratte = createRatte({ seed: 1 });
 *   const bilder = ratte.frames.map((g) => new THREE.InstancedMesh(g, standardMaterial(), 120));
 *   // Nase zeigt nach +Z, Füße auf y = 0, Ursprung unter der Rumpfmitte, Schwanz nach −Z
 * @tags     ratte, kreatur, gegner, horde, lowpoly, instancing, modell
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
import { createMeshBuilder } from '../../render/mesh-builder.js';
import { rng } from '../../core/rng.js';

const BASIS_LAENGE = 0.5;   // Modell ist in Metern für 0.5 m Länge gebaut, dann skaliert
const _z = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);

/** Zylinder-Stab von Punkt a (unten, Radius r1) nach c (oben, Radius r2). */
function stab(b, a, c, r1, r2, seg, farbe) {
  const d = _z.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
  const len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(_y, d.normalize());
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  b.cyl(r2, r1, len, farbe, {
    x: (a[0] + c[0]) / 2, y: (a[1] + c[1]) / 2, z: (a[2] + c[2]) / 2, rx: e.x, ry: e.y, rz: e.z,
  }, seg);
}

/** Ein Lauf-Bild bauen. ph = 0 | 1. */
function bauBild(ph, seed, f) {
  const b = createMeshBuilder({ seed, jitter: 0.05 });
  const g = ph ? -1 : 1;                 // Gangrichtung der Beinpaare / Schwanzschlag
  const lz = ph ? 0.94 : 1.04;           // Rumpf gestaucht bzw. gestreckt
  const hub = ph ? 0.02 : 0;             // gestaucht = höher (Hoppeln)

  // Rumpf: hinten höher/dicker (Buckel), vorn schlanker
  b.sphere(0.12, f.fell, { y: 0.17 + hub, z: -0.08 * lz, sz: 1.25 * lz, sy: 1.05 }, 5, 3);
  b.sphere(0.095, f.fell, { y: 0.15 + hub * 0.5, z: 0.07 * lz, sz: 1.3 * lz }, 6, 3);
  b.sphere(0.1, f.bauch, { y: 0.1 + hub, z: -0.01 * lz, sz: 2.0 * lz, sy: 0.7 }, 6, 2);

  // Kopf: spitze Schnauze, rosa Nase, Ohren, Augen, Nagezähne
  const hy = 0.15 + hub * 0.5, hz = 0.105 * lz;
  b.sphere(0.07, f.fell, { y: hy, z: hz }, 5, 3);
  b.cone(0.055, 0.12, f.fell, { y: hy - 0.01, z: hz + 0.09, rx: Math.PI / 2 }, 5);
  b.sphere(0.022, f.haut, { y: hy - 0.01, z: hz + 0.155 }, 4, 2);
  for (const s of [-1, 1]) {
    b.sphere(0.05, f.haut, { x: s * 0.055, y: hy + 0.07, z: hz - 0.03, sz: 0.4 }, 5, 2);
    b.sphere(0.016, f.augen, { x: s * 0.05, y: hy + 0.025, z: hz + 0.045 }, 4, 2, { jitter: 0 });
    b.cone(0.008, 0.03, '#f4f0e0', { x: s * 0.01, y: hy - 0.04, z: hz + 0.14, rx: Math.PI }, 3);
  }

  // Beine: diagonale Paare schwingen gegengleich (vl + hr vorn in Bild 0)
  const beine = [[-1, 1, 1], [1, 1, -1], [-1, -1, -1], [1, -1, 1]];   // [x-Seite, vorn(1)/hinten(-1), Phase]
  for (const [sx, vh, p] of beine) {
    const hzB = (vh > 0 ? 0.08 : -0.1) * lz, dz = 0.045 * g * p;
    stab(b, [sx * 0.085, 0.02, hzB + dz], [sx * 0.085, 0.13 + hub, hzB], 0.022, 0.03, 3, f.fell);
    b.sphere(0.035, f.haut, { x: sx * 0.085, y: 0.02, z: hzB + dz + 0.015, sy: 0.55 }, 4, 2);
  }

  // Schwanz: 3 Segmente mit Bogen, schwingt links/rechts
  const sw = g;
  const t = [[0, 0.17 + hub, -0.2 * lz], [sw * 0.025, 0.12, -0.3], [sw * 0.07, 0.07, -0.4], [sw * 0.13, 0.1, -0.5]];
  for (let i = 0; i < 3; i++) stab(b, t[i], t[i + 1], 0.02 - i * 0.004, 0.016 - i * 0.004 + (i === 0 ? 0 : 0), 3, f.haut);

  const geo = b.geometry();
  return geo;
}

/** Fabrik: zwei Lauf-Bilder einer Riesenratte. */
export function createRatte({ seed = 1, fell = '#6e5c4d', bauch = '#a8998a', haut = '#d9a3a0', augen = '#ff3b2a', laenge = 0.5 } = {}) {
  const r = rng(seed);
  const hell = 0.9 + r() * 0.2;          // leichte Fellvariation pro Tier
  const tint = (c, k) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();
  const f = { fell: tint(fell, hell), bauch: tint(bauch, hell), haut, augen };
  const k = laenge / BASIS_LAENGE;
  const frames = [0, 1].map((ph) => {
    const geo = bauBild(ph, seed, f);
    geo.scale(k, k, k);
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    return geo;
  });
  return {
    frames,
    laenge,
    hoehe: 0.3 * k,
    breite: 0.26 * k,
    dispose() { for (const g of frames) g.dispose(); },
  };
}
