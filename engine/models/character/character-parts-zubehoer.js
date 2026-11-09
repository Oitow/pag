/**
 * @modul    character-parts-zubehoer
 * @zweck    Bau-Funktionen für Accessoires: Schal/Halstuch/Pelzkragen und Halsschmuck (Knochen torso), Brille/Augenklappe/Monokel und Ohrringe (Knochen kopf)
 * @api      baueZubehoer(b,ctx) -> b ; baueBrille(b,ctx) -> b ; baueOhrringe(b,ctx) -> b ; hatZubehoer(ctx) -> bool
 * @beispiel
 *   import { baueZubehoer, hatZubehoer } from '../../engine/models/character/character-parts-zubehoer.js';
 *   if (hatZubehoer(ctx)) rig.knochen.torso.add(baueZubehoer(createMeshBuilder({ seed }), ctx).mesh());
 * @tags     figur, charakter, accessoire, schal, schmuck, kette, amulett, brille, augenklappe, monokel, ohrringe
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import { dunkler, heller } from './character-parts-basis.js';

const PI = Math.PI;

/** Gibt es am Torso etwas zu bauen (Schal oder Halsschmuck)? */
export function hatZubehoer(K) { return K.stil.schal !== 'kein' || ['kette', 'amulett', 'perlen'].includes(K.stil.schmuck); }

/** Schal und Halsschmuck im Knochen torso (Halsansatz bei y = torsoLaenge). */
export function baueZubehoer(b, K) {
  const { g, m, f, brust: rc, tiefe: sz } = K, L = m.torsoLaenge, st = K.stil.schal, sm = K.stil.schmuck;
  const zv = (y) => rc * 0.97 * sz + (y > L * 0.9 ? 0 : 0.005 * g);       // Brustvorderseite (oben)
  // Halsschmuck zuerst (liegt unter dem Schal)
  if (sm === 'kette' || sm === 'amulett') {
    b.torus(rc * 0.62, 0.006 * g, f.schmuck, { y: L * 0.9, z: 0.01 * g, rx: PI / 2 + 0.5, sy: 0.85 }, 3, 14);
    if (sm === 'amulett') {
      b.sphere(0.03 * g, f.schmuck, { y: L * 0.68, z: zv(L * 0.7) + 0.008 * g, sz: 0.45 }, 7, 5);
      b.sphere(0.018 * g, f.stein, { y: L * 0.68, z: zv(L * 0.7) + 0.016 * g, sz: 0.5, jitter: 0 }, 6, 4);
    }
  } else if (sm === 'perlen') {
    for (let i = 0; i < 13; i++) {
      const a = (i / 12 - 0.5) * PI * 1.25;
      b.sphere(0.013 * g, i % 3 ? heller(f.stein, 0.6) : f.stein, { x: Math.sin(a) * rc * 0.6, y: L * 0.86 + Math.abs(Math.sin(a)) * 0.05 * g, z: Math.cos(a) * rc * 0.62 * sz + 0.01 * g, jitter: 0 }, 5, 3);
    }
  }
  if (st === 'schal') {
    b.torus(0.075 * g, 0.034 * g, f.schal, { y: L * 1.02, rx: PI / 2 + 0.12, sy: 0.85, jitter: 0.14 }, 5, 12);
    for (const [x, h, rz] of [[0.04, 0.26, 0.08], [0.075, 0.18, -0.05]]) {   // zwei Enden vorn
      b.box(0.055 * g, h * g, 0.022 * g, f.schal, { x: x * g, y: L * 0.98 - h * g / 2, z: zv(L) + 0.012 * g, rz, rx: -0.12, jitter: 0.1 });
      b.box(0.057 * g, 0.022 * g, 0.024 * g, f.schalAkzent, { x: x * g + Math.sin(rz) * h * g * 0.4, y: L * 0.98 - h * g * 0.9, z: zv(L) + 0.012 * g - 0.01 * g, rz, rx: -0.12 });
    }
  } else if (st === 'halstuch') {
    b.torus(0.07 * g, 0.018 * g, f.schal, { y: L * 1.01, rx: PI / 2 + 0.2, sy: 0.85 }, 4, 12);
    b.cone(0.07 * g, 0.12 * g, f.schal, { y: L * 0.9, z: zv(L) + 0.006 * g, rx: PI - 0.15, sz: 0.25 }, 3);   // Dreieck vorn
    b.sphere(0.018 * g, f.schalAkzent, { y: L * 0.97, z: zv(L) + 0.01 * g }, 5, 4);
  } else if (st === 'pelzkragen') {
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * 2 * PI;
      b.ico(0.05 * g, i % 2 ? f.schal : dunkler(f.schal, 0.15), { x: Math.sin(a) * rc * 0.78, y: L * 0.97, z: Math.cos(a) * rc * 0.78 * sz, sy: 0.7, jitter: 0.15 }, 0);
    }
  }
  return b;
}

