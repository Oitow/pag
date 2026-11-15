/**
 * @modul    bau-teile
 * @zweck    Bauteile für Gebäude-Assets: Satteldach/Pultdach mit Schindelreihen, Giebel, Fachwerk, Fenster mit Läden, Tür, Zinnen, Laterne, Flagge
 * @api      mitT(b, {x,y,z,ry}) -> b' ; satteldach(b,o) ; pultdach(b,o) ; giebel(b,w,h,d,farbe,t) ; strebe(b,x1,y1,x2,y2,tiefe,farbe) ; fachwerk(b,w,h,{pfosten,schienen,streben}) ; fenster(b,l,x,y,o) ; tuer(b,breite,hoehe) ; zinnenLinie(b,x1,z1,x2,z2,y,o) ; laterne(b,l,x,y,z,ry) ; flagge(b,x,y,z,farbe)
 * @beispiel
 *   import { createMeshBuilder } from '../../render/mesh-builder.js';
 *   import { satteldach, fenster } from './bau-teile.js';
 *   const b = createMeshBuilder({ seed: 1 }), l = createMeshBuilder({ seed: 2 });
 *   satteldach(b, { w: 5, d: 4, y: 3, h: 2, farbe: '#9a4a32' });
 *   fenster(mitT(b, { z: 2 }), mitT(l, { z: 2 }), 0, 1.5);
 * @tags     bau, gebaeude, dach, fachwerk, fenster, zinnen, lowpoly
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
import { FARBEN as F } from './bau-basis.js';

// Einheits-Dreiecksprisma (x ±0.5, y 0…1, z ±0.5), Spitze oben: Giebelfüllung
let _giebel = null;
function giebelGeo() {
  if (_giebel) return _giebel;
  const v = [], tri = (a, b, c) => v.push(...a, ...b, ...c);
  tri([-.5, 0, .5], [.5, 0, .5], [0, 1, .5]); tri([-.5, 0, -.5], [0, 1, -.5], [.5, 0, -.5]);
  for (const s of [-1, 1]) {
    const p0 = [s * .5, 0, .5], p1 = [s * .5, 0, -.5], p2 = [0, 1, -.5], p3 = [0, 1, .5];
    if (s < 0) { tri(p0, p2, p1); tri(p0, p3, p2); } else { tri(p0, p1, p2); tri(p0, p2, p3); }
  }
  _giebel = new THREE.BufferGeometry();
  _giebel.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  return _giebel;
}

const IDX = { box: 4, sphere: 2, cyl: 4, cone: 3, ico: 2, add: 2 };
/** Builder-Hülle: verschiebt/dreht alle Teile (ry um Y, wie THREE rotation.y) – für Wände in lokalen Koordinaten (+z = Außenseite). */
export function mitT(b, p = {}) {
  const c = Math.cos(p.ry || 0), s = Math.sin(p.ry || 0), o = {};
  for (const k of Object.keys(IDX)) o[k] = (...a) => {
    const t = { ...(a[IDX[k]] || {}) }, lx = t.x || 0, lz = t.z || 0;
    t.x = (p.x || 0) + lx * c + lz * s; t.z = (p.z || 0) - lx * s + lz * c;
    t.y = (p.y || 0) + (t.y || 0); t.ry = (t.ry || 0) + (p.ry || 0);
    a[IDX[k]] = t; b[k](...a); return o;
  };
  return o;
}

/** Giebelfüllung (Dreieck, Breite w, Höhe h, Tiefe d) ab Höhe t.y. */
export const giebel = (b, w, h, d, farbe, t = {}) => b.add(giebelGeo(), farbe, { ...t, sx: w, sy: h, sz: d });

/** Satteldach, First entlang z. o: { w, d (Wandmaße), y (Traufe), h (Anstieg), ueber = 0.4, farbe, farbe2, dick = 0.16, reihen = 3, firstFarbe, giebelFarbe } */
export function satteldach(b, o) {
  const { w, d, y, h, ueber = 0.4, farbe, farbe2 = farbe, dick = 0.16, reihen = 3, jitter = 0.1 } = o;
  const half = w / 2 + ueber, slope = h / (w / 2), yE = y - ueber * slope, L = Math.hypot(half, y + h - yE);
  const a = Math.atan2(h, w / 2), n = [Math.sin(a), Math.cos(a)], len = d + 2 * ueber;
  for (const s of [-1, 1]) for (let i = 0; i < reihen; i++) {
    const tau = (i + 0.5) * L / reihen, lift = dick / 2 + (reihen - 1 - i) * 0.035;
    b.box(L / reihen + 0.02, dick, len, i % 2 ? farbe2 : farbe, { x: s * half - s * Math.cos(a) * tau + s * n[0] * lift,
      y: yE + Math.sin(a) * tau + n[1] * lift, rz: -s * a, jitter });
  }
  b.box(0.34, 0.16, len + 0.06, o.firstFarbe || F.holzDunkel, { y: y + h + dick * 0.9 });
  if (o.giebelFarbe) giebel(b, w, h, d, o.giebelFarbe, { y });
}

/** Pultdach: Platte von (x0..x1, z0..z1), fällt in +x (fall = 'x') oder +z (fall = 'z') von yHoch auf yTief. */
export function pultdach(b, { x0, x1, z0, z1, yHoch, yTief, farbe, dick = 0.16, fall = 'x', jitter = 0.1 }) {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, my = (yHoch + yTief) / 2 + dick / 2;
  if (fall === 'x') { const l = x1 - x0, a = Math.atan2(yHoch - yTief, l);
    b.box(Math.hypot(l, yHoch - yTief), dick, z1 - z0, farbe, { x: cx, y: my, z: cz, rz: -a, jitter }); } else {
    const l = z1 - z0, a = Math.atan2(yHoch - yTief, l);
    b.box(x1 - x0, dick, Math.hypot(l, yHoch - yTief), farbe, { x: cx, y: my, z: cz, rx: a, jitter }); }
}

