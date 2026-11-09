/**
 * @modul    natur-basis
 * @zweck    Gemeinsame Helfer für Natur-Assets: Dreiecke sammeln → nicht-indizierte Geometrie (position/normal/color/wind), Farben, Fake-AO, Schnee, Ast-Röhre, Laub-Blob, Kegel-Lage, Wedel
 * @api      farbe(wert) -> [r,g,b] ; mische(a,b,t) ; variiere(f,r,staerke) ; abdunkeln(f,k) ; createTeile(opts) -> teile (dreieck, quad, anzahl, geometrie, dispose) ; roehre(teile,punkte,radien,opts) ; blob(teile,mitte,radius,opts) ; kegel(teile,basis,radius,hoehe,opts) ; wedel(teile,basis,richtung,laenge,opts)
 * @beispiel
 *   import { createTeile, roehre, blob, farbe } from '../../engine/models/natur/natur-basis.js';
 *   const t = createTeile({ seed: 5 });
 *   roehre(t, [[0,0,0],[0,2,0]], [0.2, 0.1], { farbe: farbe('#6b4a2f'), wind: [0, 0.2] });
 *   blob(t, [0, 2.6, 0], 1, { farbe: farbe('#4f8a3a'), wind: 0.8 });
 *   const geo = t.geometrie();   // BufferGeometry mit position, normal, color, wind
 * @tags     natur, baum, geometrie, lowpoly, vertexfarben, wind, merge, prozedural
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
import { rng } from '../../core/rng.js';

const _c = new THREE.Color();
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Hex/CSS-Farbe → [r,g,b] im linearen Farbraum (wie THREE.Color nach set()). */
export function farbe(wert) { _c.set(wert); return [_c.r, _c.g, _c.b]; }
/** Lineares Mischen zweier Farben, t 0..1. */
export const mische = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** Helligkeit × k. */
export const abdunkeln = (f, k) => [f[0] * k, f[1] * k, f[2] * k];
/** Zufällige Variation: Helligkeit ± staerke, leichte Farbton-Verschiebung je Kanal. */
export function variiere(f, r, staerke = 0.08) {
  const k = 1 + (r() - 0.5) * 2 * staerke, s = staerke * 0.5;
  return [f[0] * k * (1 + (r() - 0.5) * s), f[1] * k * (1 + (r() - 0.5) * s), f[2] * k * (1 + (r() - 0.5) * s)];
}

/**
 * Sammler für Dreiecke. opts: { seed, jitter = 0.07 (Variation je Dreieck), ao = (x,y,z,ny) -> Faktor,
 *   schnee = 0..1 (nach oben zeigende Flächen weiß), schneeFarbe }
 * Standard-AO: Unterseiten dunkler, Oberseiten etwas heller.
 */
export function createTeile({ seed = 1, jitter = 0.07, ao = null, schnee = 0, schneeFarbe = '#f2f5fa' } = {}) {
  const r = rng(seed);
  const pos = [], col = [], wnd = [];
  const weiss = farbe(schneeFarbe);
  const aoFn = ao || ((x, y, z, ny) => 0.86 + 0.14 * ny);
  const t = {
    /** Dreieck a,b,c ([x,y,z], gegen den Uhrzeigersinn von außen), Farbe [r,g,b], Wind je Ecke. */
    dreieck(a, b, c, f, wa = 0, wb = wa, wc = wa) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const nl = Math.hypot(nx, ny, nz) || 1, ny1 = ny / nl;
      const k = 1 + (r() - 0.5) * 2 * jitter;
      let fb = f;
      if (schnee > 0 && ny1 > 0.2) fb = mische(f, weiss, clamp01(schnee * (0.55 + 0.45 * r()) * (ny1 - 0.2) / 0.5));
      for (const [p, w] of [[a, wa], [b, wb], [c, wc]]) {
        const s = k * aoFn(p[0], p[1], p[2], ny1);
        pos.push(p[0], p[1], p[2]);
        col.push(clamp01(fb[0] * s), clamp01(fb[1] * s), clamp01(fb[2] * s));
        wnd.push(clamp01(w));
      }
      return t;
    },
    /** Viereck a,b,c,d (Umlaufrichtung wie dreieck) als zwei Dreiecke. */
    quad(a, b, c, d, f, wa = 0, wb = wa, wc = wb, wd = wa) {
      t.dreieck(a, b, c, f, wa, wb, wc);
      return t.dreieck(a, c, d, f, wa, wc, wd);
    },
    /** Zufallsquelle des Sammlers (für Helfer ohne eigenes rng). */
    r,
    get anzahl() { return pos.length / 9; },
    /** Neue BufferGeometry (nicht indiziert, flache Normalen) mit position, normal, color, wind. */
    geometrie() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
      g.setAttribute('wind', new THREE.BufferAttribute(new Float32Array(wnd), 1));
      g.computeVertexNormals();
      g.computeBoundingBox();
      g.computeBoundingSphere();
      return g;
    },
    dispose() { pos.length = col.length = wnd.length = 0; },
  };
  return t;
}

