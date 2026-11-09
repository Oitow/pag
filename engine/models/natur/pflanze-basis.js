/**
 * @modul    pflanze-basis
 * @zweck    Sammler für Pflanzen-Geometrie: Dreiecke (ein-/zweiseitig, nach außen ausgerichtet), Bänder, Rohre, verformte Laubballen → EINE BufferGeometry mit position, normal, color, wind
 * @api      createSammler({seed, jitter}) -> s (dreieck, dreieckAussen, dreieckZwei, band, rohr, ballen, geometrie, masse, ergebnis, dreiecke, r) ; bogen3(pkt, winkel, basis) -> [[x,y,z]…] ; seiteZu(winkel) -> [x,0,z]
 * @beispiel
 *   import { createSammler, bogen3 } from '../../engine/models/natur/pflanze-basis.js';
 *   const s = createSammler({ seed: 3 });
 *   s.ballen([0, 0.5, 0], [0.5, 0.4, 0.5], 7, 4, () => [0.3, 0.6, 0.2], (y) => y);
 *   const { geometrie, hoehe } = s.ergebnis({ stammRadius: 0.2 });
 * @tags     natur, pflanze, geometrie, lowpoly, vertexfarben, wind
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
import { rng } from '../../core/rng.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const kreuz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const punkt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** Seitenvektor (waagerecht, senkrecht zur Blickrichtung winkel um y). */
export const seiteZu = (w) => [-Math.sin(w), 0, Math.cos(w)];
/** 2D-Bogen [[h,y]…] (aus pflanze-formen) in Richtung winkel um y aufstellen. */
export const bogen3 = (pkt, w, b = [0, 0, 0]) => pkt.map(([h, y]) => [b[0] + Math.cos(w) * h, b[1] + y, b[2] + Math.sin(w) * h]);

