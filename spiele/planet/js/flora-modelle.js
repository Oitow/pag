// Prozedurale Low-Poly-/Voxel-Modelle für die Flora. Jedes Modell = { teil: BufferGeometry },
// Teile: 'fest' (starr), 'baum' (Krone wiegt leicht), 'gras' (wiegt stark), 'glow' (leuchtet).
// Einheiten: Meter, Fußpunkt im Ursprung, +Y = oben.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from './noise.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
function mat(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  return _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.set(sx, sy, sz)).clone();
}

class Bau {
  constructor(seed) { this.rng = mulberry32(seed); this.teile = {}; }
  r(a = 0, b = 1) { return a + (b - a) * this.rng(); }
  add(teil, geo, farbe, m, shade = 0.12) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (g.attributes.uv) g.deleteAttribute('uv');
    if (m) g.applyMatrix4(m);
    const c = new THREE.Color(farbe), n = g.attributes.position.count, col = new Float32Array(n * 3);
    // pro Dreieck leichte Helligkeitsvariation → handgemachter Look
    for (let i = 0; i < n; i += 3) {
      const f = 1 + (this.rng() - 0.5) * shade;
      for (let k = 0; k < 3 && i + k < n; k++) { const o = (i + k) * 3; col[o] = c.r * f; col[o + 1] = c.g * f; col[o + 2] = c.b * f; }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    (this.teile[teil] ||= []).push(g);
    return this;
  }
  // Quader, (x,y,z) = Mitte
  box(teil, w, h, d, x, y, z, farbe, rx = 0, ry = 0, rz = 0) { return this.add(teil, new THREE.BoxGeometry(w, h, d), farbe, mat(x, y, z, rx, ry, rz)); }
  // flaches Blatt (Quad, beidseitig), (x,y,z) = Mitte
  blatt(teil, w, h, x, y, z, farbe, rx = 0, ry = 0, rz = 0) {
    const g = new THREE.PlaneGeometry(w, h), r = g.clone().rotateY(Math.PI);
    return this.add(teil, mergeGeometries([g, r].map(q => (q.deleteAttribute('uv'), q.toNonIndexed())), false), farbe, mat(x, y, z, rx, ry, rz));
  }
  // zwei gekreuzte Blätter
  kreuz(teil, w, h, x, y, z, farbe, ry = 0) { this.blatt(teil, w, h, x, y, z, farbe, 0, ry, 0); return this.blatt(teil, w, h, x, y, z, farbe, 0, ry + Math.PI / 2, 0); }
  // Säule/Kegel, (x,y,z) = Mitte
  cyl(teil, rt, rb, h, seg, x, y, z, farbe, rx = 0, ry = 0, rz = 0) { return this.add(teil, new THREE.CylinderGeometry(rt, rb, h, seg, 1), farbe, mat(x, y, z, rx, ry, rz)); }
  // zerklüfteter Brocken (Ikosaeder, deterministisch verbeult)
  ico(teil, r, x, y, z, farbe, sx = 1, sy = 1, sz = 1, beule = 0.25, detail = 0, ry = 0) {
    const g = new THREE.IcosahedronGeometry(r, detail), p = g.attributes.position, seed = this.rng() * 1000;
    for (let i = 0; i < p.count; i++) {
      const a = p.getX(i), b = p.getY(i), c = p.getZ(i);
      const h = Math.sin(a * 12.9898 / r + b * 78.233 / r + c * 37.719 / r + seed) * 43758.5453;
      const f = 1 + ((h - Math.floor(h)) - 0.5) * 2 * beule;
      p.setXYZ(i, a * f, b * f, c * f);
    }
    return this.add(teil, g, farbe, mat(x, y, z, 0, ry, 0, sx, sy, sz));
  }
  // Alle starren/wiegenden Teile → ein Geometrie-Teil 'fest' mit Attribut 'wiegen'
  // (0 = starr, klein = Baumkrone, groß = Gras); 'glow' bleibt separat (unbeleuchtet).
  fertig() {
    const out = {}, WIEGEN = { fest: 0, baum: 0.012, gras: 0.16 };
    const normal = [];
    for (const [k, list] of Object.entries(this.teile)) {
      if (k === 'glow') continue;
      for (const g of list) {
        g.setAttribute('wiegen', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(WIEGEN[k] ?? 0), 1));
        normal.push(g);
      }
    }
    if (normal.length) out.fest = mergeGeometries(normal, false);
    if (this.teile.glow) out.glow = mergeGeometries(this.teile.glow.map(g => { g.deleteAttribute('wiegen'); return g; }), false);
    for (const g of Object.values(out)) { g.computeVertexNormals(); g.computeBoundingSphere(); }
    return out;
  }
}

