/**
 * @modul    voxel-kugel
 * @zweck    Voxel-Nahzone auf einem Kugelplaneten: festes Gitter auf der Würfelkugel (Winkelzellen × Radius-Stufen), Dichte aus Höhenfunktion + Eingriffen (Graben/Füllen als Kugeln), Stoff je Voxel, Surface-Nets-Netz – Tunnel, Überhänge, Höhlen
 * @api      createVoxelKugel({ radius, zelle = 0.5, n = 32, saeule(dx,dy,dz) -> { h, … }, stoff(saeule, tiefe, x, y, z) -> 1…255 }) -> { zelle, n, R, schluessel(f,ci,cj,ck), zerlege(key), zelleVon(x,y,z) -> { f, i, j, k } (Bruchteile), chunkVon(x,y,z) -> key, chunksFuerOp(op) -> [key], punkt(f,i,j,k,out?) -> out, erzeuge(key, ops) -> daten, netz(daten, { rand }) -> netz, dichteAn(daten, x,y,z) -> m (> 0 fest, NaN = außerhalb), stoffAn(daten, x,y,z) -> id }, Eingriff = { typ: 'weg'|'fest', x, y, z, r, stoff? }
 * @beispiel
 *   import { createVoxelKugel } from '../../engine/world/voxel-kugel.js';
 *   const vk = createVoxelKugel({ radius: 100_000, saeule: (x, y, z) => ({ h: 12 }), stoff: (s, tiefe) => (tiefe < 1 ? 1 : 2) });
 *   const op = { typ: 'weg', x: 0, y: 100_012, z: 0, r: 1.2 };
 *   const key = vk.chunkVon(op.x, op.y, op.z);
 *   const netz = vk.netz(vk.erzeuge(key, [op]));   // netz.pos relativ zu netz.ursprung (double)
 * @tags     voxel, graben, tunnel, hoehle, planet, kugel, surface-nets, welt
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */

const GRENZE = 4;   // Dichte wird auf ±GRENZE m begrenzt (Eingriffe weiter weg ändern nichts mehr)
const ACHSEN = [[0, 1], [1, 2], [0, 2]];

/** Richtung (ungenormt) aus Würfelseite f und Würfelkoordinaten u, v (tan des Winkels). */
function wuerfel(f, u, v, out) {
  switch (f) {
    case 0: out[0] = 1; out[1] = v; out[2] = u; break;
    case 1: out[0] = -1; out[1] = v; out[2] = u; break;
    case 2: out[0] = u; out[1] = 1; out[2] = v; break;
    case 3: out[0] = u; out[1] = -1; out[2] = v; break;
    case 4: out[0] = u; out[1] = v; out[2] = 1; break;
    default: out[0] = u; out[1] = v; out[2] = -1;
  }
  const l = Math.hypot(out[0], out[1], out[2]);
  out[0] /= l; out[1] /= l; out[2] /= l;
  return out;
}

