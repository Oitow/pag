/**
 * @modul    hase
 * @zweck    Low-Poly-Feldhase (kleines Wild): runder Rumpf, kräftige Hinterläufe, lange Ohren mit schwarzen Spitzen, weiße Blume; zwei Sprung-Bild-Geometrien (Vertexfarben) für InstancedMesh
 * @api      createHase({ seed, fell, bauch, dunkel, laenge }) -> { frames:[geoBild0, geoBild1], laenge, hoehe, breite, dispose() }
 * @beispiel
 *   import { createHase } from '../../engine/models/kreaturen/hase.js';
 *   const hase = createHase({ seed: 2 });
 *   const hm = createHordeMesh({ modelle: { hase: hase.frames }, max: 40 });
 *   // Nase nach +Z, Pfoten auf y = 0; ≈ 0.6 m lang, Ohrspitzen ≈ 0.5 m; Bild 0 = geduckt, Bild 1 = gestreckt im Sprung
 * @tags     hase, wild, kreatur, jagd, tier, klein, lowpoly, instancing, modell
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
import { createMeshBuilder } from '../../render/mesh-builder.js';
import { rng } from '../../core/rng.js';

const BASIS_LAENGE = 0.6;
const _d = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);

/** Stab von a (Radius r1) nach c (Radius r2). */
function stab(b, a, c, r1, r2, seg, farbe) {
  _d.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
  const len = _d.length();
  const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(_y, _d.normalize()), 'XYZ');
  b.cyl(r2, r1, len, farbe, { x: (a[0] + c[0]) / 2, y: (a[1] + c[1]) / 2, z: (a[2] + c[2]) / 2, rx: e.x, ry: e.y, rz: e.z }, seg);
}

function bauBild(ph, seed, f) {
  const b = createMeshBuilder({ seed, jitter: 0.05 });
  // Bild 0: geduckt (sitzend/abspringend), Bild 1: gestreckt (Vorderläufe vor, Hinterläufe weit hinten)
  const st = ph ? 1 : 0, lz = ph ? 1.12 : 0.94, hub = ph ? 0.05 : 0;
  // Rumpf: hinten massig, vorn schmaler; heller Bauch
  b.sphere(0.12, f.fell, { y: 0.2 + hub, z: -0.08 * lz, sz: 1.15 * lz, sy: 1.0 - st * 0.12, sx: 0.95 }, 6, 4);
  b.sphere(0.095, f.fell, { y: 0.22 + hub + 0.02 * (1 - st), z: 0.06 * lz, sz: 1.2 * lz, sx: 0.9 }, 6, 4);
  b.sphere(0.08, f.bauch, { y: 0.14 + hub, z: 0, sz: 2.1 * lz, sy: 0.6, sx: 0.95 }, 5, 3);
  b.sphere(0.04, f.blume, { y: 0.25 + hub, z: -0.21 * lz, sz: 0.8 }, 4, 3);   // weiße Blume (Schwanz)
  // Kopf mit langen Ohren (schräg nach hinten, schwarze Spitzen)
  const hy = 0.29 + hub * 0.6 + 0.02 * (1 - st), hz = 0.17 * lz;
  b.sphere(0.06, f.fell, { y: hy, z: hz, sz: 1.35, sx: 0.85 }, 6, 4);
  b.sphere(0.022, f.dunkel, { y: hy - 0.02, z: hz + 0.075 }, 4, 2, { jitter: 0 });
  for (const s of [-1, 1]) {
    const a = [s * 0.025, hy + 0.04, hz - 0.02], m = [s * 0.045, hy + 0.16, hz - 0.08 - st * 0.03], e = [s * 0.05, hy + 0.21, hz - 0.11 - st * 0.05];
    stab(b, a, m, 0.022, 0.025, 4, f.fell);
    stab(b, m, e, 0.025, 0.008, 4, f.dunkel);
    b.sphere(0.012, '#16110c', { x: s * 0.038, y: hy + 0.015, z: hz + 0.035 }, 4, 2, { jitter: 0 });
  }
  // Vorderläufe: dünn; im Sprung weit nach vorn
  for (const s of [-1, 1]) {
    const z0 = 0.1 * lz, zf = z0 + (st ? 0.12 : 0.02) + s * 0.015;
    stab(b, [s * 0.045, 0.18 + hub, z0], [s * 0.045, 0.015, zf], 0.018, 0.014, 4, f.fell);
  }
  // Hinterläufe: kräftige Keule + lange Pfote am Boden (gestreckt: nach hinten)
  for (const s of [-1, 1]) {
    const x = s * 0.07;
    b.sphere(0.07, f.fell, { x, y: 0.15 + hub, z: -0.11 * lz, sz: 1.3, sx: 0.6 }, 5, 3);
    const fz = st ? -0.3 : -0.06;
    stab(b, [x, 0.12 + hub, -0.14 * lz], [x, 0.03, fz], 0.03, 0.02, 4, f.fell);
    b.sphere(0.022, f.dunkel, { x, y: 0.02, z: fz + (st ? -0.03 : 0.05), sz: 3, sy: 0.8 }, 4, 2);
  }
  return b.geometry();
}

/** Fabrik: zwei Sprung-Bilder eines Hasen. */
export function createHase({ seed = 1, fell = '#8a7356', bauch = '#d4c6ad', dunkel = '#2e2620', laenge = 0.6 } = {}) {
  const r = rng(seed), hell = 0.86 + r() * 0.28;
  const tint = (c, k) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();
  const f = { fell: tint(fell, hell), bauch: tint(bauch, hell), dunkel: tint(dunkel, hell), blume: '#eeeae2' };
  const k = laenge / BASIS_LAENGE;
  const frames = [0, 1].map((ph) => {
    const geo = bauBild(ph, seed, f);
    geo.scale(k, k, k); geo.computeBoundingBox(); geo.computeBoundingSphere();
    return geo;
  });
  return { frames, laenge, hoehe: 0.52 * k, breite: 0.2 * k, dispose() { for (const g of frames) g.dispose(); } };
}
