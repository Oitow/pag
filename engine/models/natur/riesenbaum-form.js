/**
 * @modul    riesenbaum-form
 * @zweck    Reine Form eines Urwald-Riesen in echter Größe (ohne THREE): Stamm-Achse, Brettwurzeln, optionaler Wurzelbogen als SDF, dazu Maße und Kronen-Skelett
 * @api      baueForm({ seed, hoehe = 110, stammRadius = 5.5, wurzeln = 7, wurzelWeite = 22, detail = 1, bogen = false }) -> { opts, sdf, naht, achse(y,out), radius(y), stoer(x,y,z), furche(x,y,z) -> 0..1, wurzeln [{ punkte, radien, streck, laenge, winkel }], krone { aeste, buschel, kronenRadius }, masse { hoehe, stammRadius, kronenAb, kronenRadius, grenzen, bogen? } }
 * @beispiel
 *   import { baueForm } from '../../engine/models/natur/riesenbaum-form.js';
 *   const form = baueForm({ seed: 7, bogen: true });
 *   form.sdf.abstand(0, 5, 0) < 0;                 // im Stamm
 *   form.masse.bogen.mitte;                         // [x, 0, z] – hier führt der Pfad unter der Wurzel durch
 * @tags     natur, baum, riesenbaum, urwald, sdf, wurzel, form, prozedural, daemmerwald
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { rng, hashSeed } from '../../core/rng.js';
import { createNoise3D } from '../../core/noise.js';
import { createSdf } from '../../core/sdf.js';
import { baueKrone, glaette } from './riesenbaum-krone.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const stufe = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** Skelett + SDF bauen. Baumfuß = Ursprung, y oben, Meter. Deterministisch für die Optionen. */
export function baueForm(optionen = {}) {
  const o = { seed: 1, hoehe: 110, stammRadius: 5.5, wurzeln: 7, wurzelWeite: 22, detail: 1, bogen: false, ...optionen };
  const H = o.hoehe, R = o.stammRadius, q = R / 5.5, TAU = Math.PI * 2;
  const r = rng(hashSeed('riesenbaum', o.seed, o.bogen ? 1 : 0));
  const rr = (a, b) => a + (b - a) * r();
  const n3 = createNoise3D(hashSeed('riesenbaum-rinde', o.seed));
  const kronenAb = H * 0.55, naht = Math.min(30, Math.round(H * 0.28 / 3) * 3);

  // ---- Stamm: leichte Neigung + S-Schwung, unten ausladend, nach oben verjüngt ----
  const nw = rr(0, TAU), sw = rr(0, TAU), sph = rr(0, TAU), neig = rr(1.5, 3.5) * (H / 110), schwung = rr(0.8, 1.7) * q;
  const achse = (y, out = [0, 0]) => {
    const t = clamp(y / H, 0, 1), a = neig * t * t, b = schwung * Math.sin(t * Math.PI * 1.7 + sph) * Math.min(1, t * 4);
    out[0] = Math.cos(nw) * a + Math.cos(sw) * b; out[1] = Math.sin(nw) * a + Math.sin(sw) * b;
    return out;
  };
  const radius = (y) => {
    const fuss = 1 + 0.24 * Math.exp(-Math.max(y, -3) / 7);
    const schlank = y < kronenAb ? 1 - 0.22 * Math.max(0, y) / kronenAb : 0.78 - 0.68 * Math.pow(clamp((y - kronenAb) / (H * 0.97 - kronenAb), 0, 1), 1.15);
    return R * fuss * schlank;
  };

  // ---- Rinde: tiefe, senkrecht gestreckte Furchen mit Drehwuchs + breite Rippen + Beulen (wird zum Abstand addiert) ----
  const drall = rr(0.008, 0.016) * (r() < 0.5 ? -1 : 1);
  const furche = (x, y, z) => {
    const c = Math.cos(drall * y), s = Math.sin(drall * y);
    const f = 1 - Math.abs(n3((x * c - z * s) * 0.8, y * 0.1, (x * s + z * c) * 0.8));
    return f * f * f * f;
  };
  const stoer = (x, y, z) => {
    const c = Math.cos(drall * y), s = Math.sin(drall * y), xr = x * c - z * s, zr = x * s + z * c;
    let f = 1 - Math.abs(n3(xr * 0.8, y * 0.1, zr * 0.8)); f *= f; f *= f;
    const w = 1 - 0.6 * stufe(R * 1.4, R * 3.2, Math.hypot(x, z));
    return (0.3 * f - 0.06 + 0.32 * n3(xr * 0.2 + 7, y * 0.03, zr * 0.2) + 0.12 * n3(x * 0.45, y * 0.45 + 3, z * 0.45)) * w * q;
  };

  const sdf = createSdf({ glatt: 0.9 * q });
  const wurzeln = [];

  /** Eine Wurzel: hochkant-elliptische Kette (Brettwurzel), die zum Ende hin flach wird und abtaucht; darunter ein breiter, weicher Sockel. */
  function wurzel({ x0, z0, winkel, laenge, hoch, potenz = 2.3, lin, r0, r1 = 0.4 * q, maeander = 0, punkte = 9, sockel = true }) {
    const ph = rr(0, TAU), fq = rr(0.9, 1.6), wph = rr(0, TAU), cw = Math.cos(winkel), swi = Math.sin(winkel);
    const P = [], rad = [], streck = [], obenY = [];
    for (let i = 0; i < punkte; i++) {
      const s = i / (punkte - 1), weg = laenge * s, seit = maeander * Math.sin(s * Math.PI * fq + ph) * s;
      const oben = hoch * Math.pow(1 - s, potenz) + lin * (1 - s) + 0.4 * q * Math.sin(s * 9 + wph) * s * (1 - s) * 4 - 1.0 * stufe(0.8, 1, s);
      const rw = r0 + (r1 - r0) * Math.pow(s, 0.8), hv = Math.max(rw, (oben + 0.8) / 2);
      P.push([x0 + cw * weg - swi * seit, oben - hv, z0 + swi * weg + cw * seit]); rad.push(rw); streck.push(hv / rw); obenY.push(oben);
    }
    sdf.kette(P, rad, { streckY: streck });
    if (sockel) {
      const SP = [], SR = [];
      for (const s of [0.08, 0.3, 0.52, 0.74]) {
        const f = s * (punkte - 1), i = Math.min(punkte - 2, Math.floor(f)), t = f - i, rs = (rad[i] + (rad[i + 1] - rad[i]) * t) * 1.4 + 0.25 * q;
        SP.push([P[i][0] + (P[i + 1][0] - P[i][0]) * t, -0.42 * rs, P[i][2] + (P[i + 1][2] - P[i][2]) * t]); SR.push(rs);
      }
      sdf.kette(SP, SR, { glatt: 1.3 * q });
    }
    const w = { punkte: P, radien: rad, streck, oben: obenY, laenge, winkel };
    wurzeln.push(w);
    return w;
  }

  // ---- Hauptwurzeln rundum, dazwischen kurze Anläufe, ein paar Gabelungen ----
  const n = Math.max(3, o.wurzeln | 0), phase = rr(0, TAU), bogenW = phase;
  const nahBogen = (w) => o.bogen && Math.abs(Math.atan2(Math.sin(w - bogenW), Math.cos(w - bogenW))) < 0.62;
  for (let i = 0; i < n; i++) {
    const w = phase + ((i + (i ? rr(-0.28, 0.28) : 0)) / n) * TAU;
    if (o.bogen && i === 0) continue;
    const nachbar = o.bogen && (i === 1 || i === n - 1);
    const L = nachbar ? rr(14, 16) : clamp(o.wurzelWeite * rr(0.7, 1.26), 15, 28);
    const start = R * 0.5, haupt = wurzel({ x0: Math.cos(w) * start, z0: Math.sin(w) * start, winkel: w, laenge: L + R - start, hoch: rr(6.5, 10.5) * q, lin: 1.1 * q,
      r0: rr(1.3, 1.8) * q, maeander: nachbar ? (i === 1 ? 2.5 : -2.5) : rr(-3.8, 3.8) });
    if (!nachbar && L > 17 && r() < 0.75) {                         // Gabelung: Seitenwurzel zweigt auf halbem Weg ab
      const k = 3 + (r() < 0.5 ? 0 : 1), a = haupt.punkte[k], b = haupt.punkte[k + 1], seite = r() < 0.5 ? -1 : 1;
      const ww = Math.atan2(b[2] - a[2], b[0] - a[0]) + seite * rr(0.45, 0.85);
      if (!nahBogen(ww)) wurzel({ x0: a[0], z0: a[2], winkel: ww, laenge: L * rr(0.36, 0.5), hoch: 0, lin: haupt.oben[k] * 0.92, r0: haupt.radien[k] * 0.85, maeander: rr(-1.5, 1.5), punkte: 6 });
    }
    const wz = w + (TAU / n) * rr(0.4, 0.6);                        // kurzer Anlauf zwischen zwei Hauptwurzeln
    if (!nahBogen(wz)) wurzel({ x0: Math.cos(wz) * start, z0: Math.sin(wz) * start, winkel: wz, laenge: rr(6, 10.5) * q + R - start, hoch: rr(2.5, 5) * q, potenz: 2, lin: 0.6 * q,
      r0: rr(0.9, 1.25) * q, maeander: rr(-1.2, 1.2), punkte: 6, sockel: false });
  }

  // ---- Wurzelbogen: verlässt den Stamm in ~11 m Höhe, spannt sich weit hinaus und fußt wieder im Boden ----
  let bogenFuss = 0;
  if (o.bogen) {
    const qb = Math.max(1, q), cw = Math.cos(bogenW), sw2 = Math.sin(bogenW);
    const profil = [[R * 0.4, 10.5, 2.0], [R + 2.5, 12.2, 1.75], [R + 6.5, 11.8, 1.55], [R + 10.2, 9.6, 1.45], [R + 13, 6, 1.4], [R + 14.6, 2, 1.5], [R + 15.4, -2.5, 1.7]];
    const fein = glaette(profil.map(([rho, y, rad], i) => { const seit = 1.2 * Math.sin((i / 6) * Math.PI); return [cw * rho * qb - sw2 * seit, y * qb, sw2 * rho * qb + cw * seit, rad * qb]; }), 3);
    sdf.kette(fein, fein.map((p) => p[3]), { glatt: 1.6 * q });
    bogenFuss = (R + 15) * qb;
    const fx = cw * bogenFuss, fz = sw2 * bogenFuss;
    sdf.ellipsoid([fx, -0.9, fz], [2.6 * qb, 2.0 * qb, 2.6 * qb], 1.4 * q);
    for (const d of [-0.75, 0.05, 0.8]) wurzel({ x0: fx, z0: fz, winkel: bogenW + d + rr(-0.15, 0.15), laenge: rr(5, 8), hoch: 0, lin: 1.7 * qb, r0: 1.0 * qb, maeander: rr(-1, 1), punkte: 5, sockel: false });
  }

  // ---- Stamm zuletzt (seine große Glättung verschmilzt alle Wurzeln weich mit ihm), dann die Rinde ----
  const SP = [], SR = [], a2 = [0, 0];
  for (let y = -3; y <= naht + 6; y += 3) { achse(y, a2); SP.push([a2[0], y, a2[1]]); SR.push(radius(y)); }
  sdf.kette(SP, SR, { glatt: 1.7 * q });
  sdf.stoerung(stoer, 0.75 * q);

  const krone = baueKrone({ H, R, kronenAb, achse, radius, detail: o.detail, r });
  const g = sdf.grenzen(), kr = krone.kronenRadius;
  const masse = { hoehe: H, stammRadius: R, kronenAb, kronenRadius: kr,
    grenzen: { min: [Math.min(g.min[0], -kr), -1.2, Math.min(g.min[2], -kr)], max: [Math.max(g.max[0], kr), H + 4, Math.max(g.max[2], kr)] } };
  if (o.bogen) masse.bogen = messeBogen(sdf, bogenW, R * 1.05, bogenFuss);
  return { opts: o, sdf, naht, achse, radius, stoer, furche, wurzeln, krone, masse };
}