const B = (seed, fn) => { const b = new Bau(seed); fn(b); return b.fertig(); };

// ---------- Farben ----------
const RINDE = 0x6e4a2c, RINDE_D = 0x4a3220, LAUB = [0x6fb043, 0x5f9e3a, 0x82c24c, 0x4f8a32];

// ---------- Wiese ----------
function laubbaum(b, v) {
  const h = 2.2 + v * 0.6;
  b.box('fest', 0.45, h + 0.6, 0.45, 0, (h + 0.6) / 2, 0, RINDE);
  b.box('fest', 0.22, 1.1, 0.22, 0.35, h - 0.1, 0.1, RINDE, 0, 0, -0.8);
  b.box('fest', 0.2, 1.0, 0.2, -0.3, h, -0.2, RINDE, 0.5, 0, 0.7);
  const n = 6 + Math.floor(v * 3);
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + b.r(-0.3, 0.3), rr = i === 0 ? 0 : b.r(0.7, 1.3);
    const s = i === 0 ? 2.3 : b.r(1.3, 1.9);
    b.box('baum', s, s * b.r(0.75, 0.95), s, Math.cos(a) * rr, h + 1.2 + (i === 0 ? 0.5 : b.r(-0.5, 0.4)), Math.sin(a) * rr, LAUB[i % 4], b.r(-0.2, 0.2), b.r(0, 1.5), b.r(-0.2, 0.2));
  }
}
function birke(b) {
  b.box('fest', 0.28, 4.4, 0.28, 0, 2.2, 0, 0xeae6dc);
  for (let i = 0; i < 6; i++) b.box('fest', 0.3, 0.08, 0.12, 0, 0.6 + i * 0.6 + b.r(0, 0.2), b.r(-0.1, 0.1), 0x2c2a28, 0, b.r(0, 3), 0);
  const cs = [0x9bd157, 0x8cc84b, 0xa9da66];
  for (let i = 0; i < 5; i++) {
    const y = 3.0 + i * 0.55, s = 1.6 - i * 0.22;
    b.box('baum', s, 0.75, s, b.r(-0.2, 0.2), y, b.r(-0.2, 0.2), cs[i % 3], 0, b.r(0, 1.6), 0);
  }
}
function busch(b, beeren) {
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1, rr = i ? 0.38 : 0;
    b.ico('baum', b.r(0.45, 0.6), Math.cos(a) * rr, 0.45 + b.r(0, 0.2), Math.sin(a) * rr, LAUB[(i + 1) % 4], 1, 0.8, 1, 0.2);
  }
  if (beeren) for (let i = 0; i < 8; i++) {
    const a = b.r(0, 6.28), y = b.r(0.3, 0.95), rr = 0.62 - Math.abs(y - 0.6) * 0.3;
    b.box('baum', 0.12, 0.12, 0.12, Math.cos(a) * rr, y, Math.sin(a) * rr, beeren);
  }
}
function blume(b, farbe) {
  for (let i = 0; i < 2; i++) {
    const x = b.r(-0.25, 0.25), z = b.r(-0.25, 0.25), h = b.r(0.25, 0.45);
    const ry = b.r(0, 3);
    b.blatt('gras', 0.05, h, x, h / 2, z, 0x4f9a35, 0, ry, 0);
    b.box('gras', 0.15, 0.05, 0.15, x, h, z, farbe, 0, ry + 0.785, 0);
    b.box('gras', 0.06, 0.07, 0.06, x, h + 0.02, z, 0xffd84a, 0, ry, 0);
  }
}
function gras(b, farbe, hoch = 0.45, n = 6) {
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.28 + b.r(0, 0.5), rr = b.r(0.05, 0.3), h = hoch * b.r(0.6, 1.1);
    b.blatt('gras', 0.07, h, Math.cos(a) * rr, h / 2, Math.sin(a) * rr, farbe, b.r(-0.3, 0.3), a, b.r(-0.3, 0.3));
  }
}
function fels(b, farbe, gross, moos) {
  b.ico('fest', gross ? 1.2 : 0.5, 0, gross ? 0.6 : 0.2, 0, farbe, 1.2, 0.8, 1, 0.3);
  if (gross) b.ico('fest', 0.7, 0.9, 0.3, 0.4, farbe, 1, 0.8, 1, 0.3);
  if (moos) b.ico('fest', gross ? 0.95 : 0.4, 0, gross ? 1.05 : 0.38, 0, moos, 1.3, 0.35, 1.1, 0.2);
}
function kiesel(b) { for (let i = 0; i < 3; i++) b.ico('fest', b.r(0.1, 0.18), b.r(-0.2, 0.2), 0.06, b.r(-0.2, 0.2), [0x9a9aa0, 0x85858c, 0xaaa59a][i], 1, 0.6, 1, 0.2); }
function ast(b) {
  b.box('fest', 0.1, 0.1, 1.1, 0, 0.06, 0, 0x7a5434, 0, 0.3, 0);
  b.box('fest', 0.07, 0.07, 0.4, 0.15, 0.06, 0.15, 0x7a5434, 0, 1.2, 0);
  b.box('fest', 0.12, 0.05, 0.12, -0.05, 0.12, -0.3, 0x6fb043);
}
function faserpflanze(b) {
  for (let i = 0; i < 8; i++) {
    const a = i * 0.785, h = b.r(0.6, 1.0);
    b.blatt('gras', 0.07, h, Math.cos(a) * 0.12, h / 2, Math.sin(a) * 0.12, 0x7fae4a, Math.sin(a) * 0.25, a, Math.cos(a) * 0.25);
    if (i % 2 === 0) b.kreuz('gras', 0.14, 0.14, Math.cos(a) * 0.12 + Math.cos(a) * h * 0.25, h, Math.sin(a) * 0.12 + Math.sin(a) * h * 0.25, 0x8fb6ff, a);
  }
}

