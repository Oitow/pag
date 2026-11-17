/**
 * @modul    sdf-netz
 * @zweck    Macht aus einem Abstandsfeld (sdf.js) ein Dreiecksnetz (Surface Nets, glatte Normalen) und eine begehbare Höhenkarte
 * @api      sdfNetz(sdf, { zelle = 0.5, grenzen, maxZellen = 3e6, block = 4 }) -> { position, normal, index, dreiecke, zelle } ; sdfHoehenkarte(sdf, { zelle = 0.5, grenzen, maxHoehe = 6, kopf = 2.2 }) -> { x0, z0, zelle, breite, tiefe, hoehe: Float32Array ‹NaN = nichts›, hoeheBei(x, z) }
 * @beispiel
 *   import { createSdf } from '../../engine/core/sdf.js';
 *   import { sdfNetz, sdfHoehenkarte } from '../../engine/core/sdf-netz.js';
 *   const sdf = createSdf(); sdf.kugel([0, 1, 0], 2);
 *   const netz = sdfNetz(sdf, { zelle: 0.25 });             // → BufferGeometry: position, normal, index
 *   const karte = sdfHoehenkarte(sdf, { zelle: 0.5 });      // karte.hoeheBei(0, 0) ≈ 3
 * @tags     sdf, netz, mesh, surface-nets, hoehenkarte, kollision, welt, modell
 * @version  1.0.1
 * @status   entwurf
 * @three    nein
 */

const W3 = Math.sqrt(3);
// Würfelecken (Bit 0 = x, 1 = y, 2 = z) und die 12 Kanten als Eckenpaare
const KANTEN = [0, 1, 2, 3, 4, 5, 6, 7, 0, 2, 1, 3, 4, 6, 5, 7, 0, 4, 1, 5, 2, 6, 3, 7];

/**
 * Surface Nets: ein Eckpunkt je Zelle mit Vorzeichenwechsel, Vierecke über die geschnittenen Gitterkanten.
 * Schnell, weil erst grob in Blöcken geprüft und nur nahe der Oberfläche fein abgetastet wird. Ränder des Quaders bleiben offen.
 */
