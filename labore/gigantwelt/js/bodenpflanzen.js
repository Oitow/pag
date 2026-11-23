/**
 * @modul    bodenpflanzen
 * @zweck    Kleine Bodenpflanzen/Deko in echten Metern (Farn, Blumen, Pilze, Totholz, Findling), je <= 150 Dreiecke
 * @api      PFLANZEN_ARTEN ; pflanzenGeometrie(art) -> BufferGeometry (position, normal, color linear)
 * @tags     pflanzen, boden, instancing, prozedural
 * @three    ja
 */
import * as THREE from 'three';
import { Geo, tube, blob, rng32, lin } from './baeume.js';

export const PFLANZEN_ARTEN = {
  farn: { name: 'Farn', gross: 0.9, biome: ['wald'] },
  blumen: { name: 'Blumenbüschel', gross: 0.45, biome: ['wiese', 'wald'] },
  pilze: { name: 'Pilzgruppe', gross: 0.2, biome: ['wald'] },
  totholz: { name: 'Totholzstamm', gross: 3.2, biome: ['wald'] },
  findling: { name: 'Moos-Findling', gross: 1.5, biome: ['wald', 'wiese', 'fels'] },
};
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function farn() {
  const r = rng32(7), g = new Geo(), dark = lin(.10, .24, .08), tip = lin(.34, .52, .16);
  const n = 7, rows = 5;
  for (let f = 0; f < n; f++) {
    const a = f / n * 6.283 + r() * .4, len = .55 + .3 * r(), W = .1 + .03 * r();
    const fx = Math.cos(a), fz = Math.sin(a), sx = -fz, sz = fx, R = [];
    for (let k = 0; k < rows; k++) {
      const t = k / (rows - 1), d = len * t * .85 * (1 - .15 * t), y = .02 + len * .75 * (Math.sin(t * 1.9) * .62 - t * t * .1 * (1 + r() * .2)), w = W * Math.sin(Math.PI * Math.pow(t, .75) * .97) + .004;
      const c = mix(dark, tip, t * .9).map(x => x * (.85 + .3 * r() * .5));
      const ctr = [fx * d, y, fz * d], lift = w * .45;
      R.push([g.vert(ctr[0] + sx * w, y + lift, ctr[2] + sz * w, c), g.vert(ctr[0], y, ctr[2], c.map(x => x * .8)), g.vert(ctr[0] - sx * w, y + lift, ctr[2] - sz * w, c)]);
    }
    for (let k = 0; k < rows - 1; k++) {
      const A = R[k], B = R[k + 1];
      g.tri(A[0], B[0], A[1]); g.tri(A[1], B[0], B[1]);
      g.tri(A[1], B[1], A[2]); g.tri(A[2], B[1], B[2]);
    }
  }
  return g;
}

function blumen() {
  const r = rng32(13), g = new Geo(), stem = lin(.16, .34, .10), cols = [lin(.95, .80, .15), lin(.96, .96, .90), lin(.62, .38, .85)];
  for (let i = 0; i < 6; i++) {
    const a = r() * 6.283, d = .04 + .12 * r(), x = Math.cos(a) * d, z = Math.sin(a) * d, h = .3 + .2 * r(), lean = .06 * r(), la = r() * 6.283;
    const pts = [V(x, -.005, z), V(x + Math.cos(la) * lean * .4, h * .5, z + Math.sin(la) * lean * .4), V(x + Math.cos(la) * lean, h, z + Math.sin(la) * lean)];
    tube(g, pts, 3, t => .005 * (1 - .3 * t), t => stem.map(v => v * (.7 + .5 * t)), 0);
    const p = pts[2], pc = cols[i % 3], hr = .035 + .015 * r(), c = g.vert(p.x, p.y + .012, p.z, [.9, .55, .08]), ring = [];
    for (let j = 0; j < 6; j++) { const b = j / 6 * 6.283; ring.push(g.vert(p.x + Math.cos(b) * hr, p.y - .004, p.z - Math.sin(b) * hr, pc)); }
    for (let j = 0; j < 6; j++) g.tri(ring[j], ring[(j + 1) % 6], c);
    const ba = r() * 6.283, bl = .12 + .05 * r(), bx = Math.cos(ba), bz = Math.sin(ba);
    const b0 = g.vert(x - bz * .012, 0, z + bx * .012, stem.map(v => v * .6)), b1 = g.vert(x + bz * .012, 0, z - bx * .012, stem.map(v => v * .6)), b2 = g.vert(x + bx * bl, bl * .75, z + bz * bl, stem.map(v => v * 1.4));
    g.tri(b0, b1, b2); g.tri(b1, b0, b2);
  }
  return g;
}