// ---------- Dunkelwald ----------
function tanne(b, hoch, farben) {
  b.box('fest', 0.4, 2, 0.4, 0, 1, 0, RINDE_D);
  const n = hoch ? 5 : 4;
  for (let i = 0; i < n; i++) {
    const y = 1.6 + i * (hoch ? 1.45 : 1.3), r = (n - i) * 0.55 + 0.5;
    b.cyl('baum', 0.05, r, 2.2, hoch ? 6 : 4, 0, y + 1.1, 0, farben[i % farben.length], 0, i * 0.4 + (hoch ? 0 : 0.785), 0);
  }
}
function pilz(b, kappe, punkte, glow) {
  for (let i = 0; i < 3; i++) {
    const s = i ? b.r(0.5, 0.75) : 1, x = i ? b.r(-0.35, 0.35) : 0, z = i ? b.r(-0.35, 0.35) : 0;
    b.box('fest', 0.12 * s, 0.32 * s, 0.12 * s, x, 0.16 * s, z, 0xf2ead8);
    b.cyl(glow ? 'glow' : 'fest', 0.08 * s, 0.26 * s, 0.16 * s, 6, x, 0.36 * s, z, kappe);
    if (punkte) for (let k = 0; k < 3; k++) b.box('fest', 0.05 * s, 0.03 * s, 0.05 * s, x + Math.cos(k * 2.1) * 0.12 * s, 0.43 * s, z + Math.sin(k * 2.1) * 0.12 * s, punkte);
  }
}
function farn(b) {
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * 6.28;
    b.blatt('gras', 0.26, 0.9, Math.cos(a) * 0.38, 0.32, Math.sin(a) * 0.38, i % 2 ? 0x3f7f3a : 0x4a8f40, -1.05, -a + Math.PI / 2, 0);
  }
}

