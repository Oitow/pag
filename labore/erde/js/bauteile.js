// Bauteil-Geometrien fürs Bauen im Erde-Labor: Low-Poly, Vertexfarben, Holz/Stein, echte Maße (Raster 2 m, Wand 2 × 2,4 m).
// Bezugspunkt wie in bauen-regeln.js: Fundament/Boden = Oberkante Mitte, sonst Unterkante Mitte; +y oben, +z = „vorn“ des Teils.
// Dach steigt von z = −1 (y = 0) nach z = +1 (y = DACH_HUB), Treppe ebenso bis WAND_H.
import * as THREE from 'three';
import { createMeshBuilder } from '../../../engine/render/mesh-builder.js';
import { createLagerfeuer } from '../../../engine/models/bau/licht.js';
import { WAND_H, DACH_HUB, FUND_TIEFE } from './bauen-regeln.js';

// gedämpfte Palette (Art-Direction: entsättigt, kein Spielzeug)
const F = { stein: '#7d786e', steinHell: '#97918a', steinDunkel: '#625e57', holz: '#66503c', holzHell: '#7a6450', holzDunkel: '#4a3a2c',
  schindel: '#4d4338', schindelHell: '#5e5345', eisen: '#3a3c40' };

/** Rechtwinkliges Keil-Prisma (Giebeldreieck): Dreieck (z0,0)–(z1,0)–(z1,hub) in der yz-Ebene, Dicke d in x. */
function keil(z0, z1, hub, d) {
  const h = d / 2, A = (x) => [x, 0, z0], B = (x) => [x, 0, z1], C = (x) => [x, hub, z1];
  const tri = [A(h), C(h), B(h), A(-h), B(-h), C(-h), A(-h), A(h), B(h), A(-h), B(h), B(-h),
    B(-h), B(h), C(h), B(-h), C(h), C(-h), A(-h), C(-h), C(h), A(-h), C(h), A(h)];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tri.flat(), 3));
  return g;
}

