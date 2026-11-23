/**
 * @modul    baeume
 * @zweck    Riesenbäume (Höhe 1 normiert) als indizierte Geometrie je Art und LOD, für Instancing
 * @api      BAUM_ARTEN ; baumGeometrie(art, lod) -> BufferGeometry (position, normal, color linear) ; Bausteine: Geo, tube, blob, rng32, lin
 * @tags     baum, lod, instancing, prozedural
 * @three    ja
 * Budgets: LOD0 <= 1200, LOD1 <= 220, LOD2 <= 40 Dreiecke. Basis y=0, Spitze y~1, deterministisch (eigene Seed-RNG).
 */
import * as THREE from 'three';

export const BAUM_ARTEN = {
  mammut: { name: 'Mammutbaum', hoehe: [90, 120], stamm: 0.042, biome: ['wald'] },
  urwald: { name: 'Urwaldriese', hoehe: [60, 100], stamm: 0.03, biome: ['wald'] },
  eiche: { name: 'Eiche', hoehe: [30, 50], stamm: 0.035, biome: ['wald', 'wiese'] },
  kiefer: { name: 'Kiefer', hoehe: [40, 70], stamm: 0.022, biome: ['wald', 'fels'] },
  birke: { name: 'Birke', hoehe: [30, 45], stamm: 0.016, biome: ['wald', 'wiese'] },
};
export const BUDGET = [1200, 220, 40];

export function rng32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const tmpC = new THREE.Color();
/** sRGB-Wert -> lineare Farbe [r,g,b] */
export const lin = (r, g, b) => { tmpC.setRGB(r, g, b, THREE.SRGBColorSpace); return [tmpC.r, tmpC.g, tmpC.b]; };
const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/** Sammler für indizierte Geometrie */
export class Geo {
  constructor() { this.p = []; this.c = []; this.i = []; this.ov = new Map(); }
  get n() { return this.p.length / 3; }
  get tris() { return this.i.length / 3; }
  vert(x, y, z, col) { this.p.push(x, y, z); this.c.push(col[0], col[1], col[2]); return this.n - 1; }
  tri(a, b, c) { this.i.push(a, b, c); }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i); g.computeVertexNormals();
    if (this.ov.size) { const nr = g.attributes.normal; for (const [k, u] of this.ov) nr.setXYZ(k, u[0], u[1], u[2]); }
    return g;
  }
}

/** Röhre entlang Punktfolge. pts: Vector3[]; rad(t,a,y)->Radius; col(t,a,y)->Farbe; cap: 0 keine, 1 Spitze, 2 beide */
export function tube(g, pts, radial, rad, col, cap = 0) {
  const T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), rings = [];
  const m = pts.length - 1;
  for (let k = 0; k <= m; k++) {
    T.subVectors(pts[Math.min(m, k + 1)], pts[Math.max(0, k - 1)]).normalize();
    if (k === 0) { N.crossVectors(Math.abs(T.y) > .95 ? new THREE.Vector3(1, 0, 0) : up, T).normalize(); }
    else N.addScaledVector(T, -N.dot(T)).normalize();
    B.crossVectors(T, N);
    const t = k / m, ring = [];
    for (let j = 0; j < radial; j++) {
      const a = j / radial * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), r = rad(t, a, pts[k].y);
      ring.push(g.vert(pts[k].x + (N.x * c + B.x * s) * r, pts[k].y + (N.y * c + B.y * s) * r, pts[k].z + (N.z * c + B.z * s) * r, col(t, a, pts[k].y)));
    }
    rings.push(ring);
  }
  for (let k = 0; k < m; k++) for (let j = 0; j < radial; j++) {
    const j1 = (j + 1) % radial, a0 = rings[k][j], a1 = rings[k][j1], b0 = rings[k + 1][j], b1 = rings[k + 1][j1];
    g.tri(a0, a1, b0); g.tri(a1, b1, b0);
  }
  const cp = (ring, p, flip) => { const ap = g.vert(p.x, p.y, p.z, [g.c[ring[0] * 3], g.c[ring[0] * 3 + 1], g.c[ring[0] * 3 + 2]]); for (let j = 0; j < radial; j++) { const a = ring[j], b = ring[(j + 1) % radial]; flip ? g.tri(b, a, ap) : g.tri(a, b, ap); } };
  if (cap >= 1) cp(rings[m], pts[m], false);
  if (cap >= 2) cp(rings[0], pts[0], true);
  return rings;
}

// Eigenes Ikosaeder (indiziert), detail 0 = 20, 1 = 80 Dreiecke
const PHI = (1 + Math.sqrt(5)) / 2;
const IV = [[-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0], [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI], [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]]
  .map(v => { const l = Math.hypot(...v); return v.map(x => x / l); });
