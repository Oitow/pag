/**
 * @modul    irrlicht
 * @zweck    Low-Poly-Irrlicht (Moorgeist): hell leuchtender Kern, Halo und wehende Schleier; zwei Schwebe-Bild-Geometrien (Vertexfarben)
 * @api      createIrrlicht({ seed, kern, halo, schleier, laenge }) -> { frames:[geoBild0, geoBild1], laenge, hoehe, breite, dispose() }
 * @beispiel
 *   import { createIrrlicht } from '../../engine/models/kreaturen/irrlicht.js';
 *   const ir = createIrrlicht({ seed: 3 });
 *   const hm = createHordeMesh({ modelle: { irrlicht: ir.frames }, max: 30 });
 *   // Ursprung = Schleierspitze auf y = 0 (die Horde hebt das Wesen per def.schwebe an); ≈ 1 m hoch, Gesicht nach +Z
 * @tags     irrlicht, moor, geist, kreatur, gegner, horde, lowpoly, leuchten, modell
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
import { createMeshBuilder } from '../../render/mesh-builder.js';

const BASIS_LAENGE = 0.8;

function bauBild(ph, seed, f) {
  const b = createMeshBuilder({ seed, jitter: 0.03 });
  const g = ph ? -1 : 1, bob = ph ? 0.04 : 0;
  // Kern + Halo (sehr hell: überstrahlt durch den Farbfaktor der Horde)
  b.sphere(0.24, f.halo, { y: 0.72 + bob, sy: 1.1 }, 7, 5, { jitter: 0 });
  b.sphere(0.15, f.kern, { y: 0.72 + bob }, 7, 5, { jitter: 0 });
  // Gesicht: zwei dunkle Augen
  for (const s of [-1, 1]) b.sphere(0.028, f.augen, { x: s * 0.075, y: 0.76 + bob, z: 0.2, sy: 1.4 }, 4, 3, { jitter: 0 });
  // Schleier: nach unten auslaufende Zipfel (Spitze unten), wehen gegengleich
  const zipfel = [[0, 0, 0.2, 0.62], [-1, 0.06, 0.15, 0.55], [1, -0.05, 0.16, 0.5], [0, -0.14, 0.14, 0.42], [-1, -0.1, 0.12, 0.38]];
  zipfel.forEach(([sx, z, r, l], i) => {
    const sw = g * (i % 2 ? 1 : -1) * 0.18;
    b.cone(r, l, i ? f.schleier : f.halo, { x: sx * 0.09 + sw * 0.15, y: l / 2 + 0.05 + bob * 0.5, z, rx: Math.PI + sw * 0.3, rz: sw * 0.4 }, 5);
  });
  // Seitliche Schwaden (Arme)
  for (const s of [-1, 1]) b.cone(0.07, 0.34, f.schleier, { x: s * 0.27, y: 0.62 + bob, z: -0.02, rz: s * (1.15 + g * 0.15) }, 4);
  return b.geometry();
}

/** Fabrik: zwei Bilder eines Irrlichts. */
export function createIrrlicht({ seed = 1, kern = '#ffffff', halo = '#d6fff0', schleier = '#7fd6c0', laenge = 0.8 } = {}) {
  const f = { kern, halo, schleier, augen: '#0b2a30' };
  const k = laenge / BASIS_LAENGE;
  const frames = [0, 1].map((ph) => {
    const geo = bauBild(ph, seed, f);
    geo.scale(k, k, k); geo.computeBoundingBox(); geo.computeBoundingSphere();
    return geo;
  });
  return { frames, laenge, hoehe: 1.0 * k, breite: 0.6 * k, dispose() { for (const g of frames) g.dispose(); } };
}
