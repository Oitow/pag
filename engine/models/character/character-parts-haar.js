/**
 * @modul    character-parts-haar
 * @zweck    Bau-Funktionen für Frisuren und Bärte im Knochen kopf (Kopfkugel um y = R, Gesicht nach +Z); beachtet Kopfbedeckungen
 * @api      baueFrisur(b,ctx) -> b ; baueBart(b,ctx) -> b
 * @beispiel
 *   import { baueFrisur, baueBart } from '../../engine/models/character/character-parts-haar.js';
 *   baueBart(baueFrisur(b, ctx), ctx);
 * @tags     figur, charakter, kopf, haar, frisur, bart, locken, zopf
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import { farbeMisch, dunkler, schale } from './character-parts-basis.js';
import { deckendeKopfbedeckung } from './character-parts-hut.js';

const PI = Math.PI;

/** Frisur (Teil des Kopf-Meshes). */
export function baueFrisur(b, K) {
  const { R, f } = K, st = K.stil.haar, h = f.haar, hut = K.stil.hut, deckt = deckendeKopfbedeckung(hut);
  if (st === 'glatze') return b;
  const kappe = (r = 1.06, farbe = h) => schale(b, R * r, farbe, { y: R * 1.1, z: -R * 0.12, jitter: 0.1 }, { thL: PI * 0.7 });
  if (st === 'irokese') {
    kappe(1.02, farbeMisch(f.haut, h, 0.3));
    if (!deckt || hut === 'bandana') for (let i = 0; i < 7; i++) {
      const a = 0.9 - i * 0.42, hoch = R * (0.75 - Math.abs(i - 2) * 0.06);
      b.cone(R * 0.26, hoch, h, { y: R * 1.1 + Math.cos(a) * R * 0.95, z: -R * 0.12 + Math.sin(a) * R * 0.95, rx: a, sx: 0.6 }, 4);
    }
    return b;
  }
  if (st === 'kranz') {                                    // Haarkranz: nur Seiten und Hinterkopf
    schale(b, R * 1.06, h, { y: R * 1.02, z: -R * 0.06, jitter: 0.12 }, { phi0: PI / 2 + 1.05, phiL: 2 * PI - 2.1, th0: PI * 0.36, thL: PI * 0.26, ws: 12, hs: 3 });
    return b;
  }
  const helm = hut === 'helm' || hut === 'topfhelm';      // Helme verdecken Kappe und Pony ganz
  if (!helm) kappe(st === 'dutt' ? 1.04 : 1.07);
  if (!helm && ['kurz', 'zopf', 'dutt', 'lang', 'pferdeschwanz', 'zoepfe'].includes(st)) {
    for (let i = -2; i <= 2; i++) b.cone(R * 0.16, R * 0.32, h, { x: i * R * 0.2, y: R * 1.68 - Math.abs(i) * R * 0.06, z: R * 0.66, rx: 2.0, rz: -i * 0.25, sz: 0.5 }, 4);
  }
  if (st === 'scheitel' && !helm) {                        // Seitenscheitel: Welle über die Stirn
    b.sphere(R * 0.62, h, { x: R * 0.22, y: R * 1.72, z: R * 0.3, sx: 1.25, sy: 0.42, sz: 1.0, rz: -0.25, jitter: 0.1 }, 8, 5);
    b.sphere(R * 0.35, dunkler(h, 0.1), { x: -R * 0.5, y: R * 1.6, z: R * 0.35, sy: 0.5, rz: 0.5 }, 6, 4);
  }
  if ((st === 'wuschel' || st === 'locken') && !deckt) {
    const n = st === 'locken' ? 16 : 13, rr0 = st === 'locken' ? 0.27 : 0.33;
    for (let i = 0; i < n; i++) {                       // Locken gleichmäßig über den Oberkopf (goldener Winkel)
      const y = 1 - (i + 0.5) / n * 0.9, rr = Math.sqrt(1 - y * y), a = i * 2.39996;
      b.ico(R * rr0, h, { x: Math.cos(a) * rr * R * 0.98, y: R * 1.12 + y * R * 0.92, z: -R * 0.1 + Math.sin(a) * rr * R * 0.98 }, 0);
    }
  }
  if (st === 'locken' && !helm) for (let i = 0; i < 9; i++) {   // Lockenkranz bis in den Nacken (auch unter Hüten)
    const a = PI / 2 + 1.0 + i / 8 * (2 * PI - 2.0);
    b.ico(R * 0.28, i % 2 ? h : dunkler(h, 0.12), { x: -Math.cos(a) * R * 0.98, y: R * (0.75 + (i % 2) * 0.12), z: Math.sin(a) * R * 0.98 - R * 0.08 }, 0);
  }
  if (st === 'lang') {
    b.cyl(R * 0.92, R * 1.05, R * 1.5, h, { y: R * 0.5, z: -R * 0.45, sz: 0.55, jitter: 0.1 }, 10);
    for (const s of [-1, 1]) b.capsule(R * 0.2, R * 0.9, h, { x: s * R * 0.86, y: R * 0.55, z: R * 0.15, rz: s * 0.08 }, 2, 6);
  }
  const band = K.f.guertel ?? 0xa83a2a;
  if (st === 'zopf') {
    for (let i = 0; i < 6; i++) b.sphere(R * (0.27 - i * 0.022), h, { x: (i % 2 ? 0.03 : -0.03) * R, y: R * (0.75 - i * 0.36), z: -R * (1.08 + i * 0.03), sy: 1.25 }, 6, 4);
    b.cyl(R * 0.15, R * 0.15, R * 0.1, band, { y: R * (0.75 - 5.5 * 0.36), z: -R * 1.24 }, 6);
    b.cone(R * 0.15, R * 0.3, h, { y: R * (0.75 - 6 * 0.36) - R * 0.05, z: -R * 1.24, rx: PI }, 5);
  }
  if (st === 'zoepfe') for (const s of [-1, 1]) {          // zwei Zöpfe seitlich
    for (let i = 0; i < 5; i++) b.sphere(R * (0.22 - i * 0.018), h, { x: s * R * (0.9 + (i % 2) * 0.03), y: R * (0.75 - i * 0.3), z: -R * 0.15, sy: 1.25 }, 6, 4);
    b.cyl(R * 0.12, R * 0.12, R * 0.09, band, { x: s * R * 0.92, y: R * (0.75 - 4.6 * 0.3), z: -R * 0.15 }, 6);
    b.cone(R * 0.13, R * 0.25, h, { x: s * R * 0.92, y: R * (0.75 - 5.1 * 0.3), z: -R * 0.15, rx: PI }, 5);
  }
  if (st === 'pferdeschwanz') {
    b.cyl(R * 0.17, R * 0.17, R * 0.12, band, { y: R * 1.5, z: -R * 1.0, rx: -0.9 }, 6);
    for (let i = 0; i < 5; i++) b.sphere(R * (0.24 - i * 0.025), h, { y: R * (1.38 - i * 0.3), z: -R * (1.12 + i * 0.06 - i * i * 0.012), sy: 1.4, jitter: 0.12 }, 6, 4);
    b.cone(R * 0.12, R * 0.3, h, { y: R * -0.25, z: -R * 1.2, rx: PI }, 5);
  }
  if (st === 'dutt' && !deckt) {
    b.sphere(R * 0.42, h, { y: R * 1.75, z: -R * 0.75, jitter: 0.12 }, 8, 6);
    b.cyl(R * 0.3, R * 0.3, R * 0.1, dunkler(h, 0.3), { y: R * 1.55, z: -R * 0.62, rx: -0.9 }, 8);
  }
  return b;
}