export function createVoxelKugel({ radius, zelle = 0.5, n = 32, saeule, stoff }) {
  const R = radius, dA = zelle / R, PAD = 2, S = n + 5, S2 = S * S, S3 = S2 * S;
  const schluessel = (f, ci, cj, ck) => `${f}:${ci}:${cj}:${ck}`;
  const zerlege = (key) => key.split(':').map(Number);
  const t3 = [0, 0, 0];

  /** Bruchteil-Gitterkoordinaten eines Weltpunkts (Seite f aus der größten Achse). */
  function zelleVon(x, y, z) {
    const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
    let f, u, v, m;
    if (ax >= ay && ax >= az) { f = x > 0 ? 0 : 1; u = z / ax; v = y / ax; m = ax; }
    else if (ay >= az) { f = y > 0 ? 2 : 3; u = x / ay; v = z / ay; m = ay; }
    else { f = z > 0 ? 4 : 5; u = x / az; v = y / az; m = az; }
    return { f, i: Math.atan(u) / dA, j: Math.atan(v) / dA, k: (Math.hypot(x, y, z) - R) / zelle };
  }
  const chunkVon = (x, y, z) => {
    const c = zelleVon(x, y, z);
    return schluessel(c.f, Math.floor(c.i / n), Math.floor(c.j / n), Math.floor(c.k / n));
  };
  /** Weltpunkt eines (Bruchteil-)Gitterpunkts. */
  function punkt(f, i, j, k, out = [0, 0, 0]) {
    wuerfel(f, Math.tan(i * dA), Math.tan(j * dA), out);
    const r = R + k * zelle;
    out[0] *= r; out[1] *= r; out[2] *= r;
    return out;
  }
  /** Alle Chunks, deren Probenbereich die Op-Kugel (+ Rand) berührt. */
  function chunksFuerOp(op) {
    const c = zelleVon(op.x, op.y, op.z), w = (op.r + 1) / zelle, keys = [];
    for (let ci = Math.floor((c.i - w - PAD) / n); ci <= Math.floor((c.i + w + PAD) / n); ci++)
      for (let cj = Math.floor((c.j - w - PAD) / n); cj <= Math.floor((c.j + w + PAD) / n); cj++)
        for (let ck = Math.floor((c.k - w - PAD) / n); ck <= Math.floor((c.k + w + PAD) / n); ck++) keys.push(schluessel(c.f, ci, cj, ck));
    return keys;
  }

  /** Dichte + Stoff eines Chunks (Proben S³, Rand PAD), Eingriffe in Reihenfolge angewandt. */
  function erzeuge(key, ops = []) {
    const [f, ci, cj, ck] = zerlege(key);
    const i0 = ci * n - PAD, j0 = cj * n - PAD, k0 = ck * n - PAD;
    const dichte = new Float32Array(S3), sto = new Uint8Array(S3), lage = new Float64Array(S3 * 3);
    const hS = new Float64Array(S2);
    let hMin = Infinity, hMax = -Infinity;
    const r0 = R + k0 * zelle;
    for (let b = 0; b < S; b++) for (let a = 0; a < S; a++) {
      const d = wuerfel(f, Math.tan((i0 + a) * dA), Math.tan((j0 + b) * dA), t3);
      const s = saeule(d[0], d[1], d[2]), h = s.h;
      hS[a + S * b] = h; if (h < hMin) hMin = h; if (h > hMax) hMax = h;
      for (let c = 0; c < S; c++) {
        const id = a + S * c + S2 * b, r = r0 + c * zelle, hoch = r - R, tiefe = h - hoch;
        lage[id * 3] = d[0] * r; lage[id * 3 + 1] = d[1] * r; lage[id * 3 + 2] = d[2] * r;
        dichte[id] = Math.max(-GRENZE, Math.min(GRENZE, tiefe));
        sto[id] = tiefe > -0.01 ? stoff(s, Math.max(0, tiefe), lage[id * 3], lage[id * 3 + 1], lage[id * 3 + 2]) : 0;
      }
    }
    for (const op of ops) {
      const rr = (op.r + GRENZE) ** 2;
      for (let id = 0; id < S3; id++) {
        const dx = lage[id * 3] - op.x, dy = lage[id * 3 + 1] - op.y, dz = lage[id * 3 + 2] - op.z, q = dx * dx + dy * dy + dz * dz;
        if (q > rr) continue;
        const ab = Math.sqrt(q) - op.r;   // < 0 = in der Kugel
        if (op.typ === 'weg') { if (ab < dichte[id]) { dichte[id] = Math.max(-GRENZE, ab); if (ab < 0) sto[id] = 0; } }
        else if (-ab > dichte[id]) { dichte[id] = Math.min(GRENZE, -ab); if (ab < 0.5) sto[id] = op.stoff || sto[id] || 1; }
      }
    }
    return { key, f, ci, cj, ck, i0, j0, k0, dichte, stoff: sto, hS, hMin, hMax, ursprung: punkt(f, ci * n + n / 2, cj * n + n / 2, ck * n + n / 2) };
  }

  const idx = (a, c, b) => a + S * c + S2 * b;   // a = i, c = k (radial), b = j

  /** Surface Nets: Ecken je Zelle, Ecke an Kanten-Nullstellen gemittelt, Normale aus dem Dichte-Gradienten. rand = +1 Ring außen (Überlappung zum Höhenfeld). */
  function netz(D, { rand = false } = {}) {
    const { f, i0, j0, k0, dichte, stoff: sto, hS, ursprung } = D;
    const ecke = new Int32Array(S3).fill(-1);
    const pos = [], nor = [], st = [], tie = [], index = [];
    const p = [0, 0, 0];
    // Gitterachsen am Chunk-Mittelpunkt (Welt) für die Normalen
    const m = [i0 + PAD + n / 2, j0 + PAD + n / 2, k0 + PAD + n / 2];
    const pa = punkt(f, m[0] + 1, m[1], m[2], [0, 0, 0]), pb = punkt(f, m[0], m[1] + 1, m[2], [0, 0, 0]), pc = punkt(f, m[0], m[1], m[2] + 1, [0, 0, 0]);
    const ex = [pa[0] - ursprung[0], pa[1] - ursprung[1], pa[2] - ursprung[2]], ey = [pb[0] - ursprung[0], pb[1] - ursprung[1], pb[2] - ursprung[2]], ez = [pc[0] - ursprung[0], pc[1] - ursprung[1], pc[2] - ursprung[2]];
    for (const e of [ex, ey, ez]) { const l = Math.hypot(e[0], e[1], e[2]); e[0] /= l * l; e[1] /= l * l; e[2] /= l * l; }
    // Händigkeit der Gitterachsen (i, j, Radius) ist je Würfelseite verschieden → Wicklung danach drehen
    const spiegel = (ex[1] * ey[2] - ex[2] * ey[1]) * ez[0] + (ex[2] * ey[0] - ex[0] * ey[2]) * ez[1] + (ex[0] * ey[1] - ex[1] * ey[0]) * ez[2] > 0;
    for (let b = 0; b < S - 1; b++) for (let c = 0; c < S - 1; c++) for (let a = 0; a < S - 1; a++) {
      let maske = 0;
      for (let q = 0; q < 8; q++) if (dichte[idx(a + (q & 1), c + ((q >> 1) & 1), b + (q >> 2))] > 0) maske |= 1 << q;
      if (maske === 0 || maske === 255) continue;
      let sx = 0, sy = 0, sz = 0, z = 0, besteD = Infinity, besteS = 0;
      for (let q = 0; q < 8; q++) {
        const id = idx(a + (q & 1), c + ((q >> 1) & 1), b + (q >> 2)), dq = dichte[id];
        if (dq > 0 && dq < besteD && sto[id]) { besteD = dq; besteS = sto[id]; }
        for (let bit = 0; bit < 3; bit++) {
          if (q & (1 << bit)) continue;
          const q2 = q | (1 << bit), d2 = dichte[idx(a + (q2 & 1), c + ((q2 >> 1) & 1), b + (q2 >> 2))];
          if ((dq > 0) === (d2 > 0)) continue;
          const t = dq / (dq - d2);
          sx += (q & 1) + (bit === 0 ? t : 0); sy += ((q >> 1) & 1) + (bit === 1 ? t : 0); sz += (q >> 2) + (bit === 2 ? t : 0); z++;
        }
      }
      const fa = a + sx / z, fc = c + sy / z, fb = b + sz / z;
      punkt(f, i0 + fa, j0 + fb, k0 + fc, p);
      ecke[idx(a, c, b)] = pos.length / 3;
      pos.push(p[0] - ursprung[0], p[1] - ursprung[1], p[2] - ursprung[2]);
      // Gradient (zentrale Differenzen an der nächsten Probe) → Weltnormale (zeigt in die Luft)
      const ga = Math.min(S - 2, Math.max(1, Math.round(fa))), gc = Math.min(S - 2, Math.max(1, Math.round(fc))), gb = Math.min(S - 2, Math.max(1, Math.round(fb)));
      const gx = dichte[idx(ga + 1, gc, gb)] - dichte[idx(ga - 1, gc, gb)], gy = dichte[idx(ga, gc, gb + 1)] - dichte[idx(ga, gc, gb - 1)], gz = dichte[idx(ga, gc + 1, gb)] - dichte[idx(ga, gc - 1, gb)];
      const nx = -(gx * ex[0] + gy * ey[0] + gz * ez[0]), ny = -(gx * ex[1] + gy * ey[1] + gz * ez[1]), nz = -(gx * ex[2] + gy * ey[2] + gz * ez[2]);
      const nl = Math.hypot(nx, ny, nz) || 1;
      nor.push(nx / nl, ny / nl, nz / nl);
      st.push(besteS);
      tie.push(hS[Math.min(S - 1, Math.round(fa)) + S * Math.min(S - 1, Math.round(fb))] - (k0 + fc) * zelle);
    }
    // Vierecke an Kanten mit Vorzeichenwechsel; eigene Kanten = Basis in PAD…PAD+n-1 (rand: einen Ring mehr)
    const lo = rand ? PAD - 1 : PAD, hi = rand ? PAD + n : PAD + n - 1;
    const v = [0, 0, 0, 0];
    for (let b = lo; b <= hi; b++) for (let c = lo; c <= hi; c++) for (let a = lo; a <= hi; a++) {
      const d0 = dichte[idx(a, c, b)] > 0;
      for (let ax = 0; ax < 3; ax++) {
        const da = ax === 0 ? 1 : 0, dc = ax === 1 ? 1 : 0, db = ax === 2 ? 1 : 0;
        const d1 = dichte[idx(a + da, c + dc, b + db)] > 0;
        if (d0 === d1) continue;
        // die vier Zellen um die Kante: in den beiden anderen Achsen −1/0
        const [u, w] = ACHSEN[ax === 0 ? 1 : ax === 1 ? 2 : 0];
        let ok = true;
        for (let q = 0; q < 4; q++) {
          const o = [0, 0, 0]; o[u] = -(q & 1); o[w] = -((q >> 1) & 1);
          // o in (a, c, b)-Reihenfolge: Achse 0 = a, 1 = c, 2 = b
          const e = ecke[idx(a + o[0], c + o[1], b + o[2])];
          if (e < 0) { ok = false; break; }
          v[q] = e;
        }
        if (!ok) continue;
        // Wicklung so, dass die Fläche zur Luft zeigt
        if ((d0 === (ax !== 1)) !== spiegel) index.push(v[0], v[1], v[3], v[0], v[3], v[2]);
        else index.push(v[0], v[3], v[1], v[0], v[2], v[3]);
      }
    }
    return {
      key: D.key, ursprung, pos: new Float32Array(pos), nor: new Float32Array(nor), stoff: new Uint8Array(st), tiefe: new Float32Array(tie),
      index: pos.length / 3 > 65535 ? new Uint32Array(index) : new Uint16Array(index),
    };
  }

  /** Trilinear: Dichte an einem Weltpunkt (NaN, wenn außerhalb der Proben). */
  function lokal(D, x, y, z) {
    const g = zelleVon(x, y, z);
    if (g.f !== D.f) return null;
    const a = g.i - D.i0, b = g.j - D.j0, c = g.k - D.k0;
    if (a < 0 || b < 0 || c < 0 || a >= S - 1 || b >= S - 1 || c >= S - 1) return null;
    return [a, b, c];
  }
  function dichteAn(D, x, y, z) {
    const l = lokal(D, x, y, z);
    if (!l) return NaN;
    const [a, b, c] = l, A = Math.floor(a), B = Math.floor(b), C = Math.floor(c), u = a - A, w = b - B, t = c - C, d = D.dichte;
    const v = (aa, cc, bb) => d[idx(A + aa, C + cc, B + bb)];
    const x0 = v(0, 0, 0) * (1 - u) + v(1, 0, 0) * u, x1 = v(0, 1, 0) * (1 - u) + v(1, 1, 0) * u;
    const x2 = v(0, 0, 1) * (1 - u) + v(1, 0, 1) * u, x3 = v(0, 1, 1) * (1 - u) + v(1, 1, 1) * u;
    return (x0 * (1 - t) + x1 * t) * (1 - w) + (x2 * (1 - t) + x3 * t) * w;
  }
  function stoffAn(D, x, y, z) {
    const l = lokal(D, x, y, z);
    return l ? D.stoff[idx(Math.round(l[0]), Math.round(l[2]), Math.round(l[1]))] : 0;
  }

  return { zelle, n, R, schluessel, zerlege, zelleVon, chunkVon, chunksFuerOp, punkt, erzeuge, netz, dichteAn, stoffAn };
}
