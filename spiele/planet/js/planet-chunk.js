// Chunk-Erzeugung für die Cube-Sphere (ohne THREE) – läuft im Hauptthread und im Worker.
export const N = 32;                 // Zellen pro Chunk-Kante
export const MAXL = 3;               // feinste Quadtree-Stufe
export const G = N << MAXL;          // Zellen pro Würfelseite auf feinster Stufe (256)
export const G1 = G + 1;
const Q = Math.PI / 4;
// Würfelseiten: Normale n, Tangente t, Bitangente b (t × b = n → Dreiecke zeigen nach außen)
export const FACES = [
  [1, 0, 0, 0, 0, -1, 0, 1, 0],
  [-1, 0, 0, 0, 0, 1, 0, 1, 0],
  [0, 1, 0, 1, 0, 0, 0, 0, -1],
  [0, -1, 0, 1, 0, 0, 0, 0, 1],
  [0, 0, 1, 1, 0, 0, 0, 1, 0],
  [0, 0, -1, -1, 0, 0, 0, 1, 0],
];
const NV = (N + 1) * (N + 1), NS = 4 * (N + 1);
export const VERTS = NV + 2 * NS;   // Oberfläche + je Rand: obere Kopie + untere Skirt-Reihe

// Gemeinsamer Indexpuffer: Oberfläche (Diagonale 00–11) + Skirts (beidseitig)
export function terrainIndex() {
  const idx = [];
  for (let b = 0; b < N; b++) for (let a = 0; a < N; a++) {
    const v00 = b * (N + 1) + a, v10 = v00 + 1, v01 = v00 + N + 1, v11 = v01 + 1;
    idx.push(v00, v10, v11, v00, v11, v01);
  }
  for (let e = 0; e < 4; e++) {
    const top = NV + e * 2 * (N + 1), base = top + N + 1;
    for (let i = 1; i <= N; i++) {
      const t0 = top + i - 1, t1 = top + i, s0 = base + i - 1, s1 = base + i;
      idx.push(t0, s0, t1, t1, s0, s1, t0, t1, s0, t1, s1, s0);
    }
  }
  return new Uint16Array(idx);
}

