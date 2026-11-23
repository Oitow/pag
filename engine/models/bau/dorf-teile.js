/**
 * @modul    bau-dorf-teile
 * @zweck    Dörfliche Kleinbauten als Low-Poly-Asset: begehbare Bogenbrücke, Holzstapel, Handkarren, Gemüsebeet, Anschlagbrett, Runen-Schrein, Palisade, Heuhaufen, Bootssteg
 * @api      createBruecke({seed,laenge,breite}) ; createHolzstapel({seed}) ; createKarren({seed}) ; createBeet({seed,variante 0-2}) ; createAnschlagbrett({seed}) ; createSchrein({seed}) ; createPalisade({seed,variante 0-1}) ; createHeuhaufen({seed}) ; createSteg({seed,laenge}) -> asset { name, variante, geometrie, leucht, kollision, anker, masse, dreiecke, dispose }
 * @beispiel
 *   import { createBruecke } from '../../engine/models/bau/dorf-teile.js';
 *   const br = createBruecke({ seed: 3, laenge: 10 });   // br.kollision enthält begehbare Stufen entlang z; br.anker.enden = Auf-/Abgang
 * @tags     bau, dorf, bruecke, steg, beet, palisade, schrein, anschlagbrett, asset, lowpoly, mittelalter
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import { createMeshBuilder } from '../../render/mesh-builder.js';
import { rng, hashSeed } from '../../core/rng.js';
import { pultdach } from './bau-teile.js';
import { FARBEN as F, kasten, kreis, asset } from './bau-basis.js';

const baue = (name, seed, v = 0) => ({ b: createMeshBuilder({ seed: hashSeed(name, seed, v) }), r: rng(hashSeed(name, seed, v + 77)) });

/** Balken in der Y/Z-Ebene bei x von (ya, za) nach (yb, zb): Breite w (x), Dicke h. */
function balken(b, x, ya, za, yb, zb, w, h, farbe, t = {}) {
  const len = Math.hypot(yb - ya, zb - za);
  return b.box(w, h, len, farbe, { x, y: (ya + yb) / 2, z: (za + zb) / 2, rx: -Math.atan2(yb - ya, zb - za), ...t });
}

/** Holzbrücke entlang z, Mitte +0.6 m (Parabelbogen), Geländer + Pfosten; begehbar in 0.5-m-Stufen. anker.enden = [{x,z}] Auf-/Abgang. */
export function createBruecke({ seed = 1, laenge = 10, breite = 3 } = {}) {
  const { b, r } = baue('bruecke', seed), L = laenge, B = breite, n = Math.max(4, Math.round(L / 0.5));
  const top = (z) => 0.6 * (1 - (2 * z / L) ** 2), kollision = [], zs = (i) => -L / 2 + (i * L) / n;
  for (let i = 0; i < n; i++) {
    const z0 = zs(i), z1 = zs(i + 1), zc = (z0 + z1) / 2;
    balken(b, 0, top(z0) - 0.07, z0, top(z1) - 0.07, z1, B, 0.14, i % 2 ? F.holzHell : F.holz, { z: zc + (r() - 0.5) * 0.02, y: top(zc) - 0.07 });
    kollision.push(kasten(0, zc, B / 2, (z1 - z0) / 2, 0.25, { begehbar: true, y0: top(zc) - 0.25 }));
  }
  for (let i = 0; i < n; i += 2) for (const s of [-1, 1]) {   // Tragbalken unten, Handlauf oben
    const z0 = zs(i), z1 = zs(Math.min(n, i + 2)), x = s * (B / 2 - 0.4), xr = s * (B / 2 - 0.08);
    balken(b, x, top(z0) - 0.27, z0, top(z1) - 0.27, z1, 0.2, 0.22, F.holzDunkel);
    balken(b, xr, top(z0) + 0.95, z0, top(z1) + 0.95, z1, 0.1, 0.1, F.holz, { rz: s * (r() - 0.5) * 0.05 });
  }
  for (let i = 0; i <= n; i += 4) for (const s of [-1, 1]) {
    const z = zs(i), h = 1.1 + r() * 0.08;
    b.box(0.13, h, 0.13, F.holzDunkel, { x: s * (B / 2 - 0.08), z, y: top(z) + h / 2 - 0.1, rz: (r() - 0.5) * 0.06 });
  }
  const gr = Math.max(1, Math.round(L / 2.5));   // Geländer als nicht begehbare Kästen
  for (let i = 0; i < gr; i++) for (const s of [-1, 1]) {
    const zc = -L / 2 + (i + 0.5) * L / gr;
    kollision.push(kasten(s * (B / 2 - 0.08), zc, 0.07, L / gr / 2, 1.0, { y0: top(zc) }));
  }
  return asset({ name: 'bruecke', geometrie: b.geometry(), kollision, anker: { enden: [{ x: 0, z: -L / 2 }, { x: 0, z: L / 2 }] },
    masse: { breite: B, tiefe: L, hoehe: 1.67 } });
}