function fundament(b) {
  b.box(2, FUND_TIEFE - 0.15, 2, F.steinDunkel, { y: -(FUND_TIEFE + 0.15) / 2 });
  for (const [x, z, k] of [[-0.5, -0.5, 0], [0.5, -0.5, 1], [-0.5, 0.5, 1], [0.5, 0.5, 0]]) b.box(0.96, 0.16, 0.96, k ? F.stein : F.steinHell, { x, z, y: -0.08 });
}
function boden(b) {
  for (let i = 0; i < 5; i++) b.box(0.38, 0.07, 2, i % 2 ? F.holz : F.holzHell, { x: -0.8 + i * 0.4, y: -0.035 });
  for (const z of [-0.7, 0.7]) b.box(2, 0.13, 0.14, F.holzDunkel, { y: -0.135, z });
}
// Blockbohlen: 8 liegende Stämme Ø 0,31 m, Eckpfosten
function stamm(b, x0, x1, y, k) { b.cyl(0.155, 0.155, x1 - x0, k % 2 ? F.holz : F.holzHell, { x: (x0 + x1) / 2, y, rz: Math.PI / 2, rx: k * 0.7 }, 7); }
function wand(b, tuer = 0) {
  for (let k = 0; k < 8; k++) {
    const y = 0.15 + k * 0.3;
    if (tuer && k < 7) { stamm(b, -1, -tuer, y, k); stamm(b, tuer, 1, y, k + 1); } else stamm(b, -1, 1, y, k);
  }
  for (const x of [-0.93, 0.93]) b.box(0.18, WAND_H, 0.26, F.holzDunkel, { x, y: WAND_H / 2 });
  if (tuer) {
    for (const x of [-tuer - 0.05, tuer + 0.05]) b.box(0.12, 2.1, 0.28, F.holzDunkel, { x, y: 1.05 });
    b.box(tuer * 2 + 0.3, 0.14, 0.3, F.holzDunkel, { y: 2.1 });
    b.box(tuer * 2, 0.05, 0.3, F.holzDunkel, { y: 0.025 });   // Schwelle
  }
}
function dach(b) {
  const L = Math.hypot(2, DACH_HUB), a = Math.atan2(DACH_HUB, 2), d = [0, Math.sin(a), Math.cos(a)], n = [0, Math.cos(a), -Math.sin(a)];
  const auf = (s, h) => ({ x: 0, y: DACH_HUB / 2 + d[1] * s + n[1] * h, z: d[2] * s + n[2] * h, rx: -a });
  b.box(2.08, 0.06, L + 0.5, F.holzDunkel, auf(-0.25, 0.03));   // Schalung mit Traufe 0,5 m
  const reihen = 6, lang = (L + 0.55) / reihen;
  for (let i = 0; i < reihen; i++) {   // Schindelreihen, unten überlappend
    const s = -L / 2 - 0.5 + lang * (i + 0.5) + 0.02;
    b.box(2.1, 0.06, lang + 0.12, i % 2 ? F.schindel : F.schindelHell, { ...auf(s, 0.09 - i * 0.002), rx: -a + 0.05 });
  }
  b.cyl(0.11, 0.11, 2.1, F.holzDunkel, { y: DACH_HUB, z: 1, rz: Math.PI / 2 }, 6);   // Firstbalken
  for (const x of [-0.97, 0.97]) b.add(keil(-1, 1, DACH_HUB, 0.06), F.holz, { x });   // Giebel (innen = Binder)
}
function treppe(b) {
  const n = 8, tief = 2 / n, hoch = WAND_H / n, L = Math.hypot(2, WAND_H), a = Math.atan2(WAND_H, 2);
  for (let k = 0; k < n; k++) b.box(1.8, 0.07, tief + 0.05, k % 2 ? F.holz : F.holzHell, { y: hoch * (k + 1) - 0.035, z: -1 + tief * (k + 0.5) });
  for (const x of [-0.95, 0.95]) b.box(0.1, 0.26, L, F.holzDunkel, { x, y: WAND_H / 2 - 0.12, rx: -a });
  for (const x of [-0.95, 0.95]) b.box(0.12, WAND_H - 0.1, 0.12, F.holzDunkel, { x, y: (WAND_H - 0.1) / 2, z: 0.94 });
}
function werkbank(b) {
  b.box(1.6, 0.1, 0.8, F.holzHell, { y: 0.9 });
  for (const [x, z] of [[-0.7, -0.3], [0.7, -0.3], [-0.7, 0.3], [0.7, 0.3]]) b.box(0.1, 0.85, 0.1, F.holzDunkel, { x, z, y: 0.425 });
  b.box(1.5, 0.05, 0.6, F.holz, { y: 0.25 });
  b.cyl(0.2, 0.2, 0.09, F.stein, { x: 0.35, y: 0.48, rx: Math.PI / 2 }, 9);   // Schleifstein
  b.box(0.2, 0.18, 0.3, F.eisen, { x: -0.62, y: 1.04, z: -0.2 });          // Schraubstock
  b.box(0.5, 0.12, 0.14, F.holz, { x: 0.1, y: 1.01, z: 0.1, ry: 0.3 });     // Werkstück
  b.cyl(0.02, 0.02, 0.55, F.holzDunkel, { x: 0.45, y: 0.97, z: -0.15, rz: Math.PI / 2, ry: -0.5 }, 5);   // Axtstiel
  b.box(0.12, 0.04, 0.16, F.eisen, { x: 0.68, y: 0.97, z: -0.29, ry: -0.5 });
}

const BAUER = { fundament, boden, wand: (b) => wand(b), tuerwand: (b) => wand(b, 0.55), dach, treppe, werkbank };
const cache = new Map();

/** Geometrie je Bauteil-Art (gecacht, nicht einzeln disposen) → { geo, leucht? } (leucht = Flammen fürs Lagerfeuer). */
export function bauteilGeometrie(art) {
  if (cache.has(art)) return cache.get(art);
  let g;
  if (art === 'lagerfeuer') { const a = createLagerfeuer({ seed: 3 }); g = { geo: a.geometrie, leucht: a.leucht }; }
  else { const b = createMeshBuilder({ seed: art.length * 17, jitter: 0.08 }); BAUER[art](b); g = { geo: b.geometry() }; }
  cache.set(art, g);
  return g;
}

export function disposeBauteile() { for (const g of cache.values()) { g.geo.dispose(); g.leucht?.dispose(); } cache.clear(); }
