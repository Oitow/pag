// Dämmerwald – Plan als reine Daten (ohne THREE): Pfad (x als glatte Funktion von z), Orte, Riesen-Varianten, Helden-Bäume, gestreute Riesen.
// Meter, y oben, Ufer bei z ≈ 0, Wasser im Süden (z < 0), der Pfad läuft nach Norden (+z). Bauplan: docs/plaene/WELT-DAEMMERWALD.md §1–§2.
import { rng, hashSeed } from '../../../engine/core/rng.js';

export const WELT = { xMin: -140, xMax: 140, zMin: -40, zMax: 470, seed: hashSeed('daemmerwald', 1) };
export const PFAD_BREITE = 3.0;
export const PFAD_ENDE = 430;

// Stützpunkte [z, x] – streng wachsend in z; dazwischen Catmull-Rom (C1-stetig)
export const PFAD_PUNKTE = [[-6, 0], [0, 0], [30, 3], [70, -4], [115, -14], [160, -6], [205, 10], [250, 16], [300, 6], [350, -8], [400, 0], [PFAD_ENDE, 0], [460, 0]];

function abschnitt(z) {
  const p = PFAD_PUNKTE;
  let i = 1;
  while (i < p.length - 3 && z > p[i + 1][0]) i++;
  return i;
}
const steig = (i) => (PFAD_PUNKTE[i + 1][1] - PFAD_PUNKTE[i - 1][1]) / (PFAD_PUNKTE[i + 1][0] - PFAD_PUNKTE[i - 1][0]);

/** x der Pfad-Mitte bei z (außerhalb der Enden festgehalten). */
export function pfadX(z) {
  const p = PFAD_PUNKTE;
  z = Math.min(Math.max(z, p[1][0]), p[p.length - 2][0]);
  const i = abschnitt(z), a = p[i], b = p[i + 1], l = b[0] - a[0], t = (z - a[0]) / l;
  const m0 = steig(i) * l, m1 = steig(i + 1) * l, t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * a[1] + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * b[1] + (t3 - t2) * m1;
}
/** dx/dz der Pfad-Mitte. */
export const pfadSteigung = (z) => (pfadX(z + 0.25) - pfadX(z - 0.25)) / 0.5;
/** Laufrichtung als Yaw (0 = +z, yaw = atan2(x, z)). */
export const pfadYaw = (z) => Math.atan2(pfadSteigung(z), 1);
/** Abstand (m) eines Punkts zur Pfad-Mitte (Näherung über die Steigung, genau genug bei flachen Kurven). */
export function pfadAbstand(x, z) {
  if (z < 0) return Math.hypot(x - pfadX(0), z);
  if (z > PFAD_ENDE) return Math.hypot(x - pfadX(PFAD_ENDE), z - PFAD_ENDE);
  const s = pfadSteigung(z);
  return Math.abs(x - pfadX(z)) / Math.sqrt(1 + s * s);
}
/** Punkt neben dem Pfad: seitlich > 0 = rechts in Laufrichtung (−x bei Blick nach Norden). */
export function nebenPfad(z, seitlich) {
  const s = pfadSteigung(z), l = Math.sqrt(1 + s * s);
  return { x: pfadX(z) - seitlich / l, z: z + seitlich * s / l };
}

export const LICHTUNG = { x: 0, z: 402, radius: 26 };
// Gestürzter Riese quer über dem Pfad; der Pfad führt durch die Bruchstelle (Kerbe).
export const STAMM = { x: pfadX(250), z: 250, winkel: 0.16, radius: 5.2, laenge: 96, kerbe: 5.5 };

// Orte: Stelle der Figur + Kamera (yaw = Blickrichtung, pitch < 0 = Kamera tief, schaut nach oben)
const ort = (id, name, z, extra = {}) => ({ id, name, x: pfadX(z), z, yaw: pfadYaw(z), pitch: -0.1, distanz: 14, ...extra });
export const ORTE = [
  ort('ufer', 'Das stille Ufer', 5, { pitch: -0.1, distanz: 13 }),
  ort('tor', 'Tor der Alten', 57, { pitch: -0.12, distanz: 14 }),
  ort('bogen', 'Der Wurzelbogen', 138, { pitch: -0.1, distanz: 14 }),
  ort('stamm', 'Der gestürzte Riese', 226, { pitch: -0.1, distanz: 15 }),
  ort('lichtung', 'Die Lichtung', 382, { pitch: -0.1, distanz: 15 }),
];
// Wegmarken laut Bauplan §2 (z der Sehenswürdigkeit selbst)
export const MARKEN = { ufer: 0, tor: 70, bogen: 160, stamm: 250, lichtung: 400 };