/** Brennholz 1.6 × 0.8 unter Pultdach auf vier Pfosten; Scheite quer (Hirnholz vorn). */
export function createHolzstapel({ seed = 1 } = {}) {
  const { b, r } = baue('holzstapel', seed);
  for (const [x, z] of [[-0.74, -0.34], [0.74, -0.34], [-0.74, 0.34], [0.74, 0.34]]) b.box(0.1, 1.3, 0.1, F.holzDunkel, { x, z, y: 0.65 });
  for (let row = 0; row < 4; row++) for (let i = 0; i < 6 - (row % 2); i++)
    b.cyl(0.1, 0.1, 0.62, (i + row) % 3 ? F.holz : F.holzHell, { x: (i - 2.5 + (row % 2) * 0.5) * 0.24, y: 0.12 + row * 0.2, rx: Math.PI / 2,
      z: (r() - 0.5) * 0.05 }, 5);
  pultdach(b, { x0: -0.8, x1: 0.8, z0: -0.4, z1: 0.4, yHoch: 1.4, yTief: 1.25, farbe: F.dachSchiefer, dick: 0.1, fall: 'z', jitter: 0.1 });
  return asset({ name: 'holzstapel', geometrie: b.geometry(), kollision: [kasten(0, 0, 0.8, 0.4, 1.3)], masse: { breite: 1.6, tiefe: 0.8, hoehe: 1.5 } });
}

/** Handkarren 2.2 m lang (z): Ladekasten, zwei Speichenräder, Deichselholme hinten (-z), Stütze vorn. */
export function createKarren({ seed = 1 } = {}) {
  const { b, r } = baue('karren', seed);
  b.box(0.9, 0.08, 1.1, F.holz, { y: 0.62, z: 0.3 });
  for (const s of [-1, 1]) {
    b.box(0.06, 0.28, 1.1, F.holzDunkel, { x: s * 0.45, y: 0.78, z: 0.3 });
    b.box(0.9, 0.28, 0.06, F.holzDunkel, { z: 0.3 + s * 0.55, y: 0.78 });
    b.cyl(0.4, 0.4, 0.07, F.holzDunkel, { x: s * 0.55, y: 0.4, z: 0.25, rz: Math.PI / 2 }, 8);
    b.box(0.09, 0.8, 0.06, F.holzHell, { x: s * 0.56, y: 0.4, z: 0.25, rx: r() * 3 });
    b.box(0.09, 0.06, 0.8, F.holzHell, { x: s * 0.56, y: 0.4, z: 0.25, rx: r() * 3 });
    balken(b, s * 0.35, 0.6, -0.2, 0.9, -1.1, 0.07, 0.07, F.holz);
  }
  b.box(0.8, 0.07, 0.07, F.holz, { y: 0.9, z: -1.1 });
  b.box(0.07, 0.55, 0.07, F.holzDunkel, { x: 0.3, y: 0.3, z: 0.8, rz: 0.1 });
  b.box(0.07, 0.55, 0.07, F.holzDunkel, { x: -0.3, y: 0.3, z: 0.8, rz: -0.1 });
  return asset({ name: 'karren', geometrie: b.geometry(), kollision: [kasten(0, 0.3, 0.6, 0.6, 1.0)], masse: { breite: 1.21, tiefe: 2.0, hoehe: 0.94 } });
}

