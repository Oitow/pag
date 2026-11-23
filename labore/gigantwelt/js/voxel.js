// Gigant-Welt: Voxel-Nahzone – Surface-Nets-Meshing, Edits (Graben/Auftragen/Ebnen), Maske für das Terrain, Speichern/Laden.
// createVoxel(K) -> { VS, CW, PAL, OPS, chunks, dens, raycast, pump(ms, pos), updateMask(pcx, pcz), evict(pos), reset(),
//   applyEdits(ops), scheduleSave(), loadWorld(), refreshStats(), vOffsLen (Getter), vPtr (Getter) }
// Nutzt K: scene, U (setzt uMask/uMaskO), $, Q, veg (editOp/afterEdits/felled, lazy).
import * as THREE from 'three';
import { ss, gn, heightAt, forestAt, FRAG_COMMON } from './welt.js';
import { offsets } from './vegetation.js';
import { createKern, VS, CW } from './voxel-kern.js';

export function createVoxel(K) {
  const { scene, U, $ } = K;
  const kern = createKern({ heightAt, forestAt, ss, gn }), colData = kern.colData;
  const vkey = (x, z) => (x + 60000) * 120000 + (z + 60000);
  const ckey = (x, y, z) => vkey(x, z) * 1024 + (y + 512);
  const OPS = [], opIndex = new Map(), colOpsY = new Map();
  const chunks = new Map(), cols = new Map();
  const PAL = { 2: [.40, .29, .18], 3: [.50, .48, .45], 4: [.80, .72, .52], 5: [.66, .42, .28], 6: [.52, .34, .19], 7: [.32, .45, .14] };

  function dens(x, y, z) {
    const ch = chunks.get(ckey(Math.floor(x / CW), Math.floor(y / CW), Math.floor(z / CW)));
    return ch ? kern.sample(ch, x, y, z) : heightAt(x, z) - y;
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

  // Meshing-Backend: Modul-Worker; scheitert er (z. B. file://), läuft dieselbe Logik im Hauptthread (Warteschlange in pump)
  const vstat = { chunks: 0, tris: 0, ms: 0 }, MAXF = 6;
  let worker = null, fallback = false, nextId = 1; const pend = new Map(), queue = [], genPend = new Set();
  function toFallback() {
    if (fallback) return; fallback = true;
    if (worker) { worker.terminate(); worker = null; }
    queue.length = 0; for (const id of pend.keys()) queue.push(id);
  }
  try {
    worker = new Worker(new URL('./voxel-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = e => onResult(e.data);
    worker.onerror = e => { if (e.preventDefault) e.preventDefault(); toFallback(); };
    worker.onmessageerror = toFallback;
  } catch (e) { worker = null; fallback = true; }
  function post(p) {
    const id = nextId++; p.id = id; pend.set(id, p);
    if (fallback) { queue.push(id); return; }
    if (p.kind === 'gen') worker.postMessage({ t: 'gen', id, cx: p.cx, cy: p.cy, cz: p.cz, ops: (opIndex.get(p.ck) || []).map(i => OPS[i]) });
    else { const d = p.ch.d.slice(), m = p.ch.m.slice(); worker.postMessage({ t: 'mesh', id, cx: p.ch.cx, cy: p.ch.cy, cz: p.ch.cz, d, m }, [d.buffer, m.buffer]); }
  }
  function drain(budget) {
    const t0 = performance.now();
    while (queue.length && performance.now() - t0 < budget) {
      const id = queue.shift(), p = pend.get(id); if (!p) continue;
      const t1 = performance.now(); let ch = p.ch, res = { id };
      if (p.kind === 'gen') { ch = kern.genChunk(p.cx, p.cy, p.cz, (opIndex.get(p.ck) || []).map(i => OPS[i])); res.d = ch.d; res.m = ch.m; }
      const t2 = performance.now(); res.mesh = kern.meshChunk(ch, dens); res.ms = performance.now() - t2;
      onResult(res);
    }
  }
  function onResult(r) {
    const p = pend.get(r.id); if (!p) return; pend.delete(r.id);
    if (r.ms !== undefined) vstat.ms = vstat.ms * .7 + r.ms * .3;
    if (p.kind === 'gen') {
      genPend.delete(p.ck);
      if (!cols.has(vkey(p.cx, p.cz))) return;               // inzwischen ausgeblendet
      if (p.stale) { requestGen(p.cx, p.cy, p.cz, p.ck); return; }  // Edit kam während der Erzeugung
      const ch = { cx: p.cx, cy: p.cy, cz: p.cz, ox: p.cx * CW, oy: p.cy * CW, oz: p.cz * CW, d: r.d, m: r.m, mesh: null, tris: 0 };
      chunks.set(p.ck, ch); applyMesh(ch, r.mesh);
    } else if (chunks.get(p.ck) === p.ch) applyMesh(p.ch, r.mesh);
  }
  const requestGen = (cx, cy, cz, ck) => { genPend.add(ck); post({ kind: 'gen', cx, cy, cz, ck }); };
  const remesh = ch => post({ kind: 'mesh', ck: ckey(ch.cx, ch.cy, ch.cz), ch });

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

  function applyMesh(ch, r) {   // altes Mesh bleibt, bis das neue da ist
    const old = ch.mesh && ch.mesh.geometry;
    if (!r) { if (ch.mesh) { scene.remove(ch.mesh); old.dispose(); ch.mesh = null; } ch.tris = 0; return; }
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
    if (old) old.dispose();
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
    let q = vPtr, first = -1;
    for (; q < vOffs.length; q++) {
      const cx = pcx + vOffs[q][0], cz = pcz + vOffs[q][1], k = vkey(cx, cz);
      let c = cols.get(k);
      if (!c) {
        const cd = colData(cx, cz), list = [];
        for (let y = Math.floor((cd.mn - 5) / CW); y <= Math.floor((cd.mx + 3) / CW); y++) list.push(y);
        const ex = colOpsY.get(k); if (ex) for (const y of ex) if (!list.includes(y)) list.push(y);
        c = { cx, cz, list, done: false }; cols.set(k, c);
      }
      if (!c.done) {
        let all = true, full = false;
        for (const cy of c.list) {
          const ck = ckey(cx, cy, cz); if (chunks.has(ck)) continue;
          all = false; if (genPend.has(ck)) continue;
          if (pend.size >= MAXF) { full = true; break; }
          requestGen(cx, cy, cz, ck);
        }
        if (all) { c.done = true; maskDirty = true; } else if (first < 0) first = q;
        if (full) break;
      }
      if (performance.now() - t0 > budget) { q++; break; }
    }
    vPtr = first < 0 ? q : first;
    if (fallback) drain(Math.max(2, budget - (performance.now() - t0)));
    return vPtr >= vOffs.length;
  }
  function voxEvict(p) {
    const pcx = Math.floor(p.x / CW), pcz = Math.floor(p.z / CW), lim = K.Q.VR / CW + 4;
    for (const [k, c] of cols) {
      if (Math.hypot(c.cx - pcx, c.cz - pcz) <= lim) continue;
      for (const cy of c.list) { const ck = ckey(c.cx, cy, c.cz), ch = chunks.get(ck); if (ch) { if (ch.mesh) { scene.remove(ch.mesh); ch.mesh.geometry.dispose(); } chunks.delete(ck); } }
      cols.delete(k); kern.dropCol(c.cx, c.cz); maskDirty = true;
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
            if (ch) { kern.applyOp(ch, op); touched.add(ch); }
            else if (genPend.has(ck)) { for (const p of pend.values()) if (p.kind === 'gen' && p.ck === ck) p.stale = true; }
            else { const c = cols.get(colK); if (c) { const nc = kern.genChunk(cx, cy, cz, opIndex.get(ck).map(i => OPS[i])); nc.mesh = null; nc.tris = 0; chunks.set(ck, nc); if (!c.list.includes(cy)) c.list.push(cy); touched.add(nc); } }
          }
      K.veg.editOp(op);
    }
    for (const ch of touched) remesh(ch);
    if (fallback) drain(1e9);
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
