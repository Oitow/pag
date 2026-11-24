// Baut die Daten einer Planeten-Kachel (reine Logik, ohne THREE, läuft im Worker oder im Hauptthread).
// Ergebnis: Typed Arrays, Lage relativ zum Kachel-Mittelpunkt auf Meereshöhe (genau genug für Float32).
import { kachelUV, kachelMitte, wuerfelZuKugel } from './planet-baum.js';

export const ZELLEN = 32; // 33×33 Punkte je Kachel

export function baueKachel(k, planet, N = ZELLEN) {
  const R = planet.radius;
  const { u0, v0, s } = kachelUV(k);
  const { d: cd, kante } = kachelMitte(k, R);
  const cx = cd[0] * R, cy = cd[1] * R, cz = cd[2] * R;
  const abstand = kante / N;
  const feinste = abstand * 1.5;

  // Gitter mit 1 Punkt Rand (für Normalen über die Kachelkante hinweg)
  const M = N + 3, G = M * M;
  const P = new Float64Array(G * 3), D = new Float64Array(G * 3), H = new Float64Array(G);
  const dir = [0, 0, 0];
  let minH = Infinity, maxH = -Infinity;
  for (let j = -1; j <= N + 1; j++) for (let i = -1; i <= N + 1; i++) {
    wuerfelZuKugel(k.f, u0 + (s * i) / N, v0 + (s * j) / N, dir);
    const l = Math.hypot(dir[0], dir[1], dir[2]);
    const dx = dir[0] / l, dy = dir[1] / l, dz = dir[2] / l;
    const h = planet.hoehe(dx, dy, dz, feinste);
    const r = R + Math.max(0, h); // Meer bleibt glatt auf Höhe 0
    const g = (j + 1) * M + (i + 1);
    P[g * 3] = dx * r; P[g * 3 + 1] = dy * r; P[g * 3 + 2] = dz * r;
    D[g * 3] = dx; D[g * 3 + 1] = dy; D[g * 3 + 2] = dz;
    H[g] = h;
    if (i >= 0 && j >= 0 && i <= N && j <= N) { if (h < minH) minH = h; if (h > maxH) maxH = h; }
  }

  const innen = (N + 1) * (N + 1), rand = 4 * N;
  const nv = innen + rand;
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Uint8Array(nv * 3);
  const farbe = [0, 0, 0];
  let v = 0;
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++, v++) {
    const g = (j + 1) * M + (i + 1);
    const gl = g - 1, gr = g + 1, gu = g - M, go = g + M;
    const ux = P[gr * 3] - P[gl * 3], uy = P[gr * 3 + 1] - P[gl * 3 + 1], uz = P[gr * 3 + 2] - P[gl * 3 + 2];
    const vx = P[go * 3] - P[gu * 3], vy = P[go * 3 + 1] - P[gu * 3 + 1], vz = P[go * 3 + 2] - P[gu * 3 + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    const dx = D[g * 3], dy = D[g * 3 + 1], dz = D[g * 3 + 2];
    const flach = nx * dx + ny * dy + nz * dz;
    pos[v * 3] = P[g * 3] - cx; pos[v * 3 + 1] = P[g * 3 + 1] - cy; pos[v * 3 + 2] = P[g * 3 + 2] - cz;
    nor[v * 3] = nx; nor[v * 3 + 1] = ny; nor[v * 3 + 2] = nz;
    planet.farbe(dx, dy, dz, H[g], flach, farbe);
    col[v * 3] = Math.min(255, farbe[0] * 255); col[v * 3 + 1] = Math.min(255, farbe[1] * 255); col[v * 3 + 2] = Math.min(255, farbe[2] * 255);
  }

  // Schürze: Randpunkte noch einmal, nach unten versetzt – verdeckt Risse zu gröberen Nachbarn
  const tiefe = abstand * 4 + 15;
  const umlauf = [];
  for (let i = 0; i < N; i++) umlauf.push(i);                          // unten, links → rechts
  for (let j = 0; j < N; j++) umlauf.push(j * (N + 1) + N);            // rechts, unten → oben
  for (let i = N; i > 0; i--) umlauf.push(N * (N + 1) + i);            // oben, rechts → links
  for (let j = N; j > 0; j--) umlauf.push(j * (N + 1));                // links, oben → unten
  for (let q = 0; q < rand; q++, v++) {
    const a = umlauf[q];
    const ii = a % (N + 1), jj = (a / (N + 1)) | 0;
    const g = (jj + 1) * M + (ii + 1);
    pos[v * 3] = pos[a * 3] - D[g * 3] * tiefe;
    pos[v * 3 + 1] = pos[a * 3 + 1] - D[g * 3 + 1] * tiefe;
    pos[v * 3 + 2] = pos[a * 3 + 2] - D[g * 3 + 2] * tiefe;
    for (let c = 0; c < 3; c++) { nor[v * 3 + c] = nor[a * 3 + c]; col[v * 3 + c] = col[a * 3 + c] * 0.8; }
  }

  const idx = new Uint16Array(N * N * 6 + rand * 6);
  let t = 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1;
    idx[t++] = a; idx[t++] = b; idx[t++] = d;
    idx[t++] = a; idx[t++] = d; idx[t++] = c;
  }
  for (let q = 0; q < rand; q++) {
    const a = umlauf[q], b = umlauf[(q + 1) % rand];
    const sa = innen + q, sb = innen + ((q + 1) % rand);
    idx[t++] = a; idx[t++] = sa; idx[t++] = b;   // nach außen (Rand läuft gegen den Uhrzeigersinn)
    idx[t++] = b; idx[t++] = sa; idx[t++] = sb;
  }

  return { key: k.key, L: k.L, pos, nor, col, idx, mitte: [cx, cy, cz], minH, maxH, kante };
}