/** Gemüsebeet 3 × 1.5: Erde mit Brettrahmen, drei Reihen. variante 0 Kohl, 1 Lauch, 2 Kürbis. Keine Kollision. */
export function createBeet({ seed = 1, variante = 0 } = {}) {
  const v = Math.max(0, Math.min(2, variante | 0)), { b, r } = baue('beet', seed, v);
  b.box(2.9, 0.16, 1.4, F.holzDunkel, { y: 0.08, jitter: 0.12 });
  for (const s of [-1, 1]) { b.box(3, 0.22, 0.1, F.holz, { z: s * 0.7, y: 0.11 }); b.box(0.1, 0.22, 1.5, F.holz, { x: s * 1.45, y: 0.11 }); }
  for (let row = 0; row < 3; row++) {
    const z = (row - 1) * 0.45;
    b.box(2.7, 0.07, 0.3, F.steinDunkel, { y: 0.17, z, jitter: 0.15 });
    for (let i = 0; i < 6 - (v === 2 ? 1 : 0); i++) {
      const x = (i - (v === 2 ? 2 : 2.5)) * (v === 2 ? 0.55 : 0.46) + (r() - 0.5) * 0.08, g = r() > 0.5 ? F.stoffGruen : F.putzDunkel;
      if (v === 0) b.ico(0.19, r() > 0.4 ? F.stoffGruen : '#6f9a50', { x, z, y: 0.3, sy: 0.85, ry: r() * 6 });
      else if (v === 1) { b.cone(0.07, 0.55, F.stoffGruen, { x, z, y: 0.45, rz: (r() - 0.5) * 0.3 }, 4); b.cone(0.05, 0.4, '#6f9a50', { x: x + 0.05, z, y: 0.4, rz: -0.25 }, 4); }
      else { b.ico(0.2, i % 2 ? F.stoffGelb : F.dachRot, { x, z, y: 0.3, sy: 0.75, ry: r() * 6 }); b.box(0.12, 0.1, 0.12, g, { x, z, y: 0.5 }); }
    }
  }
  return asset({ name: 'beet', variante: v, geometrie: b.geometry(), masse: { breite: 3, tiefe: 1.5, hoehe: [0.44, 0.72, 0.55][v] } });
}

/** Anschlagbrett: zwei Pfosten, Brett mit Pultdach, vier Zettel; anker.interaktion = { x: 0, z: 0.8 }. */
export function createAnschlagbrett({ seed = 1 } = {}) {
  const { b, r } = baue('anschlagbrett', seed);
  for (const s of [-1, 1]) b.box(0.14, 2.2, 0.14, F.holzDunkel, { x: s * 0.75, y: 1.0, rz: s * 0.01 });
  b.box(1.6, 1.0, 0.07, F.holz, { y: 1.45, z: 0.02 });
  b.box(1.7, 0.08, 0.1, F.holzDunkel, { y: 1.0, z: 0.03 }); b.box(1.7, 0.08, 0.1, F.holzDunkel, { y: 1.9, z: 0.03 });
  pultdach(b, { x0: -0.95, x1: 0.95, z0: -0.1, z1: 0.35, yHoch: 2.35, yTief: 2.2, farbe: F.dachRot, dick: 0.08, fall: 'z' });
  [[-0.45, 1.65], [0.3, 1.7], [-0.15, 1.3], [0.5, 1.35]].forEach(([x, y], i) =>
    b.box(0.34, 0.4, 0.02, i % 2 ? F.putz : F.putzDunkel, { x, y, z: 0.07, rz: (r() - 0.5) * 0.25, jitter: 0.1 }));
  return asset({ name: 'anschlagbrett', geometrie: b.geometry(), kollision: [kasten(0, 0.02, 0.85, 0.1, 2.2)],
    anker: { interaktion: { x: 0, z: 0.8 } }, masse: { breite: 1.9, tiefe: 0.46, hoehe: 2.43 } });
}

/** Bindestein/Wegschrein 1.8 m: Stufensockel, schiefer Stein, drei Runen (leucht, bläulich); anker.licht, anker.interaktion = { x: 0, z: 1.1 }. */
export function createSchrein({ seed = 1 } = {}) {
  const { b, r } = baue('schrein', seed), l = createMeshBuilder({ seed: hashSeed('schrein-l', seed), jitter: 0 });
  b.cyl(0.8, 0.9, 0.2, F.steinDunkel, { y: 0.1 }, 6);
  b.cyl(0.3, 0.5, 1.5, F.stein, { y: 0.95, ry: Math.PI / 5, rz: (r() - 0.5) * 0.04 }, 5);
  b.ico(0.4, F.steinHell, { y: 1.62, sy: 0.55, ry: r() * 3 });
  for (let i = 0; i < 3; i++) {
    const y = 0.7 + i * 0.3, ap = 0.81 * (0.5 - 0.2 * (y - 0.2) / 1.5);
    l.box(0.1 + (i === 1 ? 0.12 : 0), 0.18, 0.03, F.kristall, { y, z: ap + 0.012, rz: (i - 1) * 0.3 });
  }
  return asset({ name: 'schrein', geometrie: b.geometry(), leucht: l.geometry(), kollision: [kreis(0, 0, 0.5, 1.8)],
    anker: { licht: [{ x: 0, y: 1.2, z: 0.6, farbe: F.kristall, staerke: 0.9 }], interaktion: { x: 0, z: 1.1 } },
    masse: { breite: 1.56, tiefe: 1.8, hoehe: 1.8 } });
}

