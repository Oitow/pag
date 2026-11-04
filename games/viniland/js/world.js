// Viniland – Welt: Insel-Terrain, Wasser, Himmel, Licht, Bäume (fällbar), Logs mit leichter Eigenphysik, Deko.
// API siehe CONTRACT.md (createWorld).
import * as THREE from 'three';
import { psxMat, patchPSX } from './psx.js';
import { MeshBuilder, rng, makeNoise, clamp, lerp } from './kit.js';

const G = 9.81;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Temporäre Objekte (keine Allokationen im Loop)
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'),
  _v = new THREE.Vector3(), _s = new THREE.Vector3(), _ax = new THREE.Vector3(), _c = new THREE.Color();
const ZERO_M = new THREE.Matrix4().makeScale(0, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);

// Baumarten (unskaliert, Meter)
const TREE_TYPES = [
  { id: 'pine', H: 9.2, rB: 0.30, rT: 0.09, stump: 0.42, crownC: 6.0, crownR: 2.2, top: 10.6, lc: 0.50, hp: [4, 5],
    bark: 0x7a5232, leaves: [0x2f6b3a, 0x3d7d44, 0x285f33] },
  { id: 'oak', H: 5.0, rB: 0.42, rT: 0.27, stump: 0.42, crownC: 6.4, crownR: 2.8, top: 9.0, lc: 0.66, hp: [4, 5],
    bark: 0x5e4430, leaves: [0x5c9e3c, 0x74b247, 0x4e8c35] },
  { id: 'birch', H: 8.4, rB: 0.20, rT: 0.08, stump: 0.40, crownC: 6.7, crownR: 1.7, top: 9.4, lc: 0.55, hp: [3, 4],
    bark: 0xe6e1d3, leaves: [0xa3cf4f, 0xbcd95c, 0x8cbf45] },
];

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

function buildTreeGeos(T, r) {
  const st = new MeshBuilder(), tr = new MeshBuilder(), cr = new MeshBuilder();
  const rAt = y => lerp(T.rB, T.rT, y / T.H);
  st.cyl(rAt(T.stump), T.rB * 1.08, T.stump, T.bark, { y: T.stump / 2 }, 8);
  st.cyl(rAt(T.stump) * 0.85, rAt(T.stump) * 0.85, 0.02, 0xe8c48a, { y: T.stump + 0.005 }, 8);
  tr.cyl(T.rT, rAt(T.stump), T.H - T.stump, T.bark, { y: T.stump + (T.H - T.stump) / 2 }, 8);
  if (T.id === 'pine') {
    const lay = [[2.6, 2.2, 3.2], [4.3, 1.85, 3.0], [5.9, 1.45, 2.7], [7.5, 1.05, 2.4], [8.9, 0.6, 1.8]];
    lay.forEach(([y, rr, h], i) => cr.cone(rr, h, T.leaves[i % 3], { y: y + h / 2, ry: r() * 3, jitter: 0.1 }, 8));
  } else if (T.id === 'oak') {
    tr.cyl(0.09, 0.16, 2.2, T.bark, { y: 4.3, x: 0.7, rz: -0.8 }, 6);
    tr.cyl(0.08, 0.15, 2.0, T.bark, { y: 4.5, z: -0.6, rx: -0.75 }, 6);
    const bl = [[0, 6.6, 0, 2.4], [1.5, 6.0, 0.4, 1.8], [-1.3, 6.1, -0.7, 1.9], [0.3, 5.8, 1.5, 1.7], [-0.5, 7.6, 0.6, 1.6], [0.9, 7.2, -1.2, 1.5]];
    bl.forEach(([x, y, z, rr], i) => cr.ico(rr, T.leaves[i % 3], { x, y, z, sy: 0.85, jitter: 0.12 }, 1));
  } else {
    for (let i = 0; i < 7; i++) {
      const y = 0.9 + r() * (T.H - 2), a = r() * 6.28, rr = rAt(y);
      tr.box(0.16, 0.05, 0.05, 0x3a3532, { x: Math.sin(a) * rr, y, z: Math.cos(a) * rr, ry: a + 1.57, jitter: 0.1 });
    }
    const bl = [[0, 7.0, 0, 1.5], [0.7, 6.0, 0.3, 1.2], [-0.6, 6.3, -0.4, 1.15], [0.1, 8.3, 0.2, 1.0]];
    bl.forEach(([x, y, z, rr], i) => cr.ico(rr, T.leaves[i % 3], { x, y, z, sy: 1.35, jitter: 0.12 }, 1));
  }
  const gs = st.geometry(), gt = tr.geometry(), gc = cr.geometry();
  const full = mergeGeos([gs, gt, gc]);
  const gt2 = gt.clone(); gt2.translate(0, -T.stump, 0);
  const gc2 = gc.clone(); gc2.translate(0, -T.stump, 0);
  return { full, stump: gs, trunk: gt2, crown: gc2 };
}