// ---------- Sumpf ----------
function totbaum(b) {
  const c = 0x5a5046;
  b.box('fest', 0.5, 2.2, 0.5, 0, 1.1, 0, c, 0, 0, 0.06);
  b.box('fest', 0.38, 1.8, 0.38, 0.2, 2.9, 0, c, 0, 0.3, -0.25);
  b.box('fest', 0.2, 1.3, 0.2, -0.45, 2.3, 0.1, c, 0.2, 0, 0.9);
  b.box('fest', 0.16, 1.1, 0.16, 0.7, 3.4, 0.2, c, -0.3, 0, -1.0);
  b.box('fest', 0.14, 0.9, 0.14, 0.15, 3.9, -0.35, c, -0.8, 0, 0.2);
  for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.4; b.box('fest', 0.22, 0.5, 0.22, Math.cos(a) * 0.4, 0.15, Math.sin(a) * 0.4, c, Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7); }
  // hängendes Moos
  for (let i = 0; i < 4; i++) b.box('baum', 0.08, b.r(0.5, 0.9), 0.08, b.r(-0.7, 0.8), 2.6 + b.r(0, 0.8), b.r(-0.3, 0.3), 0x7a8a4a);
}
function schilf(b) {
  for (let i = 0; i < 10; i++) {
    const x = b.r(-0.4, 0.4), z = b.r(-0.4, 0.4), h = b.r(1.0, 1.8);
    b.blatt('gras', 0.07, h, x, h / 2, z, 0x6f8f3a, b.r(-0.1, 0.1), b.r(0, 3), b.r(-0.1, 0.1));
    if (i % 3 === 0) b.box('gras', 0.09, 0.28, 0.09, x, h - 0.1, z, 0x6b4426);
  }
}
function seerose(b) {
  b.cyl('fest', 0.5, 0.5, 0.04, 7, 0, 0.02, 0, 0x4f9a3a);
  b.cyl('fest', 0.32, 0.32, 0.05, 6, 0.7, 0.02, 0.3, 0x5aa844);
  for (let i = 0; i < 5; i++) b.box('fest', 0.12, 0.1, 0.2, Math.cos(i * 1.26) * 0.1, 0.1, Math.sin(i * 1.26) * 0.1, 0xf6a6c8, 0.4, -i * 1.26, 0);
  b.box('fest', 0.08, 0.1, 0.08, 0, 0.14, 0, 0xffe25a);
}

// ---------- Berge ----------
function kiefer(b, schnee) {
  b.box('fest', 0.36, 4.8, 0.36, 0, 2.4, 0, 0x8a5a36);
  const cs = [0x3d6b45, 0x35603d, 0x447550];
  for (let i = 0; i < 3; i++) {
    const y = 3.8 + i * 1.0, r = 1.7 - i * 0.45;
    b.cyl('baum', r * 0.4, r, 0.9, 5, b.r(-0.15, 0.15), y, b.r(-0.15, 0.15), cs[i], 0, i, 0);
    if (schnee) b.cyl('baum', r * 0.4, r * 0.8, 0.2, 5, 0, y + 0.52, 0, 0xf4f8fb, 0, i, 0);
  }
}
function schneefleck(b) { for (let i = 0; i < 3; i++) b.ico('fest', b.r(0.6, 1.0), b.r(-0.6, 0.6), 0, b.r(-0.6, 0.6), 0xf2f6fa, 1.4, 0.25, 1.2, 0.2); }

// ---------- Ebenen ----------
function akazie(b) {
  b.box('fest', 0.35, 3, 0.35, 0.2, 1.5, 0, 0x6a4a30, 0, 0, -0.12);
  b.box('fest', 0.22, 1.8, 0.22, 0.9, 3.3, 0.1, 0x6a4a30, 0, 0, -0.6);
  b.box('fest', 0.22, 1.6, 0.22, -0.3, 3.3, -0.2, 0x6a4a30, 0.3, 0, 0.55);
  const cs = [0x7f9a3a, 0x8aa645, 0x73903a];
  b.box('baum', 3.8, 0.45, 3.0, 0.6, 4.1, 0, cs[0], 0, 0.3, 0);
  b.box('baum', 2.6, 0.4, 2.6, 1.4, 4.5, 0.4, cs[1], 0, 0.9, 0);
  b.box('baum', 2.4, 0.4, 2.0, -0.6, 4.35, -0.5, cs[2], 0, -0.4, 0);
}
function getreide(b) {
  for (let i = 0; i < 10; i++) {
    const x = b.r(-0.45, 0.45), z = b.r(-0.45, 0.45), h = b.r(0.8, 1.2), ry = b.r(0, 3);
    b.blatt('gras', 0.06, h, x, h / 2, z, 0xc7a743, 0, ry, 0);
    b.kreuz('gras', 0.11, 0.26, x, h + 0.08, z, 0xe6c457, ry);
  }
}
function trockenbusch(b, c = 0x8a6a44) {
  for (let i = 0; i < 7; i++) { const a = i * 0.9; b.box('fest', 0.05, 0.8, 0.05, Math.cos(a) * 0.15, 0.35, Math.sin(a) * 0.15, c, Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6); }
}

