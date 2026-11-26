// Boden-Netz (reine Logik, ohne THREE): Höhe des GEZEICHNETEN Geländes an jedem Punkt.
// Problem: Natur steht auf der „echten“ Höhe (feines Rauschen), der Boden wird aber als Kachel-Netz mit 0,6–5 m
// Punktabstand gezeichnet – an Klippen, Graten, Uferböschungen liegen dazwischen Meter. Dann stecken Pflanzen im Boden
// oder schweben. Hier: welche Kachel ist gerade sichtbar, wo im Dreieck liegt der Punkt → Netz-Radius.
// Natur fragt das beim Aufbau ab und setzt jedes Stück genau auf das sichtbare Netz.
import { SEITEN, wuerfelZuKugel } from './planet-baum.js';

/** Richtung (Einheitsvektor) → { f, u, v } auf der Würfelseite (Umkehrung von wuerfelZuKugel, Newton). */
export function kugelZuWuerfel(dx, dy, dz, out = { f: 0, u: 0, v: 0 }) {
  const ax = Math.abs(dx), ay = Math.abs(dy), az = Math.abs(dz);
  const f = ax >= ay && ax >= az ? (dx > 0 ? 0 : 1) : ay >= az ? (dy > 0 ? 2 : 3) : (dz > 0 ? 4 : 5);
  const s = SEITEN[f];
  const dn = dx * s.n[0] + dy * s.n[1] + dz * s.n[2];
  let u = (dx * s.a[0] + dy * s.a[1] + dz * s.a[2]) / dn, v = (dx * s.b[0] + dy * s.b[1] + dz * s.b[2]) / dn;
  const p = [0, 0, 0], pu = [0, 0, 0], pv = [0, 0, 0], h = 1e-6;
  for (let it = 0; it < 6; it++) {
    wuerfelZuKugel(f, u, v, p); wuerfelZuKugel(f, u + h, v, pu); wuerfelZuKugel(f, u, v + h, pv);
    const ex = dx - p[0], ey = dy - p[1], ez = dz - p[2];
    if (ex * ex + ey * ey + ez * ez < 1e-26) break;
    // 2×2-Normalgleichung J^T J δ = J^T e
    const jux = (pu[0] - p[0]) / h, juy = (pu[1] - p[1]) / h, juz = (pu[2] - p[2]) / h;
    const jvx = (pv[0] - p[0]) / h, jvy = (pv[1] - p[1]) / h, jvz = (pv[2] - p[2]) / h;
    const a = jux * jux + juy * juy + juz * juz, b = jux * jvx + juy * jvy + juz * jvz, c = jvx * jvx + jvy * jvy + jvz * jvz;
    const r1 = jux * ex + juy * ey + juz * ez, r2 = jvx * ex + jvy * ey + jvz * ez;
    const det = a * c - b * b;
    u += (c * r1 - b * r2) / det; v += (a * r2 - b * r1) / det;
  }
  out.f = f; out.u = Math.max(-1, Math.min(1, u)); out.v = Math.max(-1, Math.min(1, v));
  return out;
}

/** N = Zellen je Kachel. setze(key, {f,L,ix,iy}, radien (N+1)², nass Uint8 (N+1)² oder null) / weg(key) / radius(d) */
export function createBodenNetz({ N = 32, maxStufe = 20 } = {}) {
  const kacheln = new Map();
  let maxL = 0;
  const w = { f: 0, u: 0, v: 0 };
  function setze(key, k, radien, nass) { kacheln.set(key, { ...k, radien, nass }); if (k.L > maxL) maxL = k.L; }
  function weg(key) { kacheln.delete(key); }
  /** Radius (m) des gezeichneten Landes in Richtung d, oder NaN (keine Kachel / Wasser). */
  function radius(dx, dy, dz) {
    kugelZuWuerfel(dx, dy, dz, w);
    for (let L = Math.min(maxL, maxStufe); L >= 0; L--) {
      const n = 1 << L, s = 2 / n;
      const ix = Math.min(n - 1, Math.floor((w.u + 1) / s)), iy = Math.min(n - 1, Math.floor((w.v + 1) / s));
      const k = kacheln.get(`${w.f}/${L}/${ix}/${iy}`);
      if (!k) continue;
      const fu = ((w.u + 1) / s - ix) * N, fv = ((w.v + 1) / s - iy) * N;
      const i = Math.min(N - 1, Math.floor(fu)), j = Math.min(N - 1, Math.floor(fv));
      const x = fu - i, y = fv - j, M = N + 1;
      const a = j * M + i, b = a + 1, c = a + M, d = c + 1;
      if (k.nass && (k.nass[a] >= 130 || k.nass[b] >= 130 || k.nass[c] >= 130 || k.nass[d] >= 130)) return NaN;
      const r = k.radien;
      // gleiche Dreiecksteilung wie kachel-bau.js: (a,b,d) und (a,d,c)
      return x >= y ? r[a] + x * (r[b] - r[a]) + y * (r[d] - r[b]) : r[a] + x * (r[d] - r[c]) + y * (r[c] - r[a]);
    }
    return NaN;
  }
  return { setze, weg, radius, get anzahl() { return kacheln.size; } };
}
