// Riesenjagd – Seil-Haken (reine Logik, ohne THREE): Pendel am Seil, Einholen mit Gas wie in Attack on Titan, Luftsteuerung.
// Zustand: { pos {x,y,z}, vel {x,y,z}, anker {x,y,z}|null, laenge }. Alles in Metern und Sekunden, Mensch = 1.8 m.

export const HAKEN = Object.freeze({
  reichweite: 95,      // so weit fliegt der Haken
  schwere: 22,         // m/s² – etwas mehr als echt, damit Schwünge knackig wirken
  gas: 34,             // m/s² Zug zum Anker beim Einholen
  einholTempo: 26,     // m/s – so schnell wird das Seil höchstens kürzer
  luftSteuer: 7,       // m/s² seitlich mit dem Stick in der Luft
  luftWiderstand: 0.06,
  maxTempo: 48,
  minLaenge: 2.2,      // näher am Anker hängt man fest (Ziel erreicht)
});

const laengeVon = (x, y, z) => Math.sqrt(x * x + y * y + z * z);

/** Neuer Zustand. */
export function createSeil(pos = { x: 0, y: 0, z: 0 }, vel = { x: 0, y: 0, z: 0 }) {
  return { pos: { ...pos }, vel: { ...vel }, anker: null, laenge: 0 };
}

/** Haken setzen: Seillänge = aktueller Abstand (man fällt erst ins Pendel). */
export function hakeEin(s, anker) {
  s.anker = { x: anker.x, y: anker.y, z: anker.z };
  s.laenge = Math.max(HAKEN.minLaenge, laengeVon(anker.x - s.pos.x, anker.y - s.pos.y, anker.z - s.pos.z));
  return s;
}

export function loese(s) { s.anker = null; s.laenge = 0; return s; }

/** Anker wandert mit (z. B. am laufenden Riesen). */
export function bewegeAnker(s, p) { if (s.anker) { s.anker.x = p.x; s.anker.y = p.y; s.anker.z = p.z; } }

/**
 * Ein Schritt. eingabe: { einholen: bool, steuer: {x,z} (Welt, Länge ≤ 1) }, k = HAKEN-Werte (überschreibbar).
 * → { amZiel: bool } – amZiel = beim Einholen am Anker angekommen.
 */
export function schritt(s, dt, eingabe = {}, k = HAKEN) {
  const v = s.vel, p = s.pos;
  v.y -= k.schwere * dt;
  const st = eingabe.steuer;
  if (st) { v.x += st.x * k.luftSteuer * dt; v.z += st.z * k.luftSteuer * dt; }
  let amZiel = false;
  if (s.anker) {
    const a = s.anker;
    let dx = a.x - p.x, dy = a.y - p.y, dz = a.z - p.z;
    const d = laengeVon(dx, dy, dz) || 1e-6;
    dx /= d; dy /= d; dz /= d;
    if (eingabe.einholen) {
      v.x += dx * k.gas * dt; v.y += dy * k.gas * dt + k.schwere * 0.55 * dt; v.z += dz * k.gas * dt;   // Gas trägt teilweise gegen die Schwere
      s.laenge = Math.max(k.minLaenge, Math.min(s.laenge, d) - k.einholTempo * dt);
      if (d <= k.minLaenge + 0.6) amZiel = true;
    }
  }
  const tempo = laengeVon(v.x, v.y, v.z), daempf = Math.max(0, 1 - k.luftWiderstand * dt);
  const kappe = tempo > k.maxTempo ? k.maxTempo / tempo : 1;
  v.x *= daempf * kappe; v.y *= daempf * kappe; v.z *= daempf * kappe;
  p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt;
  if (s.anker) {   // Seil ist straff: zurück auf die Kugel, Geschwindigkeit nach außen weg
    const a = s.anker, ox = p.x - a.x, oy = p.y - a.y, oz = p.z - a.z, d = laengeVon(ox, oy, oz);
    if (d > s.laenge && d > 1e-6) {
      const nx = ox / d, ny = oy / d, nz = oz / d;
      p.x = a.x + nx * s.laenge; p.y = a.y + ny * s.laenge; p.z = a.z + nz * s.laenge;
      const radial = v.x * nx + v.y * ny + v.z * nz;
      if (radial > 0) { v.x -= radial * nx; v.y -= radial * ny; v.z -= radial * nz; }
    }
  }
  return { amZiel };
}

/** Strahl gegen senkrechten Kegelstumpf-Stamm (Achse bei x,z; Radius r(y)). → { t, x, y, z, nx, nz } | null. Für Haken-Ziele. */
export function strahlStamm(von, richtung, stamm, maxT = HAKEN.reichweite) {
  // in kleinen Schritten den Abstand zur Achse prüfen (Radius ändert sich mit der Höhe) – 2 Phasen: grob, dann halbieren
  let vorher = 0, tf = -1;
  const schrittW = 1.5;
  for (let t = 0; t <= maxT; t += schrittW) {
    const x = von.x + richtung.x * t, y = von.y + richtung.y * t, z = von.z + richtung.z * t;
    if (y < stamm.fuss || y > stamm.oben) { vorher = t; continue; }
    if (Math.hypot(x - stamm.x, z - stamm.z) <= stamm.radius(y - stamm.fuss)) { tf = t; break; }
    vorher = t;
  }
  if (tf < 0) return null;
  let a = vorher, b = tf;
  for (let i = 0; i < 10; i++) {
    const m = (a + b) / 2, x = von.x + richtung.x * m, y = von.y + richtung.y * m, z = von.z + richtung.z * m;
    if (y >= stamm.fuss && y <= stamm.oben && Math.hypot(x - stamm.x, z - stamm.z) <= stamm.radius(y - stamm.fuss)) b = m; else a = m;
  }
  const x = von.x + richtung.x * b, y = von.y + richtung.y * b, z = von.z + richtung.z * b;
  const h = Math.hypot(x - stamm.x, z - stamm.z) || 1;
  return { t: b, x, y, z, nx: (x - stamm.x) / h, nz: (z - stamm.z) / h };
}

/** Stamm-Radius über der Höhe h (Wurzelanlauf unten, verjüngt nach oben) für einen Riesen mit Grundradius r und Höhe H. */
export function stammProfil(r, H) {
  const P = [[0, 2.1], [1.6, 1.45], [5, 1.15], [11, 1.02], [22, 0.95], [H * 0.55, 0.8], [H * 0.85, 0.55], [H, 0.4]];
  return (h) => {
    if (h <= 0) return r * P[0][1];
    for (let i = 1; i < P.length; i++) if (h <= P[i][0]) { const [h0, a] = P[i - 1], [h1, b] = P[i]; return r * (a + (b - a) * (h - h0) / (h1 - h0)); }
    return r * P[P.length - 1][1];
  };
}
