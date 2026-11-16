/**
 * @modul    mauer
 * @zweck    Stadtmauer als Low-Poly-Assets: Segment (in x streckbar), achteckiger Mauerturm, Torhaus mit freiem Durchgang, Torflügel (zentriert, für gameplay/tueren)
 * @api      createMauer({ seed, variante, sx = 1 }) ; createMauerTurm({ seed, variante }) ; createTorhaus({ seed, variante }) ; createTorfluegel({ seed, variante }) -> asset { geometrie, leucht, kollision, anker, masse, dreiecke, dispose }
 * @beispiel
 *   import { createMauer, createTorhaus } from '../../engine/models/bau/mauer.js';
 *   const stueck = createMauer({ sx: 1.5 });   // 9 m langes Segment, Front (außen) = +z
 * @tags     bau, gebaeude, mauer, tor, zinnen, asset, lowpoly
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import { createMeshBuilder } from '../../render/mesh-builder.js';
import { rng, hashSeed, range } from '../../core/rng.js';
import { FARBEN as F, kasten, kreis, asset } from './bau-basis.js';
import { zinnenLinie } from './bau-teile.js';

const baue = (name, seed, v) => ({ r: rng(hashSeed(name, seed, v)), b: createMeshBuilder({ seed: hashSeed(name + '-b', seed, v) }), l: createMeshBuilder({ seed: 1, jitter: 0 }) });

/** Mauersegment 6·sx × 1.4 × 4.5, Zinnen außen (+z), Wehrgang-Konsole innen. */
export function createMauer({ seed = 1, variante = 0, sx = 1 } = {}) {
  const { r, b, l } = baue('mauer', seed, variante), W = 6 * sx;
  b.box(W, 4.4, 1.0, F.stein, { y: 1.7, jitter: 0.08 }).box(W, 1.0, 1.4, F.steinDunkel, { jitter: 0.07 });
  for (const y of [1.5, 2.5, 3.3]) b.box(W + 0.02, 0.08, 1.03, F.steinDunkel, { y, jitter: 0.04 });
  b.box(W, 0.18, 0.2, F.holzDunkel, { y: 3.3, z: -0.6 }).box(W, 0.5, 0.14, F.steinHell, { y: 4.15, z: -0.43 });
  const n = Math.max(3, Math.round(W / 1.2));
  zinnenLinie(b, -W / 2, 0.35, W / 2, 0.35, 3.9, { n, bw: (W / n) * 0.62, bh: 0.6, bt: 0.3 });
  for (let i = 0; i < 6; i++) b.box(0.5, 0.3, 0.1, F.steinHell, { x: range(r, -W / 2 + 0.5, W / 2 - 0.5), y: range(r, 0.9, 3.0), z: 0.52, jitter: 0.08 });
  return asset({ name: 'mauer', variante, geometrie: b.geometry(), kollision: [kasten(0, 0, W / 2, 0.7, 4.5)], masse: { breite: W, tiefe: 1.4, hoehe: 4.5 } });
}

/** Achteckiger Mauerturm Ø 4.5 × 7.5 mit Zinnenkranz und Schießscharten. */
export function createMauerTurm({ seed = 1, variante = 0 } = {}) {
  const { b, l } = baue('mauerturm', seed, variante);
  b.cyl(2.25, 2.25, 1.0, F.steinDunkel, { jitter: 0.07 }, 8).cyl(2.0, 2.15, 7.0, F.stein, { y: 3.0, jitter: 0.08 }, 8);
  b.cyl(2.25, 2.0, 0.4, F.steinDunkel, { y: 6.6, jitter: 0.06 }, 8).cyl(2.1, 2.1, 0.1, F.holzDunkel, { y: 6.85 }, 8);
  for (let k = 0; k < 8; k++) {   // Zinnen auf den Achteck-Seiten
    const a = (k + 0.5) * Math.PI / 4;
    b.box(1.1, 0.6, 0.34, F.steinHell, { x: Math.sin(a) * 1.95, y: 7.2, z: Math.cos(a) * 1.95, ry: a, jitter: 0.07 });
    if (k % 2) for (const y of [3.0, 5.0]) b.box(0.13, 0.7, 0.1, F.fenster, { x: Math.sin(a) * 1.97, y, z: Math.cos(a) * 1.97, ry: a });
  }
  b.box(0.06, 0.06, 0.2, F.eisen, { y: 2.4, z: 2.15 });
  l.cone(0.09, 0.28, F.flamme, { y: 2.6, z: 2.28, jitter: 0 }, 5);
  return asset({ name: 'mauerturm', variante, geometrie: b.geometry(), leucht: l.geometry(), kollision: [kreis(0, 0, 2.1, 7.5)],
    anker: { fackeln: [{ x: 0, y: 2.7, z: 2.28 }], licht: [{ x: 0, y: 2.7, z: 2.5, farbe: F.flamme, staerke: 0.8 }] },
    masse: { breite: 4.5, tiefe: 4.5, hoehe: 7.5 } });
}