// ---------- Glutwüste ----------
function kaktus(b, arme) {
  const g = 0x4f9a50, h = 3.0;
  b.box('fest', 0.55, h, 0.55, 0, h / 2, 0, g);
  b.box('fest', 0.4, 0.4, 0.4, 0, h + 0.1, 0, 0x5aa85a);
  if (arme > 0) { b.box('fest', 0.7, 0.35, 0.35, 0.55, 1.3, 0, g); b.box('fest', 0.35, 1.1, 0.35, 0.8, 1.9, 0, g); }
  if (arme > 1) { b.box('fest', 0.6, 0.3, 0.3, -0.5, 1.7, 0, g); b.box('fest', 0.3, 0.8, 0.3, -0.7, 2.15, 0, g); }
  b.box('fest', 0.16, 0.12, 0.16, 0, h + 0.36, 0, 0xff7aa8);
  for (let i = 0; i < 10; i++) b.box('fest', 0.04, 0.04, 0.04, (i % 2 ? 0.29 : -0.29), 0.3 + i * 0.27, b.r(-0.2, 0.2), 0xf3ecc4);
}
function bogen(b) {
  const c = [0xc9773f, 0xd98c4f, 0xb8653a, 0xe0a060];
  for (let i = 0; i < 6; i++) {
    b.box('fest', 1.6 - i * 0.08, 1.0, 1.4, -3.4 + b.r(-0.08, 0.08), 0.5 + i, 0, c[i % 4]);
    b.box('fest', 1.6 - i * 0.08, 1.0, 1.4, 3.4 + b.r(-0.08, 0.08), 0.5 + i, 0, c[(i + 1) % 4]);
  }
  for (let i = 0; i < 7; i++) {
    const x = -3.0 + i * 1.0, y = 6.4 + Math.sin(i / 6 * Math.PI) * 0.6;
    b.box('fest', 1.05, 1.0, 1.25, x, y, 0, c[(i + 2) % 4], 0, 0, (i - 3) * -0.08);
  }
  b.ico('fest', 1.0, -3.6, 0.2, 1.1, 0xc9773f, 1, 0.5, 1, 0.3);
}

// ---------- Eis ----------
function eisblock(b) {
  b.box('fest', 1.6, 1.4, 1.4, 0, 0.6, 0, 0xbfe6f5, 0.08, 0.2, 0.05);
  b.box('fest', 1.0, 1.1, 1.0, 0.9, 0.5, 0.5, 0xd2f0fa, -0.1, 0.6, 0.1);
  b.box('fest', 1.4, 0.25, 1.2, 0, 1.38, 0, 0xf4fafd, 0.08, 0.2, 0.05);
}
function eiszapfen(b) {
  for (let i = 0; i < 5; i++) {
    const h = i ? b.r(0.9, 2.0) : 2.8, x = i ? b.r(-0.7, 0.7) : 0, z = i ? b.r(-0.7, 0.7) : 0;
    b.cyl('fest', 0.0, h * 0.18, h, 4, x, h / 2, z, i % 2 ? 0xa8def2 : 0xc8ecf8, b.r(-0.15, 0.15), b.r(0, 1), b.r(-0.15, 0.15));
  }
}

// ---------- Asche ----------
function verkohlt(b) {
  const c = 0x2a2422;
  b.box('fest', 0.42, 3.2, 0.42, 0, 1.6, 0, c, 0, 0, 0.05);
  b.box('fest', 0.18, 1.2, 0.18, 0.4, 2.7, 0, c, 0, 0, -0.9);
  b.box('fest', 0.16, 1.0, 0.16, -0.35, 2.3, 0.1, c, 0.3, 0, 0.8);
  b.box('fest', 0.12, 0.7, 0.12, 0.1, 3.4, -0.2, c, -0.6, 0, 0);
  for (let i = 0; i < 4; i++) b.box('glow', 0.12, 0.25, 0.08, b.r(-0.2, 0.2), b.r(0.2, 1.4), 0.2, 0xff6a1a, 0, i * 1.5, 0);
}
function lavafels(b, gross) {
  const s = gross ? 1 : 0.55;
  b.ico('fest', 1.0 * s, 0, 0.45 * s, 0, 0x3a3030, 1.3, 0.75, 1.1, 0.3);
  // glühende Pfütze am Fuß + Risse oben
  b.cyl('glow', 1.25 * s, 1.35 * s, 0.06, 7, 0, 0.03, 0, 0xff5a10);
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + 0.3;
    b.box('glow', 0.9 * s, 0.06, 0.09, Math.cos(a) * 0.35 * s, 0.98 * s, Math.sin(a) * 0.3 * s, i % 2 ? 0xff7a20 : 0xffb030, 0, -a, 0);
  }
}
function glutspalte(b) {
  for (let i = 0; i < 4; i++) b.box('glow', 1.2, 0.06, 0.18, i * 0.7, 0.02, Math.sin(i) * 0.3, 0xff5a10, 0, i * 0.5, 0);
  b.ico('fest', 0.3, 0.5, 0.05, 0.5, 0x2e2828, 1, 0.4, 1);
}

