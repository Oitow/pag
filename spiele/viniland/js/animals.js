// Viniland – Tiere. 10 cozy Mid-Poly-Tiere mit prozeduraler Animation (siehe CONTRACT.md).
// Jedes Tier: Group (Füße y=0, Blick +Z) mit Untergruppen body/head/legs(hip→knee)/tail/ears.
import * as THREE from 'three';
import { MeshBuilder, rng, clamp, lerp, damp } from './kit.js';

const TAU = Math.PI * 2, HALF = Math.PI / 2;

export const ANIMAL_TYPES = ['fox', 'rabbit', 'deer', 'boar', 'sheep', 'duck', 'hedgehog', 'bear', 'frog', 'squirrel'];

export const ANIMAL_INFO = {
  fox:      { name: 'Fuchs',        size: 'small',  walk: 1.2, run: 5.5, temper: 'skittish', herd: false },
  rabbit:   { name: 'Hase',         size: 'small',  walk: 0.9, run: 6.0, temper: 'skittish', herd: false },
  deer:     { name: 'Reh',          size: 'large',  walk: 1.3, run: 7.5, temper: 'skittish', herd: true },
  boar:     { name: 'Wildschwein',  size: 'medium', walk: 1.0, run: 5.0, temper: 'curious',  herd: false },
  sheep:    { name: 'Schaf',        size: 'medium', walk: 0.8, run: 3.5, temper: 'calm',     herd: true },
  duck:     { name: 'Ente',         size: 'small',  walk: 0.5, run: 1.6, temper: 'curious',  herd: true },
  hedgehog: { name: 'Igel',         size: 'small',  walk: 0.35, run: 1.0, temper: 'calm',    herd: false },
  bear:     { name: 'Bär',          size: 'large',  walk: 1.1, run: 6.0, temper: 'calm',     herd: false },
  frog:     { name: 'Frosch',       size: 'small',  walk: 0.5, run: 2.0, temper: 'curious',  herd: false },
  squirrel: { name: 'Eichhörnchen', size: 'small',  walk: 0.9, run: 4.5, temper: 'skittish', herd: false },
};

const BLACK = 0x1a1210, WHITE = 0xffffff;
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _up = new THREE.Vector3(0, 1, 0), _n = new THREE.Vector3();

// ---------------------------------------------------------------- Rig-Baukasten
class Rig {
  constructor(seed, o) {
    this.r = rng((seed * 9973 + 17) >>> 0);
    this.dh = (this.r() - 0.5) * 0.035; this.dl = (this.r() - 0.5) * 0.07; this.ds = (this.r() - 0.5) * 0.12;
    this.o = o;
    this.py = o.pivotY; this.pz = o.zB;               // Körper-Pivot = Hinterhüfte
    this.root = new THREE.Group();
    this.scaler = new THREE.Group(); this.root.add(this.scaler);
    this.rig = new THREE.Group(); this.scaler.add(this.rig);
    this.body = new THREE.Group(); this.body.position.set(0, this.py, this.pz); this.rig.add(this.body);
    this.torso = new THREE.Group(); this.torso.position.set(0, -this.py, -this.pz);
    this.breath = new THREE.Group(); // Atmen (Skalierung um Hüft-Pivot, klein)
    this.breath.add(this.torso); this.body.add(this.breath);
    this.legs = []; this.ears = []; this.wings = []; this.head = null; this.tail = null;
  }
  c(hex) { const c = new THREE.Color(hex); c.offsetHSL(this.dh, this.ds * 0.3, this.dl); return c.getHex(); }
  /** Gruppe an Root-Koordinate in den Körper hängen. */
  place(g, x, y, z) { g.position.set(x, y - this.py, z - this.pz); this.body.add(g); return g; }
  torsoMesh(b) { this.torso.add(b.mesh()); }
  addHead(y, z, b) { const g = new THREE.Group(); g.add(b.mesh()); this.head = this.place(g, 0, y, z); return g; }
  addTail(y, z, b, restX = 0) {
    const g = new THREE.Group(); g.add(b.mesh()); g.rotation.x = restX; g.userData.rest = restX;
    this.tail = this.place(g, 0, y, z); return g;
  }
  /** Ohr als Kind des Kopfs, lokale Koordinate im Kopf. */
  addEar(x, y, z, b, rx = 0, ry = 0, rz = 0) {
    const g = new THREE.Group(); g.add(b.mesh()); g.position.set(x, y, z); g.rotation.set(rx, ry, rz);
    g.userData = { rest: new THREE.Euler(rx, ry, rz), side: Math.sign(x) || 1, tw: 0 };
    this.head.add(g); this.ears.push(g); return g;
  }
  addWing(x, y, z, b) {
    const g = new THREE.Group(); g.add(b.mesh()); this.place(g, x, y, z);
    g.userData.side = Math.sign(x); this.wings.push(g); return g;
  }
  /** Bein: Pivot an der Hüfte, Knie-Untergruppe. */
  addLeg(L) {
    const { x, y, z, l1, l2, r, c1, c2, fc } = L;
    const hip = new THREE.Group(); this.place(hip, x, y, z);
    const b1 = new MeshBuilder();
    b1.sphere(r * 1.3, c1, { y: -r * 0.3 }, 5, 3);
    b1.cyl(r * 1.25, r, l1, c1, { y: -l1 / 2 }, 6);
    hip.add(b1.mesh());
    const knee = new THREE.Group(); knee.position.y = -l1; hip.add(knee);
    const b2 = new MeshBuilder();
    b2.cyl(r, r * 0.85, l2, c2, { y: -l2 / 2 }, 6);
    const f = L.foot || 'paw';
    if (f === 'hoof') b2.cyl(r * 0.95, r * 1.1, r * 1.3, fc, { y: -l2 + r * 0.65 }, 6);
    else if (f === 'paw') b2.sphere(r * 1.3, fc, { y: -l2 + r * 0.55, z: r * 0.4, sy: 0.6, sz: 1.35 }, 6, 4);
    else if (f === 'bigpaw') b2.sphere(r * 1.4, fc, { y: -l2 + r * 0.5, z: r * 1.2, sy: 0.45, sz: 2.3 }, 6, 4);
    else if (f === 'web') b2.sphere(r * 2.2, fc, { y: -l2 + r * 0.3, z: r * 1.6, sy: 0.18, sz: 1.3 }, 6, 3);
    knee.add(b2.mesh());
    const side = Math.sign(x) || 1;
    const leg = { hip, knee, front: !!L.front, side, restHip: L.restHip || 0, restKnee: L.restKnee || 0, splay: L.splay || 0 };
    hip.rotation.z = leg.splay * side;
    this.legs.push(leg); return leg;
  }
  /** 4 Beine symmetrisch. */
  quadLegs(F, B) {
    for (const s of [1, -1]) {
      this.addLeg({ ...F, x: s * F.x, front: true });
      this.addLeg({ ...B, x: s * B.x, front: false });
    }
  }
}