/** Torhaus 9 × 6 × 8.5: zwei Pfeilertürme, Durchgang 4.8 × 4.2 frei, Wehrgang darüber. Front (außen) = +z. */
export function createTorhaus({ seed = 1, variante = 0 } = {}) {
  const { b, l } = baue('torhaus', seed, variante);
  for (const s of [-1, 1]) {
    b.box(2.1, 8.4, 6, F.stein, { x: s * 3.45, y: 3.7, jitter: 0.08 });
    for (const y of [2.4, 5.2]) b.box(2.16, 0.1, 6.06, F.steinDunkel, { x: s * 3.45, y, jitter: 0.04 });
    const zk = { bw: 0.7, bh: 0.6, bt: 0.32 }, xa = s * 4.34, xi = s * 2.56;
    zinnenLinie(b, xa, -2.7, xa, 2.7, 7.9, { n: 4, ...zk }); zinnenLinie(b, xi, -2.7, xi, 2.7, 7.9, { n: 4, ...zk });
    zinnenLinie(b, xi, 2.84, xa, 2.84, 7.9, { n: 2, ...zk }); zinnenLinie(b, xi, -2.84, xa, -2.84, 7.9, { n: 2, ...zk });
    for (const x of [-0.5, 0.5]) b.box(0.14, 0.8, 0.1, F.fenster, { x: s * 3.45 + x, y: 4.0, z: 3.03 });
    // Banner-Halter (Querstange an zwei Konsolen) und Wandfackel
    b.box(1.2, 0.08, 0.08, F.eisen, { x: s * 3.45, y: 6.4, z: 3.12 });
    for (const dx of [-0.5, 0.5]) b.box(0.06, 0.06, 0.15, F.eisen, { x: s * 3.45 + dx, y: 6.4, z: 3.05 });
    b.box(0.06, 0.06, 0.12, F.eisen, { x: s * 2.85, y: 2.6, z: 3.06 });
    l.cone(0.09, 0.28, F.flamme, { x: s * 2.85, y: 2.85, z: 3.05, jitter: 0 }, 5);
  }
  b.box(4.9, 2.0, 6, F.steinDunkel, { y: 5.2, jitter: 0.07 }).box(4.9, 0.4, 6, F.holzDunkel, { y: 6.4, jitter: 0.05 });
  for (const z of [3.04, -3.04]) b.box(0.5, 0.5, 0.15, F.steinHell, { y: 4.0, z });
  zinnenLinie(b, -2.4, 2.84, 2.4, 2.84, 6.6, { n: 4, bw: 0.8, bh: 0.6, bt: 0.32 }); zinnenLinie(b, -2.4, -2.84, 2.4, -2.84, 6.6, { n: 4, bw: 0.8, bh: 0.6, bt: 0.32 });
  const fl = [-1, 1].map((s) => ({ x: s * 1.2, z: 0, angel: s < 0 ? 'links' : 'rechts', breite: 2.4, hoehe: 4.1 }));
  return asset({ name: 'torhaus', variante, geometrie: b.geometry(), leucht: l.geometry(),
    kollision: [kasten(-3.45, 0, 1.05, 3, 7.9), kasten(3.45, 0, 1.05, 3, 7.9), kasten(0, 0, 2.4, 3, 2.1, { y0: 4.5 })],
    anker: { tuer: { x: 0, y: 0, z: 3, winkel: 0, breite: 4.8, hoehe: 4.2 }, fluegel: fl, wachen: [-1, 1].map((s) => ({ x: s * 3.2, z: 3.7, winkel: 0 })),
      fackeln: [-1, 1].map((s) => ({ x: s * 2.85, y: 2.9, z: 3.1 })), banner: [-1, 1].map((s) => ({ x: s * 3.45, y: 6.4, z: 3.12 })),
      licht: [-1, 1].map((s) => ({ x: s * 2.85, y: 2.9, z: 3.4, farbe: F.flamme, staerke: 0.9 })) },
    masse: { breite: 9, tiefe: 6, hoehe: 8.5 } });
}

/** Torflügel 2.4 × 4.1 × 0.25, zentriert (x ±1.2, y 0…4.1): Bohlen + Eisenbänder, passt zu gameplay/tueren. */
export function createTorfluegel({ seed = 1, variante = 0 } = {}) {
  const { b } = baue('torfluegel', seed, variante);
  for (let k = 0; k < 5; k++) b.box(0.48, 4.1, 0.2, k % 2 ? F.holz : F.holzDunkel, { x: -0.96 + k * 0.48, y: 2.05, jitter: 0.1 });
  for (const y of [0.7, 2.05, 3.4]) for (const z of [-0.1, 0.1]) b.box(2.4, 0.18, 0.05, F.eisen, { y, z, jitter: 0.04 });
  b.box(0.1, 0.3, 0.05, F.eisen, { x: 0.9, y: 1.4, z: 0.1 });
  return asset({ name: 'torfluegel', variante, geometrie: b.geometry(), kollision: [], anker: { griff: { x: 0.9, y: 1.4, z: 0.125 } }, masse: { breite: 2.4, tiefe: 0.25, hoehe: 4.1 } });
}
