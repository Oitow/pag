/**
 * @modul    figur-kleidung-basis
 * @zweck    Gemeinsame Helfer für Kleidung und Haar der organischen Figur: Farben, Stoffdicke, Haut vermessen (Strahlen ins Abstandsfeld), Knochen-Gewichte (Rumpf, Rock), Glocke mit Saum
 * @api      misch(a,b,t) ; dunkler(c,t) ; heller(c,t) ; GOLD ; LEDER ; stufe(a,b,x) ; masse(ctx) -> { e, L, rx(y), rz(y), T(y,x,z) } ; strahl(form,p,d) -> m ; messeHaut(form, ctx) -> haut ; kegel(n0,nm,n1,tm) -> [ra,rb] ; rumpfGewichte(ctx) ; rockGewichte(ctx, staerke) ; glocke(form, ctx, opts)
 * @beispiel
 *   import { masse, glocke } from './figur-kleidung-basis.js';
 *   const M = masse(ctx);  glocke(form, ctx, { yOben, yUnten, rOben, rUnten, farbe, saum });
 * @tags     figur, charakter, organisch, sdf, kleidung, rock, saum, skinning
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */

/** Farben (Zahlen) mischen: t = 0 → a, 1 → b (wie character-parts-basis, ohne THREE). */
export function misch(a, b, t) {
  const k = (s) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (k(16) << 16) | (k(8) << 8) | k(0);
}
export const dunkler = (c, t) => misch(c, 0, t);
export const heller = (c, t) => misch(c, 0xffffff, t);
export const GOLD = 0xd8b048;
export const LEDER = 0x5a4030;

/** Weicher Übergang 0 → 1 zwischen a und b (a > b erlaubt). */
export function stufe(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Rumpf-Maße im Knochen torso (y = 0 Taille … L Halsansatz), wie die alten Teile:
 * e = Stoffdicke über der Haut, rx(y)/rz(y) = Haut-Halbachsen, T(y, x, z) = Punkt im Torso-Knochen.
 */
export function masse(K) {
  const L = K.m.torsoLaenge, rw = K.taille, rc = K.brust, sz = K.tiefe;
  const rx = (y) => (y < 0.55 * L ? rw + (rc - rw) * Math.max(0, y) / (0.55 * L) : rc * 0.97);
  return { e: Math.max(0.008, 0.0105 * K.g), L, rx, rz: (y) => rx(y) * sz, T: (y, x = 0, z = 0) => K.P('torso', [x, y, z]) };
}

/**
 * Abstand vom Punkt p (innen) entlang Richtung d bis zur Oberfläche der bisherigen Form (Sphere-Tracing von innen).
 * Liegt p schon außen, → 0. So passt sich die Kleidung an jede Anatomie an (Bauch, Muskeln, Kind).
 */
export function strahl(form, p, d, max = 0.6) {
  let t = 0, v = form.abstand(p[0], p[1], p[2]);
  if (v >= 0) return 0;
  for (let i = 0; i < 90 && t < max; i++) {
    t += Math.max(-v, 0.0015);
    v = form.abstand(p[0] + d[0] * t, p[1] + d[1] * t, p[2] + d[2] * t);
    if (v >= 0) return Math.max(0, t - v);
  }
  return t;
}

const norm = (a, b) => { const v = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...v) || 1; return v.map((x) => x / l); };

/**
 * Haut vermessen, BEVOR Kleidung dazukommt. → {
 *   rumpf(y) → { x, vorn, hinten, zc, rz }   Halbbreite, Vorder-/Rückseite und Mitte (z) des Rumpfs in Torso-Höhe y (interpoliert)
 *   becken  → { x, vorn, hinten, zc, rz }   Hüfte inkl. Oberschenkel-Ansatz (0.06·g unter dem Becken-Knochen); becken0 = auf Höhe des Knochens
 *   glied(knochen, yLokal) → Radius (größter Strahl nach vorn/hinten/außen, senkrecht zum Knochen)
 *   fuss(s) → { x, ferse, spitze, halb, oben }   Fuß in Figur-Koordinaten (z von Ferse/Spitze, halbe Breite, Höhe Rist)
 *   hals → Halsradius knapp über dem Ansatz
 * }
 * glied() misst beim ersten Aufruf (die üblichen Stellen werden vorab gemessen, bevor Kleidung dazukommt).
 */
