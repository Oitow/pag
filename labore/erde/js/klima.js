// Klima → Biom und Bewuchs (reine Logik, ohne THREE). Gemeinsam für Bodenfarbe (planet-hoehe) und Streuung (natur-streu),
// damit Wald auf der Karte und Bäume am Boden zusammenpassen.
// T = Temperatur in °C am Ort (Meereshöhe-Temperatur − 6,5 °C je km), F = Feuchte 0…1.

const glatt = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export const BIOM = Object.freeze({ EIS: 0, TUNDRA: 1, NADELWALD: 2, MISCHWALD: 3, LAUBWALD: 4, GRASLAND: 5, STEPPE: 6, WUESTE: 7, SAVANNE: 8, REGENWALD: 9 });
export const BIOM_NAME = ['Eis', 'Tundra', 'Nadelwald', 'Mischwald', 'Laubwald', 'Grasland', 'Steppe', 'Wüste', 'Savanne', 'Regenwald'];

/** Temperatur am Ort aus Meereshöhe-Temperatur und Höhe (m). */
export const tempAm = (t0, h) => t0 - 0.0065 * Math.max(0, h);

/** Biom (Index) – grob nach Whittaker. */
export function biom(T, F) {
  if (T < -8) return BIOM.EIS;
  if (T < -1) return BIOM.TUNDRA;
  if (T < 6) return F > 0.38 ? BIOM.NADELWALD : BIOM.TUNDRA;
  if (T < 14) return F > 0.55 ? BIOM.MISCHWALD : F > 0.3 ? BIOM.GRASLAND : BIOM.STEPPE;
  if (T < 20) return F > 0.6 ? BIOM.LAUBWALD : F > 0.32 ? BIOM.GRASLAND : F > 0.18 ? BIOM.STEPPE : BIOM.WUESTE;
  return F > 0.66 ? BIOM.REGENWALD : F > 0.36 ? BIOM.SAVANNE : F > 0.2 ? BIOM.STEPPE : BIOM.WUESTE;
}

/** Walddichte 0…1 (stetig): braucht Feuchte und Wärme über der Baumgrenze. v = Fleckenrauschen 0…1. */
export function waldDichte(T, F, v = 0.5) {
  const feucht = glatt(0.3 + 0.25 * glatt(16, 26, T), 0.62 + 0.1 * glatt(16, 26, T), F + (v - 0.5) * 0.3);
  return feucht * glatt(-2.5, 2.5, T);
}

/** Anteil Nadelbäume 0…1 (kalt = Nadel, warm = Laub). */
export const nadelAnteil = (T) => 1 - glatt(4, 13, T);

/** Bodenfarbe (ohne Fels/Schnee/Strand) nach Klima, stetig. v = Fleckenrauschen 0…1. */
export function bodenFarbe(T, F, v, out) {
  const trocken = 1 - glatt(0.15, 0.7, F);
  // Gras: frisch → gelblich je trockener
  let r = 0.3 + 0.3 * trocken, g = 0.48 + 0.04 * trocken, b = 0.16 + 0.1 * trocken;
  // heiße Wüste: Sand
  const wueste = glatt(0.24, 0.1, F) * glatt(10, 18, T);
  r += (0.8 - r) * wueste; g += (0.67 - g) * wueste; b += (0.45 - b) * wueste;
  // Tundra: braun-oliv
  const tundra = glatt(3, -2, T);
  r += (0.44 - r) * tundra; g += (0.43 - g) * tundra; b += (0.3 - b) * tundra;
  // Wald dunkelt ab, Nadel dunkler/bläulicher als Laub
  const w = waldDichte(T, F, v), na = nadelAnteil(T);
  const wr = 0.13 + 0.06 * (1 - na), wg = 0.27 + 0.1 * (1 - na), wb = 0.16 - 0.04 * (1 - na);
  r += (wr - r) * w * 0.85; g += (wg - g) * w * 0.85; b += (wb - b) * w * 0.85;
  out[0] = r + (v - 0.5) * 0.05; out[1] = g + (v - 0.5) * 0.05; out[2] = b + (v - 0.5) * 0.03;
  return out;
}

// ---------- Zeit: Sonnenstand und Temperatur im Tages- und Jahresgang ----------
// Drehachse des Planeten = y. Länge λ = atan2(z, x) (wie die Karte), Breite φ = asin(y).
// stunde = Uhrzeit bei λ = 0 (0…24); Ortszeit = stunde + λ/2π·24. jahr = Anteil 0…1 (0 = Frühlingsanfang Nord).
const NEIGUNG = 23.4 * Math.PI / 180;

/** Ortszeit (Stunden 0…24) an Richtung d zur Weltuhr `stunde`. */
export function ortszeit(stunde, d) {
  const lon = Math.atan2(d[2], d[0]);
  return (((stunde + lon / (2 * Math.PI) * 24) % 24) + 24) % 24;
}
/** Weltuhr, bei der am Ort d die Ortszeit `ziel` ist. */
export const uhrFuer = (ziel, d) => (((ziel - Math.atan2(d[2], d[0]) / (2 * Math.PI) * 24) % 24) + 24) % 24;

/** Richtung zur Sonne (Einheitsvektor) für Weltuhr und Jahresanteil. */
export function sonnenRichtung(stunde, jahr, out = [0, 0, 0]) {
  const dek = NEIGUNG * Math.sin(2 * Math.PI * jahr);           // Deklination: Sommer Nord = +
  const lonS = (12 - stunde) / 24 * 2 * Math.PI;                // wo gerade Mittag ist
  out[0] = Math.cos(dek) * Math.cos(lonS); out[1] = Math.sin(dek); out[2] = Math.cos(dek) * Math.sin(lonS);
  return out;
}

/**
 * Temperatur jetzt (°C): Jahresmittel am Ort (tempAm) + Jahreszeit (stärker in hohen Breiten, Süden umgekehrt)
 * + Tagesgang (Max ~15 Uhr, trockene Luft schwankt stärker) + Wetter (Wolken dämpfen den Tag, Regen kühlt).
 */
export function tempJetzt(tMittel, d, stunde, jahr, feuchte = 0.5, wetter = null) {
  const breite = Math.asin(Math.max(-1, Math.min(1, d[1])));
  const jahresAmp = 2 + 15 * Math.abs(Math.sin(breite)) * (1.1 - 0.4 * feuchte);
  const sommer = Math.sin(2 * Math.PI * (jahr - 0.06)) * Math.sign(breite || 1);   // Höhepunkt etwas nach der Sonnenwende
  const tagAmp = (3 + 6 * (1 - feuchte)) * (1 - 0.6 * (wetter?.wolken ?? 0));
  const tag = Math.cos(2 * Math.PI * (ortszeit(stunde, d) - 15) / 24);
  return tMittel + jahresAmp * sommer + tagAmp * tag - 3 * (wetter?.regen ?? 0);
}
