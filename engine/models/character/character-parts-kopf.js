/**
 * @modul    character-parts-kopf
 * @zweck    Bau-Funktionen für den Figuren-Kopf: Gesicht (Augen, Nase, Ohren, Mund), Frisuren, Bärte und Kopfbedeckungen
 * @api      baueKopf(b,ctx) ; baueKopfbedeckung(b,ctx) ; deckendeKopfbedeckung(stil) -> bool
 * @beispiel
 *   import { baueKopf, baueKopfbedeckung } from '../../engine/models/character/character-parts-kopf.js';
 *   const ctx = teilKontext(look, masse);
 *   rig.knochen.kopf.add(baueKopf(createMeshBuilder({ seed }), ctx).mesh());
 * @tags     figur, charakter, kopf, gesicht, haar, frisur, bart, hut, helm, krone
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
import { farbeMisch } from './character-parts.js';

const PI = Math.PI, dunkler = (c, t) => farbeMisch(c, 0, t), heller = (c, t) => farbeMisch(c, 0xffffff, t);

/** Verdeckt die Kopfbedeckung den Oberkopf (dann keine hohen Frisur-Teile)? */
export function deckendeKopfbedeckung(stil) { return !['keine', 'krone'].includes(stil); }

/** Kugel-Ausschnitt (theta von oben gemessen, phi = π/2 ist vorn +Z). */
function schale(b, r, farbe, t, { phi0 = 0, phiL = 2 * PI, th0 = 0, thL = PI, ws = 12, hs = 7 } = {}) {
  const geo = new THREE.SphereGeometry(r, ws, hs, phi0, phiL, th0, thL);
  b.add(geo, farbe, t);
  geo.dispose();
}

/** Kopf im Knochen kopf: Kugel zentriert bei y = R, Gesicht nach +Z. */
export function baueKopf(b, K) {
  const { R, f } = K, haut = f.haut;
  b.sphere(R, haut, { y: R, sy: 1.04, jitter: 0.04 }, 11, 8);
  b.sphere(R * 0.72, haut, { y: R * 0.62, z: R * 0.2, sx: 1.05, sz: 1.0, jitter: 0.04 }, 8, 5);        // Kiefer/Wangen
  for (const s of [-1, 1]) {
    const x = s * R * 0.34;
    b.sphere(R * 0.17, 0xf4efe6, { x, y: R * 1.02, z: R * 0.86, sz: 0.5, jitter: 0 }, 6, 4);           // Augapfel
    b.sphere(R * 0.115, f.augen, { x, y: R * 1.0, z: R * 0.92, sz: 0.45, jitter: 0 }, 6, 4);            // Iris
    b.sphere(R * 0.035, 0xffffff, { x: x - R * 0.04, y: R * 1.05, z: R * 0.97, jitter: 0 }, 4, 2);     // Glanzpunkt
    b.box(R * 0.3, R * 0.07, R * 0.08, dunkler(f.haar, 0.1), { x: s * R * 0.36, y: R * 1.27, z: R * 0.88, rz: s * 0.15 }); // Braue
    b.sphere(R * 0.2, haut, { x: s * R * 0.97, y: R * 0.95, z: -R * 0.05, sx: 0.45, sy: 1.1 }, 5, 4);  // Ohr
    b.sphere(R * 0.13, farbeMisch(haut, 0xd05050, 0.35), { x: s * R * 0.54, y: R * 0.7, z: R * 0.74, sz: 0.3, jitter: 0 }, 5, 3); // Wange
  }
  b.sphere(R * 0.14, dunkler(haut, 0.06), { y: R * 0.82, z: R * 0.98, sy: 1.15, sz: 1.1 }, 5, 4);     // Nase
  b.box(R * 0.24, R * 0.045, R * 0.05, farbeMisch(haut, 0x5a1a1a, 0.6), { y: R * 0.52, z: R * 0.9 });   // Mund
  frisur(b, K);
  bart(b, K);
  return b;
}

