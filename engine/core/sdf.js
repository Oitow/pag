/**
 * @modul    sdf
 * @zweck    Abstandsfelder (SDF) aus Kapseln, Kugeln, Ellipsoiden und Ketten, weich vereinigt (smooth-min) – formt organische Körper wie Wurzeln und Stämme
 * @api      createSdf({ glatt }) -> { kapsel(a,b,ra,rb?,glatt?), kugel(m,r,glatt?), ellipsoid(m,radien,glatt?), kette(punkte,radien,{glatt,streckY}?), abzugKugel(m,r,glatt?), stoerung(fn,maxBetrag?), abstand(x,y,z) -> m, normale(x,y,z,out,eps?) -> out, grenzen() -> {min,max}, eingrenzen(min,max,rand?) -> anzahl, anzahl, spiel }
 * @beispiel
 *   import { createSdf } from '../../engine/core/sdf.js';
 *   const sdf = createSdf({ glatt: 0.8 });
 *   sdf.kapsel([0, 0, 0], [0, 10, 0], 2, 1.5);            // Stamm
 *   sdf.kette([[1, 2, 0], [5, 0.5, 1], [9, -0.5, 0]], [1, 0.6, 0.3]);   // Wurzel, in sich hart, zum Rest weich
 *   const d = sdf.abstand(3, 1, 0);                        // < 0 = innen
 * @tags     sdf, abstandsfeld, form, organisch, smooth-min, welt, modell
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */

// Je Körper S Zahlen: typ, gruppe, glatt, a(3), b(3), ra, rb, fa, fb, 1/|b-a|², min(3), max(3)
const S = 20;
const KAPSEL = 0, ELLIPSOID = 1, ABZUG = 2;

/** Weiche Vereinigung zweier Abstände (polynomial). k = Breite der Verschmelzung in m. */
export function weichMin(a, b, k) {
  const h = k - Math.abs(a - b);
  return h > 0 ? Math.min(a, b) - (h * h) / (4 * k) : Math.min(a, b);
}