export function messeHaut(form, K) {
  const { P, m, g } = K, L = m.torsoLaenge;
  const quer = (p) => {
    const x = Math.max(strahl(form, p, [1, 0, 0]), strahl(form, p, [-1, 0, 0]));
    // vorn/hinten auch seitlich versetzt messen (Brust, Schulterblätter, Gesäß liegen nicht auf der Mittellinie)
    let vorn = 0, hinten = 0;
    for (const dx of [0, -0.4 * x, 0.4 * x]) {
      const q = [p[0] + dx, p[1], p[2]];
      vorn = Math.max(vorn, strahl(form, q, [0, 0, 1])); hinten = Math.max(hinten, strahl(form, q, [0, 0, -1]));
    }
    return { x, vorn: p[2] + vorn, hinten: hinten - p[2], zc: p[2] + (vorn - hinten) / 2, rz: (vorn + hinten) / 2 };
  };
  const Y = [0, 0.08, 0.3, 0.45, 0.6, 0.78].map((t) => t * L), R = Y.map((y) => quer(K.P('torso', [0, y, 0])));
  // Schulterhöhe: x läuft in die Arme → dort nur vorn/hinten verwenden
  R[5].x = R[4].x;
  const rumpf = (y) => {
    let i = 0;
    while (i < Y.length - 2 && y > Y[i + 1]) i++;
    const t = Math.min(1, Math.max(0, (y - Y[i]) / (Y[i + 1] - Y[i]))), a = R[i], b = R[i + 1], l = (k) => a[k] + (b[k] - a[k]) * t;
    return { x: l('x'), vorn: l('vorn'), hinten: l('hinten'), zc: l('zc'), rz: l('rz') };
  };
  const becken = quer(P('becken', [0, -0.06 * g, 0])), becken0 = quer(P('becken', [0, 0.01 * g, 0]));
  const gl = (kn, y) => {
    const p = P(kn, [0, y, 0]), aus = kn.endsWith('R') ? -1 : 1;
    return Math.max(strahl(form, p, norm(p, P(kn, [0, y, 1]))), strahl(form, p, norm(p, P(kn, [0, y, -1]))), strahl(form, p, norm(p, P(kn, [aus, y, 0]))));
  };
  const cache = new Map();
  const glied = (kn, y) => { const k = kn + ':' + y.toFixed(4); if (!cache.has(k)) cache.set(k, gl(kn, y)); return cache.get(k); };
  const fuesse = {};
  for (const s of ['L', 'R']) {
    const F = 'fuss' + s, h = m.fussHoehe - 0.02 * m.hoehe / 1.75, c = P(F, [0, -h * 0.45, m.fussLaenge * 0.2]), [x] = P(F);
    const spitze = strahl(form, c, [0, 0, 1]), ferse = strahl(form, c, [0, 0, -1]), halb = Math.max(strahl(form, c, [1, 0, 0]), strahl(form, c, [-1, 0, 0]));
    const r = P(F, [0, -h * 0.6, m.fussLaenge * 0.42]), oben = r[1] + strahl(form, r, [0, 1, 0], 0.2);
    fuesse[s] = spitze > 0 ? { x, ferse: c[2] - ferse, spitze: c[2] + spitze, halb, oben }
      : { x, ferse: P(F)[2] - m.fussLaenge * 0.3, spitze: P(F)[2] + m.fussLaenge * 0.72, halb: 0.045 * g, oben: 0.07 * g };
  }
  // Gliedmaßen vorab vermessen (Werte, die Kleidung braucht)
  const O = m.oberschenkel, U = m.unterschenkel, OA = m.oberarm, UA = m.unterarm;
  for (const s of ['L', 'R']) {
    for (const [kn, ys] of [['huefte' + s, [-0.06 * g, -O * 0.45, -O * 0.6, -O]], ['knie' + s, [0, -U * 0.3, -U * 0.5, -U * 0.55]], ['fuss' + s, [0.03 * g]],
      ['schulter' + s, [-OA * 0.3, -OA * 0.88, -OA]], ['ellbogen' + s, [-UA * 0.15, -UA * 0.6, -UA * 0.9]]]) for (const y of ys) glied(kn, y);
  }
  return { rumpf, becken, becken0, fuss: (s) => fuesse[s], glied, hals: glied('hals', 0.01 * g) };
}

