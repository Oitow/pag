// Höhe, Wasser und Farbe des Planeten an jedem Punkt (reine Logik, ohne THREE, läuft auch im Worker).
// Grobe Form aus der Geologie (Platten, Erosion, Flussnetz, Seen – siehe geologie.js), darauf feines Rauschen.
// Flüsse werden fein eingeschnitten: Bett, Ufer und Talsohle entlang der Abfluss-Strecken der Geologie.
// `feinste` = kleinste Wellenlänge in Metern, die noch berechnet wird (grobe Kacheln sparen Arbeit).
import { createNoise3D } from '../../../engine/core/noise.js';
import { createGeoGitter } from './geo-gitter.js';

const glatt = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Flussbreite (m) aus Einzugsfläche (km²). */
export const flussBreite = (aKm2) => Math.min(140, 3 + 2.4 * Math.sqrt(aKm2));

export function createPlanetHoehe({ seed = 1, radius = 100_000, geo, G: gitter }) {
  const n = createNoise3D(seed);
  const R = radius;
  const G = gitter || createGeoGitter(geo.N);
  const { hoehe: GH, spiegel: GF, ab: GA, flaeche: GA2, gebirge: GB } = geo;
  const dir = G.dir, nb = G.nb;
  const ZK = geo.zellKante, AMIN = geo.amin;
  const gw = G.neueGewichte();
  const W_WARP = ZK * 2.6, WARP = (ZK * 0.32) / R;

  function fbmBis(x, y, z, welle, feinste, maxOkt, versatz) {
    let sum = 0, amp = 1, norm = 0, w = welle;
    for (let o = 0; o < maxOkt; o++) {
      const g = glatt(feinste, feinste * 2, w);
      if (g <= 0) break;
      const f = 1 / w;
      sum += amp * g * n(x * f + versatz, y * f - versatz, z * f + o * 17.3);
      norm += amp; amp *= 0.5; w *= 0.5;
    }
    return norm ? sum / norm : 0;
  }
  function gratBis(x, y, z, welle, feinste, maxOkt) {
    let sum = 0, amp = 0.5, prev = 1, w = welle;
    for (let o = 0; o < maxOkt; o++) {
      const g = glatt(feinste, feinste * 2, w);
      if (g <= 0) break;
      const f = 1 / w;
      let v = 1 - Math.abs(n(x * f + 91.7, y * f + 3.1, z * f - 47.9 + o * 5.1));
      v *= v;
      sum += v * amp * prev * g; prev = v; amp *= 0.5; w /= 2.1;
    }
    return Math.min(1, sum * 1.1);
  }

  const aus = { h: 0, wasser: -Infinity, ufer: 0, fluss: 0, gebirge: 0, meer: 0 };

  /** Füllt `aus`: h = Boden (m über Meer), wasser = Wasserspiegel (−∞ = kein Wasser), ufer 0…1, fluss 0/1. */
  function probe(dx, dy, dz, feinste = 1) {
    // leichte Verwirbelung: bricht das Gitter auf, lässt Flüsse mäandern (gleich für Form und Flüsse)
    const wf = R / W_WARP;
    let qx = dx + WARP * n(dx * wf, dy * wf, dz * wf);
    let qy = dy + WARP * n(dx * wf + 17.1, dy * wf, dz * wf - 4.4);
    let qz = dz + WARP * n(dx * wf - 9.3, dy * wf + 2.8, dz * wf);
    const ql = Math.hypot(qx, qy, qz); qx /= ql; qy /= ql; qz /= ql;
    G.gewichte(qx, qy, qz, gw);
    const Hm = G.lese(GH, gw), Fm = G.lese(GF, gw), gb = G.lese(GB, gw);
    const x = dx * R, y = dy * R, z = dz * R;

    // feines Gelände: Grate im Gebirge, Hügel und Bodenwellen sonst
    const land = glatt(-30, 15, Hm);
    let detail = 0;
    if (gb > 0.01) detail += (gratBis(x, y, z, 2600, feinste, 7) - 0.3) * 700 * gb;
    detail += fbmBis(x, y, z, 700, feinste, 6, 13.7) * (14 + 45 * (1 - gb)) * land;
    detail += fbmBis(x, y, z, 55, feinste, 4, 41.1) * 1.3 * land;
    detail += fbmBis(x, y, z, 1800, feinste, 3, 5.5) * 120 * (1 - land); // Meeresgrund

    let wasser = -Infinity, ufer = 0, fluss = 0;
    if (Fm > Hm + 1 && Fm > 0) { wasser = Fm; detail *= glatt(Fm, Fm - 25, Hm); }      // See
    if (Fm < 0.5) wasser = 0;                                                         // Meer
    let h = Hm + detail;

    // Flüsse: nächste Abfluss-Strecke (Zelle → Ziel) in der Nachbarschaft
    if (Hm > -5) {
      let best = Infinity, bLevel = 0, bBreite = 0;
      const c0 = gw.naechste;
      for (let k = -1; k < 8; k++) {
        const c = k < 0 ? c0 : nb[c0 * 8 + k];
        if (c < 0 || GA2[c] < AMIN || GH[c] < -2 || GF[c] > GH[c] + 1) continue; // im See: kein eigenes Bett
        const d = GA[c];
        if (d < 0) continue;
        const ax = dir[c * 3], ay = dir[c * 3 + 1], az = dir[c * 3 + 2];
        const bx = dir[d * 3] - ax, by = dir[d * 3 + 1] - ay, bz = dir[d * 3 + 2] - az;
        const t = Math.max(0, Math.min(1, ((qx - ax) * bx + (qy - ay) * by + (qz - az) * bz) / (bx * bx + by * by + bz * bz)));
        const ex = qx - ax - bx * t, ey = qy - ay - by * t, ez = qz - az - bz * t;
        const dist = Math.hypot(ex, ey, ez) * R;
        const breite = flussBreite(GA2[c]);
        if (dist - breite / 2 < best) {
          best = dist - breite / 2;
          bBreite = breite;
          bLevel = Math.max(0, GF[c] + (Math.max(0, GF[d]) - GF[c]) * t);
        }
      }
      if (best < Infinity) {
        const halb = bBreite / 2, tal = 30 + bBreite * 2.5;
        const dist = best + halb;
        if (dist < halb + tal) {
          // Talsohle/Ufer: Gelände senkt sich sanft zum Fluss, nie unter den Wasserspiegel
          const k = glatt(halb, halb + tal, dist);
          const ufH = bLevel + 0.4 + (dist - halb) * 0.06;
          h = ufH + (h - ufH) * k;
          if (h < bLevel + 0.3) h = bLevel + 0.3;
          ufer = 1 - glatt(halb, halb + 12 + bBreite * 0.3, dist);
          // Bett nur, wenn die Kachel fein genug ist, um es zu zeigen
          if (dist < halb && feinste < bBreite * 1.5) {
            const tiefe = 0.7 + bBreite * 0.05;
            h = bLevel - tiefe * (1 - (dist / halb) ** 2);
            if (bLevel > wasser) wasser = bLevel;
            fluss = 1;
          }
        }
      }
    }
    aus.h = h; aus.wasser = wasser; aus.ufer = ufer; aus.fluss = fluss; aus.gebirge = gb; aus.meer = Fm < 0.5 ? 1 : 0;
    return aus;
  }

  /** Begehbare Oberfläche (Boden oder Wasserspiegel). */
  const oberflaeche = (dx, dy, dz, feinste = 1) => { const p = probe(dx, dy, dz, feinste); return Math.max(p.h, p.wasser); };
  const hoehe = (dx, dy, dz, feinste = 1) => probe(dx, dy, dz, feinste).h;

  /** Farbe (0…1) nach out. p = Ergebnis von probe(), flach = 1 eben … 0 senkrecht. */
  function farbe(dx, dy, dz, p, flach, out) {
    const x = dx * R, y = dy * R, z = dz * R;
    const v = n(x / 700 + 5.5, y / 700, z / 700 - 3.3) * 0.5 + 0.5;
    const feucht = n(x / 9000 - 1.1, y / 9000 + 8.8, z / 9000) * 0.5 + 0.5;
    const h = p.h;
    if (p.wasser > h + 0.02) {
      const t = glatt(0, p.meer ? 300 : 12, p.wasser - h);
      if (p.meer) { out[0] = 0.08 - 0.05 * t; out[1] = 0.36 - 0.24 * t; out[2] = 0.5 - 0.15 * t; }
      else { out[0] = 0.12 - 0.07 * t; out[1] = 0.33 - 0.12 * t; out[2] = 0.38 - 0.02 * t; } // Fluss/See: grünlicher
      return out;
    }
    const wald = glatt(0.45, 0.65, feucht * 0.7 + v * 0.3);
    let r = 0.34 + 0.18 * (1 - feucht) - 0.17 * wald, g = 0.5 + 0.06 * (1 - feucht) - 0.2 * wald, b = 0.2 - 0.06 * wald;
    const sand = p.meer ? 1 - glatt(1.5, 6 + v * 5, h) : 0;            // Strand nur am Meer
    r += (0.78 - r) * sand; g += (0.71 - g) * sand; b += (0.52 - b) * sand;
    const kies = p.ufer * (1 - sand);                                  // Flussufer: Kies/Schlamm
    r += (0.47 - r) * kies; g += (0.43 - g) * kies; b += (0.34 - b) * kies;
    const fels = Math.max(1 - glatt(0.7, 0.85, flach), glatt(1700, 2700, h + v * 300) * (0.4 + 0.6 * p.gebirge));
    const fr = 0.44 + 0.08 * v, fg = 0.41 + 0.06 * v, fb = 0.38 + 0.05 * v;
    r += (fr - r) * fels; g += (fg - g) * fels; b += (fb - b) * fels;
    const schneeGrenze = 2900 - Math.abs(dy) * 2600 + (v - 0.5) * 400;
    const schnee = glatt(schneeGrenze, schneeGrenze + 250, h) * glatt(0.6, 0.78, flach);
    r += (0.94 - r) * schnee; g += (0.95 - g) * schnee; b += (0.97 - b) * schnee;
    out[0] = r; out[1] = g; out[2] = b;
    return out;
  }

  return { radius: R, seed, probe, hoehe, oberflaeche, farbe, G };
}