/** Lichte Öffnung unter dem Wurzelbogen ausmessen (im SDF abgetastet): wo sind ≥ 4.5 m Kopfhöhe frei? */
export function messeBogen(sdf, winkel, rhoA, rhoB, kopf = 4.5) {
  const cw = Math.cos(winkel), sw = Math.sin(winkel);
  const frei = (rho) => {
    const x = cw * rho, z = sw * rho;
    if (sdf.abstand(x, 0.5, z) < 0.1) return 0;
    for (let y = 0.7; y < 16; y += 0.2) if (sdf.abstand(x, y, z) < 0) return y;
    return 16;
  };
  let a = NaN, b = NaN, start = NaN;
  for (let rho = rhoA; rho <= rhoB; rho += 0.25) {
    const ok = frei(rho) >= kopf;
    if (ok && start !== start) start = rho;
    if ((!ok || rho + 0.25 > rhoB) && start === start) { if (!(b - a >= rho - start)) { a = start; b = rho - (ok ? 0 : 0.25); } start = NaN; }
  }
  const m = a === a ? (a + b) / 2 : (rhoA + rhoB) / 2;
  let hoehe = 16;
  for (let d = -2.5; d <= 2.5; d += 0.5) hoehe = Math.min(hoehe, frei(m + d));
  return { winkel, mitte: [cw * m, 0, sw * m], achse: [-sw, 0, cw], quer: [cw, 0, sw], lichteHoehe: hoehe, lichteWeite: a === a ? b - a : 0 };
}
