// Boden-Netz (reine Logik, ohne THREE): Höhe des GEZEICHNETEN Geländes an jedem Punkt.
// Problem: Natur steht auf der „echten“ Höhe (feines Rauschen), der Boden wird aber als Kachel-Netz mit 0,6–5 m
// Punktabstand gezeichnet – an Klippen, Graten, Uferböschungen liegen dazwischen Meter. Dann stecken Pflanzen im Boden
// oder schweben. Hier: welche Kachel ist gerade sichtbar, wo im Dreieck liegt der Punkt → Netz-Radius.
// Natur fragt das beim Aufbau ab und setzt jedes Stück genau auf das sichtbare Netz.
import { SEITEN, wuerfelZuKugel, kachelMitte } from './planet-baum.js';

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

// Zahl-Schlüssel statt Text (f, L ≤ 31, ix/iy < 2^20): kein String je Abfrage → schnell genug für zehntausende Stücke
const nKey = (f, L, ix, iy) => ((f * 32 + L) * 1048576 + ix) * 1048576 + iy;

/** N = Zellen je Kachel. setze(key, {f,L,ix,iy}, radien (N+1)², nass Uint8 (N+1)² oder null) / weg(key) / radius(d) / radiusUV(f,u,v) */
export function createBodenNetz({ N = 32, maxStufe = 20 } = {}) {
  const kacheln = new Map(), zahl = new Map();   // Text-Schlüssel → Zahl-Schlüssel
  let maxL = 0, stand = 0, F = null;
  const w = { f: 0, u: 0, v: 0 };
  // Fokus (Richtung + Winkel): nur Kacheln, die ihn berühren, zählen als Änderung. Beim Sinkflug wechseln ständig ferne
  // grobe Kacheln – dort steht keine Natur, also muss sie deswegen auch nicht alle Stücke neu aufs Netz setzen.
  function trifft(k) {
    if (!F) return true;
    const { d, kante } = kachelMitte(k, 1);
    const c = d[0] * F[0] + d[1] * F[1] + d[2] * F[2];
    return Math.acos(Math.max(-1, Math.min(1, c))) < kante + F[3];
  }
  function setze(key, k, radien, nass) {
    const nk = nKey(k.f, k.L, k.ix, k.iy);
    zahl.set(key, nk); kacheln.set(nk, { ...k, radien, nass }); if (k.L > maxL) maxL = k.L;
    if (trifft(k)) stand++;
  }
  function weg(key) {
    const nk = zahl.get(key); if (nk === undefined) return;
    const k = kacheln.get(nk);
    zahl.delete(key); kacheln.delete(nk);
    if (trifft(k)) stand++;
  }
  /** Fokus setzen: Einheitsrichtung + Winkel (rad), z. B. Kamera und 1,5 km / R. Ohne Aufruf zählt jede Änderung. */
  function fokus(dx, dy, dz, winkel) {
    if (F && Math.abs(F[3] - winkel) < 1e-12 && F[0] * dx + F[1] * dy + F[2] * dz > Math.cos(winkel * 0.25)) return;   // kaum bewegt
    F = [dx, dy, dz, winkel];
  }
  /** Radius (m) des gezeichneten Landes an Würfelstelle (f,u,v), oder NaN (keine Kachel / Wasser). */
  function radiusUV(f, u, v) {
    for (let L = Math.min(maxL, maxStufe); L >= 0; L--) {
      const n = 1 << L, s = 2 / n;
      const ix = Math.min(n - 1, Math.floor((u + 1) / s)), iy = Math.min(n - 1, Math.floor((v + 1) / s));
      const k = kacheln.get(nKey(f, L, ix, iy));
      if (!k) continue;
      const fu = ((u + 1) / s - ix) * N, fv = ((v + 1) / s - iy) * N;
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
  /** Radius (m) des gezeichneten Landes in Richtung d, oder NaN (keine Kachel / Wasser). */
  function radius(dx, dy, dz) { kugelZuWuerfel(dx, dy, dz, w); return radiusUV(w.f, w.u, w.v); }
  // stand: zählt jede Änderung – Nutzer merken sich Ergebnisse und rechnen nur neu, wenn sich das Netz geändert hat
  return { setze, weg, fokus, radius, radiusUV, get anzahl() { return kacheln.size; }, get stand() { return stand; } };
}
