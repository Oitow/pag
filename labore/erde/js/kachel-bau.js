// Baut die Daten einer Planeten-Kachel (reine Logik, ohne THREE, läuft im Worker oder im Hauptthread).
// Ergebnis: Typed Arrays, Lage relativ zum Kachel-Mittelpunkt auf Meereshöhe (genau genug für Float32).
import { kachelUV, kachelMitte, wuerfelZuKugel } from './planet-baum.js';
import { FELDER } from './planet-hoehe.js';
import { waldDichte, nadelAnteil, biom, BIOM } from './klima.js';
import { rng, hashSeed } from '../../../engine/core/rng.js';
const NF = FELDER.length, WI = FELDER.indexOf('wasser');

export const ZELLEN = 32; // 33×33 Punkte je Kachel

// Gras-Teppich: Grundmenge je Biom (0…1), wie die Gras-Büschel in natur-streu.js (GRAS / 4)
const GRAS_BIOM = { [BIOM.TUNDRA]: 0.35, [BIOM.NADELWALD]: 0.3, [BIOM.MISCHWALD]: 0.55, [BIOM.LAUBWALD]: 0.45, [BIOM.GRASLAND]: 1,
  [BIOM.STEPPE]: 0.75, [BIOM.WUESTE]: 0.04, [BIOM.SAVANNE]: 0.9, [BIOM.REGENWALD]: 0.4 };