/** Bart (Teil des Kopf-Meshes). */
export function baueBart(b, K) {
  const { R, f } = K, st = K.stil.bart, c = f.bart;
  if (st === 'keiner') return b;
  const unten = (r, farbe, th0, phiL = 2.5) => schale(b, R * r, farbe, { y: R, jitter: 0.14 }, { phi0: PI / 2 - phiL / 2, phiL, th0, thL: PI * 0.95 - th0, ws: 10, hs: 5 });
  const schnurr = () => { for (const s of [-1, 1]) b.capsule(R * 0.06, R * 0.22, c, { x: s * R * 0.15, y: R * 0.6, z: R * 0.98, rz: s * 1.1 }, 1, 5); };
  const mund = () => b.box(R * 0.22, R * 0.04, R * 0.05, farbeMisch(f.haut, 0x5a1a1a, 0.6), { y: R * 0.48, z: R * 1.02 });
  if (st === 'stoppel') unten(1.012, farbeMisch(f.haut, c, 0.4), PI * 0.6);
  else if (st === 'voll' || st === 'lang') {
    unten(1.05, c, PI * 0.63);
    b.sphere(R * 0.5, c, { y: R * 0.22, z: R * 0.55, sy: 1.15, sz: 0.85, jitter: 0.14 }, 7, 5);
    schnurr();
    mund();
    if (st === 'lang') {
      b.cone(R * 0.48, R * 1.5, c, { y: R * -0.45, z: R * 0.6, rx: PI + 0.12, sz: 0.6, jitter: 0.14 }, 7);
      b.cone(R * 0.2, R * 0.5, dunkler(c, 0.08), { x: R * 0.15, y: R * -0.9, z: R * 0.68, rx: PI + 0.1, rz: -0.15 }, 5);
    }
  } else if (st === 'schnurrbart') schnurr();
  else if (st === 'zwirbel') {
    schnurr();
    for (const s of [-1, 1]) b.torus(R * 0.08, R * 0.03, c, { x: s * R * 0.4, y: R * 0.66, z: R * 0.88, ry: s * 0.5, rz: s > 0 ? 0 : PI }, 3, 8, PI * 1.3);
  } else if (st === 'ziege') {
    b.cone(R * 0.17, R * 0.42, c, { y: R * 0.05, z: R * 0.8, rx: PI + 0.35 }, 6);
    b.box(R * 0.1, R * 0.1, R * 0.06, c, { y: R * 0.38, z: R * 0.93 });
  } else if (st === 'koteletten') {
    for (const s of [-1, 1]) b.box(R * 0.14, R * 0.5, R * 0.3, c, { x: s * R * 0.92, y: R * 0.82, z: R * 0.22, rz: s * 0.08, jitter: 0.14 });
  } else if (st === 'kinnbart') {
    unten(1.04, c, PI * 0.74, 1.2);
    b.box(R * 0.09, R * 0.12, R * 0.05, c, { y: R * 0.36, z: R * 0.93 });
  }
  return b;
}