// Riesen-Varianten (Maße §1). Die letzte hat den Wurzelbogen und steht genau einmal (Ort „bogen“).
export const RIESEN_VARIANTEN = [
  { seed: 11, hoehe: 112, stammRadius: 5.6, wurzeln: 7, wurzelWeite: 22 },
  { seed: 23, hoehe: 128, stammRadius: 6.4, wurzeln: 8, wurzelWeite: 26 },
  { seed: 37, hoehe: 96, stammRadius: 4.8, wurzeln: 6, wurzelWeite: 18 },
  { seed: 41, hoehe: 138, stammRadius: 6.8, wurzeln: 9, wurzelWeite: 27 },
  { seed: 53, hoehe: 118, stammRadius: 6.0, wurzeln: 7, wurzelWeite: 24, bogen: true },
];
export const BOGEN_VARIANTE = 4;

// Helden-Bäume von Hand: [x relativ zum Pfad (seitlich, + = rechts/−x), z, Variante, Drehung, Skala]
const held = (seitlich, z, variante, drehung, skala = 1, extra = {}) => ({ ...nebenPfad(z, seitlich), variante, drehung, skala, held: true, ...extra });
const fest = (x, z, variante, drehung, skala = 1) => ({ x, z, variante, drehung, skala, held: true });
export const HELDEN = [
  // Baumwand hinter dem Strand
  fest(-118, 36, 1, 0.4, 1.0), fest(-86, 28, 0, 2.1, 1.1), fest(-57, 38, 3, 4.0, 0.95), fest(-36, 24, 2, 1.2, 1.15), fest(-25, 47, 0, 5.2, 0.9),
  fest(29, 31, 1, 3.3, 1.0), fest(53, 40, 2, 0.9, 1.2), fest(82, 27, 3, 2.7, 0.9), fest(113, 37, 0, 4.6, 1.05),
  // Tor der Alten: zwei Riesen links/rechts
  held(-11.5, 69, 3, 0.6, 1.05), held(11.0, 72, 1, 3.6, 1.1),
  // Wurzelbogen (Lage wird beim Bau über masse.bogen nachgeführt – siehe wald.js)
  held(13, 160, BOGEN_VARIANTE, 0, 1.0, { bogen: true }),
  held(-15, 150, 0, 1.9, 1.1),
  // am gestürzten Riesen
  held(-17, 232, 1, 2.4, 1.0), held(19, 272, 3, 5.0, 1.0),
  // Kranz um die Lichtung
  ...[0.55, 1.25, 2.0, 2.7, 3.55, 4.3, 5.05, 5.75].map((w, i) => fest(LICHTUNG.x + Math.sin(w) * (40 + (i % 3) * 4), LICHTUNG.z + Math.cos(w) * (40 + (i % 3) * 4), i % 4, w * 2.3, 0.95 + (i % 3) * 0.1))
    .filter((b) => pfadAbstand(b.x, b.z) > 13),
];

export const stammRadiusVon = (b) => RIESEN_VARIANTEN[b.variante].stammRadius * b.skala;

/** Abstand eines Punkts zur Achse des gestürzten Stamms (für Sperrzonen). */
export function stammAbstand(x, z) {
  const c = Math.cos(STAMM.winkel), s = Math.sin(STAMM.winkel), dx = x - STAMM.x, dz = z - STAMM.z;
  const laengs = dx * c + dz * s, quer = -dx * s + dz * c;
  return { laengs, quer, aussen: Math.max(Math.abs(laengs) - STAMM.laenge / 2, 0) };
}

/** Alle Riesen: Helden + per Seed gestreute (Mindestabstände zu Pfad, Lichtung, gestürztem Stamm und untereinander). Deterministisch. */
export function riesenListe({ seed = WELT.seed, anzahl = 46 } = {}) {
  const r = rng(hashSeed('riesen', seed)), liste = HELDEN.map((b) => ({ ...b }));
  for (let versuch = 0; versuch < 6000 && liste.length < anzahl; versuch++) {
    const x = WELT.xMin + 4 + r() * (WELT.xMax - WELT.xMin - 8), z = 52 + r() * (WELT.zMax - 56);
    const variante = Math.floor(r() * 4), skala = 0.85 + r() * 0.35, drehung = r() * Math.PI * 2;
    const radius = RIESEN_VARIANTEN[variante].stammRadius * skala;
    if (pfadAbstand(x, z) < radius + 7) continue;
    if (Math.hypot(x - LICHTUNG.x, z - LICHTUNG.z) < LICHTUNG.radius + 12) continue;
    const sa = stammAbstand(x, z);
    if (sa.aussen < 8 && Math.abs(sa.quer) < STAMM.radius + radius + 6) continue;
    if (liste.some((b) => Math.hypot(b.x - x, b.z - z) < 27)) continue;
    liste.push({ x, z, variante, drehung, skala, held: false });
  }
  return liste;
}