// ---------- Vektor-Kleinkram ----------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function senkrecht(d) { return norm(cross(d, Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])); }

/**
 * Verjüngte Röhre entlang eines Pfads (Ast/Stamm). punkte [[x,y,z]…], radien je Punkt.
 * opts: { seiten = 5, farbe | farbeFn(ring, seite) -> [r,g,b], wind: [je Punkt] | Zahl, knorrig = 0 (Radius-Rauschen),
 *   spitze = true (Ende mit Spitze schließen), r (rng, sonst teile.r), drehung }
 */
export function roehre(teile, punkte, radien, opts = {}) {
  const n = punkte.length; if (n < 2) return;
  const s = Math.max(3, opts.seiten ?? 5), r = opts.r || teile.r, kn = opts.knorrig ?? 0;
  const fFn = opts.farbeFn || (() => opts.farbe || [0.3, 0.2, 0.1]);
  const w = (i) => (Array.isArray(opts.wind) ? opts.wind[i] : opts.wind ?? 0);
  const ringe = [];
  let tang = norm(sub(punkte[1], punkte[0])), nrm = senkrecht(tang);
  const dreh = opts.drehung ?? r() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const neu = norm(sub(punkte[Math.min(i + 1, n - 1)], punkte[Math.max(i - 1, 0)]));
    // Parallel-Transport: Normale auf neue Tangente projizieren
    nrm = norm(add(nrm, neu, -dot(nrm, neu))); tang = neu;
    const bin = cross(tang, nrm), ring = [];
    for (let j = 0; j < s; j++) {
      const a = dreh + (j / s) * Math.PI * 2, rad = radien[i] * (1 + (kn ? (r() - 0.5) * 2 * kn : 0));
      const ca = Math.cos(a) * rad, sa = Math.sin(a) * rad;
      ring.push([punkte[i][0] + nrm[0] * ca + bin[0] * sa, punkte[i][1] + nrm[1] * ca + bin[1] * sa, punkte[i][2] + nrm[2] * ca + bin[2] * sa]);
    }
    ringe.push(ring);
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < s; j++) {
    const j2 = (j + 1) % s;
    teile.quad(ringe[i][j], ringe[i][j2], ringe[i + 1][j2], ringe[i + 1][j], fFn(i, j), w(i), w(i), w(i + 1), w(i + 1));
  }
  if (opts.spitze !== false) {
    const d = norm(sub(punkte[n - 1], punkte[n - 2]));
    const tip = add(punkte[n - 1], d, radien[n - 1] * 1.5);
    for (let j = 0; j < s; j++) teile.dreieck(ringe[n - 1][j], ringe[n - 1][(j + 1) % s], tip, fFn(n - 1, j), w(n - 1));
  }
}

// Ikosaeder-Grundformen (Ecken + Flächen), Unterteilung on demand gecacht
const ICO = (() => {
  const g = new THREE.IcosahedronGeometry(1, 0), p = g.attributes.position.array, out = [];
  for (let i = 0; i < p.length; i += 9) out.push([[p[i], p[i + 1], p[i + 2]], [p[i + 3], p[i + 4], p[i + 5]], [p[i + 6], p[i + 7], p[i + 8]]]);
  g.dispose(); return out;
})();
const icoCache = new Map([[0, ICO]]);
function icoFlaechen(stufe) {
  if (icoCache.has(stufe)) return icoCache.get(stufe);
  const g = new THREE.IcosahedronGeometry(1, stufe), p = g.attributes.position.array, out = [];
  for (let i = 0; i < p.length; i += 9) out.push([[p[i], p[i + 1], p[i + 2]], [p[i + 3], p[i + 4], p[i + 5]], [p[i + 6], p[i + 7], p[i + 8]]]);
  g.dispose(); icoCache.set(stufe, out); return out;
}

/**
 * Verformter Ikosaeder-Blob (Laubballen, Busch, Stein). mitte [x,y,z], radius.
 * opts: { stufe = 0 (20 Dreiecke) | 1 (80), sx, sy, sz (Streckung), verformung = 0.25, drehung (um Y),
 *   farbe | farbeFn(normaleY) , wind (Zahl, oben +0.15), unten = 0 (Unterseite abflachen 0..1), r }
 */
