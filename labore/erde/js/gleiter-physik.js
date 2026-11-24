// Flugphysik des Gleiters (Paraglider-artig) – reine Logik ohne THREE, Vektoren als Arrays [x, y, z] in Metern.
// Punktmasse mit Auftrieb/Widerstand nach Fluggeschwindigkeit relativ zur Luft, Schwerkraft entlang −oben (oben = p normalisiert),
// also auf der Kugel überall richtig. Steuerung: vor (−1 bremsen … +1 beschleunigen) wählt den Auftriebsbeiwert,
// Kurven fliegt man mit Schräglage (Ziel-Kurs → Querneigung). Zu langsam → Strömungsabriss (sackt durch, fängt sich wieder).
// Dazu: Aufwind-Modell (Thermik, Vulkan, Hangwind, Gewitter-Turbulenz) und Landung (Schaden bei harter Landung).

export const GLEITER = {
  masse: 100,        // kg (Spieler + Schirm)
  flaeche: 25,       // m²
  cd0: 0.0333,       // Grundwiderstand (Leinen, Pilot)
  k: 0.0926,         // induzierter Widerstand: cd = cd0 + k·cl² → beste Gleitzahl 9 bei cl 0,6
  clTrim: 0.6,       // Trimm: ~ 38 km/h, Sinken ~ 1,2 m/s
  clMin: 0.22,       // voll beschleunigt (Stick vor)
  clMax: 1.15,       // voll angebremst (Stick zurück)
  clTau: 0.5,        // s, so schnell folgt der Schirm der Steuerung
  vAbriss: 6.0,      // m/s (Normal-Luftdichte): langsamer → Strömungsabriss
  vErholung: 7.2,    // m/s: schneller → Strömung liegt wieder an
  abrissCl: 0.25, abrissCd: 0.9,
  bankMax: 0.7,      // rad (~40°)
  bankRate: 1.3,     // rad/s
  daempfung: 3,      // pro rad: Auftrieb gegen schnelle Änderung des Bahnwinkels
  lageTau: 1.5,      // s, so träge folgt die Lage des Schirms
  g: 9.81,
};

const RHO0 = 1.225;
/** Luftdichte (kg/m³) in der Höhe h über dem Meer. */
export const luftdichte = (h) => RHO0 * Math.exp(-Math.max(-500, h) / 8500);

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const tangential = (a, n) => add(a, n, -dot(a, n));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/** Neuer Flugzustand an Punkt p (absolut, m) mit Geschwindigkeit v (m/s). */
export function neuerFlug(p, v) {
  return { p: [...p], v: [...v], cl: GLEITER.clTrim, bank: 0, lage: null, abriss: false, fahrt: len(v) };
}

/** Auftriebsbeiwert, den der Stick verlangt (vor +1 = Nase runter/schnell, −1 = bremsen). */
export function clFuer(vor) {
  const G = GLEITER, x = clamp(vor, -1, 1);
  return x >= 0 ? G.clTrim - (G.clTrim - G.clMin) * x : G.clTrim + (G.clMax - G.clTrim) * -x;
}

/**
 * Ein Zeitschritt (intern in ≤ 20-ms-Teilschritten). f mutiert und wird zurückgegeben.
 * e = { R (Planetradius, m), vor, kurs ([3] Wunsch-Richtung, waagerecht), wind ([3] m/s), auf (Aufwind m/s) }
 */
export function schritt(f, dt, e = {}) {
  const G = GLEITER, R = e.R ?? 100_000, wind = e.wind || [0, 0, 0], auf = e.auf || 0;
  const n = Math.max(1, Math.ceil(dt / 0.02)), h = dt / n;
  for (let i = 0; i < n; i++) {
    const oben = norm(f.p);
    const luft = add(tangential(wind, oben), oben, auf);
    const va = add(f.v, luft, -1), s = len(va);
    const rho = luftdichte(len(f.p) - R);
    const sEq = s * Math.sqrt(rho / RHO0);            // „angezeigte“ Fahrt: Abriss hängt an ihr, nicht an der wahren
    if (!f.abriss && sEq < G.vAbriss) f.abriss = true;
    else if (f.abriss && sEq > G.vErholung) f.abriss = false;
    f.fahrt = s;
    // Schirm folgt der Steuerung
    f.cl += (clFuer(e.vor || 0) - f.cl) * Math.min(1, h / G.clTau);
    // Pendel-Stabilität: die Lage des Schirms folgt dem Bahnwinkel nur träge – steigt die Bahn schneller, als die Lage folgt,
    // sinkt der Anstellwinkel (weniger Auftrieb). Das dämpft das Aufschaukeln (Phygoide) nach Böen und Thermik.
    const bahn = Math.asin(clamp(dot(va, oben) / Math.max(s, 1e-3), -1, 1));
    if (f.lage == null) f.lage = bahn;
    f.lage += (bahn - f.lage) * Math.min(1, h / G.lageTau);
    const cl = f.abriss ? G.abrissCl : f.cl * clamp(1 - G.daempfung * (bahn - f.lage), 0.4, 1.6);
    const cd = f.abriss ? G.abrissCd : G.cd0 + G.k * cl * cl;
    const vh = s > 1e-3 ? [va[0] / s, va[1] / s, va[2] / s] : [0, -1, 0].map((_, j) => -oben[j]);
    // Querneigung: zum Wunsch-Kurs hin legen
    const horiz = tangential(vh, oben), hl = len(horiz);
    let bankZiel = 0;
    if (e.kurs && hl > 0.05) {
      const k = norm(tangential(e.kurs, oben)), hv = [horiz[0] / hl, horiz[1] / hl, horiz[2] / hl];
      const fehler = -Math.atan2(dot(oben, cross(hv, k)), dot(hv, k));   // + = rechts
      bankZiel = clamp(1.3 * fehler, -G.bankMax, G.bankMax);
    }
    f.bank += clamp(bankZiel - f.bank, -G.bankRate * h, G.bankRate * h);
    // Auftriebsrichtung: senkrecht zur Anströmung, „oben“ des Schirms um die Querneigung gekippt
    let nr = tangential(oben, vh);
    const nl = len(nr);
    if (nl < 0.5 && e.kurs) nr = tangential(add(nr, e.kurs, 0.5 - nl), vh); // fällt fast senkrecht: Schirm schießt vor
    const nn = norm(nr), rechts = norm(cross(vh, nn));
    const ld = add([nn[0] * Math.cos(f.bank), nn[1] * Math.cos(f.bank), nn[2] * Math.cos(f.bank)], rechts, Math.sin(f.bank));
    const q = 0.5 * rho * s * s * G.flaeche / G.masse;   // dynamischer Druck · Fläche / Masse
    const a = add(add([ld[0] * q * cl, ld[1] * q * cl, ld[2] * q * cl], vh, -q * cd), oben, -G.g);
    f.v = add(f.v, a, h);
    f.p = add(f.p, f.v, h);
  }
  return f;
}