export function createChunkBauer(T, R) {
  const cache = new Float32Array(6 * G1 * G1).fill(NaN);
  const gd = [0, 0, 0];
  function gridDir(f, gi, gj, out) {
    const F = FACES[f];
    const a = Math.tan((gi * 2 / G - 1) * Q), b = Math.tan((gj * 2 / G - 1) * Q);
    const x = F[0] + a * F[3] + b * F[6], y = F[1] + a * F[4] + b * F[7], z = F[2] + a * F[5] + b * F[8];
    const l = 1 / Math.sqrt(x * x + y * y + z * z);
    out[0] = x * l; out[1] = y * l; out[2] = z * l;
    return out;
  }
  function gridH(f, gi, gj) {
    const k = (f * G1 + gj) * G1 + gi;
    let h = cache[k];
    if (h !== h) { gridDir(f, gi, gj, gd); h = cache[k] = T.rawHeight(gd[0], gd[1], gd[2]); }
    return h;
  }
  // Mesh-genaue Höhe (feinste Stufe, gleiche Dreiecksteilung wie im Mesh)
  function heightAt(x, y, z) {
    const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
    let f;
    if (ax >= ay && ax >= az) f = x > 0 ? 0 : 1; else if (ay >= az) f = y > 0 ? 2 : 3; else f = z > 0 ? 4 : 5;
    const F = FACES[f];
    const dn = x * F[0] + y * F[1] + z * F[2];
    if (!(dn > 0)) return 0;
    const a = (x * F[3] + y * F[4] + z * F[5]) / dn, b = (x * F[6] + y * F[7] + z * F[8]) / dn;
    const gu = (Math.atan(a) / Q + 1) * G / 2, gv = (Math.atan(b) / Q + 1) * G / 2;
    let i = Math.floor(gu), j = Math.floor(gv);
    if (i < 0) i = 0; else if (i > G - 1) i = G - 1;
    if (j < 0) j = 0; else if (j > G - 1) j = G - 1;
    const fx = gu - i, fy = gv - j;
    const h00 = gridH(f, i, j), h11 = gridH(f, i + 1, j + 1);
    if (fx >= fy) { const h10 = gridH(f, i + 1, j); return h00 + fx * (h10 - h00) + fy * (h11 - h10); }
    const h01 = gridH(f, i, j + 1); return h00 + fy * (h01 - h00) + fx * (h11 - h01);
  }
  // Höhen eines fertigen Chunks (aus dem Worker) in den Cache übernehmen
  function fuelleCache(f, L, x, y, hh) {
    const s = 1 << (MAXL - L), gx0 = x * N * s, gy0 = y * N * s;
    for (let b = 0; b <= N; b++) for (let a = 0; a <= N; a++) cache[(f * G1 + gy0 + b * s) * G1 + gx0 + a * s] = hh[b * (N + 1) + a];
  }

  const W = N + 3;
  const P = new Float32Array(W * W * 3), HH = new Float32Array(W * W), DD = new Float32Array(W * W * 3);
  const col = [0, 0, 0];
  const eh = new Float32Array(N + 1), dev = new Float32Array(N + 1);
  const EDGE_V = [i => i, i => N * (N + 1) + i, i => i * (N + 1), i => i * (N + 1) + N];
  const EDGE_A = [i => i, i => i, () => 0, () => N], EDGE_B = [() => 0, () => N, i => i, i => i];

  // Baut die Daten eines Chunks. Ergebnis: nur TypedArrays/Zahlen (transferierbar).
  function bau(f, L, x, y) {
    const s = 1 << (MAXL - L);
    const gx0 = x * N * s, gy0 = y * N * s;
    gridDir(f, (x + 0.5) * N * s, (y + 0.5) * N * s, gd);
    const ox = gd[0] * R, oy = gd[1] * R, oz = gd[2] * R;
    let minH = 1e9, maxH = -1e9;
    for (let b = -1; b <= N + 1; b++) for (let a = -1; a <= N + 1; a++) {
      const gi = gx0 + a * s, gj = gy0 + b * s, k = (b + 1) * W + (a + 1);
      gridDir(f, gi, gj, gd);
      const h = (gi >= 0 && gi <= G && gj >= 0 && gj <= G) ? gridH(f, gi, gj) : T.rawHeight(gd[0], gd[1], gd[2]);
      HH[k] = h; DD[k * 3] = gd[0]; DD[k * 3 + 1] = gd[1]; DD[k * 3 + 2] = gd[2];
      const r = R + h;
      P[k * 3] = gd[0] * r; P[k * 3 + 1] = gd[1] * r; P[k * 3 + 2] = gd[2] * r;
      if (a >= 0 && a <= N && b >= 0 && b <= N) { if (h < minH) minH = h; if (h > maxH) maxH = h; }
    }
    const pos = new Float32Array(VERTS * 3), cols = new Uint8Array(VERTS * 3), hh = new Float32Array(NV);
    const kn = new Int8Array(VERTS * 3), nrm = new Float32Array(NV * 3);
    const tiefe = minH < 0.3 ? new Float32Array(NV) : null;
    for (let b = 0; b <= N; b++) for (let a = 0; a <= N; a++) {
      const k = (b + 1) * W + (a + 1), v = b * (N + 1) + a;
      const kx1 = k + 1, kx0 = k - 1, ky1 = k + W, ky0 = k - W;
      const ux = P[kx1 * 3] - P[kx0 * 3], uy = P[kx1 * 3 + 1] - P[kx0 * 3 + 1], uz = P[kx1 * 3 + 2] - P[kx0 * 3 + 2];
      const vx = P[ky1 * 3] - P[ky0 * 3], vy = P[ky1 * 3 + 1] - P[ky0 * 3 + 1], vz = P[ky1 * 3 + 2] - P[ky0 * 3 + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const nl = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz); nx *= nl; ny *= nl; nz *= nl;
      const dx = DD[k * 3], dy = DD[k * 3 + 1], dz = DD[k * 3 + 2], h = HH[k];
      const slope = 1 - (nx * dx + ny * dy + nz * dz);
      pos[v * 3] = P[k * 3] - ox; pos[v * 3 + 1] = P[k * 3 + 1] - oy; pos[v * 3 + 2] = P[k * 3 + 2] - oz;
      nrm[v * 3] = nx; nrm[v * 3 + 1] = ny; nrm[v * 3 + 2] = nz;
      T.color(dx, dy, dz, h, slope * 2.2, col);
      cols[v * 3] = col[0] * 255; cols[v * 3 + 1] = col[1] * 255; cols[v * 3 + 2] = col[2] * 255;
      hh[v] = h;
      if (tiefe) tiefe[v] = -h;
    }
    // Skirts: Tiefe je Randvertex = Abweichung zu feineren/gröberen Nachbarstufen (+Reserve)
    for (let e = 0; e < 4; e++) {
      const ea = EDGE_A[e], eb = EDGE_B[e], vi = EDGE_V[e];
      for (let i = 0; i <= N; i++) { eh[i] = HH[(eb(i) + 1) * W + (ea(i) + 1)]; dev[i] = 0; }
      for (let i = 0; i <= N; i++) {
        for (let m = 2; m <= 8; m *= 2) {           // gröbere Nachbarn
          const i0 = Math.floor(i / m) * m, i1 = Math.min(N, i0 + m);
          if (i0 !== i) { const t = (i - i0) / m; const d = Math.abs(eh[i] - (eh[i0] + (eh[i1] - eh[i0]) * t)); if (d > dev[i]) dev[i] = d; }
        }
        if (i < N && s > 1) {                        // feinere Nachbarn (Mittelpunkte)
          const gi = gx0 + (ea(i) + ea(i + 1)) * s / 2, gj = gy0 + (eb(i) + eb(i + 1)) * s / 2;
          if (gi >= 0 && gi <= G && gj >= 0 && gj <= G) {
            const dm = Math.abs(gridH(f, gi, gj) - (eh[i] + eh[i + 1]) / 2) * 1.5;
            if (dm > dev[i]) dev[i] = dm; if (dm > dev[i + 1]) dev[i + 1] = dm;
          }
        }
      }
      const top = NV + e * 2 * (N + 1), base = top + N + 1;
      for (let i = 0; i <= N; i++) {
        const v = vi(i), tv = top + i, sv = base + i;
        const skirt = 0.25 + dev[i] * 1.3 + (i > 0 ? dev[i - 1] * 0.3 : 0) + (i < N ? dev[i + 1] * 0.3 : 0);
        const px = pos[v * 3] + ox, py = pos[v * 3 + 1] + oy, pz = pos[v * 3 + 2] + oz;
        const l = Math.sqrt(px * px + py * py + pz * pz), k = (l - skirt) / l;
        pos[tv * 3] = pos[v * 3]; pos[tv * 3 + 1] = pos[v * 3 + 1]; pos[tv * 3 + 2] = pos[v * 3 + 2];
        pos[sv * 3] = px * k - ox; pos[sv * 3 + 1] = py * k - oy; pos[sv * 3 + 2] = pz * k - oz;
        for (let c = 0; c < 3; c++) {
          cols[tv * 3 + c] = cols[sv * 3 + c] = cols[v * 3 + c];
          kn[tv * 3 + c] = kn[sv * 3 + c] = Math.round(nrm[v * 3 + c] * 127);
        }
      }
    }
    // Hüllkugel (relativ zum Ursprung)
    let cx = 0, cy = 0, cz = 0;
    for (let v = 0; v < NV; v++) { cx += pos[v * 3]; cy += pos[v * 3 + 1]; cz += pos[v * 3 + 2]; }
    cx /= NV; cy /= NV; cz /= NV;
    let r2 = 0;
    for (let v = 0; v < VERTS; v++) { const dx = pos[v * 3] - cx, dy = pos[v * 3 + 1] - cy, dz = pos[v * 3 + 2] - cz; const d = dx * dx + dy * dy + dz * dz; if (d > r2) r2 = d; }
    const out = { f, L, x, y, ox, oy, oz, minH, maxH, pos, cols, hh, kn, bs: [cx, cy, cz, Math.sqrt(r2)], wpos: null, tiefe: null, widx: null };
    if (tiefe) {
      const wi = [];
      for (let b = 0; b < N; b++) for (let a = 0; a < N; a++) {
        const v00 = b * (N + 1) + a, v10 = v00 + 1, v01 = v00 + N + 1, v11 = v01 + 1;
        if (Math.max(tiefe[v00], tiefe[v10], tiefe[v01], tiefe[v11]) > -0.4) wi.push(v00, v10, v11, v00, v11, v01);
      }
      if (wi.length) {
        const wp = new Float32Array(NV * 3);
        for (let b = 0; b <= N; b++) for (let a = 0; a <= N; a++) {
          const k = (b + 1) * W + (a + 1), v = b * (N + 1) + a;
          wp[v * 3] = DD[k * 3] * R - ox; wp[v * 3 + 1] = DD[k * 3 + 1] * R - oy; wp[v * 3 + 2] = DD[k * 3 + 2] * R - oz;
        }
        out.wpos = wp; out.tiefe = tiefe; out.widx = new Uint16Array(wi);
      }
    }
    return out;
  }
  const transfer = d => [d.pos.buffer, d.cols.buffer, d.hh.buffer, d.kn.buffer].concat(d.wpos ? [d.wpos.buffer, d.tiefe.buffer, d.widx.buffer] : []);
  return { cache, gridDir, gridH, heightAt, fuelleCache, bau, transfer };
}