export function blob(teile, mitte, radius, opts = {}) {
  const r = opts.r || teile.r, vf = opts.verformung ?? 0.25, stufe = opts.stufe ?? 0;
  const sx = opts.sx ?? 1, sy = opts.sy ?? 1, sz = opts.sz ?? 1, unten = opts.unten ?? 0;
  const dr = opts.drehung ?? r() * Math.PI * 2, cd = Math.cos(dr), sd = Math.sin(dr);
  const w0 = opts.wind ?? 0, fFn = opts.farbeFn || (() => opts.farbe || [0.2, 0.4, 0.15]);
  const versatz = new Map();   // gleiche Ecke → gleiche Verformung (keine Risse)
  const ecke = (v) => {
    const key = `${Math.round(v[0] * 1e3)},${Math.round(v[1] * 1e3)},${Math.round(v[2] * 1e3)}`;
    let k = versatz.get(key);
    if (k === undefined) { k = 1 + (r() - 0.5) * 2 * vf; versatz.set(key, k); }
    let y = v[1] * k * sy; if (y < 0) y *= 1 - unten;
    const x = v[0] * k * sx, z = v[2] * k * sz;
    return [mitte[0] + (x * cd - z * sd) * radius, mitte[1] + y * radius, mitte[2] + (x * sd + z * cd) * radius];
  };
  for (const [a, b, c] of icoFlaechen(stufe)) {
    const ny = (a[1] + b[1] + c[1]) / 3;
    teile.dreieck(ecke(a), ecke(b), ecke(c), fFn(ny), w0 + 0.15 * a[1], w0 + 0.15 * b[1], w0 + 0.15 * c[1]);
  }
}

/**
 * Kegel-Lage (Nadelbaum-Etage): Spitze oben, Rand gezackt/hängend, Unterseite flach eingezogen.
 * opts: { seiten = 7, farbe, unterFarbe, zacken = 0.15, haengen = 0 (Rand absenken, Meter), drehung,
 *   windUnten = 0.3, windOben = 0.5, r }
 */
export function kegel(teile, basis, radius, hoehe, opts = {}) {
  const r = opts.r || teile.r, s = Math.max(3, opts.seiten ?? 7), z = opts.zacken ?? 0.15;
  const f = opts.farbe || [0.1, 0.3, 0.12], fu = opts.unterFarbe || abdunkeln(f, 0.55);
  const dr = opts.drehung ?? r() * Math.PI * 2, wu = opts.windUnten ?? 0.3, wo = opts.windOben ?? 0.5;
  const spitze = [basis[0], basis[1] + hoehe, basis[2]];
  const innen = [basis[0], basis[1] + hoehe * 0.22, basis[2]];
  const rand = [];
  for (let j = 0; j < s; j++) {
    const a = dr + (j / s) * Math.PI * 2, rr = radius * (1 + (r() - 0.5) * 2 * z);
    rand.push([basis[0] + Math.cos(a) * rr, basis[1] - (opts.haengen ?? 0) * (0.6 + 0.8 * r()), basis[2] + Math.sin(a) * rr]);
  }
  for (let j = 0; j < s; j++) {
    const a = rand[j], b = rand[(j + 1) % s];
    teile.dreieck(b, a, spitze, f, wu, wu, wo);
    teile.dreieck(a, b, innen, fu, wu, wu, wo * 0.6);
  }
}

/**
 * Gefalteter Blattwedel (Palme, Farn): Mittelrippe von basis in richtung (normiert), biegt sich nach unten.
 * opts: { segmente = 4, breite = 0.25 × laenge, haengen = 0.6 (Biegung), falte = 0.3, farbe, spitzenFarbe, windBasis = 0.4,
 *   doppelseitig = true (Rückseite dunkler mitbauen, nötig ohne DoubleSide-Material) }
 * Dreiecke: segmente × 4 (× 2 doppelseitig).
 */
export function wedel(teile, basis, richtung, laenge, opts = {}) {
  const n = opts.segmente ?? 4, br = opts.breite ?? laenge * 0.25, h = opts.haengen ?? 0.6, fa = opts.falte ?? 0.3;
  const f = opts.farbe || [0.15, 0.4, 0.1], fs = opts.spitzenFarbe || f, wb = opts.windBasis ?? 0.4;
  const zwei = opts.doppelseitig !== false;
  const d = norm(richtung), seite = norm(cross(d, [0, 1, 0])), hoch = norm(cross(seite, d));
  const eps = laenge * 0.012, unter = (p) => add(p, hoch, -eps);   // Rückseite leicht versetzt (kein Z-Fighting)
  const dr = (a, b, c, fc, x, y, z) => {
    teile.dreieck(a, b, c, fc, x, y, z);
    if (zwei) teile.dreieck(unter(a), unter(c), unter(b), abdunkeln(fc, 0.7), x, z, y);
  };
  const rippe = [], breite = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = add(add(basis, d, laenge * t), [0, 1, 0], -h * laenge * t * t);
    rippe.push(p); breite.push(br * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.95)) * (i === n ? 0 : 1));
  }
  for (let i = 0; i < n; i++) {
    const t = i / n, fc = mische(f, fs, t), w1 = wb + (1 - wb) * t, w2 = wb + (1 - wb) * (i + 1) / n;
    for (const sg of [1, -1]) {
      const kante = (k) => add(add(rippe[k], seite, sg * breite[k]), hoch, -fa * breite[k]);
      const a = rippe[i], b = rippe[i + 1], c = kante(i + 1), e = kante(i);
      if (sg > 0) { dr(a, e, c, fc, w1, w1, w2); dr(a, c, b, fc, w1, w2, w2); }
      else { dr(a, c, e, fc, w1, w2, w1); dr(a, b, c, fc, w1, w2, w2); }
    }
  }
}
