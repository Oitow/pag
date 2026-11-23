// Gigant-Welt: Voxel-Kern – reine Logik ohne THREE (Chunk-Erzeugung, Edits, Höhlen, Surface-Nets-Meshing).
// Läuft im Worker (voxel-worker.js) und als Fallback im Hauptthread (voxel.js). Keine Globals außer der Fabrik.
// createKern(W, opt?) -> { colData, dropCol, genChunk(cx,cy,cz,ops), applyOp(ch,op), sample(ch,x,y,z), meshChunk(ch,outer?) }
//   W = { heightAt, forestAt, ss, gn } (aus welt.js); opt.hoehlenAnteil (0..1, Standard .22; 0 = keine Höhlen)
// runJob(kern, job) -> { res, tr }: gemeinsame Auftragsverarbeitung (gen = erzeugen+meshen, mesh = nur meshen).
// Dichte d: >0 fest, <0 Luft, in Metern (±3 begrenzt). Material m: 0 Luft, 1..7 siehe PAL in voxel.js.
export const VS = 0.5, CS = 32, CW = 16, PAD = 2, P = CS + 5, P2 = P * P, P3 = P * P * P;
const Q = P + 2;
const DIRT = [.40, .29, .18], PALK = { 2: DIRT, 3: [.50, .48, .45], 4: [.80, .72, .52], 5: [.66, .42, .28], 6: [.52, .34, .19], 7: [.32, .45, .14] };

// 3D-Wertrauschen -1..1 (für Höhlen), rein über Hash der Gitterpunkte
const h3 = (x, y, z) => { let h = Math.imul(x, 0x8da6b343) ^ Math.imul(y, 0xd8163841) ^ Math.imul(z, 0xcb1ab31f); h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15; return (h & 1023) / 511.5 - 1; };
function n3(x, y, z) {
  const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
  let u = x - X, v = y - Y, w = z - Z; u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v); w = w * w * (3 - 2 * w);
  const a = h3(X, Y, Z), b = h3(X + 1, Y, Z), c = h3(X, Y + 1, Z), d = h3(X + 1, Y + 1, Z), e = h3(X, Y, Z + 1), f = h3(X + 1, Y, Z + 1), g = h3(X, Y + 1, Z + 1), h = h3(X + 1, Y + 1, Z + 1);
  const x0 = a + (b - a) * u, x1 = c + (d - c) * u, x2 = e + (f - e) * u, x3 = g + (h - g) * u, y0 = x0 + (x1 - x0) * v, y1 = x2 + (x3 - x2) * v;
  return y0 + (y1 - y0) * w;
}

