// Mesh-Baukasten: Low/Mid-Poly-Primitive mit Vertex-Farben, die zu EINER Geometrie verschmolzen werden.
// Beispiel:
//   const b = new MeshBuilder();
//   b.box(0.6, 0.4, 1.0, 0xd9772b, { y: 0.5 });
//   b.sphere(0.25, 0xffffff, { y: 0.8, z: 0.5, sy: 0.8 }, 6, 4);
//   const mesh = b.mesh(); // THREE.Mesh mit psxMat()
import * as THREE from 'three';
import { psxMat } from './psx.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(),
  _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

/** t = { x,y,z, rx,ry,rz (Radiant), s (uniform), sx,sy,sz, jitter (Farbvariation 0..1) } */
export function tMatrix(t = {}) {
  _p.set(t.x || 0, t.y || 0, t.z || 0);
  _e.set(t.rx || 0, t.ry || 0, t.rz || 0);
  _q.setFromEuler(_e);
  const s = t.s ?? 1;
  _s.set((t.sx ?? 1) * s, (t.sy ?? 1) * s, (t.sz ?? 1) * s);
  return _m.compose(_p, _q, _s).clone();
}

export class MeshBuilder {
  constructor() { this.parts = []; }

  /** Fügt beliebige BufferGeometry mit Farbe und Transform hinzu. */
  add(geo, color, t = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(tMatrix(t));
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    _c.set(color);
    const jit = t.jitter ?? 0.06;
    // Pro Dreieck leicht variierende Farbe => handgemachter PS1-Look
    for (let i = 0; i < n; i += 3) {
      const k = 1 + (Math.random() - 0.5) * jit * 2;
      for (let j = 0; j < 3 && i + j < n; j++) {
        col[(i + j) * 3] = Math.min(1, _c.r * k);
        col[(i + j) * 3 + 1] = Math.min(1, _c.g * k);
        col[(i + j) * 3 + 2] = Math.min(1, _c.b * k);
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(name)) g.deleteAttribute(name);
    this.parts.push(g);
    return this;
  }
  box(w, h, d, color, t) { return this.add(new THREE.BoxGeometry(w, h, d), color, t); }
  sphere(r, color, t, ws = 7, hs = 5) { return this.add(new THREE.SphereGeometry(r, ws, hs), color, t); }
  cyl(rTop, rBot, h, color, t, seg = 7) { return this.add(new THREE.CylinderGeometry(rTop, rBot, h, seg), color, t); }
  cone(r, h, color, t, seg = 7) { return this.add(new THREE.ConeGeometry(r, h, seg), color, t); }
  ico(r, color, t, detail = 0) { return this.add(new THREE.IcosahedronGeometry(r, detail), color, t); }
  capsule(r, len, color, t, cap = 3, seg = 7) { return this.add(new THREE.CapsuleGeometry(r, len, cap, seg), color, t); }

  geometry() {
    let total = 0;
    for (const g of this.parts) total += g.attributes.position.count;
    const pos = new Float32Array(total * 3), col = new Float32Array(total * 3);
    let o = 0;
    for (const g of this.parts) {
      pos.set(g.attributes.position.array, o * 3);
      col.set(g.attributes.color.array, o * 3);
      o += g.attributes.position.count;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    out.computeVertexNormals();
    out.computeBoundingSphere();
    return out;
  }
  mesh(material = psxMat()) {
    const m = new THREE.Mesh(this.geometry(), material);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
}

/** Seeded RNG (mulberry32) */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 2D Value-Noise + fbm, seeded */
export function makeNoise(seed = 1) {
  const r = rng(seed), P = new Uint8Array(512), G = new Float32Array(256);
  for (let i = 0; i < 256; i++) { P[i] = i; G[i] = r() * 2 - 1; }
  for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; [P[i], P[j]] = [P[j], P[i]]; }
  for (let i = 0; i < 256; i++) P[i + 256] = P[i];
  const fade = t => t * t * (3 - 2 * t);
  const v = (x, y) => G[P[P[x & 255] + (y & 255)]];
  function noise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = fade(xf), w = fade(yf);
    const a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
  }
  function fbm(x, y, oct = 4) {
    let s = 0, amp = 0.5, f = 1;
    for (let i = 0; i < oct; i++) { s += noise(x * f, y * f) * amp; f *= 2; amp *= 0.5; }
    return s;
  }
  return { noise, fbm };
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
