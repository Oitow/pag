// Würfel-Kugel + Quadtree (reine Logik, ohne THREE).
// Der Planet ist ein aufgeblasener Würfel: 6 Seiten, jede ein Quadtree aus Kacheln.
// Kachel = { f: Seite 0…5, L: Stufe (0 = ganze Seite), ix, iy } → Schlüssel "f/L/ix/iy".

// Seiten: Normale n, Achse a (u), Achse b (v), a × b = n (damit die Dreiecke nach außen zeigen)
export const SEITEN = [
  { n: [1, 0, 0], a: [0, 0, -1], b: [0, 1, 0] },
  { n: [-1, 0, 0], a: [0, 0, 1], b: [0, 1, 0] },
  { n: [0, 1, 0], a: [1, 0, 0], b: [0, 0, -1] },
  { n: [0, -1, 0], a: [1, 0, 0], b: [0, 0, 1] },
  { n: [0, 0, 1], a: [1, 0, 0], b: [0, 1, 0] },
  { n: [0, 0, -1], a: [-1, 0, 0], b: [0, 1, 0] },
];

/** Punkt (u,v ∈ [-1,1]) auf Würfelseite f → Richtung auf der Einheitskugel (gleichmäßig „aufgeblasen“). */
export function wuerfelZuKugel(f, u, v, out = [0, 0, 0]) {
  const s = SEITEN[f];
  const x = s.n[0] + u * s.a[0] + v * s.b[0];
  const y = s.n[1] + u * s.a[1] + v * s.b[1];
  const z = s.n[2] + u * s.a[2] + v * s.b[2];
  const x2 = x * x, y2 = y * y, z2 = z * z;
  out[0] = x * Math.sqrt(1 - y2 / 2 - z2 / 2 + (y2 * z2) / 3);
  out[1] = y * Math.sqrt(1 - z2 / 2 - x2 / 2 + (z2 * x2) / 3);
  out[2] = z * Math.sqrt(1 - x2 / 2 - y2 / 2 + (x2 * y2) / 3);
  return out;
}

export const schluessel = (k) => `${k.f}/${k.L}/${k.ix}/${k.iy}`;

/** u/v-Bereich einer Kachel. */
export function kachelUV(k) {
  const s = 2 / (1 << k.L);
  return { u0: -1 + k.ix * s, v0: -1 + k.iy * s, s };
}

/** Mittelpunkt-Richtung und ungefähre Kantenlänge (m) einer Kachel. */
export function kachelMitte(k, R) {
  const { u0, v0, s } = kachelUV(k);
  const d = wuerfelZuKugel(k.f, u0 + s / 2, v0 + s / 2);
  const kante = (R * Math.PI / 2) / (1 << k.L);
  return { d, kante };
}

/** Ist k1 Vorfahre von k2 (oder gleich)? */
export function enthaelt(k1, k2) {
  if (k1.f !== k2.f || k1.L > k2.L) return false;
  const sh = k2.L - k1.L;
  return (k2.ix >> sh) === k1.ix && (k2.iy >> sh) === k1.iy;
}

/**
 * Welche Kacheln braucht man für eine Kamera bei Position p (Meter, Planetenmitte = 0)?
 * Kacheln hinter dem Horizont werden nicht weiter geteilt und als `verdeckt` markiert.
 * opts: R, maxStufe, teilung (Abstand < teilung · Kante → teilen), maxBerg (m, für den Horizont),
 *       hBoden (m, Geländehöhe unter der Kamera: Kachelmitten liegen auf dieser Höhe statt auf Meereshöhe –
 *       sonst bekäme man auf Hochebenen nie die feinste Stufe)
 */
// fein(k) → true: Kachel darf noch 1 Stufe feiner werden (Grabstellen: ~0,3 m Punktabstand nah an der Kamera)
export function waehleKacheln(p, { R, maxStufe, teilung = 1.8, maxBerg = 4500, hBoden = 0, fein = null }) {
  const lp = Math.hypot(p[0], p[1], p[2]);
  const pd = [p[0] / lp, p[1] / lp, p[2] / lp];
  // Horizont: bis wohin sieht man? Großzügig, damit Berge hinter der Kante nicht fehlen.
  const hor = Math.acos(Math.min(1, R / Math.max(lp, R + 1))) + Math.acos(R / (R + maxBerg));
  const raus = [];
  const stapel = [];
  for (let f = 0; f < 6; f++) stapel.push({ f, L: 0, ix: 0, iy: 0 });
  while (stapel.length) {
    const k = stapel.pop();
    const { d, kante } = kachelMitte(k, R);
    const winkelKachel = (kante / R) * 0.75;
    const cosW = d[0] * pd[0] + d[1] * pd[1] + d[2] * pd[2];
    const verdeckt = Math.acos(Math.max(-1, Math.min(1, cosW))) > hor + winkelKachel;
    const rb = R + hBoden;
    const dist = Math.hypot(d[0] * rb - p[0], d[1] * rb - p[1], d[2] * rb - p[2]);
    if (!verdeckt && dist < teilung * kante && (k.L < maxStufe || (fein && k.L < maxStufe + 1 && fein(k)))) {
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++)
        stapel.push({ f: k.f, L: k.L + 1, ix: k.ix * 2 + i, iy: k.iy * 2 + j });
    } else {
      raus.push({ ...k, key: schluessel(k), dist, verdeckt });
    }
  }
  return raus;
}

/** Höchste sinnvolle Stufe, damit der Punktabstand bei `zellen` Zellen je Kachel etwa `zielAbstand` m ist. */
export function maxStufeFuer(R, zellen, zielAbstand) {
  return Math.max(0, Math.ceil(Math.log2((R * Math.PI / 2) / (zellen * zielAbstand))));
}