/** Kegel-Radien [ra, rb] einer Kapsel, die an t = 0, tm und 1 mindestens n0, nm, n1 umschließt. */
export function kegel(n0, nm, n1, tm = 0.5) {
  let ra = n0, rb = n1;
  if (ra + (rb - ra) * tm < nm) { const fehl = nm - (ra + (rb - ra) * tm); ra += fehl; rb += fehl * 0.5; }
  return [ra, rb];
}

/** Rumpf-Kleidung: unten Becken, ab der Taille Torso. */
export function rumpfGewichte(K) {
  const y0 = K.P('torso')[1];
  return (x, y) => { const t = stufe(y0 - 0.05 * K.g, y0 + 0.08 * K.g, y); return { becken: 1 - t, torso: t }; };
}

/**
 * Röcke/Roben/Schöße: oben Becken, nach unten zunehmend die Hüfte der eigenen Seite (links +X), unterhalb der Knie leicht die Knie.
 * staerke = wie stark der Stoff den Beinen folgt (0.5 = halb).
 */
export function rockGewichte(K, staerke = 0.5) {
  const yB = K.P('becken')[1], yK = K.P('knieL')[1], h = Math.max(0.1, yB - yK), b = 0.08 * K.g;
  return (x, y) => {
    const t = Math.max(0, (yB - y) / h), s = stufe(-b, b, x);
    const hu = staerke * stufe(0, 1, Math.min(t, 1)), kn = 0.12 * stufe(1, 1.6, t);
    const be = Math.max(0.05, 1 - hu - kn);
    return { becken: be, huefteL: hu * s, huefteR: hu * (1 - s), knieL: kn * s, knieR: kn * (1 - s) };
  };
}

/**
 * Glocke mit Saum (Rock, Robe, Schoß, Kittelsaum): Kegel-Kapsel von oben (Mitte y, Radius) bis knapp über den Saum
 * und eine flache Saum-Scheibe, die die Unterkante sauber abschließt (Kapsel-Kuppe allein wäre eine Eiform).
 * opts: { yOben, yUnten (Saumkante), rOben, rUnten (Saumradius), tief = 0.85, farbe, saum (Farbe der Kante), knochen,
 *         hinten = 0 (Saum nach hinten versetzt → vorn offen, Mantel), rauh, glatt = 0.03 }
 */
export function glocke(form, K, { yOben, yUnten, rOben, rUnten, tief = 0.85, farbe, saum = farbe, knochen, hinten = 0, rauh = 0, glatt = 0.03, z0 = 0, schnitt = false }) {
  const r = rauh ? { rauh, rauhSkala: 22 } : {}, g = K.g;
  if (schnitt) {
    // Kegel bis unter den Saum, Kuppe flach abschneiden (schneidet auch Beine/Füße darunter – die baut der Aufrufer danach neu)
    const rB = rUnten, yE = yUnten - 0.01 * g;
    form.kapsel([0, yOben, z0], [0, yE, z0 - hinten], rOben, rB, { knochen, farbe, glatt, tief, ...r });
    const tiefe = rB + 0.03 * g;
    form.rundbox([0, yUnten - tiefe / 2, z0 - hinten], [rB + 0.03 * g, tiefe / 2, rB * tief + 0.03 * g], 0.01 * g, { abzug: true, knochen, farbe, glatt: 0.008 * g });
    const hs = 0.016 * g;
    form.ellipsoid([0, yUnten + hs * 0.6, z0 - hinten], [rB + 0.009 * g, hs, rB * tief + 0.009 * g], { knochen, farbe: saum, glatt: 0.008 * g });
    return form;
  }
  const rB = rUnten * 0.94, yB = yUnten + rB * 0.8;
  form.kapsel([0, yOben, z0], [0, Math.min(yB, yOben - 0.01), z0 - hinten], rOben, rB, { knochen, farbe, glatt, tief, ...r });
  const hs = 0.02 * g;
  form.ellipsoid([0, yUnten + hs, z0 - hinten], [rUnten, hs, rUnten * tief], { knochen, farbe: saum, glatt: 0.03 * g });
  return form;
}