const IF = [1, 4, 0, 4, 9, 0, 4, 5, 9, 8, 5, 4, 1, 8, 4, 1, 10, 8, 10, 3, 8, 8, 3, 5, 3, 2, 5, 3, 7, 2, 3, 10, 7, 10, 6, 7, 6, 11, 7, 6, 0, 11, 6, 1, 0, 10, 1, 6, 11, 0, 9, 2, 11, 9, 5, 2, 9, 11, 2, 7];
export function ikosaeder(detail) {
  let v = IV.map(x => x.slice()), f = [];
  for (let i = 0; i < IF.length; i += 3) f.push([IF[i], IF[i + 2], IF[i + 1]]);
  for (let d = 0; d < detail; d++) {
    const cache = new Map(), nf = [];
    const mid = (a, b) => { const k = a < b ? a + '_' + b : b + '_' + a; if (!cache.has(k)) { const m = v[a].map((x, i) => x + v[b][i]), l = Math.hypot(...m); v.push(m.map(x => x / l)); cache.set(k, v.length - 1); } return cache.get(k); };
    for (const [a, b, c] of f) { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
    f = nf;
  }
  return { v, f };
}
const sn = (x, y, z, s) => Math.sin(x * 1.7 + s) * Math.sin(y * 1.9 + s * 1.3 + 1) * Math.sin(z * 1.6 + s * .7 + 2);

/** Verformter Ikosaeder-Cluster mit Vertexfarbe (unten dunkel = Fake-AO, Beulen heller). o: {under, tint, bump, lift, col2} */
export function blob(g, cx, cy, cz, rx, ry, rz, detail, rand, base, o = {}) {
  const { v, f } = ikosaeder(detail), sd = rand() * 50, under = o.under ?? .42, tint = .9 + .2 * rand(), bump = o.bump ?? .22;
  const col2 = o.col2 || base, ids = [];
  for (const u of v) {
    let k = 1 + bump * sn(u[0] * 2.2, u[1] * 2.2, u[2] * 2.2, sd) + bump * .5 * sn(u[0] * 5, u[1] * 5, u[2] * 5, sd * 2);
    let y = u[1]; if (y < 0) y *= .6;
    const ao = under + (1 - under) * cl(u[1] * .5 + .55), br = (1 + (k - 1) * 1.3) * tint * (o.lift ?? 1);
    const c = mix(base, col2, cl(u[1] * .8)).map(x => x * ao * br);
    const id = g.vert(cx + u[0] * rx * k, cy + y * ry * k, cz + u[2] * rz * k, c);
    if (!o.glatt) { const nl = Math.hypot(u[0] / rx, u[1] / ry, u[2] / rz); g.ov.set(id, [u[0] / rx / nl, u[1] / ry / nl, u[2] / rz / nl]); }
    ids.push(id);
  }
  for (const [a, b, c] of f) g.tri(ids[a], ids[b], ids[c]);
}

// ---- Arten ----
const SPEC = {
  mammut: {
    seed: 11, th: .88, r0: .042, r1: .006, taper: .75, flare: 1.0, kf: 20, butt: .4, nb: 7, kb: 16, ridge: .06, ridgeN: 9, sway: .008, wob: .004,
    bark: lin(.46, .21, .12), bark2: lin(.30, .13, .08), leaf: lin(.13, .29, .13), leaf2: lin(.26, .42, .17),
    from: .5, to: .86, n: 9, len: .075, tipK: .55, elLow: .2, elHigh: .9, curl: .25, reach: -.1, sub: 2, subLen: .6, levels: 1, leafR: .07, flat: .7,
    top: [.92, .045, .07], roots: 4, rootL: .035, rootR: .014, trunkR: 10, crown: [.7, .1, .3],
  },
  urwald: {
    seed: 23, th: .66, r0: .03, r1: .014, taper: .6, flare: 1.2, kf: 18, butt: 1.5, nb: 6, kb: 9, ridge: .05, ridgeN: 7, sway: .012, wob: .006,
    bark: lin(.40, .33, .24), bark2: lin(.26, .22, .16), leaf: lin(.20, .37, .11), leaf2: lin(.34, .52, .17),
    from: .56, to: .7, n: 6, len: .2, tipK: .8, elLow: .3, elHigh: .6, curl: .35, reach: .05, sub: 2, subLen: .55, levels: 1, leafR: .125, flat: .45,
    top: [.84, .13, .06], roots: 6, rootL: .07, rootR: .014, trunkR: 10, crown: [.84, .27, .1],
  },
  eiche: {
    seed: 37, th: .36, r0: .036, r1: .024, taper: .6, flare: .9, kf: 16, butt: .5, nb: 5, kb: 14, ridge: .08, ridgeN: 8, sway: .025, wob: .012,
    bark: lin(.34, .27, .19), bark2: lin(.20, .16, .11), leaf: lin(.20, .36, .10), leaf2: lin(.38, .52, .14),
    from: .26, to: .44, n: 5, len: .3, tipK: .8, elLow: .2, elHigh: .7, curl: .55, reach: .1, sub: 2, subLen: .55, levels: 2, leafR: .13, flat: .75,
    top: [.82, .13, .12], roots: 5, rootL: .045, rootR: .016, trunkR: 9, crown: [.65, .33, .27],
  },
  kiefer: {
    seed: 41, th: .92, r0: .022, r1: .004, taper: .8, flare: .7, kf: 22, butt: .25, nb: 5, kb: 20, ridge: .09, ridgeN: 6, sway: .014, wob: .006,
    bark: lin(.42, .28, .17), bark2: lin(.26, .20, .15), leaf: lin(.13, .29, .17), leaf2: lin(.24, .42, .24), barkTop: lin(.62, .36, .18),
    from: .6, to: .9, n: 7, len: .12, tipK: .6, elLow: -.05, elHigh: .45, curl: .3, reach: -.05, sub: 2, subLen: .5, levels: 1, leafR: .085, flat: .42,
    top: [.94, .15, .05], roots: 3, rootL: .03, rootR: .008, trunkR: 8, crown: [.83, .17, .13],
  },
  birke: {
    seed: 53, th: .86, r0: .016, r1: .004, taper: .8, flare: .5, kf: 26, butt: .15, nb: 4, kb: 22, ridge: .02, ridgeN: 5, sway: .03, wob: .02,
    bark: lin(.88, .86, .80), bark2: lin(.12, .11, .10), leaf: lin(.36, .54, .16), leaf2: lin(.58, .70, .26), birch: true,
    from: .35, to: .88, n: 9, len: .13, tipK: .5, elLow: .55, elHigh: 1.05, curl: .3, reach: -.15, sub: 2, subLen: .55, levels: 1, leafR: .07, flat: .85,
    top: [.93, .06, .07], roots: 0, rootL: 0, rootR: 0, trunkR: 8, crown: [.68, .12, .3],
  },
};

function bauen(S, lod, sk, detail0) {
  const r = rng32(S.seed), g = new Geo(), L = lod === 0
    ? { tr: S.trunkR, ts: 9, br: 5, bs: 2, lv: S.levels, nm: 1, ls: 1, d: detail0 }
    : lod === 1 ? { tr: 6, ts: 3, br: 3, bs: 1, lv: 0, nm: .7, ls: S.levels > 1 ? 1.7 : 1.4, d: 0 }
      : { tr: 4, ts: 1, br: 3, bs: 1, lv: 0, nm: 0, ls: 1, d: 0 };
  const V = (x, y, z) => new THREE.Vector3(x, y, z), ph = r() * 6.28, ph2 = r() * 6.28, ph3 = r() * 6.28;
  const y0 = -.012, H = S.th - y0;
  const tc = t => { const s = Math.pow(t, 1.4), w = S.wob * Math.sin(t * 5 + ph3) * t; return [S.sway * s * Math.cos(ph) + w * Math.cos(ph2), y0 + t * H, S.sway * s * Math.sin(ph) + w * Math.sin(ph2)]; };
  const trR = (t, a, y) => {
    let rr = S.r0 + (S.r1 - S.r0) * Math.pow(t, S.taper);
    const yy = Math.max(0, y);
    rr *= 1 + S.flare * Math.exp(-yy * S.kf) + S.butt * Math.exp(-yy * S.kb) * Math.pow(Math.max(0, Math.cos(a * S.nb + ph)), 3);
    return rr * (1 + S.ridge * Math.sin(a * S.ridgeN + yy * 9 + ph2));
  };
  const barkCol = (t, a, y) => {
    const yy = Math.max(0, y); let c;
    if (S.birch) { const band = Math.sin(yy * 70 + Math.sin(a * 3 + ph) * 2) * Math.sin(yy * 23 + a * 2); c = mix(S.bark, S.bark2, band > .55 ? .85 : (yy < .03 ? .6 * (1 - yy / .03) : 0)); }
    else { c = mix(S.bark, S.bark2, .5 + .5 * Math.sin(a * S.ridgeN + yy * 9 + ph2)); if (S.barkTop) c = mix(c, S.barkTop, cl((yy - .45) * 3)); }
    const ao = .5 + .5 * Math.min(1, yy * 16);
    return c.map(x => x * ao);
  };
  const pts = []; for (let k = 0; k <= L.ts; k++) { const p = tc(k / L.ts); pts.push(V(p[0], p[1], p[2])); }
  tube(g, pts, L.tr, (t, a, y) => trR(t, a, y), barkCol, lod === 2 ? 0 : 1);
  // Wurzelanläufe (nur LOD0): Bögen von der Stammbasis in den Boden
  if (lod === 0) for (let i = 0; i < S.roots; i++) {
    const a = i / S.roots * 6.283 + ph + .4 * r(), cx = Math.cos(a), cz = Math.sin(a), rp = [];
    for (let k = 0; k <= 2; k++) { const t = k / 2, o = S.r0 * (.7 + .8 * t) + S.rootL * t; rp.push(V(cx * o, .03 * (1 - t) * (1 - t) + .015 * (1 - t) - .006 * t, cz * o)); }
    tube(g, rp, 4, t => S.rootR * (1 - .7 * t), () => S.bark2.map(x => x * 1.3), 1);
  }
  const leaves = [], rn = () => r() - .5;
  const branch = (p, d, len, rad, lv) => {
    const q = p.clone(), dir = d.clone(), bp = [q.clone()];
    const bs = lv === 0 ? L.bs : 1;
    for (let k = 0; k < bs; k++) {
      dir.x += rn() * S.curl; dir.z += rn() * S.curl; dir.y += rn() * S.curl * .5 + S.reach / bs; dir.normalize();
      q.addScaledVector(dir, len / bs); bp.push(q.clone());
    }
    tube(g, bp, lv === 0 ? L.br : 4, t => rad * (1 - .65 * t), (t) => S.bark.map(x => x * (.8 + .2 * t)), 1);
    if (lv < L.lv) for (let c = 0; c < S.sub; c++) {
      const nd = dir.clone(); nd.x += rn() * 1.6; nd.z += rn() * 1.6; nd.y += .15 + .4 * r(); nd.normalize();
      branch(q, nd, len * S.subLen * (.8 + .4 * r()), rad * .5, lv + 1);
    } else leaves.push({ p: q.clone(), dir: dir.clone(), s: S.leafR * L.ls * (.8 + .4 * r()) * (lv === 0 && L.lv === 0 && S.levels > 1 ? 1.5 : 1) });
  };
  if (lod < 2) {
    const n = Math.max(3, Math.round(S.n * L.nm * sk));
    for (let i = 0; i < n; i++) {
      const f = (i + .5) / n, y = S.from + (S.to - S.from) * f, t = cl((y - y0) / H), p = tc(t), a = i * 2.399 + ph + rn() * .5;
      const el = S.elLow + (S.elHigh - S.elLow) * f, len = S.len * (1 - (1 - S.tipK) * f) * (.85 + .3 * r());
      const dir = V(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el));
      const base = V(p[0], p[1], p[2]);
      branch(base, dir, len, trR(t, 0, y) * .45 * (lod === 0 ? 1 : 1.3), 0);
    }
    for (const lf of leaves) { const s = lf.s; blob(g, lf.p.x + lf.dir.x * s * .3, lf.p.y + lf.dir.y * s * .3, lf.p.z + lf.dir.z * s * .3, s, s * S.flat, s, L.d, r, S.leaf, { col2: S.leaf2 }); }
    const T = S.top, tp = tc(cl((T[0] - y0) / H));
    blob(g, tp[0], T[0], tp[2], T[1], T[2], T[1], lod === 0 ? 1 : 0, r, S.leaf, { col2: S.leaf2, under: .55 });
  } else {
    const cc = S.crown, tp = tc(cl((cc[0] - y0) / H));
    blob(g, tp[0], cc[0], tp[2], cc[1], cc[2], cc[1], 0, r, S.leaf, { col2: S.leaf2, under: .6 });
  }
  return g;
}

const cache = new Map();
/** Baum-Geometrie, Höhe 1 (y 0..~1). art: Schlüssel aus BAUM_ARTEN, lod 0|1|2. Gecacht – nicht ändern, nur nutzen. */
export function baumGeometrie(art, lod = 0) {
  const key = art + lod; if (cache.has(key)) return cache.get(key);
  const S = SPEC[art]; if (!S) throw new Error('Unbekannte Baumart: ' + art);
  const B = BUDGET[lod]; let g;
  const tries = [[1, 1], [1, 0], [.85, 0], [.7, 0], [.55, 0], [.4, 0]];
  for (const [sk, d] of tries) { g = bauen(S, lod, sk, d); if (g.tris <= B) break; }
  if (g.tris > B) throw new Error(`Budget überschritten: ${art} LOD${lod} ${g.tris}`);
  const geo = g.geometry(); cache.set(key, geo); return geo;
}