/** Schräge Holzstrebe (Wand-lokal, in der xy-Ebene) von (x1,y1) nach (x2,y2). */
export function strebe(b, x1, y1, x2, y2, tiefe = 0.1, farbe = F.fachwerk) {
  const dx = x2 - x1, dy = y2 - y1;
  return b.box(Math.hypot(dx, dy), 0.13, tiefe, farbe, { x: (x1 + x2) / 2, y: (y1 + y2) / 2, rz: Math.atan2(dy, dx), jitter: 0.04 });
}

/** Fachwerk auf einer Wand (b = mitT-Hülle, Ursprung Wandmitte unten, +z außen): Schienen (y), Pfosten (x), Streben [[x1,y1,x2,y2]]. */
export function fachwerk(b, w, h, { pfosten = [], schienen = [], streben = [], farbe = F.fachwerk, tiefe = 0.1 } = {}) {
  for (const y of schienen) b.box(w, 0.17, tiefe, farbe, { y, z: tiefe / 2, jitter: 0.04 });
  for (const x of pfosten) b.box(0.17, h, tiefe, farbe, { x, y: h / 2, z: tiefe / 2, jitter: 0.04 });
  for (const s of streben) strebe(b, s[0], s[1], s[2], s[3], tiefe, farbe);
}

/** Fenster mit Rahmen, Sims, Läden (b = Hülle Hauptgeometrie, l = Hülle Leuchtgeometrie am selben Wandpunkt). o: { w = 0.8, h = 1.0, laeden = true, laedenFarbe, rahmen } */
export function fenster(b, l, x, y, { w = 0.8, h = 1.0, laeden = true, laedenFarbe = F.stoffGruen, rahmen = F.holzDunkel } = {}) {
  b.box(w + 0.16, h + 0.16, 0.08, rahmen, { x, y, z: 0.04, jitter: 0.03 });
  b.box(w, h, 0.06, F.fenster, { x, y, z: 0.09, jitter: 0.02 });
  b.box(w + 0.3, 0.07, 0.2, F.steinHell, { x, y: y - h / 2 - 0.1, z: 0.1 });
  l?.box(w * 0.86, h * 0.86, 0.02, F.licht, { x, y, z: 0.125, jitter: 0 });
  b.box(0.05, h, 0.05, rahmen, { x, y, z: 0.15 }).box(w, 0.05, 0.05, rahmen, { x, y, z: 0.15 });
  if (laeden) for (const s of [-1, 1]) b.box(w / 2, h, 0.05, laedenFarbe, { x: x + s * (w / 2 + w / 4 + 0.1), y, z: 0.07, ry: s * 0.12, jitter: 0.08 });
}

/** Tür (b = Hülle): Rahmen, Blatt, Beschlag, Schwelle. */
export function tuer(b, breite = 1.1, hoehe = 2.1) {
  b.box(breite + 0.3, hoehe + 0.2, 0.1, F.holzDunkel, { y: (hoehe + 0.2) / 2, z: 0.05, jitter: 0.03 });
  b.box(breite, hoehe, 0.1, F.holz, { y: hoehe / 2, z: 0.09 });
  b.box(breite, 0.12, 0.06, F.eisen, { y: hoehe * 0.25, z: 0.15 }).box(breite, 0.12, 0.06, F.eisen, { y: hoehe * 0.75, z: 0.15 });
  b.box(0.1, 0.1, 0.08, F.gold, { x: breite * 0.35, y: hoehe * 0.48, z: 0.17 });
  b.box(breite + 0.5, 0.12, 0.45, F.steinDunkel, { y: 0.06, z: 0.22 });
}

/** Zinnen (Wehrzähne) entlang der Strecke (x1,z1)→(x2,z2) auf Höhe y. o: { n, bw = 0.7, bh = 0.6, bt = 0.45, farbe } */
export function zinnenLinie(b, x1, z1, x2, z2, y, { n, bw = 0.7, bh = 0.6, bt = 0.45, farbe = F.steinHell } = {}) {
  const dx = x2 - x1, dz = z2 - z1, w = Math.atan2(-dz, dx);
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n;
    b.box(bw, bh, bt, farbe, { x: x1 + dx * t, y: y + bh / 2, z: z1 + dz * t, ry: w, jitter: 0.07 }); }
}

/** Laterne an Wandarm (b = Hülle an der Wand, l = Leuchthülle): Arm, Käfig, leuchtender Kern. */
export function laterne(b, l, x, y, z = 0) {
  b.box(0.06, 0.06, 0.5, F.eisen, { x, y: y + 0.3, z: z + 0.25 });
  const zz = z + 0.5;
  b.box(0.3, 0.05, 0.3, F.eisen, { x, y: y + 0.28, z: zz }).box(0.3, 0.05, 0.3, F.eisen, { x, y: y - 0.1, z: zz });
  l.box(0.2, 0.34, 0.2, F.licht, { x, y: y + 0.09, z: zz, jitter: 0 });
}

/** Flaggenstange mit Fahne bei (x, y, z): Stange 2.4 m hoch. */
export function flagge(b, x, y, z, farbe = F.stoffRot) {
  b.cyl(0.05, 0.06, 2.4, F.holzDunkel, { x, y: y + 1.2, z }, 5);
  b.box(1.1, 0.65, 0.04, farbe, { x: x + 0.6, y: y + 2.0, z, jitter: 0.05 });
  b.sphere(0.09, F.gold, { x, y: y + 2.42, z }, 5, 4);
}