/** Palisade 3 m breit (reihbar entlang x), neun angespitzte Pfähle bis 2.6 m, Querholme hinten. variante 1: dichter/niedriger mit Strebe. */
export function createPalisade({ seed = 1, variante = 0 } = {}) {
  const v = variante ? 1 : 0, { b, r } = baue('palisade', seed, v);
  for (let i = 0; i < 9; i++) {
    const h = (v ? 2.1 : 2.3) + r() * (v ? 0.3 : 0.3) - (i === 4 ? 0 : 0.0), hh = i === 4 ? (v ? 2.4 : 2.6) : h;
    b.cyl(0.03, 0.16, hh, i % 2 ? F.holz : F.holzDunkel, { x: (i - 4) * 0.3333 + (r() - 0.5) * 0.02, y: hh / 2 - 0.1, rz: (r() - 0.5) * 0.04, ry: r() * 3 }, 5);
  }
  for (const y of [0.7, 1.5]) b.box(2.95, 0.12, 0.07, F.holzDunkel, { y, z: -0.17 });
  if (v) for (const s of [-1, 1]) balken(b, s * 1.2, 0.0, -0.45, 1.5, -0.17, 0.08, 0.08, F.holz);
  return asset({ name: 'palisade', variante: v, geometrie: b.geometry(), kollision: [kasten(0, 0, 1.5, 0.17, 2.3)],
    masse: { breite: 3, tiefe: v ? 0.66 : 0.38, hoehe: v ? 2.32 : 2.52 } });
}

/** Heuhaufen Ø ~2: großer und kleiner Haufen aus Stroh, Heugabel steckt schräg darin. */
export function createHeuhaufen({ seed = 1 } = {}) {
  const { b, r } = baue('heuhaufen', seed);
  b.sphere(1.0, F.stroh, { y: 0.55, sy: 0.95, ry: r() * 3, jitter: 0.1 }, 8, 6);
  b.sphere(0.6, '#b89a4c', { x: 0.75, z: 0.35, y: 0.3, sy: 0.9, jitter: 0.1 }, 7, 5);
  b.cyl(0.03, 0.03, 1.8, F.holzDunkel, { x: -0.5, y: 1.2, z: 0.55, rz: 0.35, rx: -0.2 }, 4);
  return asset({ name: 'heuhaufen', geometrie: b.geometry(), kollision: [kreis(0, 0, 0.95, 1.1)], masse: { breite: 2.25, tiefe: 1.96, hoehe: 2.04 } });
}

/** Bootssteg entlang z (Ende bei -z im Wasser), Deck 0.5 m hoch auf Pfahlpaaren, begehbar; anker.enden = [{x,z}] (Wasserende, Landseite). */
export function createSteg({ seed = 1, laenge = 8 } = {}) {
  const { b, r } = baue('steg', seed), L = laenge, W = 1.6, n = Math.max(3, Math.round(L / 0.4));
  for (let i = 0; i < n; i++) b.box(W + (r() - 0.5) * 0.08, 0.06, L / n - 0.03, i % 3 ? F.holz : F.holzHell, { z: -L / 2 + (i + 0.5) * L / n, y: 0.47, ry: (r() - 0.5) * 0.03 });
  for (const s of [-1, 1]) b.box(0.12, 0.12, L, F.holzDunkel, { x: s * 0.6, y: 0.38 });
  const np = Math.max(2, Math.round(L / 2) + 1);
  for (let i = 0; i < np; i++) for (const s of [-1, 1])
    b.cyl(0.09, 0.1, 1.15, F.holzDunkel, { x: s * 0.72, z: -L / 2 + 0.15 + i * (L - 0.3) / (np - 1), y: 0.05, rz: (r() - 0.5) * 0.05 }, 5);
  b.cyl(0.07, 0.08, 0.5, F.holz, { x: 0.82, z: -L / 2 + 0.1, y: 0.8 }, 5);
  return asset({ name: 'steg', geometrie: b.geometry(), kollision: [kasten(0, 0, W / 2, L / 2, 0.5, { begehbar: true, y0: 0.2 })],
    anker: { enden: [{ x: 0, z: -L / 2 }, { x: 0, z: L / 2 }] }, masse: { breite: 1.7, tiefe: L, hoehe: 1.05 } });
}