// ---------- Strand ----------
function palme(b) {
  let x = 0, y = 0;
  for (let i = 0; i < 7; i++) {
    const t = i / 6, w = 0.36 - t * 0.08;
    b.box('fest', w, 0.95, w, x, y + 0.47, 0, i % 2 ? 0x9a7448 : 0x87643c, 0, 0, -0.06 - t * 0.12);
    x += 0.1 + t * 0.18; y += 0.92;
  }
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * 6.28;
    b.box('baum', 0.5, 0.06, 2.4, x + Math.cos(a) * 1.0, y - 0.25, Math.sin(a) * 1.0, i % 2 ? 0x4f9e3e : 0x5cb04a, 0.38, -a + Math.PI / 2, 0);
  }
  for (let i = 0; i < 3; i++) b.box('fest', 0.25, 0.25, 0.25, x + Math.cos(i * 2.1) * 0.25, y - 0.4, Math.sin(i * 2.1) * 0.25, 0x6b4a2a);
}
function muschel(b) {
  b.cyl('fest', 0.02, 0.22, 0.1, 7, 0, 0.05, 0, 0xf7d6c8);
  for (let i = 0; i < 4; i++) b.box('fest', 0.03, 0.04, 0.22, Math.cos(i * 0.6 - 0.9) * 0.08, 0.1, Math.sin(i * 0.6 - 0.9) * 0.08, 0xeab3a0, 0, -(i * 0.6 - 0.9) + Math.PI / 2, 0);
  b.ico('fest', 0.09, 0.3, 0.04, 0.15, 0xffffff, 1, 0.6, 1.6);
}
function treibholz(b) {
  b.box('fest', 0.3, 0.28, 2.0, 0, 0.12, 0, 0xb09a80, 0, 0, 0.05);
  b.box('fest', 0.12, 0.12, 0.7, 0.25, 0.15, 0.6, 0xa89078, 0, 0.8, 0);
}

// ---------- Erze ----------
function erz(b, rock, farbe, glow, kristall) {
  b.ico('fest', 0.95, 0, 0.45, 0, rock, 1.25, 0.8, 1.1, 0.28);
  const t = glow ? 'glow' : 'fest';
  if (kristall) {
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05 + b.r(0, 0.3), h = b.r(0.6, 1.2);
      b.cyl(t, 0, 0.18, h, 5, Math.cos(a) * 0.55, 0.65 + h / 2, Math.sin(a) * 0.45, farbe, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    }
    b.cyl(t, 0, 0.26, 1.6, 5, 0, 1.4, 0, farbe);
  } else {
    for (let i = 0; i < 12; i++) {
      const a = b.r(0, 6.28), y = b.r(0.2, 0.95), rr = 1.15 - Math.abs(y - 0.45) * 0.6;
      const s = b.r(0.18, 0.32);
      b.box(t, s, s, s, Math.cos(a) * rr, y, Math.sin(a) * rr * 0.9, farbe, b.r(0, 1), b.r(0, 1), 0);
    }
  }
}