function pilz(g, x, z, h, R, cap, rad) {
  const stem = lin(.86, .82, .70), under = lin(.7, .62, .5), pts = [V(x, -.005, z), V(x, h, z)];
  tube(g, pts, rad, t => R * .28 * (1 + .5 * (1 - t)), t => stem.map(v => v * (.7 + .3 * t)), 0);
  const ring = (y, rr, c) => { const o = []; for (let j = 0; j < rad; j++) { const a = j / rad * 6.283; o.push(g.vert(x + Math.cos(a) * rr, y, z - Math.sin(a) * rr, c)); } return o; };
  const r1 = ring(h * .96, R * .98, under), r2 = ring(h + R * .35, R * .62, cap.map(v => v * .9)), apex = g.vert(x, h + R * .5, z, cap.map(v => v * 1.1));
  for (let j = 0; j < rad; j++) {
    const j1 = (j + 1) % rad;
    g.tri(r1[j], r1[j1], r2[j]); g.tri(r1[j1], r2[j1], r2[j]); g.tri(r2[j], r2[j1], apex);
  }
}
function pilze() {
  const g = new Geo(), red = lin(.75, .14, .10), brown = lin(.50, .30, .16);
  pilz(g, 0, 0, .12, .07, red, 6); pilz(g, .11, .05, .09, .055, red, 6);
  pilz(g, -.08, .09, .07, .05, brown, 6); pilz(g, .02, -.1, .1, .06, brown, 6);
  pilz(g, -.07, -.06, .05, .035, red, 4);
  return g;
}

function totholz() {
  const r = rng32(19), g = new Geo(), bark = lin(.30, .22, .15), bark2 = lin(.17, .12, .09), cut = lin(.62, .50, .35);
  const pts = []; for (let k = 0; k <= 6; k++) { const t = k / 6; pts.push(V(-1.6 + 3.2 * t, .27 + .02 * Math.sin(t * 5), .06 * Math.sin(t * 3.1 + 1))); }
  tube(g, pts, 8, (t, a) => .3 * (1 - .22 * t) * (1 + .07 * Math.sin(a * 3 + t * 9)) * (1 + .1 * Math.exp(-t * 14)), (t, a) => mix(bark, bark2, .5 + .5 * Math.sin(a * 5 + t * 7)).map(x => x * (.8 + .4 * r() * .5)), 2);
  for (let b = 0; b < 2; b++) {
    const t = .3 + .4 * b, p = pts[Math.round(t * 6)], dir = V(.2 * (b ? 1 : -1), .9, (b ? 1 : -1) * .5).normalize();
    tube(g, [V(p.x, p.y + .15, p.z), V(p.x + dir.x * .28, p.y + .15 + dir.y * .28, p.z + dir.z * .28)], 4, t => .06 * (1 - .4 * t), () => bark2, 1);
  }
  return g;
}

function findling() {
  const r = rng32(29), g = new Geo(), gray = lin(.47, .45, .42), gray2 = lin(.33, .32, .31);
  blob(g, 0, .38, 0, .85, .55, .72, 1, r, gray, { col2: gray2, under: .5, bump: .16 });
  blob(g, .95, .15, .35, .32, .22, .28, 0, r, gray, { col2: gray2, under: .5, bump: .2 });
  return g;
}
function moosPass(geo, moss, thr) {
  const n = geo.attributes.normal, c = geo.attributes.color;
  for (let i = 0; i < n.count; i++) {
    const m = cl((n.getY(i) - thr) * 2.2) * .85;
    for (let k = 0; k < 3; k++) c.setComponent(i, k, c.getComponent(i, k) + (moss[k] * (.6 + .6 * cl(n.getY(i))) - c.getComponent(i, k)) * m);
  }
}

const BAU = { farn, blumen, pilze, totholz, findling };
const cache = new Map();
/** Pflanzen-Geometrie in Metern (Basis y=0, <=150 Dreiecke). Gecacht – nicht ändern. */
export function pflanzenGeometrie(art) {
  if (cache.has(art)) return cache.get(art);
  if (!BAU[art]) throw new Error('Unbekannte Pflanze: ' + art);
  const g = BAU[art](), geo = g.geometry();
  if (art === 'totholz') moosPass(geo, lin(.22, .38, .12), .35);
  if (art === 'findling') {
    moosPass(geo, lin(.20, .36, .10), .25);
    const p = geo.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) < -.05) p.setY(i, -.05);
  }
  if (geo.index.count / 3 > 150) throw new Error(`Budget überschritten: ${art} ${geo.index.count / 3}`);
  cache.set(art, geo); return geo;
}