function frisur(b, K) {
  const { R, f } = K, st = K.stil.haar, h = f.haar, deckt = deckendeKopfbedeckung(K.stil.hut);
  if (st === 'glatze') return;
  const kappe = (r = 1.06, farbe = h) => schale(b, R * r, farbe, { y: R * 1.1, z: -R * 0.12, jitter: 0.1 }, { thL: PI * 0.7 });
  if (st === 'irokese') {
    kappe(1.02, farbeMisch(f.haut, h, 0.3));
    if (!deckt || K.stil.hut === 'bandana') for (let i = 0; i < 7; i++) {
      const a = 0.9 - i * 0.42, hoch = R * (0.75 - Math.abs(i - 2) * 0.06);
      b.cone(R * 0.26, hoch, h, { y: R * 1.1 + Math.cos(a) * R * 0.95, z: -R * 0.12 + Math.sin(a) * R * 0.95, rx: a, sx: 0.6 }, 4);
    }
    return;
  }
  const helm = K.stil.hut === 'helm';          // Helm verdeckt Kappe und Pony ganz
  if (!helm) kappe(st === 'dutt' ? 1.04 : 1.07);
  if (!helm && ['kurz', 'zopf', 'dutt', 'lang'].includes(st)) {
    for (let i = -2; i <= 2; i++) b.cone(R * 0.16, R * 0.32, h, { x: i * R * 0.2, y: R * 1.68 - Math.abs(i) * R * 0.06, z: R * 0.66, rx: 2.0, rz: -i * 0.25, sz: 0.5 }, 4);
  }
  if (st === 'wuschel' && !deckt) {
    for (let i = 0; i < 13; i++) {                       // Locken gleichmäßig über den Oberkopf (goldener Winkel)
      const y = 1 - (i + 0.5) / 13 * 0.9, rr = Math.sqrt(1 - y * y), a = i * 2.39996;
      b.ico(R * 0.33, h, { x: Math.cos(a) * rr * R * 0.98, y: R * 1.12 + y * R * 0.92, z: -R * 0.1 + Math.sin(a) * rr * R * 0.98 }, 0);
    }
  }
  if (st === 'lang') {
    b.cyl(R * 0.92, R * 1.05, R * 1.5, h, { y: R * 0.5, z: -R * 0.45, sz: 0.55, jitter: 0.1 }, 10);
    for (const s of [-1, 1]) b.capsule(R * 0.2, R * 0.9, h, { x: s * R * 0.86, y: R * 0.55, z: R * 0.15, rz: s * 0.08 }, 2, 6);
  }
  if (st === 'zopf') {
    for (let i = 0; i < 6; i++) b.sphere(R * (0.27 - i * 0.022), h, { x: (i % 2 ? 0.03 : -0.03) * R, y: R * (0.75 - i * 0.36), z: -R * (1.08 + i * 0.03), sy: 1.25 }, 6, 4);
    b.cyl(R * 0.15, R * 0.15, R * 0.1, K.f.guertel ?? 0xa83a2a, { y: R * (0.75 - 5.5 * 0.36), z: -R * 1.24 }, 6);
    b.cone(R * 0.15, R * 0.3, h, { y: R * (0.75 - 6 * 0.36) - R * 0.05, z: -R * 1.24, rx: PI }, 5);
  }
  if (st === 'dutt' && !deckt) {
    b.sphere(R * 0.42, h, { y: R * 1.75, z: -R * 0.75, jitter: 0.12 }, 8, 6);
    b.cyl(R * 0.3, R * 0.3, R * 0.1, dunkler(h, 0.3), { y: R * 1.55, z: -R * 0.62, rx: -0.9 }, 8);
  }
}

function bart(b, K) {
  const { R, f } = K, st = K.stil.bart, c = f.bart;
  if (st === 'keiner') return;
  const unten = (r, farbe, th0) => schale(b, R * r, farbe, { y: R, jitter: 0.14 }, { phi0: PI / 2 - 1.25, phiL: 2.5, th0, thL: PI * 0.95 - th0, ws: 10, hs: 5 });
  const schnurr = () => { for (const s of [-1, 1]) b.capsule(R * 0.06, R * 0.22, c, { x: s * R * 0.15, y: R * 0.6, z: R * 0.98, rz: s * 1.1 }, 1, 5); };
  if (st === 'stoppel') unten(1.012, farbeMisch(f.haut, c, 0.4), PI * 0.6);
  else if (st === 'voll') {
    unten(1.05, c, PI * 0.63);
    b.sphere(R * 0.5, c, { y: R * 0.22, z: R * 0.55, sy: 1.15, sz: 0.85, jitter: 0.14 }, 7, 5);
    schnurr();
    b.box(R * 0.22, R * 0.04, R * 0.05, farbeMisch(f.haut, 0x5a1a1a, 0.6), { y: R * 0.48, z: R * 1.02 });
  } else if (st === 'schnurrbart') schnurr();
  else if (st === 'ziege') {
    b.cone(R * 0.17, R * 0.42, c, { y: R * 0.05, z: R * 0.8, rx: PI + 0.35 }, 6);
    b.box(R * 0.1, R * 0.1, R * 0.06, c, { y: R * 0.38, z: R * 0.93 });
  }
}

/** Kopfbedeckung im Knochen kopf (eigenes Mesh, damit Spiele sie ein-/ausblenden können). */
export function baueKopfbedeckung(b, K) {
  const { R, f } = K, st = K.stil.hut, c = f.hut, a = f.hutAkzent;
  const hoch = K.stil.haar === 'wuschel' ? R * 0.25 : K.stil.haar === 'dutt' ? R * 0.1 : 0;
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
    schale(b, R * 1.14, c, { y: R * 1.2, jitter: 0.05 }, { thL: PI * 0.56 });
    schale(b, R * 1.14, c, { y: R * 1.2, jitter: 0.05 }, { phi0: PI / 2 + 0.7, phiL: 2 * PI - 1.4, th0: PI * 0.55, thL: PI * 0.25 });
    b.cyl(R * 1.16, R * 1.16, R * 0.13, a, { y: R * 1.14 }, 14);
    b.box(R * 0.14, R * 0.6, R * 0.1, c, { y: R * 0.98, z: R * 1.12 });                                    // Nasenschutz
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
  }
  return b;
}
