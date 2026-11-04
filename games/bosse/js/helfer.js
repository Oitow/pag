// Gemeinsame Hilfen für alle Bosse: Keyframes, IK, Partikel, Voxel, Outline.
import * as THREE from 'three';

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = t => Math.min(1, Math.max(0, t));
export const smooth = t => t * t * (3 - 2 * t);
export const TAU = Math.PI * 2;

export function rng(seed = 1) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Keyframe-Pose: keys = [[t, {wert: x}], ...], erster und letzter Key = Ruhe (0).
// p < 0 → kein Angriff → alles 0.
export function kf(p, keys) {
  const out = {};
  for (const [, o] of keys) for (const k in o) out[k] = 0;
  if (p < 0 || p >= 1) return out;
  let i = 0;
  while (i < keys.length - 2 && p > keys[i + 1][0]) i++;
  const [t0, a] = keys[i], [t1, b] = keys[i + 1];
  const f = smooth(clamp01((p - t0) / (t1 - t0)));
  for (const k in out) out[k] = (a[k] || 0) + ((b[k] || 0) - (a[k] || 0)) * f;
  return out;
}

// Mesh (Geometrie mit Höhe 1 entlang Y, zentriert) zwischen zwei Punkte legen.
const _v = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
export function zwischen(mesh, a, b, dicke = 1) {
  _v.subVectors(b, a);
  const l = _v.length();
  mesh.position.addVectors(a, b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(_up, _v.divideScalar(l || 1));
  mesh.scale.set(dicke, l, dicke);
}

// Zwei-Knochen-IK: Hüfte h, Ziel f, Längen a/b, pole = Richtung, in die das Knie zeigt.
export function ik2(h, f, a, b, pole, knieOut) {
  const d = new THREE.Vector3().subVectors(f, h);
  let len = d.length();
  len = Math.min(len, a + b - 1e-3);
  d.normalize();
  const cosA = clamp01(0.5 + 0.5 * ((a * a + len * len - b * b) / (2 * a * len))) * 2 - 1;
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const p = pole.clone().addScaledVector(d, -d.dot(pole)).normalize();
  knieOut.copy(h).addScaledVector(d, cosA * a).addScaledVector(p, sinA * a);
  return knieOut;
}

// Outline per „Inverted Hull“: vergrößerte Rückseiten-Kopie.
export function outline(mesh, dicke = 0.04, farbe = 0x111111) {
  const m = new THREE.MeshBasicMaterial({ color: farbe, side: THREE.BackSide });
  m.onBeforeCompile = s => {
    s.uniforms.uDicke = { value: dicke };
    s.vertexShader = 'uniform float uDicke;\n' + s.vertexShader.replace('#include <begin_vertex>',
      'vec3 transformed = position + normalize(position) * uDicke;');
  };
  const o = new THREE.Mesh(mesh.geometry, m);
  mesh.add(o);
  return o;
}

// Voxel-Geometrie: fn(x,y,z) → Farbe (Zahl) oder null. Nur sichtbare Flächen.
const FACES = [
  [[1, 0, 0], [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], 0.85],
  [[-1, 0, 0], [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], 0.85],
  [[0, 1, 0], [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], 1.0],
  [[0, -1, 0], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], 0.6],
  [[0, 0, 1], [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], 0.92],
  [[0, 0, -1], [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], 0.75],
];
export function voxelGeo(nx, ny, nz, fn, s = 0.25) {
  const grid = new Array(nx * ny * nz);
  const id = (x, y, z) => x + nx * (y + ny * z);
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) grid[id(x, y, z)] = fn(x, y, z);
  const get = (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= nx || y >= ny || z >= nz) ? null : grid[id(x, y, z)];
  const pos = [], nor = [], col = [], idx = [];
  const c = new THREE.Color();
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const v = get(x, y, z); if (v == null) continue;
    for (const [n, q, hell] of FACES) {
      if (get(x + n[0], y + n[1], z + n[2]) != null) continue;
      const b = pos.length / 3;
      c.set(v);
      for (const p of q) {
        pos.push((x + p[0] - nx / 2) * s, (y + p[1] - ny / 2) * s, (z + p[2] - nz / 2) * s);
        nor.push(...n); col.push(c.r * hell, c.g * hell, c.b * hell);
      }
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

// ---------- Partikel ----------
export const partikelPx = { value: 600 };
export class Partikel {
  constructor(n = 300, { additiv = true, weich = true } = {}) {
    this.n = n; this.i = 0;
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3); this.col2 = new Float32Array(n * 3);
    this.life = new Float32Array(n); this.max = new Float32Array(n).fill(1);
    this.size = new Float32Array(n); this.size0 = new Float32Array(n); this.alpha = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uPx: partikelPx },
      vertexShader: `attribute float aSize; attribute float aAlpha; varying vec3 vC; varying float vA; uniform float uPx;
        void main(){ vC = color; vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position,1.); gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPx / max(0.1, -mv.z); }`,
      fragmentShader: `varying vec3 vC; varying float vA; void main(){ vec2 d = gl_PointCoord - .5; float r = length(d);
        if (r > .5) discard; float a = ${weich ? 'smoothstep(.5, .0, r)' : '1.'} * vA; gl_FragColor = vec4(vC, a); }`,
      vertexColors: true, transparent: true, depthWrite: false,
      blending: additiv ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.obj = new THREE.Points(g, this.mat);
    this.obj.frustumCulled = false;
  }
  emit(p, v, life, size, c1, c2 = c1) {
    const i = this.i; this.i = (this.i + 1) % this.n;
    this.pos.set([p.x, p.y, p.z], i * 3); this.vel.set([v.x, v.y, v.z], i * 3);
    const a = new THREE.Color(c1), b = new THREE.Color(c2);
    this.col.set([a.r, a.g, a.b], i * 3); this.col2.set([b.r, b.g, b.b], i * 3);
    this.life[i] = life; this.max[i] = life; this.size0[i] = size;
  }
  update(dt, { grav = 0, drag = 0, wachsen = 0, fade = 1 } = {}) {
    const c = this.obj.geometry.attributes.color.array;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; this.size[i] = 0; continue; }
      this.life[i] -= dt;
      const t = 1 - this.life[i] / this.max[i];
      const k = i * 3;
      this.vel[k + 1] -= grav * dt;
      const d = Math.max(0, 1 - drag * dt);
      for (let j = 0; j < 3; j++) {
        this.vel[k + j] *= d; this.pos[k + j] += this.vel[k + j] * dt;
        c[k + j] = lerp(this.col[k + j], this.col2[k + j], t);
      }
      this.size[i] = this.size0[i] * (1 + wachsen * t);
      this.alpha[i] = fade ? Math.pow(1 - t, fade) : 1;
    }
    const at = this.obj.geometry.attributes;
    at.position.needsUpdate = at.color.needsUpdate = at.aSize.needsUpdate = at.aAlpha.needsUpdate = true;
  }
}

// GLSL-Rauschen zum Einbauen in Shader.
export const GLSL_NOISE = `
float h3(vec3 p){ p = fract(p*0.3183099+.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.-2.*f);
  return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x), mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x), mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y), f.z); }
float fbm(vec3 p){ float s = 0., a = .5; for(int i=0;i<4;i++){ s += a*n3(p); p *= 2.03; a *= .5; } return s; }
`;
