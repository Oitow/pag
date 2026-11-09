/**
 * @modul    character-parts-hut
 * @zweck    Bau-Funktion für Kopfbedeckungen im Knochen kopf (eigenes Mesh): Kapuze, Hüte, Helme, Kronen, Tücher, Turban
 * @api      baueKopfbedeckung(b,ctx) -> b ; deckendeKopfbedeckung(stil) -> bool
 * @beispiel
 *   import { baueKopfbedeckung } from '../../engine/models/character/character-parts-hut.js';
 *   rig.knochen.kopf.add(baueKopfbedeckung(createMeshBuilder({ seed }), ctx).mesh());
 * @tags     figur, charakter, kopf, hut, helm, krone, kapuze, zauberhut, dreispitz, turban
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import { dunkler, heller, schale } from './character-parts-basis.js';

const PI = Math.PI;

/** Verdeckt die Kopfbedeckung den Oberkopf (dann keine hohen Frisur-Teile)? */
export function deckendeKopfbedeckung(stil) { return !['keine', 'krone', 'reif'].includes(stil); }

/** Kopfbedeckung im Knochen kopf (eigenes Mesh, damit Spiele sie ein-/ausblenden können). */
export function baueKopfbedeckung(b, K) {
  const { R, f } = K, st = K.stil.hut, c = f.hut, a = f.hutAkzent;
  const hoch = ['wuschel', 'locken'].includes(K.stil.haar) ? R * 0.25 : K.stil.haar === 'dutt' ? R * 0.1 : 0;
  if (st === 'kapuze') {
    const t = { y: R * 1.05, z: -R * 0.08, jitter: 0.1 }, o = { phi0: PI / 2 + 0.85, phiL: 2 * PI - 1.7, thL: PI * 0.8, ws: 10, hs: 6 };
    schale(b, R * 1.28, c, t, o);
    schale(b, R * 1.25, dunkler(c, 0.35), { ...t, innen: true }, o);
    b.cone(R * 0.45, R * 0.8, c, { y: R * 1.7, z: -R * 1.15, rx: -2.1 }, 6);                                 // Zipfel
  } else if (st === 'hut') {
    b.cyl(R * 1.7, R * 1.7, R * 0.08, c, { y: R * 1.55, rx: -0.08 }, 14);
    b.cyl(R * 0.62, R * 0.9, R * 1.0, c, { y: R * 2.05, rx: -0.08 }, 10);
    b.cyl(R * 0.92, R * 0.92, R * 0.2, a, { y: R * 1.7, rx: -0.08 }, 10);
    b.cone(R * 0.62, R * 1.0, c, { x: Math.sin(0.55) * R * 0.5, y: R * 2.55 + Math.cos(0.55) * R * 0.5, z: -R * 0.04, rz: -0.55 }, 10);
    b.sphere(R * 0.1, a, { x: R * 0.4, y: R * 1.72, z: R * 0.8 }, 5, 4);
  } else if (st === 'strohhut') {
    b.cyl(R * 2.1, R * 2.1, R * 0.06, c, { y: R * 1.55, jitter: 0.18 }, 16);
    b.cyl(R * 0.82, R * 0.95, R * 0.55, c, { y: R * 1.85, jitter: 0.18 }, 12);
    b.sphere(R * 0.82, c, { y: R * 2.1, sy: 0.25, jitter: 0.18 }, 12, 4);
    b.cyl(R * 0.97, R * 0.97, R * 0.16, a, { y: R * 1.68 }, 12);
  } else if (st === 'helm') {
    schale(b, R * 1.12, c, { y: R * 1.22, jitter: 0.05 }, { thL: PI * 0.5 });
    schale(b, R * 1.12, c, { y: R * 1.22, jitter: 0.05 }, { phi0: PI / 2 + 1.0, phiL: 2 * PI - 2.0, th0: PI * 0.5, thL: PI * 0.28, ws: 10, hs: 3 });
    b.cyl(R * 1.15, R * 1.15, R * 0.13, a, { y: R * 1.27 }, 14);
    b.box(R * 0.13, R * 0.5, R * 0.08, c, { y: R * 1.1, z: R * 1.1 });                                     // Nasenschutz
    b.sphere(R * 0.95, a, { y: R * 2.2, z: -R * 0.15, sx: 0.14, sy: 0.45, jitter: 0.12 }, 6, 4);           // Kamm
  } else if (st === 'bandana') {
    schale(b, R * 1.08, c, { y: R * 1.08, z: -R * 0.06, rx: -0.15, jitter: 0.1 }, { thL: PI * 0.47 });
    b.cyl(R * 1.09, R * 1.09, R * 0.15, a, { y: R * 1.36, z: -R * 0.06, rx: -0.15 }, 12);
    b.sphere(R * 0.16, c, { y: R * 1.25, z: -R * 1.1 }, 6, 4);
    for (const s of [-1, 1]) b.box(R * 0.2, R * 0.5, R * 0.05, c, { x: s * R * 0.1, y: R * 0.95, z: -R * 1.1, rz: s * 0.3, rx: 0.2 });
  } else if (st === 'muetze') {
    schale(b, R * 1.09, c, { y: R * 1.2, sy: 1.15, jitter: 0.12 }, { thL: PI * 0.5 });
    b.cyl(R * 1.12, R * 1.12, R * 0.32, a, { y: R * 1.3 }, 12);
    b.ico(R * 0.3, a, { y: R * 2.5 }, 1);
  } else if (st === 'krone') {
    const y = R * 1.88 + hoch;
    b.cyl(R * 0.74, R * 0.72, R * 0.3, c, { y }, 12);
    for (let i = 0; i < 6; i++) {
      const w = i / 6 * 2 * PI;
      b.cone(R * 0.16, R * 0.38, c, { x: Math.sin(w) * R * 0.72, y: y + R * 0.32, z: Math.cos(w) * R * 0.72 }, 4);
      b.sphere(R * 0.075, i % 2 ? heller(c, 0.5) : a, { x: Math.sin(w) * R * 0.76, y, z: Math.cos(w) * R * 0.76 }, 5, 4);
    }
  } else if (st === 'zauberhut') {
    b.cyl(R * 1.9, R * 1.9, R * 0.07, c, { y: R * 1.55, rx: -0.05, jitter: 0.1 }, 16);
    b.cyl(R * 0.7, R * 0.95, R * 1.1, c, { y: R * 2.1 }, 10);
    b.cyl(R * 0.96, R * 0.96, R * 0.18, a, { y: R * 1.68 }, 10);
    b.cone(R * 0.7, R * 1.5, c, { x: R * 0.25, y: R * 3.25, z: -R * 0.15, rz: -0.3, rx: -0.2 }, 10);
    for (const [x, y, z] of [[0.3, 2.3, 0.8], [-0.45, 2.7, 0.55], [0.4, 3.05, 0.3]]) b.ico(R * 0.09, a, { x: R * x, y: R * y, z: R * z }, 0);
  } else if (st === 'dreispitz') {
    b.cyl(R * 0.9, R * 1.0, R * 0.55, c, { y: R * 1.82 }, 10);
    b.sphere(R * 0.9, c, { y: R * 2.08, sy: 0.3 }, 10, 4);
    for (let i = 0; i < 3; i++) {                                   // drei hochgeklappte Krempen, Spitze vorn
      const w = PI + i * 2 * PI / 3, d = R * 1.0;
      const t = { x: Math.sin(w) * d, y: R * 1.85, z: Math.cos(w) * d, ry: w, rx: 0.35 };
      b.box(R * 2.0, R * 0.55, R * 0.07, c, t);
      b.box(R * 2.02, R * 0.06, R * 0.08, a, { ...t, y: t.y + R * 0.25 });
    }
  } else if (st === 'topfhelm') {
    b.cyl(R * 1.18, R * 1.15, R * 1.9, c, { y: R * 1.15, jitter: 0.05 }, 12);
    b.cyl(R * 1.0, R * 1.18, R * 0.25, c, { y: R * 2.2 }, 12);
    b.box(R * 1.4, R * 0.08, R * 0.1, 0x101010, { y: R * 1.15, z: R * 1.12 });                              // Sehschlitz
    b.box(R * 0.16, R * 1.5, R * 0.08, a, { y: R * 0.95, z: R * 1.17 });
    b.box(R * 1.6, R * 0.12, R * 0.08, a, { y: R * 1.38, z: R * 1.1 });
    for (let i = 0; i < 4; i++) b.sphere(R * 0.035, 0x101010, { x: R * 0.35 + (i % 2) * R * 0.15, y: R * (0.55 + Math.floor(i / 2) * 0.15), z: R * 1.15 }, 4, 2);
  } else if (st === 'kopftuch') {
    schale(b, R * 1.1, c, { y: R * 1.05, z: -R * 0.08, rx: -0.12, jitter: 0.1 }, { phi0: PI / 2 + 0.9, phiL: 2 * PI - 1.8, thL: PI * 0.66, ws: 12, hs: 6 });
    schale(b, R * 1.11, c, { y: R * 1.05, z: -R * 0.08, rx: -0.12, jitter: 0.1 }, { thL: PI * 0.35 });
    b.sphere(R * 0.18, c, { y: R * 0.55, z: -R * 0.95 }, 6, 4);                                           // Knoten im Nacken
    b.cone(R * 0.3, R * 0.6, c, { y: R * 0.25, z: -R * 1.0, rx: PI + 0.2, sz: 0.3 }, 3);
    for (let i = 0; i < 7; i++) b.sphere(R * 0.06, a, { x: Math.sin(i * 0.9 + 0.3) * R * 1.0, y: R * (1.3 + (i % 3) * 0.2), z: Math.cos(i * 0.9 + 0.3) * R * 1.0 - R * 0.1, sz: 0.4 }, 4, 2);
  } else if (st === 'federhut') {
    b.cyl(R * 1.6, R * 1.6, R * 0.07, c, { y: R * 1.55, rz: 0.15, rx: -0.1 }, 14);
    b.cyl(R * 0.8, R * 0.95, R * 0.6, c, { y: R * 1.9, rz: 0.15 }, 10);
    b.sphere(R * 0.8, c, { y: R * 2.2, sy: 0.35, rz: 0.15 }, 10, 4);
    b.cyl(R * 0.97, R * 0.97, R * 0.15, dunkler(c, 0.3), { y: R * 1.7, rz: 0.15 }, 10);
    b.sphere(R * 0.95, a, { x: R * 0.95, y: R * 2.2, z: -R * 0.5, sx: 0.12, sy: 0.32, rx: -1.0, rz: -0.3, jitter: 0.1 }, 6, 6);   // Feder
    b.cyl(R * 0.02, R * 0.02, R * 1.6, heller(a, 0.4), { x: R * 0.97, y: R * 2.2, z: -R * 0.5, rx: -1.0, rz: -0.3 }, 3);
  } else if (st === 'reif') {
    const y = R * 1.55 + hoch * 0.5;
    b.torus(R * 0.98, R * 0.045, c, { y, z: -R * 0.05, rx: PI / 2 + 0.12 }, 3, 16);
    b.sphere(R * 0.09, a, { y: y + R * 0.1, z: R * 0.93, sz: 0.5, jitter: 0 }, 6, 4);
  } else if (st === 'turban') {
    for (let i = 0; i < 3; i++) b.torus(R * (0.92 - i * 0.12), R * 0.26, i % 2 ? dunkler(c, 0.08) : c, { y: R * (1.5 + i * 0.26), rx: PI / 2 + (i % 2 ? 0.15 : -0.1), jitter: 0.1 }, 4, 10);
    schale(b, R * 1.0, c, { y: R * 1.45, jitter: 0.1 }, { thL: PI * 0.5 });
    b.sphere(R * 0.13, a, { y: R * 1.75, z: R * 1.15, sz: 0.5, jitter: 0 }, 6, 4);
    b.sphere(R * 0.3, heller(c, 0.3), { y: R * 2.15, z: R * 0.95, sx: 0.25, sy: 1.1, rx: -0.4 }, 5, 4);
  }
  return b;
}