function eye(b, x, y, z, r, turn = 0.35) {
  const s = Math.sign(x), ry = s * turn;
  const fx = Math.sin(ry), fz = Math.cos(ry);
  const T = (dx, dy, dz, extra = {}) => ({ x: x + dx * fz + dz * fx, y: y + dy, z: z - dx * fx + dz * fz, ry, jitter: 0, ...extra });
  b.sphere(r, WHITE, T(0, 0, 0, { sz: 0.75 }), 7, 5);
  b.sphere(r * 0.7, BLACK, T(0, -r * 0.05, r * 0.3, { sz: 0.7 }), 6, 5);
  b.sphere(r * 0.24, WHITE, T(r * 0.2, r * 0.3, r * 0.72), 5, 4);
}

/** Viele Elemente (Stacheln, Mähne) entlang Normalen ausrichten. */
function alongNormal(nx, ny, nz) {
  _n.set(nx, ny, nz).normalize(); _q.setFromUnitVectors(_up, _n); _e.setFromQuaternion(_q);
  return { rx: _e.x, ry: _e.y, rz: _e.z };
}

// ---------------------------------------------------------------- Tiere
const BUILD = {
  fox(R) {
    const O = R.c(0xe2712a), W = R.c(0xfff0dc), D = 0x3a2a24;
    const b = new MeshBuilder();
    b.sphere(1, O, { y: 0.36, sx: 0.14, sy: 0.13, sz: 0.29 }, 9, 7);
    b.sphere(1, W, { y: 0.31, z: 0.04, sx: 0.115, sy: 0.09, sz: 0.21 }, 8, 5);
    b.sphere(1, W, { y: 0.39, z: 0.2, sx: 0.11, sy: 0.12, sz: 0.1 }, 7, 5);
    R.torsoMesh(b);
    R.quadLegs({ x: 0.075, y: 0.25, z: 0.16, l1: 0.125, l2: 0.125, r: 0.028, c1: O, c2: D, fc: D, foot: 'paw' },
               { x: 0.08, y: 0.25, z: -0.16, l1: 0.125, l2: 0.125, r: 0.034, c1: O, c2: D, fc: D, foot: 'paw' });
    const h = new MeshBuilder();
    h.sphere(1, O, { y: 0, z: -0.02, sx: 0.09, sy: 0.1, sz: 0.09 }, 6, 4);
    h.sphere(0.14, O, { y: 0.08, z: 0.08, sy: 0.88 }, 9, 7);
    for (const s of [1, -1]) h.sphere(0.075, W, { x: s * 0.065, y: 0.035, z: 0.13 }, 6, 4);
    h.cone(0.06, 0.14, W, { y: 0.04, z: 0.25, rx: HALF, sy: 1, sx: 1.05 }, 7);
    h.sphere(0.026, BLACK, { y: 0.05, z: 0.32, jitter: 0 }, 6, 4);
    for (const s of [1, -1]) eye(h, s * 0.062, 0.12, 0.18, 0.043, 0.35);
    R.addHead(0.44, 0.24, h);
    for (const s of [1, -1]) {
      const e = new MeshBuilder();
      e.cone(0.055, 0.14, O, { y: 0.065, sz: 0.5 }, 5);
      e.cone(0.032, 0.09, W, { y: 0.05, z: 0.012, sz: 0.4 }, 5);
      e.cone(0.024, 0.05, D, { y: 0.12, sz: 0.55 }, 5);
      R.addEar(s * 0.075, 0.18, 0.05, e, -0.1, 0, -s * 0.3);
    }
    const t = new MeshBuilder();
    t.sphere(1, O, { z: -0.2, sx: 0.085, sy: 0.085, sz: 0.21 }, 8, 6);
    t.sphere(0.072, W, { z: -0.39, sz: 1.35 }, 7, 5);
    R.addTail(0.39, -0.26, t, -0.45);
  },

  rabbit(R) {
    const M = R.c(0xb48c6a), W = R.c(0xfbf1e2), P = 0xf2a0a8;
    const b = new MeshBuilder();
    b.sphere(1, M, { y: 0.2, z: -0.02, sx: 0.13, sy: 0.13, sz: 0.17 }, 9, 7);
    for (const s of [1, -1]) b.sphere(0.085, M, { x: s * 0.075, y: 0.16, z: -0.08 }, 7, 5);
    b.sphere(1, W, { y: 0.17, z: 0.06, sx: 0.09, sy: 0.1, sz: 0.09 }, 7, 5);
    R.torsoMesh(b);
    R.quadLegs({ x: 0.05, y: 0.11, z: 0.08, l1: 0.055, l2: 0.055, r: 0.02, c1: M, c2: W, fc: W, foot: 'paw' },
               { x: 0.075, y: 0.12, z: -0.1, l1: 0.06, l2: 0.06, r: 0.026, c1: M, c2: M, fc: W, foot: 'bigpaw' });
    const h = new MeshBuilder();
    h.sphere(0.11, M, { y: 0.05, z: 0.06, sx: 1.05, sy: 0.95 }, 9, 7);
    for (const s of [1, -1]) h.sphere(0.048, W, { x: s * 0.035, y: 0.01, z: 0.14 }, 6, 4);
    h.sphere(0.02, P, { y: 0.04, z: 0.17, jitter: 0 }, 6, 4);
    for (const s of [1, -1]) eye(h, s * 0.06, 0.08, 0.12, 0.036, 0.5);
    R.addHead(0.27, 0.1, h);
    for (const s of [1, -1]) {
      const e = new MeshBuilder();
      e.capsule(0.03, 0.14, M, { y: 0.1, sz: 0.45 }, 2, 6);
      e.capsule(0.018, 0.11, P, { y: 0.1, z: 0.01, sz: 0.3 }, 2, 6);
      R.addEar(s * 0.04, 0.13, 0.03, e, -0.25, 0, -s * 0.15);
    }
    const t = new MeshBuilder(); t.sphere(0.05, W, {}, 6, 4);
    R.addTail(0.22, -0.18, t, 0);
  },

  deer(R) {
    const M = R.c(0xc4844e), W = R.c(0xfaead0), D = 0x3a2a20, S = R.c(0xf3dcb4);
    const b = new MeshBuilder();
    b.sphere(1, M, { y: 0.84, sx: 0.2, sy: 0.22, sz: 0.45 }, 10, 7);
    b.sphere(1, W, { y: 0.76, z: 0.02, sx: 0.165, sy: 0.15, sz: 0.36 }, 8, 5);
    b.sphere(1, W, { y: 0.86, z: -0.38, sx: 0.13, sy: 0.14, sz: 0.08 }, 7, 5);
    for (let i = 0; i < 8; i++) {
      const sx = (R.r() - 0.5) * 0.18, sz = (R.r() - 0.5) * 0.6;
      const k = 1 - (sx / 0.2) ** 2 - (sz / 0.45) ** 2;
      if (k < 0.2) continue;
      b.sphere(0.028, S, { x: sx, y: 0.84 + 0.22 * Math.sqrt(k), z: sz, sy: 0.4 }, 5, 3);
    }
    R.torsoMesh(b);
    R.quadLegs({ x: 0.1, y: 0.68, z: 0.3, l1: 0.34, l2: 0.34, r: 0.034, c1: M, c2: M, fc: D, foot: 'hoof' },
               { x: 0.1, y: 0.68, z: -0.3, l1: 0.34, l2: 0.34, r: 0.045, c1: M, c2: M, fc: D, foot: 'hoof' });
    const h = new MeshBuilder();
    h.cyl(0.07, 0.11, 0.3, M, { y: 0.12, z: 0.06, rx: 0.45 }, 7);
    h.sphere(0.13, M, { y: 0.3, z: 0.14, sz: 1.1 }, 9, 7);
    h.sphere(0.078, W, { y: 0.25, z: 0.28, sz: 1.25 }, 7, 5);
    h.sphere(0.026, BLACK, { y: 0.27, z: 0.37, jitter: 0 }, 6, 4);
    for (const s of [1, -1]) eye(h, s * 0.075, 0.33, 0.21, 0.048, 0.45);
    const antlers = R.r() < 0.5;
    if (antlers) {
      const A = 0xe9d9b8;
      for (const s of [1, -1]) {
        h.cyl(0.01, 0.016, 0.2, A, { x: s * 0.07, y: 0.48, z: 0.1, rz: -s * 0.35, rx: -0.2 }, 5);
        h.cyl(0.008, 0.012, 0.1, A, { x: s * 0.09, y: 0.52, z: 0.15, rz: -s * 0.1, rx: 0.6 }, 5);
        h.cyl(0.007, 0.01, 0.09, A, { x: s * 0.13, y: 0.59, z: 0.09, rz: -s * 0.8 }, 5);
      }
    }
    R.addHead(0.97, 0.36, h);
    for (const s of [1, -1]) {
      const e = new MeshBuilder();
      e.sphere(1, M, { y: 0.07, sx: 0.045, sy: 0.09, sz: 0.022 }, 7, 5);
      e.sphere(1, W, { y: 0.07, z: 0.01, sx: 0.03, sy: 0.065, sz: 0.012 }, 6, 4);
      R.addEar(s * 0.085, 0.38, 0.1, e, 0, 0, -s * 0.95);
    }
    const t = new MeshBuilder(); t.sphere(0.05, W, { z: -0.02, sz: 1.3 }, 6, 4);
    R.addTail(0.92, -0.44, t, 0.3);
    return { antlers };
  },

  boar(R) {
    const M = R.c(0x6e4c38), D = R.c(0x3e2a20), L = R.c(0x8e6a52), P = R.c(0xc8948a);
    const b = new MeshBuilder();
    b.sphere(1, M, { y: 0.47, sx: 0.24, sy: 0.26, sz: 0.42 }, 10, 7);
    b.sphere(1, L, { y: 0.38, z: 0.03, sx: 0.2, sy: 0.17, sz: 0.34 }, 8, 5);
    for (let i = 0; i < 7; i++) {
      const z = 0.3 - i * 0.09, k = Math.sqrt(Math.max(0, 1 - (z / 0.42) ** 2));
      b.cone(0.05, 0.09, D, { y: 0.47 + 0.25 * k, z, rx: -0.5 + i * 0.05, sx: 0.5 }, 5);
    }
    R.torsoMesh(b);
    R.quadLegs({ x: 0.12, y: 0.27, z: 0.22, l1: 0.135, l2: 0.135, r: 0.045, c1: M, c2: D, fc: 0x2a1e18, foot: 'hoof' },
               { x: 0.12, y: 0.27, z: -0.22, l1: 0.135, l2: 0.135, r: 0.05, c1: M, c2: D, fc: 0x2a1e18, foot: 'hoof' });
    const h = new MeshBuilder();
    h.sphere(1, M, { y: -0.02, z: 0.1, sx: 0.17, sy: 0.17, sz: 0.2 }, 9, 7);
    h.cyl(0.08, 0.11, 0.17, L, { y: -0.06, z: 0.27, rx: HALF }, 8);
    h.cyl(0.085, 0.085, 0.025, P, { y: -0.06, z: 0.36, rx: HALF }, 8);
    for (const s of [1, -1]) {
      h.sphere(0.016, BLACK, { x: s * 0.03, y: -0.06, z: 0.37, jitter: 0 }, 4, 3);
      h.cone(0.016, 0.08, 0xfff4dc, { x: s * 0.075, y: -0.07, z: 0.29, rz: -s * 0.4 }, 5);
    }
    for (const s of [1, -1]) eye(h, s * 0.09, 0.05, 0.2, 0.042, 0.4);
    R.addHead(0.5, 0.33, h);
    for (const s of [1, -1]) {
      const e = new MeshBuilder();
      e.cone(0.055, 0.11, M, { y: 0.05, sz: 0.45 }, 5);
      e.cone(0.03, 0.07, P, { y: 0.04, z: 0.01, sz: 0.35 }, 5);
      R.addEar(s * 0.1, 0.13, 0.06, e, 0.45, 0, -s * 0.5);
    }
    const t = new MeshBuilder();
    t.cyl(0.012, 0.018, 0.14, M, { y: -0.07 }, 5);
    t.cone(0.03, 0.06, D, { y: -0.16, rx: Math.PI }, 5);
    R.addTail(0.55, -0.42, t, 0.5);
  },

  sheep(R) {
    const Wo = R.c(0xf5ecda), F = R.c(0x4c3c36), Fm = R.c(0x6c5a50);
    const b = new MeshBuilder();
    b.ico(0.3, Wo, { y: 0.6, sx: 0.85, sy: 0.85, sz: 1.3 }, 1);
    for (let i = 0; i < 14; i++) {
      const a = R.r() * TAU, v = R.r() * 0.9 - 0.2;
      const nx = Math.cos(a) * Math.sqrt(1 - v * v), ny = v, nz = Math.sin(a) * Math.sqrt(1 - v * v);
      b.ico(0.11 + R.r() * 0.05, Wo, { x: nx * 0.24, y: 0.6 + ny * 0.24, z: nz * 0.36, ry: R.r() * 3 }, 0);
    }
    R.torsoMesh(b);
    R.quadLegs({ x: 0.1, y: 0.33, z: 0.2, l1: 0.165, l2: 0.165, r: 0.03, c1: F, c2: F, fc: 0x2a201c, foot: 'hoof' },
               { x: 0.1, y: 0.33, z: -0.2, l1: 0.165, l2: 0.165, r: 0.034, c1: F, c2: F, fc: 0x2a201c, foot: 'hoof' });
    const h = new MeshBuilder();
    h.sphere(0.13, F, { y: 0.02, z: 0.1, sz: 1.2 }, 9, 7);
    h.sphere(0.075, Fm, { y: -0.03, z: 0.22, sx: 1.1 }, 7, 5);
    h.sphere(0.016, BLACK, { x: 0.025, y: -0.01, z: 0.29, jitter: 0 }, 4, 3);
    h.sphere(0.016, BLACK, { x: -0.025, y: -0.01, z: 0.29, jitter: 0 }, 4, 3);
    h.ico(0.1, Wo, { y: 0.13, z: 0.05, sy: 0.8 }, 0);
    h.ico(0.07, Wo, { y: 0.12, z: 0.13, sy: 0.7 }, 0);
    for (const s of [1, -1]) eye(h, s * 0.075, 0.05, 0.18, 0.042, 0.45);
    R.addHead(0.64, 0.36, h);
    for (const s of [1, -1]) {
      const e = new MeshBuilder();
      e.sphere(1, F, { x: s * 0.06, sx: 0.07, sy: 0.026, sz: 0.036 }, 6, 4);
      R.addEar(s * 0.1, 0.06, 0.06, e, 0, 0, -s * 0.4);
    }
    const t = new MeshBuilder(); t.ico(0.07, Wo, { y: -0.03 }, 0);
    R.addTail(0.62, -0.42, t, 0);
  },

  duck(R) {
    const M = R.c(0xa07a54), Ml = R.c(0xcaa982), G = R.c(0x2e8a52), Y = 0xf4c02c, O = 0xf28a22;
    const b = new MeshBuilder();
    b.sphere(1, M, { y: 0.2, sx: 0.13, sy: 0.12, sz: 0.19 }, 9, 7);
    b.sphere(1, Ml, { y: 0.17, z: 0.05, sx: 0.11, sy: 0.09, sz: 0.13 }, 8, 5);
    R.torsoMesh(b);
    for (const s of [1, -1])
      R.addLeg({ x: s * 0.055, y: 0.11, z: 0.0, l1: 0.055, l2: 0.055, r: 0.016, c1: O, c2: O, fc: O, foot: 'web' });
    for (const s of [1, -1]) {
      const w = new MeshBuilder();
      w.sphere(1, R.c(0x7a5a40), { x: s * 0.01, z: -0.05, sx: 0.03, sy: 0.075, sz: 0.14, rx: -0.15 }, 7, 5);
      w.box(0.012, 0.03, 0.07, 0x3a5ad8, { x: s * 0.028, y: 0.0, z: -0.07, jitter: 0 });
      R.addWing(s * 0.115, 0.22, -0.01, w);
    }
    const h = new MeshBuilder();
    h.cyl(0.04, 0.055, 0.13, G, { y: 0.055, z: 0.0, rx: 0.15 }, 7);
    h.cyl(0.057, 0.057, 0.02, WHITE, { y: 0.0 }, 8);
    h.sphere(0.085, G, { y: 0.14, z: 0.03, sz: 1.1 }, 9, 7);
    h.sphere(1, Y, { y: 0.115, z: 0.13, sx: 0.05, sy: 0.022, sz: 0.075 }, 7, 4);
    for (const s of [1, -1]) eye(h, s * 0.05, 0.165, 0.075, 0.03, 0.6);
    R.addHead(0.27, 0.12, h);
    const t = new MeshBuilder();
    t.cone(0.06, 0.12, R.c(0x4a4038), { y: 0.05, sx: 1.2, sz: 0.45 }, 6);
    R.addTail(0.22, -0.16, t, -HALF + 0.55);
  },

  hedgehog(R) {
    const C = R.c(0xe8cfa6), Q = R.c(0x5a3e2c), Qt = R.c(0x9a7a58), D = 0x3a2a22;
    const b = new MeshBuilder();
    b.sphere(1, C, { y: 0.1, sx: 0.11, sy: 0.08, sz: 0.15 }, 8, 6);
    b.sphere(1, Q, { y: 0.13, z: -0.02, sx: 0.13, sy: 0.11, sz: 0.16 }, 9, 7);
    for (let i = 0; i < 46; i++) {
      const u = R.r() * TAU, v = 0.15 + R.r() * 0.85;
      let nx = Math.cos(u) * Math.sqrt(1 - v * v), ny = v, nz = Math.sin(u) * Math.sqrt(1 - v * v);
      if (nz > 0.6) nz = 0.6 - (nz - 0.6);           // Gesicht frei lassen
      const px = nx * 0.12, py = 0.13 + ny * 0.1, pz = -0.02 + nz * 0.15;
      b.cone(0.022, 0.08, i % 3 ? Q : Qt, { x: px, y: py, z: pz, ...alongNormal(nx * 0.8, ny + 0.25, nz - 0.35) }, 4);
    }
    R.torsoMesh(b);
    R.quadLegs({ x: 0.06, y: 0.055, z: 0.07, l1: 0.028, l2: 0.028, r: 0.014, c1: C, c2: D, fc: D, foot: 'paw' },
               { x: 0.065, y: 0.055, z: -0.07, l1: 0.028, l2: 0.028, r: 0.016, c1: C, c2: D, fc: D, foot: 'paw' });
    const h = new MeshBuilder();
    h.sphere(0.07, C, { z: 0.03 }, 8, 6);
    h.cone(0.038, 0.1, C, { y: -0.01, z: 0.1, rx: HALF }, 7);
    h.sphere(0.018, BLACK, { y: -0.01, z: 0.152, jitter: 0 }, 5, 4);
    for (const s of [1, -1]) eye(h, s * 0.036, 0.03, 0.075, 0.023, 0.5);
    R.addHead(0.1, 0.12, h);
    for (const s of [1, -1]) {
      const e = new MeshBuilder(); e.sphere(0.02, C, { sz: 0.5 }, 5, 4);
      R.addEar(s * 0.05, 0.055, 0.0, e, 0, 0, -s * 0.3);
    }
  },

  bear(R) {
    const M = R.c(0x7a5236), L = R.c(0x9c7252), T = R.c(0xd4ac7c), D = R.c(0x4a3020);
    const b = new MeshBuilder();
    b.sphere(1, M, { y: 0.95, sx: 0.38, sy: 0.4, sz: 0.62 }, 11, 8);
    b.sphere(1, M, { y: 1.12, z: 0.25, sx: 0.31, sy: 0.25, sz: 0.3 }, 9, 6);
    b.sphere(1, L, { y: 0.8, z: 0.05, sx: 0.32, sy: 0.27, sz: 0.5 }, 9, 6);
    R.torsoMesh(b);
    R.quadLegs({ x: 0.2, y: 0.55, z: 0.36, l1: 0.275, l2: 0.275, r: 0.1, c1: M, c2: M, fc: D, foot: 'paw' },
               { x: 0.21, y: 0.55, z: -0.36, l1: 0.275, l2: 0.275, r: 0.12, c1: M, c2: M, fc: D, foot: 'paw' });
    const h = new MeshBuilder();
    h.sphere(0.27, M, { y: 0.02, z: 0.14, sx: 1.05, sy: 0.95 }, 10, 8);
    h.sphere(1, T, { y: -0.06, z: 0.37, sx: 0.14, sy: 0.11, sz: 0.13 }, 8, 6);
    h.sphere(1, BLACK, { y: 0.0, z: 0.49, sx: 0.055, sy: 0.038, sz: 0.035, jitter: 0 }, 7, 5);
    for (const s of [1, -1]) eye(h, s * 0.11, 0.11, 0.33, 0.058, 0.4);
    R.addHead(1.05, 0.55, h);
    for (const s of [1, -1]) {
      const e = new MeshBuilder();
      e.sphere(0.085, M, { sz: 0.5 }, 7, 5);
      e.sphere(0.05, T, { z: 0.025, sz: 0.4 }, 6, 4);
      R.addEar(s * 0.17, 0.23, 0.07, e, 0, 0, -s * 0.3);
    }
    const t = new MeshBuilder(); t.sphere(0.075, M, {}, 6, 4);
    R.addTail(1.02, -0.62, t, 0);
  },

  frog(R) {
    const G = R.c(0x6cc04a), Gd = R.c(0x4a9a36), Y = R.c(0xeee49e);
    const b = new MeshBuilder();
    b.sphere(1, G, { y: 0.09, sx: 0.09, sy: 0.07, sz: 0.1, rx: -0.25 }, 9, 7);
    b.sphere(1, Y, { y: 0.065, z: 0.03, sx: 0.075, sy: 0.05, sz: 0.08 }, 8, 5);
    for (let i = 0; i < 5; i++) b.sphere(0.018, Gd, { x: (R.r() - 0.5) * 0.1, y: 0.15, z: (R.r() - 0.5) * 0.12, sy: 0.4 }, 5, 3);
    R.torsoMesh(b);
    for (const s of [1, -1]) {
      R.addLeg({ x: s * 0.06, y: 0.07, z: 0.06, l1: 0.04, l2: 0.035, r: 0.013, c1: G, c2: G, fc: Y, foot: 'web', front: true, splay: 0.25 });
      R.addLeg({ x: s * 0.07, y: 0.07, z: -0.06, l1: 0.08, l2: 0.08, r: 0.024, c1: G, c2: G, fc: Y, foot: 'web', restHip: -1.1, restKnee: 2.1, splay: 0.5 });
    }
    const h = new MeshBuilder();
    h.sphere(1, G, { z: 0.04, sx: 0.085, sy: 0.055, sz: 0.07 }, 9, 6);
    h.sphere(1, Y, { y: -0.02, z: 0.05, sx: 0.07, sy: 0.035, sz: 0.06 }, 7, 4);
    h.box(0.11, 0.005, 0.01, 0x2a4a20, { y: -0.005, z: 0.105, jitter: 0 });
    for (const s of [1, -1]) {
      h.sphere(0.036, G, { x: s * 0.045, y: 0.035, z: 0.05 }, 7, 5);
      eye(h, s * 0.046, 0.05, 0.06, 0.03, 0.4);
    }
    R.addHead(0.12, 0.06, h);
  },

  squirrel(R) {
    const M = R.c(0xc85a28), W = R.c(0xfbe8cc), D = R.c(0x6a2c14);
    const b = new MeshBuilder();
    b.sphere(1, M, { y: 0.15, sx: 0.07, sy: 0.075, sz: 0.12 }, 9, 7);
    b.sphere(1, W, { y: 0.13, z: 0.04, sx: 0.055, sy: 0.06, sz: 0.08 }, 7, 5);
    for (const s of [1, -1]) b.sphere(0.048, M, { x: s * 0.04, y: 0.12, z: -0.06 }, 6, 4);
    R.torsoMesh(b);
    R.quadLegs({ x: 0.04, y: 0.085, z: 0.06, l1: 0.043, l2: 0.042, r: 0.013, c1: M, c2: M, fc: W, foot: 'paw' },
               { x: 0.045, y: 0.09, z: -0.07, l1: 0.045, l2: 0.045, r: 0.018, c1: M, c2: M, fc: M, foot: 'bigpaw' });
    const h = new MeshBuilder();
    h.sphere(0.07, M, { y: 0.03, z: 0.04 }, 9, 7);
    h.sphere(0.045, W, { y: 0.005, z: 0.075, sx: 1.2 }, 7, 5);
    h.sphere(0.013, BLACK, { y: 0.02, z: 0.115, jitter: 0 }, 5, 4);
    for (const s of [1, -1]) eye(h, s * 0.04, 0.05, 0.07, 0.027, 0.5);
    R.addHead(0.2, 0.08, h);
    for (const s of [1, -1]) {
      const e = new MeshBuilder();
      e.cone(0.022, 0.05, M, { y: 0.025, sz: 0.5 }, 5);
      e.cone(0.012, 0.04, D, { y: 0.06, rz: -s * 0.2 }, 4);
      R.addEar(s * 0.035, 0.085, 0.02, e, -0.1, 0, -s * 0.25);
    }
    const t = new MeshBuilder();
    t.sphere(1, M, { y: 0.07, z: -0.07, sx: 0.055, sy: 0.1, sz: 0.07, rx: 0.6 }, 8, 6);
    t.sphere(1, M, { y: 0.19, z: -0.06, sx: 0.06, sy: 0.08, sz: 0.075 }, 8, 6);
    t.sphere(1, R.c(0xe07a40), { y: 0.25, z: 0.0, sx: 0.045, sy: 0.05, sz: 0.06 }, 7, 5);
    R.addTail(0.15, -0.1, t, 0);
  },
};

