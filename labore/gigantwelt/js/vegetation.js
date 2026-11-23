// Gigant-Welt: Bäume (5 Arten aus baeume.js), Büsche, Steine, Bodenpflanzen (bodenpflanzen.js), Gras – Geometrien, Instanz-Meshes, Zellen-Cache, Sichtkegel-Aufbau, Fällen.
// createVegetation(K) -> { treeL, bushL, grassL, layers, felled, materials, stats, pump, pending, evict, updView,
//   rebuildTrees, rebuildBushes, rebuildGrass, editOp(op), afterEdits(), resetLayers(), fellTree(t) }
// Nutzt K: scene, camera, U, Q, yaw, pitch, SH, forceRebuild, vox.scheduleSave (lazy).
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { gn, ss, heightAt, forestRaw, rngFrom, cellSeed } from './welt.js';
import { BAUM_ARTEN, baumGeometrie } from './baeume.js';
import { PFLANZEN_ARTEN, pflanzenGeometrie } from './bodenpflanzen.js';

export function offsets(rc) { const o = []; for (let z = -rc; z <= rc; z++) for (let x = -rc; x <= rc; x++) if (x * x + z * z <= rc * rc) o.push([x, z, Math.hypot(x, z)]); o.sort((a, b) => a[2] - b[2]); return o; }
export const key = (x, z) => (x + 60000) * 120000 + (z + 60000);