export function sdfNetz(sdf, { zelle = 0.5, grenzen = sdf.grenzen(), maxZellen = 3e6, block = 4 } = {}) {
  const min = grenzen.min, max = grenzen.max;
  let nx, ny, nz;
  for (;;) {
    nx = Math.max(1, Math.ceil((max[0] - min[0]) / zelle)); ny = Math.max(1, Math.ceil((max[1] - min[1]) / zelle)); nz = Math.max(1, Math.ceil((max[2] - min[2]) / zelle));
    if (nx * ny * nz <= maxZellen) break;
    zelle *= 1.08;
  }
  const px = nx + 1, py = ny + 1, pxy = px * py;
  const werte = new Float32Array(pxy * (nz + 1)).fill(NaN);
  const zellVert = new Int32Array(nx * ny * nz).fill(-1);
  const pos = [], nrm = [], zellen = [];
  const hd = block * zelle * 0.5 * W3, grob = hd * 1.3 + (sdf.spiel || 0), eng = typeof sdf.eingrenzen === 'function';
  const v = new Float64Array(8), nv = [0, 0, 0], bmin = [0, 0, 0], bmax = [0, 0, 0];
  const wert = (i, j, k) => {
    const o = i + j * px + k * pxy;
    let w = werte[o];
    if (w !== w) { w = sdf.abstand(min[0] + i * zelle, min[1] + j * zelle, min[2] + k * zelle); if (w === 0) w = 1e-7; werte[o] = w; }
    return w;
  };

  for (let bk = 0; bk < nz; bk += block) for (let bj = 0; bj < ny; bj += block) for (let bi = 0; bi < nx; bi += block) {
    const ei = Math.min(nx, bi + block), ej = Math.min(ny, bj + block), ek = Math.min(nz, bk + block);
    bmin[0] = min[0] + bi * zelle; bmin[1] = min[1] + bj * zelle; bmin[2] = min[2] + bk * zelle;
    bmax[0] = min[0] + ei * zelle; bmax[1] = min[1] + ej * zelle; bmax[2] = min[2] + ek * zelle;
    if (eng && sdf.eingrenzen(bmin, bmax, hd * 2) === 0) continue;
    const mitte = sdf.abstand(bmin[0] + block * zelle * 0.5, bmin[1] + block * zelle * 0.5, bmin[2] + block * zelle * 0.5);
    if (Math.abs(mitte) > grob) continue;
    for (let k = bk; k < ek; k++) for (let j = bj; j < ej; j++) for (let i = bi; i < ei; i++) {
      let maske = 0;
      for (let e = 0; e < 8; e++) { v[e] = wert(i + (e & 1), j + ((e >> 1) & 1), k + (e >> 2)); if (v[e] < 0) maske |= 1 << e; }
      if (maske === 0 || maske === 255) continue;
      let sx = 0, sy = 0, sz = 0, anz = 0;
      for (let e = 0; e < 24; e += 2) {
        const a = KANTEN[e], b = KANTEN[e + 1];
        if ((v[a] < 0) === (v[b] < 0)) continue;
        const t = v[a] / (v[a] - v[b]);
        sx += (a & 1) + ((b & 1) - (a & 1)) * t; sy += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t; sz += (a >> 2) + ((b >> 2) - (a >> 2)) * t;
        anz++;
      }
      const x = min[0] + (i + sx / anz) * zelle, y = min[1] + (j + sy / anz) * zelle, z = min[2] + (k + sz / anz) * zelle;
      sdf.normale(x, y, z, nv, zelle * 0.3);
      zellVert[i + j * nx + k * nx * ny] = pos.length / 3;
      pos.push(x, y, z); nrm.push(nv[0], nv[1], nv[2]); zellen.push(i, j, k);
    }
  }
  if (eng) sdf.eingrenzen(null);

  // Vierecke: je Gitterkante mit Vorzeichenwechsel die 4 Zellen ringsum verbinden
  const idx = [];
  const P = pos, N = nrm;
  const viereck = (a, b, c, d) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
    const ux = P[b * 3] - ax, uy = P[b * 3 + 1] - ay, uz = P[b * 3 + 2] - az, wx = P[d * 3] - ax, wy = P[d * 3 + 1] - ay, wz = P[d * 3 + 2] - az;
    const aussen = (uy * wz - uz * wy) * N[a * 3] + (uz * wx - ux * wz) * N[a * 3 + 1] + (ux * wy - uy * wx) * N[a * 3 + 2] >= 0;
    if (aussen) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c);
  };
  const sxy = nx * ny;
  for (let q = 0; q < zellen.length; q += 3) {
    const i = zellen[q], j = zellen[q + 1], k = zellen[q + 2], o = i + j * nx + k * sxy;
    const d0 = werte[i + j * px + k * pxy] < 0;
    if (j > 0 && k > 0 && d0 !== (werte[i + 1 + j * px + k * pxy] < 0)) viereck(zellVert[o], zellVert[o - nx], zellVert[o - nx - sxy], zellVert[o - sxy]);
    if (i > 0 && k > 0 && d0 !== (werte[i + (j + 1) * px + k * pxy] < 0)) viereck(zellVert[o], zellVert[o - sxy], zellVert[o - 1 - sxy], zellVert[o - 1]);
    if (i > 0 && j > 0 && d0 !== (werte[i + j * px + (k + 1) * pxy] < 0)) viereck(zellVert[o], zellVert[o - 1], zellVert[o - 1 - nx], zellVert[o - nx]);
  }
  const VA = pos.length / 3 > 65535 ? Uint32Array : Uint16Array;
  for (let t = 0; t < idx.length; t += 3) {            // Wicklung an den Gradienten-Normalen ausrichten (einzelne Zellen an Sattelstellen kippen sonst)
    const A = idx[t] * 3, B = idx[t + 1] * 3, C = idx[t + 2] * 3;
    const ux = pos[B] - pos[A], uy = pos[B + 1] - pos[A + 1], uz = pos[B + 2] - pos[A + 2], vx = pos[C] - pos[A], vy = pos[C + 1] - pos[A + 1], vz = pos[C + 2] - pos[A + 2];
    const d = (uy * vz - uz * vy) * (nrm[A] + nrm[B] + nrm[C]) + (uz * vx - ux * vz) * (nrm[A + 1] + nrm[B + 1] + nrm[C + 1]) + (ux * vy - uy * vx) * (nrm[A + 2] + nrm[B + 2] + nrm[C + 2]);
    if (d < 0) { const m = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = m; }
  }
  return { position: new Float32Array(pos), normal: new Float32Array(nrm), index: new VA(idx), dreiecke: idx.length / 3, zelle };
}

