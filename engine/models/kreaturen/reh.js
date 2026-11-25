/**
 * @modul    reh
 * @zweck    Low-Poly-Reh (Wild, scheu): schlanker Rumpf, langer Hals, große Ohren, weißer Spiegel, Bock mit kleinem Gehörn; zwei Lauf-Bild-Geometrien (Vertexfarben) für InstancedMesh
 * @api      createReh({ seed, fell, bauch, dunkel, spiegel, bock, laenge }) -> { frames:[geoBild0, geoBild1], laenge, hoehe, breite, dispose() }
 * @beispiel
 *   import { createReh } from '../../engine/models/kreaturen/reh.js';
 *   const reh = createReh({ seed: 4 });
 *   const hm = createHordeMesh({ modelle: { reh: reh.frames }, max: 30 });
 *   // Nase nach +Z, Hufe auf y = 0, Ursprung unter der Rumpfmitte; ≈ 1.15 m lang, 0.75 m Schulterhöhe, Kopf ≈ 1.05 m
 * @tags     reh, wild, kreatur, jagd, tier, lowpoly, instancing, modell
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
import { createMeshBuilder } from '../../render/mesh-builder.js';
import { rng } from '../../core/rng.js';

const BASIS_LAENGE = 1.15;
const _d = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);

/** Stab von a (Radius r1) nach c (Radius r2). */
function stab(b, a, c, r1, r2, seg, farbe) {
  _d.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
  const len = _d.length();
  const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(_y, _d.normalize()), 'XYZ');
  b.cyl(r2, r1, len, farbe, { x: (a[0] + c[0]) / 2, y: (a[1] + c[1]) / 2, z: (a[2] + c[2]) / 2, rx: e.x, ry: e.y, rz: e.z }, seg);
}

function bauBild(ph, seed, f, bock) {
  const b = createMeshBuilder({ seed, jitter: 0.04 });
  const g = ph ? -1 : 1, hub = ph ? 0.03 : 0, lz = ph ? 0.95 : 1.04;
  // Rumpf: schmal, hinten etwas höher (Reh „überbaut“), heller Bauch, weißer Spiegel am Hinterteil
  b.sphere(0.17, f.fell, { y: 0.72 + hub, z: 0.12 * lz, sz: 1.35 * lz, sy: 1.05 }, 6, 4);
  b.sphere(0.17, f.fell, { y: 0.74 + hub, z: -0.17 * lz, sz: 1.45 * lz, sy: 1.02 }, 6, 4);
  b.sphere(0.14, f.bauch, { y: 0.62 + hub, z: -0.02, sz: 2.3 * lz, sy: 0.55, sx: 1.05 }, 6, 3);
  b.sphere(0.1, f.spiegel, { y: 0.68 + hub, z: -0.37 * lz, sz: 0.5, sx: 1.15, sy: 1.2 }, 5, 3);
  b.sphere(0.03, f.fell, { y: 0.8 + hub, z: -0.42 * lz }, 4, 2);   // Wedel (fast kein Schwanz)
  // Hals lang und schräg, Kopf keilförmig mit großen Ohren
  const hy = 1.03 + hub * 0.5, hz = 0.4 * lz;
  stab(b, [0, 0.76 + hub, 0.24 * lz], [0, hy - 0.04, hz - 0.03], 0.085, 0.055, 5, f.fell);
  b.sphere(0.07, f.fell, { y: hy, z: hz, sz: 1.2, sx: 0.9 }, 6, 4);
  b.cone(0.05, 0.17, f.fell, { y: hy - 0.035, z: hz + 0.12, rx: Math.PI / 2 + 0.35 }, 5);
  b.sphere(0.028, f.dunkel, { y: hy - 0.07, z: hz + 0.19, sz: 0.8 }, 4, 2, { jitter: 0 });   // schwarzer Muffel
  b.sphere(0.03, f.spiegel, { y: hy - 0.085, z: hz + 0.15, sy: 0.6 }, 4, 2, { jitter: 0 });  // helles Kinn
  for (const s of [-1, 1]) {
    b.cone(0.04, 0.13, f.fell, { x: s * 0.065, y: hy + 0.08, z: hz - 0.04, rz: -s * 0.75, sz: 0.5 }, 4);
    b.sphere(0.016, '#14110e', { x: s * 0.05, y: hy + 0.015, z: hz + 0.05 }, 4, 2, { jitter: 0 });
    if (bock) {   // kleines Gehörn: zwei Stangen mit je einer Sprosse
      stab(b, [s * 0.025, hy + 0.05, hz], [s * 0.045, hy + 0.21, hz - 0.02], 0.014, 0.008, 3, f.horn);
      stab(b, [s * 0.04, hy + 0.14, hz - 0.01], [s * 0.04, hy + 0.17, hz + 0.05], 0.009, 0.005, 3, f.horn);
    }
  }
  // Beine: dünn und lang; Hinterlauf mit Sprunggelenk. Diagonale Paare schwingen gegengleich.
  for (const [sx, vh, p] of [[-1, 1, 1], [1, 1, -1], [-1, -1, -1], [1, -1, 1]]) {
    const x = sx * 0.085, dz = 0.12 * g * p;
    if (vh > 0) {
      const z0 = 0.2 * lz;
      stab(b, [x, 0.72 + hub, z0], [x, 0.36, z0 + dz * 0.5], 0.045, 0.03, 4, f.fell);
      stab(b, [x, 0.36, z0 + dz * 0.5], [x, 0.03, z0 + dz], 0.025, 0.02, 4, f.dunkel);
    } else {
      const z0 = -0.26 * lz;
      stab(b, [x, 0.74 + hub, z0], [x, 0.36, z0 - 0.1 + dz * 0.5], 0.06, 0.035, 4, f.fell);
      stab(b, [x, 0.36, z0 - 0.1 + dz * 0.5], [x, 0.03, z0 + dz], 0.025, 0.02, 4, f.dunkel);
    }
    b.cone(0.026, 0.05, '#1c1714', { x, y: 0.025, z: (vh > 0 ? 0.2 : -0.26) * lz + dz + 0.01, rx: Math.PI }, 4);
  }
  return b.geometry();
}

/** Fabrik: zwei Lauf-Bilder eines Rehs. bock = null → per Seed (etwa jedes dritte Reh trägt Gehörn). */
export function createReh({ seed = 1, fell = '#8a5a38', bauch = '#c2ab8c', dunkel = '#4a3627', spiegel = '#e9e2d4', bock = null, laenge = 1.15 } = {}) {
  const r = rng(seed), hell = 0.88 + r() * 0.24;
  const istBock = bock ?? r() < 0.34;
  const tint = (c, k) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();
  const f = { fell: tint(fell, hell), bauch: tint(bauch, hell), dunkel: tint(dunkel, hell), spiegel, horn: '#cdbd9c' };
  const k = laenge / BASIS_LAENGE;
  const frames = [0, 1].map((ph) => {
    const geo = bauBild(ph, seed, f, istBock);
    geo.scale(k, k, k); geo.computeBoundingBox(); geo.computeBoundingSphere();
    return geo;
  });
  return { frames, laenge, hoehe: 1.1 * k, breite: 0.3 * k, bock: istBock, dispose() { for (const g of frames) g.dispose(); } };
}
