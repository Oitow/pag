// Gigant-Welt: Voxel-Nahzone – Surface-Nets-Meshing, Edits (Graben/Auftragen/Ebnen), Maske für das Terrain, Speichern/Laden.
// createVoxel(K) -> { VS, CW, PAL, OPS, chunks, dens, raycast, pump(ms, pos), updateMask(pcx, pcz), evict(pos), reset(),
//   applyEdits(ops), scheduleSave(), loadWorld(), refreshStats(), vOffsLen (Getter), vPtr (Getter) }
// Nutzt K: scene, U (setzt uMask/uMaskO), $, Q, veg (editOp/afterEdits/felled, lazy).
import * as THREE from 'three';
import { ss, heightAt, forestAt, FRAG_COMMON } from './welt.js';
import { offsets } from './vegetation.js';

export function createVoxel(K) {
  const { scene, U, $ } = K;
  const VS = 0.5, CS = 32, CW = 16, PAD = 2, P = CS + 5, P2 = P * P, P3 = P * P * P;
  const vkey = (x, z) => (x + 60000) * 120000 + (z + 60000);
  const ckey = (x, y, z) => vkey(x, z) * 1024 + (y + 512);
  const OPS = [], opIndex = new Map(), colOpsY = new Map();
  const chunks = new Map(), cols = new Map(), colCache = new Map();
  const PAL = { 2: [.40, .29, .18], 3: [.50, .48, .45], 4: [.80, .72, .52], 5: [.66, .42, .28], 6: [.52, .34, .19], 7: [.32, .45, .14] };
  const DIRT = PAL[2];

  function colData(cx, cz) {
    const k = vkey(cx, cz); let c = colCache.get(k); if (c) return c;
    const h = new Float32Array(P2), sl = new Float32Array(P2), ox = cx * CW, oz = cz * CW; let mn = 1e9, mx = -1e9;
    for (let k2 = 0; k2 < P; k2++) for (let i = 0; i < P; i++) { const v = heightAt(ox + (i - PAD) * VS, oz + (k2 - PAD) * VS); h[i + P * k2] = v; if (v < mn) mn = v; if (v > mx) mx = v; }
    for (let k2 = 0; k2 < P; k2++) for (let i = 0; i < P; i++) {
      const i0 = Math.max(0, i - 1), i1 = Math.min(P - 1, i + 1), k0 = Math.max(0, k2 - 1), k1 = Math.min(P - 1, k2 + 1);
      sl[i + P * k2] = Math.hypot((h[i1 + P * k2] - h[i0 + P * k2]) / ((i1 - i0) * VS), (h[i + P * k1] - h[i + P * k0]) / ((k1 - k0) * VS));
    }
    c = { h, sl, mn, mx }; colCache.set(k, c); return c;
  }
  function applyOp(ch, op) {
    const { t, x, y, z, r, mat, shape } = op, d = ch.d, m = ch.m;
    const ex = r + 1, ey = t === 2 ? r * 1.3 + 1 : r + 1;
    const i0 = Math.max(0, Math.floor((x - ex - ch.ox) / VS) + PAD), i1 = Math.min(P - 1, Math.ceil((x + ex - ch.ox) / VS) + PAD);
    const j0 = Math.max(0, Math.floor((y - ey - ch.oy) / VS) + PAD), j1 = Math.min(P - 1, Math.ceil((y + ey - ch.oy) / VS) + PAD);
    const k0 = Math.max(0, Math.floor((z - ex - ch.oz) / VS) + PAD), k1 = Math.min(P - 1, Math.ceil((z + ex - ch.oz) / VS) + PAD);
    for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const wx = ch.ox + (i - PAD) * VS, wy = ch.oy + (j - PAD) * VS, wz = ch.oz + (k - PAD) * VS, id = i + P * j + P2 * k, old = d[id];
      let nd;
      if (t === 2) {
        const hd = Math.hypot(wx - x, wz - z); if (hd > r || Math.abs(wy - y) > r * 1.3) continue;
        const w = ss(r, r * .7, hd); nd = old + ((y - wy) - old) * w;
        if (nd > 0 && old <= 0) m[id] = mat;
      } else {
        let sdf;
        if (shape === 0) sdf = Math.hypot(wx - x, wy - y, wz - z) - r;
        else { const qx = Math.abs(wx - x) - r, qy = Math.abs(wy - y) - r, qz = Math.abs(wz - z) - r; sdf = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0); }
        if (t === 0) nd = Math.min(old, sdf);
        else { nd = Math.max(old, -sdf); if (-sdf > -VS * 1.5 && -sdf >= old - .01) m[id] = mat; }
      }
      d[id] = nd > 3 ? 3 : nd < -3 ? -3 : nd;
    }
  }
  function genChunk(cx, cy, cz) {
    const col = colData(cx, cz), d = new Float32Array(P3), m = new Uint8Array(P3), oy = cy * CW;
    for (let k = 0; k < P; k++) for (let i = 0; i < P; i++) {
      const ci = i + P * k, h = col.h[ci], s = col.sl[ci];
      for (let j = 0; j < P; j++) {
        const dep = h - (oy + (j - PAD) * VS), id = i + P * j + P2 * k;
        d[id] = dep > 3 ? 3 : dep < -3 ? -3 : dep;
        if (dep <= -VS) continue;
        m[id] = dep < .8 ? 1 : h < 2.5 && dep < 3.5 ? 4 : (s > .7 || h > 600) ? 3 : dep < 4 ? 2 : 3;
      }
    }
    const ch = { cx, cy, cz, ox: cx * CW, oy, oz: cz * CW, d, m, col, mesh: null, tris: 0 };
    const ops = opIndex.get(ckey(cx, cy, cz)); if (ops) for (const oi of ops) applyOp(ch, OPS[oi]);
    return ch;
  }
  function dens(x, y, z) {
    const cx = Math.floor(x / CW), cy = Math.floor(y / CW), cz = Math.floor(z / CW), ch = chunks.get(ckey(cx, cy, cz));
    if (!ch) return heightAt(x, z) - y;
    const fx = (x - ch.ox) / VS + PAD, fy = (y - ch.oy) / VS + PAD, fz = (z - ch.oz) / VS + PAD;
    const i = Math.min(P - 2, Math.floor(fx)), j = Math.min(P - 2, Math.floor(fy)), k = Math.min(P - 2, Math.floor(fz));
    const u = fx - i, v = fy - j, w = fz - k, d = ch.d, b = i + P * j + P2 * k;
    const x00 = d[b] + (d[b + 1] - d[b]) * u, x10 = d[b + P] + (d[b + P + 1] - d[b + P]) * u;
    const x01 = d[b + P2] + (d[b + P2 + 1] - d[b + P2]) * u, x11 = d[b + P + P2] + (d[b + P + P2 + 1] - d[b + P + P2]) * u;
    const y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
    return y0 + (y1 - y0) * w;
  }
  const vidx = new Int32Array(P3);
  const COFF = [0, 1, P, 1 + P, P2, 1 + P2, P + P2, 1 + P + P2];
  const EDG = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float64Array(8);
  function meshChunk(ch) {
    const d = ch.d, m = ch.m; let pos_ = 0, neg_ = 0;
    for (let k = 1; k <= CS + 3; k++) for (let j = 1; j <= CS + 3; j++) { const b = P * j + P2 * k; for (let i = 1; i <= CS + 3; i++) if (d[b + i] > 0) pos_++; else neg_++; }
    if (pos_ === 0 || neg_ === 0) return null;
    vidx.fill(-1);
    const pos = [], nor = [], col = [], nat = [], ao = [], ff = [];
    let vc = 0;
    const sAt = (fi, fj, fk) => {
      const i = Math.round(fi), j = Math.round(fj), k = Math.round(fk);
      if (i >= 0 && k >= 0 && i < P && k < P) {
        if (j >= 0 && j < P) return d[i + P * j + P2 * k];
        const wy = ch.oy + (fj - PAD) * VS, nb = chunks.get(ckey(ch.cx, Math.floor(wy / CW), ch.cz));
        if (!nb) return ch.col.h[i + P * k] - wy;
      }
      return dens(ch.ox + (fi - PAD) * VS, ch.oy + (fj - PAD) * VS, ch.oz + (fk - PAD) * VS);
    };
    for (let k = 1; k <= CS + 2; k++) for (let j = 1; j <= CS + 2; j++) for (let i = 1; i <= CS + 2; i++) {
      const b = i + P * j + P2 * k; let mask = 0;
      for (let c = 0; c < 8; c++) { cv[c] = d[b + COFF[c]]; if (cv[c] > 0) mask |= 1 << c; }
      if (mask === 0 || mask === 255) continue;
      let px = 0, py = 0, pz = 0, n = 0;
      for (const [a, e] of EDG) {
        const va = cv[a], vb = cv[e];
        if ((va > 0) !== (vb > 0)) {
          const t = va / (va - vb);
          px += (a & 1) + t * ((e & 1) - (a & 1)); py += ((a >> 1) & 1) + t * (((e >> 1) & 1) - ((a >> 1) & 1)); pz += ((a >> 2) & 1) + t * (((e >> 2) & 1) - ((a >> 2) & 1)); n++;
        }
      }
      px /= n; py /= n; pz /= n;
      // Normal: trilinear interpolierter Gradient
      let gx = 0, gy = 0, gz = 0, best = -1e9, bm = 2;
      for (let c = 0; c < 8; c++) {
        const s = b + COFF[c], wx = (c & 1) ? px : 1 - px, wy = ((c >> 1) & 1) ? py : 1 - py, wz = ((c >> 2) & 1) ? pz : 1 - pz, w = wx * wy * wz;
        gx += (d[s + 1] - d[s - 1]) * w; gy += (d[s + P] - d[s - P]) * w; gz += (d[s + P2] - d[s - P2]) * w;
        if (cv[c] > best && m[s]) { best = cv[c]; bm = m[s]; }
      }
      let nl = Math.hypot(gx, gy, gz) || 1; const nx = -gx / nl, ny = -gy / nl, nz = -gz / nl;
      const fi = i + px, fj = j + py, fk = k + pz;
      // AO + Himmelsverdeckung
      let occ = 0;
      for (const s of [2, 4]) { if (sAt(fi + s, fj, fk) > 0) occ++; if (sAt(fi - s, fj, fk) > 0) occ++; if (sAt(fi, fj + s, fk) > 0) occ++; if (sAt(fi, fj - s, fk) > 0) occ++; if (sAt(fi, fj, fk + s) > 0) occ++; if (sAt(fi, fj, fk - s) > 0) occ++; }
      let sky = 0; const bi = fi + nx * 2, bj = fj + ny * 2, bk = fk + nz * 2;
      for (let s = 1; s <= 8; s++) if (sAt(bi, bj + s * 3, bk) > 0) sky++;
      const skyF = 1 - .62 * Math.min(1, sky / 2);
      const lx = (fi - PAD) * VS, ly = (fj - PAD) * VS, lz = (fk - PAD) * VS, wx = ch.ox + lx, wy = ch.oy + ly, wz = ch.oz + lz;
      let c3, na = 0;
      if (bm === 1) { if (sky === 0 && ny > -.2) { na = 1; c3 = DIRT; } else c3 = DIRT; }
      else if (bm === 7) c3 = (sky === 0 && ny > .45) ? PAL[7] : DIRT;
      else c3 = PAL[bm] || DIRT;
      vidx[b] = vc++;
      pos.push(lx, ly, lz); nor.push(nx, ny, nz); col.push(c3[0], c3[1], c3[2]); nat.push(na);
      ao.push((1 - .05 * occ) * skyF); ff.push(forestAt(wx, wz, wy));
    }
    const idx = [];
    const quad = (A, B, C, D, s) => { if (A < 0 || B < 0 || C < 0 || D < 0) return; if (s) idx.push(A, B, C, A, C, D); else idx.push(A, C, B, A, D, C); };
    for (let k = PAD; k <= CS + 1; k++) for (let j = PAD; j <= CS + 1; j++) for (let i = PAD; i <= CS + 1; i++) {
      const s = i + P * j + P2 * k, s0 = d[s] > 0;
      if (s0 !== (d[s + 1] > 0)) quad(vidx[s - P - P2], vidx[s - P2], vidx[s], vidx[s - P], s0);
      if (s0 !== (d[s + P] > 0)) quad(vidx[s - 1 - P2], vidx[s - 1], vidx[s], vidx[s - P2], s0);
      if (s0 !== (d[s + P2] > 0)) quad(vidx[s - 1 - P], vidx[s - P], vidx[s], vidx[s - 1], s0);
    }
    if (!idx.length) return null;
    return { pos: new Float32Array(pos), nor: new Float32Array(nor), col: new Float32Array(col), nat: new Float32Array(nat), ao: new Float32Array(ao), ff: new Float32Array(ff), idx: new Uint32Array(idx) };
  }
  function raycast(o, dir, maxD) {
    for (let t = .3; t < maxD; t += .25) {
      if (dens(o.x + dir.x * t, o.y + dir.y * t, o.z + dir.z * t) > 0) {
        let a = t - .25, b = t;
        for (let q = 0; q < 6; q++) { const mm = (a + b) / 2; if (dens(o.x + dir.x * mm, o.y + dir.y * mm, o.z + dir.z * mm) > 0) b = mm; else a = mm; }
        return { x: o.x + dir.x * b, y: o.y + dir.y * b, z: o.z + dir.z * b, t: b };
      }
    }
    return null;
  }
  /* VOXEL CORE END */

  const voxMat = new THREE.MeshLambertMaterial();
  voxMat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aCol;attribute float aNat;attribute float aAO;attribute float aF;varying vec3 vW;varying vec3 vNw;varying vec3 vCol;varying float vNat;varying float vAO;varying float vF;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvW=(modelMatrix*vec4(transformed,1.)).xyz;vNw=normal;vCol=aCol;vNat=aNat;vAO=aAO;vF=aF;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;varying vec3 vNw;varying vec3 vCol;varying float vNat;varying float vAO;varying float vF;\n' + FRAG_COMMON)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
  vec3 n=normalize(vNw);float tDist=length(vW.xz-uCam.xz);
  vec3 col=vCol*(.86+.28*vn(vW.xz*1.7+vW.y*1.3));
  if(vNat>.01)col=mix(col,terrCol(vW,n,vF,tDist),vNat);
  col*=vAO;
  vec4 diffuseColor=vec4(pow(col,vec3(2.2)),1.);`);
  };
  voxMat.customProgramCacheKey = () => 'vox-v1';

  const vstat = { chunks: 0, tris: 0, ms: 0 };
  function remesh(ch) {
    const t0 = performance.now(), r = meshChunk(ch);
    vstat.ms = vstat.ms * .7 + (performance.now() - t0) * .3;
    if (ch.mesh) { ch.mesh.geometry.dispose(); }
    if (!r) { if (ch.mesh) { scene.remove(ch.mesh); ch.mesh = null; } ch.tris = 0; return; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(r.pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(r.nor, 3));
    g.setAttribute('aCol', new THREE.BufferAttribute(r.col, 3));
    g.setAttribute('aNat', new THREE.BufferAttribute(r.nat, 1));
    g.setAttribute('aAO', new THREE.BufferAttribute(r.ao, 1));
    g.setAttribute('aF', new THREE.BufferAttribute(r.ff, 1));
    g.setIndex(new THREE.BufferAttribute(r.idx, 1));
    g.computeBoundingSphere();
    if (ch.mesh) ch.mesh.geometry = g;
    else { ch.mesh = new THREE.Mesh(g, voxMat); ch.mesh.position.set(ch.ox, ch.oy, ch.oz); ch.mesh.castShadow = ch.mesh.receiveShadow = true; scene.add(ch.mesh); }
    ch.tris = r.idx.length / 3;
  }
  // Maske: welche 16m-Spalten sind voxelisiert -> Terrain dort ausblenden
  const MASK = 32, maskData = new Uint8Array(MASK * MASK);
  const maskTex = new THREE.DataTexture(maskData, MASK, MASK, THREE.RedFormat, THREE.UnsignedByteType);
  maskTex.magFilter = maskTex.minFilter = THREE.NearestFilter; maskTex.needsUpdate = true;
  U.uMask = { value: maskTex }; U.uMaskO = { value: new THREE.Vector2(-1e6, -1e6) };
  let maskDirty = true, maskOX = 1e9, maskOZ = 1e9, vOffs = [], vPtr = 0, vPcx = 1e9, vPcz = 1e9;
  function vReset() { const rc = Math.ceil(K.Q.VR / CW) + 1; vOffs = offsets(rc).filter(o => o[2] * CW <= K.Q.VR + CW); vPtr = 0; vPcx = 1e9; }
  function updateMask(pcx, pcz) {
    const ox = pcx - MASK / 2, oz = pcz - MASK / 2;
    if (!maskDirty && ox === maskOX && oz === maskOZ) return;
    maskOX = ox; maskOZ = oz; maskDirty = false;
    for (let j = 0; j < MASK; j++) for (let i = 0; i < MASK; i++) { const c = cols.get(vkey(ox + i, oz + j)); maskData[i + j * MASK] = c && c.done ? 255 : 0; }
    maskTex.needsUpdate = true; U.uMaskO.value.set(ox * CW, oz * CW);
  }
  function voxPump(budget, p) {
    const t0 = performance.now(), pcx = Math.floor(p.x / CW), pcz = Math.floor(p.z / CW);
    if (pcx !== vPcx || pcz !== vPcz) { vPcx = pcx; vPcz = pcz; vPtr = 0; }
    while (vPtr < vOffs.length) {
      const cx = pcx + vOffs[vPtr][0], cz = pcz + vOffs[vPtr][1], k = vkey(cx, cz);
      let c = cols.get(k);
      if (!c) {
        const cd = colData(cx, cz), list = [];
        for (let y = Math.floor((cd.mn - 5) / CW); y <= Math.floor((cd.mx + 3) / CW); y++) list.push(y);
        const ex = colOpsY.get(k); if (ex) for (const y of ex) if (!list.includes(y)) list.push(y);
        c = { cx, cz, list, done: false }; cols.set(k, c);
      }
      if (!c.done) {
        for (const cy of c.list) {
          const ck = ckey(cx, cy, cz);
          if (!chunks.has(ck)) { const ch = genChunk(cx, cy, cz); chunks.set(ck, ch); remesh(ch); if (performance.now() - t0 > budget) return false; }
        }
        c.done = true; maskDirty = true;
      }
      vPtr++;
    }
    return true;
  }
  function voxEvict(p) {
    const pcx = Math.floor(p.x / CW), pcz = Math.floor(p.z / CW), lim = K.Q.VR / CW + 4;
    for (const [k, c] of cols) {
      if (Math.hypot(c.cx - pcx, c.cz - pcz) <= lim) continue;
      for (const cy of c.list) { const ck = ckey(c.cx, cy, c.cz), ch = chunks.get(ck); if (ch) { if (ch.mesh) { scene.remove(ch.mesh); ch.mesh.geometry.dispose(); } chunks.delete(ck); } }
      cols.delete(k); colCache.delete(k); maskDirty = true;
    }
  }
  function applyEdits(list) {
    const touched = new Set();
    for (const op of list) {
      OPS.push(op); const oi = OPS.length - 1, ex = op.r + 1.5, ey = op.t === 2 ? op.r * 1.3 + 1.5 : op.r + 1.5;
      for (let cz = Math.floor((op.z - ex) / CW); cz <= Math.floor((op.z + ex) / CW); cz++)
        for (let cx = Math.floor((op.x - ex) / CW); cx <= Math.floor((op.x + ex) / CW); cx++)
          for (let cy = Math.floor((op.y - ey) / CW); cy <= Math.floor((op.y + ey) / CW); cy++) {
            const ck = ckey(cx, cy, cz), colK = vkey(cx, cz);
            (opIndex.get(ck) || opIndex.set(ck, []).get(ck)).push(oi);
            (colOpsY.get(colK) || colOpsY.set(colK, new Set()).get(colK)).add(cy);
            const ch = chunks.get(ck);
            if (ch) { applyOp(ch, op); touched.add(ch); }
            else { const c = cols.get(colK); if (c) { const nc = genChunk(cx, cy, cz); chunks.set(ck, nc); if (!c.list.includes(cy)) c.list.push(cy); touched.add(nc); } }
          }
      K.veg.editOp(op);
    }
    for (const ch of touched) remesh(ch);
    K.veg.afterEdits();
    scheduleSave();
  }
  /* Speichern/Laden (localStorage) */
  const SAVE_KEY = 'gigantwelt-labor-v1';
  let saveT = 0;
  const rd = v => Math.round(v * 100) / 100;
  function scheduleSave() { if (!saveT) saveT = setTimeout(saveWorld, 1500); }
  function saveWorld() {
    saveT = 0;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ ops: OPS.map(o => ({ t: o.t, x: rd(o.x), y: rd(o.y), z: rd(o.z), r: rd(o.r), mat: o.mat, shape: o.shape })), felled: [...K.veg.felled] })); } catch (e) { }
  }
  function loadWorld() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (!d) return;
      if (Array.isArray(d.felled)) for (const k of d.felled) if (typeof k === 'string') K.veg.felled.add(k);
      if (Array.isArray(d.ops) && d.ops.length) applyEdits(d.ops.filter(o => o && isFinite(o.x + o.y + o.z + o.r)));
    } catch (e) { }
  }
  $('bNew').onclick = () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } location.reload(); };

  function refreshStats() {
    vstat.chunks = 0; vstat.tris = 0;
    for (const ch of chunks.values()) if (ch.mesh) { vstat.chunks++; vstat.tris += ch.tris; }
    return vstat;
  }
  return {
    VS, CW, PAL, OPS, chunks, dens, raycast, pump: voxPump, updateMask, evict: voxEvict, reset: vReset,
    applyEdits, scheduleSave, loadWorld, refreshStats, vstat,
    get vOffsLen() { return vOffs.length; }, get vPtr() { return vPtr; },
  };
}