/**
 * Begehbare Höhenkarte: je Spalte die unterste Oberfläche, über der mindestens `kopf` Meter frei sind (unter Bögen bleibt der Boden frei = NaN).
 * Spalten, die bis maxHoehe massiv sind (Stamm), bekommen maxHoehe. Höhen gelten ab y = 0 (Boden).
 */
export function sdfHoehenkarte(sdf, { zelle = 0.5, grenzen = sdf.grenzen(), maxHoehe = 6, kopf = 2.2 } = {}) {
  const x0 = grenzen.min[0], z0 = grenzen.min[2];
  const breite = Math.max(1, Math.ceil((grenzen.max[0] - x0) / zelle) + 1), tiefe = Math.max(1, Math.ceil((grenzen.max[2] - z0) / zelle) + 1);
  const hoehe = new Float32Array(breite * tiefe).fill(NaN);
  const dy = Math.min(zelle * 0.5, 0.3), stufen = Math.ceil((maxHoehe + kopf) / dy), eng = typeof sdf.eingrenzen === 'function';
  const kachel = 8, spiel = sdf.spiel || 0;
  for (let kz = 0; kz < tiefe; kz += kachel) for (let kx = 0; kx < breite; kx += kachel) {
    const ex = Math.min(breite, kx + kachel), ez = Math.min(tiefe, kz + kachel);
    if (eng && sdf.eingrenzen([x0 + kx * zelle, 0, z0 + kz * zelle], [x0 + (ex - 1) * zelle, maxHoehe + kopf, z0 + (ez - 1) * zelle], dy) === 0) continue;
    for (let iz = kz; iz < ez; iz++) for (let ix = kx; ix < ex; ix++) {
      const x = x0 + ix * zelle, z = z0 + iz * zelle;
      const mitte = sdf.abstand(x, maxHoehe * 0.5, z);
      if (mitte > (maxHoehe + kopf) * 0.75 + spiel) continue;                 // weit weg von allem
      let boden = NaN, kandidat = NaN, frei = 0, dVor = sdf.abstand(x, 0, z), gefunden = false;
      if (dVor >= 0) kandidat = -1;                                           // −1 = der blanke Boden
      for (let s = 1; s <= stufen; s++) {
        const y = s * dy, d = sdf.abstand(x, y, z);
        if (d >= 0) {
          if (dVor < 0) { kandidat = y - dy * (d / (d - dVor)); frei = 0; }   // Oberfläche von innen nach außen durchstoßen
          frei += dy;
          if (kandidat === kandidat && frei >= kopf) { boden = kandidat; gefunden = true; break; }
        } else { kandidat = NaN; frei = 0; }
        dVor = d;
        if (y > maxHoehe && kandidat !== kandidat) break;
      }
      if (!gefunden) hoehe[ix + iz * breite] = Math.min(maxHoehe, kandidat === kandidat && kandidat >= 0 ? kandidat : maxHoehe);
      else if (boden >= 0) hoehe[ix + iz * breite] = Math.min(boden, maxHoehe);
    }
  }
  if (eng) sdf.eingrenzen(null);

  /** Höhe an der Stelle (x, z) im selben Raum wie das SDF; NaN = dort ist nichts (blanker Boden). */
  function hoeheBei(x, z) {
    const fx = (x - x0) / zelle, fz = (z - z0) / zelle;
    if (!(fx >= 0 && fz >= 0 && fx <= breite - 1 && fz <= tiefe - 1)) return NaN;
    const ix = Math.min(breite - 2, Math.floor(fx)), iz = Math.min(tiefe - 2, Math.floor(fz));
    if (ix < 0 || iz < 0) return hoehe[Math.round(fx) + Math.round(fz) * breite];
    const tx = fx - ix, tz = fz - iz;
    if (hoehe[Math.round(fx) + Math.round(fz) * breite] !== hoehe[Math.round(fx) + Math.round(fz) * breite]) return NaN;
    let sum = 0, gew = 0;
    for (let e = 0; e < 4; e++) {
      const h = hoehe[ix + (e & 1) + (iz + (e >> 1)) * breite], w = ((e & 1) ? tx : 1 - tx) * ((e >> 1) ? tz : 1 - tz);
      if (h === h) { sum += h * w; gew += w; }
    }
    return gew > 0 ? sum / gew : NaN;
  }
  return { x0, z0, zelle, breite, tiefe, hoehe, hoeheBei };
}