/** Sammler; opts: { seed = 1, jitter = 0.08 (Farbvariation je Dreieck) }. */
export function createSammler({ seed = 1, jitter = 0.08 } = {}) {
  const r = rng(seed);
  const pos = [], col = [], wind = [];
  const w3 = (w) => (Array.isArray(w) ? w : [w, w, w]);

  function roh(a, b, c, f, w) {
    const k = 1 + (r() - 0.5) * 2 * jitter, kr = (r() - 0.5) * jitter * 0.5;
    const ww = w3(w);
    for (const [i, p] of [a, b, c].entries()) {
      pos.push(p[0], p[1], p[2]);
      col.push(Math.min(1, f[0] * k * (1 + kr)), Math.min(1, f[1] * k), Math.min(1, f[2] * k * (1 - kr)));
      wind.push(Math.max(0, Math.min(1, ww[i])));
    }
  }

  const s = {
    r,
    /** Dreieck in gegebener Windung (gegen den Uhrzeigersinn = Vorderseite). f = [r,g,b] sRGB, w = Zahl oder [wa,wb,wc]. */
    dreieck(a, b, c, f, w = 0) { roh(a, b, c, f, w); return s; },
    /** Dreieck, dessen Vorderseite von innen weg zeigt. */
    dreieckAussen(a, b, c, innen, f, w = 0) {
      const n = kreuz(sub(b, a), sub(c, a));
      const m = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
      if (punkt(n, sub(m, innen)) >= 0) roh(a, b, c, f, w);
      else { const ww = w3(w); roh(a, c, b, f, [ww[0], ww[2], ww[1]]); }
      return s;
    },
    /** Zweiseitiges Dreieck (Blatt): Oberseite zeigt Richtung oben (Standard +y), Unterseite fUnten (Standard 0,75·f). */
    dreieckZwei(a, b, c, f, w = 0, fUnten = null, oben = [0, 1, 0]) {
      const n = kreuz(sub(b, a), sub(c, a));
      const ww = w3(w), wv = [ww[0], ww[2], ww[1]];
      const fu = fUnten || [f[0] * 0.72, f[1] * 0.72, f[2] * 0.72];
      if (punkt(n, oben) >= 0) { roh(a, b, c, f, ww); roh(a, c, b, fu, wv); } else { roh(a, c, b, f, wv); roh(a, b, c, fu, ww); }
      return s;
    },
    /**
     * Band entlang mitte[] (3D), Halbbreite breite[i] quer in Richtung seite[i] (3D oder ein Vektor für alle).
     * breite 0 am Ende → Spitze. farbeFn(i, t) → [r,g,b] je Segment; windFn(t) → 0..1. zwei = beidseitig.
     */
    band(mitte, seite, breite, farbeFn, windFn, { zwei = true, oben = [0, 1, 0] } = {}) {
      const n = mitte.length - 1;
      const sv = (i) => (Array.isArray(seite[0]) ? seite[i] : seite);
      const L = (i) => mitte[i].map((v, k) => v - sv(i)[k] * breite[i]);
      const R = (i) => mitte[i].map((v, k) => v + sv(i)[k] * breite[i]);
      const add = zwei ? (a, b, c, f, w) => s.dreieckZwei(a, b, c, f, w, null, oben) : (a, b, c, f, w) => s.dreieckAussen(a, b, c, sub(a, oben), f, w);
      for (let i = 0; i < n; i++) {
        const f = farbeFn(i, i / n), w0 = windFn(i / n), w1 = windFn((i + 1) / n);
        if (breite[i + 1] <= 1e-6) add(L(i), R(i), mitte[i + 1], f, [w0, w0, w1]);
        else if (breite[i] <= 1e-6) add(mitte[i], R(i + 1), L(i + 1), f, [w0, w1, w1]);
        else { add(L(i), R(i), R(i + 1), f, [w0, w0, w1]); add(L(i), R(i + 1), L(i + 1), f, [w0, w1, w1]); }
      }
      return s;
    },
    /**
     * Rohr (Prisma) entlang mitte[]; radien[i] (0 am Ende = Spitze). opts: { seiten = 5, profil (Faktoren je Ecke, z. B. Rippen),
     * deckel = false, drehung = 0, farbeFn(i, k) → Farbe je Segment/Ecke, windFn(t) }.
     */
    rohr(mitte, radien, f, windFn = () => 0, { seiten = 5, profil = null, deckel = false, drehung = 0, farbeFn = null } = {}) {
      const ringe = [];
      let u = null;   // Rahmen wird mitgeführt (parallel transportiert) → Rippen verdrehen sich nicht in Kurven
      for (let i = 0; i < mitte.length; i++) {
        const t = norm(sub(mitte[Math.min(i + 1, mitte.length - 1)], mitte[Math.max(i - 1, 0)]));
        if (!u) u = norm(kreuz(t, Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
        else { const d = punkt(u, t); u = norm([u[0] - t[0] * d, u[1] - t[1] * d, u[2] - t[2] * d]); }
        const v = kreuz(t, u);
        const ring = [];
        for (let k = 0; k < seiten; k++) {
          const a = drehung + (k / seiten) * Math.PI * 2, rr = radien[i] * (profil ? profil[k % profil.length] : 1);
          ring.push(mitte[i].map((m, j) => m + (Math.cos(a) * u[j] + Math.sin(a) * v[j]) * rr));
        }
        ringe.push(ring);
      }
      const n = mitte.length - 1;
      for (let i = 0; i < n; i++) {
        const innen = mitte[i].map((m, j) => (m + mitte[i + 1][j]) / 2);
        const w0 = windFn(i / n), w1 = windFn((i + 1) / n);
        for (let k = 0; k < seiten; k++) {
          const k2 = (k + 1) % seiten, fk = farbeFn ? farbeFn(i, k) : f;
          const a = ringe[i][k], b = ringe[i][k2], c = ringe[i + 1][k2], d = ringe[i + 1][k];
          if (radien[i + 1] <= 1e-6) { s.dreieckAussen(a, b, mitte[i + 1], innen, fk, [w0, w0, w1]); continue; }
          if (radien[i] <= 1e-6) { s.dreieckAussen(mitte[i], c, d, innen, fk, [w0, w1, w1]); continue; }
          s.dreieckAussen(a, b, c, innen, fk, [w0, w0, w1]);
          s.dreieckAussen(a, c, d, innen, fk, [w0, w1, w1]);
        }
      }
      if (deckel && radien[n] > 1e-6) {
        const innen = mitte[n - 1], fd = farbeFn ? farbeFn(n, 0) : f, w = windFn(1);
        for (let k = 0; k < seiten; k++) s.dreieckAussen(ringe[n][k], ringe[n][(k + 1) % seiten], mitte[n], innen, fd, w);
      }
      return s;
    },
    /**
     * Verformter Laubballen (Breiten-/Längenkugel, segU × segV). farbeFn(ny, y) mit ny = −1 (unten) … 1 (oben);
     * windFn(y) je Ecke; unruhe = Verformung 0..0,4.
     */
    ballen(c, rad, segU, segV, farbeFn, windFn = () => 0, unruhe = 0.18) {
      const grid = [];
      const off = r() * Math.PI * 2;
      for (let j = 0; j <= segV; j++) {
        const phi = (j / segV) * Math.PI, row = [];
        const cnt = j === 0 || j === segV ? 1 : segU;
        for (let i = 0; i < cnt; i++) {
          const th = off + ((i + (j % 2) * 0.5) / segU) * Math.PI * 2;
          const k = 1 + (r() - 0.5) * 2 * unruhe;
          row.push([c[0] + Math.sin(phi) * Math.cos(th) * rad[0] * k, c[1] + Math.cos(phi) * rad[1] * k, c[2] + Math.sin(phi) * Math.sin(th) * rad[2] * k]);
        }
        grid.push(row);
      }
      const tri = (a, b, d) => {
        const ny = Math.max(-1, Math.min(1, ((a[1] + b[1] + d[1]) / 3 - c[1]) / rad[1]));
        s.dreieckAussen(a, b, d, c, farbeFn(ny, (a[1] + b[1] + d[1]) / 3), [windFn(a[1]), windFn(b[1]), windFn(d[1])]);
      };
      for (let j = 0; j < segV; j++) {
        const A = grid[j], B = grid[j + 1];
        for (let i = 0; i < segU; i++) {
          const i2 = (i + 1) % segU;
          if (A.length === 1) tri(A[0], B[i], B[i2]);
          else if (B.length === 1) tri(A[i], A[i2], B[0]);
          else if (j % 2 === 0) { tri(A[i], A[i2], B[i]); tri(A[i2], B[i2], B[i]); }
          else { tri(A[i], A[i2], B[i2]); tri(A[i], B[i2], B[i]); }
        }
      }
      return s;
    },
    get dreiecke() { return pos.length / 9; },
    /** Höhe (max y) und Grundriss-Radius (max Abstand in xz). */
    masse() {
      let h = 0, rad = 0;
      for (let i = 0; i < pos.length; i += 3) { h = Math.max(h, pos[i + 1]); rad = Math.max(rad, Math.hypot(pos[i], pos[i + 2])); }
      return { hoehe: h, radius: rad };
    },
    /** BufferGeometry: position, normal (flach), color (linear), wind. */
    geometrie() {
      const P = new Float32Array(pos), N = new Float32Array(pos.length), C = new Float32Array(col.length);
      for (let i = 0; i < P.length; i += 9) {
        const a = [P[i], P[i + 1], P[i + 2]], b = [P[i + 3], P[i + 4], P[i + 5]], c = [P[i + 6], P[i + 7], P[i + 8]];
        const n = norm(kreuz(sub(b, a), sub(c, a)));
        for (let k = 0; k < 3; k++) N.set(n, i + k * 3);
      }
      const tmp = new THREE.Color();
      for (let i = 0; i < col.length; i += 3) {
        tmp.setRGB(col[i], col[i + 1], col[i + 2], THREE.SRGBColorSpace);
        C[i] = tmp.r; C[i + 1] = tmp.g; C[i + 2] = tmp.b;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(P, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
      g.setAttribute('color', new THREE.BufferAttribute(C, 3));
      g.setAttribute('wind', new THREE.BufferAttribute(new Float32Array(wind), 1));
      g.computeBoundingSphere();
      return g;
    },
    /** Vertrags-Ergebnis { geometrie, hoehe, radius, stammRadius }. */
    ergebnis({ stammRadius = 0 } = {}) {
      const m = s.masse();
      return { geometrie: s.geometrie(), hoehe: m.hoehe, radius: m.radius, stammRadius };
    },
  };
  return s;
}