const gl01 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** Gras am Punkt: [Menge 0…1, Trockenheit 0…1] (Shader: gras-teppich.js + Bodenfarbe). */
export function grasAm(info, flach, out) {
  if (info.wasser > info.h - 0.05 || (info.meer && info.h < 0.8) || info.lava > 0.05) { out[0] = 0; out[1] = 0; return out; }
  const T = info.temp, F = info.feuchte;
  let m = (GRAS_BIOM[biom(T, F)] || 0) * Math.min(1.15, 0.45 + 0.9 * F);
  m *= gl01(0.7, 0.9, flach);                     // steile Hänge: Fels/Geröll statt Gras
  m *= 1 - gl01(0.25, 0.55, info.vulkan);
  m *= 1 - 0.6 * gl01(0.4, 0.9, info.ufer);       // Kiesufer
  m *= 1 - gl01(0.6, 1.4, info.gebirge || 0) * gl01(900, 1800, info.h) * 0.8;   // Hochgebirge: karg
  if (info.eingriff && Math.abs(info.eingriff) > 0.05) m = 0;   // gegraben/aufgeschüttet: nackte Erde
  out[0] = Math.max(0, Math.min(1, m));
  out[1] = Math.max(0, Math.min(1, gl01(0.4, 0.1, F) * 0.85 + gl01(22, 32, T) * 0.35 + gl01(4, -2, T) * 0.4));
  return out;
}

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
  const IF = new Float64Array(G * NF); // probe()-Felder je Punkt (für die Farbe)
  const dir = [0, 0, 0];
  let minH = Infinity, maxH = -Infinity;
  for (let j = -1; j <= N + 1; j++) for (let i = -1; i <= N + 1; i++) {
    wuerfelZuKugel(k.f, u0 + (s * i) / N, v0 + (s * j) / N, dir);
    const l = Math.hypot(dir[0], dir[1], dir[2]);
    const dx = dir[0] / l, dy = dir[1] / l, dz = dir[2] / l;
    const p = planet.probe(dx, dy, dz, feinste);
    const h = Math.max(p.h, p.wasser);  // sichtbar: Boden oder Wasserspiegel
    const r = R + h;
    const g = (j + 1) * M + (i + 1);
    for (let f = 0; f < NF; f++) IF[g * NF + f] = p[FELDER[f]];
    P[g * 3] = dx * r; P[g * 3 + 1] = dy * r; P[g * 3 + 2] = dz * r;
    D[g * 3] = dx; D[g * 3 + 1] = dy; D[g * 3 + 2] = dz;
    H[g] = h;
    if (i >= 0 && j >= 0 && i <= N && j <= N) { if (h < minH) minH = h; if (h > maxH) maxH = h; }
  }

  const innen = (N + 1) * (N + 1), rand = 4 * N;
  const nv = innen + rand;
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Uint8Array(nv * 3), nass = new Uint8Array(nv);
  // land: Bodenfarbe auch unter Wasserpunkten (Strand/Ufer) – der Shader nimmt sie überall, wo die Fläche nicht ganz Wasser ist.
  // So färbt das Wasser keine Hangdreiecke an der Küste mehr ein (vorher blaue Zacken den Hang hinauf).
  const land = new Uint8Array(nv * 3);
  // hohl: Gelände-Verdeckung (Ambient Occlusion) aus der Krümmung – Mulden, Täler, Hangfüße bekommen weniger Himmelslicht.
  // Rechnet nur mit dem schon vorhandenen Höhengitter (1 Punkt Rand → gleiche Werte an Kachelkanten), kostet fast nichts.
  const hohl = new Uint8Array(nv);
  const gras = new Uint8Array(nv * 2), gw = [0, 0];   // Gras-Teppich: Menge, Trockenheit
  const farbe = [0, 0, 0], info = {};
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
    { // Laplace der Höhe (4 Nachbarn + halb gewichtete Diagonalen) je Punktabstand: > 0 = Mulde
      const lap = (H[gl] + H[gr] + H[gu] + H[go] + 0.5 * (H[gu - 1] + H[gu + 1] + H[go - 1] + H[go + 1])) / 6 - H[g];
      const k = Math.max(0, lap / abstand);
      hohl[v] = Math.round(255 / (1 + 5 * k + 8 * k * k));
    }
    for (let f = 0; f < NF; f++) info[FELDER[f]] = IF[g * NF + f];
    // nass = Wassertiefe, 128 = Uferlinie (40 Stufen je m, ±3.2 m). Land neben Wasser bekommt eine negative Tiefe
    // zum Spiegel des Nachbarn → die Uferlinie läuft im Shader glatt quer durchs Dreieck statt im Zickzack an den Kanten.
    const istNass = info.wasser > info.h + 0.02;
    let spiegel = info.wasser;
    if (!istNass) for (const nb of [gl, gr, gu, go]) { const w = IF[nb * NF + WI]; if (w > spiegel) spiegel = w; }
    const tief = spiegel > -1e9 ? spiegel - info.h : -10;
    nass[v] = istNass ? Math.max(130, Math.min(255, Math.round(128 + tief * 40))) : Math.max(0, Math.min(126, Math.round(128 + tief * 40)));
    grasAm(info, flach, gw);
    gras[v * 2] = Math.round(gw[0] * 255); gras[v * 2 + 1] = Math.round(gw[1] * 255);
    planet.farbe(dx, dy, dz, info, flach, farbe);
    col[v * 3] = Math.min(255, farbe[0] * 255); col[v * 3 + 1] = Math.min(255, farbe[1] * 255); col[v * 3 + 2] = Math.min(255, farbe[2] * 255);
    if (istNass) { // Boden am Wasserspiegel: Sand am Meer, Kies am Fluss
      const hw = info.h, ww = info.wasser;
      info.h = ww; info.wasser = -Infinity; info.ufer = Math.max(info.ufer, 0.6);
      planet.farbe(dx, dy, dz, info, 1, farbe);
      info.h = hw; info.wasser = ww;
      land[v * 3] = Math.min(255, farbe[0] * 255); land[v * 3 + 1] = Math.min(255, farbe[1] * 255); land[v * 3 + 2] = Math.min(255, farbe[2] * 255);
    } else { land[v * 3] = col[v * 3]; land[v * 3 + 1] = col[v * 3 + 1]; land[v * 3 + 2] = col[v * 3 + 2]; }
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
    for (let c = 0; c < 3; c++) { nor[v * 3 + c] = nor[a * 3 + c]; col[v * 3 + c] = col[a * 3 + c] * 0.8; land[v * 3 + c] = land[a * 3 + c] * 0.8; }
    nass[v] = nass[a]; hohl[v] = hohl[a]; gras[v * 2] = gras[a * 2]; gras[v * 2 + 1] = gras[a * 2 + 1];
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

  // Gleich hier (im Worker) statt im Hauptthread: Radien des gezeichneten Netzes (boden-netz.js) und Hüllkugel (Sichtprüfung)
  const radien = new Float32Array(innen);
  for (let q = 0; q < innen; q++) radien[q] = Math.hypot(pos[q * 3] + cx, pos[q * 3 + 1] + cy, pos[q * 3 + 2] + cz);
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let q = 0; q < nv * 3; q += 3) {
    const x = pos[q], y = pos[q + 1], z = pos[q + 2];
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  const kx = (x0 + x1) / 2, ky = (y0 + y1) / 2, kz = (z0 + z1) / 2;
  let kr = 0;
  for (let q = 0; q < nv * 3; q += 3) kr = Math.max(kr, (pos[q] - kx) ** 2 + (pos[q + 1] - ky) ** 2 + (pos[q + 2] - kz) ** 2);
  const kugel = [kx, ky, kz, Math.sqrt(kr)];

  const baeume = fernBaeume(k, planet, N, M, P, D, IF, nor, kante, abstand, cx, cy, cz);
  return { key: k.key, L: k.L, pos, nor, col, land, nass, hohl, gras, idx, radien, kugel, mitte: [cx, cy, cz], minH, maxH, kante, baeume };
}

