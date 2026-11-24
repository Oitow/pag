// Höhe und Farbe eines erfundenen Planeten (reine Logik, ohne THREE, läuft auch im Worker).
// Eingabe: Richtung (Einheitsvektor von der Planetenmitte). Alles aus dem Seed, nichts gespeichert.
// `feinste` = kleinste Wellenlänge in Metern, die noch berechnet wird (grobe Kacheln sparen Oktaven).
import { createNoise3D } from '../../../engine/core/noise.js';

const glatt = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function createPlanetHoehe({ seed = 1, radius = 100_000 } = {}) {
  const n = createNoise3D(seed);
  const R = radius;
  // Größen relativ zum Radius (bei 100 km: Kontinente ~35 km, Berge ~9 km, Hügel ~1,5 km)
  const S = R / 100_000;
  const W_KONT = 35_000 * S, W_WARP = 20_000 * S, W_BERG = 9_000 * S, W_MASKE = 45_000 * S, W_HUEGEL = 1_500, W_FEIN = 60;

  // fBm mit so vielen Oktaven, wie die Auflösung braucht (letzte Oktave weich eingeblendet)
  function fbmBis(x, y, z, welle, feinste, maxOkt, versatz) {
    let sum = 0, amp = 1, norm = 0, w = welle;
    for (let o = 0; o < maxOkt; o++) {
      const gewicht = glatt(feinste, feinste * 2, w);
      if (gewicht <= 0) break;
      const f = 1 / w;
      sum += amp * gewicht * n(x * f + versatz, y * f - versatz, z * f + o * 17.3);
      norm += amp; amp *= 0.5; w *= 0.5;
    }
    return norm ? sum / norm : 0;
  }
  function gratBis(x, y, z, welle, feinste, maxOkt) {
    let sum = 0, amp = 0.5, prev = 1, w = welle;
    for (let o = 0; o < maxOkt; o++) {
      const gewicht = glatt(feinste, feinste * 2, w);
      if (gewicht <= 0) break;
      const f = 1 / w;
      let v = 1 - Math.abs(n(x * f + 91.7, y * f + 3.1, z * f - 47.9 + o * 5.1));
      v *= v;
      sum += v * amp * prev * gewicht; prev = v; amp *= 0.5; w /= 2.1;
    }
    return Math.min(1, sum * 1.1);
  }

  /** Höhe über dem Meeresspiegel (m) und Landanteil. Negativ = Meeresgrund. */
  function probe(dx, dy, dz, feinste = 1) {
    const x = dx * R, y = dy * R, z = dz * R;
    // Kontinente mit verwirbelten Küsten (Domain-Warp)
    const wf = 1 / W_WARP;
    const qx = x + 4000 * S * n(x * wf, y * wf, z * wf);
    const qy = y + 4000 * S * n(x * wf + 31.4, y * wf, z * wf);
    const qz = z + 4000 * S * n(x * wf, y * wf - 12.9, z * wf);
    const kont = fbmBis(qx, qy, qz, W_KONT, feinste, 5, 0) + 0.03;
    const land = glatt(-0.02, 0.12, kont);
    let h = kont < 0 ? kont * 5000 : kont * 900;
    // Gebirge: Grate, nur auf Land und dort, wo die grobe Maske es will
    const mf = 1 / W_MASKE;
    const maske = glatt(0.05, 0.45, n(x * mf - 7.7, y * mf + 2.2, z * mf)) * glatt(0.02, 0.2, kont);
    if (maske > 0) { const g = gratBis(x, y, z, W_BERG, feinste, 7); h += g * g * 3800 * maske; }
    // Hügel und feiner Boden
    h += fbmBis(x, y, z, W_HUEGEL, feinste, 6, 13.7) * 90 * land;
    h += fbmBis(x, y, z, W_FEIN, feinste, 4, 41.1) * 1.6 * land;
    return { h, land };
  }

  const hoehe = (dx, dy, dz, feinste = 1) => probe(dx, dy, dz, feinste).h;

  /**
   * Farbe für Boden: aus Höhe, Hang (1 = flach, 0 = senkrecht), Breite und Rauschen.
   * Schreibt r,g,b (0…1) nach out.
   */
  function farbe(dx, dy, dz, h, flach, out) {
    const x = dx * R, y = dy * R, z = dz * R;
    const v = n(x / 700 + 5.5, y / 700, z / 700 - 3.3) * 0.5 + 0.5;        // Flecken
    const feucht = n(x / 9000 - 1.1, y / 9000 + 8.8, z / 9000) * 0.5 + 0.5;
    const breite = Math.abs(dy);
    let r, g, b;
    if (h < 0) {                                  // Meer: flach = türkis, tief = dunkelblau
      const t = glatt(0, 300, -h);
      r = 0.08 - 0.05 * t; g = 0.36 - 0.24 * t; b = 0.5 - 0.15 * t;
      out[0] = r; out[1] = g; out[2] = b; return out;
    }
    // Wiese → trockenes Gras / Wald je nach Feuchte und Flecken
    const wald = glatt(0.45, 0.65, feucht * 0.7 + v * 0.3);
    r = 0.34 + 0.18 * (1 - feucht) - 0.17 * wald; g = 0.5 + 0.06 * (1 - feucht) - 0.2 * wald; b = 0.2 - 0.06 * wald;
    // Strand
    const sand = 1 - glatt(2, 9 + v * 6, h);
    r += (0.78 - r) * sand; g += (0.71 - g) * sand; b += (0.52 - b) * sand;
    // Fels an Hängen und weit oben
    const fels = Math.max(1 - glatt(0.72, 0.86, flach), glatt(1600, 2600, h + v * 300));
    const fr = 0.44 + 0.08 * v, fg = 0.41 + 0.06 * v, fb = 0.38 + 0.05 * v;
    r += (fr - r) * fels; g += (fg - g) * fels; b += (fb - b) * fels;
    // Schnee: tiefer zu den Polen, nicht an steilen Wänden
    const schneeGrenze = 2900 - breite * 2600 + (v - 0.5) * 400;
    const schnee = glatt(schneeGrenze, schneeGrenze + 250, h) * glatt(0.62, 0.78, flach);
    r += (0.94 - r) * schnee; g += (0.95 - g) * schnee; b += (0.97 - b) * schnee;
    out[0] = r; out[1] = g; out[2] = b;
    return out;
  }

  return { radius: R, seed, hoehe, probe, farbe };
}