/** Brille im Knochen kopf (Kopfkugel um y = R, Augen bei x = ±0,34·R, y = 1,02·R). Figur-rechts = −X. */
export function baueBrille(b, K) {
  const { R, f } = K, st = K.stil.brille, c = f.brille, y = R * 1.02, z = R * 0.99;
  if (st === 'keine') return b;
  const buegel = () => {
    b.box(R * 0.1, R * 0.035, R * 0.03, c, { y: y + R * 0.04, z: z + R * 0.02 });                              // Steg
    for (const s of [-1, 1]) b.box(R * 0.03, R * 0.035, R * 0.75, c, { x: s * R * 0.93, y: y + R * 0.04, z: R * 0.45, ry: -s * 0.12 });
  };
  if (st === 'rund') {
    for (const s of [-1, 1]) b.torus(R * 0.19, R * 0.025, c, { x: s * R * 0.34, y, z }, 3, 12);
    buegel();
  } else if (st === 'eckig') {
    for (const s of [-1, 1]) {
      const x = s * R * 0.34;
      for (const dy of [-1, 1]) b.box(R * 0.42, R * 0.04, R * 0.035, c, { x, y: y + dy * R * 0.12, z });
      for (const dx of [-1, 1]) b.box(R * 0.04, R * 0.28, R * 0.035, c, { x: x + dx * R * 0.2, y, z });
    }
    buegel();
  } else if (st === 'sonnenbrille') {
    for (const s of [-1, 1]) b.sphere(R * 0.2, 0x181818, { x: s * R * 0.34, y, z: z - R * 0.02, sx: 1.1, sy: 0.8, sz: 0.3, jitter: 0 }, 8, 5);
    b.box(R * 0.95, R * 0.04, R * 0.04, c, { y: y + R * 0.13, z: z + R * 0.01 });
    buegel();
  } else if (st === 'augenklappe') {
    b.sphere(R * 0.22, 0x141414, { x: -R * 0.34, y, z: z - R * 0.04, sy: 0.9, sz: 0.35, jitter: 0 }, 8, 5);
    b.torus(R * 1.03, R * 0.025, 0x141414, { y: R * 1.2, z: -R * 0.02, rx: PI / 2 + 0.15 }, 3, 16);
  } else if (st === 'monokel') {
    b.torus(R * 0.18, R * 0.028, c, { x: R * 0.34, y, z: z + R * 0.01 }, 3, 12);
    for (let i = 0; i < 4; i++) b.sphere(R * 0.02, c, { x: R * (0.48 + i * 0.07), y: y - R * (0.18 + i * 0.16), z: R * (0.92 - i * 0.08) }, 3, 2);
  }
  return b;
}

/** Ohrringe im Knochen kopf (nur bei schmuck: 'ohrringe'). */
export function baueOhrringe(b, K) {
  const { R, f } = K;
  if (K.stil.schmuck !== 'ohrringe') return b;
  for (const s of [-1, 1]) {
    b.torus(R * 0.08, R * 0.018, f.schmuck, { x: s * R * 1.0, y: R * 0.68, z: -R * 0.02, ry: PI / 2 }, 3, 8);
    b.sphere(R * 0.035, f.stein, { x: s * R * 1.0, y: R * 0.6, z: -R * 0.02, jitter: 0 }, 4, 3);
  }
  return b;
}