/** SDF-Baukasten. Körper werden in Einfüge-Reihenfolge weich vereinigt; eine Kette ist in sich hart (keine Beulen an den Gelenken). */
export function createSdf({ glatt = 0.6 } = {}) {
  const P = [];
  const stoer = [];
  let n = 0, gruppen = 0, kMax = 0, spiel = 0;
  let aktiv = null, aktivN = 0;                    // eingegrenzte Körperliste (Indizes) oder null = alle

  function plus(typ, gruppe, k, ax, ay, az, bx, by, bz, ra, rb, fa, fb) {
    k = Math.max(1e-4, k ?? glatt);
    const l2 = (bx - ax) ** 2 + (by - ay) ** 2 + (bz - az) ** 2;
    const r = Math.max(ra, rb), ry = typ === ELLIPSOID ? rb : r * Math.max(1, fa, fb), rx = typ === ELLIPSOID ? ra : r, rz = typ === ELLIPSOID ? fa : r;
    P.push(typ, gruppe, k, ax, ay, az, bx, by, bz, ra, rb, fa, fb, l2 > 0 ? 1 / l2 : 0,
      Math.min(ax, bx) - rx, Math.min(ay, by) - ry, Math.min(az, bz) - rz, Math.max(ax, bx) + rx, Math.max(ay, by) + ry, Math.max(az, bz) + rz);
    n++; aktiv = null;
    if (k > kMax) kMax = k;
  }

  function einzel(o, x, y, z) {
    const typ = P[o];
    if (typ === ELLIPSOID) {
      const px = x - P[o + 3], py = y - P[o + 4], pz = z - P[o + 5], rx = P[o + 9], ry = P[o + 10], rz = P[o + 11];
      const k0 = Math.hypot(px / rx, py / ry, pz / rz), k1 = Math.hypot(px / (rx * rx), py / (ry * ry), pz / (rz * rz));
      return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry, rz);
    }
    const ax = P[o + 3], ay = P[o + 4], az = P[o + 5];
    const pax = x - ax, pay = y - ay, paz = z - az, bax = P[o + 6] - ax, bay = P[o + 7] - ay, baz = P[o + 8] - az;
    let t = (pax * bax + pay * bay + paz * baz) * P[o + 13];
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ra = P[o + 9], fa = P[o + 11];
    const dx = pax - bax * t, dy = (pay - bay * t) / (fa + (P[o + 12] - fa) * t), dz = paz - baz * t;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) - (ra + (P[o + 10] - ra) * t);
  }

  /** Abstand zur Oberfläche in m (innen negativ). */
  function abstand(x, y, z) {
    let acc = 1e9, g = 1e9, gk = 1, gid = -1;
    const anz = aktiv ? aktivN : n;
    for (let i = 0; i < anz; i++) {
      const o = (aktiv ? aktiv[i] : i) * S;
      const d = einzel(o, x, y, z);
      if (P[o] === ABZUG) {
        if (gid >= 0) { acc = weichMin(acc, g, gk); gid = -1; g = 1e9; }
        acc = -weichMin(-acc, d, P[o + 2]);          // weiches Maximum mit dem Äußeren der Kugel
      } else if (P[o + 1] !== gid) {
        if (gid >= 0) acc = weichMin(acc, g, gk);
        gid = P[o + 1]; g = d; gk = P[o + 2];
      } else if (d < g) g = d;
    }
    if (gid >= 0) acc = weichMin(acc, g, gk);
    for (let i = 0; i < stoer.length; i++) acc += stoer[i](x, y, z);
    return acc;
  }

  const api = {
    /** Kapsel von a nach b mit Radien ra → rb (verjüngt). */
    kapsel(a, b, ra, rb = ra, k) { plus(KAPSEL, gruppen++, k, a[0], a[1], a[2], b[0], b[1], b[2], ra, rb, 1, 1); return api; },
    kugel(m, r, k) { plus(KAPSEL, gruppen++, k, m[0], m[1], m[2], m[0], m[1], m[2], r, r, 1, 1); return api; },
    /** Achsparalleles Ellipsoid (Näherung, an der Oberfläche genau). */
    ellipsoid(m, radien, k) { plus(ELLIPSOID, gruppen++, k, m[0], m[1], m[2], m[0], m[1], m[2], radien[0], radien[1], radien[2], 1); return api; },
    /** Kette aus Kapseln durch punkte; in sich hart vereinigt, als Ganzes weich. streckY > 1 = hochkant-elliptischer Querschnitt (Brettwurzel). */
    kette(punkte, radien, { glatt: k, streckY = 1 } = {}) {
      const g = gruppen++, r = (i) => (typeof radien === 'number' ? radien : radien[i]), f = (i) => (typeof streckY === 'number' ? streckY : streckY[i]);
      for (let i = 0; i + 1 < punkte.length; i++) {
        const a = punkte[i], b = punkte[i + 1];
        plus(KAPSEL, g, k, a[0], a[1], a[2], b[0], b[1], b[2], r(i), r(i + 1), f(i), f(i + 1));
      }
      return api;
    },
    /** Weiche Aushöhlung: zieht eine Kugel ab. */
    abzugKugel(m, r, k) {
      plus(ABZUG, gruppen++, k, m[0], m[1], m[2], m[0], m[1], m[2], r, r, 1, 1);
      return api;
    },
    /** fn(x,y,z) -> m wird zum Abstand addiert (Rinde, Furchen). maxBetrag = größter |Wert| (für Ränder und Beschleunigung). */
    stoerung(fn, maxBetrag = 0.5) { stoer.push(fn); spiel += maxBetrag; return api; },
    abstand,
    /** Einheitsnormale (zeigt nach außen) aus dem Gradienten. */
    normale(x, y, z, out = [0, 0, 0], eps = 0.05) {
      const nx = abstand(x + eps, y, z) - abstand(x - eps, y, z);
      const ny = abstand(x, y + eps, z) - abstand(x, y - eps, z);
      const nz = abstand(x, y, z + eps) - abstand(x, y, z - eps);
      const l = Math.hypot(nx, ny, nz) || 1;
      out[0] = nx / l; out[1] = ny / l; out[2] = nz / l;
      return out;
    },
    /** Umgebender Quader aller Körper (mit etwas Rand). */
    grenzen() {
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < n; i++) {
        if (P[i * S] === ABZUG) continue;
        for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], P[i * S + 14 + a]); max[a] = Math.max(max[a], P[i * S + 17 + a]); }
      }
      const rand = 0.25 * kMax + spiel + 0.05;
      return n ? { min: min.map((v) => v - rand), max: max.map((v) => v + rand) } : { min: [0, 0, 0], max: [0, 0, 0] };
    },
    /**
     * Beschleunigung: wertet ab jetzt nur Körper aus, die den Quader (plus Rand) beeinflussen können. eingrenzen(null) hebt das auf.
     * Innerhalb des Quaders bleibt der Abstand nahe der Oberfläche (|d| ≤ rand) exakt.
     */
    eingrenzen(min, max, rand = 0) {
      if (!min) { aktiv = null; return n; }
      if (!aktiv || aktiv.length < n) aktiv = new Int32Array(n);
      const alt = aktiv; aktivN = 0;
      for (let i = 0; i < n; i++) {
        const o = i * S, e = 2 * P[o + 2] + rand + spiel;
        if (P[o + 14] - e > max[0] || P[o + 17] + e < min[0] || P[o + 15] - e > max[1] || P[o + 18] + e < min[1] || P[o + 16] - e > max[2] || P[o + 19] + e < min[2]) continue;
        alt[aktivN++] = i;
      }
      return aktivN;
    },
    get anzahl() { return n; },
    /** Summe der Störungs-Beträge (so weit kann die Oberfläche von den reinen Körpern abweichen). */
    get spiel() { return spiel; },
  };
  return api;
}