// Rig-Parameter: pivotY = Hinterhüft-Höhe, zF/zB Hüft-z, stride = m pro Gangzyklus (Schritt), gait, sitMode.
const CFG = {
  fox:      { pivotY: 0.25, zF: 0.16, zB: -0.16, stride: 0.5,  gait: 'quad',   sit: 'quad',  eatA: 0.75, radius: 0.22, height: 0.62, wag: 5, tailLift: 0.4 },
  rabbit:   { pivotY: 0.12, zF: 0.08, zB: -0.1,  stride: 0.32, gait: 'hop',    sit: 'upright', eatA: 0.6, radius: 0.15, height: 0.5, hopH: 0.12, wag: 14 },
  deer:     { pivotY: 0.68, zF: 0.3,  zB: -0.3,  stride: 1.1,  gait: 'quad',   sit: 'quad',  eatA: 1.35, radius: 0.4, height: 1.5, wag: 10 },
  boar:     { pivotY: 0.27, zF: 0.22, zB: -0.22, stride: 0.55, gait: 'quad',   sit: 'quad',  eatA: 0.55, radius: 0.38, height: 0.8, wag: 12 },
  sheep:    { pivotY: 0.33, zF: 0.2,  zB: -0.2,  stride: 0.55, gait: 'quad',   sit: 'quad',  eatA: 0.9, radius: 0.38, height: 0.95, wag: 9 },
  duck:     { pivotY: 0.11, zF: 0.0,  zB: 0.0,   stride: 0.16, gait: 'waddle', sit: 'squat', eatA: 0.9, radius: 0.15, height: 0.45, wag: 16 },
  hedgehog: { pivotY: 0.055, zF: 0.07, zB: -0.07, stride: 0.12, gait: 'quad',  sit: 'squat', eatA: 0.5, radius: 0.15, height: 0.25, wag: 8 },
  bear:     { pivotY: 0.55, zF: 0.36, zB: -0.36, stride: 1.2,  gait: 'amble',  sit: 'quad',  eatA: 0.6, radius: 0.6, height: 1.45, wag: 6 },
  frog:     { pivotY: 0.07, zF: 0.06, zB: -0.06, stride: 0.3,  gait: 'frog',   sit: 'none',  eatA: 0.25, radius: 0.1, height: 0.18, hopH: 0.14 },
  squirrel: { pivotY: 0.09, zF: 0.06, zB: -0.07, stride: 0.3,  gait: 'hop',    sit: 'upright', eatA: 0.4, radius: 0.1, height: 0.42, hopH: 0.09, wag: 7 },
};