export function createKern(W, opt = {}) {
  const { heightAt, forestAt, ss, gn } = W;
  const anteil = opt.hoehlenAnteil ?? .22, rThr = .5 - anteil * 1.2;
  const colCache = new Map(), vkey = (x, z) => (x + 60000) * 120000 + (z + 60000);
  const vidx = new Int32Array(P3), cv = new Float64Array(8);
  const COFF = [0, 1, P, 1 + P, P2, 1 + P2, P + P2, 1 + P + P2];
  const EDG = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];

  // Spaltendaten: Höhe h, Neigung sl, Höhlen-Region rg (alles über Weltkoordinaten -> nahtlos zwischen Chunks)
  function colData(cx, cz) {
    const k = vkey(cx, cz); let c = colCache.get(k); if (c) return c;
    const hq = new Float32Array(Q * Q), h = new Float32Array(P2), sl = new Float32Array(P2), rg = new Float32Array(P2), ox = cx * CW, oz = cz * CW;
    for (let k2 = 0; k2 < Q; k2++) for (let i = 0; i < Q; i++) hq[i + Q * k2] = heightAt(ox + (i - 1 - PAD) * VS, oz + (k2 - 1 - PAD) * VS);
    let mn = 1e9, mx = -1e9, any = false;
    for (let k2 = 0; k2 < P; k2++) for (let i = 0; i < P; i++) {
      const q = i + 1 + Q * (k2 + 1), v = hq[q]; h[i + P * k2] = v; if (v < mn) mn = v; if (v > mx) mx = v;
      sl[i + P * k2] = Math.hypot((hq[q + 1] - hq[q - 1]) / (2 * VS), (hq[q + Q] - hq[q - Q]) / (2 * VS));
      if (anteil > 0) { const r = ss(rThr, rThr + .2, gn((ox + (i - PAD) * VS) / 230 + 31, (oz + (k2 - PAD) * VS) / 230 - 17)); rg[i + P * k2] = r; if (r > .02) any = true; }
    }
    c = { h, sl, rg, mn, mx, caves: any }; colCache.set(k, c);
    if (colCache.size > 400) { let n = 0; for (const key of colCache.keys()) { colCache.delete(key); if (++n > 150) break; } }
    return c;
  }
  const dropCol = (cx, cz) => colCache.delete(vkey(cx, cz));

  // Höhlen: Wurm-Tunnel = Nullstellen zweier 3D-Rauschfelder; nur unter der Oberfläche, an steilen Hängen auch knapp darunter (Eingänge)
  function carve(d, col, ox, oy, oz) {
    const F = 1 / 26;
    for (let k = 0; k < P; k++) for (let i = 0; i < P; i++) {
      const ci = i + P * k, rg = col.rg[ci]; if (rg < .02) continue;
      const h = col.h[ci], dMin = 4 - 3.4 * ss(.55, 1.0, col.sl[ci]), wx = (ox + (i - PAD) * VS) * F, wz = (oz + (k - PAD) * VS) * F;
      for (let j = 0; j < P; j++) {
        const wy = oy + (j - PAD) * VS, dep = h - wy; if (dep < dMin) continue;
        const y = wy * F * 1.5, a = n3(wx, y, wz), b = n3(wx + 41.7, y + 13.1, wz - 27.3);
        const dc = (Math.sqrt(a * a + b * b) - .085) * 17 + (1 - rg) * 6 + 6 * (1 - ss(dMin, dMin + 2, dep));
        const id = i + P * j + P2 * k; if (dc < d[id]) d[id] = dc < -3 ? -3 : dc;
      }
    }
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
  function genChunk(cx, cy, cz, ops) {
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
    if (col.caves) carve(d, col, cx * CW, oy, cz * CW);
    const ch = { cx, cy, cz, ox: cx * CW, oy, oz: cz * CW, d, m, col };
    if (ops) for (const op of ops) applyOp(ch, op);
    return ch;
  }
  function sample(ch, x, y, z) {
    const fx = (x - ch.ox) / VS + PAD, fy = (y - ch.oy) / VS + PAD, fz = (z - ch.oz) / VS + PAD;
    const i = Math.min(P - 2, Math.floor(fx)), j = Math.min(P - 2, Math.floor(fy)), k = Math.min(P - 2, Math.floor(fz));
    const u = fx - i, v = fy - j, w = fz - k, d = ch.d, b = i + P * j + P2 * k;
    const x00 = d[b] + (d[b + 1] - d[b]) * u, x10 = d[b + P] + (d[b + P + 1] - d[b + P]) * u;
    const x01 = d[b + P2] + (d[b + P2 + 1] - d[b + P2]) * u, x11 = d[b + P + P2] + (d[b + P + P2 + 1] - d[b + P + P2]) * u;
    const y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
    return y0 + (y1 - y0) * w;
  }
  // outer(x,y,z): Dichte außerhalb des Chunks (Nachbarn); ohne Angabe die reine Geländehöhe (Worker kennt keine Nachbarn)
  function meshChunk(ch, outer) {
    const d = ch.d, m = ch.m, col0 = ch.col || colData(ch.cx, ch.cz); let pos_ = 0, neg_ = 0;
    for (let k = 1; k <= CS + 3; k++) for (let j = 1; j <= CS + 3; j++) { const b = P * j + P2 * k; for (let i = 1; i <= CS + 3; i++) if (d[b + i] > 0) pos_++; else neg_++; }
    if (pos_ === 0 || neg_ === 0) return null;
    vidx.fill(-1);
    const pos = [], nor = [], col = [], nat = [], ao = [], ff = [];
    let vc = 0;
    const sAt = (fi, fj, fk) => {
      const i = Math.round(fi), j = Math.round(fj), k = Math.round(fk);
      if (i >= 0 && k >= 0 && i < P && k < P) {
        if (j >= 0 && j < P) return d[i + P * j + P2 * k];
        if (!outer) return col0.h[i + P * k] - (ch.oy + (fj - PAD) * VS);
      }
      const x = ch.ox + (fi - PAD) * VS, y = ch.oy + (fj - PAD) * VS, z = ch.oz + (fk - PAD) * VS;
      return outer ? outer(x, y, z) : heightAt(x, z) - y;
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
      let gx = 0, gy = 0, gz = 0, best = -1e9, bm = 2;
      for (let c = 0; c < 8; c++) {
        const s = b + COFF[c], wx = (c & 1) ? px : 1 - px, wy = ((c >> 1) & 1) ? py : 1 - py, wz = ((c >> 2) & 1) ? pz : 1 - pz, w = wx * wy * wz;
        gx += (d[s + 1] - d[s - 1]) * w; gy += (d[s + P] - d[s - P]) * w; gz += (d[s + P2] - d[s - P2]) * w;
        if (cv[c] > best && m[s]) { best = cv[c]; bm = m[s]; }
      }
      const nl = Math.hypot(gx, gy, gz) || 1, nx = -gx / nl, ny = -gy / nl, nz = -gz / nl;
      const fi = i + px, fj = j + py, fk = k + pz;
      let occ = 0;
      for (const s of [2, 4]) { if (sAt(fi + s, fj, fk) > 0) occ++; if (sAt(fi - s, fj, fk) > 0) occ++; if (sAt(fi, fj + s, fk) > 0) occ++; if (sAt(fi, fj - s, fk) > 0) occ++; if (sAt(fi, fj, fk + s) > 0) occ++; if (sAt(fi, fj, fk - s) > 0) occ++; }
      let sky = 0; const bi = fi + nx * 2, bj = fj + ny * 2, bk = fk + nz * 2;
      for (let s = 1; s <= 8; s++) if (sAt(bi, bj + s * 3, bk) > 0) sky++;
      const skyF = 1 - .62 * Math.min(1, sky / 2);
      const lx = (fi - PAD) * VS, ly = (fj - PAD) * VS, lz = (fk - PAD) * VS, wx = ch.ox + lx, wy = ch.oy + ly, wz = ch.oz + lz;
      let c3, na = 0;
      if (bm === 1) { if (sky === 0 && ny > -.2) na = 1; c3 = DIRT; }
      else if (bm === 7) c3 = (sky === 0 && ny > .45) ? PALK[7] : DIRT;
      else c3 = PALK[bm] || DIRT;
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
  return { colData, dropCol, genChunk, applyOp, sample, meshChunk };
}

const meshBufs = r => r ? [r.pos.buffer, r.nor.buffer, r.col.buffer, r.nat.buffer, r.ao.buffer, r.ff.buffer, r.idx.buffer] : [];
// Auftrag: { t:'gen', id, cx, cy, cz, ops } oder { t:'mesh', id, cx, cy, cz, d, m }
export function runJob(kern, job) {
  let ch;
  if (job.t === 'gen') ch = kern.genChunk(job.cx, job.cy, job.cz, job.ops);
  else ch = { cx: job.cx, cy: job.cy, cz: job.cz, ox: job.cx * CW, oy: job.cy * CW, oz: job.cz * CW, d: job.d, m: job.m, col: kern.colData(job.cx, job.cz) };
  const t0 = performance.now(), mesh = kern.meshChunk(ch), ms = performance.now() - t0;
  const res = { id: job.id, mesh, ms };
  if (job.t === 'gen') { res.d = ch.d; res.m = ch.m; return { res, tr: [ch.d.buffer, ch.m.buffer, ...meshBufs(mesh)] }; }
  return { res, tr: meshBufs(mesh) };
}
