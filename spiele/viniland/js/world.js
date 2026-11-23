// Viniland – Welt: große Insel mit Biom-Sektoren (Daten in biomes.js), Terrain-Chunks, Wasser, Himmel, Atmosphäre pro Ansicht,
// Bäume (fällbar) mit Logs + leichter Eigenphysik, Deko (Instancing pro Zelle), Landmarken, Arenen, Leuchtfeuer, Nebeltore, Wrack.
// API siehe CONTRACT.md (createWorld + Erweiterung 3).
import * as THREE from 'three';
import { psxMat, patchPSX, setGrade, trackViewport } from './psx.js';
import { MeshBuilder, rng, makeNoise, clamp, lerp } from './kit.js';
import { BIOMES, TREE_TYPES as TREE_DEFS, LAYOUT, ANCHORS, ROUTE } from './biomes.js';

const G = 9.81, TAU = Math.PI * 2, DEG = Math.PI / 180;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const f3 = v => Number(v).toFixed(4);

// Temporäre Objekte (keine Allokationen im Loop)
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'),
  _v = new THREE.Vector3(), _s = new THREE.Vector3(), _ax = new THREE.Vector3(), _c = new THREE.Color(), _c2 = new THREE.Color();
const ZERO_M = new THREE.Matrix4().makeScale(0, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);

const TREE_IDS = Object.keys(TREE_DEFS);
const TREE_TYPES = TREE_IDS.map(id => ({ id, ...TREE_DEFS[id] }));
const CHIP_COL = [0xe8c48a, 0xd9ad6e, 0xf0d6a2];

function mergeGeos(geos) {
  let n = 0; for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
  for (const g of geos) { pos.set(g.attributes.position.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeVertexNormals(); out.computeBoundingSphere();
  return out;
}

// ------------------------------------------------------------------ Baum-Geometrien (Platzhalter pro Stil)
function buildTreeGeos(T, r) {
  const st = new MeshBuilder(), tr = new MeshBuilder(), cr = new MeshBuilder();
  const rAt = y => lerp(T.rB, T.rT, clamp(y / T.H, 0, 1));
  const cut = T.cut ?? 0xe8c48a;
  st.cyl(rAt(T.stump), T.rB * 1.08, T.stump, T.bark, { y: T.stump / 2 }, 8);
  st.cyl(rAt(T.stump) * 0.85, rAt(T.stump) * 0.85, 0.02, cut, { y: T.stump + 0.005 }, 8);
  tr.cyl(T.rT, rAt(T.stump), T.H - T.stump, T.bark, { y: T.stump + (T.H - T.stump) / 2 }, 8);
  const branch = (b, y, a, len, tilt, r0, r1, col) => {
    const dx = Math.sin(a) * Math.sin(tilt), dy = Math.cos(tilt), dz = Math.cos(a) * Math.sin(tilt), rr = rAt(y);
    b.cyl(r1, r0, len, col, { x: Math.sin(a) * rr * 0.6 + dx * len / 2, y: y + dy * len / 2, z: Math.cos(a) * rr * 0.6 + dz * len / 2, rz: tilt, ry: a + Math.PI / 2 }, 5);
    return [Math.sin(a) * rr * 0.6 + dx * len, y + dy * len, Math.cos(a) * rr * 0.6 + dz * len];
  };
  if (T.style === 'pine') {
    const sy = T.H / 9.2, sr = T.crownR / 2.2;
    const lay = [[2.6, 2.2, 3.2], [4.3, 1.85, 3.0], [5.9, 1.45, 2.7], [7.5, 1.05, 2.4], [8.9, 0.6, 1.8]];
    lay.forEach(([y, rr, h], i) => cr.cone(rr * sr, h * sy, T.leaves[i % 3], { y: y * sy + h * sy / 2, ry: r() * 3, jitter: 0.1 }, 8));
  } else if (T.style === 'oak') {
    const k = T.crownC / 6.4;
    tr.cyl(0.09, 0.16, 2.2, T.bark, { y: 4.3 * k, x: 0.7, rz: -0.8 }, 6);
    tr.cyl(0.08, 0.15, 2.0, T.bark, { y: 4.5 * k, z: -0.6, rx: -0.75 }, 6);
    const bl = [[0, 6.6, 0, 2.4], [1.5, 6.0, 0.4, 1.8], [-1.3, 6.1, -0.7, 1.9], [0.3, 5.8, 1.5, 1.7], [-0.5, 7.6, 0.6, 1.6], [0.9, 7.2, -1.2, 1.5]];
    bl.forEach(([x, y, z, rr], i) => cr.ico(rr * (T.crownR / 2.8), T.leaves[i % 3], { x, y: y * k, z, sy: 0.85, jitter: 0.12 }, 1));
  } else if (T.style === 'birch') {
    for (let i = 0; i < 7; i++) {
      const y = 0.9 + r() * (T.H - 2), a = r() * 6.28, rr = rAt(y);
      tr.box(0.16, 0.05, 0.05, 0x3a3532, { x: Math.sin(a) * rr, y, z: Math.cos(a) * rr, ry: a + 1.57, jitter: 0.1 });
    }
    const bl = [[0, 7.0, 0, 1.5], [0.7, 6.0, 0.3, 1.2], [-0.6, 6.3, -0.4, 1.15], [0.1, 8.3, 0.2, 1.0]];
    bl.forEach(([x, y, z, rr], i) => cr.ico(rr, T.leaves[i % 3], { x, y, z, sy: 1.35, jitter: 0.12 }, 1));
  } else if (T.style === 'dead') {
    // kahler schwarzer Baum: Äste + Zweige als "Krone"
    const nb = T.embers ? 4 : 7;
    for (let i = 0; i < nb; i++) {
      const y = T.H * (0.42 + 0.085 * i), a = i * 2.39 + r() * 0.6, len = (T.embers ? 1.3 : 2.2) + r() * 1.2 - i * 0.12, tilt = 0.55 + r() * 0.55;
      const [ex, ey, ez] = branch(cr, y, a, len, tilt, 0.1 - i * 0.008, 0.035, T.bark);
      // Zweig am Ende
      const a2 = a + (r() - 0.5) * 1.6, l2 = 0.6 + r() * 0.7, t2 = tilt * 0.6;
      cr.cyl(0.015, 0.035, l2, T.bark, { x: ex + Math.sin(a2) * Math.sin(t2) * l2 / 2, y: ey + Math.cos(t2) * l2 / 2, z: ez + Math.cos(a2) * Math.sin(t2) * l2 / 2, rz: t2, ry: a2 + Math.PI / 2 }, 4);
      if (!T.embers && i % 3 === 0) cr.ico(0.28, T.leaves[i % 3], { x: ex, y: ey, z: ez, sy: 0.6, jitter: 0.1 }, 0);
      if (T.embers) cr.box(0.12, 0.12, 0.12, 0xff6a20, { x: ex, y: ey, z: ez, jitter: 0.2 });
    }
    if (T.embers) for (let i = 0; i < 6; i++) { const y = 0.6 + r() * (T.H * 0.7), a = r() * 6.28, rr = rAt(y); tr.box(0.1, 0.22, 0.04, 0xff7a2a, { x: Math.sin(a) * rr, y, z: Math.cos(a) * rr, ry: a, jitter: 0.25 }); }
  } else if (T.style === 'shroom') {
    const R = T.crownR, top = T.H, l = T.leaves, gill = new THREE.Color(l[2]).multiplyScalar(0.45).getHex();
    tr.cyl(T.rT * 1.9, T.rT * 1.25, 0.16, T.cut, { y: T.H * 0.78 }, 8); // Ring
    if (T.cap === 'flat') {
      cr.cyl(R * 0.95, T.rT * 1.2, 0.35, gill, { y: top - 0.05 }, 10);
      cr.cyl(R * 0.9, R, 0.45, l[0], { y: top + 0.35 }, 10);
      cr.cone(R * 0.9, 0.9, l[1], { y: top + 1.0 }, 10);
      for (let i = 0; i < 8; i++) { const a = i * 0.8 + r(), d = R * (0.3 + r() * 0.5); cr.box(0.35, 0.12, 0.35, 0xe8fff8, { x: Math.sin(a) * d, y: top + 0.62 + (1 - d / R) * 0.5, z: Math.cos(a) * d, ry: a }); }
    } else if (T.cap === 'bell') {
      cr.cyl(R * 0.92, T.rT * 1.2, 0.3, gill, { y: top - 0.05 }, 9);
      cr.ico(R, l[0], { y: top + R * 0.35, sy: 0.8, jitter: 0.1 }, 1);
      cr.cone(R * 0.45, R * 0.7, l[1], { y: top + R * 1.05 }, 7);
    } else {
      cr.ico(R * 0.72, l[0], { y: top + 0.5, sy: 0.55, jitter: 0.1 }, 1);
      cr.cyl(R * 0.68, T.rT, 0.2, gill, { y: top + 0.1 }, 8);
      for (let i = 0; i < 3; i++) {
        const a = i * 2.1 + r(), [ex, ey, ez] = branch(cr, T.H * (0.4 + i * 0.12), a, 1.3 + r() * 0.5, 0.6 + r() * 0.3, 0.12, 0.08, T.bark);
        cr.ico(0.75 + r() * 0.3, l[(i + 1) % 3], { x: ex, y: ey + 0.15, z: ez, sy: 0.55, jitter: 0.1 }, 1);
      }
    }
  }
  const gs = st.geometry(), gt = tr.geometry(), gc = cr.geometry();
  const full = T.glow ? mergeGeos([gs, gt]) : mergeGeos([gs, gt, gc]);
  const glow = T.glow ? gc : null;
  const gt2 = gt.clone(); gt2.translate(0, -T.stump, 0);
  const gc2 = gc.clone(); gc2.translate(0, -T.stump, 0);
  return { full, glow, stump: gs, trunk: gt2, crown: gc2 };
}

function buildLogGeo(T) {
  const b = new MeshBuilder(), cut = T.cut ?? 0xe8c48a, core = T.cut ? 0xd8d0e8 : 0xc99a5e;
  b.cyl(1, 1, 1, T.bark, { rx: Math.PI / 2 }, 8);
  b.cyl(0.86, 0.86, 0.02, cut, { rx: Math.PI / 2, z: 0.5 }, 8);
  b.cyl(0.86, 0.86, 0.02, cut, { rx: Math.PI / 2, z: -0.5 }, 8);
  b.cyl(0.3, 0.3, 0.025, core, { rx: Math.PI / 2, z: 0.5 }, 6);
  b.cyl(0.3, 0.3, 0.025, core, { rx: Math.PI / 2, z: -0.5 }, 6);
  if (T.style === 'birch') for (let i = 0; i < 5; i++) {
    const a = i * 2.3, z = -0.4 + i * 0.2;
    b.box(0.5, 0.18, 0.06, 0x3a3532, { x: Math.sin(a), y: Math.cos(a), z, rz: -a });
  } else b.box(0.35, 0.3, 0.2, T.embers ? 0xff6a20 : 0x2a2018, { x: 0.95, z: 0.1 });
  return b.geometry();
}

// ------------------------------------------------------------------ Shader-Helfer (alle über patchPSX → Grading/Dithering global)
function customMat(mat, key, fn) {
  mat.onBeforeCompile = fn; patchPSX(mat); mat.userData.psxKey = key; return mat;
}
const SWAY = `
  #ifdef USE_INSTANCING
    vec2 ipw = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
  #else
    vec2 ipw = vec2(0.0);
  #endif
  float swy = max(transformed.y, 0.0);
  transformed.x += sin(uTime * 1.8 + ipw.x * 0.35 + ipw.y * 0.2) * 0.12 * swy;
  transformed.z += cos(uTime * 1.4 + ipw.y * 0.3) * 0.08 * swy;`;
function swayMat(base, key) {
  return customMat(base, key, sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + SWAY); });
}
// Wetter-Partikel um die Kamera (pro Ansicht automatisch richtig, keine CPU-Kosten). u = { value: 0..1 } Dichte.
function weatherMat(key, u, o) {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: !!o.alpha, opacity: o.alpha || 1, depthWrite: !o.alpha, fog: true });
  return customMat(m, key, sh => {
    sh.uniforms.uAmt = u;
    sh.vertexShader = 'uniform float uAmt;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
      vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      float ph = fract(sin(dot(ip.xz, vec2(12.9898, 78.233)) + ip.y * 3.17) * 43758.5453);
      vec3 wp = ip + vec3(${f3(o.v[0])}, ${f3(o.v[1])}, ${f3(o.v[2])}) * uTime * (0.8 + ph * 0.4);
      wp.x += sin(uTime * ${f3(o.wf)} + ph * 6.283) * ${f3(o.wa)};
      wp.z += cos(uTime * ${f3(o.wf * 0.8)} + ph * 9.1) * ${f3(o.wa)};
      vec3 rel = wp - cameraPosition;
      rel.xz = mod(rel.xz + ${f3(o.B / 2)}, ${f3(o.B)}) - ${f3(o.B / 2)};
      rel.y = mod(rel.y - ${f3(o.y0)}, ${f3(o.ys)}) + ${f3(o.y0)};
      float vis = step(ph + 0.002, uAmt) * smoothstep(${f3(o.B / 2)}, ${f3(o.B * 0.3)}, length(rel.xz)) * smoothstep(${f3(o.near || 0)}, ${f3((o.near || 0) * 2 + 0.01)}, length(rel));
      transformed = transformed * vis + (cameraPosition + rel - ip);
      #endif`);
  });
}
// Ortsfeste aufsteigende Partikel (Glut über Leuchtfeuern, Schwaden an Nebeltoren). u = { value } Sichtbarkeit.
function driftMat(key, u, o) {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: !!o.add, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !o.add, fog: true });
  return customMat(m, key, sh => {
    sh.uniforms.uOp = u;
    sh.vertexShader = 'uniform float uOp;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
      vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      float ph = fract(sin(dot(ip.xz, vec2(12.9898, 78.233)) + ip.y * 7.3) * 43758.5453);
      float t = fract(uTime * ${f3(o.rise / o.span)} * (0.7 + ph * 0.6) + ph);
      transformed = transformed * (sin(t * 3.1416) * uOp) + vec3(sin(uTime * 1.7 + ph * 30.0) * ${f3(o.wob)}, t * ${f3(o.span)}, cos(uTime * 1.3 + ph * 17.0) * ${f3(o.wob)});
      #endif`);
  });
}