// ---------------------------------------------------------------- Factory
export function createAnimal(type, seed = 1) {
  if (!BUILD[type]) throw new Error('Unbekanntes Tier: ' + type);
  const cfg = CFG[type], info = ANIMAL_INFO[type];
  const R = new Rig(seed, cfg);
  const extra = BUILD[type](R) || {};
  const scale = 1 + (R.r() - 0.5) * 0.16;
  R.scaler.scale.setScalar(scale);
  R.root.name = 'animal:' + type;
  R.root.userData.animal = type;

  // Sitz-Geometrie vorberechnen
  const d = Math.max(0.01, cfg.zF - cfg.zB), hy = cfg.pivotY;
  let drop = hy * 0.5, theta = Math.asin(Math.min(0.85, drop / d)), phi = Math.acos(clamp((hy - drop) / hy, -1, 1));
  if (cfg.sit === 'upright') { drop = hy * 0.35; theta = 1.0; phi = Math.acos(0.65); }

  const rnd = rng((seed * 7919 + 3) >>> 0);
  const st = { t: rnd() * 10, phase: rnd() * TAU, amp: 0, run: 0, sit: 0, eat: 0, air: 0, lookY: 0, lookT: 2 + rnd() * 3,
    lookTarget: 0, wagT: 2 + rnd() * 4, wagEnv: 0, earT: 1 + rnd() * 3, turn: 0 };
  const { rig, body, breath, head, tail, legs, ears, wings } = R;
  const headRest = head ? head.rotation.x : 0;

  function animate(dt, s = {}) {
    dt = Math.min(dt || 0, 0.1);
    const spd = Math.abs(s.speed || 0), turn = s.turn || 0, grounded = s.grounded !== false;
    st.t += dt; const t = st.t;
    st.amp = damp(st.amp, clamp(spd / (info.walk * 0.5), 0, 1), 8, dt);
    st.run = damp(st.run, clamp((spd - info.walk) / (info.run - info.walk), 0, 1), 5, dt);
    st.sit = damp(st.sit, s.action === 'sit' && spd < 0.2 ? 1 : 0, 4, dt);
    st.eat = damp(st.eat, s.action === 'eat' && spd < 0.4 ? 1 : 0, 5, dt);
    st.air = damp(st.air, grounded ? 0 : 1, 10, dt);
    st.turn = damp(st.turn, turn, 6, dt);
    const stride = cfg.stride * scale * (1 + st.run * 1.1);
    st.phase = (st.phase + dt * spd / stride * TAU) % (TAU * 8);
    const ph = st.phase, amp = st.amp * (1 - st.sit), run = st.run, sit = st.sit;

    let y = 0, pitch = 0, roll = 0, yaw = 0, nod = 0;
    const A = lerp(0.4, 0.8, run) * amp;
    const hopping = cfg.gait === 'hop' || cfg.gait === 'frog';
    for (const L of legs) { L.h = L.restHip; L.k = L.restKnee; }

    if (cfg.gait === 'quad' || cfg.gait === 'amble') {
      for (const L of legs) {
        const walkOff = (L.side > 0 ? (L.front ? 0.25 : 0) : (L.front ? 0.75 : 0.5)) * TAU;
        const trotOff = cfg.gait === 'amble' ? (L.side > 0 ? 0 : Math.PI) + (L.front ? 0.6 : 0)
                                              : (L.front ? 0 : Math.PI) + (L.side > 0 ? 0 : Math.PI);
        const off = lerp(walkOff, trotOff, run), p = ph + off;
        L.h += Math.sin(p) * A;
        L.k += Math.max(0, -Math.cos(p)) * A * 1.4;
      }
      y += (0.5 - 0.5 * Math.cos(2 * ph)) * hy * 0.06 * amp * (1 + run);
      pitch += Math.sin(2 * ph) * 0.025 * amp;
      if (cfg.gait === 'amble') roll += Math.sin(ph) * 0.06 * amp;
      nod = Math.sin(2 * ph + 0.6) * 0.06 * amp;
    } else if (cfg.gait === 'waddle') {
      for (const L of legs) {
        const p = ph + (L.side > 0 ? 0 : Math.PI);
        L.h += Math.sin(p) * 0.7 * amp; L.k += Math.max(0, -Math.cos(p)) * 0.8 * amp;
      }
      roll += Math.sin(ph) * 0.2 * amp; yaw += Math.sin(ph) * 0.12 * amp;
      y += Math.abs(Math.cos(ph)) * hy * 0.12 * amp;
      nod = Math.sin(2 * ph) * 0.15 * amp;
    } else if (cfg.gait === 'hop') {
      const s1 = Math.sin(ph), air = Math.max(0, s1), lift = amp;
      y += air * cfg.hopH * scale * lift * (1 + run * 0.6);
      pitch += -Math.cos(ph) * 0.22 * lift;
      for (const L of legs) {
        if (L.front) { L.h += -s1 * 0.9 * lift; L.k += Math.max(0, s1) * 0.4 * lift; }
        else { const q = Math.sin(ph - 0.5); L.h += q * 1.0 * lift; L.k += Math.max(0, -q) * 1.3 * lift; }
      }
      nod = Math.cos(ph) * 0.15 * lift;
    } else if (cfg.gait === 'frog') {
      const s1 = Math.sin(ph), air = Math.max(0, s1), lift = amp;
      y += air * cfg.hopH * scale * lift * (1 + run * 0.6);
      pitch += -Math.cos(ph) * 0.3 * lift;
      for (const L of legs) {
        if (L.front) L.h += -air * 0.8 * lift;
        else { L.h += air * 1.6 * lift; L.k -= air * 2.0 * lift; }
      }
    }

    // In der Luft (Sprung/Fall)
    if (!hopping) for (const L of legs) L.h += (L.front ? -0.5 : 0.6) * st.air;

    // Sitzen
    if (cfg.sit === 'quad' || cfg.sit === 'upright') {
      y -= drop * sit; pitch -= theta * sit;
      for (const L of legs) {
        if (L.front) L.h += (cfg.sit === 'upright' ? -0.6 : theta) * sit, L.k += (cfg.sit === 'upright' ? 0.8 : 0) * sit;
        else { L.h += (theta - phi) * sit; L.k += 2 * phi * sit; }
      }
    } else if (cfg.sit === 'squat') {
      y -= hy * 0.75 * sit;
      for (const L of legs) { L.h += -1.1 * sit; L.k += 2.2 * sit; }
    }

    // Fressen: Körper vorn leicht runter
    pitch += 0.08 * st.eat;

    // Idle: Atmen + Umschauen
    const idle = 1 - st.amp;
    const br = Math.sin(t * (2.2 + run * 3)) * (0.6 * idle + 0.4);
    breath.scale.set(1 + br * 0.012, 1 + br * 0.02, 1 + br * 0.006);
    st.lookT -= dt;
    if (st.lookT < 0) { st.lookT = 2 + rnd() * 4; st.lookTarget = idle > 0.7 && st.eat < 0.5 && rnd() < 0.6 ? (rnd() - 0.5) * 1.0 : 0; }
    if (idle < 0.5) st.lookTarget = 0;
    st.lookY = damp(st.lookY, st.lookTarget + clamp(st.turn * 0.3, -0.5, 0.5), 3, dt);

    rig.position.y = y;
    rig.rotation.set(0, yaw, roll + clamp(-st.turn * spd * 0.03, -0.25, 0.25));
    body.rotation.x = pitch;
    for (const L of legs) { L.hip.rotation.x = L.h; L.knee.rotation.x = L.k; }

    if (head) {
      const chew = st.eat * Math.sin(t * 11) * 0.05;
      head.rotation.x = headRest + nod + st.eat * cfg.eatA + chew + theta * sit * 0.85 * (cfg.sit === 'squat' ? 0 : 1)
        - (cfg.sit === 'squat' ? 0 : 0) + Math.sin(t * 1.3) * 0.02 * idle;
      head.rotation.y = st.lookY;
      head.rotation.z = Math.sin(t * 0.7) * 0.04 * idle;
    }

    // Ohren zucken
    st.earT -= dt;
    if (st.earT < 0 && ears.length) { st.earT = 1.2 + rnd() * 4; ears[(rnd() * ears.length) | 0].userData.tw = 1; }
    for (const e of ears) {
      const u = e.userData; u.tw *= Math.exp(-5 * dt);
      e.rotation.x = u.rest.x - u.tw * 0.25 + (hopping ? Math.cos(ph) * 0.2 * amp : 0) - run * 0.3;
      e.rotation.z = u.rest.z + u.side * Math.sin(t * 32) * u.tw * 0.3;
    }

    // Schwanz wedeln
    st.wagT -= dt;
    if (st.wagT < 0) { st.wagT = 2.5 + rnd() * 5; st.wagEnv = 1; }
    st.wagEnv = Math.max(0, st.wagEnv - dt * 0.8);
    if (tail) {
      const env = Math.min(1, st.wagEnv * 2) + st.eat * 0.4;
      tail.rotation.y = Math.sin(t * (cfg.wag || 8)) * 0.35 * env - st.turn * 0.15;
      tail.rotation.x = tail.userData.rest + run * (cfg.tailLift || 0.15) + Math.sin(2 * ph) * 0.06 * amp
        + (cfg.sit === 'quad' ? -theta * sit * 0.6 : 0);
    }

    // Flügel (Ente): Flattern beim Rennen / gelegentlich
    for (const w of wings) {
      const f = Math.max(run, st.wagEnv > 0.6 ? (st.wagEnv - 0.6) * 2.5 : 0);
      w.rotation.z = w.userData.side * (Math.max(0, Math.sin(t * 22)) * 0.9 * f + 0.05 * amp);
    }
  }

  return {
    type, object3D: R.root,
    radius: cfg.radius * scale, height: cfg.height * scale,
    scale, info, antlers: !!extra.antlers,
    animate,
  };
}