function buildLogGeo(T) {
  const b = new MeshBuilder();
  b.cyl(1, 1, 1, T.bark, { rx: Math.PI / 2 }, 8);
  b.cyl(0.86, 0.86, 0.02, 0xe8c48a, { rx: Math.PI / 2, z: 0.5 }, 8);
  b.cyl(0.86, 0.86, 0.02, 0xe8c48a, { rx: Math.PI / 2, z: -0.5 }, 8);
  b.cyl(0.3, 0.3, 0.025, 0xc99a5e, { rx: Math.PI / 2, z: 0.5 }, 6);
  b.cyl(0.3, 0.3, 0.025, 0xc99a5e, { rx: Math.PI / 2, z: -0.5 }, 6);
  if (T.id === 'birch') for (let i = 0; i < 5; i++) {
    const a = i * 2.3, z = -0.4 + i * 0.2;
    b.box(0.5, 0.18, 0.06, 0x3a3532, { x: Math.sin(a), y: Math.cos(a), z, rz: -a });
  } else b.box(0.35, 0.3, 0.2, 0x4a3524, { x: 0.95, z: 0.1 });
  return b.geometry();
}

export function createWorld(scene, { seed = 1 } = {}) {
  const R = 220, WATER = 0, EXT = 262.5, CELL = 2.5, N = Math.round(2 * EXT / CELL), N1 = N + 1;
  const rand = rng(seed * 7919 + 13);
  const nz = makeNoise(seed), nz2 = makeNoise(seed + 101);
  const HILL = { x: 62, z: -72, r: 55, h: 26 };

  // ---------------------------------------------------------------- Terrain-Höhe
  function rawHeight(x, z) {
    const d = Math.hypot(x, z);
    const s = R - d + nz.fbm(x * 0.006 + 11, z * 0.006 - 7, 3) * 40; // Meter landeinwärts
    let h;
    if (s < 0) h = s * 0.05 + Math.min(0, s + 25) * 0.12;
    else h = 1.7 * (1 - Math.exp(-s * 0.035));
    const inl = smooth(14, 60, s);
    let hills = (nz.fbm(x * 0.011, z * 0.011, 4) + 0.3) * 7.5;
    hills *= 0.35 + 0.65 * smooth(-0.15, 0.3, nz2.fbm(x * 0.004 + 50, z * 0.004, 2)); // weite flache Wiesen
    hills = Math.log(1 + Math.exp(hills * 1.2)) / 1.2;
    const hd2 = (x - HILL.x) ** 2 + (z - HILL.z) ** 2;
    const big = HILL.h * Math.exp(-hd2 / (HILL.r * HILL.r)) * (1 + 0.3 * nz2.fbm(x * 0.05, z * 0.05, 3));
    h += inl * (hills + big + nz2.fbm(x * 0.08, z * 0.08, 2) * 0.35);
    return Math.max(h, -9);
  }
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

  // ---------------------------------------------------------------- Terrain-Mesh (Chunks)
  const col = h => new THREE.Color(h);
  const cWet = col(0xc8ad78), cSand = col(0xecd9a0), cSandG = col(0xc4c879), cG1 = col(0x86c04e), cG2 = col(0x63a741),
    cG3 = col(0xb0cc5c), cDirt = col(0x9b7a4c), cRock = col(0x8e8a84), cDeep = col(0x8f8a63);
  function terrainColor(h, ny, x, z, out) {
    const n1 = nz2.fbm(x * 0.02, z * 0.02, 3), n2 = nz2.noise(x * 0.11 + 30, z * 0.11);
    const sandLine = 1.3 + n1 * 0.8;
    if (h < sandLine) {
      if (h < -0.2) out.copy(cWet).lerp(cDeep, clamp(-h / 5, 0, 1));
      else out.copy(cWet).lerp(cSand, smooth(-0.2, 0.7, h));
      const b = h - (sandLine - 0.35); if (b > 0) out.lerp(cSandG, b / 0.35 * 0.6);
    } else {
      out.copy(cG2).lerp(cG1, smooth(-0.25, 0.25, n1));
      out.lerp(cG3, smooth(0.05, 0.35, nz.fbm(x * 0.006 + 40, z * 0.006 - 20, 2)) * 0.7);
      if (n2 > 0.6) out.lerp(cDirt, 0.35);
      const hf = Math.exp(-((x - HILL.x) ** 2 + (z - HILL.z) ** 2) / (HILL.r * HILL.r * 0.3));
      const rocky = Math.max(smooth(0.9, 0.72, ny), smooth(0.35, 0.75, hf + n2 * 0.35));
      out.lerp(cRock, rocky);
    }
    out.multiplyScalar(0.94 + n2 * 0.07 + (rand() - 0.5) * 0.05);
  }
  const terrainMat = psxMat();
  const CH = 7, CC = N / CH; // 7x7 Chunks à 30 Zellen
  const tA = new THREE.Vector3(), tB = new THREE.Vector3(), tC = new THREE.Vector3();
  for (let cj = 0; cj < CH; cj++) for (let ci = 0; ci < CH; ci++) {
    let maxH = -99;
    for (let j = cj * CC; j <= (cj + 1) * CC; j++) for (let i = ci * CC; i <= (ci + 1) * CC; i++) maxH = Math.max(maxH, H[j * N1 + i]);
    if (maxH < -5) continue;
    const nv = CC * CC * 6, pos = new Float32Array(nv * 3), cols = new Float32Array(nv * 3);
    let o = 0;
    const put = (i, j) => { pos[o * 3] = -EXT + i * CELL; pos[o * 3 + 1] = H[j * N1 + i]; pos[o * 3 + 2] = -EXT + j * CELL; o++; };
    for (let j = cj * CC; j < (cj + 1) * CC; j++) for (let i = ci * CC; i < (ci + 1) * CC; i++) {
      const tris = [[i, j, i, j + 1, i + 1, j + 1], [i, j, i + 1, j + 1, i + 1, j]];
      for (const t of tris) {
        const o0 = o; put(t[0], t[1]); put(t[2], t[3]); put(t[4], t[5]);
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
    scene.add(mesh);
  }

  // ---------------------------------------------------------------- Himmel, Nebel, Licht
  const HORIZON = new THREE.Color(0xf4e3c6), ZENITH = new THREE.Color(0x5fa6e6);
  scene.background = HORIZON.clone();
  scene.fog = new THREE.Fog(HORIZON.getHex(), 90, 520);
  {
    const sg = new THREE.SphereGeometry(900, 24, 14), p = sg.attributes.position, sc = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const t = clamp(p.getY(i) / 900, 0, 1);
      _c.copy(HORIZON).lerp(ZENITH, Math.pow(t, 0.55));
      sc[i * 3] = _c.r; sc[i * 3 + 1] = _c.g; sc[i * 3 + 2] = _c.b;
    }
    sg.setAttribute('color', new THREE.BufferAttribute(sc, 3));
    const skyMat = patchPSX(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    skyMat.userData.psxKey = 'sky';
    const sky = new THREE.Mesh(sg, skyMat); sky.renderOrder = -10; sky.frustumCulled = false;
    scene.add(sky);
  }
  const hemi = new THREE.HemisphereLight(0xd2e8ff, 0x7a6a45, 1.35); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d2, 2.6);
  const sunOffset = new THREE.Vector3(70, 110, 45);
  sun.position.copy(sunOffset); sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 320 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);

  // ---------------------------------------------------------------- Wasser (polares Gitter, dicht an der Küste)
  {
    const rings = []; let r = 130;
    while (r < 1700) { rings.push(r); r += r < 170 ? 10 : r < 280 ? 3.2 : r < 420 ? 9 : r * 0.18; }
    const SEG = 220, pos = [], cols = [], idx = [];
    const cShallow = col(0x5fd6c8), cMid = col(0x2aa3b8), cDeepW = col(0x1d6f9e), cFoam = col(0xf2fbf5);
    for (let ri = 0; ri < rings.length; ri++) for (let a = 0; a < SEG; a++) {
      const an = a / SEG * Math.PI * 2 + (ri % 2) * Math.PI / SEG, x = Math.cos(an) * rings[ri], z = Math.sin(an) * rings[ri];
      pos.push(x, 0, z);
      const depth = WATER - heightAt(x, z);
      if (depth < 0.25) _c.copy(cFoam).lerp(cShallow, clamp(depth / 0.25, 0, 1));
      else if (depth < 3) _c.copy(cShallow).lerp(cMid, (depth - 0.25) / 2.75);
      else _c.copy(cMid).lerp(cDeepW, clamp((depth - 3) / 6, 0, 1));
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
    const wm = psxMat({ transparent: true, opacity: 0.84, noCache: true });
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

  // ---------------------------------------------------------------- Spawn
  const spawnPoints = [];
  let spawnC, spawnIn;
  {
    const hillAng = Math.atan2(HILL.z, HILL.x);
    let best = null;
    for (let k = 0; k < 48 && !best; k++) {
      const an = hillAng + Math.PI + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.13;
      const dx = Math.cos(an), dz = Math.sin(an);
      let r = 255;
      while (r > 60 && heightAt(dx * r, dz * r) < 1.65) r -= 1;
      r -= 14;
      const x = dx * r, z = dz * r, h = heightAt(x, z);
      let flat = slopeAt(x, z) < 0.07;
      for (let a = 0; a < 6 && flat; a++) flat = slopeAt(x + Math.cos(a) * 6, z + Math.sin(a) * 6) < 0.1;
      if (flat && h > 1.6 && h < 4) best = { x, z, dx, dz };
    }
    if (!best) { const an = Math.atan2(HILL.z, HILL.x) + Math.PI; best = { x: Math.cos(an) * 170, z: Math.sin(an) * 170, dx: Math.cos(an), dz: Math.sin(an) }; }
    spawnIn = new THREE.Vector2(-best.dx, -best.dz);
    const px = -spawnIn.y, pz = spawnIn.x;
    for (const sgn of [1, -1]) {
      const x = best.x + px * 1.6 * sgn, z = best.z + pz * 1.6 * sgn;
      spawnPoints.push(new THREE.Vector3(x, heightAt(x, z), z));
    }
    spawnC = new THREE.Vector2(best.x, best.z);
  }

  // ---------------------------------------------------------------- Statische Kollider (Bäume, Stümpfe, Felsen)
  // { x, z, r, base, top, dome }  top = Infinity => nicht begehbar (stehender Baum)
  const colliders = [];

  // ---------------------------------------------------------------- Felsen
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
    const moss = col(0x76964c);
    for (let i = 0; i < gp.count; i += 3) {
      tA.fromBufferAttribute(gp, i); tB.fromBufferAttribute(gp, i + 1); tC.fromBufferAttribute(gp, i + 2);
      tB.sub(tA); tC.sub(tA); tB.cross(tC).normalize();
      if (tB.y > 0.72 && rand() < 0.6) for (let k = 0; k < 3; k++) {
        _c.fromBufferAttribute(gc, i + k).lerp(moss, 0.7); gc.setXYZ(i + k, _c.r, _c.g, _c.b);
      }
    }
    rockGeos.push(g);
  }
  const rockList = [[], [], []];
  function addRock(x, z, r, hy) {
    const g = heightAt(x, z), base = g - hy * 0.25;
    colliders.push({ x, z, r: r * 0.92, base, top: base + hy * 0.95, dome: true, tree: null });
    rockList[(rand() * 3) | 0].push({ x, y: base, z, r, hy, yaw: rand() * 6.28 });
  }
  for (let i = 0; i < 3; i++) { const a = rand() * 6.28, d = rand() * 8; addRock(HILL.x + Math.cos(a) * d, HILL.z + Math.sin(a) * d, 5 + rand() * 2.5, 4 + rand() * 2.5); }
  for (let i = 0; i < 16; i++) { const a = rand() * 6.28, d = 10 + rand() * 32; addRock(HILL.x + Math.cos(a) * d, HILL.z + Math.sin(a) * d, 1.8 + rand() * 2.8, 1.4 + rand() * 2); }
  const farFromSpawn = (x, z, d) => (x - spawnC.x) ** 2 + (z - spawnC.y) ** 2 > d * d;
  for (let n = 0, tries = 0; n < 26 && tries < 400; tries++) {
    const a = rand() * 6.28, d = rand() * 190, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (heightAt(x, z) < 2 || !farFromSpawn(x, z, 14)) continue;
    const r = 0.7 + rand() * 1.6; addRock(x, z, r, r * (0.6 + rand() * 0.4)); n++;
  }
  for (let n = 0, tries = 0; n < 14 && tries < 600; tries++) {
    const a = rand() * 6.28, d = 170 + rand() * 70, x = Math.cos(a) * d, z = Math.sin(a) * d, h = heightAt(x, z);
    if (h < -0.6 || h > 1.2 || !farFromSpawn(x, z, 10)) continue;
    const r = 0.6 + rand() * 1.2; addRock(x, z, r, r * 0.7); n++;
  }
  rockList.forEach((list, v) => {
    const im = new THREE.InstancedMesh(rockGeos[v], psxMat(), Math.max(1, list.length));
    list.forEach((k, i) => {
      _q.setFromAxisAngle(UP, k.yaw);
      im.setMatrixAt(i, _m.compose(_v.set(k.x, k.y, k.z), _q, _s.set(k.r, k.hy, k.r)));
    });
    im.count = list.length; im.castShadow = im.receiveShadow = true; im.computeBoundingSphere();
    scene.add(im);
  });

  // ---------------------------------------------------------------- Bäume
  const treeGeo = TREE_TYPES.map(T => buildTreeGeos(T, rand));
  const trees = [];
  function canTree(x, z) {
    const h = heightAt(x, z);
    if (h < 2.0 || h > 32 || slopeAt(x, z) > 0.38 || !farFromSpawn(x, z, 9)) return false;
    for (const t of trees) if ((t.x - x) ** 2 + (t.z - z) ** 2 < 11.5) return false;
    for (const c of colliders) if ((c.x - x) ** 2 + (c.z - z) ** 2 < (c.r + 1.3) ** 2) return false;
    return true;
  }
  function addTree(type, x, z) {
    const T = TREE_TYPES[type], s = 0.8 + rand() * 0.45;
    const t = { type, x, z, y: heightAt(x, z), s, yaw: rand() * 6.28, hp: T.hp[0] + ((rand() * (T.hp[1] - T.hp[0] + 1)) | 0),
      state: 0, wob: 0, wobT: 0, wx: 1, wz: 0, slot: 0, r: T.rB * s, col: null };
    t.col = { x, z, r: t.r + 0.05, base: t.y - 1, top: Infinity, dome: false, tree: t };
    colliders.push(t.col); trees.push(t);
  }
  const pickType = (x, z, dom) => {
    const hd = Math.hypot(x - HILL.x, z - HILL.z);
    if (hd < 75 && rand() < 0.75) return 0;
    if (rand() < 0.7) return dom;
    return (rand() * 3) | 0;
  };
  function cluster(cx, cz, n, rad, dom) {
    for (let k = 0, tries = 0; k < n && tries < n * 12; tries++) {
      const a = rand() * 6.28, d = Math.sqrt(rand()) * rad, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (canTree(x, z)) { addTree(pickType(x, z, dom), x, z); k++; }
    }
  }
  { // Wäldchen in Sichtweite des Spawns
    const px = -spawnIn.y, pz = spawnIn.x;
    cluster(spawnC.x + spawnIn.x * 26 + px * 8, spawnC.y + spawnIn.y * 26 + pz * 8, 11, 13, 2);
    cluster(spawnC.x + spawnIn.x * 20 - px * 26, spawnC.y + spawnIn.y * 20 - pz * 26, 9, 11, 1);
    cluster(spawnC.x + spawnIn.x * 48 + px * 30, spawnC.y + spawnIn.y * 48 + pz * 30, 10, 14, 0);
  }
  cluster(HILL.x, HILL.z, 14, 40, 0);
  for (let c = 0, tries = 0; trees.length < 150 && tries < 200; tries++) {
    const a = rand() * 6.28, d = 30 + rand() * 150, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (heightAt(x, z) < 2.5) continue;
    cluster(x, z, 6 + ((rand() * 9) | 0), 10 + rand() * 10, (rand() * 3) | 0); c++;
  }
  for (let k = 0, tries = 0; k < 14 && tries < 300; tries++) {
    const a = rand() * 6.28, d = rand() * 190, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (canTree(x, z)) { addTree((rand() * 3) | 0, x, z); k++; }
  }
  const treeIM = [], stumpIM = [], byType = [[], [], []];
  trees.forEach(t => { t.slot = byType[t.type].length; byType[t.type].push(t); });
  function treeMatrix(t, tilt) {
    _q.setFromAxisAngle(UP, t.yaw);
    if (tilt) { _ax.set(t.wz, 0, -t.wx); _q2.setFromAxisAngle(_ax, tilt); _q.premultiply(_q2); }
    return _m.compose(_v.set(t.x, t.y, t.z), _q, _s.set(t.s, t.s, t.s));
  }
  for (let ty = 0; ty < 3; ty++) {
    const n = Math.max(1, byType[ty].length);
    const im = new THREE.InstancedMesh(treeGeo[ty].full, psxMat(), n), sm = new THREE.InstancedMesh(treeGeo[ty].stump, psxMat(), n);
    byType[ty].forEach(t => { im.setMatrixAt(t.slot, treeMatrix(t, 0)); sm.setMatrixAt(t.slot, ZERO_M); });
    im.count = sm.count = byType[ty].length;
    im.castShadow = im.receiveShadow = sm.castShadow = sm.receiveShadow = true;
    im.frustumCulled = sm.frustumCulled = false;
    scene.add(im, sm); treeIM.push(im); stumpIM.push(sm);
  }

  // ---------------------------------------------------------------- Deko: Büsche, Gras, Blumen (Instancing)
  const swayMat = psxMat({ noCache: true }); swayMat.userData.psxKey = 'sway';
  { const prev = swayMat.onBeforeCompile;
    swayMat.onBeforeCompile = (sh, rd) => { prev(sh, rd);
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec2 ipw = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
        #else
          vec2 ipw = vec2(0.0);
        #endif
        float swy = max(transformed.y, 0.0);
        transformed.x += sin(uTime * 1.8 + ipw.x * 0.35 + ipw.y * 0.2) * 0.12 * swy;
        transformed.z += cos(uTime * 1.4 + ipw.y * 0.3) * 0.08 * swy;`);
    };
  }
  function scatter(geo, mat, count, test, opts = {}) {
    const im = new THREE.InstancedMesh(geo, mat, count); let n = 0;
    for (let tries = 0; n < count && tries < count * 6; tries++) {
      let x, z;
      if (opts.near && rand() < opts.nearP) { const t = trees[(rand() * trees.length) | 0], a = rand() * 6.28, d = 2 + rand() * 7; x = t.x + Math.cos(a) * d; z = t.z + Math.sin(a) * d; }
      else { const a = rand() * 6.28, d = Math.sqrt(rand()) * 225; x = Math.cos(a) * d; z = Math.sin(a) * d; }
      const h = heightAt(x, z);
      if (!test(x, z, h)) continue;
      const sc = (opts.s0 || 1) * (0.75 + rand() * 0.6);
      _q.setFromAxisAngle(UP, rand() * 6.28);
      im.setMatrixAt(n, _m.compose(_v.set(x, h - 0.04, z), _q, _s.set(sc, sc * (0.8 + rand() * 0.4), sc)));
      if (opts.tint) { _c.setScalar(0.82 + rand() * 0.3); _c.g *= 0.95 + rand() * 0.1; im.setColorAt(n, _c); }
      n++;
    }
    im.count = n; im.receiveShadow = true; im.castShadow = !!opts.shadow; im.computeBoundingSphere();
    scene.add(im); return im;
  }
  { // Büsche
    const b = new MeshBuilder();
    b.ico(0.6, 0x4e8f3a, { y: 0.4, sy: 0.8, jitter: 0.12 }, 0); b.ico(0.45, 0x5b9c40, { x: 0.45, y: 0.32, z: 0.15, jitter: 0.12 }, 0);
    b.ico(0.42, 0x467f35, { x: -0.38, y: 0.3, z: -0.2, jitter: 0.12 }, 0);
    for (let i = 0; i < 5; i++) b.box(0.08, 0.08, 0.08, 0xd2423b, { x: Math.cos(i * 1.3) * 0.5, y: 0.45 + (i % 2) * 0.2, z: Math.sin(i * 1.3) * 0.5 });
    scatter(b.geometry(), psxMat(), 240, (x, z, h) => h > 1.9 && slopeAt(x, z) < 0.45 && farFromSpawn(x, z, 5), { near: true, nearP: 0.55, shadow: true });
  }
  { // Gras-Büschel
    // Halme als doppelseitige Einzel-Dreiecke (2 Tris/Halm)
    const blade = (b, x, z, w, l, lean, a, c) => {
      const ca = Math.cos(a), sa = Math.sin(a), tx = x + Math.cos(lean) * l * 0.35, tz = z + Math.sin(lean) * l * 0.35;
      const v = [x - ca * w, 0, z - sa * w, x + ca * w, 0, z + sa * w, tx, l, tz];
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([...v, v[0], v[1], v[2], v[6], v[7], v[8], v[3], v[4], v[5]], 3));
      b.add(g, c, { jitter: 0.12 });
    };
    const b = new MeshBuilder();
    for (let i = 0; i < 6; i++) { const a = i * 1.05; blade(b, Math.cos(a) * 0.06, Math.sin(a) * 0.06, 0.035, 0.28 + (i % 3) * 0.1, a, a + 1.57, i % 2 ? 0x6fb146 : 0x8cc455); }
    const gg = b.geometry();
    scatter(gg, swayMat, 4200, (x, z, h) => h > 1.75 && slopeAt(x, z) < 0.6, { tint: true, near: true, nearP: 0.2 });
    // Strandhafer
    const b2 = new MeshBuilder();
    for (let i = 0; i < 5; i++) { const a = i * 1.26; blade(b2, Math.cos(a) * 0.05, Math.sin(a) * 0.05, 0.025, 0.55, a, a + 1.57, 0xc9c27a); }
    scatter(b2.geometry(), swayMat, 500, (x, z, h) => h > 0.6 && h < 1.8, { tint: true });
  }
  { // Blumen
    for (const c of [0xf5e04a, 0xf07ab0, 0xffffff, 0x9a86f2]) {
      const b = new MeshBuilder();
      b.cyl(0.012, 0.015, 0.3, 0x4f8f35, { y: 0.15 }, 3);
      b.ico(0.055, c, { y: 0.31, sy: 0.6, jitter: 0.04 }, 0);
      b.box(0.04, 0.03, 0.04, 0xf5c542, { y: 0.34 });
      scatter(b.geometry(), swayMat, 170, (x, z, h) => h > 2 && slopeAt(x, z) < 0.3 && nz.noise(x * 0.04 + 9, z * 0.04) > -0.1);
    }
  }

  // ---------------------------------------------------------------- Partikel-Pool
  const PMAX = 640;
  const pGeo = (() => { const b = new MeshBuilder(); b.box(1, 1, 1, 0xffffff, { jitter: 0.15 }); return b.geometry(); })();
  const pMesh = new THREE.InstancedMesh(pGeo, psxMat(), PMAX);
  pMesh.frustumCulled = false; pMesh.castShadow = false;
  for (let i = 0; i < PMAX; i++) { pMesh.setMatrixAt(i, ZERO_M); pMesh.setColorAt(i, _c.setRGB(1, 1, 1)); }
  scene.add(pMesh);
  const P = { x: new Float32Array(PMAX), y: new Float32Array(PMAX), z: new Float32Array(PMAX), vx: new Float32Array(PMAX), vy: new Float32Array(PMAX),
    vz: new Float32Array(PMAX), life: new Float32Array(PMAX), max: new Float32Array(PMAX), size: new Float32Array(PMAX), spin: new Float32Array(PMAX), leaf: new Uint8Array(PMAX) };
  let pNext = 0, pAlive = 0;
  function emit(x, y, z, n, colors, speed, size, leaf, spread = 0.1, up = 1) {
    for (let k = 0; k < n; k++) {
      const i = pNext; pNext = (pNext + 1) % PMAX;
      if (P.life[i] <= 0) pAlive++;
      const a = rand() * 6.28, sp = speed * (0.4 + rand() * 0.8);
      P.x[i] = x + (rand() - 0.5) * spread * 2; P.y[i] = y + (rand() - 0.5) * spread; P.z[i] = z + (rand() - 0.5) * spread * 2;
      P.vx[i] = Math.cos(a) * sp; P.vz[i] = Math.sin(a) * sp; P.vy[i] = sp * up * (0.5 + rand());
      P.life[i] = P.max[i] = (leaf ? 1.6 : 0.9) + rand() * 0.8;
      P.size[i] = size * (0.6 + rand() * 0.8); P.spin[i] = (rand() - 0.5) * 14; P.leaf[i] = leaf ? 1 : 0;
      _c.set(colors[(rand() * colors.length) | 0]); pMesh.setColorAt(i, _c);
    }
    pMesh.instanceColor.needsUpdate = true;
  }
  function updateParticles(dt) {
    if (pAlive <= 0) return;
    const fdrag = Math.exp(-2.5 * dt);
    for (let i = 0; i < PMAX; i++) {
      if (P.life[i] <= 0) continue;
      P.life[i] -= dt;
      if (P.life[i] <= 0) { pMesh.setMatrixAt(i, ZERO_M); pAlive--; continue; }
      if (P.leaf[i]) { P.vy[i] -= 2.2 * dt; P.vx[i] *= fdrag; P.vz[i] *= fdrag; P.vy[i] = Math.max(P.vy[i], -1.2); P.vx[i] += Math.sin(P.life[i] * 5 + i) * 1.5 * dt; }
      else P.vy[i] -= G * dt;
      P.x[i] += P.vx[i] * dt; P.y[i] += P.vy[i] * dt; P.z[i] += P.vz[i] * dt;
      const gh = heightAt(P.x[i], P.z[i]) + 0.02;
      if (P.y[i] < gh) { P.y[i] = gh; P.vy[i] *= -0.3; P.vx[i] *= 0.5; P.vz[i] *= 0.5; P.spin[i] *= 0.5; }
      const t = P.life[i], sz = P.size[i] * Math.min(1, t * 2.5);
      _e.set(t * P.spin[i], t * P.spin[i] * 0.7, 0);
      _q.setFromEuler(_e);
      pMesh.setMatrixAt(i, _m.compose(_v.set(P.x[i], P.y[i], P.z[i]), _q, _s.set(sz, P.leaf[i] ? sz * 0.3 : sz, sz)));
    }
    pMesh.instanceMatrix.needsUpdate = true;
  }
  const CHIP_COL = [0xe8c48a, 0xd9ad6e, 0xf0d6a2];

  // ---------------------------------------------------------------- Logs (Stamm-Segmente)
  const MAXLOG = 120;
  const logIM = TREE_TYPES.map(T => {
    const im = new THREE.InstancedMesh(buildLogGeo(T), psxMat(), MAXLOG);
    for (let i = 0; i < MAXLOG; i++) im.setMatrixAt(i, ZERO_M);
    im.frustumCulled = false; im.castShadow = im.receiveShadow = true; scene.add(im); return im;
  });
  const freeSlots = TREE_TYPES.map(() => { const a = []; for (let i = MAXLOG - 1; i >= 0; i--) a.push(i); return a; });
  const logs = [];
  for (let i = 0; i < MAXLOG; i++) logs.push({ alive: false, type: 0, slot: -1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, yawV: 0, pitch: 0,
    roll: 0, rollV: 0, L: 1, r: 0.2, m: 1, grounded: false, asleep: false, sleepT: 0, dirty: true });
  let logCount = 0, wood = 0;
  function spawnLog(type, x, y, z, yaw, pitch, L, r, vx, vy, vz) {
    if (!freeSlots[type].length) return null;
    const lg = logs.find(l => !l.alive); if (!lg) return null;
    Object.assign(lg, { alive: true, type, slot: freeSlots[type].pop(), x, y, z, vx, vy, vz, yaw, yawV: 0, pitch, roll: rand() * 6.28, rollV: 0,
      L, r, m: Math.PI * r * r * L * 600, grounded: false, asleep: false, sleepT: 0, dirty: true });
    logCount++; return lg;
  }
  function removeLog(lg) {
    lg.alive = false; logIM[lg.type].setMatrixAt(lg.slot, ZERO_M); logIM[lg.type].instanceMatrix.needsUpdate = true;
    freeSlots[lg.type].push(lg.slot); lg.slot = -1; logCount--;
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
    // Statische Kollider
    for (let c = 0; c < colliders.length; c++) {
      const k = colliders[c], dx = k.x - lg.x, dz = k.z - lg.z;
      if (Math.abs(dx) > hl + k.r + lg.r || Math.abs(dz) > hl + k.r + lg.r) continue;
      if (lg.y - lg.r > k.top - 0.1) continue;
      const t = clamp(dx * ax + dz * az, -hl, hl), qx = dx - ax * t, qz = dz - az * t, d = Math.hypot(qx, qz), min = k.r + lg.r;
      if (d >= min || d < 1e-5) continue;
      const nx = qx / d, nz_ = qz / d, ov = min - d;
      lg.x -= nx * ov; lg.z -= nz_ * ov;
      const vn = lg.vx * nx + lg.vz * nz_;
      if (vn > 0) { lg.vx -= nx * vn * 1.2; lg.vz -= nz_ * vn * 1.2; lg.yawV += (t / hl) * vn * 0.3; }
    }
    // Insel-Grenze
    const dc = Math.hypot(lg.x, lg.z); if (dc > EXT - 15) { lg.vx -= lg.x / dc * h * 2; lg.vz -= lg.z / dc * h * 2; }
    // Schlafen
    const sp = Math.abs(lg.vx) + Math.abs(lg.vz) + Math.abs(lg.vy) * 0.5 + Math.abs(lg.yawV);
    if (lg.grounded && !swim && sp < 0.07) { lg.sleepT += h; if (lg.sleepT > 0.5) { lg.asleep = true; lg.vx = lg.vy = lg.vz = lg.yawV = lg.rollV = 0; } }
    else lg.sleepT = 0;
    lg.dirty = true;
  }
  // Log-gegen-Log (2D-Segmentabstand + Höhenüberlappung)
  function segClosest(a, b) { // setzt _sa (t auf a), _sb (t auf b), Rückgabe Abstand²
    const ax = Math.sin(a.yaw), az = Math.cos(a.yaw), bx = Math.sin(b.yaw), bz = Math.cos(b.yaw), ha = a.L / 2, hb = b.L / 2;
    const rx = a.x - b.x, rz = a.z - b.z, bdot = ax * bx + az * bz, c = ax * rx + az * rz, f = bx * rx + bz * rz;
    const den = 1 - bdot * bdot;
    let s = den > 1e-4 ? clamp((bdot * f - c) / den, -ha, ha) : 0;
    let t = clamp(bdot * s + f, -hb, hb);
    s = clamp(bdot * t - c, -ha, ha);
    _sa = s; _sb = t;
    const dx = rx + ax * s - bx * t, dz = rz + az * s - bz * t;
    return dx * dx + dz * dz;
  }
  let _sa = 0, _sb = 0;
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
  function fell(t, dx, dz) {
    const T = TREE_TYPES[t.type], gs = treeGeo[t.type];
    t.state = 1; t.col.top = t.y + T.stump * t.s; t.col.base = t.y - 0.3;
    treeIM[t.type].setMatrixAt(t.slot, ZERO_M); treeIM[t.type].instanceMatrix.needsUpdate = true;
    _q.setFromAxisAngle(UP, t.yaw);
    stumpIM[t.type].setMatrixAt(t.slot, _m.compose(_v.set(t.x, t.y, t.z), _q, _s.set(t.s, t.s, t.s))); stumpIM[t.type].instanceMatrix.needsUpdate = true;
    const grp = new THREE.Group();
    const mt = new THREE.Mesh(gs.trunk, psxMat()), mc = new THREE.Mesh(gs.crown, psxMat());
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
      if (lg) emit(lg.x, lg.y, lg.z, 4, CHIP_COL, 1.5, 0.08, false, 0.2);
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
  function updateTrees(dt) {
    for (let i = 0; i < trees.length; i++) {
      const t = trees[i]; if (t.wob <= 0 || t.state !== 0) continue;
      t.wobT += dt; t.wob *= Math.exp(-3.5 * dt); if (t.wob < 0.002) t.wob = 0;
      treeIM[t.type].setMatrixAt(t.slot, treeMatrix(t, t.wob * Math.sin(t.wobT * 22)));
      treeIM[t.type].instanceMatrix.needsUpdate = true;
    }
  }

  // ---------------------------------------------------------------- API
  const COS_CONE = Math.cos(Math.PI / 6);
  function hitTree(origin, dir, reach = 2.2, dmg = 1) {
    let dx = dir.x, dz = dir.z; const dl = Math.hypot(dx, dz);
    const res = { hit: false, kind: null, felled: false, point: null };
    if (dl < 1e-5) return res; dx /= dl; dz /= dl;
    let best = null, bestD = 1e9, bestLog = null, bt = 0;
    for (const t of trees) {
      if (t.state !== 0) continue;
      const vx = t.x - origin.x, vz = t.z - origin.z, d = Math.hypot(vx, vz), surf = d - t.r;
      if (surf > reach || surf >= bestD) continue;
      if (surf > 0.35 && (vx * dx + vz * dz) / d < COS_CONE) continue;
      best = t; bestD = surf;
    }
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
      t.hp -= dmg; t.wob = 0.06; t.wobT = 0; t.wx = fx; t.wz = fz;
      emit(point.x, point.y, point.z, 10, [...CHIP_COL, T.bark], 2.6, 0.07, false, 0.05);
      emit(t.x, t.y + T.crownC * t.s, t.z, 4, T.leaves, 1.2, 0.18, true, T.crownR * t.s * 0.6, 0.2);
      if (t.hp <= 0) fell(t, fx, fz);
      return Object.assign(res, { hit: true, kind: 'tree', felled: t.hp <= 0, point });
    }
    if (bestLog) {
      const lg = bestLog, ax = Math.sin(lg.yaw), az = Math.cos(lg.yaw);
      const point = new THREE.Vector3(lg.x + ax * bt, lg.y + lg.r * 0.8, lg.z + az * bt);
      emit(point.x, point.y, point.z, 12, CHIP_COL, 2.4, 0.07, false, 0.1);
      wake(lg);
      if (lg.L < 1.6) {
        emit(lg.x, lg.y, lg.z, 22, [...CHIP_COL, TREE_TYPES[lg.type].bark], 2.0, 0.12, false, lg.L * 0.4);
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
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i]; if (c.top === Infinity) continue;
      const dx = x - c.x, dz = z - c.z, d2 = dx * dx + dz * dz; if (d2 >= c.r * c.r) continue;
      const y = c.dome ? c.base + (c.top - c.base) * Math.sqrt(1 - d2 / (c.r * c.r)) : c.top;
      if (y <= lim && y > best) best = y;
    }
    const ly = logTopAt(x, z, null, lim);
    if (ly <= lim && ly > best) best = ly;
    return best;
  }

  function collide(pos, radius, height, vel) {
    let n = 0;
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i], dx = pos.x - c.x, dz = pos.z - c.z, min = c.r + radius;
      if (Math.abs(dx) > min || Math.abs(dz) > min) continue;
      const d2 = dx * dx + dz * dz; if (d2 >= min * min) continue;
      const d = Math.sqrt(d2);
      if (c.top !== Infinity) {
        const dd = Math.max(0, d - radius * 0.7), ys = c.dome ? c.base + (c.top - c.base) * Math.sqrt(Math.max(0, 1 - (dd * dd) / (c.r * c.r))) : c.top;
        if (pos.y >= ys - 0.45) continue;
      }
      if (pos.y + height < c.base) continue;
      const nx = d > 1e-5 ? dx / d : 1, nz_ = d > 1e-5 ? dz / d : 0;
      pos.x = c.x + nx * min; pos.z = c.z + nz_ * min; n++;
    }
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
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R, x = Math.cos(a) * d, z = Math.sin(a) * d, h = heightAt(x, z);
      if (h > 1.5) return new THREE.Vector3(x, h, z);
    }
    return spawnPoints[0].clone();
  }

  function update(dt /*, players */) {
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
  }

  function stats() {
    let standing = 0; for (const t of trees) if (t.state === 0) standing++;
    return { trees: standing, logs: logCount, wood };
  }

  return { radius: R, waterLevel: WATER, heightAt, groundAt, collide, hitTree, spawnPoints, randomLandPoint, update, stats, sun,
    sunOffset, trees, logs };
}