// ==================================================================================================================
export function createWorld(scene, { seed = 1 } = {}) {
  const L = LAYOUT, R = L.radius, WATER = 0, EXT = L.ext, CELL = L.cell, N = Math.round(2 * EXT / CELL), N1 = N + 1;
  const rand = rng(seed * 7919 + 13);
  const nz = makeNoise(seed), nz2 = makeNoise(seed + 101), nzW = makeNoise(seed + 77);
  const NB = BIOMES.length;
  const bIndex = Object.fromEntries(BIOMES.map((b, i) => [b.id, i]));

  // ---------------------------------------------------------------- Sektoren / Biom-Bestimmung
  const SECT = BIOMES.map((b, i) => ({ b, i, a0: b.sector[0] * DEG, a1: b.sector[1] * DEG })).sort((a, b) => a.a0 - b.a0);
  const SECT_OF = []; SECT.forEach((s, k) => { SECT_OF[s.i] = k; });
  // Grenze k = Beginn von SECT[k] (zwischen SECT[k-1] und SECT[k]); Tor, wenn die Reihenfolge direkt aufeinander folgt (1→2, 2→3, 3→4)
  const BOUND = SECT.map((s, k) => {
    const left = SECT[(k - 1 + NB) % NB].b, right = s.b;
    return { k, a: s.a0, left, right, gate: right.order === left.order + 1 && right.order <= 4 };
  });
  const bAng = (k, r) => BOUND[k].a + 0.075 * nzW.noise(r * 0.008 + k * 13.7, k * 5.1);
  const BA = new Float64Array(NB);
  let _sec = 0, _dLo = 0, _dHi = 0, _r = 0, _bA = 0, _bB = 0, _bW = 0, _bD = 0, _bK = 0;
  function sectorAt(x, z) {
    const r = Math.hypot(x, z); _r = r;
    let phi = Math.atan2(z, x); if (phi < 0) phi += TAU;
    const m = Math.max(r, 30);
    for (let k = 0; k < NB; k++) BA[k] = bAng(k, r);
    for (let k = 0; k < NB; k++) {
      const a0 = BA[k], a1 = k + 1 < NB ? BA[k + 1] : BA[0] + TAU;
      const p = a0 + (((phi - a0) % TAU) + TAU) % TAU;
      if (p < a1) { _sec = k; _dLo = (p - a0) * m; _dHi = (a1 - p) * m; return k; }
    }
    _sec = 0; _dLo = _dHi = 999; return 0;
  }
  const BW = 22; // Übergangsbreite (m) jeder Seite
  function blendAt(x, z) {
    const s = sectorAt(x, z); _bA = SECT[s].i;
    if (_dHi < _dLo) { _bB = SECT[(s + 1) % NB].i; _bD = _dHi; _bK = (s + 1) % NB; }
    else { _bB = SECT[(s - 1 + NB) % NB].i; _bD = _dLo; _bK = s; }
    _bW = 0.5 * (1 - smooth(0, BW, _bD));
  }
  const biomeIdx = (x, z) => SECT[sectorAt(x, z)].i;
  const polar = (phi, r) => [Math.cos(phi) * r, Math.sin(phi) * r];
  const sectorPhi = (bi, f) => { const b = BIOMES[bi]; return (b.sector[0] + f * (b.sector[1] - b.sector[0])) * DEG; };

  // ---------------------------------------------------------------- Terrain-Höhe
  const P = L.peak, GR = L.gateR, GW = L.gateWidth;
  const zones = []; let useZones = false;
  function rawHeight(x, z) {
    blendAt(x, z);
    const d = _r;
    const s = R - d + nz.fbm(x * 0.006 + 11, z * 0.006 - 7, 3) * 40; // Meter landeinwärts
    let h;
    if (s < 0) h = s * 0.05 + Math.min(0, s + 25) * 0.12;
    else h = 1.7 * (1 - Math.exp(-s * 0.035));
    const TA = BIOMES[_bA].terrain, TB = BIOMES[_bB].terrain, w = _bW;
    const hillsK = lerp(TA.hills, TB.hills, w), roughK = lerp(TA.rough, TB.rough, w), liftK = lerp(TA.lift, TB.lift, w);
    const inl = smooth(14, 60, s);
    let hills = (nz.fbm(x * 0.011, z * 0.011, 4) + 0.3) * 7.5 * hillsK;
    hills *= 0.35 + 0.65 * smooth(-0.15, 0.3, nz2.fbm(x * 0.004 + 50, z * 0.004, 2)); // weite flache Wiesen
    hills = Math.log(1 + Math.exp(hills * 1.2)) / 1.2;
    const peak = P.h * Math.exp(-(d * d) / (P.r * P.r)) * (1 + 0.3 * nz2.fbm(x * 0.03, z * 0.03, 3));
    h += inl * (hills + peak + liftK * smooth(30, 160, s) + nz2.fbm(x * 0.08, z * 0.08, 2) * roughK);
    // Grate zwischen den Biomen (mit Lücke am Tor), reichen bis ins Meer
    let rm = Math.exp(-(_bD / 8) * (_bD / 8));
    if (BOUND[_bK].gate) rm *= smooth(GW / 2 + 1, GW / 2 + 8, Math.abs(d - GR));
    if (rm > 0.002) h += rm * (12 + 5 * nz2.noise(d * 0.06 + _bK * 7, _bK * 3.3));
    if (useZones) for (let i = 0; i < zones.length; i++) {
      const zn = zones[i]; if (zn.r1 <= 0) continue;
      const dd = Math.hypot(x - zn.x, z - zn.z); if (dd >= zn.r1) continue;
      h = lerp(h, zn.h, smooth(zn.r1, zn.r0, dd));
    }
    return Math.max(h, -9);
  }
  const addZone = (x, z, r0, r1, res, kind) => { const zn = { x, z, r0, r1, res, kind, h: rawHeight(x, z) }; zones.push(zn); return zn; };

  // ---------------------------------------------------------------- Layout: Wrack/Spawn, Tore, Arenen, Leuchtfeuer, Kathedrale
  const spawnPoints = [];
  const startPhi = L.startPhi * DEG, sdx = Math.cos(startPhi), sdz = Math.sin(startPhi);
  const inward = new THREE.Vector2(-sdx, -sdz), tangent = new THREE.Vector2(-sdz, sdx);
  let wr = EXT - 5; while (wr > 200 && rawHeight(sdx * wr, sdz * wr) < 0.35) wr -= 0.5;
  const wreckP = new THREE.Vector3(sdx * wr, 0, sdz * wr);
  addZone(wreckP.x, wreckP.z, 0, 0, 14, 'wreck');
  const spawnC = new THREE.Vector2(wreckP.x + inward.x * 9, wreckP.z + inward.y * 9);
  addZone(spawnC.x, spawnC.y, 0, 0, 7, 'spawn');

  // Arena-/Platz-Suche: möglichst flach, auf Land, weg vom Grat
  function findFlat(x0, z0, ring, search) {
    let best = null, bs = 1e9;
    for (let k = 0; k < 25; k++) {
      const a = k * 2.4, d = k === 0 ? 0 : search * Math.sqrt(k / 24), x = x0 + Math.cos(a) * d, z = z0 + Math.sin(a) * d;
      const h = rawHeight(x, z); if (_bD < ring + 12) continue;
      let v = 0, mn = h;
      for (let j = 0; j < 8; j++) { const hh = rawHeight(x + Math.cos(j * 0.785) * ring, z + Math.sin(j * 0.785) * ring); v += (hh - h) ** 2; mn = Math.min(mn, hh); }
      const sc = v + (mn < 2.2 ? 400 : 0) + (h > 40 ? 200 : 0) + d * 0.05;
      if (sc < bs) { bs = sc; best = [x, z]; }
    }
    return best || [x0, z0];
  }

  const gates = [];
  BOUND.forEach((B, k) => {
    if (!B.gate) return;
    const phi = bAng(k, GR), [x, z] = polar(phi, GR);
    // Gehrichtung: tangential in Richtung steigender Winkel (from → to)
    const tx = -Math.sin(phi), tz = Math.cos(phi);
    const gt = { id: 'g' + B.left.order, fromBiome: B.left.id, toBiome: B.right.id, pos: new THREE.Vector3(x, 0, z), yaw: Math.atan2(tx, tz),
      width: GW, open: false, _phi: phi, _k: k, _fade: 1, _u: { value: 1 }, _meshes: [] };
    addZone(x, z, 7, 15, 16, 'gate');
    gates.push(gt);
  });
  gates.sort((a, b) => a.id.localeCompare(b.id));

  const bossSlots = [], shrines = [], mobZones = [], arenas = [];
  for (const b of BIOMES) {
    const A = ANCHORS[b.id]; if (!A) continue; const bi = bIndex[b.id];
    A.bosses.forEach((a, index) => {
      const [x0, z0] = polar(sectorPhi(bi, a.f), a.r), [x, z] = findFlat(x0, z0, 15, 22);
      const zn = addZone(x, z, 17, 27, 21, 'arena');
      const slot = { biome: b.id, index, key: !!a.key, pos: new THREE.Vector3(x, zn.h, z), radius: 16 };
      bossSlots.push(slot); arenas.push(slot);
    });
  }
  let cathedral = null;
  { const bi = bIndex.duesterwald; const [x0, z0] = polar(sectorPhi(bi, 0.52), 195), [x, z] = findFlat(x0, z0, 10, 12);
    const zn = addZone(x, z, 12, 20, 17, 'cathedral'); cathedral = new THREE.Vector3(x, zn.h, z); }
  { // Start-Leuchtfeuer neben dem Wrack
    const x = wreckP.x + inward.x * 14 + tangent.x * 8, z = wreckP.z + inward.y * 14 + tangent.y * 8;
    const zn = addZone(x, z, 3.5, 8, 7, 'shrine'); shrines.push({ id: 'kueste_0', biome: 'kueste', pos: new THREE.Vector3(x, zn.h, z) });
  }
  for (const b of BIOMES) {
    const A = ANCHORS[b.id]; if (!A) continue; const bi = bIndex[b.id];
    A.shrines.forEach(a => {
      const [x0, z0] = polar(sectorPhi(bi, a.f), a.r), [x, z] = findFlat(x0, z0, 5, 10);
      const zn = addZone(x, z, 3.5, 8, 7, 'shrine');
      shrines.push({ id: b.id + '_' + shrines.filter(s => s.biome === b.id).length, biome: b.id, pos: new THREE.Vector3(x, zn.h, z) });
    });
    A.mobs.forEach((a, i) => {
      const [x, z] = polar(sectorPhi(bi, a.f), a.r);
      mobZones.push({ biome: b.id, pos: new THREE.Vector3(x, 0, z), radius: 18 + (i % 3) * 4, count: 2 + (i % 3) });
    });
  }

  // ---------------------------------------------------------------- Höhenfeld
  useZones = true;
  const H = new Float32Array(N1 * N1);
  for (let j = 0; j < N1; j++) for (let i = 0; i < N1; i++) H[j * N1 + i] = rawHeight(-EXT + i * CELL, -EXT + j * CELL);

  // Exakt dieselbe Dreiecks-Interpolation wie im Mesh (Diagonale (i,j)-(i+1,j+1))
  function heightAt(x, z) {
    const gx = (x + EXT) / CELL, gz = (z + EXT) / CELL;
    if (!(gx >= 0 && gz >= 0 && gx < N && gz < N)) return -9;
    const i = gx | 0, j = gz | 0, fx = gx - i, fz = gz - j, k = j * N1 + i;
    const h00 = H[k], h10 = H[k + 1], h01 = H[k + N1], h11 = H[k + N1 + 1];
    return fx >= fz ? h00 + (h10 - h00) * fx + (h11 - h10) * fz : h00 + (h11 - h01) * fx + (h01 - h00) * fz;
  }
  let gX = 0, gZ = 0;
  function grad(x, z) { const e = 0.6; gX = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e); gZ = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e); }
  const slopeAt = (x, z) => { grad(x, z); return Math.hypot(gX, gZ); };
  for (const s of [...bossSlots, ...shrines]) s.pos.y = heightAt(s.pos.x, s.pos.z);
  for (const g of gates) g.pos.y = heightAt(g.pos.x, g.pos.z);
  for (const m of mobZones) m.pos.y = heightAt(m.pos.x, m.pos.z);
  cathedral.y = heightAt(cathedral.x, cathedral.z);
  wreckP.y = heightAt(wreckP.x, wreckP.z);

  // Spawn: 2 Punkte nebeneinander direkt neben dem Wrack (landeinwärts)
  for (const sgn of [1, -1]) {
    const x = spawnC.x + tangent.x * 1.6 * sgn, z = spawnC.y + tangent.y * 1.6 * sgn;
    spawnPoints.push(new THREE.Vector3(x, heightAt(x, z), z));
  }

  // Route (Pfad Start → Tore), für Bodenfarbe + Testkamera
  const route = [new THREE.Vector3(spawnC.x, 0, spawnC.y)];
  for (const [id, f, r] of ROUTE) { const [x, z] = polar(sectorPhi(bIndex[id], f), r); route.push(new THREE.Vector3(x, 0, z)); }
  // Torpunkte exakt auf die Tore legen
  for (const g of gates) {
    let bi = 0, bd = 1e9; route.forEach((p, i) => { const d = p.distanceToSquared(g.pos); if (d < bd) { bd = d; bi = i; } });
    route[bi].set(g.pos.x, 0, g.pos.z);
  }
  route.forEach(p => { p.y = heightAt(p.x, p.z); });
  function routeDist(x, z) {
    let best = 1e9;
    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i], b = route[i + 1], ex = b.x - a.x, ez = b.z - a.z, l2 = ex * ex + ez * ez;
      const t = clamp(((x - a.x) * ex + (z - a.z) * ez) / l2, 0, 1), dx = x - a.x - ex * t, dz = z - a.z - ez * t, d = dx * dx + dz * dz;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }
  const reserved = (x, z, pad = 0) => { for (const zn of zones) if ((x - zn.x) ** 2 + (z - zn.z) ** 2 < (zn.res + pad) ** 2) return true; return false; };
  const farFromSpawn = (x, z, d) => (x - spawnC.x) ** 2 + (z - spawnC.y) ** 2 > d * d;

  // ---------------------------------------------------------------- Farben
  const col = h => new THREE.Color(h);
  const PAL = BIOMES.map(b => { const o = {}; for (const k in b.palette) o[k] = Array.isArray(b.palette[k]) ? b.palette[k].map(col) : col(b.palette[k]); return o; });
  const cSnow = col(0xdde4ec), cArena = col(0x5a5650);
  function palColor(p, h, ny, x, z, n1, n2, out) {
    const sandLine = 1.3 + n1 * 0.8;
    if (h < sandLine) {
      if (h < -0.2) out.copy(p.wet).lerp(p.deep, clamp(-h / 5, 0, 1));
      else out.copy(p.wet).lerp(p.sand, smooth(-0.2, 0.7, h));
      const b = h - (sandLine - 0.35); if (b > 0) out.lerp(p.sandG, b / 0.35 * 0.6);
    } else {
      out.copy(p.g2).lerp(p.g1, smooth(-0.25, 0.25, n1));
      out.lerp(p.g3, smooth(0.05, 0.35, nz.fbm(x * 0.006 + 40, z * 0.006 - 20, 2)) * 0.7);
      if (n2 > 0.6) out.lerp(p.dirt, 0.35);
      out.lerp(p.rock, smooth(0.9, 0.7, ny));
    }
  }
  function terrainColor(h, ny, x, z, out) {
    const n1 = nz2.fbm(x * 0.02, z * 0.02, 3), n2 = nz2.noise(x * 0.11 + 30, z * 0.11);
    blendAt(x, z);
    const A = _bA, B = _bB, w = _bW, bd = _bD, bk = _bK;
    palColor(PAL[A], h, ny, x, z, n1, n2, out);
    if (w > 0.002) { palColor(PAL[B], h, ny, x, z, n1, n2, _c2); out.lerp(_c2, w); }
    const rm = Math.exp(-((bd / 9) ** 2)) * (BOUND[bk].gate ? smooth(GW / 2, GW / 2 + 6, Math.abs(_r - GR)) : 1);
    if (h > 0.5) out.lerp(PAL[A].rock, clamp(rm * 1.4, 0, 0.9));
    out.lerp(cSnow, smooth(36, 48, h + n1 * 6) * smooth(0.6, 0.85, ny));
    if (h > 1.2) {
      const pd = routeDist(x, z), pw = 2.2 + n2 * 0.8;
      if (pd < pw + 1) out.lerp(PAL[A].path, smooth(pw + 1, pw - 0.6, pd) * 0.75);
      for (const a of arenas) { const d = Math.hypot(x - a.pos.x, z - a.pos.z); if (d < 16) { out.lerp(cArena, (d < 13 ? 0.35 : 0.6) * (0.8 + n2 * 0.2)); break; } }
    }
    out.multiplyScalar(0.94 + n2 * 0.07 + (rand() - 0.5) * 0.05);
  }

  // Distanz-Culling pro Ansicht (hinter dem Nebel wird nichts gezeichnet), zusätzlich zum Frustum-Culling
  const cullables = [];
  const regCull = o => { const bs = o.isInstancedMesh ? o.boundingSphere : o.geometry.boundingSphere; if (bs) cullables.push({ o, x: bs.center.x, z: bs.center.z, r: bs.radius }); };

  // ---------------------------------------------------------------- Terrain-Mesh (10×10 Chunks, Frustum-Culling)
  const terrainMat = psxMat();
  const CH = 10, CC = N / CH;
  const tA = new THREE.Vector3(), tB = new THREE.Vector3(), tC = new THREE.Vector3();
  for (let cj = 0; cj < CH; cj++) for (let ci = 0; ci < CH; ci++) {
    let maxH = -99;
    for (let j = cj * CC; j <= (cj + 1) * CC; j++) for (let i = ci * CC; i <= (ci + 1) * CC; i++) maxH = Math.max(maxH, H[j * N1 + i]);
    if (maxH < -5) continue;
    const nv = CC * CC * 6, pos = new Float32Array(nv * 3), cols = new Float32Array(nv * 3);
    let o = 0;
    const put = (i, j) => { pos[o * 3] = -EXT + i * CELL; pos[o * 3 + 1] = H[j * N1 + i]; pos[o * 3 + 2] = -EXT + j * CELL; o++; };
    for (let j = cj * CC; j < (cj + 1) * CC; j++) for (let i = ci * CC; i < (ci + 1) * CC; i++) {
      for (let t = 0; t < 2; t++) {
        const o0 = o;
        if (t === 0) { put(i, j); put(i, j + 1); put(i + 1, j + 1); } else { put(i, j); put(i + 1, j + 1); put(i + 1, j); }
        tA.fromArray(pos, o0 * 3); tB.fromArray(pos, o0 * 3 + 3); tC.fromArray(pos, o0 * 3 + 6);
        tB.sub(tA); tC.sub(tA); tB.cross(tC).normalize();
        const cx = (pos[o0 * 3] + pos[o0 * 3 + 3] + pos[o0 * 3 + 6]) / 3, cz = (pos[o0 * 3 + 2] + pos[o0 * 3 + 5] + pos[o0 * 3 + 8]) / 3;
        const ch = (pos[o0 * 3 + 1] + pos[o0 * 3 + 4] + pos[o0 * 3 + 7]) / 3;
        terrainColor(ch, Math.abs(tB.y), cx, cz, _c);
        for (let k = 0; k < 3; k++) { cols[(o0 + k) * 3] = _c.r; cols[(o0 + k) * 3 + 1] = _c.g; cols[(o0 + k) * 3 + 2] = _c.b; }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.computeVertexNormals(); g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, terrainMat);
    mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
    scene.add(mesh); regCull(mesh);
  }

  // ---------------------------------------------------------------- Himmel (Gradient per Uniform), Nebel, Licht
  const skyTop = new THREE.Color(), skyHor = new THREE.Color();
  scene.background = new THREE.Color(0x808080);
  scene.fog = new THREE.Fog(0x808080, 30, 260);
  let sky;
  {
    const sg = new THREE.SphereGeometry(900, 24, 14), p = sg.attributes.position, sc = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const t = clamp(p.getY(i) / 900, 0, 1); sc[i * 3] = sc[i * 3 + 1] = sc[i * 3 + 2] = t; }
    sg.setAttribute('color', new THREE.BufferAttribute(sc, 3));
    const skyMat = customMat(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }), 'sky2', sh => {
      sh.uniforms.uSkyT = { value: skyTop }; sh.uniforms.uSkyH = { value: skyHor }; sh.uniforms.uSkyF = { value: scene.fog.color };
      sh.fragmentShader = 'uniform vec3 uSkyT;\nuniform vec3 uSkyH;\nuniform vec3 uSkyF;\n' + sh.fragmentShader.replace('#include <color_fragment>',
        'float st = clamp(vColor.r, 0.0, 1.0); diffuseColor.rgb = mix(uSkyF, mix(uSkyH, uSkyT, pow(st, 0.55)), smoothstep(0.0, 0.22, st));');
    });
    sky = new THREE.Mesh(sg, skyMat); sky.renderOrder = -10; sky.frustumCulled = false;
    scene.add(sky);
  }
  const hemi = new THREE.HemisphereLight(0xd2e8ff, 0x7a6a45, 1.2); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d2, 2.0);
  const sunOffset = new THREE.Vector3(70, 110, 45);
  sun.position.copy(spawnPoints[0]).add(sunOffset); sun.target.position.copy(spawnPoints[0]);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 320 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  trackViewport(scene);

  // ---------------------------------------------------------------- Wasser (polares Gitter, dicht an der Küste, Farbe je Biom)
  {
    const rings = []; let r = 300;
    while (r < 1700) { rings.push(r); r += r < 330 ? 10 : r < 460 ? 3.5 : r < 600 ? 9 : r * 0.18; }
    const SEG = 320, pos = [], cols = [], idx = [];
    for (let ri = 0; ri < rings.length; ri++) for (let a = 0; a < SEG; a++) {
      const an = a / SEG * TAU + (ri % 2) * Math.PI / SEG, x = Math.cos(an) * rings[ri], z = Math.sin(an) * rings[ri];
      pos.push(x, 0, z);
      const depth = WATER - heightAt(x, z);
      blendAt(x, z);
      const wc = (pi, out) => {
        const p = PAL[pi], [sh, md, dp] = p.water;
        if (depth < 0.25) out.copy(p.foam).lerp(sh, clamp(depth / 0.25, 0, 1));
        else if (depth < 3) out.copy(sh).lerp(md, (depth - 0.25) / 2.75);
        else out.copy(md).lerp(dp, clamp((depth - 3) / 6, 0, 1));
      };
      wc(_bA, _c); if (_bW > 0.002) { wc(_bB, _c2); _c.lerp(_c2, _bW); }
      cols.push(_c.r, _c.g, _c.b);
    }
    for (let ri = 0; ri < rings.length - 1; ri++) for (let a = 0; a < SEG; a++) {
      const a1 = (a + 1) % SEG, i0 = ri * SEG + a, i1 = ri * SEG + a1, j0 = (ri + 1) * SEG + a, j1 = (ri + 1) * SEG + a1;
      idx.push(i0, i1, j0, i1, j1, j0);
    }
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    wg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    wg.setIndex(idx); wg.computeVertexNormals(); wg.computeBoundingSphere();
    const wm = psxMat({ transparent: true, opacity: 0.86, noCache: true });
    wm.userData.psxKey = 'water';
    const prev = wm.onBeforeCompile;
    wm.onBeforeCompile = (sh, rd) => {
      prev(sh, rd);
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 wpw = modelMatrix * vec4(transformed, 1.0);
        transformed.y += sin(wpw.x * 0.16 + uTime * 1.3) * 0.11 + sin(wpw.z * 0.23 - uTime * 0.9) * 0.09
                       + sin((wpw.x + wpw.z) * 0.5 + uTime * 2.1) * 0.035;`);
    };
    const water = new THREE.Mesh(wg, wm); water.receiveShadow = true; water.renderOrder = 1;
    scene.add(water);
  }

  // ---------------------------------------------------------------- Kollider: Kreise { x,z,r,base,top,dome,tree } + Segmente { seg,ax,az,bx,bz,r,base,top,gate }
  // Raster-Hash (12 m), Einträge mit Polster → Punktabfragen brauchen nur eine Zelle
  const HC = 12, HN = Math.ceil(2 * EXT / HC), HPAD = 3.2, hash = new Array(HN * HN), EMPTY = [];
  const colliders = [];
  let qid = 1;
  const hci = v => clamp(Math.floor((v + EXT) / HC), 0, HN - 1);
  function hAdd(c, x0, z0, x1, z1) {
    for (let j = hci(z0 - HPAD); j <= hci(z1 + HPAD); j++) for (let i = hci(x0 - HPAD); i <= hci(x1 + HPAD); i++) {
      const k = j * HN + i; (hash[k] || (hash[k] = [])).push(c);
    }
  }
  function addCol(c) {
    c._q = 0; colliders.push(c);
    if (c.seg) hAdd(c, Math.min(c.ax, c.bx) - c.r, Math.min(c.az, c.bz) - c.r, Math.max(c.ax, c.bx) + c.r, Math.max(c.az, c.bz) + c.r);
    else hAdd(c, c.x - c.r, c.z - c.r, c.x + c.r, c.z + c.r);
    return c;
  }
  const addWall = (ax, az, bx, bz, r, base = -100, gate = null) => addCol({ seg: true, ax, az, bx, bz, r, base, top: Infinity, gate });
  const cellAt = (x, z) => hash[hci(z) * HN + hci(x)] || EMPTY;
  // Iteration über alle Kollider im Rechteck (dedupliziert), cb(c)
  function forCols(x, z, rq, cb) {
    if (rq <= HPAD) { const a = cellAt(x, z); for (let i = 0; i < a.length; i++) cb(a[i]); return; }
    const q = ++qid, i0 = hci(x - rq + HPAD), i1 = hci(x + rq - HPAD), j0 = hci(z - rq + HPAD), j1 = hci(z + rq - HPAD);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const a = hash[j * HN + i]; if (!a) continue;
      for (let n = 0; n < a.length; n++) { const c = a[n]; if (c._q !== q) { c._q = q; cb(c); } }
    }
  }
  // Grate als Wände (Polylinie entlang der verbogenen Grenze), Lücke am Tor
  BOUND.forEach((B, k) => {
    const step = 14; let prev = null;
    for (let r = 4; r <= EXT; r += step) {
      const p = polar(bAng(k, r), r);
      if (prev && !(B.gate && r > GR - GW / 2 && r - step < GR + GW / 2)) addWall(prev[0], prev[1], p[0], p[1], 2.6);
      prev = p;
    }
    if (B.gate) { // Wandstücke bis an die Torpfosten
      const ri = Math.floor((GR - GW / 2 - 4) / step) * step + 4, ro = ri + step;
      const a = polar(bAng(k, ri), ri), b = polar(bAng(k, GR - GW / 2), GR - GW / 2), c = polar(bAng(k, GR + GW / 2), GR + GW / 2);
      let r2 = ro; while (r2 < GR + GW / 2) r2 += step; const d = polar(bAng(k, r2), r2);
      addWall(a[0], a[1], b[0], b[1], 2.6); addWall(c[0], c[1], d[0], d[1], 2.6);
      const g = gates.find(gg => gg._k === k);
      g._a = b; g._b = c;
      g._col = addWall(b[0], b[1], c[0], c[1], 1.2, -100, g);
    }
  });

  // ---------------------------------------------------------------- Instancing pro Zelle (8×8 Zellen à ~114 m → Frustum-Culling)
  const CG = 8, CS = 2 * EXT / CG;
  const cellOf = (x, z) => clamp(Math.floor((x + EXT) / CS), 0, CG - 1) + clamp(Math.floor((z + EXT) / CS), 0, CG - 1) * CG;
  function bucketize(list) { const m = new Map(); for (const it of list) { const k = cellOf(it.x, it.z); let a = m.get(k); if (!a) m.set(k, a = []); a.push(it); } return m; }
  function instance(geo, mat, list, { shadow = false, pad = 0 } = {}) {
    for (const [, arr] of bucketize(list)) {
      const im = new THREE.InstancedMesh(geo, mat, arr.length);
      arr.forEach((k, i) => {
        _e.set(k.rx || 0, k.yaw || 0, k.rz || 0); _q.setFromEuler(_e);
        im.setMatrixAt(i, _m.compose(_v.set(k.x, k.y, k.z), _q, _s.set(k.sx, k.sy ?? k.sx, k.sz ?? k.sx)));
        if (k.c) im.setColorAt(i, k.c);
      });
      im.castShadow = shadow; im.receiveShadow = true; im.computeBoundingSphere(); im.boundingSphere.radius += pad; im.matrixAutoUpdate = false;
      scene.add(im); regCull(im);
    }
  }
  // Statische Props: pro Zelle zu je einer Geometrie verschmolzen (lit / glow)
  const propLit = new Map(), propGlow = new Map();
  function addProp(geo, x, z, yaw, y, glow = false, rx = 0, rz = 0) {
    _e.set(rx, yaw, rz); _q.setFromEuler(_e); geo.applyMatrix4(_m.compose(_v.set(x, y, z), _q, _s.set(1, 1, 1)));
    const map = glow ? propGlow : propLit, k = cellOf(x, z); let a = map.get(k); if (!a) map.set(k, a = []); a.push(geo);
  }
  const glowMat = customMat(new THREE.MeshBasicMaterial({ vertexColors: true, fog: true }), 'glow', () => {});
  const glowAddMat = customMat(new THREE.MeshBasicMaterial({ vertexColors: true, fog: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), 'glowAdd', () => {});
  const swayLit = swayMat(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), 'sway');
  const swayGlow = swayMat(new THREE.MeshBasicMaterial({ vertexColors: true, fog: true }), 'swayGlow');

  // Zufallspunkt im Biom-Sektor
  function samplePt(bi, rMin = 0, rMax = 445) {
    const b = BIOMES[bi], a = (b.sector[0] + rand() * (b.sector[1] - b.sector[0])) * DEG, r = Math.sqrt(lerp((rMin / 445) ** 2, (rMax / 445) ** 2, rand())) * 445;
    return polar(a, r);
  }
  function inBiome(bi, x, z, margin) { const s = sectorAt(x, z); return SECT[s].i === bi && Math.min(_dLo, _dHi) > margin; }

  // ---------------------------------------------------------------- Felsen (3 Varianten, Tönung pro Biom per Instanzfarbe)
  const rockGeos = [];
  for (let v = 0; v < 3; v++) {
    const ig = new THREE.IcosahedronGeometry(1, 1), p = ig.attributes.position, rn = makeNoise(seed + 300 + v);
    for (let i = 0; i < p.count; i++) {
      _v.fromBufferAttribute(p, i);
      const k = 0.8 + 0.35 * (rn.noise(_v.x * 1.7 + 5, _v.z * 1.7 + _v.y * 1.3) * 0.5 + 0.5);
      p.setXYZ(i, _v.x * k, _v.y * k, _v.z * k);
    }
    const b = new MeshBuilder(); b.add(ig, 0x8d8a85, { jitter: 0.1 });
    const g = b.geometry(), gp = g.attributes.position, gc = g.attributes.color;
    const moss = col(0x6a7a50);
    for (let i = 0; i < gp.count; i += 3) {
      tA.fromBufferAttribute(gp, i); tB.fromBufferAttribute(gp, i + 1); tC.fromBufferAttribute(gp, i + 2);
      tB.sub(tA); tC.sub(tA); tB.cross(tC).normalize();
      if (tB.y > 0.72 && rand() < 0.6) for (let k = 0; k < 3; k++) { _c.fromBufferAttribute(gc, i + k).lerp(moss, 0.6); gc.setXYZ(i + k, _c.r, _c.g, _c.b); }
    }
    rockGeos.push(g);
  }
  const ROCK_TINT = BIOMES.map(b => col(b.palette.rockTint ?? 0xffffff));
  const rockList = [[], [], []];
  function addRock(x, z, r, hy, collide = true, tint = null) {
    const g = heightAt(x, z), base = g - hy * 0.25;
    if (collide) addCol({ x, z, r: r * 0.92, base, top: base + hy * 0.95, dome: true, tree: null });
    rockList[(rand() * 3) | 0].push({ x, y: base, z, sx: r, sy: hy, sz: r, yaw: rand() * 6.28, c: tint || ROCK_TINT[biomeIdx(x, z)] });
  }
  // Grat-Felsen (optisch die Wand), Torpfosten
  BOUND.forEach((B, k) => {
    for (let r = 6; r < EXT - 4; r += 6 + rand() * 4) {
      if (B.gate && Math.abs(r - GR) < GW / 2 + 1.5) continue;
      const off = (rand() - 0.5) * 5, [x, z] = polar(bAng(k, r) + off / Math.max(r, 30), r);
      const big = 2.8 + rand() * 2.8; addRock(x, z, big, big * (1.1 + rand() * 0.9), false, ROCK_TINT[B.right === undefined ? 0 : bIndex[B.right.id]]);
    }
  });
  for (const bi of BIOMES.keys()) {
    const n = BIOMES[bi].deco.rocks || 0;
    for (let k = 0, tries = 0; k < n && tries < n * 30; tries++) {
      const [x, z] = samplePt(bi, 40, 380), h = heightAt(x, z);
      if (h < 1.6 || !inBiome(bi, x, z, 10) || reserved(x, z, 4) || routeDist(x, z) < 4) continue;
      const r = 0.8 + rand() * 2.2; addRock(x, z, r, r * (0.55 + rand() * 0.45)); k++;
    }
    for (let k = 0, tries = 0; k < n / 3 && tries < 400; tries++) { // Strandfelsen
      const [x, z] = samplePt(bi, 330, 440), h = heightAt(x, z);
      if (h < -0.6 || h > 1.2 || !inBiome(bi, x, z, 6) || reserved(x, z, 3)) continue;
      const r = 0.6 + rand() * 1.4; addRock(x, z, r, r * 0.7); k++;
    }
  }

  // ---------------------------------------------------------------- Bäume (Arten je Biom, fällbar)
  const treeGeo = TREE_TYPES.map(T => buildTreeGeos(T, rand));
  const trees = [];
  function canTree(x, z) {
    const h = heightAt(x, z);
    if (h < 2.0 || h > 42 || slopeAt(x, z) > 0.38 || !farFromSpawn(x, z, 10) || reserved(x, z, 2)) return false;
    let ok = true;
    forCols(x, z, 4, c => {
      if (!ok || c.seg) return;
      const d2 = (c.x - x) ** 2 + (c.z - z) ** 2;
      if (c.tree ? d2 < 11.5 : d2 < (c.r + 1.3) ** 2) ok = false;
    });
    return ok && routeDist(x, z) > 3.2;
  }
  function addTree(type, x, z, bi) {
    const T = TREE_TYPES[type], s = 0.8 + rand() * 0.45;
    const t = { type, x, z, y: heightAt(x, z), s, yaw: rand() * 6.28, hp: T.hp[0] + ((rand() * (T.hp[1] - T.hp[0] + 1)) | 0),
      state: 0, wob: 0, wobT: 0, wx: 1, wz: 0, im: null, gm: null, slot: 0, r: T.rB * s, col: null, biome: BIOMES[bi].id };
    t.col = addCol({ x, z, r: t.r + 0.05, base: t.y - 1, top: Infinity, dome: false, tree: t });
    trees.push(t);
  }
  const treesBy = BIOMES.map(() => []);
  for (const [bi, b] of BIOMES.entries()) {
    const types = b.trees.map(([id, w]) => [TREE_IDS.indexOf(id), w]), wsum = types.reduce((s, t) => s + t[1], 0);
    const pick = () => { let u = rand() * wsum; for (const [t, w] of types) { if ((u -= w) <= 0) return t; } return types[0][0]; };
    const start = trees.length;
    const cluster = (cx, cz, n, rad, dom) => {
      for (let k = 0, tries = 0; k < n && tries < n * 12; tries++) {
        const a = rand() * 6.28, d = Math.sqrt(rand()) * rad, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        if (inBiome(bi, x, z, 6) && canTree(x, z)) { addTree(rand() < 0.7 ? dom : pick(), x, z, bi); k++; }
      }
    };
    if (b.id === 'kueste') { // Wäldchen in Sichtweite des Spawns
      const px = tangent.x, pz = tangent.y, sx = spawnC.x, sz = spawnC.y, ix = inward.x, iz = inward.y, T = id => TREE_IDS.indexOf(id);
      cluster(sx + ix * 28 + px * 10, sz + iz * 28 + pz * 10, 11, 13, T('birch'));
      cluster(sx + ix * 22 - px * 28, sz + iz * 22 - pz * 28, 9, 11, T('oak'));
      cluster(sx + ix * 50 + px * 32, sz + iz * 50 + pz * 32, 10, 14, T('pine'));
    }
    for (let tries = 0; trees.length - start < b.treeCount && tries < 400; tries++) {
      const [x, z] = samplePt(bi, 70, 360); if (heightAt(x, z) < 2.5) continue;
      cluster(x, z, 6 + ((rand() * 10) | 0), b.clusterR * (0.7 + rand() * 0.6), pick());
    }
    for (let i = start; i < trees.length; i++) treesBy[bi].push(trees[i]);
  }
  // Instanced pro (Zelle, Art); Stümpfe global pro Art (wachsen beim Fällen)
  function treeMatrix(t, tilt) {
    _q.setFromAxisAngle(UP, t.yaw);
    if (tilt) { _ax.set(t.wz, 0, -t.wx); _q2.setFromAxisAngle(_ax, tilt); _q.premultiply(_q2); }
    return _m.compose(_v.set(t.x, t.y, t.z), _q, _s.set(t.s, t.s, t.s));
  }
  const litMat = psxMat();
  {
    const groups = new Map();
    for (const t of trees) { const k = cellOf(t.x, t.z) * 64 + t.type; let a = groups.get(k); if (!a) groups.set(k, a = []); a.push(t); }
    for (const [, arr] of groups) {
      const ty = arr[0].type, gs = treeGeo[ty];
      const im = new THREE.InstancedMesh(gs.full, litMat, arr.length), gm = gs.glow ? new THREE.InstancedMesh(gs.glow, glowMat, arr.length) : null;
      arr.forEach((t, i) => { t.slot = i; t.im = im; t.gm = gm; const m = treeMatrix(t, 0); im.setMatrixAt(i, m); if (gm) gm.setMatrixAt(i, m); });
      im.castShadow = im.receiveShadow = true; im.computeBoundingSphere(); im.boundingSphere.radius += 6; scene.add(im); regCull(im);
      if (gm) { gm.castShadow = true; gm.boundingSphere = im.boundingSphere.clone(); scene.add(gm); regCull(gm); }
    }
  }
  const stumpIM = TREE_TYPES.map((T, ty) => {
    const n = Math.max(1, trees.filter(t => t.type === ty).length);
    const sm = new THREE.InstancedMesh(treeGeo[ty].stump, litMat, n);
    sm.count = 0; sm.visible = false; sm.frustumCulled = false; sm.castShadow = sm.receiveShadow = true; scene.add(sm); return sm;
  });

  // ---------------------------------------------------------------- Deko (datengetrieben aus BIOMES[].deco)
  function place(bi, count, test, opts = {}) {
    const out = [], near = opts.near ? treesBy[bi] : null;
    for (let tries = 0; out.length < count && tries < count * 6; tries++) {
      let x, z;
      if (near && near.length && rand() < opts.near) { const t = near[(rand() * near.length) | 0], a = rand() * 6.28, d = 2 + rand() * 7; x = t.x + Math.cos(a) * d; z = t.z + Math.sin(a) * d; }
      else [x, z] = samplePt(bi, opts.rMin ?? 20, opts.rMax ?? 440);
      if (!inBiome(bi, x, z, opts.margin ?? 5)) continue;
      const h = heightAt(x, z);
      if (!test(x, z, h)) continue;
      const sc = (opts.s0 || 1) * (0.75 + rand() * 0.6);
      const it = { x, y: h - 0.04, z, yaw: rand() * 6.28, sx: sc, sy: sc * (0.8 + rand() * 0.4), sz: sc };
      if (opts.colors) { it.c = col(opts.colors[(rand() * opts.colors.length) | 0]).multiplyScalar(0.85 + rand() * 0.3); }
      out.push(it);
    }
    return out;
  }
  const blade = (b, x, z, w, l, lean, a, c) => {
    const ca = Math.cos(a), sa = Math.sin(a), tx = x + Math.cos(lean) * l * 0.35, tz = z + Math.sin(lean) * l * 0.35;
    const v = [x - ca * w, 0, z - sa * w, x + ca * w, 0, z + sa * w, tx, l, tz];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([...v, v[0], v[1], v[2], v[6], v[7], v[8], v[3], v[4], v[5]], 3));
    b.add(g, c, { jitter: 0.12 });
  };
  const tuft = (n, len, w, c, spread = 0.06) => { const b = new MeshBuilder(); for (let i = 0; i < n; i++) { const a = i * (6.28 / n); blade(b, Math.cos(a) * spread, Math.sin(a) * spread, w, len + (i % 3) * 0.1, a, a + 1.57, c); } return b.geometry(); };
  const grassGeo = tuft(6, 0.28, 0.035, 0xffffff), tallGeo = tuft(5, 0.55, 0.025, 0xffffff, 0.05);
  const notSpot = (x, z, pad) => farFromSpawn(x, z, pad) && !reserved(x, z, -2);
  const D = (bi) => BIOMES[bi].deco;
  for (const bi of BIOMES.keys()) {
    const d = D(bi), id = BIOMES[bi].id;
    if (d.grass) instance(grassGeo, swayLit, place(bi, d.grass[0], (x, z, h) => h > 1.75 && slopeAt(x, z) < 0.6 && notSpot(x, z, 3), { colors: d.grass[1], near: 0.25 }));
    if (d.beachgrass) instance(tallGeo, swayLit, place(bi, d.beachgrass[0], (x, z, h) => h > 0.6 && h < 1.9, { colors: [d.beachgrass[1]], rMin: 300 }));
    if (d.deadgrass) instance(tallGeo, swayLit, place(bi, d.deadgrass[0], (x, z, h) => h > 1.5 && slopeAt(x, z) < 0.5, { colors: [d.deadgrass[1]] }));
    if (d.snowgrass) instance(tallGeo, swayLit, place(bi, d.snowgrass[0], (x, z, h) => h > 1.5 && slopeAt(x, z) < 0.5, { colors: [d.snowgrass[1]] }));
    if (d.glowgrass) instance(grassGeo, swayGlow, place(bi, d.glowgrass[0], (x, z, h) => h > 1.6 && slopeAt(x, z) < 0.6 && notSpot(x, z, 3), { colors: d.glowgrass[1], near: 0.4 }));
    if (d.bushes) {
      const b = new MeshBuilder(), [, bc, berry] = d.bushes;
      b.ico(0.6, bc, { y: 0.4, sy: 0.8, jitter: 0.12 }, 0); b.ico(0.45, bc, { x: 0.45, y: 0.32, z: 0.15, jitter: 0.15 }, 0);
      b.ico(0.42, bc, { x: -0.38, y: 0.3, z: -0.2, jitter: 0.15 }, 0);
      for (let i = 0; i < 5; i++) b.box(0.08, 0.08, 0.08, berry, { x: Math.cos(i * 1.3) * 0.5, y: 0.45 + (i % 2) * 0.2, z: Math.sin(i * 1.3) * 0.5 });
      instance(b.geometry(), litMat, place(bi, d.bushes[0], (x, z, h) => h > 1.9 && slopeAt(x, z) < 0.45 && notSpot(x, z, 5), { near: 0.55 }), { shadow: true });
    }
    if (d.flowers) for (const c of d.flowers[1]) {
      const b = new MeshBuilder();
      b.cyl(0.012, 0.015, 0.3, 0x4a5a3a, { y: 0.15 }, 3); b.ico(0.055, c, { y: 0.31, sy: 0.6, jitter: 0.04 }, 0); b.box(0.04, 0.03, 0.04, 0xb0a070, { y: 0.34 });
      instance(b.geometry(), swayLit, place(bi, d.flowers[0] / d.flowers[1].length, (x, z, h) => h > 2 && slopeAt(x, z) < 0.3 && nz.noise(x * 0.04 + 9, z * 0.04) > -0.1));
    }
    if (d.driftwood) {
      const b = new MeshBuilder(); b.cyl(0.13, 0.17, 2.4, 0x8a8070, { rz: Math.PI / 2, y: 0.1 }, 6); b.cyl(0.05, 0.07, 0.9, 0x7a7060, { rz: 1.1, x: 0.5, y: 0.3, z: 0.1 }, 4);
      instance(b.geometry(), litMat, place(bi, d.driftwood, (x, z, h) => h > 0.2 && h < 1.4 && notSpot(x, z, 6), { rMin: 320 }), { shadow: true });
    }
    if (d.smallshrooms) {
      const geos = [0x30e8d8, 0xff50d0, 0xa060ff].map(c => { const b = new MeshBuilder(); b.cyl(0.04, 0.06, 0.35, 0xc8c0e0, { y: 0.17 }, 5); b.cone(0.22, 0.16, c, { y: 0.4 }, 7); b.cyl(0.03, 0.05, 0.2, 0xc8c0e0, { y: 0.1, x: 0.18 }, 4); b.cone(0.12, 0.1, c, { y: 0.24, x: 0.18 }, 6); return b.geometry(); });
      geos.forEach(g => instance(g, glowMat, place(bi, d.smallshrooms / 3, (x, z, h) => h > 1.8 && slopeAt(x, z) < 0.5 && notSpot(x, z, 3), { near: 0.6, s0: 1.3 })));
    }
    if (d.graves) {
      const b1 = new MeshBuilder(); b1.box(0.6, 0.9, 0.16, 0x5a5a5e, { y: 0.35, rz: 0.05 }); b1.cyl(0.3, 0.3, 0.16, 0x5a5a5e, { y: 0.8, rx: Math.PI / 2 }, 7); b1.box(0.7, 0.08, 0.9, 0x3a362e, { y: 0.03, z: 0.55 });
      const b2 = new MeshBuilder(); b2.box(0.14, 1.2, 0.14, 0x4a4a50, { y: 0.5 }); b2.box(0.6, 0.14, 0.14, 0x4a4a50, { y: 0.8 }); b2.box(0.7, 0.08, 0.9, 0x3a362e, { y: 0.03, z: 0.5 });
      const list = place(bi, d.graves, (x, z, h) => h > 2 && slopeAt(x, z) < 0.3 && notSpot(x, z, 4) && routeDist(x, z) > 2.5, { near: 0.3 });
      // eher in Gruppen: Friedhöfe um Grab-Zentren
      list.forEach(g => { g.yaw = Math.round(g.yaw / 1.57) * 1.57 + (rand() - 0.5) * 0.3; g.sx = g.sy = g.sz = 0.9 + rand() * 0.3; g.rz = (rand() - 0.5) * 0.25; addCol({ x: g.x, z: g.z, r: 0.35, base: g.y - 0.2, top: Infinity, dome: false, tree: null }); });
      instance(b1.geometry(), litMat, list.filter((_, i) => i % 3), { shadow: true }); instance(b2.geometry(), litMat, list.filter((_, i) => !(i % 3)), { shadow: true });
    }
    if (d.lanterns) {
      const post = new MeshBuilder(); post.box(0.12, 2.4, 0.12, 0x1a1a1c, { y: 1.2 }); post.box(0.7, 0.08, 0.08, 0x1a1a1c, { y: 2.35, x: 0.3 }); post.box(0.3, 0.06, 0.3, 0x1a1a1c, { y: 2.2, x: 0.6 }); post.box(0.34, 0.08, 0.34, 0x1a1a1c, { y: 1.75, x: 0.6 });
      const lamp = new MeshBuilder(); lamp.box(0.2, 0.36, 0.2, 0xffc060, { y: 1.97, x: 0.6 }); lamp.box(0.1, 0.12, 0.1, 0xfff0b0, { y: 1.97, x: 0.6 });
      const list = [];
      for (let i = 0; i < route.length - 1; i++) { // entlang des Pfads im Wald
        const a = route[i], b = route[i + 1], len = a.distanceTo(b);
        for (let s = 6; s < len; s += 20) {
          const t = s / len, side = (list.length % 2 ? 1 : -1), nx = -(b.z - a.z) / len, nz_ = (b.x - a.x) / len;
          const x = lerp(a.x, b.x, t) + nx * 3.2 * side, z = lerp(a.z, b.z, t) + nz_ * 3.2 * side;
          if (!inBiome(bi, x, z, 12) || reserved(x, z, 0)) continue;
          list.push({ x, y: heightAt(x, z), z, yaw: Math.atan2(-nx * side, -nz_ * side) - Math.PI / 2, sx: 1 });
        }
      }
      list.push(...place(bi, Math.max(0, d.lanterns - list.length), (x, z, h) => h > 2 && slopeAt(x, z) < 0.3 && notSpot(x, z, 4)));
      list.forEach(l => { l.sx = l.sy = l.sz = 1; addCol({ x: l.x, z: l.z, r: 0.2, base: l.y - 0.2, top: Infinity, dome: false, tree: null }); });
      instance(post.geometry(), litMat, list, { shadow: true }); instance(lamp.geometry(), glowMat, list);
    }
    if (d.obsidian) {
      const b = new MeshBuilder(); b.cone(0.6, 3.2, 0x2a2630, { y: 1.5, rz: 0.12 }, 5); b.cone(0.4, 2.0, 0x1e1a22, { y: 1.0, x: 0.6, rz: -0.35 }, 5); b.cone(0.3, 1.4, 0x34303a, { y: 0.7, x: -0.5, z: 0.3, rx: 0.4 }, 4);
      const list = place(bi, d.obsidian, (x, z, h) => h > 1.6 && notSpot(x, z, 4), { s0: 1.2 });
      list.forEach(o => addCol({ x: o.x, z: o.z, r: 0.6 * o.sx, base: o.y, top: Infinity, dome: false, tree: null }));
      instance(b.geometry(), litMat, list, { shadow: true });
    }
    if (d.lava) {
      const b = new MeshBuilder(); b.box(0.35, 0.05, 3.2, 0xff5a10, { y: 0.03 }); b.box(0.2, 0.06, 1.6, 0xffb040, { y: 0.04, x: 0.4, z: 1.5, ry: 0.6 }); b.box(0.18, 0.06, 1.2, 0xff7020, { y: 0.04, x: -0.3, z: -1.6, ry: -0.5 });
      instance(b.geometry(), glowMat, place(bi, d.lava, (x, z, h) => h > 1.8 && slopeAt(x, z) < 0.15 && notSpot(x, z, 4)));
    }
    if (d.ice) {
      const b = new MeshBuilder(); b.cone(0.5, 2.6, 0xb8d4ee, { y: 1.2, rz: 0.15 }, 5); b.cone(0.35, 1.6, 0xd0e4f6, { y: 0.7, x: 0.5, rz: -0.4 }, 5);
      const list = place(bi, d.ice, (x, z, h) => h > 1.6 && notSpot(x, z, 4), { s0: 1.2 });
      list.forEach(o => addCol({ x: o.x, z: o.z, r: 0.5 * o.sx, base: o.y, top: Infinity, dome: false, tree: null }));
      instance(b.geometry(), litMat, list, { shadow: true });
    }
    if (d.ruins) {
      for (let k = 0, tries = 0; k < d.ruins && tries < 300; tries++) {
        const [x, z] = samplePt(bi, 90, 350), h = heightAt(x, z);
        if (h < 2.2 || slopeAt(x, z) > 0.25 || !inBiome(bi, x, z, 14) || reserved(x, z, 8) || routeDist(x, z) < 6) continue;
        buildRuin(x, z, rand() * 6.28, (rand() * 3) | 0); k++;
      }
    }
    void id;
  }
  rockList.forEach((list, v) => instance(rockGeos[v], litMat, list, { shadow: true }));

  // ---------------------------------------------------------------- Landmarken
  function stoneCol() { return [0x55565c, 0x5e5e62, 0x4c4c52][(rand() * 3) | 0]; }
  function buildRuin(x, z, yaw, kind) {
    const b = new MeshBuilder(), y0 = heightAt(x, z) - 0.3, cy = Math.cos(yaw), sy = Math.sin(yaw);
    const W = (lx, lz) => [x + lx * cy + lz * sy, z - lx * sy + lz * cy]; // lokal → Welt (Rotation um Y)
    if (kind === 0) { // zerbrochene Mauer
      const len = 6 + rand() * 6; let lx = -len / 2;
      while (lx < len / 2) { const w = 0.8 + rand() * 0.8, hh = 1.2 + rand() * 3.4; b.box(w, hh, 0.8, stoneCol(), { x: lx + w / 2, y: hh / 2, jitter: 0.08 }); lx += w; }
      const a = W(-len / 2, 0), c = W(len / 2, 0); addWall(a[0], a[1], c[0], c[1], 0.5, y0);
      for (let i = 0; i < 4; i++) b.box(0.5 + rand() * 0.4, 0.4, 0.5, stoneCol(), { x: (rand() - 0.5) * len, y: 0.4, z: 1 + rand() * 1.5, ry: rand() * 3 });
    } else if (kind === 1) { // Spitzbogen
      for (const s of [-1, 1]) { b.box(1, 5, 1, stoneCol(), { x: s * 2, y: 2.5 }); const p = W(s * 2, 0); addCol({ x: p[0], z: p[1], r: 0.7, base: y0, top: Infinity, dome: false, tree: null }); }
      b.box(1.2, 0.9, 1, stoneCol(), { x: -1.2, y: 5.2, rz: -0.5 }); b.box(1.2, 0.9, 1, stoneCol(), { x: 1.2, y: 5.2, rz: 0.5 }); b.box(0.8, 0.8, 1, stoneCol(), { y: 5.75 });
    } else { // Säulenreihe
      for (let i = 0; i < 5; i++) {
        const hh = rand() < 0.4 ? 0.8 + rand() : 3 + rand() * 2.5, lx = -6 + i * 3;
        b.cyl(0.45, 0.55, hh, stoneCol(), { x: lx, y: hh / 2 }, 7); b.box(1.2, 0.3, 1.2, stoneCol(), { x: lx, y: 0.15 });
        if (hh > 3) b.box(1.1, 0.35, 1.1, stoneCol(), { x: lx, y: hh + 0.15 });
        const p = W(lx, 0); addCol({ x: p[0], z: p[1], r: 0.6, base: y0, top: Infinity, dome: false, tree: null });
      }
    }
    addProp(b.geometry(), x, z, yaw, y0);
  }

  // Kathedralen-Turm (Düsterwald)
  {
    const b = new MeshBuilder(), gl = new MeshBuilder(), S = 0x4a4a50, S2 = 0x3c3c42, DARK = 0x141418;
    const yaw = Math.atan2(cathedral.x, cathedral.z) + Math.PI; // Front zur Inselmitte
    b.box(10, 1, 10, S2, { y: 0.2 });
    b.box(8, 26, 8, S, { y: 13, jitter: 0.05 });
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      b.box(1.8, 14, 1.8, S2, { x: sx * 4.2, y: 7, z: sz * 4.2 }); b.box(1.4, 8, 1.4, S2, { x: sx * 4.1, y: 18, z: sz * 4.1 });
      b.cone(0.9, 4.5, S2, { x: sx * 3.9, y: 35.3, z: sz * 3.9 }, 4);
    }
    b.box(7, 7, 7, S, { y: 29.5 });
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; b.box(2.2, 4.5, 0.3, DARK, { x: Math.sin(a) * 3.55, y: 29.5, z: Math.cos(a) * 3.55, ry: a }); b.cone(1.1, 1.6, DARK, { x: Math.sin(a) * 3.55, y: 32.4, z: Math.cos(a) * 3.55, ry: a + 0.78, sz: 0.25 }, 4); }
    b.cone(5.0, 20, S2, { y: 43, ry: Math.PI / 4 }, 4);
    b.box(0.25, 3, 0.25, 0x2a2a2e, { y: 54.4 }); b.box(1.4, 0.25, 0.25, 0x2a2a2e, { y: 54.8 });
    // Portal + Fenster
    b.box(2.6, 5, 0.4, DARK, { y: 3, z: 4.05 }); b.cone(1.3, 2, DARK, { y: 6.4, z: 4.05, ry: Math.PI / 4, sz: 0.2 }, 4);
    gl.box(1.0, 2.4, 0.2, 0xffd890, { y: 29.5, z: 3.7 }); gl.box(0.8, 1.6, 0.2, 0xffc070, { y: 18, z: 4.05 });
    // zerstörtes Kirchenschiff
    for (const sx of [-1, 1]) {
      let lz = 4.5;
      while (lz < 26) { const w = 1.6 + rand() * 1.5, hh = lz < 12 ? 6 + rand() * 6 : 1 + rand() * 5; b.box(1, hh, w, S, { x: sx * 5, y: hh / 2, z: lz + w / 2 }); lz += w + (rand() < 0.3 ? 1.2 : 0); }
      for (let lz2 = 8; lz2 < 24; lz2 += 5) b.box(1.6, 3 + rand() * 4, 1.6, S2, { x: sx * 5.9, y: 2, z: lz2 });
    }
    for (let i = 0; i < 10; i++) b.box(0.6 + rand(), 0.4 + rand() * 0.5, 0.6 + rand(), S2, { x: (rand() - 0.5) * 8, y: 0.3, z: 6 + rand() * 18, ry: rand() * 3 });
    const y0 = cathedral.y - 0.4;
    // Landmarke: eigenes Material mit schwächerem Nebel, kein Distanz-Culling → von weit her als Silhouette sichtbar
    const lmMat = customMat(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), 'landmark', sh => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <fog_fragment>', `#ifdef USE_FOG
        float fogF = smoothstep(fogNear, fogFar * 3.0, vFogDepth) * 0.92;
        gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogF);
      #endif`);
    });
    const lmGlow = customMat(new THREE.MeshBasicMaterial({ vertexColors: true, fog: true }), 'landmarkGlow', sh => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <fog_fragment>', `#ifdef USE_FOG
        gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, smoothstep(fogNear, fogFar * 3.5, vFogDepth) * 0.8);
      #endif`);
    });
    for (const [bb, mat] of [[b, lmMat], [gl, lmGlow]]) {
      const geo = bb.geometry(); _e.set(0, yaw, 0); _q.setFromEuler(_e); geo.applyMatrix4(_m.compose(_v.set(cathedral.x, y0, cathedral.z), _q, _s.set(1, 1, 1)));
      const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = mat === lmMat; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; scene.add(mesh);
    }
    const cy = Math.cos(yaw), sy = Math.sin(yaw), W = (lx, lz) => [cathedral.x + lx * cy + lz * sy, cathedral.z - lx * sy + lz * cy];
    const c = [W(-5, -5), W(5, -5), W(5, 5), W(-5, 5)];
    for (let i = 0; i < 4; i++) addWall(c[i][0], c[i][1], c[(i + 1) % 4][0], c[(i + 1) % 4][1], 0.6, y0);
    for (const sx of [-1, 1]) { const a = W(sx * 5, 5), e = W(sx * 5, 26); addWall(a[0], a[1], e[0], e[1], 0.6, y0); }
  }

  // Schiffswrack am Startstrand: lokal +Z entlang der Küste, +X landeinwärts (offene Seite → Spawn)
  const wreck = { pos: wreckP.clone(), lootPos: null, yaw: 0 };
  {
    const b = new MeshBuilder(), W1 = 0x3a2e24, W2 = 0x4a3a2c, W3 = 0x5e5040;
    const yaw = Math.atan2(-inward.y, inward.x); // lokal +X → landeinwärts
    b.box(0.5, 0.5, 15, W1, { y: 0.1 });
    for (let i = 0; i < 8; i++) {
      const z = -6.5 + i * 1.9;
      b.box(0.25, 0.25, 4.2, W2, { y: 0.15, z, ry: Math.PI / 2 });
      b.box(0.25, 3.4, 0.25, W2, { x: -2.2, y: 1.6, z, rz: 0.35 });
      const hr = i < 3 ? 3.2 : 1.0 + (i % 2) * 0.8; b.box(0.25, hr, 0.25, W2, { x: 2.1, y: hr / 2, z, rz: -0.35 });
    }
    for (let row = 0; row < 3; row++) for (let i = 0; i < 6; i++) if (rand() > 0.18) b.box(0.12, 0.5, 2.3, i % 2 ? W1 : W3, { x: -2.05 - row * 0.15 + 0.4, y: 0.7 + row * 0.95, z: -6 + i * 2.35, rz: 0.35 });
    for (let i = 0; i < 3; i++) b.box(0.12, 0.5, 2.3, W3, { x: 1.9, y: 0.7 + i * 0.9, z: -5.4 + (i % 2) * 1.4, rz: -0.35 });
    b.box(4.6, 3.4, 2.6, W1, { y: 1.6, z: -8.2 }); b.box(3, 1.4, 1.6, W2, { y: 3.9, z: -8.6, rz: 0.3 });
    b.box(0.3, 0.3, 3, W2, { y: 0.6, z: 8.6, rx: -0.5 });
    b.cyl(0.18, 0.24, 10, W2, { x: 4.2, y: 0.3, z: 2, rx: Math.PI / 2, ry: 0.3 }, 6); b.box(4, 0.18, 0.18, W2, { x: 4.4, y: 0.35, z: 4.5, ry: 0.3 });
    b.box(2.6, 0.12, 1.5, 0xa09888, { x: 4.8, y: 0.25, z: 5.5, ry: 0.7 }); // Segelfetzen
    for (let i = 0; i < 7; i++) b.box(0.12, 0.08, 1.6 + rand(), W3, { x: 3 + rand() * 5, y: 0.08, z: (rand() - 0.5) * 12, ry: rand() * 3 });
    b.box(0.9, 0.6, 0.6, 0x2a2018, { x: 0.2, y: 0.3, z: 1.2, ry: 0.3 }); // Kiste (Loot)
    addProp(b.geometry(), wreckP.x, wreckP.z, yaw, wreckP.y - 0.45, false, 0, 0.08);
    const cy = Math.cos(yaw), sy = Math.sin(yaw), Wd = (lx, lz) => [wreckP.x + lx * cy + lz * sy, wreckP.z - lx * sy + lz * cy];
    const seg = (a, c, r) => { const p = Wd(...a), q = Wd(...c); addWall(p[0], p[1], q[0], q[1], r, wreckP.y - 1); };
    seg([-2.3, -7], [-2.3, 7.5], 0.4); seg([-2.3, -9.5], [2.3, -9.5], 0.4); seg([2.3, -9.5], [2.3, -4.6], 0.4);
    const lp = Wd(0.2, 1.2); wreck.lootPos = new THREE.Vector3(lp[0], heightAt(lp[0], lp[1]) + 0.3, lp[1]); wreck.yaw = yaw;
  }

  // Arenen: Steinkreise je Biom (Siegelträger: höher, rote Glut)
  for (const a of arenas) {
    const b = new MeshBuilder(), gl = new MeshBuilder(), bi = bIndex[a.biome];
    const S = bi === 2 ? 0x4e4660 : bi === 1 ? 0x44444a : 0x6e7074, n = a.key ? 10 : 8, R0 = 15;
    for (let k = 0; k < n; k++) {
      const an = k / n * TAU + 0.2, x = Math.cos(an) * R0, z = Math.sin(an) * R0, y = heightAt(a.pos.x + x, a.pos.z + z) - a.pos.y;
      const hh = (a.key ? 3.6 : 2.4) + (k % 3) * 0.5, broken = !a.key && k % 4 === 3;
      b.box(1.0, broken ? 1.0 : hh, 0.8, S, { x, y: y + (broken ? 0.4 : hh / 2 - 0.2), z, ry: -an, rz: (k % 2 - 0.5) * 0.12 });
      if (!broken && a.key && k % 2 === 0) b.box(1.2, 0.3, 0.9, S, { x, y: y + hh - 0.1, z, ry: -an });
      if (k % 2 === 0) { gl.cone(0.25, 0.45, a.key ? 0xff3a20 : 0xff9a3a, { x: x * 0.93, y: y + (broken ? 1 : hh) + 0.05, z: z * 0.93 }, 5); }
      addCol({ x: a.pos.x + x, z: a.pos.z + z, r: 0.6, base: a.pos.y + y - 0.3, top: Infinity, dome: false, tree: null });
    }
    if (a.key) { // Runenring am Boden
      for (let k = 0; k < 24; k++) { const an = k / 24 * TAU; gl.box(0.9, 0.04, 0.18, 0xc02818, { x: Math.cos(an) * 6, y: 0.05, z: Math.sin(an) * 6, ry: -an + Math.PI / 2 }); }
      b.cyl(1.6, 1.9, 0.5, S, { y: 0.1 }, 8);
    }
    if (bi === 2) for (let k = 0; k < 12; k++) { const an = k / 12 * TAU + 0.1; gl.cone(0.4, 0.3, [0x30e8d8, 0xff50d0, 0xa060ff][k % 3], { x: Math.cos(an) * 17.5, y: 0.45, z: Math.sin(an) * 17.5 }, 6); gl.cyl(0.06, 0.08, 0.4, 0xc8c0e0, { x: Math.cos(an) * 17.5, y: 0.2, z: Math.sin(an) * 17.5 }, 4); }
    addProp(b.geometry(), a.pos.x, a.pos.z, 0, a.pos.y); addProp(gl.geometry(), a.pos.x, a.pos.z, 0, a.pos.y, true);
  }

  // Leuchtfeuer: Steinring, Glutschale, Glutsäule + aufsteigende Funken
  const emberU = { value: 1 };
  const emberMat = driftMat('ember', emberU, { rise: 1.3, span: 4.5, wob: 0.35, add: true });
  const pBox = (() => { const b = new MeshBuilder(); b.box(0.09, 0.09, 0.09, 0xffffff, { jitter: 0 }); return b.geometry(); })();
  {
    const emberList = [];
    for (const s of shrines) {
      const b = new MeshBuilder(), gl = new MeshBuilder();
      for (let k = 0; k < 9; k++) { const an = k / 9 * TAU; b.box(0.7, 0.35, 0.5, stoneCol(), { x: Math.cos(an) * 1.5, y: 0.1, z: Math.sin(an) * 1.5, ry: -an }); }
      b.cyl(0.55, 0.75, 0.5, 0x2a2624, { y: 0.25 }, 8); b.box(0.12, 1.6, 0.06, 0x2a2a2e, { y: 1.0, rz: 0.12 }); b.box(0.42, 0.06, 0.08, 0x2a2a2e, { y: 1.45, rz: 0.12 });
      for (let i = 0; i < 9; i++) gl.box(0.22, 0.14, 0.22, [0xff6a1a, 0xffb040, 0xff4010][i % 3], { x: (rand() - 0.5) * 0.7, y: 0.55 + rand() * 0.12, z: (rand() - 0.5) * 0.7, ry: rand() * 3 });
      addProp(b.geometry(), s.pos.x, s.pos.z, 0, s.pos.y - 0.05); addProp(gl.geometry(), s.pos.x, s.pos.z, 0, s.pos.y - 0.05, true);
      const col_ = new MeshBuilder(); col_.cyl(0.1, 0.4, 2.6, 0x7a2a06, { y: 1.8 }, 7); col_.cyl(0.04, 0.2, 3.6, 0x5a1e04, { y: 2.4 }, 6);
      const cm = new THREE.Mesh(col_.geometry(), glowAddMat); cm.position.copy(s.pos); scene.add(cm);
      for (let i = 0; i < 26; i++) emberList.push({ x: s.pos.x + (rand() - 0.5) * 0.8, y: s.pos.y + 0.5, z: s.pos.z + (rand() - 0.5) * 0.8, sx: 0.8 + rand() * 0.8, c: col([0xff8a2a, 0xffc060, 0xff5010][i % 3]) });
      addCol({ x: s.pos.x, z: s.pos.z, r: 0.8, base: s.pos.y - 0.3, top: s.pos.y + 0.6, dome: false, tree: null });
    }
    instance(pBox, emberMat, emberList, { pad: 5 });
  }

  // Nebeltore: animierte Nebelwand (mehrere Lagen) + Schwaden, Torpfosten
  for (const g of gates) {
    const wallW = GW + 3, wallH = 9;
    const m = customMat(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true }), 'gatefog', sh => {
      sh.uniforms.uOp = g._u;
      sh.vertexShader = 'varying vec3 vGW;\nvarying vec2 vGL;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGL = position.xy;\nvGW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = 'uniform float uOp;\nuniform float uTime;\nvarying vec3 vGW;\nvarying vec2 vGL;\n' + sh.fragmentShader.replace('#include <color_fragment>', `
        float n = sin(vGW.x * 0.7 + vGW.z * 0.7 + uTime * 1.1 + vGW.y * 0.9) * 0.5 + sin(vGW.y * 1.7 - uTime * 1.9 + (vGW.x - vGW.z) * 0.4) * 0.35
                + sin((vGW.x + vGW.z) * 2.3 + uTime * 3.1 - vGW.y) * 0.15;
        float fx = smoothstep(${f3(wallW / 2)}, ${f3(wallW / 2 - 2.5)}, abs(vGL.x));
        float fy = smoothstep(-0.5, 1.5, vGL.y) * smoothstep(${f3(wallH)}, ${f3(wallH - 4)}, vGL.y);
        diffuseColor.rgb = mix(vec3(0.55, 0.6, 0.68), vec3(0.95, 0.96, 1.0), n * 0.5 + 0.5);
        diffuseColor.a = (0.42 + 0.3 * n) * fx * fy * uOp;`);
    });
    const pg = new THREE.PlaneGeometry(wallW, wallH, 6, 4); pg.translate(0, wallH / 2 - 1, 0);
    const [ax, az] = g._a, [bx, bz] = g._b, cx = (ax + bx) / 2, cz = (az + bz) / 2, py = heightAt(cx, cz);
    const ryaw = Math.atan2(-(bz - az), bx - ax); // lokal X entlang der Toröffnung
    g.pos.set(cx, py, cz);
    for (const o of [-0.7, 0, 0.7]) {
      const mesh = new THREE.Mesh(pg, m); mesh.rotation.y = ryaw; mesh.position.set(cx + Math.sin(g.yaw) * o, py, cz + Math.cos(g.yaw) * o);
      mesh.renderOrder = 2; scene.add(mesh); g._meshes.push(mesh);
    }
    const wm = driftMat('gatewisp', g._u, { rise: 0.7, span: 5, wob: 0.8, add: true });
    const list = [];
    for (let i = 0; i < 70; i++) { const t = (rand() - 0.5) * GW, o = (rand() - 0.5) * 2; list.push({ x: cx + (bx - ax) / GW * t + Math.sin(g.yaw) * o, y: py - 0.5, z: cz + (bz - az) / GW * t + Math.cos(g.yaw) * o, sx: 0.8 + rand() * 1.4, c: col(0x6a7080) }); }
    const wim = new THREE.InstancedMesh(pBox, wm, list.length);
    list.forEach((k, i) => { wim.setMatrixAt(i, _m.compose(_v.set(k.x, k.y, k.z), _q.identity(), _s.set(k.sx, k.sx, k.sx))); wim.setColorAt(i, k.c); });
    wim.frustumCulled = false; scene.add(wim); g._meshes.push(wim);
    // Torpfosten (Monolithen) mit Glut-Rune
    for (const [px, pz] of [g._a, g._b]) {
      const b = new MeshBuilder(), gl = new MeshBuilder(), ph = heightAt(px, pz) - 0.3;
      b.box(1.8, 9, 1.8, 0x3a3a40, { y: 4.5, ry: ryaw }); b.box(2.3, 0.8, 2.3, 0x2e2e34, { y: 9.2, ry: ryaw }); b.cone(1.0, 2, 0x2e2e34, { y: 10.6, ry: ryaw + 0.78 }, 4);
      gl.box(0.3, 1.4, 1.9, 0xa0d0ff, { y: 5.5, ry: ryaw });
      addProp(b.geometry(), px, pz, 0, ph); addProp(gl.geometry(), px, pz, 0, ph, true);
    }
  }

  // Props verschmelzen
  for (const [map, mat, sh] of [[propLit, litMat, true], [propGlow, glowMat, false]]) for (const [, arr] of map) {
    const mesh = new THREE.Mesh(mergeGeos(arr), mat); mesh.castShadow = sh; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; scene.add(mesh); regCull(mesh);
  }

  // ---------------------------------------------------------------- Wetter (um die Kamera, Dichte pro Ansicht über applyAtmosphere)
  const WX = { rain: { value: 0 }, spores: { value: 0 }, ash: { value: 0 }, snow: { value: 0 } };
  {
    const mk = (geo, n, mat, colors) => {
      const im = new THREE.InstancedMesh(geo, mat, n);
      for (let i = 0; i < n; i++) { im.setMatrixAt(i, _m.makeTranslation(rand() * 40, rand() * 24, rand() * 40)); im.setColorAt(i, _c.set(colors[(rand() * colors.length) | 0])); }
      im.frustumCulled = false; im.renderOrder = 3; scene.add(im);
    };
    const box = (w, h, d) => { const b = new MeshBuilder(); b.box(w, h, d, 0xffffff, { jitter: 0 }); return b.geometry(); };
    const oct = r => { const b = new MeshBuilder(); b.add(new THREE.OctahedronGeometry(r, 0), 0xffffff, { jitter: 0 }); return b.geometry(); };
    mk(box(0.018, 0.6, 0.018), 1600, weatherMat('wxRain', WX.rain, { v: [1.2, -16, 0.6], wf: 0.5, wa: 0.05, B: 40, y0: -8, ys: 24, alpha: 0.35, near: 3 }), [0x9aa6b4, 0xb4c0cc]);
    mk(oct(0.06), 900, weatherMat('wxSpore', WX.spores, { v: [0.15, 0.45, 0.1], wf: 0.9, wa: 0.6, B: 36, y0: -3, ys: 12, near: 2.5 }), [0x40fff0, 0xff60e0, 0xb080ff, 0x80ff90]);
    mk(box(0.07, 0.015, 0.07), 1100, weatherMat('wxAsh', WX.ash, { v: [0.8, -0.9, 0.3], wf: 1.3, wa: 0.5, B: 40, y0: -6, ys: 20 }), [0x3a3634, 0x5a5452, 0x2a2624, 0xff7a2a]);
    mk(oct(0.05), 1400, weatherMat('wxSnow', WX.snow, { v: [1.0, -1.6, 0.4], wf: 1.1, wa: 0.4, B: 40, y0: -6, ys: 20 }), [0xffffff, 0xe8f0ff]);
  }

  // ---------------------------------------------------------------- Atmosphäre (pro Ansicht, weich, ohne Allokationen)
  const mkAtmo = () => ({ fog: new THREE.Color(), near: 0, far: 0, skyT: new THREE.Color(), skyH: new THREE.Color(), sun: new THREE.Color(), sunI: 0,
    hs: new THREE.Color(), hg: new THREE.Color(), hi: 0, gc: 1, gs: 1, gv: 0, ge: 1, tint: new THREE.Color(), rain: 0, spores: 0, ash: 0, snow: 0 });
  const ATM = BIOMES.map(b => {
    const a = b.atmo, o = mkAtmo(), gr = a.grade, w = a.weather || {};
    o.fog.set(a.fog); o.near = a.fogNear; o.far = a.fogFar; o.skyT.set(a.sky[0]); o.skyH.set(a.sky[1]); o.sun.set(a.sun); o.sunI = a.sunI;
    o.hs.set(a.hemiSky); o.hg.set(a.hemiGround); o.hi = a.hemiI;
    o.gc = gr.contrast ?? 1; o.gs = gr.saturation ?? 1; o.gv = gr.vignette ?? 0; o.ge = gr.exposure ?? 1; o.tint.setHex(gr.tint ?? 0xffffff, THREE.LinearSRGBColorSpace);
    o.rain = w.rain || 0; o.spores = w.spores || 0; o.ash = w.ash || 0; o.snow = w.snow || 0;
    return o;
  });
  const NUMK = ['near', 'far', 'sunI', 'hi', 'gc', 'gs', 'gv', 'ge', 'rain', 'spores', 'ash', 'snow'], COLK = ['fog', 'skyT', 'skyH', 'sun', 'hs', 'hg', 'tint'];
  function mixAtmo(out, a, b, w) {
    for (const k of NUMK) out[k] = a[k] + (b[k] - a[k]) * w;
    for (const k of COLK) out[k].copy(a[k]).lerp(b[k], w);
  }
  const atTarget = mkAtmo(), atViews = [], atTmp = mkAtmo();
  let extAtmo = false, curBiome = BIOMES[0];
  function applyAtmo(pos, dt, view) {
    blendAt(pos.x, pos.z);
    curBiome = BIOMES[_bW > 0.5 ? _bB : _bA];
    mixAtmo(atTarget, ATM[_bA], ATM[_bB], _bW);
    let st = atTarget;
    if (view !== undefined && view !== null) {
      let v = atViews[view];
      if (!v) { v = atViews[view] = mkAtmo(); mixAtmo(v, atTarget, atTarget, 0); }
      else if (dt > 0) { mixAtmo(atTmp, v, atTarget, 1 - Math.exp(-2.5 * dt)); mixAtmo(v, atTmp, atTmp, 0); }
      else mixAtmo(v, atTarget, atTarget, 0);
      st = v;
    }
    const f = scene.fog; f.color.copy(st.fog); f.near = st.near; f.far = st.far;
    if (scene.background && scene.background.isColor) scene.background.copy(st.fog);
    skyTop.copy(st.skyT); skyHor.copy(st.skyH);
    sky.position.set(pos.x, 0, pos.z);
    sun.color.copy(st.sun); sun.intensity = st.sunI;
    hemi.color.copy(st.hs); hemi.groundColor.copy(st.hg); hemi.intensity = st.hi;
    setGrade({ contrast: st.gc, saturation: st.gs, vignette: st.gv, exposure: st.ge, tint: st.tint });
    WX.rain.value = st.rain; WX.spores.value = st.spores; WX.ash.value = st.ash; WX.snow.value = st.snow;
    const lim = st.far + 10, px = pos.x, pz = pos.z;
    for (let i = 0; i < cullables.length; i++) { const c = cullables[i], dx = c.x - px, dz = c.z - pz, rr = lim + c.r; c.o.visible = dx * dx + dz * dz < rr * rr; }
  }
  function applyAtmosphere(pos, dt = 0, view) { extAtmo = true; applyAtmo(pos, dt, view); }
  applyAtmo(spawnPoints[0], 0);

  // ---------------------------------------------------------------- Partikel-Pool
  const PMAX = 640;
  const pGeo = (() => { const b = new MeshBuilder(); b.box(1, 1, 1, 0xffffff, { jitter: 0.15 }); return b.geometry(); })();
  const pMesh = new THREE.InstancedMesh(pGeo, psxMat(), PMAX);
  pMesh.frustumCulled = false; pMesh.castShadow = false;
  for (let i = 0; i < PMAX; i++) { pMesh.setMatrixAt(i, ZERO_M); pMesh.setColorAt(i, _c.setRGB(1, 1, 1)); }
  scene.add(pMesh);
  const PP = { x: new Float32Array(PMAX), y: new Float32Array(PMAX), z: new Float32Array(PMAX), vx: new Float32Array(PMAX), vy: new Float32Array(PMAX),
    vz: new Float32Array(PMAX), life: new Float32Array(PMAX), max: new Float32Array(PMAX), size: new Float32Array(PMAX), spin: new Float32Array(PMAX), leaf: new Uint8Array(PMAX) };
  let pNext = 0, pAlive = 0;
  function emit(x, y, z, n, colors, speed, size, leaf, spread = 0.1, up = 1) {
    for (let k = 0; k < n; k++) {
      const i = pNext; pNext = (pNext + 1) % PMAX;
      if (PP.life[i] <= 0) pAlive++;
      const a = rand() * 6.28, sp = speed * (0.4 + rand() * 0.8);
      PP.x[i] = x + (rand() - 0.5) * spread * 2; PP.y[i] = y + (rand() - 0.5) * spread; PP.z[i] = z + (rand() - 0.5) * spread * 2;
      PP.vx[i] = Math.cos(a) * sp; PP.vz[i] = Math.sin(a) * sp; PP.vy[i] = sp * up * (0.5 + rand());
      PP.life[i] = PP.max[i] = (leaf ? 1.6 : 0.9) + rand() * 0.8;
      PP.size[i] = size * (0.6 + rand() * 0.8); PP.spin[i] = (rand() - 0.5) * 14; PP.leaf[i] = leaf ? 1 : 0;
      _c.set(colors[(rand() * colors.length) | 0]); pMesh.setColorAt(i, _c);
    }
    pMesh.instanceColor.needsUpdate = true;
  }
  function updateParticles(dt) {
    if (pAlive <= 0) return;
    const fdrag = Math.exp(-2.5 * dt);
    for (let i = 0; i < PMAX; i++) {
      if (PP.life[i] <= 0) continue;
      PP.life[i] -= dt;
      if (PP.life[i] <= 0) { pMesh.setMatrixAt(i, ZERO_M); pAlive--; continue; }
      if (PP.leaf[i]) { PP.vy[i] -= 2.2 * dt; PP.vx[i] *= fdrag; PP.vz[i] *= fdrag; PP.vy[i] = Math.max(PP.vy[i], -1.2); PP.vx[i] += Math.sin(PP.life[i] * 5 + i) * 1.5 * dt; }
      else PP.vy[i] -= G * dt;
      PP.x[i] += PP.vx[i] * dt; PP.y[i] += PP.vy[i] * dt; PP.z[i] += PP.vz[i] * dt;
      const gh = heightAt(PP.x[i], PP.z[i]) + 0.02;
      if (PP.y[i] < gh) { PP.y[i] = gh; PP.vy[i] *= -0.3; PP.vx[i] *= 0.5; PP.vz[i] *= 0.5; PP.spin[i] *= 0.5; }
      const t = PP.life[i], sz = PP.size[i] * Math.min(1, t * 2.5);
      _e.set(t * PP.spin[i], t * PP.spin[i] * 0.7, 0);
      _q.setFromEuler(_e);
      pMesh.setMatrixAt(i, _m.compose(_v.set(PP.x[i], PP.y[i], PP.z[i]), _q, _s.set(sz, PP.leaf[i] ? sz * 0.3 : sz, sz)));
    }
    pMesh.instanceMatrix.needsUpdate = true;
  }
  _e.set(0, 0, 0);

  // ---------------------------------------------------------------- Logs (Stamm-Segmente)
  const MAXLOG = 120;
  const logIM = TREE_TYPES.map(T => {
    const im = new THREE.InstancedMesh(buildLogGeo(T), litMat, MAXLOG);
    for (let i = 0; i < MAXLOG; i++) im.setMatrixAt(i, ZERO_M);
    im.frustumCulled = false; im.castShadow = im.receiveShadow = true; im.count = 0; im.visible = false; scene.add(im); return im;
  });
  const freeSlots = TREE_TYPES.map(() => { const a = []; for (let i = MAXLOG - 1; i >= 0; i--) a.push(i); return a; });
  const logs = [];
  for (let i = 0; i < MAXLOG; i++) logs.push({ alive: false, type: 0, slot: -1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, yawV: 0, pitch: 0,
    roll: 0, rollV: 0, L: 1, r: 0.2, m: 1, grounded: false, asleep: false, sleepT: 0, dirty: true });
  let logCount = 0, wood = 0;
  function syncLogCount(type) { const im = logIM[type]; let mx = 0; for (const l of logs) if (l.alive && l.type === type) mx = Math.max(mx, l.slot + 1); im.count = mx; im.visible = mx > 0; }
  function spawnLog(type, x, y, z, yaw, pitch, L, r, vx, vy, vz) {
    if (!freeSlots[type].length) return null;
    const lg = logs.find(l => !l.alive); if (!lg) return null;
    Object.assign(lg, { alive: true, type, slot: freeSlots[type].pop(), x, y, z, vx, vy, vz, yaw, yawV: 0, pitch, roll: rand() * 6.28, rollV: 0,
      L, r, m: Math.PI * r * r * L * 600, grounded: false, asleep: false, sleepT: 0, dirty: true });
    logCount++; syncLogCount(type); return lg;
  }
  function removeLog(lg) {
    lg.alive = false; logIM[lg.type].setMatrixAt(lg.slot, ZERO_M); logIM[lg.type].instanceMatrix.needsUpdate = true;
    freeSlots[lg.type].push(lg.slot); freeSlots[lg.type].sort((a, b) => b - a); lg.slot = -1; logCount--; syncLogCount(lg.type);
  }
  const wake = lg => { lg.asleep = false; lg.sleepT = 0; };
  // Oberkante anderer Logs unter (x,z), nur Logs unterhalb maxY
  function logTopAt(x, z, except, maxY) {
    let best = -1e9;
    for (let i = 0; i < MAXLOG; i++) {
      const o = logs[i]; if (!o.alive || o === except || o.y > maxY) continue;
      const ax = Math.sin(o.yaw), az = Math.cos(o.yaw), hl = o.L * 0.5;
      const dx = x - o.x, dz = z - o.z; if (Math.abs(dx) > hl + o.r || Math.abs(dz) > hl + o.r) continue;
      const t = clamp(dx * ax + dz * az, -hl, hl), qx = dx - ax * t, qz = dz - az * t, d2 = qx * qx + qz * qz;
      if (d2 < o.r * o.r) { const y = o.y + Math.sin(o.pitch) * t + Math.sqrt(o.r * o.r - d2); if (y > best) best = y; }
    }
    return best;
  }

  let time = 0;
  let _lg = null, _lax = 0, _laz = 0, _lhl = 0;
  function logVsCollider(k) {
    const lg = _lg, ax = _lax, az = _laz, hl = _lhl;
    if (k.seg) {
      if (k.gate && k.gate.open) return;
      // Segment gegen Log: Log-Mittelpunkt + Enden als Kreise
      for (let e = -1; e <= 1; e++) {
        const px = lg.x + ax * hl * e * 0.9, pz = lg.z + az * hl * e * 0.9, ex = k.bx - k.ax, ez = k.bz - k.az, l2 = ex * ex + ez * ez;
        const t = clamp(((px - k.ax) * ex + (pz - k.az) * ez) / l2, 0, 1), qx = px - k.ax - ex * t, qz = pz - k.az - ez * t, d = Math.hypot(qx, qz), min = k.r + lg.r;
        if (d >= min || d < 1e-5) continue;
        const nx = qx / d, nz_ = qz / d, ov = min - d; lg.x += nx * ov; lg.z += nz_ * ov;
        const vn = lg.vx * nx + lg.vz * nz_; if (vn < 0) { lg.vx -= nx * vn * 1.2; lg.vz -= nz_ * vn * 1.2; lg.yawV += e * vn * 0.3; }
      }
      return;
    }
    const dx = k.x - lg.x, dz = k.z - lg.z;
    if (Math.abs(dx) > hl + k.r + lg.r || Math.abs(dz) > hl + k.r + lg.r) return;
    if (lg.y - lg.r > k.top - 0.1) return;
    const t = clamp(dx * ax + dz * az, -hl, hl), qx = dx - ax * t, qz = dz - az * t, d = Math.hypot(qx, qz), min = k.r + lg.r;
    if (d >= min || d < 1e-5) return;
    const nx = qx / d, nz_ = qz / d, ov = min - d;
    lg.x -= nx * ov; lg.z -= nz_ * ov;
    const vn = lg.vx * nx + lg.vz * nz_;
    if (vn > 0) { lg.vx -= nx * vn * 1.2; lg.vz -= nz_ * vn * 1.2; lg.yawV += (t / hl) * vn * 0.3; }
  }
  function stepLog(lg, h) {
    const ax = Math.sin(lg.yaw), az = Math.cos(lg.yaw), px = az, pz = -ax, hl = lg.L * 0.5;
    const e1x = lg.x + ax * hl, e1z = lg.z + az * hl, e2x = lg.x - ax * hl, e2z = lg.z - az * hl;
    const g1 = heightAt(e1x, e1z), g2 = heightAt(e2x, e2z), gc = heightAt(lg.x, lg.z);
    let support = Math.max((g1 + g2) * 0.5, gc) + lg.r * Math.cos(lg.pitch);
    const lt = logTopAt(lg.x, lg.z, lg, lg.y - 0.05); if (lt > -1e8) support = Math.max(support, lt + lg.r * 0.9);
    lg.vy -= G * h;
    const floatY = WATER - lg.r * 0.25 + Math.sin(time * 1.3 + lg.x * 0.16) * 0.08;
    const swim = floatY > support && lg.y < floatY + lg.r;
    if (swim) {
      lg.vy += ((floatY - lg.y) * 16 - lg.vy * 4) * h;
      const d = Math.exp(-0.7 * h); lg.vx *= d; lg.vz *= d; lg.yawV *= Math.exp(-1.2 * h);
      lg.vx += Math.sin(time * 0.3 + lg.z * 0.05) * 0.12 * h; lg.vz += Math.cos(time * 0.27 + lg.x * 0.05) * 0.12 * h;
      lg.pitch *= Math.exp(-3 * h); lg.rollV = Math.sin(time * 1.1 + lg.x) * 0.3; lg.sleepT = 0;
    }
    lg.x += lg.vx * h; lg.y += lg.vy * h; lg.z += lg.vz * h; lg.yaw += lg.yawV * h;
    lg.grounded = false;
    if (lg.y <= support) {
      lg.y = support; lg.grounded = true;
      if (lg.vy < 0) lg.vy = lg.vy < -2.5 ? -lg.vy * 0.15 : 0;
      const tp = Math.atan2(g1 - g2, lg.L); lg.pitch += (tp - lg.pitch) * Math.min(1, h * 12);
      grad(lg.x, lg.z);
      const gp = gX * px + gZ * pz, ga = gX * ax + gZ * az;
      let vP = lg.vx * px + lg.vz * pz, vA = lg.vx * ax + lg.vz * az;
      vP -= G * gp * 0.667 * h;
      const rr = 0.4 * h; vP = Math.abs(vP) <= rr ? 0 : vP - Math.sign(vP) * rr;
      vA -= G * ga * h;
      const fr = 4.2 * h; vA = Math.abs(vA) <= fr ? 0 : vA - Math.sign(vA) * fr;
      const e = 0.5;
      const gp1 = (heightAt(e1x + px * e, e1z + pz * e) - heightAt(e1x - px * e, e1z - pz * e)) / (2 * e);
      const gp2 = (heightAt(e2x + px * e, e2z + pz * e) - heightAt(e2x - px * e, e2z - pz * e)) / (2 * e);
      lg.yawV += (-G * 0.667 * (gp1 - gp2) / lg.L) * h * 0.6;
      lg.yawV *= Math.exp(-4 * h);
      lg.vx = px * vP + ax * vA; lg.vz = pz * vP + az * vA;
      if (!swim) lg.rollV = -vP / lg.r;
    }
    lg.roll += lg.rollV * h;
    if (!lg.grounded && !swim) lg.rollV *= Math.exp(-0.3 * h);
    // Statische Kollider (Hash) inkl. Wände/Tore
    _lg = lg; _lax = ax; _laz = az; _lhl = hl;
    forCols(lg.x, lg.z, hl + lg.r + 1, logVsCollider);
    // Insel-Grenze
    const dc = Math.hypot(lg.x, lg.z); if (dc > EXT - 15) { lg.vx -= lg.x / dc * h * 2; lg.vz -= lg.z / dc * h * 2; }
    // Schlafen
    const sp = Math.abs(lg.vx) + Math.abs(lg.vz) + Math.abs(lg.vy) * 0.5 + Math.abs(lg.yawV);
    if (lg.grounded && !swim && sp < 0.07) { lg.sleepT += h; if (lg.sleepT > 0.5) { lg.asleep = true; lg.vx = lg.vy = lg.vz = lg.yawV = lg.rollV = 0; } }
    else lg.sleepT = 0;
    lg.dirty = true;
  }
  // Log-gegen-Log (2D-Segmentabstand + Höhenüberlappung)
  let _sa = 0, _sb = 0;
  function segClosest(a, b) {
    const ax = Math.sin(a.yaw), az = Math.cos(a.yaw), bx = Math.sin(b.yaw), bz = Math.cos(b.yaw), ha = a.L / 2, hb = b.L / 2;
    const rx = a.x - b.x, rz = a.z - b.z, bdot = ax * bx + az * bz, c = ax * rx + az * rz, f = bx * rx + bz * rz;
    const den = 1 - bdot * bdot;
    let s = den > 1e-4 ? clamp((bdot * f - c) / den, -ha, ha) : 0;
    const t = clamp(bdot * s + f, -hb, hb);
    s = clamp(bdot * t - c, -ha, ha);
    _sa = s; _sb = t;
    const dx = rx + ax * s - bx * t, dz = rz + az * s - bz * t;
    return dx * dx + dz * dz;
  }
  function logPairs() {
    for (let i = 0; i < MAXLOG; i++) {
      const a = logs[i]; if (!a.alive) continue;
      for (let j = i + 1; j < MAXLOG; j++) {
        const b = logs[j]; if (!b.alive || (a.asleep && b.asleep)) continue;
        const lim = (a.L + b.L) * 0.5 + a.r + b.r;
        if (Math.abs(a.x - b.x) > lim || Math.abs(a.z - b.z) > lim) continue;
        if (Math.abs(a.y - b.y) > (a.r + b.r) * 0.8) continue; // gestapelt → Support statt Stoß
        const d2 = segClosest(a, b), min = a.r + b.r;
        if (d2 >= min * min) continue;
        const axx = Math.sin(a.yaw), azz = Math.cos(a.yaw), bxx = Math.sin(b.yaw), bzz = Math.cos(b.yaw);
        let nx = (b.x + bxx * _sb) - (a.x + axx * _sa), nz_ = (b.z + bzz * _sb) - (a.z + azz * _sa);
        let d = Math.sqrt(d2);
        if (d < 1e-4) { nx = azz; nz_ = -axx; d = 1; if ((b.x - a.x) * nx + (b.z - a.z) * nz_ < 0) { nx = -nx; nz_ = -nz_; } } else { nx /= d; nz_ /= d; d = Math.sqrt(d2); }
        const ov = min - d, wa = b.m / (a.m + b.m), wb = 1 - wa;
        a.x -= nx * ov * wa; a.z -= nz_ * ov * wa; b.x += nx * ov * wb; b.z += nz_ * ov * wb;
        const vn = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz_;
        if (vn < 0) {
          const j_ = -1.1 * vn / (1 / a.m + 1 / b.m);
          a.vx -= nx * j_ / a.m; a.vz -= nz_ * j_ / a.m; b.vx += nx * j_ / b.m; b.vz += nz_ * j_ / b.m;
        }
        if (ov > 0.02 || vn < -0.05) { wake(a); wake(b); }
      }
    }
  }
  function writeLogMatrix(lg) {
    _e.set(-lg.pitch, lg.yaw, lg.roll); _q.setFromEuler(_e);
    logIM[lg.type].setMatrixAt(lg.slot, _m.compose(_v.set(lg.x, lg.y, lg.z), _q, _s.set(lg.r, lg.r, lg.L)));
    logIM[lg.type].instanceMatrix.needsUpdate = true; lg.dirty = false;
  }

  // ---------------------------------------------------------------- Fällen
  const fallers = [];
  function setTreeMatrix(t, m) {
    t.im.setMatrixAt(t.slot, m); t.im.instanceMatrix.needsUpdate = true;
    if (t.gm) { t.gm.setMatrixAt(t.slot, m); t.gm.instanceMatrix.needsUpdate = true; }
  }
  function fell(t, dx, dz) {
    const T = TREE_TYPES[t.type], gs = treeGeo[t.type];
    t.state = 1; t.col.top = t.y + T.stump * t.s; t.col.base = t.y - 0.3;
    setTreeMatrix(t, ZERO_M);
    _q.setFromAxisAngle(UP, t.yaw);
    const sm = stumpIM[t.type];
    if (sm.count < sm.instanceMatrix.count) { sm.setMatrixAt(sm.count++, _m.compose(_v.set(t.x, t.y, t.z), _q, _s.set(t.s, t.s, t.s))); sm.instanceMatrix.needsUpdate = true; sm.visible = true; }
    const grp = new THREE.Group();
    const mt = new THREE.Mesh(gs.trunk, litMat), mc = new THREE.Mesh(gs.crown, T.glow ? glowMat : litMat);
    mt.castShadow = mc.castShadow = mt.receiveShadow = mc.receiveShadow = true;
    grp.add(mt, mc); grp.position.set(t.x, t.y + T.stump * t.s, t.z); grp.scale.setScalar(t.s);
    scene.add(grp);
    const len = (T.top - T.stump) * t.s, lc = len * T.lc;
    fallers.push({ t, grp, dx, dz, theta: 0.05, omega: 0.4, k: G * lc / (len * len * 0.3), len, bounces: 0, settled: false, settleT: 0,
      qYaw: new THREE.Quaternion().setFromAxisAngle(UP, t.yaw), axis: new THREE.Vector3(dz, 0, -dx) });
  }
  function fallTouches(f) {
    const T = TREE_TYPES[f.t.type], s = Math.sin(f.theta), c = Math.cos(f.theta), px = f.grp.position.x, py = f.grp.position.y, pz = f.grp.position.z;
    const crownStart = (T.crownC - T.crownR - T.stump) * f.t.s;
    for (let l = 1.5; l <= f.len; l += 1.0) {
      const x = px + f.dx * s * l, z = pz + f.dz * s * l, y = py + c * l;
      const clr = l > crownStart ? T.crownR * f.t.s * 0.4 : T.rB * f.t.s;
      if (y < heightAt(x, z) + clr) return true;
    }
    return false;
  }
  function breakFall(f) {
    const t = f.t, T = TREE_TYPES[t.type], s = Math.sin(f.theta), c = Math.cos(f.theta);
    const px = f.grp.position.x, py = f.grp.position.y, pz = f.grp.position.z;
    const trunkLen = (T.H - T.stump) * t.s;
    const n = clamp(Math.round(trunkLen / 2.6 + (rand() - 0.5)), 2, 4);
    const yaw = Math.atan2(f.dx, f.dz), pitch = Math.PI / 2 - f.theta;
    let l0 = 0;
    for (let i = 0; i < n; i++) {
      const L = trunkLen / n * (i < n - 1 ? 0.9 + rand() * 0.2 : 1), l1 = i < n - 1 ? l0 + L : trunkLen, Lr = l1 - l0, lm = (l0 + l1) / 2;
      const hy = T.stump + lm / t.s, r = lerp(T.rB, T.rT, hy / T.H) * t.s * 1.05;
      const lg = spawnLog(t.type, px + f.dx * s * lm, py + c * lm + 0.05, pz + f.dz * s * lm, yaw + (rand() - 0.5) * 0.15, pitch, Lr - 0.04, Math.max(0.09, r),
        f.dx * (rand() - 0.3) * 0.6, 0.6 + rand() * 0.6, f.dz * (rand() - 0.3) * 0.6);
      if (lg) emit(lg.x, lg.y, lg.z, 4, T.chip || CHIP_COL, 1.5, 0.08, false, 0.2);
      l0 = l1;
    }
    const lcn = (T.crownC - T.stump) * t.s;
    emit(px + f.dx * s * lcn, py + c * lcn, pz + f.dz * s * lcn, 60, T.leaves, 3.2, 0.22, true, T.crownR * t.s * 0.8, 0.8);
    scene.remove(f.grp);
    t.state = 2;
  }
  function updateFallers(dt) {
    for (let i = fallers.length - 1; i >= 0; i--) {
      const f = fallers[i];
      if (!f.settled) {
        f.omega += f.k * Math.sin(f.theta) * dt; f.theta += f.omega * dt;
        if (f.theta > 1.75) { f.theta = 1.75; f.omega = -Math.abs(f.omega) * 0.2; f.bounces++; }
        if (f.omega > 0 && fallTouches(f)) {
          f.theta -= f.omega * dt;
          if (f.bounces === 0) emit(f.grp.position.x + f.dx * f.len * 0.7, f.grp.position.y + 0.3, f.grp.position.z + f.dz * f.len * 0.7, 18, TREE_TYPES[f.t.type].leaves, 2.5, 0.18, true, 1.5);
          f.omega = -f.omega * (f.bounces === 0 ? 0.22 : 0.15); f.bounces++;
          if (f.bounces >= 3 || Math.abs(f.omega) < 0.12) { f.settled = true; f.omega = 0; }
        }
      } else if ((f.settleT += dt) > 0.18) { breakFall(f); fallers.splice(i, 1); continue; }
      f.grp.quaternion.setFromAxisAngle(f.axis, f.theta).multiply(f.qYaw);
    }
  }
  const wobbling = [];
  function updateTrees(dt) {
    for (let i = wobbling.length - 1; i >= 0; i--) {
      const t = wobbling[i];
      if (t.state !== 0) { wobbling.splice(i, 1); continue; }
      t.wobT += dt; t.wob *= Math.exp(-3.5 * dt); if (t.wob < 0.002) { t.wob = 0; wobbling.splice(i, 1); }
      setTreeMatrix(t, treeMatrix(t, t.wob * Math.sin(t.wobT * 22)));
    }
  }

  // ---------------------------------------------------------------- API
  const COS_CONE = Math.cos(Math.PI / 6);
  let _ht = null, _htD = 1e9, _hox = 0, _hoz = 0, _hdx = 0, _hdz = 0, _hreach = 0;
  function hitScan(c) {
    const t = c.tree; if (!t || t.state !== 0) return;
    const vx = t.x - _hox, vz = t.z - _hoz, d = Math.hypot(vx, vz), surf = d - t.r;
    if (surf > _hreach || surf >= _htD) return;
    if (surf > 0.35 && (vx * _hdx + vz * _hdz) / d < COS_CONE) return;
    _ht = t; _htD = surf;
  }
  function hitTree(origin, dir, reach = 2.2, dmg = 1) {
    let dx = dir.x, dz = dir.z; const dl = Math.hypot(dx, dz);
    const res = { hit: false, kind: null, felled: false, point: null };
    if (dl < 1e-5) return res; dx /= dl; dz /= dl;
    _ht = null; _htD = 1e9; _hox = origin.x; _hoz = origin.z; _hdx = dx; _hdz = dz; _hreach = reach;
    forCols(origin.x, origin.z, reach + 1.5, hitScan);
    let best = _ht, bestD = _htD, bestLog = null, bt = 0;
    for (const lg of logs) {
      if (!lg.alive || lg.y < origin.y - 1.3 || lg.y > origin.y + 2.3) continue;
      const ax = Math.sin(lg.yaw), az = Math.cos(lg.yaw), hl = lg.L / 2;
      for (let k = 0; k < 2; k++) {
        const qx0 = k ? origin.x + dx * reach * 0.6 : origin.x, qz0 = k ? origin.z + dz * reach * 0.6 : origin.z;
        const t = clamp((qx0 - lg.x) * ax + (qz0 - lg.z) * az, -hl, hl), cx = lg.x + ax * t, cz = lg.z + az * t;
        const vx = cx - origin.x, vz = cz - origin.z, d = Math.hypot(vx, vz), surf = d - lg.r;
        if (surf > reach || surf >= bestD) continue;
        if (surf > 0.3 && (vx * dx + vz * dz) / d < COS_CONE) continue;
        best = null; bestLog = lg; bestD = surf; bt = t;
      }
    }
    if (best) {
      const t = best, T = TREE_TYPES[t.type], vx = t.x - origin.x, vz = t.z - origin.z, d = Math.hypot(vx, vz) || 1, fx = vx / d, fz = vz / d;
      const point = new THREE.Vector3(t.x - fx * t.r, Math.min(origin.y + 1.0, t.y + 1.4), t.z - fz * t.r);
      t.hp -= dmg; t.wob = 0.06; t.wobT = 0; t.wx = fx; t.wz = fz; if (!wobbling.includes(t)) wobbling.push(t);
      emit(point.x, point.y, point.z, 10, [...(T.chip || CHIP_COL), T.bark], 2.6, 0.07, false, 0.05);
      emit(t.x, t.y + T.crownC * t.s, t.z, 4, T.leaves, 1.2, 0.18, true, T.crownR * t.s * 0.6, 0.2);
      if (t.hp <= 0) fell(t, fx, fz);
      return Object.assign(res, { hit: true, kind: 'tree', felled: t.hp <= 0, point });
    }
    if (bestLog) {
      const lg = bestLog, ax = Math.sin(lg.yaw), az = Math.cos(lg.yaw);
      const point = new THREE.Vector3(lg.x + ax * bt, lg.y + lg.r * 0.8, lg.z + az * bt);
      const T = TREE_TYPES[lg.type];
      emit(point.x, point.y, point.z, 12, T.chip || CHIP_COL, 2.4, 0.07, false, 0.1);
      wake(lg);
      if (lg.L < 1.6) {
        emit(lg.x, lg.y, lg.z, 22, [...(T.chip || CHIP_COL), T.bark], 2.0, 0.12, false, lg.L * 0.4);
        removeLog(lg); wood++;
      } else {
        const { type, x, y, z, yaw, pitch, L, r } = lg, q = L / 4, sp = Math.sin(pitch) * q;
        removeLog(lg);
        for (const sg of [1, -1]) {
          const nl = spawnLog(type, x + ax * q * sg, y + sp * sg + 0.05, z + az * q * sg, yaw + (rand() - 0.5) * 0.3, pitch, L / 2 - 0.03, r,
            ax * sg * 0.9, 1.4, az * sg * 0.9);
          if (nl) nl.yawV = (rand() - 0.5) * 1.5;
        }
      }
      return Object.assign(res, { hit: true, kind: 'log', felled: false, point });
    }
    return res;
  }

  function groundAt(x, z, footY) {
    const lim = footY + 0.45; let best = heightAt(x, z);
    const a = cellAt(x, z);
    for (let i = 0; i < a.length; i++) {
      const c = a[i]; if (c.top === Infinity) continue;
      const dx = x - c.x, dz = z - c.z, d2 = dx * dx + dz * dz; if (d2 >= c.r * c.r) continue;
      const y = c.dome ? c.base + (c.top - c.base) * Math.sqrt(1 - d2 / (c.r * c.r)) : c.top;
      if (y <= lim && y > best) best = y;
    }
    const ly = logTopAt(x, z, null, lim);
    if (ly <= lim && ly > best) best = ly;
    return best;
  }

  let _cp = null, _cr = 0, _ch = 0, _cn = 0;
  function colOne(c) {
    const pos = _cp, radius = _cr, height = _ch;
    if (c.seg) {
      if (c.gate && c.gate.open) return;
      if (pos.y + height < c.base) return;
      const ex = c.bx - c.ax, ez = c.bz - c.az, l2 = ex * ex + ez * ez, min = c.r + radius;
      const t = clamp(((pos.x - c.ax) * ex + (pos.z - c.az) * ez) / l2, 0, 1), qx = pos.x - c.ax - ex * t, qz = pos.z - c.az - ez * t, d2 = qx * qx + qz * qz;
      if (d2 >= min * min) return;
      const d = Math.sqrt(d2); let nx, nz_;
      if (d > 1e-5) { nx = qx / d; nz_ = qz / d; } else { const l = Math.sqrt(l2); nx = -ez / l; nz_ = ex / l; }
      pos.x += nx * (min - d); pos.z += nz_ * (min - d); _cn++;
      return;
    }
    const dx = pos.x - c.x, dz = pos.z - c.z, min = c.r + radius;
    if (Math.abs(dx) > min || Math.abs(dz) > min) return;
    const d2 = dx * dx + dz * dz; if (d2 >= min * min) return;
    const d = Math.sqrt(d2);
    if (c.top !== Infinity) {
      const dd = Math.max(0, d - radius * 0.7), ys = c.dome ? c.base + (c.top - c.base) * Math.sqrt(Math.max(0, 1 - (dd * dd) / (c.r * c.r))) : c.top;
      if (pos.y >= ys - 0.45) return;
    }
    if (pos.y + height < c.base) return;
    const nx = d > 1e-5 ? dx / d : 1, nz_ = d > 1e-5 ? dz / d : 0;
    pos.x = c.x + nx * min; pos.z = c.z + nz_ * min; _cn++;
  }
  function collide(pos, radius, height, vel) {
    _cp = pos; _cr = radius; _ch = height; _cn = 0;
    forCols(pos.x, pos.z, radius, colOne);
    let n = _cn;
    for (let i = 0; i < MAXLOG; i++) {
      const lg = logs[i]; if (!lg.alive) continue;
      const ax = Math.sin(lg.yaw), az = Math.cos(lg.yaw), hl = lg.L / 2, min = lg.r + radius;
      const dx = pos.x - lg.x, dz = pos.z - lg.z; if (Math.abs(dx) > hl + min || Math.abs(dz) > hl + min) continue;
      const t = clamp(dx * ax + dz * az, -hl, hl), qx = dx - ax * t, qz = dz - az * t, d = Math.hypot(qx, qz);
      if (d >= min) continue;
      const ly = lg.y + Math.sin(lg.pitch) * t;
      if (pos.y >= ly - 0.05 || pos.y + height < ly - lg.r) continue;
      let nx = az, nz_ = -ax; if (d > 1e-5) { nx = qx / d; nz_ = qz / d; } else if (qx * nx + qz * nz_ < 0) { nx = -nx; nz_ = -nz_; }
      const ov = min - d; let share = 1;
      if (vel) {
        const into = -(vel.x * nx + vel.z * nz_);
        if (into > 0) {
          const kk = clamp(90 / (90 + lg.m * 0.5), 0.12, 0.9), target = into * kk, cur = -(lg.vx * nx + lg.vz * nz_);
          if (cur < target) {
            const dv = (target - cur) * 0.5; lg.vx -= nx * dv; lg.vz -= nz_ * dv;
            lg.yawV += (t / hl) * (-(nx * az - nz_ * ax)) * dv / Math.max(hl, 0.5) * 0.8;
            wake(lg); share = 0.7;
          }
        }
      }
      pos.x += nx * ov * share; pos.z += nz_ * ov * share; n++;
    }
    return n;
  }

  function randomLandPoint(r = Math.random) {
    for (let i = 0; i < 200; i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * R, x = Math.cos(a) * d, z = Math.sin(a) * d, h = heightAt(x, z);
      if (h > 1.5 && h < 30 && !reserved(x, z, 0)) return new THREE.Vector3(x, h, z);
    }
    return spawnPoints[0].clone();
  }

  function setGateOpen(id, open = true) {
    const g = gates.find(x => x.id === id || x.fromBiome === id); if (!g) return false;
    if (g.open === !!open) return true;
    g.open = !!open;
    if (open) for (let i = 0; i < 5; i++) emit(g.pos.x + (g._b[0] - g._a[0]) * (i / 4 - 0.5), g.pos.y + 1 + rand() * 3, g.pos.z + (g._b[1] - g._a[1]) * (i / 4 - 0.5), 14, [0xe8ecf4, 0xc8ccd8, 0xffffff], 2.2, 0.35, true, 1.5, 0.6);
    else { g._fade = Math.max(g._fade, 0.01); for (const m of g._meshes) m.visible = true; }
    return true;
  }
  function updateGates(dt) {
    for (const g of gates) {
      const tgt = g.open ? 0 : 1;
      if (g._fade === tgt) continue;
      g._fade = tgt ? Math.min(1, g._fade + dt * 0.8) : Math.max(0, g._fade - dt * 0.6);
      g._u.value = g._fade;
      if (g._fade === 0) for (const m of g._meshes) m.visible = false;
    }
  }

  function update(dt, players) {
    dt = Math.min(dt, 0.05); time += dt;
    updateTrees(dt);
    updateFallers(dt);
    const ns = Math.max(1, Math.ceil(dt / (1 / 60))), h = dt / ns;
    for (let s = 0; s < ns; s++) {
      for (let i = 0; i < MAXLOG; i++) { const lg = logs[i]; if (lg.alive && !lg.asleep) stepLog(lg, h); }
      logPairs();
    }
    for (let i = 0; i < MAXLOG; i++) { const lg = logs[i]; if (lg.alive && lg.dirty) writeLogMatrix(lg); }
    updateParticles(dt);
    updateGates(dt);
    // Fallback, solange Main applyAtmosphere nicht selbst pro Ansicht aufruft
    if (!extAtmo && players && players[0] && players[0].pos) applyAtmo(players[0].pos, dt, 0);
  }

  function stats() {
    let standing = 0; for (const t of trees) if (t.state === 0) standing++;
    return { trees: standing, logs: logCount, wood };
  }

  function biomeAt(x, z) { return BIOMES[biomeIdx(x, z)]; }
  function biomeBlend(x, z) { blendAt(x, z); const out = [{ biome: BIOMES[_bA], w: 1 - _bW }]; if (_bW > 0.001) out.push({ biome: BIOMES[_bB], w: _bW }); return out; }

  return { radius: R, waterLevel: WATER, heightAt, groundAt, collide, hitTree, spawnPoints, randomLandPoint, update, stats, sun,
    sunOffset, trees, logs,
    // Erweiterung 3
    biomes: BIOMES, biomeAt, biomeBlend, applyAtmosphere, get currentBiome() { return curBiome; },
    bossSlots, mobZones, shrines, gates, setGateOpen, wreck, route, landmarks: { cathedral }, hemi };
}