// Alle Modelle, Schlüssel = Modellname
export function baueModelle(seed = 1) {
  let k = 0; const S = () => seed * 31 + (++k) * 977;
  const M = {
    laubbaum_a: B(S(), b => laubbaum(b, 0)),
    laubbaum_b: B(S(), b => laubbaum(b, 1)),
    birke: B(S(), b => birke(b)),
    busch: B(S(), b => busch(b)),
    beerenbusch: B(S(), b => busch(b, 0x3a4fd8)),
    beerenbusch_rot: B(S(), b => busch(b, 0xe23a4a)),
    blume_gelb: B(S(), b => blume(b, 0xffd23a)),
    blume_weiss: B(S(), b => blume(b, 0xffffff)),
    blume_lila: B(S(), b => blume(b, 0xb58ae0)),
    blume_rot: B(S(), b => blume(b, 0xff5a5a)),
    gras: B(S(), b => gras(b, 0xffffff)),
    gras_hoch: B(S(), b => gras(b, 0xffffff, 0.85, 8)),
    fels_klein: B(S(), b => fels(b, 0x8f8f96, false)),
    felsbrocken: B(S(), b => fels(b, 0x8a8a92, true)),
    moosfels: B(S(), b => fels(b, 0x7a7f78, true, 0x4f8a3a)),
    kiesel: B(S(), b => kiesel(b)),
    ast: B(S(), b => ast(b)),
    faserpflanze: B(S(), b => faserpflanze(b)),
    tanne: B(S(), b => tanne(b, false, [0x2f5f38, 0x2a5532, 0x36693f])),
    fichte: B(S(), b => tanne(b, true, [0x24503a, 0x1f4733, 0x2a5a40])),
    pilz: B(S(), b => pilz(b, 0xe0352f, 0xffffff)),
    pilz_braun: B(S(), b => pilz(b, 0xa0663a, null)),
    gluehpilz: B(S(), b => pilz(b, 0x5ae0ff, null, true)),
    farn: B(S(), b => farn(b)),
    totbaum: B(S(), b => totbaum(b)),
    schilf: B(S(), b => schilf(b)),
    seerose: B(S(), b => seerose(b)),
    sumpffels: B(S(), b => fels(b, 0x5f6152, true, 0x5a6a34)),
    kiefer: B(S(), b => kiefer(b, false)),
    kiefer_schnee: B(S(), b => kiefer(b, true)),
    bergfels: B(S(), b => fels(b, 0x9a9aa4, true, 0xf2f6fa)),
    schnee: B(S(), b => schneefleck(b)),
    akazie: B(S(), b => akazie(b)),
    getreide: B(S(), b => getreide(b)),
    trockenbusch: B(S(), b => trockenbusch(b)),
    ebenenfels: B(S(), b => fels(b, 0xa89a80, true)),
    kaktus: B(S(), b => kaktus(b, 1)),
    kaktus_2: B(S(), b => kaktus(b, 2)),
    bogen: B(S(), b => bogen(b)),
    sandfels: B(S(), b => fels(b, 0xd08a50, true)),
    duerrbusch: B(S(), b => trockenbusch(b, 0xa07a4a)),
    eisblock: B(S(), b => eisblock(b)),
    eiszapfen: B(S(), b => eiszapfen(b)),
    schneehaufen: B(S(), b => schneefleck(b)),
    verkohlt: B(S(), b => verkohlt(b)),
    lavafels: B(S(), b => lavafels(b, true)),
    lavafels_klein: B(S(), b => lavafels(b, false)),
    glutspalte: B(S(), b => glutspalte(b)),
    aschefels: B(S(), b => fels(b, 0x4a4040, true)),
    palme: B(S(), b => palme(b)),
    muschel: B(S(), b => muschel(b)),
    treibholz: B(S(), b => treibholz(b)),
    strandfels: B(S(), b => fels(b, 0xb0a890, false)),
    // Erze
    erz_kupfer: B(S(), b => erz(b, 0x7a756e, 0xd9822b, false)),
    erz_eisen: B(S(), b => erz(b, 0x5d5650, 0x9a4a2a, false)),
    erz_silber: B(S(), b => erz(b, 0x8a8a94, 0xe4e8f0, false)),
    erz_gold: B(S(), b => erz(b, 0x8d7f68, 0xf7cc3a, true)),
    erz_eiskristall: B(S(), b => erz(b, 0xcfe6f0, 0x7fe8ff, true, true)),
    erz_bernstein: B(S(), b => erz(b, 0xc98a52, 0xffa820, true)),
    erz_obsidian: B(S(), b => erz(b, 0x3a3236, 0x6a3aa8, true, true)),
    erz_kristall: B(S(), b => erz(b, 0x8a8a96, 0xd08cff, true, true)),
  };
  return M;
}