/** Steigen (+) / Sinken (−) in m/s und Fahrt über Grund (waagerecht) in m/s. */
export function messe(f) {
  const oben = norm(f.p), steig = dot(f.v, oben);
  return { steig, grund: len(add(f.v, oben, -steig)) };
}

// ---------- Aufwind ----------
// Glattes Wertrauschen 0…1 (für Thermik-Schläuche, ~ alle 350 m einer)
function hash(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function rauschen(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (i, j, k) => hash(xi + i, yi + j, zi + k);
  return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
/** Thermik-Muster an einem Bodenpunkt (absolut, m): −0,25 (Fallen zwischen den Schläuchen) … 1 (Kern). */
export function thermikMuster(p, zelle = 350) {
  const r = rauschen(p[0] / zelle, p[1] / zelle, p[2] / zelle);
  return r > 0.55 ? ((r - 0.55) / 0.3) ** 0.8 : -0.25 * (1 - r / 0.55);
}

/**
 * Aufwind (m/s, + = steigt) aus Gelände und Wetter.
 * u = { sonneHoch (Sonne·oben), hangSonne (Hangnormale·Sonne), steil (|Höhengradient|), dunkel 0…1, wolken 0…1,
 *       agl (m über Grund), ueberWasser, vulkan 0…1, lava 0…1, kraterNah 0…1 (Lava im Umkreis ~700 m), hangwind (Wind·Gradient, m/s), muster (−0,25…1),
 *       gewitter (bool), t (s), turb (−1…1, Rauschen) }
 */
export function aufwind(u) {
  const agl = Math.max(0, u.agl || 0);
  let w = 0;
  // Thermik über sonnigen, steilen, dunklen Hängen am Tag
  const tag = clamp(((u.sonneHoch ?? 0) - 0.3) / 0.4, 0, 1);
  if (tag > 0 && !u.ueberWasser) {
    const heiz = tag * Math.max(0, u.hangSonne ?? 0) * (0.6 + 0.8 * (u.dunkel ?? 0.5)) *
      (0.4 + Math.min(1, (u.steil ?? 0) * 2.5)) * (1 - 0.7 * (u.wolken ?? 0));
    const deckel = 400 + 1600 * heiz;                         // so hoch reicht die Thermik
    const hoch = clamp(agl / 40, 0, 1) * clamp((deckel - agl) / 250, 0, 1);
    w += 3.6 * heiz * (u.muster ?? 0.5) * hoch;
  }
  // Vulkan: warme dunkle Flanken, über dem Krater kräftig
  const v = u.vulkan || 0, l = u.lava || 0, kn = u.kraterNah || 0;
  if (v > 0 || l > 0 || kn > 0) w += (1.0 * v + 2.5 * kn + 5 * l) * clamp((3000 - agl) / 1500, 0, 1);
  // Hangwind: Wind gegen den Hang wird hochgedrückt (Lee: fällt), nimmt mit der Höhe ab
  if (u.hangwind) w += clamp(u.hangwind, -3, 4) * Math.exp(-agl / 300);
  // Gewitter: kräftige, wechselnde Böen
  if (u.gewitter) w += 3 * (u.turb ?? 0) + 0.8;
  return w;
}

// ---------- Landung ----------
/** Schaden beim Aufsetzen: sinkt (m/s, positiv) > 9 oder fahrt (m/s über Grund) > 18 → Schaden, sonst 0. */
export function landeSchaden(sinkt, fahrt, wasser = false) {
  const zuViel = Math.max(0, sinkt - 9) * 7 + Math.max(0, fahrt - 18) * 3;
  if (zuViel <= 0) return 0;
  return Math.round((zuViel + 6) * (wasser ? 0.4 : 1));
}
/** Fallschaden ohne Gleiter: fallV (m/s, negativ) beim Aufsetzen; ab −14 m/s (~10 m tief) tut es weh. */
export function fallSchaden(fallV) {
  return fallV < -14 ? Math.round((-14 - fallV) * 6 + 4) : 0;
}