export function createVegetation(K) {
  const { scene, camera, U } = K;
  /* ================= ASSET-GEOMETRIEN (prozedural) ================= */
  const tmpC = new THREE.Color();
  const lin = (r, g, b) => { tmpC.setRGB(r, g, b, THREE.SRGBColorSpace); return [tmpC.r, tmpC.g, tmpC.b]; };
  function keep(g) { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k); if (!g.index) { g.deleteAttribute('normal'); g = mergeVertices(g); } return g; }
  function paint(g, fn) {
    const p = g.attributes.position, n = g.attributes.normal, c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const col = fn(p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i)); c[i * 3] = col[0]; c[i * 3 + 1] = col[1]; c[i * 3 + 2] = col[2]; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
  }
  function blob(cx, cy, cz, rx, ry, rz, detail, rng, base, under = .42) {
    let g = new THREE.IcosahedronGeometry(1, detail); g = keep(g);
    const p = g.attributes.position, sd = rng() * 100;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = 1 + .2 * Math.sin(x * 3.1 + sd) * Math.sin(y * 2.7 + sd * 1.3) * Math.sin(z * 3.3 + sd * .7) + (rng() - .5) * .14;
      if (y < 0) y *= .65;
      p.setXYZ(i, cx + x * rx * k, cy + y * ry * k, cz + z * rz * k);
    }
    g.computeVertexNormals();
    const tint = .88 + .24 * rng();
    return paint(g, (x, y, z, nx, ny) => { const ao = under + (1 - under) * Math.min(1, Math.max(0, ny * .5 + .6)); return base.map(v => v * ao * tint); });
  }
  function bushGeo() {
    const rng = rngFrom(5), leaf = lin(.16, .29, .09), parts = [];
    for (let i = 0; i < 4; i++) { const a = i * 1.9, o = i ? .28 : 0, r = .42 + .12 * rng(); parts.push(blob(Math.cos(a) * o, .3 + .1 * rng(), Math.sin(a) * o, r, r * .8, r, 1, rng, leaf, .35)); }
    return mergeGeometries(parts);
  }
  function rockGeo() {
    let g = new THREE.IcosahedronGeometry(1, 1); g = keep(g);
    const p = g.attributes.position, rng = rngFrom(9);
    for (let i = 0; i < p.count; i++) { const k = .8 + .35 * rng(); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * .7, p.getZ(i) * k); }
    g = g.toNonIndexed(); g.computeVertexNormals();
    const gray = lin(.47, .45, .42), moss = lin(.26, .33, .13);
    return paint(g, (x, y, z, nx, ny) => { const m = Math.pow(Math.max(0, ny), 2) * .7; return gray.map((v, i) => v + (moss[i] - v) * m); });
  }
  function grassGeo() {
    const rng = rngFrom(3), pos = [], col = [], nor = [], ah = [], idx = [];
    const dark = lin(.10, .20, .04), tip = lin(.46, .56, .19);
    for (let b = 0; b < 7; b++) {
      const a = rng() * Math.PI * 2, ox = (rng() - .5) * .6, oz = (rng() - .5) * .6, lean = .15 + rng() * .25, la = rng() * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a), hgt = .7 + rng() * .3, base = pos.length / 3;
      for (let k = 0; k < 3; k++) {
        const t = k / 3, w = .045 * (1 - t * .85), bx = ox + Math.cos(la) * lean * t * t, bz = oz + Math.sin(la) * lean * t * t;
        for (const s of [-1, 1]) { pos.push(bx + ca * w * s, t * hgt, bz + sa * w * s); ah.push(t); }
      }
      pos.push(ox + Math.cos(la) * lean, hgt, oz + Math.sin(la) * lean); ah.push(1);
      for (let k = 0; k < 7; k++) { const t = ah[base + k]; col.push(...dark.map((v, i) => v + (tip[i] - v) * t)); nor.push(0, 1, 0); }
      for (let k = 0; k < 2; k++) { const q = base + k * 2; idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); }
      idx.push(base + 4, base + 6, base + 5);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('aH', new THREE.Float32BufferAttribute(ah, 1));
    g.setIndex(idx); return g;
  }

  /* ================= INSTANZ-MESHES ================= */
  const treeMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  treeMat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
  {float hy=clamp(position.y,0.,1.);float ph=instanceMatrix[3][0]*.07+instanceMatrix[3][2]*.05;
  float w=sin(uTime*1.1+ph)+.5*sin(uTime*2.3+ph*1.7);
  transformed.x+=w*hy*hy*.0045;transformed.z+=w*hy*hy*.0025;}`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
  #if NUM_DIR_LIGHTS>0
  {vec3 Vv=normalize(vViewPosition);vec3 Ld=directionalLights[0].direction;vec3 Nn=normalize(normal);
  float leafM=smoothstep(.0,.06,vColor.g-vColor.r);
  float tr=pow(max(-dot(Vv,Ld),0.),4.)*(1.-.6*max(dot(Nn,Ld),0.));
  float rim=pow(1.-max(dot(Nn,Vv),0.),3.)*max(dot(Nn,Ld)+.4,0.);
  outgoingLight+=leafM*(tr*vec3(.62,.50,.12)*vColor.g*1.6+rim*vec3(.10,.09,.03));}
  #endif
  #include <opaque_fragment>`);
  };
  treeMat.customProgramCacheKey = () => 'tree-v2';
  const bushMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const rockMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const grassMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  grassMat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;uniform vec3 uCam;uniform float uGR;attribute float aH;')
      .replace('#include <begin_vertex>', `vec3 transformed=position;
  #ifdef USE_INSTANCING
  vec3 ip=vec3(instanceMatrix[3][0],instanceMatrix[3][1],instanceMatrix[3][2]);
  #else
  vec3 ip=vec3(0.);
  #endif
  float gdist=length(ip.xz-uCam.xz);float fade=1.-smoothstep(uGR*.6,uGR,gdist);
  transformed.y*=fade;
  float t=aH*aH;float wv=sin(uTime*1.6+ip.x*.13+ip.z*.09)*.6+sin(uTime*2.9+ip.x*.5-ip.z*.3)*.22;
  transformed.x+=wv*t*.22;transformed.z+=wv*t*.13;`);
  };
  grassMat.customProgramCacheKey = () => 'grass-v2';

  function mkInst(geo, mat, cap, layer = 0) {
    const m = new THREE.InstancedMesh(geo, mat, cap);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
    m.instanceColor.setUsage(THREE.DynamicDrawUsage);
    m.count = 0; m.frustumCulled = false; m.layers.set(layer); m.cap = cap;
    scene.add(m); return m;
  }
  const ARTEN = Object.keys(BAUM_ARTEN), NA = ARTEN.length, ART = Object.fromEntries(ARTEN.map((k, i) => [k, i]));
  const CAP = [3000, 10000, 25000]; // je Art und LOD -> 5 x 3 = 15 Draw Calls + 5 Schatten-Proxies
  const trees = ARTEN.map(a => [0, 1, 2].map(l => { const m = mkInst(baumGeometrie(a, l), treeMat, CAP[l]); m.receiveShadow = l === 0; return m; }));
  const proxies = ARTEN.map((a, i) => { const m = mkInst(trees[i][0].geometry, treeMat, 800, 1); m.castShadow = true; return m; });
  const bushes = mkInst(bushGeo(), bushMat, 14000); bushes.receiveShadow = true;
  const rocks = mkInst(rockGeo(), rockMat, 6000); rocks.receiveShadow = true;
  const PARTEN = ['farn', 'blumen', 'pilze', 'totholz', 'findling'], PCAP = [6000, 6000, 3000, 1500, 1500];
  const plantMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const plants = PARTEN.map((a, i) => { const m = mkInst(pflanzenGeometrie(a), plantMat, PCAP[i]); m.receiveShadow = true; return m; });
  const grass = mkInst(grassGeo(), grassMat, 26000); grass.receiveShadow = true;
  const TRI = m => (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;

  function writeM(arr, o, x, y, z, rot, sx, sy, sz) {
    const c = Math.cos(rot), s = Math.sin(rot);
    arr[o] = c * sx; arr[o + 1] = 0; arr[o + 2] = -s * sx; arr[o + 3] = 0;
    arr[o + 4] = 0; arr[o + 5] = sy; arr[o + 6] = 0; arr[o + 7] = 0;
    arr[o + 8] = s * sz; arr[o + 9] = 0; arr[o + 10] = c * sz; arr[o + 11] = 0;
    arr[o + 12] = x; arr[o + 13] = y; arr[o + 14] = z; arr[o + 15] = 1;
  }
  function commit(m, n) {
    m.count = n;
    for (const a of [m.instanceMatrix, m.instanceColor]) {
      if (a.clearUpdateRanges) { a.clearUpdateRanges(); a.addUpdateRange(0, Math.max(1, n) * a.itemSize); }
      a.needsUpdate = true;
    }
  }

  function makeLayer(size, radiusFn, gen) {
    const L = { size, cache: new Map(), gen, radiusFn, offs: [], ptr: 0, ccx: 1e9, ccz: 1e9, dirty: true };
    L.reset = () => { L.offs = offsets(Math.ceil(L.radiusFn() / size) + 1); L.ptr = 0; L.ccx = 1e9; };
    return L;
  }
  function heightGrid(x0, z0, size, n) { const g = new Float32Array((n + 1) * (n + 1)), st = size / n; for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) g[j * (n + 1) + i] = heightAt(x0 + i * st, z0 + j * st); return g; }
  function sampleGrid(g, n, st, lx, lz) {
    const fx = Math.min(n - 1e-4, lx / st), fz = Math.min(n - 1e-4, lz / st), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, w = n + 1;
    const a = g[j * w + i], b = g[j * w + i + 1], c = g[(j + 1) * w + i], d = g[(j + 1) * w + i + 1];
    return [a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v, ((b - a) * (1 - v) + (d - c) * v) / st, ((c - a) * (1 - u) + (d - b) * u) / st];
  }

  // Bäume: 128 m Zellen, 8x8 Kandidaten
  const felled = new Set(), fkey = (x, z) => x.toFixed(1) + ',' + z.toFixed(1);
  const treeL = makeLayer(128, () => K.Q.R2, (cx, cz) => {
    const rng = rngFrom(cellSeed(cx, cz, 1)), list = [];
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
      const x = cx * 128 + (i + .15 + .7 * rng()) * 16, z = cz * 128 + (j + .15 + .7 * rng()) * 16, r = rng();
      const dens = forestRaw(x, z);
      if (r > dens * .5 + .004) continue;
      const h = heightAt(x, z); if (h < 2) continue;
      const fd = dens * (1 - ss(900, 1300, h)); if (r > fd * .5 + .004) continue;
      const sl = Math.hypot(heightAt(x + 2, z) - h, heightAt(x, z + 2) - h) / 2; if (sl > .55) continue;
      if (felled.has(fkey(x, z))) continue;
      // Art nach Höhe/Kälte, Waldrand (Wiesen-Nähe) und Tal
      const cold = ss(150, 450, h), edge = 1 - ss(.15, .5, dens), q = rng(), n = gn(x / 700, z / 700);
      let art;
      if (q < cold * .85) art = rng() < .6 ? 'kiefer' : 'mammut';
      else if (q < cold * .85 + edge * .8) art = rng() < .5 ? 'eiche' : 'birke';
      else { const u = rng() + (h < 80 ? .25 : 0) + n * .2; art = u > .75 ? 'urwald' : u > .45 ? 'mammut' : u > .2 ? 'eiche' : 'birke'; }
      const A = BAUM_ARTEN[art], lone = dens < .05;
      let H = A.hoehe[0] + (A.hoehe[1] - A.hoehe[0]) * Math.pow(rng(), 1.3);
      if (lone) H *= 1.2; if (rng() < .03) H *= 1.4;
      const tint = .82 + .3 * rng();
      list.push({ x, y: h - .6, z, H, wf: .85 + .3 * rng(), rot: rng() * 6.283, sp: ART[art], rs: A.stamm, cr: tint * (.94 + .12 * rng()), cg: tint, cb: tint * (.9 + .15 * rng()), rnd: rng() });
    }
    return { trees: list };
  });
  // Büsche + Steine: 32 m Zellen
  const bushL = makeLayer(32, () => K.Q.BR, (cx, cz) => {
    const rng = rngFrom(cellSeed(cx, cz, 2)), x0 = cx * 32, z0 = cz * 32, g = heightGrid(x0, z0, 32, 4);
    const dens = forestRaw(x0 + 16, z0 + 16), b = [], r = [], pl = PARTEN.map(() => []), eds = vegEdits32.get(key(cx, cz));
    const nb = Math.floor(dens * 7 + .8 + rng() * 1.5);
    for (let k = 0; k < nb; k++) {
      const lx = rng() * 32, lz = rng() * 32, [h, dx, dz] = sampleGrid(g, 4, 8, lx, lz);
      if (h < 1 || h > 560 || Math.hypot(dx, dz) > .6 || vegHit(eds, x0 + lx, z0 + lz)) continue;
      const s = (1.2 + rng() * 2.4) * (dens > .3 ? 1.2 : .8), t = .8 + .35 * rng();
      b.push(x0 + lx, h - .3 * s, z0 + lz, rng() * 6.28, s, s * (.7 + .4 * rng()), s, t * .95, t, t * .9);
    }
    const nr = Math.floor(rng() * 1.6 + (g[12] > 200 ? 1.5 : 0));
    for (let k = 0; k < nr; k++) {
      const lx = rng() * 32, lz = rng() * 32, [h] = sampleGrid(g, 4, 8, lx, lz);
      if (h < -2 || vegHit(eds, x0 + lx, z0 + lz)) continue;
      const s = .7 + Math.pow(rng(), 3) * 7, t = .85 + .3 * rng();
      r.push(x0 + lx, h - .3 * s, z0 + lz, rng() * 6.28, s * (.8 + .5 * rng()), s, s * (.8 + .5 * rng()), t, t, t);
    }
    // Bodenpflanzen (echte Meter): Farn/Pilze/Totholz im Wald, Blumen auf Wiesen, Findlinge an Hängen/Höhe
    const wald = dens > .25, wiese = dens < .3;
    const cnt = [wald ? Math.floor(dens * 5 + rng() * 2) : 0, wiese ? Math.floor((1 - dens) * 4 * rng() + .5) : 0, wald ? Math.floor(dens * 2 + rng()) : 0, wald && rng() < dens * .5 ? 1 : 0, Math.floor(rng() * 1.3 + (g[12] > 200 ? .6 : 0))];
    for (let a = 0; a < 5; a++) for (let k = 0; k < cnt[a]; k++) {
      const lx = rng() * 32, lz = rng() * 32, [h, dx, dz] = sampleGrid(g, 4, 8, lx, lz), sl = Math.hypot(dx, dz);
      if (h < 2 || h > 900 || vegHit(eds, x0 + lx, z0 + lz)) continue;
      if (a !== 4 && (sl > .6 || h > 500)) continue;
      if (a === 1 && h > 400) continue;
      const sc = (a === 4 ? .7 + rng() * 1.6 : .8 + rng() * .5), t = .85 + .3 * rng();
      pl[a].push(x0 + lx, h, z0 + lz, rng() * 6.28, sc, sc * (.85 + .3 * rng()), sc, t, t, t);
    }
    return { b: new Float32Array(b), r: new Float32Array(r), p: pl.map(a => new Float32Array(a)) };
  });
  // Gras: 16 m Zellen, Matrizen vorberechnet
  const grassL = makeLayer(16, () => K.Q.GR, (cx, cz) => {
    const rng = rngFrom(cellSeed(cx, cz, 3)), x0 = cx * 16, z0 = cz * 16, g = heightGrid(x0, z0, 16, 4);
    const dens = forestRaw(x0 + 8, z0 + 8), n = Math.floor((150 * (1 - dens) + 45 * dens) * K.Q.gDen);
    const m = new Float32Array(n * 16), c = new Float32Array(n * 3), eds = vegEdits16.get(key(cx, cz)); let k = 0;
    for (let i = 0; i < n; i++) {
      const lx = rng() * 16, lz = rng() * 16, [h, dx, dz] = sampleGrid(g, 4, 4, lx, lz);
      if (h < .8 || h > 600 || Math.hypot(dx, dz) > .55 || vegHit(eds, x0 + lx, z0 + lz)) continue;
      const s = .8 + rng() * .5, hy = (.45 + rng() * .7) * (dens > .4 ? .8 : 1.1);
      writeM(m, k * 16, x0 + lx, h - .05, z0 + lz, rng() * 6.28, s, hy, s);
      const t = .8 + .35 * rng(), y = rng() < .2 ? 1.15 : 1; c[k * 3] = t * y; c[k * 3 + 1] = t; c[k * 3 + 2] = t * .85; k++;
    }
    return { m, c, n: k };
  });
  const layers = [grassL, bushL, treeL];

  function pump(budgetMs, cam) {
    const t0 = performance.now();
    for (const L of layers) {
      const ccx = Math.floor(cam.x / L.size), ccz = Math.floor(cam.z / L.size);
      if (ccx !== L.ccx || ccz !== L.ccz) { L.ccx = ccx; L.ccz = ccz; L.ptr = 0; }
      while (L.ptr < L.offs.length) {
        const [ox, oz] = L.offs[L.ptr], k = key(ccx + ox, ccz + oz);
        if (!L.cache.has(k)) { L.cache.set(k, L.gen(ccx + ox, ccz + oz)); L.dirty = true; }
        L.ptr++;
        if (performance.now() - t0 > budgetMs) return false;
      }
    }
    return true;
  }
  function pending() { let p = 0; for (const L of layers) p += L.offs.length - L.ptr; return p; }
  function evict() {
    for (const L of layers) {
      const lim = L.offs.length * 1.5; if (L.cache.size < lim) continue;
      const rc = Math.ceil(L.radiusFn() / L.size) + 4;
      for (const k of L.cache.keys()) { const x = Math.floor(k / 120000) - 60000, z = (k % 120000) - 60000; if (Math.hypot(x - L.ccx, z - L.ccz) > rc) L.cache.delete(k); }
    }
  }

  const vegEdits16 = new Map(), vegEdits32 = new Map();
  function regVeg(map, size, op) {
    const R = op.r + 1;
    for (let z = Math.floor((op.z - R) / size); z <= Math.floor((op.z + R) / size); z++) for (let x = Math.floor((op.x - R) / size); x <= Math.floor((op.x + R) / size); x++) {
      const k = key(x, z); (map.get(k) || map.set(k, []).get(k)).push(op);
    }
  }
  const vegHit = (list, x, z) => { if (list) for (const o of list) if ((x - o.x) ** 2 + (z - o.z) ** 2 < (o.r + .5) ** 2) return true; return false; };
  function editOp(op) {
    regVeg(vegEdits16, 16, op); regVeg(vegEdits32, 32, op);
      for (let z = Math.floor((op.z - op.r - 1) / 16); z <= Math.floor((op.z + op.r + 1) / 16); z++) for (let x = Math.floor((op.x - op.r - 1) / 16); x <= Math.floor((op.x + op.r + 1) / 16); x++) grassL.cache.delete(key(x, z));
      for (let z = Math.floor((op.z - op.r - 1) / 32); z <= Math.floor((op.z + op.r + 1) / 32); z++) for (let x = Math.floor((op.x - op.r - 1) / 32); x <= Math.floor((op.x + op.r + 1) / 32); x++) bushL.cache.delete(key(x, z));
  }
  function afterEdits() { grassL.ptr = bushL.ptr = 0; grassL.dirty = bushL.dirty = true; }
  function resetLayers() { grassL.cache.clear(); for (const L of layers) L.reset(); }
  function fellTree(t) {
    const cell = treeL.cache.get(key(Math.floor(t.x / 128), Math.floor(t.z / 128)));
    if (cell) { const i = cell.trees.indexOf(t); if (i >= 0) cell.trees.splice(i, 1); }
    felled.add(fkey(t.x, t.z)); treeL.dirty = true; K.forceRebuild = true; K.vox.scheduleSave();
  }

  const view = { x: 0, z: 0, fx: 0, fz: -1, half: 1, all: false };
  function updView() {
    const vf = camera.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
    view.x = camera.position.x; view.z = camera.position.z;
    view.fx = -Math.sin(K.yaw); view.fz = -Math.cos(K.yaw);
    view.half = hf / 2 + .22;
    view.all = K.pitch < -(Math.PI / 2 - vf / 2 - .2);
  }
  function cellVis(cx, cz, size) {
    if (view.all) return true;
    const dx = cx - view.x, dz = cz - view.z, d = Math.hypot(dx, dz), rad = size * .75;
    if (d < rad * 1.5 + 25) return true;
    const cosA = (dx * view.fx + dz * view.fz) / d;
    return Math.acos(Math.max(-1, Math.min(1, cosA))) < view.half + Math.asin(Math.min(1, rad / d));
  }
  const stats = { t: [0, 0, 0], b: 0, r: 0, g: 0, p: 0 };
  function rebuildTrees() {
    const cnt = ARTEN.map(() => [0, 0, 0]), pc = ARTEN.map(() => 0), { R0, R1, R2 } = K.Q, L = treeL;
    for (const [ox, oz] of L.offs) {
      const cx = L.ccx + ox, cz = L.ccz + oz, cell = L.cache.get(key(cx, cz)); if (!cell) continue;
      const ccX = (cx + .5) * 128, ccZ = (cz + .5) * 128, vis = cellVis(ccX, ccZ, 128);
      const near = Math.hypot(ccX - view.x, ccZ - view.z) < K.SH + 140;
      if (!vis && !near) continue;
      for (const t of cell.trees) {
        const d = Math.hypot(t.x - view.x, t.z - view.z), de = d / Math.max(.7, t.H / 60);
        if (near && d < K.SH + 40 && pc[t.sp] < 800) {
          const pm = proxies[t.sp], o = pc[t.sp]++;
          writeM(pm.instanceMatrix.array, o * 16, t.x, t.y, t.z, t.rot, t.H * t.wf, t.H, t.H * t.wf);
        }
        if (!vis || de >= R2) continue;
        const lod = de < R0 ? 0 : de < R1 ? 1 : 2;
        if (lod === 2 && de > R2 * .5 && t.rnd > .55 && t.H < 70) continue;
        const m = trees[t.sp][lod], n = cnt[t.sp][lod]; if (n >= m.cap) continue;
        const f = lod === 2 ? 1 - ss(R2 * .85, R2, de) : 1, H = t.H * f;
        writeM(m.instanceMatrix.array, n * 16, t.x, t.y - (1 - f) * 10, t.z, t.rot, H * t.wf, H, H * t.wf);
        const ca = m.instanceColor.array; ca[n * 3] = t.cr; ca[n * 3 + 1] = t.cg; ca[n * 3 + 2] = t.cb;
        cnt[t.sp][lod] = n + 1;
      }
    }
    for (let s = 0; s < NA; s++) { for (let l = 0; l < 3; l++) commit(trees[s][l], cnt[s][l]); commit(proxies[s], pc[s]); }
    stats.t = [0, 1, 2].map(l => cnt.reduce((a, c) => a + c[l], 0));
  }
  function rebuildBushes() {
    let nb = 0, nr = 0; const np = [0, 0, 0, 0, 0], L = bushL, R = K.Q.BR;
    const fill = (src, m, n) => {
      for (let i = 0; i < src.length; i += 10) {
        if (n >= m.cap) break;
        if (Math.hypot(src[i] - view.x, src[i + 2] - view.z) > R) continue;
        writeM(m.instanceMatrix.array, n * 16, src[i], src[i + 1], src[i + 2], src[i + 3], src[i + 4], src[i + 5], src[i + 6]);
        m.instanceColor.array.set([src[i + 7], src[i + 8], src[i + 9]], n * 3); n++;
      }
      return n;
    };
    for (const [ox, oz] of L.offs) {
      const cx = L.ccx + ox, cz = L.ccz + oz, cell = L.cache.get(key(cx, cz)); if (!cell) continue;
      if (!cellVis((cx + .5) * 32, (cz + .5) * 32, 32)) continue;
      nb = fill(cell.b, bushes, nb); nr = fill(cell.r, rocks, nr);
      for (let a = 0; a < 5; a++) np[a] = fill(cell.p[a], plants[a], np[a]);
    }
    commit(bushes, nb); commit(rocks, nr); plants.forEach((m, a) => commit(m, np[a])); stats.b = nb; stats.r = nr; stats.p = np.reduce((x, y) => x + y, 0);
  }
  function rebuildGrass() {
    let n = 0; const L = grassL, R = K.Q.GR + 12, ma = grass.instanceMatrix.array, ca = grass.instanceColor.array;
    for (const [ox, oz] of L.offs) {
      const cx = L.ccx + ox, cz = L.ccz + oz, ccX = (cx + .5) * 16, ccZ = (cz + .5) * 16;
      if (Math.hypot(ccX - view.x, ccZ - view.z) > R) continue;
      const cell = L.cache.get(key(cx, cz)); if (!cell || !cell.n) continue;
      if (!cellVis(ccX, ccZ, 16)) continue;
      const k = Math.min(cell.n, grass.cap - n); if (k <= 0) break;
      ma.set(cell.m.subarray(0, k * 16), n * 16); ca.set(cell.c.subarray(0, k * 3), n * 3); n += k;
    }
    commit(grass, n); stats.g = n;
  }

  return {
    treeL, bushL, grassL, layers, felled, stats, materials: [treeMat, bushMat, rockMat, plantMat, grassMat],
    pump, pending, evict, updView, rebuildTrees, rebuildBushes, rebuildGrass, editOp, afterEdits, resetLayers, fellTree,
  };
}