// ---------- Fernwald: Bäume als Punkte (ein Eckpunkt je Baum, im Shader als Silhouette) ----------
// Nur für mittlere/grobe Kacheln (140 m … 2,5 km Kante); nah stehen die echten Bäume (natur.js).
// Dichte wie bei den echten Bäumen (waldDichte), grobe Zellen bündeln mehrere Bäume in einem größeren Punkt.
const FW = { temp: FELDER.indexOf('temp'), feuchte: FELDER.indexOf('feuchte'), h: FELDER.indexOf('h'), wasser: FELDER.indexOf('wasser'), vulkan: FELDER.indexOf('vulkan') };
function fernBaeume(k, planet, N, M, P, D, IF, nor, kante, abstand, cx, cy, cz) {
  if (kante < 140 || kante > 2500 || !planet.flecken) return null;   // feinere Kacheln liegen im Bereich der echten Bäume
  const NF = FELDER.length, z = rng(hashSeed(planet.seed, 'fernwald', k.key));
  const flaeche = abstand * abstand;
  const maxJeZelle = kante < 400 ? 3 : kante < 1000 ? 2 : 1;   // fern: weniger, dafür größere Punkte (Baumgruppen)
  const pos = [], gr = [], col = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const g = (j + 1) * M + (i + 1), v = j * (N + 1) + i;
    const h = IF[g * NF + FW.h], w = IF[g * NF + FW.wasser];
    if (w > h - 0.5) continue;                                   // Wasser/Ufer
    if (IF[g * NF + FW.vulkan] > 0.55) continue;                 // kahler Vulkangipfel (wie natur-streu)
    const flach = nor[v * 3] * D[g * 3] + nor[v * 3 + 1] * D[g * 3 + 1] + nor[v * 3 + 2] * D[g * 3 + 2];
    if (flach < 0.8) continue;
    const T = IF[g * NF + FW.temp], F = IF[g * NF + FW.feuchte];
    const fl = planet.flecken(D[g * 3], D[g * 3 + 1], D[g * 3 + 2]);
    const dichte = (waldDichte(T, F, fl) * 0.24 + 0.002) / 16;   // Bäume je m² (wie natur-streu)
    const erwartet = dichte * flaeche;
    let anzahl = erwartet < 1 ? (z() < erwartet ? 1 : 0) : Math.min(maxJeZelle, Math.round(erwartet));
    if (!anzahl) continue;
    const buendel = Math.min(3, Math.sqrt(Math.max(1, erwartet / anzahl)));
    const na = nadelAnteil(T), warm = Math.min(1, Math.max(0, (T - 18) / 8));
    for (let q = 0; q < anzahl; q++) {
      // Lage: zufällig in der Zelle, bilinear zwischen den vier Eckpunkten (liegt auf dem gezeichneten Boden)
      const a = z(), b = z();
      const g00 = g, g10 = g + 1, g01 = g + M, g11 = g + M + 1;
      const nadel = z() < na;
      const hoehe = (nadel ? 16 + 8 * z() : 13 + 7 * z()) * (1 + 0.5 * warm) * buendel;
      const p = [0, 0, 0];
      for (let c = 0; c < 3; c++) {
        p[c] = (P[g00 * 3 + c] * (1 - a) + P[g10 * 3 + c] * a) * (1 - b) + (P[g01 * 3 + c] * (1 - a) + P[g11 * 3 + c] * a) * b;
      }
      const l = Math.hypot(p[0], p[1], p[2]);
      const mitteH = hoehe * 0.45;                              // Punkt sitzt in halber Baumhöhe
      pos.push(p[0] + p[0] / l * mitteH - cx, p[1] + p[1] / l * mitteH - cy, p[2] + p[2] / l * mitteH - cz);
      gr.push(hoehe, nadel ? 0 : 1);
      const t = 0.85 + 0.3 * z() + (fl - 0.5) * 0.2;
      if (nadel) col.push(0.15 * t, 0.29 * t, 0.19 * t);
      else col.push((0.22 - 0.06 * warm) * t, (0.4 - 0.04 * warm) * t, (0.15 - 0.03 * warm) * t);
    }
  }
  if (!pos.length) return null;
  return { pos: new Float32Array(pos), groesse: new Float32Array(gr), farbe: new Uint8Array(col.map((x) => Math.min(255, x * 255))) };
}
