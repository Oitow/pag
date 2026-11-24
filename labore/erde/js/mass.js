// Maße und Kugel-Mathe für das Erde-Labor (reine Logik, ohne THREE).
// Koordinaten: Heimatpunkt = Ursprung (0,0,0), oben = +Y, Erdmitte = (0, -R, 0).
// So bleiben Zahlen in Spielernähe klein und genau (Float32 auf der GPU).

export const R_ERDE = 6_371_000;        // m, mittlerer Erdradius
export const R_MOND = 1_737_400;        // m
export const MOND_ABSTAND = 384_400_000; // m, Mitte zu Mitte
export const ISS_HOEHE = 408_000;       // m
export const H_MIN = 1.5;               // m, tiefste Kamerahöhe
export const H_MAX = 1.2e9;             // m, weit genug für Erde + Mond

/** Sichtweite bis zum Horizont aus Höhe h (Meter). */
export function horizont(h, R = R_ERDE) {
  return Math.sqrt(h * (2 * R + h));
}

/** Wie weit sinkt der Boden nach d Metern unter die Waagerechte (Erdkrümmung)? Numerisch stabil. */
export function absinken(d, R = R_ERDE) {
  if (d >= R) return R;
  return (d * d) / (R + Math.sqrt(R * R - d * d));
}

/**
 * Punkt auf der echten Kugel, ost/nord Meter (Bogenlänge) vom Heimatpunkt.
 * Gibt Lage (relativ zum Heimatpunkt) und Oberflächen-Normale zurück.
 */
export function oberflaeche(ost, nord, R = R_ERDE) {
  const s = Math.hypot(ost, nord);
  if (s === 0) return { x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0 };
  const a = s / R, ex = ost / s, ez = -nord / s; // Norden = -Z
  const sa = Math.sin(a), hs = Math.sin(a / 2);
  return {
    x: R * sa * ex, y: -2 * R * hs * hs, z: R * sa * ez,
    nx: sa * ex, ny: Math.cos(a), nz: sa * ez,
  };
}

/** Regler 0…1 ↔ Höhe (logarithmisch, von 1,5 m bis jenseits des Mondes). */
export const reglerZuHoehe = (t) => H_MIN * (H_MAX / H_MIN) ** t;
export const hoeheZuRegler = (h) => Math.log(h / H_MIN) / Math.log(H_MAX / H_MIN);

/** Länge lesbar auf Deutsch. */
export function laenge(m) {
  const f = (x, d) => x.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
  if (m < 10) return f(m, 1) + ' m';
  if (m < 1000) return f(m, 0) + ' m';
  if (m < 100_000) return f(m / 1000, 1) + ' km';
  return f(m / 1000, 0) + ' km';
}

/** Sprungmarken (?ort=…): Höhe h, Blickneigung el (Grad), Richtung az (Grad). */
export const ORTE = {
  mensch:   { name: 'Mensch',   h: 7,           el: 6,  az: 35,  um: [0, 0, 1.2] },
  baum:     { name: 'Baum',     h: 70,          el: 10, az: 40,  um: [14, 9, 10] },
  turm:     { name: 'Turm',     h: 1100,        el: 10, az: 30,  um: [350, 500, 160] },
  berg:     { name: 'Berg',     h: 75_000,      el: 8,  az: 20,  um: [25_000, 60_000, 4000] },
  flugzeug: { name: 'Flugzeug', h: 10_000,      el: 60, az: 30 },
  iss:      { name: 'ISS',      h: ISS_HOEHE,   el: 70, az: 30 },
  orbit:    { name: 'Erde',     h: 25_000_000,  el: 80, az: 30 },
  mond:     { name: 'Mond',     h: 800_000_000, el: 15, az: 115 },
};
